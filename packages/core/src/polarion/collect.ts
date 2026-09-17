/**
 * 工作项收集：从 ModuleModel 收拢所有 polarion.isWorkItem=true 实体为 WorkItemDraft 列表。
 *
 * 两个历史坑在这里兜底（不改 analyzer、不动已交付产物）：
 * ① 5.2.2.2 表格类工作项 analyzer 按 group 生成 title，同组重复（两个都叫「External 接口函数」）
 *    → 应用 tableTitleTemplate（默认 '{group} 接口函数：{name}'）去重；
 * ② 旧产物 dynamicDesign 上无 polarion 字段（注入早于 marker 加入）
 *    → normalizePolarion 按规则推断补标（stateMachine→5.3.1/statemachine、sequences→5.3.2/sequence），
 *      直接原地补到 model 对象上，保证 map-ids 回写与后续重跑 export 拿到同一份 marker。
 */
import type { ModuleModel, PolarionMarker } from '../model/types.js';
import { listStateMachines } from '../model/types.js';
import {
  DEFAULT_POLARION_CONFIG, markerOf,
  type PolarionConfig, type WorkItemDraft, type WorkItemEntity,
} from './types.js';

/** 旧产物 dynamicDesign 缺 polarion 时按规则补标（原地），返回 marker */
function normalizePolarion(
  holder: { polarion?: PolarionMarker },
  chapter: string,
  workItemKind: PolarionMarker['workItemKind'],
  title: string,
): PolarionMarker {
  if (!holder.polarion) {
    holder.polarion = { isWorkItem: true, chapter, workItemKind, title, workItemId: null };
  }
  return holder.polarion;
}

/** 章节号数值序比较："5.2.2.2" < "5.2.3.2" < "6.2" */
function compareChapter(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** 图片文件名安全化：保留 [A-Za-z0-9_-]，其余归并为 _；全丢失时回退 kind */
function safeFileStem(name: string, kind: string): string {
  const s = name.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return s || kind;
}

/**
 * 收集工作项草稿，按章节号排序（5.1 → 5.2.2.2 → … → 6.2），章节内保持模型顺序。
 * 带图工作项按序分配 figs/NN_<name>.png 文件名。
 */
export function collectWorkItems(
  model: ModuleModel,
  cfg?: Partial<PolarionConfig>,
): WorkItemDraft[] {
  const template = cfg?.tableTitleTemplate ?? DEFAULT_POLARION_CONFIG.tableTitleTemplate;
  const mod = model.module;
  const drafts: WorkItemDraft[] = [];

  const push = (
    marker: PolarionMarker,
    name: string,
    entity: WorkItemEntity,
    opts: { title?: string; location?: string; hash?: string; mermaidSrc?: string | null },
  ): void => {
    drafts.push({
      // key 必须是不含空白的单 token（map-ids 锚点正则 LLD-KEY:\s*(\S+) 按空白截断），
      // 状态机名等含空格/CJK 的名字在 key 里把空白归并为 _
      key: `${mod}::${marker.chapter}::${name.replace(/\s+/g, '_')}`,
      chapter: marker.chapter,
      kind: marker.workItemKind,
      title: opts.title ?? marker.title,
      name,
      module: mod,
      location: opts.location ?? '-',
      hash: opts.hash ?? '-',
      mermaidSrc: opts.mermaidSrc ?? null,
      figureFile: null,   // 排序后统一分配
      workItemId: marker.workItemId ?? null,
      entity,
    });
  };

  // 5.1 功能接口总图
  if (model.interfaceOverview?.polarion?.isWorkItem) {
    const ov = model.interfaceOverview;
    push(ov.polarion, 'interfaceOverview',
      { type: 'diagram', holder: ov },
      { mermaidSrc: ov.diagram });
  }
  // 5.1 内部函数调用图（name 加 callgraph: 前缀防与函数名冲突）
  for (const g of model.callGraphs ?? []) {
    if (!g.polarion?.isWorkItem) continue;
    push(g.polarion, `callgraph:${g.name}`,
      { type: 'diagram', holder: g },
      { mermaidSrc: g.diagram });
  }
  // 5.2.2.2 表格类 / 6.2 Callout（calledExternalFunctions 按 group 分流）
  const callouts = model.calledExternalFunctions.filter(e => e.polarion?.isWorkItem && e.group === 'Callout');
  const tables = model.calledExternalFunctions.filter(e => e.polarion?.isWorkItem && e.group !== 'Callout');
  for (const e of tables) {
    const title = template.replaceAll('{group}', e.group).replaceAll('{name}', e.name);
    push(e.polarion, e.name, { type: 'external-table', ext: e }, { title });
  }
  // 5.2.3.2 对外接口函数
  for (const fn of model.providedFunctions) {
    if (!fn.polarion?.isWorkItem) continue;
    push(fn.polarion, fn.name, { type: 'function', fn }, {
      location: `${fn.file}:${fn.lineStart}-${fn.lineEnd}`,
      hash: fn.bodyHash,
      mermaidSrc: fn.generated?.flowchart ?? null,
    });
  }
  // 5.2.4.2 内部函数
  for (const fn of model.internalFunctions) {
    if (!fn.polarion?.isWorkItem) continue;
    push(fn.polarion, fn.name, { type: 'function', fn }, {
      location: `${fn.file}:${fn.lineStart}-${fn.lineEnd}`,
      hash: fn.bodyHash,
      mermaidSrc: fn.generated?.flowchart ?? null,
    });
  }
  // 5.3.1 状态机（多核按角色分图时各角色一个工作项） / 5.3.2 序列图（旧产物补标）
  for (const sm of listStateMachines(model.dynamicDesign)) {
    const marker = normalizePolarion(sm, '5.3.1', 'statemachine', sm.name);
    if (marker.isWorkItem) {
      push(marker, sm.name, { type: 'diagram', holder: sm as { polarion: PolarionMarker } },
        { mermaidSrc: sm.diagram });
    }
  }
  for (const s of model.dynamicDesign?.sequences ?? []) {
    const marker = normalizePolarion(s, '5.3.2', 'sequence', s.name);
    if (marker.isWorkItem) {
      push(marker, s.name, { type: 'diagram', holder: s as { polarion: PolarionMarker } },
        { mermaidSrc: s.diagram });
    }
  }
  // 6.2 Callout function
  callouts.forEach((e, i) => {
    push(e.polarion, e.name, { type: 'callout', ext: e, secNo: `${e.polarion.chapter}.${i + 1}` }, {});
  });

  // 章节排序（稳定）+ key 唯一性断言 + 图片文件名分配
  drafts.sort((a, b) => compareChapter(a.chapter, b.chapter));
  const seen = new Set<string>();
  for (const d of drafts) {
    if (seen.has(d.key)) throw new Error(`工作项 key 重复: ${d.key}`);
    seen.add(d.key);
  }
  let figIdx = 0;
  for (const d of drafts) {
    if (d.mermaidSrc) {
      figIdx += 1;
      d.figureFile = `figs/${String(figIdx).padStart(2, '0')}_${safeFileStem(d.name, d.kind)}.png`;
    }
  }
  return drafts;
}
