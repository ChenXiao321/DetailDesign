# Polarion 同步工具实现需求

> 消费方：读取 `lld_polarion_sync.json`（下称 **同步单**）并对 Polarion 执行实际增删改的工具
> （脚本 / LLM 代理均可）。本文档规定该工具的实现需求。
> 同步单的产出方是 Modu.LLD（本仓库），结构见 `packages/core/src/generator/modelDiff.ts`。
> 版本：v1（2026-10-16，对应 sync.json 带 content+PNG 形态）

---

## 1. 背景与目标

Modu.LLD 在模块代码改版后（`update` / `run` 自动更新流程）产出同步单
`lld_polarion_sync.json`，描述「Polarion 侧的详细设计文档需要哪些改动」。
同步单已是**自包含操作单**：每条操作内嵌新内容原文（`content` 深拷贝，含图 PNG base64），
工具无需回读 `lld_design.json` 即可执行。

本文档回答：对每一种操作（create / update / delete / rename）和每一类条目
（function / type / external / config + 章节级更新），工具**具体做什么、改 Polarion 哪些字段**。

## 2. 输入契约

### 2.1 顶层结构

```jsonc
{
  "module": "Gp_EcuStpShdn",          // 模块名（FC 名）
  "oldAnalyzedAt": "...",             // 旧版分析时间戳
  "newAnalyzedAt": "...",             // 新版分析时间戳
  "operations": [ SyncOperation ],    // 工作项粒度操作，见 §4
  "chapterUpdates": [ ChapterUpdate ],// 章节级更新（非工作项粒度），见 §7
  "untouched": { "functions": 12, "types": 5, "externals": 33, "configs": 4 }  // 零操作计数
}
```

### 2.2 SyncOperation

| 字段 | 类型 | 说明 |
|---|---|---|
| `action` | `create`/`update`/`delete`/`rename` | 操作类型 |
| `kind` | `function`/`type`/`external`/`config`/`variable` | 条目类别 |
| `chapter` | string | 报告章节号 = Polarion 文档定位锚点，如 `5.2.3.2` |
| `title` | string | 工作项 title（rename 时为**新名**） |
| `wiType` | string | 工作项「类型」属性枚举 ID，直接填入 Polarion（映射见 §6.0） |
| `verifyMethod` | string | 「验证方法」属性枚举 ID，直接填入 Polarion（映射见 §6.0） |
| `from` | string? | rename 时的旧名（仅 rename 携带） |
| `detail` | string | 中文操作建议，**仅供人工阅读**，工具不得解析此文本做决策 |
| `jsonPath` | string? | 条目在新 design json 的节点路径（对账用；delete 无此字段；组表工作项为聚合节点，指向其首个成员）。基座按节点归属：普通外部接口=`$.calledExternalFunctions[N]`，Callout=`$.calloutFunctions[N]`（v2 起 Callout 独立成顶层节点，不再是 `$.calledExternalFunctions`） |
| `oldJsonPath` | string? | 条目在旧 design json 的节点路径（对账用；create 无此字段；组表工作项同上指首个成员） |
| `content` | object/array? | 新内容原文深拷贝（delete 不携带），字段映射见 §6 |
| `members` | array? | 组表工作项成员级变化明细（仅 external 组表，见 §6.3） |
| `changedFields` | string[]? | 变更属性清单（实际写入 Polarion 的 `title`/描述/`wiType`/`verifyMethod` 口径，仅 update/rename 携带），见 §6.6 |
| `signatureChanged` | bool? | 仅 function：签名哈希变化=接口面变更（评审重点关注，不阻断），见 §5.2 |
| `manualRevisionLost` | bool? | 产出方指纹检出：旧内容生成后曾被人工修订，本次覆盖将丢失（提示不阻断），见 §5.2 |

### 2.3 ChapterUpdate

