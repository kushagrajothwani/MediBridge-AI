import { ShieldAlert } from 'lucide-react';
import type { Consent } from '../types';
import { RECORD_LABEL } from '../types';
import { consentState } from '../lib/access';
import { fmtDateTime, timeLeft } from '../lib/format';
import { Button, StatusBadge } from './ui';
import { HospitalTag } from './HospitalTag';
import { patientById } from '../data/seed';

const BADGE = {
  pending: { tone: 'warn', label: 'Waiting for the patient' },
  active: { tone: 'ok', label: 'Active' },
  rejected: { tone: 'neutral', label: 'Declined' },
  revoked: { tone: 'neutral', label: 'Revoked' },
  expired: { tone: 'neutral', label: 'Expired' },
} as const;

export default function ConsentCard({
  consent, as, onGrant, onReject, onRevoke,
}: {
  consent: Consent;
  as: 'patient' | 'doctor';
  onGrant?: () => void;
  onReject?: () => void;
  onRevoke?: () => void;
}) {
  const state = consentState(consent);
  const b = BADGE[state];
  const emergency = consent.kind === 'emergency';
  return (
    <article className={`rounded-md border bg-white p-4 ${emergency ? 'border-bad/40' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {as === 'patient' ? consent.doctorName : patientById(consent.patientId)?.name}
          </p>
          <div className="mt-0.5"><HospitalTag id={consent.hospitalId} long /></div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {emergency && <StatusBadge tone="bad" icon={<ShieldAlert className="size-3.5" />}>Emergency access</StatusBadge>}
          <StatusBadge tone={b.tone}>{state === 'pending' && as === 'doctor' ? 'Waiting for the patient' : state === 'pending' ? 'Needs your answer' : b.label}</StatusBadge>
        </div>
      </div>

      <p className="mt-3 text-sm"><span className="text-muted">Reason given: </span>{consent.reason}</p>

      <p className="mt-3 flex flex-wrap gap-1.5" aria-label="Record types">
        {consent.scope.map((s) => (
          <span key={s} className="rounded border border-line bg-paper px-2 py-0.5 text-xs">{RECORD_LABEL[s]}</span>
        ))}
      </p>

      <p className="mt-3 text-xs text-muted">
        Asked {fmtDateTime(consent.requestedAt)}
        {consent.expiresAt && state === 'active' && `. ${timeLeft(consent.expiresAt)}, ends ${fmtDateTime(consent.expiresAt)}`}
        {consent.expiresAt && state === 'expired' && `. Ended ${fmtDateTime(consent.expiresAt)}`}
      </p>

      {as === 'patient' && state === 'pending' && (
        <div className="mt-4 flex gap-2">
          <Button onClick={onGrant}>Review and grant</Button>
          <Button variant="secondary" onClick={onReject}>Decline</Button>
        </div>
      )}
      {as === 'patient' && state === 'active' && (
        <div className="mt-4"><Button variant="danger" size="sm" onClick={onRevoke}>Revoke access</Button></div>
      )}
    </article>
  );
}
