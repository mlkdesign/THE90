/* THE90 — THEARENA tournament detail */
(function () {
  'use strict';

  var arena = document.querySelector('[data-screen="arena"]');
  var screen = document.querySelector('[data-screen="arena-tournament"]');
  if (!arena || !screen) return;

  var tournaments = {
    'diamond-cup': {
      title: 'DIAMOND CUP', kind: 'sponsored', label: 'Sponsored', joined: true, live: true, liveMinutes: 2735,
      participants: 240, capacity: 400, entry: 'Free', currentRound: 3, rounds: 5, place: '#96',
      roundMatch: { home: 'arsenal', away: 'barcelona' },
      description: 'Exclusive VIP tournament · 5 rounds of top matches · branded sponsor prizes',
      about: 'Diamond Cup is a closed VIP tournament with 5 rounds of top matches. Predict outcomes, earn points and compete for amazing prizes from our sponsor.'
    },
    'weekend-spotlight': {
      title: 'WEEKEND CHALLENGE', kind: 'open', label: 'Open', joined: true, live: true, liveMinutes: 2735,
      participants: 40, capacity: 40, entry: 'Free', currentRound: 2, rounds: 5, place: '#12',
      roundMatch: { home: 'real-madrid', away: 'bayern' },
      description: 'Predict top matches this weekend and compete for exclusive prizes',
      about: 'Weekend Challenge brings together the biggest matches of the week. Make your predictions, earn points and chase a place among the best predictors.'
    },
    'final-whistle': {
      title: 'FINAL WHISTLE', kind: 'sponsored', label: 'Sponsored', joined: true, live: true, liveMinutes: 2735,
      participants: 32, capacity: 40, entry: 'Free', currentRound: 1, rounds: 3, place: '#3',
      roundMatch: { home: 'liverpool', away: 'dortmund' },
      description: 'Join the sponsor cup and make your picks before the final kickoff',
      about: 'Final Whistle is the sponsor cup for the final weekend. Every pick counts as you compete across three decisive rounds.'
    },
    'weekend-challenge': {
      title: 'WEEKEND CHALLENGE', kind: 'open', label: 'Open', joined: false,
      participants: 15, capacity: 40, entry: 'Free', currentRound: 0, rounds: 5, place: '#10',
      description: 'Guess the outcomes of top matches and win cool prizes',
      about: 'Make your picks for the weekend’s biggest games. Join before the first deadline to collect points in every round.'
    },
    'ranked-rush': {
      title: 'RANKED RUSH', kind: 'ranked', label: 'Ranked', joined: false,
      participants: 12, capacity: 40, entry: '3€', currentRound: 0, rounds: 5, place: '#18',
      description: 'A ranked tournament for players ready to climb the leaderboard',
      about: 'Ranked Rush rewards consistent predictions. Every point improves your tournament position and brings you closer to the prize places.'
    }
  };

  var activeId = 'diamond-cup';
  var activeTab = 'events';
  var scroll = screen.querySelector('[data-tournament-scroll]');
  var tabsSticky = screen.querySelector('.arena-tournament-tabs-sticky');
  var tabs = screen.querySelector('[data-tournament-tabs]');
  var tabIndicator = screen.querySelector('[data-tournament-tab-indicator]');
  var tabButtons = Array.prototype.slice.call(screen.querySelectorAll('[data-tournament-tab]'));
  var panels = Array.prototype.slice.call(screen.querySelectorAll('[data-tournament-panel]'));
  var panelScroller = screen.querySelector('[data-tournament-panels]');
  var activeIndex = 0;
  var committedIndex = -1;
  var desiredPanelPosition = 0;
  var panelScrollFrame = null;
  var panelAnimationFrame = null;
  var tabFiller = 0;
  var tabFillerIndex = -1;
  var tabChanging = false;
  var panelOffsets = [];
  var pageOwner = 0;
  var liveCountdownTimer = null;
  var title = screen.querySelector('[data-tournament-title]');
  var kind = screen.querySelector('[data-tournament-kind]');
  var description = screen.querySelector('[data-tournament-description]');
  var about = screen.querySelector('[data-tournament-about]');
  var participants = screen.querySelector('[data-tournament-participants]');
  var time = screen.querySelector('[data-tournament-time]');
  var timeLabel = screen.querySelector('[data-tournament-time-label]');
  var rounds = screen.querySelector('[data-tournament-rounds]');
  var roundTotal = screen.querySelector('[data-tournament-round-total]');
  var entry = screen.querySelector('[data-tournament-entry]');
  var place = screen.querySelector('[data-tournament-place]');
  var join = screen.querySelector('[data-tournament-join]');
  var rankingPodium = screen.querySelector('[data-tournament-ranking-podium]');
  var rankingList = screen.querySelector('[data-tournament-rankings-list]');
  var more = screen.querySelector('[data-tournament-more]');
  var eventItems = Array.prototype.slice.call(screen.querySelectorAll('[data-tournament-event]'));
  var roundPickStates = {};
  var activeRoundPick = null;
  var sharedPickBar = window.THE90 && window.THE90.pickConfirmationBar;
  var lastTournamentScrollTop = scroll ? scroll.scrollTop : 0;
  /* Big enough that the board has to fold: a tournament is not a league. */
  var TOURNAMENT_PLAYER_COUNT = 240;
  var YOUR_TOURNAMENT_RANK = 96;

  function yourTournamentRank() {
    var tournament = currentTournament();
    if (!tournament.joined) return null;
    return Number(String(tournament.place).replace('#', '')) || YOUR_TOURNAMENT_RANK;
  }
  var rankingAvatars = [
    'assets/invite/avatar-zara.png',
    'assets/invite/avatar-kai.png',
    'assets/support/banner-person.png',
    'assets/invite/profile-person.png',
    'assets/invite/screen-person.png'
  ];
  var rankingNames = [
    ['Mika Chen', '@mikac'], ['Alex Rivera', '@alexr'], ['Leo Hart', '@leoh'],
    ['Zara Volkov', '@zarav'], ['Kai Tanaka', '@kait'], ['Nina Okafor', '@ninao'],
    ['Sam Moreau', '@samm'], ['Juno Park', '@junop'], ['Ravi Patel', '@ravip'],
    ['Liam Becker', '@liamb'], ['Emma Silva', '@emmas'], ['Mateo Rossi', '@mateor'],
    ['Olivia Costa', '@oliviac'], ['Noah Kim', '@noahk'], ['Ava Dubois', '@avad'],
    ['Lucas Novak', '@lucasn'], ['Mia Wilson', '@miaw'], ['Theo Santos', '@theos'],
    ['Lina Petrov', '@linap'], ['Hugo Garcia', '@hugog']
  ];

  function currentTournament() {
    return tournaments[activeId] || tournaments['diamond-cup'];
  }

  function formatTournamentCountdown(milliseconds) {
    var minutes = Math.max(0, Math.ceil(milliseconds / 60000));
    var hours = Math.floor(minutes / 60);
    return hours + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
  }

  function renderTournamentTime(tournament) {
    if (!timeLabel || !time) return;
    if (!tournament.live) {
      timeLabel.textContent = 'Starts in';
      time.textContent = '2d 14h';
      return;
    }
    if (!tournament.liveEndsAt) {
      tournament.liveEndsAt = Date.now() + (tournament.liveMinutes || 2735) * 60000;
    }
    timeLabel.textContent = 'Ends in';
    time.textContent = formatTournamentCountdown(tournament.liveEndsAt - Date.now());
  }

  function startLiveCountdown(tournament) {
    if (liveCountdownTimer) window.clearInterval(liveCountdownTimer);
    liveCountdownTimer = null;
    if (!tournament.live) return;
    liveCountdownTimer = window.setInterval(function () {
      if (currentTournament().live) renderTournamentTime(currentTournament());
    }, 30000);
  }

  function updateArenaCard(id) {
    Array.prototype.slice.call(arena.querySelectorAll('[data-tournament-id="' + id + '"]')).forEach(function (card) {
      card.dataset.tournamentState = 'joined';
      var button = card.querySelector('[data-arena-join]');
      if (button && !button.classList.contains('is-locked')) {
        button.classList.add('is-joined');
        button.textContent = 'Joined';
        button.setAttribute('aria-pressed', 'true');
      }
    });
  }

  function rankingScore(rank) {
    return Math.round(2480 * Math.pow(.947, rank - 1));
  }

  function formatScore(score) {
    var board = window.THE90 && window.THE90.board;
    if (board && board.format) return board.format(score);
    return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function tournamentUser(rank, tournament) {
    var yourRank = tournament.joined ? Number(tournament.place.replace('#', '')) : 0;
    if (rank === yourRank) {
      return { name: 'Your Name', handle: '@yournickname', avatar: 'assets/img/avatar.png', isYou: true };
    }
    var seed = rankingNames[rank - 1] || ['Tournament Player ' + rank, '@player' + rank];
    return {
      name: seed[0],
      handle: seed[1],
      avatar: rankingAvatars[(rank - 1) % rankingAvatars.length]
    };
  }

  function makeScore(score, className) {
    var result = document.createElement('span');
    result.className = className;
    result.appendChild(document.createTextNode(formatScore(score) + ' '));
    var crown = document.createElement('img');
    crown.src = 'assets/notifications/crown.svg';
    crown.alt = '';
    crown.width = 14;
    crown.height = 12;
    result.appendChild(crown);
    return result;
  }

  function makePodiumUser(rank, placement, tournament) {
    var user = tournamentUser(rank, tournament);
    var card = document.createElement('article');
    card.className = 'rankings-podium__user rankings-podium__user--' + placement;

    var avatar = document.createElement('img');
    avatar.src = user.avatar;
    avatar.alt = user.name;
    var name = document.createElement('strong');
    name.textContent = user.name;
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(makeScore(rankingScore(rank), ''));
    return card;
  }

  function makeRankingRow(rank, tournament) {
    var user = tournamentUser(rank, tournament);
    var row = document.createElement('article');
    row.className = 'rankings-row' + (user.isYou ? ' rankings-row--you' : '');
    row.dataset.rank = String(rank);

    var position = document.createElement('span');
    position.className = 'rankings-row__rank';
    position.textContent = rank;

    var avatar = document.createElement('span');
    avatar.className = 'rankings-row__avatar';
    var avatarImage = document.createElement('img');
    avatarImage.src = user.avatar;
    avatarImage.alt = user.name;
    avatar.appendChild(avatarImage);

    var copy = document.createElement('span');
    copy.className = 'rankings-row__copy';
    var name = document.createElement('strong');
    name.textContent = user.name;
    var handle = document.createElement('small');
    handle.textContent = user.handle;
    copy.appendChild(name);
    copy.appendChild(handle);

    row.appendChild(position);
    row.appendChild(avatar);
    row.appendChild(copy);
    row.appendChild(makeScore(rankingScore(rank), 'rankings-score'));
    return row;
  }

  function renderTournamentLeaderboard() {
    if (!rankingPodium || !rankingList) return;
    var tournament = currentTournament();
    var podium = document.createDocumentFragment();

    podium.appendChild(makePodiumUser(2, 'second', tournament));
    podium.appendChild(makePodiumUser(1, 'first', tournament));
    podium.appendChild(makePodiumUser(3, 'third', tournament));
    [['second', 'assets/rankings/podium-2.png'], ['first', 'assets/rankings/podium-1.png'], ['third', 'assets/rankings/podium-3.png']].forEach(function (stand) {
      var image = document.createElement('img');
      image.className = 'rankings-podium__stand rankings-podium__stand--' + stand[0];
      image.src = stand[1];
      image.alt = '';
      podium.appendChild(image);
    });
    rankingPodium.replaceChildren(podium);

    /* A tournament can be thousands deep, so the board shows the top fifty
       and then jumps: the ranks either side of yours, with the gap marked
       rather than scrolled through. The podium already holds 1–3. */
    var board = window.THE90.board;
    var shape = board.plan(TOURNAMENT_PLAYER_COUNT, yourTournamentRank(), 50);
    var rows = document.createDocumentFragment();

    shape.lead.forEach(function (rank) {
      if (rank < 4) return;                       // the podium has those
      rows.appendChild(makeRankingRow(rank, tournament));
    });

    if (shape.neighbours.length) {
      if (shape.gap) {
        var jump = document.createElement('p');
        jump.className = 'rankings-jump';
        jump.textContent = '· · ·';
        rows.appendChild(jump);
      }
      shape.neighbours.forEach(function (rank) {
        rows.appendChild(makeRankingRow(rank, tournament));
      });
    }

    rankingList.replaceChildren(rows);
    rankingList.dataset.userCount = String(TOURNAMENT_PLAYER_COUNT);
    fillTournamentPin();
    scheduleTournamentPin();
  }

  /* =======================================================
     Live-round questions

     A state belongs to a tournament and its current round, not to a card
     node. That makes the rail safe to re-render under a newly live round
     while keeping already accepted answers read-only.
     ======================================================= */

  function liveRoundQuestions(tournament) {
    var match = roundMatchTeams(tournament);
    var question = {
      question: 'Who will get the first yellow card?',
      options: [match.home.name, match.away.name, 'No card']
    };
    return Array.from({ length: 5 }, function () {
      return { question: question.question, options: question.options.slice() };
    });
  }

  function roundMatchTeams(tournament) {
    var match = tournament.roundMatch || { home: 'arsenal', away: 'barcelona' };
    var data = window.THE90 || {};
    function team(slug) {
      var club = data.club && data.club(slug);
      return {
        name: club ? club.name : slug,
        logo: data.logo ? data.logo(slug) : ''
      };
    }
    return { home: team(match.home), away: team(match.away) };
  }

  function roundStateKey(tournament) {
    return activeId + ':' + String(tournament.currentRound);
  }

  function getRoundPickState(tournament) {
    var key = roundStateKey(tournament);
    var questions = liveRoundQuestions(tournament);
    if (!roundPickStates[key]) {
      roundPickStates[key] = questions.map(function () {
        return { selected: -1, confirmed: false };
      });
    }
    return roundPickStates[key];
  }

  function currentRoundItem(round) {
    return eventItems.find(function (item) {
      return Number(item.dataset.tournamentEvent) === Number(round);
    }) || null;
  }

  function selectedQuestionIndex(state) {
    return state.findIndex(function (question) {
      return question.selected >= 0 &&
        (!question.confirmed || question.selected !== question.acceptedIndex);
    });
  }

  function paintRoundQuestionCard(card, state) {
    if (!card || !state) return;
    card.classList.toggle('is-picked', state.selected >= 0);
    Array.prototype.slice.call(card.querySelectorAll('[data-round-answer]')).forEach(function (button) {
      var selected = Number(button.dataset.roundAnswer) === state.selected;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      // a confirmed answer is still an answer you can change your mind about
      button.disabled = false;
    });
  }

  function paintRoundQuestionStates(tournament) {
    var state = getRoundPickState(tournament);
    Array.prototype.slice.call(screen.querySelectorAll('[data-round-question]')).forEach(function (card) {
      paintRoundQuestionCard(card, state[Number(card.dataset.roundQuestion)]);
    });
  }

  /* A change you did not accept is not a pick: leaving the question puts back
     whatever was accepted for it, or nothing if it never was. */
  function discardUnconfirmedRoundPicks(tournament) {
    if (!tournament) return;
    getRoundPickState(tournament).forEach(function (question) {
      if (!question.confirmed) question.selected = -1;
      else if (question.selected !== question.acceptedIndex) {
        question.selected = question.acceptedIndex;
      }
    });
    paintRoundQuestionStates(tournament);
    hideRoundPickBar();
  }

  /* What the bar says, and whether it is on screen, are two different
     questions. Writing its copy on every scroll frame is what made it slide
     in at a different point each time; content is set once, here, and
     visibility is decided separately by syncRoundBar(). */
  function showRoundPickBar(tournament, questionIndex) {
    if (!sharedPickBar || !sharedPickBar.element) return;
    var state = getRoundPickState(tournament);
    var question = state[questionIndex];
    if (!question) return hideRoundPickBar();

    // nothing to confirm until something has been chosen that is not already in
    var started = state.some(function (q) {
      return q.selected >= 0 && (!q.confirmed || q.selected !== q.acceptedIndex);
    });
    if (!started) return hideRoundPickBar();

    activeRoundPick = { id: activeId, round: tournament.currentRound, index: questionIndex };
    sharedPickBar.element.classList.add('winbar--round-picks');
    if (sharedPickBar.label) sharedPickBar.label.textContent = 'Estimated win:';
    // every answered question is worth +40
    if (sharedPickBar.points) {
      var answered = state.reduce(function (sum, q) { return sum + (q.selected >= 0 ? 1 : 0); }, 0);
      sharedPickBar.points.textContent = '+' + (40 * answered);
    }
    if (sharedPickBar.next) {
      var ready = question.selected >= 0 &&
        (!question.confirmed || question.selected !== question.acceptedIndex);
      sharedPickBar.next.textContent = ready ? 'Accept pick?' : 'Select your prediction';
      sharedPickBar.next.disabled = !ready;
    }
    syncRoundBar();
  }

  function hideRoundPickBar() {
    activeRoundPick = null;
    if (!sharedPickBar || !sharedPickBar.element || !sharedPickBar.element.classList.contains('winbar--round-picks')) return;
    sharedPickBar.show(false);
  }

  /* The bar belongs to the question card: it stays up for as long as that
     card is genuinely readable, and steps aside once the card has scrolled
     away or the bar itself is covering half of it. Scrolling back brings it
     straight back, because this is a pure function of the scroll position.

     The bar's own rect is deliberately not used as the reference — when it is
     hidden it sits off-screen, which would flip the answer and set the two
     into a loop. Its resting top edge is derived from the frame instead. */
  var lastBarHeight = 0;

  function barHeight() {
    // hidden, the bar measures zero — remember the last real height so the
    // answer does not change the moment it appears
    var measured = sharedPickBar.element.offsetHeight;
    if (measured) lastBarHeight = measured;
    return lastBarHeight || 96;
  }

  function roundCardIsReadable() {
    var scroller = screen.querySelector('.round-questions-scroller');
    if (!scroller || !scroll || !sharedPickBar || !sharedPickBar.element) return false;

    var card = scroller.querySelector('[data-round-question="' +
      (activeRoundPick ? activeRoundPick.index : -1) + '"]') || nearestQuestionCard(scroller);
    if (!card) return false;

    // rects come back scaled by the device fit; offsetHeight does not
    var frame = scroll.getBoundingClientRect();
    var scale = frame.width / scroll.offsetWidth || 1;
    var barTop = frame.bottom - barHeight() * scale;

    var rect = card.getBoundingClientRect();
    var top = Math.max(rect.top, frame.top);
    var bottom = Math.min(rect.bottom, barTop);
    return (bottom - top) >= rect.height * 0.5;
  }

  function syncRoundBar() {
    if (!sharedPickBar || !sharedPickBar.element) return;
    if (!sharedPickBar.element.classList.contains('winbar--round-picks')) return;
    if (!activeRoundPick || activeRoundPick.id !== activeId) return;
    sharedPickBar.show(roundCardIsReadable());
  }

  function restoreDailyPickBar() {
    activeRoundPick = null;
    if (!sharedPickBar || !sharedPickBar.element || !sharedPickBar.element.classList.contains('winbar--round-picks')) return;
    sharedPickBar.restoreDaily();
  }

  function makeRoundQuestionCard(tournament, question, state, questionIndex) {
    var card = document.createElement('article');
    card.className = 'round-question-card' + (state.selected >= 0 ? ' is-picked' : '');
    card.dataset.roundQuestion = String(questionIndex);

    var pitch = document.createElement('img');
    pitch.className = 'round-question-card__pitch';
    pitch.src = 'assets/img/match-card-background.png';
    pitch.alt = '';

    var teams = roundMatchTeams(tournament);
    var match = document.createElement('div');
    match.className = 'round-question-card__match';
    var field = document.createElement('div');
    field.className = 'round-question-card__field';
    ['left-box', 'right-box', 'mid', 'circle'].forEach(function (part) {
      var line = document.createElement('span');
      line.className = 'round-question-card__field-' + part;
      field.appendChild(line);
    });

    var teamsRow = document.createElement('div');
    teamsRow.className = 'round-question-card__teams';
    function teamNode(team) {
      var node = document.createElement('div');
      node.className = 'round-question-card__team';
      var crest = document.createElement('img');
      crest.className = 'round-question-card__crest';
      crest.src = team.logo;
      crest.alt = '';
      var name = document.createElement('span');
      name.className = 'round-question-card__name';
      name.textContent = team.name;
      node.appendChild(crest);
      node.appendChild(name);
      return node;
    }
    var versus = document.createElement('span');
    versus.className = 'round-question-card__vs';
    versus.textContent = 'VS';
    teamsRow.appendChild(teamNode(teams.home));
    teamsRow.appendChild(versus);
    teamsRow.appendChild(teamNode(teams.away));
    match.appendChild(field);
    match.appendChild(teamsRow);

    var bodyWrap = document.createElement('div');
    bodyWrap.className = 'round-question-card__bodywrap';
    var body = document.createElement('div');
    body.className = 'round-question-card__body';

    var questionRow = document.createElement('div');
    questionRow.className = 'round-question-card__labelrow';
    var questionText = document.createElement('span');
    questionText.className = 'round-question-card__question';
    questionText.textContent = question.question;
    questionRow.appendChild(questionText);

    var answers = document.createElement('div');
    answers.className = 'round-question-card__answers';
    question.options.forEach(function (answer, answerIndex) {
      var button = document.createElement('button');
      var selected = state.selected === answerIndex;
      button.className = 'round-question-card__answer' + (selected ? ' is-selected' : '');
      button.type = 'button';
      button.dataset.roundAnswer = String(answerIndex);
      button.textContent = answer;
      button.setAttribute('aria-pressed', String(selected));
      button.addEventListener('click', function () {
        // a confirmed answer can still be changed; the bar asks whether you
        // meant it, and leaving the question puts the old one back
        state.selected = answerIndex;
        // Keep the native rail in place. Rebuilding it here resets its scroll
        // position and makes a previously selected card flash out of view.
        paintRoundQuestionCard(card, state);
        showRoundPickBar(tournament, questionIndex);
      });
      answers.appendChild(button);
    });

    card.appendChild(pitch);
    card.appendChild(match);
    body.appendChild(questionRow);
    body.appendChild(answers);
    bodyWrap.appendChild(body);
    card.appendChild(bodyWrap);
    return card;
  }

  function nearestQuestionCard(scroller) {
    var cards = Array.prototype.slice.call(scroller.querySelectorAll('[data-round-question]'));
    var midpoint = scroller.scrollLeft + scroller.clientWidth / 2;
    var nearest = cards[0] || null;
    var distance = Infinity;
    cards.forEach(function (card) {
      var cardMidpoint = card.offsetLeft + card.offsetWidth / 2;
      var nextDistance = Math.abs(cardMidpoint - midpoint);
      if (nextDistance < distance) {
        nearest = card;
        distance = nextDistance;
      }
    });
    return nearest;
  }

  function wireRoundQuestionScroller(scroller, tournament) {
    var frame = null;
    scroller.addEventListener('scroll', function () {
      if (frame) return;
      frame = window.requestAnimationFrame(function () {
        frame = null;
        var card = nearestQuestionCard(scroller);
        if (!card) return;
        var questionIndex = Number(card.dataset.roundQuestion);
        showRoundPickBar(tournament, questionIndex);
      });
    }, { passive: true });
  }

  /* The round closes the way Daily picks does: one more card at the end of
     the rail carrying the tick, with nothing else on it. */
  function makeRoundDoneCard(tournament) {
    var card = document.createElement('article');
    card.className = 'round-question-card round-question-card--done';
    card.dataset.roundDone = '';

    var done = document.createElement('div');
    done.className = 'donecard';

    var art = document.createElement('div');
    art.className = 'donecard__art';
    art.setAttribute('aria-hidden', 'true');

    var title = document.createElement('p');
    title.className = 'donecard__title';
    title.textContent = 'All round picks accepted';

    var win = document.createElement('p');
    win.className = 'donecard__win';
    win.appendChild(document.createTextNode('Estimated win:'));
    var value = document.createElement('b');
    value.textContent = '+' + (40 * getRoundPickState(tournament).length);
    win.appendChild(value);

    done.appendChild(art);
    done.appendChild(title);
    done.appendChild(win);
    card.appendChild(done);
    return { card: card, art: art };
  }

  function finishRound(tournament) {
    var eventItem = currentRoundItem(tournament.currentRound);
    var scroller = eventItem && eventItem.querySelector('.round-questions-scroller');
    if (!scroller || scroller.querySelector('[data-round-done]')) return;

    var done = makeRoundDoneCard(tournament);
    // the same height as the questions it follows, so the rail does not grow
    var first = scroller.querySelector('[data-round-question="0"]');
    if (first) done.card.style.height = first.offsetHeight + 'px';
    scroller.appendChild(done.card);
    fitPanelHeight();

    hideRoundPickBar();

    window.requestAnimationFrame(function () {
      var first = scroller.querySelector('[data-round-question="0"]');
      scroller.scrollTo({
        left: Math.max(0, done.card.offsetLeft - (first ? first.offsetLeft : 0)),
        behavior: 'smooth'
      });
      if (window.THE90 && window.THE90.playDoneTick) window.THE90.playDoneTick(done.art);
    });
  }

  function renderRoundQuestions(tournament, eventItem) {
    var currentRound = Number(tournament.currentRound) || 0;
    if (!eventItem || !tournament.live || !tournament.joined || !currentRound) return;

    var holder = document.createElement('div');
    holder.className = 'tournament-events__questions';
    var scroller = document.createElement('div');
    scroller.className = 'round-questions-scroller';
    scroller.setAttribute('aria-label', 'Round ' + currentRound + ' prediction questions');

    var questions = liveRoundQuestions(tournament);
    var state = getRoundPickState(tournament);
    questions.forEach(function (question, index) {
      scroller.appendChild(makeRoundQuestionCard(tournament, question, state[index], index));
    });
    holder.appendChild(scroller);
    eventItem.appendChild(holder);
    wireRoundQuestionScroller(scroller, tournament);
    fitPanelHeight();
  }

  function confirmRoundPick() {
    if (!activeRoundPick || activeRoundPick.id !== activeId) return;
    var tournament = currentTournament();
    if (Number(tournament.currentRound) !== Number(activeRoundPick.round)) return;

    var state = getRoundPickState(tournament);
    var question = state[activeRoundPick.index];
    if (!question || question.confirmed || question.selected < 0) return;

    question.confirmed = true;
    question.acceptedIndex = question.selected;
    var confirmedIndex = activeRoundPick.index;
    var nextIndex = -1;
    for (var step = 1; step < state.length; step += 1) {
      var candidate = (confirmedIndex + step) % state.length;
      if (!state[candidate].confirmed) {
        nextIndex = candidate;
        break;
      }
    }
    // Keep the shared winbar visible but disable its confirm button for
    // the newly confirmed question. Update the summed estimated win.
    paintRoundQuestionStates(tournament);
    showRoundPickBar(tournament, confirmedIndex);

    // Nothing left to answer — the round is done, so close it on its own card
    if (nextIndex < 0) {
      finishRound(tournament);
      return;
    }

    // Move to the following unanswered card, wrapping to an earlier skipped
    // question after the fifth card. The existing rail stays mounted, so its
    // position and every other selected answer remain stable.
    if (nextIndex >= 0) {
      window.requestAnimationFrame(function () {
        var eventItem = currentRoundItem(tournament.currentRound);
        var scroller = eventItem && eventItem.querySelector('.round-questions-scroller');
        var nextCard = scroller && scroller.querySelector('[data-round-question="' + nextIndex + '"]');
        if (scroller && nextCard) {
          var firstCard = scroller.querySelector('[data-round-question="0"]');
          scroller.scrollTo({
            left: Math.max(0, nextCard.offsetLeft - (firstCard ? firstCard.offsetLeft : 0)),
            behavior: 'smooth'
          });
          showRoundPickBar(tournament, nextIndex);
        }
      });
    }
  }

  function renderTournamentEvents(tournament) {
    var currentRound = Number(tournament.currentRound) || 0;
    var liveEventItem = null;
    eventItems.forEach(function (item) {
      var round = Number(item.dataset.tournamentEvent);
      var complete = round < currentRound;
      var current = round === currentRound && currentRound > 0;
      var marker = item.querySelector('[data-tournament-event-marker]');
      var state = item.querySelector('[data-tournament-event-state]');
      var questions = item.querySelector('.tournament-events__questions');

      if (questions) questions.remove();
      item.classList.toggle('is-complete', complete);
      item.classList.toggle('is-current', current);
      if (marker) marker.textContent = complete ? '✓' : String(round);
      if (state) state.textContent = complete ? 'Completed' : (current ? 'Live now' : (round === currentRound + 1 ? 'Next' : 'Upcoming'));
      if (current) liveEventItem = item;
    });

    renderRoundQuestions(tournament, liveEventItem);
    var selected = tournament.live && tournament.joined && currentRound
      ? selectedQuestionIndex(getRoundPickState(tournament))
      : -1;
    if (selected >= 0) showRoundPickBar(tournament, selected);
    else hideRoundPickBar();
  }

  function playTournamentPodium() {
    if (!rankingPodium) return;
    rankingPodium.classList.remove('is-entering');
    void rankingPodium.offsetWidth;
    rankingPodium.classList.add('is-entering');
  }

  /* Where the strip comes to rest — the scroll position at which it reaches
     the top of the screen. Read from the panels that follow it rather than
     from the strip itself: offsetTop on a stuck block reports where it is
     being held, not where it belongs. */
  function tabPinOffset() {
    if (!panelScroller || !tabsSticky) return 0;
    return Math.max(0, panelScroller.offsetTop - tabsSticky.offsetHeight);
  }

  /* Your own place, held at the foot of the screen while the real row is
     further down the board — the same plate the global ranking pins. */
  var boardPin = screen.querySelector('[data-tournament-pin]');
  var boardPinQueued = false;

  function fillTournamentPin() {
    if (!boardPin) return;
    var rank = yourTournamentRank();
    var user = tournamentUser(rank, currentTournament());
    var rankCell = boardPin.querySelector('.rankings-pin__rank');
    var avatar = boardPin.querySelector('.rankings-pin__avatar img');
    var name = boardPin.querySelector('.rankings-pin__copy strong');
    var handle = boardPin.querySelector('.rankings-pin__copy small');
    var score = boardPin.querySelector('.rankings-score');
    if (rankCell) rankCell.textContent = rank || '—';
    if (avatar) avatar.src = user.avatar;
    if (name) name.textContent = user.name;
    if (handle) handle.textContent = user.handle;
    if (score) {
      score.textContent = formatScore(rankingScore(rank || 1)) + ' ';
      var crown = document.createElement('img');
      crown.src = 'assets/notifications/crown.svg';
      crown.alt = '';
      crown.width = 14;
      crown.height = 12;
      score.appendChild(crown);
    }
  }

  function updateTournamentPin() {
    boardPinQueued = false;
    if (!boardPin || !scroll) return;
    var row = rankingList && rankingList.querySelector('.rankings-row--you');
    var onBoard = activeTab === 'leaderboard' || Math.round(panelPosition()) === 2;
    var showing = screen.classList.contains('is-active') && row && onBoard && yourTournamentRank();
    if (!showing) { boardPin.hidden = true; return; }
    var frame = scroll.getBoundingClientRect();
    boardPin.hidden = row.getBoundingClientRect().top < frame.bottom - 132;
  }

  function scheduleTournamentPin() {
    if (boardPinQueued) return;
    boardPinQueued = true;
    window.requestAnimationFrame(updateTournamentPin);
  }

  function updateStickyTabs() {
    if (!scroll || !tabsSticky) return;
    tabsSticky.classList.toggle('is-stuck', scroll.scrollTop >= tabPinOffset());
  }

  /* How far down the strip a tab is being held — see holdScrollForTab. */
  function panelOffset(index) { return panelOffsets[index] || 0; }

  function setPanelOffset(index, value) {
    if (!panels[index]) return;
    panelOffsets[index] = value;
    panels[index].style.marginTop = value ? value + 'px' : '';
  }

  function clearPanelOffsets() {
    panels.forEach(function (panel, index) { setPanelOffset(index, 0); });
  }

  function panelExtent(index) {
    return panels[index] ? panels[index].offsetHeight + panelOffset(index) : 0;
  }

  /* Every tab is a flex item in one horizontal strip, so the strip is as tall
     as its tallest tab and a short one sits above a screenful of nothing.
     align-items keeps each tab at its own height; this then sizes the strip
     to whichever one is under the finger. */
  function panelHeightAt(position) {
    var last = panels.length - 1;
    var value = clamp(position, 0, last);
    var index = Math.floor(value);
    if (!panels[index]) return 0;
    var left = panelExtent(index);
    var right = panelExtent(Math.min(last, index + 1));
    return left + (right - left) * (value - index);
  }

  function fitPanelHeight() {
    if (!panelScroller) return;
    var height = panelHeightAt(panelPosition());
    if (height) panelScroller.style.height = Math.round(height + tabFiller) + 'px';
  }

  /* Everything on the page that is not the strip. Constant, whichever tab is
     open, so a tab's own extent is the only term that changes. */
  function heightOutsidePanels() {
    if (!scroll || !panelScroller) return 0;
    return scroll.scrollHeight - panelScroller.offsetHeight;
  }

  /* Empty space to hold open under a tab. Where the page will come to rest is
     known — against the strip, or wherever it already is if it has not reached
     it — and a tab shorter than the screen cannot hold that position on its
     own: the page would end above it and the browser would drag the screen up
     to meet it. This is the difference. */
  function roomUnder(index) {
    if (!scroll || !panels[index]) return 0;
    var settled = Math.min(scroll.scrollTop, tabPinOffset());
    return Math.max(0, Math.round(
      settled + scroll.clientHeight - (heightOutsidePanels() + panels[index].offsetHeight)));
  }

  function roomAcross(from, to) {
    var first = Math.min(from, to);
    var last = Math.max(from, to);
    var room = 0;
    for (var index = first; index <= last; index++) room = Math.max(room, roomUnder(index));
    return room;
  }

  /* A tab opens at its own beginning, level with the strip — and the page is
     not scrolled there to arrange it. Scrolling back would haul the tab you
     are leaving up to its own top in front of you, which is the jump all of
     this is here to avoid. The arriving tab is dropped down the strip by
     however far the page is scrolled past the tabs instead: nothing on screen
     moves, and it still starts where it should. */
  function dropTab(index) {
    if (index === pageOwner) return;
    setPanelOffset(index, Math.max(0, scroll.scrollTop - tabPinOffset()));
  }

  function holdScrollForTab(index) {
    if (!scroll || !panelScroller || !panels[index] || !tabsSticky) return;
    dropTab(index);
    tabChanging = true;
    tabFillerIndex = index;
    // Room for every tab the slide passes over, not only the one it lands on:
    // the strip is sized to whatever is under it at each moment, and a page
    // that shrinks under the scroll position loses it to the browser for good.
    // Whatever the arrival does not need is given up in commitPanelOffset.
    tabFiller = Math.max(roomUnder(pageOwner),
                         roomAcross(Math.round(panelPosition()), index));
    fitPanelHeight();
  }

  /* Once the tab has arrived the drop is traded for real scroll position: the
     tab moves up by exactly what the page moves down, so nothing on screen
     changes. The page is left resting against the strip, and scrolling up from
     there leads back to the banner rather than into the gap the drop would
     otherwise have left above the tab. */
  function commitPanelOffset(index) {
    var offset = panelOffset(index);
    pageOwner = index;
    tabChanging = false;
    clearPanelOffsets();
    if (offset && scroll) scroll.scrollTop = Math.max(0, scroll.scrollTop - offset);
    // and the room the tab it was crossing from needed is given up here, once
    // the page no longer stands on it
    tabFillerIndex = index;
    tabFiller = roomUnder(index);
    fitPanelHeight();
  }

  /* The room has to be there before the finger moves, not once it lifts: the
     strip is as tall as whatever is under it, so a drag towards a shorter tab
     shrinks the page mid-gesture and the browser hauls the screen up with it,
     back over the banner. A drag can only reach a neighbour, so both of them
     are made ready and the room is held for the shorter one. What actually
     settles is measured again when the drag ends. */
  function holdScrollForDrag() {
    if (!scroll || !panelScroller || !panels.length) return;
    var index = Math.round(panelPosition());
    [index - 1, index + 1].forEach(function (near) {
      if (panels[near]) dropTab(near);
    });
    tabChanging = true;
    tabFillerIndex = index;
    tabFiller = Math.max(roomUnder(pageOwner), roomAcross(index - 1, index + 1));
    fitPanelHeight();
  }

  /* The space is only ever given back, never taken again: scrolling up needs
     less of it, and what is released does not come back on the way down.
     Left alone while a tab change is in flight — the strip is mid-slide then,
     and its height says nothing about where the page will settle. */
  function releaseTabFiller() {
    if (!tabFiller || !scroll || tabChanging || tabFillerIndex < 0) return;
    var needed = Math.max(0, Math.round(scroll.scrollTop + scroll.clientHeight -
      (heightOutsidePanels() + panelExtent(tabFillerIndex))));
    if (needed >= tabFiller) return;
    tabFiller = needed;
    fitPanelHeight();
  }

  function nearestTabScrollPosition() {
    if (!tabs) return 0;
    var nearest = 0;
    var distance = Infinity;
    tabButtons.forEach(function (button) {
      var position = Math.max(0, button.offsetLeft - 16);
      var nextDistance = Math.abs(tabs.scrollLeft - position);
      if (nextDistance < distance) {
        nearest = position;
        distance = nextDistance;
      }
    });
    return nearest;
  }

  function tabIndex(value) {
    if (typeof value === 'number') return value >= 0 && value < tabButtons.length ? value : -1;
    return tabButtons.findIndex(function (button) { return button.dataset.tournamentTab === value; });
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function panelWidth() {
    return panelScroller ? panelScroller.clientWidth : 0;
  }

  function panelPosition() {
    var width = panelWidth();
    return width ? panelScroller.scrollLeft / width : activeIndex;
  }

  function tabGeometry(index) {
    var button = tabButtons[index];
    if (!button) return { left: 0, width: 0 };
    var styles = window.getComputedStyle(button);
    var paddingLeft = parseFloat(styles.paddingLeft) || 0;
    var paddingRight = parseFloat(styles.paddingRight) || 0;
    return {
      left: button.offsetLeft + paddingLeft,
      width: Math.max(0, button.offsetWidth - paddingLeft - paddingRight)
    };
  }

  function commitTab(index) {
    var next = clamp(Math.round(index), 0, tabButtons.length - 1);
    if (next === committedIndex) return;
    var nextTab = tabButtons[next].dataset.tournamentTab;
    if (activeTab === 'events' && nextTab !== 'events') discardUnconfirmedRoundPicks(currentTournament());
    committedIndex = next;
    activeIndex = next;
    activeTab = nextTab;
    tabButtons.forEach(function (button, buttonIndex) {
      var selected = buttonIndex === next;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    panels.forEach(function (panel) {
      var selected = panel.dataset.tournamentPanel === activeTab;
      panel.hidden = false;
      panel.classList.toggle('is-active', selected);
      panel.setAttribute('aria-hidden', String(!selected));
    });
    if (activeTab === 'leaderboard') {
      window.requestAnimationFrame(playTournamentPodium);
    }
  }

  // This is the shared visual state for the entire control. `position` may
  // sit between tabs (for example 1.35): content, text, indicator and the
  // tab ribbon all use that same number, so none of them can drift apart.
  function renderTabPosition(position) {
    var last = tabButtons.length - 1;
    var value = clamp(position, 0, last);
    var leftIndex = Math.floor(value);
    var rightIndex = Math.min(last, leftIndex + 1);
    var progress = value - leftIndex;
    var left = tabGeometry(leftIndex);
    var right = tabGeometry(rightIndex);

    if (tabIndicator) {
      var indicatorLeft = left.left + (right.left - left.left) * progress;
      var indicatorWidth = left.width + (right.width - left.width) * progress;
      tabIndicator.style.width = indicatorWidth + 'px';
      tabIndicator.style.transform = 'translate3d(' + indicatorLeft + 'px, 0, 0)';
    }

    tabButtons.forEach(function (button, index) {
      var emphasis = Math.max(0, 1 - Math.abs(value - index));
      button.style.opacity = String(.5 + emphasis * .5);
      button.style.color = 'rgba(247, 250, 248, ' + (.5 + emphasis * .5).toFixed(3) + ')';
    });

    if (tabs && last > 0) {
      var ribbonProgress = value / last;
      var maxRibbonScroll = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
      tabs.scrollLeft = ribbonProgress * maxRibbonScroll;
    }
    commitTab(value);
  }

  function renderPanelPosition(position) {
    var width = panelWidth();
    var value = clamp(position, 0, tabButtons.length - 1);
    desiredPanelPosition = value;
    if (!width) {
      renderTabPosition(value);
      return;
    }
    panelScroller.scrollLeft = value * width;
    renderTabPosition(value);
  }

  function stopPanelAnimation() {
    if (!panelAnimationFrame) return;
    window.cancelAnimationFrame(panelAnimationFrame);
    panelAnimationFrame = null;
  }

  function animateToTab(index, done) {
    var target = clamp(index, 0, tabButtons.length - 1);
    var start = panelPosition();
    var distance = target - start;
    stopPanelAnimation();
    if (Math.abs(distance) < .001) {
      renderPanelPosition(target);
      if (done) done();
      return;
    }

    var startedAt = performance.now();
    var duration = Math.min(420, Math.max(230, 230 + Math.abs(distance) * 95));
    function frame(now) {
      var elapsed = clamp((now - startedAt) / duration, 0, 1);
      // ease-out keeps the release soft without decoupling any sub-element.
      var eased = 1 - Math.pow(1 - elapsed, 4);
      renderPanelPosition(start + distance * eased);
      if (elapsed < 1) {
        panelAnimationFrame = window.requestAnimationFrame(frame);
        return;
      }
      panelAnimationFrame = null;
      if (done) done();
    }
    panelAnimationFrame = window.requestAnimationFrame(frame);
  }

  function syncTabMeasurements() {
    renderPanelPosition(desiredPanelPosition);
    updateStickyTabs();
  }

  function renderTournament() {
    var tournament = currentTournament();
    title.textContent = tournament.title;
    kind.textContent = tournament.label;
    kind.className = 'thearena-tag thearena-tag--' + tournament.kind;
    description.textContent = tournament.description;
    about.textContent = tournament.about;
    participants.textContent = tournament.participants;
    renderTournamentTime(tournament);
    startLiveCountdown(tournament);
    rounds.textContent = tournament.currentRound;
    if (roundTotal) roundTotal.textContent = '/' + tournament.rounds;
    entry.hidden = tournament.joined || tournament.live;
    place.hidden = !tournament.joined;
    place.querySelector('[data-tournament-place]').textContent = tournament.place;
    join.hidden = tournament.joined || tournament.live;
    renderTournamentEvents(tournament);
    renderTournamentLeaderboard();
  }

  function setActiveTab(value, options) {
    var index = tabIndex(value);
    if (index < 0) return;
    var settings = typeof options === 'string' ? { behavior: options } : (options || {});
    // A tap has an explicit destination, so clear the draft immediately
    // instead of leaving the confirmation surface visible during the slide.
    if (activeTab === 'events' && tabButtons[index].dataset.tournamentTab !== 'events') {
      discardUnconfirmedRoundPicks(currentTournament());
    }
    stopPanelAnimation();
    if (settings.behavior === 'auto') {
      renderPanelPosition(index);
      return;
    }
    holdScrollForTab(index);
    animateToTab(index, function () { commitPanelOffset(index); });
  }

  function openTournament(id) {
    var source = arena.querySelector('[data-tournament-id="' + id + '"]');
    if (!source || source.dataset.tournamentState === 'locked') return;
    if (!tournaments[id]) return;

    activeId = id;
    tournaments[id].joined = source.dataset.tournamentState === 'joined';
    tournaments[id].live = source.dataset.tournamentPhase === 'live';
    renderTournament();
    tabFiller = 0;
    tabFillerIndex = -1;
    tabChanging = false;
    pageOwner = 0;
    clearPanelOffsets();
    setActiveTab('events', 'auto');
    fitPanelHeight();
    if (scroll) scroll.scrollTop = 0;
    lastTournamentScrollTop = scroll ? scroll.scrollTop : 0;
    updateStickyTabs();
    if (window.THE90 && window.THE90.go) window.THE90.go('arena-tournament');
  }

  Array.prototype.slice.call(arena.querySelectorAll('[data-tournament-id]')).forEach(function (card) {
    card.addEventListener('click', function (event) {
      if (event.target.closest('[data-arena-join]')) return;
      openTournament(card.dataset.tournamentId);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openTournament(card.dataset.tournamentId);
    });
  });

  tabButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setActiveTab(button.dataset.tournamentTab);
    });
  });

  if (tabs) {
    var tabDrag = { pointerId: null, startX: 0, startScroll: 0, moved: false };
    tabs.addEventListener('pointerdown', function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      tabDrag.pointerId = event.pointerId;
      tabDrag.startX = event.clientX;
      tabDrag.startScroll = tabs.scrollLeft;
      tabDrag.moved = false;
      tabs.setPointerCapture(event.pointerId);
      tabs.classList.add('is-dragging');
    });
    tabs.addEventListener('pointermove', function (event) {
      if (event.pointerId !== tabDrag.pointerId) return;
      var delta = event.clientX - tabDrag.startX;
      if (Math.abs(delta) > 4) tabDrag.moved = true;
      tabs.scrollLeft = tabDrag.startScroll - delta;
    });
    function endTabDrag(event) {
      if (event.pointerId !== tabDrag.pointerId) return;
      if (tabs.hasPointerCapture(event.pointerId)) tabs.releasePointerCapture(event.pointerId);
      tabDrag.pointerId = null;
      tabs.classList.remove('is-dragging');
      tabs.scrollTo({ left: nearestTabScrollPosition(), behavior: 'smooth' });
    }
    tabs.addEventListener('pointerup', endTabDrag);
    tabs.addEventListener('pointercancel', endTabDrag);
    tabs.addEventListener('click', function (event) {
      if (!tabDrag.moved) return;
      tabDrag.moved = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    // Keep ordinary vertical wheel movement available to the tournament page,
    // while a two-finger horizontal trackpad gesture always scrolls this ribbon.
    tabs.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || !event.deltaX) return;
      tabs.scrollLeft += event.deltaX;
      event.preventDefault();
    }, { passive: false });
  }

  if (scroll) {
    scroll.addEventListener('scroll', syncRoundBar, { passive: true });
  }
  window.addEventListener('resize', syncRoundBar);

  /* The X on the bar is the way back out of a pick you have not accepted:
     it clears the selection and takes the bar with it, exactly as the daily
     slip does. main.js leaves it alone while the round owns the bar. */
  if (sharedPickBar && sharedPickBar.close) {
    sharedPickBar.close.addEventListener('click', function () {
      if (!sharedPickBar.element ||
          !sharedPickBar.element.classList.contains('winbar--round-picks')) return;
      if (!screen.classList.contains('is-active')) return;
      discardUnconfirmedRoundPicks(currentTournament());
    });
  }

  if (sharedPickBar && sharedPickBar.next) {
    sharedPickBar.next.addEventListener('click', function () {
      if (!sharedPickBar.element.classList.contains('winbar--round-picks')) return;
      confirmRoundPick();
    });
  }

  if (join) {
    join.addEventListener('click', function () {
      var tournament = currentTournament();
      if (window.THE90 && typeof window.THE90.openArenaJoinModal === 'function') {
        window.THE90.openArenaJoinModal(activeId);
        return;
      }
      tournament.joined = true;
      tournament.participants += 1;
      updateArenaCard(activeId);
      renderTournament();
    });
  }

  if (more) {
    more.addEventListener('click', function () {
      var section = more.closest('.tournament-about');
      var expanded = section.classList.toggle('is-expanded');
      more.setAttribute('aria-expanded', String(expanded));
      more.firstChild.nodeValue = expanded ? 'Show less ' : 'Show more ';
    });
  }

  if (panelScroller) {
    var panelDrag = {
      pointerId: null,
      axis: null,
      startX: 0,
      startY: 0,
      startScroll: 0,
      startPosition: 0,
      lastScroll: 0,
      lastTime: 0,
      velocity: 0,
      moved: false
    };
    var suppressPanelClick = false;

    function setEdgeResistance(offset, animateBack) {
      panelScroller.style.transition = animateBack ? 'transform .34s cubic-bezier(.22, 1, .36, 1)' : 'none';
      panelScroller.style.transform = offset ? 'translate3d(' + offset + 'px, 0, 0)' : '';
    }

    panelScroller.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      stopPanelAnimation();
      panelDrag.pointerId = event.pointerId;
      panelDrag.axis = null;
      panelDrag.startX = event.clientX;
      panelDrag.startY = event.clientY;
      panelDrag.startScroll = panelScroller.scrollLeft;
      panelDrag.startPosition = panelPosition();
      panelDrag.lastScroll = panelScroller.scrollLeft;
      panelDrag.lastTime = event.timeStamp || performance.now();
      panelDrag.velocity = 0;
      panelDrag.moved = false;
    });

    panelScroller.addEventListener('pointermove', function (event) {
      if (event.pointerId !== panelDrag.pointerId) return;
      var deltaX = event.clientX - panelDrag.startX;
      var deltaY = event.clientY - panelDrag.startY;
      if (!panelDrag.axis) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          panelDrag.axis = 'y';
          return;
        }
        panelDrag.axis = 'x';
        panelDrag.moved = true;
        holdScrollForDrag();
        if (panelScroller.setPointerCapture) panelScroller.setPointerCapture(event.pointerId);
        panelScroller.classList.add('is-dragging');
      }
      if (panelDrag.axis !== 'x') return;

      event.preventDefault();
      var maxScroll = Math.max(0, panelScroller.scrollWidth - panelScroller.clientWidth);
      var desired = panelDrag.startScroll - deltaX;
      var clampedScroll = clamp(desired, 0, maxScroll);
      var overflow = desired - clampedScroll;
      // Scroll space is the inverse of finger movement, so the visual
      // resistance needs the opposite sign to keep following the finger.
      setEdgeResistance(-overflow * .34, false);
      panelScroller.scrollLeft = clampedScroll;
      renderTabPosition(panelPosition());

      var now = event.timeStamp || performance.now();
      var elapsed = Math.max(1, now - panelDrag.lastTime);
      panelDrag.velocity = (clampedScroll - panelDrag.lastScroll) / elapsed;
      panelDrag.lastScroll = clampedScroll;
      panelDrag.lastTime = now;
    });

    function endPanelDrag(event) {
      if (event.pointerId !== panelDrag.pointerId) return;
      var draggedHorizontally = panelDrag.axis === 'x';
      if (panelScroller.hasPointerCapture && panelScroller.hasPointerCapture(event.pointerId)) {
        panelScroller.releasePointerCapture(event.pointerId);
      }
      panelDrag.pointerId = null;
      panelDrag.axis = null;
      panelScroller.classList.remove('is-dragging');
      setEdgeResistance(0, true);
      if (!draggedHorizontally) return;

      suppressPanelClick = panelDrag.moved;
      var current = panelPosition();
      var direction = panelDrag.velocity === 0 ? 0 : (panelDrag.velocity > 0 ? 1 : -1);
      var distance = current - panelDrag.startPosition;
      var target = Math.round(current);
      if (Math.abs(distance) >= .18) {
        target = Math.round(panelDrag.startPosition) + (distance > 0 ? 1 : -1);
      } else if (Math.abs(panelDrag.velocity) >= .55) {
        target = Math.round(panelDrag.startPosition) + direction;
      }
      target = clamp(target, 0, tabButtons.length - 1);
      holdScrollForTab(target);
      animateToTab(target, function () { commitPanelOffset(target); });
    }
    panelScroller.addEventListener('pointerup', endPanelDrag);
    panelScroller.addEventListener('pointercancel', endPanelDrag);
    panelScroller.addEventListener('click', function (event) {
      if (!suppressPanelClick) return;
      suppressPanelClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    panelScroller.addEventListener('scroll', function () {
      if (panelScrollFrame) return;
      panelScrollFrame = window.requestAnimationFrame(function () {
        panelScrollFrame = null;
        if (!panelScroller.clientWidth) return;
        desiredPanelPosition = panelPosition();
        renderTabPosition(desiredPanelPosition);
      });
    }, { passive: true });
  }

  if (panelScroller) {
    /* Called straight from the scroll event rather than behind a
       requestAnimationFrame latch: a latch that is set but never cleared —
       which happens whenever frames stop being produced — would wedge this
       shut for good. It is two height reads and one style write. */
    panelScroller.addEventListener('scroll', fitPanelHeight, { passive: true });
  }

  if (scroll) {
    scroll.addEventListener('scroll', function () {
      scheduleTournamentPin();
      releaseTabFiller();
      updateStickyTabs();
      lastTournamentScrollTop = scroll.scrollTop;
    }, { passive: true });
  }
  window.addEventListener('resize', function () {
    syncTabMeasurements();
  });
  window.addEventListener('the90:screen', function (event) {
    if (!event.detail || event.detail !== 'arena-tournament') {
      restoreDailyPickBar();
      if (boardPin) boardPin.hidden = true;
      return;
    }
    scheduleTournamentPin();
    window.requestAnimationFrame(syncTabMeasurements);
  });

  document.addEventListener('the90:tournamentjoined', function (event) {
    var id = event.detail && event.detail.id;
    if (!id || !tournaments[id]) return;
    if (!tournaments[id].joined) tournaments[id].participants += 1;
    tournaments[id].joined = true;
    if (id === activeId) renderTournament();
  });

  if (window.THE90) {
    window.THE90.openTournament = openTournament;
    window.THE90.getArenaTournament = function (id) {
      return tournaments[id] || null;
    };
  }
  renderTournament();
  setActiveTab('events', 'auto');
  syncTabMeasurements();
})();
