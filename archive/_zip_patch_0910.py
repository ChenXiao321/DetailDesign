# -*- coding: utf-8 -*-
# 迁移包补丁-20260910-管线质量闭环.zip：本次四件套改动的文件（src+dist 双副本），快速覆盖内网。
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

OUT = '迁移包补丁-20260910-管线质量闭环.zip'

core_files = [
    'src/llm/prompts.ts', 'dist/llm/prompts.js', 'dist/llm/prompts.js.map',
    'src/llm/provider.ts', 'dist/llm/provider.js', 'dist/llm/provider.js.map',
    'src/report/mermaidPre.ts', 'dist/report/mermaidPre.js', 'dist/report/mermaidPre.d.ts', 'dist/report/mermaidPre.js.map',
    'src/report/htmlReport.ts', 'dist/report/htmlReport.js', 'dist/report/htmlReport.d.ts', 'dist/report/htmlReport.js.map',
    'src/report/renderScript.ts', 'dist/report/renderScript.js', 'dist/report/renderScript.js.map',
    'src/report/abbrDocx.ts', 'dist/report/abbrDocx.js', 'dist/report/abbrDocx.d.ts', 'dist/report/abbrDocx.js.map',
    'src/index.ts', 'dist/index.js', 'dist/index.js.map',
    'src/generator/designGenerator.ts', 'dist/generator/designGenerator.js', 'dist/generator/designGenerator.js.map',
]
cli_files = [
    'src/index.ts', 'dist/index.js', 'dist/index.js.map',
    'src/audit.ts', 'dist/audit.js', 'dist/audit.d.ts', 'dist/audit.js.map',
    'src/config.ts', 'dist/config.js', 'dist/config.d.ts', 'dist/config.js.map',
    'src/polarion/renderFigures.ts', 'dist/polarion/renderFigures.js', 'dist/polarion/renderFigures.js.map',
]
entries = []
for f in core_files:
    entries.append(f'packages/core/{f}')
    entries.append(f'node_modules/@lld/core/{f}')
for f in cli_files:
    entries.append(f'packages/cli/{f}')
    entries.append(f'node_modules/@lld/cli/{f}')
entries += ['README.md', '部署说明.txt', 'lld.config.example.json']

missing = [e for e in entries if not os.path.isfile(e)]
if missing:
    print('!! 缺失文件:')
    for m in missing: print('  ', m)
    sys.exit(1)

