/* =========================================================
   THE90 — preset avatars

   Three on the house, three behind a price. Uploading your own
   still works and simply wins over whatever preset was picked.
   ========================================================= */

(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var grid = $('[data-avatar-presets]');
  if (!grid) return;

  var UNLOCKED_KEY = 'the90.avatars.v1';
  var PREMIUM_KEY = 'the90.premium.v1';
  var PREMIUM_INCLUDED = 2;   // Premium covers two of the paid avatars

  var AVATARS = [
    { id: 'a1', src: 'assets/avatars/avatar-01.jpg', price: 0 },
    { id: 'a2', src: 'assets/avatars/avatar-02.jpg', price: 0 },
    { id: 'a3', src: 'assets/avatars/avatar-03.jpg', price: 0 },
    { id: 'a4', src: 'assets/avatars/avatar-04.jpg', price: 120 },
    { id: 'a5', src: 'assets/avatars/avatar-05.jpg', price: 250 },
    { id: 'a6', src: 'assets/avatars/avatar-06.jpg', price: 400 }
  ];

  function load(key, fallback) {
    try {
      var saved = JSON.parse(localStorage.getItem(key));
      return saved === null ? fallback : saved;
    } catch (error) { return fallback; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage may be unavailable */ }
  }

  var unlocked = load(UNLOCKED_KEY, []) || [];
  var premium = load(PREMIUM_KEY, false) === true;
  var chosen = null;
  var pending = null;

  function isUnlocked(avatar) {
    if (avatar.price === 0) return true;
    if (unlocked.indexOf(avatar.id) !== -1) return true;
    // Premium hands you the first two paid avatars without paying for them
    var paid = AVATARS.filter(function (a) { return a.price > 0; });
    return premium && paid.indexOf(avatar) < PREMIUM_INCLUDED;
  }

  function includedInPremium(avatar) {
    var paid = AVATARS.filter(function (a) { return a.price > 0; });
    return premium && unlocked.indexOf(avatar.id) === -1 &&
      paid.indexOf(avatar) < PREMIUM_INCLUDED;
  }


  /* =======================================================
     Applying a choice
     ======================================================= */

  function apply(avatar) {
    chosen = avatar.id;

    var preview = $('[data-avatar-preview]');
    if (preview) {
      preview.style.backgroundImage = 'url("' + avatar.src + '")';
      preview.classList.add('has-image');
    }

    // Carry it through the rest of the app, the way a real profile would.
    $$('.balance__avatar img').forEach(function (img) { img.src = avatar.src; });
    var zone = $('.mz-avatar__photo');
    if (zone) zone.src = avatar.src;

    render();
  }

  // An uploaded file always wins — drop the preset selection.
  var upload = $('[data-avatar-input]');
  if (upload) {
    upload.addEventListener('change', function () {
      var file = upload.files && upload.files[0];
      if (!file || !file.type.match(/^image\//)) return;
      chosen = null;
      render();
    });
  }


  /* =======================================================
     Unlock sheet
     ======================================================= */

  var sheetPreview = $('[data-unlock-preview]');
  var sheetPrice = $('[data-unlock-price]');
  var sheetConfirm = $('[data-unlock-confirm]');

  function openUnlock(avatar) {
    pending = avatar;
    if (sheetPreview) {
      sheetPreview.src = avatar.src;
      sheetPreview.alt = '';
    }
    var free = includedInPremium(avatar);
    if (sheetPrice) sheetPrice.textContent = free ? 'Included in Premium' : avatar.price + ' Coins';
    if (sheetConfirm) {
      sheetConfirm.textContent = free ? 'Use this avatar' : 'Unlock for ' + avatar.price + ' Coins';
    }
  }

  if (sheetConfirm) {
    sheetConfirm.addEventListener('click', function () {
      if (!pending) return;
      if (unlocked.indexOf(pending.id) === -1) {
        unlocked.push(pending.id);
        save(UNLOCKED_KEY, unlocked);
      }
      apply(pending);
      pending = null;
      var close = document.querySelector('[data-settings-overlay] [data-sheet-close]');
      if (close) close.click();
    });
  }


  /* =======================================================
     Grid
     ======================================================= */

  function render() {
    var fragment = document.createDocumentFragment();

    AVATARS.forEach(function (avatar) {
      var open = isUnlocked(avatar);
      var card = document.createElement('button');
      card.className = 'avatar-card' +
        (open ? '' : ' avatar-card--locked') +
        (chosen === avatar.id ? ' is-on' : '');
      card.type = 'button';
      card.setAttribute('aria-label', open
        ? 'Use this avatar'
        : 'Locked avatar, ' + avatar.price + ' Coins');

      var image = document.createElement('img');
      image.className = 'avatar-card__photo';
      image.src = avatar.src;
      image.alt = '';
      card.appendChild(image);

      if (!open) {
        var lock = document.createElement('img');
        lock.className = 'avatar-card__lock';
        lock.src = 'assets/my-zone/lock.svg';
        lock.alt = '';
        lock.width = 15;
        lock.height = 17;
        card.appendChild(lock);

        var price = document.createElement('span');
        price.className = 'avatar-card__price';
        price.textContent = includedInPremium(avatar) ? 'In Premium' : avatar.price + ' Coins';
        card.appendChild(price);
      } else if (chosen === avatar.id) {
        var tick = document.createElement('img');
        tick.className = 'avatar-card__tick';
        tick.src = 'assets/icons/check.svg';
        tick.alt = '';
        tick.width = 16;
        tick.height = 16;
        card.appendChild(tick);
      }

      // A locked avatar always goes through the sheet, never straight on.
      if (open) {
        card.addEventListener('click', function () { apply(avatar); });
      } else {
        card.dataset.settingsSheet = 'avatar-unlock';
        card.addEventListener('click', function () { openUnlock(avatar); });
      }

      fragment.appendChild(card);
    });

    grid.replaceChildren(fragment);
  }

  render();
})();
