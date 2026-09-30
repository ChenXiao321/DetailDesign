import { createHash } from 'node:crypto';
import type Parser from 'web-tree-sitter';
import { parseCFile, preprocessSource, walkTopLevel, collectBodyRefs, nodeText, ParsedCFile, PreprocessedSource } from '../parser/cParser.js';
import { parseHeaderComment } from '../parser/commentParser.js';
import type {
  ModuleModel, FunctionUnit, VariableUnit, TypeUnit,
  ExternalInterface, ConfigMacro, ConfigUsage, HeaderComment, Parameter, PolarionMarker,
} from '../model/types.js';
import { SCHEMA_VERSION } from '../model/types.js';

export interface InputFile {
  /** 相对路径，如 Gp_EcuStpStdn/Gp_EcuStpShdn.c */
  path: string;
  content: string;
}

type FileRole = 'source' | 'header' | 'types' | 'config' | 'callout' | 'memmap';

function detectRole(fileName: string): FileRole {
  if (/_Memmap\.h$/i.test(fileName)) return 'memmap';
  if (/_Callout\.[ch]$/i.test(fileName)) return 'callout';
  if (/_Types\.h$/i.test(fileName)) return 'types';
  if (/_Cfg(Data)?\.[ch]$/i.test(fileName)) return 'config';
  if (/\.c$/i.test(fileName)) return 'source';
  return 'header';
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** 提取文件的 #include 头文件名（用于 4.2 文件包含关系） */
function extractIncludes(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm)) {
    out.push(m[1]);
  }
  return [...new Set(out)];
}

