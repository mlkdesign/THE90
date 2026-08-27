/* =========================================================================
   THE90 → Figma
   Rebuilds the exported prototype scene graph as a real, editable Figma file:
   variables for the tokens, text styles for the type scale, auto-layout
   frames for every container the CSS laid out with flex, and absolute
   placement only where the CSS itself was absolute.
   ========================================================================= */

const ORIGIN = 'http://localhost:4173/';

const SECTIONS = [
  { name: '00 · Foundations', match: () => false },
  { name: '01 · Onboarding',  match: n => ['welcome', 'signin', 'create', 'profile', 'teams'].includes(n) },
  { name: '02 · Home & Live', match: n => ['main', 'live-match', 'rankings', 'ranks'].includes(n) },
  { name: '03 · Leagues',     match: n => n.startsWith('league') },
  { name: '04 · Arena',       match: n => n.startsWith('arena') },
  { name: '05 · My Zone',     match: n => ['my-zone', 'notifications', 'invite-friends'].includes(n) || n.startsWith('support') },
  { name: '06 · Settings',    match: n => n.startsWith('settings') },
  { name: '07 · Overlays',    match: () => true },
  { name: '08 · Components',  match: () => false }
];

const GUTTER = 80;

/* ------------------------------------------------------------------ state */

let tokensByColor = new Map();     // "r,g,b,a" -> Variable
let textStyles    = new Map();     // style key   -> TextStyle
let imageCache    = new Map();     // asset path  -> imageHash | null
let svgMarkup     = new Map();     // asset path  -> markup
let fontCache     = new Map();     // "family|style" -> resolved FontName
let boards        = new Map();     // board name  -> { board, rail }
let components    = new Map();     // fingerprint -> ComponentNode
let compRail      = null;
let placed        = [];
let warnings      = [];

/* ------------------------------------------------------------------ utils */

const key = c => [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), Math.round((c.a === undefined ? 1 : c.a) * 1000)].join(',');
const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase()).join('');
const clean = n => Math.round(n * 100) / 100;
const warn = m => { if (warnings.length < 60 && !warnings.includes(m)) warnings.push(m); };

/* ------------------------------------------------------------------ fonts */

const WEIGHT_LADDER = ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'];
const GENERIC = /^(-apple-system|BlinkMacSystemFont|system-ui|ui-sans-serif|sans-serif|serif|monospace|Segoe UI|Helvetica|Arial)$/i;

async function resolveFont(family, style) {
  const k = family + '|' + style;
  if (fontCache.has(k)) return fontCache.get(k);

  const fam = GENERIC.test(family) ? 'Inter' : family;
  const tries = [style];
  const i = WEIGHT_LADDER.indexOf(style.replace(' Italic', ''));
  if (i >= 0) for (let d = 1; d < WEIGHT_LADDER.length; d++) {
    if (WEIGHT_LADDER[i + d]) tries.push(WEIGHT_LADDER[i + d]);
    if (WEIGHT_LADDER[i - d]) tries.push(WEIGHT_LADDER[i - d]);
  }
  tries.push('Regular');

  for (const t of tries) {
    const fn = { family: fam, style: t };
    try { await figma.loadFontAsync(fn); fontCache.set(k, fn); if (t !== style) warn(`font: ${family} ${style} → ${fam} ${t}`); return fn; }
    catch (e) { /* try the next rung */ }
  }
  const fallback = { family: 'Inter', style: 'Regular' };
  await figma.loadFontAsync(fallback);
  fontCache.set(k, fallback);
  warn(`font: ${family} ${style} → Inter Regular`);
  return fallback;
}

/* ------------------------------------------------------------------ paint */

function solid(color, opacity) {
  const a = (color.a === undefined ? 1 : color.a) * (opacity === undefined ? 1 : opacity);
  const paint = { type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: a };
  const v = tokensByColor.get(key({ r: color.r, g: color.g, b: color.b, a: 1 }));
  if (v) { try { return figma.variables.setBoundVariableForPaint(paint, 'color', v); } catch (e) { /* keep it raw */ } }
  return paint;
}

async function toPaint(p) {
  if (p.type === 'SOLID') return solid(p.color, p.opacity);
  if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL') {
    return {
      type: p.type,
      gradientTransform: p.gradientTransform,
      gradientStops: p.gradientStops.map(s => ({
        position: s.position,
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a === undefined ? 1 : s.color.a }
      }))
    };
  }
  if (p.type === 'IMAGE') {
    const hash = await imageHash(p.asset);
    if (!hash) return { type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 }, opacity: 1 };
    const paint = { type: 'IMAGE', imageHash: hash, scaleMode: p.scaleMode === 'TILE' ? 'FILL' : (p.scaleMode || 'FILL') };
    return paint;
  }
  return null;
}

