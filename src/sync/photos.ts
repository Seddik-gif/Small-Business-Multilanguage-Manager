import { db } from '@/db';
import { saveRecord } from '@/db/repo';
import { nowIso } from '@/lib/id';
import { supabase } from '@/lib/supabase';
import { classify, SyncAbort } from './errors';
import type { Product } from '@/types/models';

export const PHOTO_BUCKET = 'product-images';
const MAX_DOWNLOADS_PER_CYCLE = 10;

/**
 * Photos live in IndexedDB first (product_images). Upload: store the blob at
 * <uid>/<product id>/<version>.jpg, then point the product at it (products.image_url), which goes
 * through the normal outbox so every other till learns about it. A new version number per change
 * means "image_url changed" is all another till needs to notice.
 * Old versions are left in Storage (small, and safe if another till is still downloading one).
 */
export async function pushPhotos(uid: string): Promise<void> {
  if (!supabase) return;
  const pending = await db.product_images.where('sync_status').equals('pending').toArray();
  for (const img of pending) {
    const product = await db.products.get(img.id);
    if (!product || product.deleted) continue;
    const path = `${uid}/${img.id}/${Date.parse(img.updated_at)}.jpg`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, img.blob, { contentType: img.blob.type || 'image/jpeg', upsert: true });
    if (error) {
      const kind = classify(error as { code?: string; message?: string }, Number((error as { statusCode?: string }).statusCode));
      if (kind === 'network' || kind === 'auth' || kind === 'transient') {
        throw new SyncAbort(kind === 'transient' ? 'server' : kind, `photo upload: ${error.message}`);
      }
      console.warn('Photo upload refused', path, error.message);
      continue; // this photo only; the rest of the sync carries on
    }
    await db.transaction('rw', [db.product_images, db.products, db.outbox], async () => {
      const current = await db.product_images.get(img.id);
      if (!current || current.updated_at !== img.updated_at) return; // replaced while uploading: next cycle
      await db.product_images.update(img.id, { sync_status: 'synced', path });
      const p = await db.products.get(img.id);
      // A normal edit of the product: bumps updated_at, marks it pending, queues it in the outbox.
      if (p) await saveRecord('products', { ...p, image_url: path, updated_at: nowIso(), sync_status: 'pending' } as Product);
    });
  }
}

/** Download photos other tills uploaded or replaced; drop ones they removed. */
export async function pullPhotos(): Promise<void> {
  if (!supabase) return;
  const products = await db.products.filter((p) => !p.deleted).toArray();
  let downloads = 0;
  for (const p of products) {
    const local = await db.product_images.get(p.id);
    if (!p.image_url) {
      if (local && local.sync_status === 'synced') await db.product_images.delete(p.id);
      continue;
    }
    if (local?.path === p.image_url || local?.sync_status === 'pending') continue;
    if (downloads >= MAX_DOWNLOADS_PER_CYCLE) break;
    downloads++;
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(p.image_url);
    if (error || !data) {
      const kind = classify(error as { code?: string; message?: string }, Number((error as { statusCode?: string })?.statusCode));
      if (kind === 'network' || kind === 'auth' || kind === 'transient') {
        throw new SyncAbort(kind === 'transient' ? 'server' : kind, `photo download: ${error?.message}`);
      }
      console.warn('Photo download failed', p.image_url, error?.message);
      continue;
    }
    // Re-check: the user may have taken a new photo while this one downloaded.
    await db.transaction('rw', [db.product_images], async () => {
      const now = await db.product_images.get(p.id);
      if (now?.sync_status === 'pending') return;
      await db.product_images.put({ id: p.id, blob: data, updated_at: nowIso(), sync_status: 'synced', path: p.image_url! });
    });
  }
}
