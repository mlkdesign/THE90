/* THE90 — THEARENA filters, Live carousel and tournament actions */
(function () {
  'use strict';

  var screen = document.querySelector('[data-screen="arena"]');
  if (!screen) return;

  var filters = Array.prototype.slice.call(screen.querySelectorAll('[data-arena-filter]'));
  var tournaments = Array.prototype.slice.call(screen.querySelectorAll('[data-arena-tournament]'));
  var scroll = screen.querySelector('[data-arena-scroll]');
  var featuredSection = screen.querySelector('.thearena-featured-section');
  var featuredToggle = screen.querySelector('[data-featured-toggle]');
  var featuredViewport = screen.querySelector('[data-featured-viewport]');
  var featuredPagination = screen.querySelector('[data-featured-pagination]');
  var featuredEmpty = screen.querySelector('[data-featured-empty]');
  var featuredCards = Array.prototype.slice.call(screen.querySelectorAll('[data-featured-card]'));
  var featuredExpanded = false;
  var scrollFrame;

  function visibleFeaturedCards() {
    return featuredCards.filter(function (card) {
      return card.dataset.tournamentPhase === 'live' && !card.classList.contains('is-filtered-out');
    });
  }

  function scrollToFeaturedCard(card, behavior) {
    if (!featuredViewport || !card) return;
    var left = card.offsetLeft - ((featuredViewport.clientWidth - card.offsetWidth) / 2);
    featuredViewport.scrollTo({ left: left, behavior: behavior || 'smooth' });
  }

  function updateFeaturedPagination() {
    if (!featuredViewport || !featuredPagination || featuredPagination.hidden) return;

    var cards = visibleFeaturedCards();
    if (cards.length < 2) return;

    var viewportCenter = featuredViewport.scrollLeft + (featuredViewport.clientWidth / 2);
    var activeIndex = 0;
    var smallestDistance = Infinity;

    cards.forEach(function (card, index) {
      var cardCenter = card.offsetLeft + (card.offsetWidth / 2);
      var distance = Math.abs(cardCenter - viewportCenter);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        activeIndex = index;
      }
    });

    Array.prototype.slice.call(featuredPagination.children).forEach(function (page, index) {
      var active = index === activeIndex;
      page.classList.toggle('is-active', active);
      page.setAttribute('aria-current', active ? 'true' : 'false');
    });
    featuredPagination.setAttribute('aria-label', 'Live tournament ' + (activeIndex + 1) + ' of ' + cards.length);
  }

  function syncFeaturedCarousel(resetPosition) {
    if (!featuredViewport || !featuredPagination || !featuredEmpty) return;

    var cards = visibleFeaturedCards();
    var isEmpty = cards.length === 0;
    featuredViewport.hidden = isEmpty;
    featuredEmpty.hidden = !isEmpty;
    featuredPagination.hidden = featuredExpanded || cards.length < 2;
    featuredPagination.replaceChildren();

    if (isEmpty) return;

    cards.forEach(function (card, index) {
      var page = document.createElement('button');
      page.type = 'button';
      page.className = 'thearena-featured-page';
      page.setAttribute('aria-label', 'Show live tournament ' + (index + 1) + ' of ' + cards.length);
      page.addEventListener('click', function () { scrollToFeaturedCard(card); });
      featuredPagination.appendChild(page);
    });

    if (resetPosition) featuredViewport.scrollLeft = 0;
    window.requestAnimationFrame(updateFeaturedPagination);
  }

  function setFeaturedExpanded(expanded) {
    if (!featuredSection || !featuredToggle) return;

    featuredExpanded = expanded;
    featuredSection.classList.toggle('is-expanded', expanded);
    featuredToggle.textContent = expanded ? 'View less' : 'View all';
    featuredToggle.setAttribute('aria-expanded', String(expanded));
    syncFeaturedCarousel(!expanded);
  }

  function setFilter(kind) {
    filters.forEach(function (button) {
      var active = button.dataset.arenaFilter === kind;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });

    tournaments.forEach(function (tournament) {
      var visible = kind === 'all' || tournament.dataset.arenaKind === kind;
      tournament.classList.toggle('is-filtered-out', !visible);
    });

    syncFeaturedCarousel(true);
  }

  function bindFeaturedDrag() {
    if (!featuredViewport) return;

    // Keep two-finger trackpad scrolling native, just like the Live carousel.
    // The browser feeds horizontal trackpad movement directly to this overflow
    // container; mouse users get the same behavior through click-and-drag.
    var dragX = 0;
    var dragFrom = 0;
    var dragging = false;

    featuredViewport.addEventListener('pointerdown', function (event) {
      if (featuredExpanded || event.pointerType !== 'mouse' || event.button !== 0) return;
      dragging = true;
      dragX = event.clientX;
      dragFrom = featuredViewport.scrollLeft;
      featuredViewport.setPointerCapture(event.pointerId);
      featuredViewport.classList.add('is-dragging');
    });

    featuredViewport.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      featuredViewport.scrollLeft = dragFrom - (event.clientX - dragX);
    });

    function endDrag(event) {
      if (!dragging) return;
      if (featuredViewport.hasPointerCapture(event.pointerId)) {
        featuredViewport.releasePointerCapture(event.pointerId);
      }
      dragging = false;
      featuredViewport.classList.remove('is-dragging');
      var cards = visibleFeaturedCards();
      if (!cards.length) return;
      var closest = cards.reduce(function (current, card) {
        var center = featuredViewport.scrollLeft + (featuredViewport.clientWidth / 2);
        var currentDistance = Math.abs((current.offsetLeft + (current.offsetWidth / 2)) - center);
        var cardDistance = Math.abs((card.offsetLeft + (card.offsetWidth / 2)) - center);
        return cardDistance < currentDistance ? card : current;
      }, cards[0]);
      scrollToFeaturedCard(closest);
    }

    featuredViewport.addEventListener('pointerup', endDrag);
    featuredViewport.addEventListener('pointercancel', endDrag);
    featuredViewport.addEventListener('lostpointercapture', function () {
      dragging = false;
      featuredViewport.classList.remove('is-dragging');
    });

    featuredViewport.addEventListener('scroll', function () {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(updateFeaturedPagination);
    }, { passive: true });
  }

  filters.forEach(function (button) {
    button.addEventListener('click', function () { setFilter(button.dataset.arenaFilter); });
  });

  if (featuredToggle) {
    featuredToggle.addEventListener('click', function () {
      setFeaturedExpanded(!featuredExpanded);
    });
  }

  Array.prototype.slice.call(screen.querySelectorAll('[data-arena-show-all]')).forEach(function (button) {
    button.addEventListener('click', function () {
      setFilter('all');
      var upcoming = screen.querySelector('.thearena-upcoming');
      if (upcoming && scroll) scroll.scrollTo({ top: upcoming.offsetTop - 126, behavior: 'smooth' });
    });
  });

  Array.prototype.slice.call(screen.querySelectorAll('[data-arena-join]')).forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      var tournament = button.closest('[data-tournament-id]');
      if (button.classList.contains('is-locked') || (tournament && tournament.dataset.tournamentPhase === 'live')) return;
      if (button.classList.contains('is-joined')) return;
      if (tournament && window.THE90 && typeof window.THE90.openArenaJoinModal === 'function') {
        window.THE90.openArenaJoinModal(tournament.dataset.tournamentId);
      }
    });
  });

  var rules = screen.querySelector('[data-arena-rules]');
  if (rules) {
    rules.addEventListener('click', function () {
      var how = screen.querySelector('.thearena-how');
      if (how && scroll) scroll.scrollTo({ top: how.offsetTop - 126, behavior: 'smooth' });
    });
  }

  bindFeaturedDrag();
  syncFeaturedCarousel(false);
  window.addEventListener('resize', function () {
    window.requestAnimationFrame(updateFeaturedPagination);
  });
})();
