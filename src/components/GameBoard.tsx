import React from 'react';
import { Star } from 'lucide-react';

interface GameBoardProps {
  team1Pos: number;
  team2Pos: number;
  activeTeam: 1 | 2;
  ladders: Record<number, number>;
  snakes: Record<number, number>;
  size?: number;
}

// 10 columns x 5 rows = 50 tiles, boustrophedon from bottom-left (1) to top-left (50)
function getTileGridCoords(tile: number, cols = 10, rows = 5) {
  const zeroBased = tile - 1;
  const rowFromBottom = Math.floor(zeroBased / cols);
  const posInRow = zeroBased % cols;
  const col = rowFromBottom % 2 === 0 ? posInRow : cols - 1 - posInRow;
  const rowFromTop = rows - 1 - rowFromBottom;
  return { rowFromTop, col };
}

function getTileCenterPercent(tile: number, cols = 10, rows = 5) {
  const { rowFromTop, col } = getTileGridCoords(tile, cols, rows);
  return {
    x: ((col + 0.5) / cols) * 100,
    y: ((rowFromTop + 0.5) / rows) * 100,
  };
}

function buildLadderGeometry(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 1.15;
  const ny = (dx / len) * 1.15;

  const rail1 = { x1: p1.x + nx, y1: p1.y + ny, x2: p2.x + nx, y2: p2.y + ny };
  const rail2 = { x1: p1.x - nx, y1: p1.y - ny, x2: p2.x - nx, y2: p2.y - ny };

  const rungCount = Math.max(4, Math.floor(len / 3.4));
  const rungs = Array.from({ length: rungCount }).map((_, idx) => {
    const t = (idx + 1) / (rungCount + 1);
    const cx = p1.x + dx * t;
    const cy = p1.y + dy * t;
    return {
      x1: cx + nx,
      y1: cy + ny,
      x2: cx - nx,
      y2: cy - ny,
    };
  });

  return { rail1, rail2, rungs };
}

function buildSnakeWavePath(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  // 2-wave S-curve from head (p1) to tail (p2)
  const amp = Math.min(5.5, Math.max(3.2, len * 0.14));
  const c1x = p1.x + dx * 0.25 + nx * amp;
  const c1y = p1.y + dy * 0.25 + ny * amp;
  const midX = p1.x + dx * 0.5;
  const midY = p1.y + dy * 0.5;
  const c2x = p1.x + dx * 0.75 - nx * amp;
  const c2y = p1.y + dy * 0.75 - ny * amp;

  return `M ${p1.x} ${p1.y} Q ${c1x} ${c1y} ${midX} ${midY} Q ${c2x} ${c2y} ${p2.x} ${p2.y}`;
}

const SNAKE_PALETTES = [
  { body: '#EC4899', stripe: '#FACC15' }, // Pink + Yellow
  { body: '#9333EA', stripe: '#EF4444' }, // Purple + Red
  { body: '#38BDF8', stripe: '#FB7185' }, // Cyan + Coral
  { body: '#F97316', stripe: '#FEF08A' }, // Orange + Cream
  { body: '#2563EB', stripe: '#FACC15' }, // Blue + Gold
];

