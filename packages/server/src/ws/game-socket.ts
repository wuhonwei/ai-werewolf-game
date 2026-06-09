import type { WebSocket } from 'ws';
import type { GameService } from '../services/game-service.js';
import type { AIOrchestrator } from '../workers/ai-orchestrator.js';
import type { VoiceFacade } from '../voice/voice-service.js';
import { WsClientMessageSchema } from '../schemas/game.js';
import { filterBroadcastEvents } from '../services/phase-scheduler.js';
import { serializeServerMessage, type ServerMessage } from './events.js';

type RoomSocket = WebSocket & { humanSeatIndex?: number };

export class GameRoomManager {
  private rooms = new Map<string, Set<RoomSocket>>();

  join(gameId: string, socket: RoomSocket) {
    if (!this.rooms.has(gameId)) {
      this.rooms.set(gameId, new Set());
    }
    this.rooms.get(gameId)!.add(socket);
  }

  leave(gameId: string, socket: RoomSocket) {
    this.rooms.get(gameId)?.delete(socket);
    if (this.rooms.get(gameId)?.size === 0) {
      this.rooms.delete(gameId);
    }
  }

  broadcast(gameId: string, message: ServerMessage) {
    const payload = serializeServerMessage(message);
    for (const socket of this.rooms.get(gameId) ?? []) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }
}

async function broadcastActionResult(
  gameService: GameService,
  voice: VoiceFacade | undefined,
  rooms: GameRoomManager,
  gameId: string,
  events: import('@werewolf/shared').GameEvent[],
): Promise<void> {
  for (const event of filterBroadcastEvents(events)) {
    rooms.broadcast(gameId, { type: 'ACTION_RESULT', event });

    if (event.type === 'SPEAK' && voice) {
      const seatIndex = event.payload.seatIndex as number;
      const text = event.payload.text as string;
      const voiceConfig = await gameService.getVoiceConfigForSeat(gameId, seatIndex);
      const audioUrl = await voice.synthesizeSpeech(
        text,
        voiceConfig.voiceId,
        voiceConfig.speed,
      );
      rooms.broadcast(gameId, { type: 'SPEECH', seatIndex, text, audioUrl });
    }
  }
}

export function registerGameWebSocket(
  gameService: GameService,
  aiOrchestrator: AIOrchestrator,
  rooms: GameRoomManager,
  voice: VoiceFacade | undefined,
  gameId: string,
  socket: RoomSocket,
) {
  socket.on('message', async (raw) => {
    try {
      const parsed = JSON.parse(String(raw));
      const message = WsClientMessageSchema.safeParse(parsed);
      if (!message.success) {
        socket.send(serializeServerMessage({ type: 'ERROR', message: 'Invalid message format' }));
        return;
      }

      switch (message.data.type) {
        case 'PING': {
          socket.send(serializeServerMessage({ type: 'PONG' }));
          return;
        }

        case 'JOIN': {
          socket.humanSeatIndex = message.data.humanSeatIndex;
          rooms.join(gameId, socket);

          const view = await gameService.getPlayerView(gameId, message.data.humanSeatIndex);
          if (!view) {
            socket.send(serializeServerMessage({ type: 'ERROR', message: 'Game not found' }));
            return;
          }

          socket.send(
            serializeServerMessage({
              type: 'STATE_SYNC',
              publicState: view.publicState,
              humanRole: view.humanRole,
              discussion: view.discussion,
              lastNightDeaths: view.lastNightDeaths,
              hints: view.hints,
            }),
          );
          return;
        }

        case 'ACTION': {
          if (socket.humanSeatIndex === undefined) {
            socket.send(serializeServerMessage({ type: 'ERROR', message: 'Send JOIN first' }));
            return;
          }

          const result = await gameService.applyHumanAction(
            gameId,
            socket.humanSeatIndex,
            message.data.action,
          );

          if (!result.ok) {
            socket.send(serializeServerMessage({ type: 'ERROR', message: result.error }));
            return;
          }

          await broadcastActionResult(gameService, voice, rooms, gameId, result.events);

          rooms.broadcast(gameId, {
            type: 'STATE_SYNC',
            publicState: result.publicState,
            humanRole: result.humanRole,
            discussion: result.discussion,
            lastNightDeaths: result.lastNightDeaths,
            hints: result.hints,
          });

          if (result.aiJobsQueued > 0) {
            aiOrchestrator.enqueue(gameId, socket.humanSeatIndex);
          }
          return;
        }
      }
    } catch {
      socket.send(serializeServerMessage({ type: 'ERROR', message: 'Internal error' }));
    }
  });

  socket.on('close', () => {
    rooms.leave(gameId, socket);
  });
}
