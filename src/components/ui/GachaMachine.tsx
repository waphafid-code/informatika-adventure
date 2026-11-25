import React from 'react';
import { Crown, ShieldCheck, Dices } from 'lucide-react';
import { GameButton } from './GameButton';

interface GachaMachineProps {
  spinning: boolean;
  onSpin: () => void;
  result: { teamNumber: 1 | 2; isCaptain: boolean } | null;
  onContinue?: () => void;
}

export const GachaMachine: React.FC<GachaMachineProps> = ({
  spinning,
  onSpin,
  result,
  onContinue,
}) => {
  if (result) {
    const isBlue = result.teamNumber === 1;
    return (
      <div
        data-testid="gacha-result-card"
        className={`animate-pop-in rounded-2xl p-6 text-center space-y-5 border-2 ${
          isBlue ? 'bg-[#162033] border-[#2563EB]' : 'bg-[#162033] border-[#E11D48]'
        }`}
      >
        <div
          className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
            isBlue ? 'bg-[#2563EB]' : 'bg-[#E11D48]'
          }`}
        >
          <ShieldCheck className="w-9 h-9 text-white" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Penempatan Kelompok
          </div>
          <div
            data-testid="assigned-team-label"
            className={`font-display text-2xl font-black ${isBlue ? 'text-blue-400' : 'text-rose-400'}`}
          >
            Kelompok {result.teamNumber} ({isBlue ? 'Tim Biru' : 'Tim Merah'})
          </div>
        </div>

        {result.isCaptain && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold">
            <Crown className="w-4 h-4" /> Anda Ditunjuk sebagai Kapten / Juru Jawab
          </div>
        )}

        {onContinue && (
          <GameButton
            variant={isBlue ? 'team1' : 'team2'}
            size="lg"
            fullWidth
            onClick={onContinue}
            data-testid="go-to-lobby-btn"
          >
            Masuk ke Lobby Permainan
          </GameButton>
        )}
      </div>
    );
  }

  return (
    <div className="text-center space-y-5 py-2">
      <div className={`relative w-40 h-44 mx-auto ${spinning ? 'animate-gacha-shake' : ''}`}>
        <svg viewBox="0 0 180 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <circle cx="90" cy="72" r="56" fill="#162033" stroke="#334155" strokeWidth="5" />
          <circle cx="68" cy="74" r="14" fill="#2563EB" />
          <path d="M54 74H82" stroke="#FFFFFF" strokeWidth="3" />
          <circle cx="110" cy="78" r="14" fill="#E11D48" />
          <path d="M96 78H124" stroke="#FFFFFF" strokeWidth="3" />
          <circle cx="88" cy="52" r="13" fill="#F59E0B" />
          <path d="M75 52H101" stroke="#FFFFFF" strokeWidth="3" />
          <circle cx="90" cy="96" r="13" fill="#10B981" />
          <path d="M77 96H103" stroke="#FFFFFF" strokeWidth="3" />
          <rect x="44" y="122" width="92" height="60" rx="14" fill="#1E293B" stroke="#475569" strokeWidth="4" />
          <circle cx="90" cy="145" r="12" fill="#F59E0B" />
          <rect x="66" y="164" width="48" height="12" rx="4" fill="#0B1120" />
        </svg>
      </div>

      <div className="space-y-1">
        <h2 className="font-display text-xl font-black text-white">Gacha Kelompok</h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Server menempatkan Anda secara seimbang ke Tim Biru atau Tim Merah.
        </p>
      </div>

      <GameButton
        variant="warning"
        size="lg"
        fullWidth
        disabled={spinning}
        onClick={onSpin}
        data-testid="run-gacha-btn"
      >
        <Dices className="w-5 h-5" />
        {spinning ? 'Mengundi Kelompok...' : 'Putar Gacha'}
      </GameButton>
    </div>
  );
};
