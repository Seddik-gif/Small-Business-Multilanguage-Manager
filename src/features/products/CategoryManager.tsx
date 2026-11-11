import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { saveRecord, softDelete, stamp } from '@/db/repo';
import { Modal } from '@/components/ui/Modal';
import type { Category } from '@/types/models';

export const CATEGORY_COLORS = ['#16a34a', '#dc2626', '#2563eb', '#d97706', '#9333ea', '#db2777', '#0891b2', '#64748b'];

export function CategoryManager({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  const add = async () => {
    if (!name.trim()) return;
    await saveRecord('categories', stamp<Category>({ name: name.trim(), color, icon: null }));
    setName('');
  };

  return (
    <Modal title={t('products.categories')} onClose={onClose}>
      <ul className="mb-4 divide-y divide-slate-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-1">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
            <span dir="auto" className="flex-1">{c.name}</span>
            <button type="button" className="btn-icon text-red-600 hover:bg-red-50" onClick={() => void softDelete('categories', c.id)} aria-label={t('common.delete')}>
              <Trash2 className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
      <label className="label" htmlFor="cat-name">{t('products.newCategory')}</label>
      <input id="cat-name" className="input mb-2" dir="auto" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
      <div className="mb-3 flex flex-wrap gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`h-11 w-11 rounded-full ring-offset-2 ${color === c ? 'ring-2 ring-slate-800' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>
      <button type="button" className="btn-primary w-full" onClick={() => void add()} disabled={!name.trim()}>
        {t('common.add')}
      </button>
    </Modal>
  );
}
