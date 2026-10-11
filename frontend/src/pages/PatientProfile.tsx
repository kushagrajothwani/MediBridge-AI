import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { hospitalById, patientById } from '../data/seed';
import { consentState, isActive, splitRecords } from '../lib/access';
import { fmtDate, fmtDateTime, initials, timeLeft } from '../lib/format';
import { Button, EmptyState, ErrorState, Modal, PageHeader, StatusBadge } from '../components/ui';
import { HospitalTag } from '../components/HospitalTag';
import Timeline from '../components/Timeline';
import RecordDrawer from '../components/RecordDrawer';
import LabChart from '../components/LabChart';
import { EmergencyModal, RequestAccessModal } from '../components/AccessModals';
import type { MedicalRecord, RecordType } from '../types';
import { RECORD_LABEL } from '../types';

const TABS = ['Timeline', 'Conditions and medicines', 'Lab trends', 'Documents'] as const;
type Tab = (typeof TABS)[number];

export default function PatientProfile() {
  const { id } = useParams();
  const { user, records, consents, requestConsent, emergencyAccess, logView, logDenied } = useStore();
  const [tab, setTab] = useState<Tab>('Timeline');
  const [open, setOpen] = useState<MedicalRecord | null>(null);
  const [lockedHit, setLockedHit] = useState<MedicalRecord | null>(null);
  const [asking, setAsking] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [sent, setSent] = useState(false);

  const patient = patientById(id);

  useEffect(() => {
    if (user && patient) logView(user, patient.id);
    // log once per patient opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, patient?.id]);

  if (!user) return null;
  if (!patient) return <ErrorState title="Patient not found" body="No patient has that ID. Go back to the patient list and search again." action={<Link to="/app" className="underline">Back to patients</Link>} />;
  if (user.role === 'patient' && user.patientId !== patient.id) return <ErrorState title="You can only open your own records" body="Patients can see their own records only." />;
  if (user.role === 'hospital_admin') return <ErrorState title="Admins do not open patient charts" body="Hospital admins upload and review records from the hospital page." action={<Link to="/app" className="underline">Back to hospital records</Link>} />;

  const { visible, locked } = splitRecords(records, patient.id, user, consents);
  const isDoctor = user.role === 'doctor';
  const mine = consents.filter((c) => c.patientId === patient.id && c.doctorId === user.id);
  const pendingReq = mine.find((c) => consentState(c) === 'pending');
  const liveReq = mine.find((c) => isActive(c));
  const lockedHospitals = [...new Set(locked.map((r) => r.hospitalId))];
  const lockedTypes = [...new Set(locked.map((r) => r.type))] as RecordType[];

  const conditions = visible.filter((r) => r.type === 'diagnosis');
  const allergies = visible.filter((r) => r.type === 'allergy');
  const meds = visible.filter((r) => r.type === 'prescription');
  const labs = visible.filter((r) => r.type === 'lab_report');

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-lg bg-navy font-display text-2xl font-semibold text-white">{initials(patient.name)}</span>
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight">{patient.name}</h1>
            <p className="text-muted">{patient.id}, {patient.age} years, {patient.sex}, blood group {patient.bloodGroup}</p>
            <p className="mt-1 text-xs text-muted">Synthetic patient</p>
          </div>
        </div>
        {isDoctor && (
          <Link to={`/app/assistant?patient=${patient.id}`}><Button variant="secondary"><Sparkles className="size-4" /> Summarise with AI</Button></Link>
        )}
      </div>

      {isDoctor && locked.length > 0 && (
        <section className="mb-6 rounded-md border-l-4 border-warn bg-warn-tint p-4" aria-label="Locked records">
          <div className="flex gap-3">
            <Lock className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
            <div className="flex-1">
              <p className="font-medium">{locked.length} record{locked.length === 1 ? '' : 's'} from {lockedHospitals.map((h) => hospitalById(h)?.short).join(' and ')} are locked</p>
              <p className="text-sm text-ink/80">You can see that they exist. {patient.name.split(' ')[0]} has to agree before you can read them.</p>
              {sent || pendingReq ? (
                <p className="mt-3 text-sm font-medium text-warn">Request sent. Waiting for {patient.name.split(' ')[0]} to answer.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setAsking(true)}><ShieldCheck className="size-4" /> Ask for access</Button>
                  <Button variant="danger" onClick={() => setEmergency(true)}><ShieldAlert className="size-4" /> Emergency access</Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {isDoctor && liveReq && (
        <section className={`mb-6 rounded-md p-4 text-sm ${liveReq.kind === 'emergency' ? 'bg-bad-tint' : 'bg-ok-tint'}`}>
          <p className="font-medium">{liveReq.kind === 'emergency' ? 'Emergency access is open' : 'Access granted by the patient'}</p>
          <p>{timeLeft(liveReq.expiresAt!)}, ends {fmtDateTime(liveReq.expiresAt!)}. Record types: {liveReq.scope.map((s) => RECORD_LABEL[s]).join(', ')}.</p>
        </section>
      )}

      <div role="tablist" aria-label="Record views" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Timeline' && (
        visible.length + locked.length === 0 ? (
          <EmptyState title="No records yet" body="Records appear here after a hospital uploads them." />
        ) : (
          <Timeline records={visible} locked={locked} onOpen={setOpen} onOpenLocked={(r) => { setLockedHit(r); logDenied(user, r); }} />
        )
      )}

      {tab === 'Conditions and medicines' && (
        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="mb-2 font-semibold">Diagnoses</h2>
            <RecordList items={conditions} empty="No diagnoses available to you." onOpen={setOpen} />
            <h2 className="mb-2 mt-6 font-semibold">Allergies</h2>
            <RecordList items={allergies} empty="No allergies available to you. That does not mean there are none." onOpen={setOpen} />
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Medicine history</h2>
            {meds.length === 0 ? <p className="text-sm text-muted">No prescriptions available to you.</p> : (
              <div className="overflow-x-auto rounded-md border border-line bg-white">
                <table className="w-full min-w-[420px] text-sm">
                  <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-2 font-medium">Medicine</th><th className="font-medium">Dose</th><th className="font-medium">Prescribed</th><th className="pr-4 font-medium">Source</th></tr></thead>
                  <tbody>
                    {meds.flatMap((r) => (r.medications ?? []).map((m) => (
                      <tr key={r.id + m.name} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 font-medium">{m.name}</td>
                        <td>{m.dose}, {m.frequency}</td>
                        <td>{fmtDate(r.date)}</td>
                        <td className="pr-4"><button className="text-brand-deep underline underline-offset-2" onClick={() => setOpen(r)}>{r.id}</button></td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-sm text-muted">The list shows what was prescribed. It does not confirm what the patient takes today.</p>
          </section>
        </div>
      )}

      {tab === 'Lab trends' && <LabChart records={labs} onOpen={setOpen} />}

      {tab === 'Documents' && (
        <div className="overflow-x-auto rounded-md border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-2 font-medium">Record</th><th className="font-medium">Type</th><th className="font-medium">Hospital</th><th className="font-medium">Entered</th><th className="pr-4 font-medium">Review</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-2"><button className="text-left font-medium text-brand-deep underline underline-offset-2" onClick={() => setOpen(r)}>{r.id}</button></td>
                  <td>{RECORD_LABEL[r.type]}</td>
                  <td><HospitalTag id={r.hospitalId} /></td>
                  <td className="text-muted">{r.provenance.extraction}</td>
                  <td className="pr-4"><StatusBadge tone={r.provenance.verification === 'reviewed' ? 'ok' : 'warn'}>{r.provenance.verification === 'reviewed' ? 'Reviewed' : 'Not reviewed'}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordDrawer record={open} onClose={() => setOpen(null)} />

      <Modal
        open={!!lockedHit}
        onClose={() => setLockedHit(null)}
        title="This record is locked"
        footer={<>
          <Button variant="secondary" onClick={() => setLockedHit(null)}>Close</Button>
          {isDoctor && !pendingReq && <Button onClick={() => { setLockedHit(null); setAsking(true); }}>Ask for access</Button>}
        </>}
      >
        <p>
          {lockedHit && `${RECORD_LABEL[lockedHit.type]} from ${hospitalById(lockedHit.hospitalId)?.name}, ${fmtDate(lockedHit.date)}.`} Being able to find a record is not the same as being allowed to read it.
        </p>
        <p className="mt-2 text-sm text-muted">This attempt has been written to the audit log.</p>
      </Modal>

      {isDoctor && (
        <>
          <RequestAccessModal
            open={asking}
            onClose={() => setAsking(false)}
            patientName={patient.name}
            hospitalName={hospitalById(user.hospitalId)?.name ?? ''}
            available={lockedTypes}
            onSubmit={(scope, reason) => { requestConsent(user, patient.id, scope, reason); setAsking(false); setSent(true); }}
          />
          <EmergencyModal
            open={emergency}
            onClose={() => setEmergency(false)}
            patientName={patient.name}
            onConfirm={(reason) => { emergencyAccess(user, patient.id, reason); setEmergency(false); }}
          />
        </>
      )}
    </>
  );
}

function RecordList({ items, empty, onOpen }: { items: MedicalRecord[]; empty: string; onOpen: (r: MedicalRecord) => void }) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line rounded-md border border-line bg-white">
      {items.map((r) => (
        <li key={r.id}>
          <button onClick={() => onOpen(r)} className="w-full px-4 py-3 text-left hover:bg-brand-tint/40">
            <span className="block font-medium">{r.title}</span>
            <span className="block text-sm text-muted">{r.summary}</span>
            <span className="mt-1 flex items-center gap-3 text-xs text-muted"><HospitalTag id={r.hospitalId} /> {fmtDate(r.date)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
