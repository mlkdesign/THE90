/* =========================================================================
   A stand-in for the Figma plugin API, good enough to run plugin/code.js for
   real: it enforces the constraints Figma enforces (FILL needs an auto-layout
   parent, WRAP needs a fixed main axis, a font must be loaded before it is
   used), resolves auto-layout the way Figma resolves it, and then draws the
   result as HTML so the rebuild can be looked at next to the prototype.
   ========================================================================= */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
const errors = [];
const fail = m => { errors.push(m); };

/* --------------------------------------------------------------- the nodes */

let idSeq = 0;
const FONTS = {
  Sora: ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold'],
  Inter: ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black']
};
const loaded = new Set();

class Node {
  constructor(type) {
    this.type = type; this.id = String(++idSeq); this.name = type.toLowerCase();
    this.x = 0; this.y = 0; this.width = 100; this.height = 100;
    this.fills = []; this.strokes = []; this.effects = [];
    this.opacity = 1; this.blendMode = 'PASS_THROUGH'; this.visible = true;
    this.children = []; this.parent = null;
    this.layoutMode = 'NONE'; this.layoutWrap = 'NO_WRAP';
    this.itemSpacing = 0; this.counterAxisSpacing = 0;
    this.paddingTop = this.paddingRight = this.paddingBottom = this.paddingLeft = 0;
    this.primaryAxisAlignItems = 'MIN'; this.counterAxisAlignItems = 'MIN';
    this.primaryAxisSizingMode = 'AUTO'; this.counterAxisSizingMode = 'AUTO';
    this.layoutPositioning = 'AUTO';
    this._sizing = { h: 'FIXED', v: 'FIXED' };
    this.strokeAlign = 'INSIDE'; this.strokeWeight = 1;
    this.clipsContent = false;
    this.constraints = { horizontal: 'MIN', vertical: 'MIN' };
  }

  appendChild(n) {
    if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1);
    n.parent = this; this.children.push(n);
  }
  insertChild(i, n) {
    if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1);
    n.parent = this; this.children.splice(i, 0, n);
  }
  resize(w, h) {
    if (this.type === 'TEXT' && this.textAutoResize === 'WIDTH_AND_HEIGHT') fail(`resize on hugging text "${this.name}"`);
    this.width = w; this.height = h;
  }
  resizeWithoutConstraints(w, h) { this.resize(w, h); }

  get layoutSizingHorizontal() { return this._sizing.h; }
  set layoutSizingHorizontal(v) { this._setSizing('h', v); }
  get layoutSizingVertical() { return this._sizing.v; }
  set layoutSizingVertical(v) { this._setSizing('v', v); }

  _setSizing(axis, v) {
    const parentAuto = this.parent && this.parent.layoutMode !== 'NONE';
    if (v === 'FILL' && !parentAuto) throw new Error(`FILL needs an auto-layout parent ("${this.name}")`);
    if (v === 'FILL' && this.layoutPositioning === 'ABSOLUTE') throw new Error(`FILL on an absolute child ("${this.name}")`);
    if (v === 'HUG' && this.layoutMode === 'NONE' && this.type !== 'TEXT') throw new Error(`HUG needs auto-layout ("${this.name}")`);
    this._sizing[axis] = v;
    const mode = (axis === 'h') === (this.layoutMode === 'HORIZONTAL') ? 'primaryAxisSizingMode' : 'counterAxisSizingMode';
    if (this.layoutMode !== 'NONE') this[mode] = v === 'HUG' ? 'AUTO' : 'FIXED';
  }
}

function guard(node) {
  return new Proxy(node, {
    set(t, k, v) {
      if (k === 'layoutWrap' && v === 'WRAP') {
        if (t.layoutMode !== 'HORIZONTAL') { fail(`WRAP on a ${t.layoutMode} frame ("${t.name}")`); return true; }
        if (t.primaryAxisSizingMode === 'AUTO') { fail(`WRAP while the main axis hugs ("${t.name}")`); return true; }
      }
      if (k === 'primaryAxisAlignItems' && v === 'SPACE_BETWEEN' && t.primaryAxisSizingMode === 'AUTO') {
        fail(`SPACE_BETWEEN while the main axis hugs ("${t.name}")`); return true;
      }
      if (k === 'counterAxisAlignItems' && v === 'BASELINE' && t.layoutMode !== 'HORIZONTAL') {
        fail(`BASELINE on a ${t.layoutMode} frame ("${t.name}")`); return true;
      }
      t[k] = v;
      return true;
    }
  });
}

