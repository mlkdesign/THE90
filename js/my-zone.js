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
})();
