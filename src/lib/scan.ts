/**
 * Camera barcode scanning has two engines:
 *  - the browser's own BarcodeDetector (Chrome on Android, macOS, ChromeOS): instant, nothing to download;
 *  - ZXing everywhere else (Chrome on Windows, Firefox, Safari), loaded only when a scan is opened so
 *    the ~400 KB library never slows down the till's start-up. It is part of the app's offline cache.
 * A USB or Bluetooth scanner needs neither: it types the code like a keyboard (hooks/useScannerWedge).
 */
export const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

/** There is a camera API at all (it needs https or localhost). */
export const cameraAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** The retail codes on shop goods; leaving out the rest makes ZXing faster and less likely to misread. */
async function zxing() {
  const [browser, library] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const { BarcodeFormat, DecodeHintType } = library;
  const hints = new Map<import('@zxing/library').DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  return new browser.BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
}

/** Start scanning from the camera into <video>. Returns a function that stops the camera. */
export async function startZxingCamera(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  const reader = await zxing();
  const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video, (result) => {
    if (result) onCode(result.getText());
  });
  return () => controls.stop();
}

/**
 * Read a barcode from a still image URL (used to check the decoder without a camera).
 * Note: ZXing's decodeFromImageElement() takes an element ID when given a string; a URL needs decodeFromImageUrl().
 */
export async function decodeBarcodeImage(src: string): Promise<string> {
  const reader = await zxing();
  return (await reader.decodeFromImageUrl(src)).getText();
}
