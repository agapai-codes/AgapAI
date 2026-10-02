'use client';

import { cn } from '@/lib/utils';

interface SOSButtonProps {
  onClick: () => void;
  isActive?: boolean;
}

export default function SOSButton({ onClick, isActive }: SOSButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={isActive ? 'Deactivate emergency mode' : 'Activate emergency mode'}
      className={cn(
        'mono relative flex h-40 w-40 cursor-pointer items-center justify-center rounded-full',
        'border-2 text-2xl font-bold tracking-[0.18em] transition-colors duration-200',
        'md:h-48 md:w-48 md:text-3xl',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]',
        isActive
          ? 'border-[#f87171] bg-[var(--critical)] text-white critical-pulse'
          : 'border-[var(--critical)] bg-[var(--critical-deep)] text-white sos-pulse hover:bg-[var(--critical)]'
      )}
      title={isActive ? 'Click to stop recording' : 'Click to activate emergency mode'}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-[#f87171]/60 animate-ping"
        />
      )}
      <span className="relative z-10">{isActive ? 'DEACTIVATE' : 'SOS'}</span>
    </button>
  );
}
