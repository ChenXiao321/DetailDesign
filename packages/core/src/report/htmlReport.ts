import type {
  ModuleModel, ConfigMacro, ConfigUsage, ExternalInterface,
} from '../model/types.js';
import { esc, escRaw, functionCard, calloutCard } from './cards.js';
import { listStateMachines } from '../model/types.js';
import { wrapFlowchartLabels, pinEndNodeToBottom, lintMermaidSource, lintFlowchartStructure, lintSequenceStructure } from './mermaidPre.js';
import { mermaidRenderScript } from './renderScript.js';
import { buildDocumentContent } from '../generator/staticDocument.js';
import { buildIncludeGraph } from './includeGraph.js';
import type { ModuleDiff, PolarionSync } from '../generator/modelDiff.js';

/** 4.1 文件说明表物化前（存量 json 无 document.fileTable）的现算实现，已搬入 staticDocument.ts；
 *  两条路径同一实现，产物逐字节一致 */

// 导出给 imageBatch（PNG 物化批量页）复用，保证与报告渲染度量口径一致
export const REPORT_CSS = `
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
.wi-table.type-merged td { border:1px solid var(--border); }
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

/** 生成完整 HTML 评审报告；传入 mermaidJs（mermaid.min.js 内容）则离线渲染图；
 *  骨架内容（1/2/3/7/8 章正文与各章引导句）统一来自 model.document（gen 期物化）；
 *  存量 json 无 document 时由 buildDocumentContent 渲染期现算——同一实现，产物逐字节一致，
 *  此时 abbreviations 系列 opts 作为现算入参（legacy 兼容，_test_abbrdocx 走此路径）；
 *  model.document 在场时这些 opts 被忽略。缩写缺口名单统一从 doc.abbreviationGaps 经
 *  onAbbreviationGaps 回报（物化产物名单为 gen 期口径）。 */
export function generateHtmlReport(model: ModuleModel, opts?: {
  mermaidJs?: string;
  abbreviations?: [string, string][];
  abbreviationsReplace?: boolean;
  abbreviationSource?: string;
  definitions?: [string, string][];
  onAbbreviationGaps?: (missing: string[]) => void;
  /** 版本更新差异清单（update/diff 命令产出 lld_diff.json 后由 CLI 传入；缺省不渲染附录） */
  diff?: ModuleDiff;
  /** Polarion 同步操作单（lld_polarion_sync.json；缺省不渲染操作表） */
  sync?: PolarionSync;
}): string {
  const fnCount = model.providedFunctions.length + model.internalFunctions.length;
  const generatedCount = [...model.providedFunctions, ...model.internalFunctions].filter(f => f.generated).length;

  // 骨架内容单一来源：物化值优先，缺省现算（两条路径同一实现，字节一致）
  const doc = model.document ?? buildDocumentContent(model, {
    entries: opts?.abbreviations ?? [],
    definitions: opts?.definitions ?? [],
    replace: opts?.abbreviationsReplace === true,
    source: opts?.abbreviationSource,
  });
  if (opts?.onAbbreviationGaps && doc.abbreviationGaps.length > 0) {
    opts.onAbbreviationGaps(doc.abbreviationGaps);
  }

  const diagramBlock = (src: string) => {
    // 生成期静态检查：定界符错误的图源会在浏览器端 mermaid 词法报错整图失败，提前点名；
    // 结构 lint（孤儿节点/幽灵节点/断链等）只警告不阻断，便于 report 阶段发现存量产物问题
    for (const p of [...lintMermaidSource(src), ...lintFlowchartStructure(src), ...lintSequenceStructure(src)]) console.warn(`⚠ 图源检查: ${p}\n  图源开头: ${src.split('\n').slice(0, 2).join(' | ').slice(0, 100)}`);
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

  // ---- 5.2.1.1 引用的数据类型（物化自 doc.importedTypes；0929 前的物化 json 缺该字段时现算补齐，同实现字节一致） ----
  const importedTypeRows = (doc.importedTypes ?? buildDocumentContent(model).importedTypes!)
    .map(([mod, types]) => `<tr><td><code>${esc(mod)}</code></td><td><code>${types.map(esc).join('<br>')}</code></td></tr>`);

  // ---- 5.2.1.2 数据类型（单表：Name/Type/[Range]/Elements|Constants/Description，参照 Polarion 工作项样式） ----
  const numOf = (v: string) => v.match(/0x[0-9A-Fa-f]+|\d+/)?.[0] ?? '';
  const typesSection = model.types.map(t => {
    const rows: string[] = [
      `<tr><td class="label">Name</td><td colspan="3"><code>${esc(t.name)}</code></td></tr>`,
      `<tr><td class="label">Type</td><td colspan="3"><code>${esc(t.kind === 'struct' ? 'struct' : t.underlyingType ?? '')}</code></td></tr>`,
    ];
    if (t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) > 0) {
      const defs = t.relatedDefines!;
      rows.push(`<tr><td class="label">Range</td><td colspan="3"><code>${esc(numOf(defs[0].value))} - ${esc(numOf(defs[defs.length - 1].value))}</code></td></tr>`);
      defs.forEach((d, i) => {
        const label = i === 0 ? `<td class="label" rowspan="${defs.length}">Constants</td>` : '';
        rows.push(`<tr>${label}<td><code>${esc(d.name)}</code></td><td><code>${esc(d.value)}</code></td><td>${esc(t.generated?.defines?.[d.name] ?? d.comment)}</td></tr>`);
      });
    } else if (t.kind === 'struct' && (t.elements?.length ?? 0) > 0) {
      const els = t.elements!;
      els.forEach((e, i) => {
        const label = i === 0 ? `<td class="label" rowspan="${els.length}">Elements</td>` : '';
        rows.push(`<tr>${label}<td><code>${esc(e.name)}</code></td><td><code>${esc(e.type)}</code></td><td>${esc(t.generated?.elements?.[e.name] ?? e.comment)}</td></tr>`);
      });
    }
    rows.push(`<tr><td class="label">Description</td><td colspan="3">${esc(t.generated?.comment || t.comment) || '<span class="todo">（待补充）</span>'}</td></tr>`);
    return `<h3>${esc(t.name)} <span class="badge">工作项 · 5.2.1.2</span></h3>