note = ('覆盖说明.txt', (
    '迁移包补丁-20260910-管线质量闭环\n'
    '==============================\n'
    '覆盖内容（在 09-09 迁移包基础上直接解压覆盖即可）：\n'
    '1. gen 期序列图组合片段硬校验：函数源码含 if/for/while/switch 但序列图全图无组合片段时，\n'
    '   自动带中文问题清单重试（最多 3 次），持续平铺才计入 failures。平铺片段配平/else 缺 alt 同拦。\n'
    '2. 流程图 prompt 新增规则 13（手工排错口诀）：声明顺序即布局顺序——主链连续声明、\n'
    '   结束节点早退边提前引用、错误支逆深度序+回边集中最后、删 break 中转节点、允许翻转判断极性。\n'
    '3. 新命令 audit：Edge 预渲染（产出 SVG 成品版 lld_report.html）+ 斜线计数 + 交叉/穿盒/越界/\n'
    '   深入目标盒/贴缘审计 + 箭头朝向审计，打印中文量化验收报告。用法：\n'
    '     node packages/cli/dist/index.js audit <模块目录> --out <产物目录>\n'
    '4. 缩写表配置化：lld.config.json 可加 "abbreviations" 节覆盖/扩充 3.1 缩写表。\n'
    '5. report 对存量平铺序列图打印「疑似平铺（需重生成 dynamic）」警告。\n'
    '6. 无头浏览器支持 Chrome：audit/polarion export 自动探测 Edge→Chrome，\n'
    '   或设环境变量 LLD_EDGE_PATH=<chrome.exe 完整路径>。\n'
    '7. 渲染层扇出端口交换修复：菱形/汇合点两出（入）边被 dagre 布反（左出口连右目标、\n'
    '   右出口连左目标）导致两横段同高度对向重叠时，自动交换端口重路由消除（内网 v3 实测\n'
    '   两处 78px 级「是/否路线交叉」即此缺陷，已修）。只碰检出对向重叠的边对，其余逐像素不动。\n'
    '   附带修复 renderScript 登记表 srcId/dstId 因模板字面量正则单反斜杠被吞恒为 null 的隐患。\n'
    '8. audit 新增「共线对向重叠」审计（xcheck 严格交叉抓不到的形态），端口布反类真交叉\n'
    '   现在内网 audit 一次即可检出；同向汇合重叠属正常形态不报。\n'
    '9. gen 期条件编译虚线框存在性硬校验：函数被外层宏包裹或体内有 #if 段时，图源必须\n'
    '   出现对应宏名（虚线框注释节点），漏画框自动带中文问题清单重试（最多 3 次）。\n'
    '   内网 v3 Startup 整图漏画 SAFETY_ENABLE 框即此缺陷，此后 gen 期即拦。\n'
    '10. 编译期宏禁入菱形硬校验：宏在源码中仅出现于 #if/#elif（无运行时 if/for/while 使用）\n'
    '    时，图源菱形标签出现该宏即判「把编译期条件误画成运行时分支」，回喂重试。\n'
    '    prompt 规则 6 同步补强（#if/#elif 多路画并列虚线框，不得画菱形加是/否）。\n'
    '    注释节点接受两段式前缀缩写（GP_X_SAFETY_ENABLE→SAFETY_ENABLE，基线既有风格不误拦）。\n'
    '    存量核查：基线三模块全过；内网 TLF 的 MainFunction/SetPorstMode 菱形误画与\n'
    '    FwdBist/WwdBist/Errpin_Bist 缺外层宏框为真缺陷，建议 gen --only 重生成这些函数。\n'
    '11. 序列图 Callout 不得建参与者：Callout 是本模块的接口函数（参与者只建模块粒度），\n'
    '    prompt 规则 2 改写 + validateSequence 硬校验（声明式 participant X as Callout 与\n'
    '    隐式消息端点 Callout 均拦，消息文本里的 CalloutXxx 自调用不误判），MockProvider 同步。\n'
    '    存量序列图含 Callout 参与者的（EcuStp 各版 4 张、IoM 内网 3 张等）随 gen --only dynamic\n'
    '    --resume 重生成时自动消除。\n'
    '12. 缩写表外部提供（两种方式）：①lld.config.json 加 "abbreviationsDoc": "项目缩写表.docx"\n'
    '    ——外部人员给的 Word 缩写表（两列表格：缩写|定义，表头自动识别，多表合并，零依赖解析），\n'
    '    3.1 整章以外部表为唯一定义来源（内置 29 条词典不兜底）；report/audit 会打印\n'
    '    「正文出现但外部表未定义」的缺口名单，反馈维护方补 docx 即可（状态机状态名已排除噪声）。\n'
    '    ②JSON abbreviations 节照旧——外部表模式下同名覆盖 docx、新增补入（临时补表通道）；\n'
    '    不配 docx 时维持原合并行为。docx 读取失败回退合并模式并告警。\n'
    '13. 外部定义注入 gen：函数描述/配置说明/类型注释/外部接口说明/5.1 功能描述的 prompt\n'
    '    附带「项目术语表」块（按 prompt 内实际出现过滤，Spi_Setup 这类标识符分段也算\n'
    '    SPI 出现），生成正文术语口径与外部定义一致；流程图/序列图等结构生成不注入。\n'
    '    不配缩写时 prompt 逐字节不变（零回归）。\n'
    '\n内网验证步骤（按序，前两步不调 LLM）：\n'
    '1. 应用补丁后对存量产物跑 report，确认报告正常产出（部署无碍）。\n'
    '2. 缩写表验证：运行目录放两列表格（缩写|定义）的 docx，lld.config.json 加\n'
    '   "abbreviationsDoc": "项目缩写表.docx"，重跑 report——3.1 只列外部表出现条目、\n'
    '   注释行注明来源、控制台打印缺口名单；JSON abbreviations 补一条缺口词重跑，\n'
    '   该词进 3.1 且移出缺口；删掉 abbreviationsDoc 恢复内建词典行为。\n'
    '3. 存量缺陷重生成（调 LLM）：\n'
    '   v3: gen <v3目录> --only Gp_EcuStpShdn_Startup,Gp_EcuStpShdn_MstProcMcuPreRunTest,Gp_EcuStpShdn_MstPostInit\n'
    '   TLF: gen <TLF目录> --only Gp_TLF35584_MainFunction,Gp_TLF35584_SetPorstMode,Gp_TLF35584_FwdBist,Gp_TLF35584_WwdBist,Gp_TLF35584_Errpin_Bist\n'
    '   序列图（平铺+Callout 参与者一并消除）: gen <各目录> --only dynamic --resume\n'
    '   gen 启动日志出现「术语表: N 条…」即定义注入生效。\n'
    '4. audit 验收各产物：对向重叠 0、斜线数对照已接受态（TLF≤10、EcuStp 各版 0），\n'
    '   v3 Startup 截图目检（菱形消除、使能虚线框出现、是/否支不交叉）。\n'
    '注意：本补丁只含工具链代码，不含任何 design json（设计数据各自回传）。\n'
))

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for e in entries:
        z.write(e, e)
    z.writestr(note[0], note[1].encode('utf-8'))

chk = zipfile.ZipFile(OUT)
assert chk.testzip() is None
for e in entries:
    assert chk.read(e) == open(e, 'rb').read(), e
chk.close()
print(f'[OK] {OUT}: {len(entries)+1} 条目，逐条字节核验全过，{os.path.getsize(OUT)/1024:.0f} KB')
