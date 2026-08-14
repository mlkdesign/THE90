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

  /* Covers exported whole out of Figma: backdrop, the league's art and the
     fade into the card surface, in one image. */
  var COVERS = [
    'assets/league/card-cover-cup.jpg',
    'assets/league/card-cover-ball.jpg'
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
  var BLURB = 'Invite-only VIP tournament · 5 rounds of top matches · branded prizes from the sponsor';

  // The prototype ships with a full shelf, so "My Leagues" reads the same as
  // "Joined Leagues" without going through the create flow first.
  var SEEDED = [
    { name: 'Office League', cover: COVER_CUP,
      rank: '#14', of: '/ 128', messages: 145, unread: 3, rounds: 5, subtitle: BLURB,
      privacy: 'invite', privacyLabel: 'Invite only', fee: 100, length: '5 rounds' },
    { name: 'Arsenal Fans',  cover: COVER_BALL,
      rank: '#1',  of: '/ 128', messages: 12,  unread: 0, rounds: 3, subtitle: BLURB,
      privacy: 'invite', privacyLabel: 'Invite only', fee: 0,   length: '5 rounds' },
    { name: 'Sunday Derby',  cover: COVER_CUP,
      rank: '#6',  of: '/ 15',  messages: 87,  unread: 12, rounds: 5, subtitle: BLURB,
      privacy: 'public', privacyLabel: 'Public',      fee: 0,   length: '5 rounds' },
    { name: 'Chelsea Crew',  cover: COVER_BALL,
      rank: '#22', of: '/ 64',  messages: 40,  unread: 0, rounds: 4, subtitle: BLURB,
      privacy: 'public', privacyLabel: 'Public',      fee: 0,   length: '5 rounds' }
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

  function stat(value, label, modifier, unread) {
    var cell = el('span', 'lcard__stat' + (modifier ? ' ' + modifier : ''));
    var top = el('b');
    top.appendChild(document.createTextNode(value));
    if (unread) top.appendChild(el('em', 'lcard__new', '+' + unread));
    cell.appendChild(top);
    cell.appendChild(el('i', null, label));
    return cell;
  }

  /* Same card as the Joined shelf — a league you run should not look like a
     different species from one you were invited into. */
  function createCard(league, index) {
    var card = el('article', 'lcard');

    var open = el('button', 'lcard__open');
    open.type = 'button';
    open.dataset.go = 'league';
    open.dataset.leagueJoined = 'true';
    open.dataset.leagueOwn = 'true';
    open.setAttribute('aria-label', 'Open ' + league.name);

    var cover = el('span', 'lcard__cover');

    // a cover saved by an older build may point at a file that has since been
    // renamed; fall back rather than leave a hole where the photo should be
    var banner = el('img', 'lcard__banner');
    banner.src = COVERS.indexOf(league.cover) === -1
      ? COVERS[index % COVERS.length]
      : league.cover;
    banner.alt = '';

    var title = el('span', 'lcard__title');
    var name = el('strong', null, league.name);
    if (premium) {
      var badge = el('em', 'league-badge', 'Premium');
      name.appendChild(document.createTextNode(' '));
      name.appendChild(badge);
    }
    title.appendChild(name);
    // a league you set up yourself has its own settings to show
    title.appendChild(el('small', null, league.subtitle ||
      (league.privacyLabel + ' · ' + league.length + ' · ' +
       (league.fee > 0 ? league.fee + ' Coins entry' : 'Free entry'))));

    cover.appendChild(banner);

    var stats = el('span', 'lcard__stats');
    stats.appendChild(stat(league.rank || '#1', league.of || '/ 1', 'lcard__stat--rank'));
    stats.appendChild(stat(String(league.messages || 0), 'Messages', null, league.unread));
    stats.appendChild(stat(String(league.rounds || 5), 'rounds'));

    var body = el('span', 'lcard__body');
    body.appendChild(title);
    body.appendChild(el('span', 'lcard__rule'));
    body.appendChild(stats);

    open.appendChild(cover);
    open.appendChild(body);

    var menu = el('button', 'lcard__menu');
    menu.type = 'button';
    menu.dataset.lcardMenu = '';
    menu.setAttribute('aria-haspopup', 'menu');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Options for ' + league.name);
    var dots = el('img');
    dots.src = 'assets/DotsThreeOutline.svg';
    dots.width = 20;
    dots.height = 20;
    dots.alt = '';
    menu.appendChild(dots);

    card.appendChild(open);
    card.appendChild(menu);
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
