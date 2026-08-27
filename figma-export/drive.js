/* THE90 — export driver. Walks the prototype screen by screen (and state by
   state) and posts every captured scene to the dev server's /__save sink.
   Dev-only: nothing here ships with the app. */
(function () {
'use strict';

var SCREEN_W = 390, SCREEN_H = 852;

function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

function lock() {
  var s = document.getElementById('__figma_lock');
  if (!s) { s = document.createElement('style'); s.id = '__figma_lock'; document.head.appendChild(s); }
  s.textContent =
    'html{--dev-scale:1 !important}\n' +
    '*,*::before,*::after{transition:none !important;animation:none !important;animation-duration:0s !important;animation-play-state:paused !important}\n' +
    '.screen.is-leaving{display:none !important}';

  /* carousels, tickers and countdowns keep re-writing the DOM under us —
     stop every repeating timer so each screen is captured at rest */
  if (!window.__figmaFrozen) {
    var top = setInterval(function () {}, 1e9);
    for (var i = 1; i <= top; i++) clearInterval(i);
    window.__figmaFrozen = true;
  }
}

function post(name, payload) {
  return fetch('/__save?name=' + encodeURIComponent(name), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function (r) { return r.json(); });
}

/* Scroll ports are captured whole: park them at the top, then put them back. */
function unclip(root) {
  var undo = [];
  $$('*', root).forEach(function (el) {
    var cs = getComputedStyle(el);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollTop) { undo.push({ el: el, top: el.scrollTop }); el.scrollTop = 0; }
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollLeft) { undo.push({ el: el, left: el.scrollLeft }); el.scrollLeft = 0; }
  });
  return function () { undo.forEach(function (u) { if (u.top != null) u.el.scrollTop = u.top; if (u.left != null) u.el.scrollLeft = u.left; }); };
}

/* The chrome that lives outside the screen sections but inside the phone. */
var SHELL = ['.app__bg', '.statusbar', '[data-shell-footer]', '.home-indicator'];

/* paint order inside the phone: stacking context first, DOM order second */
function paintOrder(el) {
  var app = $('#app');
  var cs = getComputedStyle(el);
  var idx = Array.prototype.indexOf.call(app.children, el);
  if (idx < 0) idx = 999;
  return (parseInt(cs.zIndex, 10) || 0) * 10000 + idx;
}

