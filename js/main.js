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
  var picks      = {};                               // matchId -> { outcome, score, derived }
  var accepted   = false;                            // the whole slip has been confirmed
  var editing    = {};                               // matchId -> true while being re-opened
  var expanded   = {};                               // matchId -> true when the row is open
  var showAll    = false;

  matches.forEach(function (m) { picks[m.id] = T.pickCard.blank(); });


  /* =======================================================
     Helpers
     ======================================================= */

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function fmt(n) { return n.toLocaleString('en-US').replace(/,/g, ' '); }

  function hasPick(p) { return T.pickCard.hasPick(p); }

  function pickCount() {
    return matches.filter(function (m) { return hasPick(picks[m.id]); }).length;
  }

  function totalPoints() {
    return matches.reduce(function (sum, m) {
      var p = picks[m.id];
      return hasPick(p) ? sum + T.pickPoints(m, p).total : sum;
    }, 0);
  }

  function editCount() { return Object.keys(editing).length; }

  // a card is interactive before the slip is accepted, or while being edited
  function isEditable(m) { return !accepted || !!editing[m.id]; }


  /* =======================================================
     Deadline on the picks header

     A list of matches is a list. A list with a clock on it is
     a task, so the countdown runs to the end of the day.
     ======================================================= */

  T.pickCard.countdown($('[data-picks-deadline]'));


  /* =======================================================
     Open (interactive) match card
     ======================================================= */

  function openCard(m) {
    return T.pickCard.create(m, picks[m.id], {
      when: selectedDay.isToday ? 'Today' : selectedDay.weekday,
      editable: function () { return isEditable(m); },
      onChange: renderPickBar
    });
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

    card.render();
    return card;
  }

  // confirmed card re-opened for editing: no crowd split, fully interactive
  function editableCard(m) {
    var card = openCard(m);
    card.classList.add('is-editing');
    card.render();
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
        card.render();
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
