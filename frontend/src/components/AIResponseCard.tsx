import { AlertTriangle, CheckCircle2, FileSearch, GitCompareArrows, Sparkles } from 'lucide-react';
import type { AISummary, Claim, ClaimKind } from '../lib/summarize';
import type { MedicalRecord } from '../types';
import { hospitalById, patientById } from '../data/seed';
import { fmtDateTime } from '../lib/format';
import { Button, StatusBadge } from './ui';
import { toneClasses } from './HospitalTag';

const KIND: Record<ClaimKind, { label: string; icon: React.ReactNode; row: string; badge: 'ok' | 'info' | 'warn' | 'bad' }> = {
  verified: { label: 'From a record', icon: <CheckCircle2 className="size-3.5" />, row: 'border-line', badge: 'ok' },
  ai: { label: 'AI observation', icon: <Sparkles className="size-3.5" />, row: 'border-info/40 bg-info-tint/40', badge: 'info' },
  missing: { label: 'Missing', icon: <FileSearch className="size-3.5" />, row: 'border-warn/30 bg-warn-tint/50', badge: 'warn' },
  conflict: { label: 'Records disagree', icon: <GitCompareArrows className="size-3.5" />, row: 'border-bad/40 bg-bad-tint/60', badge: 'bad' },
};

export type ReviewState = 'pending' | 'accepted' | 'discarded';

export function SourceCitation({ record, onOpen }: { record: MedicalRecord; onOpen: (r: MedicalRecord) => void }) {
  const t = toneClasses[hospitalById(record.hospitalId)?.tone ?? 'a'];
  return (
    <button
      onClick={() => onOpen(record)}
      className={`inline-flex items-center gap-1.5 rounded border border-line bg-white px-2 py-0.5 text-xs hover:bg-paper`}
      title={`Open ${record.id}`}
    >
      <span className={`size-2 rounded-[2px] ${t.dot}`} aria-hidden />
      {record.id}
    </button>
  );
}

function ClaimRow({ claim, records, onOpen }: { claim: Claim; records: MedicalRecord[]; onOpen: (r: MedicalRecord) => void }) {
  const k = KIND[claim.kind];
  return (
    <li className={`rounded-md border px-4 py-3 ${k.row}`}>
      <div className="mb-1"><StatusBadge tone={k.badge} icon={k.icon}>{k.label}</StatusBadge></div>
      <p className="leading-relaxed">{claim.text}</p>
      {claim.sources.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          Sources:
          {claim.sources.map((id) => {
            const r = records.find((x) => x.id === id);
            return r ? <SourceCitation key={id} record={r} onOpen={onOpen} /> : null;
          })}
        </p>
      )}
    </li>
  );
}

export default function AIResponseCard({
  summary, records, review, onReview, onOpenRecord, reviewer,
}: {
  summary: AISummary;
  records: MedicalRecord[];
  review: ReviewState;
  onReview: (s: ReviewState) => void;
  onOpenRecord: (r: MedicalRecord) => void;
  reviewer: string;
}) {
  const patient = patientById(summary.patientId);
  const all = summary.sections.flatMap((s) => s.claims);
  const conflicts = all.filter((c) => c.kind === 'conflict').length;
  const missing = all.filter((c) => c.kind === 'missing').length;

  return (
    <article className="rounded-lg border border-line bg-white" aria-label="AI-generated summary">
      <header className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info" icon={<Sparkles className="size-3.5" />}>AI-generated draft</StatusBadge>
          {review === 'accepted' && <StatusBadge tone="ok" icon={<CheckCircle2 className="size-3.5" />}>Reviewed by {reviewer}</StatusBadge>}
          {review === 'discarded' && <StatusBadge tone="neutral">Discarded</StatusBadge>}
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold">{patient?.name}, record summary</h2>
        <p className="mt-1 text-sm text-muted">Question: {summary.query}</p>
        <p className="text-xs text-muted">Generated {fmtDateTime(summary.generatedAt)} from {summary.usedRecordIds.length} records. Synthetic data.</p>
        {(conflicts > 0 || missing > 0) && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-warn-tint px-3 py-2 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {conflicts > 0 && `${conflicts} conflict${conflicts === 1 ? '' : 's'} between records. `}
            {missing > 0 && `${missing} gap${missing === 1 ? '' : 's'} in the information.`} Read these before relying on the summary.
          </p>
        )}
      </header>

      <div className={review === 'discarded' ? 'opacity-40' : ''}>
        {summary.sections.map((s) => (
          <section key={s.heading} className="border-b border-line px-5 py-4 last:border-0">
            <h3 className="mb-2 font-semibold">{s.heading}</h3>
            <ul className="space-y-2">
              {s.claims.map((c, i) => <ClaimRow key={i} claim={c} records={records} onOpen={onOpenRecord} />)}
            </ul>
          </section>
        ))}
      </div>

      <footer className="rounded-b-lg border-t border-line bg-paper px-5 py-4">
        {review === 'pending' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => onReview('accepted')}>I have checked the sources</Button>
            <Button variant="secondary" onClick={() => onReview('discarded')}>Discard summary</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => onReview('pending')}>Undo</Button>
        )}
        <p className="mt-3 text-sm text-muted">AI-generated information is for clinical review and does not replace professional medical judgment.</p>
      </footer>
    </article>
  );
}
