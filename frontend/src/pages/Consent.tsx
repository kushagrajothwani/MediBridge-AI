import { useState } from 'react';
import { useStore } from '../store/AppStore';
import { consentState } from '../lib/access';
import { EmptyState, PageHeader } from '../components/ui';
import ConsentCard from '../components/ConsentCard';
import { GrantModal } from '../components/AccessModals';
import type { Consent } from '../types';

export default function ConsentPage() {
  const { user, consents, respondToConsent, revokeConsent } = useStore();
  const [granting, setGranting] = useState<Consent | null>(null);
  if (!user) return null;
  const isPatient = user.role === 'patient';
  const list = consents.filter((c) => (isPatient ? c.patientId === user.patientId : c.doctorId === user.id));
  const pending = list.filter((c) => consentState(c) === 'pending');
  const active = list.filter((c) => consentState(c) === 'active');
  const past = list.filter((c) => !['pending', 'active'].includes(consentState(c)));

  const group = (title: string, items: Consent[], empty: string) => (
    <section className="mb-10" aria-label={title}>
      <h2 className="mb-3 text-lg font-semibold">{title} <span className="font-normal text-muted">({items.length})</span></h2>
      {items.length === 0 ? <EmptyState title={empty} body={isPatient ? 'Nothing to do here right now.' : 'Open a patient and choose Ask for access to start a request.'} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => (
            <ConsentCard
              key={c.id}
              consent={c}
              as={isPatient ? 'patient' : 'doctor'}
              onGrant={() => setGranting(c)}
              onReject={() => respondToConsent(c.id, false)}
              onRevoke={() => revokeConsent(c.id)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <PageHeader title={isPatient ? 'Who can see my records' : 'Access requests'}>
        {isPatient
          ? 'Doctors at other hospitals can read your records only after you say yes. You choose what they see and for how long.'
          : 'Requests you have sent to patients, and the access you were given.'}
      </PageHeader>
      {group(isPatient ? 'Waiting for your answer' : 'Waiting for the patient', pending, 'No requests waiting')}
      {group('Access in effect', active, 'No active access')}
      {past.length > 0 && group('Past requests', past, 'Nothing here')}

      <GrantModal
        consent={granting}
        onClose={() => setGranting(null)}
        onGrant={(scope, days) => { if (granting) respondToConsent(granting.id, true, { scope, days }); setGranting(null); }}
      />
    </>
  );
}
