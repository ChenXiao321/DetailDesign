/**
 * Polarion 配置解析（照抄 llm/provider.ts resolveConfig 模式）：
 * 显式 overrides > lld.config.json 的 polarion 节 > LLD_POLARION_* 环境变量 > 默认值。
 * 本期服务器不可达，连接三件套（baseUrl/projectId/token）仅 push 骨架校验用，
 * export / map-ids 完全不依赖它们。
 */
import { DEFAULT_POLARION_CONFIG, type PolarionConfig } from './types.js';

export function resolvePolarionConfig(
  fileCfg?: Partial<PolarionConfig>,
  overrides?: Partial<PolarionConfig>,
): PolarionConfig {
  const d = DEFAULT_POLARION_CONFIG;
  return {
    baseUrl: overrides?.baseUrl ?? fileCfg?.baseUrl ?? process.env.LLD_POLARION_BASE_URL ?? d.baseUrl,
    projectId: overrides?.projectId ?? fileCfg?.projectId ?? process.env.LLD_POLARION_PROJECT_ID ?? d.projectId,
    token: overrides?.token ?? fileCfg?.token ?? process.env.LLD_POLARION_TOKEN ?? d.token,
    tableTitleTemplate: overrides?.tableTitleTemplate ?? fileCfg?.tableTitleTemplate ?? d.tableTitleTemplate,
    workItemTypes: { ...d.workItemTypes, ...fileCfg?.workItemTypes, ...overrides?.workItemTypes },
    maxImageWidthPx: overrides?.maxImageWidthPx ?? fileCfg?.maxImageWidthPx
      ?? (process.env.LLD_POLARION_MAX_IMAGE_WIDTH_PX ? Number(process.env.LLD_POLARION_MAX_IMAGE_WIDTH_PX) : d.maxImageWidthPx),
  };
}
