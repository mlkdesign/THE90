/* =========================================================
   THE90 — league ⇄ league chat

   The chat is the screen one step to the right of a league.
   You get there by dragging the league across or by tapping the
   mirrored back button in the top right corner, which carries an
   unread count in the same red plate the notifications bell uses.

   The drag is a real pager: both screens are laid side by side and
   follow the pointer, and only once you let go does the router
   take over. Nothing here runs until you have joined the league —
   there is no chat to swipe to before that.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  var league = document.querySelector('[data-screen="league"]');
  var chat = document.querySelector('[data-screen="league-chat"]');
  if (!T || !league || !chat) return;

  var WIDTH = 390;          // one screen, in design px
  var COMMIT = 70;          // travel that counts as "take me there"
  var SLOP = 10;            // travel before the gesture picks an axis
  var SETTLE = 280;         // keep in step with .is-settling in league.css


  /* =======================================================
     Unread messages
     ======================================================= */

  var badge = document.querySelector('[data-league-chat-badge]');
  var unread = 2;

  function paintBadge() {
    if (!badge) return;
    badge.textContent = unread;
    badge.hidden = unread === 0;
  }
  paintBadge();


  /* =======================================================
     Where we are, and whether the chat exists at all
     ======================================================= */

  var here = '';
  var joined = true;

  window.addEventListener('the90:screen', function (event) {
    here = event.detail;
    if (here !== 'league-chat' || !unread) return;
    unread = 0;
    paintBadge();
  });

  document.addEventListener('the90:league-membership', function (event) {
    joined = event.detail.joined;
  });


  /* =======================================================
     The drag

     Progress runs 0 → 1: at 0 the league fills the frame, at 1
     the chat does. Everything else is that one number painted
     onto both screens.
     ======================================================= */

  var from = null, startX = 0, startY = 0, startP = 0, axis = '', scale = 1, swallow = false;

  function paint(p, settling) {
    league.classList.add('is-paging');
    chat.classList.add('is-paging');
    league.classList.toggle('is-settling', !!settling);
    chat.classList.toggle('is-settling', !!settling);
    league.style.transform = 'translateX(' + (-p * WIDTH) + 'px)';
    chat.style.transform = 'translateX(' + ((1 - p) * WIDTH) + 'px)';
  }

  /* Hand over to the router only once the slide has finished, and let the
     screens keep their transform while the router cross-fades them — wiping
     it any earlier snaps the outgoing screen back into view mid-fade. */
  function land(p) {
    paint(p, true);
    var target = p >= .5 ? 'league-chat' : 'league';
    window.setTimeout(function () {
      T.go(target);
      league.classList.remove('is-paging', 'is-settling');
      chat.classList.remove('is-paging', 'is-settling');
      window.setTimeout(function () {
        league.style.transform = '';
        chat.style.transform = '';
      }, 340);
    }, SETTLE);
  }

  function canStart(event, name) {
    if (here !== name || from) return false;
    if (name === 'league' && !joined) return false;
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    // controls keep their clicks, and the picks rail keeps its own sideways scroll
    return !event.target.closest('button, a, input, textarea, .picks-track');
  }

  function down(event, name) {
    swallow = false;
    if (!canStart(event, name)) return;
    from = name;
    startX = event.clientX;
    startY = event.clientY;
    startP = name === 'league' ? 0 : 1;
    axis = '';
    // the mockup is scaled to fit the window, so pointer px are not design px
    scale = league.getBoundingClientRect().width / WIDTH || 1;
  }

  function move(event) {
    if (!from) return;
    var dx = (event.clientX - startX) / scale;
    var dy = (event.clientY - startY) / scale;

    if (!axis) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // a gesture that leans vertical belongs to the scroller, not to us
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis === 'y') { from = null; return; }
    }

    paint(Math.max(0, Math.min(1, startP - dx / WIDTH)), false);
    if (event.cancelable) event.preventDefault();
  }

  /* The click that closes a drag has to be dropped, but a drag does not
     always produce one — released off the element, cancelled, whatever. Let
     the guard lapse on its own so it can never eat an unrelated click later. */
  function hold() {
    swallow = true;
    window.setTimeout(function () { swallow = false; }, 400);
  }

  function up(event) {
    if (!from) return;
    var travelled = (event.clientX - startX) / scale;
    from = null;
    if (axis !== 'x') return;
    hold();
    // far enough in one direction wins; anything short springs back
    var committed = Math.abs(travelled) >= COMMIT;
    land(committed ? (travelled < 0 ? 1 : 0) : startP);
  }

  league.addEventListener('pointerdown', function (e) { down(e, 'league'); });
  chat.addEventListener('pointerdown', function (e) { down(e, 'league-chat'); });
  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', function () {
    if (!from) return;
    from = null;
    if (axis !== 'x') return;
    hold();
    land(startP);
  });

  // the click that closes a drag is not a click on whatever sat under it
  document.addEventListener('click', function (event) {
    if (!swallow) return;
    swallow = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
})();