`{ chapter, title, reason, wiType, verifyMethod, content?, jsonPath, oldJsonPath? }`——章节级内容更新（5.1 描述、5.3 图、4.x 总图、
7 评估表、3.x 缩写表等），`wiType` 恒为 `Design`、`verifyMethod` 恒为 `review`，`content` 为新内容原文。见 §7。

`jsonPath`/`oldJsonPath` 语义与 SyncOperation 相同：`jsonPath` 恒在（新 json 落点，路径静态可知，content 未物化时
指向 gen 后的落点）；`oldJsonPath` 仅当旧 json 实有该节点才携带（类比 create 无 `oldJsonPath`）。具体路径映射见 §7 表格。

### 2.4 产出时机与内容完备性

| 产出路径 | content 状态 | 工具行为 |
|---|---|---|
| `update` / `run`（默认含 images） | **完整**：生成内容 + 图 PNG base64 | 正式执行的唯一依据 |
| `update --skip-images` | 生成内容在，**无 PNG**（只有 mermaid 源码） | 可执行，图字段按 §8 降级处理 |
| 单独 `diff` | **分析态**：无生成内容、无 PNG | 只允许 dry-run 预览，禁止正式执行 |

工具开工前**必须**校验：任一 `content` 缺生成字段（如 function 无 `generated`）即判定为
分析态同步单，拒绝正式执行并提示「请先跑完 update 流程」。

### 2.5 状态机统一数组形态

`lld_design.json` 的 `dynamicDesign.stateMachines` 恒为数组：无状态机为空数组、
单核 1 张、多核按角色分图多张。读取状态机时直接取该数组即可，
无需判空字段或兼容旧单字段形态（v0.4.7 起 `stateMachine` 旧字段已下线，
存量旧 json 由工具读取侧自动迁移，同步单产出方恒以数组形态给出）。

### 2.6 design json 侧的属性物化（2026-10-19 用户定）

`wiType`/`verifyMethod` 同时物化在 `lld_design.json` 内，与同步单取值完全一致（同一套推导代码）：

- **工作项节点**：各节点的 `polarion` 标记对象内带 `wiType`/`verifyMethod` 两字段——五类工作项
  （函数/变量/类型/外部接口/配置宏）+ 图节点（状态机全角色图、序列图、功能接口总图、内部函数调用图）。
- **章节级工作项**：无节点可挂的章节（5.1 模块功能描述、4.1 文件清单、7 评估与圈复杂度表、
  3.1 缩写表、3.2 定义表）在顶层 `polarionChapterItems` 数组列出，恒 `wiType=Design`、`verifyMethod=review`。
- **产出时机**：analyze、全量 gen、update/diff 合并落盘三处均物化（幂等覆盖写）；存量旧 json 无此字段，
  下次 gen/update 自动补齐（零 LLM 可用 `gen --only document --resume` 就地补刷）。
- 同步单（lld_polarion_sync.json）仍是**执行口径**；design json 侧字段供全量导入通道与人工核查直读。

## 3. 工作项定位规则

1. **首选**：`content.polarion.workItemId`（如 `Gp_EcuStpShdn-42`）——若此前导入已回写，直接按 ID 定位。
2. **次选**：`chapter` + `title` 组合定位。产出方已由 schemaLint 门禁保证
   **同章节内工作项 title 唯一**（跨章节可重名，定位必须带章节号）。
3. **找不到时**：
   - `update`/`rename` 目标不存在 → 降级为 `create` 并记入对账报告（§10）；
   - `delete` 目标不存在 → 视为已完成（幂等），记「跳过」。

## 4. 操作语义总览

同步单 `operations` **已按执行顺序排序**（章节号升序；同章内 delete → update → create → rename），
工具**按数组顺序逐条执行即可**，不得自行重排。rename 放最后是刻意的：避免新名与待删/待建条目冲突。

