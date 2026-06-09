import { AI_RESPONSE_SCHEMA_HINT } from './parse-ai-response.js';
import type { AgentContext } from './context-builder.js';
import { buildSystemPrompt, buildUserPrompt } from './context-builder.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  model: string;
  messages: LLMMessage[];
  temperature: number;
  timeoutMs?: number;
}

export interface LLMClient {
  complete(request: LLMCompletionRequest): Promise<string>;
}

export interface DeepSeekClientOptions {
  apiKey: string;
  baseUrl?: string;
  defaultTimeoutMs?: number;
}

export class DeepSeekClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: DeepSeekClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.deepseek.com').replace(/\/$/, '');
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  }

  async complete(request: LLMCompletionRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? this.defaultTimeoutMs,
    );

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`DeepSeek API error ${res.status}: ${body}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty DeepSeek response');
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildLLMMessages(ctx: AgentContext, schemaHint = AI_RESPONSE_SCHEMA_HINT): LLMMessage[] {
  return [
    { role: 'system', content: `${buildSystemPrompt(ctx)}\n\n${schemaHint}` },
    { role: 'user', content: buildUserPrompt(ctx) },
  ];
}

export function createLLMClient(apiKey: string, baseUrl?: string): LLMClient {
  if (!apiKey) {
    return new HeuristicLLMClient();
  }
  return new DeepSeekClient({ apiKey, baseUrl });
}

/** Fallback when no API key — picks valid random-ish actions */
export class HeuristicLLMClient implements LLMClient {
  async complete(request: LLMCompletionRequest): Promise<string> {
    const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
    const aliveMatch = user.match(/存活玩家：([^\n]+)/);
    const seats =
      aliveMatch?.[1]
        ?.split('、')
        .map((s) => parseInt(s.replace('号', ''), 10) - 1)
        .filter((n) => !Number.isNaN(n)) ?? [0];

    const target = seats[Math.floor(Math.random() * seats.length)];

    return JSON.stringify({
      thought: ' heuristic fallback ',
      speech: `${target + 1}号玩家发言有点可疑，我再观察一下。`,
      action: { type: 'VOTE', target },
      preferredTarget: target,
    });
  }
}
