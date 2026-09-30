/**
 * design json 结构完整性校验（0930 结构冻结 v1）——单一实现，三处共用：
 *  ① CLI gen 写盘后自检（按 --only 阶段要求对应完备度）
 *  ② CLI gen --only images 写盘后自检（要求全 PNG 在场）
 *  ③ 根目录 _check_schema.js 门禁（薄壳，对本模块产物全量要求）
 * 堵 0929 盲区：gen --only document 整节替换曾冲掉 includeGraphPng，
 * 双字节门禁只验 report 输出不验 json 字段，静默逃逸。
 */
import { SCHEMA_VERSION, listStateMachines, type ModuleModel } from './types.js';

/** 顶层必备键（analyze 即产出；document/dynamicDesign/functionalDescription 由 gen 阶段产出，单独按阶段要求） */
export const TOP_KEYS = ['module', 'schemaVersion', 'analyzedAt', 'files', 'providedFunctions',
  'internalFunctions', 'internalVariables', 'providedVariables', 'calledExternalFunctions',
  'types', 'configMacros', 'interfaceOverview', 'callGraphs'] as const;
/** document 节必备键（不含 includeGraphPng——PNG 由 images 阶段物化，走 PNG 检查） */
export const DOC_KEYS = ['purpose', 'scope', 'fileTable', 'importedTypes', 'complexityTable',
  'configDetails', 'aliasNote', 'abbreviations', 'abbreviationNote', 'definitions',
  'definitionNote', 'abbreviationGaps', 'evaluationRows', 'complexityNote',
  'evaluationSummary', 'supportFiles', 'supportNote', 'notes'] as const;
export const NOTES_KEYS = ['overview', 'callGraph', 'include', 'providedVarsEmpty', 'externalVars',
  'externalFnsCallout', 'internalVars', 'configGeneral', 'configFunctional', 'calloutCfg',
  'evalSummaryIntro'] as const;
export const CONFIG_DETAIL_FIELDS = ['usageItems', 'example', 'tableRow', 'valueEffect'] as const;

export interface SchemaLintOptions {
  /** 要求全部六类图 PNG 在场（仅 gen --only images 后的成品 json 可满足） */
  requirePngs?: boolean;
  /** 要求 document 节完整（全量 gen / --only document 后应满足；存量 json 部分 --only 续跑可放宽） */
  requireDocument?: boolean;
  /** 要求 dynamicDesign/functionalDescription 在场（全量 gen / --only dynamic 后应满足） */
  requireDynamic?: boolean;
}

/** 返回缺陷名单（空数组=通过）。只查存在性/结构，不验内容正确性 */
export function lintModelSchema(model: ModuleModel, opts: SchemaLintOptions = {}): string[] {
  const problems: string[] = [];
  const m = model as unknown as Record<string, unknown>;
  if (model.schemaVersion !== SCHEMA_VERSION) {
    problems.push(`schemaVersion 应为 ${SCHEMA_VERSION}，实得 ${model.schemaVersion ?? '缺失'}`);
  }
  for (const k of TOP_KEYS) if (!(k in m)) problems.push(`顶层缺键 ${k}`);

  if (opts.requireDynamic) {
    if (!m.dynamicDesign) problems.push('顶层缺键 dynamicDesign');
    if (!m.functionalDescription) problems.push('顶层缺键 functionalDescription');
  }

  const doc = model.document as Record<string, unknown> | undefined;
  if (opts.requireDocument || doc) {
    if (!doc) {
      problems.push('document 节缺失');
    } else {
      for (const k of DOC_KEYS) if (!(k in doc)) problems.push(`document 缺键 ${k}`);
      const notes = (doc.notes ?? {}) as Record<string, unknown>;
      for (const k of NOTES_KEYS) if (!(k in notes)) problems.push(`document.notes 缺键 ${k}`);
      const cfg = (doc.configDetails ?? {}) as Record<string, Record<string, unknown> | undefined>;
      for (const c of model.configMacros ?? []) {
        const d = cfg[c.name];
        if (!d) { problems.push(`configDetails 缺宏 ${c.name}`); continue; }
        for (const f of CONFIG_DETAIL_FIELDS) if (!(f in d)) problems.push(`configDetails.${c.name} 缺字段 ${f}`);
      }
    }
  }

  if (opts.requirePngs) {
    const pngs: [string, unknown][] = [
      ['interfaceOverview.diagramPng', model.interfaceOverview?.diagramPng],
      ...(model.callGraphs ?? []).map(g => [`callGraphs[${g.name}].diagramPng`, g.diagramPng] as [string, unknown]),
      ...[...(model.providedFunctions ?? []), ...(model.internalFunctions ?? [])]
        .map(f => [`${f.name}.flowchartPng`, f.generated?.flowchartPng] as [string, unknown]),
      ...(model.dynamicDesign?.sequences ?? []).map(s => [`seq[${s.name}].diagramPng`, s.diagramPng] as [string, unknown]),
      ['document.includeGraphPng', model.document?.includeGraphPng],
    ];
    // 状态机按读取口径全量覆盖：多核分图逐张查，兼容别名 stateMachine（恒为第一张）也须带 PNG
    for (const sm of listStateMachines(model.dynamicDesign)) {
      pngs.push([`sm[${sm.name}].diagramPng`, sm.diagramPng]);
    }
    if (model.dynamicDesign?.stateMachine) {
      pngs.push(['stateMachine.diagramPng', model.dynamicDesign.stateMachine.diagramPng]);
    }
    for (const [label, v] of pngs) {
      if (typeof v !== 'string' || v.length === 0) problems.push(`PNG 缺失: ${label}`);
    }
  }
  return problems;
}
