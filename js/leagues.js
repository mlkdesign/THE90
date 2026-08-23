/* =========================================================
   THE90 — the Leagues shelves

   One screen, two shelves: the leagues you were invited into
   and the ones you run yourself. Same cards on both, so the
   tab only decides which stack is on show.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  var main = document.querySelector('.theleagues-content');

  var tabs = Array.prototype.slice.call(main ? main.querySelectorAll('[data-leagues-tab]') : []);
  var panels = Array.prototype.slice.call(main ? main.querySelectorAll('[data-leagues-panel]') : []);
  if (!tabs.length || !panels.length) return;

  function show(name) {
    tabs.forEach(function (tab) {
      var on = tab.dataset.leaguesTab === name;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.leaguesPanel !== name;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { show(tab.dataset.leaguesTab); });
  });

  // creating a league should land you on the shelf it went to
  if (T) T.leaguesTab = show;
})();
