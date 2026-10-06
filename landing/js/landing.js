/* =========================================================
   THE90 landing — interactions
   ========================================================= */
(function () {
  'use strict';

  var I = window.THE90_I18N;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Only a language picked in the menu is remembered; the inline script in
     <head> has already chosen one from it, or from the browser, for this view.
     The old key stored whatever was showing, so it would mask auto-detection. */
  var STORE = 'the90.landing.lang.choice';
  try { localStorage.removeItem('the90.landing.lang'); } catch (e) {}
  var lang = I.DICT[window.THE90_LANG] ? window.THE90_LANG : I.DEFAULT;

  function t(k) {
    var d = I.DICT[lang] || I.DICT[I.DEFAULT];
    return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : (I.DICT[I.DEFAULT][k] || '');
  }

  // after the preloader lifts — or at once, if there is none
  function ready(fn) {
    if (window.THE90_READY || !document.documentElement.classList.contains('is-loading')) fn();
    else window.addEventListener('the90:ready', fn, { once: true });
  }

  // a background tab gets no animation frames
  function soon(fn) {
    if (document.hidden) setTimeout(fn, 16); else requestAnimationFrame(fn);
  }

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
          '<span class="faq-ico" aria-hidden="true"><svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M0.9 1.2L4.5 4.8L8.1 1.2" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
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

  /* ---------------- download row ----------------
     iOS / Android get our button plus that platform's badge; any other OS
     gets both official badges instead. Runs before i18n so applyLang() sees
     the platform key this sets. */
  (function downloads() {
    var ua = navigator.userAgent || '';
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || '';
    var ios = /iPad|iPhone|iPod/.test(ua) ||
      (/Mac/.test(ua + plat) && navigator.maxTouchPoints > 1); /* iPadOS reports as Mac */
    var and = /Android/i.test(ua) || /Android/i.test(plat);
    var os = ios ? 'ios' : and ? 'and' : 'other';

    document.documentElement.setAttribute('data-os', os);

    $$('[data-dl]').forEach(function (row) {
      var bIos = row.querySelector('[data-dl-ios]');
      var bAnd = row.querySelector('[data-dl-and]');
      if (os === 'other') { row.querySelector('.dl__now').hidden = true; return; }
      var keep = os === 'ios' ? bIos : bAnd;
      (os === 'ios' ? bAnd : bIos).hidden = true;
      /* the plate beside our button names the platform */
      keep.querySelector('i').setAttribute('data-i18n', os === 'ios' ? 'dl.ios' : 'dl.and');
    });
  }());

  /* ---------------- daily challenges ----------------
     The app's pick rail, playable on the page — the same card and the same
     rules as js/pick-card.js and js/main.js: a pick is complete once it has
     an exact score, which also decides the result; Accept pick banks it and
     moves on to the next open card; five banked picks close the round on the
     tick card at the end of the rail. Built before i18n runs, so the cards'
     labels are translated with everything else. */
  (function dailyChallenges() {
    var root = $('[data-dc]');
    if (!root) return;

    var NAMES = {
      'real-madrid': 'Real Madrid', 'barcelona': 'FC Barcelona', 'liverpool': 'Liverpool',
      'man-united': 'Manchester United', 'bayern': 'Bayern Munich', 'dortmund': 'Borussia Dortmund',
      'arsenal': 'Arsenal', 'chelsea': 'Chelsea'
    };
    var MATCHES = [
      { home: 'real-madrid', away: 'barcelona',  kick: '21:00' },
      { home: 'liverpool',   away: 'man-united', kick: '17:30' },
      { home: 'bayern',      away: 'dortmund',   kick: '18:30' },
      { home: 'arsenal',     away: 'chelsea',    kick: '20:00' },
      { home: 'man-united',  away: 'arsenal',    kick: '16:00' }
    ];
    var N = MATCHES.length;
    var POINTS = 40;           // a complete daily pick is worth 40, as in js/data.js
    var MAX_GOALS = 20;

    var picks = MATCHES.map(function () { return { outcome: null, score: { home: null, away: null } }; });
    var banked = MATCHES.map(function () { return false; });
    var finished = false, dismissed = false, armed = false, inView = true;

    var rail = $('[data-dc-rail]', root);
    var stage = rail.parentNode;
    var prevBtn = $('[data-dc-prev]', root);
    var nextBtn = $('[data-dc-next]', root);
    var meter = $('[data-dc-meter]', root);
    var doneCell = $('[data-dc-done]', root);
    var deadline = $('[data-dc-deadline]', root);
    var slot = $('[data-winbar-slot]', root);
    var bar = $('[data-winbar]', root);
    var cta = $('[data-win-cta]', bar);
    var closeBtn = $('[data-win-close]', bar);
    var points = $('[data-win-points]', bar);
    var wide = window.matchMedia('(min-width: 1024px)');

    var BALL = '<img src="assets/icons/soccer-ball.svg" alt="" width="16" height="16">';

    function el(html) {
      var d = document.createElement('div');
      d.innerHTML = html.trim();
      return d.firstElementChild;
    }

    function complete(p) { return p.score.home !== null && p.score.away !== null; }
    function touched(p) { return !!p.outcome || complete(p); }
    function outcomeOf(h, a) {
      if (h === null || a === null) return null;
      return h > a ? 'home' : (h === a ? 'draw' : 'away');
    }

    /* ---- markup ---- */

    function team(slug) {
      return '<div class="mcard__team">' +
        '<img class="mcard__crest" src="assets/crests/' + slug + '.png" alt="" width="50" height="50">' +
        '<span class="mcard__name">' + NAMES[slug] + '</span>' +
      '</div>';
    }

    // Drum index 0 is the unselected dash; goals 0…20 live at 1…21.
    function drum(side, name) {
      var cells = '<span class="drum__cell drum__cell--none">–</span>';
      for (var g = 0; g <= MAX_GOALS; g += 1) cells += '<span class="drum__cell">' + g + '</span>';
      return '<div class="scorepad" data-side="' + side + '">' +
        '<button class="scorepad__step" type="button" data-step="-1" aria-label="' + name + ' −1">-</button>' +
        '<div class="drum" tabindex="0" role="spinbutton" aria-label="' + name + '" aria-valuetext="–">' +
          '<div class="drum__reel">' + cells + '</div>' +
        '</div>' +
        '<button class="scorepad__step" type="button" data-step="1" aria-label="' + name + ' +1">+</button>' +
      '</div>';
    }

    function cardMarkup(m, i) {
      var h = NAMES[m.home], a = NAMES[m.away];
      return '<article class="mcard" role="group" aria-roledescription="slide" data-card="' + i + '">' +
        '<img class="mcard__pitch" src="assets/img/match-card-background.png" alt="" width="358" height="356">' +
        '<div class="mcard__head">' +
          '<div class="pitch">' +
            '<span class="pitch__box pitch__box--l"></span><span class="pitch__box pitch__box--r"></span>' +
            '<span class="pitch__mid"></span><span class="pitch__circle"></span>' +
          '</div>' +
          '<span class="mcard__when"><span data-i18n="dc.today">Today</span> · ' + m.kick + '</span>' +
          '<div class="mcard__teams">' + team(m.home) + '<span class="mcard__vs">VS</span>' + team(m.away) + '</div>' +
        '</div>' +
        '<div class="mcard__bodywrap"><div class="mcard__body">' +
          '<div class="mcard__block">' +
            '<div class="mcard__labelrow">' +
              '<p class="mcard__label" data-i18n="dc.mres">Match result</p>' +
              '<span class="mcard__hint">(<span data-i18n="dc.cres">correct result</span>&nbsp;+10&nbsp;' + BALL + ')</span>' +
            '</div>' +
            '<div class="seg" role="group" data-outcome>' +
              '<button class="seg__btn" type="button" data-val="home" aria-pressed="false"><span>' + h + '</span></button>' +
              '<button class="seg__btn" type="button" data-val="draw" aria-pressed="false"><span data-i18n="dc.draw">Draw</span></button>' +
              '<button class="seg__btn" type="button" data-val="away" aria-pressed="false"><span>' + a + '</span></button>' +
            '</div>' +
          '</div>' +
          '<div class="mcard__block">' +
            '<div class="mcard__labelrow">' +
              '<span class="mcard__label" data-i18n="dc.mscore">Exact score</span>' +
              '<span class="mcard__hint">(<span data-i18n="dc.escore">exact score</span>&nbsp;+40&nbsp;' + BALL + ')</span>' +
            '</div>' +
            '<div class="scores">' + drum('home', h) + drum('away', a) + '</div>' +
          '</div>' +
        '</div></div>' +
      '</article>';
    }

    var cards = MATCHES.map(function (m, i) {
      var card = el(cardMarkup(m, i));
      rail.appendChild(card);
      return card;
    });

    // last stop on the rail, and the only card without a surface
    var doneCard = el(
      '<article class="mcard mcard--done" role="group" aria-roledescription="slide" hidden>' +
        '<div class="donecard">' +
          '<div class="donecard__art" aria-hidden="true" data-done-art>' +
            '<svg class="donecard__static" viewBox="0 0 140 140" fill="none"><circle cx="70" cy="70" r="46" fill="#24FF00"/>' +
            '<path d="M50 71l13 13 27-29" stroke="#06120D" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</div>' +
          '<p class="donecard__title" data-i18n="dc.done">All picks accepted</p>' +
          '<p class="donecard__win"><span data-i18n="dc.rating">Rating reward:</span><b>+ 5 ' + BALL + '</b></p>' +
          '<button class="donecard__edit" type="button" data-i18n="dc.edit" data-done-edit>Edit picks</button>' +
        '</div>' +
      '</article>');
    rail.appendChild(doneCard);

    /* ---- rendering ---- */

    function index(v) { return v === null ? 0 : v + 1; }

    function paintDrum(pad, p, animate) {
      var side = pad.dataset.side;
      var reel = $('.drum__reel', pad);
      var cell = reel.firstElementChild.offsetHeight || 48;
      var at = index(p.score[side]);
      reel.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.3,1)' : 'none';
      reel.style.transform = 'translateY(' + (-at * cell) + 'px)';
      $$('.drum__cell', reel).forEach(function (c, k) { c.classList.toggle('is-current', k === at); });
      $('.drum', pad).setAttribute('aria-valuetext', p.score[side] === null ? '–' : String(p.score[side]));
      // the dash is only a starting state: once a value exists, 0 is the floor
      $$('.scorepad__step', pad).forEach(function (b) {
        b.disabled = Number(b.dataset.step) < 0 ? at <= 1 : at === MAX_GOALS + 1;
      });
    }

    function render(i, animate) {
      var card = cards[i], p = picks[i];
      card.classList.toggle('is-picked', complete(p));
      $$('[data-outcome] .seg__btn', card).forEach(function (b) {
        var on = p.outcome === b.dataset.val;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      $$('.scorepad', card).forEach(function (pad) { paintDrum(pad, p, animate); });
    }

    /* ---- the rail ---- */

    function slides() { return doneCard.hidden ? cards : cards.concat(doneCard); }

    function current() {
      var list = slides(), base = cards[0].offsetLeft, x = rail.scrollLeft, best = 0, gap = Infinity;
      list.forEach(function (c, k) {
        var d = Math.abs(c.offsetLeft - base - x);
        if (d < gap) { gap = d; best = k; }
      });
      return best;
    }

    function slideTo(k, instant) {
      var list = slides();
      k = Math.max(0, Math.min(list.length - 1, k));
      rail.scrollTo({
        left: list[k].offsetLeft - cards[0].offsetLeft,
        behavior: (instant || reduce || document.hidden) ? 'auto' : 'smooth'
      });
    }

    function updateArrows() {
      var k = current(), last = slides().length - 1;
      prevBtn.classList.toggle('is-off', k <= 0);
      nextBtn.classList.toggle('is-off', k >= last);
      prevBtn.tabIndex = k <= 0 ? -1 : 0;
      nextBtn.tabIndex = k >= last ? -1 : 0;
    }

    function labelSlides() {
      cards.forEach(function (c, k) {
        c.setAttribute('aria-label', t('dc.slide').replace('{n}', k + 1).replace('{total}', N));
      });
      doneCard.setAttribute('aria-label', t('dc.done'));
    }

    /* ---- the round ---- */

    function nextOpen(from) {
      for (var s = 1; s <= N; s += 1) {
        var k = (from + s) % N;
        if (!banked[k]) return k;
      }
      return -1;
    }

    function nudge() {
      cta.classList.remove('is-nudging');
      void cta.offsetWidth;                 // restart the animation
      cta.classList.add('is-nudging');
    }

    // the button always speaks for the card on screen
    function updateCta() {
      var k = Math.min(current(), N - 1), p = picks[k];
      var ready = complete(p) && !banked[k];
      cta.setAttribute('aria-disabled', String(!ready));
      if (ready && !armed) nudge();
      if (!ready) cta.classList.remove('is-nudging');
      armed = ready;
      cta.textContent = (!complete(p) && p.outcome) ? t('dc.needscore') : t('dc.accept');
    }

    // wide screens keep the bar under the copy; phones get it as a sheet once
    // something is picked, while the cards are on screen and it was not closed
    function updateBar() {
      if (wide.matches) {
        bar.classList.remove('is-in');
        slot.classList.toggle('is-gone', finished);
      } else {
        bar.classList.toggle('is-in', picks.some(touched) && !finished && !dismissed && inView);
      }
    }

    function refresh() {
      var done = banked.filter(Boolean).length;
      doneCell.textContent = done;
      meter.style.width = (done / N * 100) + '%';
      points.textContent = '+' + picks.filter(complete).length * POINTS;
      updateCta();
      updateBar();
      updateArrows();
    }

    function shake(k) {
      var c = cards[k];
      c.classList.remove('is-shake');
      void c.offsetWidth;
      c.classList.add('is-shake');
      clearTimeout(c.shakeTimer);
      c.shakeTimer = setTimeout(function () { c.classList.remove('is-shake'); }, 900);
    }

    function changed(i) {
      banked[i] = false;               // touching a pick sends it back for confirmation
      dismissed = false;
      if (finished) { finished = false; doneCard.hidden = true; }
      render(i, true);
      prefetchTick();
      refresh();
    }

    function finish() {
      finished = true;
      doneCard.hidden = false;
      refresh();
      setTimeout(function () { slideTo(N); updateArrows(); }, 30);
      playTick();
    }

    /* The tick is the app's own animation, fetched as scripts rather than
       JSON so it also plays from a file:// copy. It starts loading on the
       first pick, long before the round can finish. */
    var tickData = null;
    function load(src) {
      return new Promise(function (ok, fail) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = ok;
        s.onerror = fail;
        document.head.appendChild(s);
      });
    }
    function prefetchTick() {
      if (!tickData) {
        tickData = (window.lottie ? Promise.resolve() : load('vendor/lottie-light.min.js'))
          .then(function () { return window.THE90_PICKS_DONE || load('assets/lottie/picks-done.js'); })
          .then(function () { return window.THE90_PICKS_DONE || null; })
          .catch(function () { return null; });
      }
      return tickData;
    }
    function playTick() {
      var art = $('[data-done-art]', doneCard);
      prefetchTick().then(function (data) {
        if (art.anim) { art.anim.goToAndPlay(0, true); return; }
        if (!data || !window.lottie) { art.classList.add('is-static'); return; }
        art.anim = window.lottie.loadAnimation({
          container: art, renderer: 'svg', loop: false, autoplay: true, animationData: data
        });
      });
    }

    /* ---- wiring: the cards ---- */

    cards.forEach(function (card, i) {
      var pick = picks[i];

      $$('[data-outcome] .seg__btn', card).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.val;
          pick.outcome = pick.outcome === v ? null : v;
          // an outcome that contradicts the entered score clears the score
          var implied = outcomeOf(pick.score.home, pick.score.away);
          if (pick.outcome && implied && implied !== pick.outcome) pick.score = { home: null, away: null };
          changed(i);
        });
      });

      function setIndex(side, at) {
        if (pick.score[side] === null && at <= 0) { render(i, true); return; }
        at = Math.max(1, Math.min(MAX_GOALS + 1, at));
        pick.score[side] = at - 1;
        var other = side === 'home' ? 'away' : 'home';
        if (pick.score[other] === null) pick.score[other] = 0;   // the first value starts the other side at 0
        pick.outcome = outcomeOf(pick.score.home, pick.score.away);   // a full score decides the result
        changed(i);
      }

      $$('.scorepad', card).forEach(function (pad) {
        var side = pad.dataset.side;
        var wheel = $('.drum', pad);
        var reel = $('.drum__reel', pad);

        $$('.scorepad__step', pad).forEach(function (b) {
          b.addEventListener('click', function () { setIndex(side, index(pick.score[side]) + Number(b.dataset.step)); });
        });

        // drag the wheel like the one on a phone; it settles on a cell
        var y0 = 0, from = 0, dragging = false, moved = false;
        wheel.addEventListener('pointerdown', function (e) {
          dragging = true;
          moved = false;
          y0 = e.clientY;
          from = index(pick.score[side]);
          reel.style.transition = 'none';
          try { wheel.setPointerCapture(e.pointerId); } catch (_) {}
        });
        wheel.addEventListener('pointermove', function (e) {
          if (!dragging) return;
          var cell = reel.firstElementChild.offsetHeight || 48;
          var d = e.clientY - y0;
          if (Math.abs(d) > 3) moved = true;
          var off = from * cell - d, limit = (MAX_GOALS + 1) * cell;
          // rubber-band past the ends so the wheel feels physical
          if (off < 0) off /= 3;
          if (off > limit) off = limit + (off - limit) / 3;
          reel.style.transform = 'translateY(' + (-off) + 'px)';
        });
        function settle(e) {
          if (!dragging) return;
          dragging = false;
          if (!moved || e.type === 'pointercancel') { paintDrum(pad, pick, true); return; }
          var cell = reel.firstElementChild.offsetHeight || 48;
          setIndex(side, from - Math.round((e.clientY - y0) / cell));
        }
        wheel.addEventListener('pointerup', settle);
        wheel.addEventListener('pointercancel', settle);
        wheel.addEventListener('keydown', function (e) {
          var s = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : 0);
          if (!s) return;
          e.preventDefault();
          setIndex(side, index(pick.score[side]) + s);
        });
      });

      render(i, false);
    });

    /* ---- wiring: the bar ---- */

    cta.addEventListener('click', function () {
      var k = Math.min(current(), N - 1);
      if (cta.getAttribute('aria-disabled') === 'true') {
        // nothing to confirm here: point at the card that needs a pick
        var need = complete(picks[k]) ? nextOpen(k) : k;
        if (need < 0) { finish(); return; }          // everything is in — back to the summary
        if (need !== k) {
          slideTo(need);
          setTimeout(function () { shake(need); }, reduce ? 0 : 420);
        } else {
          shake(k);
        }
        return;
      }
      banked[k] = true;                // this is the confirmation the meter counts
      var open = nextOpen(k);
      refresh();
      if (open !== -1) slideTo(open);
      else finish();                   // that was the last one
    });

    closeBtn.addEventListener('click', function () {
      dismissed = true;
      updateBar();
    });

    $('[data-done-edit]', doneCard).addEventListener('click', function () {
      finished = false;
      doneCard.hidden = true;
      refresh();
      slideTo(0);
    });

    // On phones the bar is a sheet fixed to the window. It lives on <body>
    // there, so no transformed ancestor (a lifting card) can capture it.
    function place() {
      if (wide.matches) { if (bar.parentNode !== slot) slot.appendChild(bar); }
      else if (bar.parentNode !== document.body) document.body.appendChild(bar);
      updateBar();
    }
    if (wide.addEventListener) wide.addEventListener('change', place); else wide.addListener(place);
    place();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        updateBar();
      }, { threshold: .25 }).observe(stage);
    }

    /* ---- wiring: moving along the rail ---- */

    prevBtn.addEventListener('click', function () { slideTo(current() - 1); });
    nextBtn.addEventListener('click', function () { slideTo(current() + 1); });

    rail.addEventListener('keydown', function (e) {
      if (e.target !== rail) return;              // the wheels keep their own keys
      if (e.key === 'ArrowRight') { e.preventDefault(); slideTo(current() + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); slideTo(current() - 1); }
    });

    var queued = false, lastSlide = 0;
    rail.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      soon(function () {
        queued = false;
        var k = current();
        if (k !== lastSlide) { lastSlide = k; updateCta(); }
        updateArrows();
      });
    }, { passive: true });

    /* Touch and trackpads scroll the rail natively; a mouse drags it. Snapping
       pauses while the pointer leads and resumes once the slide has landed. */
    var drag = null, swallow = false;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('.drum')) return;
      drag = { x: e.clientX, left: rail.scrollLeft, id: e.pointerId, k: current(), dx: 0, moved: false };
    });
    rail.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(drag.dx) < 6) return;
        drag.moved = true;
        rail.classList.add('is-dragging', 'is-free');
        try { rail.setPointerCapture(e.pointerId); } catch (_) {}
      }
      rail.scrollLeft = drag.left - drag.dx;
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      rail.classList.remove('is-dragging');
      // the click that ends a drag is not a tap on whatever lies under it
      swallow = true;
      setTimeout(function () { swallow = false; }, 0);
      var to = d.dx < -50 ? d.k + 1 : (d.dx > 50 ? d.k - 1 : current());
      slideTo(to);
      var landed = function () {
        rail.classList.remove('is-free');
        rail.removeEventListener('scrollend', landed);
      };
      rail.addEventListener('scrollend', landed);
      setTimeout(landed, 650);
    }
    rail.addEventListener('pointerup', endDrag);
    rail.addEventListener('pointercancel', endDrag);
    rail.addEventListener('click', function (e) {
      if (swallow) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // a narrower card re-tunes the wheels; keep the current slide in place
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var k = current();
        cards.forEach(function (c, i) { render(i, false); });
        slideTo(k, true);
        updateArrows();
      }, 150);
    });

    /* ---- the deadline: midnight, local time, as in the app ---- */

    function two(n) { return (n < 10 ? '0' : '') + n; }
    function tickDeadline() {
      var now = new Date();
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      var s = Math.max(0, Math.floor((end - now) / 1000));
      deadline.textContent = s
        ? t('dc.closes').replace('{t}', two(Math.floor(s / 3600)) + ':' + two(Math.floor(s / 60) % 60) + ':' + two(s % 60))
        : t('dc.closed');
    }
    tickDeadline();
    setInterval(tickDeadline, 1000);

    document.addEventListener('the90:lang', function () {
      tickDeadline();
      updateCta();
      labelSlides();
    });

    labelSlides();
    refresh();
  })();

  /* ---------------- stats ----------------
     Each locale formats its own figures: 128,000 / 128 000 / 128.000, and
     2.4M / 2,4 млн / 240万 / 24 लाख. */
  var statEls = $$('.stat b');

  function fmtStat(el, v) {
    try {
      return new Intl.NumberFormat(I.INTL[lang] || lang, el.hasAttribute('data-compact')
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { maximumFractionDigits: 0 }).format(v);
    } catch (e) {
      return String(Math.round(v));
    }
  }

  function renderStats() {
    statEls.forEach(function (el) {
      if (el.dataset.counting) return;
      el.textContent = fmtStat(el, el.dataset.pending ? 0 : Number(el.dataset.count));
    });
  }

  // count up from zero once the preloader is gone and the figures are in view
  (function counters() {
    if (reduce || !('IntersectionObserver' in window)) return;
    statEls.forEach(function (el) { el.dataset.pending = '1'; });

    function run(el) {
      var target = Number(el.dataset.count), t0 = performance.now(), dur = 1400;
      delete el.dataset.pending;
      el.dataset.counting = '1';
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur);
        el.textContent = fmtStat(el, target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
        else { delete el.dataset.counting; el.textContent = fmtStat(el, target); }
      })(t0);
    }

    ready(function () {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (x) {
          if (!x.isIntersecting) return;
          io.unobserve(x.target);
          run(x.target);
        });
      }, { threshold: .6 });
      statEls.forEach(function (el) { io.observe(el); });
    });
  })();

  /* ---------------- i18n ---------------- */
  function applyLang(next, remember) {
    lang = I.DICT[next] ? next : I.DEFAULT;
    var root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (window.THE90_FONT) window.THE90_FONT(lang);

    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.title = t('meta.title');
    var desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.desc'));
    renderStats();

    var meta = I.LOCALES.filter(function (l) { return l.code === lang; })[0];
    if (meta) $('[data-lang-current]').textContent = meta.short;
    $$('[data-lang-menu] .lang__item').forEach(function (it) {
      it.setAttribute('aria-selected', String(it.dataset.code === lang));
    });
    if (remember) { try { localStorage.setItem(STORE, lang); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('the90:lang'));
  }

  (function langSwitch() {
    var wrap = $('[data-lang]'), btn = $('[data-lang-toggle]'), menu = $('[data-lang-menu]');
    menu.innerHTML = I.LOCALES.map(function (l) {
      return '<li role="none"><button class="lang__item" type="button" role="option" data-code="' + l.code + '" lang="' + l.code + '">' +
        '<span class="lang__code">' + l.short + '</span><em>' + l.label + '</em><b aria-hidden="true">✓</b></button></li>';
    }).join('');

    function open(on) {
      menu.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
      wrap.classList.toggle('is-open', on);
      if (on) {
        var cur = $('.lang__item[aria-selected="true"]', menu);
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
      }
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(menu.hidden); });
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
      var it = e.target.closest('[data-code]');
      if (!it) return;
      applyLang(it.dataset.code, true);
      open(false);
      btn.focus();
    });
    document.addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { open(false); btn.focus(); }
    });
    window.addEventListener('resize', function () { if (!menu.hidden) open(false); });

    applyLang(lang, false);
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
    function show(e) {
      if (e.classList.contains('is-in')) return;
      e.classList.add('is-in');
      // the stagger is for the entrance only — a hover must not wait for it
      setTimeout(function () { e.style.transitionDelay = ''; }, 900);
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        // reveal when it scrolls in — and also when it is already above the
        // viewport, so anchor jumps and deep links never leave a section blank
        if (!x.isIntersecting && x.boundingClientRect.top > 0) return;
        show(x.target);
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
          show(e);
          io.unobserve(e);
        }
      });
      if (!left.length) window.removeEventListener('scroll', onScroll);
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      soon(function () { ticking = false; sweep(); });
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

  /* ---------------- artwork stays on the page ----------------
     No save-image menu, no dragging a picture out to the desktop, no
     long-press save on phones (that last part is CSS: -webkit-touch-callout). */
  (function protectImages() {
    var ART = 'img, svg, picture, video, canvas';
    $$('img').forEach(function (img) { img.draggable = false; });
    document.addEventListener('contextmenu', function (e) {
      if (e.target.closest && e.target.closest(ART)) e.preventDefault();
    });
    document.addEventListener('dragstart', function (e) {
      if (e.target.closest && e.target.closest(ART)) e.preventDefault();
    });
  })();

})();
