/**
 * design json 读取侧自动迁移（v1 → v2）。
 *
 * v2 变更：calledExternalFunctions 收窄为只放普通外部接口（5.2.2.2），
 * Callout 函数（group === 'Callout'）移入新顶层节点 calloutFunctions（6.2）。
 * 存量 v1 json 两类混放在 calledExternalFunctions 里，本函数在读取侧就地拆分，
 * 使旧 json 无需重跑 analyze 即可被 report/diff/lint 等新代码消费。
 *
 * 契约：**就地迁移**，原地修改入参并返回同一引用（同 materializePolarionAttributes 先例）；
 * **形态驱动、幂等**——不看 schemaVersion 决定动不动，只看数据形态，重复调用结果不变。
 * 磁盘写回不在这里做：迁移后的形态随 gen/images 的 save 自然落盘。
 */
import { SCHEMA_VERSION, type ModuleModel } from './types.js';

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
  if ((model.schemaVersion ?? 0) < SCHEMA_VERSION) model.schemaVersion = SCHEMA_VERSION;
  return model;
}
