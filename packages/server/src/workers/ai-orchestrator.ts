import type { GameService, ActionResultView } from '../services/game-service.js';
import type { AIPlayerService } from '../ai/ai-player-service.js';
import type { GameRoomManager } from '../ws/game-socket.js';
import type { VoiceFacade } from '../voice/voice-service.js';
import { filterBroadcastEvents } from '../services/phase-scheduler.js';
import type { AIJobStub } from '../services/phase-scheduler.js';

export class AIOrchestrator {
  private running = new Set<string>();

  constructor(
    private readonly gameService: GameService,
    private readonly aiPlayer: AIPlayerService,
    private readonly rooms?: GameRoomManager,
    private readonly voice?: VoiceFacade,
    private readonly logger: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void } = console,
  ) {}

  enqueue(gameId: string, humanSeatIndex: number): void {
    if (this.running.has(gameId)) return;
    this.running.add(gameId);

    void this.runChain(gameId, humanSeatIndex)
      .catch((err) => this.logger.error({ err, gameId }, 'AI chain failed'))
      .finally(() => this.running.delete(gameId));
  }

  private async runChain(gameId: string, humanSeatIndex: number): Promise<void> {
    let iterations = 40;

    while (iterations-- > 0) {
      const pending = await this.gameService.getPendingPlan(gameId, humanSeatIndex);
      if (!pending) break;

      if (pending.autoActions.length > 0) {
        const result = await this.gameService.applyAutoActions(gameId, humanSeatIndex);
        if (result) await this.broadcast(gameId, humanSeatIndex, result);
        continue;
      }

      if (pending.aiJobs.length === 0) break;

      for (const job of pending.aiJobs) {
        await this.processJob(gameId, humanSeatIndex, job);
      }
    }
  }

  private async processJob(
    gameId: string,
    humanSeatIndex: number,
    job: AIJobStub,
  ): Promise<void> {
    this.rooms?.broadcast(gameId, {
      type: 'AI_THINKING',
      message: `${job.seatIndex + 1}号 AI 思考中…`,
    });

    const result = await this.gameService.applyAIJob(
      gameId,
      humanSeatIndex,
      job.seatIndex,
      this.aiPlayer,
    );

    if (!result) return;
    await this.broadcast(gameId, humanSeatIndex, result);
  }

  private async broadcast(
    gameId: string,
    humanSeatIndex: number,
    result: ActionResultView,
  ): Promise<void> {
    if (!this.rooms) return;

    for (const event of filterBroadcastEvents(result.events)) {
      this.rooms.broadcast(gameId, { type: 'ACTION_RESULT', event });

      if (event.type === 'SPEAK' && this.voice) {
        const seatIndex = event.payload.seatIndex as number;
        const text = event.payload.text as string;
        const voiceConfig = await this.gameService.getVoiceConfigForSeat(gameId, seatIndex);
        const audioUrl = await this.voice.synthesizeSpeech(
          text,
          voiceConfig.voiceId,
          voiceConfig.speed,
        );
        this.rooms.broadcast(gameId, { type: 'SPEECH', seatIndex, text, audioUrl });
      }
    }

    const view = await this.gameService.getPlayerView(gameId, humanSeatIndex);
    if (!view) return;

    this.rooms.broadcast(gameId, {
      type: 'STATE_SYNC',
      publicState: view.publicState,
      humanRole: view.humanRole,
      discussion: view.discussion,
      lastNightDeaths: view.lastNightDeaths,
      hints: view.hints,
    });
  }
}
