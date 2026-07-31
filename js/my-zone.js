/* =========================================================
   THE90 — My Zone interactions
   ========================================================= */

(function () {
  'use strict';

  var choices = Array.prototype.slice.call(document.querySelectorAll('[data-theme-choice]'));

  choices.forEach(function (choice) {
    choice.addEventListener('click', function () {
      choices.forEach(function (item) {
        var selected = item === choice;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    });
  });

  /* -------------------------------------------------------
     Achievements — each badge explains what earned it.
     Reuses the shared reward modal; js/main.js owns closing it.
     ------------------------------------------------------- */

  var modal = document.querySelector('[data-modal]');
  var modalBadge = modal && modal.querySelector('.modal__badge');
  var modalTitle = document.querySelector('[data-modal-title]');
  var modalText = document.querySelector('[data-modal-text]');
  var modalCta = document.querySelector('[data-modal-cta]');
  if (!modal || !modalBadge || !modalTitle || !modalText || !modalCta) return;

  var defaultBadge = modalBadge.getAttribute('src');

  document.addEventListener('click', function (event) {
    var card = event.target.closest('[data-achievement]');
    if (card) {
      var art = card.querySelector('img');
      if (art) modalBadge.src = art.getAttribute('src');
      modalTitle.textContent = 'Congratulations!';
      modalText.innerHTML = '<b>' + card.dataset.achievement + '</b><br>' + card.dataset.achievementText;
      modalCta.textContent = 'Got It';
      modal.hidden = false;
      modal.classList.remove('is-out');
      return;
    }

    // Hand the badge back once the modal closes, so other rewards look right.
    var closing = event.target.closest('[data-modal-close]') ||
      event.target.closest('[data-modal-cta]') ||
      event.target === modal;
    if (closing) window.setTimeout(function () { modalBadge.src = defaultBadge; }, 320);
  });
})();
