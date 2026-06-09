import { View, Text } from '@tarojs/components';
import './AiThinkingBanner.scss';

export function AiThinkingBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <View className="ai-thinking">
      <View className="ai-thinking__dot" />
      <Text className="ai-thinking__text">{message}</Text>
    </View>
  );
}