<table class="wi-table type-merged">${rows.join('')}</table>`;
  }).join('\n');

  // ---- 5.2.2 调用的外部接口（按组） ----
  // Callout 属于本模块配置代码（ConfTemplate），不算外部接口，此处排除；
  // 其声明/实现见 4.1 文件说明，调用关系见各函数卡片"调用"行
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
    ? `<p class="muted">${doc.notes.providedVarsEmpty}</p>`
    : `<table class="simple"><tr><th>变量名</th><th>数据类型</th><th>说明</th></tr>${model.providedVariables.map(v =>
        `<tr><td><code>${esc(v.name)}</code></td><td><code>${esc(v.type)}</code></td><td>${esc(v.comment)}</td></tr>`).join('')}</table>`;

  // ---- 4.2 文件包含关系（由 #include 静态生成 Mermaid 图，无需 LLM） ----
  // 图源码构建抽至 includeGraph.ts（PNG 物化与报告共享同一份源码，保证一致）
  const includeGraph = buildIncludeGraph(model);

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
<p class="muted">${doc.notes.overview}</p>
${diagramBlock(model.interfaceOverview.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(model.interfaceOverview.diagram)}</pre></details>` : '';
  // 内部函数调用图：analyze 时按对外接口函数逐张静态生成（每张一个工作项 · 5.1），此处仅渲染
  const callGraphSection = (model.callGraphs?.length ?? 0) > 0 ? `
<h3>内部函数调用图（每张图一个工作项）</h3>
<p class="muted">${doc.notes.callGraph}</p>
${model.callGraphs!.map(g => `<h4>内部函数调用图：${esc(g.name)} <span class="badge">工作项 · ${esc(g.polarion.chapter)}</span></h4>
${diagramBlock(g.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(g.diagram)}</pre></details>`).join('\n')}` : '';

  // ---- 5.3 动态设计 ----
  const dd = model.dynamicDesign;
  const sms = listStateMachines(dd);
  // 迁移表合并口径：多角色分图时合并各角色迁移并按 从|到|触发 去重（单图产物与旧版逐字节一致）
  const mergedTransitions = [...new Map(sms.flatMap(sm => sm.transitions).map(t => [`${t.from}|${t.to}|${t.trigger}`, t])).values()];
  // 多核按角色分图时逐角色各渲染一张（与序列图同章号多节的惯例一致）；单图产物输出与旧版逐字节一致
  const smSection = sms.length > 0 ? `
${sms.map(sm => `<h3>5.3.1 状态机：${esc(sm.name)} <span class="badge">工作项 · 5.3.1</span></h3>
${diagramBlock(sm.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(sm.diagram)}</pre></details>`).join('\n')}
<h3>5.3.1.1 状态描述（每个状态一个工作项）</h3>
<table class="simple"><tr><th>状态</th><th>说明</th></tr>
${sms[0].states.map(s => `<tr><td><code>${esc(s.name)}</code></td><td>${esc(s.description)}</td></tr>`).join('')}</table>
<h3>5.3.1.2 状态迁移（每个迁移一个工作项）</h3>
<table class="simple"><tr><th>从</th><th>到</th><th>触发条件</th><th>说明</th></tr>
${mergedTransitions.map(t => `<tr><td><code>${esc(t.from)}</code></td><td><code>${esc(t.to)}</code></td><td>${esc(t.trigger)}</td><td>${esc(t.description)}</td></tr>`).join('')}</table>` : '';

  const seqSection = (dd?.sequences ?? []).map(s => {
    // 平铺警告（存量产物补网）：入口函数源码含分支/循环而图全图无组合片段——gen 期硬校验拦不住旧产物
    const scenarioFn = model.providedFunctions.find(f =>
      s.name.startsWith('Initialization') ? /_(Startup|Init)$/i.test(f.name) : /_MainFunction$/i.test(f.name));
    if (scenarioFn && /\b(if|for|while|switch)\s*\(/.test(scenarioFn.bodyTextWithPP ?? scenarioFn.bodyText)
        && !/^\s*(alt|opt|loop|par|critical|break)\b/m.test(s.diagram)) {
      console.warn(`⚠ 序列图检查: ${s.name} 全图无组合片段，但函数 ${scenarioFn.name} 源码含分支/循环，疑似平铺（需重生成 dynamic）`);
    }
    return `
<h3>5.3.2 序列图：${esc(s.name)} <span class="badge">工作项 · 5.3.2</span></h3>
<p class="muted">${esc(s.description)}</p>
${diagramBlock(s.diagram)}
<details><summary class="muted small">查看图源码（Mermaid，可 diff）</summary><pre class="plantuml">${escRaw(s.diagram)}</pre></details>`;
  }).join('\n');

  // ---- 6 配置（6.1 通用 / 6.2 功能，每个配置项一个子章节） ----
  // 使用方式/配置示例物化自 doc.configDetails；别名宏注物化自 doc.aliasNote
  //（0929 前的物化 json 缺字段时现算补齐，同实现字节一致；map 内缺单个宏时按宏现算兜底）
  const configDetails = doc.configDetails ?? buildDocumentContent(model).configDetails!;
  // 字段级兜底：0930 前物化的条目只有 usageItems/example，缺 tableRow/valueEffect 时按宏现算补齐
  const configDetailOf = (c: ConfigMacro) => {
    const d = configDetails[c.name];
    if (d && d.tableRow && d.valueEffect !== undefined) return d;
    return buildDocumentContent(model).configDetails![c.name]!;
  };
  const configSubsection = (c: ConfigMacro, secNo: string): string => {
    const detail = configDetailOf(c);
    return `<h4>${secNo} <code>${esc(c.name)}</code></h4>
<table class="simple"><tr><th>配置项</th><th>取值</th><th>形式</th><th>说明</th></tr>
<tr><td><code>${esc(c.name)}</code></td><td><code>${esc(detail.tableRow![0])}</code></td><td>${detail.tableRow![1]}</td><td>${esc(detail.tableRow![2])}</td></tr></table>
<p><b>配置示例：</b></p>
<pre class="plantuml">${escRaw(detail.example)}</pre>
<p><b>使用方式（静态分析事实）：</b></p>
<ul>${detail.usageItems.join('')}</ul>
${c.affects.length > 0 ? `<p><b>影响范围（条件编译直接作用的函数/变量）：</b>${c.affects.map(a => `<code>${esc(a)}</code>`).join('，')}</p>` : ''}
<p><b>取值影响：</b>${detail.valueEffect}</p>`;
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
<p class="muted">${doc.notes.calloutCfg}</p>
${callouts.map((e, i) => calloutCard(e, `${calloutSecNo}.${i + 1}`)).join('\n')}`;
  const aliasCfgNote = doc.aliasNote ?? buildDocumentContent(model).aliasNote!;

  // ---- 7 详细设计规范评估（评估行/总结物化自 doc；维度列 rowspan 与明细表为渲染期版式/派生数据） ----
  const allFns = [...model.providedFunctions, ...model.internalFunctions];
  // 维度列合并（rowspan）
  const evalTableRows: string[] = [];
  let i = 0;
  const evalRows = doc.evaluationRows;
  while (i < evalRows.length) {
    const dim = evalRows[i].dim;
    let span = 0;
    while (i + span < evalRows.length && evalRows[i + span].dim === dim) span++;
    evalRows.slice(i, i + span).forEach((r, j) => {
      evalTableRows.push(`<tr>${j === 0 ? `<td rowspan="${span}"><b>${esc(dim)}</b></td>` : ''}<td>${r.no}</td><td>${esc(r.content)}</td><td>是</td><td>${r.fact}</td></tr>`);
    });
    i += span;
  }
  // 序号 7 的事实明细：圈复杂度表（物化自 doc.complexityTable；旧物化 json 缺字段时现算补齐，同实现字节一致）
  const complexityRows = (doc.complexityTable ?? buildDocumentContent(model).complexityTable!)
    .map(([name, cx, loop]) => `<tr><td><code>${esc(name)}</code></td><td>${cx ?? '—'}</td><td>${loop ? '含死循环' : ''}</td><td>${(cx ?? 0) > 10 ? '<span class="todo">超过 10，需人工评审</span>' : '<span class="muted">≤10</span>'}</td></tr>`)
    .join('');
  const evalSection = `
<h2 id="s7">7 详细设计规范评估</h2>
<table class="simple"><tr><th>维度</th><th>序号</th><th>评估内容</th><th>是否评估</th><th>分析结果（事实依据自动生成，结论人工确认）</th></tr>${evalTableRows.join('')}</table>
<h3>圈复杂度明细（序号 7 事实依据，静态计算）</h3>
<p class="muted">${doc.complexityNote}</p>
<table class="simple"><tr><th>函数</th><th>圈复杂度</th><th>死循环</th><th>参考评估</th></tr>${complexityRows}</table>
<h3>总结</h3>
<p class="muted">${doc.notes.evalSummaryIntro}</p>
<ul class="muted">
${doc.evaluationSummary.map(s => `<li>${s}</li>`).join('\n')}
</ul>`;

  // ---- 1~3 章（骨架内容物化自 doc；文档骨架内容，非工作项） ----
  const abbrRows = doc.abbreviations
    .map(([abbr, desc]) => `<tr><td><code>${esc(abbr)}</code></td><td>${esc(desc)}</td></tr>`)
    .join('');
  const defRows = doc.definitions
    .map(([n, d]) => `<tr><td>${esc(n)}</td><td>${esc(d)}</td></tr>`)
    .join('');
  const preSection = `
<h2 id="s1">1 目的</h2>
<p>${doc.purpose}</p>
<h2 id="s2">2 适用范围</h2>
<p>${doc.scope}</p>
<h2 id="s3">3 定义和缩写</h2>
<h3>3.1 缩写</h3>
<table class="simple"><tr><th>缩写</th><th>描述</th></tr>${abbrRows}</table>
<p class="muted">${doc.abbreviationNote}</p>
<h3>3.2 定义</h3>
<table class="simple"><tr><th>名称</th><th>描述</th></tr>${defRows}</table>${doc.definitionNote
  ? `\n<p class="muted">${doc.definitionNote}</p>` : ''}`;

  // ---- 8 支持/相关性文件（物化自 doc；编号以「（待」开头的单元格标 todo 待人工补充） ----
  const supportSection = `
<h2 id="s8">8 支持/相关性文件</h2>
<table class="simple"><tr><th>序号</th><th>文档名称</th><th>文档编号</th></tr>
${doc.supportFiles.map(([no, name, code]) =>
  `<tr><td>${esc(no)}</td><td>${esc(name)}</td><td${code.startsWith('（待') ? ' class="todo"' : ''}>${esc(code)}</td></tr>`).join('\n')}
</table>
<p class="muted">${doc.supportNote}</p>`;

  // ---- 附录 A 变更记录（版本更新场景；opts.diff 缺省时整节不渲染） ----
  const diffSection = opts?.diff ? (() => {
    const d = opts.diff;
    const fnRows = [
      ...d.functions.changed.map(c => `<tr><td>变更（${c.kind === 'sig' ? '签名' : '实现'}）</td><td><code>${esc(c.name)}</code></td></tr>`),
      ...d.functions.added.map(n => `<tr><td>新增</td><td><code>${esc(n)}</code></td></tr>`),
      ...d.functions.removed.map(n => `<tr><td>删除</td><td><code>${esc(n)}</code></td></tr>`),
    ];
    const miscRows = (label: string, c: { changed: string[]; added: string[]; removed: string[] }) => [
      ...c.changed.map(n => `<tr><td>${label}·变更</td><td><code>${esc(n)}</code></td></tr>`),
      ...c.added.map(n => `<tr><td>${label}·新增</td><td><code>${esc(n)}</code></td></tr>`),
      ...c.removed.map(n => `<tr><td>${label}·删除</td><td><code>${esc(n)}</code></td></tr>`),
    ];
    const allRows = [...fnRows, ...miscRows('类型', d.types), ...miscRows('外部接口', d.externals), ...miscRows('配置宏', d.configs)];
    // ---- 变更总览（确定性汇总段：统计+接口影响判定+疑似改名+文档联动） ----
    const f = d.functions;
    const sigChg = f.changed.filter(c => c.kind === 'sig');
    const bodyChg = f.changed.filter(c => c.kind === 'body');
    const totalChanged = f.changed.length + f.added.length + f.removed.length
      + d.types.changed.length + d.types.added.length + d.types.removed.length
      + d.externals.changed.length + d.externals.added.length + d.externals.removed.length
      + d.configs.changed.length + d.configs.added.length + d.configs.removed.length;
    // 接口面影响：签名变更/新增/删除的函数（有 sync 时按章节区分内外部，5.2.4.2 内部函数不算接口面）
    const syncFnChapters = new Map((opts?.sync?.operations ?? []).filter(o => o.kind === 'function').map(o => [o.title, o.chapter]));
    const isIface = (n: string): boolean => syncFnChapters.size === 0 || syncFnChapters.get(n) !== '5.2.4.2';
    const ifaceImpact = [...sigChg.map(c => c.name), ...f.added, ...f.removed].filter(isIface);
    const renamePairs = (opts?.sync?.operations ?? []).filter(o => o.action === 'rename');
    // 改名对的 from/to 已在下方单列，接口影响名单剔除避免重复点名
    const renameNames = new Set(renamePairs.flatMap(o => [o.from ?? '', o.title]));
    const ifaceImpactNet = ifaceImpact.filter(n => !renameNames.has(n));
    const chapterList = [...new Set((opts?.sync?.chapterUpdates ?? []).map(cu => cu.chapter))];
    const overviewBlock = `
<h3>A.0 变更总览</h3>
${d.hasChanges ? `<p>本次更新共 ${totalChanged} 处条目变化：函数 ${f.changed.length + f.added.length + f.removed.length} 项（签名变更 ${sigChg.length}、实现变更 ${bodyChg.length}、新增 ${f.added.length}、删除 ${f.removed.length}）、类型 ${d.types.changed.length + d.types.added.length + d.types.removed.length} 项、外部接口 ${d.externals.changed.length + d.externals.added.length + d.externals.removed.length} 项、配置宏 ${d.configs.changed.length + d.configs.added.length + d.configs.removed.length} 项；其余条目未变，内容沿用上版。</p>
<p>${ifaceImpactNet.length > 0
  ? `<strong>接口面有变化</strong>（影响调用方，评审重点）：${ifaceImpactNet.map(n => `<code>${esc(n)}</code>`).join('、')}。`
  : renamePairs.length > 0
    ? '<strong>接口面变化均来自下方改名对</strong>（函数名变化，调用方需同步改名）。'
    : '<strong>接口面无变化</strong>，改动限于模块内部实现。'}</p>
${renamePairs.length > 0 ? `<p>疑似改名 ${renamePairs.length} 对（建议改原工作项，保留历史与追溯链接）：${renamePairs.map(o => `<code>${esc(o.from ?? '')}</code> → <code>${esc(o.title)}</code>`).join('、')}。</p>` : ''}
${chapterList.length > 0 ? `<p>文档联动更新：${chapterList.map(c => esc(c)).join('、')}（详见 A.2）。</p>` : ''}`
  : '<p>本次更新无差异（代码未变，仅重新分析），文档内容全部沿用上版。</p>'}`;
    // Polarion 同步操作单（opts.sync 缺省时零字节——操作表独立小节，不影响存量字节门禁）
    const syncLabel: Record<string, string> = { delete: '删除', update: '更新', create: '新建', rename: '改名' };
    const syncTable = opts?.sync && opts.sync.operations.length > 0 ? `
<h3>A.1 Polarion 同步操作单</h3>
<p class="muted">按章节排序，照单操作即可；未变条目零操作（函数 ${opts.sync.untouched.functions} / 类型 ${opts.sync.untouched.types} / 外部接口 ${opts.sync.untouched.externals} / 配置宏 ${opts.sync.untouched.configs}）。</p>
<table class="simple"><tr><th>章节</th><th>操作</th><th>工作项 title</th><th>说明</th></tr>
${opts.sync.operations.map(op => `<tr><td>${esc(op.chapter)}</td><td>${syncLabel[op.action]}</td><td><code>${esc(op.title)}</code>${op.from ? `<br><span class="muted">原 ${esc(op.from)}</span>` : ''}</td><td>${esc(op.detail)}</td></tr>`).join('\n')}
</table>` : '';
    const chapterTable = opts?.sync && opts.sync.chapterUpdates.length > 0 ? `
<h3>A.2 章节级内容更新（工作项之外）</h3>
<table class="simple"><tr><th>章节</th><th>内容</th><th>原因</th></tr>
${opts.sync.chapterUpdates.map(cu => `<tr><td>${esc(cu.chapter)}</td><td>${esc(cu.title)}</td><td>${esc(cu.reason)}</td></tr>`).join('\n')}
</table>` : '';
    return `
<h2 id="sA">附录 A 变更记录</h2>${overviewBlock}
<p class="muted">本次更新相对上一版分析（${esc(d.oldAnalyzedAt)} → ${esc(d.newAnalyzedAt)}）的差异清单；未变更条目内容沿用上版（共 ${d.functions.unchanged.length} 个函数未变）。</p>
${allRows.length > 0
  ? `<table class="simple"><tr><th>变更类型</th><th>名称</th></tr>\n${allRows.join('\n')}\n</table>`
  : '<p class="muted">无差异（代码未变，仅重新分析）。</p>'}${syncTable}${chapterTable}`;
  })() : '';
  // 无 diff 时零字节差异（附录节自带前置换行，不污染模板行结构）
  const diffBlock = diffSection ? `\n${diffSection}` : '';

  // ---- 文件清单（4.1，物化自 doc.fileTable；0929 前的物化 json 缺该字段时现算补齐，同实现字节一致） ----
  const fileRows = (doc.fileTable ?? buildDocumentContent(model).fileTable!)
    .map(([name, desc]) => `<tr><td><code>${esc(name)}</code></td><td>${esc(desc)}</td></tr>`).join('');

  // ---- 4.2 说明段（0929 起 notes.include 整段物化；旧物化 json 仅注部分或带旧版括号引导句，归一化兜底，字节一致） ----
  const INCLUDE_INTRO = '模块内部文件间的包含关系如下图所示。';
  const INCLUDE_INTRO_OLD = '模块内部文件间的包含关系如下图所示（由 #include 静态分析生成）。';
  const includeNote = doc.notes.include.startsWith(INCLUDE_INTRO)
    ? doc.notes.include
    : doc.notes.include.startsWith(INCLUDE_INTRO_OLD)
      ? INCLUDE_INTRO + doc.notes.include.slice(INCLUDE_INTRO_OLD.length)
      : INCLUDE_INTRO + doc.notes.include;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(model.module)} 软件详细设计规范（Code）- 评审稿</title>
<style>${REPORT_CSS}</style>
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
<p class="muted">${includeNote}</p>
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
<p class="muted">${doc.notes.externalVars}</p>
<h3>5.2.2.2 接口函数</h3>
<p class="muted">${doc.notes.externalFnsCallout}</p>
${calledSection}

<h3 id="s523">5.2.3 提供的外部接口</h3>
<h3>5.2.3.1 全局变量</h3>
${providedVarSection}
<h3>5.2.3.2 接口函数</h3>
${model.providedFunctions.map(f => functionCard(f, diagramBlock, staticVarNames)).join('\n')}

<h3 id="s524">5.2.4 内部接口</h3>
<h3>5.2.4.1 全局变量定义</h3>
<p class="muted">${doc.notes.internalVars}</p>
<table class="simple"><tr><th>变量名</th><th>数据类型</th><th>说明</th><th>备注</th></tr>${internalVarRows}</table>
<h3>5.2.4.2 内部函数说明</h3>
${model.internalFunctions.map(f => functionCard(f, diagramBlock, staticVarNames)).join('\n')}

<h2 id="s53">5.3 动态设计</h2>
${smSection}
${seqSection}

<h2 id="s6">6 配置说明</h2>
<h3>6.1 通用配置说明</h3>
<p class="muted">${doc.notes.configGeneral}</p>
${generalCfgSection}
<h3>6.2 功能配置说明</h3>
<p class="muted">${doc.notes.configFunctional}</p>
${functionalCfgSection}
${calloutCfgSection}
${aliasCfgNote}
${evalSection}
${supportSection}${diffBlock}
</main>
${opts?.mermaidJs ? `<script>${opts.mermaidJs}</script>
${mermaidRenderScript()}` : ''}
</body>
</html>`;
}
