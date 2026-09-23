// document 节物化测试：①三种缩写模式物化口径 ②缺口名单 ③评估表/总结插值 ④引导句
// ⑤model.document 在场时 report 忽略 opts 缩写 ⑥物化产物与 legacy 现算产物字节一致
const { buildDocumentContent } = require('./packages/core/dist/generator/staticDocument.js');
const { generateHtmlReport } = require('./packages/core/dist/report/htmlReport.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

function mkModel() {
  return {
    module: 'M', analyzedAt: '', files: [
      { path: 'M.c', role: 'source', includes: ['M.h', 'Rte.h'] },
      { path: 'M.h', role: 'header', includes: [] },
    ],
    providedFunctions: [{
      id: 'M::M_Init', name: 'M_Init', signature: 'void M_Init(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText: '{}', bodyHash: '', sigHash: '', complexity: 3, infiniteLoop: false,
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'M_Init', workItemId: null },
      generated: { detailedDescription: '初始化 MCU 并启动 OS，通过 SPI 配置 SBC。', llmModel: 'mock', generatedAt: '' },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [{
      name: 'M_CalloutX', signature: '', group: 'Callout', comment: null,
      calledFrom: ['M_Init'],
      polarion: { isWorkItem: true, chapter: '6.2', workItemKind: 'function', title: 'M_CalloutX', workItemId: null },
      generated: { detailedDescription: 'Callout 适配点。', llmModel: 'mock', generatedAt: '' },
    }],
    types: [],
    configMacros: [{
      name: 'M_SAFETY_ENABLE', value: '(STD_ON)', isFunctionLike: false, comment: 'safety', file: 'M_Cfg.h',
      kind: 'functional',
      usages: [{ kind: 'condCompile', file: 'M.c', line: 10, context: '#if (M_SAFETY_ENABLE == STD_ON)' }],
      affects: [],
      polarion: { isWorkItem: false, chapter: '6.2', workItemKind: 'config', title: 'M_SAFETY_ENABLE', workItemId: null },
    }],
  };
}

// ---- ① 合并模式（无外部表）：内置词典按出现过滤 ----
{
  const doc = buildDocumentContent(mkModel());
  const keys = doc.abbreviations.map(([k]) => k);
  check('合并模式按出现过滤（MCU/OS/SPI/SBC 命中，ADC 不收）',
    keys.includes('MCU') && keys.includes('OS') && keys.includes('SPI') && keys.includes('SBC') && !keys.includes('ADC'), keys.join(','));
  check('合并模式注释口径', doc.abbreviationNote.includes('仅列出本模块文档/代码中实际出现的缩写'));
  check('无缺口名单（非 replace）', doc.abbreviationGaps.length === 0);
  check('3.2 含 Callout 术语（文档出现 Callout）', doc.definitions.some(([n]) => n === 'Callout'));
  check('definitionNote 为空（无外部定义表）', doc.definitionNote === null);
}

// ---- ② JSON 合并模式：同名覆盖内置 + 新增补入（新增词条同样按出现过滤，与 legacy 一致） ----
{
  const doc = buildDocumentContent(mkModel(), {
    entries: [['SPI', '用户自定义 SPI 解释'], ['ZZNEW', '新词解释'], ['M', '模块缩写']], definitions: [], replace: false,
  });
  const map = new Map(doc.abbreviations);
  check('JSON 同名覆盖内置', map.get('SPI') === '用户自定义 SPI 解释');
  check('JSON 新增词条补入（文中出现的 M 收录）', map.get('M') === '模块缩写');
  check('JSON 新增词条按出现过滤（ZZNEW 文中未出现不收）', !map.has('ZZNEW'));
}

// ---- ③ replace 模式：全量收录 + 内置不兜底 + 缺口名单 ----
{
  const model = mkModel();
  model.providedFunctions[0].generated.detailedDescription = '初始化 ZZUNDEF 相关逻辑。';
  const doc = buildDocumentContent(model, {
    entries: [['SPI', '外部 SPI'], ['WDG', '外部看门狗']],
    definitions: [['master core', '主核定义']],
    replace: true, source: 'abbr.docx',
  });
  const keys = doc.abbreviations.map(([k]) => k);
  check('replace 全量收录（WDG 未出现也收）', keys.includes('SPI') && keys.includes('WDG'), keys.join(','));
  check('replace 内置不兜底（无 MCU/OS）', !keys.includes('MCU') && !keys.includes('OS'), keys.join(','));
  check('replace 注释含来源文件名', doc.abbreviationNote.includes('abbr.docx'));
  check('缺口名单含 ZZUNDEF（正文出现表内未定义）', doc.abbreviationGaps.includes('ZZUNDEF'), doc.abbreviationGaps.join(','));
  check('缺口名单不含 SPI（表内已定义）', !doc.abbreviationGaps.includes('SPI'));
  check('外部定义进 3.2 且在内置行之前', doc.definitions[0][0] === 'master core');
  check('definitionNote 含来源', doc.definitionNote?.includes('abbr.docx'));
}

// ---- ④ 评估表/总结/引导句插值 ----
{
  const doc = buildDocumentContent(mkModel());
  check('评估表 14 行', doc.evaluationRows.length === 14, String(doc.evaluationRows.length));
  check('评估行 1 插值接口数', doc.evaluationRows[0].fact.includes('提供 1 个接口函数'));
  check('评估行 6 命中条件编译宏', doc.evaluationRows[5].fact.includes('M_SAFETY_ENABLE'));
  check('总结 7 条且复杂度插值', doc.evaluationSummary.length === 7 && doc.evaluationSummary[2].includes('最大 3'));
  check('1 目的插值模块名', doc.purpose.includes('M 软件单元'));
  check('8 章支持文件 2 行', doc.supportFiles.length === 2 && doc.supportFiles[0][2] === 'G-B035-005');
  check('include 注含外部头文件名单（Rte.h）', doc.notes.include.includes('Rte.h'));
  check('5.2.2.2 Callout 注插值数量与章节号', doc.notes.externalFnsCallout.includes('（1 个）') && doc.notes.externalFnsCallout.includes('6.2.2 Callout function'));
  check('overview 引导句插值外部接口数（扣 Callout）', doc.notes.overview.includes('调用 0 个外部接口'));
}

// ---- ⑤ model.document 在场时 report 忽略 opts 缩写 ----
{
  const model = mkModel();
  model.document = buildDocumentContent(model);  // 合并模式物化
  const html = generateHtmlReport(model, {
    abbreviations: [['SPI', '不应生效的解释']], abbreviationsReplace: true, definitions: [],
  });
  check('document 在场 opts.replace 被忽略（SPI 仍是内置解释）',
    html.includes('Serial Peripheral Interface') && !html.includes('不应生效的解释'));
}

// ---- ⑥ 物化产物与 legacy 现算产物字节一致 ----
{
  const legacy = generateHtmlReport(mkModel(), {
    abbreviations: [['SPI', '外部 SPI']], abbreviationsReplace: true,
    abbreviationSource: 'abbr.docx', definitions: [['master core', '主核定义']],
  });
  const model = mkModel();
  model.document = buildDocumentContent(model, {
    entries: [['SPI', '外部 SPI']], definitions: [['master core', '主核定义']], replace: true, source: 'abbr.docx',
  });
  const materialized = generateHtmlReport(model);
  check('物化与 legacy 产物字节一致', materialized === legacy,
    `len ${materialized.length} vs ${legacy.length}`);
}

// ---- ⑦ 缺口回调：物化名单经 onAbbreviationGaps 上报 ----
{
  const model = mkModel();
  model.providedFunctions[0].generated.detailedDescription = '初始化 ZZUNDEF 相关逻辑。';
  model.document = buildDocumentContent(model, {
    entries: [['SPI', '外部 SPI']], definitions: [], replace: true, source: 'abbr.docx',
  });
  let reported = null;
  generateHtmlReport(model, { onAbbreviationGaps: l => { reported = l; } });
  check('物化缺口名单经回调上报', reported?.includes('ZZUNDEF'), JSON.stringify(reported));
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail ? 1 : 0;
