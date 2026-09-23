# LLD Agent 操作指南

详细设计生成 agent：C 代码 → ASPICE SWE.3 详细设计 HTML 评审报告。

## 环境准备

1. Node.js ≥ 18（开发环境用的 v25）
2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```

## 使用流程

约定：模块源码放 `测试模块/<模块名>/`，产物统一输出到 `测试产出/<模块名>/`（用 `--out` 指定；
不带 `--out` 时产物写在模块目录内）。下文以试点模块 Gp_EcuStpStdn 为例。

### 第 1 步：静态分析（离线，不依赖 LLM）

```bash
node packages/cli/dist/index.js analyze 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn
```

产出 `测试产出/Gp_EcuStpStdn/lld_model.json`：函数/变量/类型/调用关系/哈希锚点/工作项标识。

### 第 2 步：LLM 生成设计内容

**方式 A：本地 Qwen（内网环境，正式路径）**

LLM 连接配置三选一（优先级：环境变量 > lld.config.json）：

```powershell
# 方式 1：环境变量
$env:LLD_LLM_BASE_URL = "http://10.0.75.130:4000"   # 只给 host:port 会自动补 /v1
$env:LLD_LLM_API_KEY = "local"        # 本地部署通常任意值
$env:LLD_LLM_MODEL = "qwen3.8-27b" # 默认值，可不设

# 方式 2：当前目录放 lld.config.json（参照 lld.config.example.json；已 gitignore，不会进仓库）
```

**先自检连通性**（到新环境第一件事）：

```bash
node packages/cli/dist/index.js ping
# ✓ /models 可达 + ✓ chat 调用成功 → 可以跑 gen
```

```bash
node packages/cli/dist/index.js gen 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn
```

`gen` 逐条目增量落盘 `lld_design.json`，中途断网/中断不丢进度，加 `--resume` 续跑（跳过已生成条目）。
网络抖动自动重试 2 次（退避 1s/2s）；单次请求超时默认 180s，可用 `LLD_LLM_TIMEOUT_MS` 调整。

**方式 B：mock 预览（调试用，不调用任何模型）**

```bash
node packages/cli/dist/index.js gen 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn --mock
```

**只生成部分条目**（调试单个函数/动态设计）：

```bash
node packages/cli/dist/index.js gen 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn --only Gp_EcuStpShdn_Startup,dynamic
```

产出 `测试产出/Gp_EcuStpStdn/lld_design.json`：在模型基础上增加
- 每个函数的 `generated.detailedDescription`（增强描述）+ `generated.flowchart`（Mermaid 流程图）
- `dynamicDesign`：状态机 + 序列图（Mermaid 源码）

### 第 3 步：HTML 评审报告

```bash
node packages/cli/dist/index.js report 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn
```

产出 `测试产出/Gp_EcuStpStdn/lld_report.html`，浏览器打开即可评审：按模板章节排版，
函数条目为工作项卡片样式（Service name/Syntax/Parameters/Description），
含数据类型表、外部接口表、状态机/序列图/流程图（内嵌 mermaid.js 离线渲染）、配置表。

### 第 4 步：评审

打开 `lld_design.json` 检查：
- `providedFunctions[].generated.detailedDescription` —— 接口函数描述
- `providedFunctions[].generated.flowchart` —— 函数流程图（Mermaid 源码）
- `dynamicDesign.stateMachine.diagram` / `dynamicDesign.sequences[].diagram` —— 状态机/序列图源码

Mermaid 可粘贴到支持 Mermaid 的工具（VS Code Mermaid 插件 / mermaid.live）预览；
HTML 报告已内嵌 mermaid.min.js，直接打开即可离线渲染。


## 迁移到目标环境运行（Qwen 实测 runbook）

Qwen 服务器（10.0.75.130:4000）只在特定网段可达，实测需在能访问该地址的机器上跑。

**拷贝清单**（整个仓库目录，或至少以下部分）：

```
packages/            # 产品代码（core + cli）
测试模块/            # 模块源码（gen 需要重新 analyze 或读取 lld_model.json）
lld.config.json      # LLM 连接配置（参照 lld.config.example.json 填写）
package.json / package-lock.json
```

**目标环境步骤**：

```bash
npm install          # 或 npm ci；需要 node ≥ 18
npm run build

