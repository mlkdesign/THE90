/* =========================================================================
   THE90 — DOM → Figma scene extractor  (dev-only, runs inside the prototype)

   Walks a live screen, reads used values off getComputedStyle and the layout
   boxes off getBoundingClientRect, and writes a scene graph the companion
   Figma plugin can rebuild node-for-node: auto-layout where the CSS really is
   a flex line, absolute placement where it is not, real paints, real strokes,
   real shadows, real type.

   Nothing here ships with the app.
   ========================================================================= */
(function () {
'use strict';

var EPS = 0.5;                    // px slack when deciding "these gaps match"
var TOL_FILL = 1.0;               // px slack when deciding "this fills its parent"

/* ---------------------------------------------------------------- colour -- */

function parseColor(str) {
  if (!str) return null;
  str = String(str).trim();
  if (str === 'transparent' || str === 'none') return { r: 0, g: 0, b: 0, a: 0 };
  var m = str.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    var p = m[1].split(/[,\s/]+/).filter(function (s) { return s !== ''; });
    return {
      r: clamp01(parseFloat(p[0]) / 255),
      g: clamp01(parseFloat(p[1]) / 255),
      b: clamp01(parseFloat(p[2]) / 255),
      a: p.length > 3 ? clamp01(parseFloat(p[3])) : 1
    };
  }
  m = str.match(/^color\(srgb\s+([^)]+)\)$/i);
  if (m) {
    var q = m[1].split(/[\s/]+/).filter(function (s) { return s !== ''; });
    return { r: clamp01(+q[0]), g: clamp01(+q[1]), b: clamp01(+q[2]), a: q.length > 3 ? clamp01(+q[3]) : 1 };
  }
  // last resort — let the engine normalise it for us
  var probe = document.createElement('span');
  probe.style.color = str;
  document.body.appendChild(probe);
  var resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved && resolved !== str ? parseColor(resolved) : null;
}

function clamp01(n) { return isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; }
function round(n, d) { var f = Math.pow(10, d == null ? 2 : d); return Math.round(n * f) / f; }
function colorKey(c) {
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), round(c.a, 3)].join(',');
}