async function paints(list) {
  if (!list || !list.length) return [];
  const out = [];
  for (const p of list) { const q = await toPaint(p); if (q) out.push(q); }
  return out;
}

async function imageHash(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  let hash = null;
  try { const img = await figma.createImageAsync(ORIGIN + path); hash = img.hash; }
  catch (e) { warn('image: ' + path + ' — ' + e.message); }
  imageCache.set(path, hash);
  return hash;
}

/* ------------------------------------------------------------------ shape */

function applyRadius(node, r) {
  if (!r) return;
  try {
    node.topLeftRadius = r[0]; node.topRightRadius = r[1];
    node.bottomRightRadius = r[2]; node.bottomLeftRadius = r[3];
  } catch (e) { try { node.cornerRadius = r[0]; } catch (e2) { /* not a corner-bearing node */ } }
}

function applyStroke(node, spec) {
  if (!spec.strokes) return;
  node.strokes = spec.strokes.map(p => solid(p.color, p.opacity));
  node.strokeAlign = spec.strokeAlign || 'INSIDE';
  if (spec.dashPattern) { try { node.dashPattern = spec.dashPattern; } catch (e) { /* not dashable */ } }
  const w = spec.strokeWeights;
  if (!w) return;
  const same = w.t === w.r && w.r === w.b && w.b === w.l;
  if (same) { node.strokeWeight = w.t; return; }
  try {
    node.strokeTopWeight = w.t; node.strokeRightWeight = w.r;
    node.strokeBottomWeight = w.b; node.strokeLeftWeight = w.l;
  } catch (e) { node.strokeWeight = Math.max(w.t, w.r, w.b, w.l); }
}

function applyEffects(node, list) {
  if (!list || !list.length) return;
  node.effects = list.map(e => {
    if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
      return { type: e.type, radius: e.radius, visible: true };
    }
    return {
      type: e.type,
      color: { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a === undefined ? 1 : e.color.a },
      offset: e.offset, radius: e.radius, spread: e.spread || 0,
      visible: true, blendMode: 'NORMAL'
    };
  });
}

const BLEND = {
  MULTIPLY: 'MULTIPLY', SCREEN: 'SCREEN', OVERLAY: 'OVERLAY', DARKEN: 'DARKEN', LIGHTEN: 'LIGHTEN',
  COLOR_DODGE: 'COLOR_DODGE', COLOR_BURN: 'COLOR_BURN', HARD_LIGHT: 'HARD_LIGHT', SOFT_LIGHT: 'SOFT_LIGHT',
  DIFFERENCE: 'DIFFERENCE', EXCLUSION: 'EXCLUSION', HUE: 'HUE', SATURATION: 'SATURATION',
  COLOR: 'COLOR', LUMINOSITY: 'LUMINOSITY', PLUS_LIGHTER: 'LINEAR_DODGE'
};

async function applyCommon(node, spec) {
  node.name = spec.name || 'layer';
  if (spec.fills) node.fills = await paints(spec.fills);
  else if (node.type === 'FRAME' || node.type === 'RECTANGLE') node.fills = [];
  applyStroke(node, spec);
  applyRadius(node, spec.radius);
  applyEffects(node, spec.effects);
  if (spec.opacity !== undefined) node.opacity = spec.opacity;
  if (spec.blend && BLEND[spec.blend]) { try { node.blendMode = BLEND[spec.blend]; } catch (e) { /* unsupported here */ } }
}

/* ----------------------------------------------------------------- layout */

function applyAutoLayout(frame, l) {
  frame.layoutMode = l.mode;
  /* pin both axes first: SPACE_BETWEEN is rejected on an axis that hugs */
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';
  frame.itemSpacing = Math.max(0, l.gap || 0);
  frame.paddingTop = l.padT || 0; frame.paddingRight = l.padR || 0;
  frame.paddingBottom = l.padB || 0; frame.paddingLeft = l.padL || 0;
  frame.primaryAxisAlignItems = l.primary || 'MIN';
  const counter = l.counter === 'BASELINE' && l.mode !== 'HORIZONTAL' ? 'MIN' : (l.counter || 'MIN');
  frame.counterAxisAlignItems = counter;
  if (l.wrap && l.mode === 'HORIZONTAL') {
    frame.layoutWrap = 'WRAP';
    frame.counterAxisSpacing = l.rowGap || 0;
  }
}

