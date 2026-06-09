import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryGameStore } from '../src/services/game-store.js';
import { createDefaultAIConfig } from '@werewolf/shared';

describe('MemoryGameStore', () => {
  let store: MemoryGameStore;

  beforeEach(() => {
    store = new MemoryGameStore();
  });

  it('saves and loads game state', async () => {
    const game = {
      state: {
        id: 'game-1',
      } as never,
      humanSeatIndex: 0,
      aiConfigs: [createDefaultAIConfig(1)],
      createdAt: Date.now(),
    };

    await store.saveGame(game);
    const loaded = await store.loadGame('game-1');
    expect(loaded?.humanSeatIndex).toBe(0);
  });

  it('serializes concurrent locks', async () => {
    const order: number[] = [];

    await Promise.all([
      store.withGameLock('game-1', async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 20));
        order.push(2);
      }),
      store.withGameLock('game-1', async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });
});
