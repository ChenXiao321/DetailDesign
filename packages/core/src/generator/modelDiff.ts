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
import { listStateMachines } from '../model/types.js';
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
  jsonPath?: string;          // 条目在（合并后的新）lld_design.json 中的节点路径，如 $.providedFunctions[2]；delete 不存在于新 json
  oldJsonPath?: string;       // 条目在旧 lld_design.json（diff 前）中的节点路径；create 不存在于旧 json
  content?: unknown;          // 条目在新 design json 中的节点原文（深拷贝）——拿着 sync.json 即可直接更新，无需回 design json 索引；delete 无新内容不携带
  /** 组表工作项（外部接口「<组名> 接口函数」）的成员级变化明细：组内条目增删=更新整表 */
  members?: { name: string; change: 'added' | 'removed' | 'changed'; jsonPath?: string; oldJsonPath?: string }[];
}

export interface PolarionSync {
  module: string;
  oldAnalyzedAt: string;
  newAnalyzedAt: string;
  operations: SyncOperation[];
  /** 章节级更新（非工作项粒度：5.1 描述/5.3 图/4.x 总图/7 评估表等，由失效标志与图源比对推导）。
   *  content=新内容原文（深拷贝）：分析期确定性内容（4.1 文件清单/4.2 图）diff 阶段即在场；
   *  5.1 描述/5.3 状态机序列图/7 评估表/3.x 缩写表为 gen 产物，update 流程 gen 后刷新时补入 */
  chapterUpdates: { chapter: string; title: string; reason: string; content?: unknown }[];
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

