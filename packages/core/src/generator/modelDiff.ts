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
 *  - 类型/外部接口/配置宏：模型侧字段稳定 JSON 比对（剔除 generated/polarion/行号等噪声字段，
 *    并深剥 comment/commentSource——注释不是代码语义，且旧产物注释可能被管线富化过，参与比对
 *    会在工具版本升级后造成全量误报；未变条目的旧注释在合并时回挂，防报告显示回退）。
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

/**
 * 深剥注释类字段（comment/commentSource）——注释不是代码语义（与 bodyHash 剥离注释同口径），
 * 且旧产物里的注释可能被管线富化/推断过，参与比对会造成工具版本升级后的全量误报。
 * （当前三个键构造函数均已按语义字段白名单取值，本函数备用。）
 */
function stripComments<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripComments) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k !== 'comment' && k !== 'commentSource') o[k] = stripComments(val);
    }
    return o as T;
  }
  return v;
}
void stripComments;

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
// 类型语义键：枚举元素/关联宏只取代码语义字段（名/型/值），
// 剔除 file/polarion/kind/usages/affects 等工具版本元数据（旧产物缺字段或章节号不同会误报）
const typeKey = (t: TypeUnit): string =>
  stable({
    kind: t.kind,
    underlyingType: t.underlyingType,
    elements: (t.elements ?? []).map(e => ({ name: e.name, type: e.type })),
    relatedDefines: (t.relatedDefines ?? []).map(d => ({ name: d.name, value: d.value })),
  });
const extKey = (e: ExternalInterface): string =>
  stable({ signature: e.signature, group: e.group });
const cfgKey = (c: ConfigMacro): string =>
  stable({ value: c.value, isFunctionLike: c.isFunctionLike, kind: c.kind });

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

  const carry = <T extends { name: string; generated?: unknown; comment?: unknown; commentSource?: unknown }>(
    newList: T[], oldList: T[], keep: Set<string>,
  ): void => {
    const oldMap = new Map(oldList.map(x => [x.name, x]));
    for (const item of newList) {
      const old = oldMap.get(item.name);
      if (old && keep.has(item.name)) {
        if (old.generated) item.generated = old.generated;
        // 条目语义未变 → 旧注释（可能被管线富化/推断过）仍然准确，回挂防显示回退
        if (old.comment !== undefined && old.comment !== null) item.comment = old.comment;
        if (old.commentSource !== undefined) item.commentSource = old.commentSource;
      }
    }
  };

  const fnKeep = new Set(diff.functions.unchanged);
  carry(merged.providedFunctions, oldDesign.providedFunctions, fnKeep);
  carry(merged.internalFunctions, oldDesign.internalFunctions, fnKeep);
  carry(merged.types, oldDesign.types, new Set(diff.types.unchanged));
  // 未变类型的枚举元素/关联宏整体回挂（子注释可能富化过，语义未变则旧值仍准确）
  {
    const oldMap = new Map(oldDesign.types.map(t => [t.name, t]));
    const keep = new Set(diff.types.unchanged);
    for (const t of merged.types) {
      const old = oldMap.get(t.name);
      if (old && keep.has(t.name)) {
        if (old.elements) t.elements = old.elements;
        if (old.relatedDefines) t.relatedDefines = old.relatedDefines;
      }
    }
  }
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

/* ================= Polarion 同步清单 =================
 * 把 diff 四类清单翻译成 Polarion 操作单：新增→新建工作项、变更→更新内容、删除→移除，
 * 并对「删除+新增」做疑似改名配对（名称 LCS 相似度，语义键相同加权）——
 * 改名建议改原工作项 title+内容，保留历史与追溯链接，而非删了重建。
 */

export type SyncAction = 'create' | 'update' | 'delete' | 'rename';

export interface SyncOperation {
  action: SyncAction;
  kind: 'function' | 'type' | 'external' | 'config';
  chapter: string;            // 报告章节号=Polarion 文档定位锚点
  title: string;              // 工作项 title（rename 时为新名）
  from?: string;              // rename 时的旧名
  detail: string;             // 中文操作建议
}

export interface PolarionSync {
  module: string;
  oldAnalyzedAt: string;
  newAnalyzedAt: string;
  operations: SyncOperation[];
  /** 未变条目数（Polarion 侧零操作） */
  untouched: { functions: number; types: number; externals: number; configs: number };
}

/** LCS 相似度（Dice 口径 2·LCS/(m+n)：一方含另一方时得分高；名字短，O(n·m) 够用） */
function lcsRatio(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return (2 * prev[n]) / (m + n);
}

