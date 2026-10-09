/**
 * 模块版本更新：新旧模型差异比对 + 失效合并（纯逻辑，不碰 fs）。
 *
 * 场景：模块代码出新版本后，analyze 得到新 model；与产物目录既有 design json
 * （=旧 model + 已生成内容）按锚点比对，输出四类清单（未变/变更/新增/删除），
 * 并产出「合并 design json」= 新 model 整体打底 + 未变条目回挂已生成内容
 * （含人工修订痕迹），变更/新增条目 generated 清空待 gen --resume 重生。
 *
 * 锚点口径：
 *  - 函数：sigHash（签名归一哈希）+ bodyHash（注释剥离+空白归一函数体哈希）——
 *    行号移动/注释改动不算变更；签名变优先报 sig，否则 body。
 *  - 类型/外部接口/配置宏：模型侧字段稳定 JSON 比对（剔除 generated/polarion/行号等噪声字段）。
 *
 * 失效规则：
 *  - 函数级变更（provided/internal 任一 changed/added/removed）→ dynamicDesign（状态机+序列图）
 *    整节失效重生（图结构跨函数联动，局部保留无意义）。
 *  - 任何变更 → functionalDescription（5.1 模块功能描述）失效重生。
 *  - document 节恒失效（确定性零 LLM，gen 末尾全量重物化）。
 *  - interfaceOverview/callGraphs 的 diagramPng：图 mermaid 源码一致才回挂（分析期确定性产物，
 *    源码不同则 PNG 必过期）。
 */
import type {
  ModuleModel, FunctionUnit, TypeUnit, ExternalInterface, ConfigMacro,
} from '../model/types.js';

export interface NameChanges {
  unchanged: string[];
  changed: string[];
  added: string[];
  removed: string[];
}

export interface FunctionChange {
  name: string;
  kind: 'sig' | 'body';   // sig=签名变更（接口变化，评审重点关注）；body=仅实现变更
}

export interface ModuleDiff {
  module: string;
  oldAnalyzedAt: string;
  newAnalyzedAt: string;
  functions: { unchanged: string[]; changed: FunctionChange[]; added: string[]; removed: string[] };
  types: NameChanges;
  externals: NameChanges;
  configs: NameChanges;
  /** 函数级变更 → 动态设计（状态机+序列图）整节失效 */
  dynamicInvalidated: boolean;
  /** 任何变更 → 5.1 模块功能描述失效 */
  descriptionInvalidated: boolean;
  hasChanges: boolean;
}

/** 稳定 JSON：剔噪后序列化（键排序防字段序漂移） */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : 1));
    }
    return val;
  });
}

function diffByName<T extends { name: string }>(
  oldList: T[], newList: T[], keyOf: (x: T) => string,
): NameChanges {
  const oldMap = new Map(oldList.map(x => [x.name, keyOf(x)]));
  const newMap = new Map(newList.map(x => [x.name, keyOf(x)]));
  const r: NameChanges = { unchanged: [], changed: [], added: [], removed: [] };
  for (const [name, key] of newMap) {
    if (!oldMap.has(name)) r.added.push(name);
    else if (oldMap.get(name) === key) r.unchanged.push(name);
    else r.changed.push(name);
  }
  for (const name of oldMap.keys()) {
    if (!newMap.has(name)) r.removed.push(name);
  }
  return r;
}

const fnKey = (f: FunctionUnit): string => `${f.sigHash}|${f.bodyHash}`;
const typeKey = (t: TypeUnit): string =>
  stable({ kind: t.kind, underlyingType: t.underlyingType, elements: t.elements, relatedDefines: t.relatedDefines, comment: t.comment });
const extKey = (e: ExternalInterface): string =>
  stable({ signature: e.signature, group: e.group, comment: e.comment, commentSource: e.commentSource });
const cfgKey = (c: ConfigMacro): string =>
  stable({ value: c.value, isFunctionLike: c.isFunctionLike, kind: c.kind, comment: c.comment });

