import type {
  ModuleModel, FunctionUnit, HeaderComment, ParamDoc, ConfigMacro, ConfigUsage, ExternalInterface,
} from '../model/types.js';

/** HTML 转义 */
function esc(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

function escRaw(s: string | undefined | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 流程图 label 预折行：节点文字靠浏览器对 foreignObject 内 HTML 自动折行（mermaid label max-width 200px），
 * 个别浏览器中该折行失效，超长单行会被裁剪/溢出节点框。这里按估算像素宽度把每个 <br> 分段
 * 预先折到 200px 以内（优先在空格处断开，无空格长 token 硬断），渲染结果不再依赖浏览器折行。
 */
function wrapFlowchartLabels(src: string): string {
  if (!/^\s*flowchart/.test(src)) return src;
  const MAX_W = 185;  // px @13px 字号，对 200px 上限留余量
  const charW = (ch: string) => (ch.charCodeAt(0) < 0x7f ? 7 : 13.5);  // ASCII ≈7px，全角/CJK ≈13.5px
  const segWidth = (s: string) => [...s.replace(/<[^>]+>/g, '')].reduce((w, c) => w + charW(c), 0);
  const wrapSeg = (seg: string): string => {
    if (segWidth(seg) <= MAX_W) return seg;
    const atoms = seg.match(/<[^>]+>|[\s\S]/g) ?? [];   // HTML 标签作为整体原子，不计宽、不在内部断
    const lines: string[] = [];
    let line = '', w = 0, lastSpace = -1, lastParen = -1;  // lastParen：（的下标，次优断点（断在其前）
    for (const atom of atoms) {
      if (atom.length > 1 && atom.startsWith('<')) { line += atom; continue; }
      const cw = charW(atom);
      if (w + cw > MAX_W && line) {
        if (lastSpace > 0) {                 // 回退到本行最后一个空格处断开
          lines.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1);
        } else if (lastParen > 0) {          // 无空格时优先断在（前，避免拆散括号词
          lines.push(line.slice(0, lastParen));
          line = line.slice(lastParen);
        } else {                             // 无空格长 token：硬断
          lines.push(line);
          line = '';
        }
        w = segWidth(line);
        lastSpace = line.lastIndexOf(' ');
        lastParen = line.lastIndexOf('（');
        if (atom === ' ') continue;          // 断点处的空格丢弃
      }
      if (atom === ' ') lastSpace = line.length;
      if (atom === '（') lastParen = line.length;
      line += atom; w += cw;
    }
    if (line) lines.push(line);
    return lines.join('<br>');
  };
  return src.split('\n').map(l =>
    // subgraph 标题（条件编译注释）不折行：mermaid 按单行计算框顶高度，多行标题会压到框内节点
    /^\s*subgraph\s/.test(l) ? l : l.replace(/"([^"\n]*)"/g, (_m, label: string) =>
      `"${label.split(/<br\s*\/?>/i).map(wrapSeg).join('<br>')}"`),
  ).join('\n');
}

/**
 * 「结束」节点钉底：dagre 最长路径排名把结束放在其入边来源（多为循环条件菱形）的下一层，
 * 循环体更深时结束会悬在图中间（如 CheckInitRslt：D1 --否--> END 与循环体同层）。
 * 这里在 DAG（去回边）上从「开始」算最长路径深度，从所有不浅于结束的节点各引一条
 * ~~~ 隐形链到结束，强制其沉到最底；结束本就在底部的图深度已满、不加任何边，布局零影响。
 */
function pinEndNodeToBottom(src: string): string {
  if (!/^\s*flowchart/.test(src)) return src;
  const lines = src.split('\n');
  // 体育场形端子节点：ID(["label"])
  const ends: string[] = [];
  let startId: string | null = null;
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*\(\s*\[\s*"([^"]*)"\s*\]\s*\)/g)) {
    const label = m[2].replace(/<br\s*\/?>/gi, '').trim();
    if (/^(结束|End)$/i.test(label)) ends.push(m[1]);
    if (/^(开始|Start)$/i.test(label)) startId = m[1];
  }
  if (ends.length === 0) return src;
  // 解析边（只取 --> / --- 有向/无箭头连线；~~~ 隐形钉链不参与深度）
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    nodes.add(a); nodes.add(b);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
  };
  for (const raw of lines) {
    if (/^\s*(subgraph|end\b|style|classDef|class\s|direction|linkStyle|%%)/.test(raw)) continue;
    // 带标签连线归一成裸操作符：D1 -- 是 --> R / W -- 否 --- J
    const line = raw.replace(/--\s*[^-~>\n][^-~>\n]*?\s*(?=-->|---)/g, '');
    if (!/(~~~|-->|---|-\.->|==>)/.test(line)) continue;
    const segs = line.split(/~~~|-->|---|-\.->|==>/);
    if (line.includes('~~~')) continue;  // ~~~ 隐形钉链不参与深度
    const ids = segs.map(s => (s.match(/\b([A-Za-z_]\w*)\b/) ?? [])[1]);
    for (let i = 0; i + 1 < ids.length; i++) {
      if (ids[i] && ids[i + 1]) addEdge(ids[i]!, ids[i + 1]!);
    }
  }
  // DAG 最长路径深度：DFS 丢弃指向栈上祖先的回边（循环回边），深度单调递增必然收敛
  const depth = new Map<string, number>();
  const onStack = new Set<string>();
  const visit = (u: string, d: number): void => {
    if (onStack.has(u) || (depth.get(u) ?? -1) >= d) return;
    depth.set(u, d);
    onStack.add(u);
    for (const v of adj.get(u) ?? []) visit(v, d + 1);
    onStack.delete(u);
  };
  if (startId) visit(startId, 0);
  for (const n of nodes) if (!depth.has(n)) visit(n, 0);  // 开始不可达的游离节点按根处理
  // 从所有不浅于结束的节点引隐形链；插在结束首次出现行之后（保持同一 subgraph 作用域）
  const pins: string[] = [];
  for (const e of ends) {
    const de = depth.get(e) ?? 0;
    for (const [n, d] of depth) if (n !== e && d >= de) pins.push(`    ${n} ~~~ ${e}`);
  }
  if (pins.length === 0) return src;
  const firstEnd = ends[0]!;
  const idx = lines.findIndex(l => new RegExp(`\\b${firstEnd}\\b`).test(l));
  lines.splice(idx >= 0 ? idx + 1 : lines.length, 0, ...pins);
  return lines.join('\n');
}

