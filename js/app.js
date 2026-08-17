/* =========================================================
   THE90 — prototype logic
   Field states: default → active → valid / error
   ========================================================= */

(function () {
  'use strict';

  /* --- icons exported from Figma (fill switched to currentColor) --- */
  var ICON_EYE =
    '<svg width="18.75" height="12.5" viewBox="0 0 18.75 12.5" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M18.6961 5.99688C18.6687 5.93516 18.007 4.46719 16.5359 2.99609C14.5758 1.03594 12.1 0 9.37499 0C6.64999 0 4.17421 1.03594 2.21405 2.99609C0.742961 4.46719 0.0781175 5.9375 0.0538988 5.99688C0.0183622 6.07681 0 6.16331 0 6.25078C0 6.33826 0.0183622 6.42476 0.0538988 6.50469C0.0812425 6.56641 0.742961 8.03359 2.21405 9.50469C4.17421 11.4641 6.64999 12.5 9.37499 12.5C12.1 12.5 14.5758 11.4641 16.5359 9.50469C18.007 8.03359 18.6687 6.56641 18.6961 6.50469C18.7316 6.42476 18.75 6.33826 18.75 6.25078C18.75 6.16331 18.7316 6.07681 18.6961 5.99688ZM9.37499 9.375C8.75693 9.375 8.15274 9.19172 7.63884 8.84834C7.12493 8.50496 6.72439 8.01691 6.48787 7.44589C6.25134 6.87487 6.18946 6.24653 6.31004 5.64034C6.43062 5.03415 6.72824 4.47733 7.16528 4.04029C7.60232 3.60325 8.15914 3.30562 8.76533 3.18505C9.37152 3.06447 9.99986 3.12635 10.5709 3.36288C11.1419 3.5994 11.63 3.99994 11.9733 4.51384C12.3167 5.02775 12.5 5.63193 12.5 6.25C12.5 7.0788 12.1708 7.87366 11.5847 8.45971C10.9986 9.04576 10.2038 9.375 9.37499 9.375Z" fill="currentColor"/>' +
    '</svg>';

  var ICON_EYE_OFF =
    '<svg width="18.75" height="15.0111" viewBox="0 0 18.75 15.0111" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M6.92812 2.02664C6.89121 1.98621 6.86557 1.93678 6.85377 1.88332C6.84197 1.82987 6.84441 1.77424 6.86087 1.72203C6.87733 1.66981 6.90721 1.62284 6.94753 1.5858C6.98785 1.54877 7.03719 1.52298 7.09062 1.51101C7.83997 1.33977 8.60632 1.25407 9.37499 1.25555C12.1 1.25555 14.5758 2.29148 16.5359 4.25164C18.007 5.72273 18.6687 7.1907 18.6961 7.25242C18.7316 7.33235 18.75 7.41885 18.75 7.50633C18.75 7.5938 18.7316 7.6803 18.6961 7.76023C18.6687 7.82195 18.007 9.28914 16.5359 10.7602C16.313 10.9821 16.0841 11.1923 15.8492 11.3907C15.7874 11.4432 15.7076 11.4696 15.6267 11.4643C15.5458 11.4591 15.4701 11.4226 15.4156 11.3626L6.92812 2.02664ZM16.0875 13.9602C16.1438 14.0208 16.1876 14.0919 16.2163 14.1695C16.245 14.247 16.2579 14.3295 16.2545 14.4122C16.251 14.4948 16.2312 14.5759 16.1962 14.6509C16.1611 14.7258 16.1116 14.793 16.0504 14.8486C15.9892 14.9042 15.9175 14.9472 15.8396 14.9749C15.7617 15.0026 15.679 15.0146 15.5965 15.0102C15.5139 15.0057 15.433 14.985 15.3585 14.949C15.284 14.9131 15.2174 14.8627 15.1625 14.8009L13.4375 12.9063C12.1582 13.4722 10.7738 13.7615 9.37499 13.7555C6.64999 13.7555 4.17421 12.7196 2.21405 10.7602C0.742961 9.28914 0.0781175 7.82195 0.0538988 7.76023C0.0183622 7.6803 0 7.5938 0 7.50633C0 7.41885 0.0183622 7.33235 0.0538988 7.25242C0.0781175 7.19305 0.742961 5.72273 2.21405 4.25164C2.80178 3.66121 3.45739 3.14249 4.16718 2.70633L2.66249 1.05086C2.60614 0.990322 2.56236 0.919203 2.53369 0.841623C2.50503 0.764043 2.49204 0.681544 2.4955 0.59891C2.49895 0.516275 2.51877 0.435148 2.55381 0.360229C2.58884 0.28531 2.6384 0.218091 2.69961 0.162467C2.76082 0.106842 2.83246 0.0639196 2.91037 0.0361859C2.98829 0.00845229 3.07094 -0.00354051 3.15353 0.000902525C3.23611 0.00534556 3.317 0.0261362 3.39149 0.0620693C3.46599 0.0980023 3.53261 0.148363 3.58749 0.210233L16.0875 13.9602ZM10.9711 10.1907L6.85468 5.65945C6.43051 6.24062 6.21988 6.95036 6.25835 7.66882C6.29682 8.38729 6.58203 9.07047 7.06583 9.60303C7.54963 10.1356 8.20237 10.4849 8.91386 10.5919C9.62535 10.699 10.352 10.5573 10.9711 10.1907Z" fill="currentColor"/>' +
    '</svg>';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  var USERNAME_RE = /^[a-z0-9_]{3,20}$/i;
  var TAKEN_USERNAMES = ['username'];

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };


  /* =======================================================
     Fit the mockup into the viewport
     ======================================================= */

  var DEV_W = 414, DEV_H = 876;

  function measure() {
    var root  = document.documentElement;
    var stage = $('.stage');
    var cs = getComputedStyle(stage);
    var chromeH = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
                  parseFloat(cs.rowGap || cs.gap || 0) + $('.stage__logo').offsetHeight;
    var chromeW = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);

    var scale = Math.min(
      1,
      (root.clientHeight - chromeH) / DEV_H,
      (root.clientWidth - chromeW) / DEV_W
    );

    root.style.setProperty('--dev-scale', Math.max(scale, .3).toFixed(4));
  }

  // two passes: the logo shrinks with the scale, so the second pass
  // settles on the final chrome height
  function fitDevice() {
    measure();
    requestAnimationFrame(measure);
  }

  fitDevice();
  window.addEventListener('resize', fitDevice);
  window.addEventListener('orientationchange', fitDevice);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitDevice);


  /* =======================================================
     Screen navigation
     ======================================================= */

  var screens = $$('[data-screen]');
  var bg = $('[data-bg]');
  var current = 'welcome';
  var SCREEN_STORAGE_KEY = 'the90.currentScreen';

  function rememberScreen(name) {
    try { localStorage.setItem(SCREEN_STORAGE_KEY, name); } catch (error) { /* storage may be unavailable */ }
  }

  function savedScreen() {
    try { return localStorage.getItem(SCREEN_STORAGE_KEY); } catch (error) { return null; }
  }

  function showScreen(name) {
    if (name === current) return;

    screens.forEach(function (s) {
      var isTarget = s.dataset.screen === name;
      if (s.dataset.screen === current) {
        s.classList.add('is-leaving');
        setTimeout(function () { s.classList.remove('is-leaving'); }, 320);
      }
      s.classList.toggle('is-active', isTarget);
    });

    bg.classList.toggle('app__bg--hero', name === 'welcome');
    var shellFooter = $('[data-shell-footer]');
    if (shellFooter) {
      var isSettings = name.indexOf('settings') === 0;
      var isNotifications = name === 'notifications';
      var isLeagueScreen = name === 'league' || name === 'league-chat' || name === 'league-rules';
      var isMyZoneSubpage = isNotifications || name === 'invite-friends' ||
        name === 'support' || name === 'support-contact' || name === 'support-requests' ||
        name === 'ranks';
      var isLiveMatch = name === 'live-match';
      var isArenaTournament = name === 'arena-tournament';
      var appSection = name === 'main' || name === 'rankings' || name === 'arena' || isArenaTournament || name === 'leagues' || name === 'my-zone' || isMyZoneSubpage || isLeagueScreen || isSettings || isLiveMatch;
      shellFooter.classList.toggle('is-visible', appSection);
      shellFooter.classList.toggle('is-my-zone', name === 'my-zone' || isMyZoneSubpage);
      shellFooter.classList.toggle('is-settings', isSettings);
      shellFooter.classList.toggle('is-rankings', name === 'rankings');
      shellFooter.classList.toggle('is-arena', name === 'arena' || isArenaTournament);
      shellFooter.classList.toggle('is-leagues', name === 'leagues');
      shellFooter.classList.toggle('is-league', name === 'league');
      shellFooter.classList.toggle('is-league-chat', name === 'league-chat');
      shellFooter.classList.toggle('is-league-rules', name === 'league-rules');
      shellFooter.classList.toggle('is-live-match', isLiveMatch);
      $$('[data-nav]', shellFooter).forEach(function (nav) {
        var activeName = (isSettings || isMyZoneSubpage) ? 'my-zone' :
          (isLeagueScreen ? 'leagues' : ((isLiveMatch ? 'main' : (isArenaTournament ? 'arena' : name))));
        var active = nav.dataset.nav === activeName;
        nav.classList.toggle('is-active', active);
        if (active) nav.setAttribute('aria-current', 'page');
        else nav.removeAttribute('aria-current');
      });
    }
    current = name;
    rememberScreen(name);

    window.dispatchEvent(new CustomEvent('the90:screen', { detail: name }));
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-go]');
    if (!trigger) return;
    e.preventDefault();
    showScreen(trigger.dataset.go);
  });

  // gestures need the router too, not just [data-go] controls
  if (window.THE90) window.THE90.go = showScreen;

  // welcome screen loads with the sharp hero
  bg.classList.add('app__bg--hero');

  window.addEventListener('DOMContentLoaded', function () {
    var saved = savedScreen();
    var exists = saved && screens.some(function (screen) { return screen.dataset.screen === saved; });
    if (exists && saved !== current) showScreen(saved);
  });


  /* =======================================================
     Fields
     ======================================================= */

  var MESSAGES = {
    email:    'Enter a valid email address.',
    required: 'Enter your password.',
    password: 'Use 8+ characters with letters, numbers and symbols.',
    confirm:  'Passwords do not match.',
    username: 'Use 3–20 letters, numbers or underscores.'
  };

  function validate(field) {
    var input = $('.field__input', field);
    var rule  = field.dataset.validate;
    var value = input.value;

    if (!value) return { state: 'empty' };

    switch (rule) {
      case 'email':
        return EMAIL_RE.test(value.trim())
          ? { state: 'valid' }
          : { state: 'error', msg: MESSAGES.email };

      case 'password':
        var strong = value.length >= 8 &&
                     /[a-z]/i.test(value) &&
                     /\d/.test(value) &&
                     /[^A-Za-z0-9]/.test(value);
        return strong
          ? { state: 'valid' }
          : { state: 'error', msg: MESSAGES.password };

      case 'confirm':
        var form = field.closest('form');
        var pwd  = $('.field__input[name="password"]', form);
        return (pwd && pwd.value === value)
          ? { state: 'valid' }
          : { state: 'error', msg: MESSAGES.confirm };

      case 'username':
        var username = value.trim().replace(/^@/, '');
        if (!USERNAME_RE.test(username)) return { state: 'error', msg: MESSAGES.username };
        if (TAKEN_USERNAMES.indexOf(username.toLowerCase()) !== -1) {
          return { state: 'error', msg: '@' + username + ' is already taken.' };
        }
        return { state: 'valid', msg: '@' + username + ' is available.' };

      default:
        return { state: 'valid' };
    }
  }

  function paint(field, result) {
    var msgEl = $('[data-msg]', field);
    var hint  = field.dataset.hint;

    field.classList.toggle('is-valid', result.state === 'valid');
    field.classList.toggle('is-error', result.state === 'error');

    if (!msgEl) return;
    if (result.state === 'error') {
      msgEl.textContent = result.msg || '';
    } else if (result.state === 'valid' && result.msg) {
      msgEl.textContent = result.msg;
    } else {
      msgEl.textContent = hint || '';
    }
  }

  function refresh(field, opts) {
    var result = validate(field);

    // while typing, never flip a pristine field straight to error —
    // only clear an error once it is fixed
    if (result.state === 'error' && opts && opts.soft && !field.classList.contains('is-error')) {
      field.classList.remove('is-valid');
      return result;
    }

    if (result.state === 'empty') {
      field.classList.remove('is-valid', 'is-error');
      var msgEl = $('[data-msg]', field);
      if (msgEl) msgEl.textContent = field.dataset.hint || '';
      return result;
    }

    paint(field, result);
    return result;
  }

  $$('[data-field]').forEach(function (field) {
    var input = $('.field__input', field);
    var msgEl = $('[data-msg]', field);
    var eye   = $('[data-eye]', field);

    if (msgEl && msgEl.textContent.trim()) field.dataset.hint = msgEl.textContent.trim();

    input.addEventListener('focus', function () { field.classList.add('is-active'); });

    input.addEventListener('blur', function () {
      field.classList.remove('is-active');
      refresh(field);
    });

    input.addEventListener('input', function () {
      refresh(field, { soft: field.dataset.validate !== 'username' });

      // keep "confirm" in sync while the source password changes
      if (input.name === 'password') {
        var form = field.closest('form');
        var confirmField = form && $('[data-validate="confirm"]', form);
        if (confirmField && $('.field__input', confirmField).value) {
          refresh(confirmField, { soft: true });
        }
      }
    });

    if (eye) {
      eye.innerHTML = ICON_EYE;
      eye.addEventListener('click', function () {
        var shown = input.type === 'text';
        input.type = shown ? 'password' : 'text';
        eye.innerHTML = shown ? ICON_EYE : ICON_EYE_OFF;
        eye.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
        input.focus();
      });
    }
  });


  /* =======================================================
     Submit
     ======================================================= */

  function shake(field) {
    field.classList.remove('is-shake');
    void field.offsetWidth;
    field.classList.add('is-shake');
  }

  $$('[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var ok = true;
      var firstBad = null;
      var demoBypass = form.dataset.form === 'create' || form.dataset.form === 'signin';

      if (!demoBypass) $$('[data-field]', form).forEach(function (field) {
        var input  = $('.field__input', field);
        var result = validate(field);

        if (result.state === 'empty') {
          result = { state: 'error', msg: MESSAGES[field.dataset.validate] || 'This field is required.' };
        }

        paint(field, result);

        if (result.state !== 'valid') {
          ok = false;
          shake(field);
          if (!firstBad) firstBad = input;
        }
      });

      // required checkbox (Terms & Conditions)
      var reqCheck = demoBypass ? null : $('[data-required-check]', form);
      if (reqCheck) {
        var box = reqCheck.closest('.check');
        box.classList.toggle('is-error', !reqCheck.checked);
        if (!reqCheck.checked) ok = false;
      }

      if (!ok) {
        if (firstBad) firstBad.focus();
        return;
      }

      var btn = $('button[type="submit"]', form);
      var idleLabel = btn.textContent;
      btn.classList.add('is-disabled');
      btn.textContent = 'Please wait…';

      setTimeout(function () {
        btn.classList.remove('is-disabled');
        btn.textContent = idleLabel;
        showScreen(form.dataset.form === 'create' ? 'profile' :
                   form.dataset.form === 'profile' ? 'teams' : 'main');
      }, 700);
    });
  });

  $$('[data-required-check]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      if (cb.checked) cb.closest('.check').classList.remove('is-error');
    });
  });


  /* =======================================================
     Profile setup + favourite club
     ======================================================= */

  var avatarInput = $('[data-avatar-input]');
  if (avatarInput) {
    avatarInput.addEventListener('change', function () {
      var file = avatarInput.files && avatarInput.files[0];
      if (!file || !file.type.match(/^image\//)) return;
      var reader = new FileReader();
      reader.onload = function () {
        var preview = $('[data-avatar-preview]');
        preview.style.backgroundImage = 'url("' + reader.result + '")';
        preview.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    });
  }

  var PROFILE_CLUBS = [
    ['arsenal','Arsenal'], ['real-madrid','Real Madrid'], ['barcelona','Barcelona'],
    ['man-united','Man United'], ['bayern','Bayern Munich'], ['liverpool','Liverpool'],
    ['chelsea','Chelsea'], ['dortmund','Dortmund'], [null,'PSG'],
    [null,'Manchester City'], [null,'Tottenham'], [null,'AC Milan'],
    [null,'Inter Milan'], [null,'Juventus'], [null,'Napoli'],
    [null,'Ajax'], [null,'PSV Eindhoven'], [null,'Atlético Madrid'],
    [null,'Benfica'], [null,'Marseille']
  ];
  var clubsExpanded = false;
  var clubQuery = '';
  var selectedClubs = [];
  var clubGrid = $('[data-club-grid]');

  function initials(name) {
    return name.split(/\s+/).map(function (part) { return part[0]; }).join('').slice(0, 3).toUpperCase();
  }

  function renderProfileClubs() {
    if (!clubGrid) return;
    var filtered = PROFILE_CLUBS.filter(function (club) {
      return club[1].toLowerCase().indexOf(clubQuery) !== -1;
    });
    if (!clubQuery && !clubsExpanded) filtered = filtered.slice(0, 9);
    clubGrid.innerHTML = filtered.map(function (club) {
      var visual = club[0]
        ? '<img class="club-option__logo" src="assets/clubs/' + club[0] + '.png" alt="">'
        : '<span class="club-option__logo">' + initials(club[1]) + '</span>';
      var isSelected = selectedClubs.indexOf(club[1]) !== -1;
      return '<button class="club-option' + (isSelected ? ' is-selected' : '') +
             '" type="button" aria-pressed="' + isSelected + '" data-club="' + club[1] + '">' + visual +
             '<span class="club-option__name">' + club[1] + '</span></button>';
    }).join('');
  }

  if (clubGrid) {
    renderProfileClubs();
    clubGrid.addEventListener('click', function (e) {
      var option = e.target.closest('[data-club]');
      if (!option) return;
      var clubName = option.dataset.club;
      var selectedIndex = selectedClubs.indexOf(clubName);
      if (selectedIndex === -1) selectedClubs.push(clubName);
      else selectedClubs.splice(selectedIndex, 1);
      renderProfileClubs();
    });
    $('[data-club-search]').addEventListener('input', function (e) {
      clubQuery = e.target.value.trim().toLowerCase();
      renderProfileClubs();
    });
    $('[data-clubs-toggle]').addEventListener('click', function (e) {
      clubsExpanded = true;
      e.currentTarget.closest('.content--teams').classList.add('is-expanded');
      e.currentTarget.hidden = true;
      renderProfileClubs();
    });
    $('[data-team-continue]').addEventListener('click', function () { showScreen('main'); });
  }


  /* =======================================================
     Sponsored banner carousel
     ======================================================= */

  var adSlides = $$('[data-ad] .ad__slide');
  var adDots = $$('[data-ad-dots] button');
  var adTrack = $('[data-ad-track]');
  var adIndex = 0;
  var adAutoTimer;
  function showAd(index) {
    if (!adSlides.length || !adTrack) return;
    adIndex = (index + adSlides.length) % adSlides.length;
    adDots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === adIndex); });
    adTrack.scrollTo({ left: adIndex * adTrack.clientWidth, behavior: 'smooth' });
  }
  function restartAdAuto() {
    clearInterval(adAutoTimer);
    if (adSlides.length) adAutoTimer = setInterval(function () { showAd(adIndex + 1); }, 4000);
  }
  adDots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { showAd(i); restartAdAuto(); });
  });
  if (adTrack) {
    var adScrollFrame;
    adTrack.addEventListener('scroll', function () {
      cancelAnimationFrame(adScrollFrame);
      adScrollFrame = requestAnimationFrame(function () {
        var index = Math.round(adTrack.scrollLeft / Math.max(adTrack.clientWidth, 1));
        if (index === adIndex) return;
        adIndex = index;
        adDots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === adIndex); });
      });
    }, { passive: true });

    var adDragX = 0;
    var adDragScroll = 0;
    var adDragging = false;
    adTrack.addEventListener('pointerdown', function (event) {
      clearInterval(adAutoTimer);
      if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return;
      adDragging = true;
      adDragX = event.clientX;
      adDragScroll = adTrack.scrollLeft;
      adTrack.classList.add('is-dragging');
      adTrack.setPointerCapture(event.pointerId);
    });
    adTrack.addEventListener('pointermove', function (event) {
      if (!adDragging) return;
      adTrack.scrollLeft = adDragScroll - (event.clientX - adDragX);
    });
    function endAdDrag() {
      if (!adDragging) return;
      adDragging = false;
      adTrack.classList.remove('is-dragging');
      showAd(Math.round(adTrack.scrollLeft / Math.max(adTrack.clientWidth, 1)));
    }
    adTrack.addEventListener('pointerup', function () { endAdDrag(); restartAdAuto(); });
    adTrack.addEventListener('pointercancel', function () { endAdDrag(); restartAdAuto(); });
  }
  restartAdAuto();


  /* =======================================================
     Welcome carousel dots
     ======================================================= */

  var dotsWrap = $('[data-dots]');
  if (dotsWrap) {
    var dots = $$('.dots__dot', dotsWrap);
    var welcomeBackgrounds = $$('[data-welcome-bg]');
    var welcomeCopy = $('[data-welcome-copy]');
    var welcomeTitle = $('[data-welcome-title]');
    var welcomeSubtitle = $('[data-welcome-subtitle]');
    var welcomeOffers = [
      {
        title: 'Bet<br>Smarter.',
        subtitle: 'Make every match count with sharp picks, live stats and instant rewards.'
      },
      {
        title: 'Feel Every<br>Match.',
        subtitle: 'Follow the action live, predict the score and climb the rankings.'
      },
      {
        title: 'Pick. Play.<br>Win.',
        subtitle: 'Build your daily picks and turn your football knowledge into points.'
      },
      {
        title: 'Your Game.<br>Your Zone.',
        subtitle: 'Back your favourite clubs, collect achievements and own the season.'
      }
    ];
    var idx = 0;
    var timer;

    function go(i) {
      idx = (i + dots.length) % dots.length;
      dots.forEach(function (d, n) { d.classList.toggle('is-active', n === idx); });
      welcomeBackgrounds.forEach(function (image, n) {
        var active = n === idx;
        image.classList.toggle('is-active', active);
        image.style.opacity = active ? '1' : '0';
        image.style.zIndex = active ? '1' : '0';
      });

      var offer = welcomeOffers[idx];
      if (offer && welcomeTitle && welcomeSubtitle) {
        welcomeTitle.innerHTML = offer.title;
        welcomeSubtitle.textContent = offer.subtitle;
        welcomeCopy.classList.remove('is-changing');
        void welcomeCopy.offsetWidth;
        welcomeCopy.classList.add('is-changing');
      }
    }

    function auto() {
      clearInterval(timer);
      timer = setInterval(function () {
        if (current === 'welcome') go(idx + 1);
      }, 3500);
    }

    dots.forEach(function (d, n) {
      d.addEventListener('click', function () { go(n); auto(); });
    });

    go(0);
    auto();
  }

})();
