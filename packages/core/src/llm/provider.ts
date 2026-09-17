/**
 * LLM Provider 抽象：默认 OpenAI 兼容接口（本地 Qwen），可替换其他实现。
 * 配置来源（优先级从高到低）：显式参数 > 环境变量 > lld.config.json（由 CLI 读入后作为显式参数传入；core 不碰文件系统）
 */

export interface LLMConfig {
  baseUrl: string;     // 如 http://qwen-server:8000/v1（只给 host:port 时自动补 /v1）
  apiKey: string;      // 本地部署通常任意值即可
  model: string;       // 如 qwen3.8-27b
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
      // Qwen3 系思考模型（vLLM --reasoning-parser）：思考链会挤占 max_tokens 致 content=null，
      // 关掉思考模式；服务器不认识此参数时由下方 reasoning_content 兜底
      chat_template_kwargs: { enable_thinking: false },
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
          choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
        };
        const msg = data.choices?.[0]?.message;
        // content 优先；思考模型在 enable_thinking 未生效时正文在 reasoning_content（可能是思考链，但好过判空失败）
        const content = msg?.content || msg?.reasoning_content;
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
    // 流程图已改静态生成（cfgBuilder/flowchartEmitter），mock 不再有 flowchart 罐头
    if (user.includes('stateDiagram')) {
      // 多核罐头：主核/从核分图（与 prompt 规则 6 的分图约定一致，冒烟覆盖角色拆分路径）
      return [
        '### 主核 Core0',
        'stateDiagram-v2',
        '    [*] --> UNDEF : 上电复位',
        '    UNDEF --> ONE : 进入 Startup',
        '    ONE --> TWO : master 完成阶段一初始化',
        '    TWO --> THREE : master 完成初始化与自检',
        '    THREE --> [*] : 启动完成',
        '### 从核 satellite',
        'stateDiagram-v2',
        '    [*] --> UNDEF : 上电复位',
        '    UNDEF --> ONE : 进入 Startup',
        '    ONE --> TWO : satellite 自旋等待主核阶段二屏障',
        '    TWO --> THREE : satellite 完成初始化并记录时间戳',
        '    THREE --> [*] : 启动完成',
      ].join('\n');
    }
    if (user.includes('sequenceDiagram')) {
      return [
        'sequenceDiagram',
        '    actor OS',
        '    OS->>Module: Startup()',
        '    Module->>Module: CalloutGetCoreId()',
        '    alt 主核',
        '        Module->>Gp_RstM: Init()',
        '    else 从核',
        '        Module->>Module: 自旋等待主核屏障',
        '    end',
      ].join('\n');
    }
    return `[MOCK] 这是基于静态分析信息生成的功能描述占位文本。函数签名与调用上下文已注入 prompt（长度 ${user.length} 字符）。`;
  }
}

export function resolveConfig(overrides?: Partial<LLMConfig>): LLMConfig {
  return {
    baseUrl: overrides?.baseUrl ?? process.env.LLD_LLM_BASE_URL ?? '',
    apiKey: overrides?.apiKey ?? process.env.LLD_LLM_API_KEY ?? 'local',
    model: overrides?.model ?? process.env.LLD_LLM_MODEL ?? 'qwen3.8-27b',
    temperature: overrides?.temperature,
    maxTokens: overrides?.maxTokens,
    timeoutMs: overrides?.timeoutMs ?? (process.env.LLD_LLM_TIMEOUT_MS ? Number(process.env.LLD_LLM_TIMEOUT_MS) : undefined),
  };
}
