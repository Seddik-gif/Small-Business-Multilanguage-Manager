import { useEffect, useRef } from 'react';

/**
 * USB/Bluetooth barcode scanners act as keyboards: they "type" the code very fast and press Enter.
 * This catches scans even when focus is on a tile or nowhere, by buffering keystrokes that arrive
 * < 60 ms apart. Keystrokes inside inputs are left alone (the search field handles its own Enter).
 */
export function useScannerWedge(onScan: (code: string) => void, enabled = true): void {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const now = performance.now();
      if (now - last > 60) buffer = '';
      last = now;
      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          cb.current(buffer);
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
