/* =========================================================================
   Verifier — re-runs Figma's auto-layout rules over the exported scene graph
   and compares the result against what the browser actually measured.

   The plugin cannot be run from here, so this is how the export earns trust:
   every frame that Figma will size for itself (HUG / FILL) has to land on the
   number Chrome landed on, or the export is lying about the design.
   ========================================================================= */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
const TOL = 1.0;

const isAuto = s => s.layout && s.layout.mode && s.layout.mode !== 'NONE';
const flow = s => (s.children || []).filter(c => !c.absolute);
const abs  = s => (s.children || []).filter(c => c.absolute);

/* ------------------------------------------------------------------ sizes */

function ownSize(spec, avail, axis) {
  const want = (spec.sizing || {})[axis] || 'FIXED';
  const measured = axis === 'h' ? spec.w : spec.h;
  if (want === 'FILL' && avail != null && isFinite(avail)) return avail;
  if (want === 'HUG') return hug(spec, axis);
  return measured;
}

function hug(spec, axis) {
  const l = spec.layout;
  const measured = axis === 'h' ? spec.w : spec.h;
  /* text and leaves hug to whatever the browser drew — nothing to recompute */
  if (!isAuto(spec)) return measured;

  const kids = flow(spec);
  const padA = axis === 'h' ? (l.padL || 0) + (l.padR || 0) : (l.padT || 0) + (l.padB || 0);
  if (!kids.length) return padA;

  const along = (l.mode === 'HORIZONTAL') === (axis === 'h');
  const sizes = kids.map(k => {
    const s = (k.sizing || {})[axis] || 'FIXED';
    /* a FILL child inside a hugging parent has nothing to fill — Figma pins it */
    if (s === 'HUG') return hug(k, axis);
    return axis === 'h' ? k.w : k.h;
  });

  if (l.wrap) {
    if (axis === 'h') return measured;                  // wrap width comes from the parent
    return wrapHeight(spec, spec.w) + padA;
  }
  if (along) return sizes.reduce((a, b) => a + b, 0) + (kids.length - 1) * (l.gap || 0) + padA;
  return Math.max(...sizes) + padA;
}

/* Figma packs a wrapping row the way flexbox does: fill the line, then break */
function wrapHeight(spec, outerW) {
  const l = spec.layout, kids = flow(spec);
  const contentW = outerW - (l.padL || 0) - (l.padR || 0);
  const rows = [];
  let row = [], used = 0;
  for (const k of kids) {
    const w = (k.sizing || {}).h === 'HUG' ? hug(k, 'h') : k.w;
    const add = row.length ? (l.gap || 0) + w : w;
    if (row.length && used + add > contentW + 0.5) { rows.push(row); row = []; used = 0; }
    row.push(k); used += row.length > 1 ? (l.gap || 0) + w : w;
  }
  if (row.length) rows.push(row);
  const heights = rows.map(r => Math.max(...r.map(k => (k.sizing || {}).v === 'HUG' ? hug(k, 'v') : k.h)));
  return heights.reduce((a, b) => a + b, 0) + (rows.length - 1) * (l.rowGap || 0);
}

/* ------------------------------------------------------------- the layout */

function resolve(spec, availW, availH, out, path) {
  const w = ownSize(spec, availW, 'h');
  const h = ownSize(spec, availH, 'v');

  out.push({ path, spec, w, h });

  if (!isAuto(spec)) {
    for (const c of spec.children || []) resolve(c, null, null, out, path + ' › ' + c.name);
    return { w, h };
  }

  const l = spec.layout;
  const kids = flow(spec);
  const contentW = w - (l.padL || 0) - (l.padR || 0);
  const contentH = h - (l.padT || 0) - (l.padB || 0);
  const row = l.mode === 'HORIZONTAL';
  const mainAvail = row ? contentW : contentH;

  /* primary axis: fixed and hugging children first, then split the remainder */
  const mainAxis = row ? 'h' : 'v';
  const crossAxis = row ? 'v' : 'h';
  const fills = [];
  let used = 0;
  const mains = kids.map((k, i) => {
    const s = (k.sizing || {})[mainAxis] || 'FIXED';
    if (s === 'FILL') { fills.push(i); return null; }
    const v = s === 'HUG' ? hug(k, mainAxis) : (mainAxis === 'h' ? k.w : k.h);
    used += v;
    return v;
  });
  const gaps = (kids.length - 1) * (l.gap || 0);
  if (fills.length) {
    const share = Math.max(0, mainAvail - used - gaps) / fills.length;
    fills.forEach(i => { mains[i] = share; });
  }

  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    const crossAvail = row ? contentH : contentW;
    const kw = row ? mains[i] : (((k.sizing || {}).h === 'FILL') ? contentW : null);
    const kh = row ? (((k.sizing || {}).v === 'FILL') ? contentH : null) : mains[i];
    const forcedW = row ? mains[i] : kw;
    const forcedH = row ? kh : mains[i];
    resolve(k, forcedW, forcedH, out, path + ' › ' + k.name);
  }

  for (const c of abs(spec)) resolve(c, null, null, out, path + ' › ' + c.name);
  return { w, h };
}

