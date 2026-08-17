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


  /* =======================================================
     Leagues you have walked away from

     Leaving one of the invited leagues takes its card off the
     shelf. Remembered by name so it stays gone across reloads.
     ======================================================= */

  var LEFT_KEY = 'the90.leftLeagues.v1';

  function loadLeft() {
    try { return JSON.parse(localStorage.getItem(LEFT_KEY)) || []; }
    catch (error) { return []; }
  }

  var left = loadLeft();

  function nameOf(card) {
    var title = card.querySelector('.lcard__title strong');
    return title ? title.textContent.trim() : '';
  }

  function applyLeft() {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-leagues-panel="joined"] .lcard'),
      function (card) { card.hidden = left.indexOf(nameOf(card)) > -1; }
    );
  }
  applyLeft();

  function leave(card) {
    var name = nameOf(card);
    if (left.indexOf(name) === -1) left.push(name);
    try { localStorage.setItem(LEFT_KEY, JSON.stringify(left)); }
    catch (error) { /* storage may be unavailable */ }
    applyLeft();
  }


  /* =======================================================
     The ... on a card

     What it offers depends on whose league it is: yours is
     something you can change or take down, someone else's is
     something you can only walk out of.
     ======================================================= */

  var openSheet = null;

  function closeSheet() {
    if (!openSheet) return;
    var owner = openSheet.parentNode && openSheet.parentNode.querySelector('[data-lcard-menu]');
    if (owner) owner.setAttribute('aria-expanded', 'false');
    openSheet.remove();
    openSheet = null;
  }

  function isOwn(card) {
    var open = card.querySelector('.lcard__open');
    return !!open && open.dataset.leagueOwn === 'true';
  }

  // own cards are rendered from the stored list, in order
  function ownIndex(card) {
    var cards = document.querySelectorAll('[data-own-leagues] .lcard');
    return Array.prototype.indexOf.call(cards, card);
  }

  function actionsFor(card) {
    if (!isOwn(card)) {
      return [{
        label: 'Leave league',
        danger: true,
        run: function () {
          T.confirm('Leave ' + nameOf(card) + '?',
            'You will drop off its board and lose access to the chat. You can be invited back.',
            'Leave league', function () { leave(card); });
        }
      }];
    }
    var index = ownIndex(card);
    return [
      {
        label: 'Edit league',
        run: function () {
          if (T.ownLeagues) T.ownLeagues.edit(index);
          if (T.go) T.go('league-create');
        }
      },
      { label: 'Premium league', sheet: 'premium' },
      {
        label: 'Delete league',
        danger: true,
        run: function () {
          T.confirm('Delete ' + nameOf(card) + '?',
            'The league, its board and its chat go with it. This cannot be undone.',
            'Delete league', function () {
              if (T.ownLeagues) T.ownLeagues.remove(index);
            });
        }
      }
    ];
  }

  function buildSheet(card) {
    var sheet = document.createElement('div');
    sheet.className = 'lcard__sheet';
    sheet.setAttribute('role', 'menu');
    actionsFor(card).forEach(function (action) {
      var item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.textContent = action.label;
      if (action.danger) item.className = 'is-danger';
      // the settings sheets have their own opener in settings.js
      if (action.sheet) item.dataset.settingsSheet = action.sheet;
      if (action.run) item.addEventListener('click', action.run);
      sheet.appendChild(item);
    });
    card.appendChild(sheet);
    return sheet;
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-lcard-menu]');
    if (trigger) {
      var card = trigger.closest('.lcard');
      var wasOpen = openSheet && openSheet.parentNode === card;
      closeSheet();
      if (!wasOpen) {
        openSheet = buildSheet(card);
        trigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    // anything else — including an item in the sheet — puts it away
    closeSheet();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeSheet();
  });

  window.addEventListener('the90:screen', closeSheet);
})();
