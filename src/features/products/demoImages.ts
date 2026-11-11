import { db } from '@/db';
import { nowIso } from '@/lib/id';

/**
 * Flat illustrations for the demo catalogue, one per product (keyed by the Italian name). Drawn in code so
 * the app needs no image files and no network; generic shapes only, no brand artwork. They are stored as
 * product photos, so they behave exactly like a photo taken with the camera (kept offline, synced later).
 */
const svg = (bg: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600"><rect width="400" height="300" fill="${bg}"/>${body}</svg>`;

/** Deterministic scatter of small dots inside a box, so every render looks the same. */
function dots(n: number, seed: number, x: number, y: number, w: number, h: number, colors: string[], r: number): string {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: n }, () => `<circle cx="${(x + rnd() * w).toFixed(1)}" cy="${(y + rnd() * h).toFixed(1)}" r="${(r * (0.7 + rnd() * 0.6)).toFixed(1)}" fill="${colors[Math.floor(rnd() * colors.length)]}"/>`).join('');
}

const shadow = (cx: number, cy: number, rx: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="12" fill="#000" opacity=".09"/>`;
const DRINK = '#DCEBFA', MEAT = '#FBE3E0', FRESH = '#E3F2DD', PANTRY = '#FBEBD3';

const bottle = (body: string, edge: string, cap: string, label: string, mark: string) =>
  `${shadow(200, 272, 72)}<rect x="170" y="26" width="60" height="24" rx="5" fill="${cap}"/>` +
  `<path d="M178 50h44v22q0 14 22 36v140q0 14-14 14h-60q-14 0-14-14V108q22-22 22-36z" fill="${body}" stroke="${edge}" stroke-width="4" stroke-linejoin="round"/>` +
  `<rect x="157" y="146" width="86" height="64" fill="${label}"/>${mark}` +
  `<rect x="170" y="84" width="10" height="120" rx="5" fill="#fff" opacity=".35"/>`;

const star = (cx: number, cy: number, k: number) =>
  `<polygon transform="translate(${cx} ${cy}) scale(${k})" points="0,-14 10,2 30,-4 16,12 26,32 0,20 -26,32 -16,12 -30,-4 -10,2" fill="#4F9A3A"/>`;

export const DEMO_IMAGES: Record<string, string> = {
  'Acqua 1,5 L': svg(
    DRINK,
    bottle('#A9D3F3', '#2F6FB5', '#2F6FB5', '#fff', '<path d="M157 178q14-10 29 0t28 0t29 0" stroke="#2F6FB5" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M157 196q14-10 29 0t28 0t29 0" stroke="#7FB6E6" stroke-width="4" fill="none" stroke-linecap="round"/>'),
  ),

  'Coca-Cola 33 cl': svg(
    DRINK,
    `${shadow(200, 266, 66)}<rect x="140" y="46" width="120" height="212" rx="16" fill="#D62B2B"/>` +
      '<rect x="140" y="46" width="120" height="22" rx="9" fill="#C9CED3"/><rect x="140" y="236" width="120" height="22" rx="9" fill="#C9CED3"/>' +
      '<path d="M140 140q30-28 60 0t60 0v36q-30-28-60 0t-60 0z" fill="#fff"/>' +
      '<rect x="152" y="80" width="12" height="140" rx="6" fill="#fff" opacity=".28"/><rect x="180" y="52" width="40" height="8" rx="4" fill="#9AA1A8"/>',
  ),

  'Tè verde': svg(
    DRINK,
    `<ellipse cx="200" cy="236" rx="118" ry="24" fill="#fff" stroke="#C5D3DF" stroke-width="3"/>` +
      '<path d="M278 138q46 2 40 32t-48 32" stroke="#C5D3DF" stroke-width="12" fill="none" stroke-linecap="round"/>' +
      '<path d="M120 118h160v52q0 64-80 64t-80-64z" fill="#fff" stroke="#C5D3DF" stroke-width="3"/>' +
      '<ellipse cx="200" cy="118" rx="80" ry="15" fill="#8DBF5A" stroke="#C5D3DF" stroke-width="3"/>' +
      '<path d="M172 96q-16-18 0-36t0-30M210 96q-16-18 0-36t0-30" stroke="#9FB8CC" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M40 252q50-46 96-12-46 36-96 12z" fill="#5BA33B"/><path d="M46 250q40-22 82-12" stroke="#3E7D28" stroke-width="3" fill="none"/>',
  ),

  Agnello: svg(
    MEAT,
    `${shadow(200, 262, 120)}<path d="M268 116l62-44" stroke="#F3E9DC" stroke-width="18" stroke-linecap="round"/>` +
      '<circle cx="338" cy="62" r="13" fill="#F3E9DC"/><circle cx="346" cy="82" r="13" fill="#F3E9DC"/>' +
      '<path d="M126 150q0-64 72-68t84 46q8 62-52 82t-104-60z" fill="#F6E3D4"/>' +
      '<path d="M138 152q0-52 62-56t70 38q8 52-44 70t-88-52z" fill="#C8453F"/>' +
      '<path d="M166 142q30-24 66 0M170 176q34-18 62 4" stroke="#E27C73" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="214" cy="152" r="9" fill="#F6E3D4" opacity=".7"/>',
  ),

  'Pollo intero': svg(
    MEAT,
    '<ellipse cx="200" cy="256" rx="150" ry="28" fill="#fff"/><ellipse cx="200" cy="256" rx="150" ry="28" fill="none" stroke="#E5CFCB" stroke-width="3"/>' +
      '<ellipse cx="106" cy="158" rx="34" ry="20" transform="rotate(-24 106 158)" fill="#D18B2B"/><ellipse cx="294" cy="158" rx="34" ry="20" transform="rotate(24 294 158)" fill="#D18B2B"/>' +
      '<ellipse cx="200" cy="164" rx="106" ry="82" fill="#E3A23F"/><ellipse cx="190" cy="140" rx="70" ry="36" fill="#EDB75B" opacity=".8"/>' +
      '<path d="M150 190q50 22 100 0" stroke="#C07F25" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="128" cy="232" rx="30" ry="18" transform="rotate(-30 128 232)" fill="#D6932F"/><ellipse cx="272" cy="232" rx="30" ry="18" transform="rotate(30 272 232)" fill="#D6932F"/>' +
      '<circle cx="104" cy="248" r="9" fill="#F6EBDD"/><circle cx="296" cy="248" r="9" fill="#F6EBDD"/>' +
      dots(14, 7, 130, 120, 140, 90, ['#B97420', '#F1C37A'], 3),
  ),

  'Carne macinata': svg(
    MEAT,
    '<rect x="60" y="176" width="280" height="84" rx="12" fill="#fff" stroke="#E0CFCB" stroke-width="3"/>' +
      '<path d="M84 186q20-92 116-92t116 92z" fill="#B2403C"/>' +
      dots(70, 11, 100, 112, 200, 70, ['#8E2C29', '#CC5A52', '#A53733'], 4.5) +
      '<path d="M120 150q40-30 90-26" stroke="#CF6B63" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>',
  ),

  Banane: svg(
    FRESH,
    shadow(205, 268, 110) +
      '<path d="M118 214Q128 112 246 90" stroke="#F4CF3A" stroke-width="40" fill="none" stroke-linecap="round"/>' +
      '<path d="M150 230Q164 130 272 116" stroke="#F8DB52" stroke-width="40" fill="none" stroke-linecap="round"/>' +
      '<path d="M184 240Q204 154 296 142" stroke="#EDC32B" stroke-width="40" fill="none" stroke-linecap="round"/>' +
      '<path d="M246 90l36-24M272 116l12-48M296 142l-4-70" stroke="#7A5A33" stroke-width="14" stroke-linecap="round"/><circle cx="288" cy="66" r="13" fill="#6B4A2B"/>' +
      '<circle cx="118" cy="214" r="9" fill="#5E4326"/><circle cx="150" cy="230" r="9" fill="#5E4326"/><circle cx="184" cy="240" r="9" fill="#5E4326"/>',
  ),

  Pomodori: svg(
    FRESH,
    shadow(200, 270, 130) +
      '<circle cx="146" cy="178" r="64" fill="#E04B3C"/><circle cx="256" cy="162" r="58" fill="#D93F31"/>' +
      '<ellipse cx="124" cy="156" rx="16" ry="10" fill="#fff" opacity=".35"/><ellipse cx="236" cy="142" rx="14" ry="9" fill="#fff" opacity=".35"/>' +
      star(146, 120, 1) +
      star(256, 108, 0.9),
  ),

  Cipolle: svg(
    FRESH,
    shadow(200, 270, 130) +
      '<path d="M150 134q-6-34 10-56" stroke="#C6913E" stroke-width="11" fill="none" stroke-linecap="round"/><ellipse cx="150" cy="192" rx="64" ry="58" fill="#D8A04A"/>' +
      '<path d="M120 150q-14 42 8 84M150 138q-8 54 0 108M180 150q14 42-8 84" stroke="#B67E2D" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M262 160q-4-26 8-44" stroke="#8A4474" stroke-width="10" fill="none" stroke-linecap="round"/><ellipse cx="262" cy="212" rx="52" ry="48" fill="#A04F86"/>' +
      '<path d="M238 180q-12 34 6 64M262 170q-6 44 0 84M286 180q12 34-6 64" stroke="#7E3563" stroke-width="4" fill="none" stroke-linecap="round"/>',
  ),

  'Riso basmati 1 kg': svg(
    PANTRY,
    shadow(200, 270, 96) +
      '<rect x="120" y="56" width="160" height="206" rx="10" fill="#F4EBD6" stroke="#C9B58A" stroke-width="3"/><rect x="120" y="56" width="160" height="18" rx="6" fill="#E3D2AA"/>' +
      '<rect x="138" y="100" width="124" height="96" rx="8" fill="#fff"/>' +
      '<text x="200" y="138" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#8A6A2E">RISO</text>' +
      '<text x="200" y="162" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#8A6A2E">BASMATI</text>' +
      '<text x="200" y="228" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#8A6A2E">1 kg</text>' +
      '<ellipse cx="60" cy="262" rx="8" ry="3.5" fill="#fff3d6" stroke="#D9C79A"/><ellipse cx="84" cy="270" rx="8" ry="3.5" fill="#fff3d6" stroke="#D9C79A"/><ellipse cx="318" cy="266" rx="8" ry="3.5" fill="#fff3d6" stroke="#D9C79A"/>',
  ),

  'Pane arabo': svg(
    PANTRY,
    '<ellipse cx="200" cy="228" rx="132" ry="40" fill="#DDB877"/><ellipse cx="200" cy="196" rx="132" ry="40" fill="#E9C98E"/>' +
      '<ellipse cx="200" cy="158" rx="124" ry="38" fill="#F1D8A3"/><path d="M110 150q90-26 180 0" stroke="#D6B471" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      dots(16, 5, 110, 138, 180, 40, ['#C99A55', '#D9AF6D'], 6),
  ),

  'Latte 1 L': svg(
    PANTRY,
    shadow(200, 268, 70) +
      '<polygon points="140,100 200,48 260,100" fill="#DCE6F1" stroke="#B9C6D6" stroke-width="3" stroke-linejoin="round"/><rect x="188" y="52" width="24" height="12" rx="3" fill="#4E8FD6"/>' +
      '<rect x="140" y="100" width="120" height="156" fill="#fff" stroke="#B9C6D6" stroke-width="3"/><rect x="141.5" y="152" width="117" height="56" fill="#4E8FD6"/>' +
      '<path d="M200 164q-18 20-18 30a18 18 0 0 0 36 0q0-10-18-30z" fill="#fff"/>',
  ),

  'Lenticchie rosse': svg(
    PANTRY,
    shadow(200, 272, 118) +
      dots(26, 21, 60, 244, 280, 22, ['#D9522E', '#E8734A', '#B8421F'], 4) +
      '<path d="M96 150h208q0 92-104 92t-104-92z" fill="#8A6642"/><ellipse cx="200" cy="150" rx="104" ry="24" fill="#C0431F"/>' +
      '<ellipse cx="200" cy="140" rx="92" ry="26" fill="#D9522E"/>' +
      dots(80, 33, 118, 120, 164, 40, ['#E8734A', '#B8421F', '#F08A5E', '#C93E1A'], 5),
  ),

  'Olio di semi 1 L': svg(
    PANTRY,
    bottle('#F3C646', '#B8890F', '#3E7D32', '#fff', '<circle cx="200" cy="178" r="14" fill="#F28C1B"/><path d="M200 152v-8M200 204v8M174 178h-8M226 178h8M182 160l-6-6M218 160l6-6M182 196l-6 6M218 196l6 6" stroke="#F28C1B" stroke-width="4" stroke-linecap="round"/>'),
  ),
};

/** Draw an SVG illustration into a 640×480 JPEG, small enough to keep hundreds in IndexedDB. */
async function render(markup: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext('2d')!.drawImage(img, 0, 0, 640, 480);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))), 'image/jpeg', 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Give each demo product its illustration, unless it already has a photo. Returns how many were added. */
export async function attachDemoImages(): Promise<number> {
  let added = 0;
  const products = await db.products.filter((p) => !p.deleted).toArray();
  for (const p of products) {
    const markup = DEMO_IMAGES[p.name_it];
    if (!markup || (await db.product_images.get(p.id))) continue;
    await db.product_images.put({ id: p.id, blob: await render(markup), updated_at: nowIso(), sync_status: 'pending' });
    added++;
  }
  return added;
}
