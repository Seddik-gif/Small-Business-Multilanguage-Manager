import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, dayStart, today, toDayString, type Period } from './data';

export type PresetId = 'today' | 'week' | 'last30' | 'month' | 'custom';
const PRESETS: PresetId[] = ['today', 'week', 'month', 'last30', 'custom'];

export function presetPeriod(id: Exclude<PresetId, 'custom'>): Period {
  const t = today();
  if (id === 'today') return { from: t, to: t };
  if (id === 'week') return { from: addDays(t, -6), to: t };
  if (id === 'last30') return { from: addDays(t, -29), to: t };
  return { from: toDayString(new Date(dayStart(t).getFullYear(), dayStart(t).getMonth(), 1)), to: t };
}

/** Today / last 7 days / this month / last 30 days / custom dates. Dates are local days, both ends included. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<PresetId>('week');

  const pick = (id: PresetId) => {
    setPreset(id);
    if (id !== 'custom') onChange(presetPeriod(id));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((id) => (
          <button key={id} type="button" aria-pressed={preset === id} className={`btn ${preset === id ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`} onClick={() => pick(id)}>
            {t(`reports.period.${id}`)}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {t('reports.from')}
            <input type="date" className="input w-auto" dir="ltr" max={value.to} value={value.from} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {t('reports.to')}
            <input type="date" className="input w-auto" dir="ltr" min={value.from} max={today()} value={value.to} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
