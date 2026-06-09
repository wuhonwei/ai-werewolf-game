import { View, Text } from '@tarojs/components';
import './VoteResultOverlay.scss';

export interface VoteResultData {
  exiled: number | null;
  votes: Record<number, number | null>;
}

export interface VoteResultOverlayProps {
  visible: boolean;
  data: VoteResultData | null;
  onDismiss: () => void;
}

function formatVotes(votes: Record<number, number | null>): Array<{ voter: number; target: number | null }> {
  return Object.entries(votes)
    .map(([voter, target]) => ({ voter: Number(voter), target }))
    .sort((a, b) => a.voter - b.voter);
}

function tallyVotes(votes: Record<number, number | null>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const target of Object.values(votes)) {
    if (target === null) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  return counts;
}

export function VoteResultOverlay({ visible, data, onDismiss }: VoteResultOverlayProps) {
  if (!visible || !data) return null;

  const rows = formatVotes(data.votes);
  const tally = tallyVotes(data.votes);
  const sortedTally = [...tally.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <View className="vote-overlay" onClick={onDismiss}>
      <View className="vote-overlay__card" onClick={(e) => e.stopPropagation()}>
        <Text className="vote-overlay__title">投票结果</Text>

        {data.exiled !== null ? (
          <View className="vote-overlay__exile">
            <Text className="vote-overlay__exile-label">被放逐</Text>
            <Text className="vote-overlay__exile-seat">{data.exiled + 1} 号</Text>
          </View>
        ) : (
          <View className="vote-overlay__exile vote-overlay__exile--none">
            <Text className="vote-overlay__exile-label">无人出局</Text>
            <Text className="vote-overlay__exile-hint">平票或全员弃票</Text>
          </View>
        )}

        {sortedTally.length > 0 && (
          <View className="vote-overlay__tally">
            <Text className="vote-overlay__section">得票统计</Text>
            {sortedTally.map(([seat, count]) => (
              <View key={seat} className="vote-overlay__tally-row">
                <Text>{seat + 1} 号</Text>
                <Text className="vote-overlay__tally-count">{count} 票</Text>
              </View>
            ))}
          </View>
        )}

        <View className="vote-overlay__detail">
          <Text className="vote-overlay__section">投票明细</Text>
          {rows.map(({ voter, target }) => (
            <View key={voter} className="vote-overlay__detail-row">
              <Text>{voter + 1} 号</Text>
              <Text className="vote-overlay__arrow">→</Text>
              <Text>{target === null ? '弃票' : `${target + 1} 号`}</Text>
            </View>
          ))}
        </View>

        <Text className="vote-overlay__tap">点击任意处关闭</Text>
      </View>
    </View>
  );
}
