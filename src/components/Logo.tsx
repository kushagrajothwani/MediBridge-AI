export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#102A43" stroke="rgba(255,255,255,.18)" />
      <circle cx="9" cy="21" r="3.2" fill="#2DD4BF" />
      <circle cx="23" cy="21" r="3.2" fill="#E9B5D2" />
      <path d="M9 21C9 11 23 11 23 21" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-display text-xl font-semibold ${light ? 'text-white' : 'text-navy'}`}>MediBridge AI</span>
    </span>
  );
}
