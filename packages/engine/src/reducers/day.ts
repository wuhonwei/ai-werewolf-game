import { Phase, Role, type GameState } from '@werewolf/shared';
import type { GameEvent } from '@werewolf/shared';
import { advanceFromDayAnnounce, runCheckWinPhase } from '../check-win.js';
import {
  event,
  getAliveSpeakOrder,
  getSeat,
  isAlive,
  killSeat,
} from '../helpers/state.js';

function tallyVotes(votes: Record<number, number | null>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const target of Object.values(votes)) {
    if (target === null) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  return counts;
}

function findExileTarget(
  counts: Map<number, number>,
  tieVoteNoExile: boolean,
): number | null {
  if (counts.size === 0) return null;

  let maxVotes = 0;
  let candidates: number[] = [];

  for (const [target, count] of counts) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [target];
    } else if (count === maxVotes) {
      candidates.push(target);
    }
  }

  if (tieVoteNoExile && candidates.length > 1) return null;
  return candidates[0] ?? null;
}

export function handleSpeak(
  state: GameState,
  seatIndex: number,
  text: string,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  if (state.phase !== Phase.DAY_DISCUSS) {
    return { ok: false, error: 'Not in discussion phase' };
  }
  if (!isAlive(state, seatIndex)) return { ok: false, error: 'Speaker is dead' };

  const order = getAliveSpeakOrder(state);
  const expected = order[state.currentSpeakerIndex];
  if (expected !== seatIndex) {
    return { ok: false, error: `Not seat ${seatIndex}'s turn to speak` };
  }

  const events: GameEvent[] = [event('SPEAK', { seatIndex, text })];
  const next: GameState = {
    ...state,
    discussion: [
      ...state.discussion,
      { seatIndex, text, day: state.day, phase: Phase.DAY_DISCUSS, timestamp: Date.now() },
    ],
  };
  return { ok: true, state: next, events };
}

export function handleEndSpeech(
  state: GameState,
  seatIndex: number,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  if (state.phase !== Phase.DAY_DISCUSS) {
    return { ok: false, error: 'Not in discussion phase' };
  }

  const order = getAliveSpeakOrder(state);
  const expected = order[state.currentSpeakerIndex];
  if (expected !== seatIndex) {
    return { ok: false, error: `Not seat ${seatIndex}'s turn` };
  }

  const events: GameEvent[] = [event('END_SPEECH', { seatIndex })];
  const nextIndex = state.currentSpeakerIndex + 1;

  if (nextIndex >= order.length) {
    const votes: Record<number, number | null> = {};
    for (const idx of order) votes[idx] = null;
    return {
      ok: true,
      state: {
        ...state,
        phase: Phase.DAY_VOTE,
        currentVotes: votes,
      },
      events: [...events, event('PHASE_CHANGE', { phase: Phase.DAY_VOTE })],
    };
  }

  return {
    ok: true,
    state: { ...state, currentSpeakerIndex: nextIndex },
    events,
  };
}

export function handleVote(
  state: GameState,
  seatIndex: number,
  target: number | null,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  if (state.phase !== Phase.DAY_VOTE) return { ok: false, error: 'Not in vote phase' };
  if (!isAlive(state, seatIndex)) return { ok: false, error: 'Voter is dead' };
  if (target !== null && !isAlive(state, target)) return { ok: false, error: 'Target is dead' };
  if (target === seatIndex) return { ok: false, error: 'Cannot vote for yourself' };
  if (!state.currentVotes || !(seatIndex in state.currentVotes)) {
    return { ok: false, error: 'Invalid voter' };
  }
  if (state.currentVotes[seatIndex] !== null) {
    return { ok: false, error: 'Already voted' };
  }

  const votes = { ...state.currentVotes, [seatIndex]: target };
  const events: GameEvent[] = [event('VOTE', { seatIndex, target })];

  const alive = getAliveSpeakOrder(state);
  const allVoted = alive.every((idx) => votes[idx] !== null && votes[idx] !== undefined);

  if (!allVoted) {
    return { ok: true, state: { ...state, currentVotes: votes }, events };
  }

  const counts = tallyVotes(votes);
  const exiled = findExileTarget(counts, state.rules.tieVoteNoExile);

  let next: GameState = {
    ...state,
    phase: Phase.DAY_VOTE_RESULT,
    currentVotes: null,
    votes: [...state.votes, { day: state.day, votes, exiled }],
  };

  events.push(event('VOTE_RESULT', { exiled, votes }));

  if (exiled !== null) {
    next = killSeat(next, exiled);
    events.push(event('PLAYER_EXILED', { seatIndex: exiled }));
    if (getSeat(next, exiled).role === Role.HUNTER) {
      next = {
        ...next,
        pendingHunterSeat: exiled,
        pendingHunterReason: 'exile',
        phase: Phase.HUNTER_SHOOT,
      };
      events.push(event('HUNTER_CAN_SHOOT', { seatIndex: exiled }));
      return { ok: true, state: next, events };
    }
  }

  next = { ...next, phase: Phase.CHECK_WIN };
  events.push(event('PHASE_CHANGE', { phase: Phase.CHECK_WIN }));
  return { ok: true, state: next, events };
}

export function handleDayAnnounceContinue(
  state: GameState,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [
    event('DAY_ANNOUNCE', { deaths: state.lastNightDeaths }),
    event('PHASE_CHANGE', { phase: Phase.DAY_DISCUSS }),
  ];
  return { state: advanceFromDayAnnounce(state), events };
}

export function handleHunterShoot(
  state: GameState,
  seatIndex: number,
  target: number,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  if (state.phase !== Phase.HUNTER_SHOOT) return { ok: false, error: 'Not hunter shoot phase' };
  if (state.pendingHunterSeat !== seatIndex) return { ok: false, error: 'Not this hunter turn' };
  if (!isAlive(state, target)) return { ok: false, error: 'Target is dead' };
  if (target === seatIndex) return { ok: false, error: 'Hunter cannot shoot themselves' };

  const events: GameEvent[] = [event('HUNTER_SHOOT', { seatIndex, target })];
  let next = killSeat(state, target);
  const reason = state.pendingHunterReason;
  next = { ...next, pendingHunterSeat: null, pendingHunterReason: null };
  events.push(event('PLAYER_DIED', { seatIndex: target, cause: 'hunter' }));

  if (reason === 'night') {
    next = { ...next, phase: Phase.DAY_ANNOUNCE };
    events.push(event('PHASE_CHANGE', { phase: Phase.DAY_ANNOUNCE }));
  } else {
    const result = runCheckWinPhase(next);
    return { ok: true, state: result.state, events: [...events, ...result.events] };
  }

  return { ok: true, state: next, events };
}

export { runCheckWinPhase };
