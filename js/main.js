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

  var matches    = today.picks;                    // the 10 daily picks
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
    if (fixtures) renderFixtures();
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
  var fixtures = $('[data-fixtures]');
  var expandedGroups = {};

  function renderDateRow() {
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
        if (selectedDay.key !== d.key) expandedGroups = {};
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

  }

  function renderCalendar() {
    renderDateRow();
    renderFixtures();
  }

  function fixtureOrder(a, b) {
    var rank = { live: 0, upcoming: 1, finished: 2 };
    return rank[a.status] - rank[b.status] || a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id);
  }

  function star(type, id, name, on) {
    return '<button class="fxstar' + (on ? ' is-on' : '') + '" type="button" data-follow-' + type + '="' + id +
      '" aria-pressed="' + on + '" aria-label="' + (on ? 'Unfollow ' : 'Follow ') + name + '">' +
      '<img src="assets/icons/star' + (on ? '-fill' : '') + '.svg" alt="" width="20" height="20"></button>';
  }

  function fixtureRow(m) {
    var name = T.club(m.home).name + ' versus ' + T.club(m.away).name;
    var action = '', state = '', label = name;
    if (m.status === 'live') {
      action = ' data-go="live-match" data-live-id="' + m.id + '"';
      label += ', live, ' + m.score.home + ' to ' + m.score.away + ', ' + m.minute + ' minutes. Open the match';
      state = '<b class="fxrow__score">' + m.score.home + ' – ' + m.score.away + '</b>' +
        '<span class="fxrow__minute"><i class="fxrow__dot"></i>' + m.minute + '’</span>';
    } else if (m.status === 'finished') {
      state = '<b class="fxrow__score">' + m.score.home + ' – ' + m.score.away + '</b><small class="fxrow__ft">FT</small>';
    } else {
      state = '<b class="fxrow__time">' + m.kickoff + '</b>';
      var pick = picks[m.id];
      if (pick && hasPick(pick)) state += '<small class="fxrow__pick">' + pick.score.home + ' – ' + pick.score.away + '</small>';
      if (selectedDay.isToday) {
        action = ' data-open-pick="' + m.id + '"';
        label += ', ' + m.kickoff + '. Open your pick';
      }
    }
    function team(slug) {
      return '<span class="fxrow__team"><img class="fxrow__crest" src="' + T.logo(slug) + '" alt="">' +
        '<span class="fxrow__name">' + T.club(slug).name + '</span></span>';
    }
    return '<div class="fxrow fxrow--' + m.status + '" data-match-id="' + m.id + '"' + action +
      (action ? ' role="button" tabindex="0" aria-label="' + label + '"' : '') + '>' +
      '<span class="fxrow__teams">' + team(m.home) + team(m.away) + '</span><span class="fxrow__state">' + state + '</span>' +
      star('match', m.id, name, T.follows.isMatch(m.id)) + '</div>';
  }

  function fixtureGroup(id, list, section) {
    var comp = T.competition(id), key = section + '-' + id;
    var expanded = !!expandedGroups[key];
    // Logos have not been supplied yet; render the specified fallback without a failing request.
    return '<article class="fxgroup" data-competition="' + id + '"><header class="fxgroup__head">' +
      '<span class="fxgroup__logo fxgroup__logo--mono">' + comp.short + '</span>' +
      '<span class="fxgroup__copy"><b class="fxgroup__name">' + comp.name + '</b>' +
      '<small class="fxgroup__round">Matchday ' + list[0].matchday + '</small></span>' +
      star('competition', id, comp.name, T.follows.isCompetition(id)) + '</header>' +
      (expanded ? list : list.slice(0, 3)).map(fixtureRow).join('') +
      (list.length > 3 ? '<button class="fxgroup__more" type="button" data-group-more="' + key + '" aria-expanded="' + expanded + '">' +
        (expanded ? 'Show less' : 'Show all (' + list.length + ')') +
        '<img src="assets/icons/chevron-right.svg" alt="" width="14" height="14"></button>' : '') + '</article>';
  }

  function fixtureSection(title, content, subtitle, icon) {
    return '<section class="fxsec"><div class="fxsec__head' + (subtitle ? ' fxsec__head--stacked' : '') + '">' +
      (icon ? '<img class="fxsec__icon" src="assets/icons/star-fill.svg" alt="" width="16" height="16">' : '') +
      '<span class="fxsec__title">' + title + '</span>' + (subtitle ? '<small class="fxsec__sub">' + subtitle + '</small>' : '') +
      '</div>' + content + '</section>';
  }

  function renderFixtures() {
    if (!fixtures) return;
    var list = selectedDay.matches.slice().sort(fixtureOrder), groups = {}, html = '';
    var followed = list.filter(function (m) {
      return T.follows.isMatch(m.id) || T.follows.isClub(m.home) || T.follows.isClub(m.away);
    });
    if (followed.length) html += fixtureSection('Followed Matches', '<article class="fxgroup fxgroup--flat">' + followed.map(fixtureRow).join('') + '</article>', '', true);
    list.forEach(function (m) { (groups[m.competition] || (groups[m.competition] = [])).push(m); });
    var ids = Object.keys(groups).sort(function (a, b) { return T.competition(a).order - T.competition(b).order; });
    var following = ids.filter(function (id) { return T.follows.isCompetition(id); });
    var others = ids.filter(function (id) { return !T.follows.isCompetition(id); });
    if (following.length) html += fixtureSection('Followed Competitions', following.map(function (id) { return fixtureGroup(id, groups[id], 'followed'); }).join(''));
    if (others.length) html += fixtureSection('All Matches', others.map(function (id) { return fixtureGroup(id, groups[id], 'all'); }).join(''), following.length ? "Competitions you don't follow" : '');
    if (!list.length) html = '<div class="fxempty"><b>No matches on this day</b><small>Pick another date to see the fixtures</small></div>';
    var content = document.createElement('div');
    content.innerHTML = html;
    var fragment = document.createDocumentFragment();
    while (content.firstChild) fragment.appendChild(content.firstChild);
    fixtures.replaceChildren(fragment);
  }

  fixtures.addEventListener('click', function (event) {
    var matchStar = event.target.closest('[data-follow-match]');
    var compStar = event.target.closest('[data-follow-competition]');
    var more = event.target.closest('[data-group-more]');
    if (matchStar || compStar || more) {
      event.stopPropagation();
      var control = matchStar || compStar || more;
      var attribute = matchStar ? 'data-follow-match' : compStar ? 'data-follow-competition' : 'data-group-more';
      var value = control.getAttribute(attribute);
      var section = control.closest('.fxsec').querySelector('.fxsec__title').textContent;
      if (matchStar) T.follows.toggleMatch(value);
      else if (compStar) T.follows.toggleCompetition(value);
      else { expandedGroups[value] = !expandedGroups[value]; renderFixtures(); }
      var candidates = $$('[' + attribute + ']', fixtures).filter(function (node) { return node.getAttribute(attribute) === value; });
      var target = candidates.filter(function (node) { return node.closest('.fxsec').querySelector('.fxsec__title').textContent === section; })[0] || candidates[0];
      if (target) target.focus({ preventScroll: true });
      return;
    }
    var pick = event.target.closest('[data-open-pick]');
    if (pick) document.dispatchEvent(new CustomEvent('the90:open-pick', { detail: { id: pick.getAttribute('data-open-pick') } }));
  });
  fixtures.addEventListener('keydown', function (event) {
    if (event.target.matches('.fxrow[role="button"]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.target.click();
    }
  });
  document.addEventListener('the90:follows', renderCalendar);
  document.addEventListener('the90:open-pick', function (event) {
    var id = event.detail && event.detail.id;
    var index = matches.map(function (m) { return m.id; }).indexOf(id);
    if (index < 0) return;
    slideTo(index);
    var scroller = $('.mainscroll', screen);
    var topbarHeight = parseFloat(getComputedStyle(screen).getPropertyValue('--topbar-h')) || 126;
    scroller.scrollTo({ top: scroller.scrollTop + picksWrap.getBoundingClientRect().top - scroller.getBoundingClientRect().top - topbarHeight - 16, behavior: stillness.matches ? 'auto' : 'smooth' });
  });


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
