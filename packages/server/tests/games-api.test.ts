import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { MemoryGameStore } from '../src/services/game-store.js';
import { createDefaultAIConfig, Role } from '@werewolf/shared';

function buildAIConfigs(humanSeat: number) {
  return Array.from({ length: 12 }, (_, i) => (i === humanSeat ? null : createDefaultAIConfig(i))).filter(
    Boolean,
  ) as ReturnType<typeof createDefaultAIConfig>[];
}

describe('games API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ gameStore: new MemoryGameStore() });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/games creates a game', async () => {
    const humanSeatIndex = 2;
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: {
        humanSeatIndex,
        humanRole: Role.SEER,
        aiConfigs: buildAIConfigs(humanSeatIndex),
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.gameId).toBeTruthy();
    expect(body.publicState.seats).toHaveLength(12);
    expect(body.humanRole).toBe(Role.SEER);
  });

  it('GET /api/games/:id returns player view', async () => {
    const humanSeatIndex = 0;
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: {
        humanSeatIndex,
        humanRole: null,
        aiConfigs: buildAIConfigs(humanSeatIndex),
        seed: 42,
      },
    });

    const { gameId } = created.json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/games/${gameId}?humanSeatIndex=${humanSeatIndex}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().humanRole).toBeTruthy();
  });

  it('POST /api/games/:id/actions applies START_GAME', async () => {
    const humanSeatIndex = 0;
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: {
        humanSeatIndex,
        humanRole: null,
        aiConfigs: buildAIConfigs(humanSeatIndex),
        seed: 7,
      },
    });

    const { gameId } = created.json();

    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${gameId}/actions?humanSeatIndex=${humanSeatIndex}`,
      payload: { action: { type: 'START_GAME' } },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.publicState.phase).toBe('night_wolf');
    expect(body.publicState.day).toBe(1);
  });

  it('rejects action for wrong seat', async () => {
    const humanSeatIndex = 0;
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
      payload: {
        humanSeatIndex,
        humanRole: null,
        aiConfigs: buildAIConfigs(humanSeatIndex),
      },
    });

    const { gameId } = created.json();

    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${gameId}/actions?humanSeatIndex=${humanSeatIndex}`,
      payload: { action: { type: 'SPEAK', seatIndex: 1, text: 'hello' } },
    });

    expect(res.statusCode).toBe(400);
  });
});
