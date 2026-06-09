import { View, Text, Button } from '@tarojs/components';
import { useState } from 'react';
import type { GameAction, PlayerHints, PublicGameState } from '@werewolf/shared';
import { SeatGrid } from './SeatGrid';
import { SpeechPanel } from './SpeechPanel';
import { ConfirmModal } from './ConfirmModal';
import { PANEL_HINTS } from '../utils/labels';
import { describeAction, needsConfirmation, type ConfirmRequest } from '../utils/action-describe';
import './ActionPanel.scss';

export interface GameActionPanelProps {
  publicState: PublicGameState;
  humanSeat: number;
  hints: PlayerHints;
  recording: boolean;
  uploading: boolean;
  onAction: (action: GameAction) => void;
  onToggleRecord: () => void;
}

export function GameActionPanel({
  publicState,
  humanSeat,
  hints,
  recording,
  uploading,
  onAction,
  onToggleRecord,
}: GameActionPanelProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmRequest | null>(null);
  const seats = publicState.seats;
  const panelHint = PANEL_HINTS[hints.panel] ?? '';

  const submitAction = (action: GameAction) => {
    if (needsConfirmation(action)) {
      setPendingConfirm(describeAction(action));
      return;
    }
    onAction(action);
    setSelectedSeat(null);
  };

  const handleConfirm = () => {
    if (!pendingConfirm) return;
    onAction(pendingConfirm.action);
    setPendingConfirm(null);
    setSelectedSeat(null);
  };

  const renderNightTarget = (
    label: string,
    buildAction: (target: number) => GameAction,
    skipAction?: GameAction,
  ) => (
    <View className="action-panel">
      <Text className="action-panel__hint">{label}</Text>
      <SeatGrid
        seats={seats}
        humanSeat={humanSeat}
        activeSeat={hints.activeSeatIndex}
        selectable
        selectedSeat={selectedSeat}
        excludeSeats={[humanSeat]}
        onSelect={setSelectedSeat}
      />
      <View className="action-panel__row">
        <Button
          className="action-panel__btn"
          disabled={selectedSeat === null}
          onClick={() => selectedSeat !== null && submitAction(buildAction(selectedSeat))}
        >
          确认
        </Button>
        {skipAction && (
          <Button
            className="action-panel__btn action-panel__btn--secondary"
            onClick={() => submitAction(skipAction)}
          >
            跳过
          </Button>
        )}
      </View>
    </View>
  );

  const panelContent = (() => {
    switch (hints.panel) {
      case 'start':
        return (
          <View className="action-panel">
            <Text className="action-panel__hint">{panelHint}</Text>
            <Button className="action-panel__btn" onClick={() => onAction({ type: 'START_GAME' })}>
              开始游戏
            </Button>
          </View>
        );

      case 'night_wolf':
        return renderNightTarget('选择狼刀目标', (target) => ({
          type: 'WOLF_KILL',
          seatIndex: humanSeat,
          target,
        }));

      case 'night_seer':
        return renderNightTarget('选择查验目标', (target) => ({
          type: 'SEER_CHECK',
          seatIndex: humanSeat,
          target,
        }));

      case 'night_witch_heal': {
        const wolfTarget = hints.witch?.wolfTarget;
        return (
          <View className="action-panel">
            <Text className="action-panel__hint">
              {wolfTarget !== null && wolfTarget !== undefined
                ? `今晚 ${wolfTarget + 1} 号被刀，是否使用解药？`
                : '今晚平安夜，是否仍要使用解药？'}
            </Text>
            <View className="action-panel__row">
              <Button
                className="action-panel__btn"
                disabled={!hints.witch?.healAvailable}
                onClick={() =>
                  submitAction({ type: 'WITCH_HEAL', seatIndex: humanSeat, useHeal: true })
                }
              >
                使用解药
              </Button>
              <Button
                className="action-panel__btn action-panel__btn--secondary"
                onClick={() =>
                  submitAction({ type: 'WITCH_HEAL', seatIndex: humanSeat, useHeal: false })
                }
              >
                不用
              </Button>
            </View>
          </View>
        );
      }

      case 'night_witch_poison':
        return renderNightTarget(
          '选择毒杀目标',
          (target) => ({ type: 'WITCH_POISON', seatIndex: humanSeat, target }),
          { type: 'WITCH_POISON', seatIndex: humanSeat, target: null },
        );

      case 'night_guard':
        return renderNightTarget('选择守护目标', (target) => ({
          type: 'GUARD_PROTECT',
          seatIndex: humanSeat,
          target,
        }));

      case 'discuss':
        return (
          <SpeechPanel
            recording={recording}
            uploading={uploading}
            onSpeak={(text) => onAction({ type: 'SPEAK', seatIndex: humanSeat, text })}
            onEndSpeech={() => onAction({ type: 'END_SPEECH', seatIndex: humanSeat })}
            onToggleRecord={onToggleRecord}
          />
        );

      case 'vote':
        if (hints.hasVoted) {
          return (
            <View className="action-panel">
              <Text className="action-panel__hint">你已投票，等待其他玩家…</Text>
            </View>
          );
        }
        return (
          <View className="action-panel">
            <Text className="action-panel__hint">{panelHint}</Text>
            <SeatGrid
              seats={seats}
              humanSeat={humanSeat}
              activeSeat={hints.activeSeatIndex}
              selectable
              selectedSeat={selectedSeat}
              excludeSeats={[humanSeat]}
              onSelect={setSelectedSeat}
            />
            <View className="action-panel__row">
              <Button
                className="action-panel__btn"
                disabled={selectedSeat === null}
                onClick={() =>
                  selectedSeat !== null &&
                  submitAction({ type: 'VOTE', seatIndex: humanSeat, target: selectedSeat })
                }
              >
                投票
              </Button>
              <Button
                className="action-panel__btn action-panel__btn--secondary"
                onClick={() => submitAction({ type: 'VOTE', seatIndex: humanSeat, target: null })}
              >
                弃票
              </Button>
            </View>
          </View>
        );

      case 'hunter':
        return renderNightTarget('选择开枪目标', (target) => ({
          type: 'HUNTER_SHOOT',
          seatIndex: humanSeat,
          target,
        }));

      case 'game_over':
        return (
          <View className="action-panel">
            <Text className="action-panel__hint">本局已结束</Text>
          </View>
        );

      default:
        return (
          <View className="action-panel">
            <Text className="action-panel__hint action-panel__hint--muted">{panelHint}</Text>
          </View>
        );
    }
  })();

  return (
    <>
      {panelContent}
      <ConfirmModal
        visible={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        onConfirm={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
      />
    </>
  );
}
