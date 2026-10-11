import { useMemo, useState } from 'react';
import { useStore } from '../store/AppStore';
import { ACTION_LABEL, ACTION_TONE } from '../lib/audit';
import { fmtDateTime } from '../lib/format';
import { EmptyState, PageHeader, StatusBadge, inputClass } from '../components/ui';
import { HospitalTag } from '../components/HospitalTag';
import { patientById } from '../data/seed';
import type { AuditAction } from '../types';

export default function AuditPage() {
  const { user, audit } = useStore();
  const [action, setAction] = useState<'all' | AuditAction>('all');
  const [q, setQ] = useState('');

  const scoped = useMemo(() => {
    if (!user) return [];
    if (user.role === 'patient') return audit.filter((e) => e.patientId === user.patientId);
    if (user.role === 'doctor') return audit.filter((e) => e.actorId === user.id);
    return audit.filter((e) => e.actorHospitalId === user.hospitalId);
  }, [audit, user]);

  const rows = scoped.filter(
    (e) =>
      (action === 'all' || e.action === action) &&
      (e.actorName + e.resource + (e.reason ?? '')).toLowerCase().includes(q.toLowerCase()),
  );
  if (!user) return null;
  const isPatient = user.role === 'patient';

  return (
    <>
      <PageHeader title={isPatient ? 'Access history' : 'Audit log'}>
        {isPatient ? 'Everything that has happened to your records, newest first.' : user.role === 'doctor' ? 'Your own actions on patient records.' : 'Actions taken by people at your hospital.'}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person, record or reason" aria-label="Search the log" className={`${inputClass} max-w-sm`} />
        <select value={action} onChange={(e) => setAction(e.target.value as 'all' | AuditAction)} aria-label="Filter by action" className={`${inputClass} max-w-[14rem]`}>
          <option value="all">All actions</option>
          {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No matching events" body="Try a different search or clear the action filter." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-4 py-2.5 font-medium">When</th><th className="font-medium">Who</th><th className="font-medium">Patient</th>
                <th className="font-medium">Action</th><th className="font-medium">Record</th><th className="font-medium">Reason</th><th className="pr-4 font-medium">Consent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5">{fmtDateTime(e.at)}</td>
                  <td><p className="font-medium">{e.actorName}</p>{e.actorHospitalId && <HospitalTag id={e.actorHospitalId} />}</td>
                  <td>{patientById(e.patientId)?.name}</td>
                  <td><StatusBadge tone={ACTION_TONE[e.action]}>{ACTION_LABEL[e.action]}</StatusBadge></td>
                  <td className="text-muted">{e.resource}</td>
                  <td className="max-w-[16rem] text-muted">{e.reason ?? 'None given'}</td>
                  <td className="pr-4 text-muted">{e.consent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
