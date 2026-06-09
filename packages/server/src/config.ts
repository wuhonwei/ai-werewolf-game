import { config } from 'dotenv';

config();

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://werewolf:werewolf@localhost:5432/werewolf',
  usePostgres: process.env.USE_POSTGRES === 'true',
  authRequired: process.env.AUTH_REQUIRED === 'true',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  aliyunAccessKeyId: process.env.ALIYUN_ACCESS_KEY_ID ?? '',
  aliyunAccessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET ?? '',
  aliyunTtsAppKey: process.env.ALIYUN_TTS_APP_KEY ?? '',
  aliyunOssBucket: process.env.ALIYUN_OSS_BUCKET ?? '',
  aliyunOssRegion: process.env.ALIYUN_OSS_REGION ?? 'oss-cn-hangzhou',
  wechatAppId: process.env.WECHAT_APP_ID ?? '',
  wechatAppSecret: process.env.WECHAT_APP_SECRET ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
} as const;