/** 参数行（模板格式：变量名 + 说明含范围） */
function paramRows(params: ParamDoc[], dir: string): string {
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
function functionCard(fn: FunctionUnit, diagramBlock?: (src: string) => string, staticVars?: ReadonlySet<string>): string {
  const c: HeaderComment | null = fn.comment;
  const desc = fn.generated?.detailedDescription ?? c?.description ?? '<span class="todo">（待生成）</span>';
  const flowchart = fn.generated?.flowchart;
  const flowchartRow = flowchart
    ? `<tr><td class="label">流程图</td><td>${diagramBlock ? diagramBlock(flowchart) : `<pre class="plantuml">${escRaw(flowchart)}</pre>`}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(flowchart)}</pre></details></td></tr>`
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
function calloutCard(e: ExternalInterface, secNo: string): string {
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

/** 文件用途说明（4.1 文件说明表）：按角色 + 分析数据生成中文描述 */
function describeFile(path: string, role: string, model: ModuleModel): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const isC = /\.c$/i.test(base);
  switch (role) {
    case 'source': {
      // 主要入口：按命名约定识别 Startup/Mainfunction/Init 类入口函数
      const entries = model.providedFunctions
        .filter(f => /_(Startup|Mainfunction|MainFunction|Init)$/.test(f.name))
        .map(f => f.name.replace(/^Gp_\w+?_(?=[A-Z])/, ''));
      const entryNote = entries.length > 0 ? `；主要入口为 ${entries.join('、')}` : '';
      return `模块主实现文件：实现 ${model.providedFunctions.length} 个对外接口函数与 ${model.internalFunctions.length} 个内部函数${entryNote}`;
    }
    case 'header':
      return `模块对外头文件：声明 ${model.providedFunctions.length} 个对外接口函数`;
    case 'types': {
      const td = model.types.filter(t => t.kind === 'typedef').length;
      const st = model.types.filter(t => t.kind === 'struct').length;
      return `类型定义头文件：定义 ${td} 个枚举式 typedef 与 ${st} 个结构体`;
    }
    case 'callout': {
      const n = model.calledExternalFunctions.filter(e => e.group === 'Callout').length;
      return isC
        ? `Callout 实现文件（配置代码）：由集成方实现 ${n} 个 Callout 函数的具体策略`
        : `Callout 声明头文件（配置代码）：声明 ${n} 个由集成方实现的 Callout 函数`;
    }
    case 'config': {
      if (isC) return '配置数据文件（配置代码）：定义模块配置数据（核运行时容器、函数指针表等）';
      const n = model.configMacros.filter(c => c.file === path && c.kind !== 'alias').length;
      return n > 0
        ? `配置参数头文件（配置代码）：定义 ${n} 个配置宏`
        : '配置数据头文件（配置代码）：配置数据的类型与声明';
    }
    case 'memmap':
      return '内存映射头文件：定义变量/函数的存储段放置（MemMap），不影响功能逻辑';
    default:
      return role;
  }
}

/** 4.1 表格顺序：主文件在前，其后按 头文件→类型→配置→Callout→Memmap */
function fileSortKey(f: { path: string; role: string }): string {
  const rank: Record<string, number> = { source: 0, header: 1, types: 2, config: 3, callout: 4, memmap: 5 };
  const isC = /\.c$/i.test(f.path) ? '1' : '0';  // 同角色 .h 在 .c 前
  return `${rank[f.role] ?? 9}${isC}${f.path}`;
}

const CSS = `
:root { --border:#d0d7de; --label-bg:#f6f8fa; --accent:#0969da; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", "Microsoft YaHei", sans-serif; margin:0; color:#1f2328; }
header { background:#0a3069; color:#fff; padding:24px 40px; }
header h1 { margin:0 0 8px; font-size:22px; }
header .meta { opacity:.85; font-size:13px; }
nav { background:#f6f8fa; border-bottom:1px solid var(--border); padding:10px 40px; position:sticky; top:0; z-index:10; font-size:13px; }
nav a { margin-right:16px; color:var(--accent); text-decoration:none; }
main { max-width:1060px; margin:0 auto; padding:24px 40px 80px; }
h2 { border-bottom:2px solid var(--accent); padding-bottom:6px; margin-top:48px; font-size:19px; }
h3 { margin-top:32px; font-size:16px; color:#0a3069; }
h4 { margin-top:24px; font-size:14px; color:#24292f; }
h5 { margin-top:20px; font-size:13px; color:#24292f; }
.workitem { border:1px solid var(--border); border-radius:8px; margin:20px 0; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.wi-header { background:#0a3069; color:#fff; padding:10px 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.wi-title { font-weight:600; font-family:Consolas,monospace; }
.wi-tag { background:#1f6feb; border-radius:10px; padding:2px 10px; font-size:12px; }
.wi-id { margin-left:auto; font-size:12px; opacity:.8; }
.wi-table { width:100%; border-collapse:collapse; font-size:14px; }
.wi-table td { border-top:1px solid var(--border); padding:8px 16px; vertical-align:top; }
.wi-table td.label { width:170px; background:var(--label-bg); font-weight:600; font-size:13px; }
.wi-table .desc { line-height:1.7; }
.wi-footer { background:var(--label-bg); padding:6px 16px; font-size:11px; color:#57606a; display:flex; gap:24px; flex-wrap:wrap; }
table.simple { border-collapse:collapse; width:100%; font-size:14px; margin:12px 0; }
table.simple th { background:var(--label-bg); border:1px solid var(--border); padding:8px 12px; text-align:left; }
table.simple td { border:1px solid var(--border); padding:8px 12px; vertical-align:top; }
code { font-family:Consolas,monospace; font-size:13px; }
.muted { color:#57606a; } .small { font-size:12px; }
.todo { color:#cf222e; }
pre.plantuml { background:#0d1117; color:#c9d1d9; padding:16px; border-radius:8px; overflow:auto; font-size:12.5px; line-height:1.5; }
.badge { display:inline-block; background:#ddf4ff; color:#0969da; border-radius:10px; padding:1px 8px; font-size:12px; margin-left:8px; }
.inferred { display:inline-block; background:#fff8c5; color:#9a6700; border:1px solid #eac54f; border-radius:8px; padding:0 6px; font-size:11px; margin-left:6px; }
.note { background:#fff8c5; border:1px solid #eac54f; border-radius:6px; padding:10px 14px; font-size:13px; margin:12px 0; }
.mermaid { overflow-x:auto; font-size:13px; text-align:center; }
/* useMaxWidth:false 时 svg 按自然宽度输出，超宽的图（如 Startup 双分支）会溢出页面被裁；
   这里限制最大宽度随容器缩小（viewBox 等比缩放），小图不放大 */
.mermaid svg, .mermaid img { display:block; margin:0 auto; max-width:100%; height:auto; }
/* 个别浏览器中节点文字未按预期折行时会被 foreignObject 截断，放开裁剪兜底（宁可轻微溢出节点框，不可截字） */
.mermaid foreignObject { overflow:visible; }
@media print {
  nav { display:none; }
  .workitem { break-inside:avoid; }
  .mermaid { overflow-x:visible; }
  .mermaid svg { max-width:100% !important; height:auto !important; }
}
@page { size:A4; margin:12mm; }
`;

/** 生成完整 HTML 评审报告；传入 mermaidJs（mermaid.min.js 内容）则离线渲染图 */
export function generateHtmlReport(model: ModuleModel, opts?: { mermaidJs?: string }): string {
  const fnCount = model.providedFunctions.length + model.internalFunctions.length;
  const generatedCount = [...model.providedFunctions, ...model.internalFunctions].filter(f => f.generated).length;

  const diagramBlock = (src: string) => opts?.mermaidJs
    ? `<div class="mermaid">${escRaw(wrapFlowchartLabels(pinEndNodeToBottom(src)))}</div>`
    : `<pre class="plantuml">${escRaw(src)}</pre>`;

  // ---- 外部接口按组归类（5.2.1.1 与 5.2.2 共用） ----
  const groups = new Map<string, typeof model.calledExternalFunctions>();
  for (const e of model.calledExternalFunctions) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group)!.push(e);
  }

  // ---- 5.2.1.1 引用的数据类型（只列类型，对应模板 模块名|Imported Type；外部函数归属 5.2.2，不在此列） ----
  const STD_TYPES = ['Std_ReturnType', 'boolean', 'uint8', 'uint16', 'uint32', 'uint64',
    'sint8', 'sint16', 'sint32', 'sint64', 'float32', 'float64'];
  const scanText = [
    ...[...model.providedFunctions, ...model.internalFunctions].map(f => f.signature),
    ...[...model.internalVariables, ...model.providedVariables].map(v => v.type),
    ...model.types.flatMap(t => [t.underlyingType ?? '', ...(t.elements ?? []).map(e => e.type)]),
  ].join(' ');
  const usedStdTypes = STD_TYPES.filter(t => new RegExp(`\\b${t}\\b`).test(scanText));
  // 外部类型探测：按 AUTOSAR 命名约定取 XxxType 形标识符，排除本模块已定义类型与 Std_Types，
  // 按模块前缀归组（Dem_EventIdType → Dem）；无下划线前缀的（如 CounterType）归入「其他」
  const localTypeNames = new Set(model.types.map(t => t.name));
  const extTypeGroups = new Map<string, Set<string>>();
  for (const tok of scanText.match(/[A-Za-z_]\w*/g) ?? []) {
    if (!/Type$/.test(tok)) continue;
    if (localTypeNames.has(tok) || STD_TYPES.includes(tok)) continue;
    const mod = tok.includes('_') ? tok.split('_')[0] : '其他';
    if (!extTypeGroups.has(mod)) extTypeGroups.set(mod, new Set());
    extTypeGroups.get(mod)!.add(tok);
  }
  const importedTypeRows: string[] = [];
  if (usedStdTypes.length > 0) {
    importedTypeRows.push(`<tr><td><code>Std_Types</code></td><td><code>${usedStdTypes.join('<br>')}</code></td></tr>`);
  }
  for (const [mod, types] of [...extTypeGroups.entries()].sort()) {
    importedTypeRows.push(`<tr><td><code>${esc(mod)}</code></td><td><code>${[...types].map(esc).join('<br>')}</code></td></tr>`);
  }

  // ---- 5.2.1.2 数据类型（属性|值 格式，参照模板与既有文档） ----
  const numOf = (v: string) => v.match(/0x[0-9A-Fa-f]+|\d+/)?.[0] ?? '';
  const typesSection = model.types.map(t => {
    const attrRows: string[] = [
      `<tr><td class="label">Name</td><td><code>${esc(t.name)}</code></td></tr>`,
      `<tr><td class="label">Type</td><td><code>${esc(t.kind === 'struct' ? 'struct' : t.underlyingType ?? '')}</code></td></tr>`,
    ];
    if (t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) > 0) {
      const defs = t.relatedDefines!;
      attrRows.push(`<tr><td class="label">Range</td><td><code>${esc(numOf(defs[0].value))} - ${esc(numOf(defs[defs.length - 1].value))}</code></td></tr>`);
    }
    attrRows.push(`<tr><td class="label">Description</td><td>${esc(t.comment) || '<span class="todo">（待补充）</span>'}</td></tr>`);

    let detailTable = '';
    if (t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) > 0) {
      const rows = t.relatedDefines!.map(d =>
        `<tr><td><code>${esc(d.name)}</code></td><td><code>${esc(d.value)}</code></td><td>${esc(d.comment)}</td></tr>`).join('');
      detailTable = `<table class="simple"><tr><th>常量名称</th><th>值</th><th>说明</th></tr>${rows}</table>`;
    } else if (t.kind === 'struct') {
      const rows = (t.elements ?? []).map(e =>
        `<tr><td><code>${esc(e.name)}</code></td><td><code>${esc(e.type)}</code></td><td>${esc(e.comment)}</td></tr>`).join('');
      detailTable = `<table class="simple"><tr><th>元素名称</th><th>数据类型</th><th>说明</th></tr>${rows}</table>`;
    }
    return `<h3>${esc(t.name)} <span class="badge">工作项 · 5.2.1.2</span></h3>
<table class="wi-table"><tr><th style="width:170px;text-align:left;padding:8px 16px;background:var(--label-bg)">属性</th><th style="text-align:left;padding:8px 16px;background:var(--label-bg)">值</th></tr>${attrRows.join('')}</table>
${detailTable}`;
  }).join('\n');

  // ---- 5.2.2 调用的外部接口（按组） ----
  // Callout 属于本模块配置代码（ConfTemplate），不算外部接口，此处排除；
  // 其声明/实现见 4.1 文件说明，调用关系见各函数卡片"调用"行
  const calloutCount = model.calledExternalFunctions.filter(e => e.group === 'Callout').length;
  const calledSection = [...groups.entries()]
    .filter(([group]) => group !== 'Callout')
    .map(([group, items]) => {
    const rows = items.map(e =>
      `<tr><td><code>${esc(e.name)}</code></td><td>${esc(e.comment?.description ?? '')}${e.commentSource === 'inferred' ? ' <span class="inferred">推断，待确认</span>' : ''}</td><td class="muted small">${e.calledFrom.map(esc).join(', ')}</td></tr>`).join('');
    return `<h3>${esc(group)} <span class="badge">${items.length} 个接口</span></h3>
<table class="simple"><tr><th>接口</th><th>说明</th><th>模块内调用者</th></tr>${rows}</table>`;
  }).join('\n');

  // ---- 5.2.4.1 内部变量 ----
  const internalVarRows = model.internalVariables.map(v => {
    const badges = [v.isConst ? '<span class="badge">const</span>' : '', v.isVolatile ? '<span class="badge">volatile</span>' : ''].join('');
    return `<tr><td><code>${esc(v.name)}</code>${badges}</td><td><code>${esc(v.type)}</code></td><td>${esc(v.comment)}</td>${v.conditionalFlags.length ? `<td class="muted small">条件: <code>${esc(v.conditionalFlags.join(','))}</code></td>` : '<td></td>'}</tr>`;
  }).join('');
  const staticVarNames: ReadonlySet<string> = new Set(model.internalVariables.map(v => v.name));

  // ---- 5.2.3.1 提供的外部全局变量 ----
  const providedVarSection = model.providedVariables.length === 0
    ? '<p class="muted">注：本模块未提供外部链接的全局变量（即非 static 的文件作用域变量），模块数据均通过函数接口访问。</p>'
    : `<table class="simple"><tr><th>变量名</th><th>数据类型</th><th>说明</th></tr>${model.providedVariables.map(v =>
        `<tr><td><code>${esc(v.name)}</code></td><td><code>${esc(v.type)}</code></td><td>${esc(v.comment)}</td></tr>`).join('')}</table>`;

  // ---- 4.2 文件包含关系（由 #include 静态生成 Mermaid 图，无需 LLM） ----
  // 样式对齐模板：UML 版型节点（«header»/«Source» + 加粗文件名），虚线 «include» 箭头，
  // BT 布局——源文件在底部，箭头朝上指向被包含的头文件（模板约定：箭头指向被调用的元素）
  const sanitizeId = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');
  // 长文件名按模块前缀折行，控制节点宽度避免导出超页宽
  const wrapFileLabel = (base: string) =>
    base.startsWith(`${model.module}_`) ? `${model.module}_<br/>${base.slice(model.module.length + 1)}` : base;
  const moduleFileBases = new Set(model.files.map(f => f.path.split(/[\\/]/).pop()!));
  const isMemmap = (base: string) => /memmap/i.test(base);
  const includeNodes: string[] = [];
  const includeEdges: string[] = [];
  const seenNodes = new Set<string>();
  const droppedExternals = new Set<string>();
  const addIncludeNode = (base: string): void => {
    if (seenNodes.has(base)) return;
    seenNodes.add(base);
    const stereotype = /\.c$/i.test(base) ? '«Source»' : '«header»';
    includeNodes.push(`    ${sanitizeId(base)}["${stereotype}<br/><b>${wrapFileLabel(base)}</b>"]`);
  };
  for (const f of model.files) {
    const base = f.path.split(/[\\/]/).pop()!;
    if (isMemmap(base)) continue;   // Memmap 文件不出图（纯 pragma 包装）
    for (const inc of f.includes ?? []) {
      const incBase = inc.split(/[\\/]/).pop()!;
      if (isMemmap(incBase)) continue;   // MemMap.h 默认被各文件包含，不画出
      if (!moduleFileBases.has(incBase) && incBase !== 'Std_Types.h') {
        droppedExternals.add(incBase);   // 外部模块头文件不画出（Std_Types.h 除外）
        continue;
      }
      addIncludeNode(base);
      addIncludeNode(incBase);
      includeEdges.push(`    ${sanitizeId(base)} -.->|"«include»"| ${sanitizeId(incBase)}`);
    }
  }
  const includeGraph = includeEdges.length > 0
    ? [
        'flowchart BT',
        ...includeNodes,
        ...includeEdges,
        '    classDef header fill:#dae8fc,stroke:#6c8ebf,color:#1a1a1a',
        '    classDef source fill:#d5e8d4,stroke:#82b366,color:#1a1a1a',
        `    class ${[...seenNodes].filter(b => !/\.c$/i.test(b)).map(sanitizeId).join(',')} header`,
        `    class ${[...seenNodes].filter(b => /\.c$/i.test(b)).map(sanitizeId).join(',')} source`,
      ].join('\n')
    : '';
  const includeNote = droppedExternals.size > 0
    ? `注：箭头指向被包含的头文件（模板约定：箭头指向被调用的元素）。MemMap.h 为内存映射包装文件，默认被本模块各文件包含，图中不再画出；外部模块头文件（${[...droppedExternals].sort().join('、')}）不在图中展示，标准类型头文件 Std_Types.h 除外。`
    : '注：箭头指向被包含的头文件（模板约定：箭头指向被调用的元素）。MemMap.h 为内存映射包装文件，默认被本模块各文件包含，图中不再画出。';

  // ---- 5.1 功能描述 ----
  const functionalDescSection = model.functionalDescription
    ? `<p>${esc(model.functionalDescription)}</p>`
    : '<p class="todo">（待生成：模块级功能描述，由 LLM 基于接口与动态设计事实生成）</p>';
  // 功能接口总图：analyze 时静态生成并存入模型（工作项 · 5.1），此处仅渲染
  const overviewSection = model.interfaceOverview ? `
<h3>功能接口总图 <span class="badge">工作项 · ${esc(model.interfaceOverview.polarion.chapter)}</span></h3>
<p class="muted">本模块对外提供 ${model.providedFunctions.length} 个接口函数（左侧为调用方），并调用 ${model.calledExternalFunctions.length - calloutCount} 个外部接口（右侧按来源模块归组）；箭头方向为调用方向。Callout 函数属本模块配置点，不在本图展示，其调用关系见下方内部函数调用图与 6.2；各接口的模块内调用者见内部函数调用图与 5.2.2 表。</p>
${diagramBlock(model.interfaceOverview.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(model.interfaceOverview.diagram)}</pre></details>` : '';
  // 内部函数调用图：analyze 时按对外接口函数逐张静态生成（每张一个工作项 · 5.1），此处仅渲染
  const callGraphSection = (model.callGraphs?.length ?? 0) > 0 ? `
<h3>内部函数调用图（每张图一个工作项）</h3>
<p class="muted">按对外接口函数分别绘制其模块内调用树（深蓝=入口函数，灰=内部函数，蓝=被内部调用的对外接口，黄=Callout 函数（配置代码））；同一函数被多处调用时按调用路径重复出现，保证布局无交叉。经配置表函数指针间接引用的 Callout 单独成图。无模块内调用的平凡函数不出图，其余跨模块调用（Gp_RstM / Gp_TstApp 等）见功能接口总图与 5.2.2 表。</p>
${model.callGraphs!.map(g => `<h4>内部函数调用图：${esc(g.name)} <span class="badge">工作项 · ${esc(g.polarion.chapter)}</span></h4>
${diagramBlock(g.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(g.diagram)}</pre></details>`).join('\n')}` : '';

  // ---- 5.3 动态设计 ----
  const dd = model.dynamicDesign;
  const smSection = dd?.stateMachine ? `
<h3>5.3.1 状态机：${esc(dd.stateMachine.name)} <span class="badge">工作项 · 5.3.1</span></h3>
${diagramBlock(dd.stateMachine.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(dd.stateMachine.diagram)}</pre></details>
<h3>5.3.1.1 状态描述（每个状态一个工作项）</h3>
<table class="simple"><tr><th>状态</th><th>说明</th></tr>
${dd.stateMachine.states.map(s => `<tr><td><code>${esc(s.name)}</code></td><td>${esc(s.description)}</td></tr>`).join('')}</table>
<h3>5.3.1.2 状态迁移（每个迁移一个工作项）</h3>
<table class="simple"><tr><th>从</th><th>到</th><th>触发条件</th><th>说明</th></tr>
${dd.stateMachine.transitions.map(t => `<tr><td><code>${esc(t.from)}</code></td><td><code>${esc(t.to)}</code></td><td>${esc(t.trigger)}</td><td>${esc(t.description)}</td></tr>`).join('')}</table>` : '';

  const seqSection = (dd?.sequences ?? []).map(s => `
<h3>5.3.2 序列图：${esc(s.name)} <span class="badge">工作项 · 5.3.2</span></h3>
<p class="muted">${esc(s.description)}</p>
${diagramBlock(s.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(s.diagram)}</pre></details>`).join('\n');

  // ---- 6 配置（6.1 通用 / 6.2 功能，每个配置项一个子章节） ----
  const USAGE_KIND_LABEL: Record<ConfigUsage['kind'], string> = {
    condCompile: '条件编译裁剪',
    arrayDim: '数组维度',
    loopBound: '循环上界',
    call: '代码中调用',
    reference: '直接引用',
  };
  const configSubsection = (c: ConfigMacro, secNo: string): string => {
    const usageParts: string[] = [];
    const condUsages = c.usages.filter(u => u.kind === 'condCompile');
    if (condUsages.length > 0) {
      const exprs = [...new Set(condUsages.map(u => u.context.replace(/^#\s*(?:if|elif)\s*/, '')))];
      usageParts.push(`<li>条件编译裁剪 ${condUsages.length} 处：${exprs.map(e => `<code>${esc(e)}</code>`).join('，')}</li>`);
    }
    for (const kind of ['arrayDim', 'loopBound', 'call', 'reference'] as const) {
      const us = c.usages.filter(u => u.kind === kind);
      if (us.length === 0) continue;
      const locs = us.map(u => `${esc(u.file.split(/[\\/]/).pop()!)}:${u.line}`).join('，');
      usageParts.push(`<li>${USAGE_KIND_LABEL[kind]} ${us.length} 处（${locs}），如 <code>${esc(us[0].context)}</code>${us.length > 1 ? ' 等' : ''}</li>`);
    }
    if (c.usages.length === 0) usageParts.push('<li class="muted">模块内未发现引用点</li>');
    const example = `#define ${c.name}${c.isFunctionLike ? '()' : ''}   ${c.value || ''}${c.comment ? `  /* ${c.comment} */` : ''}`;
    return `<h4>${secNo} <code>${esc(c.name)}</code></h4>
<table class="simple"><tr><th>配置项</th><th>取值</th><th>形式</th><th>说明</th></tr>
<tr><td><code>${esc(c.name)}</code></td><td><code>${esc(c.value)}</code></td><td>${c.isFunctionLike ? '函数式宏' : '值宏'}</td><td>${esc(c.comment)}</td></tr></table>
<p><b>配置示例：</b></p>
<pre class="plantuml">${escRaw(example)}</pre>
<p><b>使用方式（静态分析事实）：</b></p>
<ul>${usageParts.join('')}</ul>
${c.affects.length > 0 ? `<p><b>影响范围（条件编译直接作用的函数/变量）：</b>${c.affects.map(a => `<code>${esc(a)}</code>`).join('，')}</p>` : ''}
<p><b>取值影响：</b>${c.generated ? `${esc(c.generated.valueEffect)}<span class="inferred">推断，待确认</span>` : '<span class="todo">（待 LLM 生成）</span>'}</p>`;
  };
  const configSections = (list: ConfigMacro[], base: string) =>
    list.length === 0
      ? '<p class="muted">注：本模块无此类配置项。</p>'
      : list.map((c, i) => configSubsection(c, `${base}.${i + 1}`)).join('\n');
  const generalCfgSection = configSections(model.configMacros.filter(c => c.kind === 'general'), '6.1');
  const functionalCfgs = model.configMacros.filter(c => c.kind === 'functional');
  const functionalCfgSection = configSections(functionalCfgs, '6.2');
  // Callout 函数：由集成方在配置代码中实现，属于功能配置点
  const callouts = model.calledExternalFunctions.filter(e => e.group === 'Callout');
  const calloutSecNo = `6.2.${functionalCfgs.length + 1}`;
  const calloutCfgSection = callouts.length === 0 ? '' : `<h4>${calloutSecNo} Callout function</h4>
<p class="muted">Callout 函数由集成方在配置代码（ConfTemplate）中实现，是本模块的功能配置点：通过编写/修改 Callout 实现来适配项目策略（核ID获取、阶段初始化、故障处理等）。每个 Callout 为一个独立工作项。</p>
${callouts.map((e, i) => calloutCard(e, `${calloutSecNo}.${i + 1}`)).join('\n')}`;
  const aliasCfgs = model.configMacros.filter(c => c.kind === 'alias');
  const aliasCfgNote = aliasCfgs.length === 0 ? '' :
    `<p class="muted">注：以下宏为固定别名（实现重定义，无可选值，不属于配置项）：${aliasCfgs.map(c => `<code>${esc(c.name)}${c.isFunctionLike ? '()' : ''} → ${esc(c.value)}</code>`).join('，')}</p>`;

  // ---- 7 详细设计规范评估（模板固定 14 项；事实依据自动填，结论人工确认） ----
  const allFns = [...model.providedFunctions, ...model.internalFunctions];
  const extGroupNames = [...groups.keys()];
  const nonCalloutGroups = extGroupNames.filter(g => g !== 'Callout');
  const commIfs = model.calledExternalFunctions.filter(e =>
    /\b(Spi|Can(Fd)?|Lin|Eth|Com_|PduR|Dcm|SoAd|Fr)(_|$|\b)/i.test(e.name));
  const maxComplexity = Math.max(0, ...allFns.map(f => f.complexity ?? 0));
  const highComplexity = allFns.filter(f => (f.complexity ?? 0) > 10);
  const loopFns = allFns.filter(f => f.infiniteLoop);
  const condCfgs = model.configMacros.filter(c => c.usages.some(u => u.kind === 'condCompile'));
  const safetyIds = [
    ...allFns.filter(f => /safe|safety/i.test(f.name)).map(f => f.name),
    ...model.configMacros.filter(c => /safe|safety/i.test(c.name)).map(c => c.name),
  ];
  const TODO_CONCLUSION = '<span class="todo">结论待人工确认</span>';
  const evalRows: { dim: string; no: number; content: string; fact: string }[] = [
    { dim: '互操作性/交互', no: 1, content: '对软件单元的接口一致性进行分析',
      fact: `本模块提供 ${model.providedFunctions.length} 个接口函数（5.2.3.2），调用外部接口 ${model.calledExternalFunctions.length} 个（${extGroupNames.join('、')}），签名与调用点均已由静态分析提取；与软件架构接口的一致性需对照架构文档确认。${TODO_CONCLUSION}` },
    { dim: '互操作性/交互', no: 2, content: '软件单元对全局变量引用的正确性',
      fact: `模块内静态全局变量 ${model.internalVariables.length} 个（5.2.4.1），外部链接全局变量 ${model.providedVariables.length} 个（5.2.3.1）；各函数的全局变量访问已在函数卡片逐条列出。${TODO_CONCLUSION}` },
    { dim: '互操作性/交互', no: 3, content: '对涉及通讯协议的软件单元分析协议的一致性',
      fact: commIfs.length === 0
        ? '静态分析未探测到通讯协议相关接口（Spi/Can/Lin/Eth/Com/PduR 等）调用，本模块不涉及通讯协议。<span class="muted">（自动判定，如有遗漏请人工更正）</span>'
        : `探测到通讯协议相关调用：${commIfs.map(e => `<code>${esc(e.name)}</code>`).join('、')}。${TODO_CONCLUSION}` },
    { dim: '互操作性/交互', no: 4, content: '分析软件单元是否能够体现动态行为和交互',
      fact: model.dynamicDesign
        ? `5.3 已生成${model.dynamicDesign.stateMachine ? `状态机「${esc(model.dynamicDesign.stateMachine.name)}」（${model.dynamicDesign.stateMachine.states.length} 状态 / ${model.dynamicDesign.stateMachine.transitions.length} 迁移）` : ''}${model.dynamicDesign.sequences.length > 0 ? `与 ${model.dynamicDesign.sequences.length} 张序列图` : ''}；5.1 功能接口总图与各函数调用图体现交互关系。${TODO_CONCLUSION}`
        : `5.3 动态设计（状态机/序列图）尚未生成；5.1 已提供功能接口总图与内部函数调用图。${TODO_CONCLUSION}` },
    { dim: '关键性', no: 5, content: '分析与其他单元/组件的依赖关系',
      fact: `外部依赖模块：${nonCalloutGroups.length > 0 ? nonCalloutGroups.join('、') : '无'}（接口明细见 5.2.2）；Callout 函数 ${calloutCount} 个由集成方在配置代码中实现（见 6.2）。${TODO_CONCLUSION}` },
    { dim: '关键性', no: 6, content: '其他关键性的分析维度(如任务、算法等)',
      fact: condCfgs.length > 0
        ? `条件编译配置项 ${condCfgs.length} 个（${condCfgs.map(c => `<code>${esc(c.name)}</code>`).join('、')}）直接裁剪参与编译的函数/变量（影响范围见第 6 章）。${TODO_CONCLUSION}`
        : `本模块无条件编译裁剪点。${TODO_CONCLUSION}` },
    { dim: '技术复杂性', no: 7, content: '分析详细设计单元的复杂度（模型复杂度、圈复杂度）',
      fact: `已静态计算全部 ${allFns.length} 个函数的圈复杂度（明细见下表）：最大 ${maxComplexity}${highComplexity.length > 0 ? `，超过 10 的函数 ${highComplexity.length} 个（${highComplexity.map(f => `<code>${esc(f.name)}</code>`).join('、')}）` : '，无超过 10 的函数'}。${TODO_CONCLUSION}` },
    { dim: '可实现性', no: 8, content: '从时间周期、实现条件（人员、设备等）下分析相应功能的实现能力，分析出风险、并制定处理措施',
      fact: `（项目管理层面的评估，无代码事实可自动提取）${TODO_CONCLUSION}` },
    { dim: '可测试性', no: 9, content: '分析软件单元的可控性（是否存在死循环、复杂度过高的情况）',
      fact: `死循环（while(1)/for(;;)）探测：${loopFns.length === 0 ? '未发现' : `发现 ${loopFns.length} 处（${loopFns.map(f => `<code>${esc(f.name)}</code>`).join('、')}）`}；圈复杂度最大 ${maxComplexity}${highComplexity.length > 0 ? `，${highComplexity.length} 个函数超过 10` : ''}。${TODO_CONCLUSION}` },
    { dim: '可测试性', no: 10, content: '分析单元输入、输出的可观测性',
      fact: `全部 ${allFns.length} 个函数的输入/输出参数与返回值已在 5.2.3.2 / 5.2.4.2 函数卡片中逐项列出（含取值范围说明）。${TODO_CONCLUSION}` },
    { dim: '可复用性', no: 11, content: '分析详细设计单元是否能够被本系统或其他系统使用的可能性',
      fact: `本模块含 ${calloutCount} 个 Callout 项目适配点与 ${model.configMacros.filter(c => c.kind !== 'alias').length} 个配置宏，平台化/复用策略需人工评估。${TODO_CONCLUSION}` },
    { dim: '安全性', no: 12, content: '分析软件设计单元是否是功能安全输出',
      fact: safetyIds.length > 0
        ? `探测到安全相关标识符：${safetyIds.map(s => `<code>${esc(s)}</code>`).join('、')}；是否构成功能安全输出需人工判定。${TODO_CONCLUSION}`
        : `未探测到安全相关标识符。${TODO_CONCLUSION}` },
    { dim: '安全性', no: 13, content: '分析违反功能安全目标的风险可控性',
      fact: `（需结合系统级安全分析人工评估）${TODO_CONCLUSION}` },
    { dim: '安全性', no: 14, content: '分析是否违背功能安全',
      fact: `（需结合系统级安全分析人工评估）${TODO_CONCLUSION}` },
  ];
  // 维度列合并（rowspan）
  const evalTableRows: string[] = [];
  let i = 0;
  while (i < evalRows.length) {
    const dim = evalRows[i].dim;
    let span = 0;
    while (i + span < evalRows.length && evalRows[i + span].dim === dim) span++;
    evalRows.slice(i, i + span).forEach((r, j) => {
      evalTableRows.push(`<tr>${j === 0 ? `<td rowspan="${span}"><b>${esc(dim)}</b></td>` : ''}<td>${r.no}</td><td>${esc(r.content)}</td><td>是</td><td>${r.fact}</td></tr>`);
    });
    i += span;
  }
  // 序号 7 的事实明细：圈复杂度表（按复杂度降序）
  const complexityRows = [...allFns]
    .sort((a, b) => (b.complexity ?? 0) - (a.complexity ?? 0))
    .map(f => `<tr><td><code>${esc(f.name)}</code></td><td>${f.complexity ?? '—'}</td><td>${f.infiniteLoop ? '含死循环' : ''}</td><td>${(f.complexity ?? 0) > 10 ? '<span class="todo">超过 10，需人工评审</span>' : '<span class="muted">≤10</span>'}</td></tr>`)
    .join('');
  const evalSection = `
<h2 id="s7">7 详细设计规范评估</h2>
<table class="simple"><tr><th>维度</th><th>序号</th><th>评估内容</th><th>是否评估</th><th>分析结果（事实依据自动生成，结论人工确认）</th></tr>${evalTableRows.join('')}</table>
<h3>圈复杂度明细（序号 7 事实依据，静态计算）</h3>
<p class="muted">判定节点计数法：1 + if / for / while / case / &amp;&amp; / || / ?: 数量。阈值 10 为常见评审参考值，最终以项目规范为准。</p>
<table class="simple"><tr><th>函数</th><th>圈复杂度</th><th>死循环</th><th>参考评估</th></tr>${complexityRows}</table>
<h3>总结</h3>
<p class="muted">本模块设计过程中已对上述内容进行评估，各维度说明如下（骨架自动生成，需人工补全/确认）：</p>
<ul class="muted">
<li>互操作性/交互：接口与全局变量的定义、调用关系详见 5.2；通讯协议${commIfs.length === 0 ? '不涉及' : '一致性待确认'}。<span class="todo">待人工确认</span></li>
<li>关键性：外部依赖（${nonCalloutGroups.join('、') || '无'}）与任务调度考虑。<span class="todo">待人工确认</span></li>
<li>技术复杂性：圈复杂度最大 ${maxComplexity}${highComplexity.length > 0 ? `，${highComplexity.length} 个函数超过 10` : '，均在 10 以内'}。<span class="todo">待人工确认</span></li>
<li>可实现性：按项目时间安排与既往经验评估。<span class="todo">待人工补充</span></li>
<li>可测试性：函数输入输出及范围均已列出，圈复杂度已控制。<span class="todo">待人工确认</span></li>
<li>可复用性：是否平台化需人工说明。<span class="todo">待人工补充</span></li>
<li>安全性：${safetyIds.length > 0 ? '涉及安全相关接口/配置，是否功能安全输出需人工判定' : '是否涉及功能安全需人工判定'}。<span class="todo">待人工确认</span></li>
</ul>`;

  // ---- 1~3 章（固定套话 + 术语表自动筛选；文档骨架内容，非工作项） ----
  const allText = [
    model.module,
    ...allFns.map(f => `${f.name} ${f.signature}`),
    ...model.calledExternalFunctions.map(e => e.name),
    ...model.configMacros.map(c => c.name),
    model.functionalDescription ?? '',
  ].join(' ');
  // 候选缩写词典：仅列本文档/代码中实际出现的
  const ABBR_CANDIDATES: [string, string][] = [
    ['ADC', 'Analog to Digital Converter 模数转换器'],
    ['ASIL', 'Automotive Safety Integrity Level 汽车安全完整性等级'],
    ['AUTOSAR', 'AUTomotive Open System ARchitecture 汽车开放系统架构'],
    ['Callout', 'Callout 函数：由集成方在配置代码中实现，模块通过调用 Callout 适配项目策略'],
    ['EcuM', 'ECU State Manager ECU 状态管理模块'],
    ['FC', 'Function Cluster 功能簇'],
    ['LLD', 'Low Level Design 详细设计'],
    ['MCAL', 'Microcontroller Abstraction Layer 微控制器抽象层'],
    ['MCU', 'Microcontroller Unit 微控制器'],
    ['OS', 'Operating System 操作系统'],
    ['RTE', 'Runtime Environment 运行时环境'],
    ['SBC', 'System Basis Chip 系统基础芯片'],
    ['Wdg', 'Watchdog 看门狗'],
  ];
  const abbrRows = ABBR_CANDIDATES
    .filter(([abbr]) => new RegExp(`\\b${abbr}\\b`, 'i').test(allText))
    .map(([abbr, desc]) => `<tr><td><code>${esc(abbr)}</code></td><td>${esc(desc)}</td></tr>`)
    .join('');
  const DEF_ROWS: [string, string][] = [
    ['可重入性', '函数在同时多次调用，例如操作系统在进程调度过程中，或者单片机、处理器等中断的时候会发生重入的现象。（可重入函数可以在任意时刻被打断，稍后再继续运行，不会丢失数据；不可重入函数不能由超过一个任务共享，除非能确保函数的互斥）'],
    ['静态全局变量', 'static 声明的文件作用域变量（内部链接），仅本模块内可见，外部模块不可直接访问；本报告 5.2.4.1 节列出。'],
  ];
  const defRows = DEF_ROWS.map(([n, d]) => `<tr><td>${esc(n)}</td><td>${esc(d)}</td></tr>`).join('');
  const preSection = `
<h2 id="s1">1 目的</h2>
<p>本文档描述 ${esc(model.module)} 软件单元的详细设计，作为该单元编码实现、设计评审与单元测试的依据。</p>
<h2 id="s2">2 适用范围</h2>
<p>本文档适用于 ${esc(model.module)} 软件单元的开发、评审与维护。</p>
<h2 id="s3">3 定义和缩写</h2>
<h3>3.1 缩写</h3>
<table class="simple"><tr><th>缩写</th><th>描述</th></tr>${abbrRows}</table>
<p class="muted">注：仅列出本模块文档/代码中实际出现的缩写，可按项目需要补充。</p>
<h3>3.2 定义</h3>
<table class="simple"><tr><th>名称</th><th>描述</th></tr>${defRows}</table>`;

  // ---- 8 支持/相关性文件（骨架，编号待人工补充） ----
  const supportSection = `
<h2 id="s8">8 支持/相关性文件</h2>
<table class="simple"><tr><th>序号</th><th>文档名称</th><th>文档编号</th></tr>
<tr><td>1</td><td>软件详细设计规范（Code）</td><td>G-B035-005</td></tr>
<tr><td>2</td><td>软件接口命名规范</td><td class="todo">（待补充）</td></tr>
</table>
<p class="muted">注：项目级相关文件（软件架构设计、需求规格等）请人工补充。</p>`;

  // ---- 文件清单（主文件在前） ----

  const fileRows = [...model.files]
    .sort((a, b) => fileSortKey(a).localeCompare(fileSortKey(b)))
    .map(f => `<tr><td><code>${esc(f.path.split(/[\\/]/).pop()!)}</code></td><td>${esc(describeFile(f.path, f.role, model))}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(model.module)} 软件详细设计规范（Code）- 评审稿</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <h1>${esc(model.module)} 软件详细设计规范（Code）</h1>
  <div class="meta">LLD Agent 生成评审稿 · 分析时间 ${esc(model.analyzedAt)} · 状态: Draft</div>
</header>
<nav>
  <a href="#s1">1 目的</a>
  <a href="#s3">3 定义和缩写</a>
  <a href="#s4">4 程序系统结构</a>
  <a href="#s51">5.1 功能描述</a>
  <a href="#s521">5.2.1 数据类型</a>
  <a href="#s522">5.2.2 调用的外部接口</a>
  <a href="#s523">5.2.3 提供的外部接口</a>
  <a href="#s524">5.2.4 内部接口</a>
  <a href="#s53">5.3 动态设计</a>
  <a href="#s6">6 配置说明</a>
  <a href="#s7">7 详细设计规范评估</a>
  <a href="#s8">8 支持/相关性文件</a>
</nav>
<main>
<div class="note">本报告由 agent 自动生成，供评审。带 <b>工作项</b> 标记的条目对应 Polarion 工作项颗粒度；函数描述共 ${fnCount} 个，已生成 ${generatedCount} 个。追溯链接（is derived from）按约定留空，入库后人工补充。</div>
${preSection}

<h2 id="s4">4 程序系统结构</h2>
<h3>4.1 文件说明</h3>
<table class="simple"><tr><th>文件</th><th>说明</th></tr>${fileRows}</table>

<h3>4.2 文件包含关系</h3>
<p class="muted">模块内部文件间的包含关系如下图所示（由 #include 静态分析生成）。${includeNote}</p>
${includeGraph ? `${diagramBlock(includeGraph)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(includeGraph)}</pre></details>` : '<p class="todo">（未解析到 include 关系）</p>'}

<h2 id="s51">5.1 功能描述</h2>
${functionalDescSection}
${overviewSection}
${callGraphSection}

<h2 id="s52">5.2 接口说明</h2>
<h3 id="s521">5.2.1 数据类型说明</h3>
<h3>5.2.1.1 引用的数据类型</h3>
<table class="simple"><tr><th>模块名</th><th>Imported Type</th></tr>${importedTypeRows.join('')}</table>
<h3>5.2.1.2 数据类型定义</h3>
${typesSection}

<h3 id="s522">5.2.2 调用的外部接口</h3>
<h3>5.2.2.1 全局变量</h3>
<p class="muted">注：本模块未引用外部模块的全局变量，跨模块数据交互均通过函数接口完成。</p>
<h3>5.2.2.2 接口函数</h3>
<p class="muted">注：Callout 函数（${calloutCount} 个）属于本模块配置代码（ConfTemplate），由集成方实现，不属于外部接口，未列入本节；其作为功能配置点见 ${calloutSecNo} Callout function，声明见 4.1 文件说明，调用关系见各接口函数卡片的「调用」行。</p>
${calledSection}

<h3 id="s523">5.2.3 提供的外部接口</h3>
<h3>5.2.3.1 全局变量</h3>
${providedVarSection}
<h3>5.2.3.2 接口函数</h3>
${model.providedFunctions.map(f => functionCard(f, diagramBlock, staticVarNames)).join('\n')}

<h3 id="s524">5.2.4 内部接口</h3>
<h3>5.2.4.1 全局变量定义</h3>
<p class="muted">注：以下为本模块的静态全局变量/常量（<code>static</code> 声明，内部链接，仅本模块内可见，外部模块不可直接访问）；其中 <code>const</code> 修饰的为只读常量，<code>volatile</code> 修饰的为易变变量。</p>
<table class="simple"><tr><th>变量名</th><th>数据类型</th><th>说明</th><th>备注</th></tr>${internalVarRows}</table>
<h3>5.2.4.2 内部函数说明</h3>
${model.internalFunctions.map(f => functionCard(f, diagramBlock, staticVarNames)).join('\n')}

<h2 id="s53">5.3 动态设计</h2>
${smSection}
${seqSection}

<h2 id="s6">6 配置说明</h2>
<h3>6.1 通用配置说明</h3>
<p class="muted">通用配置项适用于所有项目，控制模块基础行为。</p>
${generalCfgSection}
<h3>6.2 功能配置说明</h3>
<p class="muted">功能配置项根据项目需求裁剪模块特性。</p>
${functionalCfgSection}
${calloutCfgSection}
${aliasCfgNote}
${evalSection}
${supportSection}
</main>
${opts?.mermaidJs ? `<script>${opts.mermaidJs}</script>
<script>mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'neutral', themeVariables: { fontSize: '13px' }, flowchart: { useMaxWidth: false, padding: 6, rankSpacing: 36, nodeSpacing: 24 }, sequence: { showSequenceNumbers: true } });</script>
<script>
// 直角折线后处理。前提：mermaid.min.js 已打补丁（_patch_curve.js），边按 dagre 路径点输出折线。
// 这里把每条边规范化为横平竖直且最多拐两次。端部斜线段的方向不可靠（dagre 在跨层时给出
// 斜线，横竖占比接近时方向会判错），所以不按出边/入边方向套固定模板，而是生成全部
// 候选直角路由（一拐两种 + 两拐横竖干线各取端点中点/dagre中间点中位数），按“dagre 原始
// 路径点到候选路由的距离平方和”选最贴合的一条——dagre 的干线走节点间空隙，贴住它就不会
// 像端点中点法那样把干线折进节点列（D1--否-->END 被截断），也不会判错先行方向
// （D2--否-->I 被判成先竖后横，竖线直接穿过 P 节点框）。
// 两道硬闸（拟合分不能凌驾其上）：
// ① 穿盒淘汰：候选任一段穿过其他节点包围盒（2px 缩边 AABB）即淘汰，选优优先级
//    “方向合规且不穿盒 > 任意不穿盒 > 方向合规 > 任意”——D1--否-->END 曾拟合出
//    干线 x=129 竖穿「读 InitCheckRslt」盒（拟合分最低但线穿节点，用户截图发现）。
// ② 箭头朝向约束：从边 id 找到目标节点，端点贴在哪条边上，末段就必须沿该边法线
// （顶/底边竖直进▼、左右边水平进）——方向不符的候选直接淘汰，只在方向正确的候选里
// 按拟合度选优，否则会选出横着扎进顶边的躺平箭头（P-->I 进 Cnt_u32加1 顶边、
// D1--否-->C3 横进 SwitchToRunPhase 顶边）。端点落在角部（顶/底边与侧边距离相近）时
// 按来源方位决策：矩形族节点 + 来源在角侧盒外 + 该侧边无其他入边 → 端点平移到侧缘横进，
// 但仅当平移后存在不穿盒不穿边的横进候选才采用，否则竖直进；菱形等 polygon 节点不平移。
// ③ 穿边避让：选路优先级为字典序「不穿盒 > 方向合规 > 不穿其他边 > 拟合分」——候选与已
// 定稿边的当前路由严格交叉（_xcheck 同口径）即降级；候选不够时两轮扩容（被穿盒的盒缘外
// 8px 加干线、被穿越段的端点外 8px 加干线）；仍不干净且 dagre 原始路由干净则保留原始斜线
// 不直角化。TLF35584 密集图曾批量出现兄弟边互相交叉（N5-->N6 干线贴 N5 顶边与 N5-->N7
// 角部拐弯相撞）、两点直线早退把 dagre 绕行路线拉成竖穿节点盒（D2-->END 竖穿 B2）。
// ③b 目标盒穿透：穿盒检查排除了目标盒自身（箭尖总要触边），但竖干线落在矩形族目标盒
// 跨度内会穿盒而入、末段连箭头埋在节点填充下（RtSetMode 图 W2-->END 秃线）——候选在终点
// 前不得进入目标盒 2px 缩边内部，否决并入「不穿盒」档，扩容①同时加目标盒缘外 8px 干线。
// 选定后两件收尾：
// ④ 端点贴形：贴边（≤12px）端点的箭头尖贴到盒边——dagre 按原始斜向求的交点在直角化后
//    会悬空（D1-->END 尖浮在「结束」胶囊左肩外 6px）；进点坐标卡进盒跨距（胶囊留 rx
//    平直段，普通矩形也卡 2px 级悬空），两点直线被夹出拐点时插入拐点。
// ⑤ 标签重挂：边标签投影到原路径取弧长占比，平移到新路径同占比处——否则路由大改后
//    标签留在旧干线旁（D1--否-->END 的「否」字离新线 87px）。
window.addEventListener('DOMContentLoaded', async () => {
  await mermaid.run({ querySelector: '.mermaid' });
  // 调试钩子：file URL 带 #debug-orig 时把 dagre 原始路径存到 data-orig，供离线比对直角化改动
  if (location.hash === '#debug-orig')
    document.querySelectorAll('svg path.flowchart-link').forEach((p) => {
      if (p.getAttribute('d')) p.setAttribute('data-orig', p.getAttribute('d'));
    });
  const median = (vals) => { const v = [...vals].sort((a, b) => a - b); return v[v.length >> 1]; };
  const round2 = (n) => Math.round(n * 100) / 100;
  const distToSeg = (p, a, b) => {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const wx = p[0] - a[0], wy = p[1] - a[1];
    const len2 = vx * vx + vy * vy;
    let t = len2 ? (wx * vx + wy * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(a[0] + t * vx - p[0], a[1] + t * vy - p[1]);
  };
  const fitScore = (route, pts) => {
    let s = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      let d = Infinity;
      for (let j = 0; j < route.length - 1; j++) d = Math.min(d, distToSeg(pts[i], route[j], route[j + 1]));
      s += d * d;
    }
    return s;
  };
  // 各 svg 的节点包围盒缓存（getBBox 本地坐标 + 自身 translate）
  const boxCache = new Map();
  const boxesOf = (svg) => {
    if (boxCache.has(svg)) return boxCache.get(svg);
    const map = {};
    svg.querySelectorAll('g.node[id^="flowchart-"]').forEach((g) => {
      const m = g.getAttribute('id').match(/^flowchart-(.+)-\\d+$/);
      const t = (g.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      if (!m || !t) return;
      const b = g.getBBox();
      map[m[1]] = { x: b.x + +t[1], y: b.y + +t[2], w: b.width, h: b.height };
    });
    boxCache.set(svg, map);
    return map;
  };
  // 各 svg 的入边占边缓存：目标节点 id → [{id, side}]（按各入边端点的最近边归边，≤12px 才算占）
  const occCache = new Map();
  const occOf = (svg) => {
    if (occCache.has(svg)) return occCache.get(svg);
    const boxes = boxesOf(svg);
    const occ = {};
    svg.querySelectorAll('path.flowchart-link').forEach((p) => {
      const id = p.getAttribute('id') || '';
      const em = id.match(/^L_(.+)_\\d+$/);
      const d = p.getAttribute('d');
      if (!em || !d) return;
      const q = [...d.matchAll(/([\\d.]+),([\\d.]+)/g)].map((n) => [+n[1], +n[2]]);
      if (q.length < 2) return;
      const core = em[1];
      for (let i = 1; i < core.length - 1; i++) {
        if (core[i] !== '_') continue;
        const tBox = boxes[core.slice(i + 1)];
        if (!boxes[core.slice(0, i)] || !tBox) continue;
        const E = q[q.length - 1];
        const ds = [
          ['T', distToSeg(E, [tBox.x, tBox.y], [tBox.x + tBox.w, tBox.y])],
          ['B', distToSeg(E, [tBox.x, tBox.y + tBox.h], [tBox.x + tBox.w, tBox.y + tBox.h])],
          ['L', distToSeg(E, [tBox.x, tBox.y], [tBox.x, tBox.y + tBox.h])],
          ['R', distToSeg(E, [tBox.x + tBox.w, tBox.y], [tBox.x + tBox.w, tBox.y + tBox.h])],
        ].sort((a, b) => a[1] - b[1]);
        if (ds[0][1] <= 12) (occ[core.slice(i + 1)] = occ[core.slice(i + 1)] || []).push({ id, side: ds[0][0] });
        break;
      }
    });
    occCache.set(svg, occ);
    return occ;
  };
  const dirOf = (c) => {
    const a = c[c.length - 2], b = c[c.length - 1];
    return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'H' : 'V';
  };
  // 候选路由穿盒检查：任一段与其他节点包围盒（2px 缩边 AABB）相交即算穿盒（源/目标自身除外）
  const crossBoxesOf = (boxes, srcId, dstId) => (cand) => {
    const hit = [];
    for (let i = 0; i < cand.length - 1; i++) {
      const a = cand[i], b = cand[i + 1];
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
      const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
      for (const id in boxes) {
        if (id === srcId || id === dstId) continue;
        const bx = boxes[id];
        if (x1 < bx.x + bx.w - 2 && x2 > bx.x + 2 && y1 < bx.y + bx.h - 2 && y2 > bx.y + 2) hit.push(id);
      }
    }
    return hit;
  };
  // 目标盒穿透检查（仅矩形族目标用——菱形/平行四边形斜边端点本就在包围盒内部，会误判）：
  // 路径在终点前不得进入目标盒 2px 缩边内部。穿盒检查把目标盒自身排除了（箭尖总要触边），
  // 但竖干线落在目标盒 x 跨度内时会穿盒而入，末段连箭头一起埋在节点填充下面——
  // TLF35584 RtSetMode 图 W2-->END：干线 x=444.61 ∈「结束」盒 x 跨度 [423.86,462.24]，
  // 箭头被盖成秃线（用户截图反馈"有条线没有箭头"）。段与开盒相交用 slab 法。
  const penInto = (box) => (cand) => {
    const x1 = box.x + 2, x2 = box.x + box.w - 2, y1 = box.y + 2, y2 = box.y + box.h - 2;
    for (let i = 0; i < cand.length - 1; i++) {
      const a = cand[i], b = cand[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-9) { if (a[0] <= x1 || a[0] >= x2) continue; }
      else {
        let ta = (x1 - a[0]) / dx, tb = (x2 - a[0]) / dx;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 >= t1) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (a[1] <= y1 || a[1] >= y2) continue; }
      else {
        let ta = (y1 - a[1]) / dy, tb = (y2 - a[1]) / dy;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 >= t1) continue;
      }
      return true;
    }
    return false;
  };
  // 段-段严格交叉：与 _xcheck.js 同口径（0.6 容差、平行/共线跳过、一横一竖才算；
  // 斜线段按首端点近似为横段——dagre 原始斜线基本不参与判定，这也与 _xcheck 一致）
  const segX = (p1, p2, q1, q2) => {
    const aVert = Math.abs(p1[0] - p2[0]) < 0.6, bVert = Math.abs(q1[0] - q2[0]) < 0.6;
    if (aVert === bVert) return false;
    const vv = aVert ? [p1, p2] : [q1, q2], hh = aVert ? [q1, q2] : [p1, p2];
    const vx = vv[0][0], hy = hh[0][1];
    return hy > Math.min(vv[0][1], vv[1][1]) + 0.6 && hy < Math.max(vv[0][1], vv[1][1]) - 0.6 &&
           vx > Math.min(hh[0][0], hh[1][0]) + 0.6 && vx < Math.max(hh[0][0], hh[1][0]) - 0.6;
  };
  const bboxOf = (pts) => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const q of pts) { if (q[0] < x1) x1 = q[0]; if (q[0] > x2) x2 = q[0]; if (q[1] < y1) y1 = q[1]; if (q[1] > y2) y2 = q[1]; }
    return { x1, y1, x2, y2 };
  };
  // 各 svg 的边路由登记表（自旋整形之后、主循环之中惰性建立）：候选选路时避让其他边的当前
  // 路由——先定稿的边先入库，后处理的边避开它们；每条边定稿后回写自己的新路由。TLF35584
  // 密集图曾批量出现兄弟边拟合后互相交叉（N5-->N6 干线贴 N5 顶边与 N5-->N7 角部拐弯相撞），
  // 只因选路只看盒不看边。
  const routeCache = new Map();
  const routesOf = (svg) => {
    if (routeCache.has(svg)) return routeCache.get(svg);
    const reg = { list: [], byEl: new Map() };
    const boxes = boxesOf(svg);
    svg.querySelectorAll('path.flowchart-link').forEach((p) => {
      const d = p.getAttribute('d');
      if (!d) return;
      const pts = [];
      (d.match(/[A-Za-z][^A-Za-z]*/g) || []).forEach((seg) => {
        const nums = seg.slice(1).trim().split(/[ ,]+/).filter(Boolean).map(Number);
        if (nums.length >= 2) pts.push([nums[nums.length - 2], nums[nums.length - 1]]);
      });
      if (pts.length < 2) return;
      const id = p.getAttribute('id') || '';
      let srcId = null, dstId = null;
      const em = id.match(/^L_(.+)_\d+$/);
      if (em) {
        const core = em[1];
        for (let i = 1; i < core.length - 1; i++) {
          if (core[i] !== '_') continue;
          if (boxes[core.slice(0, i)] && boxes[core.slice(i + 1)]) { srcId = core.slice(0, i); dstId = core.slice(i + 1); break; }
        }
      }
      const e = { p, pts, invisible: /edge-thickness-invisible/.test(p.getAttribute('class') || ''), srcId, dstId, bbox: bboxOf(pts) };
      reg.list.push(e);
      reg.byEl.set(p, e);
    });
    routeCache.set(svg, reg);
    return reg;
  };
  // 候选与其他边的首个严格交叉段（无则 null）；同源同目标的平行边不参与（互相避让无意义）
  const mkEdgeHit = (svg, self) => (cand) => {
    if (!self) return null;
    const cb = bboxOf(cand);
    for (const e of routesOf(svg).list) {
      if (e === self || e.invisible) continue;
      if (self.srcId && e.srcId === self.srcId && e.dstId === self.dstId) continue;
      if (cb.x2 < e.bbox.x1 || cb.x1 > e.bbox.x2 || cb.y2 < e.bbox.y1 || cb.y1 > e.bbox.y2) continue;
      for (let i = 0; i < cand.length - 1; i++)
        for (let j = 0; j < e.pts.length - 1; j++)
          if (segX(cand[i], cand[i + 1], e.pts[j], e.pts[j + 1])) return [e.pts[j], e.pts[j + 1]];
    }
    return null;
  };
  // 选路优先级（字典序）：不穿盒 > 末段方向合规 > 不穿其他边 > 拟合分。候选不够时两轮扩容：
  // ① 基础候选穿到哪些盒，就把竖/横干线挪到盒缘外 8px 再试（N5-->N6 需在 N3 右缘外穿行）；
  // ② 仍穿边就把干线挪到被穿越段的端点外 8px 再试一轮。
  // 扩容后仍不干净、且 dagre 原始路由干净（不穿盒/不穿边/方向合规）→ 保留原始斜线不直角化
  // （D2-->END 一类：dagre 本已左绕 B2，两点直线早退曾把它拉成竖穿 B2 盒）。
  const ortho = (pts, endDir, ctx) => {
    const S = pts[0], E = pts[pts.length - 1];
    const xBoxes = ctx ? crossBoxesOf(ctx.boxes, ctx.srcId, ctx.dstId) : () => [];
    const edgeHit = ctx ? ctx.edgeHit : null;
    const pen = ctx && ctx.pen ? ctx.pen : () => false;
    const straight = [S, E];
    if ((Math.abs(E[0] - S[0]) < 0.6 || Math.abs(E[1] - S[1]) < 0.6) && !xBoxes(straight).length && !pen(straight) && !(edgeHit && edgeHit(straight))) return straight;
    const mids = pts.slice(1, -1);
    const uniq = (arr) => [...new Set(arr)];
    const build = (mxs, mys) => [
      [S, [S[0], E[1]], E],
      [S, [E[0], S[1]], E],
      ...mxs.map((mx) => [S, [mx, S[1]], [mx, E[1]], E]),
      ...mys.map((my) => [S, [S[0], my], [E[0], my], E]),
    ];
    const mxs = uniq([round2((S[0] + E[0]) / 2), ...(mids.length ? [round2(median(mids.map((p) => p[0])))] : [])]);
    const mys = uniq([round2((S[1] + E[1]) / 2), ...(mids.length ? [round2(median(mids.map((p) => p[1])))] : [])]);
    let cands = build(mxs, mys);
    // 扩容①：盒缘外 8px 干线。穿到目标盒自身（pen）时同样扩——把目标盒缘外 8px 加入干线，
    // 让汇合边能走盒外 L 形（W2-->END 竖干线穿「结束」盒 → 改走左缘外 x=tBox.x-8 横进）
    const hitBoxes = uniq(cands.flatMap((c) => xBoxes(c)));
    const penHit = cands.some((c) => pen(c));
    if (ctx && (hitBoxes.length || penHit)) {
      const ex = [], ey = [];
      for (const id of hitBoxes.slice(0, 6)) {
        const b = ctx.boxes[id];
        ex.push(round2(b.x - 8), round2(b.x + b.w + 8));
        ey.push(round2(b.y - 8), round2(b.y + b.h + 8));
      }
      if (penHit && ctx.dstBox) {
        const b = ctx.dstBox;
        ex.push(round2(b.x - 8), round2(b.x + b.w + 8));
        ey.push(round2(b.y - 8), round2(b.y + b.h + 8));
      }
      cands = cands.concat(build(uniq(ex).slice(0, 12), uniq(ey).slice(0, 12)));
    }
    let best = null, bk = null;
    const consider = (list) => {
      for (const c of list) {
        // 字典序：不穿盒（含不穿目标盒内部）> 不穿其他边 > 方向合规 > 拟合分。方向让位给
        // 穿边——端点贴形阶段常能把方向问题修回来（箭尖贴边/卡跨距），穿边却修不了（svg#46）
        const k = [(xBoxes(c).length || pen(c)) ? 1 : 0, edgeHit && edgeHit(c) ? 1 : 0, endDir && dirOf(c) !== endDir ? 1 : 0, fitScore(c, pts)];
        if (!bk || k[0] < bk[0] || (k[0] === bk[0] && (k[1] < bk[1] || (k[1] === bk[1] && (k[2] < bk[2] || (k[2] === bk[2] && k[3] < bk[3] - 1e-6)))))) { bk = k; best = c; }
      }
    };
    consider(cands);
    // 扩容②：仍穿边，干线挪到被穿越段的端点外 8px 再试一轮
    if (bk && bk[1] > 0 && edgeHit) {
      const hit = edgeHit(best);
      if (hit) {
        const [ha, hb2] = hit;
        consider(build(uniq([round2(ha[0] - 8), round2(ha[0] + 8), round2(hb2[0] - 8), round2(hb2[0] + 8)]), uniq([round2(ha[1] - 8), round2(ha[1] + 8), round2(hb2[1] - 8), round2(hb2[1] + 8)])));
      }
    }
    // 仍不干净：dagre 原始路由干净（不穿盒/不穿目标盒内部/不穿边、方向合规）则保留原始斜线
    if (bk && (bk[0] > 0 || bk[1] > 0)) {
      const origBad = xBoxes(pts).length > 0 || pen(pts) || (endDir && dirOf(pts) !== endDir) || (edgeHit && edgeHit(pts));
      if (!origBad) return pts.slice();
    }
    return best;
  };
  // 边标签随路由重挂用的折线工具：弧长、按弧长取点、点投影（返回最近点及其弧长位置）
  const polyLen = (pts) => {
    let L = 0;
    for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    return L;
  };
  const pointAt = (pts, at) => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + L >= at) {
        const t = L ? (at - acc) / L : 0;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
      acc += L;
    }
    return pts[pts.length - 1];
  };
  const projectOn = (p, pts) => {
    let bd = Infinity, bl = 0, bp = pts[0], acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const wx = p[0] - a[0], wy = p[1] - a[1];
      const l2 = vx * vx + vy * vy;
      let t = l2 ? (wx * vx + wy * vy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const q = [a[0] + t * vx, a[1] + t * vy];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; bl = acc + Math.sqrt(l2) * t; bp = q; }
      acc += Math.sqrt(l2);
    }
    return { d: bd, len: bl, pt: bp };
  };
  // 各 svg 的边标签缓存（mermaid 把标签放在路径中点，g.edgeLabel 的 translate 即标签中心）
  const labelCache = new Map();
  const labelsOf = (svg) => {
    if (labelCache.has(svg)) return labelCache.get(svg);
    const list = [];
    svg.querySelectorAll('g.edgeLabel').forEach((g) => {
      const t = (g.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      if (t) list.push({ g, x: +t[1], y: +t[2], used: false });
    });
    labelCache.set(svg, list);
    return list;
  };
  // 自旋回环整形（在主循环之前）：J 是隐形汇合节点（id 以 _J 结尾、标签空白，结构
  // PRE-->J / J-->W / W---J，W 为菱形）。dagre 把 J 当普通节点，为避免对向两边重叠会把
  // J-->W 绕到菱形左上斜边进、回边贴在右上斜边——与参考画法（用户供图定稿）不符：
  // J 钉在 W 竖直中轴上、J-->W 竖直 ▼ 进顶角、否回边从右角出 右-上-左 进 J 右侧（T 形并入）。
  // 整形后主线竖直、回边横平竖直，主循环对直线早退/拟合分 0 均原样保留。
  document.querySelectorAll('svg').forEach((svg) => {
    const boxes = boxesOf(svg);
    svg.querySelectorAll('g.node[id^="flowchart-"]').forEach((g) => {
      const m = g.getAttribute('id').match(/^flowchart-(.+)-\\d+$/);
      if (!m || !/_J$/.test(m[1]) || g.textContent.trim() !== '') return;
      const jId = m[1];
      // 收集与 J 相连的全部边，再按方向分出 入边/出边/回边（与 DOM 顺序无关）
      const touching = [];
      svg.querySelectorAll('path.flowchart-link').forEach((p) => {
        const em = (p.getAttribute('id') || '').match(/^L_(.+)_\\d+$/);
        if (!em) return;
        const core = em[1];
        for (let i = 1; i < core.length - 1; i++) {
          if (core[i] !== '_') continue;
          const s = core.slice(0, i), t = core.slice(i + 1);
          if (!boxes[s] || !boxes[t]) continue;
          if (s === jId || t === jId) touching.push({ p, s, t });
          break;
        }
      });
      const outE = touching.find((e) => e.s === jId);
      if (!outE) return;
      const wId = outE.t;
      const backE = touching.find((e) => e.s === wId && e.t === jId);
      const inE = touching.find((e) => e.t === jId && e.s !== jId && e.s !== wId);
      const wG = svg.querySelector('g.node[id^="flowchart-' + wId + '-"]');
      if (!backE || !inE || !wG || !wG.querySelector('polygon')) return;  // W 非菱形不整
      const jBox = boxes[jId], wBox = boxes[wId];
      // J 钉到 W 中轴（水平居中，y 不动）；同步改 boxes 缓存让主循环看到新位置
      const jt = (g.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
      const wcx = wBox.x + wBox.w / 2;
      const dxc = wcx - (jBox.x + jBox.w / 2);
      if (jt) g.setAttribute('transform', 'translate(' + (+jt[1] + dxc) + ', ' + jt[2] + ')');
      jBox.x += dxc;
      const jcx = jBox.x + jBox.w / 2, jcy = jBox.y + jBox.h / 2;
      // J-->W：竖直 ▼ 进顶角（直线，主循环早退原样保留；菱形不做端点贴形）
      outE.p.setAttribute('d', 'M' + jcx + ',' + (jBox.y + jBox.h) + 'L' + wcx + ',' + wBox.y);
      // 否回边：右角 → 右 → 上 → 左进 J 右侧；竖通道沿用 dagre 原路径的 max-x（已避开节点），
      // 主循环对这条 H-V-H 干线拟合分 0 原样保留，端点贴形在右侧边上移动量 0
      const bp = [...(backE.p.getAttribute('d') || '').matchAll(/([\\d.]+),([\\d.]+)/g)].map((q) => [+q[1], +q[2]]);
      const rvx = wBox.x + wBox.w, rvy = wBox.y + wBox.h / 2;
      const gapX = Math.max(rvx + 48, ...bp.map((q) => q[0]));
      backE.p.setAttribute('d', 'M' + rvx + ',' + rvy + 'L' + gapX + ',' + rvy + 'L' + gapX + ',' + jcy + 'L' + (jBox.x + jBox.w) + ',' + jcy);
      // 回边右通道可能超出 mermaid 原始 viewBox——SVG 不渲染 viewBox 外内容（回路右竖线被截），按需右扩
      const vb = svg.viewBox && svg.viewBox.baseVal;
      if (vb && gapX + 8 > vb.x + vb.width) {
        vb.width = gapX + 8 - vb.x;
        const wa = svg.getAttribute('width');
        if (wa && wa.indexOf('%') < 0) svg.setAttribute('width', String(vb.width));
        if (svg.style && /px$/.test(svg.style.maxWidth)) svg.style.maxWidth = vb.width + 'px';
      }
      // 入边端点改 J 顶边中点：主循环按新端点重拟合，端点法线约束竖直进顶
      const ip = [...(inE.p.getAttribute('d') || '').matchAll(/([\\d.]+),([\\d.]+)/g)].map((q) => [+q[1], +q[2]]);
      if (ip.length >= 2) {
        ip[ip.length - 1] = [jcx, jBox.y];
        inE.p.setAttribute('d', 'M' + ip.map((q) => q[0] + ',' + q[1]).join('L'));
      }
    });
  });
  // 单条边选路（不改 DOM，返回定稿折线）：两遍主循环共用——第一遍按 DOM 序定稿（后续边
  // 避让已定稿的），第二遍从 dagre 原始路径对所有边重选——消除处理顺序死锁（A 避让 B 的
  // dagre 原始斜线而选了交叉路由，B 随后改道，A 本有干净路由却无从得知：svg#51 D1-->R1
  // 的最优 my930.66 第一遍被 D0-->END 的原始干线否决，第二遍才轮到它）。
  const routeEdge = (p, pts) => {
    const svg = p.closest('svg');
    // 边 id L_<源>_<目标>_<n>：按下划线拆出源/目标节点（节点 id 本身含下划线，逐位试拆），取端点所在边的法线约束
    let endDir = null, endPts = pts, sp0 = null, ctx = null, xBoxes = null, xEdge = null;
    let srcId = null, dstId = null, tBox = null, dstG = null, ds = null;
    const selfE = routesOf(svg).byEl.get(p) || null;
    const em = (p.getAttribute('id') || '').match(/^L_(.+)_\\d+$/);
    if (em) {
      const boxes = boxesOf(svg);
      const core = em[1];
      for (let i = 1; i < core.length - 1; i++) {
        if (core[i] !== '_') continue;
        if (!boxes[core.slice(0, i)] || !boxes[core.slice(i + 1)]) continue;
        srcId = core.slice(0, i);
        dstId = core.slice(i + 1);
        break;
      }
      if (dstId) {
        xBoxes = crossBoxesOf(boxes, srcId, dstId);
        xEdge = mkEdgeHit(svg, selfE);
        tBox = boxes[dstId];
        dstG = svg.querySelector('g.node[id^="flowchart-' + dstId + '-"]');
        // 矩形族目标才做穿透检查（polygon 目标斜边端点本在包围盒内，恒误判）
        const rectFamDst = dstG && !dstG.querySelector('polygon');
        ctx = { boxes, srcId, dstId, edgeHit: xEdge, pen: rectFamDst ? penInto(tBox) : null, dstBox: tBox };
        const S0 = pts[0], E0 = pts[pts.length - 1];
        ds = [
          ['T', distToSeg(E0, [tBox.x, tBox.y], [tBox.x + tBox.w, tBox.y])],
          ['B', distToSeg(E0, [tBox.x, tBox.y + tBox.h], [tBox.x + tBox.w, tBox.y + tBox.h])],
          ['L', distToSeg(E0, [tBox.x, tBox.y], [tBox.x, tBox.y + tBox.h])],
          ['R', distToSeg(E0, [tBox.x + tBox.w, tBox.y], [tBox.x + tBox.w, tBox.y + tBox.h])],
        ].sort((a, b) => a[1] - b[1]);
        const axis = (s) => (s === 'T' || s === 'B' ? 'V' : 'H');
        if (ds[0][1] <= 12 && ds[1][1] - ds[0][1] > 8) {
          // 明确贴某条边：末段沿该边法线（顶/底竖直进▼、左右水平进）
          endDir = axis(ds[0][0]);
        } else if (ds[0][1] <= 12 && axis(ds[0][0]) !== axis(ds[1][0])) {
          // 角部模糊（一顶/底边 + 一侧边距离相近）：不能放任——dagre 的横进顶边会原样
          // 保留成躺平箭头（D2--否-->I 端点在 I 顶边距左角 4px，用户反馈"箭头躺着"）。
          // 矩形族节点 + 来源在角侧盒外 + 该侧边无其他入边 → 端点平移到侧缘横进
          // （W2-->END 类汇合，与对侧兄弟边同高对称，用户明确要这种）；
          // 但仅当平移后存在不穿盒的横进候选才采用——D1--否-->END 直下必穿「读 InitCheckRslt」
          // 盒、按 dagre 干线左绕则不穿 → 采用平移；没有干净横进路由就退回竖进顶/底边
          // （侧边已被兄弟入边占用（I 左边已有 P-->I）或来源在盒内时也竖直进）。
          const sideCh = axis(ds[0][0]) === 'H' ? ds[0][0] : ds[1][0];
          const sgn = sideCh === 'L' ? -1 : 1;
          const outSide = sgn < 0 ? S0[0] < tBox.x - 4 : S0[0] > tBox.x + tBox.w + 4;
          // 仅矩形族节点（无 polygon 子元素）可平移；菱形/平行四边形包围盒边不贴实际形状
          const rectFam = dstG && !dstG.querySelector('polygon');
          const occ = occOf(svg)[dstId] || [];
          const edgeId = p.getAttribute('id') || '';
          const sideFree = !occ.some((o) => o.side === sideCh && o.id !== edgeId);
          if (rectFam && outSide && sideFree) {
            const nx = sgn > 0 ? tBox.x + tBox.w : tBox.x;
            const shifted = [...pts.slice(0, -1), [nx, E0[1]]];
            const trySp = ortho(shifted, 'H', ctx);
            if (trySp && dirOf(trySp) === 'H' && !xBoxes(trySp).length && !xEdge(trySp)) {
              endPts = shifted;  // 平移到侧缘（y 不变，与兄弟边同高）
              endDir = 'H';
              sp0 = trySp;
            } else endDir = 'V';
          } else endDir = 'V';
        }
      }
    }
    let sp = sp0 || ortho(endPts, endDir, ctx);
    // 躺平进顶/底边救援：端点贴目标顶/底边（≤2.5px）、方向合规要求竖进，但所有竖进候选
    // 都被穿盒/穿边否决时，正交化只能选出末段水平的躺平箭头（IoMcuAdc GetAdcRaw
    // D3--否-->W2：C2 盒封死 x≤652 走廊、兄弟边 D4→W3 的横干线封死 x>601 走廊，竖进
    // 数学上无解）。此时把端点平移到朝来路一侧的侧边中点横进（▶ 侧缘进，同侧向汇合
    // 画法）；polygon 目标（平行四边形）按斜边实际位置求该 y 的边 x——直接钉 bbox
    // 侧边会悬空（W2 bbox 左边 527 vs 斜边实际 538）。无干净横进路由则保留躺平原样。
    if (sp && !sp0 && tBox && ds && endDir === 'V' && dirOf(sp) === 'H' &&
        (ds[0][0] === 'T' || ds[0][0] === 'B') && ds[0][1] <= 2.5 && sp.length >= 2) {
      const trunkX = sp[sp.length - 2][0];
      const sideCh = trunkX < tBox.x ? 'L' : trunkX > tBox.x + tBox.w ? 'R' : null;
      if (sideCh) {
        const yMid = round2(tBox.y + tBox.h / 2);
        let sideX = sideCh === 'L' ? tBox.x : tBox.x + tBox.w;
        const poly = dstG ? dstG.querySelector('polygon') : null;
        if (poly) {
          const gm = (dstG.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
          const tm = (poly.getAttribute('transform') || '').match(/translate\\(\\s*(-?[\\d.]+)[ ,]\\s*(-?[\\d.]+)\\s*\\)/);
          const ox = (gm ? +gm[1] : 0) + (tm ? +tm[1] : 0), oy = (gm ? +gm[2] : 0) + (tm ? +tm[2] : 0);
          const vp = (poly.getAttribute('points') || '').trim().split(/\\s+/).map((q) => { const w = q.split(','); return [+w[0] + ox, +w[1] + oy]; });
          const xs = [];
          for (let i = 0; i < vp.length; i++) {
            const a = vp[i], b = vp[(i + 1) % vp.length];
            if (Math.abs(a[1] - b[1]) < 1e-6 || (a[1] - yMid) * (b[1] - yMid) > 0) continue;
            xs.push(a[0] + (yMid - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
          }
          if (xs.length >= 2) sideX = round2(sideCh === 'L' ? Math.min.apply(null, xs) : Math.max.apply(null, xs));
        }
        const shifted = [...endPts.slice(0, -1), [sideX, yMid]];
        const trySp = ortho(shifted, 'H', ctx);
        if (trySp && dirOf(trySp) === 'H' && !xBoxes(trySp).length && !(ctx.pen && ctx.pen(trySp)) && !xEdge(trySp)) {
          endPts = shifted;
          endDir = 'H';
          sp = trySp;
        }
      }
    }
    // 端点贴形：贴边（≤12px）端点把箭头尖贴到盒边——dagre 按原始斜向求的交点在直角化后会
    // 悬空（D1-->END 尖浮在「结束」胶囊左肩外 6px，用户反馈"箭头和框离得远"）；进点坐标
    // 卡进盒跨距（胶囊 rx>0 留平直段；普通矩形也要卡——svg#0 横进箭尖曾悬在盒底边下 2px）。
    // 两点直线被夹出拐点时插入拐点；贴形改线后穿盒/穿边或移动过大则放弃。
    if (tBox && ds && ds[0][1] <= 12 && dstG && !dstG.querySelector('polygon') && sp.length >= 2) {
      const rect = dstG.querySelector('rect[rx]');
      const rx = rect ? +(rect.getAttribute('rx') || 0) : 0;
      const pad = rx > 0 ? rx : 0;
      const li = sp.length - 1;
      const A = sp[li - 1], E = sp[li];
      let snapped = sp.map((q) => [q[0], q[1]]);
      if (dirOf(sp) === 'V') {
        const ySnap = Math.abs(E[1] - tBox.y) <= Math.abs(E[1] - (tBox.y + tBox.h)) ? tBox.y : tBox.y + tBox.h;
        const x = Math.min(Math.max(E[0], tBox.x + pad), tBox.x + tBox.w - pad);
        if (x === A[0]) snapped[li] = [x, ySnap];
        else if (sp.length >= 3 && Math.abs(sp[li - 2][1] - A[1]) < 0.6) { snapped[li - 1] = [x, A[1]]; snapped[li] = [x, ySnap]; }
        else snapped = [...sp.slice(0, -1), [x, A[1]], [x, ySnap]];
      } else {
        const xSnap = Math.abs(E[0] - tBox.x) <= Math.abs(E[0] - (tBox.x + tBox.w)) ? tBox.x : tBox.x + tBox.w;
        const y = Math.min(Math.max(E[1], tBox.y + pad), tBox.y + tBox.h - pad);
        if (y === A[1]) snapped[li] = [xSnap, y];
        else if (sp.length >= 3 && Math.abs(sp[li - 2][0] - A[0]) < 0.6) { snapped[li - 1] = [A[0], y]; snapped[li] = [xSnap, y]; }
        else snapped = [...sp.slice(0, -1), [A[0], y], [xSnap, y]];
      }
      const tip = snapped[snapped.length - 1];
      const moved = Math.abs(tip[0] - E[0]) + Math.abs(tip[1] - E[1]);
      const pen = ctx && ctx.pen ? ctx.pen : () => false;
      if (moved <= 30 && !pen(snapped) && (!xBoxes || !xBoxes(snapped).length) && !(xEdge && xEdge(snapped))) sp = snapped;
    }
    // ⑥ 贴缘/近距修饰（美观，最后做，改后穿盒/穿边/穿目标盒/方向改变均放弃）：
    // a) 横段与其他节点顶/底边共线贴合（<2.5px 且横向重叠）时抬/降到盒外 8px——
    //    SinSafetyBistCheck 图 P2-->D0 回边横段与 E2 顶边完全贴合，像从盒上碾过；
    //    首/末段为保端点贴在盒边上用插拐平移（末段插拐不得改变入箭方向）。
    //    ±8 常被兄弟边下垂段否决（T21-->END 抬升撞上 T31-->END 的下垂线）——按否决段
    //    端点 y 再向外推 8px 爬梯（最多 3 级、总位移 ≤64px），直到干净或放弃。
    // b) 竖段与其他边竖段平行间距 <12px 且纵向重叠时错开到 16px——否边下落（x=731.77）
    //    与回边上行（x=739.77）隔 8px，两条线易看成一条。
    if (ctx && sp.length >= 2) {
      const pen = ctx.pen ? ctx.pen : () => false;
      const clean = (cand) => !(xBoxes && xBoxes(cand).length) && !pen(cand) && !(xEdge && xEdge(cand));
      for (let i = 0; i < sp.length - 1; i++) {
        const a = sp[i], b = sp[i + 1];
        if (Math.abs(a[1] - b[1]) >= 0.6) continue;
        const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
        let yTry = null, up = true, hugId = null;
        for (const id in ctx.boxes) {
          if (id === ctx.srcId || id === ctx.dstId) continue;
          const bx = ctx.boxes[id];
          if (x2 < bx.x + 1 || x1 > bx.x + bx.w - 1) continue;
          if (Math.abs(a[1] - bx.y) < 2.5) { yTry = round2(bx.y - 8); up = true; hugId = id; break; }
          if (Math.abs(a[1] - (bx.y + bx.h)) < 2.5) { yTry = round2(bx.y + bx.h + 8); up = false; hugId = id; break; }
        }
        if (yTry === null) continue;
        let applied = false;
        for (let att = 0; att < 3 && Math.abs(yTry - a[1]) <= 64; att++) {
          let cand = null;
          if (i > 0 && i < sp.length - 2) { cand = sp.map((q) => [q[0], q[1]]); cand[i][1] = cand[i + 1][1] = yTry; }
          else if (i === 0 && sp.length >= 3 && Math.abs(sp[1][0] - sp[2][0]) < 0.6)
            cand = [sp[0], [sp[0][0], yTry], [sp[1][0], yTry], ...sp.slice(2)];
          else if (i === sp.length - 2 && sp.length >= 3 && Math.abs(sp[i - 1][0] - sp[i][0]) < 0.6)
            cand = [...sp.slice(0, i + 1), [sp[i][0], yTry], [sp[i + 1][0], yTry], sp[i + 1]];
          if (!cand || dirOf(cand) !== dirOf(sp) || (xBoxes && xBoxes(cand).length) || pen(cand)) break;
          const hit = xEdge && xEdge(cand);
          if (!hit) { sp = cand; applied = true; break; }
          // 爬梯：越过挡住它的段（其远侧端点再向外 8px）
          yTry = round2(up ? Math.min(hit[0][1], hit[1][1]) - 8 : Math.max(hit[0][1], hit[1][1]) + 8);
        }
        // 退路B：竖移被邻边走廊封死（或末段竖移会改变入箭方向）时，改把相邻竖段
        // 平移到贴缘盒的侧向空隙（盒缘外 8px），横段随之缩短到不再覆盖该盒——
        // svg#0 文件包含图 c-->Callout_h 末段贴 Cfg_c 底边，竖移会把入箭方向
        // 从 H 改成 V；把末段前的竖段左移到 Cfg_c 与 Callout_h 之间后贴缘消失。
        // （首段情形如 P2-->D0 贴 E2 顶：竖段左移会横穿邻边横臂被 xEdge 否决，
        //   属布局锁死，保持贴缘。）
        if (!applied && hugId && (i === 0 || i === sp.length - 2)) {
          const vb = ctx.boxes[hugId];
          for (const side of [0, 1]) {
            const newX = round2(side === 0 ? vb.x - 8 : vb.x + vb.w + 8);
            let cand = null, hSeg = null;
            if (i === 0 && sp.length >= 3 && Math.abs(sp[1][0] - sp[2][0]) < 0.6) {
              if ((newX - sp[0][0]) * (sp[1][0] - sp[0][0]) <= 0 || Math.abs(newX - sp[0][0]) <= 8) continue; // 不反向/不塌缩
              cand = [sp[0], [newX, sp[0][1]], [newX, sp[2][1]], ...sp.slice(3)];
              hSeg = [cand[0], cand[1]];
            } else if (i === sp.length - 2 && sp.length >= 3 && Math.abs(sp[i - 1][0] - sp[i][0]) < 0.6) {
              if ((sp[i + 1][0] - newX) * (sp[i + 1][0] - sp[i][0]) <= 0 || Math.abs(sp[i + 1][0] - newX) <= 8) continue;
              cand = [...sp.slice(0, i), [newX, sp[i - 1][1]], [newX, sp[i][1]], sp[i + 1]];
              hSeg = [cand[cand.length - 2], cand[cand.length - 1]];
            }
            if (!cand || dirOf(cand) !== dirOf(sp) || !clean(cand)) continue;
            // 新横段不得再贴任何盒缘（否则只是换了个盒子贴）
            const hx1 = Math.min(hSeg[0][0], hSeg[1][0]), hx2 = Math.max(hSeg[0][0], hSeg[1][0]);
            let rehug = false;
            for (const id2 in ctx.boxes) {
              if (id2 === ctx.srcId || id2 === ctx.dstId) continue;
              const b2 = ctx.boxes[id2];
              if (hx2 < b2.x + 1 || hx1 > b2.x + b2.w - 1) continue;
              if (Math.abs(hSeg[0][1] - b2.y) < 2.5 || Math.abs(hSeg[0][1] - (b2.y + b2.h)) < 2.5) { rehug = true; break; }
            }
            if (rehug) continue;
            sp = cand; applied = true; break;
          }
        }
        if (applied) break;
      }
      // 竖段近距错开
      for (let i = 0; i < sp.length - 1; i++) {
        const a = sp[i], b = sp[i + 1];
        if (Math.abs(a[0] - b[0]) >= 0.6) continue;
        const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
        let nearX = null;
        for (const e of routesOf(svg).list) {
          if (e === selfE || e.invisible) continue;
          for (let j = 0; j < e.pts.length - 1; j++) {
            const q1 = e.pts[j], q2 = e.pts[j + 1];
            if (Math.abs(q1[0] - q2[0]) >= 0.6) continue;
            const dx = a[0] - q1[0];
            if (Math.abs(dx) >= 12 || dx === 0) continue;
            const oy = Math.min(y2, Math.max(q1[1], q2[1])) - Math.max(y1, Math.min(q1[1], q2[1]));
            if (oy > 4) { nearX = round2(q1[0] + (dx > 0 ? 16 : -16)); break; }
          }
          if (nearX !== null) break;
        }
        if (nearX === null) continue;
        // 仅动内部竖段：首/末段插拐会让横Stub滑在自己盒缘上（新的自贴缘），不值得
        let cand = null;
        if (i > 0 && i < sp.length - 2) { cand = sp.map((q) => [q[0], q[1]]); cand[i][0] = cand[i + 1][0] = nearX; }
        if (cand && dirOf(cand) === dirOf(sp) && clean(cand)) { sp = cand; break; }
      }
    }
    return sp;
  };
  // 两遍选路 + 统一落笔：entry.orig 存 dagre 原始路径（登记表按当前 d 惰性建立，此时即
  // 原始/自旋整形后的路径）；每遍定稿后回写登记表的当前路由供后续边避让；最后统一写 d
  // 并重挂标签（标签按 orig → 定稿的弧长占比平移，只挂一次）。
  const edgeEls = [...document.querySelectorAll('svg path.flowchart-link')];
  const parsePts = (d) => {
    const pts = [];
    (d.match(/[A-Za-z][^A-Za-z]*/g) || []).forEach((seg) => {
      const nums = seg.slice(1).trim().split(/[ ,]+/).filter(Boolean).map(Number);
      if (nums.length >= 2) pts.push([nums[nums.length - 2], nums[nums.length - 1]]);
    });
    return pts;
  };
  for (let pass = 0; pass < 2; pass++) {
    edgeEls.forEach((p) => {
      const svg = p.closest('svg');
      const e = routesOf(svg).byEl.get(p);
      const orig = pass === 0 ? parsePts(p.getAttribute('d') || '') : (e && e.orig);
      if (!orig || orig.length < 2) return;
      if (e && pass === 0) e.orig = orig;
      const sp = routeEdge(p, orig);
      if (e) { e.pts = sp.map((q) => [q[0], q[1]]); e.bbox = bboxOf(e.pts); }
    });
  }
  edgeEls.forEach((p) => {
    const svg = p.closest('svg');
    const e = routesOf(svg).byEl.get(p);
    if (!e || !e.orig || !e.pts) return;
    const pts = e.orig, sp = e.pts;
    p.setAttribute('d', 'M' + sp.map((q) => q[0] + ',' + q[1]).join('L'));
    // 边标签随路由重挂：标签投影到原路径取弧长占比，平移到新路径同占比处——否则路由大改后
    // 标签留在旧干线旁（D1--否-->END 的「否」字离新线 87px，用户反馈"文字与线离得远"）。
    // 标签匹配：取投影到原路径距离最近（<30px）的未占用标签——mermaid 本就把它放在路径中点上。
    const labels = labelsOf(svg);
    let lab = null, ld = 30;
    for (const l of labels) {
      if (l.used) continue;
      const dd = projectOn([l.x, l.y], pts).d;
      if (dd < ld) { ld = dd; lab = l; }
    }
    if (lab) {
      lab.used = true;
      const oldL = polyLen(pts), newL = polyLen(sp);
      if (oldL > 0 && newL > 0) {
        const pr = projectOn([lab.x, lab.y], pts);
        const np = pointAt(sp, (pr.len / oldL) * newL);
        lab.g.setAttribute('transform', 'translate(' + (lab.x + np[0] - pr.pt[0]) + ', ' + (lab.y + np[1] - pr.pt[1]) + ')');
      }
    }
  });
});
</script>` : ''}
</body>
</html>`;
}
