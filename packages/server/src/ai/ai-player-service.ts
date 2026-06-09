import type { AIPlayerConfig } from '@werewolf/shared';
import { Phase, type GameAction } from '@werewolf/shared';
import { buildAgentContext } from './context-builder.js';
import { buildLLMMessages, type LLMClient } from './deepseek-client.js';
import { mapAIResponseToActions, tallyWolfVotes, getAliveWolfSeats } from './action-mapper.js';
import { parseAIResponseSafe, AI_RESPONSE_SCHEMA_HINT } from './parse-ai-response.js';
import type { StoredGame } from '../services/game-store.js';

const WOLF_VOTE_SCHEMA = `请严格输出 JSON：
{
  "thought": "内心推理",
  "preferredTarget": 3
}`;

export class AIPlayerService {
  constructor(private readonly llm: LLMClient) {}

  async decideActions(stored: StoredGame, seatIndex: number): Promise<GameAction[]> {
    const state = stored.state;
    const config = this.getConfig(stored, seatIndex);

    if (state.phase === Phase.NIGHT_WOLF) {
      return this.decideWolfKill(stored);
    }

    const ctx = buildAgentContext(state, seatIndex, config.personality);
    const raw = await this.completeWithRetry(config, ctx, AI_RESPONSE_SCHEMA_HINT);
    const parsed = parseAIResponseSafe(raw);
    return mapAIResponseToActions(state, seatIndex, parsed);
  }

  private async decideWolfKill(stored: StoredGame): Promise<GameAction[]> {
    const state = stored.state;
    const wolves = getAliveWolfSeats(state);
    if (wolves.length === 0) return [];

    const votes = new Map<number, number>();

    for (const wolfSeat of wolves) {
      const config = this.getConfig(stored, wolfSeat);
      const ctx = buildAgentContext(state, wolfSeat, config.personality);
      ctx.actionHint = '选择今晚要刀的目标座位号（preferredTarget），不要输出 speech';

      const raw = await this.completeWithRetry(config, ctx, WOLF_VOTE_SCHEMA);
      const parsed = parseAIResponseSafe(raw);
      const target =
        parsed.preferredTarget ??
        parsed.action?.target ??
        parsed.action?.preferredTarget ??
        state.seats.find((s) => s.alive && s.index !== wolfSeat)?.index ??
        0;
      votes.set(wolfSeat, target);
    }

    const killTarget = tallyWolfVotes(votes);
    return [{ type: 'WOLF_KILL', seatIndex: wolves[0], target: killTarget }];
  }

  private getConfig(stored: StoredGame, seatIndex: number): AIPlayerConfig {
    const config = stored.aiConfigs.find((c) => c.seatIndex === seatIndex);
    if (!config) throw new Error(`Missing AI config for seat ${seatIndex}`);
    return config;
  }

  private async completeWithRetry(
    config: AIPlayerConfig,
    ctx: ReturnType<typeof buildAgentContext>,
    schemaHint: string,
  ): Promise<string> {
    const messages = buildLLMMessages(ctx, schemaHint);
    try {
      return await this.llm.complete({
        model: config.model,
        messages,
        temperature: config.temperature,
      });
    } catch {
      return await this.llm.complete({
        model: config.model,
        messages,
        temperature: Math.max(0.3, config.temperature - 0.2),
      });
    }
  }
}
