import { createHash } from 'node:crypto';
import type Parser from 'web-tree-sitter';
import { parseCFile, preprocessSource, walkTopLevel, collectBodyRefs, nodeText, ParsedCFile, PreprocessedSource } from '../parser/cParser.js';
import { parseHeaderComment } from '../parser/commentParser.js';
import type {
  ModuleModel, FunctionUnit, VariableUnit, TypeUnit,
  ExternalInterface, ConfigMacro, ConfigUsage, HeaderComment, Parameter, PolarionMarker,
} from '../model/types.js';

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
  bodyText: string;
  signature: string;
}

type TSNode = import('web-tree-sitter').SyntaxNode;

/** 从 function_definition 或 declaration(原型) 提取函数信息 */
function extractFunction(
  node: TSNode,
  file: ParsedCFile,
  filePath: string,
  condFlags: string[],
  isDefinition: boolean,
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
  if (body) {
    const refs = collectBodyRefs(body, file.source);
    calls = refs.calls;
    identifiers = refs.identifiers;
    bodyText = nodeText(body, file.source);
  }

  return {
    name, returnType, parameters, isStatic,
    file: filePath,
    lineStart: node.startPosition.row + 1,
    lineEnd: node.endPosition.row + 1,
    comment, calls, identifiers,
    conditionalFlags: condFlags,
    bodyText, signature,
  };
}

