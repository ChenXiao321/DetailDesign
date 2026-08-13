# LLD Agent 操作指南

详细设计生成 agent：C 代码 → ASPICE SWE.3 详细设计 → Polarion。

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

```powershell
# PowerShell 设置环境变量（Qwen 服务器地址）
$env:LLD_LLM_BASE_URL = "http://<qwen-server>:8000/v1"
$env:LLD_LLM_API_KEY = "local"        # 本地部署通常任意值
$env:LLD_LLM_MODEL = "qwen3.6-35b-a3b" # 默认值，可不设

node packages/cli/dist/index.js gen 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn
```

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

## 当前状态

| 阶段 | 状态 |
|------|------|
| 静态分析层 | ✅ 完成（Gp_EcuStpShdn 验证通过） |
| LLM 生成层 | ✅ pipeline 完成；示例内容见 `samples/claude_generated_content.json`（由 Claude 生成，用于评审效果） |
| HTML 评审报告 | ✅ 章节完整（17 张 mermaid 图，全中文 + 「推断，待确认」标记） |
| Polarion 同步层 | ⬜ 待做（需测试项目 projectId） |

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
