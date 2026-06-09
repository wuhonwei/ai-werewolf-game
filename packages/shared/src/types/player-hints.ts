import type { SeerCheckRecord } from './game.js';

export type ActionPanel =
  | 'none'
  | 'start'
  | 'night_wolf'
  | 'night_seer'
  | 'night_witch_heal'
  | 'night_witch_poison'
  | 'night_guard'
  | 'discuss'
  | 'vote'
  | 'hunter'
  | 'waiting'
  | 'game_over';

export interface WitchHints {
  healAvailable: boolean;
  poisonAvailable: boolean;
  wolfTarget: number | null;
  healDecided: boolean;
  poisonDecided: boolean;
}

export interface PlayerHints {
  activeSeatIndex: number | null;
  isHumanTurn: boolean;
  panel: ActionPanel;
  seerChecks: SeerCheckRecord[];
  witch: WitchHints | null;
  guardLastTarget: number | null;
  hasVoted: boolean;
}

export interface PlayerViewPayload {
  hints: PlayerHints;
  lastNightDeaths: number[];
}
