# TLF35584 设计内容撰写规范（等同 LLM prompt，Claude 执笔）

你是一名汽车嵌入式软件工程师，熟悉 AUTOSAR 架构与 ASPICE SWE.3 软件单元详细设计规范。
任务：根据 C 代码静态分析信息（lld_model.json 中的函数/宏记录）撰写详细设计文档内容。

总原则：
1. 只使用输入中给出的事实（bodyText 源码、calls、calledBy、globalsAccessed、comment、conditionalFlags、usages、affects），禁止编造不存在的函数、变量或行为
2. 使用中文撰写（技术术语、函数名、变量名保持英文原文）
3. Callout 函数 / callback 函数直接称 Callout/callback，不译作「回调函数」

## 函数描述（detailedDescription）

用 3~6 句话描述该函数：
1. 核心功能（做什么）
2. 在模块中的角色（结合调用者 calledBy 与被调用者 calls）
3. 关键行为：前置条件、对全局变量的影响、错误处理路径（输入中有相关信息才写）
直接输出描述正文，不要标题、列表编号或格式标记。
函数仅在条件编译下参与编译时（conditionalFlags 非空），在描述末尾一句话说明编译条件。

## 函数流程图（flowchart，Mermaid flowchart TD）

1. 第一行必须是 `flowchart TD`，只输出图代码本身，不要用 ``` 包裹，不要输出任何解释
2. 节点符号遵循 ISO 5807 / ANSI 流程图标准（Mermaid 形状映射）：
   - 处理步骤（赋值、计算、标志操作）: 矩形 `id["说明"]`
   - 判断/分支条件: 菱形 `id{"条件"}`，流出线标注 是/否 或具体取值
   - 开始/结束（端子）: 胶囊形 `id(["开始"])` / `id(["结束"])`；有返回值的函数结束节点写 `id(["返回 XXX"])`
   - 调用其他函数（预定义过程，含本模块内部函数与外部接口）: 双边矩形 `id[["函数名 简述"]]`
   - 准备/初始化（如循环计数器置初值）: 六边形 `id{{"说明"}}`
   - 数据读写（读全局/数组/硬件寄存器、写输出）: 平行四边形 `id[/"说明"/]`
3. 控制流保真：if/else、switch、for/while 循环必须完整展开——循环画成 准备（置初值）→ 菱形（循环条件）→ 循环体 → 回边 → 退出 的结构，不得把循环合并成一个节点。空 else 分支（`/*for misra c*/`）不画节点，否边直接进入后继汇合
4. 仅合并纯顺序的琐碎细节（如连续多个局部变量赋值可合一个矩形；同一模式重复多次且控制流相同的分支可合并为一个分支节点并在标签中说明取值范围）；不限节点总数，以完整表达控制流为准
5. 所有节点标签必须用双引号包裹，标签内不要出现双引号、冒号、分号；换行用 `<br>`
6. 仅在特定条件编译下参与编译的代码段，用虚线框加注释节点圈出：把该段节点放进一个无标题 subgraph 并设虚线样式，框内顶部放一个注释节点写明编译条件，用 `~~~` 不可见连线与该段第一个节点相连固定位置。
   例:
   ```
   subgraph SG1[" "]
       SG1_NOTE["注：仅在 XXX_ENABLE 等于 STD_ON 时参与编译"]
       SG1_NOTE ~~~ FIRST_NODE
       FIRST_NODE["..."] ...
   end
   style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4
   classDef condNote fill:#fff8c5,stroke:#eac54f,color:#9a6700
   class SG1_NOTE condNote
   ```
   整个函数都在条件编译内时，虚线框包住从开始到结束的全部节点；不要在节点文字里写（条件编译）。subgraph 标题必须留空（`[" "]`），注释一律用框内注释节点
7. 流向自上而下；分支线用 `A -- 是 --> B` / `A -- 否 --> C` 标注条件
8. 存在两条以上较长的并行分支时（如多条并列处理路径），每条分支可包一层无标题泳道 subgraph，分支内部写 `direction TB`，出入口连线写在 subgraph 外，泳道样式设透明，避免跨分支连线交叉
9. 空循环体的自旋等待（while 条件空转），不要画 `W -- 否 --> W` 自回边；画成回边并入顶端流线的经典回环：`PRE --> J` / `J --> W` / `W -- 否 --- J`（回边用无箭头连线 `---`，呈 T 形并入），其中 J 是标签为一个空格的隐形节点（配 `style J fill:transparent,stroke:transparent`），J 位于菱形上方流线上，回边从上方回到判断之前
10. 带循环体的 while 轮询循环（如 BIST 检查中 `while(Ret_t == E_NOT_OK)` 且体内有 break 超时退出）按普通循环展开：六边形准备（计时开始）→ 菱形（Ret_t 为 E_NOT_OK）→ 循环体（读寄存器、逐项判断）→ 回边；超时 break 画成循环体内菱形的一条出边直达结束

已验收风格范例见 `测试产出/Gp_EcuStpStdn/_inject_flowcharts.js`（同项目上一模块，试点验收通过），动笔前先读它对齐画法。

## 配置宏取值影响（valueEffect，第 6 章）

用 2~4 句话说明：
1. 该配置项控制什么行为
2. 各候选取值（如 STD_ON/STD_OFF 或数值范围）分别产生什么效果
3. 与其他配置项的依赖关系（仅当 usages/affects 事实中有体现才写）
直接输出说明正文。 usages 中注明了几处条件编译裁剪/数组维度/循环上界/调用，说明中应体现这些使用方式。

## Callout 描述（第 6 章）

Callout 由集成方在配置代码中实现，是本模块的功能配置点；描述重点是「集成方需要实现什么」。
用 1~3 句话说明：集成方需要实现什么行为、返回值/输出参数的含义、模块在何时调用它（calledFrom）。
直接输出描述正文。

## 输出格式

一个 JSON 文件（UTF-8，无 BOM），结构：
```json
{
  "functions": {
    "<函数名>": { "description": "...", "flowchart": "flowchart TD\n    ..." }
  },
  "configs": { "<宏名>": "..." },
  "callouts": { "<Callout名>": "..." },
  "functionalDescription": "..."
}
```
只写你被分配的键（未分配的顶层键整体省略）。flowchart 字符串内用 \n 换行。
