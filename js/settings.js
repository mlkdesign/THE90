/* Settings detail screens and sheets */
(function () {
  'use strict';

  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };

  /* Notification switches */
  var notificationSwitches = $$('.settings-switch');
  function updateNotificationCount() {
    var enabled = notificationSwitches.filter(function (toggle) {
      return !toggle.hasAttribute('data-switch-all') && toggle.classList.contains('is-on');
    }).length;
    var count = $('[data-notification-count]');
    if (count) count.textContent = enabled + ' enabled';
  }
  notificationSwitches.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var enabled = !toggle.classList.contains('is-on');
      toggle.classList.toggle('is-on', enabled);
      toggle.setAttribute('aria-checked', String(enabled));
      if (toggle.hasAttribute('data-switch-all')) {
        notificationSwitches.forEach(function (item) {
          item.classList.toggle('is-on', enabled);
          item.setAttribute('aria-checked', String(enabled));
        });
      }
      updateNotificationCount();
    });
  });
  updateNotificationCount();

  /* Theme selection */
  $$('[data-settings-theme]').forEach(function (theme) {
    theme.addEventListener('click', function () {
      $$('[data-settings-theme]').forEach(function (item) {
        item.classList.toggle('is-selected', item === theme);
      });
      var current = $('[data-current-theme]');
      if (current) current.textContent = theme.dataset.settingsTheme;
    });
  });

  /* Delete confirmation */
  var deleteChecks = $$('.settings-delete__checks input');
  var deleteConfirm = $('[data-delete-confirm]');
  function refreshDelete() {
    if (!deleteConfirm) return;
    deleteConfirm.disabled = !deleteChecks.every(function (input) { return input.checked; });
  }
  deleteChecks.forEach(function (input) { input.addEventListener('change', refreshDelete); });
  if (deleteConfirm) {
    deleteConfirm.addEventListener('click', function () {
      if (deleteConfirm.disabled) return;
      deleteConfirm.textContent = 'Deletion request confirmed';
      deleteConfirm.disabled = true;
    });
  }

  /* Bottom sheets */
  var overlay = $('[data-settings-overlay]');
  function closeSheet() {
    if (!overlay) return;
    overlay.hidden = true;
    $$('[data-settings-panel]', overlay).forEach(function (panel) { panel.hidden = true; });
  }
  function openSheet(name) {
    if (!overlay) return;
    $$('[data-settings-panel]', overlay).forEach(function (panel) {
      panel.hidden = panel.dataset.settingsPanel !== name;
    });
    overlay.hidden = false;
  }
  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-settings-sheet]');
    if (opener) openSheet(opener.dataset.settingsSheet);
    if (event.target.closest('[data-sheet-close]')) closeSheet();
    if (event.target === overlay) closeSheet();
  });

  /* Languages */
  var languages = [
    ['Russian', 'Русский'], ['English', 'English'], ['Spanish', 'Español'],
    ['German', 'Deutsch'], ['French', 'Français'], ['Italian', 'Italiano'],
    ['Portuguese', 'Português'], ['Dutch', 'Nederlands']
  ];
  var languageQuery = '';
  var selectedLanguage = 'English';
  var languageList = $('[data-language-list]');
  function renderLanguages() {
    if (!languageList) return;
    languageList.innerHTML = languages.filter(function (language) {
      return (language[0] + ' ' + language[1]).toLowerCase().indexOf(languageQuery) !== -1;
    }).map(function (language) {
      var selected = language[0] === selectedLanguage;
      return '<button class="settings-language-option' + (selected ? ' is-selected' : '') +
        '" type="button" data-language="' + language[0] + '"><i></i><span>' +
        language[0] + ' — ' + language[1] + '</span></button>';
    }).join('');
  }
  renderLanguages();
  if (languageList) {
    languageList.addEventListener('click', function (event) {
      var option = event.target.closest('[data-language]');
      if (!option) return;
      selectedLanguage = option.dataset.language;
      var current = $('[data-current-language]');
      if (current) current.textContent = selectedLanguage;
      renderLanguages();
      closeSheet();
    });
  }
  var languageSearch = $('[data-language-search]');
  if (languageSearch) {
    languageSearch.addEventListener('input', function () {
      languageQuery = languageSearch.value.trim().toLowerCase();
      renderLanguages();
    });
  }

  /* Settings photo upload */
  var photoInput = $('.settings-photo input[type="file"]');
  if (photoInput) {
    photoInput.addEventListener('change', function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file || !file.type.match(/^image\//)) return;
      var reader = new FileReader();
      reader.onload = function () { $('.settings-photo img').src = reader.result; };
      reader.readAsDataURL(file);
    });
    $('.settings-photo > button').addEventListener('click', function () { photoInput.click(); });
  }
})();