/* split "a, b(x, y), c" on top-level commas only */
function splitTop(str) {
  var out = [], depth = 0, cur = '';
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* ------------------------------------------------------------- gradients -- */

/* maps p0 -> (0,0) and p1 -> (1,0); Figma reads colour off x only */
function transformFromPoints(p0, p1) {
  var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  var l2 = dx * dx + dy * dy || 1e-6;
  var a = dx / l2, b = dy / l2;
  return [
    [round(a, 5), round(b, 5), round(-(a * p0[0] + b * p0[1]), 5)],
    [round(-b, 5), round(a, 5), round(b * p0[0] - a * p0[1], 5)]
  ];
}

function parseStops(parts, box) {
  /* parts: ["rgba(0,0,0,0) 0%", "rgb(14,14,14) 100%"] — positions may be absent */
  var stops = [], i;
  for (i = 0; i < parts.length; i++) {
    var s = parts[i].trim();
    var cm = s.match(/^((?:rgba?|color|hsla?)\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)\s*(.*)$/i);
    if (!cm) continue;
    var col = parseColor(cm[1]);
    if (!col) continue;
    var posTokens = cm[2].trim().split(/\s+/).filter(Boolean);
    /* a stop may carry two positions ("red 0% 40%") — expand into two stops */
    if (!posTokens.length) stops.push({ color: col, pos: null });
    else posTokens.forEach(function (t) { stops.push({ color: col, pos: lenToFrac(t, box) }); });
  }
  /* fill in the gaps the way CSS does */
  if (stops.length) {
    if (stops[0].pos == null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos == null) stops[stops.length - 1].pos = 1;
    for (i = 1; i < stops.length - 1; i++) {
      if (stops[i].pos != null) continue;
      var prev = i - 1; while (stops[prev].pos == null) prev--;
      var next = i + 1; while (next < stops.length && stops[next].pos == null) next++;
      var span = next - prev;
      for (var k = prev + 1; k < next; k++) {
        stops[k].pos = stops[prev].pos + (stops[next].pos - stops[prev].pos) * ((k - prev) / span);
      }
    }
    var run = 0;
    stops.forEach(function (s) { if (s.pos < run) s.pos = run; else run = s.pos; });
  }
  return stops.map(function (s) {
    return { position: round(Math.min(1, Math.max(0, s.pos)), 4), color: s.color };
  });
}

function lenToFrac(tok, box) {
  if (/%$/.test(tok)) return parseFloat(tok) / 100;
  if (/px$/.test(tok)) return parseFloat(tok) / (box || 1);
  return null;
}

function angleFromDirection(dir) {
  /* CSS: 0deg points up, angle grows clockwise */
  var d = dir.trim().toLowerCase();
  var m = d.match(/^([-\d.]+)deg$/); if (m) return parseFloat(m[1]);
  m = d.match(/^([-\d.]+)turn$/); if (m) return parseFloat(m[1]) * 360;
  m = d.match(/^([-\d.]+)rad$/); if (m) return parseFloat(m[1]) * 180 / Math.PI;
  if (!/^to\s/.test(d)) return null;
  var sides = d.replace(/^to\s+/, '').split(/\s+/).sort().join(' ');
  var map = {
    'top': 0, 'right': 90, 'bottom': 180, 'left': 270,
    'right top': 45, 'bottom right': 135, 'bottom left': 225, 'left top': 315
  };
  return map[sides] != null ? map[sides] : 180;
}

function linearPaint(inner, w, h) {
  var parts = splitTop(inner);
  var angle = 180, first = parts[0].trim();
  var a = angleFromDirection(first);
  if (a != null) { angle = a; parts = parts.slice(1); }
  var rad = angle * Math.PI / 180;
  var dx = Math.sin(rad), dy = -Math.cos(rad);
  /* CSS stretches the gradient line so the box corners land on its ends */
  var W = w || 1, H = h || 1;
  var lineLen = Math.abs(W * Math.sin(rad)) + Math.abs(H * Math.cos(rad));
  var stops = parseStops(parts, lineLen);
  if (stops.length < 2) return null;
  /* normalised object space: unit square, so scale the direction by the box */
  var hx = (dx * lineLen) / (2 * W), hy = (dy * lineLen) / (2 * H);
  var p0 = [0.5 - hx, 0.5 - hy], p1 = [0.5 + hx, 0.5 + hy];
  return { type: 'GRADIENT_LINEAR', gradientStops: stops, gradientTransform: transformFromPoints(p0, p1) };
}

function radialPaint(inner, w, h) {
  var parts = splitTop(inner);
  var head = parts[0].trim(), cx = 0.5, cy = 0.5, rx = 0.5, ry = 0.5, consumed = false;
  if (/(circle|ellipse|closest|farthest|at\s|%|px)/i.test(head) && !/^(rgba?|#|color\()/i.test(head)) {
    consumed = true;
    var atSplit = head.split(/\s+at\s+/i);
    var sizePart = atSplit[0].trim();
    if (atSplit[1]) {
      var pos = atSplit[1].trim().split(/\s+/);
      cx = posToFrac(pos[0], w); cy = posToFrac(pos[1] != null ? pos[1] : '50%', h);
    }
    var sizes = sizePart.replace(/\b(circle|ellipse)\b/gi, '').trim().split(/\s+/).filter(Boolean);
    var nums = sizes.filter(function (s) { return /(%|px|em|rem)$/.test(s); });
    if (nums.length === 1) { rx = lenToFrac(nums[0], w); ry = lenToFrac(nums[0], h); }
    else if (nums.length >= 2) { rx = lenToFrac(nums[0], w); ry = lenToFrac(nums[1], h); }
    if (rx == null) rx = 0.5; if (ry == null) ry = 0.5;
  }
  var stops = parseStops(consumed ? parts.slice(1) : parts, Math.max(w, h));
  if (stops.length < 2) return null;
  var sx = 1 / (2 * (rx || 0.5)), sy = 1 / (2 * (ry || 0.5));
  return {
    type: 'GRADIENT_RADIAL',
    gradientStops: stops,
    gradientTransform: [
      [round(sx, 5), 0, round(0.5 - cx * sx, 5)],
      [0, round(sy, 5), round(0.5 - cy * sy, 5)]
    ]
  };
}

function posToFrac(tok, box) {
  var named = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
  if (named[tok] != null) return named[tok];
  var f = lenToFrac(tok, box);
  return f == null ? 0.5 : f;
}

/* -------------------------------------------------------------- geometry -- */

function radiusPx(v, w, h) {
  if (!v) return 0;
  var first = String(v).trim().split(/\s+/)[0];
  if (/%$/.test(first)) return (parseFloat(first) / 100) * Math.min(w, h);
  return parseFloat(first) || 0;
}

function px(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

/* --------------------------------------------------------------- shadows -- */

function parseShadows(value) {
  if (!value || value === 'none') return [];
  return splitTop(value).map(function (part) {
    var inset = /\binset\b/.test(part);
    var s = part.replace(/\binset\b/, '').trim();
    var cm = s.match(/(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8})/i);
    var color = cm ? parseColor(cm[1]) : { r: 0, g: 0, b: 0, a: 1 };
    var nums = s.replace(cm ? cm[1] : '', '').trim().split(/\s+/).map(parseFloat).filter(function (n) { return isFinite(n); });
    return {
      type: inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: color,
      offset: { x: nums[0] || 0, y: nums[1] || 0 },
      radius: nums[2] || 0,
      spread: nums[3] || 0
    };
  }).filter(Boolean);
}

function blurAmount(filterValue) {
  if (!filterValue || filterValue === 'none') return 0;
  var m = filterValue.match(/blur\(([\d.]+)px\)/);
  return m ? parseFloat(m[1]) : 0;
}

/* ----------------------------------------------------------------- utils -- */

var INLINE_TAGS = { SPAN: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, SMALL: 1, SUB: 1, SUP: 1, MARK: 1, BR: 1, TIME: 1, ABBR: 1, LABEL: 1, A: 1 };

function isPlainInline(el) {
  if (!INLINE_TAGS[el.tagName]) return false;
  if (el.tagName === 'BR') return true;
  var cs = getComputedStyle(el);
  if (cs.display !== 'inline') return false;
  if (parseColor(cs.backgroundColor).a > 0.001) return false;
  if (cs.backgroundImage !== 'none') return false;
  if (px(cs.borderTopWidth) || px(cs.borderLeftWidth) || px(cs.borderRightWidth) || px(cs.borderBottomWidth)) return false;
  if (cs.boxShadow !== 'none') return false;
  for (var i = 0; i < el.children.length; i++) if (!isPlainInline(el.children[i])) return false;
  return true;
}

function isTextLeaf(el) {
  if (!el.childNodes.length) return false;
  var sawText = false;
  for (var i = 0; i < el.childNodes.length; i++) {
    var n = el.childNodes[i];
    if (n.nodeType === 3) { if (n.nodeValue.trim()) sawText = true; continue; }
    if (n.nodeType === 1) { if (!isPlainInline(n)) return false; if (n.textContent.trim() || n.tagName === 'BR') sawText = true; continue; }
    if (n.nodeType === 8) continue;
    return false;
  }
  return sawText;
}

function isRendered(el, cs) {
  if (el.hasAttribute && el.hasAttribute('hidden')) return false;
  if (cs.display === 'none') return false;
  return true;
}

/* An element the CSS made invisible still holds its place in the line. Figma
   drops hidden layers out of auto-layout, so these come across as empty
   frames instead — the gap survives, the ink does not. */
function isInk(cs) {
  if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
  if (parseFloat(cs.opacity) === 0) return false;
  return true;
}

function layerName(el) {
  var tag = el.tagName.toLowerCase();
  var cls = (el.getAttribute && el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
  var base = cls.filter(function (c) { return !/^(is-|has-|js-)/.test(c); })[0];
  if (!base && el.id) base = '#' + el.id;
  if (!base) {
    var d = el.dataset || {};
    var dk = Object.keys(d)[0];
    base = dk ? 'data-' + dk.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) : tag;
  }
  var state = cls.filter(function (c) { return /^is-/.test(c); }).map(function (c) { return c.slice(3); });
  return base + (state.length ? ' · ' + state.join('+') : '');
}

/* ------------------------------------------------------------- font maps -- */

var WEIGHT_STYLE = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black'
};

function fontStyleFor(cs) {
  var w = parseInt(cs.fontWeight, 10) || 400;
  var name = WEIGHT_STYLE[Math.round(w / 100) * 100] || 'Regular';
  if (cs.fontStyle === 'italic') name = name === 'Regular' ? 'Italic' : name + ' Italic';
  return name;
}

function familyOf(cs) {
  var first = (cs.fontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  return first || 'Sora';
}

/* --------------------------------------------------------------- assets --- */

var assetCache = {};   // url -> { kind:'svg', markup } | { kind:'image', url }

function resolveUrl(u) {
  try { return new URL(u, location.href).href; } catch (e) { return u; }
}
function relUrl(u) {
  try { return new URL(u, location.href).pathname.replace(/^\//, ''); } catch (e) { return u; }
}

function noteAsset(rawUrl) {
  var abs = resolveUrl(rawUrl);
  if (assetCache[abs]) return assetCache[abs];
  var rec = /\.svg(\?|$)/i.test(abs)
    ? { kind: 'svg', path: relUrl(abs), markup: null }
    : { kind: 'image', path: relUrl(abs) };
  assetCache[abs] = rec;
  return rec;
}

function fetchPendingSvgs() {
  var jobs = Object.keys(assetCache)
    .filter(function (k) { return assetCache[k].kind === 'svg' && assetCache[k].markup == null; })
    .map(function (k) {
      return fetch(k).then(function (r) { return r.text(); })
        .then(function (t) { assetCache[k].markup = t; })
        .catch(function () { assetCache[k].markup = ''; });
    });
  return Promise.all(jobs);
}

/* ------------------------------------------------------------ background -- */

function backgroundPaints(cs, w, h, out) {
  var bg = parseColor(cs.backgroundColor);
  if (bg && bg.a > 0.001) out.push({ type: 'SOLID', color: { r: bg.r, g: bg.g, b: bg.b }, opacity: bg.a });

  var img = cs.backgroundImage;
  if (!img || img === 'none') return;
  /* CSS paints the first layer on top; Figma paints the last fill on top */
  var layers = splitTop(img).reverse();
  var sizes = splitTop(cs.backgroundSize || 'auto').reverse();
  var positions = splitTop(cs.backgroundPosition || '0% 0%').reverse();
  var repeats = splitTop(cs.backgroundRepeat || 'repeat').reverse();

  layers.forEach(function (layer, i) {
    var m = layer.match(/^(linear-gradient|repeating-linear-gradient)\((.*)\)$/is);
    if (m) { var p = linearPaint(m[2], w, h); if (p) out.push(p); return; }
    m = layer.match(/^(radial-gradient|repeating-radial-gradient)\((.*)\)$/is);
    if (m) { var r = radialPaint(m[2], w, h); if (r) out.push(r); return; }
    m = layer.match(/^url\(["']?(.*?)["']?\)$/i);
    if (m) {
      var rec = noteAsset(m[1]);
      var size = (sizes[i] || 'auto').trim();
      var rep = (repeats[i] || 'repeat').trim();
      var mode = size === 'cover' ? 'FILL' : size === 'contain' ? 'FIT' : (rep.indexOf('repeat') === 0 ? 'TILE' : 'FIT');
      out.push({ type: 'IMAGE', asset: rec.path, kind: rec.kind, scaleMode: mode, position: (positions[i] || '50% 50%').trim() });
    }
  });
}

/* ------------------------------------------------------------- the walk --- */

function styleSnapshot(el, cs, w, h) {
  var node = {};

  var fills = [];
  backgroundPaints(cs, w, h, fills);
  if (fills.length) node.fills = fills;

  /* strokes — Figma wants one paint plus per-side weights */
  var bw = { t: px(cs.borderTopWidth), r: px(cs.borderRightWidth), b: px(cs.borderBottomWidth), l: px(cs.borderLeftWidth) };
  if (bw.t || bw.r || bw.b || bw.l) {
    var bc = parseColor(cs.borderTopColor) || parseColor(cs.borderLeftColor);
    if (bc && bc.a > 0.001) {
      node.strokes = [{ type: 'SOLID', color: { r: bc.r, g: bc.g, b: bc.b }, opacity: bc.a }];
      node.strokeWeights = bw;
      node.strokeAlign = 'INSIDE';
      if (cs.borderTopStyle === 'dashed') node.dashPattern = [6, 4];
      else if (cs.borderTopStyle === 'dotted') node.dashPattern = [1, 3];
    }
  }

  var r = [
    radiusPx(cs.borderTopLeftRadius, w, h),
    radiusPx(cs.borderTopRightRadius, w, h),
    radiusPx(cs.borderBottomRightRadius, w, h),
    radiusPx(cs.borderBottomLeftRadius, w, h)
  ].map(function (n) { return round(Math.min(n, Math.min(w, h) / 2), 2); });
  if (r[0] || r[1] || r[2] || r[3]) node.radius = r;

  var eff = parseShadows(cs.boxShadow);
  var lb = blurAmount(cs.filter);
  if (lb) eff.push({ type: 'LAYER_BLUR', radius: lb });
  var bb = blurAmount(cs.backdropFilter || cs.webkitBackdropFilter);
  if (bb) eff.push({ type: 'BACKGROUND_BLUR', radius: bb });
  if (eff.length) node.effects = eff;

  /* a gradient mask is how the CSS fades a blur out at the edge; Figma says
     the same thing with an alpha mask, so carry the gradient across */
  var maskSrc = cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage
              : (cs.webkitMaskImage && cs.webkitMaskImage !== 'none' ? cs.webkitMaskImage : null);
  if (maskSrc && /gradient\(/i.test(maskSrc)) {
    var mask = [];
    var lm = maskSrc.match(/^(linear-gradient)\((.*)\)$/is);
    if (lm) { var mp = linearPaint(lm[2], w, h); if (mp) mask.push(mp); }
    else {
      var rm = maskSrc.match(/^(radial-gradient)\((.*)\)$/is);
      if (rm) { var rp = radialPaint(rm[2], w, h); if (rp) mask.push(rp); }
    }
    if (mask.length) node.mask = mask;
  }

  var op = parseFloat(cs.opacity);
  if (isFinite(op) && op < 1) node.opacity = round(op, 3);
  if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') node.blend = cs.mixBlendMode.toUpperCase().replace(/-/g, '_');
  if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') node.clip = true;

  return node;
}

function textSegments(el, cs) {
  var chars = '', segs = [];
  function styleOf(s) {
    var col = parseColor(s.color) || { r: 1, g: 1, b: 1, a: 1 };
    return {
      family: familyOf(s), style: fontStyleFor(s),
      size: round(px(s.fontSize), 2),
      lineHeight: s.lineHeight === 'normal' ? null : round(px(s.lineHeight), 2),
      lineHeightNormal: s.lineHeight === 'normal',
      letterSpacing: s.letterSpacing === 'normal' ? 0 : round(px(s.letterSpacing), 3),
      color: { r: col.r, g: col.g, b: col.b, a: col.a },
      decoration: s.textDecorationLine && s.textDecorationLine !== 'none'
        ? (s.textDecorationLine.indexOf('underline') >= 0 ? 'UNDERLINE' : 'STRIKETHROUGH') : 'NONE',
      case: s.textTransform === 'uppercase' ? 'UPPER' : s.textTransform === 'lowercase' ? 'LOWER'
        : s.textTransform === 'capitalize' ? 'TITLE' : 'ORIGINAL'
    };
  }
  function walk(node, inherited) {
    for (var i = 0; i < node.childNodes.length; i++) {
      var n = node.childNodes[i];
      if (n.nodeType === 3) {
        var t = n.nodeValue.replace(/\s+/g, ' ');
        if (!t) continue;
        if (!chars && t === ' ') continue;
        var start = chars.length; chars += t;
        segs.push({ start: start, end: chars.length, style: inherited });
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') { chars += '\n'; continue; }
        walk(n, styleOf(getComputedStyle(n)));
      }
    }
  }
  walk(el, styleOf(cs));
  chars = chars.replace(/\s+$/, '');
  segs = segs.filter(function (s) { return s.start < chars.length; })
             .map(function (s) { return { start: s.start, end: Math.min(s.end, chars.length), style: s.style }; });
  return { characters: chars, segments: segs };
}

function alignOf(cs) {
  var a = cs.textAlign;
  if (a === 'center') return 'CENTER';
  if (a === 'right' || a === 'end') return 'RIGHT';
  if (a === 'justify') return 'JUSTIFIED';
  return 'LEFT';
}

/* flexbox → Figma auto-layout alignment */
function primaryAlign(v) {
  if (v === 'center') return 'CENTER';
  if (v === 'flex-end' || v === 'end' || v === 'right') return 'MAX';
  if (v === 'space-between') return 'SPACE_BETWEEN';
  if (v === 'space-around' || v === 'space-evenly') return 'SPACE_BETWEEN';
  return 'MIN';
}
function counterAlign(v) {
  if (v === 'center') return 'CENTER';
  if (v === 'flex-end' || v === 'end') return 'MAX';
  if (v === 'baseline') return 'BASELINE';
  return 'MIN';   // stretch is handled by giving children FILL
}

function inFlowChildren(el) {
  var out = [];
  for (var i = 0; i < el.children.length; i++) {
    var c = el.children[i], cs = getComputedStyle(c);
    if (!isRendered(c, cs)) continue;
    if (cs.position === 'absolute' || cs.position === 'fixed') continue;
    out.push({ el: c, cs: cs });
  }
  return out;
}

/* Decide the auto-layout for a container by measuring what actually happened.
   Uniform gaps become itemSpacing; anything else falls back to absolute so the
   frame still matches the prototype to the pixel. */
function decideLayout(el, cs, kids, rect) {
  var disp = cs.display;
  var isFlex = disp === 'flex' || disp === 'inline-flex';
  var isGrid = disp === 'grid' || disp === 'inline-grid';
  if (!kids.length) return { mode: 'NONE' };

  var dir = 'VERTICAL';
  if (isFlex) {
    dir = /row/.test(cs.flexDirection) ? 'HORIZONTAL' : 'VERTICAL';
    if (/reverse/.test(cs.flexDirection)) return { mode: 'NONE', reason: 'reverse' };
    if (cs.flexWrap === 'wrap' && kids.length > 1) {
      /* wrap only survives the trip when the rows are even */
      var rows = {}; kids.forEach(function (k) { rows[Math.round(k.el.getBoundingClientRect().top)] = 1; });
      if (Object.keys(rows).length > 1) return wrapLayout(el, cs, kids, rect);
    }
  } else if (isGrid) {
    return gridLayout(el, cs, kids, rect);
  } else {
    /* block flow — only a column if the children really do stack */
    for (var i = 0; i < kids.length; i++) {
      var d = kids[i].cs.display;
      if (d === 'inline' || d === 'inline-block' || d === 'inline-flex') return { mode: 'NONE', reason: 'inline-flow' };
      if (kids[i].cs['float'] !== 'none') return { mode: 'NONE', reason: 'float' };
    }
  }

  /* measure the gaps in DOM order — that is also the visual order here */
  var boxes = kids.map(function (k) {
    var r = k.el.getBoundingClientRect();
    return { s: dir === 'HORIZONTAL' ? r.left : r.top, e: dir === 'HORIZONTAL' ? r.right : r.bottom };
  });
  for (var j = 1; j < boxes.length; j++) {
    if (boxes[j].s < boxes[j - 1].e - EPS) return { mode: 'NONE', reason: 'overlap' };
    if (boxes[j].s < boxes[j - 1].s) return { mode: 'NONE', reason: 'out-of-order' };
  }
  var gaps = [];
  for (j = 1; j < boxes.length; j++) gaps.push(boxes[j].s - boxes[j - 1].e);
  var gap = gaps.length ? gaps[0] : 0;
  var uniform = gaps.every(function (g) { return Math.abs(g - gap) <= EPS; });
  var spaced = isFlex && primaryAlign(cs.justifyContent) === 'SPACE_BETWEEN';

  var base = {
    mode: dir,
    gap: round(Math.max(0, gap), 2),
    padT: round(px(cs.paddingTop) + px(cs.borderTopWidth), 2),
    padR: round(px(cs.paddingRight) + px(cs.borderRightWidth), 2),
    padB: round(px(cs.paddingBottom) + px(cs.borderBottomWidth), 2),
    padL: round(px(cs.paddingLeft) + px(cs.borderLeftWidth), 2),
    primary: isFlex ? primaryAlign(cs.justifyContent) : 'MIN',
    counter: isFlex ? counterAlign(cs.alignItems) : 'MIN',
    stretch: isFlex && (cs.alignItems === 'stretch' || cs.alignItems === 'normal')
  };

  measurePadding(base, kids, rect, dir, boxes);

  if (uniform) return base;
  if (spaced) { base.gap = 0; return base; }

  /* Uneven gaps are what a margin looks like from the outside. Rather than
     drop to absolute, split the run at its widest gap and nest the rest —
     the same shape a designer would have built by hand. */
  var plan = planGroups(0, boxes.length - 1, boxes);
  if (plan == null || typeof plan === 'number' || !plan.items) return { mode: 'NONE', reason: 'uneven-gaps', dir: dir };
  base.gap = plan.gap;
  base.groups = plan.items;
  base.regrouped = true;
  return base;
}

/* Padding read off the boxes rather than off the CSS: a margin on the first or
   last child, or an inset that only some children carry, is padding as far as
   auto-layout is concerned. Where the inset is not shared, the container keeps
   the smallest one and the children hold their own width. */
function measurePadding(base, kids, rect, dir, boxes) {
  var row = dir === 'HORIZONTAL';
  var starts = [], ends = [];
  kids.forEach(function (k) {
    var r = k.el.getBoundingClientRect();
    starts.push(row ? r.top - rect.top : r.left - rect.left);
    ends.push(row ? rect.bottom - r.bottom : rect.right - r.right);
  });

  var same = function (a) { return a.every(function (v) { return Math.abs(v - a[0]) <= EPS; }); };
  var minStart = Math.min.apply(null, starts), minEnd = Math.min.apply(null, ends);
  var startsSame = same(starts), endsSame = same(ends);

  var padStart = minStart, padEnd = minEnd;
  if (startsSame && endsSame) {
    padStart = starts[0]; padEnd = ends[0];
  } else {
    base.mixedInset = true;
    if (endsSame && !startsSame) { base.counter = 'MAX'; padEnd = ends[0]; }
    else if (startsSame && !endsSame) { base.counter = 'MIN'; padStart = starts[0]; }
    else {
      var symmetric = kids.every(function (_, i) { return Math.abs(starts[i] - ends[i]) <= EPS; });
      base.counter = symmetric ? 'CENTER' : base.counter;
    }
  }
  if (row) { base.padT = round(Math.max(0, padStart), 2); base.padB = round(Math.max(0, padEnd), 2); }
  else     { base.padL = round(Math.max(0, padStart), 2); base.padR = round(Math.max(0, padEnd), 2); }

  /* the main axis: only when nothing is distributing the slack for us */
  if (base.primary === 'MIN' && boxes && boxes.length) {
    var lead = boxes[0].s - (row ? rect.left : rect.top);
    var trail = (row ? rect.right : rect.bottom) - boxes[boxes.length - 1].e;
    if (row) { base.padL = round(Math.max(0, lead), 2); base.padR = round(Math.max(0, trail), 2); }
    else     { base.padT = round(Math.max(0, lead), 2); base.padB = round(Math.max(0, trail), 2); }
  }
}

/* recursive split of [lo..hi] at the widest gap; leaves are child indexes */
function planGroups(lo, hi, boxes) {
  if (lo >= hi) return lo;
  var gaps = [], i;
  for (i = lo; i < hi; i++) gaps.push(boxes[i + 1].s - boxes[i].e);
  var G = Math.max.apply(null, gaps);
  var groups = [], start = lo;
  for (i = lo; i < hi; i++) {
    if (Math.abs(gaps[i - lo] - G) <= EPS) { groups.push([start, i]); start = i + 1; }
  }
  groups.push([start, hi]);
  if (groups.length < 2) return lo;
  return {
    gap: round(Math.max(0, G), 2),
    items: groups.map(function (g) { return planGroups(g[0], g[1], boxes); })
  };
}

/* turn a group plan into real wrapper frames around the built children */
function assembleGroups(items, flow, dir, counter) {
  return items.map(function (it) {
    if (typeof it === 'number') return flow[it];
    var kids = assembleGroups(it.items, flow, dir, counter).filter(Boolean);
    if (kids.length === 1) return kids[0];
    var minX = Math.min.apply(null, kids.map(function (k) { return k.x; }));
    var minY = Math.min.apply(null, kids.map(function (k) { return k.y; }));
    var maxX = Math.max.apply(null, kids.map(function (k) { return k.x + k.w; }));
    var maxY = Math.max.apply(null, kids.map(function (k) { return k.y + k.h; }));
    var cross = dir === 'HORIZONTAL' ? 'v' : 'h';
    var crossFill = kids.every(function (k) { return k.sizing && k.sizing[cross] === 'FILL'; });
    kids.forEach(function (k) { k.x = round(k.x - minX, 2); k.y = round(k.y - minY, 2); });
    var wrap = {
      type: 'FRAME', name: 'group',
      x: round(minX, 2), y: round(minY, 2),
      w: round(maxX - minX, 2), h: round(maxY - minY, 2),
      sizing: dir === 'HORIZONTAL'
        ? { h: 'HUG', v: crossFill ? 'FILL' : 'HUG' }
        : { h: crossFill ? 'FILL' : 'HUG', v: 'HUG' },
      layout: { mode: dir, gap: it.gap, padT: 0, padR: 0, padB: 0, padL: 0, primary: 'MIN', counter: counter || 'MIN' },
      children: kids
    };
    stats.grouped++;
    return wrap;
  });
}

function wrapLayout(el, cs, kids, rect) {
  var rowGap = px(cs.rowGap) || px(cs.gap) || 0;
  var colGap = px(cs.columnGap) || px(cs.gap) || 0;
  return {
    mode: 'HORIZONTAL', wrap: true, gap: round(colGap, 2), rowGap: round(rowGap, 2),
    padT: round(px(cs.paddingTop), 2), padR: round(px(cs.paddingRight), 2),
    padB: round(px(cs.paddingBottom), 2), padL: round(px(cs.paddingLeft), 2),
    primary: primaryAlign(cs.justifyContent), counter: counterAlign(cs.alignItems),
    stretch: cs.alignItems === 'stretch' || cs.alignItems === 'normal'
  };
}

/* a grid becomes rows of an auto-layout when its tracks are even */
function gridLayout(el, cs, kids, rect) {
  var cols = (cs.gridTemplateColumns || '').split(/\s+/).filter(Boolean).length;
  var rowGap = px(cs.rowGap) || 0, colGap = px(cs.columnGap) || 0;
  if (cols <= 1) {
    return {
      mode: 'VERTICAL', gap: round(rowGap, 2),
      padT: round(px(cs.paddingTop), 2), padR: round(px(cs.paddingRight), 2),
      padB: round(px(cs.paddingBottom), 2), padL: round(px(cs.paddingLeft), 2),
      primary: 'MIN', counter: 'MIN', stretch: true
    };
  }
  var rows = {};
  kids.forEach(function (k) { rows[Math.round(k.el.getBoundingClientRect().top)] = 1; });
  if (Object.keys(rows).length <= 1) {
    return {
      mode: 'HORIZONTAL', gap: round(colGap, 2),
      padT: round(px(cs.paddingTop), 2), padR: round(px(cs.paddingRight), 2),
      padB: round(px(cs.paddingBottom), 2), padL: round(px(cs.paddingLeft), 2),
      primary: 'MIN', counter: 'MIN', stretch: true
    };
  }
  return { mode: 'HORIZONTAL', wrap: true, gap: round(colGap, 2), rowGap: round(rowGap, 2),
    padT: round(px(cs.paddingTop), 2), padR: round(px(cs.paddingRight), 2),
    padB: round(px(cs.paddingBottom), 2), padL: round(px(cs.paddingLeft), 2),
    primary: 'MIN', counter: 'MIN', stretch: true, grid: cols };
}

/* ------------------------------------------------------------ the sizer --- */

/* getComputedStyle hands back used values, never `auto`, so "does this hug its
   content?" has to be answered by measuring: add the children up and see
   whether the box is exactly that big. */
function hugsContent(el, cs, axis, rect) {
  var kids = inFlowChildren(el);
  if (!kids.length) return false;
  var isRow = (cs.display === 'flex' || cs.display === 'inline-flex') && /row/.test(cs.flexDirection);
  var along = axis === 'h' ? isRow : !isRow;
  var frame = axis === 'h'
    ? px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth)
    : px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
  var host = rect[axis === 'h' ? 'left' : 'top'];
  var sizes = kids.map(function (k) {
    var r = k.el.getBoundingClientRect();
    return axis === 'h' ? { s: r.left, e: r.right } : { s: r.top, e: r.bottom };
  });
  var need;
  if (along) {
    var span = Math.max.apply(null, sizes.map(function (b) { return b.e; })) -
               Math.min.apply(null, sizes.map(function (b) { return b.s; }));
    need = span + frame;
  } else {
    need = Math.max.apply(null, sizes.map(function (b) { return b.e - b.s; })) + frame;
  }
  return Math.abs((axis === 'h' ? rect.width : rect.height) - need) <= 1;
}

function sizing(el, cs, rect, parent, kind) {
  var h = 'FIXED', v = 'FIXED';
  var pl = parent && parent.layout;
  var inAuto = pl && pl.mode !== 'NONE';
  var row = inAuto && pl.mode === 'HORIZONTAL';
  var grow = parseFloat(cs.flexGrow) || 0;

  if (inAuto) {
    var contentW = parent.rect.width - (pl.padL || 0) - (pl.padR || 0);
    var contentH = parent.rect.height - (pl.padT || 0) - (pl.padB || 0);
    var fillsW = Math.abs(rect.width - contentW) <= TOL_FILL;
    var fillsH = Math.abs(rect.height - contentH) <= TOL_FILL;

    if (row) {
      if (grow > 0) h = 'FILL';
      if (pl.stretch && fillsH && !pl.mixedInset) v = 'FILL';
    } else {
      if (pl.mixedInset) { /* the child carries its own inset — keep it fixed */ }
      else if (pl.stretch && fillsW) h = 'FILL';
      else if (fillsW && !/inline/.test(cs.display)) h = 'FILL';
      if (grow > 0) v = 'FILL';
    }
  }

  if (kind === 'TEXT') {
    if (v !== 'FILL') {
      /* only hug when the box really is the ink plus its own padding — a
         44px button around a 20px line is a fixed height, not a hug */
      var tb = textBox(el);
      var frameH = px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
      v = Math.abs(rect.height - (tb.h + frameH)) <= 1.5 ? 'HUG' : 'FIXED';
    }
    return { h: h, v: v };
  }
  if (kind === 'SVG' || kind === 'IMAGE') return { h: h, v: v };

  if (h === 'FIXED' && hugsContent(el, cs, 'h', rect)) h = 'HUG';
  if (v === 'FIXED' && hugsContent(el, cs, 'v', rect)) v = 'HUG';

  /* a hard CSS size, a min-size floor or a scroll port all pin the axis */
  if (px(cs.minHeight) > 0 && Math.abs(px(cs.minHeight) - rect.height) < 1 && v === 'HUG') v = 'FIXED';
  if (px(cs.minWidth) > 0 && Math.abs(px(cs.minWidth) - rect.width) < 1 && h === 'HUG') h = 'FIXED';
  if (cs.aspectRatio && cs.aspectRatio !== 'auto') { if (h === 'HUG') h = 'FIXED'; if (v === 'HUG') v = 'FIXED'; }
  if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') { if (v === 'HUG') v = 'FIXED'; }
  if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') { if (h === 'HUG') h = 'FIXED'; }

  return { h: h, v: v };
}

/* Figma will not hug an axis that also has to distribute or align its children */
function reconcileSizing(node) {
  var l = node.layout;
  if (!l || l.mode === 'NONE') return;
  var primaryAxis = l.mode === 'HORIZONTAL' ? 'h' : 'v';
  if (l.primary && l.primary !== 'MIN' && node.sizing[primaryAxis] === 'HUG') node.sizing[primaryAxis] = 'FIXED';
}

/* --------------------------------------------------------- pseudo layers -- */

function pseudoNode(el, which, hostRect) {
  var cs = getComputedStyle(el, which);
  if (!cs || cs.content === 'none' || cs.content === 'normal') return null;
  if (cs.display === 'none' || cs.visibility === 'hidden') return null;
  if (cs.position !== 'absolute' && cs.position !== 'fixed') return null;   // static pseudos have no readable box
  var w = px(cs.width), h = px(cs.height);
  var host = getComputedStyle(el);
  var bt = px(host.borderTopWidth), bl = px(host.borderLeftWidth);
  var top, left;
  if (cs.top !== 'auto') top = px(cs.top) + bt;
  else if (cs.bottom !== 'auto') top = hostRect.height - px(cs.bottom) - h;
  else top = bt;
  if (cs.left !== 'auto') left = px(cs.left) + bl;
  else if (cs.right !== 'auto') left = hostRect.width - px(cs.right) - w;
  else left = bl;
  if (cs.inset && cs.inset !== 'auto') { /* inset already resolved into top/left above */ }
  if (!(w > 0 && h > 0)) return null;

  var node = { type: 'FRAME', name: which === '::before' ? '◦ before' : '◦ after', pseudo: true,
    x: round(left, 2), y: round(top, 2), w: round(w, 2), h: round(h, 2), absolute: true,
    sizing: { h: 'FIXED', v: 'FIXED' }, children: [] };
  Object.assign(node, styleSnapshot(el, cs, w, h));
  var txt = cs.content.replace(/^["']|["']$/g, '');
  if (txt && txt !== 'none' && !/^url\(/.test(cs.content)) {
    var col = parseColor(cs.color) || { r: 1, g: 1, b: 1, a: 1 };
    node.children.push({
      type: 'TEXT', name: txt.slice(0, 20), x: 0, y: 0, w: round(w, 2), h: round(h, 2),
      sizing: { h: 'FILL', v: 'FILL' },
      text: {
        characters: txt, align: alignOf(cs), vAlign: 'CENTER', autoResize: 'NONE',
        segments: [{ start: 0, end: txt.length, style: {
          family: familyOf(cs), style: fontStyleFor(cs), size: round(px(cs.fontSize), 2),
          lineHeight: cs.lineHeight === 'normal' ? null : round(px(cs.lineHeight), 2),
          letterSpacing: cs.letterSpacing === 'normal' ? 0 : round(px(cs.letterSpacing), 3),
          color: { r: col.r, g: col.g, b: col.b, a: col.a }, decoration: 'NONE', case: 'ORIGINAL'
        } }]
      }
    });
  }
  return node;
}

/* ----------------------------------------------------------------- build -- */

/* Range metrics: the real ink box, the line count and the used line-height —
   the only way to learn what `line-height: normal` actually resolved to. */
function textBox(el) {
  var range = document.createRange();
  range.selectNodeContents(el);
  var rects = range.getClientRects();
  var box = range.getBoundingClientRect();
  var tops = {}, lineH = 0;
  for (var i = 0; i < rects.length; i++) {
    if (!rects[i].height) continue;
    tops[Math.round(rects[i].top)] = 1;
    lineH = Math.max(lineH, rects[i].height);
  }
  return { w: box.width, h: box.height, lines: Math.max(1, Object.keys(tops).length), lineHeight: lineH };
}

function kindOf(el) {
  var tag = el.tagName;
  if (tag === 'IMG') return /\.svg(\?|$)/i.test(el.getAttribute('src') || '') ? 'SVG' : 'IMAGE';
  if (tag === 'svg') return 'SVG';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return 'FIELD';
  if (isTextLeaf(el)) return 'TEXT';
  return 'FRAME';
}

var stats;

function build(el, parent, depth) {
  var cs = getComputedStyle(el);
  if (!isRendered(el, cs)) return null;
  var rect = el.getBoundingClientRect();
  var w = rect.width, h = rect.height;
  var parentAuto = parent && parent.layout && parent.layout.mode !== 'NONE';
  if (w <= 0 || h <= 0) {
    var inFlow = cs.position !== 'absolute' && cs.position !== 'fixed';
    /* a zero-height rail still holds a slot in the flex line — keep the slot */
    if (!(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !(inFlow && parentAuto)) return null;
    w = Math.max(w, 0.01); h = Math.max(h, 0.01);
  }

  var pRect = parent ? parent.rect : { left: rect.left, top: rect.top, width: w, height: h };
  var pScrollX = parent ? parent.scrollLeft : 0;
  var pScrollY = parent ? parent.scrollTop : 0;
  /* Figma measures a child from its parent's border box — so do we */
  var pPadL = 0, pPadT = 0;

  var node = {
    type: 'FRAME',
    name: layerName(el),
    x: round(rect.left - pRect.left + pScrollX - pPadL, 2),
    y: round(rect.top - pRect.top + pScrollY - pPadT, 2),
    w: round(w, 2),
    h: round(h, 2)
  };
  stats.nodes++;

  var isAbs = cs.position === 'absolute' || cs.position === 'fixed';

  /* invisible and out of flow: it is not there at all. invisible but in flow:
     it is a spacer, and the line needs it */
  if (!isInk(cs) || rect.width <= 0 || rect.height <= 0) {
    if (isAbs) return null;
    node.sizing = sizing(el, cs, rect, parent, 'FRAME');
    node.name = layerName(el) + ' · spacer';
    node.spacer = true;
    return node;
  }

  var kind = kindOf(el);
  if (isAbs) node.absolute = true;
  node.sizing = isAbs ? { h: 'FIXED', v: 'FIXED' } : sizing(el, cs, rect, parent, kind);
  if (isAbs) node.anchors = absAnchors(cs, pRect, rect);

  /* a padded or decorated run of type hugs when the box is exactly the ink
     plus its own padding */
  if (kind === 'TEXT' && !isAbs && node.sizing.h === 'FIXED') {
    var tb = textBox(el);
    var frameW = px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
    if (Math.abs(rect.width - (tb.w + frameW)) <= 1.5) node.sizing.h = 'HUG';
  }

  /* ---- leaf kinds ---- */
  var tag = el.tagName;

  if (tag === 'IMG') {
    var src = el.getAttribute('src') || '';
    var rec = noteAsset(src);
    if (rec.kind === 'svg') {
      node.type = 'SVG'; node.asset = rec.path;
      node.tint = tintOf(cs);
    } else {
      node.type = 'IMAGE'; node.asset = rec.path;
      node.scaleMode = cs.objectFit === 'contain' ? 'FIT' : cs.objectFit === 'none' ? 'CROP' : 'FILL';
    }
    Object.assign(node, styleSnapshot(el, cs, w, h));
    delete node.fills;
    return node;
  }

  if (tag === 'svg') {
    node.type = 'SVG';
    /* `currentColor` resolves against the element's own colour — bake it in so
       Figma does not import the icon as black */
    node.markup = el.outerHTML.replace(/currentColor/g, cs.color);
    node.tint = tintOf(cs);
    return node;
  }

  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    Object.assign(node, styleSnapshot(el, cs, w, h));
    var val = el.value || el.getAttribute('placeholder') || '';
    var isPlaceholder = !el.value;
    node.children = [];
    if (val) {
      var pcs = isPlaceholder ? getComputedStyle(el, '::placeholder') : cs;
      var col = parseColor((pcs && pcs.color) || cs.color) || { r: 1, g: 1, b: 1, a: 1 };
      node.children.push({
        type: 'TEXT', name: isPlaceholder ? 'placeholder' : 'value',
        x: round(px(cs.paddingLeft) + px(cs.borderLeftWidth), 2), y: 0,
        w: round(w - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.borderLeftWidth) - px(cs.borderRightWidth), 2),
        h: round(h, 2),
        sizing: { h: 'FIXED', v: 'FIXED' }, absolute: true,
        text: {
          characters: val, align: alignOf(cs), vAlign: 'CENTER', autoResize: 'NONE',
          segments: [{ start: 0, end: val.length, style: {
            family: familyOf(cs), style: fontStyleFor(cs), size: round(px(cs.fontSize), 2),
            lineHeight: cs.lineHeight === 'normal' ? null : round(px(cs.lineHeight), 2),
            letterSpacing: cs.letterSpacing === 'normal' ? 0 : round(px(cs.letterSpacing), 3),
            color: { r: col.r, g: col.g, b: col.b, a: col.a }, decoration: 'NONE', case: 'ORIGINAL'
          } }]
        }
      });
    }
    return node;
  }

  if (isTextLeaf(el)) {
    var ts = textSegments(el, cs);
    if (ts.characters) {
      var metrics = textBox(el);
      ts.segments.forEach(function (sg) {
        if (sg.style.lineHeightNormal) sg.style.lineHeight = round(metrics.lineHeight, 2);
        delete sg.style.lineHeightNormal;
      });
      var lines = metrics.lines;
      var box = styleSnapshot(el, cs, w, h);
      var padded = px(cs.paddingTop) || px(cs.paddingRight) || px(cs.paddingBottom) || px(cs.paddingLeft);
      var decorated = box.fills || box.strokes || box.effects;
      var inner = {
        type: 'TEXT', name: ts.characters.slice(0, 24).trim() || 'text',
        text: {
          characters: ts.characters, segments: ts.segments, lines: lines,
          align: alignOf(cs),
          vAlign: /flex|grid/.test(cs.display) ? (cs.alignItems === 'center' ? 'CENTER' : 'TOP') : 'TOP',
          autoResize: 'NONE',
          nowrap: cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre',
          truncate: cs.textOverflow === 'ellipsis' && (cs.overflowX === 'hidden' || cs.overflow === 'hidden')
        }
      };
      if (!padded && !decorated) {
        Object.assign(node, inner);
        node.text.vAlign = 'TOP';
        stats.text++;
        return node;
      }
      /* padding or a background means the box and the type are two layers */
      Object.assign(node, box);
      var iw = w - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
      var ih = h - px(cs.paddingTop) - px(cs.paddingBottom) - px(cs.borderTopWidth) - px(cs.borderBottomWidth);
      node.layout = {
        mode: 'HORIZONTAL', gap: 0,
        padT: round(px(cs.paddingTop) + px(cs.borderTopWidth), 2),
        padR: round(px(cs.paddingRight) + px(cs.borderRightWidth), 2),
        padB: round(px(cs.paddingBottom) + px(cs.borderBottomWidth), 2),
        padL: round(px(cs.paddingLeft) + px(cs.borderLeftWidth), 2),
        primary: alignOf(cs) === 'CENTER' ? 'CENTER' : alignOf(cs) === 'RIGHT' ? 'MAX' : 'MIN',
        counter: 'CENTER'
      };
      inner.x = 0; inner.y = 0; inner.w = round(Math.max(1, iw), 2); inner.h = round(Math.max(1, ih), 2);
      inner.sizing = { h: 'FILL', v: 'HUG' };
      node.children = [inner];
      stats.text++;
      return node;
    }
  }

  /* ---- container ---- */
  Object.assign(node, styleSnapshot(el, cs, w, h));

  var kids = inFlowChildren(el);
  var layout = decideLayout(el, cs, kids, rect);
  if (layout.mode === 'NONE') {
    if (layout.reason) { stats.absolute++; stats.reasons[layout.reason] = (stats.reasons[layout.reason] || 0) + 1; }
    node.layout = null;
  } else {
    node.layout = layout;
    stats.auto++;
  }

  reconcileSizing(node);

  var scrollable = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight - el.clientHeight > 2;
  var scrollableX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth - el.clientWidth > 2;
  if (scrollable) node.overflow = 'VERTICAL';
  else if (scrollableX) node.overflow = 'HORIZONTAL';

  var ctx = {
    rect: rect, layout: node.layout,
    scrollLeft: el.scrollLeft, scrollTop: el.scrollTop,
    borderL: px(cs.borderLeftWidth), borderT: px(cs.borderTopWidth)
  };

  var out = [];
  var before = pseudoNode(el, '::before', rect);
  if (before) out.push(before);

  for (var i = 0; i < el.children.length; i++) {
    var child = build(el.children[i], ctx, depth + 1);
    if (child) out.push(child);
  }

  var after = pseudoNode(el, '::after', rect);
  if (after) out.push(after);

  /* orphan text mixed in with element children — keep it as its own layer */
  for (var k = 0; k < el.childNodes.length; k++) {
    var tn = el.childNodes[k];
    if (tn.nodeType !== 3) continue;
    var txt = tn.nodeValue.replace(/\s+/g, ' ').trim();
    if (!txt) continue;
    var range = document.createRange(); range.selectNode(tn);
    var tr = range.getBoundingClientRect(); range.detach && range.detach();
    if (!tr.width || !tr.height) continue;
    var tcol = parseColor(cs.color) || { r: 1, g: 1, b: 1, a: 1 };
    out.push({
      type: 'TEXT', name: txt.slice(0, 24), absolute: true,
      x: round(tr.left - rect.left, 2), y: round(tr.top - rect.top, 2),
      w: round(tr.width + 1, 2), h: round(tr.height, 2), sizing: { h: 'FIXED', v: 'FIXED' },
      text: { characters: txt, align: alignOf(cs), vAlign: 'TOP', autoResize: 'NONE',
        segments: [{ start: 0, end: txt.length, style: {
          family: familyOf(cs), style: fontStyleFor(cs), size: round(px(cs.fontSize), 2),
          lineHeight: cs.lineHeight === 'normal' ? null : round(px(cs.lineHeight), 2),
          letterSpacing: cs.letterSpacing === 'normal' ? 0 : round(px(cs.letterSpacing), 3),
          color: { r: tcol.r, g: tcol.g, b: tcol.b, a: tcol.a }, decoration: 'NONE', case: 'ORIGINAL'
        } }] }
    });
  }

  if (node.layout && node.layout.groups) {
    var flow = [], fixed = [];
    out.forEach(function (n) { (n.absolute || n.pseudo ? fixed : flow).push(n); });
    if (flow.length === kids.length) {
      var grouped = assembleGroups(node.layout.groups, flow, node.layout.mode, node.layout.counter).filter(Boolean);
      out = grouped.concat(fixed);
    } else {
      node.layout = null; stats.auto--; stats.absolute++;
      stats.reasons['regroup-mismatch'] = (stats.reasons['regroup-mismatch'] || 0) + 1;
    }
    if (node.layout) delete node.layout.groups;
  }

  if (out.length) node.children = out;
  return node;
}

function absAnchors(cs, pRect, rect) {
  var h = 'MIN', v = 'MIN';
  var hasL = cs.left !== 'auto', hasR = cs.right !== 'auto';
  var hasT = cs.top !== 'auto', hasB = cs.bottom !== 'auto';
  if (hasL && hasR) h = 'STRETCH';
  else if (hasR) h = 'MAX';
  else if (!hasL && Math.abs((rect.left + rect.width / 2) - (pRect.left + pRect.width / 2)) < 1) h = 'CENTER';
  if (hasT && hasB) v = 'STRETCH';
  else if (hasB) v = 'MAX';
  return { h: h, v: v };
}

function tintOf(cs) {
  /* icons are recoloured with filter/opacity in CSS; keep the hint for Figma */
  var f = cs.filter && cs.filter !== 'none' ? cs.filter : null;
  return f ? { filter: f } : null;
}

/* ---------------------------------------------------------------- tokens -- */

function collectTokens() {
  var tokens = {}, order = [];
  function scan(rules) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      /* CSSStyleRule carries an (empty) cssRules list for nesting, so read the
         declarations first and only then walk down. */
      if (r.cssRules && r.cssRules.length) scan(r.cssRules);
      if (!r.style) continue;
      for (var j = 0; j < r.style.length; j++) {
        var prop = r.style[j];
        if (prop.indexOf('--') !== 0) continue;
        var val = r.style.getPropertyValue(prop).trim();
        if (!tokens[prop]) order.push(prop);
        tokens[prop] = { value: val, scope: r.selectorText || '' };
      }
    }
  }
  for (var s = 0; s < document.styleSheets.length; s++) {
    try { scan(document.styleSheets[s].cssRules); } catch (e) { /* cross-origin */ }
  }
  /* resolve to used values against :root */
  var root = document.documentElement, cs = getComputedStyle(root);
  return order.map(function (name) {
    var used = cs.getPropertyValue(name).trim() || tokens[name].value;
    var col = /^(#|rgb|hsl|color\()/i.test(used) ? parseColor(used) : null;
    return {
      name: name, raw: tokens[name].value, value: used, scope: tokens[name].scope,
      color: col ? { r: round(col.r, 5), g: round(col.g, 5), b: round(col.b, 5), a: round(col.a, 4) } : null,
      number: /^-?[\d.]+px$/.test(used) ? parseFloat(used) : null
    };
  });
}

/* ------------------------------------------------------------------ api --- */

function extractScreen(el, name) {
  stats = { nodes: 0, text: 0, auto: 0, absolute: 0, grouped: 0, reasons: {} };
  var rect = el.getBoundingClientRect();
  var cs = getComputedStyle(el);
  var root = build(el, null, 0);
  if (!root) return null;
  root.name = name;
  root.x = 0; root.y = 0;
  root.screen = name;
  root.stats = stats;
  return root;
}

window.THE90_EXPORT = {
  tokens: collectTokens,
  assets: function () {
    return Object.keys(assetCache).map(function (k) {
      var a = assetCache[k];
      return { path: a.path, kind: a.kind, markup: a.kind === 'svg' ? a.markup : undefined };
    });
  },
  fetchAssets: fetchPendingSvgs,
  screen: extractScreen,
  reset: function () { assetCache = {}; },
  probe: function (sel) {
    var el = document.querySelector(sel);
    return el ? extractScreen(el, sel) : null;
  }
};

console.log('[THE90_EXPORT] ready');
})();
