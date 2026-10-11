import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { HOSPITALS, hospitalById } from '../data/seed';
import { consentState, isActive } from '../lib/access';
import { sentence } from '../lib/audit';
import { fmtDate, fmtDateTime, timeLeft } from '../lib/format';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { HospitalTag } from '../components/HospitalTag';

export default function PatientDashboard() {
  const { user, records, consents, audit } = useStore();
  if (!user?.patientId) return null;
  const mine = records.filter((r) => r.patientId === user.patientId);
  const myConsents = consents.filter((c) => c.patientId === user.patientId);
  const pending = myConsents.filter((c) => consentState(c) === 'pending');
  const active = myConsents.filter((c) => isActive(c));
  const emergency = active.filter((c) => c.kind === 'emergency');
  const activity = audit.filter((e) => e.patientId === user.patientId && e.actorId !== user.id).slice(0, 5);
  const hospitalsWithRecords = HOSPITALS.filter((h) => mine.some((r) => r.hospitalId === h.id));

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`}>
        {mine.length} records across {hospitalsWithRecords.length} hospitals.{' '}
        {pending.length > 0 ? `${pending.length} request${pending.length === 1 ? ' is' : 's are'} waiting for your answer.` : 'Nothing is waiting for you.'}
      </PageHeader>

      {emergency.length > 0 && (
        <div role="alert" className="mb-6 flex gap-3 rounded-md border border-bad/40 bg-bad-tint p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-bad">Emergency access was used on your records</p>
            {emergency.map((c) => (
              <p key={c.id} className="mt-1">{c.doctorName} at {hospitalById(c.hospitalId)?.short}, {fmtDateTime(c.requestedAt)}. Reason: {c.reason} ({timeLeft(c.expiresAt!)}.)</p>
            ))}
            <Link to="/app/consent" className="mt-2 inline-block font-medium text-bad underline underline-offset-2">Review and revoke</Link>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <section className="mb-8 rounded-md border-l-4 border-warn bg-warn-tint p-5" aria-labelledby="pend">
          <h2 id="pend" className="font-semibold">Waiting for your answer</h2>
          <ul className="mt-2 space-y-1.5">
            {pending.map((c) => (
              <li key={c.id}>{c.doctorName} at {hospitalById(c.hospitalId)?.name} wants to read your records. <span className="text-muted">“{c.reason}”</span></li>
            ))}
          </ul>
          <Link to="/app/consent" className="mt-4 inline-block"><Button>Review requests</Button></Link>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="hosp">
          <h2 id="hosp" className="mb-3 text-lg font-semibold">Your hospitals</h2>
          <div className="divide-y divide-line rounded-md border border-line bg-white">
            {hospitalsWithRecords.map((h) => {
              const list = mine.filter((r) => r.hospitalId === h.id);
              const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];
              return (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <div>
                    <HospitalTag id={h.id} long />
                    <p className="mt-0.5 text-sm text-muted">{list.length} records, latest {fmtDate(latest.date)}</p>
                  </div>
                  <Link to={`/app/patient/${user.patientId}`} className="text-sm font-medium text-brand-deep underline underline-offset-2">Open records</Link>
                </div>
              );
            })}
          </div>

          <h2 className="mb-3 mt-8 text-lg font-semibold">Who can read them now</h2>
          {active.length === 0 ? (
            <EmptyState title="No one has outside access" body="Doctors at other hospitals can only read your records after you say yes." />
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line bg-white">
              {active.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <p className="font-medium">{c.doctorName} <span className="font-normal text-muted">at {hospitalById(c.hospitalId)?.short}</span></p>
                  <p className="text-sm text-muted">{timeLeft(c.expiresAt!)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="act">
          <h2 id="act" className="mb-3 text-lg font-semibold">Recent activity on your records</h2>
          {activity.length === 0 ? (
            <EmptyState title="No activity yet" body="When someone reads or asks for your records it shows up here." />
          ) : (
            <ol className="space-y-4 border-l border-line pl-4">
              {activity.map((e) => (
                <li key={e.id}>
                  <p className="text-sm">{sentence(e, hospitalById(e.actorHospitalId)?.short ?? '')}</p>
                  <p className="text-xs text-muted">{fmtDateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          )}
          <Link to="/app/audit" className="mt-4 inline-block text-sm font-medium text-brand-deep underline underline-offset-2">See full access history</Link>
        </section>
      </div>
    </>
  );
}