/* ---------------------------------------------------------------- the text */

const CHAR_W = 0.55;   // rough Sora advance, only used to sanity-check hugs

class TextNode extends Node {
  constructor() {
    super('TEXT');
    this.characters = ''; this.fontSize = 12;
    this.fontName = { family: 'Inter', style: 'Regular' };
    this.lineHeight = { unit: 'AUTO' }; this.letterSpacing = { value: 0, unit: 'PIXELS' };
    this.textAlignHorizontal = 'LEFT'; this.textAlignVertical = 'TOP';
    this.textAutoResize = 'WIDTH_AND_HEIGHT'; this.textStyleId = '';
    this.ranges = [];
  }
  _range(a, b, patch) {
    if (a < 0 || b > this.characters.length || b < a) fail(`bad text range ${a}..${b} on "${this.name}"`);
    this.ranges.push(Object.assign({ start: a, end: b }, patch));
  }
  setRangeFontName(a, b, fn) {
    if (!loaded.has(fn.family + '|' + fn.style)) throw new Error(`font not loaded: ${fn.family} ${fn.style}`);
    this._range(a, b, { fontName: fn });
  }
  setRangeFontSize(a, b, v) { this._range(a, b, { fontSize: v }); }
  setRangeLineHeight(a, b, v) { this._range(a, b, { lineHeight: v }); }
  setRangeLetterSpacing(a, b, v) { this._range(a, b, { letterSpacing: v }); }
  setRangeFills(a, b, v) { this._range(a, b, { fills: v }); }
  setRangeTextDecoration(a, b, v) { this._range(a, b, { decoration: v }); }
  setRangeTextCase(a, b, v) { this._range(a, b, { textCase: v }); }
  async setTextStyleIdAsync(id) { this.textStyleId = id; }
}

/* ------------------------------------------------------------------ figma */

const page = guard(new Node('PAGE'));
page.name = 'From prototype';

const variables = [];
const textStyleObjects = [];

function parseSvg(markup) {
  const f = guard(new Node('FRAME'));
  f.name = 'svg';
  const m = markup.match(/viewBox\s*=\s*"([-\d.\s]+)"/i);
  if (m) { const p = m[1].trim().split(/\s+/).map(Number); f.width = p[2]; f.height = p[3]; }
  else {
    const w = markup.match(/\bwidth\s*=\s*"([\d.]+)/), h = markup.match(/\bheight\s*=\s*"([\d.]+)/);
    f.width = w ? +w[1] : 24; f.height = h ? +h[1] : 24;
  }
  f.svg = markup;
  return f;
}

const figma = {
  currentPage: page,
  viewport: { scrollAndZoomIntoView() {} },
  closePlugin() {},
  showUI() {},
  ui: { onmessage: null, postMessage(m) { inbox.push(m); } },

  createFrame() { const n = guard(new Node('FRAME')); n.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }]; return n; },
  createRectangle() { return guard(new Node('RECTANGLE')); },
  createText() { return guard(new TextNode()); },
  createNodeFromSvg(markup) { return parseSvg(markup); },
  createComponentFromNode(node) {
    const c = guard(new Node('COMPONENT'));
    c.name = node.name; c.width = node.width; c.height = node.height;
    c.layoutMode = node.layoutMode; c.children = node.children;
    c.master = true;
    c.createInstance = () => {
      const i = guard(new Node('INSTANCE'));
      i.name = c.name; i.width = c.width; i.height = c.height; i.layoutMode = c.layoutMode;
      return i;
    };
    const p = node.parent;
    if (p) { const idx = p.children.indexOf(node); p.children.splice(idx, 1, c); c.parent = p; }
    return c;
  },
  async createImageAsync(url) {
    const path = url.replace(/^https?:\/\/[^/]+\//, '');
    return { hash: 'img:' + path };
  },
  async loadFontAsync(fn) {
    const list = FONTS[fn.family];
    if (!list || !list.includes(fn.style)) throw new Error('font not available');
    loaded.add(fn.family + '|' + fn.style);
  },
  createTextStyle() { const s = { id: 'S' + (++idSeq), type: 'TEXT_STYLE' }; textStyleObjects.push(s); return s; },
  variables: {
    createVariableCollection(name) { return { id: 'C1', name, modes: [{ modeId: 'M1', name: 'Default' }] }; },
    createVariable(name, collection, type) {
      if (variables.some(v => v.name === name)) throw new Error('duplicate variable ' + name);
      const v = { id: 'V' + (++idSeq), name, type, values: {}, setValueForMode(m, val) { this.values[m] = val; } };
      variables.push(v); return v;
    },
    setBoundVariableForPaint(paint, field, variable) {
      return Object.assign({}, paint, { boundVariables: { [field]: { type: 'VARIABLE_ALIAS', id: variable.id } } });
    }
  }
};

