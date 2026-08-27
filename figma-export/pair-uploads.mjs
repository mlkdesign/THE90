// Pairs plan images (in plugin walk order) with figma-inventory node ids and
// writes upload-pairs.json — the list a future uploader hands to the Figma API.
//
// The inventory uses two different key styles for the same screens:
//   - Regular screens keep the file base:   'main', 'sheet-teams', 'modal-reward'
//   - Two league boards use a bullet form:  'leagues · joined', 'leagues · my leagues'
// The plan always uses the bullet form (data.screen straight from the scene).
// We normalise plan keys to inventory keys before matching.
//
// Entries whose plan asset is empty (avatar-unlock__preview and friends) are
// still walked so positions line up with the inventory, but they are dropped
// from the output — nothing to upload.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/jackmilka/Desktop/THE90';
const EXPORT = join(ROOT, 'figma-export');

const plan = JSON.parse(readFileSync(join(EXPORT, 'image-plan.json'), 'utf8'));
const inv  = JSON.parse(readFileSync(join(EXPORT, 'figma-inventory.json'), 'utf8'));

function planToInv(k) {
  // 'leagues · joined' / 'leagues · my leagues' — inv keeps the bullet form
  if (k.startsWith('leagues · ')) return k;
  // 'modal · reward' → 'modal-reward'; 'sheet · unlock avatar' → 'sheet-unlock-avatar'
  for (const pre of ['modal · ', 'sheet · ']) {
    if (k.startsWith(pre)) {
      const base = pre.replace(' · ', '');
      const rest = k.slice(pre.length).replace(/ /g, '-');
      return base + '-' + rest;
    }
  }
  // regular single-word screens map 1:1
  return k.replace(/ · /g, '-');
}

const pairs = [];
const mismatches = [];
let skippedEmpty = 0;

for (const [screen, items] of Object.entries(plan)) {
  const invKey = planToInv(screen);
  const ids = inv[invKey];
  if (!ids) { mismatches.push({ screen, reason: 'no inventory key', invKey }); continue; }
  if (ids.length !== items.length) {
    mismatches.push({ screen, invKey, plan: items.length, inv: ids.length });
    continue;
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.asset) { skippedEmpty++; continue; }
    pairs.push({
      nodeId: ids[i],
      asset: it.asset,
      scaleMode: it.scaleMode,
      name: it.name
    });
  }
}

writeFileSync(join(EXPORT, 'upload-pairs.json'), JSON.stringify(pairs, null, 2));
console.log(`pairs: ${pairs.length}, skipped-empty: ${skippedEmpty}, mismatches: ${mismatches.length}`);
if (mismatches.length) for (const m of mismatches) console.log(' ', m);
