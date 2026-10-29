/**
 * 图 PNG 物化（gen --only images）：把 design json 里全部 mermaid 图渲染成 PNG 存回 json。
 * 本文件为纯逻辑（不碰 fs/进程），Edge I/O 在 cli/images.ts。
 *
 * 渲染管线与已验收报告严格一致：批量页 = 报告同款 CSS + 内嵌 mermaid.min.js +
 * mermaidRenderScript（正交化后处理），Edge --dump-dom 取渲染后 SVG，再逐图独立页
 * Edge --screenshot 出 PNG（默认 2x）。图源预处理与 htmlReport.diagramBlock 同口径
 * （pinEndNodeToBottom + wrapFlowchartLabels + escRaw）。
 */
import type { ModuleModel } from '../model/types.js';
import { listStateMachines } from '../model/types.js';
import { buildIncludeGraph } from './includeGraph.js';
import { escRaw } from './cards.js';
import { wrapFlowchartLabels, pinEndNodeToBottom } from './mermaidPre.js';
import { mermaidRenderScript } from './renderScript.js';
import { REPORT_CSS } from './htmlReport.js';

/** 图定位键：fn:<函数名> / overview / callgraph:<名> / sm:<名> / seq:<名> / include */
export interface DiagramEntry {
  key: string;
  kind: string;     // 中文类别名（日志用）
  title: string;
  src: string;      // mermaid 源码（原始，未预处理）
}

/** 收集全部六类图（顺序即批量页渲染顺序，稳定可 diff） */
export function collectDiagrams(model: ModuleModel): DiagramEntry[] {
  const out: DiagramEntry[] = [];
  if (model.interfaceOverview) {
    out.push({ key: 'overview', kind: '功能接口总图', title: model.module, src: model.interfaceOverview.diagram });
  }
  for (const g of model.callGraphs ?? []) {
    out.push({ key: `callgraph:${g.name}`, kind: '内部函数调用图', title: g.name, src: g.diagram });
  }
  for (const f of [...model.providedFunctions, ...model.internalFunctions]) {
    if (f.generated?.flowchart) {
      out.push({ key: `fn:${f.name}`, kind: '函数流程图', title: f.name, src: f.generated.flowchart });
    }
  }
  for (const sm of listStateMachines(model.dynamicDesign)) {
    out.push({ key: `sm:${sm.name}`, kind: '状态机', title: sm.name, src: sm.diagram });
  }
  for (const s of model.dynamicDesign?.sequences ?? []) {
    out.push({ key: `seq:${s.name}`, kind: '序列图', title: s.name, src: s.diagram });
  }
  const inc = buildIncludeGraph(model);
  if (inc) out.push({ key: 'include', kind: '4.2 包含关系图', title: model.module, src: inc });
  return out;
}

/** PNG 写回目标定位（返回持有字段的对象引用，就地改即写回 model） */
function findPngTarget(model: ModuleModel, key: string): { obj: object; field: string } | null {
  if (key === 'overview') return model.interfaceOverview ? { obj: model.interfaceOverview, field: 'diagramPng' } : null;
  if (key === 'include') return model.document ? { obj: model.document, field: 'includeGraphPng' } : null;
  const [prefix, name] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (prefix === 'callgraph') {
    const g = (model.callGraphs ?? []).find(x => x.name === name);
    return g ? { obj: g, field: 'diagramPng' } : null;
  }
  if (prefix === 'fn') {
    const f = [...model.providedFunctions, ...model.internalFunctions].find(x => x.name === name);
    return f?.generated ? { obj: f.generated, field: 'flowchartPng' } : null;
  }
  if (prefix === 'sm') {
    const sm = listStateMachines(model.dynamicDesign).find(x => x.name === name);
    return sm ? { obj: sm, field: 'diagramPng' } : null;
  }
  if (prefix === 'seq') {
    const s = (model.dynamicDesign?.sequences ?? []).find(x => x.name === name);
    return s ? { obj: s, field: 'diagramPng' } : null;
  }
  return null;
}

export function hasDiagramPng(model: ModuleModel, key: string): boolean {
  const t = findPngTarget(model, key);
  if (!t) return false;
  const v = (t.obj as Record<string, unknown>)[t.field];
  return typeof v === 'string' && v.length > 0;
}