/* ---------------------------------------------------------------- the run */

const inbox = [];
const code = readFileSync(join(DIR, 'plugin', 'code.js'), 'utf8');
new Function('figma', '__html__', code)(figma, '<html></html>');

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const tokens = JSON.parse(readFileSync(join(DIR, 'tokens.json'), 'utf8')).tokens;
const assets = JSON.parse(readFileSync(join(DIR, 'assets.json'), 'utf8')).assets;
const scenes = index.entries.map(e => ({ entry: e, data: JSON.parse(readFileSync(join(DIR, e.file), 'utf8')) }));

/* the survey the plugin UI does before it hands anything over */
const colorKey = c => [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)].join(',');
const colors = new Map(), styles = new Map();
const visit = n => {
  for (const p of (n.fills || []).concat(n.strokes || [])) if (p.type === 'SOLID') colors.set(colorKey(p.color), p.color);
  if (n.text) for (const s of n.text.segments) {
    const st = s.style;
    colors.set(colorKey(st.color), { r: st.color.r, g: st.color.g, b: st.color.b });
    const k = [st.family, st.style, st.size, st.lineHeight === null ? 'auto' : st.lineHeight, st.letterSpacing].join('|');
    const rec = styles.get(k) || { key: k, style: st, count: 0 };
    rec.count++; styles.set(k, rec);
  }
  for (const c of n.children || []) visit(c);
  for (const c of n.shell || []) visit(c);
};
scenes.forEach(s => visit(s.data.scene));
const textStyles = [...styles.values()].filter(s => s.count >= 5).sort((a, b) => b.count - a.count)
  .map(s => Object.assign({}, s, {
    name: s.style.family + '/' + s.style.style + '/' + s.style.size + ' · ' +
          (s.style.lineHeight === null ? 'auto' : s.style.lineHeight) + (s.style.letterSpacing ? ' +' + s.style.letterSpacing : '')
  }));

async function send(msg) {
  await figma.ui.onmessage(msg);
  const err = inbox.filter(m => m.type === 'error');
  if (err.length) { err.forEach(e => fail('plugin error: ' + e.message.split('\n')[0])); inbox.length = 0; }
}

const only = process.argv.find(a => !a.startsWith('-') && a.endsWith('.json'));
const run = only ? scenes.filter(s => s.entry.file.includes(only)) : scenes;

await send({ type: 'init', index, tokens, assets, usedColors: [...colors.values()], textStyles });
for (const s of run) await send({ type: 'scene', entry: s.entry, data: s.data });
await send({ type: 'finish' });

const done = inbox.find(m => m.type === 'done');

console.log(`simulated ${run.length} scenes`);
console.log(`variables: ${variables.length}   text styles: ${textStyleObjects.length}   boards: ${page.children.length}`);
let comps = 0, insts = 0, frames = 0, texts = 0, imgs = 0, masks = 0;
(function tally(n) {
  if (n.type === 'COMPONENT') comps++;
  else if (n.type === 'INSTANCE') insts++;
  else if (n.type === 'TEXT') texts++;
  else if (n.type === 'RECTANGLE') imgs++;
  else frames++;
  if (n.isMask) masks++;
  for (const c of n.children) tally(c);
})(page);
console.log(`nodes: ${frames} frames  ${texts} text  ${imgs} rect  ${comps} components  ${insts} instances  ${masks} masks`);
console.log(`api violations: ${errors.length}`);
[...new Set(errors)].slice(0, 25).forEach(e => console.log('  ✗ ' + e));
if (done && done.warnings.length) {
  console.log(`plugin notes: ${done.warnings.length}`);
  done.warnings.slice(0, 20).forEach(w => console.log('  · ' + w));
}

export { page, figma, errors };
