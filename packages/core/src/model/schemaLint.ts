/**
 * design json 结构完整性校验（0930 结构冻结 v1）——单一实现，三处共用：
 *  ① CLI gen 写盘后自检（按 --only 阶段要求对应完备度）
 *  ② CLI gen --only images 写盘后自检（要求全 PNG 在场）
 *  ③ 根目录 _check_schema.js 门禁（薄壳，对本模块产物全量要求）
 * 堵 0929 盲区：gen --only document 整节替换曾冲掉 includeGraphPng，
 * 双字节门禁只验 report 输出不验 json 字段，静默逃逸。
 */
import { SCHEMA_VERSION, listStateMachines, listConfigMacros, type ModuleModel, type PolarionMarker } from './types.js';
import { normalizeModel } from './normalize.js';

/** 顶层必备键（analyze 即产出；document/dynamicDesign/functionalDescription 由 gen 阶段产出，单独按阶段要求；
 *  calloutFunctions 为 v2 新增——存量 v1 json 由入口 normalizeModel 补齐后再校验，不判缺键） */
export const TOP_KEYS = ['module', 'schemaVersion', 'analyzedAt', 'files', 'providedFunctions',
  'internalFunctions', 'internalVariables', 'providedVariables', 'calledExternalFunctions',
  'calloutFunctions', 'types', 'generalConfigMacros', 'functionalConfigMacros', 'aliasConfigMacros',
  'interfaceOverview', 'callGraphs'] as const;
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

/** 返回缺陷名单（空数组=通过）。只查存在性/结构，不验内容正确性。
 *  入口先 normalizeModel：存量 v1 json 就地迁移（补 calloutFunctions、升 schemaVersion），
 *  校验对象恒为当前版本形态（就地副作用与 normalizeModel 迁移契约同构） */
export function lintModelSchema(model: ModuleModel, opts: SchemaLintOptions = {}): string[] {
  normalizeModel(model);
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
      for (const c of listConfigMacros(model)) {
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
    // 状态机按读取口径全量覆盖
    for (const sm of listStateMachines(model.dynamicDesign)) {
      pngs.push([`sm[${sm.name}].diagramPng`, sm.diagramPng]);
    }
    for (const [label, v] of pngs) {
      if (typeof v !== 'string' || v.length === 0) problems.push(`PNG 缺失: ${label}`);
    }
  }
  // ---------- 工作项 title 唯一性（Polarion 映射键=(章节,title)，重名则同步歧义） ----------
  // 例外：表格类组表工作项（workItemKind='table'）——同组多条外部接口共享一个
  // (5.2.2.2,「<组名> 接口函数」) 属设计本意（一整张表=一个工作项），不算撞名。
  {
    const wi: { chapter: string; title: string; label: string }[] = [];
    const pushWi = (p: PolarionMarker | undefined, label: string): void => {
      if (!p?.isWorkItem || p.workItemKind === 'table') return;
      wi.push({ chapter: p.chapter, title: p.title, label });
    };
    for (const f of model.providedFunctions ?? []) pushWi(f.polarion, `提供函数 ${f.name}`);
    for (const f of model.internalFunctions ?? []) pushWi(f.polarion, `内部函数 ${f.name}（${f.file}）`);
    for (const e of model.calledExternalFunctions ?? []) pushWi(e.polarion, `外部接口 ${e.name}`);
    for (const e of model.calloutFunctions ?? []) pushWi(e.polarion, `Callout ${e.name}`);
    for (const t of model.types ?? []) pushWi(t.polarion, `类型 ${t.name}`);
    for (const c of listConfigMacros(model)) pushWi(c.polarion, `配置宏 ${c.name}`);
    for (const v of [...(model.internalVariables ?? []), ...(model.providedVariables ?? [])]) {
      pushWi(v.polarion, `变量 ${v.name}`);
    }
    pushWi(model.interfaceOverview?.polarion, '功能接口总图');
    for (const g of model.callGraphs ?? []) pushWi(g.polarion, `调用图 ${g.name}`);
    for (const sm of listStateMachines(model.dynamicDesign)) pushWi(sm.polarion, `状态机 ${sm.name}`);
    for (const s of model.dynamicDesign?.sequences ?? []) pushWi(s.polarion, `序列图 ${s.name}`);
    const seen = new Map<string, string>();
    for (const w of wi) {
      const key = `${w.chapter}|${w.title}`;
      const prev = seen.get(key);
      if (prev) problems.push(`工作项 title 重名: [${w.chapter}] "${w.title}"（${prev} 与 ${w.label}）`);
      else seen.set(key, w.label);
    }
  }
  return problems;
}
