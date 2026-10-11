import type { MedicalRecord } from '../types';
import { hospitalById } from '../data/seed';

const ddmmyyyy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** What a hospital's own system might export. Different hospitals use different shapes. */
export function legacyPayload(r: MedicalRecord): Record<string, unknown> {
  if (r.type === 'lab_report' && r.labs) {
    return {
      PT_NO: r.patientId,
      RPT_DT: ddmmyyyy(r.date),
      RPT_ID: r.id,
      RESULTS: r.labs.map((l) => ({ TEST: l.name.toUpperCase(), RESULT: String(l.value), UNIT: l.unit, REF: `${l.refLow}-${l.refHigh}` })),
    };
  }
  if (r.type === 'prescription' && r.medications) {
    return {
      PT_NO: r.patientId,
      RX_DT: ddmmyyyy(r.date),
      RX_ID: r.id,
      ITEMS: r.medications.map((m) => ({ DRUG: m.name, STRENGTH: m.dose, SIG: m.frequency })),
    };
  }
  return { PT_NO: r.patientId, ENTRY_DT: ddmmyyyy(r.date), ENTRY_ID: r.id, NOTE_TYPE: r.type.toUpperCase(), NOTE_TEXT: r.summary };
}

/**
 * A simplified, FHIR-inspired version of the record.
 * It follows FHIR R4 resource names and fields but is not validated against the full specification.
 */
export function toFhir(r: MedicalRecord): Record<string, unknown> {
  const hospital = hospitalById(r.hospitalId);
  const base = {
    id: r.id,
    subject: { reference: `Patient/${r.patientId}` },
    meta: {
      source: hospital?.name,
      tag: [{ system: 'medibridge/extraction', code: r.provenance.extraction }, { system: 'medibridge/verification', code: r.provenance.verification }],
    },
  };
  switch (r.type) {
    case 'lab_report':
      return {
        resourceType: 'DiagnosticReport',
        ...base,
        status: 'final',
        code: { text: r.title },
        effectiveDateTime: r.date,
        contained: (r.labs ?? []).map((l, i) => ({
          resourceType: 'Observation',
          id: `obs-${i + 1}`,
          status: 'final',
          code: { text: l.name },
          valueQuantity: { value: l.value, unit: l.unit },
          referenceRange: [{ low: { value: l.refLow }, high: { value: l.refHigh } }],
        })),
      };
    case 'prescription':
      return {
        resourceType: 'MedicationRequest',
        ...base,
        status: 'active',
        intent: 'order',
        authoredOn: r.date,
        medicationCodeableConcept: { text: r.medications?.map((m) => `${m.name} ${m.dose}`).join(', ') },
        dosageInstruction: (r.medications ?? []).map((m) => ({ text: m.frequency })),
      };
    case 'allergy':
      return {
        resourceType: 'AllergyIntolerance',
        id: r.id,
        patient: { reference: `Patient/${r.patientId}` },
        meta: base.meta,
        clinicalStatus: { coding: [{ code: 'active' }] },
        code: { text: r.title },
        recordedDate: r.date,
        note: [{ text: r.summary }],
      };
    case 'diagnosis':
      return {
        resourceType: 'Condition',
        ...base,
        clinicalStatus: { coding: [{ code: 'active' }] },
        code: { text: r.title },
        recordedDate: r.date,
        note: [{ text: r.summary }],
      };
    case 'encounter':
      return {
        resourceType: 'Encounter',
        ...base,
        status: 'finished',
        class: { code: 'AMB' },
        period: { start: r.date },
        reasonCode: [{ text: r.title }],
      };
    default:
      return {
        resourceType: 'DocumentReference',
        ...base,
        status: 'current',
        date: r.date,
        description: r.title,
      };
  }
}
