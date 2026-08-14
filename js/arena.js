/* THE90 — Arena league swipe actions */
(function () {
  'use strict';

  var screen = document.querySelector('[data-screen="leagues"]');
  if (!screen) return;

  var REVEAL = 112;
  var rows = function () {
    return Array.prototype.slice.call(screen.querySelectorAll('[data-arena-swipe]'));
  };

  function closeRow(row) {
    if (!row) return;
    row.classList.remove('is-open', 'is-dragging');
    var card = row.querySelector('[data-arena-card]');
    if (card) card.style.transform = '';
  }

  function closeOthers(activeRow) {
    rows().forEach(function (row) {
      if (row !== activeRow) closeRow(row);
    });
  }

  function setOpen(row, open) {
    closeOthers(open ? row : null);
    row.classList.toggle('is-open', open);
    row.classList.remove('is-dragging');
    var card = row.querySelector('[data-arena-card]');
    if (card) card.style.transform = '';
  }

  function bindSwipeRow(row) {
    var card = row.querySelector('[data-arena-card]');
    var pinButton = row.querySelector('[data-arena-pin]');
    var exitButton = row.querySelector('[data-arena-exit]');
    if (!card) return;

    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'League. Swipe left for actions');

    var tracking = false;
    var horizontal = false;
    var startX = 0;
    var startY = 0;
    var startOffset = 0;
    var offset = 0;
    var moved = false;

    card.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      tracking = true;
      horizontal = false;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      startOffset = row.classList.contains('is-open') ? -REVEAL : 0;
      offset = startOffset;
      card.setPointerCapture(event.pointerId);
    });

    card.addEventListener('pointermove', function (event) {
      if (!tracking) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;

      if (!horizontal) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        if (Math.abs(dy) > Math.abs(dx)) return;
        horizontal = true;
        row.classList.add('is-dragging');
        closeOthers(row);
      }

      moved = Math.abs(dx) > 7;
      offset = Math.max(-REVEAL, Math.min(0, startOffset + dx));
      card.style.transform = 'translateX(' + offset + 'px)';
    });

    function finish(event) {
      if (!tracking) return;
      tracking = false;
      if (card.hasPointerCapture && card.hasPointerCapture(event.pointerId)) {
        card.releasePointerCapture(event.pointerId);
      }
      if (!horizontal) return;

      var shouldOpen = offset < -(REVEAL * .42);
      setOpen(row, shouldOpen);
      window.setTimeout(function () { moved = false; }, 0);
    }

    card.addEventListener('pointerup', finish);
    card.addEventListener('pointercancel', finish);

    card.addEventListener('click', function (event) {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (row.classList.contains('is-open')) setOpen(row, false);
    });

    card.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 5) return;
      event.preventDefault();
      setOpen(row, event.deltaX > 0);
    }, { passive: false });

    card.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setOpen(row, true);
      } else if (event.key === 'ArrowRight' || event.key === 'Escape') {
        event.preventDefault();
        setOpen(row, false);
      }
    });

    if (pinButton) {
      pinButton.addEventListener('click', function () {
        var becomesPinned = !row.classList.contains('is-pinned');
        var title = row.querySelector('.arena-league__copy strong');
        var pinIcon = title && title.querySelector('.arena-league__pin');
        var allLabel = screen.querySelectorAll('.arena-section-label')[1];

        row.classList.toggle('is-pinned', becomesPinned);
        pinButton.setAttribute('aria-label', becomesPinned ? 'Unpin league' : 'Pin league');

        if (title && becomesPinned && !pinIcon) {
          pinIcon = document.createElement('img');
          pinIcon.className = 'arena-league__pin';
          pinIcon.src = 'assets/arena/pin.svg';
          pinIcon.alt = '';
          title.appendChild(pinIcon);
        } else if (pinIcon && !becomesPinned) {
          pinIcon.remove();
        }

        closeRow(row);
        if (allLabel) {
          if (becomesPinned) allLabel.before(row);
          else allLabel.after(row);
        }
      });
    }

    if (exitButton) {
      exitButton.addEventListener('click', function () {
        row.classList.add('is-exiting');
        window.setTimeout(function () { row.remove(); }, 260);
      });
    }
  }

  rows().forEach(bindSwipeRow);

  screen.addEventListener('pointerdown', function (event) {
    if (!event.target.closest('[data-arena-swipe]')) closeOthers(null);
  });

  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'leagues') closeOthers(null);
  });
})();
