import React from 'react';
import { Crown } from 'lucide-react';

interface StudentAvatarProps {
  name: string;
  teamNumber?: 1 | 2 | null;
  isCaptain?: boolean;
  isConnected?: boolean;
  size?: 'sm' | 'md';
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  name,
  teamNumber,
  isCaptain = false,
  isConnected = true,
  size = 'md',
}) => {
  const bg =
    teamNumber === 1
      ? 'bg-[#2563EB] text-white'
      : teamNumber === 2
      ? 'bg-[#E11D48] text-white'
      : 'bg-[#7C3AED] text-white';

  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${dim} ${bg} rounded-full font-display font-black flex items-center justify-center border-2 border-white/20 shadow-sm`}
      >
        {getInitials(name)}
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111C33] ${
          isConnected ? 'bg-[#10B981]' : 'bg-slate-500'
        }`}
      />
      {isCaptain && (
        <span
          title="Kapten"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow"
        >
          <Crown className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};
