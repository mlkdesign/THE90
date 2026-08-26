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

  /* What the ... offers depends on whose league it is. Running one and being
     in one are two different jobs, and the menu is where that shows. */
  var viewing = { own: false, league: null };

  document.addEventListener('the90:league-membership', function (event) {
    viewing = event.detail || viewing;
    close();
  });

  function isOpen() { return !!(viewing.league && viewing.league.privacy === 'open'); }

  function actions() {
    var share = {
      label: 'Share invite',
      // the invite link is built and copied by the same handler the
      // Invite friend button goes through
      share: true
    };
    var leave = {
      label: 'Leave league',
      danger: true,
      run: function () {
        ask('Leave ' + leagueName() + '?',
          'You drop off its board and lose the chat. You can be invited back.',
          'Leave league', function () { if (T && T.go) T.go('leagues'); });
      }
    };

    if (!viewing.own) {
      // a member of a private league has nobody to invite
      return isOpen() ? [share, leave] : [leave];
    }

    /* Rounds are parked along with the picks tab they are played on, so the
       way in to managing them is parked too. */
    return [
      { label: 'Edit league', run: function () {
        if (T && T.ownLeagues && viewing.index > -1) T.ownLeagues.edit(viewing.index);
        if (T && T.go) T.go('league-create');
      } },
      { label: 'Manage participants', run: function () { if (T && T.go) T.go('league-participants'); } },
      share,
      { label: 'Delete league', danger: true, run: function () {
        ask('Delete ' + leagueName() + '?',
          'The league, its board and its chat go with it. This cannot be undone.',
          'Delete league', function () {
            if (T && T.ownLeagues && viewing.index > -1) T.ownLeagues.remove(viewing.index);
            if (T && T.go) T.go('leagues');
          });
      } }
    ];
  }

  function build() {
    var box = document.createElement('div');
    box.className = 'league-sheet';
    box.setAttribute('role', 'menu');
    actions().forEach(function (action) {
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
