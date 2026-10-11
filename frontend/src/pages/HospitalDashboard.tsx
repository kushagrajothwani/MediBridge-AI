import { useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { PATIENTS, hospitalById } from '../data/seed';
import { fmtDate } from '../lib/format';
import { Button, ErrorState, Field, PageHeader, StatusBadge, inputClass } from '../components/ui';
import { RECORD_LABEL, RECORD_TYPES, type RecordType } from '../types';
import RecordDrawer from '../components/RecordDrawer';
import type { MedicalRecord } from '../types';

const MAX_MB = 10;
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg'];

type Stage = 'choose' | 'reading' | 'review';

export default function HospitalDashboard() {
  const { user, records, addRecord } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [patientId, setPatientId] = useState(PATIENTS[0].id);
  const [type, setType] = useState<RecordType>('lab_report');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saved, setSaved] = useState('');
  const [open, setOpen] = useState<MedicalRecord | null>(null);
  if (!user?.hospitalId) return null;
  const hospital = hospitalById(user.hospitalId)!;
  const own = records.filter((r) => r.hospitalId === hospital.id).sort((a, b) => b.date.localeCompare(a.date));

  function accept(f: File | undefined) {
    setSaved('');
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return setError('This file type is not supported. Upload a PDF, PNG or JPG.');
    if (f.size > MAX_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_MB} MB. Compress it or split it and try again.`);
    setError('');
    setFile(f);
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); };

  function extract() {
    setStage('reading');
    // Stand-in for the OCR + document classification pipeline.
    setTimeout(() => {
      setTitle(type === 'lab_report' ? 'Blood report' : type === 'prescription' ? 'Prescription' : RECORD_LABEL[type]);
      setSummary('Text read from the document appears here. Check it against the original file, fix any mistakes, then save.');
      setStage('review');
    }, 1400);
  }

  function save() {
    if (!file || title.trim().length < 3) return setError('Give the record a title of at least 3 characters.');
    const id = addRecord(user!, {
      patientId, hospitalId: hospital.id, type, title: title.trim(), date, summary: summary.trim(),
      provenance: { extraction: 'OCR + manual review', verification: 'reviewed', uploadedAt: new Date().toISOString(), fileName: file.name },
    });
    setSaved(id); setStage('choose'); setFile(null); setTitle(''); setSummary(''); setError('');
  }

  return (
    <>
      <PageHeader title={hospital.name}>
        {own.length} records are held here. Upload a document, check what the system read, then save it to the patient’s record.
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section aria-labelledby="up">
          <h2 id="up" className="mb-3 text-lg font-semibold">Add a record</h2>
          <div className="space-y-4 rounded-md border border-line bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Patient" htmlFor="pt">
                <select id="pt" value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass} disabled={stage !== 'choose'}>
                  {PATIENTS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                </select>
              </Field>
              <Field label="Record type" htmlFor="ty">
                <select id="ty" value={type} onChange={(e) => setType(e.target.value as RecordType)} className={inputClass} disabled={stage !== 'choose'}>
                  {RECORD_TYPES.map((t) => <option key={t} value={t}>{RECORD_LABEL[t]}</option>)}
                </select>
              </Field>
            </div>

            {stage === 'choose' && (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={onDrop}
                  className={`rounded-md border-2 border-dashed px-4 py-8 text-center ${drag ? 'border-brand bg-brand-tint' : 'border-line'}`}
                >
                  <FileUp className="mx-auto size-7 text-muted" aria-hidden />
                  {file ? (
                    <p className="mt-2 font-medium">{file.name} <span className="font-normal text-muted">({(file.size / 1024).toFixed(0)} KB)</span></p>
                  ) : (
                    <p className="mt-2">Drop a file here or</p>
                  )}
                  <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => accept(e.target.files?.[0])} aria-label="Choose a file" />
                  <Button variant="secondary" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>{file ? 'Choose a different file' : 'Choose a file'}</Button>
                  <p className="mt-2 text-xs text-muted">PDF, PNG or JPG, up to {MAX_MB} MB</p>
                </div>
                {error && <ErrorState title="Cannot use this file" body={error} />}
                {saved && (
                  <p className="flex items-center gap-2 rounded-md bg-ok-tint px-3 py-2 text-sm text-ok" role="status">
                    <CheckCircle2 className="size-4" aria-hidden /> Saved as {saved}. It is now part of the patient’s record.
                  </p>
                )}
                <Button disabled={!file} onClick={extract} className="w-full">Read the document</Button>
              </>
            )}

            {stage === 'reading' && (
              <p role="status" className="flex items-center gap-2 py-8 text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Reading {file?.name}</p>
            )}

            {stage === 'review' && (
              <>
                <p className="rounded-md bg-warn-tint px-3 py-2 text-sm text-warn">Check this against the original before saving. Nothing is added to the record until you save.</p>
                <Field label="Title" htmlFor="title"><input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
                <Field label="Record date" htmlFor="date"><input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field>
                <Field label="Extracted text" htmlFor="sum"><textarea id="sum" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} className={`${inputClass} h-auto py-2`} /></Field>
                {error && <p role="alert" className="text-sm text-bad">{error}</p>}
                <div className="flex gap-2">
                  <Button onClick={save}>Save to patient record</Button>
                  <Button variant="secondary" onClick={() => { setStage('choose'); setError(''); }}>Start over</Button>
                </div>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="held">
          <h2 id="held" className="mb-3 text-lg font-semibold">Records held here</h2>
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="px-4 py-2 font-medium">Record</th><th className="font-medium">Patient</th><th className="font-medium">Date</th><th className="pr-4 font-medium">Review</th></tr></thead>
              <tbody>
                {own.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-2"><button className="text-left" onClick={() => setOpen(r)}><span className="block font-medium text-brand-deep underline underline-offset-2">{r.id}</span><span className="block text-xs text-muted">{RECORD_LABEL[r.type]}</span></button></td>
                    <td>{PATIENTS.find((p) => p.id === r.patientId)?.name}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td className="pr-4"><StatusBadge tone={r.provenance.verification === 'reviewed' ? 'ok' : 'warn'}>{r.provenance.verification === 'reviewed' ? 'Reviewed' : 'Not reviewed'}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <RecordDrawer record={open} onClose={() => setOpen(null)} />
    </>
  );
}
