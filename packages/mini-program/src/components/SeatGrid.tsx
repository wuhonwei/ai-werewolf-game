import { View, Text } from '@tarojs/components';
import type { PublicSeat } from '@werewolf/shared';
import './SeatGrid.scss';

export type DeathCause = 'wolf' | 'poison' | 'exile' | 'hunter' | 'night';

export interface DeathFlash {
  seatIndex: number;
  cause: DeathCause;
}

const CAUSE_LABELS: Record<DeathCause, string> = {
  wolf: '狼刀',
  poison: '毒杀',
  exile: '放逐',
  hunter: '猎枪',
  night: '出局',
};

export interface SeatGridProps {
  seats: PublicSeat[];
  humanSeat: number;
  activeSeat: number | null;
  selectable?: boolean;
  selectedSeat: number | null;
  excludeSeats?: number[];
  deathFlashes?: DeathFlash[];
  onSelect?: (seatIndex: number) => void;
}

export function SeatGrid({
  seats,
  humanSeat,
  activeSeat,
  selectable = false,
  selectedSeat,
  excludeSeats = [],
  deathFlashes = [],
  onSelect,
}: SeatGridProps) {
  const flashMap = new Map(deathFlashes.map((f) => [f.seatIndex, f.cause]));

  return (
    <View className="seat-grid">
      {seats.map((seat) => {
        const excluded = excludeSeats.includes(seat.index);
        const canSelect = selectable && seat.alive && !excluded;
        const isActive = activeSeat === seat.index;
        const isSelected = selectedSeat === seat.index;
        const deathCause = flashMap.get(seat.index);

        return (
          <View
            key={seat.index}
            className={[
              'seat-chip',
              seat.index === humanSeat ? 'seat-chip--human' : '',
              !seat.alive ? 'seat-chip--dead' : '',
              isActive ? 'seat-chip--active' : '',
              isSelected ? 'seat-chip--selected' : '',
              canSelect ? 'seat-chip--selectable' : '',
              deathCause ? `seat-chip--dying seat-chip--dying-${deathCause}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              if (canSelect && onSelect) onSelect(seat.index);
            }}
          >
            <Text className="seat-chip__num">{seat.index + 1}</Text>
            {seat.index === humanSeat && <Text className="seat-chip__tag">你</Text>}
            {isActive && seat.alive && (
              <Text className="seat-chip__tag seat-chip__tag--active">发言</Text>
            )}
            {deathCause && (
              <Text className="seat-chip__death-label">{CAUSE_LABELS[deathCause]}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
