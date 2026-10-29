/**
 * Polarion 自定义属性（wiType/verifyMethod）推导与物化——design json 与 sync.json 共用同一套口径。
 *
 * 枚举（2026-10-16 用户定，详见《Polarion同步工具需求.md》§6.0）：
 *  wiType：IF=接口函数 LF=内部函数 TDST=结构体 TDE=枚举 TDB=基础类型 GV=全局变量 LV=内部变量 Design=设计
 *  verifyMethod：test=测试 review=评审
 *
 * 物化入口 materializePolarionAttributes：analyze/gen/update 三处调用（幂等覆盖写），
 * 把两属性填进各节点 polarion 标记 + 顶层 polarionChapterItems（无 marker 节点可挂的章节级工作项）。
 * modelDiff 的 sync.json 操作单也从本模块取映射，保证两处值一致。
 */
import type { ModuleModel, TypeUnit } from '../model/types.js';
import { listStateMachines, listConfigMacros } from '../model/types.js';

/** 函数「类型」：章节 5.2.3.2 对外接口函数=IF，其余（5.2.4.2 内部函数）=LF */
export const fnWiType = (chapter: string): string => chapter === '5.2.3.2' ? 'IF' : 'LF';
/** 类型「类型」：struct=TDST；有关联宏的枚举式 typedef=TDE；普通 typedef=TDB */
export const typeWiType = (t: TypeUnit | undefined): string =>
  t?.kind === 'struct' ? 'TDST' : (t?.relatedDefines && t.relatedDefines.length > 0 ? 'TDE' : 'TDB');
/** 变量「类型」：章节 5.2.3.1 对外变量=GV，否则（5.2.4.1 内部变量）=LV */
export const varWiType = (chapter: string): string => chapter === '5.2.3.1' ? 'GV' : 'LV';
/** Callout/外部接口组表/配置宏/章节级更新统一归「设计」 */
export const DESIGN_WITYPE = 'Design';
/** 验证方法：function/Callout/组表/配置宏=测试；type/variable/图/章节级=评审 */
export const VM_TEST = 'test', VM_REVIEW = 'review';

/** 无 marker 节点可挂的章节级工作项（与 sync.json chapterUpdates 中相应条目同口径，恒 Design/review） */
const CHAPTER_ITEMS: { chapter: string; title: string }[] = [
  { chapter: '5.1', title: '模块功能描述' },
  { chapter: '4.1', title: '文件清单' },
  { chapter: '7', title: '评估与圈复杂度表' },
  { chapter: '3.1', title: '缩写表' },
  { chapter: '3.2', title: '定义表' },
];

/** 把 wiType/verifyMethod 物化进模型全部 polarion 标记 + 顶层 polarionChapterItems。
 *  覆盖写、幂等：函数 provided↔internal 挪动、类型形态变化后重跑自动刷新。 */
export function materializePolarionAttributes(model: ModuleModel): void {
  for (const f of model.providedFunctions) {
    f.polarion.wiType = fnWiType('5.2.3.2');
    f.polarion.verifyMethod = VM_TEST;
  }
  for (const f of model.internalFunctions) {
    f.polarion.wiType = fnWiType('5.2.4.2');
    f.polarion.verifyMethod = VM_TEST;
  }
  for (const v of model.providedVariables) {
    v.polarion.wiType = varWiType('5.2.3.1');
    v.polarion.verifyMethod = VM_REVIEW;
  }
  for (const v of model.internalVariables) {
    v.polarion.wiType = varWiType('5.2.4.1');
    v.polarion.verifyMethod = VM_REVIEW;
  }
  for (const t of model.types) {
    t.polarion.wiType = typeWiType(t);
    t.polarion.verifyMethod = VM_REVIEW;
  }
  for (const e of [...model.calledExternalFunctions, ...(model.calloutFunctions ?? [])]) {
    e.polarion.wiType = DESIGN_WITYPE;
    e.polarion.verifyMethod = VM_TEST;
  }
  for (const c of listConfigMacros(model)) {
    c.polarion.wiType = DESIGN_WITYPE;
    c.polarion.verifyMethod = VM_TEST;
  }
  // 状态机/序列图/总图/调用图
  // 存量旧产物的动态设计节点可能连 polarion 标记都没有（早期格式）——这两类必为工作项，缺则补建
  for (const sm of listStateMachines(model.dynamicDesign)) {
    sm.polarion ??= { isWorkItem: true, chapter: '5.3.1', workItemKind: 'statemachine', title: sm.name, workItemId: null };
    sm.polarion.wiType = DESIGN_WITYPE;
    sm.polarion.verifyMethod = VM_REVIEW;
  }
  for (const s of model.dynamicDesign?.sequences ?? []) {
    s.polarion ??= { isWorkItem: true, chapter: '5.3.2', workItemKind: 'sequence', title: s.name, workItemId: null };
    s.polarion.wiType = DESIGN_WITYPE;
    s.polarion.verifyMethod = VM_REVIEW;
  }
  if (model.interfaceOverview) {
    model.interfaceOverview.polarion.wiType = DESIGN_WITYPE;
    model.interfaceOverview.polarion.verifyMethod = VM_REVIEW;
  }
  for (const g of model.callGraphs ?? []) {
    g.polarion.wiType = DESIGN_WITYPE;
    g.polarion.verifyMethod = VM_REVIEW;
  }
  // 章节级工作项（5.1 描述/4.1 文件清单/7 评估表/3.1 缩写表/3.2 定义表）
  model.polarionChapterItems = CHAPTER_ITEMS.map(i => ({ ...i, wiType: DESIGN_WITYPE, verifyMethod: VM_REVIEW }));
}