| action | 一句话语义 | 详细 |
|---|---|---|
| `create` | 在 `chapter` 对应位置新建工作项，按 §6 填全部字段 | §5.1 |
| `update` | 定位已有工作项，**内容字段整体替换**，元数据/链接/历史保留 | §5.2 |
| `delete` | 工作项状态从「发布」迁移到「废弃」，并移出文档 | §5.3 |
| `rename` | 改 title 为新名 + 按 update 刷新内容，**严禁删了重建** | §5.4 |

## 5. 各操作的具体执行要求

### 5.1 create

1. 在 `chapter` 对应的文档位置新建工作项；「类型」属性直接照填操作单携带的 `wiType`（§6.0），不再由工具按 `kind` 自行映射（Polarion 原生 work item type ID 的映射仍属 §13 待定项）。
2. `title` = `SyncOperation.title`。
3. 按 §6 字段映射表，用 `content` 填内容字段。
4. 图字段：`content` 内 PNG base64 解码后以**内嵌图片或附件**挂入（§8）。
5. **状态**：新建工作项初始即为「待评审」（具体状态枚举值见 §13 待定项）。
6. 幂等：若 §3 定位已命中同名工作项，转为 `update` 而不是报错。

### 5.2 update（语义已定，2026-10-16）

1. 按 §3 定位工作项。
2. **只改内容字段**（§6 映射表列出的字段整体以 `content` 为准覆盖）；
   **不得触碰**：工作项 ID、创建人/创建时间、追溯链接（linked work items）、
   审批状态以外的 Polarion 侧人工维护字段（如评审结论）。
3. 内容字段覆盖是全量替换语义：旧内容中与 `content` 矛盾的部分以 `content` 为准。
   `changedFields` 给出本次实际变化的 Polarion 写入属性清单（§6.6）——作为工具局部优化与
   人审摘要的**提示**；工具实现初期可忽略它直接整段覆盖，语义等价。
4. **`wiType`/`verifyMethod` 随 update 同步刷新**（已定）：操作单携带的是按新模型算好的
   最新值（如函数从内部改为对外，章节与 IF/LF 类型一起变），工具照填覆盖即可，
   不得保留工作项上的旧值。
5. **状态退回待评审**（已定）：内容变更后原评审结论失效，执行 update 后将工作项状态
   打回「待评审」（具体状态枚举值见 §13 待定项），由评审人重新过；rename 因同样刷新
   内容，一并退回。create 新建的工作项初始即待评审态。
6. **签名变更标记**（已定）：函数 `signatureChanged: true` =接口面变更，调用方可能受影响——
   工具在对账报告中**高亮**此类操作供评审定夺，不强制额外流程、不阻断。
7. **人工修订检出**（已定，产出方指纹口径）：`manualRevisionLost: true` = 产出方比对
   生成时刻内容指纹（design json `generated.contentHash`）发现该条目旧内容被人工改过，
   本次 `content` 覆盖将丢失该修订。工具在对账报告标注即可，**默认提示不阻断**
   （重生覆盖是设计内行为：条目代码语义已变，旧修订基于旧内容）。旧版产物无指纹时
   该字段缺席=未检出，工具可选做 Polarion 侧二次比对作为补充。

### 5.3 delete（已定：状态迁移 + 移出文档，不做物理删除）

1. 按 §3 定位工作项。
2. **状态迁移**：工作项状态从「发布」改为「废弃」——工作项本体保留在 Polarion 中，
   历史与追溯链接完整可查，任何时候可回溯或恢复。
3. **移出文档**：把工作项从所属文档（chapter 对应位置）中移除——文档读者不再看到该条目，
   但工作项不丢。
4. 连带处理：该工作项作为源/目标的追溯链接一并清理（文档内不再引用它）；
   若其他文档仍引用该工作项，在对账报告中列出引用点清单交人工处置，不擅自处理。
5. **不做物理删除**（delete work item），任何配置下都不允许。
6. 幂等：目标不存在（已废弃且已移出）视为已完成；目标已废弃但仍在文档中 → 补移出；
   目标在文档中但状态非发布 → 仍执行移出并在对账报告标注原状态。

### 5.4 rename（疑似改名）

