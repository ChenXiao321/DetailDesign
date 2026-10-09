// 条件编译虚线框断言网测试：直喂 flowchartProblems(fn, 图文本)
// （流程图已改静态生成，原 fake provider 路径退役；断言网逻辑不变，单独守回归）
// 场景：①正常虚线框 通过 / ②整图漏框 拦下 / ③#if 误画菱形 拦下 / ④运行时豁免 通过 / ⑤缩写注释 通过
const { flowchartProblems } = require('../packages/core/dist/generator/designGenerator.js');

const BASE = [
  'flowchart TD',
  '    A(["开始"]) --> B["处理步骤"]',
  '    B --> C{"判断条件"}',
  '    C -- 是 --> D["分支处理"]',
  '    C -- 否 --> E(["结束"])',
  '    D --> E',
];
const BOX = (macro) => [
  '    subgraph SG1[" "]',
  `        SG1_NOTE["注：仅在 ${macro} 生效时参与编译"]`,
  '        SG1_NOTE ~~~ B',
  '    end',
  '    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4',
];

const mkFn = (overrides) => ({
  id: 'M::F', name: 'F', signature: 'void F(void)', returnType: 'void', parameters: [],
  isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
  calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
  bodyText: 'void F(void){}', bodyHash: '', sigHash: '',
  polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'F', workItemId: null },
  ...overrides,
});

let pass = 0, fail = 0;
function run(name, fnOverrides, chart, expectKeyword /* null=应通过 */) {
  const problems = flowchartProblems(mkFn(fnOverrides), chart);
  if (!expectKeyword) {
    if (problems.length === 0) { console.log(`PASS ${name}`); pass++; return; }
    console.log(`FAIL ${name}：应通过却被拦`, problems); fail++; return;
  }
  if (problems.some(p => p.includes(expectKeyword))) {
    console.log(`PASS ${name}（拦下，含「${expectKeyword}」）`); pass++; return;
  }
  console.log(`FAIL ${name}：应拦下含「${expectKeyword}」`, problems); fail++;
}

// ① 正常虚线框 → 通过
run('正常虚线框',
  { conditionalFlags: ['GP_TEST_ENABLE'] },
  [...BASE, ...BOX('GP_TEST_ENABLE')].join('\n'), null);
// ② 整图漏框 → 拦下
run('整图漏框',
  { conditionalFlags: ['GP_TEST_ENABLE'] },
  BASE.join('\n'), '缺少条件编译虚线框');
// ③ #if 误画菱形（源码仅 #if）→ 拦下（菱形禁入；缺注释框也一并报）
run('#if误画菱形',
  { innerCondFlags: ['GP_TEST_ACTION'], bodyTextWithPP: 'void F(void){\n#if (GP_TEST_ACTION == STD_ON)\n  x = 1;\n#endif\n}' },
  [...BASE, '    C --> G{"GP_TEST_ACTION == STD_ON ?"}', '    G -- 是 --> E'].join('\n'), '编译期条件');
// ④ 运行时豁免：源码 for 循环用到宏 + 图里菱形是循环条件 + 注释框也有 → 通过
run('运行时豁免',
  { innerCondFlags: ['GP_TEST_NUM'], bodyTextWithPP: 'void F(void){\n#if (GP_TEST_NUM > 1U)\n#endif\n  for (i = 0; i < GP_TEST_NUM; i++) { x = i; }\n}' },
  [...BASE, '    C --> G{"i < GP_TEST_NUM ?"}', '    G -- 是 --> D', ...BOX('GP_TEST_NUM')].join('\n'), null);
// ⑤ 缩写注释（基线风格：GP_TEST_SAFETY_ENABLE 注成 SAFETY_ENABLE）→ 通过
run('缩写注释通过',
  { conditionalFlags: ['GP_TEST_SAFETY_ENABLE'] },
  [...BASE,
    '    subgraph SG1[" "]',
    '        SG1_NOTE["注：本函数仅在 SAFETY_ENABLE 时参与编译"]',
    '        SG1_NOTE ~~~ B',
    '    end',
    '    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4',
  ].join('\n'), null);

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exitCode = fail ? 1 : 0;
