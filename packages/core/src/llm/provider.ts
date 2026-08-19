/**
 * LLM Provider 抽象：默认 OpenAI 兼容接口（本地 Qwen），可替换其他实现。
 * 配置来源（优先级从高到低）：显式参数 > 环境变量 > lld.config.json（由 CLI 读入后作为显式参数传入；core 不碰文件系统）
 */

export interface LLMConfig {
  baseUrl: string;     // 如 http://qwen-server:8000/v1（只给 host:port 时自动补 /v1）
  apiKey: string;      // 本地部署通常任意值即可
  model: string;       // 如 qwen3.6-35b-a3b
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;  // 单次请求超时，默认 180s（35B 级模型长输出较慢）
}

export interface LLMProvider {
  readonly name: string;
  /** 单轮生成：system + user → 文本 */
  generate(system: string, user: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_NETWORK_RETRIES = 2;

/** baseUrl 规范化：只给 host:port（无路径）时自动补 /v1（vLLM 等 OpenAI 兼容服务的惯例挂载点） */
export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    if (u.pathname === '' || u.pathname === '/') return `${trimmed}/v1`;
  } catch {
    // 非法 URL 原样返回，请求时报错即可
  }
  return trimmed;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  private config: LLMConfig;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.config = config;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.name = `openai-compatible:${config.model}`;
  }

  async generate(system: string, user: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: this.config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts?.temperature ?? this.config.temperature ?? 0.2,
      max_tokens: opts?.maxTokens ?? this.config.maxTokens ?? 4096,
    });
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
      if (attempt > 0) await sleep(1000 * attempt); // 退避：1s、2s
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!resp.ok) {
          const respBody = await resp.text();
          // 4xx 是请求本身的问题（模型名错/参数不合法），重试无意义；5xx 与服务中断可重试
          if (resp.status < 500 || attempt === MAX_NETWORK_RETRIES) {
            throw new Error(`LLM 请求失败 ${resp.status}: ${respBody.slice(0, 300)}`);
          }
          lastError = new Error(`LLM 请求失败 ${resp.status}: ${respBody.slice(0, 300)}`);
          continue;
        }

        const data = await resp.json() as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('LLM 返回为空');
        return content.trim();
      } catch (err) {
        const e = err as Error;
        // 已构造的 4xx 错误直接抛；网络错误/超时/5xx 进入重试
        if (/^LLM 请求失败 4\d\d/.test(e.message)) throw e;
        lastError = e;
      }
    }
    throw new Error(`LLM 请求失败（网络重试 ${MAX_NETWORK_RETRIES} 次后仍失败）: ${lastError?.message}`);
  }
}

/** 离线 mock：不调用任何服务，用于跑通流程与 prompt 调试 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  /** 记录每次调用的 prompt，便于检查 */
  readonly calls: { system: string; user: string }[] = [];

  async generate(system: string, user: string): Promise<string> {
    this.calls.push({ system, user });
    if (user.includes('flowchart')) {
      return [
        'flowchart TD',
        '    A(["开始"]) --> B["处理步骤"]',
        '    B --> C{"判断条件"}',
        '    C -- 是 --> D["分支处理"]',
        '    C -- 否 --> E(["结束"])',
        '    D --> E',
      ].join('\n');
    }
    if (user.includes('stateDiagram')) {
      return [
        'stateDiagram-v2',
        '    [*] --> UNDEF : 上电复位',
        '    UNDEF --> ONE : 进入 Startup',
        '    ONE --> TWO : master 完成阶段一初始化',
        '    TWO --> THREE : master 完成初始化与自检',
        '    THREE --> [*] : 启动完成',
      ].join('\n');
    }
    if (user.includes('sequenceDiagram')) {
      return [
        'sequenceDiagram',
        '    actor OS',
        '    OS->>Module: Startup()',
        '    Module->>Callout: CalloutGetCoreId()',
        '    Module->>Gp_RstM: Init()',
      ].join('\n');
    }
    return `[MOCK] 这是基于静态分析信息生成的功能描述占位文本。函数签名与调用上下文已注入 prompt（长度 ${user.length} 字符）。`;
  }
}

export function resolveConfig(overrides?: Partial<LLMConfig>): LLMConfig {
  return {
    baseUrl: overrides?.baseUrl ?? process.env.LLD_LLM_BASE_URL ?? '',
    apiKey: overrides?.apiKey ?? process.env.LLD_LLM_API_KEY ?? 'local',
    model: overrides?.model ?? process.env.LLD_LLM_MODEL ?? 'qwen3.6-35b-a3b',
    temperature: overrides?.temperature,
    maxTokens: overrides?.maxTokens,
    timeoutMs: overrides?.timeoutMs ?? (process.env.LLD_LLM_TIMEOUT_MS ? Number(process.env.LLD_LLM_TIMEOUT_MS) : undefined),
  };
}