1. 按 `chapter` + **`from`（旧名）** 定位工作项。
2. 改 title 为 `title`（新名），然后按 §5.2 刷新内容字段（`content` 已是新名节点的原文）。
3. **状态**：rename 执行后工作项状态退回「待评审」（同 §5.2-5，具体状态枚举值见 §13 待定项）。
4. **严禁**「删除旧工作项 + 新建新工作项」——那会丢失工作项 ID、历史与追溯链接。
   同步单 `detail` 字段对此已有同样提示。
5. rename 是产出方按名称相似度（LCS ≥0.8 或语义键相同）配对的**疑似**结果：
   工具须支持 dry-run 模式先输出 rename 配对清单供人工确认；确认名单外的 rename 按
   delete+create 处理（在对账报告中显式标注「改名未确认，已按删+建执行」）。

## 6. 字段映射（content → Polarion）

> 实际写入 Polarion 的属性为 `title`、描述、`wiType`、`verifyMethod`（2026-10-19 用户确认）。
> 下表中的签名、参数表、流程图、表格等内容项统一组成「描述」，不作为独立写入属性；
> 「描述正文」指工作项 description。Polarion 侧自定义字段 ID 依项目模板而定，§13 列出待定项。

### 6.0 工作项「类型」属性（已定，2026-10-16 用户确认枚举）

Polarion 中工作项的「类型」自定义属性为枚举，**同步单每条操作/章节更新已物化 `wiType` 字段，
工具直接照填 ID 即可，不得自行映射**：

| ID | 名称 | sync.json 侧来源 |
|---|---|---|
| `IF` | 接口函数 InterfaceFunction | function @5.2.3.2（对外接口函数） |
| `LF` | 内部函数 LocalFunction | function @5.2.4.2（内部函数） |
| `TDST` | 结构体类型 Structure | type 且 `content.kind === 'struct'` |
| `TDE` | 枚举类型 Enum | type 且 typedef 带 `relatedDefines`（枚举式） |
| `TDB` | 基础类型 Basic | type 且普通 typedef |
| `Design` | 设计 | Callout（6.2）、外部接口组表（5.2.2.2）、配置宏（6.x）、全部 chapterUpdates |
| `LV` / `GV` | 内部变量 / 全局变量 | variable：5.2.4.1 内部变量→`LV`，5.2.3.1 对外变量→`GV`（2026-10-16 纳入） |

「验证方法」属性（已定，2026-10-16 用户确认枚举 `test`=测试 / `review`=评审 / `test&review`=测试和评审），
同步单每条操作/章节更新已物化 `verifyMethod` 字段，工具直接照填 ID：

| sync.json 条目 | verifyMethod |
|---|---|
| function（IF/LF，5.2.3.2/5.2.4.2） | `test` |
| type（TDST/TDE/TDB，5.2.1.2） | `review` |
| external Callout 单条（6.2） | `test` |
| external 组表（5.2.2.2） | `test` |
| config 配置宏（6.x） | `test` |
| variable 变量（5.2.3.1/5.2.4.1） | `review` |
| chapterUpdates 全部章节 | `review` |

### 6.1 kind=function（章节 5.2.3.2 对外接口函数 / 5.2.4.2 内部函数）

`content` = FunctionUnit 节点。映射：

| Polarion 字段 | 来源 | 说明 |
|---|---|---|
| title | `name` | 函数名 |
| 描述正文 | `generated.detailedDescription` | LLM 增强功能描述（主体内容） |
| 签名 | `signature` | 归一化签名，建议独立自定义字段或正文首节 |
| 参数表 | `parameters[]`（type/name/pointerDepth）+ `returnType` | 建议表格化 |
| 流程图 | `generated.flowchartPng`（base64 PNG） | 内嵌图；无 PNG 时降级见 §8。简单顺序函数可能无流程图（字段缺省），非缺漏 |
| 圈复杂度 | `complexity` | 建议自定义字段（数值） |
| 死循环标记 | `infiniteLoop` | 建议自定义字段（布尔），第 7 章可控性评估依据 |
| 条件编译 | `conditionalFlags[]` + `innerCondFlags[]` | 外层包裹宏 / 体内宏 |
| 源位置 | `file` + `lineStart`–`lineEnd` | 溯源用 |
| 调用关系 | `calls[]` / `calledBy[]` / `globalsAccessed[]` | 可选自定义字段或正文小节 |