/* FILL needs an auto-layout parent; HUG needs the node to hug something. */
function applySizing(node, spec, parentSpec) {
  const parentAuto = parentSpec && parentSpec.layout && parentSpec.layout.mode && parentSpec.layout.mode !== 'NONE';
  if (!parentAuto || spec.absolute) return;
  const s = spec.sizing || {};
  const canHug = node.type === 'TEXT' || (node.layoutMode && node.layoutMode !== 'NONE');
  for (const [axis, prop] of [['h', 'layoutSizingHorizontal'], ['v', 'layoutSizingVertical']]) {
    let want = s[axis] || 'FIXED';
    if (want === 'HUG' && !canHug) want = 'FIXED';
    try { node[prop] = want; } catch (e) { try { node[prop] = 'FIXED'; } catch (e2) { /* leave it */ } }
  }
}

function place(node, spec, parentSpec) {
  const parentAuto = parentSpec && parentSpec.layout && parentSpec.layout.mode && parentSpec.layout.mode !== 'NONE';
  if (parentAuto && spec.absolute) {
    try { node.layoutPositioning = 'ABSOLUTE'; } catch (e) { /* not in an auto-layout parent after all */ }
  }
  if (!parentAuto || spec.absolute) {
    node.x = spec.x || 0;
    node.y = spec.y || 0;
  }
  if (spec.anchors) {
    try { node.constraints = { horizontal: spec.anchors.h, vertical: spec.anchors.v }; } catch (e) { /* not constrainable */ }
  }
}

function safeResize(node, w, h) {
  const W = Math.max(0.01, w || 0.01), H = Math.max(0.01, h || 0.01);
  try { node.resizeWithoutConstraints(W, H); }
  catch (e) { try { node.resize(W, H); } catch (e2) { /* text auto-sizes */ } }
}

/* ------------------------------------------------------------------- text */

function styleKey(st) {
  return [st.family, st.style, st.size, st.lineHeight === null ? 'auto' : st.lineHeight, st.letterSpacing].join('|');
}

async function buildText(spec) {
  const t = figma.createText();
  const segs = spec.text.segments.length ? spec.text.segments : [{ start: 0, end: spec.text.characters.length, style: {
    family: 'Sora', style: 'Regular', size: 14, lineHeight: null, letterSpacing: 0,
    color: { r: 1, g: 1, b: 1, a: 1 }, decoration: 'NONE', case: 'ORIGINAL' } }];

  const first = await resolveFont(segs[0].style.family, segs[0].style.style);
  t.fontName = first;
  t.characters = spec.text.characters;

  for (const seg of segs) {
    const s = seg.style;
    const start = Math.max(0, Math.min(seg.start, t.characters.length));
    const end = Math.max(start, Math.min(seg.end, t.characters.length));
    if (end <= start) continue;
    const fn = await resolveFont(s.family, s.style);
    try {
      t.setRangeFontName(start, end, fn);
      t.setRangeFontSize(start, end, s.size);
      t.setRangeLineHeight(start, end, s.lineHeight ? { value: s.lineHeight, unit: 'PIXELS' } : { unit: 'AUTO' });
      t.setRangeLetterSpacing(start, end, { value: s.letterSpacing || 0, unit: 'PIXELS' });
      t.setRangeFills(start, end, [solid(s.color)]);
      if (s.decoration && s.decoration !== 'NONE') t.setRangeTextDecoration(start, end, s.decoration);
      if (s.case && s.case !== 'ORIGINAL') t.setRangeTextCase(start, end, s.case);
    } catch (e) { warn('text range: ' + e.message); }
  }

  t.textAlignHorizontal = spec.text.align || 'LEFT';
  t.textAlignVertical = spec.text.vAlign === 'CENTER' ? 'CENTER' : spec.text.vAlign === 'BOTTOM' ? 'BOTTOM' : 'TOP';

  const s = spec.sizing || {};
  t.textAutoResize = s.v === 'HUG' ? (s.h === 'HUG' ? 'WIDTH_AND_HEIGHT' : 'HEIGHT') : 'NONE';
  if (spec.text.truncate) { try { t.textTruncation = 'ENDING'; } catch (e) { /* older API */ } }
  if (spec.text.nowrap && t.textAutoResize !== 'WIDTH_AND_HEIGHT') {
    try { t.maxLines = Math.max(1, spec.text.lines || 1); } catch (e) { /* older API */ }
  }

  /* one style for the whole run gets a named text style — mixed runs stay raw */
  if (segs.length === 1) {
    const st = textStyles.get(styleKey(segs[0].style));
    if (st) { try { await t.setTextStyleIdAsync(st.id); } catch (e) { try { t.textStyleId = st.id; } catch (e2) {} } }
  }
  return t;
}

