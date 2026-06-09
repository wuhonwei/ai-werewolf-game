import { GameStatus, Phase, type GameAction, type GameState } from '@werewolf/shared';
import type { ActionResult, GameEvent } from '@werewolf/shared';
import { resolveNight } from './check-win.js';
import {
  handleDayAnnounceContinue,
  handleEndSpeech,
  handleHunterShoot,
  handleSpeak,
  handleVote,
  runCheckWinPhase,
} from './reducers/day.js';
import {
  autoAdvanceDeadRolePhases,
  handleGuardProtect,
  handleNightResolve,
  handleSeerCheck,
  handleSkipNightAction,
  handleWitchHeal,
  handleWitchPoison,
  handleWolfKill,
} from './reducers/night.js';

function postProcess(state: GameState, events: GameEvent[]): GameState {
  let current = autoAdvanceDeadRolePhases(state);

  if (current.phase === Phase.NIGHT_RESOLVE) {
    const resolved = handleNightResolve(current);
    events.push(...resolved.events);
    current = resolved.state;
  }

  if (current.phase === Phase.CHECK_WIN) {
    const result = runCheckWinPhase(current);
    events.push(...result.events);
    current = result.state;
  }

  return current;
}

function success(state: GameState, events: GameEvent[]): ActionResult {
  const processed = postProcess(state, events);
  return { ok: true, state: processed, events };
}

export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.status === GameStatus.FINISHED) {
    return { ok: false, error: 'Game is already finished' };
  }

  switch (action.type) {
    case 'START_GAME': {
      if (state.phase !== Phase.ROLE_REVEAL) {
        return { ok: false, error: 'Game can only start from role_reveal phase' };
      }
      const events: GameEvent[] = [
        { type: 'PHASE_CHANGE', payload: { phase: Phase.NIGHT_WOLF, day: 1 }, timestamp: Date.now() },
      ];
      const next = postProcess(
        { ...state, phase: Phase.NIGHT_WOLF, day: 1 },
        events,
      );
      return { ok: true, state: next, events };
    }

    case 'WOLF_KILL': {
      const result = handleWolfKill(state, action.seatIndex, action.target);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'SEER_CHECK': {
      const result = handleSeerCheck(state, action.seatIndex, action.target);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'WITCH_HEAL': {
      const result = handleWitchHeal(state, action.seatIndex, action.useHeal);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'WITCH_POISON': {
      const result = handleWitchPoison(state, action.seatIndex, action.target);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'GUARD_PROTECT': {
      const result = handleGuardProtect(state, action.seatIndex, action.target);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'SKIP_NIGHT_ACTION': {
      const result = handleSkipNightAction(state, action.seatIndex);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'END_DAY_ANNOUNCE': {
      if (state.phase !== Phase.DAY_ANNOUNCE) {
        return { ok: false, error: 'Not in day announce phase' };
      }
      const { state: next, events } = handleDayAnnounceContinue(state);
      return { ok: true, state: next, events };
    }

    case 'SPEAK': {
      const result = handleSpeak(state, action.seatIndex, action.text);
      if (!result.ok) return result;
      return { ok: true, state: result.state, events: result.events };
    }

    case 'END_SPEECH': {
      const result = handleEndSpeech(state, action.seatIndex);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'VOTE': {
      const result = handleVote(state, action.seatIndex, action.target);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    case 'HUNTER_SHOOT': {
      const result = handleHunterShoot(state, action.seatIndex, action.target);
      if (!result.ok) return result;
      return success(result.state, result.events);
    }

    default:
      return { ok: false, error: `Action ${(action as GameAction).type} not implemented yet` };
  }
}

/** @internal exported for tests */
export { resolveNight, runCheckWinPhase };