### 6.2 kind=type（章节 5.2.1.2 类型定义）

`content` = TypeUnit 节点：

| Polarion 字段 | 来源 |
|---|---|
| title | `name` |
| 类型类别 | `kind`（struct/typedef）+ `underlyingType` |
| 描述 | `generated.comment`（缺省回退源码注释 `comment`） |
| 成员/常量表 | struct：`elements[]` + `generated.elements{成员名:说明}`；枚举式 typedef：`relatedDefines[]` + `generated.defines{宏名:说明}` |

### 6.3 kind=external（两种工作项形态）

**Callout 单条（章节 6.2，title=函数名）**：`content` = ExternalInterface 节点——
title=`name`；签名=`signature`；描述=`generated.detailedDescription`；
说明来源=`commentSource`（`inferred` 时须带「推断，待确认」标注）；调用点=`calledFrom[]`。
jsonPath 基座为 `$.calloutFunctions[N]`（design json v2 起 Callout 独立顶层节点）。

**组表整表（章节 5.2.2.2，title=「\<组名\> 接口函数」）**：
- `content` = 该组**全部**成员的 ExternalInterface 节点数组（已是新全量，整表替换即可）；
- `members[]` 仅为**变更明细**（name + added/removed/changed + 双向 jsonPath），
  用于日志/对账，不作为执行依据——执行就是整表替换。

### 6.4 kind=config（章节 6 / 6.1 / 6.2，以 `content.polarion.chapter` 为准）

`content` = ConfigMacro 节点：

| Polarion 字段 | 来源 |
|---|---|
| title | `name` |
| 取值/形式 | `value` + `isFunctionLike` |
| 类别 | `kind`（general=6.1 一般配置 / functional=6.2 功能开关 / alias=别名宏不入工作项） |
| 取值影响 | `generated.valueEffect` |
| 使用点 | `usages[]`（file/line/context/kind） |
| 影响面 | `affects[]`（被条件编译影响的函数/变量/类型） |

### 6.5 kind=variable（章节 5.2.3.1 对外变量 GV / 5.2.4.1 内部变量 LV）

`content` = VariableUnit 节点：

| Polarion 字段 | 来源 |
|---|---|
| title | `name` |
| 类型 | `type` |
| 限定符 | `isStatic` / `isConst` / `isVolatile` |
| 描述 | `comment`（未变条目回挂旧注释，人工富化保留） |
| 条件编译 | `conditionalFlags[]` |
| 源位置 | `file` + `line` |

变量比对键 = 类型+限定符（注释/文件位置/行号不算变更，与类型条目同口径）。

### 6.6 changedFields 取值口径（仅 update/rename 携带）

`changedFields` 只列**实际写入 Polarion 的属性**，可选值固定为 `title`、描述、`wiType`、`verifyMethod`；
不再把描述内部的签名、流程图、复杂度、表格等拆成独立属性：

| 取值 | 触发条件 |
|---|---|
| `title` | 新旧工作项 title 不同（rename） |
| 描述 | §6.1~6.5 的描述组成内容发生语义变化，或旧生成内容曾被人工修订、本次将被覆盖 |
| `wiType` | 新旧工作项「类型」枚举值不同，如 IF→LF、TDB→TDST、LV→GV |
| `verifyMethod` | 新旧「验证方法」枚举值不同 |

边界：
- 函数签名变化时，描述标记为变更，同时另带 `signatureChanged: true` 供接口影响评审高亮；
  `changedFields` 中不再出现「签名」「参数表」。
