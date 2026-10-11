import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Search, Sparkles } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { PATIENTS, hospitalById } from '../data/seed';
import { consentState, splitRecords } from '../lib/access';
import { initials } from '../lib/format';
import { EmptyState, PageHeader, StatusBadge, inputClass } from '../components/ui';
import { HospitalTag } from '../components/HospitalTag';
import { RECORD_LABEL } from '../types';

export default function DoctorDashboard() {
  const { user, records, consents, audit } = useStore();
  const [q, setQ] = useState('');
  const results = useMemo(
    () => PATIENTS.filter((p) => (p.name + p.id).toLowerCase().includes(q.trim().toLowerCase())),
    [q],
  );
  if (!user) return null;

  const recentIds = [...new Set(audit.filter((e) => e.actorId === user.id && e.action === 'view_records').map((e) => e.patientId))].slice(0, 3);
  const waiting = consents.filter((c) => c.doctorId === user.id && consentState(c) === 'pending');

  const alerts = PATIENTS.flatMap((p) =>
    splitRecords(records, p.id, user, consents).visible.filter((r) => r.type === 'allergy').map((r) => ({ p, r })),
  );

  return (
    <>
      <PageHeader title="Patients">
        Search by name or MediBridge ID. You can always read records from {hospitalById(user.hospitalId)?.name}. Records from other hospitals need the patient’s consent.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section aria-label="Patient search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for Rahul Sharma or MB-PAT-1001"
              aria-label="Search patients"
              className={`${inputClass} h-12 pl-9`}
            />
          </div>

          <div className="mt-4 divide-y divide-line rounded-md border border-line bg-white">
            {results.length === 0 && <div className="p-4"><EmptyState title="No patient found" body="Check the spelling or try the MediBridge ID, which starts with MB-PAT." /></div>}
            {results.map((p) => {
              const { visible, locked } = splitRecords(records, p.id, user, consents);
              const hospitals = [...new Set([...visible, ...locked].map((r) => r.hospitalId))];
              return (
                <Link key={p.id} to={`/app/patient/${p.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-brand-tint/40">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-navy text-sm font-semibold text-white">{initials(p.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted">{p.id}, {p.age} years, {p.sex}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {hospitals.map((h) => <HospitalTag key={h} id={h} />)}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p>{visible.length} readable</p>
                    {locked.length > 0 && (
                      <StatusBadge tone="warn" icon={<Lock className="size-3" />}>{locked.length} locked</StatusBadge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="space-y-8">
          <section aria-labelledby="alerts">
            <h2 id="alerts" className="mb-2 font-semibold">Allergies you can see</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted">None yet. Allergies recorded at another hospital appear here once you have access.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map(({ p, r }) => (
                  <li key={r.id} className="rounded-md border-l-4 border-bad bg-bad-tint px-3 py-2 text-sm">
                    <span className="font-medium">{p.name}:</span> {r.title}. <span className="text-muted">{hospitalById(r.hospitalId)?.short}, {r.id}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-2 font-semibold">Recently opened</h2>
            {recentIds.length === 0 ? (
              <p className="text-sm text-muted">Patients you open will be listed here.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {recentIds.map((id) => {
                  const p = PATIENTS.find((x) => x.id === id);
                  return p ? <li key={id}><Link className="text-brand-deep underline underline-offset-2" to={`/app/patient/${id}`}>{p.name}</Link></li> : null;
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="req">
            <h2 id="req" className="mb-2 font-semibold">Your requests</h2>
            <p className="text-sm text-muted">
              {waiting.length ? `${waiting.length} waiting for a patient to answer.` : 'No requests waiting.'}{' '}
              <Link className="text-brand-deep underline underline-offset-2" to="/app/consent">See all</Link>
            </p>
            <Link to="/app/assistant" className="mt-4 flex items-start gap-3 rounded-md border border-line bg-white p-4 hover:bg-brand-tint/40">
              <Sparkles className="mt-0.5 size-5 text-brand-deep" aria-hidden />
              <span>
                <span className="block font-medium">Ask the AI assistant</span>
                <span className="block text-sm text-muted">Summarise a patient’s history with links to the source records. Covers {Object.values(RECORD_LABEL).length} record types.</span>
              </span>
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
