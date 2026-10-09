// 外部缩写表测试：①docx 解析（缩写表两种表头形态 + 定义表分类与列序）②report replace 模式
// （全量收录+内置不兜底+缺口名单+JSON 覆盖补入+外部定义进 3.2）
const fs = require('fs');
const { parseAbbreviationsDocx } = require('../packages/core/dist/report/abbrDocx.js');
const { generateHtmlReport } = require('../packages/core/dist/report/htmlReport.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

// ---- ① docx 解析 ----
const doc = parseAbbreviationsDocx(fs.readFileSync(require('path').join(__dirname, '_test_fixture_abbr.docx')));
const entries = doc.abbreviations;
const map = new Map(entries.map(([k, v]) => [k, v]));
check('标准表头表解析 2 条', map.get('SPI')?.includes('外部定义版') && map.get('WDG')?.includes('外部定义版'), JSON.stringify(entries));
check('非标准表头表按首两列取值', map.get('YYYAUX')?.includes('首两列'), JSON.stringify(entries));
check('表头行不入条目', !map.has('缩写') && !map.has('补充表'));
// 定义表：表头「定义|描述」→ 入 definitions 且列序正确（旧版列序取反缺陷回归）
const defMap = new Map(doc.definitions.map(([k, v]) => [k, v]));
check('定义表解析 2 条', doc.definitions.length === 2, JSON.stringify(doc.definitions));
check('定义表列序正确（名称→描述）', defMap.get('master core')?.includes('core0') && defMap.get('satellite core')?.includes('配合'), JSON.stringify(doc.definitions));
check('定义表条目不混入缩写表', !map.has('master core') && !map.has('satellite core'), JSON.stringify(entries));
check('定义表表头行不入条目', !defMap.has('定义'));

// ---- ② report replace 模式 ----
function mkModel() {
  return {
    module: 'M', analyzedAt: '', files: [],
    providedFunctions: [{
      id: 'M::M_Init', name: 'M_Init', signature: 'void M_Init(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText: '', bodyHash: '', sigHash: '',
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'M_Init', workItemId: null },
      generated: { detailedDescription: '本函数通过 SPI 读取 WDG 状态，并上报 DEM 错误；UNDEFMACRO 未定义词。' },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], types: [], configMacros: [], interfaceOverview: null, callGraphs: [],
    dynamicDesign: null,
  };
}

// replace 模式：外部表有 SPI/WDG → 用外部定义；DEM 内置词典有但外部表没有 → 不列且进缺口；UNDEFMACRO 进缺口
// 全量收录：XXXPROJ/YYYAUX 正文未出现也应列出；外部定义全量进 3.2
{
  let gaps = null;
  const html = generateHtmlReport(mkModel(), {
    abbreviations: entries, abbreviationsReplace: true, abbreviationSource: '项目缩写表.docx',
    definitions: doc.definitions,
    onAbbreviationGaps: g => { gaps = g; },
  });
  check('外部定义进 3.1', html.includes('Serial Peripheral Interface 串行外设接口（外部定义版）'));
  check('外部表来源注释', html.includes('项目缩写表.docx'));
  check('全量收录注释（不再写仅列实际出现）', html.includes('全量收录') && !html.includes('仅列本模块实际出现'));
  check('内置 DEM 不兜底（3.1 无 DEM 行）', !/<tr><td><code>DEM<\/code>/.test(html));
  check('正文未出现条目也列出（XXXPROJ/YYYAUX）',
    /<tr><td><code>XXXPROJ<\/code>/.test(html) && /<tr><td><code>YYYAUX<\/code>/.test(html));
  check('缺口名单含 DEM+UNDEFMACRO', !!gaps && gaps.includes('DEM') && gaps.includes('UNDEFMACRO'), JSON.stringify(gaps));
  check('缺口名单不含 SPI/WDG', !!gaps && !gaps.includes('SPI') && !gaps.includes('WDG'), JSON.stringify(gaps));
  // 3.2 定义：外部定义全量列入且在内置通用行之前
  const iMaster = html.indexOf('<td>master core</td>');
  const iReentry = html.indexOf('<td>可重入性</td>');
  check('外部定义进 3.2', iMaster > 0 && html.includes('<td>satellite core</td>'));
  check('外部定义排在内置通用行之前', iMaster > 0 && iReentry > 0 && iMaster < iReentry);
  check('3.2 外部来源注释', html.includes('「定义」节提供'));
}

// JSON 同名覆盖+新增补入（resolveAbbreviations 合并后的 entries 形态）
{
  const merged = [['SPI', 'JSON 覆盖版'], ...entries.filter(([k]) => k !== 'SPI'), ['JSONNEW', 'JSON 新增词']];
  let gaps = null;
  const model = mkModel();
  model.providedFunctions[0].generated.detailedDescription += ' JSONNEW 出现。';
  const html = generateHtmlReport(model, {
    abbreviations: merged, abbreviationsReplace: true, abbreviationSource: 'x.docx',
    onAbbreviationGaps: g => { gaps = g; },
  });
  check('JSON 同名覆盖外部定义',
    /<tr><td><code>SPI<\/code><\/td><td>JSON 覆盖版<\/td><\/tr>/.test(html)
    && !/<code>SPI<\/code><\/td><td>Serial Peripheral/.test(html));
  check('JSON 新增条目进 3.1', html.includes('JSON 新增词'));
  check('JSON 新增不进缺口', !!gaps && !gaps.includes('JSONNEW'), JSON.stringify(gaps));
}

// 合并模式（无外部表，现状回归）：内置 DEM 照常列出、不触发缺口回调、3.2 无外部定义注释
{
  let gaps = null;
  const html = generateHtmlReport(mkModel(), { onAbbreviationGaps: g => { gaps = g; } });
  check('合并模式内置 DEM 列出', /<tr><td><code>DEM<\/code>/.test(html));
  check('合并模式不触发缺口回调', gaps === null, JSON.stringify(gaps));
  check('合并模式 3.2 无外部来源注释', !html.includes('「定义」节提供'));
}

console.log(`---- ${pass} PASS ${fail} FAIL`);
process.exit(fail ? 1 : 0);
