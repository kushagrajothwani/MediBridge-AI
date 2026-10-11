import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { MedicalRecord } from '../types';
import { RECORD_LABEL } from '../types';
import { hospitalById } from '../data/seed';
import { fmtDate, fmtDateTime } from '../lib/format';
import { Button, Drawer, StatusBadge } from './ui';
import { HospitalTag } from './HospitalTag';

export default function RecordDrawer({ record, onClose }: { record: MedicalRecord | null; onClose: () => void }) {
  const [showOriginal, setShowOriginal] = useState(false);
  if (!record) return null;
  const p = record.provenance;
  const aiExtracted = p.extraction.startsWith('OCR');
  const hospital = hospitalById(record.hospitalId);

  const rows: [string, React.ReactNode][] = [
    ['Original hospital', hospital?.name],
    ['Record ID', record.id],
    ['Record type', RECORD_LABEL[record.type]],
    ['Record date', fmtDate(record.date)],
    ['Uploaded', fmtDateTime(p.uploadedAt)],
    ['How it was entered', aiExtracted ? 'Read from a document by OCR' : p.extraction === 'Structured upload' ? 'Sent by the hospital system' : 'Typed in by hospital staff'],
    ['Extraction method', p.extraction],
    [
      'Verification',
      <StatusBadge tone={p.verification === 'reviewed' ? 'ok' : 'warn'}>
        {p.verification === 'reviewed' ? 'Reviewed by hospital staff' : p.verification === 'pending' ? 'Waiting for review' : 'Not verified'}
      </StatusBadge>,
    ],
  ];

  return (
    <Drawer open onClose={() => { setShowOriginal(false); onClose(); }} title={record.id}>
      <HospitalTag id={record.hospitalId} long />
      <h2 className="mt-2 font-display text-2xl font-semibold leading-snug">{record.title}</h2>
      <p className="mt-3">{record.summary}</p>

      {record.medications && (
        <table className="mt-5 w-full text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-medium">Medicine</th><th className="font-medium">Dose</th><th className="font-medium">How often</th></tr></thead>
          <tbody>
            {record.medications.map((m) => (
              <tr key={m.name} className="border-b border-line"><td className="py-2 font-medium">{m.name}</td><td>{m.dose}</td><td>{m.frequency}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      {record.labs && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-medium">Test</th><th className="font-medium">Result</th><th className="font-medium">Reference range</th><th className="font-medium">Status</th></tr></thead>
            <tbody>
              {record.labs.map((l) => {
                const out = l.value > l.refHigh || l.value < l.refLow;
                return (
                  <tr key={l.name} className="border-b border-line">
                    <td className="py-2 font-medium">{l.name}</td>
                    <td>{l.value} {l.unit}</td>
                    <td className="text-muted">{l.refLow} to {l.refHigh} {l.unit}</td>
                    <td><StatusBadge tone={out ? 'warn' : 'ok'}>{out ? 'Outside range' : 'In range'}</StatusBadge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-7 rounded-md border border-line bg-paper p-4" aria-labelledby="prov">
        <h3 id="prov" className="font-medium">Where this record came from</h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {aiExtracted && (
          <p className="mt-3 text-sm text-warn">Text read from scans can contain mistakes. Check the original before relying on it.</p>
        )}
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowOriginal((v) => !v)}>
          <FileText className="size-4" /> {showOriginal ? 'Hide original document' : 'View original document'}
        </Button>
        {showOriginal && (
          <div className="mt-3 rounded border border-line bg-white p-4 font-mono text-xs leading-relaxed text-muted">
            <p className="mb-2 font-sans text-sm font-medium text-ink">{p.fileName}</p>
            <p>{hospital?.name}</p>
            <p>Patient: {record.patientId}</p>
            <p>Date: {fmtDate(record.date)}</p>
            <p className="mt-2">{record.summary}</p>
            <p className="mt-3 text-[11px]">Sample preview. The real viewer will load the uploaded file from the backend.</p>
          </div>
        )}
      </section>
    </Drawer>
  );
}
