import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';

/** Object URL for a product's locally stored photo (revoked on change/unmount). */
export function useProductImage(productId: string | null | undefined): string | null {
  const rec = useLiveQuery(() => (productId ? db.product_images.get(productId) : undefined), [productId]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!rec?.blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(rec.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [rec]);
  return url;
}
