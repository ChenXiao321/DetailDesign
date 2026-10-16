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
  ModuleModel, FunctionUnit, TypeUnit, ExternalInterface, ConfigMacro, VariableUnit,
} from '../model/types.js';
import { isManuallyRevised } from './contentHash.js';

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
  /** 变量（5.2.3.1 对外 GV + 5.2.4.1 内部 LV 合并比对，2026-10-16 纳入比对面） */
  variables: NameChanges;
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
// 变量语义键：类型+限定符。注释/file/conditionalFlags 不算变更（与 typeKey 同口径；
// 注释剥离原则——旧产物注释可能被富化过）。
// 已知盲区（与函数一致）：变量在 5.2.3.1/5.2.4.1 之间移动但语义未变时不报（键不含章节归属）
const varKey = (v: VariableUnit): string =>
  stable({ type: v.type, isStatic: v.isStatic, isConst: v.isConst, isVolatile: v.isVolatile });

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
  const variables = diffByName(
    [...oldDesign.providedVariables, ...oldDesign.internalVariables],
    [...newModel.providedVariables, ...newModel.internalVariables], varKey);

  const dynamicInvalidated = changed.length + fnNames.added.length + fnNames.removed.length > 0;
  const hasChanges = dynamicInvalidated
    || types.changed.length + types.added.length + types.removed.length > 0
    || externals.changed.length + externals.added.length + externals.removed.length > 0
    || configs.changed.length + configs.added.length + configs.removed.length > 0
    || variables.changed.length + variables.added.length + variables.removed.length > 0;

  return {
    module: newModel.module,
    oldAnalyzedAt: oldDesign.analyzedAt,
    newAnalyzedAt: newModel.analyzedAt,
    functions: { unchanged: fnNames.unchanged, changed, added: fnNames.added, removed: fnNames.removed },
    types, externals, configs, variables,
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
  // 变量无 generated（非 LLM 条目），回挂旧注释即可（可能被富化过）
  carry(merged.providedVariables, oldDesign.providedVariables, new Set(diff.variables.unchanged));
  carry(merged.internalVariables, oldDesign.internalVariables, new Set(diff.variables.unchanged));

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
 * 把 diff 五类清单（函数/类型/外部接口/配置宏/变量）翻译成 Polarion 操作单：
 * 新增→新建工作项、变更→更新内容、删除→移除，
 * 并对「删除+新增」做疑似改名配对（名称 LCS 相似度，语义键相同加权）——
 * 改名建议改原工作项 title+内容，保留历史与追溯链接，而非删了重建。
 */

export type SyncAction = 'create' | 'update' | 'delete' | 'rename';

export interface SyncOperation {
  action: SyncAction;
  kind: 'function' | 'type' | 'external' | 'config' | 'variable';
  chapter: string;            // 报告章节号=Polarion 文档定位锚点
  title: string;              // 工作项 title（rename 时为新名）
  /** Polarion 自定义工作项「类型」属性枚举 ID（2026-10-16 用户定枚举：
   *  IF=接口函数 LF=内部函数 TDST=结构体 TDE=枚举 TDB=基础类型 LV=内部变量 GV=全局变量 Design=设计）。
   *  函数按章节 IF/LF；类型按节点 struct/枚举式typedef/普通typedef 分 TDST/TDE/TDB；
   *  Callout/外部接口组表/配置宏/章节级更新一律 Design */
  wiType?: string;
  /** Polarion「验证方法」枚举 ID（2026-10-16 用户定：test=测试 review=评审 test&review=测试和评审）。
   *  function/Callout/外部接口组表/配置宏=test；type=review；章节级更新=review */
  verifyMethod?: string;
  from?: string;              // rename 时的旧名
  detail: string;             // 中文操作建议
  jsonPath?: string;          // 条目在（合并后的新）lld_design.json 中的节点路径，如 $.providedFunctions[2]；delete 不存在于新 json
  oldJsonPath?: string;       // 条目在旧 lld_design.json（diff 前）中的节点路径；create 不存在于旧 json
  content?: unknown;          // 条目在新 design json 中的节点原文（深拷贝）——拿着 sync.json 即可直接更新，无需回 design json 索引；delete 无新内容不携带
  /** 变更字段清单（Polarion 逻辑字段口径，仅 update/rename 携带；create=全部字段、delete 无内容不携带）。
   *  颗粒度=比对键覆盖的语义面：函数只能细到「签名面（签名/参数表）」与「实现面（描述/图/复杂度等派生自函数体）」；
   *  注释/行号类字段不在比对键内，永远不会出现在清单里 */
  changedFields?: string[];
  /** function 专有：签名哈希变化=接口面变更（调用方可能受影响，评审重点关注；内容照常全量更新，不阻断） */
  signatureChanged?: boolean;
  /** 旧 generated 内容指纹与生成时刻不符=曾有人工修订，本次重生将覆盖（提示不阻断；
   *  旧版产物无 contentHash 指纹时无法检出，不出现该字段） */
  manualRevisionLost?: boolean;
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
  chapterUpdates: { chapter: string; title: string; reason: string; wiType?: string; verifyMethod?: string; content?: unknown }[];
  /** 未变条目数（Polarion 侧零操作） */
  untouched: { functions: number; types: number; externals: number; configs: number; variables: number };
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

/** Polarion 自定义「类型」枚举 ID 映射（2026-10-16 用户定） */
const fnWiType = (chapter: string): string => chapter === '5.2.3.2' ? 'IF' : 'LF';
const typeWiType = (t: TypeUnit | undefined): string =>
  t?.kind === 'struct' ? 'TDST' : (t?.relatedDefines && t.relatedDefines.length > 0 ? 'TDE' : 'TDB');
const DESIGN_WITYPE = 'Design';   // Callout/外部接口组表/配置宏/章节级更新统一归「设计」
/** 验证方法枚举 ID（2026-10-16 用户定）：function/Callout/组表/配置宏=测试；type/章节级更新=评审 */
const VM_TEST = 'test', VM_REVIEW = 'review';

/* ---- changedFields 取值（Polarion 逻辑字段口径，与《Polarion同步工具需求.md》§6 映射表左列一致） ---- */
const F_TITLE = 'title';
const F_SIG = '签名';
const F_PARAMS = '参数表';
const F_DESC = '描述正文';
const F_FLOW = '流程图';
const F_CPLX = '圈复杂度';
const F_INFLOOP = '死循环标记';
const F_CALLS = '调用关系';
const F_COND = '条件编译';
const F_TYPEKIND = '类型类别';
const F_MEMBERS = '成员/常量表';
const F_VALUE = '取值/形式';
const F_CFGKIND = '类别';
const F_VARTYPE = '类型';
const F_QUAL = '限定符';
const F_TABLE = '整表内容';

/** 函数字段级比对：签名哈希→签名/参数表；函数体哈希→实现面派生字段（描述/图/复杂度/死循环/调用关系/条件编译） */
const fnChangedFields = (o?: FunctionUnit, n?: FunctionUnit): string[] => {
  const f: string[] = [];
  if (!o || !n) return f;
  if (o.sigHash !== n.sigHash) f.push(F_SIG, F_PARAMS);
  if (o.bodyHash !== n.bodyHash) f.push(F_DESC, F_FLOW, F_CPLX, F_INFLOOP, F_CALLS, F_COND);
  return f;
};
/** 类型字段级比对：kind/underlyingType→类型类别；元素或关联宏→成员/常量表（与 typeKey 同语义子集） */
const typeChangedFields = (o?: TypeUnit, n?: TypeUnit): string[] => {
  const f: string[] = [];
  if (!o || !n) return f;
  if (o.kind !== n.kind || o.underlyingType !== n.underlyingType) f.push(F_TYPEKIND);
  const el = (t: TypeUnit) => stable((t.elements ?? []).map(e => ({ name: e.name, type: e.type })));
  const rd = (t: TypeUnit) => stable((t.relatedDefines ?? []).map(d => ({ name: d.name, value: d.value })));
  if (el(o) !== el(n) || rd(o) !== rd(n)) f.push(F_MEMBERS);
  return f;
};
/** 配置宏字段级比对：取值/形式→取值/形式；类别→类别（与 cfgKey 同语义子集） */
const cfgChangedFields = (o?: ConfigMacro, n?: ConfigMacro): string[] => {
  const f: string[] = [];
  if (!o || !n) return f;
  if (o.value !== n.value || o.isFunctionLike !== n.isFunctionLike) f.push(F_VALUE);
  if (o.kind !== n.kind) f.push(F_CFGKIND);
  return f;
};
/** 变量字段级比对：类型→类型；限定符→限定符（与 varKey 同语义子集） */
const varChangedFields = (o?: VariableUnit, n?: VariableUnit): string[] => {
  const f: string[] = [];
  if (!o || !n) return f;
  if (o.type !== n.type) f.push(F_VARTYPE);
  if (o.isStatic !== n.isStatic || o.isConst !== n.isConst || o.isVolatile !== n.isVolatile) f.push(F_QUAL);
  return f;
};
/** 外部接口字段级比对：签名→签名；归组→所属组（与 extKey 同语义子集） */
const extChangedFields = (o?: ExternalInterface, n?: ExternalInterface): string[] => {
  const f: string[] = [];
  if (!o || !n) return f;
  if (o.signature !== n.signature) f.push(F_SIG);
  if (o.group !== n.group) f.push('所属组');
  return f;
};

/** 人工修订提示后缀（manualRevisionLost=true 时拼进 detail，同步单阅读者当场可见） */
const MANUAL_REV_HINT = '；⚠ 该条目生成后曾被人工修订，本次重生将覆盖修订内容';

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
    const ch = fnChapter(to, false);
    const oldF = fnNode(oldDesign, from), newF = fnNode(newModel, to);
    const sigChanged = !!oldF && !!newF && oldF.sigHash !== newF.sigHash;
    const manualRev = isManuallyRevised(oldF?.generated);
    operations.push({
      action: 'rename', kind: 'function', chapter: ch, title: to, wiType: fnWiType(ch), verifyMethod: VM_TEST, from,
      detail: RENAME_DETAIL + (manualRev ? MANUAL_REV_HINT : ''),
      jsonPath: newFnPath(to), oldJsonPath: oldFnPath(from), content: newFnContent(to),
      changedFields: [F_TITLE, ...fnChangedFields(oldF, newF)],
      ...(sigChanged ? { signatureChanged: true } : {}),
      ...(manualRev ? { manualRevisionLost: true } : {}),
    });
  }
  for (const name of fnPair.loneAdded) {
    const ch = fnChapter(name, false);
    operations.push({ action: 'create', kind: 'function', chapter: ch, title: name, wiType: fnWiType(ch), verifyMethod: VM_TEST, detail: '新建工作项，插入对应章节', jsonPath: newFnPath(name), content: newFnContent(name) });
  }
  for (const name of fnPair.loneRemoved) {
    const ch = fnChapter(name, true);
    operations.push({ action: 'delete', kind: 'function', chapter: ch, title: name, wiType: fnWiType(ch), verifyMethod: VM_TEST, detail: '从文档移除该工作项', oldJsonPath: oldFnPath(name) });
  }
  for (const c of diff.functions.changed) {
    const ch = fnChapter(c.name, false);
    const oldF = fnNode(oldDesign, c.name), newF = fnNode(newModel, c.name);
    const manualRev = isManuallyRevised(oldF?.generated);
    operations.push({
      action: 'update', kind: 'function', chapter: ch, title: c.name, wiType: fnWiType(ch), verifyMethod: VM_TEST,
      detail: (c.kind === 'sig' ? '签名变更：更新工作项内容（接口变化，评审重点关注）' : '实现变更：更新工作项内容') + (manualRev ? MANUAL_REV_HINT : ''),
      jsonPath: newFnPath(c.name), oldJsonPath: oldFnPath(c.name), content: newFnContent(c.name),
      changedFields: fnChangedFields(oldF, newF),
      ...(c.kind === 'sig' ? { signatureChanged: true } : {}),
      ...(manualRev ? { manualRevisionLost: true } : {}),
    });
  }

  // 类型/配置宏：名称相似度配对（无语义键加权——字段变即 changed 不会落到删+增）。
  // 章节读节点自带 polarion marker（配置宏按 kind 分 6/6.1/6.2），缺失时回退默认章节
  const misc = <N extends { name: string; generated?: { contentHash?: string } }>(
    kind: 'type' | 'config' | 'variable', chapterOf: (name: string, isOld: boolean) => string, c: NameChanges,
    pathOf: (list: { name: string }[], name: string) => string | undefined,
    oldList: N[], newList: N[],
    wiTypeOf: (name: string, isOld: boolean) => string,
    fieldsOf: (oldN: N | undefined, newN: N | undefined) => string[],
  ): void => {
    const vm = kind === 'config' ? VM_TEST : VM_REVIEW;   // config=测试，type/variable=评审（用户 2026-10-16 定）
    const newContent = (name: string) => cloneNode(newList.find(x => x.name === name));
    const oldNode = (name: string) => oldList.find(x => x.name === name);
    const newNode = (name: string) => newList.find(x => x.name === name);
    const p = pairRenames(c.removed, c.added, () => undefined);
    for (const [from, to] of p.pairs) {
      const manualRev = isManuallyRevised(oldNode(from)?.generated);
      operations.push({ action: 'rename', kind, chapter: chapterOf(to, false), title: to, wiType: wiTypeOf(to, false), verifyMethod: vm, from, detail: RENAME_DETAIL + (manualRev ? MANUAL_REV_HINT : ''), jsonPath: pathOf(newList, to), oldJsonPath: pathOf(oldList, from), content: newContent(to), changedFields: [F_TITLE, ...fieldsOf(oldNode(from), newNode(to))], ...(manualRev ? { manualRevisionLost: true } : {}) });
    }
    for (const name of p.loneAdded) {
      operations.push({ action: 'create', kind, chapter: chapterOf(name, false), title: name, wiType: wiTypeOf(name, false), verifyMethod: vm, detail: '新建工作项，插入对应章节', jsonPath: pathOf(newList, name), content: newContent(name) });
    }
    for (const name of p.loneRemoved) {
      operations.push({ action: 'delete', kind, chapter: chapterOf(name, true), title: name, wiType: wiTypeOf(name, true), verifyMethod: vm, detail: '从文档移除该工作项', oldJsonPath: pathOf(oldList, name) });
    }
    for (const name of c.changed) {
      const manualRev = isManuallyRevised(oldNode(name)?.generated);
      operations.push({ action: 'update', kind, chapter: chapterOf(name, false), title: name, wiType: wiTypeOf(name, false), verifyMethod: vm, detail: '内容变更：更新工作项内容' + (manualRev ? MANUAL_REV_HINT : ''), jsonPath: pathOf(newList, name), oldJsonPath: pathOf(oldList, name), content: newContent(name), changedFields: fieldsOf(oldNode(name), newNode(name)), ...(manualRev ? { manualRevisionLost: true } : {}) });
    }
  };
  misc<TypeUnit>('type', () => '5.2.1.2', diff.types,
    (list, name) => idxPath(list, '$.types', name), oldDesign.types, newModel.types,
    (name, isOld) => typeWiType((isOld ? oldDesign.types : newModel.types).find(x => x.name === name)),
    typeChangedFields);
  misc<ConfigMacro>('config', (name, isOld) => {
    const m = (isOld ? oldDesign : newModel).configMacros.find(x => x.name === name);
    return m?.polarion?.chapter ?? '6';
  }, diff.configs,
    (list, name) => idxPath(list, '$.configMacros', name), oldDesign.configMacros, newModel.configMacros,
    () => DESIGN_WITYPE,
    cfgChangedFields);

  // 变量：5.2.3.1 对外变量（GV）/ 5.2.4.1 内部变量（LV），名称相似度配对；验证方法=评审（同 type 口径）
  {
    const oldProvidedVar = new Set(oldDesign.providedVariables.map(v => v.name));
    const newProvidedVar = new Set(newModel.providedVariables.map(v => v.name));
    const varChapter = (name: string, isOld: boolean): string =>
      (isOld ? oldProvidedVar : newProvidedVar).has(name) ? '5.2.3.1' : '5.2.4.1';
    const oldVars = [...oldDesign.providedVariables, ...oldDesign.internalVariables];
    const newVars = [...newModel.providedVariables, ...newModel.internalVariables];
    const varPath = (m: ModuleModel, name: string): string | undefined =>
      idxPath(m.providedVariables, '$.providedVariables', name)
      ?? idxPath(m.internalVariables, '$.internalVariables', name);
    misc<VariableUnit>('variable', varChapter, diff.variables,
      (list, name) => varPath(list === oldVars ? oldDesign : newModel, name),
      oldVars, newVars,
      (name, isOld) => varChapter(name, isOld) === '5.2.3.1' ? 'GV' : 'LV',
      varChangedFields);
  }

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
      const manualRev = isManuallyRevised(oldExt.get(from)?.generated);
      operations.push({ action: 'rename', kind: 'external', chapter: '6.2', title: to, wiType: DESIGN_WITYPE, verifyMethod: VM_TEST, from, detail: RENAME_DETAIL + (manualRev ? MANUAL_REV_HINT : ''), jsonPath: extPath(newModel.calledExternalFunctions, to), oldJsonPath: extPath(oldDesign.calledExternalFunctions, from), content: cloneNode(newExt.get(to)), changedFields: [F_TITLE, ...extChangedFields(oldExt.get(from), newExt.get(to))], ...(manualRev ? { manualRevisionLost: true } : {}) });
    }
    for (const name of cp.loneAdded) {
      operations.push({ action: 'create', kind: 'external', chapter: '6.2', title: name, wiType: DESIGN_WITYPE, verifyMethod: VM_TEST, detail: '新建 Callout 工作项，插入 6.2 节', jsonPath: extPath(newModel.calledExternalFunctions, name), content: cloneNode(newExt.get(name)) });
    }
    for (const name of cp.loneRemoved) {
      operations.push({ action: 'delete', kind: 'external', chapter: '6.2', title: name, wiType: DESIGN_WITYPE, verifyMethod: VM_TEST, detail: '从 6.2 节移除该 Callout 工作项', oldJsonPath: extPath(oldDesign.calledExternalFunctions, name) });
    }
    for (const name of cChanged) {
      const manualRev = isManuallyRevised(oldExt.get(name)?.generated);
      operations.push({ action: 'update', kind: 'external', chapter: '6.2', title: name, wiType: DESIGN_WITYPE, verifyMethod: VM_TEST, detail: '签名变更：更新 Callout 工作项内容' + (manualRev ? MANUAL_REV_HINT : ''), jsonPath: extPath(newModel.calledExternalFunctions, name), oldJsonPath: extPath(oldDesign.calledExternalFunctions, name), content: cloneNode(newExt.get(name)), changedFields: extChangedFields(oldExt.get(name), newExt.get(name)), ...(manualRev ? { manualRevisionLost: true } : {}) });
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
        operations.push({ action: 'create', kind: 'external', chapter: '5.2.2.2', title, wiType: DESIGN_WITYPE, verifyMethod: VM_TEST, detail: `新建组表工作项（${newMs.length} 个接口）`, content, members });
      } else if (newMs.length === 0) {
        operations.push({ action: 'delete', kind: 'external', chapter: '5.2.2.2', title, wiType: DESIGN_WITYPE, verifyMethod: VM_TEST, detail: `整组移除（原 ${oldMs.length} 个接口）：删除该组表工作项`, members });
      } else if (added.length + removed.length + changed.length > 0) {
        const parts: string[] = [];
        if (added.length) parts.push(`新增 ${added.join('、')}`);
        if (removed.length) parts.push(`删除 ${removed.join('、')}`);
        if (changed.length) parts.push(`签名变更 ${changed.join('、')}`);
        // 变更成员的旧生成内容有修订痕迹 → 整表重生会覆盖，提示不阻断
        const manualRev = changed.some(n => isManuallyRevised(oldExt.get(n)?.generated));
        operations.push({ action: 'update', kind: 'external', chapter: '5.2.2.2', title, wiType: DESIGN_WITYPE, verifyMethod: VM_TEST, detail: `组内成员变化（${parts.join('；')}）：更新整表工作项内容` + (manualRev ? MANUAL_REV_HINT : ''), content, members, changedFields: [F_TABLE], ...(manualRev ? { manualRevisionLost: true } : {}) });
      }
    }
  }

  // 章节号升序、同章按 删→改→建→改名 排序，照着单子从上到下干活即可
  const order: Record<SyncAction, number> = { delete: 0, update: 1, create: 2, rename: 3 };
  operations.sort((x, y) => x.chapter.localeCompare(y.chapter, undefined, { numeric: true }) || order[x.action] - order[y.action]);

  // 章节级更新推导（工作项清单之外，文档其余可能波及的内容；content=新内容原文，gen 产物在刷新后补入）
  const chapterUpdates: PolarionSync['chapterUpdates'] = [];
  if (diff.descriptionInvalidated) {
    chapterUpdates.push({ chapter: '5.1', title: '模块功能描述', reason: '任何变更都会重生 5.1 描述', wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW, content: cloneNode(newModel.functionalDescription) });
  }
  if (diff.dynamicInvalidated) {
    const sms = listStateMachines(newModel.dynamicDesign);
    const seqs = newModel.dynamicDesign?.sequences ?? [];
    chapterUpdates.push({ chapter: '5.3.1', title: '状态机', reason: '函数级变更 → 状态机整图重生', wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW, content: sms.length > 0 ? cloneNode(sms) : undefined });
    chapterUpdates.push({ chapter: '5.3.2', title: '序列图', reason: '函数级变更 → 序列图整组重生', wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW, content: seqs.length > 0 ? cloneNode(seqs) : undefined });
    chapterUpdates.push({
      chapter: '7', title: '评估与圈复杂度表', reason: '函数集合变化 → 统计表行变化', wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW,
      content: newModel.document ? cloneNode({ evaluationRows: newModel.document.evaluationRows, complexityTable: newModel.document.complexityTable }) : undefined,
    });
  }
  // 4.1 文件清单：源文件集合变化
  const oldFiles = (oldDesign.files ?? []).map(f => f.path).join('\n');
  const newFiles = (newModel.files ?? []).map(f => f.path).join('\n');
  if (oldFiles !== newFiles) {
    chapterUpdates.push({ chapter: '4.1', title: '文件清单', reason: '源文件集合变化', wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW, content: cloneNode(newModel.files ?? []) });
  }
  // 4.2 接口总图/调用图：图源码比对
  if ((oldDesign.interfaceOverview?.diagram ?? '') !== (newModel.interfaceOverview?.diagram ?? '')) {
    chapterUpdates.push({ chapter: '4.2', title: '接口总图', reason: '接口总图图源变化', wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW, content: cloneNode(newModel.interfaceOverview) });
  }
  const oldCg = new Map((oldDesign.callGraphs ?? []).map(g => [g.name, g.diagram]));
  const newCgByName = new Map((newModel.callGraphs ?? []).map(g => [g.name, g] as const));
  const changedCg = (newModel.callGraphs ?? []).filter(g => oldCg.get(g.name) !== g.diagram).map(g => g.name);
  const removedCg = [...oldCg.keys()].filter(n => !(newModel.callGraphs ?? []).some(g => g.name === n));
  if (changedCg.length + removedCg.length > 0) {
    chapterUpdates.push({
      chapter: '4.2', title: '调用图', reason: `调用图变化：${[...changedCg, ...removedCg].join('、')}`, wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW,
      content: cloneNode({ changed: changedCg.map(n => newCgByName.get(n)), removed: removedCg }),
    });
  }
  if (diff.hasChanges) {
    chapterUpdates.push({
      chapter: '3.1/3.2', title: '缩写表/定义表', reason: '新生成的描述可能引入新缩写——以 report 打印的缺口名单为准，有则反馈维护方补表', wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW,
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
      variables: diff.variables.unchanged.length,
    },
  };
}
