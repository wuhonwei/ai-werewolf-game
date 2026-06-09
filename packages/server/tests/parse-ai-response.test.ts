import { describe, it, expect } from 'vitest';
import { parseAIResponse, parseAIResponseSafe } from '../src/ai/parse-ai-response.js';

describe('parse-ai-response', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      thought: '怀疑3号',
      speech: '3号发言有问题',
      action: { type: 'VOTE', target: 2 },
    });

    const result = parseAIResponse(raw);
    expect(result.speech).toBe('3号发言有问题');
    expect(result.action?.target).toBe(2);
  });

  it('extracts JSON from markdown wrapper', () => {
    const raw = '```json\n{"thought":"x","speech":"你好","action":{"target":1}}\n```';
    const result = parseAIResponse(raw);
    expect(result.speech).toBe('你好');
  });

  it('returns fallback on invalid JSON', () => {
    const result = parseAIResponseSafe('not json at all');
    expect(result.speech.length).toBeGreaterThan(0);
  });
});
