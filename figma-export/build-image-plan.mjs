// Walks each screen JSON in the SAME order the plugin's buildScreen/buildNode
// walks (shell by z, then scene; each node visits itself then children[]).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/jackmilka/Desktop/THE90';
const SCREENS_DIR = join(ROOT, 'figma-export', 'screens');

function walkNode(spec, out) {
  if (!spec || typeof spec !== 'object') return;
  // Record every IMAGE node the plugin creates, even when the asset is empty
  // (e.g. avatar-unlock__preview). The plugin still spawns a placeholder rectangle
  // that lands in figma-inventory.json — dropping empty-asset entries here desyncs
  // the two lists and breaks the positional pairing downstream.
  if (spec.type === 'IMAGE') {
    out.push({
      name: spec.name || 'img',
      w: Math.round(spec.w || 0),
      h: Math.round(spec.h || 0),
      asset: spec.asset || '',
      scaleMode: spec.scaleMode || 'FILL'
    });
  }
  // Then walk children in order
  if (Array.isArray(spec.children)) {
    for (const c of spec.children) walkNode(c, out);
  }
}

function walkScreen(data) {
  const out = [];
  const scene = data.scene;
  // Match the plugin: shell[] sorted by z, then scene (default z 5000)
  const stack = (scene.shell || []).map(s => ({ spec: s, z: s.z || 0 }));
  stack.push({ spec: scene, z: scene.z === undefined ? 5000 : scene.z });
  stack.sort((a, b) => a.z - b.z);
  for (const item of stack) walkNode(item.spec, out);
  return out;
}

const plan = {};
for (const fn of readdirSync(SCREENS_DIR).sort()) {
  if (!fn.endsWith('.json')) continue;
  const data = JSON.parse(readFileSync(join(SCREENS_DIR, fn), 'utf8'));
  const name = data.screen || fn.replace('.json','');
  plan[name] = walkScreen(data);
}

writeFileSync(join(ROOT, 'figma-export', 'image-plan.json'), JSON.stringify(plan, null, 2));
console.log('screens:', Object.keys(plan).length);
for (const [k, v] of Object.entries(plan)) console.log(`  ${v.length.toString().padStart(4)}  ${k}`);
