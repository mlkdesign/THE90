/* =========================================================
   THE90 — the ... on a league

   The three things you can do to a league from inside it:
   take it down, pass it on, or walk out. Two of them cannot
   be taken back, so both ask first.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  var screen = document.querySelector('[data-screen="league"]');
  var trigger = screen && screen.querySelector('[data-league-menu]');
  if (!screen || !trigger) return;

  var name = screen.querySelector('.league-summary h1');
  var sheet = null;

  function leagueName() {
    return name && name.textContent.trim() ? name.textContent.trim() : 'this league';
  }

  function close() {
    if (!sheet) return;
    sheet.remove();
    sheet = null;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function ask(title, body, cta, done) {
    if (T && T.confirm) T.confirm(title, body, cta, done);
    else done();
  }

  var ACTIONS = [
    {
      label: 'Delete league',
      danger: true,
      run: function () {
        ask('Delete ' + leagueName() + '?',
          'The league, its board and its chat go with it. This cannot be undone.',
          'Delete league', function () { if (T && T.go) T.go('leagues'); });
      }
    },
    {
      label: 'Share league',
      // the invite link is built and copied by the same handler the
      // Invite friend button goes through
      share: true
    },
    {
      label: 'Leave league',
      danger: true,
      run: function () {
        ask('Leave ' + leagueName() + '?',
          'You drop off its board and lose the chat. You can be invited back.',
          'Leave league', function () { if (T && T.go) T.go('leagues'); });
      }
    }
  ];

  function build() {
    var box = document.createElement('div');
    box.className = 'league-sheet';
    box.setAttribute('role', 'menu');
    ACTIONS.forEach(function (action) {
      var item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.textContent = action.label;
      if (action.danger) item.className = 'is-danger';
      if (action.share) item.dataset.shareLeague = '';
      if (action.run) item.addEventListener('click', action.run);
      box.appendChild(item);
    });
    trigger.parentNode.appendChild(box);
    return box;
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-league-menu]')) {
      var wasOpen = !!sheet;
      close();
      if (!wasOpen) {
        sheet = build();
        trigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    // anything else — including an item in the sheet — puts it away
    close();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') close();
  });

  window.addEventListener('the90:screen', close);
})();
