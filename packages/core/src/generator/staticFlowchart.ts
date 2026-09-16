/**
 * 确定性流程图桥接：FunctionUnit + 源文件内容 → mermaid flowchart TD 源码。
 *
 * core 不碰 fs：源文件内容由调用方（CLI）经 readSource 回调读入。
 * L0 完整 CFG（cfgBuilder + flowchartEmitter）；源码定位失败等异常由调用方收敛到 L3。
 * 本文件同时提供 L3 兜底 buildFallbackFlowchart（bodyText 顺序链），保证任意函数必出图。
 */
import { preprocessSource, parseCFile } from '../parser/cParser.js';
import { buildFnCfg, collapseCfg } from '../analyzer/cfgBuilder.js';
import { emitMermaid, sanitizeLabel } from '../analyzer/flowchartEmitter.js';
import type { FunctionUnit } from '../model/types.js';

/** 大函数节点上限（对齐 callGraphs CG_MAX_NODES=60 先例） */
const MAX_NODES = 60;
/** L3 顺序链最多块数，超出聚合成一个尾部块 */
const L3_MAX_BLOCKS = 40;

export interface StaticFlowchartResult {
  mermaid: string;
  warnings: string[];
  degraded: 'none' | 'subtree' | 'block';
  /** 实际画出虚线框的宏（空区域被抑制的不在内） */
  framedMacros: string[];
}

/** 重解析 fn.file 定位函数体，构建 CFG 并发射 mermaid；定位失败抛错（调用方降 L3） */
export async function buildStaticFlowchart(fn: FunctionUnit, source: string): Promise<StaticFlowchartResult> {
  const pre = preprocessSource(source);
  const parsed = await parseCFile(pre.clean);

  // 定位：优先 名字+起始行 双匹配（design json 与源码同源时精确），退化为名字唯一匹配
  type TSNode = import('web-tree-sitter').SyntaxNode;
  const candidates: TSNode[] = [];
  (function walk(n: TSNode): void {
    if (n.type === 'function_definition') candidates.push(n);
    for (const c of n.namedChildren) walk(c);
  })(parsed.tree.rootNode);

  const nameOf = (n: TSNode): string => {
    const d = n.childForFieldName('declarator');
    if (!d) return '';
    return pre.clean.slice(d.startIndex, d.endIndex);
  };
  const byNameAndLine = candidates.filter(
    n => nameOf(n).includes(fn.name) && n.startPosition.row + 1 === fn.lineStart,
  );
  const byName = candidates.filter(n => nameOf(n).includes(fn.name));
  const fnNode = byNameAndLine[0] ?? (byName.length === 1 ? byName[0] : null);
  if (!fnNode) {
    throw new Error(`源码中定位不到函数 ${fn.name}（${fn.file}:${fn.lineStart}，名字候选 ${byName.length} 个）`);
  }
  const body = fnNode.childForFieldName('body');
  if (!body) throw new Error(`函数 ${fn.name} 无函数体节点`);

  let cfg = buildFnCfg(body, pre.clean, {
    condRegions: pre.condRegions,
    originalLines: pre.originalLines,
    fnRowFrom: fnNode.startPosition.row,
    fnRowTo: fnNode.endPosition.row,
  });
  if (cfg.nodes.filter(n => !n.dead).length > MAX_NODES) {
    cfg = collapseCfg(cfg, MAX_NODES);
  }
  const { mmd, framedMacros } = emitMermaid(cfg, { outerMacros: fn.conditionalFlags });
  return { mermaid: mmd, warnings: cfg.warnings, degraded: cfg.degraded, framedMacros };
}

/**
 * L3 兜底：fn.bodyText 按括号深度切语句的顺序链 START→块→…→END。
 * 结构上构造性 lint 全绿（单链无分支）；标签走与主路径相同的 sanitizeLabel 清洗。
 */
export function buildFallbackFlowchart(fn: FunctionUnit): string {
  // 剥注释/字符串/字符常量后再切分（regex 同 moduleAnalyzer cyclomaticComplexity）
  const stripped = (fn.bodyText ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])'/g, "''")
    // bodyText 自带函数体外层花括号：剥掉后语句切分以深度 0 为基准
    .replace(/^\s*\{/, '')
    .replace(/\}\s*$/, '');

  // 括号深度 0 处的 ; 与闭合 } 为切点（for(;;) 内分号有圆括号深度保护）
  const chunks: string[] = [];
  let depth = 0, paren = 0, cur = '';
  for (const ch of stripped) {
    cur += ch;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0 && paren === 0) { chunks.push(cur); cur = ''; } }
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === ';' && depth === 0 && paren === 0) { chunks.push(cur); cur = ''; }
  }
  if (cur.trim()) chunks.push(cur);

  // 清洗切块：空块丢弃
  const blocks = chunks.map(c => c.trim()).filter(c => c.length > 0);

  const lines: string[] = ['flowchart TD', '    START(["开始"])'];
  if (blocks.length === 0) {
    lines.push('    START --> END');
  } else {
    const shown = blocks.slice(0, L3_MAX_BLOCKS);
    const hidden = blocks.length - shown.length;
    let prev = 'START';
    shown.forEach((b, i) => {
      lines.push(`    N${i}["${sanitizeLabel(b)}"]`);
      lines.push(`    ${prev} --> N${i}`);
      prev = `N${i}`;
    });
    if (hidden > 0) {
      lines.push(`    NX["…（后续共 ${hidden} 条语句）"]`);
      lines.push(`    ${prev} --> NX`);
      prev = 'NX';
    }
    lines.push(`    ${prev} --> END`);
  }
  lines.push('    END(["结束"])');
  return lines.join('\n');
}