/* -------------------------------------------------------------------- svg */

function buildSvg(spec) {
  const markup = spec.markup || svgMarkup.get(spec.asset);
  if (!markup) { const r = figma.createRectangle(); r.fills = []; return r; }
  let node;
  try { node = figma.createNodeFromSvg(markup); }
  catch (e) { warn('svg: ' + (spec.asset || spec.name) + ' — ' + e.message); const r = figma.createRectangle(); r.fills = []; return r; }
  node.fills = [];
  const w = spec.w || node.width, h = spec.h || node.height;
  if (Math.abs(node.width - w) > 0.1 || Math.abs(node.height - h) > 0.1) {
    for (const c of node.children) { try { c.constraints = { horizontal: 'SCALE', vertical: 'SCALE' }; } catch (e) {} }
    safeResize(node, w, h);
  }
  return node;
}

/* ------------------------------------------------------------------ build */

async function buildNode(spec, parent, parentSpec) {
  let node;

  /* a block the design repeats is built once and dropped in as an instance */
  if (spec.comp) {
    const made = components.get(spec.comp);
    if (made) return dropInstance(made, spec, parent, parentSpec);
    const plain = Object.assign({}, spec); delete plain.comp;
    const built = await buildNode(plain, parent, parentSpec);
    return await promote(built, spec, parent, parentSpec);
  }

  /* A CSS gradient mask has no direct equivalent on a single layer, so the
     node moves inside a group with an alpha mask above it — the way it would
     have been drawn by hand. */
  if (spec.mask) {
    const wrap = figma.createFrame();
    wrap.name = (spec.name || 'layer') + ' · masked';
    wrap.fills = [];
    wrap.clipsContent = false;
    wrap.resize(Math.max(0.01, spec.w), Math.max(0.01, spec.h));
    parent.appendChild(wrap);
    place(wrap, spec, parentSpec);

    const inner = Object.assign({}, spec);
    delete inner.mask;
    inner.x = 0; inner.y = 0; inner.absolute = false;
    inner.sizing = { h: 'FIXED', v: 'FIXED' };
    await buildNode(inner, wrap, { layout: null });

    const m = figma.createRectangle();
    m.name = 'mask';
    m.resize(Math.max(0.01, spec.w), Math.max(0.01, spec.h));
    m.fills = await paints(spec.mask);
    applyRadius(m, spec.radius);
    wrap.appendChild(m);
    wrap.insertChild(0, m);
    m.isMask = true;
    try { m.maskType = 'ALPHA'; } catch (e) { /* older files only do vector masks */ }

    applySizing(wrap, spec, parentSpec);
    return wrap;
  }

  if (spec.type === 'TEXT') {
    node = await buildText(spec);
    parent.appendChild(node);
    if (node.textAutoResize === 'NONE') safeResize(node, spec.w, spec.h);
    else if (node.textAutoResize === 'HEIGHT') safeResize(node, spec.w, node.height);
    place(node, spec, parentSpec);
    applySizing(node, spec, parentSpec);
    return node;
  }

  if (spec.type === 'SVG') {
    node = buildSvg(spec);
    node.name = spec.name || 'icon';
    parent.appendChild(node);
    place(node, spec, parentSpec);
    applySizing(node, spec, parentSpec);
    return node;
  }

  if (spec.type === 'IMAGE') {
    node = figma.createRectangle();
    node.name = spec.name || 'image';
    const hash = await imageHash(spec.asset);
    node.fills = hash
      ? [{ type: 'IMAGE', imageHash: hash, scaleMode: spec.scaleMode || 'FILL' }]
      : [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.15 }, opacity: 1 }];
    applyRadius(node, spec.radius);
    applyStroke(node, spec);
    applyEffects(node, spec.effects);
    if (spec.opacity !== undefined) node.opacity = spec.opacity;
    safeResize(node, spec.w, spec.h);
    parent.appendChild(node);
    place(node, spec, parentSpec);
    applySizing(node, spec, parentSpec);
    return node;
  }

  /* frame */
  node = figma.createFrame();
  await applyCommon(node, spec);
  node.clipsContent = !!spec.clip;
  safeResize(node, spec.w, spec.h);
  if (spec.layout && spec.layout.mode && spec.layout.mode !== 'NONE') applyAutoLayout(node, spec.layout);
  parent.appendChild(node);
  place(node, spec, parentSpec);

  for (const child of spec.children || []) {
    try { await buildNode(child, node, spec); }
    catch (e) { warn('node "' + (child.name || '?') + '": ' + e.message); }
  }

  if (spec.overflow) { try { node.overflowDirection = spec.overflow; } catch (e) {} }
  applySizing(node, spec, parentSpec);

  /* a hug that landed on the wrong number means the CSS was doing something
     auto-layout cannot say — pin it back to what the browser measured */
  const s = spec.sizing || {};
  const parentAuto = parentSpec && parentSpec.layout && parentSpec.layout.mode !== 'NONE';
  if (parentAuto) {
    if (s.h === 'HUG' && Math.abs(node.width - spec.w) > 1.5) { try { node.layoutSizingHorizontal = 'FIXED'; safeResize(node, spec.w, node.height); } catch (e) {} }
    if (s.v === 'HUG' && Math.abs(node.height - spec.h) > 1.5) { try { node.layoutSizingVertical = 'FIXED'; safeResize(node, node.width, spec.h); } catch (e) {} }
  }
  return node;
}

