import { describe, it, expect } from 'vitest';
import { createVoiceFacade } from '../src/voice/voice-service.js';
import { ttsCacheKey } from '../src/voice/audio-cache.js';

describe('voice service', () => {
  it('caches local TTS and returns audio URL', async () => {
    const voice = createVoiceFacade('http://localhost:3000');
    const url1 = await voice.synthesizeSpeech('你好', 'xiaoyun', 1.0);
    const url2 = await voice.synthesizeSpeech('你好', 'xiaoyun', 1.0);

    expect(url1).toBe(url2);
    expect(url1).toContain('/api/audio/');

    const key = ttsCacheKey('xiaoyun', '你好');
    expect(voice.getAudio(key)).toBeDefined();
  });

  it('local STT returns placeholder text', async () => {
    const voice = createVoiceFacade('http://localhost:3000');
    const text = await voice.transcribeAudio(Buffer.from('fake'), 'mp3');
    expect(text.length).toBeGreaterThan(0);
  });
});
