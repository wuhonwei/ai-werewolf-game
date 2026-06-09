import {
  Phase,
  Role,
  SeatType,
  type GameAction,
  type GameEvent,
  type GameState,
} from '@werewolf/shared';
import { findSeatIndex } from '@werewolf/engine';

export interface AIJobStub {
  gameId: string;
  seatIndex: number;
  phase: Phase;
  role: Role;
}

export function getRoleForPhase(phase: Phase): Role | null {
  switch (phase) {
    case Phase.NIGHT_WOLF:
      return Role.WEREWOLF;
    case Phase.NIGHT_SEER:
      return Role.SEER;
    case Phase.NIGHT_WITCH:
      return Role.WITCH;
    case Phase.NIGHT_GUARD:
      return Role.GUARD;
    default:
      return null;
  }
}

export function getActiveSeatForPhase(state: GameState): number | null {
  const phase = state.phase;

  if (phase === Phase.DAY_DISCUSS) {
    const order = state.speakOrder.filter((idx) => state.seats[idx]?.alive);
    return order[state.currentSpeakerIndex] ?? null;
  }

  if (phase === Phase.DAY_VOTE && state.currentVotes) {
    const pending = Object.entries(state.currentVotes).find(([, vote]) => vote === null);
    return pending ? Number(pending[0]) : null;
  }

  if (phase === Phase.HUNTER_SHOOT) {
    return state.pendingHunterSeat;
  }

  const role = getRoleForPhase(phase);
  if (role) {
    return findSeatIndex(state, role);
  }

  return null;
}

export function planNextStep(
  gameId: string,
  state: GameState,
  humanSeatIndex: number,
): { aiJobs: AIJobStub[]; autoActions: GameAction[] } {
  const aiJobs: AIJobStub[] = [];
  const autoActions: GameAction[] = [];

  if (state.phase === Phase.DAY_ANNOUNCE) {
    autoActions.push({ type: 'END_DAY_ANNOUNCE' });
    return { aiJobs, autoActions };
  }

  const activeSeat = getActiveSeatForPhase(state);
  if (activeSeat === null) return { aiJobs, autoActions };

  const seat = state.seats[activeSeat];
  if (!seat?.alive) return { aiJobs, autoActions };

  if (seat.type === SeatType.AI && activeSeat !== humanSeatIndex) {
    const role = getRoleForPhase(state.phase) ?? seat.role;
    aiJobs.push({ gameId, seatIndex: activeSeat, phase: state.phase, role });
  }

  return { aiJobs, autoActions };
}

export function logAIJobs(jobs: AIJobStub[], logger: { info: (obj: unknown, msg?: string) => void }) {
  for (const job of jobs) {
    logger.info({ job }, 'AI job enqueued');
  }
}

export function filterBroadcastEvents(events: GameEvent[]): GameEvent[] {
  return events.filter((e) =>
    [
      'PHASE_CHANGE',
      'SPEAK',
      'ACTION_RESULT',
      'PLAYER_DIED',
      'PLAYER_EXILED',
      'VOTE_RESULT',
      'GAME_OVER',
      'NIGHT_RESOLVED',
      'HUNTER_CAN_SHOOT',
      'DAY_ANNOUNCE',
    ].includes(e.type),
  );
}
