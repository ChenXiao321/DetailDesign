import { createRequire } from 'node:module';
import * as path from 'node:path';
import Parser from 'web-tree-sitter';

const require = createRequire(import.meta.url);

let parserInstance: Parser | null = null;

async function initParser(): Promise<Parser> {
  if (parserInstance) return parserInstance;

  // web-tree-sitter 运行时 wasm 与语法 wasm 都从 node_modules 解析
  const runtimeJs = require.resolve('web-tree-sitter');
  const runtimeDir = path.dirname(runtimeJs);
  await Parser.init({
    locateFile: (file: string) => path.join(runtimeDir, file),
  });

  const grammarWasm = require.resolve('tree-sitter-wasms/out/tree-sitter-c.wasm');
  const lang = await Parser.Language.load(grammarWasm);

  const parser = new Parser();
  parser.setLanguage(lang);
  parserInstance = parser;
  return parser;
}

export interface ParsedCFile {
  tree: Parser.Tree;
  source: string;
  lines: string[];
}

export interface PreprocessedSource {
  /** 预处理后的干净 C 源码（行数与原始一致） */
  clean: string;
  /** 原始行 */
  originalLines: string[];
  /** 每行生效的条件编译宏（从原始源码扫描，0-based 行号 → 宏名列表） */
  condFlagsAt: (line: number) => string[];
}

/**
 * 解析前预处理：消除 tree-sitter 无法处理的嵌入式 C 写法。
 * 规则（严格保持行号不变）：
 * 1. 预处理指令行（# 开头）整行替换为空格；其反斜杠续行同样替换
 * 2. 行尾反斜杠（续行符）替换为空格——去掉后 C 语法依然合法
 */
export function preprocessSource(source: string): PreprocessedSource {
  const originalLines = source.split(/\r?\n/);
  const cleanLines = [...originalLines];

  // 条件编译区域扫描（栈式）
  const flagStack: string[] = [];
  const lineFlags: string[][] = [];

  let blankContinuation = false;
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    const trimmed = line.trim();

    // 记录本行生效的条件宏（指令行本身不算）
    lineFlags[i] = [...flagStack];

    if (blankContinuation || trimmed.startsWith('#')) {
      // 条件指令要先更新栈（基于原始文本）
      const mIf = trimmed.match(/^#\s*(?:if|ifdef|ifndef)\s+(.+)$/);
      const mEnd = trimmed.match(/^#\s*endif\b/);
      if (mIf) {
        const expr = mIf[1].replace(/\/\*.*?\*\//g, '').trim();
        const macro = expr.match(/[A-Za-z_][A-Za-z0-9_]*/)?.[0] ?? expr;
        flagStack.push(macro);
      } else if (mEnd) {
        flagStack.pop();
      }
      // #else/#elif 不改变栈深
      blankContinuation = /\\\s*$/.test(line);
      cleanLines[i] = ' '.repeat(line.length);
      continue;
    }
    blankContinuation = false;

    // 行尾续行符 → 空格
    if (/\\\s*$/.test(line)) {
      cleanLines[i] = line.replace(/\\(\s*)$/, ' $1');
    }
  }

  let clean = cleanLines.join('\n');
  // XXX_STATIC_ 宏等价于 static，直接文本替换（保持列偏移无关性，语法树只关心行号）
  clean = clean.replace(/\b\w*_STATIC_\b/g, m => 'static'.padEnd(m.length, ' '));

  return {
    clean,
    originalLines,
    condFlagsAt: (line: number) => lineFlags[line] ?? [],
  };
}

/** 解析一个 C 源文件（传入 preprocessSource().clean） */
export async function parseCFile(source: string): Promise<ParsedCFile> {
  const parser = await initParser();
  const tree = parser.parse(source);
  return { tree, source, lines: source.split('\n') };
}

/** 取节点文本 */
export function nodeText(node: Parser.SyntaxNode, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

/**
 * 遍历顶层声明（穿透 preproc_if/ifdef 包装），回调每个"声明级"节点。
 * 同时记录节点被哪些条件编译宏包裹。
 */
export function walkTopLevel(
  tree: Parser.Tree,
  cb: (node: Parser.SyntaxNode, condFlags: string[]) => void,
): void {
  const root = tree.rootNode;

  function extractCondFlags(node: Parser.SyntaxNode): string[] {
    // preproc_if: "#if" + 表达式; preproc_ifdef: "#ifdef"/"#ifndef" + 名字
    const flags: string[] = [];
    for (const child of node.namedChildren) {
      if (child.type === 'preproc_if' || child.type === 'preproc_ifdef') {
        const text = child.text.split('\n')[0];
        const m = text.match(/#\s*(?:if|ifdef|ifndef)\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*[()].*?)?)/);
        if (m) flags.push(m[1].replace(/[()\s].*$/, ''));
      }
    }
    return flags;
  }

  function walk(node: Parser.SyntaxNode, condFlags: string[]): void {
    for (const child of node.namedChildren) {
      if (child.type === 'preproc_if' || child.type === 'preproc_ifdef') {
        const m = child.text.match(/#\s*(?:if|ifdef|ifndef)\s+([A-Za-z_][A-Za-z0-9_]*)/);
        const flag = m ? m[1] : 'UNKNOWN';
        walk(child, [...condFlags, flag]);
      } else {
        cb(child, condFlags);
      }
    }
  }

  walk(root, []);
}

/** 在函数体内收集调用与被引用的标识符 */
export function collectBodyRefs(body: Parser.SyntaxNode, source: string): {
  calls: string[];
  identifiers: string[];
} {
  const calls = new Set<string>();
  const identifiers = new Set<string>();

  function walk(node: Parser.SyntaxNode): void {
    if (node.type === 'call_expression') {
      const fn = node.childForFieldName('function');
      if (fn) {
        if (fn.type === 'identifier') {
          calls.add(nodeText(fn, source));
        } else if (fn.type === 'field_expression') {
          // ptr->pf() 函数指针调用，记录字段名
          const field = fn.childForFieldName('field');
          if (field) calls.add('(*)->' + nodeText(field, source));
        }
      }
    } else if (node.type === 'identifier') {
      identifiers.add(nodeText(node, source));
    }
    for (const child of node.namedChildren) walk(child);
  }

  walk(body);
  return { calls: [...calls], identifiers: [...identifiers] };
}
