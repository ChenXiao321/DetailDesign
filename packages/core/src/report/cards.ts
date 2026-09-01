/**
 * 工作项卡片渲染（评审报告与 Polarion 导出共用，从 htmlReport.ts 抽取，逻辑零改动）。
 * 唯一参数化扩展：functionCard 的 opts.includeSource——评审报告传 true（默认，输出
 * 「查看图源码」details 块），Polarion docx 场景传 false（图源码对导入是噪音）。
 */
import type { FunctionUnit, HeaderComment, ParamDoc, ExternalInterface } from '../model/types.js';

/** HTML 转义 */
export function esc(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

export function escRaw(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 参数行（模板格式：变量名 + 说明含范围） */
export function paramRows(params: ParamDoc[], dir: string): string {
  if (params.length === 0) {
    return `<tr><td class="label">Parameters(${dir})</td><td>None</td></tr>`;
  }
  return params.map((p, i) => {
    const label = i === 0 ? `Parameters(${dir})` : '';
    const desc = [p.raw !== `${p.type} ${p.name}` ? p.type : '', p.description ?? '']
      .filter(Boolean).join('; ');
    return `<tr><td class="label">${label}</td><td><code>${esc(p.name)}</code>${desc ? `<br><span class="muted">${esc(desc)}</span>` : ''}</td></tr>`;
  }).join('');
}

/** 函数工作项卡片（模板 5.2.3.2 表格样式） */
export function functionCard(fn: FunctionUnit, diagramBlock?: (src: string) => string, staticVars?: ReadonlySet<string>, opts?: { includeSource?: boolean }): string {
  const includeSource = opts?.includeSource ?? true;
  const c: HeaderComment | null = fn.comment;
  const desc = fn.generated?.detailedDescription ?? c?.description ?? '<span class="todo">（待生成）</span>';
  const flowchart = fn.generated?.flowchart;
  const flowchartRow = flowchart
    ? `<tr><td class="label">流程图</td><td>${diagramBlock ? diagramBlock(flowchart) : `<pre class="plantuml">${escRaw(flowchart)}</pre>`}
${includeSource ? `<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(flowchart)}</pre></details>` : ''}</td></tr>`
    : '';
  const condNote = fn.conditionalFlags.length > 0
    ? `<tr><td class="label">条件编译</td><td><code>${esc(fn.conditionalFlags.join(', '))}</code> 生效时参与编译</td></tr>`
    : '';
  const callsNote = fn.calls.length > 0
    ? `<tr><td class="label">调用</td><td class="muted small">${fn.calls.map(esc).join('<br>')}</td></tr>`
    : '';
  const calledByNote = fn.calledBy.length > 0
    ? `<tr><td class="label">被调用</td><td class="muted small">${fn.calledBy.map(esc).join(', ')}</td></tr>`
    : '';
  // 严格按 C 术语：static 文件作用域变量 = 静态全局变量（内部链接）；非 static = 外部链接全局变量
  const allStatic = fn.globalsAccessed.length > 0 && fn.globalsAccessed.every(n => staticVars?.has(n));
  const globalsLabel = allStatic ? '访问的静态全局变量' : '访问的模块全局变量';
  const globalsNote = fn.globalsAccessed.length > 0
    ? `<tr><td class="label">${globalsLabel}</td><td class="muted small">${fn.globalsAccessed.map(esc).join(', ')}</td></tr>`
    : '';

  return `
<div class="workitem" id="${esc(fn.id)}">
  <div class="wi-header">
    <span class="wi-title">${esc(fn.name)}</span>
    <span class="wi-tag">工作项 · ${esc(fn.polarion.chapter)}</span>
    <span class="wi-id">${esc(fn.polarion.workItemId ?? '待导入分配ID')}</span>
  </div>
  <table class="wi-table">
    <tr><td class="label">Service name</td><td><code>${esc(fn.name)}</code></td></tr>
    <tr><td class="label">Syntax</td><td><code>${esc(fn.signature)}</code></td></tr>
    <tr><td class="label">Service ID[hex]</td><td>${esc(c?.serviceId ?? 'None')}</td></tr>
    <tr><td class="label">Sync/Async</td><td>${esc(c?.syncAsync ?? 'Synchronous')}</td></tr>
    <tr><td class="label">Reentrancy</td><td>${esc(c?.reentrancy ?? 'Non Reentrancy')}</td></tr>
    ${paramRows(c?.paramsIn ?? [], 'in')}
    ${paramRows(c?.paramsInout ?? [], 'inout')}
    ${paramRows(c?.paramsOut ?? [], 'out')}
    <tr><td class="label">Return value</td><td>${esc(c?.returnValue ?? fn.returnType)}</td></tr>
    <tr><td class="label">Description</td><td class="desc">${desc}</td></tr>
    ${flowchartRow}
    ${condNote}${callsNote}${calledByNote}${globalsNote}
  </table>
  <div class="wi-footer">
    <span>源: ${esc(fn.file)}:${fn.lineStart}-${fn.lineEnd}</span>
    ${fn.complexity != null ? `<span>圈复杂度: ${fn.complexity}${fn.infiniteLoop ? '（含死循环）' : ''}</span>` : ''}
    <span>bodyHash: ${fn.bodyHash} · sigHash: ${fn.sigHash}</span>
    ${fn.generated ? `<span>描述生成: ${esc(fn.generated.llmModel)}</span>` : ''}
  </div>
</div>`;
}

/** Callout 工作项卡片（6.2.x Callout function，字段与函数卡片对齐模板） */
export function calloutCard(e: ExternalInterface, secNo: string): string {
  const c: HeaderComment | null = e.comment;
  const desc = e.generated?.detailedDescription
    ? `${esc(e.generated.detailedDescription)}<span class="inferred">推断，待确认</span>`
    : (c?.description ? esc(c.description) : '<span class="todo">（待生成）</span>');
  return `<h5>${secNo} <code>${esc(e.name)}</code></h5>
<div class="workitem">
  <div class="wi-header">
    <span class="wi-title">${esc(e.name)}</span>
    <span class="wi-tag">工作项 · ${esc(e.polarion.chapter)}</span>
    <span class="wi-id">${esc(e.polarion.workItemId ?? '待导入分配ID')}</span>
  </div>
  <table class="wi-table">
    <tr><td class="label">Service name</td><td><code>${esc(e.name)}</code></td></tr>
    <tr><td class="label">Syntax</td><td><code>${esc(e.signature || e.name)}</code></td></tr>
    <tr><td class="label">Sync/Async</td><td>${esc(c?.syncAsync ?? 'Synchronous')}</td></tr>
    <tr><td class="label">Reentrancy</td><td>${esc(c?.reentrancy ?? 'Non Reentrancy')}</td></tr>
    ${paramRows(c?.paramsIn ?? [], 'in')}
    ${paramRows(c?.paramsInout ?? [], 'inout')}
    ${paramRows(c?.paramsOut ?? [], 'out')}
    <tr><td class="label">Return value</td><td>${esc(c?.returnValue ?? 'None')}</td></tr>
    <tr><td class="label">Description</td><td class="desc">${desc}</td></tr>
    <tr><td class="label">模块内调用者</td><td class="muted small">${e.calledFrom.map(esc).join(', ')}</td></tr>
  </table>
</div>`;
}
