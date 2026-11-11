import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, MessageCircle } from 'lucide-react';
import i18n, { LANGUAGES } from '@/i18n';
import { Modal } from '@/components/ui/Modal';
import { makeMoneyFormatter } from '@/lib/money';
import { normalizePhone, waLink } from '@/lib/phone';
import { getShopName } from '@/lib/shop';
import type { Customer } from '@/types/models';

/**
 * WhatsApp debt reminder. The message is written in the CUSTOMER's language (set on the customer),
 * not the language the till is currently in; amounts use Latin digits so they read the same everywhere.
 * Opening WhatsApp needs internet; the text is built on the device either way.
 */
export function ReminderModal({ customer, balance, onClose }: { customer: Customer; balance: number; onClose: () => void }) {
  const { t, i18n: ui } = useTranslation();
  const [lang, setLang] = useState(customer.language_preference ?? ui.resolvedLanguage ?? 'it');
  const digits = customer.phone ? normalizePhone(customer.phone) : null;

  const defaultText = useMemo(
    () => i18n.getFixedT(lang)('reminder.message', { name: customer.name, amount: makeMoneyFormatter(lang)(balance), shop: getShopName() }),
    [lang, customer.name, balance],
  );
  // The owner can edit the text; changing the language rebuilds it.
  const [edited, setEdited] = useState<{ lang: string; text: string } | null>(null);
  const text = edited && edited.lang === lang ? edited.text : defaultText;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard refused: the text stays selectable in the box */
    }
  };

  return (
    <Modal title={`${t('reminder.title')} · ${customer.name}`} onClose={onClose} size="sm">
      {!digits ? (
        <p className="rounded-xl bg-amber-50 p-3 text-amber-800">{t('reminder.noPhone')}</p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="label">{t('reminder.language')}</span>
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <textarea
            className="input min-h-32 py-2"
            dir={LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr'}
            lang={lang}
            value={text}
            onChange={(e) => { setEdited({ lang, text: e.target.value }); setCopied(false); }}
          />
          <p dir="ltr" className="text-xs text-slate-500">{t('reminder.to', { number: digits })}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary" onClick={() => void copy()}>
              <Copy className="h-5 w-5" /> {copied ? t('reminder.copied') : t('reminder.copy')}
            </button>
            <a className="btn-primary" href={waLink(digits, text)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" /> {t('reminder.open')}
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
