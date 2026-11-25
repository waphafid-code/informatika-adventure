import React from 'react';
import { Trophy } from 'lucide-react';
import { GameResult } from '../../types';

interface VictoryOverlayProps {
  result: GameResult;
  testId?: string;
}

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({ result, testId = 'teacher-game-result' }) => {
  const isDraw = result.winner_team === 0;
  const isBlueWin = result.winner_team === 1;

  return (
    <div
      data-testid={testId}
      className={`animate-pop-in rounded-2xl p-5 border-2 text-center space-y-4 bg-[#162033] ${
        isDraw ? 'border-[#7C3AED]' : isBlueWin ? 'border-[#2563EB]' : 'border-[#E11D48]'
      }`}
    >
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-500/40 mx-auto">
        <Trophy className="w-8 h-8 text-amber-400" />
      </div>

      <div className="space-y-1">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
          Pertandingan Selesai
        </div>
        <h3 className="font-display text-xl font-black text-white">
          {isDraw
            ? 'Hasil Pertandingan Seri'
            : `Juara: Kelompok ${result.winner_team} (${isBlueWin ? 'Tim Biru' : 'Tim Merah'})`}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className={`p-3 rounded-xl bg-[#0F172A] border ${isBlueWin ? 'border-[#2563EB]' : 'border-slate-800'}`}>
          <div className="text-xs font-extrabold text-blue-400">TIM BIRU (K1)</div>
          <div className="font-display text-lg font-black text-white">Petak {result.team1_final_pos}</div>
          <div className="text-xs font-bold text-amber-400">{result.team1_xp} XP</div>
        </div>
        <div className={`p-3 rounded-xl bg-[#0F172A] border ${!isDraw && !isBlueWin ? 'border-[#E11D48]' : 'border-slate-800'}`}>
          <div className="text-xs font-extrabold text-rose-400">TIM MERAH (K2)</div>
          <div className="font-display text-lg font-black text-white">Petak {result.team2_final_pos}</div>
          <div className="text-xs font-bold text-amber-400">{result.team2_xp} XP</div>
        </div>
      </div>

      <div className="text-xs text-slate-400 font-semibold">
        Total Giliran: <strong className="text-white">{result.total_turns}</strong>
      </div>
    </div>
  );
};
