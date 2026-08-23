/* THE90 — Global leaderboard: top 20, then your position with its neighbours */
(function () {
  'use strict';

  var BOARD = window.THE90.board;
  var PLAYER_COUNT = 100;
  var YOUR_RANK = 47;
  var PODIUM_COUNT = 3;      // ranks 1–3 live on the podium, not in the list

  var list = document.querySelector('[data-rankings-list]');
  var scroll = document.querySelector('[data-rankings-scroll]');
  var pin = document.querySelector('[data-rankings-pin]');
  var screen = document.querySelector('[data-screen="rankings"]');
  var podium = document.querySelector('.rankings-podium');
  if (!list || !scroll || !pin || !screen) return;

  var firstNames = [
    'Noah', 'Emma', 'Liam', 'Olivia', 'Mateo', 'Ava', 'Lucas', 'Mia', 'Ethan', 'Sofia',
    'Daniel', 'Isla', 'Owen', 'Amara', 'Theo', 'Lina', 'Adam', 'Nora', 'Hugo', 'Maya'
  ];
  var lastNames = [
    'Bennett', 'Silva', 'Kowalski', 'Dubois', 'Rossi', 'Martinez', 'Johansson', 'Ibrahim',
    'Novak', 'Costa', 'Kim', 'Muller', 'Popescu', 'Santos', 'Wilson', 'Nielsen', 'Yilmaz',
    'Petrov', 'Garcia', 'Mensah'
  ];
  var avatars = [
    'assets/invite/avatar-zara.png',
    'assets/invite/avatar-kai.png',
    'assets/support/banner-person.png',
    'assets/invite/profile-person.png',
    'assets/invite/screen-person.png'
  ];
  var known = {
    4: { name: 'Zara Volkov', handle: '@zarav' },
    5: { name: 'Kai Tanaka', handle: '@kait' },
    6: { name: 'Nina Okafor', handle: '@ninao' },
    7: { name: 'Sam Moreau', handle: '@samm' },
    8: { name: 'Juno Park', handle: '@junop' },
    9: { name: 'Ravi Patel', handle: '@ravip' },
    10: { name: 'Liam Becker', handle: '@liamb' }
  };

  /* Season points, strictly decreasing. The old scale handed whole blocks of
     players the same 2 points, which made "N points to pass" meaningless.
     The decay is tuned so rank 47 lands on the 1 520 shown in My Zone. */
  var TOP_SCORE = 2480;
  var DECAY = 0.98942;

  function scoreFor(rank) {
    return Math.round(TOP_SCORE * Math.pow(DECAY, rank - 1));
  }

  function generatedUser(rank) {
    if (rank === YOUR_RANK) {
      return { name: 'Your Name', handle: '@yournickname', avatar: 'assets/my-zone/avatar.png', isYou: true };
    }
    if (known[rank]) {
      return Object.assign({ avatar: avatars[(rank - 4) % avatars.length] }, known[rank]);
    }
    var index = rank - 4;
    var first = firstNames[index % firstNames.length];
    var last = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    return {
      name: first + ' ' + last,
      handle: '@' + first.toLowerCase() + last.toLowerCase().slice(0, 3) + rank,
      avatar: avatars[index % avatars.length]
    };
  }

  function createRow(rank) {
    var user = generatedUser(rank);
    var row = document.createElement('article');
    row.className = 'rankings-row' + (user.isYou ? ' rankings-row--you' : '');
    row.dataset.rank = String(rank);
    if (user.isYou) row.dataset.currentRank = 'true';

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

    var score = document.createElement('span');
    score.className = 'rankings-score';
    score.textContent = BOARD.format(scoreFor(rank)) + ' ';
    var crown = document.createElement('img');
    crown.src = 'assets/notifications/crown.svg';
    crown.alt = '';
    crown.width = 14;
    crown.height = 12;
    score.appendChild(crown);

    row.appendChild(position);
    row.appendChild(avatar);
    row.appendChild(copy);
    row.appendChild(score);
    return row;
  }

  function createNeighbours(ranks) {
    var block = document.createElement('section');
    block.className = 'rankings-neighbours';
    block.setAttribute('aria-label', 'Your position');

    // this heading is what marks the jump in the ranks — it replaces the
    // row of dots that used to sit here
    var title = document.createElement('p');
    title.className = 'rankings-neighbours__title';
    title.textContent = '•••';
    block.appendChild(title);

    ranks.forEach(function (rank) { block.appendChild(createRow(rank)); });
    return block;
  }

  // Shown instead of the neighbours block when there is no position yet.
  function createUnranked() {
    var block = document.createElement('p');
    block.className = 'rankings-neighbours__hint';
    block.textContent = 'Make your first pick to enter the leaderboard';
    return block;
  }

  var shape = BOARD.plan(PLAYER_COUNT, YOUR_RANK);
  var fragment = document.createDocumentFragment();

  shape.lead.forEach(function (rank) {
    if (rank > PODIUM_COUNT) fragment.appendChild(createRow(rank));
  });

  if (!YOUR_RANK) {
    fragment.appendChild(createUnranked());
  } else if (shape.neighbours.length) {
    fragment.appendChild(createNeighbours(shape.neighbours));
  }

  list.replaceChildren(fragment);
  list.dataset.userCount = String(PLAYER_COUNT);

  // Keep the fixed card at the bottom telling the same story as the rows.
  (function fillPin() {
    if (!YOUR_RANK) return;
    var rankCell = pin.querySelector('.rankings-pin__rank');
    var scoreCell = pin.querySelector('.rankings-score');
    if (rankCell) rankCell.textContent = YOUR_RANK;
    if (!scoreCell) return;
    scoreCell.textContent = BOARD.format(scoreFor(YOUR_RANK)) + ' ';
    var crown = document.createElement('img');
    crown.src = 'assets/notifications/crown.svg';
    crown.alt = '';
    crown.width = 14;
    crown.height = 12;
    scoreCell.appendChild(crown);
  })();

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

  // Replays the podium slide-up from the bottom on every visit to Rankings.
  function playPodium() {
    if (!podium) return;
    podium.classList.remove('is-entering');
    void podium.offsetWidth;
    podium.classList.add('is-entering');
  }


  /* =======================================================
     Parallax

     The top three sit on a block that only travels half as
     far as the page does, so it appears to rise slowly while
     the leaderboard climbs over it. The shade that covers the
     podium belongs to the list, not to the hero, so it arrives
     with the ranks rather than staying put (see rankings.css).

     Written straight from the scroll handler rather than from a
     frame callback: a parallax that lags the scroll by a frame
     is exactly the wobble it is supposed to avoid.
     ======================================================= */

  var hero = document.querySelector('.rankings-hero');
  var RATE = .5;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  function parallax() {
    if (!hero) return;
    var drift = still.matches ? 0 : Math.max(0, scroll.scrollTop) * RATE;
    hero.style.transform = drift ? 'translate3d(0,' + drift.toFixed(2) + 'px,0)' : '';
  }

  scroll.addEventListener('scroll', function () {
    parallax();
    schedulePinUpdate();
  }, { passive: true });
  window.addEventListener('resize', function () {
    parallax();
    schedulePinUpdate();
  });
  if (still.addEventListener) still.addEventListener('change', parallax);
  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'rankings') return;
    // Top Leaders always opens on the podium, however far the list was scrolled
    // last time — otherwise the section reappears somewhere in the middle.
    scroll.scrollTop = 0;
    parallax();
    pin.classList.remove('is-row-visible');
    schedulePinUpdate();
    playPodium();
  });
  parallax();
  schedulePinUpdate();
  if (screen.classList.contains('is-active')) playPodium();
})();
