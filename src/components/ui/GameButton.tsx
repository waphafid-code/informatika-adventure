import React from 'react';

type ButtonVariant = 'primary' | 'purple' | 'team1' | 'team2' | 'success' | 'warning' | 'danger' | 'ghost';

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#2563EB] hover:bg-[#3B82F6] text-white border-b-4 border-[#1D4ED8] active:border-b-0 active:translate-y-1',
  purple:
    'bg-[#7C3AED] hover:bg-[#8B5CF6] text-white border-b-4 border-[#5B21B6] active:border-b-0 active:translate-y-1',
  team1:
    'bg-[#2563EB] hover:bg-[#3B82F6] text-white border-b-4 border-[#1E40AF] active:border-b-0 active:translate-y-1',
  team2:
    'bg-[#E11D48] hover:bg-[#F43F5E] text-white border-b-4 border-[#9F1239] active:border-b-0 active:translate-y-1',
  success:
    'bg-[#10B981] hover:bg-[#34D399] text-slate-950 border-b-4 border-[#047857] active:border-b-0 active:translate-y-1',
  warning:
    'bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 border-b-4 border-[#B45309] active:border-b-0 active:translate-y-1',
  danger:
    'bg-[#E11D48]/20 hover:bg-[#E11D48]/30 text-rose-200 border border-rose-500/40',
  ghost:
    'bg-[#1A2744] hover:bg-[#263759] text-slate-200 border border-slate-700',
};

const SIZE_STYLES = {
  sm: 'px-3.5 py-2 text-xs min-h-[38px] rounded-xl',
  md: 'px-5 py-3 text-sm min-h-[44px] rounded-xl',
  lg: 'px-6 py-3.5 text-base min-h-[52px] rounded-2xl',
};

export const GameButton: React.FC<GameButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-display font-extrabold transition-all duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1120] ${
        VARIANT_STYLES[variant]
      } ${SIZE_STYLES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
};
