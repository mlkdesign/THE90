/* =========================================================================
   Draws the exported scene graph back out as HTML, straight from the Figma
   paints and geometry the plugin will use. If this page and the prototype
   look the same, the export carries the design; if a gradient transform or a
   text metric is wrong, it shows up here rather than in Figma.
   ========================================================================= */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
const svgByPath = new Map();
for (const a of JSON.parse(readFileSync(join(DIR, 'assets.json'), 'utf8')).assets) {
  if (a.kind === 'svg' && a.markup) svgByPath.set(a.path, a.markup);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgba = c => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a === undefined ? 1 : +c.a.toFixed(4)})`;

/* invert the gradientTransform to recover the two handles, then say it in CSS —
   if the transform is wrong this is where it goes visibly wrong */
function handles(t) {
  const [[a, b, e], [c, d, f]] = t;
  const det = a * d - b * c;
  if (!det) return [[0, 0], [1, 0]];
  const inv = (x, y) => [(d * (x - e) - b * (y - f)) / det, (-c * (x - e) + a * (y - f)) / det];
  return [inv(0, 0), inv(1, 0)];
}

function gradientCss(p, w, h) {
  const stops = p.gradientStops.map(s => `${rgba(s.color)} ${(s.position * 100).toFixed(2)}%`).join(', ');
  if (p.type === 'GRADIENT_LINEAR') {
    const [p0, p1] = handles(p.gradientTransform);
    const dx = (p1[0] - p0[0]) * w, dy = (p1[1] - p0[1]) * h;
    const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    const x0 = (p0[0] * 100).toFixed(3), y0 = (p0[1] * 100).toFixed(3);
    const x1 = (p1[0] * 100).toFixed(3), y1 = (p1[1] * 100).toFixed(3);
    const len = Math.hypot(dx, dy);
    return `linear-gradient(${deg.toFixed(2)}deg, ${p.gradientStops.map(s => {
      const px = (s.position * len).toFixed(2);
      return `${rgba(s.color)} ${px}px`;
    }).join(', ')})`;
  }
  const [[a, , e], [, d, f]] = p.gradientTransform;
  const cx = (0.5 - e) / a, cy = (0.5 - f) / d;
  const rx = 1 / (2 * a), ry = 1 / (2 * d);
  return `radial-gradient(${(rx * w).toFixed(2)}px ${(ry * h).toFixed(2)}px at ${(cx * 100).toFixed(2)}% ${(cy * 100).toFixed(2)}%, ${stops})`;
}

function background(spec) {
  const fills = spec.fills || [];
  if (!fills.length) return '';
  /* Figma paints the last fill on top; CSS paints the first layer on top */
  const layers = [];
  let base = '';
  for (const p of [...fills].reverse()) {
    if (p.type === 'SOLID') {
      const c = { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity === undefined ? 1 : p.opacity };
      if (!layers.length) base = rgba(c);
      else layers.push(`linear-gradient(${rgba(c)}, ${rgba(c)})`);
    } else if (p.type === 'IMAGE') {
      layers.push(`url("../${p.asset}")`);
    } else {
      layers.push(gradientCss(p, spec.w, spec.h));
    }
  }
  let css = '';
  if (layers.length) {
    css += `background-image:${layers.join(',')};`;
    css += `background-size:${layers.map(l => l.startsWith('url') ? 'cover' : '100% 100%').join(',')};`;
    css += 'background-position:center;background-repeat:no-repeat;';
  }
  if (base) css += `background-color:${base};`;
  return css;
}

function box(spec) {
  let css = '';
  css += background(spec);
  if (spec.radius) css += `border-radius:${spec.radius.map(r => r + 'px').join(' ')};`;
  if (spec.opacity !== undefined) css += `opacity:${spec.opacity};`;
  if (spec.clip) css += 'overflow:hidden;';

  const shadows = [];
  let filter = '', backdrop = '';
  for (const e of spec.effects || []) {
    if (e.type === 'DROP_SHADOW') shadows.push(`${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread || 0}px ${rgba(e.color)}`);
    else if (e.type === 'INNER_SHADOW') shadows.push(`inset ${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread || 0}px ${rgba(e.color)}`);
    else if (e.type === 'LAYER_BLUR') filter += `blur(${e.radius / 2}px) `;
    else if (e.type === 'BACKGROUND_BLUR') backdrop += `blur(${e.radius / 2}px) `;
  }
  if (spec.strokes && spec.strokes.length) {
    const w = spec.strokeWeights || { t: spec.strokeWeight || 1, r: 1, b: 1, l: 1 };
    const c = rgba({ r: spec.strokes[0].color.r, g: spec.strokes[0].color.g, b: spec.strokes[0].color.b, a: spec.strokes[0].opacity });
    if (spec.dashPattern) {
      /* outline keeps the box the same size, which inset shadows cannot do dashed */
      css += `outline:${w.t}px dashed ${c};outline-offset:-${w.t}px;`;
    } else {
      shadows.push(`inset 0 ${w.t}px 0 0 ${c}`, `inset 0 -${w.b}px 0 0 ${c}`, `inset ${w.l}px 0 0 0 ${c}`, `inset -${w.r}px 0 0 0 ${c}`);
    }
  }
  if (shadows.length) css += `box-shadow:${shadows.join(',')};`;
  if (filter) css += `filter:${filter.trim()};`;
  if (backdrop) css += `backdrop-filter:${backdrop.trim()};-webkit-backdrop-filter:${backdrop.trim()};`;
  if (spec.blend) css += `mix-blend-mode:${spec.blend.toLowerCase().replace(/_/g, '-')};`;
  if (spec.mask && spec.mask.length) {
    const m = gradientCss(spec.mask[0], spec.w, spec.h);
    css += `mask-image:${m};-webkit-mask-image:${m};mask-size:100% 100%;-webkit-mask-size:100% 100%;`;
  }
  return css;
}

const CASE = { UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' };

function textHtml(spec) {
  const t = spec.text;
  const segs = t.segments.length ? t.segments : [];
  let html = '';
  let at = 0;
  for (const s of segs) {
    if (s.start > at) html += esc(t.characters.slice(at, s.start)).replace(/\n/g, '<br>');
    const st = s.style;
    const style = [
      `font-family:'${st.family}',sans-serif`,
      `font-weight:${weightOf(st.style)}`,
      `font-size:${st.size}px`,
      st.lineHeight ? `line-height:${st.lineHeight}px` : 'line-height:normal',
      `letter-spacing:${st.letterSpacing || 0}px`,
      `color:${rgba(st.color)}`,
      st.decoration === 'UNDERLINE' ? 'text-decoration:underline' : st.decoration === 'STRIKETHROUGH' ? 'text-decoration:line-through' : '',
      CASE[st.case] ? `text-transform:${CASE[st.case]}` : ''
    ].filter(Boolean).join(';');
    html += `<span style="${style}">${esc(t.characters.slice(s.start, s.end)).replace(/\n/g, '<br>')}</span>`;
    at = s.end;
  }
  if (at < t.characters.length) html += esc(t.characters.slice(at)).replace(/\n/g, '<br>');
  return html;
}

const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };
const weightOf = s => WEIGHTS[String(s).replace(' Italic', '')] || 400;

function node(spec, out) {
  const base = `position:absolute;left:${spec.x || 0}px;top:${spec.y || 0}px;width:${spec.w}px;height:${spec.h}px;`;

  if (spec.type === 'TEXT') {
    const t = spec.text;
    const align = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }[t.align] || 'left';
    const v = t.vAlign === 'CENTER' ? 'center' : t.vAlign === 'BOTTOM' ? 'flex-end' : 'flex-start';
    const wrap = t.nowrap ? 'white-space:nowrap;' : '';
    out.push(`<div style="${base}display:flex;flex-direction:column;justify-content:${v};text-align:${align};${wrap}${t.truncate ? 'overflow:hidden;' : ''}${spec.opacity !== undefined ? 'opacity:' + spec.opacity + ';' : ''}"><div style="${wrap}${t.truncate ? 'overflow:hidden;text-overflow:ellipsis;' : ''}">${textHtml(spec)}</div></div>`);
    return;
  }

  if (spec.type === 'SVG') {
    const markup = spec.markup || svgByPath.get(spec.asset) || '';
    const inner = markup.replace(/<svg([^>]*)>/i, (m, attrs) => {
      const vb = attrs.match(/viewBox\s*=\s*"([^"]+)"/i);
      return `<svg${vb ? ' viewBox="' + vb[1] + '"' : ''} width="100%" height="100%" preserveAspectRatio="none">`;
    });
    out.push(`<div style="${base}${spec.opacity !== undefined ? 'opacity:' + spec.opacity + ';' : ''}">${inner}</div>`);
    return;
  }

  if (spec.type === 'IMAGE') {
    const fit = spec.scaleMode === 'FIT' ? 'contain' : spec.scaleMode === 'CROP' ? 'none' : 'cover';
    out.push(`<img src="../${spec.asset}" style="${base}object-fit:${fit};${box(spec)}">`);
    return;
  }

  out.push(`<div style="${base}${box(spec)}">`);
  for (const c of spec.children || []) node(c, out);
  out.push('</div>');
}

function screen(data, label) {
  const scene = data.scene;
  const dev = scene.device || { w: 390, h: 852 };
  const stack = (scene.shell || []).map(s => ({ spec: s, z: s.z || 0 }));
  stack.push({ spec: scene, z: scene.z === undefined ? 5000 : scene.z });
  stack.sort((a, b) => a.z - b.z);

  const out = [];
  out.push(`<figure><figcaption>${esc(label)}</figcaption><div class="screen" style="width:${dev.w}px;height:${dev.h}px">`);
  for (const item of stack) {
    const spec = Object.assign({}, item.spec, item.spec === scene ? { x: 0, y: 0 } : {});
    node(spec, out);
  }
  out.push('</div></figure>');
  return out.join('');
}

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const only = process.argv[2];
const entries = only ? index.entries.filter(e => e.file.includes(only)) : index.entries;

const body = entries.map(e => screen(JSON.parse(readFileSync(join(DIR, e.file), 'utf8')), e.label)).join('\n');

writeFileSync(join(DIR, 'preview.html'), `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>THE90 — Figma export preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@100;200;300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:40px;background:#000;font-family:Sora,sans-serif;display:flex;flex-wrap:wrap;gap:48px}
  figure{margin:0}
  figcaption{color:#A5B7AE;font-size:13px;margin-bottom:10px}
  .screen{position:relative;overflow:hidden;background:#0E0E0E;border-radius:28px}
  .screen div{box-sizing:border-box}
</style></head><body>${body}</body></html>`);

console.log('preview.html written · ' + entries.length + ' screens');
