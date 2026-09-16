// _test_cfggen.js — 确定性 CFG 流程图生成器 fixture 测试
// 模式照 _test_fclint.js：CommonJS require dist/（改 src 后先 npm run build -w packages/core）
// 每条 fixture 必查：lint 双项全绿；再按 fixture 定制结构断言。
const { parseCFile, preprocessSource } = require('./packages/core/dist/parser/cParser.js');
const { buildFnCfg, collapseCfg } = require('./packages/core/dist/analyzer/cfgBuilder.js');
const { emitMermaid } = require('./packages/core/dist/analyzer/flowchartEmitter.js');
const { lintMermaidSource, lintFlowchartStructure } = require('./packages/core/dist/report/mermaidPre.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push(`${name}: ${detail}`); }
}

/** 解析 src 中名为 fnName 的函数，构建 CFG + 发射 mermaid */
async function gen(src, fnName, opts = {}) {
  const pre = preprocessSource(src);
  const f = await parseCFile(pre.clean);
  let fnNode = null;
  (function walk(n) {
    if (n.type === 'function_definition') {
      const d = n.childForFieldName('declarator');
      if (d && pre.clean.slice(d.startIndex, d.endIndex).includes(fnName)) fnNode = n;
    }
    for (const c of n.namedChildren) walk(c);
  })(f.tree.rootNode);
  if (!fnNode) throw new Error('函数未找到: ' + fnName);
  const body = fnNode.childForFieldName('body');
  let cfg = buildFnCfg(body, pre.clean, {
    condRegions: pre.condRegions, originalLines: pre.originalLines,
    fnRowFrom: fnNode.startPosition.row, fnRowTo: fnNode.endPosition.row,
  });
  if (opts.collapse) cfg = collapseCfg(cfg, opts.collapse);
  const { mmd } = emitMermaid(cfg, { outerMacros: opts.outerMacros ?? [] });
  const problems = [...lintMermaidSource(mmd), ...lintFlowchartStructure(mmd)];
  return { mmd, cfg, problems };
}

const count = (s, re) => (s.match(re) ?? []).length;

