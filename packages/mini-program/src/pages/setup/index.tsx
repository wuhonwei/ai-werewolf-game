import { View, Text, Button } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { Role, createDefaultAIConfig } from '@werewolf/shared';
import { createGame } from '../../utils/api';
import { ensureLoggedIn } from '../../utils/auth';
import './index.scss';

const ROLE_OPTIONS: { value: Role | null; label: string }[] = [
  { value: null, label: '随机' },
  { value: Role.SEER, label: '预言家' },
  { value: Role.WITCH, label: '女巫' },
  { value: Role.HUNTER, label: '猎人' },
  { value: Role.GUARD, label: '守卫' },
  { value: Role.VILLAGER, label: '平民' },
  { value: Role.WEREWOLF, label: '狼人' },
];

function buildAIConfigs(humanSeat: number) {
  return Array.from({ length: 12 }, (_, i) =>
    i === humanSeat ? null : createDefaultAIConfig(i),
  ).filter((cfg): cfg is NonNullable<typeof cfg> => cfg !== null);
}

export default function SetupPage() {
  const [humanSeat, setHumanSeat] = useState(0);
  const [humanRole, setHumanRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);

  useLoad(() => {
    Taro.setNavigationBarTitle({ title: '配桌' });
  });

  const handleStart = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await ensureLoggedIn();
      const result = await createGame({
        humanSeatIndex: humanSeat,
        humanRole,
        aiConfigs: buildAIConfigs(humanSeat),
        seed: Date.now(),
      });

      Taro.navigateTo({
        url: `/pages/game/index?gameId=${result.gameId}&humanSeat=${humanSeat}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建对局失败';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="setup-page">
      <Text className="section-title">选择你的座位</Text>
      <View className="seat-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <View
            key={i}
            className={`seat ${humanSeat === i ? 'seat--human' : 'seat--ai'}`}
            onClick={() => setHumanSeat(i)}
          >
            <Text className="seat-num">{i + 1}</Text>
            <Text className="seat-type">{humanSeat === i ? '你' : 'AI'}</Text>
          </View>
        ))}
      </View>

      <Text className="section-title">选择身份</Text>
      <View className="role-list">
        {ROLE_OPTIONS.map((opt) => (
          <View
            key={String(opt.value)}
            className={`role-chip ${humanRole === opt.value ? 'role-chip--active' : ''}`}
            onClick={() => setHumanRole(opt.value)}
          >
            {opt.label}
          </View>
        ))}
      </View>

      <Button className="start-btn" loading={loading} onClick={handleStart}>
        开始对局
      </Button>
    </View>
  );
}
