/* =========================================================
   THE90 — your own leagues
   The create flow, the list it feeds, and the Premium switch
   that only applies to leagues you own.
   ========================================================= */

(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Bump this whenever the shape of a stored league changes. Leagues are kept
     in localStorage, so a browser that saw an earlier build keeps handing back
     the old objects — including cover paths for files that no longer exist. */
  var OWN_KEY = 'the90.ownLeagues.v4';
  var PREMIUM_KEY = 'the90.premium.v1';

  var form = $('[data-league-create-form]');
  var listWrap = $('[data-own-leagues]');
  var empty = $('[data-own-empty]');
  var addButton = $('[data-own-add]');
  if (!form || !listWrap || !empty) return;

  /* Art exported from THELEAGUES - Main (712:8963). */
  var COVERS = [
    'assets/leagues/theleagues-gold-trophy.png',
    'assets/leagues/theleagues-bronze-trophy.png'
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

  var COVER_CUP = COVERS[0];
  var COVER_BALL = COVERS[1];
  var BLURB = 'Set your rules, invite friends and compete for the top spot.';

  var SEEDED = [
    { name: 'Weekend challenge', cover: COVER_CUP, premium: true,
      subtitle: 'Guess the outcomes of top matches and win cool prizes',
      privacy: 'invite', privacyLabel: 'Invite only', fee: 100, length: '5 rounds' },
    { name: 'Friends League', cover: COVER_CUP,
      subtitle: 'Just friends, just football, just the best league.',
      privacy: 'invite', privacyLabel: 'Invite only', fee: 0, length: '5 rounds' },
    { name: 'Office Warriors', cover: COVER_BALL,
      subtitle: 'Colleagues on the field, friends in life. Only forward!',
      privacy: 'public', privacyLabel: 'Public', fee: 0, length: '5 rounds' }
  ];

  var leagues = load(OWN_KEY, null) || SEEDED.slice();
  var premium = load(PREMIUM_KEY, false) === true;


  /* =======================================================
     The list of leagues you own
     ======================================================= */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function temporaryShareLabel(button, label) {
    var previous = button.textContent;
    button.textContent = label;
    window.setTimeout(function () { button.textContent = previous; }, 1600);
  }

  function inviteLinkFor(name) {
    var url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('league', name);
    return url.toString();
  }

  function copyLeagueLink(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url).then(function () { return true; }, function () { return false; });
    }
    var input = document.createElement('textarea');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (error) { /* copying may be unavailable */ }
    input.remove();
    return Promise.resolve(copied);
  }

  function leagueNameFor(button) {
    if (button.dataset.leagueName) return button.dataset.leagueName;
    var card = button.closest('.theleagues-card');
    var title = card && card.querySelector('.theleagues-card__title');
    if (title) return title.textContent.trim();
    var page = button.closest('.league-content');
    var heading = page && page.querySelector('.league-summary h1');
    return heading ? heading.textContent.trim() : 'THE90 League';
  }

  function shareLeague(button) {
    var name = leagueNameFor(button);
    var url = inviteLinkFor(name);
    var shareData = {
      title: name + ' on THE90',
      text: 'Join my ' + name + ' league on THE90.',
      url: url
    };

    if (navigator.share) {
      navigator.share(shareData).catch(function (error) {
        if (error && error.name === 'AbortError') return;
        copyLeagueLink(url).then(function (copied) {
          temporaryShareLabel(button, copied ? 'Link copied' : 'Share unavailable');
        });
      });
      return;
    }

    copyLeagueLink(url).then(function (copied) {
      temporaryShareLabel(button, copied ? 'Link copied' : 'Share unavailable');
    });
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-share-league]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    shareLeague(button);
  });

  function createCard(league, index) {
    var card = el('article', 'theleagues-card');
    var open = el('button', 'theleagues-card__open');
    open.type = 'button';
    open.dataset.go = 'league';
    open.dataset.leagueJoined = 'true';
    open.dataset.leagueOwn = 'true';
    open.setAttribute('aria-label', 'Open ' + league.name);

    var art = el('span', 'theleagues-card__art');
    var banner = el('img');
    banner.src = league.cover && COVERS.indexOf(league.cover) > -1
      ? league.cover
      : COVERS[index === 2 ? 1 : 0];
    banner.alt = '';
    art.appendChild(banner);

    var body = el('span', 'theleagues-card__body');
    var copy = el('span', 'theleagues-card__copy');
    if (league.premium || premium) copy.appendChild(el('em', 'theleagues-card__tag', 'Premium'));
    copy.appendChild(el('h3', 'theleagues-card__title', league.name));
    copy.appendChild(el('p', null, league.subtitle || BLURB));

    var footer = el('span', 'theleagues-card__footer');
    var avatars = el('span', 'theleagues-card__avatars');
    [
      'assets/leagues/theleagues-member-1.png',
      'assets/leagues/theleagues-member-2.png',
      'assets/leagues/theleagues-member-3.png',
      'assets/leagues/theleagues-member-4.png'
    ].forEach(function (src) {
      var avatar = el('img');
      avatar.src = src;
      avatar.alt = '';
      avatars.appendChild(avatar);
    });
    avatars.appendChild(el('span', 'theleagues-card__more', '+12'));
    footer.appendChild(avatars);

    body.appendChild(copy);
    body.appendChild(el('span', 'theleagues-card__rule'));
    body.appendChild(footer);
    open.appendChild(art);
    open.appendChild(body);

    var invite = el('button', 'theleagues-card__invite', 'Invite friends');
    invite.type = 'button';
    invite.dataset.shareLeague = 'true';
    invite.dataset.leagueName = league.name;
    invite.setAttribute('aria-label', 'Share invite link for ' + league.name);

    card.appendChild(open);
    card.appendChild(invite);
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
    Array.prototype.forEach.call(document.querySelectorAll('[data-leagues-count]'), function (count) {
      count.textContent = '(' + leagues.length + ')';
    });
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
    button.classList.toggle('is-danger', !!(cta && cta.danger));

    // the trophy belongs to a reward, not to "are you sure you want to delete"
    var badgeArt = $('.modal__badge');
    if (badgeArt) badgeArt.hidden = !!(cta && cta.danger);

    // app.js routes anything carrying data-go, so the modal button can send
    // you somewhere without this module reaching into the router
    if (cta && cta.go) button.dataset.go = cta.go;
    else delete button.dataset.go;

    button.addEventListener('click', function restore() {
      button.removeEventListener('click', restore);
      button.textContent = 'Got It';
      button.classList.remove('is-danger');
      if (badgeArt) badgeArt.hidden = false;
      delete button.dataset.go;
      // the X cancels; getting here means the button itself was pressed
      if (cta && cta.onConfirm) cta.onConfirm();
    });

    modal.hidden = false;
    modal.classList.remove('is-out');
  }

  // the same modal doubles as the confirm for anything destructive
  window.THE90.confirm = function (title, text, label, onConfirm) {
    reward(title, text, { label: label, danger: true, onConfirm: onConfirm });
  };


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


  /* =======================================================
     Create or edit

     The same form does both: editing loads a league into it and
     submitting writes back over that one instead of adding.
     ======================================================= */

  var formTitle = $('.offer__title', form);
  var formSub = $('.offer__sub', form);
  var submitButton = $('[data-league-create-submit]', form);
  var editing = -1;

  function selectSeg(host, value) {
    if (!host) return;
    $$('.seg__btn', host).forEach(function (button) {
      button.classList.toggle('is-on', button.dataset.val === String(value));
    });
  }

  function dressForm() {
    var isEdit = editing > -1;
    if (formTitle) formTitle.textContent = isEdit ? 'Edit your league' : 'Create your league';
    if (formSub) formSub.textContent = isEdit
      ? 'Change what you need — everyone in it sees the update.'
      : 'Set it up once — invite whoever you want.';
    if (submitButton) submitButton.textContent = isEdit ? 'Save changes' : 'Create league';
  }

  function startCreate() {
    editing = -1;
    resetForm();
    selectSeg($('[data-league-privacy]', form), 'invite');
    selectSeg($('[data-league-fee]', form), '0');
    selectSeg($('[data-league-length]', form), '5 rounds');
    dressForm();
  }

  function startEdit(index) {
    var league = leagues[index];
    if (!league) return;
    editing = index;
    resetForm();
    if (nameInput) nameInput.value = league.name;
    selectSeg($('[data-league-privacy]', form), league.privacy);
    selectSeg($('[data-league-fee]', form), league.fee);
    selectSeg($('[data-league-length]', form), league.length);
    dressForm();
  }

  // opening the form from anywhere other than an Edit action means "new one"
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-go="league-create"]');
    if (trigger) startCreate();
  });

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

    var settings = {
      name: name,
      privacy: segValue(privacy),
      privacyLabel: segLabel(privacy),
      fee: Number(segValue(fee)) || 0,
      length: segLabel(length)
    };

    var wasEditing = editing > -1;
    if (wasEditing) {
      // keep everything the card shows that the form does not ask about
      var current = leagues[editing];
      Object.keys(settings).forEach(function (key) { current[key] = settings[key]; });
      if (pickedCover) current.cover = pickedCover;
      delete current.subtitle;   // the settings line replaces the seeded blurb
    } else {
      settings.cover = pickedCover;
      leagues.push(settings);
    }
    save(OWN_KEY, leagues);

    editing = -1;
    resetForm();
    renderOwn();

    // Land back on the shelf the league lives on, so dismissing the modal
    // leaves you looking at it.
    var backToLeagues = document.querySelector('[data-nav="leagues"]');
    if (backToLeagues) backToLeagues.click();
    if (window.THE90 && window.THE90.leaguesTab) window.THE90.leaguesTab('own');

    if (wasEditing) {
      reward('Changes saved', name + ' has been updated.');
    } else {
      reward('Your league is live!',
        'Share the invite link and start picking. ' + name + ' is ready for its first round.',
        { label: 'Invite friends', go: 'invite-friends' });
    }
  });


  /* =======================================================
     What the card's ... menu can do to a league you run
     ======================================================= */

  window.THE90.ownLeagues = {
    nameAt: function (index) {
      return leagues[index] ? leagues[index].name : '';
    },
    edit: startEdit,
    remove: function (index) {
      if (!leagues[index]) return;
      leagues.splice(index, 1);
      save(OWN_KEY, leagues);
      renderOwn();
    }
  };

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
