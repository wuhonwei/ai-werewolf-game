import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { GameService } from '../services/game-service.js';
import type { AIOrchestrator } from '../workers/ai-orchestrator.js';
import type { VoiceFacade } from '../voice/voice-service.js';
import { filterBroadcastEvents } from '../services/phase-scheduler.js';

const AUDIO_FORMATS = new Set(['mp3', 'aac', 'wav']);

export async function registerSpeechRoutes(
  app: FastifyInstance,
  gameService: GameService,
  aiOrchestrator: AIOrchestrator,
  voice: VoiceFacade,
  requireAuth: preHandlerHookHandler,
) {
  app.get('/api/audio/:hash', async (request, reply) => {
    const { hash } = request.params as { hash: string };
    const audio = voice.getAudio(hash);
    if (!audio) {
      return reply.status(404).send({ error: 'Audio not found' });
    }
    return reply.type('audio/mpeg').send(audio);
  });

  app.post('/api/games/:gameId/speech/audio', { preHandler: requireAuth }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const humanSeatIndex = Number((request.query as { humanSeatIndex?: string }).humanSeatIndex);

    if (Number.isNaN(humanSeatIndex)) {
      return reply.status(400).send({ error: 'humanSeatIndex query param required' });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'audio file required' });
    }

    const formatRaw = (request.query as { format?: string }).format ?? 'mp3';
    const format = AUDIO_FORMATS.has(formatRaw)
      ? (formatRaw as 'mp3' | 'aac' | 'wav')
      : 'mp3';

    const buffer = await file.toBuffer();
    const text = await voice.transcribeAudio(buffer, format);
    if (!text.trim()) {
      return reply.status(400).send({ error: 'Could not transcribe audio' });
    }

    const result = await gameService.applyHumanAction(gameId, humanSeatIndex, {
      type: 'SPEAK',
      seatIndex: humanSeatIndex,
      text: text.trim(),
    });

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    const voiceConfig = await gameService.getVoiceConfigForSeat(gameId, humanSeatIndex);
    const audioUrl = await voice.synthesizeSpeech(text.trim(), voiceConfig.voiceId, voiceConfig.speed);

    for (const event of filterBroadcastEvents(result.events)) {
      app.rooms.broadcast(gameId, { type: 'ACTION_RESULT', event });
      if (event.type === 'SPEAK') {
        app.rooms.broadcast(gameId, {
          type: 'SPEECH',
          seatIndex: event.payload.seatIndex as number,
          text: event.payload.text as string,
          audioUrl,
        });
      }
    }

    app.rooms.broadcast(gameId, {
      type: 'STATE_SYNC',
      publicState: result.publicState,
      humanRole: result.humanRole,
      discussion: result.discussion,
      lastNightDeaths: result.lastNightDeaths,
      hints: result.hints,
    });

    if (result.aiJobsQueued > 0) {
      aiOrchestrator.enqueue(gameId, humanSeatIndex);
    }

    return { text: text.trim(), audioUrl, result };
  });
}
