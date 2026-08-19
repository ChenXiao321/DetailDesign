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
        ? `Callout 实现文件（配置代码）：由集成方实现 ${n} 个回调接口的具体策略`
        : `Callout 声明头文件（配置代码）：声明 ${n} 个由集成方实现的回调接口`;
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
@media print { nav { display:none; } .workitem { break-inside:avoid; } }
`;

/** 生成完整 HTML 评审报告；传入 mermaidJs（mermaid.min.js 内容）则离线渲染图 */
export function generateHtmlReport(model: ModuleModel, opts?: { mermaidJs?: string }): string {
  const fnCount = model.providedFunctions.length + model.internalFunctions.length;
  const generatedCount = [...model.providedFunctions, ...model.internalFunctions].filter(f => f.generated).length;

  const diagramBlock = (src: string) => opts?.mermaidJs
    ? `<div class="mermaid">${escRaw(src)}</div>`
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
  const sanitizeId = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');
  const includeEdges: string[] = [];
  for (const f of model.files) {
    const base = f.path.split(/[\\/]/).pop()!;
    for (const inc of f.includes ?? []) {
      const incBase = inc.split(/[\\/]/).pop()!;
      includeEdges.push(`    ${sanitizeId(base)}["${base}"] --> ${sanitizeId(incBase)}["${incBase}"]`);
    }
  }
  const includeGraph = includeEdges.length > 0
    ? ['flowchart LR', ...includeEdges].join('\n')
    : '';

  // ---- 5.1 功能接口总图（由 providedFunctions + calledExternalFunctions 静态生成，无需 LLM） ----
  // 模板要求：功能接口图显示 FC 的接口关系，箭头指向与数据流向一致
  const overviewLines: string[] = ['flowchart LR'];
  overviewLines.push('    Caller["外部调用方<br/>（其他 FC / RTE / 集成代码）"]');
  overviewLines.push(`    subgraph MOD["${model.module} 提供的外部接口（${model.providedFunctions.length} 个）"]`, '        direction TB');
  model.providedFunctions.forEach((f, i) => overviewLines.push(`        P${i}["${f.name}"]`));
  overviewLines.push('    end');
  const extGroupEntries = [...groups.entries()];
  extGroupEntries.forEach(([group, items], gi) => {
    const names = items.map(e => e.name).join('<br/>');
    const tag = group === 'Callout' ? '（配置代码回调）' : '';
    overviewLines.push(`    G${gi}["<b>${group}</b>${tag}（${items.length} 个）<br/>──────────<br/>${names}"]`);
  });
  overviewLines.push('    Caller --> MOD');
  extGroupEntries.forEach((_, gi) => overviewLines.push(`    MOD --> G${gi}`));
  const interfaceOverview = overviewLines.join('\n');

  // ---- 5.1 功能描述 ----
  const functionalDescSection = model.functionalDescription
    ? `<p>${esc(model.functionalDescription)}</p>`
    : '<p class="todo">（待生成：模块级功能描述，由 LLM 基于接口与动态设计事实生成）</p>';

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
  // Callout 回调函数：由集成方在配置代码中实现，属于功能配置点
  const callouts = model.calledExternalFunctions.filter(e => e.group === 'Callout');
  const calloutSecNo = `6.2.${functionalCfgs.length + 1}`;
  const calloutCfgSection = callouts.length === 0 ? '' : `<h4>${calloutSecNo} Callout function</h4>
<p class="muted">Callout 回调函数由集成方在配置代码（ConfTemplate）中实现，是本模块的功能配置点：通过编写/修改 Callout 实现来适配项目策略（核ID获取、阶段初始化、故障处理等）。每个 Callout 为一个独立工作项。</p>
${callouts.map((e, i) => calloutCard(e, `${calloutSecNo}.${i + 1}`)).join('\n')}`;
  const aliasCfgs = model.configMacros.filter(c => c.kind === 'alias');
  const aliasCfgNote = aliasCfgs.length === 0 ? '' :
    `<p class="muted">注：以下宏为固定别名（实现重定义，无可选值，不属于配置项）：${aliasCfgs.map(c => `<code>${esc(c.name)}${c.isFunctionLike ? '()' : ''} → ${esc(c.value)}</code>`).join('，')}</p>`;

  // ---- 文件清单（主文件在前） ----
  const fileRows = [...model.files]
    .sort((a, b) => fileSortKey(a).localeCompare(fileSortKey(b)))
    .map(f => `<tr><td><code>${esc(f.path)}</code></td><td>${esc(describeFile(f.path, f.role, model))}</td></tr>`).join('');

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
  <a href="#s4">4 程序系统结构</a>
  <a href="#s51">5.1 功能描述</a>
  <a href="#s521">5.2.1 数据类型</a>
  <a href="#s522">5.2.2 调用的外部接口</a>
  <a href="#s523">5.2.3 提供的外部接口</a>
  <a href="#s524">5.2.4 内部接口</a>
  <a href="#s53">5.3 动态设计</a>
  <a href="#s6">6 配置说明</a>
</nav>
<main>
<div class="note">本报告由 agent 自动生成，供评审。带 <b>工作项</b> 标记的条目对应 Polarion 工作项颗粒度；函数描述共 ${fnCount} 个，已生成 ${generatedCount} 个。追溯链接（is derived from）按约定留空，入库后人工补充。</div>

<h2 id="s4">4 程序系统结构</h2>
<h3>4.1 文件说明</h3>
<table class="simple"><tr><th>文件</th><th>说明</th></tr>${fileRows}</table>

<h3>4.2 文件包含关系</h3>
<p class="muted">模块内部文件间的包含关系如下图所示（由 #include 静态分析生成）。</p>
${includeGraph ? `${diagramBlock(includeGraph)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(includeGraph)}</pre></details>` : '<p class="todo">（未解析到 include 关系）</p>'}

<h2 id="s51">5.1 功能描述</h2>
<h3>功能接口总图</h3>
<p class="muted">本模块对外提供 ${model.providedFunctions.length} 个接口函数（左侧为调用方），并调用 ${model.calledExternalFunctions.length} 个外部接口（右侧按来源模块归组，含 Callout 配置代码回调）；箭头方向为调用方向。</p>
${diagramBlock(interfaceOverview)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(interfaceOverview)}</pre></details>
${functionalDescSection}

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
<p class="muted">注：Callout 回调接口（${calloutCount} 个）属于本模块配置代码（ConfTemplate），由集成方实现，不属于外部接口，未列入本节；其作为功能配置点见 ${calloutSecNo} Callout function，声明见 4.1 文件说明，调用关系见各接口函数卡片的「调用」行。</p>
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
</main>
${opts?.mermaidJs ? `<script>${opts.mermaidJs}</script>
<script>mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', theme: 'neutral', sequence: { showSequenceNumbers: true } });</script>` : ''}
</body>
</html>`;
}
