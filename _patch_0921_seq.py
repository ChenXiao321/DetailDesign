# -*- coding: utf-8 -*-
# 迁移包补丁-20260921-序列图确定性生成.zip：序列图改纯静态生成（零 LLM）——
# 含 0921 状态机补丁全部内容（状态机确定性生成 + 0917 条件编译框/定义滤除）
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = []
# 工具链改动（src + dist + node_modules/@lld 镜像）
core_files = [
    'analyzer/cfgBuilder',
    'analyzer/stateMachineBuilder',
    'analyzer/sequenceBuilder',
    'generator/designGenerator',
    'generator/staticStateMachine',
    'generator/staticSequence',
    'llm/prompts', 'llm/provider',
    'model/types',
    'polarion/collect',
    'report/htmlReport',
    'index',
]
for f in core_files:
    files.append(f'packages/core/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/core/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/core/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/core/src/{f}.ts')
files.append('部署说明.txt')

missing = [f for f in files if not os.path.isfile(f)]
if missing:
    print('!! 缺失:'); [print('  ', m) for m in missing]; sys.exit(1)

readme = '''迁移包补丁-20260921-序列图确定性生成 —— 覆盖说明（0921b 版，取代此前全部补丁）
================================================

■ 内容（全部为工具链改动，不含任何生成产物；未打过 0917/0920/0921 的直接打本补丁）
  1. 【本补丁新增】序列图生成改为纯确定性（零 LLM），与流程图同一套路径
     （tree-sitter AST → 控制流图 → mermaid sequenceDiagram）：
       · if/else → alt、else-if 链拉平为一个 alt、if 无 else → opt、
         while/for/自旋等待 → loop、return/break/continue 终止当前路径；
       · 编译期 #if 区域自动包「宏 生效时 / 未生效时」opt/alt（嵌套区域嵌套
         包裹；else 体被 #endif 夹断逃出区域的写法只圈真正同区域的内容）；
       · 消息 = 源码出现顺序的直接调用，标签一律代码原文（条件守卫 = 条件
         表达式原文，不做中文润色）；跨模块被调函数在它自己的图里展开；
       · 条件里的调用（如 if (CalloutChkMcuRunTimeTest() == FALSE)）先发一条
         调用消息再进组合片段；空操作宏（NOP 类）除自旋等待体内外不画；
       · 多核角色分支（GetCoreId 返回值紧邻比较）自动分主核/从核两张图，
         两图内容无差异自动并回单图（如 IoM 的 GetCoreId 索引用法）；
       · 参与者只建模块粒度：OS + 本模块 + 交互的外部模块（Callout 属本模块
         画自调用，不建参与者）；入口固定 OS->>本模块: FnName()；
       · 任意函数必出图：控制流分析失败自动降级为按调用顺序的平铺图。
     实测：EcuStpStdn 四张序列图（主核/从核 × Initialization/Runtime）与 v6
     手修基准结构一致；TLF/IoM 各两张单图。序列图不再有任何 LLM 调用，
     --only dynamic 时若状态机已存在则完全离线可跑。
  2. （0921 已有）状态机生成改确定性结构提取 + LLM 仅润色标签：候选检测、
     CFG 抽象解释提取迁移（赋值=迁移、switch case=迁移源、自旋等待退出=
     迁移并标注、PwrShdn 类不返回分支=提前终止到 [*]）、真终止判定+互补
     守护合并、初态边「上电复位」、非周期驱动机器补结束状态边 state→[*]。
     润色失败保持代码原文，不中断。降级阶梯保证任意模块必出图。
  3. （0917 已有）条件编译虚线框归属修复 + 局部变量定义不进流程图。

■ 应用方法（内网）
  在迁移包解压目录上直接覆盖本补丁全部文件（目录结构一致）。

■ 内网刷新步骤
  ① 流程图（免 LLM，直接刷）：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only flowcharts --resume
  ② 状态机：删掉 lld_design.json 的 "stateMachine" 字段（及 "stateMachines" 若有），然后：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only dynamic --resume
  ③ 序列图（免 LLM）：把 lld_design.json 的 "sequences": [...] 改为 "sequences": []，然后同 ② 命令
     （②③可合并一次跑：stateMachine 与 sequences 都删/清空后 --only dynamic --resume）
  ④ 出报告 + 渲染验收：
       node packages/cli/dist/index.js report 测试模块/<模块> --out <产物目录>
       node packages/cli/dist/index.js audit 测试模块/<模块> --out <产物目录>

■ 生成结果口径说明（与旧 LLM 版的预期差异，评审时请留意）
  - 序列图条件守卫是条件表达式原文（如 `MstImpl_ptst->TryPwrShdn_b == TRUE`），
    不再是中文描述；编译期区域标签为「宏名 生效时 / 未生效时」。
  - 序列图区域包裹比 LLM 版更精确：else 体逃出 #if 区域的写法，宏 opt 只圈
    真正在区域内的调用（v6 手修基准同口径）。
  - 状态机迁移触发条件经 LLM 润色为中文短句；润色失败保持条件表达式原文
    或紧邻源码注释。从核图按代码实际路径画（satellite 可能 UNDEF→TWO 直达）。
  - switch default 分支展开为「未被 case 覆盖的状态各出一条迁移」。
  - 初态边标签「上电复位」；非周期驱动机器末个置位函数返回处补 state→[*] 结束边。

■ 兼容说明
  - 旧产物 json 不用改也能照常 report/audit（渲染逻辑零改动，存量 json 重出报告
    与旧版字节一致）；只有重跑 gen 的条目才会换成新版内容。
  - 状态机/序列图分图后 5.3 会出现「主核 Core0」「从核 satellite」节，各为一个
    Polarion 工作项。
'''

out = '迁移包补丁-20260921-序列图确定性生成.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('覆盖说明.txt', readme)
    for f in files:
        z.write(f, f.replace('/', os.sep))
print(f'已生成 {out}（{len(files)+1} 条目，{os.path.getsize(out)//1024} KB）')