export const GameBoard: React.FC<GameBoardProps> = ({
  team1Pos,
  team2Pos,
  activeTeam,
  ladders,
  snakes,
  size = 100,
}) => {
  const cols = 10;
  const rows = Math.ceil(size / cols);

  const gridCells: number[] = Array(size).fill(0);
  for (let tile = 1; tile <= size; tile++) {
    const { rowFromTop, col } = getTileGridCoords(tile, cols, rows);
    gridCells[rowFromTop * cols + col] = tile;
  }

  return (
    <div className="p-2 bg-white rounded-2xl border-4 border-[#0F172A] shadow-xl select-none max-w-[640px] xl:max-w-[720px] mx-auto w-full">
      <div className="relative w-full aspect-[10/9] border-2 border-[#1E293B] overflow-hidden bg-white">
        {/* Classic Alternating Green & White Checkerboard */}
        <div
          className="grid w-full h-full"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {gridCells.map((tile) => {
            const { rowFromTop, col } = getTileGridCoords(tile, cols, rows);
            const isGreen = (rowFromTop + col) % 2 === 1;
            const isFinish = tile === size;
            const hasT1 = team1Pos === tile;
            const hasT2 = team2Pos === tile;

            return (
              <div
                key={tile}
                data-testid={`board-tile-${tile}`}
                className={`relative border border-slate-300/60 p-0.5 sm:p-1 flex flex-col justify-between ${
                  isGreen ? 'bg-[#8CC63F]' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between z-10">
                  <span className="font-display text-[10px] sm:text-xs font-black text-[#0F172A] leading-none">
                    {tile}
                  </span>
                  {isFinish && (
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400 stroke-[#92400E] stroke-2" />
                  )}
                </div>

                {/* Pawns */}
                <div className="flex items-center justify-center gap-0.5 z-30">
                  {hasT1 && (
                    <div
                      data-testid="pawn-team-1"
                      title="Kelompok 1 (Tim Biru)"
                      className={`w-4 h-4 sm:w-5 sm:h-5 xl:w-6 xl:h-6 rounded-full bg-[#2563EB] border border-white shadow-md flex items-center justify-center font-display text-[8px] sm:text-[9px] font-black text-white transition-all duration-300 ${
                        activeTeam === 1 ? 'ring-2 ring-[#0F172A] scale-110' : ''
                      }`}
                    >
                      T1
                    </div>
                  )}
                  {hasT2 && (
                    <div
                      data-testid="pawn-team-2"
                      title="Kelompok 2 (Tim Merah)"
                      className={`w-4 h-4 sm:w-5 sm:h-5 xl:w-6 xl:h-6 rounded-full bg-[#E11D48] border border-white shadow-md flex items-center justify-center font-display text-[8px] sm:text-[9px] font-black text-white transition-all duration-300 ${
                        activeTeam === 2 ? 'ring-2 ring-[#0F172A] scale-110' : ''
                      }`}
                    >
                      T2
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* SVG Overlay: Classic Blue Ladders & S-Curved Striped Snakes */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 w-full h-full z-20"
        >
          {/* Blue Ladders */}
          {Object.entries(ladders).map(([fromStr, to]) => {
            const from = Number(fromStr);
            const p1 = getTileCenterPercent(from, cols, rows);
            const p2 = getTileCenterPercent(to, cols, rows);
            const { rail1, rail2, rungs } = buildLadderGeometry(p1, p2);
            return (
              <g key={`ladder-${from}`}>
                {/* Dark Outline */}
                <line {...rail1} stroke="#0F172A" strokeWidth="1.3" strokeLinecap="round" />
                <line {...rail2} stroke="#0F172A" strokeWidth="1.3" strokeLinecap="round" />
                {rungs.map((r, i) => (
                  <line key={`ro-${i}`} {...r} stroke="#0F172A" strokeWidth="1.0" strokeLinecap="round" />
                ))}
                {/* Blue Fill */}
                <line {...rail1} stroke="#2563EB" strokeWidth="0.85" strokeLinecap="round" />
                <line {...rail2} stroke="#2563EB" strokeWidth="0.85" strokeLinecap="round" />
                {rungs.map((r, i) => (
                  <line key={`rf-${i}`} {...r} stroke="#3B82F6" strokeWidth="0.6" strokeLinecap="round" />
                ))}
              </g>
            );
          })}

          {/* S-Curved Striped Snakes */}
          {Object.entries(snakes).map(([fromStr, to], idx) => {
            const from = Number(fromStr);
            const p1 = getTileCenterPercent(from, cols, rows);
            const p2 = getTileCenterPercent(to, cols, rows);
            const pathD = buildSnakeWavePath(p1, p2);
            const palette = SNAKE_PALETTES[idx % SNAKE_PALETTES.length];
            return (
              <g key={`snake-${from}`}>
                {/* Outline */}
                <path d={pathD} fill="none" stroke="#0F172A" strokeWidth="2.3" strokeLinecap="round" />
                {/* Body */}
                <path d={pathD} fill="none" stroke={palette.body} strokeWidth="1.6" strokeLinecap="round" />
                {/* Stripes */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={palette.stripe}
                  strokeWidth="1.4"
                  strokeDasharray="1.8 2.4"
                  strokeLinecap="butt"
                />
                {/* Forked Tongue */}
                <path
                  d={`M ${p1.x} ${p1.y - 1.5} L ${p1.x} ${p1.y - 3.2} M ${p1.x} ${p1.y - 2.6} L ${p1.x - 0.7} ${
                    p1.y - 3.4
                  } M ${p1.x} ${p1.y - 2.6} L ${p1.x + 0.7} ${p1.y - 3.4}`}
                  stroke="#EF4444"
                  strokeWidth="0.4"
                  strokeLinecap="round"
                />
                {/* Cute Head */}
                <ellipse cx={p1.x} cy={p1.y} rx="1.6" ry="1.9" fill={palette.body} stroke="#0F172A" strokeWidth="0.4" />
                {/* Eyes */}
                <circle cx={p1.x - 0.55} cy={p1.y - 0.45} r="0.38" fill="#FFFFFF" />
                <circle cx={p1.x + 0.55} cy={p1.y - 0.45} r="0.38" fill="#FFFFFF" />
                <circle cx={p1.x - 0.55} cy={p1.y - 0.45} r="0.2" fill="#0F172A" />
                <circle cx={p1.x + 0.55} cy={p1.y - 0.45} r="0.2" fill="#0F172A" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