/* -------------------------------------------------------------- reuse ---- */

function dropInstance(comp, spec, parent, parentSpec) {
  const inst = comp.createInstance();
  parent.appendChild(inst);
  inst.name = spec.name;
  const s = spec.sizing || {};
  if (s.h !== 'FILL' && s.v !== 'FILL') { try { inst.resize(Math.max(0.01, spec.w), Math.max(0.01, spec.h)); } catch (e) { /* keeps the master size */ } }
  place(inst, spec, parentSpec);
  applySizing(inst, spec, parentSpec);
  return inst;
}

async function promote(node, spec, parent, parentSpec) {
  try {
    const idx = parent.children.indexOf(node);
    const comp = figma.createComponentFromNode(node);
    comp.name = spec.compName || spec.name;

    /* lift the master out of the layout it was born in before that layout gets
       a chance to resize it — every instance would inherit the wrong size */
    const rail = await componentRail();
    rail.appendChild(comp);
    if (Math.abs(comp.width - spec.w) > 0.5 || Math.abs(comp.height - spec.h) > 0.5) {
      try { comp.resizeWithoutConstraints(Math.max(0.01, spec.w), Math.max(0.01, spec.h)); } catch (e) { /* hugs its own content */ }
    }
    components.set(spec.comp, comp);

    const inst = comp.createInstance();
    parent.insertChild(idx, inst);
    inst.name = spec.name;
    place(inst, spec, parentSpec);
    applySizing(inst, spec, parentSpec);
    return inst;
  } catch (e) {
    warn('component "' + (spec.compName || spec.name) + '": ' + e.message);
    return node;
  }
}

async function componentRail() {
  if (compRail) return compRail;
  const { rail } = await ensureBoard('08 · Components');
  rail.itemSpacing = 32;
  rail.counterAxisSpacing = 32;
  rail.counterAxisAlignItems = 'CENTER';
  compRail = rail;
  return rail;
}

/* ------------------------------------------------------------- the screen */

async function buildScreen(entry, data) {
  const scene = data.scene;
  const dev = scene.device || { w: 390, h: 852 };

  const frame = figma.createFrame();
  frame.name = entry.label;
  frame.resizeWithoutConstraints(dev.w, dev.h);
  frame.clipsContent = true;
  frame.fills = [{ type: 'SOLID', color: { r: 0.055, g: 0.055, b: 0.055 }, opacity: 1 }];
  frame.layoutMode = 'NONE';

  const stack = (scene.shell || []).map(s => ({ spec: s, z: s.z || 0 }));
  stack.push({ spec: scene, z: scene.z === undefined ? 5000 : scene.z });
  stack.sort((a, b) => a.z - b.z);

  const hostSpec = { layout: null };
  for (const item of stack) {
    const spec = Object.assign({}, item.spec);
    if (item.spec === scene) { spec.x = 0; spec.y = 0; spec.name = 'screen · ' + entry.base; }
    spec.absolute = false;
    delete spec.shell;
    try { await buildNode(spec, frame, hostSpec); }
    catch (e) { warn(entry.label + ': ' + e.message); }
  }

  return frame;
}

/* ------------------------------------------------------- page composition */

/* Boards, not sections: a plain auto-layout frame lays its screens out the
   same way every time, and nothing here depends on how the canvas decides to
   position a section's children. */

const BOARD_COLS = 6;

