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

  var BASE_BALANCE = 10000;
  var DAILY_REWARD = 5;

  var calendar   = T.buildCalendar();
  var today      = calendar.filter(function (d) { return d.isToday; })[0];
  var selectedDay = today;

  var matches    = today.matches;                    // the 10 daily picks
  var picks      = {};                               // matchId -> { outcome, score, derived }
  var accepted   = false;                            // the whole slip has been confirmed
  var currentBalance = BASE_BALANCE;
  var rewardGranted = false;

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

  // An outcome alone is only the first half of a daily pick. The exact score
  // is mandatory; entering it also derives the matching outcome automatically.
  function hasPick(p) {
    return !!(p.score && p.score.home !== null && p.score.away !== null);
  }

  function hasSelection(p) {
    return !!p.outcome || hasPick(p);
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



  /* =======================================================
     Deadline on the picks header

     A list of matches is a list. A list with a clock on it is
     a task, so the countdown runs to the end of the day.
     ======================================================= */

  /* =======================================================
     The round

     Ten cards on one horizontal rail, one card per swipe.

     Answering a card reveals the confirmation card and arms its
     button; pressing it is what banks the pick and moves the
     progress bar. Until then the button stays dead, so every card
     needs a deliberate confirmation before the round moves on.
     ======================================================= */

  var picksWrap = $('[data-picks]');
  var winbar    = $('[data-winbar]');
  var winLabel  = $('[data-win-label]');
  var winPoints = $('[data-win-points]');
  var winNext   = $('[data-win-next]');
  var winClose  = $('[data-win-close]');
  var doneCell  = $('[data-picks-done]');
  var totalCell = $('[data-picks-total]');
  var meter     = $('[data-picks-meter]');

  var cards = {};        // matchId -> element
  var banked = {};       // matchId -> true once the pick has been confirmed
  var doneCard  = $('[data-picks-done-card]');
  var donePoints = $('[data-done-points]');
  var doneEdit  = $('[data-done-edit]');
  var doneArt   = $('[data-done-art]');
  var stillness = window.matchMedia('(prefers-reduced-motion: reduce)');
  var winbarDismissed = false;

  T.pickCard.countdown($('[data-picks-deadline]'));

  /* What was accepted for a card, so a change can be taken back. */
  var kept = {};

  function snapshot(pick) {
    return JSON.stringify({ outcome: pick.outcome, score: pick.score });
  }

  function repaint(m) {
    var fresh = build(m);
    if (cards[m.id] && cards[m.id].parentNode) {
      cards[m.id].parentNode.replaceChild(fresh, cards[m.id]);
    }
    cards[m.id] = fresh;
  }

  function restore(m) {
    if (!kept[m.id]) return false;
    var saved = JSON.parse(kept[m.id]);
    var pick = picks[m.id];
    if (snapshot(pick) === kept[m.id]) return false;
    pick.outcome = saved.outcome;
    pick.score = saved.score;
    banked[m.id] = true;
    return true;
  }

  function build(m) {
    return T.pickCard.create(m, picks[m.id], {
      when: selectedDay.isToday ? 'Today' : selectedDay.weekday,
      daily: true,
      // a confirmed pick is still a pick you can change your mind about
      editable: function () { return true; },
      isComplete: hasPick,
      onChange: function () {
        // touching a confirmed pick sends it back for confirmation
        banked[m.id] = false;
        winbarDismissed = false;
        refresh();
      }
    });
  }

  matches.forEach(function (m) {
    var card = build(m);
    cards[m.id] = card;
    picksWrap.insertBefore(card, doneCard);
  });

  function bankedCount() {
    return matches.filter(function (m) { return banked[m.id]; }).length;
  }

  function answeredCount() {
    return matches.filter(function (m) { return hasSelection(picks[m.id]); }).length;
  }

  // the next card still waiting to be confirmed, wrapping past the end
  function nextOpen(from) {
    for (var step = 1; step <= matches.length; step += 1) {
      var i = (from + step) % matches.length;
      if (!banked[matches[i].id]) return i;
    }
    return -1;
  }

  function currentIndex() {
    var mid = picksWrap.scrollLeft + picksWrap.clientWidth / 2;
    var best = 0, bestGap = Infinity;
    matches.forEach(function (m, i) {
      var card = cards[m.id];
      var centre = card.offsetLeft + card.offsetWidth / 2;
      var gap = Math.abs(centre - mid);
      if (gap < bestGap) { bestGap = gap; best = i; }
    });
    return best;
  }

  function slideTo(index) {
    var first = cards[matches[0].id];
    var card = index === -1 ? doneCard : cards[matches[index].id];
    picksWrap.scrollTo({
      left: card.offsetLeft - first.offsetLeft,
      behavior: stillness.matches ? 'auto' : 'smooth'
    });
  }

  function nudgeCta() {
    if (!winNext) return;
    winNext.classList.remove('is-nudging');
    void winNext.offsetWidth;                 // restart the animation
    winNext.classList.add('is-nudging');
  }

  // the button always speaks for the card you are looking at
  var ctaWasReady = false;
  function updateCta() {
    if (!winNext) return;
    var m = matches[currentIndex()];
    var pick = picks[m.id];
    var ready = hasPick(pick) && !banked[m.id];
    winNext.disabled = !ready;
    // the pulse plays every time the button arms — a fresh answer and a
    // changed pick both ask for the same confirmation
    if (ready && !ctaWasReady) nudgeCta();
    if (!ready) winNext.classList.remove('is-nudging');
    ctaWasReady = ready;
    if (!hasPick(pick) && pick.outcome) {
      winNext.textContent = 'Choose exact score';
      return;
    }
    winNext.textContent = 'Accept pick';
  }

  function renderBalance(animate) {
    $$('.balance__value').forEach(function (cell) {
      cell.textContent = fmt(currentBalance);
      if (!animate) return;
      cell.classList.remove('is-bump');
      void cell.offsetWidth;
      cell.classList.add('is-bump');
    });
  }

  function refresh() {
    var done = bankedCount();
    var total = matches.length;

    if (doneCell) doneCell.textContent = done;
    if (totalCell) totalCell.textContent = '/' + total;
    if (meter) meter.style.width = (done / total * 100) + '%';
    if (winPoints) winPoints.textContent = '+' + fmt(totalPoints());
    if (donePoints) donePoints.textContent = '+ ' + DAILY_REWARD;

    updateCta();
    applyWinbar();
  }

  /* Keep the confirmation control available after the first selection. The
     closing card still carries the finished-round summary, so both never
     appear together. */
  function applyWinbar() {
    showWinbar(answeredCount() > 0 && !isFinished() && !winbarDismissed);
  }

  function isFinished() {
    return Boolean(doneCard) && !doneCard.hidden;
  }

  /* The round closes on its own card at the end of the rail: no surface, no
     border, just the tick, the total and a way back in. Re-confirming an
     edited pick only restores the summary — nothing slides on its own. */
  function finish() {
    if (!doneCard) return;
    var firstTime = !rewardGranted;
    if (firstTime) {
      rewardGranted = true;
      currentBalance += DAILY_REWARD;
      renderBalance(true);
    }
    doneCard.hidden = false;
    refresh();
    if (firstTime) {
      slideTo(-1);
      playDoneTick(doneArt);
    }
  }

  function withDoneData(then) {
    if (window.THE90_PICKS_DONE) return then(window.THE90_PICKS_DONE);
    var tag = document.createElement('script');
    tag.src = 'assets/lottie/picks-done.js';
    tag.onload = function () { then(window.THE90_PICKS_DONE); };
    tag.onerror = function () { then(null); };
    document.head.appendChild(tag);
  }

  /* Fetched as a script rather than handed to lottie as a `path`: an XHR for
     the JSON is blocked when the prototype is opened straight from disk, and
     the tick would silently never appear. Still lazy — the file only loads
     once a round is actually finished. The animation is cached on the
     container, so replaying costs nothing.

     Shared with the tournament round, which ends on the same tick. */
  function playDoneTick(container) {
    if (!container || typeof lottie === 'undefined') return;
    if (container.tickAnimation) { container.tickAnimation.goToAndPlay(0, true); return; }
    withDoneData(function (data) {
      if (container.tickAnimation || !data) return;
      container.tickAnimation = lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: data
      });
    });
  }
  if (T) T.playDoneTick = playDoneTick;

  if (doneEdit) {
    doneEdit.addEventListener('click', function () {
      doneCard.hidden = true;
      refresh();
      slideTo(0);
    });
  }

  function showWinbar(show) {
    if (!winbar) return;
    if (show) {
      if (winbar.classList.contains('is-in')) return;
      winbar.hidden = false;
      void winbar.offsetWidth;      // flush layout so the slide has a start state
      winbar.classList.add('is-in');
      return;
    }
    winbar.classList.remove('is-in');
    // with motion off there is no slide to wait out
    if (stillness.matches) { winbar.hidden = true; return; }
    setTimeout(function () {
      if (!winbar.classList.contains('is-in')) winbar.hidden = true;
    }, 260);
  }

  // The tournament round reuses this exact surface instead of introducing a
  // second fixed bar. Its own state and copy are supplied by tournament.js.
  T.pickConfirmationBar = {
    element: winbar,
    label: winLabel,
    points: winPoints,
    next: winNext,
    close: winClose,
    show: showWinbar,
    isReducedMotion: function () { return stillness.matches; },
    restoreDaily: function () {
      if (winbar) winbar.classList.remove('winbar--round-picks');
      if (winLabel) winLabel.textContent = 'Potential win:';
      if (winNext) winNext.textContent = 'Accept pick';
      refresh();
    }
  };

  // swiping between cards re-points the button at whatever is on screen
  var scrollFrame;
  var lastCard = 0;
  picksWrap.addEventListener('scroll', function () {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(function () {
      var here = currentIndex();
      if (here !== lastCard) {
        var left = matches[lastCard];
        lastCard = here;
        if (left && restore(left)) {
          repaint(left);
          refresh();
          return;
        }
      }
      updateCta();
    });
  }, { passive: true });

  if (winNext) {
    winNext.addEventListener('click', function () {
      if (winbar && winbar.classList.contains('winbar--round-picks')) return;
      var here = currentIndex();
      var m = matches[here];
      if (!hasPick(picks[m.id]) || banked[m.id]) return;

      banked[m.id] = true;          // this is the confirmation the bar counts
      kept[m.id] = snapshot(picks[m.id]);
      var open = nextOpen(here);
      refresh();
      if (open !== -1) slideTo(open);
      else finish();                // that was the last one
    });
  }

  if (winClose) {
    winClose.addEventListener('click', function () {
      if (winbar && winbar.classList.contains('winbar--round-picks')) return;
      // an accepted pick you were changing goes back to what it was
      var here = matches[currentIndex()];
      if (here && restore(here)) {
        repaint(here);
        refresh();
        return;
      }
      winbarDismissed = true;
      showWinbar(false);
    });
  }

  renderBalance(false);
  refresh();


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

    // Figma › match-card (678:5469): the fixture standing on a pitch, kickoff
    // over the halfway line, a crest and a name on either side of it.
    function side(slug) {
      return '<span class="ccard__side">' +
        '<img class="ccard__crest" src="' + T.logo(slug) + '" alt="">' +
        '<b>' + T.club(slug).name + '</b>' +
      '</span>';
    }

    var when = selectedDay.date + ' ' + selectedDay.monthLong;

    dayList.innerHTML = '';
    selectedDay.matches.forEach(function (m) {
      dayList.appendChild(el(
        '<article class="ccard">' +
          '<span class="ccard__when">' + when + ' • ' + m.kickoff + '</span>' +
          '<span class="ccard__row">' +
            side(m.home) +
            '<span class="ccard__vs">VS</span>' +
            side(m.away) +
          '</span>' +
        '</article>'
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
  // the second way on closes it too, and does nothing else — that is the point
  var modalSecond = $('[data-modal-second]');
  if (modalSecond) modalSecond.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });


  /* =======================================================
     Daily pick points guide
     ======================================================= */

  var pointsModal = $('[data-points-modal]');
  var pointsModalClose = $$('[data-points-modal-close]');
  var pointsModalTrigger = null;

  function closePointsModal() {
    if (!pointsModal) return;
    pointsModal.hidden = true;
    if (pointsModalTrigger) {
      pointsModalTrigger.setAttribute('aria-expanded', 'false');
      pointsModalTrigger = null;
    }
  }

  function openPointsModal(event) {
    if (!pointsModal) return;
    if (pointsModalTrigger) pointsModalTrigger.setAttribute('aria-expanded', 'false');
    pointsModalTrigger = event.detail && event.detail.trigger;
    if (pointsModalTrigger) pointsModalTrigger.setAttribute('aria-expanded', 'true');
    pointsModal.hidden = false;
  }

  window.addEventListener('the90:open-points-info', openPointsModal);
  pointsModalClose.forEach(function (control) {
    control.addEventListener('click', closePointsModal);
  });


  /* =======================================================
     Boot
     ======================================================= */

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
