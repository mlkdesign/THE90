/* Runs the post-export pipeline in order:
     1. pin anything auto-layout cannot reproduce back to the measured size
     2. mark the blocks the design repeats so they become components
     3. dry-run the plugin against a stand-in Figma API
     4. draw the result as HTML so it can be looked at
   Capture the screens from the browser first (see README.md). */
import { execFileSync } from 'node:child_process';

const DIR = new URL('.', import.meta.url).pathname;
const steps = [
  ['verify.mjs', ['--fix'], 'geometry'],
  ['components.mjs', [], 'components'],
  ['simulate.mjs', [], 'plugin dry-run'],
  ['render.mjs', [], 'preview']
];

for (const [file, args, label] of steps) {
  process.stdout.write('\n── ' + label + '\n');
  process.stdout.write(execFileSync('node', [DIR + file, ...args], { encoding: 'utf8' }));
}
