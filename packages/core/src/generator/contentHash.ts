/**
 * generated 内容指纹（2026-10-16）：生成时刻对 generated 对象算 sha256 存为 contentHash，
 * diff 期重算比对——不一致即「生成后被人工修订过」，update/rename 操作单打 manualRevisionLost
 * 标记（提示不阻断：条目语义已变，旧修订基于旧内容，重生覆盖是设计内行为，但要让人知晓）。
 *
 * 口径：剔 contentHash 自身 + llmModel/generatedAt（溯源元数据非内容）+ 一切 *Png 物化字段
 * （images 物化在 gen 之后落盘，且渲染环境差异会造成字节噪音；图内容以图源码为准）。
 */
import { createHash } from 'node:crypto';

/** 稳定 JSON（键排序防字段序漂移），与 modelDiff.ts 的 stable 同口径 */
function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : 1));
    }
    return val;
  });
}

/** 剔除非内容字段后的哈希输入 */
function hashable(gen: object): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(gen)) {
    if (k === 'contentHash' || k === 'llmModel' || k === 'generatedAt' || k.endsWith('Png')) continue;
    o[k] = v;
  }
  return o;
}

/** 计算 generated 内容指纹（16 位 hex，与 bodyHash/sigHash 同截断口径） */
export function computeContentHash(gen: object): string {
  return createHash('sha256').update(stableJson(hashable(gen))).digest('hex').slice(0, 16);
}

/** 生成时刻打指纹（就地写 contentHash）。gen 各写入点在赋完内容后调用 */
export function stampContentHash(gen: { contentHash?: string }): void {
  gen.contentHash = computeContentHash(gen);
}

/** 检出人工修订：有指纹且与当前内容不符=true；无指纹（旧版产物）=无法判定，返回 false */
export function isManuallyRevised(gen: { contentHash?: string } | undefined | null): boolean {
  if (!gen || typeof gen.contentHash !== 'string') return false;
  return computeContentHash(gen) !== gen.contentHash;
}
