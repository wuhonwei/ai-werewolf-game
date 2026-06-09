import type { Phase } from './game.js';

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'SPEAK'; seatIndex: number; text: string }
  | { type: 'END_SPEECH'; seatIndex: number }
  | { type: 'WOLF_KILL'; seatIndex: number; target: number }
  | { type: 'SEER_CHECK'; seatIndex: number; target: number }
  | { type: 'WITCH_HEAL'; seatIndex: number; useHeal: boolean }
  | { type: 'WITCH_POISON'; seatIndex: number; target: number | null }
  | { type: 'GUARD_PROTECT'; seatIndex: number; target: number }
  | { type: 'VOTE'; seatIndex: number; target: number | null }
  | { type: 'HUNTER_SHOOT'; seatIndex: number; target: number }
  | { type: 'SKIP_NIGHT_ACTION'; seatIndex: number }
  | { type: 'END_DAY_ANNOUNCE' };

export interface GameEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export type ActionResult =
  | { ok: true; state: import('./game.js').GameState; events: GameEvent[] }
  | { ok: false; error: string };

export interface AllowedActionHint {
  actionTypes: GameAction['type'][];
  seatIndex: number;
  phase: Phase;
}
