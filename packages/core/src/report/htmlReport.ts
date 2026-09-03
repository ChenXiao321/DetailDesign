import type {
  ModuleModel, ConfigMacro, ConfigUsage, ExternalInterface,
} from '../model/types.js';
import { esc, escRaw, functionCard, calloutCard } from './cards.js';
import { wrapFlowchartLabels, pinEndNodeToBottom, lintMermaidSource } from './mermaidPre.js';
import { mermaidRenderScript } from './renderScript.js';

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

  const diagramBlock = (src: string) => {
    // 生成期静态检查：定界符错误的图源会在浏览器端 mermaid 词法报错整图失败，提前点名
    for (const p of lintMermaidSource(src)) console.warn(`⚠ 图源检查: ${p}\n  图源开头: ${src.split('\n').slice(0, 2).join(' | ').slice(0, 100)}`);
    return opts?.mermaidJs
      ? `<div class="mermaid">${escRaw(wrapFlowchartLabels(pinEndNodeToBottom(src)))}</div>`
      : `<pre class="plantuml">${escRaw(src)}</pre>`;
  };

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
  // 外部类型探测：按 AUTOSAR 命名约定取 XxxType 形标识符，排除本模块已定义类型、Std_Types 与已知函数名
  //（TLF 有函数 Gp_TLF35584_GetResetType 以 Type 结尾会被误当类型）。
  // 模块名归组：标准 AUTOSAR 前缀取首段（Dem_EventIdType → Dem）；项目根前缀（module 首段，如 Gp）下的
  // 名字取「去 Type 后缀后的前两段」（Gp_TimeCalType → Gp_TimeCal）——首段 Gp 是产品族前缀而非模块名；
  // 无下划线前缀的（如 CounterType）归入「其他」
  const localTypeNames = new Set(model.types.map(t => t.name));
  const knownFnNames = new Set(
    [...model.providedFunctions, ...model.internalFunctions, ...model.calledExternalFunctions]
      .map(f => f.name),
  );
  const rootPrefix = model.module.split('_')[0];
  const extTypeGroups = new Map<string, Set<string>>();
  for (const tok of scanText.match(/[A-Za-z_]\w*/g) ?? []) {
    if (!/Type$/.test(tok)) continue;
    if (localTypeNames.has(tok) || STD_TYPES.includes(tok) || knownFnNames.has(tok)) continue;
    const stripped = tok.replace(/Type$/, '');
    const mod = tok.startsWith(`${rootPrefix}_`) && stripped.includes('_')
      ? stripped.split('_').slice(0, 2).join('_')
      : tok.includes('_') ? tok.split('_')[0] : '其他';
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
    attrRows.push(`<tr><td class="label">Description</td><td>${esc(t.generated?.comment || t.comment) || '<span class="todo">（待补充）</span>'}</td></tr>`);

    let detailTable = '';
    if (t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) > 0) {
      const rows = t.relatedDefines!.map(d =>
        `<tr><td><code>${esc(d.name)}</code></td><td><code>${esc(d.value)}</code></td><td>${esc(t.generated?.defines?.[d.name] ?? d.comment)}</td></tr>`).join('');
      detailTable = `<table class="simple"><tr><th>常量名称</th><th>值</th><th>说明</th></tr>${rows}</table>`;
    } else if (t.kind === 'struct') {
      const rows = (t.elements ?? []).map(e =>
        `<tr><td><code>${esc(e.name)}</code></td><td><code>${esc(e.type)}</code></td><td>${esc(t.generated?.elements?.[e.name] ?? e.comment)}</td></tr>`).join('');
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
      // 说明列：LLM 生成优先；无生成内容时回退头文件注释，推断来源的标注「推断，待确认」
      `<tr><td><code>${esc(e.name)}</code></td><td>${esc(e.generated?.detailedDescription ?? e.comment?.description ?? '')}${!e.generated?.detailedDescription && e.commentSource === 'inferred' ? ' <span class="inferred">推断，待确认</span>' : ''}</td><td class="muted small">${e.calledFrom.map(esc).join(', ')}</td></tr>`).join('');
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
  // LLM 输出为「总述段落 + \n- 要点」；连续的 "- " 行渲染为列表，其余行各成段落
  let functionalDescSection: string;
  if (!model.functionalDescription) {
    functionalDescSection = '<p class="todo">（待生成：模块级功能描述，由 LLM 基于接口与动态设计事实生成）</p>';
  } else {
    const fdParts: string[] = [];
    let fdBullets: string[] = [];
    const flushBullets = () => {
      if (fdBullets.length > 0) {
        fdParts.push(`<ul>${fdBullets.map(b => `<li>${b}</li>`).join('')}</ul>`);
        fdBullets = [];
      }
    };
    for (const line of model.functionalDescription.split('\n')) {
      const bullet = line.match(/^\s*[-•]\s+(.*)$/);
      if (bullet) {
        fdBullets.push(esc(bullet[1]));
      } else {
        flushBullets();
        if (line.trim()) fdParts.push(`<p>${esc(line)}</p>`);
      }
    }
    flushBullets();
    functionalDescSection = fdParts.join('\n');
  }
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
    ...allFns.map(f => `${f.name} ${f.signature} ${f.generated?.detailedDescription ?? ''}`),
    ...model.calledExternalFunctions.map(e => `${e.name} ${e.generated?.detailedDescription ?? ''}`),
    ...model.configMacros.map(c => `${c.name} ${c.generated?.valueEffect ?? ''}`),
    ...model.types.map(t => `${t.name} ${t.comment} ${t.generated?.comment ?? ''}`),
    model.functionalDescription ?? '',
    // 序列图/状态机图源也属文档内容（含 actor OS 等角色名）
    model.dynamicDesign?.stateMachine?.diagram ?? '',
    ...(model.dynamicDesign?.sequences ?? []).map(s => `${s.name} ${s.diagram} ${s.description}`),
  ].join(' ');
  // 候选缩写词典：仅列本文档/代码中实际出现的
  const ABBR_CANDIDATES: [string, string][] = [
    ['ABIST', 'Analog Built-In Self Test 模拟内建自测试'],
    ['ADC', 'Analog to Digital Converter 模数转换器'],
    ['ASIL', 'Automotive Safety Integrity Level 汽车安全完整性等级'],
    ['ASW', 'Application Software 应用软件'],
    ['AUTOSAR', 'AUTomotive Open System ARchitecture 汽车开放系统架构'],
    ['BIST', 'Built-In Self Test 内建自测试'],
    ['Callout', 'Callout 函数：由集成方在配置代码中实现，模块通过调用 Callout 适配项目策略'],
    ['DEM', 'Diagnostic Event Manager 诊断事件管理模块（AUTOSAR）'],
    ['DET', 'Default Error Tracer 默认错误追踪模块（AUTOSAR）'],
    ['ECU', 'Electronic Control Unit 电子控制单元'],
    ['EcuM', 'ECU State Manager ECU 状态管理模块'],
    ['ENA', 'Enable 使能信号（TLF35584 唤醒源之一）'],
    ['ERR', 'Error 错误指示信号（TLF35584 安全路径）'],
    ['FC', 'Function Cluster 功能簇'],
    ['FWD', 'Functional Watchdog 功能看门狗'],
    ['LLD', 'Low Level Design 详细设计'],
    ['MCAL', 'Microcontroller Abstraction Layer 微控制器抽象层'],
    ['MCU', 'Microcontroller Unit 微控制器'],
    ['OS', 'Operating System 操作系统'],
    ['PORST', 'Power-On Reset 上电复位'],
    ['ROT', 'Reset Output 复位输出信号（TLF35584）'],
    ['RTE', 'Runtime Environment 运行时环境'],
    ['SBC', 'System Basis Chip 系统基础芯片'],
    ['SPI', 'Serial Peripheral Interface 串行外设接口'],
    ['SSC', 'Safe State Control 安全状态控制（TLF35584）'],
    ['WAK', 'Wake-up 唤醒信号（TLF35584 唤醒源之一）'],
    ['Wdg', 'Watchdog 看门狗'],
    ['WDI', 'Watchdog Input 看门狗输入信号（TLF35584）'],
    ['WWD', 'Window Watchdog 窗口看门狗'],
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
${mermaidRenderScript()}` : ''}
</body>
</html>`;
}
