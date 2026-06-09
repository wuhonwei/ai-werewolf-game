import { Phase, Role, type GameAction, type GameState } from '@werewolf/shared';
import type { AIResponse } from './parse-ai-response.js';

function pickRandomTarget(state: GameState, seatIndex: number): number {
  const candidates = state.seats.filter((s) => s.alive && s.index !== seatIndex).map((s) => s.index);
  return candidates[0] ?? 0;
}

export function mapAIResponseToActions(
  state: GameState,
  seatIndex: number,
  response: AIResponse,
): GameAction[] {
  const actions: GameAction[] = [];
  const speech = response.speech.trim();
  if (speech.length > 0) {
    actions.push({ type: 'SPEAK', seatIndex, text: speech });
  }

  const target =
    response.action?.target ??
    response.preferredTarget ??
    response.action?.preferredTarget ??
    pickRandomTarget(state, seatIndex);

  switch (state.phase) {
    case Phase.NIGHT_WOLF:
      actions.push({ type: 'WOLF_KILL', seatIndex, target });
      break;

    case Phase.NIGHT_SEER:
      actions.push({ type: 'SEER_CHECK', seatIndex, target });
      break;

    case Phase.NIGHT_WITCH:
      if (!state.witchHealDecided) {
        actions.push({
          type: 'WITCH_HEAL',
          seatIndex,
          useHeal: response.action?.useHeal ?? false,
        });
      } else {
        actions.push({
          type: 'WITCH_POISON',
          seatIndex,
          target: response.action?.target ?? null,
        });
      }
      break;

    case Phase.NIGHT_GUARD:
      actions.push({ type: 'GUARD_PROTECT', seatIndex, target });
      break;

    case Phase.DAY_DISCUSS:
      actions.push({ type: 'END_SPEECH', seatIndex });
      break;

    case Phase.DAY_VOTE:
      actions.push({
        type: 'VOTE',
        seatIndex,
        target: response.action?.target ?? target,
      });
      break;

    case Phase.HUNTER_SHOOT:
      actions.push({ type: 'HUNTER_SHOOT', seatIndex, target });
      break;

    default:
      break;
  }

  return actions;
}

export function tallyWolfVotes(votes: Map<number, number>): number {
  const counts = new Map<number, number>();
  for (const target of votes.values()) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }

  let max = 0;
  let winners: number[] = [];
  for (const [target, count] of counts) {
    if (count > max) {
      max = count;
      winners = [target];
    } else if (count === max) {
      winners.push(target);
    }
  }

  return winners.sort((a, b) => a - b)[0];
}

export function getAliveWolfSeats(state: GameState): number[] {
  return state.seats
    .filter((s) => s.alive && s.role === Role.WEREWOLF)
    .map((s) => s.index)
    .sort((a, b) => a - b);
}
