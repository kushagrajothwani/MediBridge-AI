import { hospitalById } from '../data/seed';

export const toneClasses = {
  a: { dot: 'bg-brand', text: 'text-brand-deep', border: 'border-brand', tint: 'bg-brand-tint', hex: '#0d9488' },
  b: { dot: 'bg-plum', text: 'text-plum', border: 'border-plum', tint: 'bg-plum-tint', hex: '#8a3b6b' },
} as const;

export function HospitalTag({ id, long }: { id: string; long?: boolean }) {
  const h = hospitalById(id);
  if (!h) return null;
  const t = toneClasses[h.tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`size-2.5 rounded-[3px] ${t.dot}`} aria-hidden />
      <span className={`font-medium ${t.text}`}>{long ? h.name : h.short}</span>
    </span>
  );
}
