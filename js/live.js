/* =========================================================
   THE90 — live matches

   The carousel on the main screen and the match screen behind
   it. Everything reads from THE90.LIVE_MATCHES, so a fourth
   fixture only needs a fourth entry there.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var MATCHES = (T && T.LIVE_MATCHES) || [];
  if (!MATCHES.length) return;

  var WINDOW_SECONDS = 15;
  var WINDOW_OPENS_AFTER = 5000;   // in the prototype the window opens on its own

  // Minutes tick per fixture, never off one shared clock.
  var minutes = {};
  MATCHES.forEach(function (m) { minutes[m.id] = m.minute; });

  var picked = {};    // matchId -> option id, one answer per window


  /* =======================================================
     Carousel on the main screen
     ======================================================= */

  // Swipe is the only way through the carousel — no dots to tap. There is one
  // on Main and one in My Zone's pick history, and they behave identically.
  var tracks = $$('[data-live-track]');

  function buildSlides(track) {
    MATCHES.forEach(function (m) {
      var slide = document.createElement('button');
      slide.className = 'live';
      slide.type = 'button';
      slide.dataset.go = 'live-match';
      slide.dataset.liveId = m.id;
      slide.setAttribute('aria-label',
        T.club(m.home).name + ' versus ' + T.club(m.away).name + ', live. Open the match');

      slide.innerHTML =
        '<span class="badge">' +
          '<span class="badge__dot"></span>' +
          '<span class="badge__label">LIVE</span>' +
          '<span class="badge__minute" data-slide-minute="' + m.id + '">' + m.minute + '’</span>' +
        '</span>' +
        '<span class="live__row">' +
          '<span class="live__team">' +
            '<img class="live__logo" src="' + T.logo(m.home) + '" alt="">' +
            '<span class="live__short">' + T.club(m.home).short + '</span>' +
          '</span>' +
          '<span class="live__score">' +
            '<span>' + m.scoreHome + '</span><i>–</i><span>' + m.scoreAway + '</span>' +
          '</span>' +
          '<span class="live__team">' +
            '<img class="live__logo" src="' + T.logo(m.away) + '" alt="">' +
            '<span class="live__short">' + T.club(m.away).short + '</span>' +
          '</span>' +
        '</span>';

      track.appendChild(slide);
    });
  }

  // The slides no longer fill the track, so the scroll step has to be measured
  // rather than assumed to be the container width.
  function slideStep(track) {
    var first = track && track.firstElementChild;
    if (!first) return 1;
    var second = first.nextElementSibling;
    return Math.max(1, second ? second.offsetLeft - first.offsetLeft : first.offsetWidth);
  }

  tracks.forEach(function (track) {
    buildSlides(track);
    // Mouse drag, for the desktop mockup — touch already scrolls natively.
    var dragX = 0, dragFrom = 0, dragging = false, moved = false;
    track.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      dragging = true;
      moved = false;
      dragX = event.clientX;
      dragFrom = track.scrollLeft;
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var delta = event.clientX - dragX;
      if (Math.abs(delta) > 4) moved = true;
      track.scrollLeft = dragFrom - delta;
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      var step = slideStep(track);
      track.scrollTo({ left: Math.round(track.scrollLeft / step) * step, behavior: 'smooth' });
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    // a drag that ended on a slide must not also count as opening it
    track.addEventListener('click', function (event) {
      if (!moved) return;
      moved = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  });

  window.setInterval(function () {
    MATCHES.forEach(function (m) {
      minutes[m.id] = minutes[m.id] >= 90 ? 46 : minutes[m.id] + 1;
      $$('[data-slide-minute="' + m.id + '"]').forEach(function (cell) {
        cell.textContent = minutes[m.id] + '’';
      });
      if (current && current.id === m.id && screenMinute) {
        screenMinute.textContent = minutes[m.id] + '’';
      }
    });
  }, 10000);


  /* =======================================================
     Match screen
     ======================================================= */

  var screenEl = $('[data-screen="live-match"]');
  if (!screenEl) return;

  var screenMinute = $('[data-live-minute]', screenEl);
  var optionsHost = $('[data-window-options]', screenEl);
  var lockedNote = $('[data-window-locked]', screenEl);
  var secondsEl = $('[data-window-seconds]', screenEl);
  var ring = $('[data-window-ring]', screenEl);
  var eventsHost = $('[data-events-list]', screenEl);
  var orderButton = $('[data-events-order]', screenEl);

  var RING_LENGTH = 2 * Math.PI * 24;
  var current = null;
  var newestFirst = true;
  var countdown = null;
  var opening = null;

  var EVENT_ICONS = {
    goal: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2.2l3.1 2.2-1.2 3.6h-3.8L8.9 6.4zM5.4 9.3l1.2 3.7-3 .3A8 8 0 015.4 9.3zm13.2 0a8 8 0 011.8 4l-3-.3 1.2-3.7zM9 19.2a8 8 0 01-3.2-3.4l2.6-1.5 2.7 2zm6 0l-2.1-2.9 2.7-2 2.6 1.5A8 8 0 0115 19.2z',
    card: 'M8 2h6a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2z',
    whistle: 'M15 6a7 7 0 100 14 7 7 0 000-14zm0 4.6a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8zM2 9h7v4H2a1 1 0 01-1-1v-2a1 1 0 011-1zm3-5h5v3H5z',
    sub: 'M7 4l4 4H8v6H6V8H3zm10 16l-4-4h3v-6h2v6h3z'
  };

  function matchById(id) {
    for (var i = 0; i < MATCHES.length; i += 1) {
      if (MATCHES[i].id === id) return MATCHES[i];
    }
    return MATCHES[0];
  }

  function renderBoard(m) {
    $('[data-live-title]', screenEl).textContent = m.title;
    $('[data-live-where]', screenEl).textContent = m.league + ' · ' + m.venue;
    $('[data-live-home-logo]', screenEl).src = T.logo(m.home);
    $('[data-live-away-logo]', screenEl).src = T.logo(m.away);
    $('[data-live-home-name]', screenEl).textContent = T.club(m.home).name;
    $('[data-live-away-name]', screenEl).textContent = T.club(m.away).name;
    $('[data-live-home-score]', screenEl).textContent = m.scoreHome;
    $('[data-live-away-score]', screenEl).textContent = m.scoreAway;
    if (screenMinute) screenMinute.textContent = minutes[m.id] + '’';
  }


  /* ---------- the live window ---------- */

  function setRing(fraction) {
    if (!ring) return;
    ring.style.strokeDasharray = RING_LENGTH;
    ring.style.strokeDashoffset = RING_LENGTH * (1 - fraction);
  }

  function stopWindow() {
    window.clearInterval(countdown);
    window.clearTimeout(opening);
    countdown = null;
    opening = null;
  }

  function lockPick(m, option) {
    picked[m.id] = option.id;
    stopWindow();
    renderWindow(m);
  }

  function renderWindow(m) {
    var question = $('[data-window-question]', screenEl);
    if (question) question.textContent = m.window.question;

    var chosen = picked[m.id];
    optionsHost.replaceChildren();

    m.window.options.forEach(function (option) {
      var button = document.createElement('button');
      button.className = 'live-option' + (chosen === option.id ? ' is-on' : '');
      button.type = 'button';
      button.disabled = Boolean(chosen) || !countdown;
      button.innerHTML = '<span>' + option.label + '</span><b>' + option.share + '%</b>';
      button.addEventListener('click', function () { lockPick(m, option); });
      optionsHost.appendChild(button);
    });

    if (!lockedNote) return;
    if (chosen) {
      var label = m.window.options.filter(function (o) { return o.id === chosen; })[0].label;
      lockedNote.textContent = 'Pick locked — ' + label + ' · +' + T.POINTS.liveWindow + ' points';
      lockedNote.hidden = false;
    } else {
      lockedNote.hidden = true;
    }
  }

  function openWindow(m) {
    var left = WINDOW_SECONDS;
    if (secondsEl) secondsEl.textContent = left;
    setRing(1);
    screenEl.classList.add('is-window-open');

    countdown = window.setInterval(function () {
      left -= 1;
      if (secondsEl) secondsEl.textContent = Math.max(0, left);
      setRing(Math.max(0, left) / WINDOW_SECONDS);
      if (left > 0) return;
      stopWindow();
      screenEl.classList.remove('is-window-open');
      renderWindow(m);       // repaints the options as locked out
    }, 1000);

    renderWindow(m);
  }

  function startWindow(m) {
    stopWindow();
    screenEl.classList.remove('is-window-open');
    if (secondsEl) secondsEl.textContent = '–';
    setRing(0);
    renderWindow(m);

    if (picked[m.id]) return;   // one answer per window, and it is already in
    opening = window.setTimeout(function () { openWindow(m); }, WINDOW_OPENS_AFTER);
  }


  /* ---------- events ---------- */

  function renderEvents(m) {
    var rows = m.events.slice();
    if (!newestFirst) rows.reverse();

    var fragment = document.createDocumentFragment();
    rows.forEach(function (item) {
      var row = document.createElement('article');
      row.className = 'live-event live-event--' + item.type;

      var minute = document.createElement('span');
      minute.className = 'live-event__minute';
      minute.textContent = item.minute;

      var icon = document.createElement('span');
      icon.className = 'live-event__icon';
      icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
        (EVENT_ICONS[item.type] || EVENT_ICONS.whistle) + '" fill="currentColor"/></svg>';

      var copy = document.createElement('span');
      copy.className = 'live-event__copy';
      var title = document.createElement('strong');
      title.textContent = item.title;
      var detail = document.createElement('small');
      detail.textContent = item.detail;
      copy.appendChild(title);
      copy.appendChild(detail);

      var score = document.createElement('span');
      score.className = 'live-event__score';
      score.textContent = item.score || '';

      row.appendChild(minute);
      row.appendChild(icon);
      row.appendChild(copy);
      row.appendChild(score);
      fragment.appendChild(row);
    });
    eventsHost.replaceChildren(fragment);
  }

  if (orderButton) {
    orderButton.addEventListener('click', function () {
      newestFirst = !newestFirst;
      orderButton.textContent = newestFirst ? 'Newest first' : 'Oldest first';
      orderButton.setAttribute('aria-pressed', String(newestFirst));
      if (current) renderEvents(current);
    });
  }


  /* ---------- entry / exit ---------- */

  // Remember which slide was tapped before the router swaps screens.
  document.addEventListener('click', function (event) {
    var slide = event.target.closest('[data-live-id]');
    if (slide) current = matchById(slide.dataset.liveId);
  }, true);

  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'live-match') {
      stopWindow();
      return;
    }
    if (!current) current = MATCHES[0];
    renderBoard(current);
    renderEvents(current);
    startWindow(current);
    var scroll = $('[data-live-scroll]', screenEl);
    if (scroll) scroll.scrollTop = 0;
  });
})();
