/**
 * 确定性序列图桥接（第二步）：ModuleModel + FunctionUnit + readSource → mermaid sequenceDiagram。
 *
 * 口径（全部来自既有定调）：
 *  - 参与者只建模块粒度：OS（participant）+ 本模块 + 交互的外部模块（calledExternalFunctions
 *    的 group，如 Gp_RstM / Gp_TstApp），别名=去 Gp_ 前缀；声明顺序=OS、本模块、外部首用序
 *  - Callout 属本模块 → 自调用（本模块->>本模块: CalloutXxx()），不建参与者（09-11 定调）；
 *    模块内函数（provided/internal）与宏未知调用（NOP 等）同样自调用（v6 口径）
 *  - 入口固定 OS->>本模块: FnName()；GetCoreId 返回值若是声明式初始化（cfgBuilder 定义
 *    不进图会漏画）则按 v6 口径在入口处补一条自调用
 *  - 多核角色分支（GetCoreId 紧邻比较，roleEdgeForLabel 同 SM 口径）→ 主核/从核各一张图；
 *    两图逐字节相同则并回单图（行为无角色差异不分图）
 *  - 降级阶梯：CFG 正常走 L0；readSource 缺失/定位失败/异常 → L3 平铺图
 *    （fn.calls 按代码出现顺序直发，无组合片段），任意函数必出图
 *  - 内置断言网：lintMermaidSource + lintSequenceStructure 全绿才入库（构造性保证，
 *    命中即工具链 bug，记 warnings 不中断）
 */
import { locateFnCfg, COREID_ASSIGN_RE, roleEdgeForLabel } from '../analyzer/stateMachineBuilder.js';
import { buildSequenceEvents, type SeqEvent } from '../analyzer/sequenceBuilder.js';
import { lintMermaidSource, lintSequenceStructure } from '../report/mermaidPre.js';
import type { FunctionUnit, ModuleModel } from '../model/types.js';

export interface StaticSequenceResult {
  parts: { role: string | null; diagram: string }[];
  warnings: string[];
  degraded: 'none' | 'flat';
}

/** 别名：Gp_RstM → RstM；无 Gp_ 前缀按原名（非法字符剥除） */
function aliasOf(group: string): string {
  const s = group.replace(/^Gp_/, '').replace(/[^A-Za-z0-9_]/g, '');
  return s || 'M';
}