(async () => {
  // ============ 第 1 组：基础控制流 ============

  // 1. 顺序语句合并 + call 双边矩形
  {
    const { mmd, problems } = await gen(`
void F(void) {
  unsigned int i;
  i = 0U;
  Bar_Init();
  i += 2U;
}`, 'F');
    check('顺序:lint', problems.length === 0, problems.join('|'));
    check('顺序:合并', /N0\["unsigned int i<br>i = 0U<br>Bar_Init\(\)<br>i \+= 2U"\]/.test(mmd), mmd);
    check('顺序:START出边', /START --> N0/.test(mmd), mmd);
    check('顺序:END', /N0 --> END/.test(mmd), mmd);
  }

  // 2. 纯调用语句 → 双边矩形
  {
    const { mmd, problems } = await gen(`
void F(void) {
  Bar_Init();
}`, 'F');
    check('call:lint', problems.length === 0, problems.join('|'));
    check('call:双边矩形', /\[\["Bar_Init\(\)"\]\]/.test(mmd), mmd);
  }

  // 3. if/else if/else 链
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  if (a == 1U) { One(); }
  else if (a == 2U) { Two(); }
  else { Three(); }
  Done();
}`, 'F');
    check('if链:lint', problems.length === 0, problems.join('|'));
    check('if链:菱形数', count(mmd, /\{"/g) === 2, mmd);
    check('if链:else if挂否支', /D0 -- 否 --> D1/.test(mmd), mmd);
    check('if链:汇合点', /M\d+\[" "\]/.test(mmd) && /是/.test(mmd) && /否/.test(mmd), mmd);
  }

  // 4. if 无 else（空否支直挂汇合）
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  if (a == 1U) { One(); }
  Done();
}`, 'F');
    check('if无else:lint', problems.length === 0, problems.join('|'));
    check('if无else:否边出自菱形', /D0 -- 否 -->/.test(mmd), mmd);
    // 是/否不得同目标（lint ④ 已由全绿保证，再显式查）
    const yes = mmd.match(/D0 -- 是 --> (\w+)/);
    const no = mmd.match(/D0 -- 否 --> (\w+)/);
    check('if无else:是否不同目标', yes && no && yes[1] !== no[1], mmd);
  }

  // 5. 空 then（if (a); 退化）与空 then 带 else
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  if (a == 1U) { One(); } else { }
  Done();
}`, 'F');
    check('空else:lint', problems.length === 0, problems.join('|'));
    const yes = mmd.match(/D0 -- 是 --> (\w+)/);
    const no = mmd.match(/D0 -- 否 --> (\w+)/);
    check('空else:是否不同目标', yes && no && yes[1] !== no[1], mmd);
  }

  // 6. 嵌套 if
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  if (a > 1U) {
    if (a > 2U) { Two(); }
  }
  Done();
}`, 'F');
    check('嵌套if:lint', problems.length === 0, problems.join('|'));
    check('嵌套if:菱形数', count(mmd, /\{"/g) === 2, mmd);
  }

  // 7. while 循环（回边 + break/continue）
  {
    const { mmd, problems } = await gen(`
void F(unsigned int i) {
  while (i < 10U) {
    i++;
    if (i == 5U) { continue; }
    if (i == 8U) { break; }
  }
  Done();
}`, 'F');
    check('while:lint', problems.length === 0, problems.join('|'));
    check('while:continue回条件', /N\d+\["continue"\]/.test(mmd) && /\["continue"\]\n(.*\n)*?.*--> D0/.test(mmd), mmd);
    check('while:break出循环', /\["break"\]/.test(mmd), mmd);
  }

  // 8. 空体 while = 自旋回环（_J 契约）
  {
    const { mmd, problems } = await gen(`
void F(void) {
  Wait();
  while (g_x != 0U) { }
  Done();
}`, 'F');
    check('自旋:lint', problems.length === 0, problems.join('|'));
    const jId = (mmd.match(/(D\d+)_J\[" "\]/) ?? [])[1];
    check('自旋:J节点id', !!jId, mmd);
    check('自旋:PRE-->J', new RegExp(`--> ${jId}_J`).test(mmd), mmd);
    check('自旋:J-->W', new RegExp(`${jId}_J --> ${jId}`).test(mmd), mmd);
    check('自旋:W---J无箭头', new RegExp(`${jId} --- ${jId}_J`).test(mmd), mmd);
    check('自旋:否支退出', new RegExp(`${jId} -- 否 -->`).test(mmd), mmd);
  }

  // 9. do-while（回边）
  {
    const { mmd, problems } = await gen(`
void F(unsigned int i) {
  do { i--; } while (i > 0U);
  Done();
}`, 'F');
    check('dowhile:lint', problems.length === 0, problems.join('|'));
    check('dowhile:是支回体', /D0 -- 是 --> N0/.test(mmd), mmd);
    check('dowhile:体出边入条件', /N0 --> D0/.test(mmd), mmd);
  }

  // 10. for 全件（init/cond/update）
  {
    const { mmd, problems } = await gen(`
void F(void) {
  unsigned int i;
  for (i = 0U; i < 3U; i++) {
    Baz(i);
  }
  Done();
}`, 'F');
    check('for:lint', problems.length === 0, problems.join('|'));
    check('for:init节点', /\["i = 0U"\]/.test(mmd), mmd);
    check('for:update回边', /\["i\+\+"\]\n(.*\n)*?.*--> D0/.test(mmd), mmd);
    check('for:否支退出', /D0 -- 否 -->/.test(mmd), mmd);
  }

  // 11. for(;;)+break（无否支，唯一出口 break）
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  for (;;) {
    if (a > 0U) { break; }
  }
  Done();
}`, 'F');
    check('for死循环:lint', problems.length === 0, problems.join('|'));
    check('for死循环:菱形label', /\{"for \(；；\)"\}/.test(mmd), mmd);
    check('for死循环:break出口', /\["break"\]/.test(mmd), mmd);
  }

  // ============ 第 2 组：switch/跳转/多返回 ============

  // 12. 嵌套循环 break/continue 归属
  {
    const { mmd, problems } = await gen(`
void F(void) {
  unsigned int i = 0U;
  while (i < 10U) {
    unsigned int j = 0U;
    while (j < 5U) {
      j++;
      if (j == 2U) { continue; }
      if (j == 4U) { break; }
    }
    i++;
    if (i == 9U) { break; }
  }
  Done();
}`, 'F');
    check('嵌套循环:lint', problems.length === 0, problems.join('|'));
    // 内层 continue 回内层条件 D1，内层 break 出内层；外层 break 出外层
    check('嵌套循环:continue回内层', /N\d+\["continue"\]/.test(mmd), mmd);
  }

  // 13. switch fallthrough + default
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  switch (a) {
    case 1U:
      One();
      break;
    case 2U:
    case 3U:
      Three();
    default:
      Def();
  }
  Done();
}`, 'F');
    check('switch:lint', problems.length === 0, problems.join('|'));
    check('switch:case标签', /-- case 1U -->/.test(mmd) && /-- case 2U -->/.test(mmd) && /-- default -->/.test(mmd), mmd);
    check('switch:case2空落case3同目标', (() => {
      const c2 = mmd.match(/-- case 2U --> (\w+)/);
      const c3 = mmd.match(/-- case 3U --> (\w+)/);
      return c2 && c3 && c2[1] === c3[1];
    })(), mmd);
    check('switch:无其他支', !/-- 其他 -->/.test(mmd), mmd);
  }

  // 14. switch 无 default（补其他支）
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  switch (a) {
    case 1U:
      One();
      break;
  }
  Done();
}`, 'F');
    check('switch无default:lint', problems.length === 0, problems.join('|'));
    check('switch无default:其他支', /-- 其他 -->/.test(mmd), mmd);
  }

  // 15. 多 return 汇唯一 END
  {
    const { mmd, problems } = await gen(`
