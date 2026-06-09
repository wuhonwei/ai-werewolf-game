import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Faction } from '@werewolf/shared';
import { FACTION_LABELS } from '../../utils/labels';
import './index.scss';

export default function ResultPage() {
  const router = useRouter();
  const winner = router.params.winner as Faction | undefined;

  const winnerLabel =
    winner === Faction.WEREWOLF
      ? FACTION_LABELS[Faction.WEREWOLF]
      : winner === Faction.VILLAGER
        ? FACTION_LABELS[Faction.VILLAGER]
        : '未知';

  const isWolfWin = winner === Faction.WEREWOLF;

  return (
    <View className="result-page">
      <Text className={`title ${isWolfWin ? 'title--wolf' : 'title--villager'}`}>
        {winnerLabel} 胜利
      </Text>
      <Text className="subtitle">本局结束，感谢参与</Text>
      <Button
        className="back-btn"
        onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}
      >
        返回首页
      </Button>
      <Button
        className="back-btn back-btn--secondary"
        onClick={() => Taro.redirectTo({ url: '/pages/setup/index' })}
      >
        再来一局
      </Button>
    </View>
  );
}
