/**
 * Row ownership (user_id).
 *  - Before any sign-in, rows are owned by a random per-device id (each till has its own).
 *  - On the first successful sign-in, auth/linkDevice.ts rewrites those rows to auth.uid() and
 *    records the owner here; from then on every new row is created with the owner's uid.
 */
const DEVICE_ID_KEY = 'pos.shop_id'; // historical key name: this is the per-device id
const OWNER_UID_KEY = 'pos.owner_uid';
const SHOP_NAME_KEY = 'pos.shop_name';
const FALLBACK_ID = '00000000-0000-0000-0000-000000000000';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** Per-device id used as user_id before the device is linked to an account. */
export function getDeviceId(): string {
  let id = read(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(DEVICE_ID_KEY, id);
  }
  return id ?? FALLBACK_ID;
}

/** auth.uid() of the account this device is linked to, or null if never linked. */
export const getOwnerUid = (): string | null => read(OWNER_UID_KEY);
export const setOwnerUid = (uid: string): void => write(OWNER_UID_KEY, uid);

/** user_id for new rows. */
export const getShopId = (): string => getOwnerUid() ?? getDeviceId();

export const getShopName = (): string => read(SHOP_NAME_KEY) || 'Il mio negozio';
export const setShopName = (name: string): void => write(SHOP_NAME_KEY, name);
