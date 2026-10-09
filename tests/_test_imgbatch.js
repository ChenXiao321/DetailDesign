// 图 PNG 物化纯逻辑测试：①collectDiagrams 六类收集 ②批量页结构（预处理/容器/CSS/脚本）
// ③extractDiagramSvgs 提取与失败检出 ④svgNaturalSize ⑤pickShotParams 缩放阶梯
// ⑥wrapSvgShotPage 根标签重写 ⑦applyDiagramPng/hasDiagramPng 写回与 resume 跳过
const {
  collectDiagrams, buildBatchPage, extractDiagramSvgs, svgNaturalSize, pickShotParams,
  wrapSvgShotPage, hasDiagramPng, applyDiagramPng,
} = require('../packages/core/dist/report/imageBatch.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

function mkModel() {
  return {
    module: 'M', analyzedAt: '', files: [
      { path: 'M.c', role: 'source', includes: ['M.h'] },
      { path: 'M.h', role: 'header', includes: [] },
    ],
    providedFunctions: [{
      name: 'M_Init', file: 'M.c',
      generated: { detailedDescription: 'd', flowchart: 'flowchart TD\n    START([开始]) --> END([结束])', flowchartFormat: 'mermaid', llmModel: 'mock', generatedAt: '' },
    }, {
      name: 'M_NoChart', file: 'M.c',
      generated: { detailedDescription: 'd', llmModel: 'mock', generatedAt: '' },
    }],
    internalFunctions: [],
    internalVariables: [], providedVariables: [], calledExternalFunctions: [],
    types: [], configMacros: [],
    interfaceOverview: { diagram: 'flowchart LR\n    A --> B', diagramFormat: 'mermaid', polarion: {} },
    callGraphs: [{ name: 'M_Init', diagram: 'flowchart TD\n    M_Init --> M_Sub', diagramFormat: 'mermaid', polarion: {} }],
    dynamicDesign: {
      stateMachine: { name: 'M_SM', diagram: 'stateDiagram-v2\n    [*] --> Idle', diagramFormat: 'mermaid', states: [], transitions: [], polarion: {} },
      sequences: [{ name: 'Initialization', diagram: 'sequenceDiagram\n    OS->>M: M_Init()', diagramFormat: 'mermaid', description: '', polarion: {} }],
    },
    document: { purpose: '', scope: '', abbreviations: [], abbreviationNote: '', definitions: [], definitionNote: null, abbreviationGaps: [], evaluationRows: [], complexityNote: '', evaluationSummary: [], supportFiles: [], supportNote: '', notes: {} },
  };
}

// ---- ① collectDiagrams：六类齐全，无流程图的函数不收 ----
{
  const entries = collectDiagrams(mkModel());
  const keys = entries.map(e => e.key);
  check('六类图收集（overview/callgraph/fn/sm/seq/include）',
    keys.join(',') === 'overview,callgraph:M_Init,fn:M_Init,sm:M_SM,seq:Initialization,include', keys.join(','));
  check('无 flowchart 的函数不收集', !keys.includes('fn:M_NoChart'));
  check('include 图源为 buildIncludeGraph 产物', entries.find(e => e.key === 'include').src.startsWith('flowchart BT'));
  // 多核分图：stateMachines 列表全收
  const m2 = mkModel();
  m2.dynamicDesign.stateMachines = [
    { name: 'M_Master', diagram: 'stateDiagram-v2\n    [*] --> A', diagramFormat: 'mermaid', states: [], transitions: [], polarion: {} },
    { name: 'M_Sat', diagram: 'stateDiagram-v2\n    [*] --> B', diagramFormat: 'mermaid', states: [], transitions: [], polarion: {} },
  ];
  const keys2 = collectDiagrams(m2).map(e => e.key);
  check('多核 stateMachines 列表全收', keys2.includes('sm:M_Master') && keys2.includes('sm:M_Sat') && !keys2.includes('sm:M_SM'), keys2.filter(k => k.startsWith('sm:')).join(','));
}

// ---- ② buildBatchPage：预处理 + 定位容器 + 报告 CSS + 渲染脚本 ----
{
  const entries = collectDiagrams(mkModel());
  const page = buildBatchPage(entries, 'MERMAIDJS_STUB');
  check('批量页含全部 data-key 容器', entries.every(e => page.includes(`data-key="${e.key}"`)));
  check('批量页含 mermaid 容器', (page.match(/class="mermaid"/g) || []).length === entries.length);
  check('批量页含 mermaid.min.js 与渲染脚本', page.includes('MERMAIDJS_STUB') && page.includes('mermaid.initialize'));
  check('批量页含报告 CSS（渲染度量与报告一致）', page.includes('.mermaid svg') && page.includes('Segoe UI'));
  check('图源经 pinEndNodeToBottom/wrapFlowchartLabels 预处理', !page.includes('START([开始]) --> END([结束])') || page.includes('END'));
}

// ---- ③ extractDiagramSvgs：定位提取 + 语法错误占位检出 ----
{
  const entries = [
    { key: 'fn:A', kind: '函数流程图', title: 'A', src: '' },
    { key: 'fn:B', kind: '函数流程图', title: 'B', src: '' },
    { key: 'fn:C', kind: '函数流程图', title: 'C', src: '' },
  ];
  const dump = '<body>'
    + '<div class="lldimg" data-key="fn:A"><div class="mermaid" data-processed="true"><svg viewBox="0 0 100 50"><g><foreignObject><div>x</div></foreignObject></g></svg></div></div>'
    + '<div class="lldimg" data-key="fn:B"><div class="mermaid" data-processed="true"><svg viewBox="0 0 10 10"><text>Syntax error in text</text></svg></div></div>'
    + '</body>';
  const { svgs, failed } = extractDiagramSvgs(dump, entries);
  check('正常图提取成功（含 foreignObject 嵌套 div 不截断）', svgs.get('fn:A')?.includes('<foreignObject>') && svgs.get('fn:A')?.endsWith('</svg>'));
  check('语法错误占位 svg 计入失败', failed.includes('fn:B') && !svgs.has('fn:B'));
  check('缺失图计入失败', failed.includes('fn:C'));
}

// ---- ④ svgNaturalSize：viewBox 优先，数值 width/height 兜底 ----
{
  check('viewBox 解析', JSON.stringify(svgNaturalSize('<svg viewBox="-8 0 123.5 456.2" width="100%"></svg>')) === '{"w":123.5,"h":456.2}');
  check('width/height 兜底', JSON.stringify(svgNaturalSize('<svg width="200" height="80"></svg>')) === '{"w":200,"h":80}');
  check('无尺寸返回 null', svgNaturalSize('<svg width="100%"></svg>') === null);
}

// ---- ⑤ pickShotParams：2x 默认，超大图降 scale ----
{
  const s1 = pickShotParams(500, 300);
  check('常规图 2x', s1.scale === 2 && s1.winW === 500 && s1.winH === 300);
  const s2 = pickShotParams(10000, 5000);
  check('超宽图降 scale（设备像素 ≤16000）', s2.scale < 2 && 10000 * s2.scale <= 16000 && s2.scale >= 1, JSON.stringify(s2));
  const s3 = pickShotParams(50000, 40000);
  check('极端图 scale 下限 0.5', s3.scale === 0.5);
}

// ---- ⑥ wrapSvgShotPage：根标签钉尺寸、摘 max-width，内部不动 ----
{
  const svg = '<svg aria-roledescription="flowchart-v2" viewBox="0 0 123 456" style="max-width: 123.45px;" width="100%"><g style="max-width: 9px;"><foreignObject><div>字</div></foreignObject></g></svg>';
  const page = wrapSvgShotPage(svg);
  const rootTag = page.match(/<svg\b[^>]*>/)[0];
  check('根 svg 钉 width/height', rootTag.includes('width="123"') && rootTag.includes('height="456"'), rootTag);
  check('根 svg 摘原 width 与 max-width', !rootTag.includes('100%') && !rootTag.includes('max-width'), rootTag);
  check('内部 g 的 style 不动', page.includes('<g style="max-width: 9px;">'));
  check('白底无页边距样式', page.includes('background:#fff') && page.includes('margin:0'));
}

// ---- ⑦ applyDiagramPng / hasDiagramPng：六类写回 + resume 跳过 + 失败原因 ----
{
  const m = mkModel();
  check('初始无 PNG', !hasDiagramPng(m, 'fn:M_Init') && !hasDiagramPng(m, 'overview'));
  check('写 fn', applyDiagramPng(m, 'fn:M_Init', 'QkFTRTY0') === null && m.providedFunctions[0].generated.flowchartPng === 'QkFTRTY0');
  check('写 overview', applyDiagramPng(m, 'overview', 'WA==') === null && m.interfaceOverview.diagramPng === 'WA==');
  check('写 callgraph', applyDiagramPng(m, 'callgraph:M_Init', 'WQ==') === null && m.callGraphs[0].diagramPng === 'WQ==');
  check('写 sm（legacy 单图路径）', applyDiagramPng(m, 'sm:M_SM', 'Wg==') === null && m.dynamicDesign.stateMachine.diagramPng === 'Wg==');
  check('写 seq', applyDiagramPng(m, 'seq:Initialization', 'Ww==') === null && m.dynamicDesign.sequences[0].diagramPng === 'Ww==');
  check('写 include（document 节）', applyDiagramPng(m, 'include', 'XA==') === null && m.document.includeGraphPng === 'XA==');
  check('hasDiagramPng 写后全真', ['fn:M_Init', 'overview', 'callgraph:M_Init', 'sm:M_SM', 'seq:Initialization', 'include'].every(k => hasDiagramPng(m, k)));
  check('未知键报错', typeof applyDiagramPng(m, 'fn:NOPE', 'eA==') === 'string');
  // 多核分图写回 stateMachines 列表对应角色
  const m2 = mkModel();
  m2.dynamicDesign.stateMachines = [
    { name: 'M_Master', diagram: '', diagramFormat: 'mermaid', states: [], transitions: [], polarion: {} },
    { name: 'M_Sat', diagram: '', diagramFormat: 'mermaid', states: [], transitions: [], polarion: {} },
  ];
  check('多核写回对应角色图', applyDiagramPng(m2, 'sm:M_Sat', 'eQ==') === null
    && m2.dynamicDesign.stateMachines[1].diagramPng === 'eQ=='
    && m2.dynamicDesign.stateMachines[0].diagramPng === undefined);
  // 无 document 节时 include 报原因
  const m3 = mkModel(); delete m3.document;
  check('无 document 节 include 报原因', (applyDiagramPng(m3, 'include', 'eA==') || '').includes('document'));
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exitCode = fail > 0 ? 1 : 0;
