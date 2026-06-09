import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/game-engine.js';
import { runCheckWinPhase } from '../src/check-win.js';
import { Faction, GameStatus, Phase, Role } from '@werewolf/shared';
import { createTestState } from './test-utils.js';

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

const ALL_SEATS = Array.from({ length: 12 }, (_, i) => i);

function enterDayDiscuss(state: ReturnType<typeof createTestState>) {
  return {
    ...state,
    phase: Phase.DAY_DISCUSS,
    day: 1,
    currentSpeakerIndex: 0,
    speakOrder: ALL_SEATS,
  };
}

function enterDayVote(state: ReturnType<typeof createTestState>) {
  return {
    ...state,
    phase: Phase.DAY_VOTE,
    currentVotes: Object.fromEntries(ALL_SEATS.map((i) => [i, null])) as Record<
      number,
      number | null
    >,
  };
}

describe('day phase', () => {
  it('rotates speak order among alive players', () => {
    let state = enterDayDiscuss(createTestState(STANDARD_ROLES));

    for (const seatIndex of ALL_SEATS) {
      const speak = applyAction(state, { type: 'SPEAK', seatIndex, text: `speech ${seatIndex}` });
      expect(speak.ok).toBe(true);
      if (!speak.ok) return;

      const end = applyAction(speak.state, { type: 'END_SPEECH', seatIndex });
      expect(end.ok).toBe(true);
      if (!end.ok) return;
      state = end.state;
    }

    expect(state.phase).toBe(Phase.DAY_VOTE);
    expect(state.currentVotes).not.toBeNull();
  });

  it('exiles player with most votes', () => {
    let state = enterDayVote(createTestState(STANDARD_ROLES));
    const exileTarget = 8;

    for (const seatIndex of ALL_SEATS) {
      const target = seatIndex === exileTarget ? 0 : exileTarget;
      const r = applyAction(state, { type: 'VOTE', seatIndex, target });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      state = r.state;
      if (state.phase !== Phase.DAY_VOTE) break;
    }

    expect(state.seats[exileTarget].alive).toBe(false);
  });

  it('tie vote exiles nobody when tieVoteNoExile is true', () => {
    const state = {
      ...enterDayVote(createTestState(STANDARD_ROLES)),
      currentVotes: {
        0: 6,
        1: 6,
        2: 6,
        3: 6,
        4: 6,
        5: 7,
        6: 7,
        7: 6,
        8: 7,
        9: 7,
        10: 7,
        11: null,
      } as Record<number, number | null>,
    };

    const final = applyAction(state, { type: 'VOTE', seatIndex: 11, target: 7 });
    expect(final.ok).toBe(true);
    if (final.ok) {
      expect(final.state.seats[6].alive).toBe(true);
      expect(final.state.seats[7].alive).toBe(true);
    }
  });

  it('hunter can shoot after exile', () => {
    const roles = [...STANDARD_ROLES];
    roles[4] = Role.HUNTER;

    const base = createTestState(roles);
    const state = {
      ...base,
      phase: Phase.HUNTER_SHOOT,
      pendingHunterSeat: 4,
      pendingHunterReason: 'exile' as const,
      seats: base.seats.map((s) => (s.index === 4 ? { ...s, alive: false } : s)),
    };

    const result = applyAction(state, { type: 'HUNTER_SHOOT', seatIndex: 4, target: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.seats[0].alive).toBe(false);
      expect(result.state.pendingHunterSeat).toBeNull();
    }
  });
});

describe('check win', () => {
  it('villagers win when all wolves dead', () => {
    const roles: Role[] = [
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.VILLAGER,
      Role.SEER,
      Role.WITCH,
      Role.HUNTER,
      Role.GUARD,
    ];

    const state = {
      ...createTestState(roles),
      phase: Phase.CHECK_WIN,
    };

    const result = runCheckWinPhase(state);
    expect(result.state.status).toBe(GameStatus.FINISHED);
    expect(result.state.winner).toBe(Faction.VILLAGER);
  });

  it('wolves win when all gods eliminated', () => {
    const alive = [true, true, true, true, true, true, true, true, false, false, false, false];
    const state = {
      ...createTestState(STANDARD_ROLES, { alive }),
      phase: Phase.CHECK_WIN,
    };

    const result = runCheckWinPhase(state);
    expect(result.state.status).toBe(GameStatus.FINISHED);
    expect(result.state.winner).toBe(Faction.WEREWOLF);
  });
});
