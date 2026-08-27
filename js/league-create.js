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
    { name: 'Weekend challenge', cover: COVER_CUP,
      description: 'Guess the outcomes of top matches and win cool prizes',
      privacy: 'private', privacyLabel: 'Private', members: 12 },
    { name: 'Friends League', cover: COVER_CUP,
      description: 'Just friends, just football, just the best league.',
      privacy: 'private', privacyLabel: 'Private', members: 8 },
    { name: 'Office Warriors', cover: COVER_BALL,
      description: 'Colleagues on the field, friends in life. Only forward!',
      privacy: 'open', privacyLabel: 'Open', members: 16 }
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
    open.dataset.leagueIndex = String(index);
    open.setAttribute('aria-label', 'Open ' + league.name);

    var art = el('span', 'theleagues-card__art');
    var banner = el('img');
    // a cover of your own if you gave one, otherwise one of the house pair
    banner.src = league.cover || COVERS[index === 2 ? 1 : 0];
    banner.alt = '';
    art.appendChild(banner);

    var body = el('span', 'theleagues-card__body');
    var copy = el('span', 'theleagues-card__copy');
    if (league.premium) copy.appendChild(el('em', 'theleagues-card__tag', 'Premium'));
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

    /* The corner of a card is the way into its room, and it says what is
       waiting there. It carries the same marks the card itself does, so
       opening the chat knows whose league it is. */
    var chat = el('button', 'theleagues-card__chat', 'Chat');
    chat.type = 'button';
    chat.dataset.go = 'league-chat';
    chat.dataset.leagueJoined = 'true';
    chat.dataset.leagueOwn = 'true';
    chat.dataset.leagueIndex = String(index);
    chat.setAttribute('aria-label', 'Open the chat of ' + league.name);
    chat.appendChild(el('i', 'theleagues-card__unread'));

    card.appendChild(open);
    card.appendChild(chat);
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
      /* Premium is bought for the league you are standing in. The account
         flag is kept for what Premium unlocks outside a league. */
      premium = true;
      save(PREMIUM_KEY, premium);
      if (viewing.own && leagues[viewing.index]) {
        leagues[viewing.index].premium = true;
        save(OWN_KEY, leagues);
      }
      renderPremium();
      renderOwn();
      /* The sheet closes itself on the way out — data-sheet-close on the
         button — so what is left on screen is the news. */
      var name = viewing.league && viewing.league.name;
      reward('Your league is Premium!',
        (name || 'This league') + ' can run its own rounds now, and it comes with a custom ' +
        'background, theme and league stickers.');
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

  /* The same modal doubles as the confirm. Destructive by default, since most
     things worth asking about are — publishing a round is not, and says so. */
  window.THE90.confirm = function (title, text, label, onConfirm, options) {
    var settings = options || {};
    reward(title, text, {
      label: label,
      danger: settings.danger !== false,
      onConfirm: onConfirm
    });
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
  var privacyHost = $('[data-league-privacy]', form);

  var NAME_MIN = 3, NAME_MAX = 40;
  var DESC_MIN = 10, DESC_MAX = 160;

  function countDescription() {
    if (!descCount || !descInput) return;
    descCount.textContent = descInput.value.length + '/' + DESC_MAX;
  }
  if (descInput) descInput.addEventListener('input', countDescription);

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
    if (rulesBody) rulesBody.innerHTML = '';
    renderPrizes(null);
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

  /* =======================================================
     Three steps: what the league is, how it is played, what
     it is played for. The dots in the corner say where you
     are; the button at the foot moves you on.
     ======================================================= */

  /* A parked step is not part of the wizard: it stays in the page so it can
     be brought back, but nothing counts it, shows it or walks through it. */
  var stepPanels = $$('[data-create-step]', form).filter(function (panel) {
    return panel.dataset.parked === undefined;
  });
  var stepStrip = $('[data-create-steps]', form);
  var stepDots = $$('[data-create-steps] i', form).slice(0, stepPanels.length);
  if (stepStrip) stepStrip.hidden = stepPanels.length < 2;
  var stepBack = $('.setup-back', form);
  var step = 1;

  function showStep(next) {
    step = Math.max(1, Math.min(stepPanels.length, next));
    stepPanels.forEach(function (panel, index) {
      panel.hidden = index !== step - 1;
    });
    stepDots.forEach(function (dot, index) {
      dot.classList.toggle('is-on', index === step - 1);
    });
    dressForm();
    form.scrollTop = 0;
  }

  if (stepBack) {
    stepBack.addEventListener('click', function (event) {
      // inside the form the back button is a step back, not a way out
      if (step === 1) return;
      event.preventDefault();
      event.stopPropagation();
      showStep(step - 1);
    }, true);
  }


  /* =======================================================
     Rules, written rather than chosen
     ======================================================= */

  var rulesBody = $('[data-rules-body]', form);

  /* There is more than one of these now — the one in the create form and the
     one a league writes its own rules in — so a toolbar acts on the editor it
     is part of rather than on a particular one. */
  function bodyOf(node) {
    var editor = node.closest('.editor');
    return editor ? $('[data-rules-body]', editor) : null;
  }

  $$('[data-cmd]').forEach(function (button) {
    button.addEventListener('mousedown', function (event) { event.preventDefault(); });
    button.addEventListener('click', function () {
      var body = bodyOf(button);
      if (!body) return;
      body.focus();
      if (button.dataset.cmd === 'size') document.execCommand('fontSize', false, button.dataset.size);
      else document.execCommand(button.dataset.cmd, false, null);
    });
  });

  $$('[data-rules-media]').forEach(function (input) {
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      var body = bodyOf(input);
      if (!file || !body) return;
      var reader = new FileReader();
      reader.onload = function () {
        var node = document.createElement(file.type.indexOf('video') === 0 ? 'video' : 'img');
        node.src = String(reader.result);
        if (node.tagName === 'VIDEO') node.controls = true;
        body.appendChild(node);
      };
      reader.readAsDataURL(file);
      input.value = '';
    });
  });


  /* =======================================================
     Prizes, place by place

     Nothing is worked out for you: the place is a line of
     text like everything else, so a league can pay whoever
     it likes for whatever it likes.
     ======================================================= */

  var prizeList = $('[data-prize-list]', form);
  var prizeAdd = $('[data-prize-add]', form);
  var ORDINALS = ['1st place', '2nd place', '3rd place'];

  function ordinal(index) {
    return ORDINALS[index] || (index + 1) + 'th place';
  }

  function prizeBlock(prize, index) {
    var box = el('article', 'prize-block');

    var head = el('div', 'prize-block__head');
    var place = document.createElement('input');
    place.type = 'text';
    place.placeholder = ordinal(index);
    place.value = (prize && prize.place) || ordinal(index);
    place.dataset.prizePlace = '';
    head.appendChild(place);

    // any place can go, including one of the three a league starts with
    if (prizeList) {
      var drop = el('button', 'prize-block__drop', 'Remove');
      drop.type = 'button';
      drop.addEventListener('click', function () {
        box.remove();
        renumber();
      });
      head.appendChild(drop);
    }
    box.appendChild(head);

    var title = document.createElement('input');
    title.type = 'text';
    title.placeholder = 'What they win';
    title.value = (prize && prize.title) || '';
    title.dataset.prizeTitle = '';
    box.appendChild(title);

    var note = document.createElement('textarea');
    note.rows = 2;
    note.placeholder = 'Description (optional)';
    note.value = (prize && prize.description) || '';
    note.dataset.prizeNote = '';
    box.appendChild(note);

    var value = document.createElement('input');
    value.type = 'text';
    value.placeholder = 'Value (optional)';
    value.value = (prize && prize.value) || '';
    value.dataset.prizeValue = '';
    box.appendChild(value);

    var photo = el('label', 'prize-block__photo');
    var picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.hidden = true;
    var caption = el('span', null, 'Add a photo (optional)');
    photo.appendChild(picker);
    photo.appendChild(caption);
    if (prize && prize.image) dressPhoto(photo, caption, prize.image);
    picker.addEventListener('change', function () {
      var file = picker.files && picker.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { dressPhoto(photo, caption, String(reader.result)); };
      reader.readAsDataURL(file);
    });
    box.appendChild(photo);

    return box;
  }

  function dressPhoto(photo, caption, src) {
    photo.dataset.prizeImage = src;
    photo.classList.add('has-image');
    var art = photo.querySelector('img') || document.createElement('img');
    art.src = src;
    art.alt = '';
    if (!art.parentNode) photo.insertBefore(art, caption);
    caption.textContent = 'Change photo';
  }

  /* The places keep their order when one in the middle goes. */
  function renumber() {
    $$('.prize-block', prizeList).forEach(function (box, index) {
      var place = $('[data-prize-place]', box);
      if (!place) return;
      place.placeholder = ordinal(index);
      if (!place.value.trim() || /^\d+(st|nd|rd|th) place$/.test(place.value.trim())) {
        place.value = ordinal(index);
      }
    });
  }

  function renderPrizes(list) {
    if (!prizeList) return;
    var fragment = document.createDocumentFragment();
    var prizes = (list && list.length) ? list : [null, null, null];
    prizes.forEach(function (prize, index) { fragment.appendChild(prizeBlock(prize, index)); });
    prizeList.replaceChildren(fragment);
  }

  if (prizeAdd) {
    prizeAdd.addEventListener('click', function () {
      var index = $$('.prize-block', prizeList).length;
      prizeList.appendChild(prizeBlock(null, index));
    });
  }

  function collectPrizes() {
    return $$('.prize-block', prizeList).map(function (box, index) {
      var photo = $('.prize-block__photo', box);
      return {
        place: ($('[data-prize-place]', box).value || '').trim() || ordinal(index),
        title: ($('[data-prize-title]', box).value || '').trim(),
        description: ($('[data-prize-note]', box).value || '').trim(),
        value: ($('[data-prize-value]', box).value || '').trim(),
        image: (photo && photo.dataset.prizeImage) || ''
      };
    }).filter(function (prize) { return prize.title; });
  }


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

  var STEP_TITLES = ['Create your league', 'Rules of your league', 'Prizes to play for'];
  var STEP_SUBS = [
    'Set it up once — invite whoever you want.',
    'How it is played, and anything your players should know.',
    'What each place wins. Fill in as many as you like.'
  ];

  function dressForm() {
    var isEdit = editing > -1;
    var last = step === (stepPanels.length || 1);
    if (formTitle) {
      formTitle.textContent = isEdit && step === 1 ? 'Edit your league' : STEP_TITLES[step - 1];
    }
    if (formSub) {
      formSub.textContent = isEdit && step === 1
        ? 'Change what you need — everyone in it sees the update.'
        : STEP_SUBS[step - 1];
    }
    if (submitButton) {
      submitButton.textContent = !last ? 'Continue' : (isEdit ? 'Save changes' : 'Create league');
    }
  }

  function startCreate() {
    editing = -1;
    resetForm();
    showStep(1);
    selectPrivacy('private');
    dressForm();
  }

  function startEdit(index) {
    var league = leagues[index];
    if (!league) return;
    editing = index;
    resetForm();
    if (rulesBody) rulesBody.innerHTML = league.rules || '';
    renderPrizes(league.prizes);
    showStep(1);
    if (nameInput) nameInput.value = league.name;
    if (descInput) descInput.value = league.description || league.subtitle || '';
    countDescription();
    selectPrivacy(league.privacy === 'open' ? 'open' : 'private');
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
    // a description is welcome, not required — a league can be named and no more
    if (description.length > DESC_MAX) {
      fail(descInput, 'Keep it under ' + DESC_MAX + ' characters.');
      return;
    }

    // any step but the last is a way forward, not a way to finish
    if (step < stepPanels.length) {
      showStep(step + 1);
      return;
    }

    var privacy = privacyValue();
    var settings = {
      name: name,
      description: description,
      privacy: privacy,
      privacyLabel: privacy === 'open' ? 'Open' : 'Private',
      rules: rulesBody ? rulesBody.innerHTML.trim() : '',
      prizes: collectPrizes()
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

    if (wasEditing) {
      // Land back on the shelf the league lives on, so dismissing the modal
      // leaves you looking at it.
      var backToLeagues = document.querySelector('[data-nav="leagues"]');
      if (backToLeagues) backToLeagues.click();
      if (window.THE90 && window.THE90.leaguesTab) window.THE90.leaguesTab('own');
      reward('Changes saved', name + ' has been updated.');
      return;
    }

    /* Straight into the league you just made, as its owner — the same state a
       tap on its card would have set, so anything that asks later gets the
       same answer. Setting up a round is offered from the league itself. */
    viewing = {
      joined: true,
      own: true,
      index: leagues.length - 1,
      league: leagues[leagues.length - 1]
    };
    rememberViewing();
    if (window.THE90.go) window.THE90.go('league');
    applyMembership();
    // at the top of it, however far down the form was scrolled
    var leagueScroll = document.querySelector('[data-league-scroll]');
    if (leagueScroll) leagueScroll.scrollTop = 0;
  });


  /* =======================================================
     What the card's ... menu can do to a league you run
     ======================================================= */

  window.THE90.ownLeagues = {
    nameAt: function (index) {
      return leagues[index] ? leagues[index].name : '';
    },
    edit: startEdit,
    rulesAt: function (index) {
      return leagues[index] ? (leagues[index].rules || '') : '';
    },
    setRules: function (index, html) {
      if (!leagues[index]) return;
      leagues[index].rules = html;
      save(OWN_KEY, leagues);
      renderOwn();
      applyMembership();
    },
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
      privacy: card.dataset.leaguePrivacy === 'open' ? 'open' : 'private',
      premium: card.dataset.leaguePremium === 'true'
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

  /* The picture a league was made with is the picture it wears — on its card
     out here and across the top of the league itself. */
  var heroArt = document.querySelector('.league-hero__bg');
  var heroDefault = heroArt ? heroArt.getAttribute('src') : '';

  var heroExtras = Array.prototype.slice.call(
    document.querySelectorAll('.league-hero__host, .league-hero__trophy'));

  function dressHero() {
    if (!heroArt) return;
    var cover = viewing.league && viewing.league.cover;
    heroArt.src = cover || heroDefault;
    /* A picture of your own is the whole banner: the host and the trophy
       belong to the house one and would be standing in front of yours. */
    heroExtras.forEach(function (art) { art.hidden = !!cover; });
  }

  function applyMembership() {
    /* Rounds and Rules are what Premium buys, and it is bought for one league
       at a time — having paid for one says nothing about the next. */
    viewing.premium = !!(viewing.league && viewing.league.premium);

    if (joinButton) joinButton.hidden = viewing.joined;
    if (youRow) youRow.hidden = !viewing.joined;
    // no point offering it to a league that already has it
    if (premiumCard) premiumCard.hidden = !viewing.own || viewing.premium;
    if (premiumActive) premiumActive.hidden = !viewing.own || !viewing.premium;

    /* In a private league only the owner brings people in, so a member is not
       shown a door they cannot open. An open league hands the invite to
       everyone who is already in it. */
    var open = viewing.league && viewing.league.privacy === 'open';
    var canInvite = viewing.own || open;
    if (invite) invite.hidden = !canInvite;
    if (participantsInvite) participantsInvite.hidden = !canInvite;

    dressHero();
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
