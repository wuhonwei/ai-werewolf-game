import { useCallback, useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import type { GameAction, GameEvent, PlayerHints, PublicGameState, Role } from '@werewolf/shared';
import { WS_BASE } from '../config/api';
import type { DeathCause } from '../components/SeatGrid';
import type { VoteResultData } from '../components/VoteResultOverlay';

export interface DiscussionEntry {
  seatIndex: number;
  text: string;
  day: number;
  phase: string;
  timestamp: number;
}

export interface SpeechEvent {
  seatIndex: number;
  text: string;
  audioUrl: string;
}

export interface DeathFlash {
  seatIndex: number;
  cause: DeathCause;
}

interface StateSyncMessage {
  type: 'STATE_SYNC';
  publicState: PublicGameState;
  humanRole: Role;
  discussion: DiscussionEntry[];
  lastNightDeaths: number[];
  hints: PlayerHints;
}

interface SpeechMessage {
  type: 'SPEECH';
  seatIndex: number;
  text: string;
  audioUrl: string;
}

interface AiThinkingMessage {
  type: 'AI_THINKING';
  message: string;
}

interface ActionResultMessage {
  type: 'ACTION_RESULT';
  event: GameEvent;
}

type ServerMessage =
  | StateSyncMessage
  | SpeechMessage
  | AiThinkingMessage
  | ActionResultMessage
  | { type: string; message?: string };

const defaultHints: PlayerHints = {
  activeSeatIndex: null,
  isHumanTurn: false,
  panel: 'waiting',
  seerChecks: [],
  witch: null,
  guardLastTarget: null,
  hasVoted: false,
};

const DEATH_ANIM_MS = 1800;
const VOTE_OVERLAY_MS = 5000;

function parseDeathCause(type: string, payload: Record<string, unknown>): DeathCause {
  if (type === 'PLAYER_EXILED') return 'exile';
  const cause = payload.cause as string | undefined;
  if (cause === 'wolf') return 'wolf';
  if (cause === 'poison') return 'poison';
  if (cause === 'hunter') return 'hunter';
  return 'night';
}

export function useGameSocket(gameId: string, humanSeatIndex: number) {
  const [connected, setConnected] = useState(false);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [humanRole, setHumanRole] = useState<Role | null>(null);
  const [hints, setHints] = useState<PlayerHints>(defaultHints);
  const [discussion, setDiscussion] = useState<DiscussionEntry[]>([]);
  const [lastNightDeaths, setLastNightDeaths] = useState<number[]>([]);
  const [lastSpeech, setLastSpeech] = useState<SpeechEvent | null>(null);
  const [aiThinking, setAiThinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deathFlashes, setDeathFlashes] = useState<DeathFlash[]>([]);
  const [voteResult, setVoteResult] = useState<VoteResultData | null>(null);
  const [showVoteResult, setShowVoteResult] = useState(false);
  const socketRef = useRef<Taro.SocketTask | null>(null);
  const audioRef = useRef<Taro.InnerAudioContext | null>(null);
  const deathTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const voteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDeathFlash = useCallback((seatIndex: number, cause: DeathCause) => {
    setDeathFlashes((prev) => {
      if (prev.some((f) => f.seatIndex === seatIndex)) return prev;
      return [...prev, { seatIndex, cause }];
    });

    const existing = deathTimersRef.current.get(seatIndex);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setDeathFlashes((prev) => prev.filter((f) => f.seatIndex !== seatIndex));
      deathTimersRef.current.delete(seatIndex);
    }, DEATH_ANIM_MS);

    deathTimersRef.current.set(seatIndex, timer);
  }, []);

  const showVoteOverlay = useCallback((data: VoteResultData) => {
    setVoteResult(data);
    setShowVoteResult(true);
    if (voteTimerRef.current) clearTimeout(voteTimerRef.current);
    voteTimerRef.current = setTimeout(() => {
      setShowVoteResult(false);
    }, VOTE_OVERLAY_MS);
  }, []);

  const dismissVoteResult = useCallback(() => {
    setShowVoteResult(false);
    if (voteTimerRef.current) {
      clearTimeout(voteTimerRef.current);
      voteTimerRef.current = null;
    }
  }, []);

  const handleGameEvent = useCallback(
    (event: GameEvent) => {
      if (event.type === 'VOTE_RESULT') {
        const exiled = event.payload.exiled as number | null;
        const votes = event.payload.votes as Record<number, number | null>;
        showVoteOverlay({ exiled, votes });
        if (exiled !== null) {
          triggerDeathFlash(exiled, 'exile');
        }
      }

      if (event.type === 'PLAYER_DIED' || event.type === 'PLAYER_EXILED') {
        const seatIndex = event.payload.seatIndex as number;
        triggerDeathFlash(seatIndex, parseDeathCause(event.type, event.payload));
      }

      if (event.type === 'DAY_ANNOUNCE') {
        const deaths = event.payload.deaths as number[];
        for (const seatIndex of deaths) {
          triggerDeathFlash(seatIndex, 'night');
        }
      }
    },
    [showVoteOverlay, triggerDeathFlash],
  );

  useEffect(() => {
    audioRef.current = Taro.createInnerAudioContext();
    return () => {
      audioRef.current?.destroy();
      for (const timer of deathTimersRef.current.values()) clearTimeout(timer);
      if (voteTimerRef.current) clearTimeout(voteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!lastSpeech?.audioUrl || !audioRef.current) return;
    const audio = audioRef.current;
    audio.src = lastSpeech.audioUrl;
    audio.play();
  }, [lastSpeech]);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;
    const url = `${WS_BASE}/ws/games/${gameId}`;

    void Taro.connectSocket({ url }).then((task) => {
      if (cancelled) {
        task.close({});
        return;
      }

      socketRef.current = task;

      task.onOpen(() => {
        setConnected(true);
        task.send({
          data: JSON.stringify({ type: 'JOIN', humanSeatIndex }),
        });
      });

      task.onMessage((msg: Taro.SocketTask.OnMessageCallbackResult) => {
        try {
          const data = JSON.parse(String(msg.data)) as ServerMessage;

          if (data.type === 'STATE_SYNC') {
            const sync = data as StateSyncMessage;
            setPublicState(sync.publicState);
            setHumanRole(sync.humanRole);
            setDiscussion(sync.discussion);
            setLastNightDeaths(sync.lastNightDeaths);
            setHints(sync.hints ?? defaultHints);
            setAiThinking(null);
          }

          if (data.type === 'ACTION_RESULT') {
            handleGameEvent((data as ActionResultMessage).event);
          }

          if (data.type === 'SPEECH') {
            const speech = data as SpeechMessage;
            setLastSpeech({
              seatIndex: speech.seatIndex,
              text: speech.text,
              audioUrl: speech.audioUrl,
            });
          }

          if (data.type === 'AI_THINKING') {
            setAiThinking((data as AiThinkingMessage).message);
          }

          if (data.type === 'ERROR') {
            setError((data as { message?: string }).message ?? 'Unknown error');
          }
        } catch {
          setError('Failed to parse server message');
        }
      });

      task.onError(() => {
        setConnected(false);
        setError('WebSocket connection failed');
      });

      task.onClose(() => {
        setConnected(false);
      });
    });

    return () => {
      cancelled = true;
      socketRef.current?.close({});
      socketRef.current = null;
    };
  }, [gameId, humanSeatIndex, handleGameEvent]);

  const sendAction = useCallback(
    (action: GameAction) => {
      const task = socketRef.current;
      if (!task || !connected) {
        Taro.showToast({ title: '未连接服务器', icon: 'none' });
        return;
      }
      setError(null);
      task.send({
        data: JSON.stringify({ type: 'ACTION', action }),
      });
    },
    [connected],
  );

  return {
    connected,
    publicState,
    humanRole,
    hints,
    discussion,
    lastNightDeaths,
    lastSpeech,
    aiThinking,
    error,
    deathFlashes,
    voteResult,
    showVoteResult,
    dismissVoteResult,
    sendAction,
  };
}
