import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { cameraAvailable, hasNativeDetector, startZxingCamera } from '@/lib/scan';

/** The camera button is offered wherever a camera API exists; the engine is chosen when it opens. */
export const cameraScanSupported = cameraAvailable;

/** Camera barcode scan: native BarcodeDetector where the browser has it, ZXing otherwise. Closes on the first hit. */
export function BarcodeScannerModal({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;
  const [error, setError] = useState<string | null>(cameraAvailable ? null : t('camera.unsupported'));

  useEffect(() => {
    if (!cameraAvailable) return;
    let stream: MediaStream | null = null;
    let stopZxing: (() => void) | null = null;
    let timer = 0;
    let stopped = false;

    const found = (code: string) => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      navigator.vibrate?.(80);
      detectedRef.current(code);
    };

    (async () => {
      try {
        const video = videoRef.current!;
        if (hasNativeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (stopped) return;
          video.srcObject = stream;
          await video.play();
          const detector = new BarcodeDetector({ formats: await BarcodeDetector.getSupportedFormats() });
          let busy = false;
          timer = window.setInterval(async () => {
            if (busy || video.readyState < 2) return;
            busy = true;
            try {
              const [hit] = await detector.detect(video);
              if (hit?.rawValue) found(hit.rawValue);
            } catch {
              /* frame not ready; try next tick */
            } finally {
              busy = false;
            }
          }, 250);
        } else {
          const stop = await startZxingCamera(video, found);
          if (stopped) stop();
          else stopZxing = stop;
        }
      } catch {
        if (!stopped) setError(t('camera.permission'));
      }
    })();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      stopZxing?.();
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [t]);

  return (
    <Modal title={t('sales.scanCamera')} onClose={onClose}>
      {error ? (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-800">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
          <p className="absolute inset-x-0 bottom-2 text-center text-sm text-white">{t('camera.aim')}</p>
        </div>
      )}
    </Modal>
  );
}
