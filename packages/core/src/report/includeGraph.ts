/**
 * 4.2 文件包含关系图（由 #include 静态生成 Mermaid 源码，无需 LLM）。
 * 原内联在 htmlReport.ts，抽取为共享纯函数：报告渲染与 PNG 物化（gen --only images）
 * 必须消费同一份图源码，保证字节一致。
 *
 * 样式对齐模板：UML 版型节点（«header»/«Source» + 加粗文件名），虚线 «include» 箭头，
 * BT 布局——源文件在底部，箭头朝上指向被包含的头文件（模板约定：箭头指向被调用的元素）
 */
import type { ModuleModel } from '../model/types.js';

export function buildIncludeGraph(model: ModuleModel): string {
  const sanitizeId = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');
  // 长文件名按模块前缀折行，控制节点宽度避免导出超页宽
  const wrapFileLabel = (base: string) =>
    base.startsWith(`${model.module}_`) ? `${model.module}_<br/>${base.slice(model.module.length + 1)}` : base;
  const moduleFileBases = new Set(model.files.map(f => f.path.split(/[\\/]/).pop()!));
  const isMemmap = (base: string) => /memmap/i.test(base);
  const includeNodes: string[] = [];
  const includeEdges: string[] = [];
  const seenNodes = new Set<string>();
  const addIncludeNode = (base: string): void => {
    if (seenNodes.has(base)) return;
    seenNodes.add(base);
    const stereotype = /\.c$/i.test(base) ? '«Source»' : '«header»';
    includeNodes.push(`    ${sanitizeId(base)}["${stereotype}<br/><b>${wrapFileLabel(base)}</b>"]`);
  };
  for (const f of model.files) {
    const base = f.path.split(/[\\/]/).pop()!;
    if (isMemmap(base)) continue;   // Memmap 文件不出图（纯 pragma 包装）
    for (const inc of f.includes ?? []) {
      const incBase = inc.split(/[\\/]/).pop()!;
      if (isMemmap(incBase)) continue;   // MemMap.h 默认被各文件包含，不画出
      if (!moduleFileBases.has(incBase) && incBase !== 'Std_Types.h') {
        continue;   // 外部模块头文件不画出（Std_Types.h 除外），名单见 document 注
      }
      addIncludeNode(base);
      addIncludeNode(incBase);
      includeEdges.push(`    ${sanitizeId(base)} -.->|"«include»"| ${sanitizeId(incBase)}`);
    }
  }
  return includeEdges.length > 0
    ? [
        'flowchart BT',
        ...includeNodes,
        ...includeEdges,
        '    classDef header fill:#dae8fc,stroke:#6c8ebf,color:#1a1a1a',
        '    classDef source fill:#d5e8d4,stroke:#82b366,color:#1a1a1a',
        `    class ${[...seenNodes].filter(b => !/\.c$/i.test(b)).map(sanitizeId).join(',')} header`,
        `    class ${[...seenNodes].filter(b => /\.c$/i.test(b)).map(sanitizeId).join(',')} source`,
      ].join('\n')
    : '';
}