function title(base, kind) {
  if (kind === 'overlay') return '07 · Overlays';
  for (const s of SECTIONS) if (s.match(base)) return s.name;
  return '07 · Overlays';
}

async function ensureBoard(name) {
  if (boards.has(name)) return boards.get(name);

  const board = figma.createFrame();
  board.name = name;
  board.layoutMode = 'VERTICAL';
  board.primaryAxisSizingMode = 'AUTO';
  board.counterAxisSizingMode = 'AUTO';
  board.itemSpacing = 40;
  board.paddingTop = board.paddingBottom = 72;
  board.paddingLeft = board.paddingRight = 72;
  board.cornerRadius = 24;
  board.fills = [{ type: 'SOLID', color: { r: 0.043, g: 0.043, b: 0.043 }, opacity: 1 }];
  board.clipsContent = false;
  figma.currentPage.appendChild(board);

  const heading = figma.createText();
  heading.fontName = await resolveFont('Sora', 'ExtraBold');
  heading.characters = name;
  heading.fontSize = 40;
  heading.letterSpacing = { value: -0.5, unit: 'PIXELS' };
  heading.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.98, b: 0.97 } }];
  board.appendChild(heading);
  heading.textAutoResize = 'WIDTH_AND_HEIGHT';

  const rail = figma.createFrame();
  rail.name = 'screens';
  rail.layoutMode = 'HORIZONTAL';
  rail.primaryAxisSizingMode = 'FIXED';
  rail.counterAxisSizingMode = 'AUTO';
  rail.layoutWrap = 'WRAP';
  rail.itemSpacing = GUTTER;
  rail.counterAxisSpacing = GUTTER;
  rail.fills = [];
  rail.clipsContent = false;
  board.appendChild(rail);
  rail.resize(BOARD_COLS * 390 + (BOARD_COLS - 1) * GUTTER, 100);
  rail.layoutSizingHorizontal = 'FIXED';
  rail.layoutSizingVertical = 'HUG';

  const rec = { board, rail };
  boards.set(name, rec);
  return rec;
}

async function placeOnBoard(name, frame, label) {
  const { rail } = await ensureBoard(name);

  const card = figma.createFrame();
  card.name = label;
  card.layoutMode = 'VERTICAL';
  card.itemSpacing = 14;
  card.fills = [];
  card.clipsContent = false;
  rail.appendChild(card);
  card.layoutSizingHorizontal = 'HUG';
  card.layoutSizingVertical = 'HUG';

  const cap = figma.createText();
  cap.fontName = await resolveFont('Sora', 'SemiBold');
  cap.characters = label;
  cap.fontSize = 15;
  cap.fills = [{ type: 'SOLID', color: { r: 0.65, g: 0.72, b: 0.68 } }];
  card.appendChild(cap);
  cap.textAutoResize = 'WIDTH_AND_HEIGHT';

  card.appendChild(frame);
  frame.layoutSizingHorizontal = 'FIXED';
  frame.layoutSizingVertical = 'FIXED';
}

function layoutBoards() {
  let y = 0;
  for (const s of SECTIONS) {
    const rec = boards.get(s.name);
    if (!rec) continue;
    rec.board.x = 0;
    rec.board.y = y;
    y += rec.board.height + 160;
  }
}

/* ------------------------------------------------------------ foundations */