/** 归一化：剥注释 + 压缩空白 */
function normalizeCode(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 向上查找紧邻的块注释（函数头注释） */
function findPrecedingComment(lines: string[], startRow: number): string | null {
  let row = startRow - 1;
  while (row >= 0 && lines[row].trim() === '') row--;
  if (row < 0) return null;
  const endLine = lines[row].trimEnd();
  if (!/\*\/\s*$/.test(endLine)) return null;
  let begin = row;
  while (begin >= 0 && !lines[begin].includes('/*')) begin--;
  if (begin < 0) return null;
  return lines.slice(begin, row + 1).join('\n');
}

/** 提取同行行尾注释，或上一行独立注释 */
function extractInlineComment(line: string, prevLine: string | undefined): string | null {
  const m = line.match(/\/\*(.+?)\*\//);
  const text = m ? m[1].trim() : (() => {
    if (!prevLine) return null;
    const p = prevLine.match(/^\s*\/\*([^*].*?)\*\/\s*$/) || prevLine.match(/^\s*\/\/\s*(.+)$/);
    return p ? p[1].trim() : null;
  })();
  // 过滤代码中的占位符标记（如 $TDST-B$）
  if (text && /^\$.*\$$/.test(text)) return null;
  return text;
}

/** 取声明器的最内层标识符（穿透指针/数组/函数指针/括号包裹） */
function innermostIdentifier(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
  if (node.type === 'identifier' || node.type === 'field_identifier') return node;
  const d = node.childForFieldName('declarator');
  if (d) {
    const r = innermostIdentifier(d);
    if (r) return r;
  }
  for (const c of node.namedChildren) {
    const r = innermostIdentifier(c);
    if (r) return r;
  }
  return null;
}

/** 解析 struct 成员声明 → { name, type }（指针/数组/函数指针归一到类型列） */
function parseFieldDecl(fieldText: string, declText: string, name: string): { name: string; type: string } {
  const full = normalizeCode(fieldText.replace(/;\s*$/, ''));
  if (declText.includes('(*')) {
    // 函数指针：void (*Name)(params) → void (*)(params)
    return { name, type: normalizeCode(full.replace(name, '')) };
  }
  const ptr = (declText.match(/\*/g) ?? []).join('');
  const arr = declText.match(/\[.*\]/)?.[0] ?? '';
  const base = normalizeCode(full.replace(declText, ''));
  return { name, type: base + (ptr ? ` ${ptr}` : '') + arr };
}

interface RawFunction {
  name: string;
  returnType: string;
  parameters: Parameter[];
  isStatic: boolean;
  file: string;
  lineStart: number;
  lineEnd: number;
  comment: HeaderComment | null;
  calls: string[];
  identifiers: string[];
  conditionalFlags: string[];
  innerCondFlags?: string[];    // 函数体内部条件编译段的宏
  bodyText: string;
  bodyTextWithPP?: string;      // 含 #if/#endif 指令行的函数体（仅体内有条件编译段时填）
  signature: string;
  complexity: number;         // 圈复杂度（仅定义函数有；原型为 0）
  infiniteLoop: boolean;      // 含 while(1)/for(;;) 死循环
}

type TSNode = import('web-tree-sitter').SyntaxNode;

/** 从 function_definition 或 declaration(原型) 提取函数信息 */
function extractFunction(
  node: TSNode,
  file: ParsedCFile,
  filePath: string,
  condFlags: string[],
  isDefinition: boolean,
  pre: PreprocessedSource,
): RawFunction | null {
  let declarator: TSNode | null = null;
  let body: TSNode | null = null;

  if (isDefinition) {
    declarator = node.childForFieldName('declarator');
    body = node.childForFieldName('body');
  } else {
    for (const child of node.namedChildren) {
      if (child.type === 'function_declarator') { declarator = child; break; }
      if (child.type === 'init_declarator') {
        const inner = child.childForFieldName('declarator');
        if (inner && inner.type === 'function_declarator') declarator = inner;
      }
    }
  }
  if (!declarator) return null;

  // 函数名（剥嵌套 declarator）
  let nameNode = declarator.childForFieldName('declarator');
  while (nameNode && nameNode.type !== 'identifier') {
    nameNode = nameNode.childForFieldName('declarator') ?? nameNode.namedChildren[0] ?? null;
  }
  if (!nameNode) return null;
  const name = nodeText(nameNode, file.source);

  // declarator 之前的文本：返回类型 + 存储类
  const prefix = file.source.slice(node.startIndex, declarator.startIndex);
  const isStatic = /\bstatic\b/.test(prefix) || /_STATIC_\b/.test(prefix);
  const returnType = normalizeCode(
    prefix.replace(/\bstatic\b/g, '').replace(/\b\w*_STATIC_\b/g, '').replace(/\bextern\b/g, ''),
  );

  // 参数
  const parameters: Parameter[] = [];
  const paramList = declarator.childForFieldName('parameters');
  if (paramList) {
    for (const p of paramList.namedChildren) {
      if (p.type !== 'parameter_declaration') continue;
      const typeNode = p.childForFieldName('type');
      const declNode = p.childForFieldName('declarator');
      const pType = typeNode ? normalizeCode(nodeText(typeNode, file.source)) : '';
      let pName = '';
      let pointerDepth = 0;
      if (declNode) {
        if (declNode.type === 'identifier') {
          pName = nodeText(declNode, file.source);
        } else {
          const text = nodeText(declNode, file.source);
          pointerDepth = (text.match(/\*/g) ?? []).length;
          const idMatch = text.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
          if (idMatch) pName = idMatch[1];
        }
      }
      if (pType === 'void' && !pName) continue;
      parameters.push({ type: pType, name: pName, pointerDepth });
    }
  }

  const paramStr = parameters.map(p => `${p.type}${'*'.repeat(p.pointerDepth)} ${p.name}`.trim()).join(', ');
  const signature = `${returnType} ${name}(${paramStr || 'void'})`;

  const commentBlock = findPrecedingComment(file.lines, node.startPosition.row);
  const comment = commentBlock ? parseHeaderComment(commentBlock) : null;

  let calls: string[] = [];
  let identifiers: string[] = [];
  let bodyText = '';
  let innerCondFlags: string[] | undefined;
  let bodyTextWithPP: string | undefined;
  if (body) {
    const refs = collectBodyRefs(body, file.source);
    calls = refs.calls;
    identifiers = refs.identifiers;
    bodyText = nodeText(body, file.source);
    // 函数体内部的条件编译段（区域完全落在函数体内；包裹整个函数的外层区域已由 condFlags 表达）
    const innerRegions = pre.condRegions.filter(
      r => r.from > node.startPosition.row && r.to <= node.endPosition.row,
    );
    if (innerRegions.length > 0) {
      innerCondFlags = [...new Set(innerRegions.map(r => r.macro))];
      // bodyText 来自预处理后的 clean 源（# 指令行已置空格），LLM 看不到 #if 位置；
      // 这里从原始行重建含指令行的版本，供流程图 prompt 圈虚线框用
      bodyTextWithPP = pre.originalLines
        .slice(body.startPosition.row, body.endPosition.row + 1)
        .join('\n');
    }
  }

  return {
    name, returnType, parameters, isStatic,
    file: filePath,
    lineStart: node.startPosition.row + 1,
    lineEnd: node.endPosition.row + 1,
    comment, calls, identifiers,
    conditionalFlags: condFlags,
    innerCondFlags,
    bodyText, bodyTextWithPP, signature,
    complexity: bodyText ? cyclomaticComplexity(bodyText) : 0,
    infiniteLoop: bodyText ? hasInfiniteLoop(bodyText) : false,
  };
}

function makeMarker(chapter: string, kind: PolarionMarker['workItemKind'], title: string, isWorkItem = true): PolarionMarker {
  return { isWorkItem, chapter, workItemKind: kind, title, workItemId: null };
}

/** 圈复杂度（判定节点计数法）：1 + if/for/while/case/&&/||/?: 数量；注释与字符串先剥离 */
export function cyclomaticComplexity(body: string): number {
  const clean = body
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ')
    .replace(/'(?:\\.|[^'\\])'/g, ' ');
  const count = (re: RegExp) => (clean.match(re) ?? []).length;
  return 1
    + count(/\bif\b/g) + count(/\bfor\b/g) + count(/\bwhile\b/g) + count(/\bcase\b/g)
    + count(/&&/g) + count(/\|\|/g) + count(/\?/g);
}

/** 死循环探测：while(1)/while(TRUE)/for(;;) */
export function hasInfiniteLoop(body: string): boolean {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  return /\bwhile\s*\(\s*(1|TRUE|true)\s*\)/.test(clean) || /\bfor\s*\(\s*;\s*;?\s*\)/.test(clean);
}

/** 从原始源码按行扫描宏定义（#define），含注释与生效条件 */
function extractMacros(
  pre: PreprocessedSource,
  filePath: string,
  filter: (name: string) => boolean,
): ConfigMacro[] {
  const macros: ConfigMacro[] = [];
  for (let i = 0; i < pre.originalLines.length; i++) {
    const line = pre.originalLines[i];
    const m = line.match(/^\s*#\s*define\s+([A-Za-z_][A-Za-z0-9_]*)(\([^)]*\))?\s*(.*?)\s*$/);
    if (!m) continue;
    const [, name, args, rawValue] = m;
    if (!filter(name)) continue;
    const value = normalizeCode(rawValue.replace(/\/\*.*?\*\//g, ''));
    // 分类：无参函数式宏且取值仅为另一宏调用 → alias（实现别名，非配置项）；
    // 值（去括号）为 STD_ON/STD_OFF 的特性开关 → functional（6.2）；其余 → general（6.1）
    const bare = value.replace(/[()\s]/g, '');
    const isAlias = !!args && args === '()' && /^[A-Za-z_][A-Za-z0-9_]*\s*\(.*\)$/.test(value);
    const kind: ConfigMacro['kind'] = isAlias ? 'alias'
      : (bare === 'STD_ON' || bare === 'STD_OFF') ? 'functional' : 'general';
    macros.push({
      name,
      value,
      isFunctionLike: !!args,
      comment: extractInlineComment(line, pre.originalLines[i - 1]),
      file: filePath,
      kind,
      usages: [],
      affects: [],
      polarion: makeMarker(kind === 'alias' ? '6' : kind === 'functional' ? '6.2' : '6.1', 'config', name, false),
    });
  }
  return macros;
}

/** 扫描配置宏在模块内的使用点（基于原始源码行，排除 #define 定义行与 #endif/#else 收尾行） */
function scanConfigUsages(
  parsed: { input: InputFile; pre: PreprocessedSource }[],
  macros: ConfigMacro[],
): void {
  for (const macro of macros) {
    const wordRe = new RegExp(`\\b${macro.name}\\b`);
    const usages: ConfigUsage[] = [];
    for (const { input, pre } of parsed) {
      for (let i = 0; i < pre.originalLines.length; i++) {
        const line = pre.originalLines[i];
        if (!wordRe.test(line)) continue;
        const trimmed = line.trim();
        if (/^#\s*define/.test(trimmed)) continue;            // 定义行
        if (/^#\s*(endif|else)\b/.test(trimmed)) continue;    // 区域收尾行（注释里重复宏名）
        if (/^(\/\/|\/\*|\*)/.test(trimmed)) continue;        // 纯注释行
        let kind: ConfigUsage['kind'];
        if (/^#\s*(if|elif)\b/.test(trimmed)) kind = 'condCompile';
        else if (macro.isFunctionLike && new RegExp(`\\b${macro.name}\\s*\\(`).test(line)) kind = 'call';
        else if (new RegExp(`\\[[^\\]]*\\b${macro.name}\\b`).test(line)) kind = 'arrayDim';
        else if (/\bfor\s*\(/.test(line)) kind = 'loopBound';
        else kind = 'reference';
        usages.push({ kind, file: input.path, line: i + 1, context: trimmed.slice(0, 80) });
      }
    }
    macro.usages = usages;
  }
}

/** 分析整个模块，产出中间模型 */
export async function analyzeModule(files: InputFile[], moduleName?: string): Promise<ModuleModel> {
  const parsed: { input: InputFile; role: FileRole; pre: PreprocessedSource; file: ParsedCFile }[] = [];
  const fileInfos: { path: string; role: FileRole; includes: string[] }[] = [];
  for (const input of files) {
    const base = input.path.split(/[\\/]/).pop()!;
    const role = detectRole(base);
    // Memmap 文件不解析（纯 pragma 包装），但保留在文件清单中
    fileInfos.push({ path: input.path, role, includes: extractIncludes(input.content) });
    if (role === 'memmap') continue;
    const pre = preprocessSource(input.content);
    parsed.push({ input, role, pre, file: await parseCFile(pre.clean) });
  }

  const mainSource = parsed.find(p => p.role === 'source');
  const module = moduleName ?? (mainSource ? mainSource.input.path.split(/[\\/]/).pop()!.replace(/\.c$/i, '') : 'UnknownModule');

  const definedFunctions: RawFunction[] = [];   // 仅主 .c
  const prototypes: RawFunction[] = [];          // 头文件 + Callout（含 Callout.c 定义）
  const variables: VariableUnit[] = [];
  const types: TypeUnit[] = [];
  const configMacros: ConfigMacro[] = [];
  const typeDefines: ConfigMacro[] = [];         // Types.h 里的枚举式宏

  for (const { input, role, pre, file } of parsed) {
    // ---------- 宏提取（基于原始源码，与语法树无关） ----------
    if (role === 'config') {
      configMacros.push(...extractMacros(pre, input.path,
        n => !/_H_$/.test(n) && !/_(START|STOP)$/.test(n)));
    }
    if (role === 'types') {
      typeDefines.push(...extractMacros(pre, input.path, n => !/_H_$/.test(n)));
    }

    walkTopLevel(file.tree, (node) => {
      const condFlags = pre.condFlagsAt(node.startPosition.row);

      // ---------- 函数定义：只有主 .c 才算模块函数 ----------
      if (node.type === 'function_definition') {
        const fn = extractFunction(node, file, input.path, condFlags, true, pre);
        if (!fn) return;
        if (role === 'source') definedFunctions.push(fn);
        else if (role === 'callout') prototypes.push(fn);  // Callout 实现 → 外部接口声明
        return;
      }
      // ---------- 函数原型 / 变量 ----------
      if (node.type === 'declaration') {
        const hasFuncDecl = node.namedChildren.some(c =>
          c.type === 'function_declarator' ||
          (c.type === 'init_declarator' && c.childForFieldName('declarator')?.type === 'function_declarator'));
        if (hasFuncDecl) {
          if (role === 'header' || role === 'callout') {
            const proto = extractFunction(node, file, input.path, condFlags, false, pre);
            if (proto) prototypes.push(proto);
          }
          return;
        }
        // 变量（仅主 .c 的模块级变量）
        if (role !== 'source') return;
        let varName: string | null = null;
        let declStart = node.endIndex;
        for (const child of node.namedChildren) {
          if (child.type === 'init_declarator' || child.type === 'array_declarator' || child.type === 'identifier') {
            declStart = child.startIndex;
            const t = nodeText(child, file.source);
            const m = t.match(/([A-Za-z_][A-Za-z0-9_]*)/);
            if (m) { varName = m[1]; break; }
          }
        }
        if (!varName) return;
        const typePart = file.source.slice(node.startIndex, declStart);
        const row = node.startPosition.row;
        variables.push({
          id: `${module}::${varName}`,
          name: varName,
          type: normalizeCode(typePart.replace(/\b\w*_STATIC_\b/g, 'static')),
          isStatic: /\bstatic\b/.test(typePart) || /_STATIC_\b/.test(typePart),
          isConst: /\bconst\b/.test(typePart),
          isVolatile: /\bvolatile\b/.test(typePart),
          file: input.path,
          line: row + 1,
          comment: extractInlineComment(pre.originalLines[row] ?? '', pre.originalLines[row - 1]),
          conditionalFlags: condFlags,
          polarion: makeMarker('5.2.4.1', 'variable', varName, false),
        });
        return;
      }
      // ---------- typedef / struct（仅 Types.h） ----------
      if (node.type === 'type_definition' && role === 'types') {
        const text = nodeText(node, file.source);
        const isStruct = /\bstruct\b/.test(text);
        const typeNode = node.childForFieldName('type');
        const declNode = node.childForFieldName('declarator');
        if (!declNode) return;
        const name = nodeText(declNode, file.source);
        let elements: TypeUnit['elements'];
        if (isStruct && typeNode) {
          elements = [];
          const bodyNode = typeNode.namedChildren.find(c => c.type === 'field_declaration_list');
          if (bodyNode) {
            for (const field of bodyNode.namedChildren) {
              if (field.type !== 'field_declaration') continue;
              const fDecl = field.childForFieldName('declarator');
              const fRow = field.startPosition.row;
              const declText = fDecl ? nodeText(fDecl, file.source) : '';
              const nameNode = fDecl ? innermostIdentifier(fDecl) : null;
              const parsed = parseFieldDecl(
                nodeText(field, file.source),
                declText,
                nameNode ? nodeText(nameNode, file.source) : normalizeCode(declText),
              );
              elements.push({
                name: parsed.name,
                type: parsed.type,
                comment: extractInlineComment(pre.originalLines[fRow] ?? '', undefined),
              });
            }
          }
        }
        types.push({
          id: `${module}::${name}`,
          name,
          kind: isStruct ? 'struct' : 'typedef',
          underlyingType: typeNode && !isStruct ? normalizeCode(nodeText(typeNode, file.source)) : undefined,
          elements,
          comment: extractInlineComment(
            pre.originalLines[node.startPosition.row] ?? '',
            pre.originalLines[node.startPosition.row - 1],
          ),
          file: input.path,
          polarion: makeMarker('5.2.1.2', 'type', name, false),
        });
        return;
      }
    });
  }

  // ---------- typedef 关联枚举宏 ----------
  for (const define of typeDefines) {
    let best: TypeUnit | null = null;
    let bestLen = 0;
    for (const t of types) {
      const typePrefix = 'GP_' + t.name.replace(/^Gp_/, '').replace(/Type$/, '').toUpperCase() + '_';
      if (define.name.startsWith(typePrefix) && typePrefix.length > bestLen) {
        best = t; bestLen = typePrefix.length;
      }
    }
    if (best) (best.relatedDefines ??= []).push(define);
  }

  // ---------- 交叉引用 ----------
  const definedNames = new Set(definedFunctions.map(f => f.name));
  const protoByName = new Map<string, RawFunction>();
  for (const p of prototypes) if (!protoByName.has(p.name)) protoByName.set(p.name, p);
  const globalNames = new Set(variables.map(v => v.name));

  const externalMap = new Map<string, ExternalInterface>();
  for (const fn of definedFunctions) {
    for (const callee of fn.calls) {
      if (definedNames.has(callee) || callee.startsWith('(*)')) continue;
      if (/^[A-Z_0-9]+$/.test(callee)) continue;   // 宏调用（NOP 等）
      let ext = externalMap.get(callee);
      if (!ext) {
        const proto = protoByName.get(callee);
        let group: string;
        if (proto && /Callout/.test(proto.file)) {
          group = 'Callout';
        } else if (proto) {
          group = proto.file.split(/[\\/]/).pop()!;
        } else {
          group = callee.match(/^(Gp_[A-Za-z]+)_/)?.[1] ?? 'External';
        }
        ext = {
          name: callee,
          signature: proto?.signature ?? '',
          group,
          comment: proto?.comment ?? null,
          commentSource: proto?.comment ? 'header' : undefined,
          calledFrom: [],
          // Callout 是集成方实现的功能配置点 → 6.2，每个 Callout 一个工作项；其余外部接口 → 5.2.2.2
          polarion: group === 'Callout'
            ? makeMarker('6.2', 'function', callee, true)
            : makeMarker('5.2.2.2', 'table', `${group} 接口函数`, true),
        };
        externalMap.set(callee, ext);
      }
      if (!ext.calledFrom.includes(fn.name)) ext.calledFrom.push(fn.name);
    }
  }

  // Callout 函数指针引用（出现在配置表初始化中但未被直接调用，如 InitStageTwoCore1-5）
  const mainClean = mainSource?.pre.clean ?? '';
  for (const proto of prototypes) {
    if (definedNames.has(proto.name) || externalMap.has(proto.name)) continue;
    if (!/Callout/.test(proto.file)) continue;
    if (!new RegExp(`\\b${proto.name}\\b`).test(mainClean)) continue;
    externalMap.set(proto.name, {
      name: proto.name,
      signature: proto.signature,
      group: 'Callout',
      comment: proto.comment ?? null,
      commentSource: proto.comment ? 'header' : undefined,
      calledFrom: ['(rtSatCont 配置表函数指针引用)'],
      polarion: makeMarker('6.2', 'function', proto.name, true),
    });
  }

  // ---------- 组装 FunctionUnit ----------
  const toUnit = (fn: RawFunction, chapter: string, kind: PolarionMarker['workItemKind']): FunctionUnit => ({
    id: `${module}::${fn.name}`,
    name: fn.name,
    signature: fn.signature,
    returnType: fn.returnType,
    parameters: fn.parameters,
    isStatic: fn.isStatic,
    file: fn.file,
    lineStart: fn.lineStart,
    lineEnd: fn.lineEnd,
    comment: fn.comment,
    calls: fn.calls,
    calledBy: definedFunctions.filter(other => other.name !== fn.name && other.calls.includes(fn.name)).map(o => o.name),
    globalsAccessed: fn.identifiers.filter(id => globalNames.has(id)),
    conditionalFlags: fn.conditionalFlags,
    innerCondFlags: fn.innerCondFlags,
    bodyText: fn.bodyText.length > 8000 ? fn.bodyText.slice(0, 8000) + '\n/* ...(截断) */' : fn.bodyText,
    bodyTextWithPP: fn.bodyTextWithPP
      ? (fn.bodyTextWithPP.length > 8500 ? fn.bodyTextWithPP.slice(0, 8500) + '\n/* ...(截断) */' : fn.bodyTextWithPP)
      : undefined,
    bodyHash: sha256(normalizeCode(fn.bodyText)),
    sigHash: sha256(normalizeCode(fn.signature)),
    complexity: fn.complexity,
    infiniteLoop: fn.infiniteLoop,
    polarion: makeMarker(chapter, kind, fn.name, true),
  });

  const providedFunctions = definedFunctions
    .filter(f => !f.isStatic)
    .map(f => toUnit(f, '5.2.3.2', 'function'))
    .sort((a, b) => a.lineStart - b.lineStart);
  const internalFunctions = definedFunctions
    .filter(f => f.isStatic)
    .map(f => toUnit(f, '5.2.4.2', 'function'))
    .sort((a, b) => a.lineStart - b.lineStart);

  // ---------- 配置宏用法扫描 + 影响范围回填 ----------
  scanConfigUsages(parsed, configMacros);
  for (const macro of configMacros) {
    const affected = new Set<string>();
    for (const fn of [...providedFunctions, ...internalFunctions]) {
      if (fn.conditionalFlags.includes(macro.name)) affected.add(fn.name);
    }
    for (const v of variables) {
      if (v.conditionalFlags.includes(macro.name)) affected.add(v.name);
    }
    macro.affects = [...affected].sort();
  }

  // ---------- 5.1 功能接口总图（静态生成；作为工作项随模型进 diff/同步） ----------
  // Callout 属本模块配置代码，不进总图（其调用关系见内部函数调用图与 6.2 Callout function）
  // 长标识符按模块前缀折行/去前缀，控制节点宽度避免导出超页宽
  const shortName = (n: string) => n.startsWith(`${module}_`) ? n.slice(module.length + 1) : n;
  const wrapName = (n: string) => n.startsWith(`${module}_`) ? `${module}_<br/>${n.slice(module.length + 1)}` : n;
  // 提供的接口节点按列平铺（direction TB + 每列一条隐形竖链），列数随接口数自适应，避免单列过长
  // init 指令：本图单独收紧 rank/nodeSpacing——MOD 框内标题与成员、成员行间默认 61px 偏空（用户反馈）。
  // 框内行距 = rankSpacing + 8（mermaid.min.js 已补丁，cluster 子图内层距原 +25 改 +8），
  // 顶层横向（Caller→MOD→组节点）通道 = rankSpacing + 25，两方向由此解耦；
  // rankSpacing 勿写 0（falsy 会被 mermaid 回退默认 50）
  const ov: string[] = ['%%{init: {"flowchart": {"rankSpacing": 10, "nodeSpacing": 16}}}%%', 'flowchart LR'];
  ov.push('    Caller(["外部调用方<br/>（其他 FC / RTE / 集成代码）"])');
  // 标题做成框内透明节点（标题文字+横线分隔，与右侧 External 组节点同款），不用 subgraph
  // 自带标题——subgraph 标题折成两行时 mermaid 只预留一行高度，第二行被首个成员节点遮挡
  // （IoMcuAdc 总图「（4 个）」被 Init 节点盖住，用户截图反馈，要求像右侧一样横线分隔）
  ov.push('    subgraph MOD[" "]');
  ov.push('        direction TB');
  ov.push(`        MT["<b>${module}</b><br/><b>提供的外部接口</b>（${providedFunctions.length} 个）<br/>────────────"]`);
  const ovCols = providedFunctions.length <= 4 ? 1 : Math.ceil(providedFunctions.length / 4);
  const ovRows = Math.ceil(providedFunctions.length / Math.max(ovCols, 1));
  for (let c = 0; c < ovCols; c++) {
    const col = providedFunctions.slice(c * ovRows, (c + 1) * ovRows);
    if (col.length > 0) {
      ov.push('        MT ~~~ ' + col.map(f => `P${c * ovRows + col.indexOf(f)}("${wrapName(f.name)}")`).join(' ~~~ '));
    }
  }
  ov.push('    end');
  const ovGroups = new Map<string, ExternalInterface[]>();
  for (const e of [...externalMap.values()]
    .filter(e => e.group !== 'Callout')
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))) {
    if (!ovGroups.has(e.group)) ovGroups.set(e.group, []);
    ovGroups.get(e.group)!.push(e);
  }
  [...ovGroups.entries()].forEach(([group, items], gi) => {
    const lines = items.map(e => shortName(e.name));
    ov.push(`    G${gi}["<b>${group}</b>（${items.length} 个）<br/>──────────<br/>${lines.join('<br/>')}"]`);
  });
  ov.push('    Caller -->|call| MOD');
  [...ovGroups.keys()].forEach((_, gi) => ov.push(`    MOD -->|call| G${gi}`));
  // 配色：显式指定填充+文字色，保证对比度（与内部调用图同色板）
  ov.push('    classDef caller fill:#eaeef2,stroke:#57606a,color:#1f2328');
  ov.push('    classDef provided fill:#b6e3ff,stroke:#0969da,color:#0a3069');
  ov.push('    classDef extgroup fill:#f6f8fa,stroke:#57606a,color:#1f2328');
  ov.push('    class Caller caller');
  if (providedFunctions.length > 0) ov.push(`    class ${providedFunctions.map((_, i) => 'P' + i).join(',')} provided`);
  [...ovGroups.keys()].forEach((_, gi) => ov.push(`    class G${gi} extgroup`));
  ov.push('    style MOD fill:#fbfcfd,stroke:#d0d7de,stroke-width:1px');
  ov.push('    style MT fill:transparent,stroke:transparent,color:#1f2328');

  // ---------- 5.1 内部函数调用图（静态生成；按对外接口函数逐张拆分，每张一个工作项） ----------
  // 每张图 = 以某对外接口为根的调用树（内部函数逐层展开 + 命中的 Callout）；
  // 被多处调用的节点沿调用路径重复出现（同名副本），换无交叉的树形布局；
  // 递归/循环调用沿路径截断防死循环；配置表函数指针引用的 Callout 不属于任何函数，单独成图；
  // 无模块内调用的平凡函数不出图；其余跨模块调用（Gp_RstM / Gp_TstApp 等）见总图与 5.2.2
  const cgCallouts = [...externalMap.values()]
    .filter(e => e.group === 'Callout')
    .sort((a, b) => a.name.localeCompare(b.name));
  const calloutNameSet = new Set(cgCallouts.map(e => e.name));
  const fnByName = new Map([...providedFunctions, ...internalFunctions].map(f => [f.name, f] as const));
  const providedNameSet = new Set(providedFunctions.map(f => f.name));
  // 注意：classDef 命名避开 mermaid 保留类名 root（dagre 布局顶层 <g class="root">），
  // 否则 .root span{color:#fff} 会命中整个 SVG 的 span（含边标签），导致标签白字不可见
  const CG_CLASSES = [
    '    classDef entry fill:#0a3069,stroke:#0a3069,color:#ffffff',
    '    classDef internal fill:#eaeef2,stroke:#57606a,color:#1f2328',
    '    classDef provided fill:#b6e3ff,stroke:#0969da,color:#0a3069',
    '    classDef callout fill:#ffe9a8,stroke:#bf8700,color:#1f2328',
  ];
  const CG_MAX_NODES = 60;  // 树展开安全上限，防止病态模块节点爆炸
  const callGraphs: NonNullable<ModuleModel['callGraphs']> = [];

  for (const root of providedFunctions) {
    const lines: string[] = ['flowchart LR'];
    const idsByClass: Record<'entry' | 'internal' | 'provided' | 'callout', string[]> =
      { entry: [], internal: [], provided: [], callout: [] };
    let nodeCount = 0;
    let edgeCount = 0;
    const addNode = (name: string, kind: keyof typeof idsByClass, label?: string): string => {
      const id = `N${nodeCount++}`;
      lines.push(`    ${id}["${label ?? name}"]`);
      idsByClass[kind].push(id);
      return id;
    };
    const rootId = addNode(root.name, 'entry');
    // 按代码中的调用顺序逐层展开；同一父节点下去重，调用路径上的节点不再进入（截断递归）。
    // 子节点排序：叶子（Callout / 无模块内调用的函数）在前、带子树的函数在后（各自保持代码顺序），
    // 使初始布局即为平面树序——子树带不会跨到后续兄弟节点的走线区，dagre 不再产生交叉边
    const hasVisibleChildren = (fn: string, path: ReadonlySet<string>): boolean =>
      (fnByName.get(fn)?.calls ?? []).some(c => calloutNameSet.has(c) || (fnByName.has(c) && !path.has(c)));
    const expand = (parentId: string, fnName: string, path: ReadonlySet<string>): void => {
      if (nodeCount >= CG_MAX_NODES) return;
      const callees = [...new Set(fnByName.get(fnName)?.calls ?? [])];
      const isLeaf = (c: string) =>
        calloutNameSet.has(c) || !fnByName.has(c) || path.has(c) || !hasVisibleChildren(c, path);
      const ordered = [...callees.filter(isLeaf), ...callees.filter(c => !isLeaf(c))];
      for (const callee of ordered) {
        if (nodeCount >= CG_MAX_NODES) break;
        if (calloutNameSet.has(callee)) {
          lines.push(`    ${parentId} -->|call| ${addNode(callee, 'callout', shortName(callee))}`);
          edgeCount++;
        } else if (fnByName.has(callee) && !path.has(callee)) {
          const kind = providedNameSet.has(callee) ? 'provided' : 'internal';
          const cid = addNode(callee, kind);
          lines.push(`    ${parentId} -->|call| ${cid}`);
          edgeCount++;
          expand(cid, callee, new Set([...path, callee]));
        }
      }
    };
    expand(rootId, root.name, new Set([root.name]));
    if (edgeCount === 0) continue;  // 平凡函数无模块内调用，不出图
    lines.push(...CG_CLASSES);
    for (const [kind, ids] of Object.entries(idsByClass)) {
      if (ids.length > 0) lines.push(`    class ${ids.join(',')} ${kind}`);
    }
    callGraphs.push({
      name: root.name,
      diagram: lines.join('\n'),
      diagramFormat: 'mermaid',
      polarion: makeMarker('5.1', 'diagram', `${root.name} 调用图`, true),
    });
  }

  // 配置表函数指针引用（rtSatCont 等）：无直接调用者，单独成图
  const cgId = (name: string) => 'N_' + name.replace(/[^A-Za-z0-9_]/g, '_');
  const cfgRefCallouts = cgCallouts.filter(e => e.calledFrom.some(c => c.startsWith('(')));
  if (cfgRefCallouts.length > 0) {
    const lines = ['flowchart LR', '    N_CfgTbl["配置表函数指针引用"]'];
    for (const e of cfgRefCallouts) {
      lines.push(`    ${cgId(e.name)}["${shortName(e.name)}"]`, `    N_CfgTbl -->|call（函数指针间接调用）| ${cgId(e.name)}`);
    }
    lines.push(...CG_CLASSES, '    class N_CfgTbl internal', `    class ${cfgRefCallouts.map(e => cgId(e.name)).join(',')} callout`);
    callGraphs.push({
      name: '配置表函数指针引用',
      diagram: lines.join('\n'),
      diagramFormat: 'mermaid',
      polarion: makeMarker('5.1', 'diagram', '配置表函数指针引用 调用图', true),
    });
  }

  return {
    module,
    schemaVersion: SCHEMA_VERSION,
    analyzedAt: new Date().toISOString(),
    files: fileInfos,
    providedFunctions,
    internalFunctions,
    internalVariables: variables.filter(v => v.isStatic),
    providedVariables: variables.filter(v => !v.isStatic),
    calledExternalFunctions: [...externalMap.values()].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
    types,
    configMacros,
    interfaceOverview: {
      diagram: ov.join('\n'),
      diagramFormat: 'mermaid',
      polarion: makeMarker('5.1', 'diagram', '功能接口总图', true),
    },
    callGraphs,
  };
}
