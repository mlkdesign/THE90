/* THE90 — THEARENA join confirmation sheet */
(function () {
  'use strict';

  var modal = document.querySelector('[data-arena-join-modal]');
  var arena = document.querySelector('[data-screen="arena"]');
  if (!modal || !arena) return;

  var track = modal.querySelector('[data-arena-join-track]');
  var confirmButton = modal.querySelector('[data-arena-join-confirm]');
  var goButton = modal.querySelector('[data-arena-go-tournament]');
  var successArt = modal.querySelector('[data-arena-join-success-art]');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = null;
  var closeTimer = null;
  var successAnimation = null;
  var lottieScript = null;

  function select(name) {
    return modal.querySelector('[data-arena-join-' + name + ']');
  }

  function setText(name, value) {
    var node = select(name);
    if (node) node.textContent = value;
  }

  function textFrom(card, selector, fallback) {
    var node = card && card.querySelector(selector);
    return node ? node.textContent.trim() : fallback;
  }

  function entryFromLabel(label) {
    var value = (label || '').replace(/^join\s+for\s+/i, '').trim();
    if (!value || /^free$/i.test(value)) return 'Free';
    return value;
  }

  function cardInfo(id) {
    var card = arena.querySelector('[data-tournament-id="' + id + '"]');
    var tournament = window.THE90 && typeof window.THE90.getArenaTournament === 'function'
      ? window.THE90.getArenaTournament(id)
      : null;
    var detailTitle = document.querySelector('[data-tournament-title]');
    var detailDescription = document.querySelector('[data-tournament-description]');
    var detailKind = document.querySelector('[data-tournament-kind]');
    var detailParticipants = document.querySelector('[data-tournament-participants]');
    var detailRounds = document.querySelector('[data-tournament-rounds]');
    var detailTime = document.querySelector('[data-tournament-time]');
    var art = card && card.querySelector('.thearena-tournament__art img, .thearena-featured__cover img');
    var tag = card && card.querySelector('.thearena-tag');
    var join = card && card.querySelector('[data-arena-join]');
    var participants = tournament ? tournament.participants : textFrom(card, '.thearena-tournament__bottom dl > div:first-child dt', detailParticipants ? detailParticipants.textContent.trim() : '0');
    var rounds = tournament ? tournament.rounds : textFrom(card, '.thearena-tournament__bottom dl > div:nth-child(2) dt', detailRounds ? detailRounds.textContent.trim() : '0');
    var title = tournament ? tournament.title : textFrom(card, '.thearena-tournament__copy h3, .thearena-featured__copy h3', detailTitle ? detailTitle.textContent.trim() : 'Tournament');
    var description = tournament ? tournament.description : textFrom(card, '.thearena-tournament__copy p, .thearena-featured__copy p', detailDescription ? detailDescription.textContent.trim() : 'Make your predictions and compete for prizes.');
    var kind = tournament ? tournament.label : (tag ? tag.textContent.trim() : (detailKind ? detailKind.textContent.trim() : 'Open'));

    var live = tournament ? !!tournament.live : !!(card && card.dataset.tournamentPhase === 'live');
    var liveTime = '45h 35m';
    if (tournament && tournament.liveEndsAt) {
      var minutesLeft = Math.max(0, Math.ceil((tournament.liveEndsAt - Date.now()) / 60000));
      liveTime = Math.floor(minutesLeft / 60) + 'h ' + String(minutesLeft % 60).padStart(2, '0') + 'm';
    }

    return {
      id: id,
      card: card,
      title: title,
      description: description,
      kind: kind,
      kindType: tournament ? tournament.kind : (card ? card.dataset.arenaKind : (detailKind && detailKind.className.match(/thearena-tag--([\w-]+)/) || [])[1]),
      cover: art ? art.src : 'assets/arena/thearena-tournament-hero.png',
      participants: participants,
      capacity: tournament && tournament.capacity ? tournament.capacity : '40',
      rounds: rounds,
      live: live,
      time: live ? liveTime
        : textFrom(card, '.thearena-time', detailTime ? detailTime.textContent.trim() : '2d 14h'),
      entry: tournament && tournament.entry ? tournament.entry : entryFromLabel(join ? join.textContent : 'Free')
    };
  }

  function resetSheet() {
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = null;
    modal.classList.remove('is-closing', 'is-success');
    if (track) track.style.transitionDuration = '';
  }

  function openJoinSheet(id) {
    var info = cardInfo(id);
    if (!info.id || (info.card && info.card.dataset.tournamentState === 'locked')) return;

    current = info;
    var cover = select('cover');
    var kind = select('kind');
    if (cover) cover.src = info.cover;
    if (kind) {
      kind.textContent = info.kind;
      kind.className = 'thearena-tag thearena-tag--' + (info.kindType || 'open');
    }
    setText('title', info.title);
    setText('description', info.description);
    setText('participants', info.participants);
    setText('capacity', info.capacity);
    setText('rounds', info.rounds);
    setText('time-label', info.live ? 'Ends in' : 'Starts in');
    setText('time', info.time);
    setText('entry', info.entry);
    setText('success-title', info.title);

    resetSheet();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(function () {
      var close = modal.querySelector('.arena-join-modal__close');
      if (close) close.focus({ preventScroll: true });
    });
  }

  function finishClose() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-closing', 'is-success');
  }

  function closeJoinSheet() {
    if (modal.hidden) return;
    if (prefersReducedMotion.matches) {
      finishClose();
      return;
    }
    modal.classList.add('is-closing');
    closeTimer = window.setTimeout(finishClose, 220);
  }

  function withPicksDoneData(callback) {
    if (window.THE90_PICKS_DONE) {
      callback(window.THE90_PICKS_DONE);
      return;
    }
    if (lottieScript) {
      lottieScript.addEventListener('load', function () { callback(window.THE90_PICKS_DONE); }, { once: true });
      lottieScript.addEventListener('error', function () { callback(null); }, { once: true });
      return;
    }
    lottieScript = document.querySelector('script[src="assets/lottie/picks-done.js"]');
    var isNewScript = !lottieScript;
    if (isNewScript) {
      lottieScript = document.createElement('script');
      lottieScript.src = 'assets/lottie/picks-done.js';
      lottieScript.dataset.arenaJoinLottie = 'true';
    }
    lottieScript.addEventListener('load', function () { callback(window.THE90_PICKS_DONE); }, { once: true });
    lottieScript.addEventListener('error', function () { callback(null); }, { once: true });
    if (isNewScript) document.head.appendChild(lottieScript);
  }

  function playSuccessAnimation() {
    if (!successArt || !window.lottie) return;
    if (successAnimation) {
      successAnimation.goToAndPlay(0, true);
      return;
    }
    withPicksDoneData(function (data) {
      if (!data || successAnimation || !window.lottie) return;
      successArt.replaceChildren();
      successAnimation = window.lottie.loadAnimation({
        container: successArt,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: data
      });
    });
  }

  function markTournamentJoined() {
    if (!current) return;
    var cards = arena.querySelectorAll('[data-tournament-id="' + current.id + '"]');
    Array.prototype.forEach.call(cards, function (card) {
      card.dataset.tournamentState = 'joined';
      var button = card.querySelector('[data-arena-join]');
      if (!button || button.classList.contains('is-locked')) return;
      button.classList.add('is-joined');
      button.textContent = 'Joined';
      button.setAttribute('aria-pressed', 'true');
    });
    document.dispatchEvent(new CustomEvent('the90:tournamentjoined', { detail: { id: current.id } }));
  }

  function showSuccess() {
    if (!current) return;
    markTournamentJoined();
    modal.classList.add('is-success');
    window.setTimeout(playSuccessAnimation, prefersReducedMotion.matches ? 0 : 160);
    if (goButton) goButton.focus({ preventScroll: true });
  }

  function goToTournament() {
    var id = current && current.id;
    finishClose();
    if (id && window.THE90 && typeof window.THE90.openTournament === 'function') {
      window.THE90.openTournament(id);
    }
  }

  Array.prototype.forEach.call(modal.querySelectorAll('[data-arena-join-dismiss]'), function (button) {
    button.addEventListener('click', closeJoinSheet);
  });
  if (confirmButton) confirmButton.addEventListener('click', showSuccess);
  if (goButton) goButton.addEventListener('click', goToTournament);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) closeJoinSheet();
  });

  window.THE90 = window.THE90 || {};
  window.THE90.openArenaJoinModal = openJoinSheet;
})();