async function buildFoundations(tokens, palette, styleList) {
  const { rail } = await ensureBoard('00 · Foundations');
  const sora = await resolveFont('Sora', 'SemiBold');
  const soraR = await resolveFont('Sora', 'Regular');

  const board = figma.createFrame();
  board.name = 'Design tokens';
  board.layoutMode = 'VERTICAL';
  board.itemSpacing = 40;
  board.paddingTop = board.paddingBottom = board.paddingLeft = board.paddingRight = 48;
  board.fills = [{ type: 'SOLID', color: { r: 0.055, g: 0.055, b: 0.055 }, opacity: 1 }];
  board.primaryAxisSizingMode = 'AUTO';
  board.counterAxisSizingMode = 'FIXED';
  board.resize(1500, 400);
  rail.appendChild(board);
  board.layoutSizingHorizontal = 'FIXED';
  board.layoutSizingVertical = 'HUG';

  const heading = (text, size) => {
    const t = figma.createText();
    t.fontName = sora; t.characters = text; t.fontSize = size;
    t.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.98, b: 0.97 } }];
    return t;
  };

  board.appendChild(heading('THE90 — design tokens', 32));

  /* colours */
  const colorBlock = figma.createFrame();
  colorBlock.name = 'Colour';
  colorBlock.layoutMode = 'VERTICAL'; colorBlock.itemSpacing = 16;
  colorBlock.fills = []; colorBlock.primaryAxisSizingMode = 'AUTO';
  board.appendChild(colorBlock);
  colorBlock.layoutSizingHorizontal = 'FILL';
  colorBlock.appendChild(heading('Colour', 20));

  const grid = figma.createFrame();
  grid.name = 'Swatches';
  grid.layoutMode = 'HORIZONTAL';
  grid.primaryAxisSizingMode = 'FIXED';
  grid.counterAxisSizingMode = 'AUTO';
  grid.layoutWrap = 'WRAP';
  grid.itemSpacing = 12; grid.counterAxisSpacing = 12;
  grid.fills = [];
  colorBlock.appendChild(grid);
  grid.layoutSizingHorizontal = 'FILL';
  grid.layoutSizingVertical = 'HUG';

  for (const entry of palette) {
    const cell = figma.createFrame();
    cell.name = entry.name;
    cell.layoutMode = 'VERTICAL'; cell.itemSpacing = 8;
    cell.paddingTop = cell.paddingBottom = cell.paddingLeft = cell.paddingRight = 10;
    cell.cornerRadius = 12;
    cell.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 }, opacity: 1 }];
    cell.primaryAxisSizingMode = 'AUTO'; cell.counterAxisSizingMode = 'FIXED';
    cell.resizeWithoutConstraints(140, 100);
    grid.appendChild(cell);

    const chip = figma.createRectangle();
    chip.name = 'swatch';
    chip.cornerRadius = 8;
    chip.fills = [solid(entry.color)];
    chip.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.1 }];
    chip.strokeWeight = 1;
    chip.resize(120, 44);
    cell.appendChild(chip);
    chip.layoutSizingHorizontal = 'FILL';

    const label = figma.createText();
    label.fontName = soraR; label.fontSize = 11; label.characters = entry.name + '\n' + entry.hex;
    label.lineHeight = { value: 16, unit: 'PIXELS' };
    label.fills = [{ type: 'SOLID', color: { r: 0.65, g: 0.72, b: 0.68 } }];
    label.textAutoResize = 'HEIGHT';
    cell.appendChild(label);
    label.layoutSizingHorizontal = 'FILL';
  }

  /* type */
  const typeBlock = figma.createFrame();
  typeBlock.name = 'Type';
  typeBlock.layoutMode = 'VERTICAL'; typeBlock.itemSpacing = 12;
  typeBlock.fills = []; typeBlock.primaryAxisSizingMode = 'AUTO';
  board.appendChild(typeBlock);
  typeBlock.layoutSizingHorizontal = 'FILL';
  typeBlock.appendChild(heading('Type scale — Sora', 20));

  for (const st of styleList) {
    const row = figma.createFrame();
    row.name = st.name;
    row.layoutMode = 'HORIZONTAL'; row.itemSpacing = 24; row.counterAxisAlignItems = 'CENTER';
    row.fills = []; row.primaryAxisSizingMode = 'AUTO';
    typeBlock.appendChild(row);
    row.layoutSizingHorizontal = 'FILL';

    const tag = figma.createText();
    tag.fontName = soraR; tag.fontSize = 12; tag.characters = st.name;
    tag.fills = [{ type: 'SOLID', color: { r: 0.65, g: 0.72, b: 0.68 } }];
    row.appendChild(tag);
    tag.textAutoResize = 'NONE'; tag.resize(230, 20);

    const sample = figma.createText();
    const fn = await resolveFont(st.style.family, st.style.style);
    sample.fontName = fn; sample.characters = 'Every match counts';
    sample.fontSize = st.style.size;
    if (st.style.lineHeight) sample.lineHeight = { value: st.style.lineHeight, unit: 'PIXELS' };
    sample.letterSpacing = { value: st.style.letterSpacing || 0, unit: 'PIXELS' };
    sample.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.98, b: 0.97 } }];
    row.appendChild(sample);
    sample.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
}

/* ------------------------------------------------------------- variables */

function tokenName(cssName) {
  const n = cssName.replace(/^--/, '');
  const parts = n.split('-');
  const head = ['brand', 'bg', 'text', 'input', 'status', 'r', 'screen', 'dev', 'bezel'];
  if (head.includes(parts[0]) && parts.length > 1) return parts[0] + '/' + parts.slice(1).join('-');
  return 'misc/' + n;
}

