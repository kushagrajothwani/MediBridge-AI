import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Consent, RecordType } from '../types';
import { RECORD_LABEL, RECORD_TYPES } from '../types';
import { Button, Field, Modal, inputClass } from './ui';

function ScopePicker({ value, onChange, options }: { value: RecordType[]; onChange: (v: RecordType[]) => void; options: RecordType[] }) {
  const toggle = (t: RecordType) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Record types</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((t) => (
          <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${value.includes(t) ? 'border-brand bg-brand-tint' : 'border-line bg-white'}`}>
            <input type="checkbox" className="accent-[#0f766e]" checked={value.includes(t)} onChange={() => toggle(t)} />
            {RECORD_LABEL[t]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RequestAccessModal({ open, onClose, patientName, hospitalName, available, onSubmit }: {
  open: boolean; onClose: () => void; patientName: string; hospitalName: string;
  available: RecordType[]; onSubmit: (scope: RecordType[], reason: string) => void;
}) {
  const [scope, setScope] = useState<RecordType[]>(available);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonError = touched && reason.trim().length < 10 ? 'Write at least 10 characters so the patient knows why you need this.' : undefined;
  const scopeError = touched && scope.length === 0 ? 'Choose at least one record type.' : undefined;
  const submit = () => {
    setTouched(true);
    if (reason.trim().length < 10 || scope.length === 0) return;
    onSubmit(scope, reason.trim());
    setReason('');
    setTouched(false);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ask ${patientName} for access`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Send request</Button></>}
    >
      <p className="mb-4 text-sm text-muted">
        {patientName} will see your name, {hospitalName} and the reason below. Access ends automatically on the date they choose.
      </p>
      <div className="space-y-4">
        <ScopePicker value={scope} onChange={setScope} options={available.length ? available : RECORD_TYPES} />
        {scopeError && <p className="text-xs text-bad" role="alert">{scopeError}</p>}
        <Field label="Why do you need these records?" htmlFor="reason" error={reasonError}>
          <textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} h-auto py-2`} placeholder="For example: patient has high blood sugar and I need his earlier results." />
        </Field>
      </div>
    </Modal>
  );
}

export function EmergencyModal({ open, onClose, patientName, onConfirm }: {
  open: boolean; onClose: () => void; patientName: string; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const error = touched && reason.trim().length < 15 ? 'Describe the emergency in at least 15 characters.' : undefined;
  const confirm = () => {
    setTouched(true);
    if (reason.trim().length < 15) return;
    onConfirm(reason.trim());
    setReason('');
    setTouched(false);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Emergency access"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={confirm} className="bg-bad hover:bg-[#971c12]">Open records for 24 hours</Button></>}
    >
      <div className="mb-4 flex gap-3 rounded-md bg-bad-tint p-3 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
        <p>
          Use this only when {patientName} cannot give consent now. You will see allergies, diagnoses and prescriptions only.
          The patient and the hospital audit log will see that you did this, and why.
        </p>
      </div>
      <Field label="What is the emergency?" htmlFor="why" error={error}>
        <textarea id="why" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} h-auto py-2`} placeholder="For example: patient arrived unconscious, need allergy and medicine history before treatment." />
      </Field>
    </Modal>
  );
}

export function GrantModal({ consent, onClose, onGrant }: {
  consent: Consent | null; onClose: () => void; onGrant: (scope: RecordType[], days: number) => void;
}) {
  const [scope, setScope] = useState<RecordType[] | null>(null);
  const [days, setDays] = useState(7);
  if (!consent) return null;
  const current = scope ?? consent.scope;
  return (
    <Modal
      open
      onClose={() => { setScope(null); onClose(); }}
      title={`Let ${consent.doctorName} see your records?`}
      footer={
        <>
          <Button variant="secondary" onClick={() => { setScope(null); onClose(); }}>Cancel</Button>
          <Button disabled={current.length === 0} onClick={() => { onGrant(current, days); setScope(null); }}>Grant access</Button>
        </>
      }
    >
      <p className="mb-1 text-sm"><span className="text-muted">Reason given: </span>{consent.reason}</p>
      <p className="mb-4 text-sm text-muted">You can remove record types they asked for. You can revoke access at any time.</p>
      <div className="space-y-4">
        <ScopePicker value={current} onChange={setScope} options={consent.scope} />
        <Field label="Access lasts" htmlFor="days">
          <select id="days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass}>
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}
