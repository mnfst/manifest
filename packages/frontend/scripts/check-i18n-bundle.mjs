import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
const entries = Object.entries(manifest);
const appEntry = entries.find(([, chunk]) => chunk.isEntry);
const supportedLocales = ['en', 'ru'];

if (!appEntry) throw new Error('[i18n bundle] Vite entry was not found');

function staticClosure(rootKey) {
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    for (const imported of manifest[key]?.imports ?? []) visit(imported);
  };
  visit(rootKey);
  return visited;
}

function catalogueEntry(locale) {
  const suffix = `src/i18n/messages/${locale}/index.ts`;
  const match = entries.find(([key, chunk]) => key.endsWith(suffix) || chunk.src?.endsWith(suffix));
  if (!match) throw new Error(`[i18n bundle] ${locale} catalogue chunk was not found`);
  return match;
}

function sizes(keys) {
  let raw = 0;
  let gzip = 0;
  const files = new Set();
  for (const key of keys) {
    const file = manifest[key]?.file;
    if (!file?.endsWith('.js') || files.has(file)) continue;
    files.add(file);
    const contents = readFileSync(resolve(dist, file));
    raw += contents.byteLength;
    gzip += gzipSync(contents).byteLength;
  }
  return { raw, gzip };
}

function kilobytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const [appKey] = appEntry;
const initial = staticClosure(appKey);
const localeEntries = supportedLocales.map((locale) => [locale, ...catalogueEntry(locale)]);

for (const [locale, key] of localeEntries) {
  if (initial.has(key)) {
    throw new Error(`[i18n bundle] ${locale} catalogue leaked into the initial static graph`);
  }
}

const cyrillic = /[\u0400-\u04ff]/u;
for (const key of initial) {
  const file = manifest[key]?.file;
  if (!file?.endsWith('.js')) continue;
  const contents = readFileSync(resolve(dist, file), 'utf8');
  if (cyrillic.test(contents)) {
    throw new Error(`[i18n bundle] Cyrillic copy leaked into initial chunk ${file}`);
  }
}

const initialSize = sizes(initial);
console.log(
  `[i18n bundle] initial static JS: ${kilobytes(initialSize.raw)} raw / ${kilobytes(initialSize.gzip)} gzip`,
);
for (const [locale, key] of localeEntries) {
  const localeSize = sizes(staticClosure(key));
  console.log(
    `[i18n bundle] ${locale} catalogue graph: ${kilobytes(localeSize.raw)} raw / ${kilobytes(localeSize.gzip)} gzip`,
  );
}