  // 节点路径：差异条目在 lld_design.json 中的定位（$.list[index] 索引路径）——
  // newModel 与写盘的合并 json 数组顺序一致（applyModuleDiff 深拷贝回挂不重排），索引直接可用。
  const idxPath = (list: { name: string }[], base: string, name: string): string | undefined => {
    const i = list.findIndex(x => x.name === name);
    return i >= 0 ? `${base}[${i}]` : undefined;
  };
  // 节点原文深拷贝：内嵌进操作单后下游可直接更新，且与模型对象脱钩
  const cloneNode = <T>(node: T | undefined): T | undefined =>
    node === undefined ? undefined : JSON.parse(JSON.stringify(node)) as T;
  const fnPath = (m: ModuleModel, name: string): string | undefined =>
    idxPath(m.providedFunctions, '$.providedFunctions', name)
    ?? idxPath(m.internalFunctions, '$.internalFunctions', name);
  const fnNode = (m: ModuleModel, name: string): FunctionUnit | undefined =>
    m.providedFunctions.find(f => f.name === name) ?? m.internalFunctions.find(f => f.name === name);
  const oldFnPath = (name: string) => fnPath(oldDesign, name);
  const newFnPath = (name: string) => fnPath(newModel, name);
  const newFnContent = (name: string) => cloneNode(fnNode(newModel, name));

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
    operations.push({ action: 'rename', kind: 'function', chapter: fnChapter(to, false), title: to, from, detail: RENAME_DETAIL, jsonPath: newFnPath(to), oldJsonPath: oldFnPath(from), content: newFnContent(to) });
  }
  for (const name of fnPair.loneAdded) {
    operations.push({ action: 'create', kind: 'function', chapter: fnChapter(name, false), title: name, detail: '新建工作项，插入对应章节', jsonPath: newFnPath(name), content: newFnContent(name) });
  }
  for (const name of fnPair.loneRemoved) {
    operations.push({ action: 'delete', kind: 'function', chapter: fnChapter(name, true), title: name, detail: '从文档移除该工作项', oldJsonPath: oldFnPath(name) });
  }
  for (const c of diff.functions.changed) {
    operations.push({
      action: 'update', kind: 'function', chapter: fnChapter(c.name, false), title: c.name,
      detail: c.kind === 'sig' ? '签名变更：更新工作项内容（接口变化，评审重点关注）' : '实现变更：更新工作项内容',
      jsonPath: newFnPath(c.name), oldJsonPath: oldFnPath(c.name), content: newFnContent(c.name),
    });
  }

  // 类型/配置宏：名称相似度配对（无语义键加权——字段变即 changed 不会落到删+增）。
  // 章节读节点自带 polarion marker（配置宏按 kind 分 6/6.1/6.2），缺失时回退默认章节
  const misc = (
    kind: 'type' | 'config', chapterOf: (name: string, isOld: boolean) => string, c: NameChanges,
    base: string, oldList: { name: string }[], newList: { name: string }[],
  ): void => {
    const newContent = (name: string) => cloneNode(newList.find(x => x.name === name));
    const p = pairRenames(c.removed, c.added, () => undefined);
    for (const [from, to] of p.pairs) {
      operations.push({ action: 'rename', kind, chapter: chapterOf(to, false), title: to, from, detail: RENAME_DETAIL, jsonPath: idxPath(newList, base, to), oldJsonPath: idxPath(oldList, base, from), content: newContent(to) });
    }
    for (const name of p.loneAdded) {
      operations.push({ action: 'create', kind, chapter: chapterOf(name, false), title: name, detail: '新建工作项，插入对应章节', jsonPath: idxPath(newList, base, name), content: newContent(name) });
    }
    for (const name of p.loneRemoved) {
      operations.push({ action: 'delete', kind, chapter: chapterOf(name, true), title: name, detail: '从文档移除该工作项', oldJsonPath: idxPath(oldList, base, name) });
    }
    for (const name of c.changed) {
      operations.push({ action: 'update', kind, chapter: chapterOf(name, false), title: name, detail: '内容变更：更新工作项内容', jsonPath: idxPath(newList, base, name), oldJsonPath: idxPath(oldList, base, name), content: newContent(name) });
    }
  };
  misc('type', () => '5.2.1.2', diff.types, '$.types', oldDesign.types, newModel.types);
  misc('config', (name, isOld) => {
    const m = (isOld ? oldDesign : newModel).configMacros.find(x => x.name === name);
    return m?.polarion?.chapter ?? '6';
  }, diff.configs, '$.configMacros', oldDesign.configMacros, newModel.configMacros);

  // 外部接口：操作按 Polarion 工作项粒度出，与报告/marker 一致——
  // Callout 每条一个工作项（6.2，title=函数名，保留疑似改名配对）；
  // 其余按组一张表（5.2.2.2，title=「<组名> 接口函数」）：组内条目增删=更新整表（content 给全新成员节点数组）、
  // 新组=新建、整组移除=删除；组间搬移对源组算删除、目标组算新增。
  {
    const EXT_BASE = '$.calledExternalFunctions';
    const oldExt = new Map(oldDesign.calledExternalFunctions.map(e => [e.name, e] as const));
    const newExt = new Map(newModel.calledExternalFunctions.map(e => [e.name, e] as const));
    const isCallout = (e: ExternalInterface | undefined): boolean => e?.polarion?.chapter === '6.2';
    const extPath = (list: ExternalInterface[], name: string) => idxPath(list, EXT_BASE, name);

    // —— Callout：单条工作项 ——
    const cRemoved = diff.externals.removed.filter(n => isCallout(oldExt.get(n)));
    const cAdded = diff.externals.added.filter(n => isCallout(newExt.get(n)));
    const cChanged = diff.externals.changed.filter(n => isCallout(newExt.get(n)));
    const cp = pairRenames(cRemoved, cAdded, () => undefined);
    for (const [from, to] of cp.pairs) {
      operations.push({ action: 'rename', kind: 'external', chapter: '6.2', title: to, from, detail: RENAME_DETAIL, jsonPath: extPath(newModel.calledExternalFunctions, to), oldJsonPath: extPath(oldDesign.calledExternalFunctions, from), content: cloneNode(newExt.get(to)) });
    }
    for (const name of cp.loneAdded) {
      operations.push({ action: 'create', kind: 'external', chapter: '6.2', title: name, detail: '新建 Callout 工作项，插入 6.2 节', jsonPath: extPath(newModel.calledExternalFunctions, name), content: cloneNode(newExt.get(name)) });
    }
    for (const name of cp.loneRemoved) {
      operations.push({ action: 'delete', kind: 'external', chapter: '6.2', title: name, detail: '从 6.2 节移除该 Callout 工作项', oldJsonPath: extPath(oldDesign.calledExternalFunctions, name) });
    }
    for (const name of cChanged) {
      operations.push({ action: 'update', kind: 'external', chapter: '6.2', title: name, detail: '签名变更：更新 Callout 工作项内容', jsonPath: extPath(newModel.calledExternalFunctions, name), oldJsonPath: extPath(oldDesign.calledExternalFunctions, name), content: cloneNode(newExt.get(name)) });
    }

    // —— 组表接口：按工作项 title 聚合 ——
    const groupTitleOf = (e: ExternalInterface | undefined): string =>
      e?.polarion?.title ?? `${e?.group ?? 'External'} 接口函数`;
    const groupMembersOf = (list: ExternalInterface[]): Map<string, string[]> => {
      const g = new Map<string, string[]>();
      for (const e of list) {
        if (isCallout(e)) continue;
        const t = groupTitleOf(e);
        const arr = g.get(t) ?? [];
        arr.push(e.name);
        g.set(t, arr);
      }
      return g;
    };
    const oldGroups = groupMembersOf(oldDesign.calledExternalFunctions);
    const newGroups = groupMembersOf(newModel.calledExternalFunctions);
    const memberEntry = (name: string, change: 'added' | 'removed' | 'changed') => ({
      name, change,
      jsonPath: change === 'removed' ? undefined : extPath(newModel.calledExternalFunctions, name),
      oldJsonPath: change === 'added' ? undefined : extPath(oldDesign.calledExternalFunctions, name),
    });
    for (const title of [...new Set([...oldGroups.keys(), ...newGroups.keys()])].sort()) {
      const oldMs = oldGroups.get(title) ?? [];
      const newMs = newGroups.get(title) ?? [];
      const added = newMs.filter(n => !oldMs.includes(n));
      const removed = oldMs.filter(n => !newMs.includes(n));
      const changed = newMs.filter(n => oldMs.includes(n) && diff.externals.changed.includes(n));
      const content = newMs.length > 0
        ? newMs.map(n => cloneNode(newExt.get(n)))
        : undefined;
      const members = [
        ...removed.map(n => memberEntry(n, 'removed')),
        ...changed.map(n => memberEntry(n, 'changed')),
        ...added.map(n => memberEntry(n, 'added')),
      ];
      if (oldMs.length === 0) {
        operations.push({ action: 'create', kind: 'external', chapter: '5.2.2.2', title, detail: `新建组表工作项（${newMs.length} 个接口）`, content, members });
      } else if (newMs.length === 0) {
        operations.push({ action: 'delete', kind: 'external', chapter: '5.2.2.2', title, detail: `整组移除（原 ${oldMs.length} 个接口）：删除该组表工作项`, members });
      } else if (added.length + removed.length + changed.length > 0) {
        const parts: string[] = [];
        if (added.length) parts.push(`新增 ${added.join('、')}`);
        if (removed.length) parts.push(`删除 ${removed.join('、')}`);
        if (changed.length) parts.push(`签名变更 ${changed.join('、')}`);
        operations.push({ action: 'update', kind: 'external', chapter: '5.2.2.2', title, detail: `组内成员变化（${parts.join('；')}）：更新整表工作项内容`, content, members });
      }
    }
  }

  // 章节号升序、同章按 删→改→建→改名 排序，照着单子从上到下干活即可
  const order: Record<SyncAction, number> = { delete: 0, update: 1, create: 2, rename: 3 };
  operations.sort((x, y) => x.chapter.localeCompare(y.chapter, undefined, { numeric: true }) || order[x.action] - order[y.action]);

  // 章节级更新推导（工作项清单之外，文档其余可能波及的内容；content=新内容原文，gen 产物在刷新后补入）
  const chapterUpdates: PolarionSync['chapterUpdates'] = [];
  if (diff.descriptionInvalidated) {
    chapterUpdates.push({ chapter: '5.1', title: '模块功能描述', reason: '任何变更都会重生 5.1 描述', content: cloneNode(newModel.functionalDescription) });
  }
  if (diff.dynamicInvalidated) {
    const sms = listStateMachines(newModel.dynamicDesign);
    const seqs = newModel.dynamicDesign?.sequences ?? [];
    chapterUpdates.push({ chapter: '5.3.1', title: '状态机', reason: '函数级变更 → 状态机整图重生', content: sms.length > 0 ? cloneNode(sms) : undefined });
    chapterUpdates.push({ chapter: '5.3.2', title: '序列图', reason: '函数级变更 → 序列图整组重生', content: seqs.length > 0 ? cloneNode(seqs) : undefined });
    chapterUpdates.push({
      chapter: '7', title: '评估与圈复杂度表', reason: '函数集合变化 → 统计表行变化',
      content: newModel.document ? cloneNode({ evaluationRows: newModel.document.evaluationRows, complexityTable: newModel.document.complexityTable }) : undefined,
    });
  }
  // 4.1 文件清单：源文件集合变化
  const oldFiles = (oldDesign.files ?? []).map(f => f.path).join('\n');
  const newFiles = (newModel.files ?? []).map(f => f.path).join('\n');
  if (oldFiles !== newFiles) {
    chapterUpdates.push({ chapter: '4.1', title: '文件清单', reason: '源文件集合变化', content: cloneNode(newModel.files ?? []) });
  }
  // 4.2 接口总图/调用图：图源码比对
  if ((oldDesign.interfaceOverview?.diagram ?? '') !== (newModel.interfaceOverview?.diagram ?? '')) {
    chapterUpdates.push({ chapter: '4.2', title: '接口总图', reason: '接口总图图源变化', content: cloneNode(newModel.interfaceOverview) });
  }
  const oldCg = new Map((oldDesign.callGraphs ?? []).map(g => [g.name, g.diagram]));
  const newCgByName = new Map((newModel.callGraphs ?? []).map(g => [g.name, g] as const));
  const changedCg = (newModel.callGraphs ?? []).filter(g => oldCg.get(g.name) !== g.diagram).map(g => g.name);
  const removedCg = [...oldCg.keys()].filter(n => !(newModel.callGraphs ?? []).some(g => g.name === n));
  if (changedCg.length + removedCg.length > 0) {
    chapterUpdates.push({
      chapter: '4.2', title: '调用图', reason: `调用图变化：${[...changedCg, ...removedCg].join('、')}`,
      content: cloneNode({ changed: changedCg.map(n => newCgByName.get(n)), removed: removedCg }),
    });
  }
  if (diff.hasChanges) {
    chapterUpdates.push({
      chapter: '3.1/3.2', title: '缩写表/定义表', reason: '新生成的描述可能引入新缩写——以 report 打印的缺口名单为准，有则反馈维护方补表',
      content: newModel.document ? cloneNode({ abbreviations: newModel.document.abbreviations, definitions: newModel.document.definitions, abbreviationGaps: newModel.document.abbreviationGaps }) : undefined,
    });
  }

  return {
    module: diff.module,
    oldAnalyzedAt: diff.oldAnalyzedAt,
    newAnalyzedAt: diff.newAnalyzedAt,
    operations,
    chapterUpdates,
    untouched: {
      functions: diff.functions.unchanged.length,
      types: diff.types.unchanged.length,
      externals: diff.externals.unchanged.length,
      configs: diff.configs.unchanged.length,
    },
  };
}
