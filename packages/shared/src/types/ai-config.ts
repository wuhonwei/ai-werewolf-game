export interface VoiceConfig {
  provider: 'aliyun';
  voiceId: string;
  speed: number;
  pitch: number;
}

export interface AIPlayerConfig {
  seatIndex: number;
  model: 'deepseek-chat';
  temperature: number;
  personality: string;
  voice: VoiceConfig;
}

export const DEFAULT_PERSONALITIES = [
  { id: 'logical', label: '逻辑型', description: '冷静分析，注重推理链条' },
  { id: 'emotional', label: '情绪型', description: '语气激烈，容易怀疑他人' },
  { id: 'concise', label: '简洁型', description: '言简意赅，少废话' },
  { id: 'humorous', label: '幽默型', description: '轻松调侃，偶尔插科打诨' },
] as const;

export const DEFAULT_VOICES = [
  { id: 'xiaoyun', label: '小云', gender: 'female' },
  { id: 'xiaogang', label: '小刚', gender: 'male' },
  { id: 'ruoxi', label: '若兮', gender: 'female' },
  { id: 'siqi', label: '思琪', gender: 'female' },
  { id: 'sicheng', label: '思诚', gender: 'male' },
] as const;

export function createDefaultAIConfig(seatIndex: number): AIPlayerConfig {
  const voiceIndex = seatIndex % DEFAULT_VOICES.length;
  const personalityIndex = seatIndex % DEFAULT_PERSONALITIES.length;
  return {
    seatIndex,
    model: 'deepseek-chat',
    temperature: 0.7,
    personality: DEFAULT_PERSONALITIES[personalityIndex].description,
    voice: {
      provider: 'aliyun',
      voiceId: DEFAULT_VOICES[voiceIndex].id,
      speed: 1.0,
      pitch: 1.0,
    },
  };
}
