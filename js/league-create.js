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
  var OWN_KEY = 'the90.ownLeagues.v5';
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
      description: 'Guess the outcomes of top matches and win cool prizes',
      privacy: 'private', privacyLabel: 'Private', max: 20, members: 12 },
    { name: 'Friends League', cover: COVER_CUP,
      description: 'Just friends, just football, just the best league.',
      privacy: 'private', privacyLabel: 'Private', max: 12, members: 8 },
    { name: 'Office Warriors', cover: COVER_BALL,
      description: 'Colleagues on the field, friends in life. Only forward!',
      privacy: 'open', privacyLabel: 'Open', max: 30, members: 16 }
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
    open.dataset.go = 'league-chat';
    open.dataset.leagueJoined = 'true';
    open.dataset.leagueOwn = 'true';
    open.dataset.leagueIndex = String(index);
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
    copy.appendChild(el('p', null, league.description || league.subtitle || BLURB));

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

    var second = $('[data-modal-second]');
    if (second) {
      second.hidden = !(cta && cta.second);
      if (cta && cta.second) second.textContent = cta.second;
    }

    button.addEventListener('click', function restore() {
      button.removeEventListener('click', restore);
      button.textContent = 'Got It';
      button.classList.remove('is-danger');
      if (badgeArt) badgeArt.hidden = false;
      if (second) second.hidden = true;
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
  var descInput = $('[data-league-desc]', form);
  var descCount = $('[data-league-desc-count]', form);
  var maxHost = $('[data-league-max]', form);
  var maxValue = $('[data-league-max-value]', form);
  var maxNote = $('[data-league-max-note]', form);
  var privacyHost = $('[data-league-privacy]', form);
  var maximum = 12;
  var floor = 2;

  var NAME_MIN = 3, NAME_MAX = 40;
  var DESC_MIN = 10, DESC_MAX = 160;
  var MAX_LOW = 2, MAX_HIGH = 100;

  function countDescription() {
    if (!descCount || !descInput) return;
    descCount.textContent = descInput.value.length + '/' + DESC_MAX;
  }
  if (descInput) descInput.addEventListener('input', countDescription);

  function paintMax() {
    if (maxValue) maxValue.textContent = maximum;
    if (maxHost) {
      $$('.stepper__btn', maxHost).forEach(function (button) {
        var step = Number(button.dataset.step);
        button.disabled = step < 0 ? maximum <= floor : maximum >= MAX_HIGH;
      });
    }
  }

  if (maxHost) {
    $$('.stepper__btn', maxHost).forEach(function (button) {
      button.addEventListener('click', function () {
        maximum = Math.max(floor, Math.min(MAX_HIGH, maximum + Number(button.dataset.step)));
        paintMax();
      });
    });
  }

  /* two cards rather than a segmented control: each one has to say what it
     means for the people you invite */
  function selectPrivacy(value) {
    if (!privacyHost) return;
    $$('.privacy__card', privacyHost).forEach(function (card) {
      var on = card.dataset.val === value;
      card.classList.toggle('is-on', on);
      card.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function privacyValue() {
    var on = privacyHost && $('.privacy__card.is-on', privacyHost);
    return on ? on.dataset.val : 'private';
  }

  if (privacyHost) {
    $$('.privacy__card', privacyHost).forEach(function (card) {
      card.addEventListener('click', function () {
        var next = card.dataset.val;
        if (next === privacyValue()) return;
        // changing it changes who can bring people in, so it is worth asking
        if (editing > -1 && window.THE90.confirm) {
          window.THE90.confirm('Switch to ' + (next === 'open' ? 'Open' : 'Private') + '?',
            'Changing privacy affects who can invite new members.',
            'Change privacy', function () { selectPrivacy(next); });
          return;
        }
        selectPrivacy(next);
      });
    });
  }

  function fail(input, message) {
    var field = input.closest('.field');
    var msg = field && $('[data-msg]', field);
    if (field) {
      field.classList.add('is-error');
      field.classList.remove('is-shake');
      void field.offsetWidth;
      field.classList.add('is-shake');
    }
    if (msg) msg.textContent = message;
    input.focus();
  }

  function clearErrors() {
    $$('.field', form).forEach(function (field) {
      field.classList.remove('is-error', 'is-shake');
      var msg = $('[data-msg]', field);
      if (msg) msg.textContent = '';
    });
  }

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
    if (descInput) descInput.value = '';
    countDescription();
    clearErrors();
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
    selectPrivacy('private');
    floor = MAX_LOW;
    maximum = 12;
    paintMax();
    if (maxNote) maxNote.textContent = 'You can’t set a limit below the current member count when editing.';
    dressForm();
  }

  function startEdit(index) {
    var league = leagues[index];
    if (!league) return;
    editing = index;
    resetForm();
    if (nameInput) nameInput.value = league.name;
    if (descInput) descInput.value = league.description || league.subtitle || '';
    countDescription();
    selectPrivacy(league.privacy === 'open' ? 'open' : 'private');
    // the ceiling can be raised, never dropped under the people already in
    floor = Math.max(MAX_LOW, league.members || MAX_LOW);
    maximum = Math.max(floor, Number(league.max) || 12);
    paintMax();
    if (maxNote) {
      maxNote.textContent = league.members
        ? league.members + ' members are in this league — the limit cannot go below that.'
        : 'You can’t set a limit below the current member count when editing.';
    }
    dressForm();
  }

  // opening the form from anywhere other than an Edit action means "new one"
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-go="league-create"]');
    if (trigger) startCreate();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearErrors();

    var name = nameInput ? nameInput.value.trim() : '';
    var description = descInput ? descInput.value.trim() : '';

    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      fail(nameInput, 'Give your league a name of ' + NAME_MIN + '–' + NAME_MAX + ' characters.');
      return;
    }
    if (description.length < DESC_MIN || description.length > DESC_MAX) {
      fail(descInput, 'Say what this league is about — ' + DESC_MIN + '–' + DESC_MAX + ' characters.');
      return;
    }

    var privacy = privacyValue();
    var settings = {
      name: name,
      description: description,
      max: maximum,
      privacy: privacy,
      privacyLabel: privacy === 'open' ? 'Open' : 'Private'
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
      return;
    }

    /* A league with no round is a room with nobody playing: the way on from
       here is the first round, with leaving it for later spelled out rather
       than left to the X. */
    reward('Your league is live!',
      'Now set up the first round and invite your players.',
      {
        label: 'Set up first round',
        second: 'Do this later',
        onConfirm: function () {
          /* Straight into the league you just made, as its owner — the same
             state a tap on its card would have set, so anything that asks
             later gets the same answer. */
          viewing = {
            joined: true,
            own: true,
            index: leagues.length - 1,
            league: leagues[leagues.length - 1]
          };
          rememberViewing();
          applyMembership();
          if (window.THE90.go) window.THE90.go('league-rounds');
        }
      });
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
  /* Which league you last opened. The app can come back to the league screen
     on its own — a reload restores the screen you were on — and without this
     it would arrive with no idea whose league it is showing. */
  var VIEWING_KEY = 'the90.viewingLeague.v1';
  var viewing = load(VIEWING_KEY, null) || { joined: true, own: false };

  function rememberViewing() {
    save(VIEWING_KEY, viewing);
  }

  /* Which league was opened, and what you are to it. A card you made carries
     its index into the stored list; a seeded one carries only what the markup
     says, which is enough — you are a member of it either way. */
  document.addEventListener('click', function (event) {
    var card = event.target.closest('[data-league-joined]');
    if (!card) return;
    var own = card.dataset.leagueOwn === 'true';
    var index = card.dataset.leagueIndex === undefined ? -1 : Number(card.dataset.leagueIndex);
    var record = own && leagues[index] ? leagues[index] : {
      name: (card.getAttribute('aria-label') || '').replace(/^Open\s+/, '') || 'League',
      privacy: card.dataset.leaguePrivacy === 'open' ? 'open' : 'private'
    };
    viewing = {
      joined: card.dataset.leagueJoined !== 'false',
      own: own,
      index: own ? index : -1,
      league: record
    };
    rememberViewing();
  }, true);

  var invite = $('.league-actions__invite');
  var participantsInvite = $('.participants-invite');

  function applyMembership() {
    if (chatEntry) chatEntry.hidden = !viewing.joined;
    if (joinButton) joinButton.hidden = viewing.joined;
    if (youRow) youRow.hidden = !viewing.joined;
    if (prizes) prizes.hidden = viewing.own;
    if (premiumCard) premiumCard.hidden = !viewing.own || premium;
    if (premiumActive) premiumActive.hidden = !viewing.own || !premium;

    /* In a private league only the owner brings people in, so a member is not
       shown a door they cannot open. An open league hands the invite to
       everyone who is already in it. */
    var open = viewing.league && viewing.league.privacy === 'open';
    var canInvite = viewing.own || open;
    if (invite) invite.hidden = !canInvite;
    if (participantsInvite) participantsInvite.hidden = !canInvite;

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
