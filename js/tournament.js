/* THE90 — THEARENA tournament detail */
(function () {
  'use strict';

  var arena = document.querySelector('[data-screen="arena"]');
  var screen = document.querySelector('[data-screen="arena-tournament"]');
  if (!arena || !screen) return;

  var tournaments = {
    'diamond-cup': {
      title: 'DIAMOND CUP', kind: 'sponsored', label: 'Sponsored', joined: true, live: true, liveMinutes: 2735,
      participants: 15, currentRound: 3, rounds: 5, place: '#6',
      description: 'Exclusive VIP tournament · 5 rounds of top matches · branded sponsor prizes',
      about: 'Diamond Cup is a closed VIP tournament with 5 rounds of top matches. Predict outcomes, earn points and compete for amazing prizes from our sponsor.'
    },
    'weekend-spotlight': {
      title: 'WEEKEND CHALLENGE', kind: 'open', label: 'Open', joined: true, live: true, liveMinutes: 2735,
      participants: 40, currentRound: 2, rounds: 5, place: '#12',
      description: 'Predict top matches this weekend and compete for exclusive prizes',
      about: 'Weekend Challenge brings together the biggest matches of the week. Make your predictions, earn points and chase a place among the best predictors.'
    },
    'final-whistle': {
      title: 'FINAL WHISTLE', kind: 'sponsored', label: 'Sponsored', joined: true, live: true, liveMinutes: 2735,
      participants: 32, currentRound: 1, rounds: 3, place: '#3',
      description: 'Join the sponsor cup and make your picks before the final kickoff',
      about: 'Final Whistle is the sponsor cup for the final weekend. Every pick counts as you compete across three decisive rounds.'
    },
    'weekend-challenge': {
      title: 'WEEKEND CHALLENGE', kind: 'open', label: 'Open', joined: false,
      participants: 40, currentRound: 0, rounds: 5, place: '#10',
      description: 'Guess the outcomes of top matches and win cool prizes',
      about: 'Make your picks for the weekend’s biggest games. Join before the first deadline to collect points in every round.'
    },
    'ranked-rush': {
      title: 'RANKED RUSH', kind: 'ranked', label: 'Ranked', joined: false,
      participants: 40, currentRound: 0, rounds: 5, place: '#18',
      description: 'A ranked tournament for players ready to climb the leaderboard',
      about: 'Ranked Rush rewards consistent predictions. Every point improves your tournament position and brings you closer to the prize places.'
    }
  };

  var activeId = 'diamond-cup';
  var activeTab = 'overview';
  var scroll = screen.querySelector('[data-tournament-scroll]');
  var tabsSticky = screen.querySelector('.arena-tournament-tabs-sticky');
  var tabs = screen.querySelector('[data-tournament-tabs]');
  var tabIndicator = screen.querySelector('[data-tournament-tab-indicator]');
  var tabButtons = Array.prototype.slice.call(screen.querySelectorAll('[data-tournament-tab]'));
  var panels = Array.prototype.slice.call(screen.querySelectorAll('[data-tournament-panel]'));
  var panelScroller = screen.querySelector('[data-tournament-panels]');
  var activeIndex = 0;
  var pendingPanelTarget = null;
  var pendingPanelTimer = null;
  var panelScrollFrame = null;
  var liveCountdownTimer = null;
  var title = screen.querySelector('[data-tournament-title]');
  var kind = screen.querySelector('[data-tournament-kind]');
  var description = screen.querySelector('[data-tournament-description]');
  var about = screen.querySelector('[data-tournament-about]');
  var participants = screen.querySelector('[data-tournament-participants]');
  var time = screen.querySelector('[data-tournament-time]');
  var timeLabel = screen.querySelector('[data-tournament-time-label]');
  var rounds = screen.querySelector('[data-tournament-rounds]');
  var roundTotal = screen.querySelector('[data-tournament-round-total]');
  var entry = screen.querySelector('[data-tournament-entry]');
  var place = screen.querySelector('[data-tournament-place]');
  var join = screen.querySelector('[data-tournament-join]');
  var rankingPodium = screen.querySelector('[data-tournament-ranking-podium]');
  var rankingList = screen.querySelector('[data-tournament-rankings-list]');
  var more = screen.querySelector('[data-tournament-more]');
  var eventItems = Array.prototype.slice.call(screen.querySelectorAll('[data-tournament-event]'));
  var TOURNAMENT_PLAYER_COUNT = 20;
  var rankingAvatars = [
    'assets/invite/avatar-zara.png',
    'assets/invite/avatar-kai.png',
    'assets/support/banner-person.png',
    'assets/invite/profile-person.png',
    'assets/invite/screen-person.png'
  ];
  var rankingNames = [
    ['Mika Chen', '@mikac'], ['Alex Rivera', '@alexr'], ['Leo Hart', '@leoh'],
    ['Zara Volkov', '@zarav'], ['Kai Tanaka', '@kait'], ['Nina Okafor', '@ninao'],
    ['Sam Moreau', '@samm'], ['Juno Park', '@junop'], ['Ravi Patel', '@ravip'],
    ['Liam Becker', '@liamb'], ['Emma Silva', '@emmas'], ['Mateo Rossi', '@mateor'],
    ['Olivia Costa', '@oliviac'], ['Noah Kim', '@noahk'], ['Ava Dubois', '@avad'],
    ['Lucas Novak', '@lucasn'], ['Mia Wilson', '@miaw'], ['Theo Santos', '@theos'],
    ['Lina Petrov', '@linap'], ['Hugo Garcia', '@hugog']
  ];

  function currentTournament() {
    return tournaments[activeId] || tournaments['diamond-cup'];
  }

  function formatTournamentCountdown(milliseconds) {
    var minutes = Math.max(0, Math.ceil(milliseconds / 60000));
    var hours = Math.floor(minutes / 60);
    return hours + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
  }

  function renderTournamentTime(tournament) {
    if (!timeLabel || !time) return;
    if (!tournament.live) {
      timeLabel.textContent = 'Starts in';
      time.textContent = '2d 14h';
      return;
    }
    if (!tournament.liveEndsAt) {
      tournament.liveEndsAt = Date.now() + (tournament.liveMinutes || 2735) * 60000;
    }
    timeLabel.textContent = 'Ends in';
    time.textContent = formatTournamentCountdown(tournament.liveEndsAt - Date.now());
  }

  function startLiveCountdown(tournament) {
    if (liveCountdownTimer) window.clearInterval(liveCountdownTimer);
    liveCountdownTimer = null;
    if (!tournament.live) return;
    liveCountdownTimer = window.setInterval(function () {
      if (currentTournament().live) renderTournamentTime(currentTournament());
    }, 30000);
  }

  function updateArenaCard(id) {
    Array.prototype.slice.call(arena.querySelectorAll('[data-tournament-id="' + id + '"]')).forEach(function (card) {
      card.dataset.tournamentState = 'joined';
      var button = card.querySelector('[data-arena-join]');
      if (button && !button.classList.contains('is-locked')) {
        button.classList.add('is-joined');
        button.textContent = 'Joined';
        button.setAttribute('aria-pressed', 'true');
      }
    });
  }

  function rankingScore(rank) {
    return Math.round(2480 * Math.pow(.947, rank - 1));
  }

  function formatScore(score) {
    var board = window.THE90 && window.THE90.board;
    if (board && board.format) return board.format(score);
    return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function tournamentUser(rank, tournament) {
    var yourRank = tournament.joined ? Number(tournament.place.replace('#', '')) : 0;
    if (rank === yourRank) {
      return { name: 'Your Name', handle: '@yournickname', avatar: 'assets/img/avatar.png', isYou: true };
    }
    var seed = rankingNames[rank - 1] || ['Tournament Player ' + rank, '@player' + rank];
    return {
      name: seed[0],
      handle: seed[1],
      avatar: rankingAvatars[(rank - 1) % rankingAvatars.length]
    };
  }

  function makeScore(score, className) {
    var result = document.createElement('span');
    result.className = className;
    result.appendChild(document.createTextNode(formatScore(score) + ' '));
    var crown = document.createElement('img');
    crown.src = 'assets/notifications/crown.svg';
    crown.alt = '';
    crown.width = 14;
    crown.height = 12;
    result.appendChild(crown);
    return result;
  }

  function makePodiumUser(rank, placement, tournament) {
    var user = tournamentUser(rank, tournament);
    var card = document.createElement('article');
    card.className = 'rankings-podium__user rankings-podium__user--' + placement;

    var avatar = document.createElement('img');
    avatar.src = user.avatar;
    avatar.alt = user.name;
    var name = document.createElement('strong');
    name.textContent = user.name;
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(makeScore(rankingScore(rank), ''));
    return card;
  }

  function makeRankingRow(rank, tournament) {
    var user = tournamentUser(rank, tournament);
    var row = document.createElement('article');
    row.className = 'rankings-row' + (user.isYou ? ' rankings-row--you' : '');
    row.dataset.rank = String(rank);

    var position = document.createElement('span');
    position.className = 'rankings-row__rank';
    position.textContent = rank;

    var avatar = document.createElement('span');
    avatar.className = 'rankings-row__avatar';
    var avatarImage = document.createElement('img');
    avatarImage.src = user.avatar;
    avatarImage.alt = user.name;
    avatar.appendChild(avatarImage);

    var copy = document.createElement('span');
    copy.className = 'rankings-row__copy';
    var name = document.createElement('strong');
    name.textContent = user.name;
    var handle = document.createElement('small');
    handle.textContent = user.handle;
    copy.appendChild(name);
    copy.appendChild(handle);

    row.appendChild(position);
    row.appendChild(avatar);
    row.appendChild(copy);
    row.appendChild(makeScore(rankingScore(rank), 'rankings-score'));
    return row;
  }

  function renderTournamentLeaderboard() {
    if (!rankingPodium || !rankingList) return;
    var tournament = currentTournament();
    var podium = document.createDocumentFragment();

    podium.appendChild(makePodiumUser(2, 'second', tournament));
    podium.appendChild(makePodiumUser(1, 'first', tournament));
    podium.appendChild(makePodiumUser(3, 'third', tournament));
    [['second', 'assets/rankings/podium-2.png'], ['first', 'assets/rankings/podium-1.png'], ['third', 'assets/rankings/podium-3.png']].forEach(function (stand) {
      var image = document.createElement('img');
      image.className = 'rankings-podium__stand rankings-podium__stand--' + stand[0];
      image.src = stand[1];
      image.alt = '';
      podium.appendChild(image);
    });
    rankingPodium.replaceChildren(podium);

    var rows = document.createDocumentFragment();
    for (var rank = 4; rank <= TOURNAMENT_PLAYER_COUNT; rank += 1) {
      rows.appendChild(makeRankingRow(rank, tournament));
    }
    rankingList.replaceChildren(rows);
    rankingList.dataset.userCount = String(TOURNAMENT_PLAYER_COUNT);
  }

  function renderTournamentEvents(tournament) {
    var currentRound = Number(tournament.currentRound) || 0;
    eventItems.forEach(function (item) {
      var round = Number(item.dataset.tournamentEvent);
      var complete = round < currentRound;
      var current = round === currentRound && currentRound > 0;
      var marker = item.querySelector('[data-tournament-event-marker]');
      var state = item.querySelector('[data-tournament-event-state]');

      item.classList.toggle('is-complete', complete);
      item.classList.toggle('is-current', current);
      if (marker) marker.textContent = complete ? '✓' : String(round);
      if (state) state.textContent = complete ? 'Completed' : (current ? 'Live now' : (round === currentRound + 1 ? 'Next' : 'Upcoming'));
    });
  }

  function playTournamentPodium() {
    if (!rankingPodium) return;
    rankingPodium.classList.remove('is-entering');
    void rankingPodium.offsetWidth;
    rankingPodium.classList.add('is-entering');
  }

  function moveTabIndicator(button, immediate) {
    if (!tabs || !tabIndicator || !button) return;
    var styles = window.getComputedStyle(button);
    var paddingLeft = parseFloat(styles.paddingLeft) || 0;
    var paddingRight = parseFloat(styles.paddingRight) || 0;
    if (immediate) tabIndicator.classList.add('is-instant');
    tabIndicator.style.width = Math.max(0, button.offsetWidth - paddingLeft - paddingRight) + 'px';
    tabIndicator.style.transform = 'translateX(' + (button.offsetLeft + paddingLeft) + 'px)';
    if (immediate) {
      window.requestAnimationFrame(function () {
        tabIndicator.classList.remove('is-instant');
      });
    }
  }

  function updateStickyTabs() {
    if (!scroll || !tabsSticky) return;
    tabsSticky.classList.toggle('is-stuck', scroll.scrollTop >= tabsSticky.offsetTop - 78);
  }

  function syncTabMeasurements() {
    var selectedButton = tabButtons.find(function (button) { return button.dataset.tournamentTab === activeTab; });
    scrollTabBar(activeIndex, 'auto');
    moveTabIndicator(selectedButton, true);
    updateStickyTabs();
  }

  function nearestTabScrollPosition() {
    if (!tabs) return 0;
    var nearest = 0;
    var distance = Infinity;
    tabButtons.forEach(function (button) {
      var position = Math.max(0, button.offsetLeft - 16);
      var nextDistance = Math.abs(tabs.scrollLeft - position);
      if (nextDistance < distance) {
        nearest = position;
        distance = nextDistance;
      }
    });
    return nearest;
  }

  function tabIndex(value) {
    if (typeof value === 'number') return value >= 0 && value < tabButtons.length ? value : -1;
    return tabButtons.findIndex(function (button) { return button.dataset.tournamentTab === value; });
  }

  function scrollTabBar(index, behavior) {
    if (!tabs || tabButtons.length < 2) return;
    var progress = index / (tabButtons.length - 1);
    var maxScroll = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
    tabs.scrollTo({ left: progress * maxScroll, behavior: behavior || 'smooth' });
  }

  function clearPendingPanelTarget() {
    pendingPanelTarget = null;
    if (pendingPanelTimer) window.clearTimeout(pendingPanelTimer);
    pendingPanelTimer = null;
  }

  function scrollPanelContent(index, behavior) {
    if (!panelScroller) return;
    var target = index * panelScroller.clientWidth;
    if (Math.abs(panelScroller.scrollLeft - target) <= 1) return;
    if (behavior === 'auto') {
      clearPendingPanelTarget();
      panelScroller.scrollTo({ left: target, behavior: 'auto' });
      return;
    }
    pendingPanelTarget = target;
    if (pendingPanelTimer) window.clearTimeout(pendingPanelTimer);
    pendingPanelTimer = window.setTimeout(clearPendingPanelTarget, 560);
    panelScroller.scrollTo({ left: target, behavior: behavior || 'smooth' });
  }

  function renderTournament() {
    var tournament = currentTournament();
    title.textContent = tournament.title;
    kind.textContent = tournament.label;
    kind.className = 'thearena-tag thearena-tag--' + tournament.kind;
    description.textContent = tournament.description;
    about.textContent = tournament.about;
    participants.textContent = tournament.participants;
    renderTournamentTime(tournament);
    startLiveCountdown(tournament);
    rounds.textContent = tournament.currentRound;
    if (roundTotal) roundTotal.textContent = '/' + tournament.rounds;
    entry.hidden = tournament.joined || tournament.live;
    place.hidden = !tournament.joined;
    place.querySelector('[data-tournament-place]').textContent = tournament.place;
    join.hidden = tournament.joined || tournament.live;
    renderTournamentEvents(tournament);
    renderTournamentLeaderboard();
  }

  function setActiveTab(value, options) {
    var index = tabIndex(value);
    if (index < 0) return;
    var settings = typeof options === 'string' ? { behavior: options } : (options || {});
    var selectedButton = tabButtons[index];
    var name = selectedButton.dataset.tournamentTab;

    activeIndex = index;
    activeTab = name;
    tabButtons.forEach(function (button) {
      var selected = button.dataset.tournamentTab === name;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    scrollTabBar(index, settings.behavior);
    moveTabIndicator(selectedButton, settings.behavior === 'auto');
    panels.forEach(function (panel) {
      var selected = panel.dataset.tournamentPanel === name;
      panel.hidden = false;
      panel.classList.toggle('is-active', selected);
      panel.setAttribute('aria-hidden', String(!selected));
    });
    if (!settings.fromPanel) scrollPanelContent(index, settings.behavior);
    if (name === 'leaderboard') {
      window.requestAnimationFrame(function () {
        playTournamentPodium();
      });
    }
  }

  function openTournament(id) {
    var source = arena.querySelector('[data-tournament-id="' + id + '"]');
    if (!source || source.dataset.tournamentState === 'locked') return;
    if (!tournaments[id]) return;

    activeId = id;
    tournaments[id].joined = source.dataset.tournamentState === 'joined';
    tournaments[id].live = source.dataset.tournamentPhase === 'live';
    renderTournament();
    setActiveTab('overview', 'auto');
    if (scroll) scroll.scrollTop = 0;
    updateStickyTabs();
    if (window.THE90 && window.THE90.go) window.THE90.go('arena-tournament');
  }

  Array.prototype.slice.call(arena.querySelectorAll('[data-tournament-id]')).forEach(function (card) {
    card.addEventListener('click', function (event) {
      if (event.target.closest('[data-arena-join]')) return;
      openTournament(card.dataset.tournamentId);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openTournament(card.dataset.tournamentId);
    });
  });

  tabButtons.forEach(function (button) {
    button.addEventListener('click', function () { setActiveTab(button.dataset.tournamentTab); });
  });

  if (tabs) {
    var tabDrag = { pointerId: null, startX: 0, startScroll: 0, moved: false };
    tabs.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      tabDrag.pointerId = event.pointerId;
      tabDrag.startX = event.clientX;
      tabDrag.startScroll = tabs.scrollLeft;
      tabDrag.moved = false;
      tabs.setPointerCapture(event.pointerId);
      tabs.classList.add('is-dragging');
    });
    tabs.addEventListener('pointermove', function (event) {
      if (event.pointerId !== tabDrag.pointerId) return;
      var delta = event.clientX - tabDrag.startX;
      if (Math.abs(delta) > 4) tabDrag.moved = true;
      tabs.scrollLeft = tabDrag.startScroll - delta;
    });
    function endTabDrag(event) {
      if (event.pointerId !== tabDrag.pointerId) return;
      if (tabs.hasPointerCapture(event.pointerId)) tabs.releasePointerCapture(event.pointerId);
      tabDrag.pointerId = null;
      tabs.classList.remove('is-dragging');
      tabs.scrollTo({ left: nearestTabScrollPosition(), behavior: 'smooth' });
    }
    tabs.addEventListener('pointerup', endTabDrag);
    tabs.addEventListener('pointercancel', endTabDrag);
    tabs.addEventListener('click', function (event) {
      if (!tabDrag.moved) return;
      tabDrag.moved = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    // Keep ordinary vertical wheel movement available to the tournament page,
    // while a two-finger horizontal trackpad gesture always scrolls this ribbon.
    tabs.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || !event.deltaX) return;
      tabs.scrollLeft += event.deltaX;
      event.preventDefault();
    }, { passive: false });
  }

  if (join) {
    join.addEventListener('click', function () {
      var tournament = currentTournament();
      tournament.joined = true;
      tournament.participants += 1;
      updateArenaCard(activeId);
      renderTournament();
    });
  }

  if (more) {
    more.addEventListener('click', function () {
      var section = more.closest('.tournament-about');
      var expanded = section.classList.toggle('is-expanded');
      more.setAttribute('aria-expanded', String(expanded));
      more.firstChild.nodeValue = expanded ? 'Show less ' : 'Show more ';
    });
  }

  if (panelScroller) {
    var panelDrag = { pointerId: null, startX: 0, startScroll: 0, moved: false };
    panelScroller.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      panelDrag.pointerId = event.pointerId;
      panelDrag.startX = event.clientX;
      panelDrag.startScroll = panelScroller.scrollLeft;
      panelDrag.moved = false;
      panelScroller.setPointerCapture(event.pointerId);
      panelScroller.classList.add('is-dragging');
    });
    panelScroller.addEventListener('pointermove', function (event) {
      if (event.pointerId !== panelDrag.pointerId) return;
      var delta = event.clientX - panelDrag.startX;
      if (Math.abs(delta) > 4) panelDrag.moved = true;
      panelScroller.scrollLeft = panelDrag.startScroll - delta;
    });
    function endPanelDrag(event) {
      if (event.pointerId !== panelDrag.pointerId) return;
      if (panelScroller.hasPointerCapture(event.pointerId)) panelScroller.releasePointerCapture(event.pointerId);
      panelDrag.pointerId = null;
      panelScroller.classList.remove('is-dragging');
      panelScroller.scrollTo({
        left: Math.round(panelScroller.scrollLeft / panelScroller.clientWidth) * panelScroller.clientWidth,
        behavior: 'smooth'
      });
    }
    panelScroller.addEventListener('pointerup', endPanelDrag);
    panelScroller.addEventListener('pointercancel', endPanelDrag);
    panelScroller.addEventListener('click', function (event) {
      if (!panelDrag.moved) return;
      panelDrag.moved = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    panelScroller.addEventListener('scroll', function () {
      if (panelScrollFrame) return;
      panelScrollFrame = window.requestAnimationFrame(function () {
        panelScrollFrame = null;
        if (!panelScroller.clientWidth) return;
        if (pendingPanelTarget !== null) {
          if (Math.abs(panelScroller.scrollLeft - pendingPanelTarget) <= 1) clearPendingPanelTarget();
          else return;
        }
        var index = Math.round(panelScroller.scrollLeft / panelScroller.clientWidth);
        index = Math.max(0, Math.min(tabButtons.length - 1, index));
        if (index !== activeIndex) setActiveTab(index, { fromPanel: true });
      });
    }, { passive: true });
  }

  if (scroll) {
    scroll.addEventListener('scroll', updateStickyTabs, { passive: true });
  }
  window.addEventListener('resize', function () {
    syncTabMeasurements();
  });
  window.addEventListener('the90:screen', function (event) {
    if (!event.detail || event.detail !== 'arena-tournament') return;
    window.requestAnimationFrame(syncTabMeasurements);
  });

  document.addEventListener('the90:tournamentjoined', function (event) {
    var id = event.detail && event.detail.id;
    if (!id || !tournaments[id]) return;
    tournaments[id].joined = true;
    if (id === activeId) renderTournament();
  });

  if (window.THE90) window.THE90.openTournament = openTournament;
  renderTournament();
  setActiveTab('overview', 'auto');
  syncTabMeasurements();
})();
