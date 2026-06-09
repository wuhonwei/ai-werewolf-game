import { describe, it, expect } from 'vitest';
import { createGame } from '@werewolf/engine';
import { Phase, Role, SeatType, STANDARD_12_YWLG } from '@werewolf/shared';
import { getActiveSeatForPhase, planNextStep } from '../src/services/phase-scheduler.js';

function baseState(humanSeatIndex: number) {
  return createGame({
    board: STANDARD_12_YWLG,
    humanSeatIndex,
    humanRole: Role.VILLAGER,
    aiSeatIndices: Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== humanSeatIndex),
    seed: 99,
  });
}

describe('phase-scheduler', () => {
  it('queues AI job when active seat is AI', () => {
    const state = {
      ...baseState(3),
      phase: Phase.NIGHT_WOLF,
      day: 1,
    };
    for (const seat of state.seats) {
      if (seat.index !== 3) seat.type = SeatType.AI;
    }

    const plan = planNextStep(state.id, state, 3);
    expect(plan.aiJobs.length).toBeGreaterThan(0);
    expect(plan.aiJobs[0].phase).toBe(Phase.NIGHT_WOLF);
  });

  it('auto-advances day announce', () => {
    const state = {
      ...baseState(0),
      phase: Phase.DAY_ANNOUNCE,
      day: 1,
    };

    const plan = planNextStep(state.id, state, 0);
    expect(plan.autoActions).toEqual([{ type: 'END_DAY_ANNOUNCE' }]);
  });

  it('returns active speaker during discussion', () => {
    const state = {
      ...baseState(0),
      phase: Phase.DAY_DISCUSS,
      day: 1,
      currentSpeakerIndex: 0,
    };

    expect(getActiveSeatForPhase(state)).toBe(0);
  });
});
