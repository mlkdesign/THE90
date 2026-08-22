/* =========================================================
   THE90 — the tabs inside a league

   Daily picks, Participants, Prizes, Rules. The same control
   the tournament uses, without its drag pager: here a tab is
   a switch, not a swipe.
   ========================================================= */

(function () {
  'use strict';

  var screen = document.querySelector('[data-screen="league"]');
  if (!screen) return;

  var strip = screen.querySelector('[data-league-tabs]');
  var indicator = screen.querySelector('[data-league-tab-indicator]');
  var buttons = Array.prototype.slice.call(screen.querySelectorAll('[data-league-tab]'));
  var panels = Array.prototype.slice.call(screen.querySelectorAll('[data-league-panel]'));
  var scroll = screen.querySelector('[data-league-scroll]');
  if (!strip || !buttons.length || !panels.length) return;

  var active = 'picks';

  function moveIndicator() {
    if (!indicator) return;
    var button = buttons.filter(function (b) { return b.dataset.leagueTab === active; })[0];
    if (!button) return;
    indicator.style.width = button.offsetWidth + 'px';
    indicator.style.transform = 'translate3d(' + button.offsetLeft + 'px, 0, 0)';
  }

  function show(name) {
    active = name;
    buttons.forEach(function (button) {
      var on = button.dataset.leagueTab === name;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.leaguePanel !== name;
    });
    moveIndicator();
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      show(button.dataset.leagueTab);
      // keep the tab strip in view — switching to a short tab otherwise
      // leaves you looking at whitespace further down the page
      if (!scroll) return;
      var stripTop = strip.closest('.league-tabs-sticky');
      if (!stripTop) return;
      var frame = scroll.getBoundingClientRect();
      var scale = frame.width / scroll.offsetWidth || 1;
      var delta = (stripTop.getBoundingClientRect().top - frame.top) / scale - 78;
      if (delta < 0) scroll.scrollTo({ top: scroll.scrollTop + delta, behavior: 'smooth' });
    });
  });

  window.addEventListener('resize', moveIndicator);
  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'league') return;
    // a league always opens on its picks
    show('picks');
    window.requestAnimationFrame(moveIndicator);
  });

  show('picks');
  window.requestAnimationFrame(moveIndicator);
})();
