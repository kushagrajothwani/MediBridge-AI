import { Lock } from 'lucide-react';
import type { MedicalRecord } from '../types';
import { RECORD_LABEL } from '../types';
import { HOSPITALS, hospitalById } from '../data/seed';
import { fmtDate } from '../lib/format';
import { HospitalTag, toneClasses } from './HospitalTag';
import { StatusBadge } from './ui';

interface Props {
  records: MedicalRecord[];
  locked: MedicalRecord[];
  onOpen: (r: MedicalRecord) => void;
  onOpenLocked: (r: MedicalRecord) => void;
}

/**
 * Two lanes, one per hospital, with the dates running down the middle.
 * Records the viewer cannot read still show their date and type, but not their content.
 */
export default function Timeline({ records, locked, onOpen, onOpenLocked }: Props) {
  const items = [
    ...records.map((r) => ({ r, isLocked: false })),
    ...locked.map((r) => ({ r, isLocked: true })),
  ].sort((a, b) => b.r.date.localeCompare(a.r.date));

  return (
    <div>
      <div className="mb-4 hidden grid-cols-[1fr_112px_1fr] md:grid">
        {HOSPITALS.map((h, i) => (
          <div key={h.id} className={`${i === 0 ? 'col-start-1' : 'col-start-3'}`}>
            <div className={`border-b-2 pb-2 ${toneClasses[h.tone].border}`}>
              <p className="font-medium">{h.name}</p>
              <p className="text-xs text-muted">{h.short}</p>
            </div>
          </div>
        ))}
      </div>

      <ol>
        {items.map(({ r, isLocked }) => {
          const h = hospitalById(r.hospitalId)!;
          const t = toneClasses[h.tone];
          return (
            <li key={r.id} className="relative grid grid-cols-[76px_1fr] gap-x-3 md:grid-cols-[1fr_112px_1fr]">
              <div className="relative col-start-1 row-start-1 flex flex-col items-center md:col-start-2">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden />
                <span className="relative mt-4 bg-paper px-1 text-center text-xs leading-tight text-muted">{fmtDate(r.date)}</span>
                <span className={`relative mt-1 size-3 rounded-full ring-4 ring-paper ${isLocked ? 'bg-white border-2 border-muted/50' : t.dot}`} aria-hidden />
              </div>

              <div className={`col-start-2 row-start-1 pb-5 ${h.tone === 'a' ? 'md:col-start-1' : 'md:col-start-3'}`}>
                {isLocked ? (
                  <button
                    onClick={() => onOpenLocked(r)}
                    className="group w-full rounded-md border border-dashed border-muted/40 px-4 py-3 text-left hover:border-muted hover:bg-white/60"
                  >
                    <span className="flex items-center gap-2 text-sm text-muted">
                      <Lock className="size-4" aria-hidden />
                      <span className="font-medium text-ink">{RECORD_LABEL[r.type]}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">Held by {h.short}. The patient has not shared it with you.</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onOpen(r)}
                    className={`w-full rounded-md border border-line border-l-[3px] bg-white px-4 py-3 text-left hover:bg-brand-tint/40 ${t.border}`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-xs font-medium ${t.text}`}>{RECORD_LABEL[r.type]}</span>
                      <span className="md:hidden"><HospitalTag id={r.hospitalId} /></span>
                    </span>
                    <span className="mt-0.5 block font-medium leading-snug">{r.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted">{r.summary}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={r.provenance.verification === 'reviewed' ? 'ok' : 'warn'}>
                        {r.provenance.verification === 'reviewed' ? 'Reviewed' : 'Not yet reviewed'}
                      </StatusBadge>
                      <span className="text-xs text-muted">{r.id}</span>
                    </span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
