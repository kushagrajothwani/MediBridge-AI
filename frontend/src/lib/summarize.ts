import type { MedicalRecord } from '../types';
import { hospitalById } from '../data/seed';
import { fmtDate, fmtMonthYear } from './format';

export type ClaimKind = 'verified' | 'ai' | 'missing' | 'conflict';

export interface Claim {
  text: string;
  kind: ClaimKind;
  sources: string[]; // record ids
}
export interface SummarySection {
  heading: string;
  claims: Claim[];
}
export interface AISummary {
  query: string;
  patientId: string;
  generatedAt: string;
  sections: SummarySection[];
  lockedCount: number;
  usedRecordIds: string[];
}

/**
 * Mock of the multi-agent pipeline so the interface can be built and demoed.
 * It only receives records the viewer is already allowed to read.
 * The real version is POST /api/ai/query (LangGraph). Keep the AISummary shape the same.
 */
export function buildSummary(
  patientId: string,
  query: string,
  visible: MedicalRecord[],
  lockedCount: number,
): AISummary {
  const byDate = [...visible].sort((a, b) => a.date.localeCompare(b.date));
  const where = (r: MedicalRecord) => hospitalById(r.hospitalId)?.short ?? r.hospitalId;
  const sections: SummarySection[] = [];

  // Diagnoses
  const dx = byDate.filter((r) => r.type === 'diagnosis');
  sections.push({
    heading: 'Diagnoses',
    claims: dx.length
      ? dx.map((r) => ({ text: `${r.title}, recorded ${fmtDate(r.date)} at ${where(r)}.`, kind: 'verified', sources: [r.id] }))
      : [{ text: 'No diagnoses are available in the records you can read.', kind: 'missing', sources: [] }],
  });

  // Medications
  const rx = byDate.filter((r) => r.type === 'prescription');
  const medClaims: Claim[] = [];
  rx.forEach((r) =>
    r.medications?.forEach((m) =>
      medClaims.push({ text: `${m.name} ${m.dose}, ${m.frequency}. Prescribed ${fmtDate(r.date)} at ${where(r)}.`, kind: 'verified', sources: [r.id] }),
    ),
  );
  if (rx.length) {
    medClaims.push({ text: 'No record confirms whether the patient is still taking these medicines.', kind: 'missing', sources: [] });
    medClaims.push({ text: 'No stop date is recorded for any listed medicine.', kind: 'missing', sources: [] });
    const noMed = byDate.filter((r) => r.reportsNoMedication);
    if (noMed.length) {
      medClaims.push({
        text: `The latest visit note says the patient takes no regular medicines, but a prescription exists. Ask the patient and check the original documents.`,
        kind: 'conflict',
        sources: [...noMed.map((r) => r.id), ...rx.map((r) => r.id)],
      });
    }
  } else {
    medClaims.push({ text: 'No prescriptions are available in the records you can read.', kind: 'missing', sources: [] });
  }
  sections.push({ heading: 'Medication history', claims: medClaims });

  // Labs: group by test name
  const labClaims: Claim[] = [];
  const tests = new Map<string, { r: MedicalRecord; value: number; unit: string }[]>();
  byDate.filter((r) => r.type === 'lab_report').forEach((r) =>
    r.labs?.forEach((l) => {
      const list = tests.get(l.name) ?? [];
      list.push({ r, value: l.value, unit: l.unit });
      tests.set(l.name, list);
    }),
  );
  tests.forEach((list, name) => {
    if (list.length >= 2) {
      const first = list[0];
      const last = list[list.length - 1];
      const dir = last.value < first.value ? 'decreased' : last.value > first.value ? 'increased' : 'stayed the same';
      labClaims.push({
        text: `${name} was ${first.value} ${first.unit} in ${fmtMonthYear(first.r.date)} and ${last.value} ${last.unit} in ${fmtMonthYear(last.r.date)}. The recorded value ${dir} between the two reports. This is a numerical observation, not a treatment recommendation.`,
        kind: 'ai',
        sources: list.map((x) => x.r.id),
      });
    } else {
      const x = list[0];
      labClaims.push({ text: `${name} was ${x.value} ${x.unit} on ${fmtDate(x.r.date)} (${where(x.r)}).`, kind: 'verified', sources: [x.r.id] });
    }
  });
  if (!labClaims.length) labClaims.push({ text: 'No laboratory reports are available in the records you can read.', kind: 'missing', sources: [] });
  sections.push({ heading: 'Laboratory results', claims: labClaims });

  // Allergies
  const al = byDate.filter((r) => r.type === 'allergy');
  sections.push({
    heading: 'Allergies',
    claims: al.length
      ? al.map((r) => ({ text: `${r.title}. ${r.summary}`, kind: 'verified', sources: [r.id] }))
      : [{ text: 'No allergy information is available to you. This does not mean the patient has no allergies.', kind: 'missing', sources: [] }],
  });

  // Visits
  const visits = byDate.filter((r) => r.type === 'encounter').slice(-2).reverse();
  if (visits.length) {
    sections.push({
      heading: 'Recent visits',
      claims: visits.map((r) => ({ text: `${fmtDate(r.date)}, ${where(r)}: ${r.title}. ${r.summary}`, kind: 'verified', sources: [r.id] })),
    });
  }

  if (lockedCount > 0) {
    sections.push({
      heading: 'Not included',
      claims: [{ text: `${lockedCount} record${lockedCount === 1 ? '' : 's'} held by another hospital ${lockedCount === 1 ? 'was' : 'were'} left out because the patient has not given consent.`, kind: 'missing', sources: [] }],
    });
  }

  return {
    query,
    patientId,
    generatedAt: new Date().toISOString(),
    sections,
    lockedCount,
    usedRecordIds: byDate.map((r) => r.id),
  };
}
