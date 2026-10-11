import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, LockOpen } from 'lucide-react';
import { Wordmark } from '../components/Logo';
import { Button } from '../components/ui';

const PEEK = [
  { id: 'Visit-B-005', hospital: 'b', date: '4 Oct 2026', title: 'Visit: tiredness and increased thirst' },
  { id: 'Report-B-004', hospital: 'b', date: '20 Jun 2026', title: 'Follow-up blood report' },
  { id: 'Allergy-A-004', hospital: 'a', date: '18 Apr 2026', title: 'Penicillin allergy' },
  { id: 'Prescription-A-002', hospital: 'a', date: '12 Mar 2026', title: 'Prescription: Metformin' },
  { id: 'Report-A-001', hospital: 'a', date: '12 Mar 2026', title: 'Blood report: HbA1c, glucose, LDL' },
] as const;

function ConsentPeek() {
  const [granted, setGranted] = useState(false);
  const visible = PEEK.filter((r) => r.hospital === 'b' || granted).length;
  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <p className="text-sm text-muted">What Dr. Iyer sees at Hospital B</p>
        <p className="font-display text-xl font-semibold">Rahul Sharma, MB-PAT-1001</p>
      </div>
      <ul>
        {PEEK.map((r) => {
          const locked = r.hospital === 'a' && !granted;
          return (
            <li key={r.id} className="flex items-stretch border-b border-line last:border-0">
              <span className={`w-1 ${r.hospital === 'a' ? 'bg-brand' : 'bg-plum'}`} aria-hidden />
              <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{r.date}, Hospital {r.hospital.toUpperCase()}</p>
                  <p className={`truncate font-medium transition-[filter] duration-500 ${locked ? 'select-none blur-[5px]' : ''}`} aria-hidden={locked}>{r.title}</p>
                  {locked && <span className="sr-only">Locked until the patient gives consent</span>}
                </div>
                {locked ? <Lock className="size-4 shrink-0 text-muted" aria-hidden /> : <LockOpen className="size-4 shrink-0 text-brand-deep" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl bg-paper px-5 py-4">
        <p className="text-sm" aria-live="polite">
          {granted ? 'Rahul has allowed Hospital B. All 5 records are open.' : `Hospital A's records are locked. ${visible} of 5 are open.`}
        </p>
        <Button variant={granted ? 'secondary' : 'primary'} size="sm" onClick={() => setGranted((g) => !g)}>
          {granted ? 'Revoke access' : 'Rahul grants access'}
        </Button>
      </div>
    </div>
  );
}

const STEPS = [
  ['Hospital A uploads a record', 'A prescription, blood report or note goes in as a PDF or a form. Staff check what the system read before it is saved.'],
  ['MediBridge standardises it', 'The record is converted to a common FHIR-style format, with the hospital, date and source file kept attached.'],
  ['The patient is matched', 'Records are linked to one patient through a verified identifier, so two hospitals are talking about the same person.'],
  ['The patient decides', 'Hospital B asks. The patient chooses which record types to share and for how long, and can end it at any time.'],
  ['The doctor reads one timeline', 'Records from both hospitals appear in date order. Every access is written to the audit log.'],
];

const TERMS: [string, string][] = [
  ['Consent comes first', 'A doctor who can find a patient still cannot read another hospital’s records until the patient allows it.'],
  ['Access has an end date', 'Permission is for chosen record types and expires on its own. Revoking it takes effect on the next request.'],
  ['Emergencies are narrow', 'If a patient cannot answer, a doctor can open allergies, diagnoses and prescriptions for 24 hours. A written reason is required and the patient is told.'],
  ['Everything is logged', 'Who looked, at what, when, why, and under which consent. Patients can read their own history.'],
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" aria-label="MediBridge AI home"><Wordmark /></Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Page sections">
          <a href="#how" className="text-muted hover:text-ink">How it works</a>
          <a href="#ai" className="text-muted hover:text-ink">The AI assistant</a>
          <a href="#privacy" className="text-muted hover:text-ink">Consent and privacy</a>
        </nav>
        <Link to="/login"><Button size="sm">Explore Demo</Button></Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1fr_1fr] lg:pt-14">
        <div>
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.08] text-navy sm:text-6xl">
            Your Medical History Should Travel With You.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Securely connecting hospitals, doctors, and patient records through interoperable healthcare technology and AI.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login"><Button className="h-12 px-6 text-base">Explore Demo</Button></Link>
            <a href="#how"><Button variant="secondary" className="h-12 px-6 text-base">How It Works</Button></a>
          </div>
          <p className="mt-6 max-w-md text-sm text-muted">Try the panel on the right. It is the whole idea in one screen: the doctor can find the records, but only the patient can open them.</p>
        </div>
        <ConsentPeek />
      </section>

      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight">Six months of records, and none of them in the room.</h2>
            <p className="mt-5 max-w-xl leading-relaxed text-white/80">
              Rahul was diagnosed with diabetes at Hospital A. When he walks into Hospital B feeling unwell, the doctor has his word,
              a half-remembered medicine name and no reports. The data exists. It sits in a system the doctor cannot reach.
            </p>
          </div>
          <ul className="divide-y divide-white/15 self-center border-y border-white/15">
            {['Tests get repeated because earlier results cannot be found.', 'Allergies and current medicines are missed.', 'Patients cannot see or control who has read their records.', 'Each hospital keeps a different format, so even shared files do not line up.'].map((t) => (
              <li key={t} className="py-3 text-white/90">{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-4 px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight text-navy">How a record travels</h2>
            <p className="mt-3 text-muted">MediBridge does not replace a hospital’s own system. It sits between hospitals and moves records only when the patient agrees.</p>
          </div>
          <ol className="space-y-0">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="relative flex gap-5 pb-8 last:pb-0">
                {i < STEPS.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-line" aria-hidden />}
                <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-semibold text-white">{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 max-w-xl text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ai" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="max-w-2xl font-display text-3xl font-semibold leading-tight text-navy">An assistant that shows its sources</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Doctors ask in plain language. The assistant reads only the records the doctor is allowed to see and links every statement back to the document it came from.
          </p>
          <div className="mt-10 grid gap-x-16 gap-y-8 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-ok">It will</h3>
              <ul className="mt-3 space-y-2.5">
                {['Summarise history across hospitals in date order', 'Read prescriptions and reports from scanned PDFs', 'Show how lab values changed, with units and reference ranges', 'Point out missing information and records that disagree'].map((t) => <li key={t} className="border-l-2 border-ok/40 pl-3">{t}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-bad">It will not</h3>
              <ul className="mt-3 space-y-2.5">
                {['Diagnose or suggest a treatment', 'Read records the patient has not shared', 'Present a guess as a fact', 'Replace the doctor’s review'].map((t) => <li key={t} className="border-l-2 border-bad/40 pl-3">{t}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="mx-auto max-w-6xl scroll-mt-4 px-5 py-20 sm:px-8">
        <h2 className="font-display text-3xl font-semibold text-navy">The patient holds the key</h2>
        <dl className="mt-8 divide-y divide-line border-y border-line">
          {TERMS.map(([t, d]) => (
            <div key={t} className="grid gap-1 py-5 md:grid-cols-[260px_1fr] md:gap-10">
              <dt className="font-semibold">{t}</dt>
              <dd className="max-w-2xl text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-8 sm:px-8">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xl text-sm text-muted">
              A student project built for a college tech event. It runs on synthetic patients only. It is not a medical device and is not integrated with or certified by ABDM.
            </p>
          </div>
          <Link to="/login"><Button>Explore Demo</Button></Link>
        </div>
      </footer>
    </div>
  );
}
