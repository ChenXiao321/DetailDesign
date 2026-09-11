// 外部缩写表测试：①docx 解析（两种表头形态）②report replace 模式（内置不兜底+缺口名单+JSON 覆盖补入）
const fs = require('fs');
const { parseAbbreviationsDocx } = require('./packages/core/dist/report/abbrDocx.js');
const { generateHtmlReport } = require('./packages/core/dist/report/htmlReport.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

// ---- ① docx 解析 ----
const entries = parseAbbreviationsDocx(fs.readFileSync('_test_fixture_abbr.docx'));
const map = new Map(entries.map(([k, v]) => [k, v]));
check('标准表头表解析 2 条', map.get('SPI')?.includes('外部定义版') && map.get('WDG')?.includes('外部定义版'), JSON.stringify(entries));
check('非标准表头表按首两列取值', map.get('YYYAUX')?.includes('首两列'), JSON.stringify(entries));
check('表头行不入条目', !map.has('缩写') && !map.has('补充表'));

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
{
  let gaps = null;
  const html = generateHtmlReport(mkModel(), {
    abbreviations: entries, abbreviationsReplace: true, abbreviationSource: '项目缩写表.docx',
    onAbbreviationGaps: g => { gaps = g; },
  });
  check('外部定义进 3.1', html.includes('Serial Peripheral Interface 串行外设接口（外部定义版）'));
  check('外部表来源注释', html.includes('项目缩写表.docx'));
  check('内置 DEM 不兜底（3.1 无 DEM 行）', !/<tr><td><code>DEM<\/code>/.test(html));
  check('缺口名单含 DEM+UNDEFMACRO', !!gaps && gaps.includes('DEM') && gaps.includes('UNDEFMACRO'), JSON.stringify(gaps));
  check('缺口名单不含 SPI/WDG', !!gaps && !gaps.includes('SPI') && !gaps.includes('WDG'), JSON.stringify(gaps));
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

// 合并模式（无外部表，现状回归）：内置 DEM 照常列出、不触发缺口回调
{
  let gaps = null;
  const html = generateHtmlReport(mkModel(), { onAbbreviationGaps: g => { gaps = g; } });
  check('合并模式内置 DEM 列出', /<tr><td><code>DEM<\/code>/.test(html));
  check('合并模式不触发缺口回调', gaps === null, JSON.stringify(gaps));
}

console.log(`---- ${pass} PASS ${fail} FAIL`);
process.exit(fail ? 1 : 0);
