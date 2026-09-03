/**
 * Polarion Word round-trip 导入文档渲染（纯逻辑，产物由 CLI 落盘）。
 *
 * docx 结构约定（Polarion Word 导入向导按 Heading 切分工作项）：
 * - H1 = 章节分组（仅阅读导航，导入时不切分）
 * - H2 = 工作项边界（导入向导设 split at Heading 2），文本 `[<Kind>] <title>`，
 *        Kind 前缀供服务器侧类型映射与人工核对
 * - 正文 = 工作项卡片（复用 functionCard/calloutCard，表格由 pandoc 转 Word 原生表格）
 *        + 内嵌图片（相对路径 figs/NN.png，pandoc 打包进 docx）
 *        + 末行可见锚点小字 `LLD-KEY: <key>`（HTML 注释会被 pandoc 丢弃，必须可见文本，
 *          map-ids 靠它在 Polarion 回导的 csv 里找回工作项）
 */
import type { ModuleModel } from '../model/types.js';
import { esc, escRaw, functionCard, calloutCard } from '../report/cards.js';
import { DEFAULT_POLARION_CONFIG, type PolarionConfig, type WorkItemDraft } from './types.js';

/** 章节号 → H1 分组标题（与报告章节对齐） */
const CHAPTER_TITLES: Record<string, string> = {
  '5.1': '5.1 功能接口概览',
  '5.2.2.2': '5.2.2.2 外部接口函数',
  '5.2.3.2': '5.2.3.2 对外接口函数',
  '5.2.4.2': '5.2.4.2 内部函数',
  '5.3.1': '5.3.1 状态机',
  '5.3.2': '5.3.2 序列图',
  '6.2': '6.2 Callout function',
};

export interface WorkItemDocOptions {
  /** 图片显示宽度（CSS px，截图 2x 的自然宽一半）→ 超过 maxImageWidthPx 限宽 */
  figureWidths?: ReadonlyMap<string, number>;
  maxImageWidthPx?: number;
}

function figureHtml(draft: WorkItemDraft, opts?: WorkItemDocOptions): string {
  if (!draft.figureFile) return '';
  const naturalCss = opts?.figureWidths?.get(draft.figureFile);
  const limit = opts?.maxImageWidthPx ?? DEFAULT_POLARION_CONFIG.maxImageWidthPx;
  const width = naturalCss != null ? Math.min(naturalCss, limit) : limit;
  return `<p align="center"><img src="${draft.figureFile}" width="${width}" alt="${esc(draft.title)}"></p>`;
}

/** 单个工作项的 H2 + 正文 HTML */
function renderDraft(draft: WorkItemDraft, cfg: PolarionConfig, staticVars: ReadonlySet<string>, opts?: WorkItemDocOptions): string {
  const kindLabel = cfg.workItemTypes[draft.kind] ?? draft.kind;
  const parts: string[] = [`<h2>[${esc(kindLabel)}] ${esc(draft.title)}</h2>`];
  const e = draft.entity;
  switch (e.type) {
    case 'function':
      // 流程图图片走 diagramBlock 嵌进卡片「流程图」行（与报告同位置）；includeSource=false 去掉图源码 details
      parts.push(functionCard(e.fn,
        draft.figureFile ? () => figureHtml(draft, opts) : undefined,
        staticVars, { includeSource: false }));
      break;
    case 'callout':
      parts.push(calloutCard(e.ext, e.secNo));
      break;
    case 'external-table': {
      const extDesc = e.ext.generated?.detailedDescription ?? e.ext.comment?.description;
      parts.push(`<table>
<tr><th>接口函数</th><td><code>${esc(e.ext.name)}</code></td></tr>
<tr><th>语法</th><td><code>${esc(e.ext.signature || e.ext.name)}</code></td></tr>
<tr><th>来源分组</th><td>${esc(e.ext.group)}</td></tr>
<tr><th>模块内调用者</th><td>${e.ext.calledFrom.map(esc).join(', ')}</td></tr>
${extDesc ? `<tr><th>说明</th><td>${esc(extDesc)}</td></tr>` : ''}
</table>`);
      break;
    }
    case 'diagram': {
      const holder = e.holder as { description?: string; states?: { name: string; description: string }[]; transitions?: { from: string; to: string; trigger: string; description: string }[] };
      if (holder.description) parts.push(`<p>${esc(holder.description)}</p>`);
      if (holder.states?.length) {
        parts.push('<table><tr><th>状态</th><th>说明</th></tr>'
          + holder.states.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.description)}</td></tr>`).join('') + '</table>');
      }
      if (holder.transitions?.length) {
        parts.push('<table><tr><th>从</th><th>到</th><th>触发</th><th>说明</th></tr>'
          + holder.transitions.map(t => `<tr><td>${esc(t.from)}</td><td>${esc(t.to)}</td><td>${esc(t.trigger)}</td><td>${esc(t.description)}</td></tr>`).join('') + '</table>');
      }
      parts.push(figureHtml(draft, opts));
      break;
    }
  }
  // 可见锚点（小字）：map-ids 回匹配用，勿删勿改格式
  parts.push(`<p><small>LLD-KEY: ${escRaw(draft.key)}</small></p>`);
  return parts.join('\n');
}

/** 整份工作项导入文档（standalone HTML，pandoc → docx） */
export function renderWorkItemsDocument(
  model: ModuleModel,
  drafts: WorkItemDraft[],
  cfg?: Partial<PolarionConfig>,
  opts?: WorkItemDocOptions,
): string {
  const full: PolarionConfig = { ...DEFAULT_POLARION_CONFIG, ...cfg };
  const staticVars = new Set([
    ...model.internalVariables.filter(v => v.isStatic).map(v => v.name),
    ...model.providedVariables.filter(v => v.isStatic).map(v => v.name),
  ]);
  const body: string[] = [];
  let lastChapter = '';
  for (const d of drafts) {
    if (d.chapter !== lastChapter) {
      lastChapter = d.chapter;
      body.push(`<h1>${esc(CHAPTER_TITLES[d.chapter] ?? d.chapter)}</h1>`);
    }
    body.push(renderDraft(d, full, staticVars, opts));
  }
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${esc(model.module)} 详细设计工作项（Polarion 导入）</title>
</head>
<body>
${body.join('\n')}
</body>
</html>
`;
}

/**
 * manifest csv（UTF-8 BOM 由 CLI 落盘时加；RFC4180 引号转义）。
 * 列：key,chapter,kind,title,name,module,location,hash,figure,workItemId
 * hash=bodyHash 供漂移提示；workItemId 回写后重跑 export 带上，形成闭环。
 */
export function renderManifestCsv(drafts: WorkItemDraft[]): string {
  const cell = (s: string | null): string => {
    const v = s ?? '';
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows = drafts.map(d =>
    [d.key, d.chapter, d.kind, d.title, d.name, d.module, d.location, d.hash,
      d.figureFile ?? '-', d.workItemId ?? ''].map(cell).join(','));
  return ['key,chapter,kind,title,name,module,location,hash,figure,workItemId', ...rows].join('\r\n') + '\r\n';
}
