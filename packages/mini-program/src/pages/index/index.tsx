import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

export default function IndexPage() {
  const handleStart = () => {
    Taro.navigateTo({ url: '/pages/setup/index' });
  };

  return (
    <View className="index-page">
      <Text className="title">AI 狼人杀</Text>
      <Text className="subtitle">1 真人 + 11 AI · 预女猎守</Text>
      <Button className="start-btn" onClick={handleStart}>
        开始游戏
      </Button>
    </View>
  );
}
