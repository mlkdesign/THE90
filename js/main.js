/* =========================================================
   THE90 — Main screen logic
   Picks, scoring, accept flow, calendar, live ticker
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var screen = $('[data-screen="main"]');
  if (!screen) return;

  var TOTAL_PICKS  = 10;
  var COLLAPSED_VISIBLE = 3;

  var BASE_BALANCE = 10000;

  var calendar   = T.buildCalendar();
  var today      = calendar.filter(function (d) { return d.isToday; })[0];
  var selectedDay = today;

  var matches    = today.matches;                    // the 10 daily picks
  var picks      = {};                               // matchId -> { outcome, score, btts }
  var accepted   = false;                            // the whole slip has been confirmed
  var editing    = {};                               // matchId -> true while being re-opened
  var expanded   = {};                               // matchId -> true when the row is open
  var showAll    = false;

  matches.forEach(function (m) {
    picks[m.id] = { outcome: null, score: { home: null, away: null }, btts: null };
  });


  /* =======================================================
     Helpers
     ======================================================= */

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function fmt(n) { return n.toLocaleString('en-US').replace(/,/g, ' '); }

  function hasPick(p) {
    return !!(p.outcome || p.btts);
  }

  function pickCount() {
    return matches.filter(function (m) { return hasPick(picks[m.id]); }).length;
  }

  function totalPoints() {
    return matches.reduce(function (sum, m) {
      var p = picks[m.id];
      return hasPick(p) ? sum + T.pickPoints(m, p).total : sum;
    }, 0);
  }

  function outcomeFromScore(h, a) {
    if (h === null || a === null) return null;
    return h > a ? 'home' : (h === a ? 'draw' : 'away');
  }

  function editCount() { return Object.keys(editing).length; }

  // a card is interactive before the slip is accepted, or while being edited
  function isEditable(m) { return !accepted || !!editing[m.id]; }


  /* =======================================================
     LIVE block
     ======================================================= */

  (function initLive() {
    var L = T.LIVE;
    $('[data-live-home-logo]').src  = T.logo(L.home);
    $('[data-live-away-logo]').src  = T.logo(L.away);
    $('[data-live-home-short]').textContent = T.club(L.home).short;
    $('[data-live-away-short]').textContent = T.club(L.away).short;
    $('[data-live-home-score]').textContent = L.scoreHome;
    $('[data-live-away-score]').textContent = L.scoreAway;

    var minute = L.minute;
    var minuteEl = $('[data-live-minute]');
    minuteEl.textContent = minute + '’';

    setInterval(function () {
      minute = minute >= 90 ? 46 : minute + 1;
      minuteEl.textContent = minute + '’';
    }, 10000);
  })();


  /* =======================================================
     Open (interactive) match card
     ======================================================= */

  function openCard(m) {
    var home = T.club(m.home), away = T.club(m.away);

    var card = el(
      '<article class="mcard" data-card="' + m.id + '">' +
        '<div class="mcard__head">' +
          '<img class="mcard__flag mcard__flag--l" src="' + T.bg(m.home) + '" alt="">' +
          '<img class="mcard__flag mcard__flag--r" src="' + T.bg(m.away) + '" alt="">' +
          '<div class="pitch">' +
            '<span class="pitch__box pitch__box--l"></span>' +
            '<span class="pitch__box pitch__box--r"></span>' +
            '<span class="pitch__mid"></span>' +
            '<span class="pitch__circle"></span>' +
          '</div>' +
          '<div class="mcard__meta">' +
            '<span class="chip">' + m.league + '</span>' +
            '<span class="mcard__time">' + (selectedDay.isToday ? 'Today' : selectedDay.weekday) + ', ' + m.kickoff + '</span>' +
          '</div>' +
          '<div class="mcard__teams">' +
            '<div class="mcard__team">' +
              '<img class="mcard__crest" src="' + T.logo(m.home) + '" alt="">' +
              '<span class="mcard__name">' + home.name + '</span>' +
            '</div>' +
            '<div class="mcard__team">' +
              '<img class="mcard__crest" src="' + T.logo(m.away) + '" alt="">' +
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

          '<div class="btts">' +
            '<span class="btts__label">Both to score?</span>' +
            '<div class="seg" data-btts>' +
              '<button class="seg__btn" type="button" data-val="yes"><span>Yes</span></button>' +
              '<button class="seg__btn" type="button" data-val="no"><span>No</span></button>' +
            '</div>' +
          '</div>' +

          '<div class="mcard__row" data-edit-row hidden>' +
            '<button class="editbtn" type="button" data-edit>Edit</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );

    wireCard(card, m);
    return card;
  }

  function wireCard(card, m) {
    var p = picks[m.id];

    // outcome
    $$('[data-outcome] .seg__btn', card).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!isEditable(m)) return;
        var v = btn.dataset.val;
        p.outcome = (p.outcome === v) ? null : v;

        // an outcome that contradicts the entered score clears the score
        var implied = outcomeFromScore(p.score.home, p.score.away);
        if (p.outcome && implied && implied !== p.outcome) {
          p.score = { home: null, away: null };
        }
        renderCard(card, m);
        renderPickBar();
      });
    });

    // both to score
    $$('[data-btts] .seg__btn', card).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!isEditable(m)) return;
        var v = btn.dataset.val;
        var was = p.btts;
        p.btts = (was === v) ? null : v;

        if (p.btts === 'no') {
          // "no goals from both" only has one scoreline that is also a draw
          p.score = { home: 0, away: 0 };
          p.outcome = 'draw';
        } else if (was === 'no' && p.btts === null) {
          // undoing "No" takes the auto-filled 0:0 with it
          if (p.score.home === 0 && p.score.away === 0) {
            p.score = { home: null, away: null };
            p.outcome = null;
          }
        } else if (p.btts === 'yes') {
          // "Yes" fills nothing; it only clears a score that contradicts it
          if (p.score.home !== null && p.score.away !== null &&
              !(p.score.home > 0 && p.score.away > 0)) {
            p.score = { home: null, away: null };
          }
        }
        renderCard(card, m);
        renderPickBar();
      });
    });

    // score steppers + keyboard
    $$('.stepper', card).forEach(function (st) {
      var side  = st.dataset.side;
      var field = $('.stepper__field', st);

      $$('.stepper__btn', st).forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!isEditable(m)) return;
          var cur = p.score[side];
          var next = (cur === null ? 0 : cur) + Number(btn.dataset.step);
          if (next < 0) next = 0;
          if (next > 20) next = 20;
          p.score[side] = next;
          syncScore(m, p);
          renderCard(card, m);
          renderPickBar();
        });
      });

      field.addEventListener('input', function () {
        if (!isEditable(m)) return;
        var raw = field.value.replace(/\D/g, '');
        p.score[side] = raw === '' ? null : Math.min(20, parseInt(raw, 10));
        syncScore(m, p);

        // keep the caret usable while typing: patch siblings, not this input
        renderCard(card, m, field);
        renderPickBar();
      });

      field.addEventListener('blur', function () { renderCard(card, m); });
    });
  }

  // a complete score decides the outcome (and both-to-score) for you
  function syncScore(m, p) {
    if (p.score.home === null || p.score.away === null) return;
    p.outcome = outcomeFromScore(p.score.home, p.score.away);
    p.btts    = (p.score.home > 0 && p.score.away > 0) ? 'yes' : 'no';
  }

  function renderCard(card, m, skipField) {
    var p = picks[m.id];
    var picked = hasPick(p);
    var locked = card.classList.contains('is-locked');

    card.classList.toggle('is-picked', picked);

    $$('[data-outcome] .seg__btn', card).forEach(function (b) {
      b.classList.toggle('is-on', p.outcome === b.dataset.val);
    });
    $$('[data-btts] .seg__btn', card).forEach(function (b) {
      b.classList.toggle('is-on', p.btts === b.dataset.val);
    });

    $$('.stepper', card).forEach(function (st) {
      var side = st.dataset.side, v = p.score[side];
      var field = $('.stepper__field', st);
      if (field !== skipField) field.value = v === null ? '' : v;
      field.classList.toggle('has-value', v !== null);
      var editable = isEditable(m);
      $('.stepper__btn[data-step="-1"]', st).disabled = !editable || v === null || v === 0;
      $('.stepper__btn[data-step="1"]',  st).disabled = !editable;
    });

    // a confirmed card only shows the markets that were actually played
    if (locked) {
      $('.scores', card).hidden = (p.score.home === null || p.score.away === null);
      $('.btts', card).hidden   = !p.btts;
    }
  }


  /* =======================================================
     Accepted card — collapsed row + read-only recap
     ======================================================= */

  function collapsedCard(m) {
    var row = el(
      '<button class="ccard" type="button" data-collapsed="' + m.id + '">' +
        '<img class="ccard__flag ccard__flag--l" src="' + T.bg(m.home) + '" alt="">' +
        '<img class="ccard__flag ccard__flag--r" src="' + T.bg(m.away) + '" alt="">' +
        '<span class="ccard__crests">' +
          '<img class="ccard__crest" src="' + T.logo(m.home) + '" alt="">' +
          '<img class="ccard__crest" src="' + T.logo(m.away) + '" alt="">' +
        '</span>' +
        '<span class="ccard__names">' +
          '<span>' + T.club(m.home).name + '</span><i>–</i><span>' + T.club(m.away).name + '</span>' +
        '</span>' +
        '<img class="ccard__mark" src="assets/icons/check.svg" alt="Pick accepted" width="16" height="16">' +
      '</button>'
    );

    row.addEventListener('click', function () {
      expanded[m.id] = !expanded[m.id];
      renderPicks();
    });
    return row;
  }

  // confirmed card: read-only recap with the crowd split, plus an Edit button
  function recapCard(m) {
    var card = openCard(m);
    var split = T.crowd(m);

    card.classList.add('is-locked');

    $$('[data-outcome] .seg__btn', card).forEach(function (b) {
      b.insertAdjacentHTML('beforeend',
        '<span class="seg__pct">' + split[b.dataset.val] + '%</span>');
    });

    $('[data-edit-row]', card).hidden = false;
    $('[data-edit]', card).addEventListener('click', function () {
      editing[m.id] = true;
      renderPicks();
      renderPickBar();
    });

    // collapse again on a click anywhere in the header
    $('.mcard__head', card).style.cursor = 'pointer';
    $('.mcard__head', card).addEventListener('click', function () {
      expanded[m.id] = false;
      renderPicks();
    });

    renderCard(card, m);
    return card;
  }

  // confirmed card re-opened for editing: no crowd split, fully interactive
  function editableCard(m) {
    var card = openCard(m);
    card.classList.add('is-editing');
    renderCard(card, m);
    return card;
  }


  /* =======================================================
     Picks list
     ======================================================= */

  var picksWrap  = $('[data-picks]');
  var watchAll   = $('[data-watch-all]');
  var watchLabel = $('[data-watch-all-label]');

  function renderPicks() {
    picksWrap.innerHTML = '';

    if (!accepted) {
      matches.forEach(function (m) {
        var card = openCard(m);
        picksWrap.appendChild(card);
        renderCard(card, m);
      });
      watchAll.hidden = true;
      $('[data-picks-dot]').classList.toggle('is-on', pickCount() > 0);
      return;
    }

    var visible = showAll ? matches : matches.slice(0, COLLAPSED_VISIBLE);
    visible.forEach(function (m) {
      if (!expanded[m.id])  { picksWrap.appendChild(collapsedCard(m)); return; }
      picksWrap.appendChild(editing[m.id] ? editableCard(m) : recapCard(m));
    });

    watchAll.hidden = false;
    watchAll.classList.toggle('is-open', showAll);
    watchLabel.textContent = showAll ? 'Hide picks' : 'Watch all picks';
    $('[data-picks-dot]').classList.add('is-on');
  }

  watchAll.addEventListener('click', function () {
    showAll = !showAll;
    renderPicks();
  });


  /* =======================================================
     Pick bar
     ======================================================= */

  var pickbar    = $('[data-pickbar]');
  var estEl      = $('[data-est]');
  var acceptBtn  = $('[data-accept]');
  var countEl    = $('[data-accept-count]');

  function renderPickBar() {
    var n = pickCount();
    var isEditPass = accepted && editCount() > 0;

    // hidden until the first pick, and again once the slip is confirmed —
    // it only comes back while a confirmed card is being edited
    if (accepted ? !isEditPass : n === 0) { hidePickBar(); return; }

    if (pickbar.hidden) {
      pickbar.hidden = false;
      pickbar.classList.remove('is-out');
    }

    // always the full slip, including the card currently being changed
    estEl.textContent = '+' + fmt(totalPoints());
    countEl.textContent = n + '/' + TOTAL_PICKS;

    var ready = n === TOTAL_PICKS;
    acceptBtn.classList.toggle('is-locked', !ready);
    acceptBtn.classList.toggle('is-ready', ready);
    acceptBtn.classList.toggle('is-editpass', isEditPass);   // hides the counter
  }

  function hidePickBar() {
    if (pickbar.hidden) return;
    pickbar.classList.add('is-out');
    setTimeout(function () {
      pickbar.hidden = true;
      pickbar.classList.remove('is-out');
    }, 220);
  }

  acceptBtn.addEventListener('click', function () {
    if (pickCount() < TOTAL_PICKS) return;

    var wasEditPass = accepted;
    var won = totalPoints();

    accepted = true;
    editing  = {};
    expanded = {};
    if (!wasEditPass) showAll = false;

    hidePickBar();
    renderPicks();

    var balEl = $('[data-balance]');
    balEl.textContent = fmt(BASE_BALANCE + won);
    balEl.classList.remove('is-bump');
    void balEl.offsetWidth;
    balEl.classList.add('is-bump');

    // the modal is the reward for completing the slip — not for re-editing it
    if (wasEditPass) return;

    $('[data-scroll]').scrollTo({ top: 0, behavior: 'smooth' });
    openModal(
      'Congratulations!',
      'All 10 picks completed successfully. If every one of them lands you take ' +
      '<b>+' + fmt(won) + '</b> rating points.',
      'Got It'
    );
  });


  /* =======================================================
     Calendar
     ======================================================= */

  var dateRow = $('[data-daterow]');
  var dayList = $('[data-daylist]');

  function renderCalendar() {
    dateRow.innerHTML = '';

    calendar.forEach(function (d) {
      var cell = el(
        '<button class="datecell" type="button">' +
          '<span class="datecell__m">' + d.month + '</span>' +
          '<span class="datecell__d">' + d.date + '</span>' +
          '<span class="datecell__w">' + d.weekday + '</span>' +
        '</button>'
      );
      cell.classList.toggle('is-active', d.key === selectedDay.key);
      cell.classList.toggle('is-today', d.isToday);
      cell.classList.toggle('is-past', d.isPast);
      cell.addEventListener('click', function () {
        selectedDay = d;
        renderCalendar();
      });
      dateRow.appendChild(cell);
    });

    // keep the selected day in view
    var active = $('.datecell.is-active', dateRow);
    if (active) {
      dateRow.scrollTo({
        left: active.offsetLeft - dateRow.clientWidth / 2 + active.offsetWidth / 2,
        behavior: 'smooth'
      });
    }

    dayList.innerHTML = '';
    selectedDay.matches.forEach(function (m) {
      dayList.appendChild(el(
        '<div class="ccard">' +
          '<img class="ccard__flag ccard__flag--l" src="' + T.bg(m.home) + '" alt="">' +
          '<img class="ccard__flag ccard__flag--r" src="' + T.bg(m.away) + '" alt="">' +
          '<span class="ccard__crests">' +
            '<img class="ccard__crest" src="' + T.logo(m.home) + '" alt="">' +
            '<img class="ccard__crest" src="' + T.logo(m.away) + '" alt="">' +
          '</span>' +
          '<span class="ccard__names">' +
            '<span>' + T.club(m.home).name + '</span><i>–</i><span>' + T.club(m.away).name + '</span>' +
          '</span>' +
          '<img class="ccard__chev" src="assets/icons/chevron-down.svg" alt="" width="20" height="20" ' +
               'style="transform:rotate(-90deg)">' +
        '</div>'
      ));
    });
  }


  /* =======================================================
     Modal
     ======================================================= */

  var modal = $('[data-modal]');

  function openModal(title, html, cta) {
    $('[data-modal-title]').textContent = title;
    $('[data-modal-text]').innerHTML = html;
    $('[data-modal-cta]').textContent = cta || 'Got It';
    modal.hidden = false;
    modal.classList.remove('is-out');
  }

  function closeModal() {
    modal.classList.add('is-out');
    setTimeout(function () {
      modal.hidden = true;
      modal.classList.remove('is-out');
    }, 220);
  }

  $('[data-modal-close]').addEventListener('click', closeModal);
  $('[data-modal-cta]').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });


  /* =======================================================
     Boot
     ======================================================= */

  renderPicks();
  renderCalendar();

  // welcome reward — fires as soon as the main screen is first shown
  var greeted = false;
  window.addEventListener('the90:screen', function (e) {
    if (e.detail !== 'main' || greeted) return;
    greeted = true;
    setTimeout(function () {
      openModal('Congratulations!', 'You received a Welcome reward for registering in our app', 'Got It');
    }, 450);
  });

})();