- `create`（全部属性都是新的）与 `delete`（无新内容）不携带 `changedFields`。
- 纯改名且描述内容未变时为 `[title]`；改名同时内容变化时为 `[title, 描述]`；
  `wiType`/`verifyMethod` 只在新旧值确实不同时追加。
- 注释、行号、文件位置等不触发 update 的噪声不产生属性变更项；PNG 字节差异同样不算。

## 7. chapterUpdates（章节级更新）

`chapterUpdates` 处理的是**工作项清单之外**的章节内容。`reason` 说明触发原因（人读），
工具按 `chapter` 分发：

| chapter | 内容 | content 形态 | jsonPath（新 json 落点） | 操作 |
|---|---|---|---|---|
| `5.1` | 模块功能描述 | 字符串 | `$.functionalDescription` | 替换 5.1 节正文 |
| `5.3.1` | 状态机 | StateMachineDesign 数组：`diagram`(mermaid 源码) + `diagramPng` + `states[]`(名称/描述) + `transitions[]`(迁移说明) | `$.dynamicDesign.stateMachines` | 整节替换：图用 PNG，状态表/迁移表用 states/transitions |
| `5.3.2` | 序列图 | SequenceDesign 数组：`diagram` + `diagramPng` + `description` | `$.dynamicDesign.sequences` | 整节替换（多核场景多张图逐一对应） |
| `7` | 评估与圈复杂度表 | `{ evaluationRows[], complexityTable[] }` | `$.document`（content 为 document 节多键子集，锚到父节点） | 整表替换 |
| `4.1` | 文件清单 | files 数组（path/role/includes） | `$.files` | 整表替换 |
| `4.2` | 接口总图 | `{ diagram, diagramPng }` | `$.interfaceOverview` | 图替换 |
| `4.2` | 调用图 | `{ changed: [{name,diagram,diagramPng}], removed: [名字] }` | `$.callGraphs` | changed 逐张替换，removed 逐张移除 |
| `3.1/3.2` | 缩写表/定义表 | `{ abbreviations, definitions, abbreviationGaps }` | `$.document`（同 §7 评估表，锚到父节点） | 整表替换；`abbreviationGaps` 非空=有未定义缩写，须在对账报告提示维护方补表 |

`oldJsonPath` 仅当旧 json 实有该节点才携带（如旧 json 尚无 `document` 节、`interfaceOverview` 未物化等，则省略）。

**章节标题唯一性（已定，2026-10-19 用户确认）**：同一逻辑章节包含多张图/多个条目时，
文档正文中的章节号标题只出现一次；各图或条目改用不含章节号的角色/场景子标题区分
（如 5.3.1 下分「主核 Core0」「从核 satellite」，5.3.2 下分各序列图场景）。工作项的
`chapter` 属性仍保留原章节号，§3 的 `(chapter, title)` 定位规则不变。

章节级更新与工作项操作**无顺序依赖**，可在 operations 全部完成后统一执行。

## 8. 图 PNG 处理

1. `content` 中 `flowchartPng` / `diagramPng` 为 base64 编码 PNG（2x 分辨率，与 HTML 报告同管线渲染）。
   解码后作为内嵌图片挂入工作项/章节对应位置。
2. mermaid 源码字段（`flowchart` / `diagram`）**同时保留**——建议作为图片附件的 alt 文本或附录，
   便于后续图源级 diff 与问题排查。
3. 降级路径：`--skip-images` 产出的同步单无 PNG。工具应：
   - 有 mermaid 源码 → 可自选渲染或先挂源码占位，并在对账报告标注「图待补（重跑 update 带 images 即可）」；
   - 不得因缺 PNG 中断整个同步。
4. **PNG 字节不做变更比对**（已定）：PNG 是渲染产物，浏览器/字体环境差异会造成字节噪音，
   图源级是否变化一律以 mermaid 源码字符串为准；工具不得对 base64 字节做 diff 判变更。

