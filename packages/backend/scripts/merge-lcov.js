#!/usr/bin/env node
/**
 * Merge multiple lcov reports into one by taking the per-line/-function/-branch
 * UNION of coverage across inputs (a line is covered if any input covered it).
 *
 * Why this exists: the backend `backend` Codecov flag is fed by two Jest runs —
 * unit (`npm test`) and e2e (`npm run test:e2e`) — which cover different code.
 * Uploading both lcov files and letting Codecov combine them did NOT produce a
 * clean line-union (it under-reported, dragging the e2e-only lines back to
 * "uncovered"). Pre-merging here and uploading a single report gives Codecov
 * exactly the combined coverage with nothing left to merge.
 *
 * Usage: node merge-lcov.js <out.info> <in1.info> <in2.info> [...]
 */
'use strict';
const fs = require('fs');

const [, , out, ...inputs] = process.argv;
if (!out || inputs.length === 0) {
  console.error('usage: merge-lcov.js <out.info> <in.info> [<in.info> ...]');
  process.exit(1);
}

/** @type {Map<string, {fn: Map<string, string>, fnda: Map<string, number>, da: Map<number, number>, brda: Map<string, string>}>} */
const files = new Map();
const recordFor = (sf) => {
  let r = files.get(sf);
  if (!r) {
    r = { fn: new Map(), fnda: new Map(), da: new Map(), brda: new Map() };
    files.set(sf, r);
  }
  return r;
};

for (const input of inputs) {
  if (!fs.existsSync(input)) {
    console.error(`merge-lcov: input not found, skipping: ${input}`);
    continue;
  }
  let cur = null;
  for (const line of fs.readFileSync(input, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) {
      cur = recordFor(line.slice(3).trim());
    } else if (!cur) {
      continue;
    } else if (line.startsWith('DA:')) {
      const [ln, hits] = line.slice(3).split(',');
      const n = Number(ln);
      cur.da.set(n, Math.max(cur.da.get(n) || 0, Number(hits) || 0));
    } else if (line.startsWith('FN:')) {
      const i = line.indexOf(',');
      cur.fn.set(line.slice(i + 1), line.slice(3, i));
    } else if (line.startsWith('FNDA:')) {
      const i = line.indexOf(',');
      const name = line.slice(i + 1);
      cur.fnda.set(name, Math.max(cur.fnda.get(name) || 0, Number(line.slice(5, i)) || 0));
    } else if (line.startsWith('BRDA:')) {
      const parts = line.slice(5).split(',');
      const key = parts.slice(0, 3).join(',');
      const taken = parts[3];
      const prev = cur.brda.get(key);
      const score = (t) => (t === undefined || t === '-' ? -1 : Number(t));
      if (score(taken) > score(prev)) cur.brda.set(key, taken);
      else if (prev === undefined) cur.brda.set(key, taken);
    } else if (line === 'end_of_record') {
      cur = null;
    }
  }
}

const num = (t) => (t === '-' ? 0 : Number(t));
const lines = [];
for (const [sf, r] of files) {
  lines.push('TN:');
  lines.push(`SF:${sf}`);
  for (const [name, ln] of r.fn) lines.push(`FN:${ln},${name}`);
  for (const [name, hits] of r.fnda) lines.push(`FNDA:${hits},${name}`);
  lines.push(`FNF:${r.fn.size}`);
  lines.push(`FNH:${[...r.fnda.values()].filter((h) => h > 0).length}`);
  for (const [key, taken] of r.brda) lines.push(`BRDA:${key},${taken}`);
  lines.push(`BRF:${r.brda.size}`);
  lines.push(`BRH:${[...r.brda.values()].filter((t) => num(t) > 0).length}`);
  for (const ln of [...r.da.keys()].sort((a, b) => a - b)) lines.push(`DA:${ln},${r.da.get(ln)}`);
  lines.push(`LF:${r.da.size}`);
  lines.push(`LH:${[...r.da.values()].filter((h) => h > 0).length}`);
  lines.push('end_of_record');
}
fs.writeFileSync(out, lines.join('\n') + '\n');
console.error(`merge-lcov: wrote ${files.size} files to ${out}`);
