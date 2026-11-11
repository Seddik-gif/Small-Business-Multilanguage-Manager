import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { makeMoneyFormatter } from '@/lib/money';

export function useMoney(): (n: number) => string {
  const { i18n } = useTranslation();
  const lng = i18n.resolvedLanguage ?? 'it';
  return useMemo(() => makeMoneyFormatter(lng), [lng]);
}