/* -------------------------------------------------------------------- fix */

/* Where auto-layout cannot land on the browser's number, the browser wins:
   that axis goes back to a fixed size. Pinning a child changes what its
   parent hugs, so this runs until nothing moves. */
function pin(root) {
  let pinned = 0;
  for (let pass = 0; pass < 8; pass++) {
    const out = [];
    resolve(root, null, null, out, root.name);
    let changed = 0;
    for (const r of out) {
      const s = r.spec, sz = s.sizing || {};
      if (s.type === 'TEXT') continue;
      if ((sz.h === 'HUG' || sz.h === 'FILL') && Math.abs(r.w - s.w) > TOL) { sz.h = 'FIXED'; changed++; }
      if ((sz.v === 'HUG' || sz.v === 'FILL') && Math.abs(r.h - s.h) > TOL) { sz.v = 'FIXED'; changed++; }
    }
    pinned += changed;
    if (!changed) break;
  }
  return pinned;
}

/* ------------------------------------------------------------------ check */

const FIX = process.argv.includes('--fix');
let files = readdirSync(join(DIR, 'screens')).filter(f => f.endsWith('.json'));
const filter = process.argv.slice(2).find(a => !a.startsWith('--'));
if (filter) files = files.filter(f => f.includes(filter));

if (FIX) {
  let pinned = 0;
  for (const f of files) {
    const p = join(DIR, 'screens', f);
    const data = JSON.parse(readFileSync(p, 'utf8'));
    for (const root of [data.scene, ...(data.scene.shell || [])]) pinned += pin(root);
    writeFileSync(p, JSON.stringify(data));
  }
  console.log(`pinned ${pinned} axes back to the measured size`);
}

let total = 0, bad = 0;
const worst = [];
const byReason = {};

for (const f of files) {
  const data = JSON.parse(readFileSync(join(DIR, 'screens', f), 'utf8'));
  const roots = [data.scene, ...(data.scene.shell || [])];
  for (const root of roots) {
    const out = [];
    resolve(root, null, null, out, root.name);
    for (const r of out) {
      const s = r.spec;
      const sz = s.sizing || {};
      /* only judge the axes Figma computes for itself */
      for (const [axis, got, want, mode] of [['w', r.w, s.w, sz.h], ['h', r.h, s.h, sz.v]]) {
        if (mode !== 'HUG' && mode !== 'FILL') continue;
        if (s.type === 'TEXT') continue;                 // needs a font engine, not arithmetic
        total++;
        const delta = Math.abs(got - want);
        if (delta > TOL) {
          bad++;
          const kind = `${s.type} ${axis}:${mode}`;
          byReason[kind] = (byReason[kind] || 0) + 1;
          worst.push({ file: f, path: r.path, axis, mode, got: Math.round(got * 10) / 10, want, delta });
        }
      }
    }
  }
}

worst.sort((a, b) => b.delta - a.delta);
console.log(`checked ${total} computed axes across ${files.length} scenes`);
console.log(`mismatches > ${TOL}px: ${bad}  (${(bad / Math.max(1, total) * 100).toFixed(2)}%)`);
console.log(byReason);
console.log('\nworst 25:');
for (const w of worst.slice(0, 400)) {
  console.log(`  ${w.delta.toFixed(1).padStart(7)}px  ${w.axis}:${w.mode.padEnd(4)} got ${String(w.got).padStart(7)} want ${String(w.want).padStart(7)}  ${w.file}  ${w.path.slice(-110)}`);
}