function makeMarker(chapter: string, kind: PolarionMarker['workItemKind'], title: string, isWorkItem = true): PolarionMarker {
  return { isWorkItem, chapter, workItemKind: kind, title, workItemId: null };
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
        const fn = extractFunction(node, file, input.path, condFlags, true);
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
            const proto = extractFunction(node, file, input.path, condFlags, false);
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
    bodyText: fn.bodyText.length > 8000 ? fn.bodyText.slice(0, 8000) + '\n/* ...(截断) */' : fn.bodyText,
    bodyHash: sha256(normalizeCode(fn.bodyText)),
    sigHash: sha256(normalizeCode(fn.signature)),
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
  // 提供的接口节点分两列平铺（direction TB + 两条隐形竖链 → 2 列 × ⌈n/2⌉ 行），避免单列过长
  const ov: string[] = ['flowchart LR'];
  ov.push('    Caller["外部调用方<br/>（其他 FC / RTE / 集成代码）"]');
  ov.push(`    subgraph MOD["${module} 提供的外部接口（${providedFunctions.length} 个）"]`);
  ov.push('        direction TB');
  const ovHalf = Math.ceil(providedFunctions.length / 2);
  const ovChain = (list: FunctionUnit[], offset: number) =>
    '        ' + list.map((f, i) => `P${offset + i}["${f.name}"]`).join(' ~~~ ');
  if (providedFunctions.length > 0) ov.push(ovChain(providedFunctions.slice(0, ovHalf), 0));
  if (providedFunctions.length > ovHalf) ov.push(ovChain(providedFunctions.slice(ovHalf), ovHalf));
  ov.push('    end');
  const ovGroups = new Map<string, ExternalInterface[]>();
  for (const e of [...externalMap.values()].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))) {
    if (!ovGroups.has(e.group)) ovGroups.set(e.group, []);
    ovGroups.get(e.group)!.push(e);
  }
  [...ovGroups.entries()].forEach(([group, items], gi) => {
    const tag = group === 'Callout' ? '（配置代码回调）' : '';
    const lines = items.map(e => e.name);
    ov.push(`    G${gi}["<b>${group}</b>${tag}（${items.length} 个）<br/>──────────<br/>${lines.join('<br/>')}"]`);
  });
  ov.push('    Caller --> MOD');
  [...ovGroups.keys()].forEach((_, gi) => ov.push(`    MOD --> G${gi}`));
  // 配色：显式指定填充+文字色，保证对比度（与内部调用图同色板）
  ov.push('    classDef caller fill:#eaeef2,stroke:#57606a,color:#1f2328');
  ov.push('    classDef provided fill:#b6e3ff,stroke:#0969da,color:#0a3069');
  ov.push('    classDef extgroup fill:#f6f8fa,stroke:#57606a,color:#1f2328');
  ov.push('    classDef calloutgrp fill:#ffe9a8,stroke:#bf8700,color:#1f2328');
  ov.push('    class Caller caller');
  if (providedFunctions.length > 0) ov.push(`    class ${providedFunctions.map((_, i) => 'P' + i).join(',')} provided`);
  [...ovGroups.keys()].forEach((group, gi) => ov.push(`    class G${gi} ${group === 'Callout' ? 'calloutgrp' : 'extgroup'}`));

  // ---------- 5.1 内部函数调用图（静态生成；按对外接口函数逐张拆分，每张一个工作项） ----------
  // 每张图 = 以某对外接口为根的模块内调用闭包（内部函数传递展开 + 直接命中的 Callout）；
  // 配置表函数指针引用的 Callout 不属于任何函数，单独成图；无内部调用的平凡函数不出图
  const cgId = (name: string) => 'N_' + name.replace(/[^A-Za-z0-9_]/g, '_');
  const cgCallouts = [...externalMap.values()]
    .filter(e => e.group === 'Callout')
    .sort((a, b) => a.name.localeCompare(b.name));
  const calloutNameSet = new Set(cgCallouts.map(e => e.name));
  const shortName = (n: string) => n.startsWith(`${module}_`) ? n.slice(module.length + 1) : n;
  const fnByName = new Map([...providedFunctions, ...internalFunctions].map(f => [f.name, f] as const));
  const CG_CLASSES = [
    '    classDef root fill:#0a3069,stroke:#0a3069,color:#ffffff',
    '    classDef internal fill:#eaeef2,stroke:#57606a,color:#1f2328',
    '    classDef callout fill:#ffe9a8,stroke:#bf8700,color:#1f2328',
  ];
  const callGraphs: NonNullable<ModuleModel['callGraphs']> = [];

  for (const root of providedFunctions) {
    const edges: string[] = [];
    const usedInternal: string[] = [];
    const usedCallouts: string[] = [];
    const visited = new Set<string>();
    const queue = [root.name];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const callee of fnByName.get(cur)?.calls ?? []) {
        if (fnByName.has(callee) && callee !== root.name) {
          edges.push(`    ${cgId(cur)} --> ${cgId(callee)}`);
          if (!visited.has(callee) && !usedInternal.includes(callee) && !providedFunctions.some(p => p.name === callee)) usedInternal.push(callee);
          queue.push(callee);
        } else if (calloutNameSet.has(callee)) {
          edges.push(`    ${cgId(cur)} --> ${cgId(callee)}`);
          if (!usedCallouts.includes(callee)) usedCallouts.push(callee);
        }
      }
    }
    if (edges.length === 0) continue;  // 平凡函数无模块内调用，不出图
    // 左右结构（LR）：根节点在左，callee 纵向展开，宽度不随 callee 数量增长，避免导出超页宽
    const lines = ['flowchart LR', `    ${cgId(root.name)}["${root.name}"]`];
    for (const n of usedInternal) lines.push(`    ${cgId(n)}["${n}"]`);
    // 闭包内可能出现的其他对外接口（被内部函数回调）也列为节点
    for (const n of visited) {
      if (n !== root.name && !usedInternal.includes(n)) lines.push(`    ${cgId(n)}["${n}"]`);
    }
    for (const n of usedCallouts) lines.push(`    ${cgId(n)}["${shortName(n)}"]`);
    lines.push(...edges, ...CG_CLASSES, `    class ${cgId(root.name)} root`);
    if (usedInternal.length > 0) lines.push(`    class ${usedInternal.map(cgId).join(',')} internal`);
    if (usedCallouts.length > 0) lines.push(`    class ${usedCallouts.map(cgId).join(',')} callout`);
    callGraphs.push({
      name: root.name,
      diagram: lines.join('\n'),
      diagramFormat: 'mermaid',
      polarion: makeMarker('5.1', 'diagram', `${root.name} 调用图`, true),
    });
  }

  // 配置表函数指针引用（rtSatCont 等）：无直接调用者，单独成图
  const cfgRefCallouts = cgCallouts.filter(e => e.calledFrom.some(c => c.startsWith('(')));
  if (cfgRefCallouts.length > 0) {
    const lines = ['flowchart LR', '    N_CfgTbl["配置表函数指针引用"]'];
    for (const e of cfgRefCallouts) {
      lines.push(`    ${cgId(e.name)}["${shortName(e.name)}"]`, `    N_CfgTbl --> ${cgId(e.name)}`);
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