function setupVariables(tokens, usedColors) {
  let collection;
  try { collection = figma.variables.createVariableCollection('THE90'); }
  catch (e) { warn('variables: ' + e.message); return []; }
  const mode = collection.modes[0].modeId;
  const palette = [];
  const seen = new Set();

  for (const t of tokens) {
    if (!t.color) continue;
    const k = key({ r: t.color.r, g: t.color.g, b: t.color.b, a: 1 });
    const name = 'color/' + tokenName(t.name);
    try {
      const v = figma.variables.createVariable(name, collection, 'COLOR');
      v.setValueForMode(mode, { r: t.color.r, g: t.color.g, b: t.color.b, a: 1 });
      if (!tokensByColor.has(k)) tokensByColor.set(k, v);
      if (!seen.has(k)) { seen.add(k); palette.push({ name: tokenName(t.name), hex: hex(t.color), color: t.color }); }
    } catch (e) { warn('variable ' + name + ': ' + e.message); }
  }

  for (const t of tokens) {
    if (t.number === null || t.number === undefined) continue;
    try {
      const v = figma.variables.createVariable('size/' + tokenName(t.name).replace(/^[a-z]+\//, ''), collection, 'FLOAT');
      v.setValueForMode(mode, t.number);
    } catch (e) { /* duplicate names are fine to skip */ }
  }

  /* every other colour the design actually paints with, so nothing is loose */
  for (const c of usedColors) {
    const k = key({ r: c.r, g: c.g, b: c.b, a: 1 });
    if (tokensByColor.has(k)) continue;
    const name = 'color/palette/' + hex(c).slice(1);
    try {
      const v = figma.variables.createVariable(name, collection, 'COLOR');
      v.setValueForMode(mode, { r: c.r, g: c.g, b: c.b, a: 1 });
      tokensByColor.set(k, v);
      palette.push({ name: 'palette/' + hex(c).slice(1), hex: hex(c), color: c });
    } catch (e) { /* skip */ }
  }
  return palette;
}

async function setupTextStyles(list) {
  const out = [];
  for (const st of list) {
    const fn = await resolveFont(st.style.family, st.style.style);
    try {
      const s = figma.createTextStyle();
      s.name = st.name;
      s.fontName = fn;
      s.fontSize = st.style.size;
      s.lineHeight = st.style.lineHeight ? { value: st.style.lineHeight, unit: 'PIXELS' } : { unit: 'AUTO' };
      s.letterSpacing = { value: st.style.letterSpacing || 0, unit: 'PIXELS' };
      textStyles.set(st.key, s);
      out.push(st);
    } catch (e) { warn('text style ' + st.name + ': ' + e.message); }
  }
  return out;
}

/* ------------------------------------------------------------------- main */

figma.showUI(__html__, { width: 400, height: 520, themeColors: true });

let INDEX = null;

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'init') return void await onInit(msg);
    if (msg.type === 'scene') return void await onScene(msg);
    if (msg.type === 'finish') return void await onFinish();
    if (msg.type === 'cancel') figma.closePlugin();
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: e.message + '\n' + (e.stack || '') });
  }
};

async function onInit(msg) {
  tokensByColor = new Map(); textStyles = new Map(); imageCache = new Map();
  svgMarkup = new Map(); fontCache = new Map(); boards = new Map();
  components = new Map(); compRail = null; placed = []; warnings = [];

  INDEX = msg.index;

  for (const a of msg.assets) if (a.kind === 'svg' && a.markup) svgMarkup.set(a.path, a.markup);

  await resolveFont('Sora', 'Regular');
  await resolveFont('Sora', 'SemiBold');

  figma.ui.postMessage({ type: 'status', text: 'Creating variables…' });
  const palette = setupVariables(msg.tokens, msg.usedColors || []);

  figma.ui.postMessage({ type: 'status', text: 'Creating text styles…' });
  const styleList = await setupTextStyles(msg.textStyles || []);

  figma.ui.postMessage({ type: 'status', text: 'Building foundations…' });
  await buildFoundations(msg.tokens, palette, styleList);

  figma.ui.postMessage({ type: 'ready' });
}

async function onScene(msg) {
  const entry = msg.entry;
  const frame = await buildScreen(entry, msg.data);
  await placeOnBoard(title(entry.base, entry.kind), frame, entry.label);
  placed.push(frame);
  figma.ui.postMessage({ type: 'built', label: entry.label });
}

async function onFinish() {
  layoutBoards();
  figma.currentPage.selection = [];
  if (placed.length) figma.viewport.scrollAndZoomIntoView(placed.slice(0, 8));
  figma.ui.postMessage({ type: 'done', warnings, count: placed.length, page: figma.currentPage.name });
}
