import { describe, it, expect } from 'vitest';
import { createGame } from '@werewolf/engine';
import { Phase, Role, STANDARD_12_YWLG, createDefaultAIConfig } from '@werewolf/shared';
import { AIPlayerService } from '../src/ai/ai-player-service.js';
import { HeuristicLLMClient } from '../src/ai/deepseek-client.js';
import type { StoredGame } from '../src/services/game-store.js';

describe('AIPlayerService', () => {
  const ai = new AIPlayerService(new HeuristicLLMClient());

  function stored(humanSeat: number, humanRole: Role, phase: Phase): StoredGame {
    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: humanSeat,
      humanRole,
      aiSeatIndices: Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== humanSeat),
      seed: 55,
    });

    return {
      state: { ...state, phase, day: 1 },
      humanSeatIndex: humanSeat,
      aiConfigs: Array.from({ length: 12 }, (_, i) =>
        i === humanSeat ? null : createDefaultAIConfig(i),
      ).filter(Boolean) as StoredGame['aiConfigs'],
      createdAt: Date.now(),
    };
  }

  it('produces wolf kill action at night_wolf', async () => {
    const game = stored(0, Role.VILLAGER, Phase.NIGHT_WOLF);
    const wolfSeat = game.state.seats.find((s) => s.role === Role.WEREWOLF)!.index;
    const actions = await ai.decideActions(game, wolfSeat);
    expect(actions.some((a) => a.type === 'WOLF_KILL')).toBe(true);
  });

  it('produces speak + end_speech during day discuss for AI seat', async () => {
    const game = stored(0, Role.VILLAGER, Phase.DAY_DISCUSS);
    const aiSeat = 1;
    const actions = await ai.decideActions(game, aiSeat);
    expect(actions.some((a) => a.type === 'SPEAK')).toBe(true);
    expect(actions.some((a) => a.type === 'END_SPEECH')).toBe(true);
  });
});
