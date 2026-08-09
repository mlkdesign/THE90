/* =========================================================
   THE90 — the round inside a league

   The same daily picks as Main, laid out as a horizontal
   swipe above the participant board. A league slip is its own
   thing: what you pick here does not touch the global slip.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;

  var section = document.querySelector('[data-league-picks]');
  var track = document.querySelector('[data-league-picks-track]');
  if (!section || !track || !T.pickCard) return;

  var calendar = T.buildCalendar();
  var today = calendar.filter(function (d) { return d.isToday; })[0];
  var matches = today.matches;

  var picks = {};
  matches.forEach(function (m) { picks[m.id] = T.pickCard.blank(); });

  matches.forEach(function (m) {
    track.appendChild(T.pickCard.create(m, picks[m.id], { when: 'Today' }));
  });

  T.pickCard.countdown(document.querySelector('[data-league-deadline]'));


  /* =======================================================
     Drag, for the desktop mockup — touch scrolls natively
     ======================================================= */

  var dragX = 0, dragFrom = 0, dragging = false, moved = false;

  function step() {
    var first = track.firstElementChild;
    if (!first) return 1;
    var second = first.nextElementSibling;
    return Math.max(1, second ? second.offsetLeft - first.offsetLeft : first.offsetWidth);
  }

  track.addEventListener('pointerdown', function (event) {
    // never start a drag on a control — the steppers need their clicks
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.target.closest('button, input')) return;
    dragging = true;
    moved = false;
    dragX = event.clientX;
    dragFrom = track.scrollLeft;
    track.setPointerCapture(event.pointerId);
  });

  track.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    var delta = event.clientX - dragX;
    if (Math.abs(delta) > 4) moved = true;
    track.scrollLeft = dragFrom - delta;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    var pitch = step();
    track.scrollTo({ left: Math.round(track.scrollLeft / pitch) * pitch, behavior: 'smooth' });
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('click', function (event) {
    if (!moved) return;
    moved = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);


  /* =======================================================
     There is nothing to pick until you have joined
     ======================================================= */

  document.addEventListener('the90:league-membership', function (event) {
    section.hidden = !event.detail.joined;
    if (!section.hidden) track.scrollLeft = 0;
  });
})();
