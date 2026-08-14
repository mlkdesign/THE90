/* =========================================================
   THE90 — the news block on Main

   Read more opens the story in place rather than sending you
   to a page: the whole item is already here, only clamped.
   ========================================================= */

(function () {
  'use strict';

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-news-more]');
    if (!button) return;

    var card = button.closest('.newscard');
    if (!card) return;

    var open = !card.classList.contains('is-open');
    card.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.textContent = open ? 'Show less' : 'Read more';
  });
})();
