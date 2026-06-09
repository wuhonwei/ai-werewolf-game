import {
  Faction,
  Phase,
  Role,
  ROLE_FACTION,
  type DiscussionEntry,
  type GameState,
} from '@werewolf/shared';

export interface AgentContext {
  seatIndex: number;
  role: Role;
  phase: Phase;
  day: number;
  personality: string;
  knownFacts: string[];
  discussionHistory: string[];
  actionHint: string;
}

const ROLE_LABEL: Record<Role, string> = {
  [Role.WEREWOLF]: '狼人',
  [Role.VILLAGER]: '平民',
  [Role.SEER]: '预言家',
  [Role.WITCH]: '女巫',
  [Role.HUNTER]: '猎人',
  [Role.GUARD]: '守卫',
};

const FACTION_LABEL: Record<Faction, string> = {
  [Faction.WEREWOLF]: '狼人',
  [Faction.VILLAGER]: '好人',
};

function seatLabel(index: number): string {
  return `${index + 1}号`;
}

function aliveSeats(state: GameState): number[] {
  return state.seats.filter((s) => s.alive).map((s) => s.index);
}

function formatDiscussion(entries: DiscussionEntry[]): string[] {
  return entries.map((e) => `${seatLabel(e.seatIndex)}：${e.text}`);
}

function buildWolfFacts(state: GameState, seatIndex: number): string[] {
  const facts: string[] = [];
  const teammates = state.seats
    .filter((s) => s.alive && s.role === Role.WEREWOLF && s.index !== seatIndex)
    .map((s) => seatLabel(s.index));
  if (teammates.length > 0) {
    facts.push(`你的狼人队友：${teammates.join('、')}`);
  }
  return facts;
}

function buildSeerFacts(state: GameState): string[] {
  return state.seerChecks.map(
    (c) => `第${c.day}天夜查验${seatLabel(c.target)}，结果是${FACTION_LABEL[c.result]}`,
  );
}

function buildWitchFacts(state: GameState): string[] {
  const facts: string[] = [];
  facts.push(`解药${state.witch.healAvailable ? '可用' : '已用'}`);
  facts.push(`毒药${state.witch.poisonAvailable ? '可用' : '已用'}`);
  if (state.night.wolfTarget !== null) {
    facts.push(`今晚狼人刀口：${seatLabel(state.night.wolfTarget)}`);
  }
  return facts;
}

function buildPublicFacts(state: GameState): string[] {
  const facts: string[] = [];
  facts.push(`当前第${state.day}天，阶段：${state.phase}`);
  facts.push(`存活玩家：${aliveSeats(state).map(seatLabel).join('、')}`);

  if (state.lastNightDeaths.length > 0) {
    facts.push(`昨夜死亡：${state.lastNightDeaths.map(seatLabel).join('、')}`);
  }

  const dead = state.seats.filter((s) => !s.alive);
  if (dead.length > 0) {
    facts.push(`已出局：${dead.map((s) => seatLabel(s.index)).join('、')}`);
  }

  return facts;
}

function buildActionHint(state: GameState, _role: Role, seatIndex: number): string {
  switch (state.phase) {
    case Phase.NIGHT_WOLF:
      return '选择今晚要刀的目标座位号（preferredTarget），并准备发言';
    case Phase.NIGHT_SEER:
      return '选择要查验的目标座位号（target）';
    case Phase.NIGHT_WITCH:
      if (!state.witchHealDecided) {
        return '决定是否使用解药（useHeal: true/false），然后发言';
      }
      return '决定是否毒杀目标（target 为座位号，不毒则 target 为 null），并发言';
    case Phase.NIGHT_GUARD:
      return '选择要守护的目标座位号（target）';
    case Phase.DAY_DISCUSS:
      return '轮到你发言，给出推理并怀疑对象（speech），不要暴露不该知道的信息';
    case Phase.DAY_VOTE:
      return '投票放逐一名玩家（target 为座位号，弃票则 null）';
    case Phase.HUNTER_SHOOT:
      if (state.pendingHunterSeat === seatIndex) {
        return '你可以开枪带走一名玩家（target 为座位号）';
      }
      return '等待猎人开枪';
    default:
      return '等待游戏推进';
  }
}

export function buildAgentContext(
  state: GameState,
  seatIndex: number,
  personality: string,
): AgentContext {
  const seat = state.seats[seatIndex];
  if (!seat) throw new Error(`Invalid seat ${seatIndex}`);

  const role = seat.role;
  const knownFacts = buildPublicFacts(state);

  if (role === Role.WEREWOLF) {
    knownFacts.push(...buildWolfFacts(state, seatIndex));
  }
  if (role === Role.SEER) {
    knownFacts.push(...buildSeerFacts(state));
  }
  if (role === Role.WITCH) {
    knownFacts.push(...buildWitchFacts(state));
  }

  return {
    seatIndex,
    role,
    phase: state.phase,
    day: state.day,
    personality,
    knownFacts,
    discussionHistory: formatDiscussion(state.discussion),
    actionHint: buildActionHint(state, role, seatIndex),
  };
}

export function buildSystemPrompt(ctx: AgentContext): string {
  return [
    `你是狼人杀 ${seatLabel(ctx.seatIndex)} 玩家，身份：${ROLE_LABEL[ctx.role]}。`,
    `性格：${ctx.personality}`,
    '严格遵守：你不知道其他玩家的真实身份，只能根据公开信息推理。',
    '不要编造查验结果或队友信息。',
    `当前阶段：${ctx.phase}。${ctx.actionHint}`,
  ].join('\n');
}

export function buildUserPrompt(ctx: AgentContext): string {
  const facts = ctx.knownFacts.length > 0 ? ctx.knownFacts.join('\n') : '暂无额外信息';
  const history =
    ctx.discussionHistory.length > 0 ? ctx.discussionHistory.join('\n') : '暂无发言记录';

  return [`【已知信息】\n${facts}`, `【发言记录】\n${history}`].join('\n\n');
}

/** Detect if a specific other player's role is explicitly revealed in text */
export function findRoleLeaks(text: string, viewerSeat: number, state: GameState): string[] {
  const leaks: string[] = [];

  for (const seat of state.seats) {
    if (seat.index === viewerSeat) continue;
    const label = ROLE_LABEL[seat.role];
    const num = seat.index + 1;
    const patterns = [
      new RegExp(`${num}号(?:玩家)?是${label}`),
      new RegExp(`${num}号的身份是${label}`),
    ];
    if (patterns.some((p) => p.test(text))) {
      leaks.push(`${num}号:${label}`);
    }
  }

  return leaks;
}

export function contextToPromptText(ctx: AgentContext): string {
  return `${buildSystemPrompt(ctx)}\n\n${buildUserPrompt(ctx)}`;
}

export { ROLE_LABEL, ROLE_FACTION };
