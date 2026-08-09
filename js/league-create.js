/* =========================================================
   THE90 — your own leagues
   The create flow, the list it feeds, and the Premium switch
   that only applies to leagues you own.
   ========================================================= */

(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var OWN_KEY = 'the90.ownLeagues.v1';
  var PREMIUM_KEY = 'the90.premium.v1';

  var form = $('[data-league-create-form]');
  var listWrap = $('[data-own-leagues]');
  var empty = $('[data-own-empty]');
  var addButton = $('[data-own-add]');
  if (!form || !listWrap || !empty) return;

  var COVERS = [
    'assets/clubs/bg-arsenal.jpg',
    'assets/clubs/bg-barcelona.jpg',
    'assets/clubs/bg-chelsea.jpg',
    'assets/clubs/bg-liverpool.jpg'
  ];


  /* =======================================================
     Storage
     ======================================================= */

  function load(key, fallback) {
    try {
      var saved = JSON.parse(localStorage.getItem(key));
      return saved === null ? fallback : saved;
    } catch (error) { return fallback; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage may be unavailable */ }
  }

  // The prototype ships with one league you already run, so the section has
  // something to show without going through the create flow first.
  var SEEDED = [{
    name: 'Office League',
    cover: 'assets/clubs/bg-arsenal.jpg',
    privacy: 'invite',
    privacyLabel: 'Invite only',
    fee: 100,
    length: '5 rounds'
  }];

  var leagues = load(OWN_KEY, null) || SEEDED.slice();
  var premium = load(PREMIUM_KEY, false) === true;


  /* =======================================================
     The list of leagues you own
     ======================================================= */

  function createCard(league, index) {
    var card = document.createElement('button');
    card.className = 'rankings-league-card rankings-league-card--own';
    card.type = 'button';
    card.dataset.go = 'league';
    card.dataset.leagueJoined = 'true';
    card.dataset.leagueOwn = 'true';

    var bg = document.createElement('img');
    bg.className = 'rankings-league-card__bg';
    bg.src = league.cover || COVERS[index % COVERS.length];
    bg.alt = '';

    var copy = document.createElement('span');
    copy.className = 'rankings-league-card__copy';

    var title = document.createElement('strong');
    title.textContent = league.name;
    if (premium) {
      var badge = document.createElement('em');
      badge.className = 'league-badge';
      badge.textContent = 'Premium';
      title.appendChild(document.createTextNode(' '));
      title.appendChild(badge);
    }

    var sub = document.createElement('small');
    sub.textContent = league.privacyLabel + ' · ' + league.length +
      ' · ' + (league.fee > 0 ? league.fee + ' Coins entry' : 'Free entry');

    // A chat is the point of a private league, so this line stays here and
    // nowhere else — public leagues lost it entirely.
    var chat = document.createElement('b');
    chat.textContent = 'Chat open · you are the host';

    copy.appendChild(title);
    copy.appendChild(sub);
    copy.appendChild(chat);

    var place = document.createElement('span');
    place.className = 'rankings-league-card__place';
    var rank = document.createElement('strong');
    rank.textContent = '#1';
    var of = document.createElement('small');
    of.textContent = '/ 1';
    place.appendChild(rank);
    place.appendChild(of);

    var arrow = document.createElement('span');
    arrow.className = 'rankings-league-card__arrow';
    arrow.textContent = '›';

    card.appendChild(bg);
    card.appendChild(copy);
    card.appendChild(place);
    card.appendChild(arrow);
    return card;
  }

  function renderOwn() {
    var fragment = document.createDocumentFragment();
    leagues.forEach(function (league, index) {
      fragment.appendChild(createCard(league, index));
    });
    listWrap.replaceChildren(fragment);

    var has = leagues.length > 0;
    empty.hidden = has;
    if (addButton) addButton.hidden = !has;
  }


  /* =======================================================
     Premium
     ======================================================= */

  var premiumCard = $('[data-premium-card]');
  var premiumActive = $('[data-premium-manage]');

  function renderPremium() {
    if (typeof applyMembership === 'function') applyMembership();
  }

  $$('[data-premium-confirm]').forEach(function (button) {
    button.addEventListener('click', function () {
      premium = true;
      save(PREMIUM_KEY, premium);
      renderPremium();
      renderOwn();
      reward('Premium is active',
        'Your league now has a custom background, theme and stickers — plus two paid avatars on the house.');
    });
  });


  /* =======================================================
     Reward modal — shared with achievements and welcome bonus
     ======================================================= */

  function reward(title, text, cta) {
    var modal = $('[data-modal]');
    var titleEl = $('[data-modal-title]');
    var textEl = $('[data-modal-text]');
    var button = $('[data-modal-cta]');
    if (!modal || !titleEl || !textEl || !button) return;

    titleEl.textContent = title;
    textEl.textContent = text;
    button.textContent = (cta && cta.label) || 'Got It';

    // app.js routes anything carrying data-go, so the modal button can send
    // you somewhere without this module reaching into the router
    if (cta && cta.go) button.dataset.go = cta.go;
    else delete button.dataset.go;

    button.addEventListener('click', function restore() {
      button.removeEventListener('click', restore);
      button.textContent = 'Got It';
      delete button.dataset.go;
    });

    modal.hidden = false;
    modal.classList.remove('is-out');
  }


  /* =======================================================
     Create form
     ======================================================= */

  function segValue(host) {
    var on = $('.seg__btn.is-on', host);
    return on ? on.dataset.val : '';
  }

  function segLabel(host) {
    var on = $('.seg__btn.is-on', host);
    return on ? on.textContent.trim() : '';
  }

  $$('.seg', form).forEach(function (seg) {
    $$('.seg__btn', seg).forEach(function (button) {
      button.addEventListener('click', function () {
        $$('.seg__btn', seg).forEach(function (other) {
          other.classList.toggle('is-on', other === button);
        });
      });
    });
  });

  var nameInput = $('[data-league-name]', form);
  var coverInput = $('[data-league-cover-input]', form);
  var coverPreview = $('[data-league-cover-preview]', form);
  var pickedCover = '';

  if (coverInput && coverPreview) {
    coverInput.addEventListener('change', function () {
      var file = coverInput.files && coverInput.files[0];
      if (!file || !file.type.match(/^image\//)) return;
      var reader = new FileReader();
      reader.onload = function () {
        pickedCover = String(reader.result);
        coverPreview.style.backgroundImage = 'url("' + pickedCover + '")';
        coverPreview.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    });
  }

  function resetForm() {
    if (nameInput) nameInput.value = '';
    pickedCover = '';
    if (coverPreview) {
      coverPreview.style.backgroundImage = '';
      coverPreview.classList.remove('has-image');
    }
    var field = nameInput && nameInput.closest('.field');
    if (field) field.classList.remove('is-error', 'is-valid');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      var field = nameInput.closest('.field');
      var msg = field && $('[data-msg]', field);
      if (field) {
        field.classList.add('is-error');
        field.classList.remove('is-shake');
        void field.offsetWidth;
        field.classList.add('is-shake');
      }
      if (msg) msg.textContent = 'Give your league a name.';
      nameInput.focus();
      return;
    }

    var privacy = $('[data-league-privacy]', form);
    var fee = $('[data-league-fee]', form);
    var length = $('[data-league-length]', form);

    leagues.push({
      name: name,
      cover: pickedCover,
      privacy: segValue(privacy),
      privacyLabel: segLabel(privacy),
      fee: Number(segValue(fee)) || 0,
      length: segLabel(length)
    });
    save(OWN_KEY, leagues);

    resetForm();
    renderOwn();

    // Land back on the shelf the new league just joined, so dismissing the
    // modal leaves you looking at it.
    var backToArena = document.querySelector('[data-nav="arena"]');
    if (backToArena) backToArena.click();

    reward('Your league is live!',
      'Share the invite link and start picking. ' + name + ' is ready for its first round.',
      { label: 'Invite friends', go: 'invite-friends' });
  });

  /* =======================================================
     Which league you are looking at

     Three things follow from membership rather than from the league
     itself: you can only join a league you are not in, the chat and
     your own row only exist once you are in, and the Premium card only
     appears in a league you actually own.
     ======================================================= */

  var chatEntry = $('[data-league-chat-entry]');
  var prizes = $('.league-prizes');
  var joinButton = $('[data-league-join]');
  var youRow = $('.league-member--you');
  var viewing = { joined: true, own: false };

  document.addEventListener('click', function (event) {
    var card = event.target.closest('[data-go="league"]');
    if (!card) return;
    viewing = {
      joined: card.dataset.leagueJoined !== 'false',
      own: card.dataset.leagueOwn === 'true'
    };
  }, true);

  function applyMembership() {
    if (chatEntry) chatEntry.hidden = !viewing.joined;
    if (joinButton) joinButton.hidden = viewing.joined;
    if (youRow) youRow.hidden = !viewing.joined;
    if (prizes) prizes.hidden = viewing.own;
    if (premiumCard) premiumCard.hidden = !viewing.own || premium;
    if (premiumActive) premiumActive.hidden = !viewing.own || !premium;
    document.dispatchEvent(new CustomEvent('the90:league-membership', { detail: viewing }));
  }

  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'league') return;
    applyMembership();
  });

  // Joining from the footer puts you in the league there and then.
  if (joinButton) {
    joinButton.addEventListener('click', function () {
      viewing.joined = true;
      applyMembership();
    });
  }

  /* =======================================================
     Scoring line — read from the model so the rules card can
     never quote a number the app does not actually award
     ======================================================= */

  (function fillScoring() {
    var host = $('[data-league-points]');
    var points = window.THE90 && window.THE90.POINTS;
    if (!host || !points) return;
    host.replaceChildren();
    [points.outcome, points.score].forEach(function (value) {
      var cell = document.createElement('b');
      cell.textContent = '+' + value;
      host.appendChild(cell);
    });
  })();

  renderPremium();
  renderOwn();
})();