export async function buildStaticSequence(
  model: ModuleModel,
  fn: FunctionUnit,
  readSource?: (relPath: string) => string | null,
): Promise<StaticSequenceResult> {
  const warnings: string[] = [];
  const selfAlias = aliasOf(model.module);

  // ---- 参与者归属：外部接口查 group（Callout 组=本模块）；模块内函数/宏未知 → 自调用 ----
  const extByName = new Map(model.calledExternalFunctions.map(e => [e.name, e]));
  const internalNames = new Set([...model.providedFunctions, ...model.internalFunctions].map(f => f.name));
  const aliasGroup = new Map<string, string>(); // 外部参与者别名 → 原组名（声明行 as 还原用）
  const resolveParticipant = (callee: string): string => {
    const ext = extByName.get(callee);
    if (ext) {
      if (ext.group === 'Callout') return selfAlias;
      const a = aliasOf(ext.group);
      aliasGroup.set(a, ext.group);
      return a;
    }
    if (internalNames.has(callee)) return selfAlias;
    return selfAlias; // 宏/未登记调用（NOP 等）按自调用（与 v6 口径一致）
  };

  // ---- L3 平铺兜底：fn.calls（代码出现顺序）直发，无组合片段 ----
  const flat = (): StaticSequenceResult => {
    const extAliases: string[] = [];
    for (const c of fn.calls) {
      const to = resolveParticipant(c);
      if (to !== selfAlias && !extAliases.includes(to)) extAliases.push(to);
    }
    const lines = ['sequenceDiagram', '    participant OS as OS', `    participant ${selfAlias} as ${model.module}`];
    for (const a of extAliases) lines.push(`    participant ${a} as ${aliasGroup.get(a) ?? a}`);
    lines.push('', `    OS->>${selfAlias}: ${fn.name}()`);
    for (const c of fn.calls) lines.push(`    ${selfAlias}->>${resolveParticipant(c)}: ${c}()`);
    return { parts: [{ role: null, diagram: lines.join('\n') }], warnings, degraded: 'flat' };
  };

  const src = readSource?.(fn.file);
  if (!src) {
    warnings.push(`读不到 ${fn.file}，${fn.name} 序列图走平铺兜底`);
    return flat();
  }

  try {
    const { cfg } = await locateFnCfg(fn, src);
    const coreIdVars: string[] = [];
    for (const m of (fn.bodyText ?? '').matchAll(new RegExp(COREID_ASSIGN_RE, 'g'))) {
      if (!coreIdVars.includes(m[1])) coreIdVars.push(m[1]);
    }
    // 角色分支存在性：纯扫 cond 标签（与 SM 同口径，无需走 CFG）
    const hasRoleCond = coreIdVars.length > 0
      && cfg.nodes.some(n => n.kind === 'cond' && !n.dead && roleEdgeForLabel(n.label, coreIdVars) !== null);
    const roles: { role: 'master' | 'satellite' | null; name: string | null }[] = hasRoleCond
      ? [{ role: 'master', name: '主核 Core0' }, { role: 'satellite', name: '从核 satellite' }]
      : [{ role: null, name: null }];

    const parts: { role: string | null; diagram: string }[] = [];
    for (const r of roles) {
      const built = buildSequenceEvents(cfg, {
        role: r.role, coreIdVars, resolveParticipant, selfAlias,
      });
      warnings.push(...built.warnings.map(w => `${fn.name}: ${w}`));
      const events = [...built.events];
      // GetCoreId 声明式初始化被 cfgBuilder「定义不进图」丢弃时，入口处补自调用（v6 口径）
      const coreIdCall = (fn.bodyText ?? '').match(/=\s*[\w\s\->.]*?(\w*GetCoreId\w*)\s*\(/);
      if (coreIdCall && !hasGetCoreIdMsg(events)) {
        events.unshift({ kind: 'msg', to: selfAlias, text: `${coreIdCall[1]}()`, rpath: '' });
      }
      parts.push({ role: r.name, diagram: emitDiagram(model.module, selfAlias, fn.name, events, aliasGroup) });
    }

    // 两角色图逐字节相同 → 行为无角色差异，并回单图
    const merged = parts.length === 2 && parts[0].diagram === parts[1].diagram
      ? [{ role: null, diagram: parts[0].diagram }]
      : parts;

    // 内置断言网：词法 + 组合片段结构（构造性全绿，命中即工具链 bug）
    for (const p of merged) {
      for (const prob of [...lintMermaidSource(p.diagram), ...lintSequenceStructure(p.diagram)]) {
        warnings.push(`序列图(${p.role ?? '单图'})断言网命中: ${prob}`);
      }
    }
    return { parts: merged, warnings, degraded: 'none' };
  } catch (err) {
    warnings.push(`${fn.name} CFG 构建失败（${(err as Error).message}），序列图走平铺兜底`);
    return flat();
  }
}

/** 事件树里是否已有 GetCoreId 消息（防与 CFG 画出的重复） */
function hasGetCoreIdMsg(events: SeqEvent[]): boolean {
  for (const e of events) {
    if (e.kind === 'msg' && /GetCoreId/.test(e.text)) return true;
    if (e.kind === 'opt' || e.kind === 'loop') { if (hasGetCoreIdMsg(e.events)) return true; }
    if (e.kind === 'alt') { if (e.branches.some(b => hasGetCoreIdMsg(b.events))) return true; }
  }
  return false;
}

/** 事件树 → mermaid 文本（参与者声明=OS、本模块、外部首用序） */
function emitDiagram(module: string, selfAlias: string, fnName: string, events: SeqEvent[], aliasGroup: Map<string, string>): string {
  // 外部参与者首用序收集
  const externals: string[] = [];
  const collect = (evts: SeqEvent[]): void => {
    for (const e of evts) {
      if (e.kind === 'msg') {
        if (e.to !== selfAlias && !externals.includes(e.to)) externals.push(e.to);
      } else if (e.kind === 'opt' || e.kind === 'loop') collect(e.events);
      else e.branches.forEach(b => collect(b.events));
    }
  };
  collect(events);

  const lines = ['sequenceDiagram', '    participant OS as OS', `    participant ${selfAlias} as ${module}`];
  for (const a of externals) lines.push(`    participant ${a} as ${aliasGroup.get(a) ?? a}`);
  lines.push('', `    OS->>${selfAlias}: ${fnName}()`);
  emitEvents(events, '    ', lines, selfAlias);
  return lines.join('\n');
}

function emitEvents(events: SeqEvent[], indent: string, lines: string[], selfAlias: string): void {
  for (const e of events) {
    if (e.kind === 'msg') {
      lines.push(`${indent}${selfAlias}->>${e.to}: ${e.text}`);
      continue;
    }
    if (e.kind === 'opt' || e.kind === 'loop') {
      lines.push(`${indent}${e.kind} ${e.label}`);
      emitEvents(e.events, indent + '    ', lines, selfAlias);
      lines.push(`${indent}end`);
      continue;
    }
    e.branches.forEach((b, i) => {
      const head = i === 0 ? `alt ${b.label ?? ''}` : b.label !== null ? `else ${b.label}` : 'else';
      lines.push(indent + head.trimEnd());
      emitEvents(b.events, indent + '    ', lines, selfAlias);
    });
    lines.push(`${indent}end`);
  }
}
