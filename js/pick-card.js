/* =========================================================
   THE90 — the pick card

   One card, two homes: the daily slip on Main and the round
   inside a league. Both need identical behaviour, so the markup
   and the wiring live here rather than being written twice.

   The score is a drum: drag it like the wheel on a phone, or
   step it with the buttons — the page's own scroll never moves
   it. It starts with a dash on both sides; once a score is chosen, zero is
   the minimum and the dash cannot be restored from the score controls.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var MAX_GOALS = 20;
  var CELL = 48;            // one drum position, in px

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function outcomeFromScore(h, a) {
    if (h === null || a === null) return null;
    return h > a ? 'home' : (h === a ? 'draw' : 'away');
  }

  // a complete score decides the outcome for you
  function syncScore(p) {
    if (p.score.home === null || p.score.away === null) return;
    p.outcome = outcomeFromScore(p.score.home, p.score.away);
    p.derived = true;
  }

  // the first value on one side starts the other at 0
  function seedOtherSide(p, side) {
    var other = side === 'home' ? 'away' : 'home';
    if (p.score[other] === null) p.score[other] = 0;
  }

  function blank() {
    return { outcome: null, score: { home: null, away: null }, derived: false };
  }

  function hasPick(p) { return !!p.outcome; }

  // Drum index 0 is the unselected dash. Values 0…20 live at indices 1…21.
  function toIndex(value) { return value === null ? 0 : value + 1; }
  function fromIndex(i) { return i <= 0 ? null : Math.min(MAX_GOALS, i - 1); }

  function drumMarkup(side, label) {
    var cells = '<span class="drum__cell drum__cell--none">–</span>';
    for (var g = 0; g <= MAX_GOALS; g += 1) cells += '<span class="drum__cell">' + g + '</span>';
    return '<div class="scorepad" data-side="' + side + '">' +
      '<button class="scorepad__step" type="button" data-step="-1" aria-label="Fewer goals for ' + label + '">-</button>' +
      '<div class="drum" tabindex="0" role="spinbutton" aria-label="' + label + ' score">' +
        '<div class="drum__reel" data-reel>' + cells + '</div>' +
      '</div>' +
      '<button class="scorepad__step" type="button" data-step="1" aria-label="More goals for ' + label + '">+</button>' +
    '</div>';
  }


  /* =======================================================
     Build

       match    fixture from THE90.buildCalendar()
       pick     the mutable pick object for that fixture
       options  { when, editable(), onChange() }
     ======================================================= */

  function create(match, pick, options) {
    var opts = options || {};
    var editable = opts.editable || function () { return true; };
    var onChange = opts.onChange || function () {};
    var isComplete = opts.isComplete || hasPick;
    var home = T.club(match.home), away = T.club(match.away);

    var card = el(
      '<article class="mcard" data-card="' + match.id + '">' +
        '<img class="mcard__pitch" src="assets/img/match-card-background.png" alt="">' +
        '<div class="mcard__head">' +
          '<div class="pitch">' +
            '<span class="pitch__box pitch__box--l"></span>' +
            '<span class="pitch__box pitch__box--r"></span>' +
            '<span class="pitch__mid"></span>' +
            '<span class="pitch__circle"></span>' +
          '</div>' +
          '<span class="mcard__when">' + (opts.when || 'Today') + ' · ' + match.kickoff + '</span>' +
          '<div class="mcard__teams">' +
            '<div class="mcard__team">' +
              '<img class="mcard__crest" src="' + T.logo(match.home) + '" alt="">' +
              '<span class="mcard__name">' + home.name + '</span>' +
            '</div>' +
            '<span class="mcard__vs">VS</span>' +
            '<div class="mcard__team">' +
              '<img class="mcard__crest" src="' + T.logo(match.away) + '" alt="">' +
              '<span class="mcard__name">' + away.name + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="mcard__bodywrap">' +
          '<div class="mcard__body">' +
            '<div class="mcard__block">' +
              '<div class="mcard__labelrow">' +
                '<p class="mcard__label">Choose the winner or draw:</p>' +
                '<span class="mcard__points"><b>+ 10</b><img src="assets/icons/soccer-ball.svg" alt="" width="16" height="16"></span>' +
              '</div>' +
              '<div class="seg" data-outcome>' +
                '<button class="seg__btn" type="button" data-val="home"><span>' + home.name + '</span></button>' +
                '<button class="seg__btn" type="button" data-val="draw"><span>Draw</span></button>' +
                '<button class="seg__btn" type="button" data-val="away"><span>' + away.name + '</span></button>' +
              '</div>' +
            '</div>' +

            '<div class="mcard__block">' +
              '<div class="exact__head">' +
                '<span class="exact__title">Add exact score</span>' +
                '<span class="mcard__points"><b>+ 40</b><img src="assets/icons/soccer-ball.svg" alt="" width="16" height="16"></span>' +
              '</div>' +
              '<div class="exact__body">' +
                '<div class="scores">' +
                  drumMarkup('home', home.name) +
                  drumMarkup('away', away.name) +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>'
    );


    /* ---- rendering ---- */

    function paintDrum(pad, animate) {
      var side = pad.dataset.side;
      var reel = $('[data-reel]', pad);
      var index = toIndex(pick.score[side]);
      reel.style.transition = animate ? 'transform .28s cubic-bezier(.2,.8,.3,1)' : 'none';
      reel.style.transform = 'translateY(' + (-index * CELL) + 'px)';
      $$('.drum__cell', reel).forEach(function (cell, i) {
        cell.classList.toggle('is-current', i === index);
      });
      pad.classList.toggle('is-set', pick.score[side] !== null);
      // The dash is only an initial state. Once a value exists, 0 is the
      // floor and the minus button cannot restore the dash.
      $$('.scorepad__step', pad).forEach(function (b) {
        var atEnd = Number(b.dataset.step) < 0 ? index <= 1 : index === MAX_GOALS + 1;
        b.disabled = !editable() || atEnd;
      });
    }

    function render(animate) {
      card.classList.toggle('is-picked', isComplete(pick));
      $$('[data-outcome] .seg__btn', card).forEach(function (b) {
        b.classList.toggle('is-on', pick.outcome === b.dataset.val);
      });
      $$('.scorepad', card).forEach(function (pad) { paintDrum(pad, animate !== false); });
    }

    var answered = isComplete(pick);

    function changed() {
      var firstAnswer = !answered && isComplete(pick);
      answered = answered || isComplete(pick);
      render();
      onChange(firstAnswer);
    }


    /* ---- outcome ---- */

    $$('[data-outcome] .seg__btn', card).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!editable()) return;
        var v = btn.dataset.val;
        pick.outcome = (pick.outcome === v) ? null : v;

        // an outcome that contradicts the entered score clears the score
        var implied = outcomeFromScore(pick.score.home, pick.score.away);
        if (pick.outcome && implied && implied !== pick.outcome) {
          pick.score = { home: null, away: null };
          pick.derived = false;
        }

        changed();
      });
    });


    /* ---- the score drum ---- */

    function setIndex(side, index) {
      if (pick.score[side] === null && index <= 0) return;
      var next = Math.max(1, Math.min(MAX_GOALS + 1, index));
      pick.score[side] = fromIndex(next);
      seedOtherSide(pick, side);
      syncScore(pick);
    }

    $$('.scorepad', card).forEach(function (pad) {
      var side = pad.dataset.side;
      var drum = $('.drum', pad);
      var reel = $('[data-reel]', pad);

      $$('.scorepad__step', pad).forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!editable()) return;
          setIndex(side, toIndex(pick.score[side]) + Number(btn.dataset.step));
          changed();
        });
      });

      // drag the wheel — the reel follows the finger, then settles on a cell
      var startY = 0, startIndex = 0, dragging = false, moved = false;

      drum.addEventListener('pointerdown', function (event) {
        if (!editable()) return;
        dragging = true;
        moved = false;
        startY = event.clientY;
        startIndex = toIndex(pick.score[side]);
        reel.style.transition = 'none';
        drum.setPointerCapture(event.pointerId);
      });

      drum.addEventListener('pointermove', function (event) {
        if (!dragging) return;
        var delta = event.clientY - startY;
        if (Math.abs(delta) > 3) moved = true;
        var offset = startIndex * CELL - delta;
        // rubber-band past the ends so the wheel feels physical
        var limit = (MAX_GOALS + 1) * CELL;
        if (offset < 0) offset /= 3;
        if (offset > limit) offset = limit + (offset - limit) / 3;
        reel.style.transform = 'translateY(' + (-offset) + 'px)';
      });

      function settle(event) {
        if (!dragging) return;
        dragging = false;
        if (drum.hasPointerCapture && event && drum.hasPointerCapture(event.pointerId)) {
          drum.releasePointerCapture(event.pointerId);
        }
        if (!moved) {
          paintDrum(pad, true);
          return;
        }
        var shift = Math.round((event.clientY - startY) / CELL);
        setIndex(side, startIndex - shift);
        changed();
      }
      drum.addEventListener('pointerup', settle);
      drum.addEventListener('pointercancel', settle);

      /* No wheel handler on purpose: scrolling the page over a drum used to
         change the score by accident. The value moves only when you drag it
         or press the buttons. */

      drum.addEventListener('keydown', function (event) {
        if (!editable()) return;
        var step = event.key === 'ArrowUp' ? -1 : (event.key === 'ArrowDown' ? 1 : 0);
        if (!step) return;
        event.preventDefault();
        setIndex(side, toIndex(pick.score[side]) + step);
        changed();
      });
    });

    card.render = render;
    render(false);
    return card;
  }


  /* =======================================================
     Deadline label, shared by every "Daily picks" header
     ======================================================= */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function countdown(cell) {
    if (!cell) return;
    function tick() {
      var now = new Date();
      var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      var left = Math.max(0, Math.floor((midnight - now) / 1000));
      cell.textContent = left === 0
        ? 'Picks are closed'
        : 'Closes in ' + pad(Math.floor(left / 3600)) + ':' +
          pad(Math.floor(left / 60) % 60) + ':' + pad(left % 60);
    }
    tick();
    setInterval(tick, 1000);
  }

  T.pickCard = {
    create: create,
    blank: blank,
    hasPick: hasPick,
    countdown: countdown
  };
})();
