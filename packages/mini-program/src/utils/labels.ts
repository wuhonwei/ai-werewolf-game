import { Role, Phase, Faction } from '@werewolf/shared';

export const ROLE_LABELS: Record<Role, string> = {
  [Role.WEREWOLF]: '狼人',
  [Role.VILLAGER]: '平民',
  [Role.SEER]: '预言家',
  [Role.WITCH]: '女巫',
  [Role.HUNTER]: '猎人',
  [Role.GUARD]: '守卫',
};

export const PHASE_LABELS: Record<string, string> = {
  [Phase.LOBBY]: '等待开始',
  [Phase.ROLE_REVEAL]: '查看身份',
  [Phase.NIGHT_WOLF]: '狼人行动',
  [Phase.NIGHT_SEER]: '预言家查验',
  [Phase.NIGHT_WITCH]: '女巫行动',
  [Phase.NIGHT_GUARD]: '守卫守护',
  [Phase.NIGHT_RESOLVE]: '夜晚结算',
  [Phase.DAY_ANNOUNCE]: '天亮公告',
  [Phase.DAY_DISCUSS]: '白天发言',
  [Phase.DAY_VOTE]: '投票放逐',
  [Phase.DAY_VOTE_RESULT]: '投票结果',
  [Phase.HUNTER_SHOOT]: '猎人开枪',
  [Phase.CHECK_WIN]: '判定胜负',
  [Phase.GAME_OVER]: '游戏结束',
};

export const FACTION_LABELS: Record<Faction, string> = {
  [Faction.VILLAGER]: '好人阵营',
  [Faction.WEREWOLF]: '狼人阵营',
};

export const FACTION_SHORT: Record<Faction, string> = {
  [Faction.VILLAGER]: '好人',
  [Faction.WEREWOLF]: '狼人',
};

export const PANEL_HINTS: Record<string, string> = {
  start: '查看身份后点击开始',
  night_wolf: '选择击杀目标',
  night_seer: '选择查验目标',
  night_witch_heal: '是否使用解药',
  night_witch_poison: '选择毒杀目标或跳过',
  night_guard: '选择守护目标',
  discuss: '轮到你发言了',
  vote: '选择投票目标',
  hunter: '选择开枪目标',
  waiting: '等待其他玩家行动…',
  game_over: '游戏已结束',
};
