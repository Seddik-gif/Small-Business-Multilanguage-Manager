import { Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

/** Apply a keypad press to a decimal string, capped at `decimals` places. */
export function applyKey(value: string, key: string, decimals: number): string {
  if (key === 'back') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : (value || '0') + '.';
  const [, frac] = value.split('.');
  if (frac !== undefined && frac.length >= decimals) return value;
  if (value === '0') return key;
  return value + key;
}

/** Numeric keypad: always LTR (phone layout), even in Arabic. */
export function Keypad({ onKey, decimal = true }: { onKey: (k: string) => void; decimal?: boolean }) {
  return (
    <div dir="ltr" className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => !decimal && k === '.' ? <span key={k} /> : (
        <button key={k} type="button" className="btn-secondary h-14 text-xl" onClick={() => onKey(k)} aria-label={k === 'back' ? 'Backspace' : k}>
          {k === 'back' ? <Delete className="h-6 w-6" /> : k}
        </button>
      ))}
    </div>
  );
}
