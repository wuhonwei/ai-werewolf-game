export enum Role {
  WEREWOLF = 'werewolf',
  VILLAGER = 'villager',
  SEER = 'seer',
  WITCH = 'witch',
  HUNTER = 'hunter',
  GUARD = 'guard',
}

export enum Faction {
  WEREWOLF = 'werewolf',
  VILLAGER = 'villager',
}

export enum Phase {
  LOBBY = 'lobby',
  ROLE_REVEAL = 'role_reveal',
  NIGHT_WOLF = 'night_wolf',
  NIGHT_SEER = 'night_seer',
  NIGHT_WITCH = 'night_witch',
  NIGHT_GUARD = 'night_guard',
  NIGHT_RESOLVE = 'night_resolve',
  DAY_ANNOUNCE = 'day_announce',
  DAY_DISCUSS = 'day_discuss',
  DAY_VOTE = 'day_vote',
  DAY_VOTE_RESULT = 'day_vote_result',
  HUNTER_SHOOT = 'hunter_shoot',
  CHECK_WIN = 'check_win',
  GAME_OVER = 'game_over',
}

export enum SeatType {
  HUMAN = 'human',
  AI = 'ai',
}

export enum GameStatus {
  LOBBY = 'lobby',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export const ROLE_FACTION: Record<Role, Faction> = {
  [Role.WEREWOLF]: Faction.WEREWOLF,
  [Role.VILLAGER]: Faction.VILLAGER,
  [Role.SEER]: Faction.VILLAGER,
  [Role.WITCH]: Faction.VILLAGER,
  [Role.HUNTER]: Faction.VILLAGER,
  [Role.GUARD]: Faction.VILLAGER,
};

export interface Seat {
  index: number;
  type: SeatType;
  role: Role;
  alive: boolean;
  /** Reserved for multiplayer: bound WeChat user id */
  userId?: string;
}

export interface WitchState {
  healAvailable: boolean;
  poisonAvailable: boolean;
}

export interface SeerCheckRecord {
  day: number;
  target: number;
  result: Faction;
}

export interface DiscussionEntry {
  seatIndex: number;
  text: string;
  day: number;
  phase: Phase;
  timestamp: number;
}

export interface VoteRecord {
  day: number;
  votes: Record<number, number | null>;
  exiled: number | null;
}

export interface NightActions {
  wolfTarget: number | null;
  seerTarget: number | null;
  /** true = heal wolf target, false = declined, null = not decided */
  witchUseHeal: boolean | null;
  witchPoisonTarget: number | null;
  guardTarget: number | null;
  lastGuardTarget: number | null;
}

export interface GameState {
  id: string;
  boardId: string;
  status: GameStatus;
  phase: Phase;
  day: number;
  seats: Seat[];
  rules: BoardRules;
  witch: WitchState;
  seerChecks: SeerCheckRecord[];
  night: NightActions;
  /** Witch must submit heal before poison each night */
  witchHealDecided: boolean;
  witchPoisonDecided: boolean;
  discussion: DiscussionEntry[];
  votes: VoteRecord[];
  /** Active vote tally during DAY_VOTE phase */
  currentVotes: Record<number, number | null> | null;
  winner: Faction | null;
  speakOrder: number[];
  currentSpeakerIndex: number;
  /** Hunter awaiting shot after death or exile */
  pendingHunterSeat: number | null;
  pendingHunterReason: 'night' | 'exile' | null;
  /** Deaths to announce at start of day */
  lastNightDeaths: number[];
}

export interface PublicSeat {
  index: number;
  type: SeatType;
  alive: boolean;
}

export interface PublicGameState {
  id: string;
  boardId: string;
  status: GameStatus;
  phase: Phase;
  day: number;
  seats: PublicSeat[];
  winner: Faction | null;
  currentSpeakerIndex: number | null;
}

export interface RoleDefinition {
  role: Role;
  count: number;
}

export interface BoardRules {
  witchSelfSaveFirstNight: boolean;
  guardNoConsecutiveGuard: boolean;
  tieVoteNoExile: boolean;
}

export interface BoardConfig {
  id: string;
  name: string;
  playerCount: number;
  roles: RoleDefinition[];
  rules: BoardRules;
}

export interface CreateGameInput {
  board: BoardConfig;
  humanSeatIndex: number;
  humanRole: Role | null;
  aiSeatIndices: number[];
  seed?: number;
}
