/* =========================================================
   THE90 — the tabs inside a league

   Daily picks, Participants, Prizes, Rules. The same control
   the tournament carries, and for the same reasons: the tabs
   are laid side by side in one strip you can drag between,
   the underline travels with the drag rather than jumping
   after it, and the strip comes to rest against the top of
   the screen without the page moving underneath.

   The scroll behaviour is the tournament's, worked out there
   and kept in step here: a tab arriving while the page is
   scrolled past the strip is dropped down by that much so it
   opens at its own beginning without anything else shifting,
   and once it has arrived the drop is traded for real scroll
   position, which cancels out exactly.
   ========================================================= */

(function () {
  'use strict';

  var screen = document.querySelector('[data-screen="league"]');
  if (!screen) return;

  var strip = screen.querySelector('[data-league-tabs]');
  var indicator = screen.querySelector('[data-league-tab-indicator]');
  var buttons = Array.prototype.slice.call(screen.querySelectorAll('[data-league-tab]'));
  var panels = Array.prototype.slice.call(screen.querySelectorAll('[data-league-panel]'));
  var rail = screen.querySelector('[data-league-panels]');
  var scroll = screen.querySelector('[data-league-scroll]');
  var sticky = screen.querySelector('.league-tabs-sticky');
  if (!strip || !rail || !scroll || !buttons.length || !panels.length) return;

  var desired = 0;
  var animation = null;
  var scrollFrame = null;
  var filler = 0;
  var fillerIndex = -1;
  var changing = false;
  var offsets = [];
  var owner = 0;

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

  function railWidth() { return rail.clientWidth; }

  function position() {
    var width = railWidth();
    return width ? rail.scrollLeft / width : desired;
  }

  function indexOf(name) {
    return buttons.findIndex(function (button) { return button.dataset.leagueTab === name; });
  }


  /* =======================================================
     The strip

     Everything is drawn from one number — where the rail is
     between two tabs — so nothing can fall out of step.
     ======================================================= */

  function tabGeometry(index) {
    var button = buttons[index];
    if (!button) return { left: 0, width: 0 };
    var styles = window.getComputedStyle(button);
    var padLeft = parseFloat(styles.paddingLeft) || 0;
    var padRight = parseFloat(styles.paddingRight) || 0;
    return {
      left: button.offsetLeft + padLeft,
      width: Math.max(0, button.offsetWidth - padLeft - padRight)
    };
  }

  function renderStrip(value) {
    var last = buttons.length - 1;
    var at = clamp(value, 0, last);
    var leftIndex = Math.floor(at);
    var rightIndex = Math.min(last, leftIndex + 1);
    var progress = at - leftIndex;
    var left = tabGeometry(leftIndex);
    var right = tabGeometry(rightIndex);

    if (indicator) {
      indicator.style.width = (left.width + (right.width - left.width) * progress) + 'px';
      indicator.style.transform =
        'translate3d(' + (left.left + (right.left - left.left) * progress) + 'px, 0, 0)';
    }

    /* Colour and opacity only — the same two the tournament's strip paints.
       Weight is left to .is-active in the stylesheet: font-weight is a layout
       property, and rewriting it every frame re-measured the strip under the
       indicator and under its own scroll position, which is what made both
       drift while a tab was still travelling. */
    buttons.forEach(function (button, index) {
      var near = Math.max(0, 1 - Math.abs(at - index));
      button.style.opacity = String(.5 + near * .5);
      button.style.color = 'rgba(247, 250, 248, ' + (.5 + near * .5).toFixed(3) + ')';
    });

    // the strip travels its own overflow in step with the rail, so the tab
    // you are heading for is on screen by the time you arrive
    if (last > 0) {
      var overflow = Math.max(0, strip.scrollWidth - strip.clientWidth);
      strip.scrollLeft = (at / last) * overflow;
    }

    var settled = Math.round(at);
    buttons.forEach(function (button, index) {
      var on = index === settled;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (panel, index) {
      panel.setAttribute('aria-hidden', index === settled ? 'false' : 'true');
    });
  }


  /* =======================================================
     Height, and the space held open under a short tab
     ======================================================= */

  function panelOffset(index) { return offsets[index] || 0; }

  function setPanelOffset(index, value) {
    if (!panels[index]) return;
    offsets[index] = value;
    panels[index].style.marginTop = value ? value + 'px' : '';
  }

  function clearPanelOffsets() {
    panels.forEach(function (panel, index) { setPanelOffset(index, 0); });
  }

  function panelExtent(index) {
    return panels[index] ? panels[index].offsetHeight + panelOffset(index) : 0;
  }

  function heightAt(value) {
    var last = panels.length - 1;
    var at = clamp(value, 0, last);
    var index = Math.floor(at);
    if (!panels[index]) return 0;
    var left = panelExtent(index);
    var right = panelExtent(Math.min(last, index + 1));
    return left + (right - left) * (at - index);
  }

  function fitHeight() {
    var height = heightAt(position());
    if (height) rail.style.height = Math.round(height + filler) + 'px';
  }

  /* Where the strip comes to rest — read from the rail, because offsetTop on
     a stuck block reports where it is being held, not where it belongs. */
  function pinOffset() {
    if (!sticky) return 0;
    return Math.max(0, rail.offsetTop - sticky.offsetHeight -
      (parseFloat(window.getComputedStyle(rail.parentNode).rowGap) || 0));
  }

  function heightOutsidePanels() { return scroll.scrollHeight - rail.offsetHeight; }

  function roomUnder(index) {
    if (!panels[index]) return 0;
    var settled = Math.min(scroll.scrollTop, pinOffset());
    return Math.max(0, Math.round(
      settled + scroll.clientHeight - (heightOutsidePanels() + panels[index].offsetHeight)));
  }

  function roomAcross(from, to) {
    var room = 0;
    for (var index = Math.min(from, to); index <= Math.max(from, to); index++) {
      room = Math.max(room, roomUnder(index));
    }
    return room;
  }

  function dropTab(index) {
    if (index === owner) return;
    setPanelOffset(index, Math.max(0, scroll.scrollTop - pinOffset()));
  }

  function hold(index) {
    dropTab(index);
    changing = true;
    fillerIndex = index;
    filler = Math.max(roomUnder(owner), roomAcross(Math.round(position()), index));
    fitHeight();
  }

  function holdForDrag() {
    var index = Math.round(position());
    [index - 1, index + 1].forEach(function (near) {
      if (panels[near]) dropTab(near);
    });
    changing = true;
    fillerIndex = index;
    filler = Math.max(roomUnder(owner), roomAcross(index - 1, index + 1));
    fitHeight();
  }

  /* The drop becomes ordinary scroll position: the tab rises by exactly what
     the page falls, so nothing on screen changes. */
  function commit(index) {
    var offset = panelOffset(index);
    owner = index;
    changing = false;
    clearPanelOffsets();
    if (offset) scroll.scrollTop = Math.max(0, scroll.scrollTop - offset);
    fillerIndex = index;
    filler = roomUnder(index);
    fitHeight();
  }

  /* Given back on the way up and never taken again. */
  function release() {
    if (!filler || changing || fillerIndex < 0) return;
    var needed = Math.max(0, Math.round(scroll.scrollTop + scroll.clientHeight -
      (heightOutsidePanels() + panelExtent(fillerIndex))));
    if (needed >= filler) return;
    filler = needed;
    fitHeight();
  }

  function updateStuck() {
    if (!sticky) return;
    sticky.classList.toggle('is-stuck', scroll.scrollTop >= pinOffset());
  }


  /* =======================================================
     Moving between tabs
     ======================================================= */

  function render(value) {
    var at = clamp(value, 0, buttons.length - 1);
    desired = at;
    var width = railWidth();
    if (width) rail.scrollLeft = at * width;
    renderStrip(at);
  }

  function stopAnimation() {
    if (!animation) return;
    window.cancelAnimationFrame(animation);
    animation = null;
  }

  function animateTo(index, done) {
    var target = clamp(index, 0, buttons.length - 1);
    var start = position();
    var distance = target - start;
    stopAnimation();
    if (Math.abs(distance) < .001) {
      render(target);
      if (done) done();
      return;
    }
    var startedAt = performance.now();
    var duration = Math.min(420, Math.max(230, 230 + Math.abs(distance) * 95));
    (function frame(now) {
      var elapsed = clamp((now - startedAt) / duration, 0, 1);
      render(start + distance * (1 - Math.pow(1 - elapsed, 4)));
      if (elapsed < 1) {
        animation = window.requestAnimationFrame(frame);
        return;
      }
      animation = null;
      if (done) done();
    })(startedAt);
  }

  function goTo(index, options) {
    var settings = options || {};
    var target = clamp(index, 0, buttons.length - 1);
    if (settings.instant) {
      stopAnimation();
      clearPanelOffsets();
      owner = target;
      changing = false;
      filler = 0;
      fillerIndex = target;
      render(target);
      fitHeight();
      return;
    }
    hold(target);
    animateTo(target, function () { commit(target); });
  }

  buttons.forEach(function (button, index) {
    button.addEventListener('click', function () { goTo(index); });
  });


  /* =======================================================
     The drag

     The rail follows the pointer and settles on whichever tab
     the flick was heading for. A gesture that leans vertical
     belongs to the page, and one that starts above the strip
     belongs to the pager that carries you back to the chat.
     ======================================================= */

  var drag = { id: null, axis: null, x: 0, y: 0, from: 0, at: 0, time: 0, speed: 0 };
  var swallowClick = false;

  rail.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.picks-track')) return;
    stopAnimation();
    drag.id = event.pointerId;
    drag.axis = null;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.from = position();
    drag.at = rail.scrollLeft;
    drag.time = event.timeStamp || performance.now();
    drag.speed = 0;
  });

  rail.addEventListener('pointermove', function (event) {
    if (event.pointerId !== drag.id) return;
    var dx = event.clientX - drag.x;
    var dy = event.clientY - drag.y;
    if (!drag.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { drag.axis = 'y'; return; }
      drag.axis = 'x';
      holdForDrag();
      if (rail.setPointerCapture) rail.setPointerCapture(event.pointerId);
      rail.classList.add('is-dragging');
    }
    if (drag.axis !== 'x') return;
    if (event.cancelable) event.preventDefault();

    var width = railWidth();
    var limit = Math.max(0, rail.scrollWidth - width);
    var next = clamp(drag.at - dx, 0, limit);
    rail.scrollLeft = next;
    renderStrip(position());

    var now = event.timeStamp || performance.now();
    drag.speed = (next - drag.at) / Math.max(1, now - drag.time);
    drag.at = next;
    drag.time = now;
  });

  function endDrag(event) {
    if (event.pointerId !== drag.id) return;
    var wasHorizontal = drag.axis === 'x';
    if (rail.hasPointerCapture && rail.hasPointerCapture(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId);
    }
    drag.id = null;
    drag.axis = null;
    rail.classList.remove('is-dragging');
    if (!wasHorizontal) return;

    swallowClick = true;
    window.setTimeout(function () { swallowClick = false; }, 400);

    var at = position();
    var travelled = at - drag.from;
    var target = Math.round(at);
    if (Math.abs(travelled) >= .18) {
      target = Math.round(drag.from) + (travelled > 0 ? 1 : -1);
    } else if (Math.abs(drag.speed) >= .55) {
      target = Math.round(drag.from) + (drag.speed > 0 ? 1 : -1);
    }
    target = clamp(target, 0, buttons.length - 1);
    hold(target);
    animateTo(target, function () { commit(target); });
  }

  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', endDrag);
  rail.addEventListener('click', function (event) {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  rail.addEventListener('scroll', function () {
    fitHeight();
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(function () {
      scrollFrame = null;
      if (!railWidth()) return;
      desired = position();
      renderStrip(desired);
    });
  }, { passive: true });

  scroll.addEventListener('scroll', function () {
    release();
    updateStuck();
  }, { passive: true });

  window.addEventListener('resize', function () { render(desired); fitHeight(); });

  // a tab can grow under you — the participants list opens out, the picks
  // rail appears once you are in the league — and the strip has to follow
  if (window.ResizeObserver) {
    var watcher = new window.ResizeObserver(function () { if (!changing) fitHeight(); });
    panels.forEach(function (panel) { watcher.observe(panel); });
  }

  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'league') return;
    // a league always opens on its picks
    goTo(0, { instant: true });
    window.requestAnimationFrame(function () { render(0); fitHeight(); updateStuck(); });
  });

  goTo(0, { instant: true });
  window.requestAnimationFrame(function () { render(0); fitHeight(); updateStuck(); });


  /* =======================================================
     Opening a tab from somewhere else

     The pinned round in the chat comes in this way: it asks
     for the picks with the strip already at the top, so the
     tab is the first thing on screen.
     ======================================================= */

  var T = window.THE90;
  if (T) {
    T.leagueTabs = {
      open: function (name, options) {
        var index = Math.max(0, indexOf(name));
        var settings = options || {};
        goTo(index, { instant: true });
        if (settings.pinned) {
          scroll.scrollTop = pinOffset();
          updateStuck();
        }
      },
      pinOffset: pinOffset
    };
  }
})();