function shellNodes() {
  var app = $('#app').getBoundingClientRect();
  var out = [];
  SHELL.forEach(function (sel) {
    var el = $(sel);
    if (!el) return;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.hidden) return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var node = window.THE90_EXPORT.screen(el, sel.replace(/[\[\]".]/g, '').replace('data-shell-footer', 'tabbar'));
    if (!node) return;
    node.x = Math.round((r.left - app.left) * 100) / 100;
    node.y = Math.round((r.top - app.top) * 100) / 100;
    node.absolute = true;
    node.z = paintOrder(el);
    out.push(node);
  });
  return out.sort(function (a, b) { return a.z - b.z; });
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

var captured = [];

function capture(screenName, opts) {
  opts = opts || {};
  var label = opts.label || screenName;
  lock();
  if (opts.go !== false) window.THE90.go(screenName);
  var undoOverlays = opts.before ? null : clearOverlays();
  var undoBefore = opts.before ? opts.before() : null;
  var undo = function () { if (undoBefore) undoBefore(); if (undoOverlays) undoOverlays(); };
  document.body.offsetHeight;

  var whole = !!opts.selector;
  var el = $(opts.selector || '[data-screen="' + screenName + '"]');
  if (!el) { undo(); return Promise.resolve({ error: 'no element', label: label }); }

  var restore = unclip(el);
  var scene = window.THE90_EXPORT.screen(el, label);
  if (!scene && !opts.selector) {
    /* the router can leave a screen mid-swap; put it on stage and look again */
    el.classList.remove('is-leaving');
    el.classList.add('is-active');
    document.body.offsetHeight;
    scene = window.THE90_EXPORT.screen(el, label);
  }
  restore();
  if (!scene) { undo(); return Promise.resolve({ error: 'nothing rendered', label: label }); }

  scene.shell = whole ? [] : shellNodes();
  scene.z = whole ? 0 : paintOrder(el);
  scene.device = { w: SCREEN_W, h: SCREEN_H };
  scene.whole = whole;

  /* an overlay capture is the whole phone: park it at the app's own origin */
  if (whole) { scene.x = 0; scene.y = 0; }
  undo();

  return window.THE90_EXPORT.fetchAssets().then(function () {
    var file = 'screens/' + slug(label) + '.json';
    return post(file, { screen: label, base: screenName, scene: scene }).then(function (r) {
      captured.push({ label: label, base: screenName, file: file, kind: opts.kind || 'screen', bytes: r.bytes, stats: scene.stats });
      return { ok: true, label: label, bytes: r.bytes, stats: scene.stats };
    });
  });
}

/* ---------------------------------------------------------------- states -- */

function clickState(sel) {
  return function () {
    var btn = $(sel);
    if (btn) btn.click();
    return null;                         // tabs stay switched; that is fine
  };
}

/* Every overlay in the prototype lives in the same layer, and one of them
   (the reward) is already open when the app boots. Each overlay capture has to
   start from an empty stage or the reward leaks into all of them. */
var OVERLAYS = ['[data-modal]', '[data-points-modal]', '[data-arena-join-modal]', '[data-settings-overlay]', '[data-round-picker]'];

function clearOverlays() {
  var was = OVERLAYS.map(function (sel) {
    var el = $(sel);
    if (!el) return null;
    var state = { el: el, hidden: el.hidden };
    el.hidden = true;
    return state;
  });
  return function () { was.forEach(function (w) { if (w) w.el.hidden = w.hidden; }); };
}

function showOverlay(sel, extraClass) {
  return function () {
    var restore = clearOverlays();
    var el = $(sel);
    if (!el) return restore;
    el.hidden = false;
    if (extraClass) el.classList.add(extraClass);
    return function () { if (extraClass) el.classList.remove(extraClass); restore(); };
  };
}

function showSheet(panel) {
  return function () {
    var restore = clearOverlays();
    var overlay = $('[data-settings-overlay]');
    if (!overlay) return restore;
    var panels = $$('[data-settings-panel]', overlay);
    var was = panels.map(function (p) { return p.hidden; });
    panels.forEach(function (p) { p.hidden = p.dataset.settingsPanel !== panel; });
    overlay.hidden = false;
    return function () { panels.forEach(function (p, i) { p.hidden = was[i]; }); restore(); };
  };
}

var STATES = [
  { screen: 'leagues',          label: 'leagues · joined',              before: clickState('[data-leagues-tab="joined"]') },
  { screen: 'leagues',          label: 'leagues · my leagues',          before: clickState('[data-leagues-tab="own"]') },
  /* the tournament tabs are one horizontal scroll-snap track, so the base
     capture already carries every panel side by side — no extra states */

  { screen: 'main',             label: 'modal · points guide',   selector: '#app', kind: 'overlay', before: showOverlay('[data-points-modal]') },
  { screen: 'main',             label: 'modal · reward',         selector: '#app', kind: 'overlay', before: showOverlay('[data-modal]') },
  { screen: 'arena',            label: 'modal · join tournament', selector: '#app', kind: 'overlay', before: showOverlay('[data-arena-join-modal]') },
  { screen: 'arena',            label: 'modal · joined',          selector: '#app', kind: 'overlay', before: showOverlay('[data-arena-join-modal]', 'is-success') },
  { screen: 'league-round-edit', label: 'sheet · add match',      selector: '#app', kind: 'overlay', before: showOverlay('[data-round-picker]') },

  { screen: 'settings', label: 'sheet · change e-mail',  selector: '#app', kind: 'overlay', before: showSheet('email') },
  { screen: 'settings', label: 'sheet · change password', selector: '#app', kind: 'overlay', before: showSheet('password') },
  { screen: 'settings', label: 'sheet · language',        selector: '#app', kind: 'overlay', before: showSheet('language') },
  { screen: 'settings', label: 'sheet · teams',           selector: '#app', kind: 'overlay', before: showSheet('teams') },
  { screen: 'settings', label: 'sheet · unlock avatar',   selector: '#app', kind: 'overlay', before: showSheet('avatar-unlock') },
  { screen: 'settings', label: 'sheet · premium',         selector: '#app', kind: 'overlay', before: showSheet('premium') },
  { screen: 'settings', label: 'sheet · log out',         selector: '#app', kind: 'overlay', before: showSheet('logout') }
];

/* ------------------------------------------------------------------ api --- */

window.THE90_DRIVE = {
  lock: lock,
  capture: capture,
  states: STATES,
  screens: function () { return $$('[data-screen]').map(function (s) { return s.dataset.screen; }); },

  captureScreens: function (list) {
    return list.reduce(function (chain, n) {
      return chain.then(function (acc) { return capture(n).then(function (r) { acc.push(r); return acc; }); });
    }, Promise.resolve([]));
  },

  captureStates: function (list) {
    return list.reduce(function (chain, st) {
      return chain.then(function (acc) {
        return capture(st.screen, st).then(function (r) { acc.push(r); return acc; });
      });
    }, Promise.resolve([]));
  },

  finish: function () {
    return post('assets.json', { assets: window.THE90_EXPORT.assets() }).then(function (a) {
      return post('index.json', {
        generated: new Date().toISOString(),
        device: { w: SCREEN_W, h: SCREEN_H },
        entries: captured
      }).then(function (i) { return { assets: a, index: i, count: captured.length }; });
    });
  },

  tokens: function () { return post('tokens.json', { tokens: window.THE90_EXPORT.tokens() }); },
  reset: function () { captured = []; window.THE90_EXPORT.reset(); }
};

console.log('[THE90_DRIVE] ready');
})();
