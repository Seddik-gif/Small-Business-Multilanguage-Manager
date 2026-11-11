import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Keypad, applyKey } from '@/components/ui/Keypad';
import { useMoney } from '@/hooks/useMoney';
import { round2 } from '@/lib/money';
import { productName } from '@/lib/product';
import type { Product } from '@/types/models';

const PRESETS = [0.25, 0.5, 1, 2];

export function WeightModal({
  product, initialKg, onConfirm, onClose,
}: { product: Product; initialKg?: number; onConfirm: (kg: number) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const [value, setValue] = useState(initialKg ? String(initialKg) : '');
  const kg = Number(value) || 0;
  const pricePerKg = product.price_per_kg ?? 0;

  return (
    <Modal
      title={`${t('weight.title')} · ${productName(product, i18n.resolvedLanguage ?? 'it')}`}
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className="btn-primary h-14 w-full text-lg" disabled={kg <= 0} onClick={() => onConfirm(kg)}>
          {t('common.confirm')} · {money(round2(kg * pricePerKg))}
        </button>
      }
    >
      <div className="mb-3 rounded-xl bg-slate-50 p-3 text-center">
        <div dir="ltr" className="text-4xl font-bold tabular-nums">{value || '0'} <span className="text-2xl text-slate-500">kg</span></div>
        <div className="mt-1 text-sm text-slate-500">{money(pricePerKg)}/kg</div>
      </div>
      <div dir="ltr" className="mb-3 grid grid-cols-4 gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" className="btn-secondary px-1 text-sm" onClick={() => setValue(String(p))}>
            {p < 1 ? `${p * 1000} g` : `${p} kg`}
          </button>
        ))}
      </div>
      <Keypad onKey={(k) => setValue((v) => applyKey(v, k, 3))} />
    </Modal>
  );
}
