import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useRouter } from '@tarojs/taro';
import { useEffect } from 'react';
import { Phase, GameStatus, SeatType } from '@werewolf/shared';
import { useGameSocket } from '../../hooks/useGameSocket';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { SeatGrid } from '../../components/SeatGrid';
import { GameActionPanel } from '../../components/GameActionPanel';
import { SeerLog } from '../../components/SeerLog';
import { AiThinkingBanner } from '../../components/AiThinkingBanner';
import { VoteResultOverlay } from '../../components/VoteResultOverlay';
import { RecordPermissionModal } from '../../components/RecordPermissionModal';
import { PHASE_LABELS, ROLE_LABELS } from '../../utils/labels';
import './index.scss';

export default function GamePage() {
  const router = useRouter();
  const gameId = router.params.gameId ?? '';
  const humanSeat = Number(router.params.humanSeat ?? 0);

  const {
    connected,
    publicState,
    humanRole,
    hints,
    discussion,
    lastNightDeaths,
    lastSpeech,
    aiThinking,
    error,
    deathFlashes,
    voteResult,
    showVoteResult,
    dismissVoteResult,
    sendAction,
  } = useGameSocket(gameId, humanSeat);

  const {
    recording,
    uploading,
    showPermissionGuide,
    needSettings,
    dismissPermissionGuide,
    requestPermission,
    openSettings,
    toggle: toggleRecord,
  } = useVoiceRecorder(gameId, humanSeat);

  useLoad(() => {
    Taro.setNavigationBarTitle({ title: '对局中' });
  });

  useEffect(() => {
    if (
      publicState?.phase === Phase.GAME_OVER ||
      publicState?.status === GameStatus.FINISHED
    ) {
      const winner = publicState.winner ?? '';
      Taro.redirectTo({
        url: `/pages/result/index?winner=${winner}&gameId=${gameId}`,
      });
    }
  }, [publicState, gameId]);

  const phaseLabel = publicState
    ? PHASE_LABELS[publicState.phase] ?? publicState.phase
    : '连接中…';

  const seats =
    publicState?.seats ??
    Array.from({ length: 12 }, (_, i) => ({
      index: i,
      type: SeatType.AI,
      alive: true,
    }));

  const showDeathBanner =
    publicState?.phase === Phase.DAY_ANNOUNCE && lastNightDeaths.length > 0;

  return (
    <View className="game-page">
      <View className="status-bar">
        <Text className={`status-dot ${connected ? 'status-dot--on' : ''}`} />
        <Text className="status-text">
          第 {publicState?.day ?? '-'} 天 · {phaseLabel}
        </Text>
        {humanRole && (
          <Text className="role-badge">{ROLE_LABELS[humanRole]}</Text>
        )}
      </View>

      {error && <Text className="error-text">{error}</Text>}
      {showDeathBanner && (
        <View className="death-banner death-banner--animated">
          <Text className="death-banner__icon">💀</Text>
          <Text className="death-banner__text">
            昨夜 {lastNightDeaths.map((s) => `${s + 1}号`).join('、')} 出局
          </Text>
        </View>
      )}

      <AiThinkingBanner message={aiThinking} />

      <SeatGrid
        seats={seats}
        humanSeat={humanSeat}
        activeSeat={hints.activeSeatIndex}
        selectable={false}
        selectedSeat={null}
        deathFlashes={deathFlashes}
      />

      {hints.seerChecks.length > 0 && <SeerLog checks={hints.seerChecks} />}

      <ScrollView className="chat-panel" scrollY>
        {discussion.map((entry, idx) => (
          <View
            key={idx}
            className={`chat-line ${entry.seatIndex === humanSeat ? 'chat-line--self' : ''}`}
          >
            <Text className="chat-speaker">{entry.seatIndex + 1}号</Text>
            <Text className="chat-text">{entry.text}</Text>
          </View>
        ))}
        {lastSpeech && (
          <View className="chat-line chat-line--speech">
            <Text className="chat-speaker">{lastSpeech.seatIndex + 1}号 🔊</Text>
            <Text className="chat-text">{lastSpeech.text}</Text>
          </View>
        )}
      </ScrollView>

      {publicState && (
        <GameActionPanel
          publicState={publicState}
          humanSeat={humanSeat}
          hints={hints}
          recording={recording}
          uploading={uploading}
          onAction={sendAction}
          onToggleRecord={toggleRecord}
        />
      )}

      <VoteResultOverlay
        visible={showVoteResult}
        data={voteResult}
        onDismiss={dismissVoteResult}
      />

      <RecordPermissionModal
        visible={showPermissionGuide}
        needSettings={needSettings}
        onRequest={() => void requestPermission()}
        onOpenSettings={openSettings}
        onDismiss={dismissPermissionGuide}
      />
    </View>
  );
}