# 1. 自检连通性（不通会打印排查方向）
node packages/cli/dist/index.js ping

# 2. 静态分析（离线）
node packages/cli/dist/index.js analyze 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_qwen

# 3. 先单点试一个函数，确认 Qwen 输出格式兼容（prompt 有 Mermaid 格式校验+重试）
node packages/cli/dist/index.js gen 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_qwen --only Gp_EcuStpShdn_Startup

# 4. 全量跑（约 55 次 LLM 调用；中断后加 --resume 续跑）
node packages/cli/dist/index.js gen 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_qwen

# 5. 出报告（离线，可在本机做——把 lld_design.json 拷回即可）
node packages/cli/dist/index.js report 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_qwen

# 6. 渲染质量验收（需 Edge 或 Chrome：预渲染 SVG 成品版 lld_report.html + 斜线/交叉/穿盒/箭头审计，打印中文量化报告）
node packages/cli/dist/index.js audit 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_qwen
```

产物目录用 `_qwen` 后缀与 samples 基准（`测试产出/Gp_EcuStpStdn/`）区分，方便对照评审。
评审重点：描述质量 vs samples、流程图 Mermaid 语法正确率、格式校验重试次数（stderr 日志）。

缩写表定制（两种提供方式）：①外部人员提供的 Word 缩写表——在 lld.config.json 加
`"abbreviationsDoc": "项目缩写表.docx"`（两列表格：缩写|定义，多表自动合并），3.1 整章以外部表为唯一定义来源
（内建词典不兜底）；正文出现但表内未定义的缩写，report/audit 会打印缺口名单，反馈维护方补表即可。
②模块特有/临时补充——`"abbreviations": {"WWD": "Window Watchdog 窗口看门狗"}`，
两种同时在场时 JSON 同名覆盖 docx、新增补入；不配 docx 时 JSON 与内建 29 条词典合并（原行为）。
外部定义同时注入 gen：函数描述/配置说明/类型注释/外部接口说明/5.1 功能描述的 prompt 会附带
「项目术语表」块（按 prompt 内实际出现过滤——`Spi_Setup` 这类标识符分段也算 SPI 出现），
生成正文的术语口径与外部定义一致；流程图/序列图等结构生成不注入。

报告骨架内容物化（document 节，2026-09-23 起）：1/2/3/7/8 章正文与各章引导句（含 3.1/3.2 缩写定义表）
在 gen 期物化进 lld_design.json 的 `document` 节，report/audit 纯渲染只读 json，不再现读缩写表配置——
**缩写表改为 gen 期定型**：维护方更新 docx 后需重跑
`node packages/cli/dist/index.js gen <模块目录> --out <产物目录> --only document --resume`
（确定性零 LLM，秒级）才反映到报告；描述类内容重生成后同样需重刷 document（3.1 按文档实际出现过滤）。
存量 design json 无 document 节时 report/audit 回退旧行为（report 期现读配置，产物一致）并打印提示。

## 当前状态

| 阶段 | 状态 |
|------|------|
| 静态分析层 | ✅ 完成（Gp_EcuStpShdn 验证通过） |
| LLM 生成层 | ✅ pipeline 完成；示例内容见 `samples/claude_generated_content.json`（由 Claude 生成，用于评审效果） |
| HTML 评审报告 | ✅ 章节完整（17 张 mermaid 图，全中文 + 「推断，待确认」标记） |

## 目录结构

```
packages/            # 产品代码
├── core/            # 纯逻辑（未来 VS Code 插件直接复用）
│   └── src/
│       ├── parser/       # tree-sitter C 解析 + 嵌入式预处理 + 注释块解析
│       ├── analyzer/     # 模块分析 → 中间模型
│       ├── llm/          # LLM Provider（OpenAI兼容/Mock）+ prompt
│       └── generator/    # 生成编排（描述增强、动态设计、重试校验）
├── cli/             # 命令行入口
samples/             # 示例生成内容（LLM 离线内容源）
模板/                # G-B035-005 软件详细设计规范（Code）.docx
参考文件/            # 既有 AI 生成 LLD 参考（1231-2_convert.docx）
测试模块/            # 测试输入：Gp_EcuStpStdn/ 试点模块源码（只放 .c/.h）
测试产出/            # 测试产出：Gp_EcuStpStdn/ 下 lld_model.json / lld_design.json / lld_report.html
```
