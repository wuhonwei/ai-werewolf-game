export interface TTSService {
  synthesize(text: string, voiceId: string, speed?: number): Promise<Buffer>;
}

export interface STTService {
  transcribe(audio: Buffer, format: 'mp3' | 'aac' | 'wav'): Promise<string>;
}

export interface VoiceServices {
  tts: TTSService;
  stt: STTService;
  isCloudEnabled: boolean;
}
