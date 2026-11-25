import React from 'react';

interface GameLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showMascot?: boolean;
}

export const MascotSvg: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <rect x="6" y="6" width="52" height="52" rx="14" fill="#1E293B" stroke="#3B82F6" strokeWidth="3" />
    <rect x="14" y="14" width="16" height="16" rx="4" fill="#2563EB" />
    <rect x="34" y="14" width="16" height="16" rx="4" fill="#E11D48" />
    <rect x="14" y="34" width="16" height="16" rx="4" fill="#10B981" />
    <rect x="34" y="34" width="16" height="16" rx="4" fill="#F59E0B" />
    <circle cx="22" cy="22" r="3" fill="#FFFFFF" />
    <circle cx="42" cy="42" r="3" fill="#0B1120" />
  </svg>
);

export const GameLogo: React.FC<GameLogoProps> = ({ size = 'md', showMascot = true }) => {
  const titleSize =
    size === 'lg' ? 'text-3xl sm:text-4xl' : size === 'sm' ? 'text-lg' : 'text-xl sm:text-2xl';
  const mascotSize = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';

  return (
    <div className="inline-flex items-center gap-3 select-none">
      {showMascot && <MascotSvg className={mascotSize} />}
      <div className="leading-tight text-left">
        <div className={`font-display font-black tracking-tight text-white ${titleSize}`}>
          INFORMATIKA <span className="text-[#3B82F6]">ADVENTURE</span>
        </div>
        {size !== 'sm' && (
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Classroom Board Game
          </div>
        )}
      </div>
    </div>
  );
};
