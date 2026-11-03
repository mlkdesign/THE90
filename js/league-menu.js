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
  try { viewing = JSON.parse(localStorage.getItem('the90.viewingLeague.v1')) || viewing; } catch (error) { /* storage may be unavailable */ }

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
      var report = { label: 'Report league', run: reportLeague };
      return isOpen() ? [share, report, leave] : [report, leave];
    }

    /* Running rounds is what Premium buys, so the way in to it is only on the
       menu of a league that has it. */
    var items = [
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

    if (viewing.premium) {
      items.splice(1, 0,
        { label: 'Manage rounds', run: function () { if (T && T.go) T.go('league-rounds'); } });
    }
    return items;
  }

  var reportDialog = document.createElement('dialog');
  reportDialog.className = 'league-report';
  reportDialog.setAttribute('aria-modal', 'true');
  reportDialog.setAttribute('aria-labelledby', 'league-report-title');
  reportDialog.innerHTML = '<h2 id="league-report-title">Report this league?</h2><p data-report-name></p><div class="league-report__actions"><button type="button" data-report-cancel>Cancel</button><button type="button" data-report-confirm>Report league</button></div>';
  screen.appendChild(reportDialog);
  var reported = false;
  function reportLeague() {
    close();
    reported = false;
    reportDialog.querySelector('h2').textContent = 'Report this league?';
    reportDialog.querySelector('[data-report-name]').textContent = leagueName();
    reportDialog.querySelector('[data-report-confirm]').hidden = false;
    reportDialog.querySelector('[data-report-cancel]').textContent = 'Cancel';
    reportDialog.showModal();
    reportDialog.querySelector('[data-report-cancel]').focus();
  }
  reportDialog.querySelector('[data-report-cancel]').addEventListener('click', function () { reportDialog.close(); });
  reportDialog.querySelector('[data-report-confirm]').addEventListener('click', function () {
    if (reported) return;
    reported = true;
    reportDialog.querySelector('h2').textContent = 'Report recorded in this prototype.';
    reportDialog.querySelector('[data-report-confirm]').hidden = true;
    reportDialog.querySelector('[data-report-cancel]').textContent = 'Close';
    reportDialog.querySelector('[data-report-cancel]').focus();
  });
  reportDialog.addEventListener('close', function () { if (screen.classList.contains('is-active')) trigger.focus(); });
  window.addEventListener('the90:screen', function () { if (reportDialog.open) reportDialog.close(); });

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