/** 疑似改名配对：removed × added 贪心取相似度最高对，≥0.8 或语义键相同（加权 0.95） */
function pairRenames(
  removed: string[], added: string[], semKeyOf: (name: string, isOld: boolean) => string | undefined,
): { pairs: [string, string][]; loneRemoved: string[]; loneAdded: string[] } {
  const cands: { r: string; a: string; score: number }[] = [];
  for (const r of removed) {
    for (const a of added) {
      let score = lcsRatio(r, a);
      const kr = semKeyOf(r, true), ka = semKeyOf(a, false);
      if (kr !== undefined && kr === ka) score = Math.max(score, 0.95);
      if (score >= 0.8) cands.push({ r, a, score });
    }
  }
  cands.sort((x, y) => y.score - x.score);
  const usedR = new Set<string>(), usedA = new Set<string>();
  const pairs: [string, string][] = [];
  for (const c of cands) {
    if (!usedR.has(c.r) && !usedA.has(c.a)) {
      usedR.add(c.r); usedA.add(c.a); pairs.push([c.r, c.a]);
    }
  }
  return {
    pairs,
    loneRemoved: removed.filter(r => !usedR.has(r)),
    loneAdded: added.filter(a => !usedA.has(a)),
  };
}

const RENAME_DETAIL = '疑似改名：建议直接改原工作项 title+内容，保留历史与追溯链接（勿删了重建）';

export function buildPolarionSync(diff: ModuleDiff, oldDesign: ModuleModel, newModel: ModuleModel): PolarionSync {
  const operations: SyncOperation[] = [];

  // 函数：章节按新旧模型中 provided/internal 归属判定
  const newProvided = new Set(newModel.providedFunctions.map(f => f.name));
  const oldProvided = new Set(oldDesign.providedFunctions.map(f => f.name));
  const fnChapter = (name: string, isOld: boolean): string =>
    (isOld ? oldProvided : newProvided).has(name) ? '5.2.3.2' : '5.2.4.2';
  const oldFnSig = new Map([...oldDesign.providedFunctions, ...oldDesign.internalFunctions].map(f => [f.name, f.sigHash]));
  const newFnSig = new Map([...newModel.providedFunctions, ...newModel.internalFunctions].map(f => [f.name, f.sigHash]));
  const fnPair = pairRenames(diff.functions.removed, diff.functions.added,
    (name, isOld) => (isOld ? oldFnSig : newFnSig).get(name));
  for (const [from, to] of fnPair.pairs) {
    operations.push({ action: 'rename', kind: 'function', chapter: fnChapter(to, false), title: to, from, detail: RENAME_DETAIL });
  }
  for (const name of fnPair.loneAdded) {
    operations.push({ action: 'create', kind: 'function', chapter: fnChapter(name, false), title: name, detail: '新建工作项，插入对应章节' });
  }
  for (const name of fnPair.loneRemoved) {
    operations.push({ action: 'delete', kind: 'function', chapter: fnChapter(name, true), title: name, detail: '从文档移除该工作项' });
  }
  for (const c of diff.functions.changed) {
    operations.push({
      action: 'update', kind: 'function', chapter: fnChapter(c.name, false), title: c.name,
      detail: c.kind === 'sig' ? '签名变更：更新工作项内容（接口变化，评审重点关注）' : '实现变更：更新工作项内容',
    });
  }

  // 类型/外部接口/配置宏：名称相似度配对（无语义键加权——字段变即 changed 不会落到删+增）
  const misc = (
    kind: 'type' | 'external' | 'config', chapter: string, c: NameChanges,
  ): void => {
    const p = pairRenames(c.removed, c.added, () => undefined);
    for (const [from, to] of p.pairs) {
      operations.push({ action: 'rename', kind, chapter, title: to, from, detail: RENAME_DETAIL });
    }
    for (const name of p.loneAdded) {
      operations.push({ action: 'create', kind, chapter, title: name, detail: '新建工作项，插入对应章节' });
    }
    for (const name of p.loneRemoved) {
      operations.push({ action: 'delete', kind, chapter, title: name, detail: '从文档移除该工作项' });
    }
    for (const name of c.changed) {
      operations.push({ action: 'update', kind, chapter, title: name, detail: '内容变更：更新工作项内容' });
    }
  };
  misc('type', '5.2.1.2', diff.types);
  misc('external', '5.2.2.2', diff.externals);
  misc('config', '6', diff.configs);

  // 章节号升序、同章按 删→改→建→改名 排序，照着单子从上到下干活即可
  const order: Record<SyncAction, number> = { delete: 0, update: 1, create: 2, rename: 3 };
  operations.sort((x, y) => x.chapter.localeCompare(y.chapter, undefined, { numeric: true }) || order[x.action] - order[y.action]);

  return {
    module: diff.module,
    oldAnalyzedAt: diff.oldAnalyzedAt,
    newAnalyzedAt: diff.newAnalyzedAt,
    operations,
    untouched: {
      functions: diff.functions.unchanged.length,
      types: diff.types.unchanged.length,
      externals: diff.externals.unchanged.length,
      configs: diff.configs.unchanged.length,
    },
  };
}
