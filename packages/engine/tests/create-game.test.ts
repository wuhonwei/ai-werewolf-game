import { describe, it, expect } from 'vitest';
import { createGame, getPublicState } from '../src/create-game.js';
import { applyAction } from '../src/game-engine.js';
import { Role, STANDARD_12_YWLG, SeatType } from '@werewolf/shared';

describe('createGame', () => {
  it('creates 12 seats with correct role distribution', () => {
    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: 0,
      humanRole: null,
      aiSeatIndices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      seed: 42,
    });

    expect(state.seats).toHaveLength(12);
    const roles = state.seats.map((s) => s.role);
    expect(roles.filter((r) => r === Role.WEREWOLF)).toHaveLength(4);
    expect(roles.filter((r) => r === Role.VILLAGER)).toHaveLength(4);
    expect(roles.filter((r) => r === Role.SEER)).toHaveLength(1);
    expect(roles.filter((r) => r === Role.WITCH)).toHaveLength(1);
    expect(roles.filter((r) => r === Role.HUNTER)).toHaveLength(1);
    expect(roles.filter((r) => r === Role.GUARD)).toHaveLength(1);
    expect(state.seats[0].type).toBe(SeatType.HUMAN);
    expect(state.phase).toBe('role_reveal');
  });

  it('assigns specified human role when provided', () => {
    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: 3,
      humanRole: Role.SEER,
      aiSeatIndices: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
      seed: 1,
    });

    expect(state.seats[3].role).toBe(Role.SEER);
  });

  it('hides roles in public state', () => {
    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: 0,
      humanRole: Role.WITCH,
      aiSeatIndices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      seed: 99,
    });

    const pub = getPublicState(state);
    expect(pub.seats.every((s) => !('role' in s))).toBe(true);
    expect(pub.seats).toHaveLength(12);
  });
});

describe('applyAction', () => {
  it('starts game from role_reveal to night_wolf', () => {
    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: 0,
      humanRole: null,
      aiSeatIndices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      seed: 42,
    });

    const result = applyAction(state, { type: 'START_GAME' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toBe('night_wolf');
      expect(result.state.day).toBe(1);
    }
  });
});