unsigned char F(unsigned char a) {
  if (a == 1U) { return 1U; }
  if (a == 2U) { return 2U; }
  return 0U;
}`, 'F');
    check('多return:lint', problems.length === 0, problems.join('|'));
    check('多return:END唯一', count(mmd, /\(\["结束"\]\)/g) === 1, mmd);
    check('多return:return节点数', count(mmd, /\["return/g) === 3, mmd);
    check('多return:均入END', count(mmd, /--> END/g) === 3, mmd);
  }

  // 16. 循环内早退 return → END
  {
    const { mmd, problems } = await gen(`
unsigned char F(unsigned int i) {
  while (i < 10U) {
    if (i == 5U) { return 5U; }
    i++;
  }
  return 0U;
}`, 'F');
    check('循环早退:lint', problems.length === 0, problems.join('|'));
    check('循环早退:return入END', /\["return 5U"\]\n(.*\n)*?.*--> END/.test(mmd), mmd);
  }

  // 17. goto + label（前跳）
  {
    const { mmd, problems, cfg } = await gen(`
void F(unsigned char a) {
  if (a > 7U) { return; }
  goto done;
done:
  Cleanup();
  return;
}`, 'F');
    check('goto:lint', problems.length === 0, problems.join('|'));
    check('goto:无警告', cfg.warnings.length === 0, cfg.warnings.join('|'));
    const g = mmd.match(/(N\d+)\["goto done"\]/);
    const c = mmd.match(/(N\d+)\[\["Cleanup\(\)"\]\]/);
    check('goto:连线到标签', !!(g && c && mmd.includes(`${g[1]} --> ${c[1]}`)), mmd);
  }

  // ============ 第 3 组：条件编译 / 清洗 / 降级 ============

  // 18. 体内 #if 包语句 → 虚线框 + 注释节点
  {
    const { mmd, problems } = await gen(`
