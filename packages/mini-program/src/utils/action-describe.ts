import type { GameAction } from '@werewolf/shared';

export interface ConfirmRequest {
  action: GameAction;
  title: string;
  message: string;
}

export function describeAction(action: GameAction): ConfirmRequest {
  switch (action.type) {
    case 'WOLF_KILL':
      return {
        action,
        title: '确认狼刀',
        message: `确定击杀 ${action.target + 1} 号玩家？`,
      };
    case 'SEER_CHECK':
      return {
        action,
        title: '确认查验',
        message: `确定查验 ${action.target + 1} 号玩家？`,
      };
    case 'WITCH_HEAL':
      return {
        action,
        title: action.useHeal ? '使用解药' : '放弃解药',
        message: action.useHeal ? '确定使用解药救人？' : '确定不使用解药？',
      };
    case 'WITCH_POISON':
      return action.target === null
        ? { action, title: '跳过毒药', message: '确定本夜不使用毒药？' }
        : {
            action,
            title: '确认毒杀',
            message: `确定毒杀 ${action.target + 1} 号玩家？`,
          };
    case 'GUARD_PROTECT':
      return {
        action,
        title: '确认守护',
        message: `确定守护 ${action.target + 1} 号玩家？`,
      };
    case 'VOTE':
      return action.target === null
        ? { action, title: '确认弃票', message: '确定弃票？' }
        : {
            action,
            title: '确认投票',
            message: `确定投票给 ${action.target + 1} 号？`,
          };
    case 'HUNTER_SHOOT':
      return {
        action,
        title: '确认开枪',
        message: `确定开枪带走 ${action.target + 1} 号玩家？`,
      };
    default:
      return { action, title: '确认操作', message: '确定执行此操作？' };
  }
}

export function needsConfirmation(action: GameAction): boolean {
  return [
    'WOLF_KILL',
    'SEER_CHECK',
    'WITCH_HEAL',
    'WITCH_POISON',
    'GUARD_PROTECT',
    'VOTE',
    'HUNTER_SHOOT',
  ].includes(action.type);
}
