export interface AIActionPayload {
  type?: string;
  target?: number | null;
  useHeal?: boolean;
  preferredTarget?: number;
}

export interface AIResponse {
  thought: string;
  speech: string;
  action?: AIActionPayload;
  preferredTarget?: number;
}

const FALLBACK: AIResponse = {
  thought: '情况不明，先观察。',
  speech: '我先听听大家怎么说。',
};

export function parseAIResponse(raw: string): AIResponse {
  const trimmed = raw.trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ...FALLBACK, speech: trimmed.slice(0, 80) || FALLBACK.speech };
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<AIResponse>;

  return {
    thought: String(parsed.thought ?? ''),
    speech: String(parsed.speech ?? FALLBACK.speech).slice(0, 120),
    action: parsed.action,
    preferredTarget:
      parsed.preferredTarget ??
      (typeof parsed.action?.preferredTarget === 'number'
        ? parsed.action.preferredTarget
        : undefined),
  };
}

export function parseAIResponseSafe(raw: string): AIResponse {
  try {
    return parseAIResponse(raw);
  } catch {
    return FALLBACK;
  }
}

export const AI_RESPONSE_SCHEMA_HINT = `请严格输出 JSON：
{
  "thought": "内心推理（不展示）",
  "speech": "公开发言（10-80字）",
  "action": { "type": "VOTE", "target": 3 }
}`;
