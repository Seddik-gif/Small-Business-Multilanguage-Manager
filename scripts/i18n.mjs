#!/usr/bin/env node
/**
 * Translation tools. No dependencies.
 *
 *   node scripts/i18n.mjs check              every language has every key, {{placeholders}} match, nothing empty
 *   node scripts/i18n.mjs export [file]      write a spreadsheet for native speakers to review
 *   node scripts/i18n.mjs import <file> [--dry]   read their corrections back into the JSON files
 *
 * The Arabic, Bengali and Chinese strings were machine-written: send the exported file to a native
 * speaker, ask them to fix any cell in their column, then import it. Italian is the reference language.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = join(root, 'src/i18n/locales');
const LANGS = ['it', 'en', 'ar', 'bn', 'zh'];
const REFERENCE = 'it';

const load = (lang) => JSON.parse(readFileSync(join(LOCALES, `${lang}.json`), 'utf8'));
const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) typeof v === 'object' && v ? flatten(v, `${prefix}${k}.`, out) : (out[`${prefix}${k}`] = v);
  return out;
};
const put = (obj, key, value) => {
  const parts = key.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = o[p] ??= {};
  o[parts.at(-1)] = value;
};
const placeholders = (s) => [...String(s).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
const all = () => Object.fromEntries(LANGS.map((l) => [l, flatten(load(l))]));

/** Problems that need no language skills to spot. */
function problems(flat) {
  const out = [];
  const keys = new Set(LANGS.flatMap((l) => Object.keys(flat[l])));
  for (const key of [...keys].sort()) {
    const ref = flat[REFERENCE][key];
    for (const lang of LANGS) {
      const v = flat[lang][key];
      if (v === undefined) out.push(`${lang}: missing "${key}"`);
      else if (typeof v !== 'string' || v.trim() === '') out.push(`${lang}: empty "${key}"`);
      else if (ref !== undefined && placeholders(v) !== placeholders(ref)) {
        out.push(`${lang}: "${key}" has placeholders {${placeholders(v)}} but ${REFERENCE} has {${placeholders(ref)}}`);
      }
    }
  }
  return out;
}

// ---- CSV (";" separated, UTF-8 with BOM: what an Italian Excel opens correctly) ----
const csvCell = (v) => (/[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const sep = (text.split(/\r?\n/)[0].match(/;/g) || []).length >= (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') (text[i + 1] === '"' ? ((cell += '"'), i++) : (quoted = false));
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) (row.push(cell), (cell = ''));
    else if (c === '\n') (row.push(cell), rows.push(row), (row = []), (cell = ''));
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) (row.push(cell), rows.push(row));
  return rows;
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'check') {
  const found = problems(all());
  found.forEach((p) => console.log('  ✗', p));
  const n = Object.keys(all()[REFERENCE]).length;
  console.log(found.length ? `\n${found.length} problem(s) in ${n} strings` : `OK: ${n} strings × ${LANGS.length} languages, placeholders match`);
  process.exit(found.length ? 1 : 0);
}

if (cmd === 'export') {
  const flat = all();
  const file = args[0] ?? join(root, 'i18n-review/translations.csv');
  mkdirSync(dirname(file), { recursive: true });
  const header = ['key', ...LANGS, 'reviewer_notes'];
  const rows = Object.keys(flat[REFERENCE]).sort().map((k) => [k, ...LANGS.map((l) => flat[l][k] ?? ''), '']);
  writeFileSync(file, '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n');
  console.log(`Wrote ${rows.length} strings to ${file}`);
  process.exit(0);
}

if (cmd === 'import') {
  const file = args.find((a) => !a.startsWith('--'));
  const dry = args.includes('--dry');
  if (!file) (console.error('usage: i18n.mjs import <file.csv> [--dry]'), process.exit(2));
  if (!statSync(file).isFile()) (console.error('not a file'), process.exit(2));
  const [header, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  for (const need of ['key', ...LANGS]) if (!(need in col)) (console.error(`column "${need}" is missing`), process.exit(2));

  const data = Object.fromEntries(LANGS.map((l) => [l, load(l)]));
  const flat = all();
  const changes = [], rejected = [];
  for (const r of rows) {
    const key = r[col.key]?.trim();
    if (!key || !(key in flat[REFERENCE])) continue;
    for (const lang of LANGS) {
      const next = (r[col[lang]] ?? '').trim();
      if (next === '' || next === flat[lang][key]) continue;
      // The reviewer must not break the {{placeholders}}: the app fills those in.
      if (placeholders(next) !== placeholders(flat[REFERENCE][key])) {
        rejected.push(`${lang} "${key}": placeholders {${placeholders(next)}} should be {${placeholders(flat[REFERENCE][key])}}`);
        continue;
      }
      changes.push({ lang, key, from: flat[lang][key], to: next });
      put(data[lang], key, next);
    }
  }
  changes.forEach((c) => console.log(`  ${c.lang} ${c.key}\n      - ${c.from}\n      + ${c.to}`));
  rejected.forEach((r) => console.log('  ✗ rejected:', r));
  console.log(`\n${changes.length} change(s), ${rejected.length} rejected${dry ? ' (dry run, nothing written)' : ''}`);
  if (!dry && changes.length) {
    for (const lang of LANGS) writeFileSync(join(LOCALES, `${lang}.json`), JSON.stringify(data[lang], null, 2) + '\n');
    console.log('JSON files updated. Run "node scripts/i18n.mjs check" and rebuild.');
  }
  process.exit(rejected.length ? 1 : 0);
}

console.log('usage: node scripts/i18n.mjs check | export [file] | import <file> [--dry]');
process.exit(2);
