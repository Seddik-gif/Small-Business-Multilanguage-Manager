import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useMoney } from '@/hooks/useMoney';
import { discardHeld, listHeld } from './held';

/** Parked sales on this till. Resume one, or throw it away. */
export function HeldModal({ onResume, onClose }: { onResume: (id: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const held = useLiveQuery(listHeld, []);
  const ago = (iso: string) => {
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return mins < 1 ? t('held.justNow') : mins < 60 ? t('held.minutesAgo', { count: mins }) : t('held.hoursAgo', { count: Math.round(mins / 60) });
  };

  return (
    <Modal title={t('held.title')} onClose={onClose} size="sm">
      {held?.length === 0 && <p className="text-slate-500">{t('held.empty')}</p>}
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
        {(held ?? []).map((h) => (
          <li key={h.id} className="flex items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <div dir="auto" className="truncate font-medium">{h.label}</div>
              <div className="text-xs text-slate-500">{ago(h.created_at)} · {t('held.items', { count: h.items })}</div>
            </div>
            <span className="font-semibold tabular-nums">{money(h.total)}</span>
            <button type="button" className="btn-icon bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onResume(h.id)} aria-label={t('held.resume')} title={t('held.resume')}>
              <Play className="h-5 w-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              className="btn-icon text-red-600 hover:bg-red-50"
              aria-label={t('common.delete')}
              onClick={() => window.confirm(t('held.discardConfirm')) && void discardHeld(h.id)}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">{t('held.note')}</p>
    </Modal>
  );
}
