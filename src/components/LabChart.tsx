import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MedicalRecord } from '../types';
import { hospitalById } from '../data/seed';
import { fmtDate } from '../lib/format';
import { toneClasses } from './HospitalTag';
import { EmptyState } from './ui';

interface Point { id: string; date: string; label: string; value: number; hospitalId: string }

export default function LabChart({ records, onOpen }: { records: MedicalRecord[]; onOpen: (r: MedicalRecord) => void }) {
  const tests = useMemo(() => {
    const m = new Map<string, { unit: string; refLow: number; refHigh: number; points: Point[] }>();
    [...records].sort((a, b) => a.date.localeCompare(b.date)).forEach((r) =>
      r.labs?.forEach((l) => {
        const e = m.get(l.name) ?? { unit: l.unit, refLow: l.refLow, refHigh: l.refHigh, points: [] };
        e.points.push({ id: r.id, date: r.date, label: fmtDate(r.date), value: l.value, hospitalId: r.hospitalId });
        m.set(l.name, e);
      }),
    );
    return m;
  }, [records]);

  const names = [...tests.keys()];
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked && tests.has(picked) ? picked : names[0];

  if (!names.length) return <EmptyState title="No lab results to chart" body="Lab values appear here once a lab report is available to you." />;
  const t = tests.get(current)!;
  const lo = Math.min(t.refLow, ...t.points.map((p) => p.value));
  const hi = Math.max(t.refHigh, ...t.points.map((p) => p.value));
  const pad = (hi - lo) * 0.15 || 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Lab test">
        {names.map((n) => (
          <button
            key={n}
            role="tab"
            aria-selected={n === current}
            onClick={() => setPicked(n)}
            className={`rounded-md border px-3 py-1.5 text-sm ${n === current ? 'border-navy bg-navy text-white' : 'border-line bg-white hover:bg-paper'}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-line bg-white p-4">
        <p className="text-sm text-muted">
          {current} in {t.unit}. The shaded band is the reference range ({t.refLow} to {t.refHigh}).
        </p>
        <div className="mt-3 h-64" aria-label={`${current} over time`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={t.points} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <ReferenceArea y1={t.refLow} y2={t.refHigh} fill="#e8f6ee" fillOpacity={0.9} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5b6b80' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis domain={[Math.floor(lo - pad), Math.ceil(hi + pad)]} tick={{ fontSize: 12, fill: '#5b6b80' }} tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Point;
                  return (
                    <div className="rounded-md border border-line bg-white px-3 py-2 text-sm">
                      <p className="font-medium">{p.value} {t.unit}</p>
                      <p className="text-muted">{p.label}, {hospitalById(p.hospitalId)?.short}</p>
                      <p className="text-xs text-muted">{p.id}</p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#102a43"
                strokeWidth={2}
                dot={(props: { cx?: number; cy?: number; payload?: Point; index?: number }) => {
                  const hex = toneClasses[hospitalById(props.payload?.hospitalId)?.tone ?? 'a'].hex;
                  return <circle key={props.index} cx={props.cx} cy={props.cy} r={6} fill={hex} stroke="#fff" strokeWidth={2} />;
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-line bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2 font-medium">Date</th><th className="font-medium">Result</th><th className="font-medium">Reference range</th><th className="font-medium">Hospital</th><th className="pr-4 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {[...t.points].reverse().map((p) => {
              const rec = records.find((r) => r.id === p.id)!;
              const out = p.value > t.refHigh || p.value < t.refLow;
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{p.label}</td>
                  <td className={out ? 'font-medium text-warn' : ''}>{p.value} {t.unit}</td>
                  <td className="text-muted">{t.refLow} to {t.refHigh}</td>
                  <td>{hospitalById(p.hospitalId)?.short}</td>
                  <td className="pr-4"><button className="text-brand-deep underline underline-offset-2" onClick={() => onOpen(rec)}>{p.id}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
