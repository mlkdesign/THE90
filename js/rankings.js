/* THE90 — Global Ranking: top 20, then your position with its neighbours */
(function () {
  'use strict';

  var BOARD = window.THE90.board;
  var PLAYER_COUNT = 100;
  var YOUR_RANK = 47;

  var list = document.querySelector('[data-rankings-list]');
  var scroll = document.querySelector('[data-rankings-scroll]');
  var pin = document.querySelector('[data-rankings-pin]');
  var screen = document.querySelector('[data-screen="rankings"]');
  if (!list || !scroll || !pin || !screen) return;

  var ICONS = 'assets/rankings/v2/';

  /* Figma › Global – Top Leaders — the first eight are the people on the
     mock-up, with their own portraits; everybody after them reuses those. */
  var known = [
    { name: 'Maya Chen', avatar: ICONS + 'user-1.jpg' },
    { name: 'Leo Brooks', avatar: ICONS + 'user-2.jpg' },
    { name: 'Sofia Patel', avatar: ICONS + 'user-3.jpg' },
    { name: 'Noah Kim', avatar: ICONS + 'user-4.jpg' },
    { name: 'Ava Moretti', avatar: ICONS + 'user-5.jpg' },
    { name: 'Ethan Hall', avatar: ICONS + 'user-6.jpg' },
    { name: 'Mia Torres', avatar: ICONS + 'user-7.jpg' },
    { name: 'Zara Volkov', avatar: ICONS + 'user-8.png' }
  ];
  var firstNames = [
    'Liam', 'Emma', 'Mateo', 'Olivia', 'Lucas', 'Isla', 'Daniel', 'Amara', 'Theo', 'Lina',
    'Adam', 'Nora', 'Hugo', 'Kai', 'Owen', 'Nina', 'Sam', 'Juno', 'Ravi', 'Iris'
  ];
  var lastNames = [
    'Bennett', 'Silva', 'Kowalski', 'Dubois', 'Rossi', 'Martinez', 'Johansson', 'Ibrahim',
    'Novak', 'Costa', 'Muller', 'Popescu', 'Santos', 'Wilson', 'Nielsen', 'Yilmaz'
  ];

  /* Season points, strictly decreasing. The decay is tuned so rank 47 lands
     on the 1 520 shown in My Zone. */
  var TOP_SCORE = 2480;
  var DECAY = 0.98942;

  function scoreFor(rank) {
    return Math.round(TOP_SCORE * Math.pow(DECAY, rank - 1));
  }

  function userFor(rank) {
    if (rank === YOUR_RANK) {
      return { name: 'Your Name', avatar: 'assets/my-zone/avatar.png', isYou: true };
    }
    if (known[rank - 1]) return known[rank - 1];
    var index = rank - known.length - 1;
    return {
      name: firstNames[index % firstNames.length] + ' ' +
        lastNames[Math.floor(index / firstNames.length) % lastNames.length],
      avatar: known[index % known.length].avatar
    };
  }

  /* How many places a player moved since the last round: up, down or not at
     all. Fixed per rank so the board reads the same on every visit. */
  var TRENDS = [40, 40, -30, 40, -15, null, -4, 0, 100, 5, 0, 0];
  var YOUR_TREND = 25;

  function trendFor(rank) {
    if (rank === YOUR_RANK) return YOUR_TREND;
    if (rank <= TRENDS.length) return TRENDS[rank - 1];
    var seed = (rank * 37) % 11;
    if (seed < 3) return 0;
    return (seed % 2 ? 1 : -1) * ((rank * 7) % 23 + 1);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(src, size) {
    var image = el('img');
    image.src = src;
    image.alt = '';
    image.width = size;
    image.height = size;
    return image;
  }

  function avatar(user) {
    var host = el('span', 'leaders-avatar');
    var image = el('img');
    image.src = user.avatar;
    image.alt = user.name;
    host.appendChild(image);
    return host;
  }

  function trend(value) {
    if (value == null) return el('span', 'leaders-trend leaders-trend--flat', '–');
    if (value === 0) return el('span', 'leaders-trend leaders-trend--flat', '0');
    var up = value > 0;
    var node = el('span', 'leaders-trend leaders-trend--' + (up ? 'up' : 'down'), (rankJump(value)));
    node.appendChild(icon(ICONS + (up ? 'caret-up.svg' : 'caret-down.svg'), 16));
    node.setAttribute('aria-label', (up ? 'Up ' : 'Down ') + Math.abs(value) + ' places');
    return node;
  }

  // the mock-up writes the big jumps with their sign and the small ones bare
  function rankJump(value) {
    var size = Math.abs(value);
    return value > 0 && size >= 100 ? '+' + size : String(size);
  }

  function score(points) {
    var node = el('span', 'leaders-score', BOARD.format(points));
    node.appendChild(icon(ICONS + 'crown.svg', 16));
    return node;
  }

  var MEDALS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

  function createRow(rank) {
    var user = userFor(rank);
    var medal = MEDALS[rank];
    var row = el('article', 'leaders-row' +
      (medal ? ' leaders-row--' + medal : '') +
      (user.isYou ? ' leaders-row--you' : ''));
    row.dataset.rank = String(rank);
    if (user.isYou) row.dataset.currentRank = 'true';

    var inner = el('div', 'leaders-row__inner');
    var who = el('span', 'leaders-row__who');
    who.appendChild(el('span', 'leaders-rank' + (medal ? ' leaders-rank--' + medal : ''), rank));
    who.appendChild(avatar(user));
    who.appendChild(el('strong', '', user.name));

    inner.appendChild(who);
    inner.appendChild(trend(trendFor(rank)));
    inner.appendChild(score(scoreFor(rank)));
    row.appendChild(inner);
    return row;
  }

  function createNeighbours(ranks) {
    var block = el('section', 'rankings-neighbours');
    block.setAttribute('aria-label', 'Your position');
    // the heading marks the jump in the ranks
    block.appendChild(el('p', 'rankings-neighbours__title', '•••'));
    ranks.forEach(function (rank) { block.appendChild(createRow(rank)); });
    return block;
  }

  var shape = BOARD.plan(PLAYER_COUNT, YOUR_RANK);
  var fragment = document.createDocumentFragment();
  shape.lead.forEach(function (rank) { fragment.appendChild(createRow(rank)); });

  if (!YOUR_RANK) {
    fragment.appendChild(el('p', 'rankings-neighbours__hint', 'Make your first pick to enter the leaderboard'));
  } else if (shape.neighbours.length) {
    fragment.appendChild(createNeighbours(shape.neighbours));
  }

  list.replaceChildren(fragment);
  list.dataset.userCount = String(PLAYER_COUNT);

  // The fixed plate at the bottom is the same row as yours in the list.
  if (YOUR_RANK) {
    var plate = createRow(YOUR_RANK);
    plate.removeAttribute('data-current-rank');
    pin.replaceChildren(plate);
  }


  /* =======================================================
     Top gainers

     A running feed: every couple of seconds somebody new slides
     in on the left and pushes the rest along. The pool repeats.
     ======================================================= */

  var track = document.querySelector('[data-leaders-gainers]');
  var GAINER_EVERY = 2400;
  var GAINER_KEEP = 6;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var gainerPool = [
    { name: 'Maya Chen', avatar: ICONS + 'gainer-1.jpg', points: 1089, rise: 1 },
    { name: 'Leo Brooks', avatar: ICONS + 'gainer-2.jpg', points: 1089, rise: 1 },
    { name: 'Sofia Patel', avatar: ICONS + 'gainer-3.jpg', points: 1089, rise: 1 },
    { name: 'Noah Kim', avatar: ICONS + 'user-4.jpg', points: 412, rise: 3 },
    { name: 'Ava Moretti', avatar: ICONS + 'user-5.jpg', points: 268, rise: 2 },
    { name: 'Ethan Hall', avatar: ICONS + 'user-6.jpg', points: 155, rise: 4 },
    { name: 'Mia Torres', avatar: ICONS + 'user-7.jpg', points: 640, rise: 6 },
    { name: 'Zara Volkov', avatar: ICONS + 'user-8.png', points: 92, rise: 1 },
    { name: 'Theo Rossi', avatar: ICONS + 'user-2.jpg', points: 330, rise: 2 },
    { name: 'Lina Costa', avatar: ICONS + 'user-3.jpg', points: 517, rise: 5 }
  ];
  var gainerNext = 0;

  function createGainer(person) {
    var card = el('article', 'leaders-gainer');
    card.appendChild(avatar(person));

    var copy = el('span', 'leaders-gainer__copy');
    copy.appendChild(el('strong', '', person.name));
    var stats = el('span', 'leaders-gainer__stats');
    var points = el('span', 'leaders-gainer__points', '+ ' + BOARD.format(person.points));
    points.appendChild(icon(ICONS + 'crown-sm.svg', 10));
    var rise = el('span', 'leaders-gainer__rise', '+' + person.rise);
    rise.appendChild(icon(ICONS + 'caret-up-sm.svg', 10));
    stats.appendChild(points);
    stats.appendChild(rise);
    copy.appendChild(stats);
    card.appendChild(copy);
    return card;
  }

  function takeGainer() {
    var person = gainerPool[gainerNext % gainerPool.length];
    gainerNext += 1;
    return person;
  }

  // Slide the whole strip right by the width of the newcomer, then let it ease
  // back to zero — the cards already there move along instead of jumping.
  function pushGainer() {
    if (!track) return;
    var card = createGainer(takeGainer());
    track.insertBefore(card, track.firstChild);
    while (track.children.length > GAINER_KEEP) track.removeChild(track.lastChild);
    if (still.matches) return;

    var shift = card.offsetWidth + 8;
    track.style.transition = 'none';
    track.style.transform = 'translate3d(' + -shift + 'px,0,0)';
    void track.offsetWidth;
    track.style.transition = 'transform .5s cubic-bezier(.2, .8, .3, 1)';
    track.style.transform = '';
    card.classList.add('is-new');
  }

  var gainerTimer = null;
  function startGainers() {
    if (gainerTimer || !track) return;
    gainerTimer = setInterval(pushGainer, GAINER_EVERY);
  }
  function stopGainers() {
    clearInterval(gainerTimer);
    gainerTimer = null;
  }

  // Newest on the left: lay the first three down in the order of the mock-up.
  if (track) {
    var opening = document.createDocumentFragment();
    for (var g = 0; g < 3; g += 1) opening.appendChild(createGainer(takeGainer()));
    track.replaceChildren(opening);
  }


  /* =======================================================
     Season countdown
     ======================================================= */

  var timerParts = {};
  document.querySelectorAll('[data-leaders-timer-part]').forEach(function (part) {
    timerParts[part.dataset.leadersTimerPart] = part;
  });
  var SEASON_LEFT = ((10 * 24 + 15) * 60 + 39) * 60 + 39;   // 10d 15h 39m 39s
  var seasonEnds = Date.now() + SEASON_LEFT * 1000;

  function pad(value) { return value < 10 ? '0' + value : String(value); }

  function tickTimer() {
    var left = Math.max(0, Math.round((seasonEnds - Date.now()) / 1000));
    if (timerParts.d) timerParts.d.textContent = pad(Math.floor(left / 86400));
    if (timerParts.h) timerParts.h.textContent = pad(Math.floor(left / 3600) % 24);
    if (timerParts.m) timerParts.m.textContent = pad(Math.floor(left / 60) % 60);
    if (timerParts.s) timerParts.s.textContent = pad(left % 60);
  }
  tickTimer();
  setInterval(tickTimer, 1000);


  /* =======================================================
     Prizes — a bottom sheet; its contents are designed later
     ======================================================= */

  var prizes = document.querySelector('[data-leaders-prizes]');
  var sheet = document.querySelector('[data-leaders-sheet]');

  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    if (prizes) prizes.focus();
  }
  if (prizes && sheet) {
    prizes.addEventListener('click', function () {
      sheet.hidden = false;
      var close = sheet.querySelector('[data-leaders-sheet-close]');
      if (close) close.focus();
    });
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet || event.target.closest('[data-leaders-sheet-close]')) closeSheet();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeSheet();
    });
  }


  /* =======================================================
     Your plate
     ======================================================= */

  var currentRow = list.querySelector('[data-current-rank]');
  var updateQueued = false;
  var pinTopOffset;

  function updatePin() {
    updateQueued = false;
    if (!currentRow || !screen.classList.contains('is-active')) {
      pin.classList.remove('is-row-visible');
      return;
    }
    var rowRect = currentRow.getBoundingClientRect();
    var scrollRect = scroll.getBoundingClientRect();
    if (!pin.classList.contains('is-row-visible')) {
      pinTopOffset = scrollRect.bottom - pin.getBoundingClientRect().top;
    }

    // Once the current row reaches the fixed card, keep the card hidden below it.
    // It reappears only when the user scrolls back up and the row moves below it.
    var pinTop = scrollRect.bottom - pinTopOffset;
    var rowHasReachedPin = rowRect.top <= pinTop;
    pin.classList.toggle('is-row-visible', rowHasReachedPin);
  }

  function schedulePinUpdate() {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(updatePin);
  }


  // The whole page scrolls as one: the hero goes up with the list.
  scroll.addEventListener('scroll', schedulePinUpdate, { passive: true });
  window.addEventListener('resize', schedulePinUpdate);
  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'rankings') {
      stopGainers();
      closeSheet();
      return;
    }
    // Rankings always opens at the top, however far the list was scrolled
    // last time — otherwise the section reappears somewhere in the middle.
    scroll.scrollTop = 0;
    pin.classList.remove('is-row-visible');
    schedulePinUpdate();
    startGainers();
  });
  schedulePinUpdate();
  if (screen.classList.contains('is-active')) startGainers();
})();