/** 写回 PNG（base64）。返回 null=成功，否则失败原因 */
export function applyDiagramPng(model: ModuleModel, key: string, base64: string): string | null {
  const t = findPngTarget(model, key);
  if (!t) return key === 'include' ? '无 document 节（先跑 gen --only document --resume）' : `找不到图归属（${key}）`;
  (t.obj as Record<string, unknown>)[t.field] = base64;
  return null;
}

/** 批量渲染页：与报告同款 CSS + mermaid + 正交化脚本，每张图外包 data-key 定位容器 */
export function buildBatchPage(entries: DiagramEntry[], mermaidJs: string): string {
  const blocks = entries.map(e =>
    `<div class="lldimg" data-key="${escRaw(e.key)}"><div class="mermaid">${escRaw(wrapFlowchartLabels(pinEndNodeToBottom(e.src)))}</div></div>`
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>lld image batch</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<main>
${blocks}
</main>
<script>${mermaidJs}</script>
${mermaidRenderScript()}
</body>
</html>`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 从 Edge --dump-dom 产物提取各图渲染后 SVG；mermaid 语法错误的图（错误占位 svg）计入 failed */
export function extractDiagramSvgs(dump: string, entries: DiagramEntry[]): { svgs: Map<string, string>; failed: string[] } {
  const svgs = new Map<string, string>();
  const failed: string[] = [];
  for (const e of entries) {
    const km = dump.match(new RegExp(`data-key="${escapeRe(e.key)}"`));
    if (!km || km.index === undefined) { failed.push(e.key); continue; }
    const svgStart = dump.indexOf('<svg', km.index);
    const svgEnd = svgStart >= 0 ? dump.indexOf('</svg>', svgStart) : -1;
    if (svgStart < 0 || svgEnd < 0) { failed.push(e.key); continue; }
    const svg = dump.slice(svgStart, svgEnd + '</svg>'.length);
    // mermaid 语法错误的占位 svg 带「Syntax error in text」文本；
    // （.error-icon 只是每张图的固定 CSS 类定义，不能当错误判据——E2E 实测全图误杀）
    if (svg.includes('Syntax error in text')) { failed.push(e.key); continue; }
    svgs.set(e.key, svg);
  }
  return { svgs, failed };
}

/** SVG 自然尺寸（css px）：优先 viewBox，退回数值型 width/height 属性 */
export function svgNaturalSize(svg: string): { w: number; h: number } | null {
  const vb = svg.match(/viewBox="(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
  if (vb) return { w: +vb[3]!, h: +vb[4]! };
  const tag = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';
  const wm = tag.match(/\bwidth="([\d.]+)"/);
  const hm = tag.match(/\bheight="([\d.]+)"/);
  if (wm && hm) return { w: +wm[1]!, h: +hm[1]! };
  return null;
}

/** 截图参数：默认 2x；单边设备像素超 16000（Edge 16384 纹理上限留余量）时降 scale，最低 0.5 */
export function pickShotParams(w: number, h: number): { scale: number; winW: number; winH: number } {
  const scale = Math.max(0.5, Math.min(2, Math.floor((16000 / Math.max(w, h)) * 100) / 100));
  return { scale, winW: Math.ceil(w), winH: Math.ceil(h) };
}

/** 单图截图页：根 svg 摘掉 width/height/max-width 后按自然尺寸显式钉死，白底无页边距 */
export function wrapSvgShotPage(svg: string): string {
  const size = svgNaturalSize(svg);
  let out = svg;
  const tagMatch = out.match(/<svg\b[^>]*>/);
  if (tagMatch) {
    let tag = tagMatch[0];
    tag = tag.replace(/\s(width|height)="[^"]*"/g, '');
    tag = tag.replace(/\sstyle="([^"]*)"/, (_s, c: string) => {
      const nc = c.replace(/max-width\s*:[^;]*;?/g, '').trim();
      return nc ? ` style="${nc}"` : '';
    });
    if (size) tag = tag.replace(/>$/, ` width="${Math.ceil(size.w)}" height="${Math.ceil(size.h)}">`);
    out = out.slice(0, tagMatch.index) + tag + out.slice(tagMatch.index! + tagMatch[0].length);
  }
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#fff}body>svg{display:block}</style>
</head>
<body>
${out}
</body>
</html>`;
}
