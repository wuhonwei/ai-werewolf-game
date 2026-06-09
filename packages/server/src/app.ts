import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { env } from './config.js';
import { createGameStore, type GameStore } from './services/game-store.js';
import { GameService } from './services/game-service.js';
import { registerGameRoutes } from './routes/games.js';
import { registerSpeechRoutes } from './routes/speech.js';
import { registerAuthRoutes } from './routes/auth.js';
import { GameRoomManager, registerGameWebSocket } from './ws/game-socket.js';
import { createLLMClient } from './ai/deepseek-client.js';
import { AIPlayerService } from './ai/ai-player-service.js';
import { AIOrchestrator } from './workers/ai-orchestrator.js';
import { createVoiceFacade, type VoiceFacade } from './voice/voice-service.js';
import { createUserStore } from './db/postgres-user-store.js';
import type { UserStore } from './db/user-store.js';
import { optionalAuthHook, requireAuthHook } from './plugins/auth.js';

export interface AppOptions {
  gameStore?: GameStore;
  voice?: VoiceFacade;
  userStore?: UserStore;
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: true });
  const store = options.gameStore ?? createGameStore(env.redisUrl);
  const userStore = options.userStore ?? createUserStore(env.databaseUrl, env.usePostgres);
  const gameService = new GameService(store, app.log);
  const rooms = new GameRoomManager();
  const voice = options.voice ?? createVoiceFacade(env.publicBaseUrl);
  const llm = createLLMClient(env.deepseekApiKey, env.deepseekBaseUrl);
  const aiPlayer = new AIPlayerService(llm);
  const aiOrchestrator = new AIOrchestrator(gameService, aiPlayer, rooms, voice, app.log);

  await app.register(cors, { origin: true });
  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  app.decorate('gameService', gameService);
  app.decorate('gameStore', store);
  app.decorate('userStore', userStore);
  app.decorate('aiOrchestrator', aiOrchestrator);
  app.decorate('rooms', rooms);
  app.decorate('voice', voice);

  app.addHook('onRequest', optionalAuthHook);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'werewolf-server',
    env: env.nodeEnv,
    voice: voice.isCloudEnabled ? 'aliyun' : 'local',
    oss: voice.ossEnabled,
    authRequired: env.authRequired,
    postgres: env.usePostgres,
    redis: Boolean(env.redisUrl),
  }));

  app.get('/api/voices', async () => ({
    voices: [
      { id: 'xiaoyun', label: '小云', gender: 'female' },
      { id: 'xiaogang', label: '小刚', gender: 'male' },
      { id: 'ruoxi', label: '若兮', gender: 'female' },
      { id: 'siqi', label: '思琪', gender: 'female' },
      { id: 'sicheng', label: '思诚', gender: 'male' },
    ],
  }));

  await registerAuthRoutes(app, userStore);
  await registerGameRoutes(app, gameService, aiOrchestrator, requireAuthHook);
  await registerSpeechRoutes(app, gameService, aiOrchestrator, voice, requireAuthHook);

  app.get('/ws/games/:gameId', { websocket: true }, (socket, request) => {
    const { gameId } = request.params as { gameId: string };
    registerGameWebSocket(gameService, aiOrchestrator, rooms, voice, gameId, socket);
  });

  app.addHook('onClose', async () => {
    if ('disconnect' in store && typeof store.disconnect === 'function') {
      await store.disconnect();
    }
    if ('disconnect' in userStore && typeof userStore.disconnect === 'function') {
      await userStore.disconnect();
    }
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    gameService: GameService;
    gameStore: GameStore;
    userStore: UserStore;
    aiOrchestrator: AIOrchestrator;
    rooms: GameRoomManager;
    voice: VoiceFacade;
  }
}
