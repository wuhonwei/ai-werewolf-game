import { describe, it, expect } from 'vitest';
import { createGame } from '@werewolf/engine';
import { Phase, Role, Faction, SeatType, STANDARD_12_YWLG } from '@werewolf/shared';
import {
  buildAgentContext,
  contextToPromptText,
  findRoleLeaks,
  ROLE_LABEL,
} from '../src/ai/context-builder.js';

function manualState() {
  const roles: Role[] = [
    Role.VILLAGER,
    Role.WEREWOLF,
    Role.WEREWOLF,
    Role.VILLAGER,
    Role.VILLAGER,
    Role.VILLAGER,
    Role.VILLAGER,
    Role.WEREWOLF,
    Role.SEER,
    Role.WITCH,
    Role.HUNTER,
    Role.GUARD,
  ];

  const base = createGame({
    board: STANDARD_12_YWLG,
    humanSeatIndex: 0,
    humanRole: Role.VILLAGER,
    aiSeatIndices: Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== 0),
    seed: 1,
  });

  return {
    ...base,
    seats: base.seats.map((s, i) => ({ ...s, role: roles[i], type: i === 0 ? SeatType.HUMAN : SeatType.AI })),
  };
}

describe('context-builder', () => {
  it('werewolf sees teammates without revealing other roles', () => {
    const state = manualState();
    const wolfSeat = 1;
    state.seats[wolfSeat].role = Role.WEREWOLF;

    const ctx = buildAgentContext(state, wolfSeat, '冷静');
    const text = contextToPromptText(ctx);

    expect(ctx.knownFacts.some((f) => f.includes('队友'))).toBe(true);
    expect(text).toContain(ROLE_LABEL[Role.WEREWOLF]);
    expect(findRoleLeaks(text, wolfSeat, state)).not.toContain(`${3}号:${ROLE_LABEL[Role.SEER]}`);
  });

  it('seer sees own check history only', () => {
    const state = {
      ...manualState(),
      phase: Phase.NIGHT_SEER,
      day: 1,
      seerChecks: [{ day: 1, target: 3, result: Faction.WEREWOLF }],
    };
    const seerSeat = state.seats.findIndex((s) => s.role === Role.SEER);

    const ctx = buildAgentContext(state, seerSeat, '逻辑');
    expect(ctx.knownFacts.some((f) => f.includes('查验'))).toBe(true);
    expect(findRoleLeaks(contextToPromptText(ctx), seerSeat, state)).toEqual([]);
  });

  it('villager sees public info only', () => {
    const state = {
      ...manualState(),
      phase: Phase.DAY_DISCUSS,
      day: 1,
    };

    const ctx = buildAgentContext(state, 0, '简洁');
    const text = contextToPromptText(ctx);

    expect(ctx.knownFacts.some((f) => f.includes('存活玩家'))).toBe(true);
    expect(findRoleLeaks(text, 0, state).length).toBe(0);
  });

  it('asserts no role leak in prompt for villager viewer', () => {
    const state = manualState();
    const ctx = buildAgentContext(state, 0, '测试');
    const leaks = findRoleLeaks(contextToPromptText(ctx), 0, state);
    expect(leaks).toEqual([]);
  });
});
