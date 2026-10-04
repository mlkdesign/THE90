/* =========================================================
   THE90 landing — interactions
   ========================================================= */
(function () {
  'use strict';

  var I = window.THE90_I18N;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STORE = 'the90.landing.lang';
  var lang = I.DEFAULT;

  /* ---------------- clubs marquee ---------------- */
  var CLUBS = ['c1','c2','c3','c4','c5','c6'];
  (function clubs() {
    var row = '';
    for (var i = 0; i < 3; i++) {
      CLUBS.forEach(function (c) {
        // no lazy loading here: the marquee moves by transform, so off-screen
        // frames would never trigger the loader and the strip would show gaps
        row += '<img src="assets/clubs/' + c + '.png" alt="" width="42" height="42">';
      });
    }
    // duplicated once more so the -50% marquee loops seamlessly
    $('[data-clubs]').innerHTML = row + row;
  })();

  /* ---------------- FAQ ---------------- */
  var FAQ = ['q1','q2','q3','q4','q5','q6'];
  (function faq() {
    $('[data-faq]').innerHTML = FAQ.map(function (q, i) {
      return '<div class="faq-item' + (i === 0 ? ' is-open' : '') + '">' +
        '<button class="faq-q" type="button" aria-expanded="' + (i === 0) + '">' +
          '<span data-i18n="faq.' + q + '"></span>' +
          '<span class="faq-ico" aria-hidden="true"><i></i><i></i></span>' +
        '</button>' +
        '<div class="faq-a"><div><p data-i18n="faq.a' + (i + 1) + '"></p></div></div>' +
      '</div>';
    }).join('');

    $('[data-faq]').addEventListener('click', function (e) {
      var q = e.target.closest('.faq-q');
      if (!q) return;
      var item = q.closest('.faq-item');
      var open = !item.classList.contains('is-open');
      // accordion: close the rest
      $$('.faq-item', $('[data-faq]')).forEach(function (it) {
        it.classList.remove('is-open');
        $('.faq-q', it).setAttribute('aria-expanded', 'false');
      });
      if (open) { item.classList.add('is-open'); q.setAttribute('aria-expanded', 'true'); }
    });
  })();

  /* ---------------- i18n ---------------- */
  function t(k) {
    var d = I.DICT[lang] || I.DICT[I.DEFAULT];
    return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : (I.DICT[I.DEFAULT][k] || '');
  }

  function applyLang(next) {
    lang = I.DICT[next] ? next : I.DEFAULT;
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });

    var n = I.NUM[lang] || I.NUM[I.DEFAULT];
    var b = $$('.stat b');
    if (b[0]) { b[0].textContent = n.s1; b[0].dataset.done = '1'; }
    if (b[1]) { b[1].textContent = n.s2; b[1].dataset.done = '1'; }

    var meta = I.LOCALES.filter(function (l) { return l.code === lang; })[0];
    if (meta) $('[data-lang-current]').textContent = meta.short;
    $$('[data-lang-menu] .lang__item').forEach(function (it) {
      it.setAttribute('aria-selected', String(it.dataset.code === lang));
    });
    try { localStorage.setItem(STORE, lang); } catch (e) {}
  }

  (function langSwitch() {
    var wrap = $('[data-lang]'), btn = $('[data-lang-toggle]'), menu = $('[data-lang-menu]');
    menu.innerHTML = I.LOCALES.map(function (l) {
      return '<li role="none"><button class="lang__item" type="button" role="option" data-code="' + l.code + '">' +
        '<span>' + l.flag + '</span><em>' + l.label + '</em><b>✓</b></button></li>';
    }).join('');

    function open(on) {
      menu.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
      wrap.classList.toggle('is-open', on);
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var it = e.target.closest('[data-code]');
      if (!it) return;
      applyLang(it.dataset.code); open(false); btn.focus();
    });
    document.addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); }
    });

    var saved = null;
    try { saved = localStorage.getItem(STORE); } catch (e) {}
    applyLang(saved && I.DICT[saved] ? saved : I.DEFAULT);
  })();

  /* ---------------- header ---------------- */
  (function header() {
    var h = $('[data-hdr]');
    var on = function () { h.classList.toggle('is-stuck', window.scrollY > 10); };
    on(); window.addEventListener('scroll', on, { passive: true });

    // mobile drawer
    var burger = $('[data-burger]'), drawer = $('[data-mnav]');
    if (!burger || !drawer) return;

    function open(state) {
      h.classList.toggle('is-nav-open', state);
      burger.setAttribute('aria-expanded', String(state));
      drawer.hidden = !state;
    }
    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      open(burger.getAttribute('aria-expanded') !== 'true');
    });
    // any link closes it
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) open(false);
    });
    document.addEventListener('click', function (e) {
      if (!h.contains(e.target)) open(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') open(false);
    });
    // leaving the mobile range must not strand the drawer open
    window.matchMedia('(min-width: 1440px)').addEventListener('change', function (m) {
      if (m.matches) open(false);
    });
  })();

  /* ---------------- reveal on scroll ---------------- */
  (function reveal() {
    var els = $$('[data-reveal]');
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('is-in'); }); return;
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        // reveal when it scrolls in — and also when it is already above the
        // viewport, so anchor jumps and deep links never leave a section blank
        if (!x.isIntersecting && x.boundingClientRect.top > 0) return;
        x.target.classList.add('is-in');
        io.unobserve(x.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .1 });
    els.forEach(function (e, i) {
      e.style.transitionDelay = (i % 3) * 90 + 'ms';
      io.observe(e);
    });

    // A hash jump can carry an element from "below the fold" to "above" without
    // ever intersecting, so the observer never fires for it. Sweep for those.
    function sweep() {
      var left = els.filter(function (e) { return !e.classList.contains('is-in'); });
      left.forEach(function (e) {
        if (e.getBoundingClientRect().top < window.innerHeight) {
          e.classList.add('is-in');
          io.unobserve(e);
        }
      });
      if (!left.length) window.removeEventListener('scroll', onScroll);
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; sweep(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('hashchange', function () { setTimeout(sweep, 60); });

    // The browser applies a #hash jump (and restores scroll) after `load`, and
    // that move emits no scroll event — so poll briefly instead of trusting one.
    // setTimeout rather than rAF: rAF is paused while the tab is backgrounded.
    var ticks = 0;
    var settle = setInterval(function () {
      sweep();
      if (++ticks > 16) clearInterval(settle);
    }, 120);
  })();

  /* ---------------- counting stats ---------------- */
  (function counters() {
    if (reduce) return;
    var els = $$('.stat b');
    var fmt = function (v, el) {
      var n = I.NUM[lang] || I.NUM[I.DEFAULT];
      if (el === els[0]) return Math.round(v).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
      if (el === els[1]) return (lang === 'ru' ? v.toFixed(1).replace('.', ',') + ' млн' : v.toFixed(1) + 'M');
      return String(Math.round(v));
    };
    var run = function (el) {
      var target = parseFloat(el.dataset.count);
      var t0 = performance.now(), dur = 1400;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e, el);
        if (p < 1) requestAnimationFrame(step);
        else { el.dataset.done = '1'; applyLang(lang); }
      })(t0);
    };
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (!x.isIntersecting || x.target.dataset.done) return;
        io.unobserve(x.target); run(x.target);
      });
    }, { threshold: .6 });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* ---------------- pointer tilt / parallax ---------------- */
  (function tilt() {
    if (reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-tilt]').forEach(function (el) {
      var host = el.closest('section') || document.body;
      var raf = null, tx = 0, ty = 0;
      host.addEventListener('mousemove', function (e) {
        var r = host.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        tx = px; ty = py;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          el.style.transform =
            'perspective(1400px) rotateY(' + (tx * 9).toFixed(2) + 'deg) rotateX(' +
            (-ty * 7).toFixed(2) + 'deg) translate3d(' + (tx * 22).toFixed(1) + 'px,' +
            (ty * 14).toFixed(1) + 'px,0)';
        });
      });
      host.addEventListener('mouseleave', function () { el.style.transform = ''; });
      // a leftover inline transform would fight the stacked mobile layout
      window.matchMedia('(max-width: 1439px)').addEventListener('change', function (m) {
        if (m.matches) el.style.transform = '';
      });
    });
  })();

  /* ---------------- floating chips ---------------- */
  (function floaters() {
    if (reduce) return;
    $$('[data-float]').forEach(function (el, i) {
      el.style.animation = 'bob ' + (5 + i) + 's ease-in-out ' + (-i * 1.7) + 's infinite';
    });
  })();

  /* ---------------- interactive match card ---------------- */
  (function matchCard() {
    var card = $('[data-mcard]');
    if (!card) return;

    $$('[data-seg] .seg__b', card).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-seg] .seg__b', card).forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
      });
    });

    $$('[data-stp]', card).forEach(function (stp) {
      var out = $('.stp__v', stp);
      $$('.stp__b', stp).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var v = parseInt(out.textContent, 10) + Number(btn.dataset.d);
          if (v < 0) v = 0; if (v > 9) v = 9;
          out.textContent = String(v);
          out.classList.remove('is-bump');
          void out.offsetWidth;
          out.classList.add('is-bump');
          // the score decides the result, same rule as in the app
          var a = parseInt($$('[data-stp] .stp__v', card)[0].textContent, 10);
          var b2 = parseInt($$('[data-stp] .stp__v', card)[1].textContent, 10);
          var want = a > b2 ? 'home' : (a === b2 ? 'draw' : 'away');
          $$('[data-seg] .seg__b', card).forEach(function (x) {
            x.classList.toggle('is-on', x.dataset.val === want);
          });
        });
      });
    });
  })();

})();
