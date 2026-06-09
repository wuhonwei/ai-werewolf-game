import {
  GameStatus,
  Phase,
  Role,
  type GameState,
  type PlayerHints,
  type ActionPanel,
} from '@werewolf/shared';
import { getActiveSeatForPhase } from './phase-scheduler.js';

export function buildPlayerHints(state: GameState, humanSeatIndex: number): PlayerHints {
  const humanSeat = state.seats[humanSeatIndex];
  const humanRole = humanSeat?.role;
  const activeSeat = getActiveSeatForPhase(state);
  const isHumanTurn = activeSeat === humanSeatIndex && Boolean(humanSeat?.alive);

  let panel: ActionPanel = 'waiting';

  if (state.phase === Phase.GAME_OVER || state.status === GameStatus.FINISHED) {
    panel = 'game_over';
  } else if (state.phase === Phase.ROLE_REVEAL) {
    panel = 'start';
  } else if (isHumanTurn) {
    switch (state.phase) {
      case Phase.NIGHT_WOLF:
        panel = humanRole === Role.WEREWOLF ? 'night_wolf' : 'waiting';
        break;
      case Phase.NIGHT_SEER:
        panel = humanRole === Role.SEER ? 'night_seer' : 'waiting';
        break;
      case Phase.NIGHT_WITCH:
        if (humanRole === Role.WITCH) {
          if (!state.witchHealDecided) panel = 'night_witch_heal';
          else if (!state.witchPoisonDecided) panel = 'night_witch_poison';
        }
        break;
      case Phase.NIGHT_GUARD:
        panel = humanRole === Role.GUARD ? 'night_guard' : 'waiting';
        break;
      case Phase.DAY_DISCUSS:
        panel = 'discuss';
        break;
      case Phase.DAY_VOTE:
        panel = 'vote';
        break;
      case Phase.HUNTER_SHOOT:
        panel = 'hunter';
        break;
      default:
        panel = 'waiting';
    }
  }

  const seerChecks = humanRole === Role.SEER ? state.seerChecks : [];

  const witch =
    humanRole === Role.WITCH
      ? {
          healAvailable: state.witch.healAvailable,
          poisonAvailable: state.witch.poisonAvailable,
          wolfTarget: state.night.wolfTarget,
          healDecided: state.witchHealDecided,
          poisonDecided: state.witchPoisonDecided,
        }
      : null;

  const guardLastTarget = humanRole === Role.GUARD ? state.night.lastGuardTarget : null;

  const hasVoted =
    state.phase === Phase.DAY_VOTE && state.currentVotes
      ? state.currentVotes[humanSeatIndex] !== null
      : false;

  return {
    activeSeatIndex: activeSeat,
    isHumanTurn,
    panel,
    seerChecks,
    witch,
    guardLastTarget,
    hasVoted,
  };
}
