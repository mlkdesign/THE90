/* =========================================================================
   Finds the blocks the design repeats and marks them, so the plugin can build
   one component and drop instances everywhere else.

   Only exact matches count - same structure, same paints, same copy - so an
   instance never needs an override, and only mid-sized blocks qualify: a whole
   screen is not a component, and neither is a single label.
   ========================================================================= */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
const MIN_COPIES = 4;
const MIN_NODES = 3;
const MAX_NODES = 140;

const hash = s => createHash('md5').update(s).digest('hex').slice(0, 16);

function fingerprint(n) {
  const parts = [
    n.type, String(n.w), String(n.h),
    JSON.stringify(n.sizing || null), JSON.stringify(n.layout || null),
    JSON.stringify(n.fills || null), JSON.stringify(n.strokes || null),
    JSON.stringify(n.strokeWeights || null), JSON.stringify(n.radius || null),
    JSON.stringify(n.effects || null), JSON.stringify(n.mask || null),
    n.asset || '', n.markup || '', String(n.opacity), String(!!n.absolute),
    n.overflow || '', JSON.stringify(n.text || null)
  ];
  for (const c of n.children || []) parts.push(fingerprint(c));
  return hash(parts.join(''));
}

const count = n => 1 + (n.children || []).reduce((a, c) => a + count(c), 0);

/* ------------------------------------------------------------------ pass 1 */

const files = readdirSync(join(DIR, 'screens')).filter(f => f.endsWith('.json'));
const docs = files.map(f => ({ f, data: JSON.parse(readFileSync(join(DIR, 'screens', f), 'utf8')) }));

const tally = new Map();
function survey(n, depth) {
  if (depth > 0) {
    const size = count(n);
    if (size >= MIN_NODES && size <= MAX_NODES) {
      const k = fingerprint(n);
      const rec = tally.get(k) || { n: 0, size, names: new Map() };
      rec.n++;
      rec.names.set(n.name, (rec.names.get(n.name) || 0) + 1);
      tally.set(k, rec);
    }
  }
  for (const c of n.children || []) survey(c, depth + 1);
}
for (const d of docs) {
  survey(d.data.scene, 0);
  for (const s of d.data.scene.shell || []) survey(s, 0);
}

const GENERIC = new Set(['div', 'span', 'p', 'i', 'b', 'li', 'ul', 'dl', 'dt', 'dd', 'group', 'a', 'button', 'img', 'screen', 'app']);

const winners = new Map();
for (const [k, rec] of tally) {
  if (rec.n < MIN_COPIES) continue;
  const raw = [...rec.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const name = raw.split(' · ')[0];
  if (GENERIC.has(name)) continue;
  winners.set(k, { name, copies: rec.n, size: rec.size });
}

/* Components that share a name are the same control in different clothes.
   Figma reads a slash as a folder, so `nav / Arena` files them together. */
const sample = new Map();

/* when two variants read the same, the one that is switched on says so */
function stateLabel(n) {
  for (const c of n.children || []) {
    const i = c.name.indexOf(' \u00b7 ');
    if (i > 0 && c.name.slice(i + 3) !== 'spacer') { const t = firstLabel(c); return (t ? t + ' ' : '') + c.name.slice(i + 3); }
    const deep = stateLabel(c);
    if (deep) return deep;
  }
  return null;
}

function firstLabel(n) {
  if (n.type === 'TEXT' && n.text && n.text.characters.trim()) return n.text.characters.trim();
  if (n.asset) return n.asset.split('/').pop().replace(/\.[a-z]+$/i, '');
  for (const c of n.children || []) { const l = firstLabel(c); if (l) return l; }
  return null;
}

/* ------------------------------------------------------------------ pass 2 */

/* outermost wins: a component inside a component is just the component */
let marked = 0, instances = 0;
function mark(n, depth) {
  if (depth > 0) {
    const k = fingerprint(n);
    const w = winners.get(k);
    if (w) {
      if (!sample.has(k)) sample.set(k, { plain: firstLabel(n), state: stateLabel(n) });
      n.comp = k;
      n.compName = w.name;
      marked++;
      return;                       // do not descend into a component
    }
  }
  delete n.comp; delete n.compName;
  for (const c of n.children || []) mark(c, depth + 1);
}
for (const d of docs) {
  mark(d.data.scene, 0);
  for (const s of d.data.scene.shell || []) mark(s, 0);
}

/* second look: give the shared names their folder */
const byName = new Map();
for (const [k, w] of winners) {
  if (!sample.has(k)) continue;
  const list = byName.get(w.name) || [];
  list.push(k); byName.set(w.name, list);
}
const finalName = new Map();
for (const [name, keys] of byName) {
  if (keys.length === 1) { finalName.set(keys[0], name); continue; }
  const plain = keys.map(k => (sample.get(k).plain || '').replace(/\s+/g, ' ').slice(0, 24));
  const clashes = new Set(plain.filter((v, i) => plain.indexOf(v) !== i));
  const seen = new Map();
  keys.forEach((k, i) => {
    const s = sample.get(k);
    let label = plain[i];
    if (!label || clashes.has(label)) label = (s.state || label || 'variant').replace(/\s+/g, ' ').slice(0, 28);
    const n = (seen.get(label) || 0) + 1; seen.set(label, n);
    finalName.set(k, name + ' / ' + label + (n > 1 ? ' ' + n : ''));
  });
}
for (const d of docs) {
  const rename = n => {
    if (n.comp) { n.compName = finalName.get(n.comp) || n.compName; return; }
    (n.children || []).forEach(rename);
  };
  rename(d.data.scene); (d.data.scene.shell || []).forEach(rename);
  writeFileSync(join(DIR, 'screens', d.f), JSON.stringify(d.data));
}

const used = new Set();
for (const d of docs) {
  const walk = n => { if (n.comp) { used.add(n.comp); instances++; return; } (n.children || []).forEach(walk); };
  walk(d.data.scene); (d.data.scene.shell || []).forEach(walk);
}

const list = [...used].map(k => Object.assign({}, winners.get(k), { label: finalName.get(k) })).sort((a, b) => b.copies - a.copies);
console.log(`components: ${list.length}   instances: ${instances}`);
for (const c of list.slice(0, 24)) {
  console.log('  x' + String(c.copies).padStart(3) + '  ' + String(c.size).padStart(4) + ' nodes  ' + c.label);
}
