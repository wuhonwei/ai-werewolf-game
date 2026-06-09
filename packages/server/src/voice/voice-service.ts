import { env } from '../config.js';
import {
  AudioCache,
  createSilentMp3Placeholder,
  MemoryAudioCache,
  ttsCacheKey,
} from './audio-cache.js';
import { createNlsToken } from './aliyun-nls-token.js';
import {
  getOssPublicUrl,
  isOssEnabled,
  ossObjectExists,
  ttsObjectKey,
  uploadToOss,
} from './oss-store.js';
import type { STTService, TTSService } from './types.js';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getNlsToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return cachedToken.token;
  }

  if (!env.aliyunAccessKeyId || !env.aliyunAccessKeySecret) {
    throw new Error('Aliyun credentials not configured');
  }

  const { token, expireTime } = await createNlsToken(
    env.aliyunAccessKeyId,
    env.aliyunAccessKeySecret,
  );
  cachedToken = { token, expiresAt: expireTime };
  return token;
}

export class AliyunTTSService implements TTSService {
  constructor(private readonly cache: AudioCache) {}

  async synthesize(text: string, voiceId: string, speed = 1.0): Promise<Buffer> {
    const key = ttsCacheKey(voiceId, text);
    const hit = this.cache.get(key);
    if (hit) return hit;

    if (!env.aliyunTtsAppKey) {
      throw new Error('ALIYUN_TTS_APP_KEY not configured');
    }

    const token = await getNlsToken();
    const url = new URL('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts');
    url.searchParams.set('appkey', env.aliyunTtsAppKey);
    url.searchParams.set('token', token);
    url.searchParams.set('text', text);
    url.searchParams.set('format', 'mp3');
    url.searchParams.set('voice', voiceId);
    url.searchParams.set('speech_rate', String(Math.round((speed - 1) * 500)));

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      throw new Error(`Aliyun TTS failed: ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    this.cache.set(key, buffer);
    return buffer;
  }
}

export class LocalTTSService implements TTSService {
  constructor(private readonly cache: AudioCache) {}

  async synthesize(text: string, voiceId: string): Promise<Buffer> {
    const key = ttsCacheKey(voiceId, text);
    const hit = this.cache.get(key);
    if (hit) return hit;

    const buffer = createSilentMp3Placeholder();
    this.cache.set(key, buffer);
    return buffer;
  }
}

export class AliyunSTTService implements STTService {
  async transcribe(audio: Buffer, format: 'mp3' | 'aac' | 'wav'): Promise<string> {
    if (!env.aliyunTtsAppKey) {
      throw new Error('ALIYUN_TTS_APP_KEY not configured');
    }

    const token = await getNlsToken();
    const url = new URL('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr');
    url.searchParams.set('appkey', env.aliyunTtsAppKey);
    url.searchParams.set('format', format);
    url.searchParams.set('sample_rate', '16000');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-NLS-Token': token,
      },
      body: audio,
    });

    if (!res.ok) {
      throw new Error(`Aliyun STT failed: ${res.status}`);
    }

    const data = (await res.json()) as { result?: string; payload?: { result?: string } };
    return data.result ?? data.payload?.result ?? '';
  }
}

export class LocalSTTService implements STTService {
  async transcribe(_audio: Buffer, _format: 'mp3' | 'aac' | 'wav'): Promise<string> {
    return '我先听听大家怎么说。';
  }
}

export class VoiceFacade {
  constructor(
    private readonly tts: TTSService,
    private readonly stt: STTService,
    private readonly cache: AudioCache,
    private readonly publicBaseUrl: string,
    readonly isCloudEnabled: boolean,
    readonly ossEnabled: boolean,
  ) {}

  async synthesizeSpeech(text: string, voiceId: string, speed = 1.0): Promise<string> {
    const key = ttsCacheKey(voiceId, text);
    const ossKey = ttsObjectKey(key);

    if (this.ossEnabled) {
      try {
        const exists = await ossObjectExists(ossKey);
        if (exists) return getOssPublicUrl(ossKey);
      } catch {
        // fall through to synthesis
      }
    }

    if (!this.cache.has(key)) {
      try {
        const audio = await this.tts.synthesize(text, voiceId, speed);
        this.cache.set(key, audio);

        if (this.ossEnabled) {
          try {
            return await uploadToOss(ossKey, audio, 'audio/mpeg');
          } catch {
            // serve from API if OSS upload fails
          }
        }
      } catch {
        const fallback = createSilentMp3Placeholder();
        this.cache.set(key, fallback);
      }
    }

    return `${this.publicBaseUrl}/api/audio/${key}`;
  }

  async transcribeAudio(audio: Buffer, format: 'mp3' | 'aac' | 'wav'): Promise<string> {
    try {
      return await this.stt.transcribe(audio, format);
    } catch {
      return new LocalSTTService().transcribe(audio, format);
    }
  }

  getAudio(key: string): Buffer | undefined {
    return this.cache.get(key);
  }
}

export function createVoiceFacade(publicBaseUrl: string): VoiceFacade {
  const cache = new MemoryAudioCache();
  const cloudReady =
    Boolean(env.aliyunAccessKeyId) &&
    Boolean(env.aliyunAccessKeySecret) &&
    Boolean(env.aliyunTtsAppKey);
  const ossEnabled = isOssEnabled();

  const tts = cloudReady ? new AliyunTTSService(cache) : new LocalTTSService(cache);
  const stt = cloudReady ? new AliyunSTTService() : new LocalSTTService();

  return new VoiceFacade(tts, stt, cache, publicBaseUrl, cloudReady, ossEnabled);
}
