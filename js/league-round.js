/* =========================================================
   THE90 — the round pinned in the league chat

   Which round the league is on, and how long is left before it
   opens. The dial fills as the wait runs down; tapping it goes
   through to the picks the round is about, with the tabs
   already at the top of the screen so the picks are the first
   thing there.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  var block = document.querySelector('[data-league-round]');
  var ring = document.querySelector('[data-league-round-ring]');
  var clock = document.querySelector('[data-league-round-time]');
  var current = document.querySelector('[data-league-round-current]');
  var total = document.querySelector('[data-league-round-total]');
  if (!block || !ring || !clock) return;

  var ROUND = 3;
  var ROUNDS = 5;
  var WAIT = 15 * 60;        // the gap between rounds, in seconds
  var remaining = 4 * 60 + 16;

  var radius = parseFloat(ring.getAttribute('r')) || 19;
  var circumference = 2 * Math.PI * radius;
  ring.style.strokeDasharray = circumference.toFixed(2);

  if (current) current.textContent = ROUND;
  if (total) total.textContent = ROUNDS;

  function paint() {
    var minutes = Math.floor(remaining / 60);
    var seconds = remaining % 60;
    clock.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    // full circle when the wait is over, empty when it has only just begun
    var done = 1 - Math.min(1, remaining / WAIT);
    ring.style.strokeDashoffset = (circumference * (1 - done)).toFixed(2);
    block.setAttribute('aria-label',
      'Round ' + ROUND + ' of ' + ROUNDS + ', starts in ' + clock.textContent +
      '. Opens the daily picks.');
  }

  paint();

  var ticking = null;
  function tick() {
    if (remaining <= 0) {
      window.clearInterval(ticking);
      ticking = null;
      return;
    }
    remaining -= 1;
    paint();
  }

  /* Only while the chat is the screen you are on — a countdown running in a
     room nobody is looking at is work for nothing. */
  window.addEventListener('the90:screen', function (event) {
    var here = event.detail === 'league-chat';
    if (here && !ticking) ticking = window.setInterval(tick, 1000);
    if (!here && ticking) { window.clearInterval(ticking); ticking = null; }
  });

  /* The same slide the i does, and the picks are waiting at the top of it. */
  block.addEventListener('click', function () {
    if (!T) return;
    function open() { if (T.leagueTabs) T.leagueTabs.open('picks', { pinned: true }); }
    if (T.leaguePage) T.leaguePage.go('league', open);
    else if (T.go) { T.go('league'); open(); }
  });
})();
