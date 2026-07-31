/* THE90 — Global leaderboard with 100 users */
(function () {
  'use strict';

  var list = document.querySelector('[data-rankings-list]');
  var scroll = document.querySelector('[data-rankings-scroll]');
  var pin = document.querySelector('[data-rankings-pin]');
  var screen = document.querySelector('[data-screen="rankings"]');
  var scopeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-ranking-scope]'));
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

  function scoreFor(rank) {
    if (rank === 4) return 89;
    if (rank === 5) return 88;
    if (rank === 6) return 87;
    if (rank < 47) return Math.max(3, 87 - Math.round((rank - 6) * 84 / 40));
    if (rank <= 64) return 2;
    if (rank <= 82) return 1;
    return 0;
  }

  function generatedUser(rank) {
    if (rank === 47) {
      return { name: 'Your Name', handle: '@yournickname', avatar: 'assets/img/avatar.png', isYou: true };
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
    score.textContent = scoreFor(rank) + ' ';
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

  var fragment = document.createDocumentFragment();
  for (var rank = 4; rank <= 100; rank += 1) fragment.appendChild(createRow(rank));
  list.replaceChildren(fragment);
  list.dataset.userCount = '100';

  scopeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var leaguesActive = button.dataset.rankingScope === 'leagues';
      scopeButtons.forEach(function (item) {
        var active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      scroll.classList.toggle('is-leagues', leaguesActive);
      pin.classList.toggle('is-scope-hidden', leaguesActive);
      pin.classList.remove('is-row-visible');
      scroll.scrollTop = 0;
      schedulePinUpdate();
    });
  });

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

  scroll.addEventListener('scroll', schedulePinUpdate, { passive: true });
  window.addEventListener('resize', schedulePinUpdate);
  window.addEventListener('the90:screen', function (event) {
    if (event.detail === 'rankings') schedulePinUpdate();
  });
  schedulePinUpdate();
})();
