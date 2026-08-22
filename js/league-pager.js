/* =========================================================
   THE90 — league chat ⇄ league info

   The chat is where a league opens; its info is the screen one
   step to the right. You get there by dragging the chat across
   or by tapping the i in the top right corner, and back the
   same way.

   The drag is a real pager: both screens are laid side by side and
   follow the pointer, and only once you let go does the router
   take over. On the info side it only answers to the top block —
   below the tabs the sideways gesture belongs to the tabs
   themselves (js/league-tabs.js).
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
     Where we are
     ======================================================= */

  var here = '';

  window.addEventListener('the90:screen', function (event) {
    here = event.detail;
  });


  /* =======================================================
     The drag

     Progress runs 0 → 1: at 0 the chat fills the frame, at 1
     the info does. Everything else is that one number painted
     onto both screens.
     ======================================================= */

  var from = null, startX = 0, startY = 0, startP = 0, axis = '', scale = 1, swallow = false;

  function paint(p, settling) {
    league.classList.add('is-paging');
    chat.classList.add('is-paging');
    league.classList.toggle('is-settling', !!settling);
    chat.classList.toggle('is-settling', !!settling);
    chat.style.transform = 'translateX(' + (-p * WIDTH) + 'px)';
    league.style.transform = 'translateX(' + ((1 - p) * WIDTH) + 'px)';
  }

  /* Hand over to the router only once the slide has finished, and let the
     screens keep their transform while the router cross-fades them — wiping
     it any earlier snaps the outgoing screen back into view mid-fade. */
  function land(p, done) {
    paint(p, true);
    var target = p >= .5 ? 'league' : 'league-chat';
    window.setTimeout(function () {
      T.go(target);
      league.classList.remove('is-paging', 'is-settling');
      chat.classList.remove('is-paging', 'is-settling');
      if (done) done();
      window.setTimeout(function () {
        league.style.transform = '';
        chat.style.transform = '';
      }, 340);
    }, SETTLE);
  }

  /* The i in the chat, the back button on the info, the round block: the same
     journey the drag makes, so the two screens always arrive the same way. */
  function slideTo(name, done) {
    if (from || here === name) return;
    var to = name === 'league' ? 1 : 0;
    paint(1 - to, false);
    // a frame at the starting position, or there is nothing to animate from
    window.requestAnimationFrame(function () { land(to, done); });
  }

  T.leaguePage = { go: slideTo };

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-league-page]');
    if (!trigger) return;
    event.preventDefault();
    slideTo(trigger.dataset.leaguePage);
  });

  function canStart(event, name) {
    if (here !== name || from) return false;
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    // The tabs and everything under them own the sideways gesture on the info
    // side; the way back to the chat is the block above them.
    if (name === 'league' && event.target.closest('.league-tabs-sticky, .league-panels')) return false;
    // controls keep their clicks, and the picks rail keeps its own sideways scroll
    return !event.target.closest('button, a, input, textarea, .picks-track');
  }

  function down(event, name) {
    swallow = false;
    if (!canStart(event, name)) return;
    from = name;
    startX = event.clientX;
    startY = event.clientY;
    startP = name === 'league-chat' ? 0 : 1;
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
