/* =========================================================
   THE90 — rounds in a league

   A league you own is a thing you run: you pick the matches,
   you say what is being predicted, and you publish. Everyone
   else plays what you published and nothing else.

   One store, one state machine:

     draft      only the owner sees it, everything editable
     published  members see it, picks not open yet
     open       picks can be made and confirmed
     completed  the matches are played

   Publishing is the door: matches and questions are fixed on
   the way through it.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  if (!T) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var KEY = 'the90.leagueRounds.v1';

  /* The four questions a round can ask of a match. Points come from the
     app's own model rather than from the owner — the value of a call is the
     same wherever it is made. */
  var TEMPLATES = [
    { id: 'result', label: 'Match result', points: 10, required: true },
    { id: 'score', label: 'Exact score', points: 40 },
    { id: 'btts', label: 'Both teams to score', points: 15 },
    { id: 'scorer', label: 'First goalscorer', points: 25 }
  ];

  var STATE_LABEL = {
    draft: 'Draft', published: 'Published', open: 'Open', completed: 'Completed',
    locked: 'Locked'
  };


  /* =======================================================
     Store
     ======================================================= */

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) { return {}; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (error) { /* storage may be unavailable */ }
  }

  var all = load();

  function keyFor(league) {
    return (league && league.name ? league.name : 'league').toLowerCase();
  }

  function roundsOf(league) {
    var key = keyFor(league);
    if (!all[key]) all[key] = [];
    return all[key];
  }

  function publishedOf(league) {
    var own = roundsOf(league).filter(function (round) { return round.state !== 'draft'; });
    if (own.length) return own;
    /* A league you were invited into arrives mid-season rather than empty: one
       round played, one being played and one still to open. A league you made
       yourself keeps its empty screen — that one is asking you for a round. */
    return isOwner() ? [] : demoSeason();
  }

  /* The three rounds a joined league is shown with. Built once a session off
     the calendar in front of it, so round two is always the live one. */
  var season = null;

  function demoSeason() {
    if (season) return season;
    if (!days.length) return [];

    function fixture(day) { return day && day.matches[0]; }
    var played = fixture(days[0]);
    var now = fixture(days[1]) || played;
    var next = fixture(days[3]) || fixture(days[2]) || now;
    if (!played || !now || !next) return [];

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var behind = yesterday.getFullYear() + '-' + (yesterday.getMonth() + 1) + '-' + yesterday.getDate();

    season = [
      /* Round one is off the calendar on purpose: it carries yesterday's date,
         which is what makes it a round that has been played. */
      { id: 'season-1', name: 'Round 1', description: '', lock: 15, state: 'published',
        matches: [{ id: 'season-1-m', home: played.home, away: played.away,
                    league: played.league, kickoff: '17:00', date: behind,
                    questions: ['result', 'score'] }] },
      { id: 'season-2', name: 'Round 2', description: '', lock: 15, state: 'published',
        matches: [{ id: now.id, home: now.home, away: now.away, league: now.league,
                    kickoff: now.kickoff, date: days[1] ? days[1].key : days[0].key,
                    questions: ['result', 'score', 'btts'] }] },
      { id: 'season-3', name: 'Round 3', description: '', lock: 15, state: 'published',
        matches: [{ id: next.id, home: next.home, away: next.away, league: next.league,
                    kickoff: next.kickoff, date: (days[3] || days[2] || days[1]).key,
                    questions: ['result', 'score'] }] }
    ];

    // the round that has been played was played: it comes with its picks in
    var first = season[0];
    first.matches.forEach(function (match) {
      var pick = pickOf(first, match);
      if (pick.accepted) return;
      pick.accepted = { result: 'home', score: '2:1' };
      pick.answers = { result: 'home', score: { home: 2, away: 1 } };
    });
    savePicks();
    return season;
  }

  function draftOf(league) {
    return roundsOf(league).filter(function (round) { return round.state === 'draft'; })[0] || null;
  }

  function questionCount(round) {
    return round.matches.reduce(function (total, match) { return total + match.questions.length; }, 0);
  }


  /* =======================================================
     Fixtures, and the deadline that comes off them
     ======================================================= */

  var days = T.buildCalendar ? T.buildCalendar().filter(function (day) { return !day.isPast; }) : [];

  function fixtureById(id) {
    for (var i = 0; i < days.length; i++) {
      var found = days[i].matches.filter(function (match) { return match.id === id; })[0];
      if (found) return { day: days[i], match: found };
    }
    return null;
  }

  function kickoffLabel(match) {
    var found = fixtureById(match.id);
    if (found) return found.day.weekday + ' · ' + found.match.kickoff;
    /* Off the end of the calendar the day is worked out from the date the
       round kept — and a match with no date at all is shown as today's
       rather than as its own kickoff twice over. */
    var at = kickoffAt(match);
    return dayName(at) + ' · ' + (match.kickoff || '');
  }

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function dayName(at) {
    if (!at) return 'Today';
    var now = new Date();
    function stamp(date) {
      return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
    }
    var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (stamp(at) === stamp(now)) return 'Today';
    if (stamp(at) === stamp(tomorrow)) return 'Tomorrow';
    return WEEKDAYS[at.getDay()];
  }

  /* Fixtures carry a day key and a kickoff; a round needs real times to know
     where it is in its own life. */
  function kickoffAt(match) {
    var found = fixtureById(match.id);
    // the calendar first, then the day the round wrote down when it took it
    var key = (found ? found.day.key : match.date) || '';
    var parts = key.split('-');
    var clock = (found ? found.match.kickoff : match.kickoff || '00:00').split(':');
    if (parts.length !== 3) return null;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
      Number(clock[0]), Number(clock[1]));
  }

  function deadlineOf(round) {
    var earliest = null;
    round.matches.forEach(function (match) {
      var at = kickoffAt(match);
      if (!at) return;
      var locks = new Date(at.getTime() - Number(round.lock) * 60000);
      if (!earliest || locks < earliest) earliest = locks;
    });
    return earliest;
  }

  function lastWhistle(round) {
    var latest = null;
    round.matches.forEach(function (match) {
      var at = kickoffAt(match);
      if (!at) return;
      var ends = new Date(at.getTime() + 115 * 60000);   // 90 plus the rest of it
      if (!latest || ends > latest) latest = ends;
    });
    return latest;
  }

  /* draft is the owner's; everything else is the clock's. */
  function stateOf(round) {
    if (round.state === 'draft') return 'draft';
    var now = Date.now();
    var locks = deadlineOf(round);
    var ends = lastWhistle(round);
    if (!locks || !ends) return 'published';
    /* No locked window for now: a pick can be changed for as long as the
       matches are still to be played. */
    return now < ends.getTime() ? 'open' : 'completed';
  }

  function countdown(to) {
    var left = Math.max(0, to.getTime() - Date.now());
    var hours = Math.floor(left / 3600000);
    var minutes = Math.floor(left % 3600000 / 60000);
    var seconds = Math.floor(left % 60000 / 1000);
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') +
      ':' + String(seconds).padStart(2, '0');
  }

  function statusLine(round) {
    var state = stateOf(round);
    if (state === 'open') {
      var locks = deadlineOf(round);
      if (!locks) return 'Open';
      return locks.getTime() > Date.now() ? 'Locks in ' + countdown(locks) : 'In play';
    }
    if (state === 'completed') return 'Completed';
    /* Published with no clock to go by — its fixtures are off the end of the
       calendar. It is still the round being played, so it says so. */
    if (state === 'published' && !deadlineOf(round)) return 'In play';
    return STATE_LABEL[state] || state;
  }

  function teamsOf(match) {
    var home = T.club(match.home), away = T.club(match.away);
    return (home ? home.name : match.home) + ' vs ' + (away ? away.name : match.away);
  }


  /* =======================================================
     Answers

     One store, keyed by league, round and match. A pick is a
     choice; confirming it is what locks it in and what the
     progress line counts.
     ======================================================= */

  var PICK_KEY = 'the90.leaguePicks.v1';

  function loadPicks() {
    try {
      var saved = JSON.parse(localStorage.getItem(PICK_KEY));
      return saved && typeof saved === 'object' ? saved : {};
    } catch (error) { return {}; }
  }

  var picks = loadPicks();

  function savePicks() {
    try { localStorage.setItem(PICK_KEY, JSON.stringify(picks)); } catch (error) { /* storage may be unavailable */ }
  }

  function pickKey(round, match) { return keyFor(league()) + '|' + round.id + '|' + match.id; }

  function pickOf(round, match) {
    var key = pickKey(round, match);
    if (!picks[key]) picks[key] = { answers: {}, locked: false };
    return picks[key];
  }

  function template(id) {
    return TEMPLATES.filter(function (item) { return item.id === id; })[0];
  }

  /* What a question offers. The exact score is the one that is not a choice
     between things, so it gets the app's own stepper shape instead. */
  function optionsFor(question, match) {
    var home = T.club(match.home), away = T.club(match.away);
    if (question === 'result') {
      return [
        { value: 'home', label: home ? home.short : 'Home' },
        { value: 'draw', label: 'Draw' },
        { value: 'away', label: away ? away.short : 'Away' }
      ];
    }
    if (question === 'btts') {
      return [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
    }
    if (question === 'scorer') {
      return [
        { value: 'home', label: home ? home.short : 'Home' },
        { value: 'away', label: away ? away.short : 'Away' },
        { value: 'none', label: 'No goals' }
      ];
    }
    return null;   // exact score
  }

  /* =======================================================
     Who is looking

     league-create.js knows which card was tapped; it hands the
     record over on the membership event. Everything owner-only
     hangs off own === true.
     ======================================================= */

  var viewing = { joined: true, own: false, league: null };

  document.addEventListener('the90:league-membership', function (event) {
    viewing = event.detail || viewing;
    renderPanel();
    if (typeof renderRules === 'function') renderRules();
  });

  function league() { return viewing.league || { name: 'League' }; }
  function isOwner() { return !!viewing.own; }


  /* =======================================================
     The picks tab: an owner runs rounds, a member plays them
     ======================================================= */

  var panel = $('[data-league-rounds]');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function pill(state) {
    var badge = el('span', 'round-pill round-pill--' + state, STATE_LABEL[state] || state);
    return badge;
  }

  function card(title, text, buttons, state) {
    var box = el('article', 'league-round-card');
    var head = el('div', 'league-round-card__head');
    head.appendChild(el('h2', null, title));
    if (state) head.appendChild(pill(state));
    box.appendChild(head);
    box.appendChild(el('p', null, text));
    (buttons || []).forEach(function (button) { box.appendChild(button); });
    return box;
  }

  function action(label, kind, run) {
    var button = el('button', 'btn ' + kind, label);
    button.type = 'button';
    button.addEventListener('click', run);
    return button;
  }

  function renderPanel() {
    if (!panel) return;
    panel.replaceChildren();
    if (!viewing.joined && !isOwner()) return;

    var rounds = isOwner() ? roundsOf(league()) : publishedOf(league());

    if (!rounds.length) {
      if (!isOwner()) return;   // a member is never shown an empty owner screen
      panel.appendChild(card('Your league needs its first round',
        'Choose matches, add prediction questions and publish when you are ready.',
        [action('Create round', 'btn--primary', function () { openEditor(null); })]));
      return;
    }

    var draft = draftOf(league());
    if (isOwner() && draft) {
      panel.appendChild(card(draft.name,
        draft.matches.length + ' ' + (draft.matches.length === 1 ? 'match' : 'matches') +
        ' · ' + questionCount(draft) + ' questions',
        [action('Continue editing', 'btn--primary', function () { openEditor(draft.id); })],
        'draft'));
    }

    panel.appendChild(playStage(publishedOf(league())));

    panel.appendChild(el('p', 'league-round-note',
      'League points only — Global Ranking is not affected.'));

    if (isOwner()) {
      panel.appendChild(action('Manage rounds', 'league-round-card__ghost', function () {
        if (T.go) T.go('league-rounds');
      }));
    }
  }


  /* =======================================================
     A published round, as it is played

     The same card for everyone: what the round is, where it is
     in its life, and the questions under it. Before the
     deadline they answer; after it they only read.
     ======================================================= */

  function scoreOf(round, match, question, answer) {
    var result = resultOf(match);
    if (!result) return null;
    if (question === 'result') return answer === result.outcome ? template('result').points : 0;
    if (question === 'btts') return answer === result.btts ? template('btts').points : 0;
    if (question === 'scorer') return answer === result.first ? template('scorer').points : 0;
    if (question === 'score') {
      var exact = answer && answer.home === result.home && answer.away === result.away;
      return exact ? template('score').points : 0;
    }
    return 0;
  }

  /* The result comes out of the same model the rest of the app predicts
     with, so a finished match settles the same way everywhere. */
  function resultOf(match) {
    if (stateOfMatch(match) !== 'done') return null;
    var seed = 0;
    for (var i = 0; i < match.id.length; i++) seed = (seed * 31 + match.id.charCodeAt(i)) >>> 0;
    var home = seed % 4;
    var away = (seed >> 3) % 3;
    return {
      home: home, away: away,
      outcome: home > away ? 'home' : (home < away ? 'away' : 'draw'),
      btts: home > 0 && away > 0 ? 'yes' : 'no',
      first: home + away === 0 ? 'none' : (home >= away ? 'home' : 'away')
    };
  }

  function stateOfMatch(match) {
    var at = kickoffAt(match);
    if (!at) return 'upcoming';
    return Date.now() > at.getTime() + 115 * 60000 ? 'done' : 'upcoming';
  }

  function roundScore(round) {
    var total = 0;
    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      match.questions.forEach(function (id) {
        var got = scoreOf(round, match, id, pick.answers[id]);
        if (got) total += got;
      });
    });
    return total;
  }

  /* The wait a locked round is drawn against: from the moment the round
     before it is done to the moment this one opens. A first round has
     nothing behind it, so a day stands in. */
  function waitSpan(round) {
    var rounds = publishedOf(league());
    var index = rounds.indexOf(round);
    var opens = deadlineOf(round);
    var before = index > 0 ? lastWhistle(rounds[index - 1]) : null;
    var span = (opens && before) ? opens.getTime() - before.getTime() : 24 * 3600000;
    return Math.max(60000, span);
  }

  /* A countdown drains: the ring is full while the wait is still ahead and
     empty as it runs out. */
  function paintRing(ring, round) {
    var radius = parseFloat(ring.getAttribute('r')) || 40;
    var circumference = 2 * Math.PI * radius;
    var locks = deadlineOf(round);
    var left = locks ? Math.max(0, locks.getTime() - Date.now()) : 0;
    var part = Math.max(0, Math.min(1, left / waitSpan(round)));
    ring.style.strokeDasharray = circumference.toFixed(2);
    ring.style.strokeDashoffset = (circumference * (1 - part)).toFixed(2);
  }

  /* A round that has not opened yet — Figma › League-cards ›
     match-card-round2-lock. The card itself, behind a scrim, with the lock in
     the middle, the time left under it and the ring that empties as the round
     comes round. Nothing on it can be answered until its turn. */
  function lockOverlay(round) {
    var over = el('div', 'mcard__over mcard__over--lock');
    var dial = el('span', 'mcard__dial');
    dial.innerHTML =
      '<svg viewBox="0 0 88 88" width="88" height="88" aria-hidden="true">' +
        '<circle class="mcard__dialtrack" cx="44" cy="44" r="40"></circle>' +
        '<circle class="mcard__dialfill" cx="44" cy="44" r="40" data-round-ring="' + round.id + '"></circle>' +
      '</svg>' +
      /* Figma › LockKey — the padlock is drawn, not filled */
      '<svg class="mcard__lockicon" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" ' +
          'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="5" y="13" width="22" height="15" rx="3"></rect>' +
        '<path d="M11 13V8.5a5 5 0 0 1 10 0V13"></path>' +
        '<circle cx="16" cy="20.5" r="1.6" fill="currentColor" stroke="none"></circle>' +
      '</svg>';
    over.appendChild(dial);
    // the card's own header already counts the wait down; the lock only says
    // that it is a wait
    return over;
  }

  /* How long until a locked round opens: its own deadline is the moment it
     stops being a thing you are waiting for. */
  function waitFor(round) {
    var locks = deadlineOf(round);
    if (!locks) return '--:--:--';
    var left = Math.max(0, locks.getTime() - Date.now());
    function two(value) { return String(value).padStart(2, '0'); }
    return two(Math.floor(left / 3600000)) + ':' +
      two(Math.floor(left % 3600000 / 60000)) + ':' +
      two(Math.floor(left % 60000 / 1000));
  }

  /* =======================================================
     The rounds, one card under another

     A round is a card: its name, the state it is in, how long is
     left, and under that every match it is played on with every
     question the round asks of it. The round being played is
     outlined in green; the ones behind it read as a record; the
     ones ahead of it are shut behind the lock.
     ======================================================= */

  var stageRounds = [];
  var liveIndex = 0;
  var reopened = {};

  function playStage(rounds) {
    var box = el('section', 'round-play');
    stageRounds = rounds;

    /* The round being played is the first that has not been played out. */
    liveIndex = rounds.length - 1;
    for (var i = 0; i < rounds.length; i += 1) {
      if (stateOf(rounds[i]) !== 'completed') { liveIndex = i; break; }
    }

    rounds.forEach(function (round, index) {
      box.appendChild(roundCard(round, index));
    });

    window.setTimeout(paintBar, 0);
    return box;
  }

  function modeOf(index) {
    if (index > liveIndex) return 'locked';
    if (index < liveIndex || stateOf(stageRounds[index]) === 'completed') return 'past';
    return 'live';
  }

  var STATE_TEXT = { live: 'Open', past: 'Completed', locked: 'Locked' };

  function clockLine(round, mode) {
    if (mode === 'locked') return 'Opens in ' + waitFor(round);
    if (mode === 'past') return 'Completed';
    return statusLine(round);
  }

  function roundCard(round, index) {
    var mode = modeOf(index);
    var box = el('article', 'rcard rcard--' + mode);
    box.dataset.round = round.id;

    var head = el('div', 'rcard__head');
    head.appendChild(el('strong', null, round.name));
    head.appendChild(el('span', 'rcard__state rcard__state--' + mode, STATE_TEXT[mode]));
    box.appendChild(head);

    var clock = el('p', 'rcard__clock', clockLine(round, mode));
    if (mode === 'locked') {
      clock.dataset.roundWait = round.id;
      clock.dataset.waitLabel = 'Opens in ';
    } else if (mode === 'live') {
      clock.dataset.roundClock = round.id;
    }
    box.appendChild(clock);

    round.matches.forEach(function (match) {
      box.appendChild(matchBlock(round, match, mode));
    });

    if (mode === 'locked') box.appendChild(lockOverlay(round));
    else if (mode !== 'past' && roundDone(round) && !reopened[round.id]) dressDone(box, round, false);
    return box;
  }

  /* One match on the card: who is playing, when it kicks off and when the
     picks on it close, then the questions the round asks about it. */
  function matchBlock(round, match, mode) {
    var pick = pickOf(round, match);
    if (!pick.card) {
      pick.card = { outcome: null, score: { home: null, away: null }, derived: false, extras: {} };
    }
    restoreCard(round, match, pick);

    var block = el('section', 'rmatch');

    var top = el('div', 'rmatch__top');
    var crests = el('span', 'rmatch__crests');
    [match.home, match.away].forEach(function (slug) {
      var badge = document.createElement('img');
      badge.src = T.logo(slug);
      badge.alt = '';
      crests.appendChild(badge);
    });
    top.appendChild(crests);

    var copy = el('span', 'rmatch__copy');
    copy.appendChild(el('strong', null, teamsOf(match)));
    copy.appendChild(el('small', null, whenLine(round, match)));
    top.appendChild(copy);
    block.appendChild(top);

    blocksOf(match).forEach(function (id, at) {
      block.appendChild(questionBlock(round, match, pick, id, at, mode));
    });
    return block;
  }

  function whenLine(round, match) {
    var line = kickoffLabel(match);
    var minutes = Number(round.lock);
    if (!minutes) return line + ' · Picks lock at kickoff';
    return line + ' · Picks lock ' + minutes + ' min before kickoff (' +
      (match.kickoff || '') + ')';
  }

  function questionBlock(round, match, pick, id, at, mode) {
    var meta = template(id);
    var wrap = el('div', 'rq');

    var label = el('div', 'rq__label');
    label.appendChild(el('span', null, meta ? meta.label : id));
    label.appendChild(el('b', null, '+' + (meta ? meta.points : 0)));
    wrap.appendChild(label);

    var options = optionsFor(id, match);
    wrap.appendChild(options
      ? optionRow(round, match, pick, at, options, mode)
      : scoreRow(round, match, pick, at, mode));
    return wrap;
  }

  function optionRow(round, match, pick, at, options, mode) {
    var row = el('div', 'rq__opts');
    var current = valueOf(pick, match, at);
    options.forEach(function (option) {
      var button = el('button', 'rq__opt' + (current === option.value ? ' is-on' : ''), option.label);
      button.type = 'button';
      if (mode !== 'live') { button.disabled = true; return void row.appendChild(button); }
      button.addEventListener('click', function () {
        setValue(pick, match, at, option.value);
        keepCard(round, match, pick);
        repaint(round);
      });
      row.appendChild(button);
    });
    return row;
  }

  /* The exact score is the one question that is not a choice between things,
     so it gets the app's own stepper instead of a row of options. */
  function scoreRow(round, match, pick, at, mode) {
    var row = el('div', 'rq__score');
    ['home', 'away'].forEach(function (side) {
      var group = el('span', 'rq__step');
      var minus = el('button', null, '–');
      var value = el('b', null, pick.card.score && pick.card.score[side] !== null
        ? String(pick.card.score[side]) : '–');
      var plus = el('button', null, '+');
      minus.type = plus.type = 'button';

      [[minus, -1], [plus, 1]].forEach(function (pair) {
        if (mode !== 'live') { pair[0].disabled = true; return; }
        pair[0].addEventListener('click', function () {
          var score = pick.card.score || { home: null, away: null };
          var other = side === 'home' ? 'away' : 'home';
          var now = score[side];
          // the first press starts at nothing and lands on zero
          score[side] = now === null ? Math.max(0, pair[1]) : Math.max(0, Math.min(9, now + pair[1]));
          if (score[other] === null) score[other] = 0;
          pick.card.score = score;
          keepCard(round, match, pick);
          repaint(round);
        });
      });

      group.appendChild(minus);
      group.appendChild(value);
      group.appendChild(plus);
      row.appendChild(group);
    });
    return row;
  }

  /* One card redrawn where it stands — the rest of the column does not move. */
  function repaint(round) {
    if (!panel) return;
    var old = panel.querySelector('.rcard[data-round="' + round.id + '"]');
    if (!old) return;
    var fresh = roundCard(round, stageRounds.indexOf(round));
    old.replaceWith(fresh);
    paintBar();
    return fresh;
  }

  function cardFor(round) {
    return panel && panel.querySelector('.rcard[data-round="' + round.id + '"]');
  }


  /* =======================================================
     A round that is in

     Confirming closes the round's card: it goes under a scrim,
     the tick runs and it says what it is worth, with the way
     back in under it. Edit opens it again with the bar already
     up, so the same answers can go back in unchanged.
     ======================================================= */

  function roundDone(round) {
    return round.matches.every(function (match) {
      var pick = pickOf(round, match);
      return blocksOf(match).every(function (id) { return isAccepted(pick, id); });
    });
  }

  function roundWorth(round) {
    return round.matches.reduce(function (total, match) {
      var pick = pickOf(round, match);
      return total + blocksOf(match).reduce(function (sum, id, at) {
        if (!blockAnswered(pick, match, at)) return sum;
        var meta = template(id);
        return meta ? sum + meta.points : sum;
      }, 0);
    }, 0);
  }

  function dressDone(card, round, animate) {
    if (!card || card.querySelector('.mcard__over--done')) return;
    card.classList.add('is-done');

    var many = round.matches.reduce(function (count, match) {
      return count + blocksOf(match).length;
    }, 0) > 1;

    var over = el('div', 'mcard__over mcard__over--done');
    var done = el('div', 'donecard donecard--oncard');

    var art = el('div', 'donecard__art');
    art.setAttribute('aria-hidden', 'true');
    done.appendChild(art);
    done.appendChild(el('p', 'donecard__title',
      'Congratulations! Your ' + (many ? 'picks are' : 'pick is') + ' accepted.'));

    var win = el('p', 'donecard__win');
    win.appendChild(document.createTextNode('Estimated points win: '));
    win.appendChild(el('b', null, '+' + roundWorth(round)));
    done.appendChild(win);

    var edit = el('button', 'donecard__edit', many ? 'Edit picks' : 'Edit pick');
    edit.type = 'button';
    edit.addEventListener('click', function () {
      reopened[round.id] = true;
      repaint(round);
    });
    done.appendChild(edit);

    over.appendChild(done);
    card.appendChild(over);
    if (animate && T.playDoneTick) window.setTimeout(function () { T.playDoneTick(art); }, 60);
  }

  /* The card keeps its own shape; the store keeps answers by question. These
     two carry a pick between them. */
  function restoreCard(round, match, pick) {
    pick.card.outcome = pick.answers.result || null;
    pick.card.score = pick.answers.score || { home: null, away: null };
    pick.card.extras = {
      btts: pick.answers.btts || null,
      scorer: pick.answers.scorer || null
    };
  }

  function keepCard(round, match, pick) {
    /* An accepted answer is settled: entering a score derives an outcome on
       the card, and that must not quietly rewrite a result already in. */
    function open(id) { return !(pick.accepted && pick.accepted[id]); }

    if (open('result')) pick.answers.result = pick.card.outcome || undefined;
    if (open('score')) {
      if (pick.card.score && pick.card.score.home !== null && pick.card.score.away !== null) {
        pick.answers.score = pick.card.score;
      } else {
        delete pick.answers.score;
      }
    }
    ['btts', 'scorer'].forEach(function (id) {
      if (!open(id)) return;
      if (pick.card.extras && pick.card.extras[id]) pick.answers[id] = pick.card.extras[id];
      else delete pick.answers[id];
    });
    savePicks();
  }

  /* Which round the bar is about: the one being played. In a column there is
     nothing to be in front of you — there is only the round whose questions
     are still open. */
  function liveRound() {
    if (!panel) return null;
    var round = stageRounds[liveIndex];
    if (!round || modeOf(liveIndex) !== 'live') return null;
    var card = cardFor(round);
    // parked out of sight, or the whole panel is: nothing to confirm
    return card && card.offsetParent ? round : null;
  }

  /* The card always draws the result and the score; anything else the round
     asks follows in the order the owner turned it on. */
  function extrasOf(match) {
    return match.questions.filter(function (id) { return id === 'btts' || id === 'scorer'; });
  }

  /* The order the card draws them in: the result, the score if the round
     asks for it, then whatever else it asks. */
  function blocksOf(match) {
    var list = ['result'];
    if (match.questions.indexOf('score') > -1) list.push('score');
    return list.concat(extrasOf(match));
  }

  function blockAnswered(pick, match, index) {
    if (!pick.card) return false;
    var id = blocksOf(match)[index];
    if (id === 'result') return !!pick.card.outcome;
    if (id === 'score') {
      var score = pick.card.score;
      return !!(score && score.home !== null && score.away !== null);
    }
    return !!(id && pick.card.extras && pick.card.extras[id]);
  }

  /* The way back out: the round loses whatever has not been confirmed, and a
     round you had reopened closes again on what it already had in it. */
  function clearRound() {
    var round = liveRound();
    if (!round) return;
    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      blocksOf(match).forEach(function (id, at) {
        if (isAccepted(pick, id)) setValue(pick, match, at, pick.accepted[id]);
        else setValue(pick, match, at, null);
      });
      keepCard(round, match, pick);
    });
    delete reopened[round.id];
    repaint(round);
  }

  /* Accepting takes the whole round: every question on it that has an answer
     goes in at once. When that leaves nothing open the card closes on the
     tick; when it does not, the bar simply goes until the next answer. */
  function acceptRound() {
    var round = liveRound();
    if (!round) return;

    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      if (!pick.accepted) pick.accepted = {};
      blocksOf(match).forEach(function (id, at) {
        if (!blockAnswered(pick, match, at)) return;
        var value = valueOf(pick, match, at);
        pick.accepted[id] = value;
        /* Accepting IS the confirmation, so the stored answer follows it even
           when the question was answered before — keepCard only guards drafts. */
        if (id === 'score') {
          var parts = String(value).split(':');
          pick.answers.score = { home: Number(parts[0]), away: Number(parts[1]) };
        } else {
          pick.answers[id] = value;
        }
      });
    });

    savePicks();
    var closing = roundDone(round);
    delete reopened[round.id];
    var card = repaint(round);
    if (closing && card) {
      // the card was drawn without the tick; it is earned, so play it
      var art = card.querySelector('.donecard__art');
      if (art && T.playDoneTick) window.setTimeout(function () { T.playDoneTick(art); }, 60);
    }
  }

  function isAccepted(pick, id) {
    return !!(pick.accepted && Object.prototype.hasOwnProperty.call(pick.accepted, id));
  }

  /* What is on the card for a question, and what was accepted for it. The two
     differ exactly when there is something to confirm. */
  function valueOf(pick, match, index) {
    var id = blocksOf(match)[index];
    if (id === 'result') return pick.card.outcome || null;
    if (id === 'score') {
      var score = pick.card.score;
      return score && score.home !== null && score.away !== null
        ? score.home + ':' + score.away : null;
    }
    return (pick.card.extras && pick.card.extras[id]) || null;
  }

  function setValue(pick, match, index, value) {
    var id = blocksOf(match)[index];
    if (id === 'result') { pick.card.outcome = value || null; return; }
    if (id === 'score') {
      if (!value) { pick.card.score = { home: null, away: null }; return; }
      var parts = String(value).split(':');
      pick.card.score = { home: Number(parts[0]), away: Number(parts[1]) };
      return;
    }
    if (!pick.card.extras) pick.card.extras = {};
    pick.card.extras[id] = value || null;
  }

  /* Leaving a question you have changed but not confirmed puts it back the
     way it was accepted — the change was never yours to keep. */
  function revert(round, match, index) {
    var pick = pickOf(round, match);
    var id = blocksOf(match)[index];
    if (!isAccepted(pick, id)) return false;
    if (valueOf(pick, match, index) === pick.accepted[id]) return false;
    setValue(pick, match, index, pick.accepted[id]);
    keepCard(round, match, pick);
    return true;
  }


  /* The shared confirmation surface, in the league's own currency. It is up
     while the round being played is holding an answer nobody has confirmed,
     and its button takes the round in one go. */
  var barReady = false;

  function paintBar() {
    var bar = T.pickConfirmationBar;
    if (!bar || !bar.element) return;

    var round = liveRound();
    if (!round) {
      bar.show(false);
      barReady = false;
      return;
    }

    /* Normally the bar is about a change: it is up while something on the
       card differs from what was confirmed. A round you reopened is the
       exception — the button is there from the first moment, so the same
       answers can be confirmed again untouched. */
    var ready = round.matches.some(function (match) {
      var pick = pickOf(round, match);
      return blocksOf(match).some(function (id, at) {
        if (!blockAnswered(pick, match, at)) return false;
        return reopened[round.id] || !isAccepted(pick, id) ||
          pick.accepted[id] !== valueOf(pick, match, at);
      });
    });

    if (!ready) {
      bar.show(false);
      barReady = false;
      return;
    }

    bar.element.classList.add('winbar--round-picks', 'winbar--points');
    if (bar.label) bar.label.textContent = 'Potential win:';
    if (bar.points) bar.points.textContent = '+' + roundWorth(round);

    if (bar.next) {
      bar.next.textContent = 'Accept pick';
      bar.next.disabled = false;
      bar.next.onclick = acceptRound;
      // one nudge as it comes alive, the way the daily slip does it
      if (!barReady) {
        bar.next.classList.remove('is-nudging');
        void bar.next.offsetWidth;
        bar.next.classList.add('is-nudging');
      }
    }
    if (bar.close) bar.close.onclick = clearRound;
    barReady = true;
    bar.show(true);
  }

  /* =======================================================
     Manage rounds
     ======================================================= */

  var list = $('[data-rounds-list]');
  var listEmpty = $('[data-rounds-empty]');

  function renderList() {
    if (!list) return;
    var rounds = roundsOf(league());
    var fragment = document.createDocumentFragment();

    rounds.forEach(function (round, index) {
      var row = el('button', 'round-row');
      row.type = 'button';
      var head = el('div', 'round-row__head');
      // "Round 1 · Derby Weekend", unless the name already says which round
      var numbered = /^round\s/i.test(round.name.trim());
      head.appendChild(el('span', 'round-row__title',
        numbered ? round.name : 'Round ' + (index + 1) + ' · ' + round.name));
      head.appendChild(pill(stateOf(round)));
      row.appendChild(head);

      var first = round.matches[0];
      row.appendChild(el('span', 'round-row__meta',
        (first ? kickoffLabel(first) + ' · ' : '') +
        round.matches.length + ' ' + (round.matches.length === 1 ? 'match' : 'matches')));
      row.appendChild(el('span', 'round-row__meta',
        questionCount(round) + ' questions'));

      row.addEventListener('click', function () { openEditor(round.id); });
      fragment.appendChild(row);
    });

    list.replaceChildren(fragment);
    if (listEmpty) listEmpty.hidden = rounds.length > 0;
    // the empty state carries its own; this one is for when there are already some
    var add = $('[data-rounds-add]');
    if (add) add.hidden = !rounds.length;
  }


  /* =======================================================
     The editor

     A draft is edited in place. Anything published opens the
     same screen with everything turned off — it is the record
     of what was published, not a form.
     ======================================================= */

  var head = $('[data-round-head]');
  var nameInput = $('[data-round-name]');
  var descInput = $('[data-round-desc]');
  var descCount = $('[data-round-desc-count]');
  var matchList = $('[data-round-matches]');
  var matchesEmpty = $('[data-round-matches-empty]');
  var actions = $('[data-round-actions]');
  var readonlyNote = $('[data-round-readonly]');
  var addButton = $('[data-round-add]');
  var editing = null;

  function blankRound() {
    var index = roundsOf(league()).length + 1;
    return {
      id: 'r' + Date.now(),
      name: 'Round ' + index,
      description: '',
      matches: [],
      lock: 15,
      state: 'draft'
    };
  }

  var creating = false;

  function openEditor(id) {
    var rounds = roundsOf(league());
    editing = id ? rounds.filter(function (round) { return round.id === id; })[0] : blankRound();
    if (!editing) return;
    creating = rounds.indexOf(editing) === -1;
    dressEditor();
    if (T.go) T.go('league-round-edit');
  }

  function editable() { return editing && editing.state === 'draft'; }

  function dressEditor() {
    if (!editing) return;
    if (head) head.textContent = editable() ? (creating ? 'Create round' : 'Edit round') : editing.name;
    if (nameInput) { nameInput.value = editing.name; nameInput.disabled = !editable(); }
    if (descInput) { descInput.value = editing.description || ''; descInput.disabled = !editable(); }
    countDescription();
    if (addButton) addButton.hidden = !editable();
    if (actions) actions.hidden = !editable();
    if (readonlyNote) readonlyNote.hidden = editable();
    renderMatches();
  }

  function countDescription() {
    if (!descCount || !descInput) return;
    descCount.textContent = descInput.value.length + '/120';
  }

  function renderMatches() {
    if (!matchList || !editing) return;
    var fragment = document.createDocumentFragment();

    editing.matches.forEach(function (match) {
      var box = el('article', 'round-match');
      var top = el('div', 'round-match__head');

      var badges = el('span', 'round-match__badges');
      [match.home, match.away].forEach(function (slug) {
        var logo = document.createElement('img');
        logo.src = T.logo(slug);
        logo.alt = '';
        badges.appendChild(logo);
      });
      top.appendChild(badges);

      var teams = el('span', 'round-match__teams');
      teams.appendChild(el('strong', null, teamsOf(match)));
      teams.appendChild(el('small', null, kickoffLabel(match) + ' · ' + match.league));
      top.appendChild(teams);

      if (editable()) {
        var drop = el('button', 'round-match__drop', 'Remove');
        drop.type = 'button';
        drop.addEventListener('click', function () {
          editing.matches = editing.matches.filter(function (other) { return other.id !== match.id; });
          renderMatches();
        });
        top.appendChild(drop);
      }
      box.appendChild(top);

      var questions = el('div', 'round-questions');
      questions.appendChild(el('span', null, 'Prediction questions'));
      TEMPLATES.forEach(function (template) {
        var on = match.questions.indexOf(template.id) > -1;
        var row = el('div', 'round-q' + (template.required ? ' round-q--fixed' : ''));
        row.appendChild(el('span', 'round-q__copy', template.label));
        row.appendChild(el('span', 'round-q__points', '+' + template.points));

        var toggle = el('button', 'round-q__toggle' + (on ? ' is-on' : ''));
        toggle.type = 'button';
        toggle.appendChild(document.createElement('i'));
        toggle.disabled = template.required || !editable();
        toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        toggle.setAttribute('aria-label', template.label);
        toggle.addEventListener('click', function () {
          var at = match.questions.indexOf(template.id);
          if (at > -1) match.questions.splice(at, 1);
          else match.questions.push(template.id);
          renderMatches();
        });
        row.appendChild(toggle);
        questions.appendChild(row);
      });
      box.appendChild(questions);
      fragment.appendChild(box);
    });

    matchList.replaceChildren(fragment);
    if (matchesEmpty) matchesEmpty.hidden = editing.matches.length > 0;
  }

  if (nameInput) nameInput.addEventListener('input', function () { if (editing) editing.name = nameInput.value; });
  if (descInput) {
    descInput.addEventListener('input', function () {
      if (editing) editing.description = descInput.value;
      countDescription();
    });
  }


  /* =======================================================
     The match picker
     ======================================================= */

  var picker = $('[data-round-picker]');
  var search = $('[data-round-search]');
  var dayStrip = $('[data-round-days]');
  var fixtureList = $('[data-round-fixtures]');
  var pickedDay = 0;

  /* The calendar the day strip on Main uses — same cell, same marks, so a
     date reads the same wherever it is chosen. */
  function renderDays() {
    if (!dayStrip) return;
    var fragment = document.createDocumentFragment();
    days.forEach(function (day, index) {
      var cell = el('button', 'datecell');
      cell.type = 'button';
      cell.appendChild(el('span', 'datecell__m', day.month));
      cell.appendChild(el('span', 'datecell__d', String(day.date)));
      cell.appendChild(el('span', 'datecell__w', day.weekday));
      cell.classList.toggle('is-active', index === pickedDay);
      cell.classList.toggle('is-today', !!day.isToday);
      cell.addEventListener('click', function () {
        pickedDay = index;
        renderDays();
        renderFixtures();
      });
      fragment.appendChild(cell);
    });
    dayStrip.replaceChildren(fragment);

    var active = dayStrip.querySelector('.datecell.is-active');
    if (active) {
      dayStrip.scrollTo({
        left: active.offsetLeft - dayStrip.clientWidth / 2 + active.offsetWidth / 2,
        behavior: 'smooth'
      });
    }
  }

  /* Is this fixture still in front of us? The day carries the date and the
     match carries the clock. */
  function ahead(day, match) {
    var parts = (day && day.key ? day.key : '').split('-');
    var clock = (match.kickoff || '00:00').split(':');
    if (parts.length !== 3) return true;
    var at = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
      Number(clock[0]), Number(clock[1]));
    return at.getTime() > Date.now();
  }

  function renderFixtures() {
    if (!fixtureList || !editing) return;
    var day = days[pickedDay];
    var term = (search && search.value.trim().toLowerCase()) || '';
    var fragment = document.createDocumentFragment();

    (day ? day.matches : []).forEach(function (match) {
      var label = teamsOf(match).toLowerCase();
      if (term && label.indexOf(term) === -1) return;
      /* A round is played on matches still to come. One that has already
         kicked off would arrive with its picks closed and its own card
         reading as completed, which is not a round anybody can play. */
      if (!ahead(day, match)) return;

      var already = editing.matches.some(function (other) { return other.id === match.id; });
      var row = el('button', 'round-fixture');
      row.type = 'button';
      row.disabled = already;

      [match.home, match.away].forEach(function (slug) {
        var logo = document.createElement('img');
        logo.src = T.logo(slug);
        logo.alt = '';
        row.appendChild(logo);
      });

      var copy = el('span', 'round-fixture__copy');
      copy.appendChild(el('strong', null, teamsOf(match)));
      copy.appendChild(el('small', null,
        day.weekday + ' ' + day.date + ' ' + day.month + ' · ' + match.kickoff + ' · ' + match.league +
        (already ? ' · already in this round' : '')));
      row.appendChild(copy);

      row.addEventListener('click', function () {
        // the same fixture cannot be played twice in one round
        if (editing.matches.some(function (other) { return other.id === match.id; })) return;
        editing.matches.push({
          id: match.id, home: match.home, away: match.away,
          league: match.league, kickoff: match.kickoff,
          /* The day is written down with the match. The calendar is built
             from today outwards, so a fixture picked this morning is not in
             it next week — and a round that cannot say when it is played
             cannot say when it closes. */
          date: day.key,
          questions: ['result']            // the one every round asks
        });
        closePicker();
        renderMatches();
      });
      fragment.appendChild(row);
    });

    if (!fragment.childNodes.length) {
      fragment.appendChild(el('p', 'round-hint',
        'Nothing still to come here — try another day or another team.'));
    }
    fixtureList.replaceChildren(fragment);
  }

  function openPicker() {
    if (!picker || !editable()) return;
    if (search) search.value = '';
    renderDays();
    renderFixtures();
    picker.hidden = false;
  }

  function closePicker() { if (picker) picker.hidden = true; }

  if (addButton) addButton.addEventListener('click', openPicker);
  if (search) search.addEventListener('input', renderFixtures);
  if (picker) {
    picker.addEventListener('click', function (event) {
      if (event.target === picker) closePicker();
    });
  }


  /* =======================================================
     Saving and publishing
     ======================================================= */

  function keep() {
    if (!editing) return;
    var rounds = roundsOf(league());
    if (rounds.indexOf(editing) === -1) rounds.push(editing);
    save();
  }

  $$('[data-round-save]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!editing) return;
      if (!editing.name.trim()) editing.name = 'Round ' + (roundsOf(league()).length + 1);
      keep();
      renderList();
      renderPanel();
      toRounds();
    });
  });

  $$('[data-round-publish]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!editing) return;
      var questions = questionCount(editing);
      if (!editing.matches.length || !questions) {
        if (T.confirm) {
          T.confirm('Not ready to publish',
            'A round needs at least one match with one question on it before anyone can play it.',
            'Keep editing', function () {});
        }
        return;
      }
      if (!T.confirm) return;
      T.confirm('Publish ' + editing.name + '?',
        editing.matches.length + ' ' + (editing.matches.length === 1 ? 'match' : 'matches') +
        ' · ' + questions + ' questions.' +
        ' Matches and questions can’t be edited after publishing.',
        'Publish round', function () {
          editing.state = 'published';
          keep();
          renderList();
          renderPanel();
          toRounds();
        }, { danger: false });
    });
  });

  $$('[data-round-new]').forEach(function (button) {
    button.addEventListener('click', function () { openEditor(null); });
  });

  /* The way to a first round from the league page itself — Premium buys the
     rounds, so only the owner of such a league is offered one. */
  var newRound = $('[data-league-new-round]');
  if (newRound) {
    newRound.addEventListener('click', function () {
      // without Premium the gold button is the way to it, not to a round
      if (newRound.dataset.mode !== 'premium') openEditor(null);
    });
    document.addEventListener('the90:league-membership', function (event) {
      var detail = event.detail || {};
      newRound.hidden = !detail.own;
      newRound.dataset.mode = detail.premium ? 'round' : 'premium';
      newRound.textContent = detail.premium ? 'Create round' : 'Activate premium';
      if (detail.premium) delete newRound.dataset.settingsSheet;
      else newRound.dataset.settingsSheet = 'premium';
    });
  }

  /* Out of the editor and back to the league, on the tab the round is played
     on — the round you just made is the thing you want to see. */
  function toRounds() {
    if (!T.go) return;
    T.go('league');
    window.setTimeout(function () {
      if (T.leagueTabs) T.leagueTabs.open('picks');
    }, 60);
  }


  /* =======================================================
     Wiring
     ======================================================= */

  function releaseBar() {
    var bar = T.pickConfirmationBar;
    if (!bar || !bar.element) return;
    bar.element.classList.remove('winbar--points');
    if (bar.next) bar.next.onclick = null;
    if (bar.close) bar.close.onclick = null;
    if (bar.restoreDaily) bar.restoreDaily();
  }

  /* A choice you did not accept is a thought, not a pick: it goes when you
     leave, and the round picks up at the first question still open. */
  function dropUnconfirmed(round) {
    if (!round) return;
    var changed = false;
    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      blocksOf(match).forEach(function (id) {
        if (pick.accepted && pick.accepted[id]) return;
        if (pick.answers[id] === undefined) return;
        delete pick.answers[id];
        changed = true;
      });
      if (pick.card) {
        if (!(pick.accepted && pick.accepted.result)) pick.card.outcome = null;
        if (!(pick.accepted && pick.accepted.score)) pick.card.score = { home: null, away: null };
        ['btts', 'scorer'].forEach(function (id) {
          if (pick.accepted && pick.accepted[id]) return;
          if (pick.card.extras) pick.card.extras[id] = null;
        });
      }
    });
    if (changed) savePicks();
  }

  window.addEventListener('the90:screen', function (event) {
    if (event.detail === 'league-rounds') renderList();
    if (event.detail === 'league') {
      renderPanel();
      window.setTimeout(paintBar, 0);
      window.setTimeout(function () {
        $$('[data-round-ring]', panel || document).forEach(function (ring) {
          var item = roundsOf(league()).filter(function (r) { return r.id === ring.dataset.roundRing; })[0];
          if (item) paintRing(ring, item);
        });
      }, 0);
    } else {
      dropUnconfirmed(publishedOf(league())[0]);
      reopened = {};
      releaseBar();
    }
    if (event.detail !== 'league-round-edit') closePicker();
  });

  renderPanel();

  /* Once a second while a league is open in front of you: the status line is
     a countdown, and a countdown that does not move is a label. */
  window.setInterval(function () {
    var active = document.querySelector('.screen.is-active');
    if (!active || active.dataset.screen !== 'league') return;
    $$('[data-round-clock]', panel || document).forEach(function (cell) {
      var round = roundsOf(league()).filter(function (item) {
        return item.id === cell.dataset.roundClock;
      })[0];
      if (round) cell.textContent = statusLine(round);
    });

    // a round still to open counts down instead, around its own lock
    $$('[data-round-wait]', panel || document).forEach(function (cell) {
      var round = roundsOf(league()).filter(function (item) {
        return item.id === cell.dataset.roundWait;
      })[0];
      if (!round) return;
      cell.textContent = (cell.dataset.waitLabel || '') + waitFor(round);
    });
    $$('[data-round-ring]', panel || document).forEach(function (ring) {
      var round = roundsOf(league()).filter(function (item) {
        return item.id === ring.dataset.roundRing;
      })[0];
      if (round) paintRing(ring, round);
    });
  }, 1000);

  /* =======================================================
     What a league you made pays out, and how it is played

     Both are written on the way in, so both are shown from
     the league's own record rather than from the demo.
     ======================================================= */

  /* What a league pays is written into its rules by hand, so there is one
     box on that tab and one thing that fills it. */
  var rulesPanel = document.querySelector('[data-league-rules]');
  var demoRules = rulesPanel ? rulesPanel.innerHTML : '';

  function renderRules() {
    if (!rulesPanel) return;
    var rules = viewing.league && viewing.league.rules;
    if (rules) {
      rulesPanel.innerHTML = '<div class="league-rules-copy">' + rules + '</div>';
      return;
    }
    /* A league you made has nothing here until you write it; one you were
       invited into shows what its owner would have written. */
    if (!isOwner()) { rulesPanel.innerHTML = demoRules; return; }

    var empty = el('div', 'league-rules-empty');
    empty.appendChild(el('p', null, 'You haven’t written any rules for this league yet.'));
    var write = el('button', 'btn league-rules-write', 'Add description');
    write.type = 'button';
    write.addEventListener('click', openRules);
    empty.appendChild(write);
    rulesPanel.replaceChildren(empty);
  }

  /* =======================================================
     Writing the rules

     Free form, in the editor the create wizard carries — the
     same formatting and the same pictures.
     ======================================================= */

  var rulesArea = $('[data-league-own-rules]');
  var rulesSave = $('[data-league-rules-save]');

  function openRules() {
    if (rulesArea) rulesArea.innerHTML = (viewing.league && viewing.league.rules) || '';
    if (T.go) T.go('league-rules-edit');
  }

  if (rulesSave) {
    rulesSave.addEventListener('click', function () {
      var html = rulesArea ? rulesArea.innerHTML.trim() : '';
      if (T.ownLeagues && viewing.index > -1) T.ownLeagues.setRules(viewing.index, html);
      if (viewing.league) viewing.league.rules = html;
      renderRules();
      if (T.go) T.go('league');
      window.setTimeout(function () {
        if (T.leagueTabs) T.leagueTabs.open('rules');
      }, 60);
    });
  }

  T.leagueRounds = {
    of: function () { return roundsOf(league()); },
    open: openEditor,
    templates: TEMPLATES
  };
})();
