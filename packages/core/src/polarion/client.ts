/**
 * Polarion REST client 骨架（D6）。
 * 本期两步走只做到离线导入文件 + ID 回写；REST 直连推送留骨架。
 * 未来实现照抄 llm/provider.ts 模式：原生 fetch + AbortSignal.timeout +
 * 重试 2 次退避 1s/2s + 4xx 不重试，零新依赖。
 */
import type { PolarionConfig, WorkItemDraft } from './types.js';

export interface PolarionClient {
  readonly baseUrl: string;
  readonly projectId: string;
  /** 推送工作项（创建/更新）。本期未实现——调用即抛错 */
  push(drafts: WorkItemDraft[]): Promise<void>;
}

export function createPolarionClient(cfg: PolarionConfig): PolarionClient {
  return {
    baseUrl: cfg.baseUrl,
    projectId: cfg.projectId,
    push(): Promise<void> {
      return Promise.reject(new Error(
        'REST 直连推送本期未实现。请用 polarion export 生成 Word 导入文件，'
        + '在 Polarion 界面执行 Import → Word，导入后用 map-ids 回写 ID'));
    },
  };
}