void F(void) {
  Before();
#if(GP_X_SAFETY_ENABLE == STD_ON)
  Safe_1();
  Safe_2();
#endif
  After();
}`, 'F');
    check('#if:lint', problems.length === 0, problems.join('|'));
    check('#if:虚线框', /subgraph SG\d+_\d+\[" "\]/.test(mmd), mmd);
    check('#if:注释含宏名', /_NOTE\["注：仅在 GP_X_SAFETY_ENABLE 生效时参与编译"\]/.test(mmd), mmd);
    check('#if:dasharray样式', /stroke-dasharray:6 4/.test(mmd), mmd);
    check('#if:钉位', /_NOTE ~~~ /.test(mmd), mmd);
    check('#if:框内节点', /subgraph SG0_0\[" "\]\n(?:.*\n)*?.*Safe_1/.test(mmd), mmd);
  }

  // 19. #if/#elif/#else 三路并列
  {
    const { mmd, problems } = await gen(`
void F(void) {
#if(GP_X_MODE == 1U)
  Mode1();
#elif(GP_X_MODE == 2U)
  Mode2();
#else
  ModeX();
#endif
  After();
}`, 'F');
    check('#if三路:lint', problems.length === 0, problems.join('|'));
    check('#if三路:三个虚线框', count(mmd, /subgraph SG0_\d\[" "\]/g) === 3, mmd);
    check('#if三路:elif注释', /的 #elif 分支生效时参与编译/.test(mmd), mmd);
    check('#if三路:else注释', /未生效（#else 分支）时参与编译/.test(mmd), mmd);
  }

  // 20. 嵌套 #if（内层框嵌在外层框内）
  {
    const { mmd, problems } = await gen(`
void F(void) {
#if(GP_X_OUTER == STD_ON)
  Outer_1();
#if(GP_X_INNER == STD_ON)
  Inner_1();
#endif
#endif
  After();
}`, 'F');
    check('嵌套#if:lint', problems.length === 0, problems.join('|'));
    check('嵌套#if:两宏注释', /GP_X_OUTER 生效/.test(mmd) && /GP_X_INNER 生效/.test(mmd), mmd);
    // 内层 SG 声明在外层 SG 的 end 之前
    const outerOpen = mmd.indexOf('subgraph SG0_0');
    const innerOpen = mmd.indexOf('subgraph SG1_0');
    const outerClose = mmd.indexOf('\n    end', outerOpen);
    check('嵌套#if:内层在外层内', outerOpen !== -1 && innerOpen > outerOpen && innerOpen < outerClose, mmd);
  }

  // 21. 外层宏包全函数（outerMacros）
  {
    const { mmd, problems } = await gen(`
void F(void) {
  Body();
}`, 'F', { outerMacros: ['GP_X_WHOLE'] });
    check('外层宏:lint', problems.length === 0, problems.join('|'));
    check('外层宏:SG_OUT', /subgraph SG_OUT\[" "\]/.test(mmd), mmd);
    check('外层宏:注释钉START', /SG_OUT_NOTE ~~~ START/.test(mmd), mmd);
  }

  // 22. 标签清洗：< > & " : ;
  {
    const { mmd, problems } = await gen(`
void F(unsigned char a) {
  unsigned int x;
  if (a < 3U && a > 1U) {
    x = (unsigned int)(a < 2U ? 1U : 0U);
    Str_Copy("a;b:c");
  }
  Done();
}`, 'F');
    check('清洗:lint', problems.length === 0, problems.join('|'));
    check('清洗:小于转义', /&lt;/.test(mmd) && !/a < 3U/.test(mmd), mmd);
    check('清洗:引号替换', !/\\"a;b:c\\"/.test(mmd) && !mmd.includes('"a;b:c"'), mmd);
    check('清洗:分号全角', mmd.includes('a；b'), mmd);
    check('清洗:行内无半角冒号残留于标签', !/\["[^"]*?[\?] [^"]*:"/.test(mmd), mmd);
  }

  // 23. 不可达代码剔除（return 之后）
  {
    const { mmd, problems, cfg } = await gen(`
