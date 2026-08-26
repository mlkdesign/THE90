/* =========================================================
   THE90 — a league ⇄ its chat

   A league opens on itself: the banner, what it is, who is
   winning it. The chat is the screen one step to the right —
   drag the page across, or press Chat, and back the same way.

   The drag is a real pager: both screens are laid side by side and
   follow the pointer, and only once you let go does the router
   take over.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  var league = document.querySelector('[data-screen="league"]');
  var chat = document.querySelector('[data-screen="league-chat"]');
  if (!T || !league || !chat) return;

  /* The foot of the screen belongs to whichever screen is under it: the
     message field is the chat's, the tab bar and the join button are the
     info's. Each travels with the screen it belongs to rather than swapping
     over once the slide has already finished. */
  var footer = document.querySelector('[data-shell-footer]');
  var withChat = footer ? footer.querySelectorAll('.league-chat-input') : [];
  var withLeague = footer ? footer.querySelectorAll('.navbar, .league-join') : [];

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
     ======================================================= */

  var from = null, startX = 0, startY = 0, startP = 0, axis = '', scale = 1, swallow = false;

  /* Progress runs 0 → 1: at 0 the league fills the frame, at 1 the chat
     does. Everything else is that one number painted onto both screens. */
  function paint(p, settling) {
    league.classList.add('is-paging');
    chat.classList.add('is-paging');
    league.classList.toggle('is-settling', !!settling);
    chat.classList.toggle('is-settling', !!settling);
    league.style.transform = 'translateX(' + (-p * WIDTH) + 'px)';
    chat.style.transform = 'translateX(' + ((1 - p) * WIDTH) + 'px)';
    paintFooter(p, settling);
  }

  function slide(nodes, x) {
    Array.prototype.forEach.call(nodes, function (node) {
      node.style.transform = x === '' ? '' : 'translateX(' + x + 'px)';
    });
  }

  function paintFooter(p, settling) {
    if (!footer) return;
    if (!footer.classList.contains('is-paging')) {
      /* Both halves are on stage for the length of the gesture. The box keeps
         the height it had, so the gradient behind them stays where it is while
         they cross. */
      footer.style.height = footer.offsetHeight + 'px';
      footer.classList.add('is-paging');
    }
    footer.classList.toggle('is-settling', !!settling);
    slide(withLeague, -p * WIDTH);
    slide(withChat, (1 - p) * WIDTH);
  }

  /* Let go once the halves have arrived: whichever one landed is at rest
     already, and the one that left is off the side and about to be hidden. */
  function restFooter() {
    if (!footer) return;
    footer.classList.remove('is-paging', 'is-settling');
    footer.style.height = '';
    window.setTimeout(function () {
      slide(withChat, '');
      slide(withLeague, '');
    }, 340);
  }

  /* Hand over to the router only once the slide has finished, and let the
     screens keep their transform while the router cross-fades them — wiping
     it any earlier snaps the outgoing screen back into view mid-fade. */
  function land(p, done) {
    paint(p, true);
    var target = p >= .5 ? 'league-chat' : 'league';
    window.setTimeout(function () {
      T.go(target);
      league.classList.remove('is-paging', 'is-settling');
      chat.classList.remove('is-paging', 'is-settling');
      restFooter();
      if (done) done();
      window.setTimeout(function () {
        league.style.transform = '';
        chat.style.transform = '';
      }, 340);
    }, SETTLE);
  }

  /* The Chat button and the chat's own back arrow make the same journey the
     drag does, so the two screens always arrive the same way. */
  function slideTo(name, done) {
    if (from || here === name) return;
    var to = name === 'league-chat' ? 1 : 0;
    paint(1 - to, false);
    /* A beat at the starting position, or there is nothing to animate from.
       A timer rather than a frame: a frame that never comes — a tab in the
       background, a stalled compositor — would leave the pair stranded
       halfway with no way back. */
    window.setTimeout(function () { land(to, done); }, 20);
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
    // controls keep their clicks, and any rail keeps its own sideways scroll
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
