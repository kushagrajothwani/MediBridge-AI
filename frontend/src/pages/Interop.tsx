import { useEffect, useRef, useState } from 'react';
import { Building2, Cog, Link2, ShieldCheck, XCircle, CheckCircle2, Circle } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { PATIENTS } from '../data/seed';
import { isActive } from '../lib/access';
import { legacyPayload, toFhir } from '../lib/fhir';
import { Button, PageHeader, inputClass } from '../components/ui';
import { RECORD_LABEL } from '../types';

const STEPS = [
  { title: 'Record uploaded', detail: 'Hospital A sends the record in its own format.' },
  { title: 'Standardised', detail: 'Converted to a FHIR-style resource with its source attached.' },
  { title: 'Patient matched', detail: 'Linked to the patient by MediBridge ID.' },
  { title: 'Consent checked', detail: 'Does Hospital B hold an active consent for this record type?' },
  { title: 'Delivered to Hospital B', detail: 'Only permitted records are released.' },
];

export default function Interop() {
  const { records, consents } = useStore();
  const hospitalA = records.filter((r) => r.hospitalId === 'H-A');
  const [recordId, setRecordId] = useState(hospitalA[0]?.id ?? '');
  const [step, setStep] = useState(-1);
  const [blocked, setBlocked] = useState(false);
  const [view, setView] = useState<'original' | 'standard'>('original');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(timer.current), []);

  const record = hospitalA.find((r) => r.id === recordId);
  if (!record) return null;

  const hasConsent = consents.some(
    (c) => c.patientId === record.patientId && c.hospitalId === 'H-B' && isActive(c) && c.scope.includes(record.type),
  );
  const running = step >= 0 && step < STEPS.length - 1 && !blocked;

  function run() {
    window.clearInterval(timer.current);
    setBlocked(false); setView('original'); setStep(0);
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      if (i === 1) setView('standard');
      if (i === 3 && !hasConsent) {
        setStep(3); setBlocked(true);
        window.clearInterval(timer.current);
        return;
      }
      setStep(i);
      if (i >= STEPS.length - 1) window.clearInterval(timer.current);
    }, 1100);
  }

  // Position of the moving packet along the line between the three nodes
  const pct = step < 0 ? 0 : step === 0 ? 0 : step < 4 ? 50 : 100;
  const json = JSON.stringify(view === 'original' ? legacyPayload(record) : toFhir(record), null, 2);
  const patientName = PATIENTS.find((p) => p.id === record.patientId)?.name;

  return (
    <>
      <PageHeader title="Record exchange">
        Watch one record move from Hospital A to Hospital B. It is delivered only if the patient has given consent.
      </PageHeader>

      <div className="rounded-lg border border-line bg-white p-5 sm:p-8">
        <div className="relative flex items-center justify-between" aria-hidden>
          <div className="absolute inset-x-12 top-1/2 h-0.5 -translate-y-1/2 bg-line sm:inset-x-[88px]">
            <span
              className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-1000 ease-in-out ${blocked ? 'bg-bad' : 'bg-brand'}`}
              style={{ left: `${pct}%`, opacity: step < 0 ? 0.35 : 1 }}
            />
          </div>
          {[
            { icon: <Building2 className="size-6" />, name: 'Hospital A', sub: 'Holds the record', tone: 'bg-brand-tint text-brand-deep' },
            { icon: <Cog className="size-6" />, name: 'MediBridge', sub: 'Standardises and checks', tone: 'bg-navy text-white' },
            { icon: <Building2 className="size-6" />, name: 'Hospital B', sub: 'Asks for the record', tone: 'bg-plum-tint text-plum' },
          ].map((n) => (
            <div key={n.name} className="relative flex w-24 flex-col items-center text-center sm:w-44">
              <span className={`grid size-14 place-items-center rounded-xl ${n.tone} ${blocked && n.name === 'MediBridge' ? 'ring-4 ring-bad' : ''}`}>{n.icon}</span>
              <span className="mt-2 text-sm font-medium">{n.name}</span>
              <span className="hidden text-xs text-muted sm:block">{n.sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section aria-label="Steps">
          <label htmlFor="rec" className="mb-1 block text-sm font-medium">Record to send</label>
          <select id="rec" value={recordId} onChange={(e) => { setRecordId(e.target.value); setStep(-1); setBlocked(false); setView('original'); }} className={inputClass}>
            {hospitalA.map((r) => <option key={r.id} value={r.id}>{r.id}: {RECORD_LABEL[r.type]}</option>)}
          </select>
          <p className="mt-2 text-sm text-muted">
            {hasConsent
              ? `${patientName} has allowed Hospital B to read ${RECORD_LABEL[record.type].toLowerCase()} records.`
              : `${patientName} has not allowed Hospital B to read ${RECORD_LABEL[record.type].toLowerCase()} records. Try it, then grant consent as the patient and run it again.`}
          </p>
          <Button className="mt-4" onClick={run} loading={running}><Link2 className="size-4" /> Send to Hospital B</Button>

          <ol className="mt-6 space-y-4" aria-live="polite">
            {STEPS.map((s, i) => {
              const failedHere = blocked && i === 3;
              const stopped = blocked && i === 4;
              const reached = i <= step && !stopped;
              return (
                <li key={s.title} className="flex gap-3">
                  <span className="mt-0.5">
                    {failedHere ? <XCircle className="size-5 text-bad" /> : reached && (i < step || i === STEPS.length - 1) ? <CheckCircle2 className="size-5 text-ok" /> : i === step && !blocked ? <Circle className="size-5 animate-pulse text-brand" /> : <Circle className="size-5 text-line" />}
                  </span>
                  <div>
                    <p className={`font-medium ${i > step && !stopped ? 'text-muted' : ''}`}>
                      {stopped ? 'Not delivered' : failedHere ? 'Blocked: no consent' : s.title}
                    </p>
                    <p className="text-sm text-muted">
                      {failedHere ? 'No active consent covers this record type for Hospital B. The record stays at Hospital A.' : stopped ? 'Nothing was sent to Hospital B.' : s.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {step === STEPS.length - 1 && !blocked && (
            <p className="mt-4 flex items-center gap-2 rounded-md bg-ok-tint px-3 py-2 text-sm text-ok" role="status"><ShieldCheck className="size-4" aria-hidden /> Delivered. The transfer is in the audit log.</p>
          )}
        </section>

        <section aria-label="Record format">
          <div className="mb-2 flex gap-1" role="tablist" aria-label="Format">
            <button role="tab" aria-selected={view === 'original'} onClick={() => setView('original')} className={`rounded-md px-3 py-1.5 text-sm ${view === 'original' ? 'bg-navy text-white' : 'border border-line bg-white'}`}>As Hospital A stores it</button>
            <button role="tab" aria-selected={view === 'standard'} onClick={() => setView('standard')} className={`rounded-md px-3 py-1.5 text-sm ${view === 'standard' ? 'bg-navy text-white' : 'border border-line bg-white'}`}>Standardised (FHIR-style)</button>
          </div>
          <pre className="max-h-[30rem] overflow-auto rounded-md bg-navy p-4 font-mono text-xs leading-relaxed text-[#d6e4f0]" tabIndex={0} aria-label="Record JSON">{json}</pre>
          <p className="mt-2 text-xs text-muted">Simplified for the demo. It follows FHIR R4 resource names but is not checked against the full specification.</p>
        </section>
      </div>
    </>
  );
}
