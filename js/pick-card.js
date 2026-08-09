/* =========================================================
   THE90 — the pick card

   One card, two homes: the daily slip on Main and the round
   inside a league. Both need identical behaviour — the stepper
   that counts from zero, the outcome that follows a complete
   score — so the markup and the wiring live here rather than
   being written twice and drifting apart.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

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

  // the first value on one side starts the other at 0 — that is what makes
  // 2–0 three taps instead of four
  function seedOtherSide(p, side) {
    var other = side === 'home' ? 'away' : 'home';
    if (p.score[other] === null) p.score[other] = 0;
  }

  // emptying a side takes back the outcome the complete score had filled in
  function clearScore(p, side) {
    p.score[side] = null;
    if (!p.derived) return;
    p.outcome = null;
    p.derived = false;
  }

  function blank() {
    return { outcome: null, score: { home: null, away: null }, derived: false };
  }

  function hasPick(p) { return !!p.outcome; }


  /* =======================================================
     Build

       match    fixture from THE90.buildCalendar()
       pick     the mutable pick object for that fixture
       options  { when, editable(), onChange() }

     Returns the element with a render() hung off it, so callers
     can repaint after changing the pick from the outside.
     ======================================================= */

  function create(match, pick, options) {
    var opts = options || {};
    var editable = opts.editable || function () { return true; };
    var onChange = opts.onChange || function () {};
    var home = T.club(match.home), away = T.club(match.away);

    var card = el(
      '<article class="mcard" data-card="' + match.id + '">' +
        '<div class="mcard__head">' +
          '<img class="mcard__flag mcard__flag--l" src="' + T.bg(match.home) + '" alt="">' +
          '<img class="mcard__flag mcard__flag--r" src="' + T.bg(match.away) + '" alt="">' +
          '<div class="pitch">' +
            '<span class="pitch__box pitch__box--l"></span>' +
            '<span class="pitch__box pitch__box--r"></span>' +
            '<span class="pitch__mid"></span>' +
            '<span class="pitch__circle"></span>' +
          '</div>' +
          '<div class="mcard__meta">' +
            '<span class="chip">' + match.league + '</span>' +
            '<span class="mcard__time">' + (opts.when || 'Today') + ', ' + match.kickoff + '</span>' +
          '</div>' +
          '<div class="mcard__teams">' +
            '<div class="mcard__team">' +
              '<img class="mcard__crest" src="' + T.logo(match.home) + '" alt="">' +
              '<span class="mcard__name">' + home.name + '</span>' +
            '</div>' +
            '<div class="mcard__team">' +
              '<img class="mcard__crest" src="' + T.logo(match.away) + '" alt="">' +
              '<span class="mcard__name">' + away.name + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="mcard__body">' +
          '<div class="mcard__row">' +
            '<div class="seg" data-outcome>' +
              '<button class="seg__btn" type="button" data-val="home"><span>Win 1</span></button>' +
              '<button class="seg__btn" type="button" data-val="draw"><span>Draw</span></button>' +
              '<button class="seg__btn" type="button" data-val="away"><span>Win 2</span></button>' +
            '</div>' +
          '</div>' +

          '<div class="scores">' +
            '<div class="stepper" data-side="home">' +
              '<button class="stepper__btn" type="button" data-step="-1">-</button>' +
              '<input class="stepper__field" inputmode="numeric" maxlength="2" placeholder="-" aria-label="' + home.name + ' score">' +
              '<button class="stepper__btn" type="button" data-step="1">+</button>' +
            '</div>' +
            '<div class="stepper" data-side="away">' +
              '<button class="stepper__btn" type="button" data-step="-1">-</button>' +
              '<input class="stepper__field" inputmode="numeric" maxlength="2" placeholder="-" aria-label="' + away.name + ' score">' +
              '<button class="stepper__btn" type="button" data-step="1">+</button>' +
            '</div>' +
          '</div>' +

          '<div class="mcard__row" data-edit-row hidden>' +
            '<button class="editbtn" type="button" data-edit>Edit</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );

    function render(skipField) {
      var locked = card.classList.contains('is-locked');
      card.classList.toggle('is-picked', hasPick(pick));

      $$('[data-outcome] .seg__btn', card).forEach(function (b) {
        b.classList.toggle('is-on', pick.outcome === b.dataset.val);
      });

      $$('.stepper', card).forEach(function (st) {
        var side = st.dataset.side, v = pick.score[side];
        var field = $('.stepper__field', st);
        if (field !== skipField) field.value = v === null ? '' : v;
        field.classList.toggle('has-value', v !== null);
        var live = editable();
        $('.stepper__btn[data-step="-1"]', st).disabled = !live;
        $('.stepper__btn[data-step="1"]',  st).disabled = !live;
      });

      // a confirmed card only shows the markets that were actually played
      if (locked) {
        $('.scores', card).hidden = (pick.score.home === null || pick.score.away === null);
      }
    }

    function changed(skipField) {
      render(skipField);
      onChange();
    }

    // ---- outcome ----
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

    // ---- score steppers + keyboard ----
    $$('.stepper', card).forEach(function (st) {
      var side  = st.dataset.side;
      var field = $('.stepper__field', st);

      $$('.stepper__btn', st).forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!editable()) return;
          var cur  = pick.score[side];
          var step = Number(btn.dataset.step);

          if (cur === null) {
            // counting starts at 0, and either button reaches it in one tap
            pick.score[side] = 0;
            seedOtherSide(pick, side);
            syncScore(pick);
          } else if (cur === 0 && step < 0) {
            clearScore(pick, side);
          } else {
            pick.score[side] = Math.max(0, Math.min(20, cur + step));
            syncScore(pick);
          }
          changed();
        });
      });

      field.addEventListener('input', function () {
        if (!editable()) return;
        var raw = field.value.replace(/\D/g, '');
        if (raw === '') {
          clearScore(pick, side);
        } else {
          pick.score[side] = Math.min(20, parseInt(raw, 10));
          seedOtherSide(pick, side);
          syncScore(pick);
        }
        // keep the caret usable while typing: patch siblings, not this input
        changed(field);
      });

      field.addEventListener('blur', function () { render(); });
    });

    card.render = render;
    render();
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
