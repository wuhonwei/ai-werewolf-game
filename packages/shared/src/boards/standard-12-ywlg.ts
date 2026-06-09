import { Role } from '../types/game.js';
import type { BoardConfig } from '../types/game.js';

export const STANDARD_12_YWLG: BoardConfig = {
  id: 'standard-12-ywlg',
  name: '预女猎守',
  playerCount: 12,
  roles: [
    { role: Role.WEREWOLF, count: 4 },
    { role: Role.VILLAGER, count: 4 },
    { role: Role.SEER, count: 1 },
    { role: Role.WITCH, count: 1 },
    { role: Role.HUNTER, count: 1 },
    { role: Role.GUARD, count: 1 },
  ],
  rules: {
    witchSelfSaveFirstNight: true,
    guardNoConsecutiveGuard: true,
    tieVoteNoExile: true,
  },
};

export function expandRoles(board: BoardConfig): Role[] {
  return board.roles.flatMap(({ role, count }) => Array.from({ length: count }, () => role));
}
