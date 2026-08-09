/* =========================================================
   THE90 — rank ladder
   Owns both the plate on My Zone and the ladder screen behind
   it, so the percentage and the "N points to Master" line can
   never drift apart from the rungs they describe.
   ========================================================= */

(function () {
  'use strict';

  var list = document.querySelector('[data-ranks-list]');
  var plate = document.querySelector('[data-rank-plate]');
  var labels = Array.prototype.slice.call(document.querySelectorAll('[data-rank-label]'));
  if (!list && !plate && !labels.length) return;

  // Highest first — the same order the ladder is read in.
  var RANKS = [
    { id: 'grandmaster', name: 'Grandmaster', from: 5000, range: '5 000+',
      perk: 'Grandmaster title + Hall of Fame' },
    { id: 'master', name: 'Master', from: 2000, range: '2 000+',
      perk: 'Master title, custom profile background' },
    { id: 'diamond', name: 'Diamond', from: 900, range: '900–1 999',
      perk: 'Diamond stickers, custom emoji, profile frame' },
    { id: 'platinum', name: 'Platinum', from: 400, range: '400–899',
      perk: 'Platinum themes, head-to-head' },
    { id: 'gold', name: 'Gold', from: 150, range: '150–399',
      perk: 'Gold sticker packs, premium frames, league boost' },
    { id: 'silver', name: 'Silver', from: 50, range: '50–149',
      perk: 'Silver themes, weekly tournaments' },
    { id: 'bronze', name: 'Bronze', from: 10, range: '10–49',
      perk: 'Bronze stickers, basic frames' }
  ];

  // Same number the global board puts you on at rank 47.
  var POINTS = 1520;

  /* Inline rather than <img> so a single glyph can be green when it is your
     rank and grey when it is out of reach. */
  var GLYPHS = {
    grandmaster: 'M12 2l1.6 3.4L17 6l-2.2 2.6.4 3.4-3.2-1.4L8.8 12l.4-3.4L7 6l3.4-.6zM4 14l3.4 2.2L12 10l4.6 6.2L20 14l-1.8 8H5.8z',
    master: 'M3 8l4.6 3.2L12 4l4.4 7.2L21 8l-2 12H5zm2 14h14v2H5z',
    diamond: 'M12 2l7 7-7 13-7-13zm0 3.4L7.3 9.2 12 17.9l4.7-8.7z',
    platinum: 'M12 2l8 3v6.4c0 4.6-3.2 8.5-8 10.6-4.8-2.1-8-6-8-10.6V5z',
    gold: 'M12 2l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 16.9 5.9 20.3l1.4-6.7-5-4.6 6.8-.8z',
    silver: 'M12 2l8.7 5v10L12 22l-8.7-5V7zm0 6a4 4 0 100 8 4 4 0 000-8z',
    bronze: 'M12 2l8.7 5v10L12 22l-8.7-5V7z'
  };
  var CHECK = 'M9.5 16.6l-4-4L4 14l5.5 5.5L20 9 18.6 7.6z';
  var LOCK = 'M17 9h-1V7a4 4 0 10-8 0v2H7a1.6 1.6 0 00-1.6 1.6v8.8A1.6 1.6 0 007 21h10a1.6 1.6 0 001.6-1.6v-8.8A1.6 1.6 0 0017 9zm-7-2a2 2 0 114 0v2h-4z';

  function currentIndex() {
    for (var i = 0; i < RANKS.length; i += 1) {
      if (POINTS >= RANKS[i].from) return i;
    }
    return RANKS.length - 1;   // below Bronze you are still on the bottom rung
  }

  var index = currentIndex();
  var current = RANKS[index];
  var next = index > 0 ? RANKS[index - 1] : null;   // the ladder runs downwards

  function svg(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="' + path + '" fill="currentColor"/></svg>';
  }

  function format(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }


  // The rank name in the status header comes from the same model as the ladder,
  // so the crown next to the avatar always means what the ladder says it means.
  labels.forEach(function (label) { label.textContent = current.name; });


  /* =======================================================
     Plate on My Zone
     ======================================================= */

  if (plate) {
    var ceiling = next ? next.from : current.from;
    var span = ceiling - current.from;
    var progress = span > 0 ? Math.min(1, (POINTS - current.from) / span) : 1;

    var points = plate.querySelector('[data-level-points]');
    if (points) points.textContent = format(POINTS);

    var goal = plate.querySelector('[data-level-goal]');
    if (goal) goal.textContent = next ? '/' + format(next.from) : '';

    var bar = plate.querySelector('[data-level-bar]');
    if (bar) bar.style.width = Math.max(4, Math.round(progress * 100)) + '%';

    var upcoming = plate.querySelector('[data-level-next]');
    if (upcoming) upcoming.textContent = next ? next.name : 'Max';

    plate.setAttribute('aria-label',
      current.name + ' level, ' + format(POINTS) + ' points. Open the level ladder');
  }


  /* =======================================================
     Ladder screen
     ======================================================= */

  if (!list) return;

  function stateOf(i) {
    if (i === index) return 'current';
    if (i > index) return 'passed';        // lower on the ladder = already cleared
    if (i === index - 1) return 'locked';  // the one you are working towards
    return 'far';
  }

  function iconFor(rank, state) {
    if (state === 'passed') return svg(CHECK);
    if (state === 'locked') return svg(LOCK);
    return svg(GLYPHS[rank.id]);
  }

  function createRow(rank, state) {
    var row = document.createElement('article');
    row.className = 'rank-row rank-row--' + state;

    var icon = document.createElement('span');
    icon.className = 'rank-row__icon';
    icon.innerHTML = iconFor(rank, state);

    var copy = document.createElement('span');
    copy.className = 'rank-row__copy';

    var title = document.createElement('span');
    title.className = 'rank-row__name';
    title.appendChild(document.createTextNode(rank.name));
    if (state === 'current') {
      var here = document.createElement('b');
      here.className = 'rank-row__here';
      here.textContent = 'You are here';
      title.appendChild(here);
    }

    var perk = document.createElement('span');
    perk.className = 'rank-row__perk';
    perk.textContent = rank.perk;

    copy.appendChild(title);
    copy.appendChild(perk);

    var range = document.createElement('span');
    range.className = 'rank-row__range';
    range.textContent = rank.range;

    row.appendChild(icon);
    row.appendChild(copy);
    row.appendChild(range);
    return row;
  }

  var fragment = document.createDocumentFragment();
  RANKS.forEach(function (rank, i) { fragment.appendChild(createRow(rank, stateOf(i))); });
  list.replaceChildren(fragment);
})();
