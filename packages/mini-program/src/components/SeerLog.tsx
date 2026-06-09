import { View, Text } from '@tarojs/components';
import type { SeerCheckRecord } from '@werewolf/shared';
import { FACTION_SHORT } from '../utils/labels';
import './SeerLog.scss';

export function SeerLog({ checks }: { checks: SeerCheckRecord[] }) {
  if (checks.length === 0) return null;

  return (
    <View className="seer-log">
      <Text className="seer-log__title">查验记录</Text>
      {checks.map((check, idx) => (
        <View key={idx} className="seer-log__row">
          <Text className="seer-log__day">第{check.day}夜</Text>
          <Text className="seer-log__target">{check.target + 1}号</Text>
          <Text className={`seer-log__result seer-log__result--${check.result}`}>
            {FACTION_SHORT[check.result]}
          </Text>
        </View>
      ))}
    </View>
  );
}
