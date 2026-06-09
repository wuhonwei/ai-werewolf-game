import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/game-engine.js';
import { Role, Phase } from '@werewolf/shared';
import { createTestState, findSeatByRole } from './test-utils.js';

const STANDARD_ROLES: Role[] = [
  Role.WEREWOLF,
  Role.WEREWOLF,
  Role.WEREWOLF,
  Role.WEREWOLF,
  Role.VILLAGER,
  Role.VILLAGER,
  Role.VILLAGER,
  Role.VILLAGER,
  Role.SEER,
  Role.WITCH,
  Role.HUNTER,
  Role.GUARD,
];

function runNightActions(
  state: ReturnType<typeof createTestState>,
  opts: {
    killTarget: number;
    guardTarget: number;
    witchHeal?: boolean;
    witchPoison?: number | null;
  },
) {
  const wolf = findSeatByRole(state, Role.WEREWOLF);
  const seer = findSeatByRole(state, Role.SEER);
  const witch = findSeatByRole(state, Role.WITCH);
  const guard = findSeatByRole(state, Role.GUARD);

  let r = applyAction(state, { type: 'WOLF_KILL', seatIndex: wolf, target: opts.killTarget });
  expect(r.ok).toBe(true);
  if (!r.ok) return r;

  r = applyAction(r.state, { type: 'SEER_CHECK', seatIndex: seer, target: opts.killTarget });
  expect(r.ok).toBe(true);
  if (!r.ok) return r;

  r = applyAction(r.state, { type: 'WITCH_HEAL', seatIndex: witch, useHeal: opts.witchHeal ?? false });
  expect(r.ok).toBe(true);
  if (!r.ok) return r;

  r = applyAction(r.state, { type: 'WITCH_POISON', seatIndex: witch, target: opts.witchPoison ?? null });
  expect(r.ok).toBe(true);
  if (!r.ok) return r;

  r = applyAction(r.state, { type: 'GUARD_PROTECT', seatIndex: guard, target: opts.guardTarget });
  expect(r.ok).toBe(true);
  return r;
}

describe('night phase', () => {
  it('guard protects target from wolf kill', () => {
    const state = createTestState(STANDARD_ROLES);
    const victim = 4;

    const result = runNightActions(state, { killTarget: victim, guardTarget: victim });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.state.seats[victim].alive).toBe(true);
      expect(result.state.phase).toBe('day_discuss');
    }
  });

  it('wolf kill succeeds without protection', () => {
    const state = createTestState(STANDARD_ROLES);
    const victim = 4;

    const result = runNightActions(state, { killTarget: victim, guardTarget: 5 });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.state.seats[victim].alive).toBe(false);
    }
  });

  it('witch heal saves wolf target', () => {
    const state = createTestState(STANDARD_ROLES);
    const victim = 4;
    const guard = findSeatByRole(state, Role.GUARD);

    let r = applyAction(state, {
      type: 'WOLF_KILL',
      seatIndex: findSeatByRole(state, Role.WEREWOLF),
      target: victim,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    r = applyAction(r.state, {
      type: 'SEER_CHECK',
      seatIndex: findSeatByRole(r.state, Role.SEER),
      target: victim,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    r = applyAction(r.state, {
      type: 'WITCH_HEAL',
      seatIndex: findSeatByRole(r.state, Role.WITCH),
      useHeal: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    r = applyAction(r.state, {
      type: 'WITCH_POISON',
      seatIndex: findSeatByRole(r.state, Role.WITCH),
      target: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    r = applyAction(r.state, { type: 'GUARD_PROTECT', seatIndex: guard, target: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.seats[victim].alive).toBe(true);
      expect(r.state.witch.healAvailable).toBe(false);
    }
  });

  it('witch poison kills independently of guard', () => {
    const state = createTestState(STANDARD_ROLES);
    const poisonTarget = 5;

    const result = runNightActions(state, {
      killTarget: 4,
      guardTarget: 4,
      witchPoison: poisonTarget,
    });

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.state.seats[4].alive).toBe(true);
      expect(result.state.seats[poisonTarget].alive).toBe(false);
    }
  });

  it('rejects guard protecting same player two nights in a row', () => {
    const state = createTestState(STANDARD_ROLES, { day: 2, phase: Phase.NIGHT_GUARD });
    const guard = findSeatByRole(state, Role.GUARD);
    const withLastGuard = {
      ...state,
      night: { ...state.night, lastGuardTarget: 4 },
    };

    const result = applyAction(withLastGuard, {
      type: 'GUARD_PROTECT',
      seatIndex: guard,
      target: 4,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('two nights');
    }
  });
});
