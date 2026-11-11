import { db } from '@/db';
import { saveRecord, stamp } from '@/db/repo';
import { attachDemoImages } from './demoImages';
import type { Category, IvaRate, Product, StockMovement } from '@/types/models';

type DemoProduct = [names: [string, string, string, string, string], cat: number, price: number, perKg: number | null, barcode: string | null, iva: IvaRate, stock: number];

const CATS: [string, string][] = [
  ['Frutta e verdura', '#16a34a'],
  ['Carne', '#dc2626'],
  ['Bevande', '#2563eb'],
  ['Dispensa', '#d97706'],
];

// Barcodes in the 200–299 prefix range are reserved for in-store use, so they can't clash with real EANs.
const PRODUCTS: DemoProduct[] = [
  [['Banane', 'Bananas', 'موز', 'কলা', '香蕉'], 0, 0, 1.99, null, 4, 40],
  [['Pomodori', 'Tomatoes', 'طماطم', 'টমেটো', '番茄'], 0, 0, 2.49, null, 4, 25],
  [['Cipolle', 'Onions', 'بصل', 'পেঁয়াজ', '洋葱'], 0, 0, 1.29, null, 4, 30],
  [['Pollo intero', 'Whole chicken', 'دجاج كامل', 'আস্ত মুরগি', '整鸡'], 1, 0, 6.9, null, 10, 15],
  [['Carne macinata', 'Minced beef', 'لحم مفروم', 'কিমা মাংস', '牛肉末'], 1, 0, 9.5, null, 10, 12],
  [['Agnello', 'Lamb', 'لحم خروف', 'ভেড়ার মাংস', '羊肉'], 1, 0, 14.9, null, 10, 8],
  [['Acqua 1,5 L', 'Water 1.5 L', 'ماء 1.5 لتر', 'পানি ১.৫ লি', '矿泉水 1.5升'], 2, 0.5, null, '2000000000011', 22, 48],
  [['Coca-Cola 33 cl', 'Coca-Cola 33 cl', 'كوكا كولا 33 سل', 'কোকা-কোলা ৩৩ সিএল', '可口可乐 33厘升'], 2, 1.2, null, '2000000000028', 22, 36],
  [['Tè verde', 'Green tea', 'شاي أخضر', 'সবুজ চা', '绿茶'], 2, 2.8, null, '2000000000035', 22, 20],
  [['Riso basmati 1 kg', 'Basmati rice 1 kg', 'أرز بسمتي 1 كغ', 'বাসমতি চাল ১ কেজি', '印度香米 1公斤'], 3, 3.5, null, '2000000000042', 4, 30],
  [['Pane arabo', 'Pita bread', 'خبز عربي', 'আরবি রুটি', '阿拉伯面包'], 3, 1.5, null, '2000000000059', 4, 20],
  [['Latte 1 L', 'Milk 1 L', 'حليب 1 لتر', 'দুধ ১ লি', '牛奶 1升'], 3, 1.39, null, '2000000000066', 4, 24],
  [['Lenticchie rosse', 'Red lentils', 'عدس أحمر', 'মসুর ডাল', '红扁豆'], 3, 2.2, null, '2000000000073', 4, 18],
  [['Olio di semi 1 L', 'Seed oil 1 L', 'زيت نباتي 1 لتر', 'সয়াবিন তেল ১ লি', '植物油 1升'], 3, 2.9, null, '2000000000080', 22, 15],
];

export async function seedDemo(): Promise<void> {
  await seedCatalogue();
  await attachDemoImages(); // an illustration for every demo product
}

async function seedCatalogue(): Promise<void> {
  await db.transaction('rw', [db.categories, db.products, db.stock_movements, db.outbox], async () => {
    const cats: Category[] = [];
    for (const [name, color] of CATS) cats.push(await saveRecord('categories', stamp<Category>({ name, color, icon: null })));
    for (const [[it, en, ar, bn, zh], cat, price, perKg, barcode, iva, stock] of PRODUCTS) {
      const p = await saveRecord(
        'products',
        stamp<Product>({
          barcode, image_url: null, name_it: it, name_en: en, name_ar: ar, name_bn: bn, name_zh: zh,
          price, price_per_kg: perKg, cost_price: null, stock_quantity: stock,
          category_id: cats[cat].id, iva_rate: iva, is_active: 1,
        }),
      );
      await saveRecord('stock_movements', stamp<StockMovement>({ product_id: p.id, delta: stock, reason: 'adjustment', ref_id: null }));
    }
  });
}