## 9. 执行模式

1. **dry-run（必备）**：只输出执行计划（逐条操作 + 目标定位结果 + rename 配对确认清单），不写 Polarion。
2. **正式执行**：逐条执行，单条失败**不中断**，记录后继续；全部完成后退出码反映是否有失败项。
3. **幂等**：同一同步单重复执行结果收敛（create 查重转 update、delete 缺席视为完成、update 覆盖语义）。
4. 执行日志须逐条记录：`action / kind / chapter / title / 定位方式(ID|章节+title|新建) / 结果 / 失败原因`。

## 10. 对账报告与回写

执行结束产出对账报告（json 或控制台表）：
- 每条操作：成功 / 失败(原因) / 跳过(幂等命中) / 降级(update→create、rename 未确认转删+建等)；
- `untouched` 计数与 Polarion 侧实际抽查核对（抽样即可）；
- 建议：将新建/改名后工作项的 Polarion ID 回写到同步单副本的 `content.polarion.workItemId`，
  供下次同步走 §3 首选定位（回写副本不覆盖原同步单）。

## 11. 验收标准

1. 对一份含四类操作（create/update/delete/rename 各 ≥1）+ 全部章节级更新类型的同步单，
   dry-run 输出与人工预期完全一致。
2. 正式执行后：Polarion 文档与同步单 `content` 逐字段一致（含图）；rename 工作项
   ID 不变、历史保留；delete 工作项状态已废弃且已从文档移出、本体可回溯。
3. 同一同步单连跑两次，第二次全部「跳过/幂等覆盖」，无重复工作项产生。
4. 缺 PNG 同步单全程无中断，对账报告有「图待补」标注。
5. 分析态同步单（单独 diff 产出）被正式执行模式拒绝，dry-run 可用。
6. 带 `signatureChanged` / `manualRevisionLost` 标记的操作在对账报告中正确高亮；
   update/rename 执行后工作项状态已退回待评审、`wiType`/`verifyMethod` 已刷新为操作单值。

## 12. 非需求（明确不做）

- 不做反向同步（Polarion → design json）；Polarion 侧人工修订的检出与提示见 §5.2-7。
- 不解析 `detail` / `reason` 中文文本做任何决策。
- 不重排 `operations` 顺序，不自行合并/拆分操作。

## 13. 待定项（按实际 Polarion 环境落实）

| 项 | 说明 |
|---|---|
| 工作项类型 ID | function/type/external/config 各自对应的 Polarion work item type（注意：与 §6.0 的「类型」自定义属性是两回事） |
| 自定义字段 ID | 「类型」（wiType）与「验证方法」（verifyMethod）两个属性的实际字段名；title/description 使用 Polarion 标准属性，描述内部组成见 §6 |
| ~~「验证方法」属性~~ | **已定**（§6.0）：function/Callout/组表/config=test，type/章节级更新=review；「类型」「验证方法」两属性在 Polarion 侧的字段名待落实 |
| 文档定位方式 | chapter → Polarion 文档/章节的映射（LiveDocument 结构或工作项层级） |
| API 通道 | REST API 端点/认证方式；或走导入文件 round-trip |
| ~~删除策略默认值~~ | **已定**（§5.3）：状态发布→废弃 + 移出文档，不做物理删除；「废弃」在该环境的具体状态枚举值待落实 |
| ~~update 后状态~~ | **已定**（§5.2-5）：内容变更后打回「待评审」；「待评审」在该环境的具体状态枚举值待落实 |
| rename 确认通道 | dry-run 清单的人工确认方式（配置文件/交互/审批单） |

## 14. 已知缺口

- **章节间移动不报警**（函数与变量同此口径）：条目在内外部章节之间移动（如变量从
  5.2.4.1 改为 5.2.3.1 对外暴露）但语义键未变时，diff 判为未变、不出操作——比对键
  不含章节归属是刻意设计（防工具版本升级误报），此类移动须评审期人工留意。
