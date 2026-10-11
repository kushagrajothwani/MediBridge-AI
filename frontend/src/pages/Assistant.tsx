import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Lock, Sparkles } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { HOSPITALS, PATIENTS, hospitalById } from '../data/seed';
import { isActive, splitRecords } from '../lib/access';
import { buildSummary, type AISummary } from '../lib/summarize';
import { Button, EmptyState, PageHeader, inputClass } from '../components/ui';
import AIResponseCard, { type ReviewState } from '../components/AIResponseCard';
import RecordDrawer from '../components/RecordDrawer';
import { HospitalTag } from '../components/HospitalTag';
import type { MedicalRecord } from '../types';
import { fmtDateTime } from '../lib/format';

const STEPS = [
  'Checking your permission for this patient',
  'Fetching the records you are allowed to read',
  'Reading documents and lab values',
  'Drafting the summary',
  'Checking each statement against its source',
];

const SUGGESTED = [
  'Summarize the patient’s previous medical records, list documented medications, and highlight any missing information.',
  'How have the patient’s lab values changed over time?',
  'Are there any documented allergies?',
];

export default function Assistant() {
  const { user, records, consents, logAi } = useStore();
  const [params] = useSearchParams();
  const [patientId, setPatientId] = useState(params.get('patient') ?? PATIENTS[0].id);
  const [query, setQuery] = useState(SUGGESTED[0]);
  const [stage, setStage] = useState(-1); // -1 idle, 0..n-1 running, n done
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [review, setReview] = useState<ReviewState>('pending');
  const [open, setOpen] = useState<MedicalRecord | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!user) return null;
  const { visible, locked } = splitRecords(records, patientId, user, consents);
  const running = stage >= 0 && stage < STEPS.length;

  function pickPatient(id: string) {
    window.clearInterval(timer.current);
    setPatientId(id); setSummary(null); setStage(-1); setReview('pending');
  }

  function ask() {
    if (!user || query.trim().length < 5) return;
    window.clearInterval(timer.current);
    setSummary(null); setReview('pending'); setStage(0);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      if (i >= STEPS.length) {
        window.clearInterval(timer.current);
        setSummary(buildSummary(patientId, query.trim(), visible, locked.length));
        setStage(STEPS.length);
        logAi(user, patientId, query.trim());
      } else setStage(i);
    }, 650);
  }

  return (
    <>
      <PageHeader title="AI assistant">
        Ask about one patient at a time. The assistant reads only what you are allowed to read and links every statement to its source.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="rounded-lg border border-line bg-white p-5">
            <label htmlFor="patient" className="mb-1 block text-sm font-medium">Patient</label>
            <select id="patient" value={patientId} onChange={(e) => pickPatient(e.target.value)} className={`${inputClass} max-w-sm`}>
              {PATIENTS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>

            <label htmlFor="q" className="mb-1 mt-4 block text-sm font-medium">Your question</label>
            <textarea id="q" rows={3} value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} h-auto py-2`} />
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => setQuery(s)} className="rounded-full border border-line px-3 py-1 text-left text-xs text-muted hover:bg-paper hover:text-ink">
                  {s.length > 56 ? s.slice(0, 54) + '…' : s}
                </button>
              ))}
            </div>
            <Button className="mt-4" onClick={ask} loading={running}><Sparkles className="size-4" /> Ask</Button>
          </div>

          {stage >= 0 && !summary && (
            <ol className="mt-6 space-y-2" aria-live="polite" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 text-sm ${i > stage ? 'text-muted/60' : i === stage ? 'font-medium' : 'text-muted'}`}>
                  {i < stage ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : i === stage ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <span className="size-4 rounded-full border border-line" aria-hidden />}
                  {s}
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6">
            {summary ? (
              <AIResponseCard summary={summary} records={visible} review={review} onReview={setReview} onOpenRecord={setOpen} reviewer={user.name} />
            ) : stage < 0 ? (
              <EmptyState title="No summary yet" body="Choose a patient, check the question and press Ask. The answer will list its sources." />
            ) : null}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-2 font-semibold">What the assistant can read</h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-white">
            {HOSPITALS.map((h) => {
              const total = records.filter((r) => r.patientId === patientId && r.hospitalId === h.id);
              if (!total.length) return null;
              const readable = total.filter((r) => visible.includes(r)).length;
              const live = consents.find((c) => c.patientId === patientId && c.doctorId === user.id && isActive(c) && c.hospitalId === user.hospitalId);
              return (
                <li key={h.id} className="px-4 py-3">
                  <HospitalTag id={h.id} long />
                  <p className="mt-1 text-sm">{readable} of {total.length} records</p>
                  {readable < total.length && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-warn"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Needs the patient’s consent. <Link className="underline" to={`/app/patient/${patientId}`}>Ask for access</Link></p>
                  )}
                  {h.id !== user.hospitalId && live && <p className="mt-1 text-xs text-muted">Access ends {fmtDateTime(live.expiresAt!)}</p>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-muted">
            If a patient revokes access, the assistant loses it on the next question. {hospitalById(user.hospitalId)?.short} records are always available to you.
          </p>
        </aside>
      </div>
      <RecordDrawer record={open} onClose={() => setOpen(null)} />
    </>
  );
}
