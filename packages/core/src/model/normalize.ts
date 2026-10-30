/**
 * design json 读取侧自动迁移（v1 → v2 → … → v5）。
 *
 * v2 变更：calledExternalFunctions 收窄为只放普通外部接口（5.2.2.2），
 * Callout 函数（group === 'Callout'）移入新顶层节点 calloutFunctions（6.2）。
 * 存量 v1 json 两类混放在 calledExternalFunctions 里，本函数在读取侧就地拆分，
 * 使旧 json 无需重跑 analyze 即可被 report/diff/lint 等新代码消费。
 *
 * v5 变更：document.configDetails 单一对象拆为 configDetailsGeneral/configDetailsFunctional
 * 两个对象（按对应宏的 kind 归属；别名宏本就不在 configDetails 内）。
 *
 * 契约：**就地迁移**，原地修改入参并返回同一引用（同 materializePolarionAttributes 先例）；
 * **形态驱动、幂等**——不看 schemaVersion 决定动不动，只看数据形态，重复调用结果不变。
 * 磁盘写回不在这里做：迁移后的形态随 gen/images 的 save 自然落盘。
 */
import { SCHEMA_VERSION, type ConfigDetailEntry, type ConfigMacro, type ModuleModel, type StateMachineDesign } from './types.js';

export function normalizeModel(model: ModuleModel): ModuleModel {
  model.calloutFunctions ??= [];
  const cef = model.calledExternalFunctions ?? [];
  const stray = cef.filter(e => e.group === 'Callout');
  if (stray.length > 0) {
    const known = new Set(model.calloutFunctions.map(e => e.name));
    for (const e of stray) {
      if (!known.has(e.name)) { model.calloutFunctions.push(e); known.add(e.name); }
    }
    model.calledExternalFunctions = cef.filter(e => e.group !== 'Callout');
  }
  // stateMachine 旧字段迁移：单核产物只有 stateMachine 无 stateMachines，就地升为数组
  const dd = model.dynamicDesign as { stateMachine?: StateMachineDesign | null; stateMachines?: StateMachineDesign[] } | undefined;
  if (dd && !dd.stateMachines && dd.stateMachine) {
    dd.stateMachines = [dd.stateMachine];
    delete dd.stateMachine;
  }
  // configMacros 旧字段迁移：v4 起按 kind 拆三桶（general/functional/alias），就地拆分；
  // 桶内保持旧数组相对序，并给每条打 _seq（旧数组原始索引）——渲染期跨桶名单（7 章评估等）
  // 按 _seq 还原 v4 前 configMacros 全序，保证存量 json 现算产物字节零回归；新产物无 _seq 落桶序
  const legacy = model as unknown as { configMacros?: ConfigMacro[] };
  if (legacy.configMacros && !model.generalConfigMacros) {
    legacy.configMacros.forEach((c, i) => { (c as ConfigMacro & { _seq?: number })._seq = i; });
    model.generalConfigMacros = legacy.configMacros.filter(c => c.kind === 'general');
    model.functionalConfigMacros = legacy.configMacros.filter(c => c.kind === 'functional');
    model.aliasConfigMacros = legacy.configMacros.filter(c => c.kind === 'alias');
    delete legacy.configMacros;
  }
  model.generalConfigMacros ??= [];
  model.functionalConfigMacros ??= [];
  model.aliasConfigMacros ??= [];
  // configDetails 旧字段迁移：v5 起拆 configDetailsGeneral/configDetailsFunctional 两个对象，
  // 按对应宏的 kind 归属（与顶层三桶口径一致；别名宏本就不在 configDetails 内），就地拆分。
  const doc = model.document as (ModuleModel['document'] & { configDetails?: Record<string, ConfigDetailEntry> }) | undefined;
  if (doc?.configDetails && doc.configDetailsGeneral === undefined) {
    const generalNames = new Set(model.generalConfigMacros.map(c => c.name));
    doc.configDetailsGeneral = {};
    doc.configDetailsFunctional = {};
    for (const [name, detail] of Object.entries(doc.configDetails)) {
      (generalNames.has(name) ? doc.configDetailsGeneral : doc.configDetailsFunctional)[name] = detail;
    }
    delete doc.configDetails;
  }
  if ((model.schemaVersion ?? 0) < SCHEMA_VERSION) model.schemaVersion = SCHEMA_VERSION;
  return model;
}
