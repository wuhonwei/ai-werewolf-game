import {
  Faction,
  GameStatus,
  Phase,
  Role,
  SeatType,
  STANDARD_12_YWLG,
  type GameState,
  type NightActions,
  type Seat,
} from '@werewolf/shared';

function emptyNight(): NightActions {
  return {
    wolfTarget: null,
    seerTarget: null,
    witchUseHeal: null,
    witchPoisonTarget: null,
    guardTarget: null,
    lastGuardTarget: null,
  };
}

export function createTestState(
  roles: Role[],
  options: {
    humanSeatIndex?: number;
    phase?: Phase;
    day?: number;
    alive?: boolean[];
  } = {},
): GameState {
  const humanSeatIndex = options.humanSeatIndex ?? 0;
  const seats: Seat[] = roles.map((role, index) => ({
    index,
    role,
    alive: options.alive?.[index] ?? true,
    type: index === humanSeatIndex ? SeatType.HUMAN : SeatType.AI,
  }));

  return {
    id: 'test-game',
    boardId: STANDARD_12_YWLG.id,
    status: GameStatus.PLAYING,
    phase: options.phase ?? Phase.NIGHT_WOLF,
    day: options.day ?? 1,
    seats,
    rules: { ...STANDARD_12_YWLG.rules },
    witch: { healAvailable: true, poisonAvailable: true },
    seerChecks: [],
    night: emptyNight(),
    witchHealDecided: false,
    witchPoisonDecided: false,
    discussion: [],
    votes: [],
    currentVotes: null,
    winner: null,
    speakOrder: Array.from({ length: roles.length }, (_, i) => i),
    currentSpeakerIndex: 0,
    pendingHunterSeat: null,
    pendingHunterReason: null,
    lastNightDeaths: [],
  };
}

export function findSeatByRole(state: GameState, role: Role): number {
  const seat = state.seats.find((s) => s.role === role && s.alive);
  if (!seat) throw new Error(`No alive seat with role ${role}`);
  return seat.index;
}

export function findWolfSeat(state: GameState): number {
  return findSeatByRole(state, Role.WEREWOLF);
}

export function startNight(state: GameState): GameState {
  return {
    ...state,
    phase: Phase.NIGHT_WOLF,
    night: emptyNight(),
    witchHealDecided: false,
    witchPoisonDecided: false,
    lastNightDeaths: [],
  };
}

export { Role, Phase, Faction, GameStatus };