export function diffModules(oldDesign: ModuleModel, newModel: ModuleModel): ModuleDiff {
  const oldFns = [...oldDesign.providedFunctions, ...oldDesign.internalFunctions];
  const newFns = [...newModel.providedFunctions, ...newModel.internalFunctions];
  const fnNames = diffByName(oldFns, newFns, fnKey);
  const oldSig = new Map(oldFns.map(f => [f.name, f.sigHash]));
  const changed: FunctionChange[] = fnNames.changed.map(name => ({
    name,
    kind: oldSig.get(name) !== newFns.find(f => f.name === name)?.sigHash ? 'sig' : 'body',
  }));

  const types = diffByName(oldDesign.types, newModel.types, typeKey);
  const externals = diffByName(oldDesign.calledExternalFunctions, newModel.calledExternalFunctions, extKey);
  const configs = diffByName(oldDesign.configMacros, newModel.configMacros, cfgKey);

  const dynamicInvalidated = changed.length + fnNames.added.length + fnNames.removed.length > 0;
  const hasChanges = dynamicInvalidated
    || types.changed.length + types.added.length + types.removed.length > 0
    || externals.changed.length + externals.added.length + externals.removed.length > 0
    || configs.changed.length + configs.added.length + configs.removed.length > 0;

  return {
    module: newModel.module,
    oldAnalyzedAt: oldDesign.analyzedAt,
    newAnalyzedAt: newModel.analyzedAt,
    functions: { unchanged: fnNames.unchanged, changed, added: fnNames.added, removed: fnNames.removed },
    types, externals, configs,
    dynamicInvalidated,
    descriptionInvalidated: hasChanges,
    hasChanges,
  };
}

/** 合并产出新 design json：新 model 打底 + 未变条目回挂 generated。返回新对象，不改入参。 */
export function applyModuleDiff(newModel: ModuleModel, oldDesign: ModuleModel, diff: ModuleDiff): ModuleModel {
  const merged = JSON.parse(JSON.stringify(newModel)) as ModuleModel;

  const carry = <T extends { name: string; generated?: unknown }>(
    newList: T[], oldList: T[], keep: Set<string>,
  ): void => {
    const oldMap = new Map(oldList.map(x => [x.name, x]));
    for (const item of newList) {
      const old = oldMap.get(item.name);
      if (old && keep.has(item.name) && old.generated) item.generated = old.generated;
    }
  };

  const fnKeep = new Set(diff.functions.unchanged);
  carry(merged.providedFunctions, oldDesign.providedFunctions, fnKeep);
  carry(merged.internalFunctions, oldDesign.internalFunctions, fnKeep);
  carry(merged.types, oldDesign.types, new Set(diff.types.unchanged));
  carry(merged.calledExternalFunctions, oldDesign.calledExternalFunctions, new Set(diff.externals.unchanged));
  carry(merged.configMacros, oldDesign.configMacros, new Set(diff.configs.unchanged));

  // 5.1 模块功能描述：无任何变更才保留
  if (!diff.descriptionInvalidated && oldDesign.functionalDescription) {
    merged.functionalDescription = oldDesign.functionalDescription;
  }
  // 动态设计：函数级无变更才整节保留
  if (!diff.dynamicInvalidated && oldDesign.dynamicDesign) {
    merged.dynamicDesign = oldDesign.dynamicDesign;
  }
  // document 节恒失效（gen 末尾确定性重物化）
  delete merged.document;
  // 结构版本沿用（分析产物可能不带，design json 以旧版/常量为准）
  if (merged.schemaVersion === undefined && oldDesign.schemaVersion !== undefined) {
    merged.schemaVersion = oldDesign.schemaVersion;
  }
  // 图源一致的 PNG 物化回挂（分析期确定性产物，图源同则渲染同）
  if (merged.interfaceOverview && oldDesign.interfaceOverview
    && merged.interfaceOverview.diagram === oldDesign.interfaceOverview.diagram) {
    const png = oldDesign.interfaceOverview.diagramPng;
    if (png) merged.interfaceOverview.diagramPng = png;
  }
  if (merged.callGraphs && oldDesign.callGraphs) {
    const oldCg = new Map(oldDesign.callGraphs.map(g => [g.name, g]));
    for (const g of merged.callGraphs) {
      const old = oldCg.get(g.name);
      if (old && old.diagram === g.diagram && old.diagramPng) g.diagramPng = old.diagramPng;
    }
  }
  return merged;
}
