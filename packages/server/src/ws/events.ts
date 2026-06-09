import type { GameEvent, PlayerHints, PublicGameState, Role } from '@werewolf/shared';

export interface ServerStateSyncMessage {
  type: 'STATE_SYNC';
  publicState: PublicGameState;
  humanRole: Role;
  discussion: Array<{
    seatIndex: number;
    text: string;
    day: number;
    phase: string;
    timestamp: number;
  }>;
  lastNightDeaths: number[];
  hints: PlayerHints;
}

export interface ServerSpeechMessage {
  type: 'SPEECH';
  seatIndex: number;
  text: string;
  audioUrl: string;
}

export interface ServerEventMessage {
  type: 'ACTION_RESULT' | 'PHASE_CHANGE' | 'AI_THINKING' | 'GAME_OVER' | 'ERROR';
  event?: GameEvent;
  message?: string;
}

export interface ServerPongMessage {
  type: 'PONG';
}

export type ServerMessage =
  | ServerStateSyncMessage
  | ServerEventMessage
  | ServerSpeechMessage
  | ServerPongMessage;

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
