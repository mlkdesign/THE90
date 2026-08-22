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
  var sticky = strip.closest('.league-tabs-sticky');

  /* The block covers the top only once it has arrived there. Measured from
     where it actually is rather than from offsetTop: the negative margin that
     pulls it up puts those two numbers 78px apart. */
  function updateStuck() {
    if (!sticky || !scroll) return;
    var frame = scroll.getBoundingClientRect();
    sticky.classList.toggle('is-stuck', sticky.getBoundingClientRect().top - frame.top < 1);
  }
  if (scroll) scroll.addEventListener('scroll', updateStuck, { passive: true });

  /* Where the strip comes to rest — the scroll position at which it reaches
     the top of the screen. Read from the panels that follow it rather than
     from the strip itself: offsetTop on a stuck block reports where it is
     being held, not where it belongs. */
  function pinOffset() {
    var host = panels[0].parentNode;
    if (!host || !sticky) return 0;
    var gap = parseFloat(window.getComputedStyle(host.parentNode).rowGap) || 0;
    return Math.max(0, host.offsetTop - gap - sticky.offsetHeight);
  }

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
      /* A tab change lands on the beginning of the new tab: if the page is
         already past the strip it comes back to it, so the content starts
         right under the tabs instead of somewhere in its middle. */
      if (scroll && sticky) {
        var pin = pinOffset();
        if (scroll.scrollTop > pin) scroll.scrollTop = pin;
      }
      updateStuck();
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
  window.requestAnimationFrame(function () { moveIndicator(); updateStuck(); });
})();
