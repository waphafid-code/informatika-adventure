import React from 'react';

interface DiceWidgetProps {
  value: number | null;
  rolling?: boolean;
  activeTeam: 1 | 2;
}

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const DiceWidget: React.FC<DiceWidgetProps> = ({ value, rolling = false, activeTeam }) => {
  const displayVal = value && value >= 1 && value <= 6 ? value : 6;
  const pips = PIP_POSITIONS[displayVal];
  const ringColor = activeTeam === 1 ? 'border-[#3B82F6] shadow-blue-500/25' : 'border-[#FB7185] shadow-rose-500/25';

  return (
    <div
      className={`w-16 h-16 rounded-2xl bg-white p-2.5 grid grid-cols-3 grid-rows-3 gap-1 border-4 shadow-xl transition-transform ${ringColor} ${
        rolling ? 'animate-dice-tumble' : ''
      }`}
      aria-label={value ? `Dadu bernilai ${value}` : 'Dadu siap dilempar'}
    >
      {Array.from({ length: 9 }).map((_, idx) => {
        const hasPip = pips.includes(idx);
        return (
          <div key={idx} className="flex items-center justify-center">
            {hasPip && (
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  displayVal === 1 ? 'bg-[#E11D48] w-3.5 h-3.5' : 'bg-[#0B1120]'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
