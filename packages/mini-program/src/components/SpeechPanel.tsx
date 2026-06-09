import { View, Button, Input } from '@tarojs/components';
import { useState } from 'react';
import './SpeechPanel.scss';

export interface SpeechPanelProps {
  disabled?: boolean;
  recording: boolean;
  uploading: boolean;
  onSpeak: (text: string) => void;
  onEndSpeech: () => void;
  onToggleRecord: () => void;
}

export function SpeechPanel({
  disabled,
  recording,
  uploading,
  onSpeak,
  onEndSpeech,
  onToggleRecord,
}: SpeechPanelProps) {
  const [text, setText] = useState('');

  const handleSpeak = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSpeak(trimmed);
    setText('');
  };

  return (
    <View className="speech-panel">
      <Input
        className="speech-panel__input"
        value={text}
        disabled={disabled}
        placeholder="输入发言内容"
        onInput={(e) => setText(e.detail.value)}
      />
      <View className="speech-panel__row">
        <Button className="speech-panel__btn" disabled={disabled} onClick={handleSpeak}>
          文字发言
        </Button>
        <Button
          className={`speech-panel__btn speech-panel__btn--voice ${recording ? 'speech-panel__btn--recording' : ''}`}
          disabled={disabled || uploading}
          onClick={onToggleRecord}
        >
          {uploading ? '识别中…' : recording ? '停止录音' : '按住说话'}
        </Button>
      </View>
      <Button
        className="speech-panel__btn speech-panel__btn--secondary"
        disabled={disabled}
        onClick={onEndSpeech}
      >
        结束发言
      </Button>
    </View>
  );
}
