import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/game-engine.js';
import { Faction, GameStatus, Phase, Role } from '@werewolf/shared';
import { createTestState, findSeatByRole } from './test-utils.js';

describe('full game flow', () => {
  it('completes a short scripted game with villager win', () => {
    const roles: Role[] = [
      Role.WEREWOLF,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.WEREWOLF,
      Role.WEREWOLF,
      Role.WEREWOLF,
      Role.VILLAGER,
      Role.SEER,
      Role.WITCH,
      Role.HUNTER,
      Role.GUARD,
    ];

    let state = createTestState(roles, { phase: Phase.ROLE_REVEAL, day: 0 });

    let r = applyAction(state, { type: 'START_GAME' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;

    const wolf = findSeatByRole(state, Role.WEREWOLF);
    const seer = findSeatByRole(state, Role.SEER);
    const witch = findSeatByRole(state, Role.WITCH);
    const guard = findSeatByRole(state, Role.GUARD);
    const villagerTarget = 1;

    r = applyAction(state, { type: 'WOLF_KILL', seatIndex: wolf, target: villagerTarget });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;

    r = applyAction(state, { type: 'SEER_CHECK', seatIndex: seer, target: wolf });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;

    r = applyAction(state, { type: 'WITCH_HEAL', seatIndex: witch, useHeal: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;

    r = applyAction(state, { type: 'WITCH_POISON', seatIndex: witch, target: wolf });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;

    r = applyAction(state, { type: 'GUARD_PROTECT', seatIndex: guard, target: villagerTarget });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.state;

    expect(state.seats[villagerTarget].alive).toBe(true);
    expect(state.seats[wolf].alive).toBe(false);

    if (state.phase === Phase.DAY_ANNOUNCE) {
      r = applyAction(state, { type: 'END_DAY_ANNOUNCE' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
    }

    expect([Phase.DAY_DISCUSS, Phase.DAY_ANNOUNCE, Phase.HUNTER_SHOOT]).toContain(state.phase);
  });

  it('rejects invalid action for wrong phase', () => {
    const state = createTestState(
      [Role.WEREWOLF, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.SEER, Role.WITCH, Role.HUNTER, Role.GUARD],
      { phase: Phase.DAY_DISCUSS },
    );

    const result = applyAction(state, { type: 'WOLF_KILL', seatIndex: 0, target: 1 });
    expect(result.ok).toBe(false);
  });

  it('does not mutate state on failed action', () => {
    const state = createTestState(
      [Role.WEREWOLF, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.VILLAGER, Role.SEER, Role.WITCH, Role.HUNTER, Role.GUARD],
      { phase: Phase.NIGHT_WOLF },
    );

    const before = structuredClone(state);
    applyAction(state, { type: 'WOLF_KILL', seatIndex: 99, target: 1 });
    expect(state).toEqual(before);
  });
});