unsigned char F(unsigned char a) {
  if (a > 0U) { return 1U; }
  return 0U;
  Dead_1();
  Dead_2();
}`, 'F');
    check('不可达:lint', problems.length === 0, problems.join('|'));
    check('不可达:已剔除', !mmd.includes('Dead_'), mmd);
    check('不可达:有警告', cfg.warnings.some(w => w.includes('不可达')), cfg.warnings.join('|'));
  }

  // 24. 大函数坍缩（>60 节点 → ≤62，骨架菱形保留）
  // 嵌套结构：外层 if 含两个内层 if（各 3 语句体）。坍缩先吃最小的内层整 if 组，
  // 外层菱形骨架保留。（平铺 if 的分支体 run 合并后只 1 节点，无组可坍缩，测不到骨架保留）
  {
    let body = '';
    for (let i = 0; i < 10; i++) {
      body += `  if (a == ${i}U) {\n`;
      body += `    if (b == 0U) {\n      S${i}_1();\n      S${i}_2();\n      S${i}_3();\n    }\n`;
      body += `    if (b == 1U) {\n      T${i}_1();\n      T${i}_2();\n      T${i}_3();\n    }\n`;
      body += `  }\n`;
    }
    const { mmd, problems, cfg } = await gen(`
void F(unsigned char a, unsigned char b) {
${body}  Done();
}`, 'F', { collapse: 60 });
    check('坍缩:lint', problems.length === 0, problems.join('|'));
    const nodeCount = count(mmd, /^\s+\w+(?:\[\["|\["|\{"|\(\[")/gm);
    check('坍缩:节点数≤62', nodeCount <= 62, `节点数=${nodeCount}`);
    check('坍缩:骨架菱形保留', count(mmd, /\{"/g) >= 5, `菱形数=${count(mmd, /\{"/g)}`);
    check('坍缩:有聚合块', mmd.includes('…（共'), mmd.slice(0, 400));
  }

  // 25. L1 降级：未识别构造（asm）不断链
  {
    const { mmd, problems, cfg } = await gen(`
void F(void) {
  Before();
  __asm volatile("nop");
  After();
}`, 'F');
    check('L1:lint', problems.length === 0, problems.join('|'));
    check('L1:链不断', /Before/.test(mmd) && /After/.test(mmd), mmd);
  }

  // 26. 多行调用独占节点（run 物理行上限防标签截断吞语句）
  {
    const { mmd, problems } = await gen(`
void F(void) {
  Before();
  Get_Info(
    &a,
    &b,
    &c,
    &d
  );
  After();
}`, 'F');
    check('多行调用:lint', problems.length === 0, problems.join('|'));
    check('多行调用:After未被吞', /After/.test(mmd), mmd);
    check('多行调用:调用为双边矩形', /\[\["Get_Info\(/.test(mmd), mmd);
    check('多行调用:无截断', !mmd.includes('…（共'), mmd);
  }

  // 27. #if 只包花括号（夹断块结构）→ 空框抑制 + 警告
  {
    const { mmd, problems, cfg } = await gen(`
void F(unsigned char a) {
  if (a == 1U) {
    One();
#if(GP_X_ACTION == STD_ON)
  }
#endif
  else {
    Two();
  }
  Done();
}`, 'F');
    check('空框抑制:lint', problems.length === 0, problems.join('|'));
    check('空框抑制:无空框', !/subgraph SG/.test(mmd), mmd);
    check('空框抑制:有警告', cfg.warnings.some(w => w.includes('虚线框已省略')), cfg.warnings.join('|'));
    check('空框抑制:流程完整', /One/.test(mmd) && /Two/.test(mmd) && /Done/.test(mmd), mmd);
  }

  console.log(`\n通过 ${pass} / ${pass + fail}`);
  if (failures.length) {
    console.log('失败明细:');
    for (const f of failures) console.log('  ✗ ' + f);
  }
  // 不用 process.exit(1)：web-tree-sitter 的 wasm 拆卸期立即退出会触发 UV_HANDLE_CLOSING 断言
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
