import {
  expandRoles,
  GameStatus,
  Phase,
  SeatType,
  type BoardConfig,
  type CreateGameInput,
  type GameState,
  type NightActions,
  type PublicGameState,
  type PublicSeat,
  type Seat,
} from '@werewolf/shared';
import { assignRoles, generateGameId } from './utils.js';

function emptyNightActions(): NightActions {
  return {
    wolfTarget: null,
    seerTarget: null,
    witchUseHeal: null,
    witchPoisonTarget: null,
    guardTarget: null,
    lastGuardTarget: null,
  };
}

function buildSpeakOrder(seatCount: number, startSeat: number): number[] {
  return Array.from({ length: seatCount }, (_, i) => (startSeat + i) % seatCount);
}

export function createGame(input: CreateGameInput): GameState {
  const { board, humanSeatIndex, humanRole, aiSeatIndices, seed = Date.now() } = input;

  if (board.playerCount !== 12) {
    throw new Error(`Board ${board.id} requires 12 players`);
  }

  const allRoles = expandRoles(board);
  const roleAssignments = assignRoles(allRoles, humanSeatIndex, humanRole, seed);

  const seats: Seat[] = roleAssignments.map((role, index) => ({
    index,
    role,
    alive: true,
    type: index === humanSeatIndex ? SeatType.HUMAN : SeatType.AI,
  }));

  const aiSet = new Set(aiSeatIndices);
  for (const seat of seats) {
    if (seat.index !== humanSeatIndex && !aiSet.has(seat.index)) {
      seat.type = SeatType.AI;
    }
  }

  return {
    id: generateGameId(),
    boardId: board.id,
    status: GameStatus.PLAYING,
    phase: Phase.ROLE_REVEAL,
    day: 0,
    seats,
    rules: { ...board.rules },
    witch: { healAvailable: true, poisonAvailable: true },
    seerChecks: [],
    night: emptyNightActions(),
    witchHealDecided: false,
    witchPoisonDecided: false,
    discussion: [],
    votes: [],
    currentVotes: null,
    winner: null,
    speakOrder: buildSpeakOrder(board.playerCount, humanSeatIndex),
    currentSpeakerIndex: 0,
    pendingHunterSeat: null,
    pendingHunterReason: null,
    lastNightDeaths: [],
  };
}

export function getPublicState(state: GameState): PublicGameState {
  const seats: PublicSeat[] = state.seats.map((s) => ({
    index: s.index,
    type: s.type,
    alive: s.alive,
  }));

  const currentSpeakerIndex =
    state.phase === Phase.DAY_DISCUSS ? state.speakOrder[state.currentSpeakerIndex] ?? null : null;

  return {
    id: state.id,
    boardId: state.boardId,
    status: state.status,
    phase: state.phase,
    day: state.day,
    seats,
    winner: state.winner,
    currentSpeakerIndex,
  };
}

export function getRoleForSeat(state: GameState, seatIndex: number, viewerSeatIndex: number) {
  const seat = state.seats[seatIndex];
  if (!seat) return null;
  if (seatIndex === viewerSeatIndex) return seat.role;
  return null;
}

export function validateBoard(board: BoardConfig): void {
  const total = board.roles.reduce((sum, r) => sum + r.count, 0);
  if (total !== board.playerCount) {
    throw new Error(`Board role count ${total} does not match playerCount ${board.playerCount}`);
  }
}
