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
    return roundsOf(league).filter(function (round) { return round.state !== 'draft'; });
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
      return locks.getTime() > Date.now() ? 'Closes in ' + countdown(locks) : 'In play';
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

  function answeredCount(round) {
    return round.matches.reduce(function (total, match) {
      var pick = pickOf(round, match);
      return total + match.questions.filter(function (id) {
        return pick.answers[id] !== undefined;
      }).length;
    }, 0);
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
    if (typeof renderPrizes === 'function') renderPrizes();
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

    publishedOf(league()).forEach(function (round, index) {
      panel.appendChild(index === 0 ? playCard(round) : lockedCard(round, index));
    });

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

  function chip(label, on, run) {
    var button = el('button', 'pick-chip' + (on ? ' is-on' : ''), label);
    button.type = 'button';
    if (run) button.addEventListener('click', run);
    else button.disabled = true;
    return button;
  }

  function scoreStepper(pick, run, live) {
    var box = el('div', 'pick-score');
    ['home', 'away'].forEach(function (side) {
      var current = pick.answers.score || { home: 0, away: 0 };
      var group = el('span', 'pick-score__side');
      var minus = el('button', 'pick-score__btn', '–');
      var value = el('b', null, String(current[side]));
      var plus = el('button', 'pick-score__btn', '+');
      minus.type = plus.type = 'button';
      if (!live) { minus.disabled = plus.disabled = true; }
      [[minus, -1], [plus, 1]].forEach(function (pair) {
        pair[0].addEventListener('click', function () {
          var next = pick.answers.score || { home: 0, away: 0 };
          next[side] = Math.max(0, Math.min(9, next[side] + pair[1]));
          pick.answers.score = next;
          run();
        });
      });
      group.appendChild(minus);
      group.appendChild(value);
      group.appendChild(plus);
      box.appendChild(group);
    });
    return box;
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
     match-card-round2-lock. The round's own cards, behind a scrim, with the
     lock in the middle and the wait drawn around it. Nothing on them can be
     answered until the round before this one is done. */
  function lockedCard(round, index) {
    var box = el('section', 'round-play round-play--locked');
    box.appendChild(roundHead(round, 'locked'));

    var track = el('div', 'picks-track round-track');
    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      if (!pick.card) {
        pick.card = { outcome: null, score: { home: null, away: null }, derived: false, extras: {} };
      }
      restoreCard(round, match, pick);
      var card = T.pickCard.create(match, pick.card, {
        when: kickoffLabel(match).split(' · ')[0],
        round: true,
        questions: match.questions,
        extras: extrasOf(match),
        editable: function () { return false; },
        onChange: function () {}
      });
      card.appendChild(lockOverlay(round));
      card.classList.add('is-shut');
      track.appendChild(card);
    });
    box.appendChild(track);
    return box;
  }

  /* The wait itself: a lock, the time left under it, and the ring that
     empties as the round comes round. */
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

    var clock = el('b', 'mcard__opens', 'Open in ' + waitFor(round));
    clock.dataset.roundWait = round.id;
    clock.dataset.waitLabel = 'Open in ';
    over.appendChild(clock);
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

  /* The round's own header: which round, how long is left, and how much of
     it is answered — Figma › LEAGUES › League (748:2284). */
  function roundHead(round, state) {
    var box = el('div', 'round-head');
    var top = el('div', 'round-head__row');
    top.appendChild(el('strong', null, round.name));
    if (state) top.appendChild(pill(state));


    var clock = el('span', 'round-head__clock');
    var timer = document.createElement('img');
    timer.src = 'assets/icons/timer.svg';
    timer.alt = '';
    timer.width = timer.height = 16;
    clock.appendChild(timer);
    var locked = state === 'locked';
    var ticking = el('b', null, locked ? 'Opens in ' + waitFor(round) : statusLine(round));
    if (locked) {
      ticking.dataset.roundWait = round.id;
      ticking.dataset.waitLabel = 'Opens in ';
    } else {
      ticking.dataset.roundClock = round.id;
    }
    clock.appendChild(ticking);
    top.appendChild(clock);
    box.appendChild(top);

    // a round nobody can answer yet has no progress to report
    if (locked) return box;

    var bar = el('div', 'round-head__row');
    var rail = el('div', 'round-head__rail');
    var fill = el('i');
    var total = round.matches.reduce(function (sum, match) {
      return sum + blocksOf(match).length;
    }, 0);
    var done = acceptedCount(round);
    fill.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    rail.appendChild(fill);
    bar.appendChild(rail);
    var count = el('span', 'round-head__count');
    count.appendChild(el('b', null, String(done)));
    count.appendChild(el('small', null, '/' + total));
    bar.appendChild(count);
    box.appendChild(bar);
    return box;
  }

  /* One card per match, the app's own — the same pitch, the same crests, the
     same highlight when an answer lands — with the round's questions in it. */
  function playCard(round) {
    var state = stateOf(round);
    /* Anything short of played out is played on. A round whose fixtures have
       aged out of the calendar cannot work out its own deadline and reports
       itself as published — that is not a reason to shut its questions. */
    var live = state !== 'completed';
    var box = el('section', 'round-play');

    box.appendChild(roundHead(round));

    var track = el('div', 'picks-track round-track');
    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      if (!pick.card) {
        pick.card = { outcome: null, score: { home: null, away: null }, derived: false, extras: {} };
      }
      restoreCard(round, match, pick);

      var extras = match.questions.filter(function (id) {
        return id === 'btts' || id === 'scorer';
      });

      var card = T.pickCard.create(match, pick.card, {
        when: kickoffLabel(match).split(' · ')[0],
        round: true,
        questions: match.questions,
        extras: extras,
        // a league round does not shut you out: the pick is yours to change
      editable: function () { return true; },
        onChange: function () {
          keepCard(round, match, pick);
          paintBar(round);
        }
      });
      var slider = card.querySelector('.mcard__body');
      if (slider) {
        slider.addEventListener('scroll', function () {
          var was = Number(card.dataset.question || 0);
          var now = Math.round(slider.scrollLeft / Math.max(1, slider.clientWidth));
          if (now !== was && revert(round, match, was)) {
            card.dataset.question = String(now);
            renderPanel();
            return;
          }
          card.dataset.question = String(now);
          paintBar(round);
        }, { passive: true });
      }

      /* Every question on this card confirmed: the card goes dark and says
         so, with the way back in under it. Coming into a round already
         played is not an occasion, so the tick only runs on arrival. */
      if (live && cardComplete(round, match)) dressDone(card, round, match, false);
      else card.classList.toggle('is-live', live);

      track.appendChild(card);
    });
    track.addEventListener('scroll', function () {
      settleCards(round);
      paintBar(round);
    }, { passive: true });
    box.appendChild(track);

    window.setTimeout(function () { paintBar(round); }, 0);
    return box;
  }

  /* =======================================================
     A card that is in

     Confirming the last question on a card closes it: the
     pitch dims, the tick runs and the card says what it is
     worth — the daily slip's own ending, on the card itself
     (Figma › League-cards › match-card-round2-accepted).

     Edit opens it again. While it is open the bar is up from
     the first moment, so the same answers can go back in
     unchanged. Anything the card is left in the middle of —
     swiping away, or closing the bar — settles back to what
     was last confirmed.
     ======================================================= */

  var reopened = {};

  function cardComplete(round, match) {
    var pick = pickOf(round, match);
    return blocksOf(match).every(function (id) { return isAccepted(pick, id); });
  }

  function cardWorth(round, match) {
    var pick = pickOf(round, match);
    return blocksOf(match).reduce(function (total, id) {
      if (pick.answers[id] === undefined) return total;
      var meta = template(id);
      return meta ? total + meta.points : total;
    }, 0);
  }

  function dressDone(card, round, match, animate) {
    if (!card || card.querySelector('.mcard__over--done')) return;
    card.classList.remove('is-live');
    card.classList.add('is-done');

    var many = blocksOf(match).length > 1;
    var over = el('div', 'mcard__over mcard__over--done');
    var done = el('div', 'donecard donecard--oncard');

    var art = el('div', 'donecard__art');
    art.setAttribute('aria-hidden', 'true');
    done.appendChild(art);
    done.appendChild(el('p', 'donecard__title',
      'Congratulations! Your ' + (many ? 'picks are' : 'pick is') + ' accepted.'));

    var win = el('p', 'donecard__win');
    win.appendChild(document.createTextNode('Estimated points win: '));
    win.appendChild(el('b', null, '+' + cardWorth(round, match)));
    done.appendChild(win);

    var edit = el('button', 'donecard__edit', many ? 'Edit picks' : 'Edit pick');
    edit.type = 'button';
    edit.addEventListener('click', function () {
      reopened[match.id] = true;
      strainDone(card);
      paintBar(round);
    });
    done.appendChild(edit);

    over.appendChild(done);
    card.appendChild(over);
    if (animate && T.playDoneTick) window.setTimeout(function () { T.playDoneTick(art); }, 60);
  }

  function strainDone(card) {
    if (!card) return;
    var over = card.querySelector('.mcard__over--done');
    if (over) over.remove();
    card.classList.remove('is-done');
    card.classList.add('is-live');
  }

  /* Leaving a card you reopened puts it back the way it was confirmed — the
     round-trip is the same one a single question makes. */
  function settleCards(round) {
    if (!panel) return;
    var spot = currentSpot(round);
    round.matches.forEach(function (match, index) {
      if (index === spot.index) return;
      if (!reopened[match.id]) return;
      delete reopened[match.id];
      var card = panel.querySelector('.mcard--round[data-card="' + match.id + '"]');
      if (!card) return;
      var pick = pickOf(round, match);
      var moved = false;
      blocksOf(match).forEach(function (id, at) {
        if (revert(round, match, at)) moved = true;
      });
      if (moved && card.render) {
        restoreCard(round, match, pick);
        card.render(false);
      }
      if (cardComplete(round, match)) dressDone(card, round, match, false);
    });
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

  /* The rail and the counter under the round's name, redrawn without
     rebuilding the cards — they are mid-slide when this runs. */
  function paintProgress(round) {
    if (!panel) return;
    var rail = panel.querySelector('.round-head__rail i');
    var count = panel.querySelector('.round-head__count');
    var total = round.matches.reduce(function (sum, match) {
      return sum + blocksOf(match).length;
    }, 0);
    var done = acceptedCount(round);
    if (rail) rail.style.width = (total ? Math.round(done / total * 100) : 0) + '%';

    if (count) {
      count.replaceChildren();
      count.appendChild(el('b', null, String(done)));
      count.appendChild(el('small', null, '/' + total));
    }
  }

  /* Where the eye is: which match is under the rail, and which question is
     under the card's own slider. */
  function currentSpot(round) {
    var track = panel && panel.querySelector('.round-track');
    var cards = panel ? $$('.mcard--round', panel) : [];
    var index = track ? Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) : 0;
    index = Math.max(0, Math.min(cards.length - 1, index));
    var card = cards[index];
    var body = card && card.querySelector('.mcard__body');
    var blocks = card ? $$('.mcard__block', card) : [];
    var question = card && card.dataset.question !== undefined
      ? Number(card.dataset.question)
      : (body ? Math.round(body.scrollLeft / Math.max(1, body.clientWidth)) : 0);
    return {
      index: index,
      match: round.matches[index],
      card: card,
      body: body,
      blocks: blocks,
      question: Math.max(0, Math.min(blocks.length - 1, question))
    };
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

  /* The way back out: the question in front of you loses what has not been
     accepted yet, and a card you had reopened closes again on what it already
     had in it. */
  function clearCurrent(round) {
    var spot = currentSpot(round);
    if (!spot.match) return;
    var pick = pickOf(round, spot.match);
    var id = blocksOf(spot.match)[spot.question];
    if (isAccepted(pick, id)) {
      // an accepted answer goes back to what it was, not to nothing
      setValue(pick, spot.match, spot.question, pick.accepted[id]);
    } else {
      setValue(pick, spot.match, spot.question, null);
    }
    keepCard(round, spot.match, pick);
    if (reopened[spot.match.id]) {
      delete reopened[spot.match.id];
      blocksOf(spot.match).forEach(function (each, at) { revert(round, spot.match, at); });
      keepCard(round, spot.match, pick);
    }
    renderPanel();
    goTo(round, spot.index, spot.question);
  }

  /* Back to a card and a question after the panel has been redrawn under
     you — the redraw starts at the beginning, and you did not. */
  function goTo(round, index, question) {
    if (!panel) return;
    var track = panel.querySelector('.round-track');
    var cards = $$('.mcard--round', panel);
    var card = cards[index];
    if (!card) return;
    card.dataset.question = String(question);
    var body = card.querySelector('.mcard__body');
    if (body) body.scrollLeft = question * body.clientWidth;
    if (track) track.scrollLeft = Math.max(0, card.offsetLeft - track.offsetLeft);
  }

  /* The first question in the round that has not been accepted yet, walking
     forward from a card and wrapping past the end — the same way the daily
     slip comes back for the ones you skipped. */
  function nextOpenSpot(round, fromIndex) {
    for (var step = 1; step <= round.matches.length; step += 1) {
      var index = (fromIndex + step) % round.matches.length;
      var pick = pickOf(round, round.matches[index]);
      var ids = blocksOf(round.matches[index]);
      for (var q = 0; q < ids.length; q += 1) {
        if (!isAccepted(pick, ids[q])) return { index: index, question: q };
      }
    }
    return null;
  }

  /* Accepting moves you on: the next open question on this card, then the
     next card that still has one, wrapping back to anything skipped. Once
     everything is in, confirming a change stays where you are. */
  function acceptOne(round) {
    var spot = currentSpot(round);
    if (!spot.match || !spot.body) return;
    var pick = pickOf(round, spot.match);
    if (!blockAnswered(pick, spot.match, spot.question)) return;

    var id = blocksOf(spot.match)[spot.question];
    if (!pick.accepted) pick.accepted = {};
    var value = valueOf(pick, spot.match, spot.question);
    pick.accepted[id] = value;
    /* Accepting IS the confirmation, so the stored answer follows it even
       when the question was answered before — keepCard only guards drafts. */
    if (id === 'score') {
      var scoreParts = String(value).split(':');
      pick.answers.score = { home: Number(scoreParts[0]), away: Number(scoreParts[1]) };
    } else {
      pick.answers[id] = value;
    }

    /* A result and an exact score describe the same match, so an accepted
       pair can never disagree. A new result that contradicts the accepted
       score reopens the score question; a new score simply rewrites the
       result it implies — exactly what the daily card does. */
    function impliedOutcome(score) {
      var parts = String(score).split(':');
      var home = Number(parts[0]), away = Number(parts[1]);
      return home > away ? 'home' : (home < away ? 'away' : 'draw');
    }
    if (id === 'result' && pick.accepted.score !== undefined &&
        impliedOutcome(pick.accepted.score) !== pick.accepted.result) {
      delete pick.accepted.score;
      delete pick.answers.score;
    }
    if (id === 'score') {
      var implied = impliedOutcome(pick.accepted.score);
      if (pick.accepted.result !== implied) {
        pick.accepted.result = implied;
        pick.answers.result = implied;
      }
    }

    savePicks();
    paintProgress(round);

    /* A reopened card is walked through in full — every question on it is up
       for review again, whether or not it is being changed. */
    var reviewing = !!reopened[spot.match.id];
    for (var next = spot.question + 1; next < spot.blocks.length; next += 1) {
      if (!reviewing && isAccepted(pick, blocksOf(spot.match)[next])) continue;
      if (spot.card) spot.card.dataset.question = String(next);
      spot.body.scrollLeft = next * spot.body.clientWidth;
      window.setTimeout(function () { paintBar(round); }, 340);
      return;
    }

    // the card is in: it closes where you are, rather than moving you on
    if (cardComplete(round, spot.match)) {
      delete reopened[spot.match.id];
      dressDone(spot.card, round, spot.match, true);
      paintBar(round);
      return;
    }

    var track = panel && panel.querySelector('.round-track');
    var onward = nextOpenSpot(round, spot.index);
    if (track && onward) {
      var cards = $$('.mcard--round', panel);
      var target = cards[onward.index];
      if (target) {
        target.dataset.question = String(onward.question);
        var body = target.querySelector('.mcard__body');
        if (body) body.scrollLeft = onward.question * body.clientWidth;
      }
      track.scrollLeft = onward.index * track.clientWidth;
      window.setTimeout(function () { paintBar(round); }, 340);
    }
  }

  function isAccepted(pick, id) {
    return !!(pick.accepted && Object.prototype.hasOwnProperty.call(pick.accepted, id));
  }

  function acceptedCount(round) {
    return round.matches.reduce(function (total, match) {
      var pick = pickOf(round, match);
      return total + blocksOf(match).filter(function (id) {
        return isAccepted(pick, id);
      }).length;
    }, 0);
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


  /* The shared confirmation surface, in the league's own currency. It says
     what the round is worth, and its button is about the question in front of
     you: accept it, or go and answer it. */
  var barReady = false;

  function paintBar(round) {
    var bar = T.pickConfirmationBar;
    if (!bar || !bar.element) return;
    /* Nothing answered anywhere in the round: there is nothing to confirm. */
    if (!answeredCount(round)) {
      bar.show(false);
      barReady = false;
      return;
    }


    var worth = 0;
    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      match.questions.forEach(function (id) {
        if (pick.answers[id] === undefined) return;
        var meta = template(id);
        if (meta) worth += meta.points;
      });
    });

    bar.element.classList.add('winbar--round-picks', 'winbar--points');
    if (bar.label) bar.label.textContent = 'Potential win:';
    if (bar.points) bar.points.textContent = '+' + worth;

    var spot = currentSpot(round);
    var ready = false;
    if (spot.match) {
      var current = pickOf(round, spot.match);
      var id = blocksOf(spot.match)[spot.question];
      /* Normally the bar is about a change: it is up while what is on the
         card differs from what was confirmed. A card you reopened is the
         exception — the button is there from the first moment, so the same
         answer can be confirmed again untouched. */
      ready = blockAnswered(current, spot.match, spot.question) &&
        (reopened[spot.match.id] || !isAccepted(current, id) ||
          current.accepted[id] !== valueOf(current, spot.match, spot.question));
    }

    if (!ready) {
      bar.show(false);
      barReady = false;
      return;
    }

    if (bar.next) {
      bar.next.textContent = 'Accept pick';
      bar.next.disabled = false;
      bar.next.onclick = function () { acceptOne(round); };
      // one nudge as it comes alive, the way the daily slip does it
      if (ready && !barReady) {
        bar.next.classList.remove('is-nudging');
        void bar.next.offsetWidth;
        bar.next.classList.add('is-nudging');
      }
      if (!ready) bar.next.classList.remove('is-nudging');
    }
    if (bar.close) bar.close.onclick = function () { clearCurrent(round); };
    barReady = ready;
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

  function renderFixtures() {
    if (!fixtureList || !editing) return;
    var day = days[pickedDay];
    var term = (search && search.value.trim().toLowerCase()) || '';
    var fragment = document.createDocumentFragment();

    (day ? day.matches : []).forEach(function (match) {
      var label = teamsOf(match).toLowerCase();
      if (term && label.indexOf(term) === -1) return;

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
      fragment.appendChild(el('p', 'round-hint', 'No matches here — try another day or another team.'));
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
      if (T.go) T.go('league-rounds');
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
          if (T.go) T.go('league-rounds');
        });
    });
  });

  $$('[data-round-new]').forEach(function (button) {
    button.addEventListener('click', function () { openEditor(null); });
  });


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

  /* Where a round is picked up: the first question nobody has accepted. */
  function resume(round) {
    if (!panel) return;
    var cards = $$('.mcard--round', panel);
    for (var i = 0; i < round.matches.length; i += 1) {
      var match = round.matches[i];
      var pick = pickOf(round, match);
      var ids = blocksOf(match);
      for (var j = 0; j < ids.length; j += 1) {
        if (pick.accepted && pick.accepted[ids[j]]) continue;
        var card = cards[i];
        var track = panel.querySelector('.round-track');
        if (card) {
          card.dataset.question = String(j);
          var body = card.querySelector('.mcard__body');
          if (body) body.scrollLeft = j * body.clientWidth;
        }
        if (track && card) track.scrollLeft = Math.max(0, card.offsetLeft - track.offsetLeft);
        return;
      }
    }
  }

  window.addEventListener('the90:screen', function (event) {
    if (event.detail === 'league-rounds') renderList();
    if (event.detail === 'league') {
      renderPanel();
      var round = publishedOf(league())[0];
        if (round) window.setTimeout(function () { resume(round); paintBar(round); }, 0);
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

  var prizesPanel = document.querySelector('[data-league-panel="prizes"]');
  var rulesPanel = document.querySelector('[data-league-panel="rules"]');
  var demoPrizes = prizesPanel ? prizesPanel.innerHTML : '';
  var demoRules = rulesPanel ? rulesPanel.innerHTML : '';

  function renderPrizes() {
    if (!prizesPanel) return;
    var prizes = (viewing.league && viewing.league.prizes) || [];
    if (!prizes.length) { prizesPanel.innerHTML = demoPrizes; return; }

    var fragment = document.createDocumentFragment();
    prizes.forEach(function (prize) {
      var card = el('article', 'arena-prize');
      if (prize.image) {
        var art = el('div', 'arena-prize__art');
        var image = document.createElement('img');
        image.src = prize.image;
        image.alt = '';
        art.appendChild(image);
        card.appendChild(art);
      }
      var copy = el('div', 'arena-prize__copy');
      copy.appendChild(el('span', 'arena-prize__place', prize.place));
      copy.appendChild(el('h3', null, prize.title));
      if (prize.description) copy.appendChild(el('p', null, prize.description));
      if (prize.value) copy.appendChild(el('span', 'arena-prize__value', 'Value: ' + prize.value));
      card.appendChild(copy);
      fragment.appendChild(card);
    });
    prizesPanel.replaceChildren(fragment);
  }

  function renderRules() {
    if (!rulesPanel) return;
    var rules = viewing.league && viewing.league.rules;
    if (!rules) { rulesPanel.innerHTML = demoRules; return; }
    rulesPanel.innerHTML = '<div class="league-rules-copy">' + rules + '</div>';
  }

  T.leagueRounds = {
    of: function () { return roundsOf(league()); },
    open: openEditor,
    templates: TEMPLATES
  };
})();
