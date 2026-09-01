// Cascade resolution for the registry generator.
//
// Answers "which declaration actually renders" the way the browser does for
// same-element rules: selector specificity first, then source order (the
// depth-first @import order from the entry stylesheet). Declarations that can
// never win against an identical selector are the ghost rules.

import { readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { parseCss } from './parse-css.mjs';

/**
 * Depth-first @import walk from the entry file, then the extra stylesheets
 * that components import directly (Vite loads those after the global sheet;
 * they are walked in the given order, each with its own @imports first).
 * CSS places a file's own rules after its imports, so children are appended
 * before the parent. Returns { order, rules, missing, entryTreeSize }.
 */
export function loadCascade(entryPath, extras = []) {
  const order = [];
  const rules = [];
  const missing = [];
  const seen = new Set();
  const ctx = { order, rules, missing, seen };
  visit(resolve(entryPath), ctx);
  const entryTreeSize = order.length;
  for (const extra of extras) visit(resolve(extra), ctx);
  return { order, rules, missing, entryTreeSize };
}

function visit(path, ctx) {
  if (ctx.seen.has(path)) return;
  ctx.seen.add(path);
  let source;
  try {
    source = readFileSync(path, 'utf8');
  } catch {
    ctx.missing.push(path);
    return;
  }
  const { rules, imports } = parseCss(source, basename(path));
  for (const spec of imports) visit(resolve(dirname(path), spec), ctx);
  ctx.order.push(path);
  for (const rule of rules) ctx.rules.push({ ...rule, orderIndex: ctx.rules.length });
}

/** Specificity as a single comparable number (ids, classes/attrs/pseudos, types). */
export function specificity(selector) {
  const s = selector.replace(/::[\w-]+/g, ' ').replace(/:not\(([^)]*)\)/g, ' $1 ');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g) || []).length;
  const types = (s.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) || []).length;
  return ids * 10000 + classes * 100 + types;
}

/**
 * Group every declaration by (selector, media, property) and resolve the
 * winner. Only genuine conflicts (differing values) are reported: a repeated
 * identical value is noise, not a fork.
 * Returns { canonical: [...], ghosts: [...] }.
 */
export function resolveConflicts(rules) {
  const byKey = new Map();
  for (const rule of rules) {
    for (const d of rule.declarations) {
      if (d.prop.startsWith('--')) continue; // token definitions handled separately
      const key = `${rule.selector} § ${rule.media} § ${d.prop}`;
      const entry = {
        ...d,
        selector: rule.selector,
        media: rule.media,
        file: rule.file,
        orderIndex: rule.orderIndex,
      };
      (byKey.get(key) ?? byKey.set(key, []).get(key)).push(entry);
    }
  }
  const canonical = [];
  const ghosts = [];
  for (const [, entries] of byKey) {
    const values = new Set(entries.map((e) => e.value));
    if (entries.length < 2 || values.size < 2) continue;
    entries.sort(
      (a, b) =>
        Number(isImportant(a.value)) - Number(isImportant(b.value)) ||
        specificity(a.selector) - specificity(b.selector) ||
        a.orderIndex - b.orderIndex,
    );
    const winner = entries[entries.length - 1];
    canonical.push(strip(winner));
    for (const loser of entries.slice(0, -1))
      ghosts.push({ ...strip(loser), losesTo: `${winner.file}:${winner.line}` });
  }
  const bySource = (a, b) => a.file.localeCompare(b.file) || a.line - b.line;
  return { canonical: canonical.sort(bySource), ghosts: ghosts.sort(bySource) };
}

const isImportant = (value) => /\s!important\s*$/i.test(value);

const strip = ({ selector, media, prop, value, file, line }) => ({
  selector,
  ...(media ? { media } : {}),
  prop,
  value,
  file,
  line,
});

const TOKEN_SCOPES = [':root', '.dark'];

/**
 * Token tables: every custom property declared on :root or .dark, cascade
 * resolved. Declarations on any other selector are component-scoped locals
 * (legal); :root/.dark declarations outside tokens.css are reported as
 * out-of-source definitions — the single-source rule forbids them.
 */
export function resolveTokens(rules) {
  const tables = { ':root': new Map(), '.dark': new Map() };
  const outOfSource = [];
  for (const rule of rules) {
    const scope = TOKEN_SCOPES.includes(rule.selector) ? rule.selector : null;
    if (!scope) continue;
    for (const d of rule.declarations) {
      if (!d.prop.startsWith('--')) continue;
      tables[scope].set(d.prop, { value: d.value, file: rule.file, line: d.line });
      if (rule.file !== 'tokens.css')
        outOfSource.push({ scope, prop: d.prop, file: rule.file, line: d.line });
    }
  }
  return { light: tables[':root'], dark: tables['.dark'], outOfSource };
}

/** Group class selectors into BEM blocks: block__element--modifier. */
export function groupBlocks(rules) {
  const blocks = new Map();
  for (const rule of rules) {
    for (const name of rule.selector.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
      const cls = name[1];
      const block = cls.split('__')[0].split('--')[0];
      const entry = blocks.get(block) ?? { classes: new Set(), files: new Set() };
      entry.classes.add(cls);
      entry.files.add(rule.file);
      blocks.set(block, entry);
    }
  }
  return new Map(
    [...blocks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([block, e]) => [block, { classes: [...e.classes].sort(), files: [...e.files].sort() }]),
  );
}
