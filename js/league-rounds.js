/* =========================================================
   THE90 — rounds in a league

   A league you own is a thing you run: you pick the matches,
   you say what is being predicted, and you publish. Everyone
   else plays what you published and nothing else.

   One store, one state machine:

     draft      only the owner sees it, everything editable
     published  members see it, picks not open yet
     open       picks can be made and confirmed
     locked     the deadline has passed
     pending    played, not yet scored
     completed  scored, read only

   Publishing is the door: matches, questions and the lock rule
   are fixed on the way through it.
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
    draft: 'Draft', published: 'Published', open: 'Open',
    pending: 'Results pending', completed: 'Completed'
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
    if (!found) return match.kickoff || '';
    return found.day.weekday + ' · ' + found.match.kickoff;
  }

  /* Fixtures carry a day key and a kickoff; a round needs real times to know
     where it is in its own life. */
  function kickoffAt(match) {
    var found = fixtureById(match.id);
    var key = found ? found.day.key : '';
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
    if (now < ends.getTime()) return 'open';
    if (now < ends.getTime() + 30 * 60000) return 'pending';
    return 'completed';
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
    if (state === 'pending') return 'Results pending';
    if (state === 'completed') return 'Completed';
    return STATE_LABEL[state] || state;
  }

  function lockLabel(round, match) {
    var minutes = Number(round.lock);
    var at = match.kickoff || '';
    if (!minutes) return 'Picks lock at kickoff (' + at + ')';
    return 'Picks lock ' + minutes + ' min before kickoff (' + at + ')';
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

    publishedOf(league()).forEach(function (round) {
      panel.appendChild(playCard(round));
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
    var ticking = el('b', null, statusLine(round));
    ticking.dataset.roundClock = round.id;
    clock.appendChild(ticking);
    top.appendChild(clock);
    box.appendChild(top);

    var bar = el('div', 'round-head__row');
    var rail = el('div', 'round-head__rail');
    var fill = el('i');
    var total = questionCount(round);
    var done = answeredCount(round);
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
    var live = state === 'open';
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

      track.appendChild(T.pickCard.create(match, pick.card, {
        when: kickoffLabel(match).split(' · ')[0],
        round: true,
        extras: extras,
        editable: function () { return live; },
        onChange: function () {
          keepCard(round, match, pick);
          paintBar(round);
        }
      }));
    });
    box.appendChild(track);

    window.setTimeout(function () { paintBar(round); }, 0);
    return box;
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
    pick.answers.result = pick.card.outcome || undefined;
    if (pick.card.score && pick.card.score.home !== null && pick.card.score.away !== null) {
      pick.answers.score = pick.card.score;
    } else {
      delete pick.answers.score;
    }
    ['btts', 'scorer'].forEach(function (id) {
      if (pick.card.extras && pick.card.extras[id]) pick.answers[id] = pick.card.extras[id];
      else delete pick.answers[id];
    });
    savePicks();
  }

  /* The shared confirmation surface, in the league's own currency. */
  /* And the way back out of it: the card in front of you loses what has not
     been confirmed, and the bar goes with it. */
  function clearCurrent(round) {
    var track = panel && panel.querySelector('.round-track');
    var index = track ? Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) : 0;
    var match = round.matches[index] || round.matches[0];
    if (!match) return;
    var pick = pickOf(round, match);
    pick.answers = {};
    if (pick.card) {
      pick.card.outcome = null;
      pick.card.score = { home: null, away: null };
      pick.card.extras = {};
    }
    savePicks();
    renderPanel();
  }

  /* Confirming works the way the daily slip does: the card in front of you is
     banked, and the rail moves on to the next one still waiting. */
  function acceptOne(round) {
    var track = panel && panel.querySelector('.round-track');
    var index = track ? Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) : 0;
    var match = round.matches[index] || round.matches[0];
    if (!match) return;

    var pick = pickOf(round, match);
    pick.seen = true;
    savePicks();

    // on to the next match nobody has answered yet
    var next = -1;
    for (var i = 0; i < round.matches.length; i += 1) {
      var other = pickOf(round, round.matches[i]);
      var answered = round.matches[i].questions.some(function (id) {
        return other.answers[id] !== undefined;
      });
      if (!answered) { next = i; break; }
    }
    renderPanel();

    if (next < 0) return;
    var rail = panel && panel.querySelector('.round-track');
    if (!rail) return;
    /* The rail has just been rebuilt, so there is nothing to animate from —
       put the next card in front of you and let the slide be the one the
       finger makes. */
    rail.scrollLeft = next * rail.clientWidth;
  }

  function paintBar(round) {
    var bar = T.pickConfirmationBar;
    if (!bar || !bar.element) return;

    /* What is answered and not yet in. Once it is all locked there is nothing
       left to confirm and the bar has no business being up. */
    var pending = answeredCount(round);
    if (!pending || stateOf(round) !== 'open') { bar.show(false); return; }

    var worth = 0;
    round.matches.forEach(function (match) {
      var pick = pickOf(round, match);
      match.questions.forEach(function (id) {
        if (pick.answers[id] === undefined) return;
        var meta = template(id);
        if (meta) worth += meta.points;
      });
    });

    bar.element.classList.add('winbar--round-picks');
    if (bar.label) bar.label.textContent = 'Potential win:';
    if (bar.points) bar.points.textContent = '+' + worth;
    bar.element.classList.add('winbar--points');
    if (bar.next) {
      bar.next.textContent = 'Next pick';
      /* The tournament leaves this button disabled when its own round has
         nothing selected, and a disabled button never sees a click — so the
         league has to take it back as well as rename it. */
      bar.next.disabled = false;
      bar.next.onclick = function () { acceptOne(round); };
    }
    if (bar.close) bar.close.onclick = function () { clearCurrent(round); };
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
        questionCount(round) + ' questions · ' +
        (Number(round.lock) ? 'Picks lock ' + round.lock + ' min before kickoff'
                            : 'Picks lock at kickoff')));

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
  var lockSeg = $('[data-round-lock]');
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
    selectLock(editing.lock);
    $$('.seg__btn', lockSeg).forEach(function (button) { button.disabled = !editable(); });
    if (addButton) addButton.hidden = !editable();
    if (actions) actions.hidden = !editable();
    if (readonlyNote) readonlyNote.hidden = editable();
    renderMatches();
  }

  function countDescription() {
    if (!descCount || !descInput) return;
    descCount.textContent = descInput.value.length + '/120';
  }

  function selectLock(value) {
    if (!lockSeg) return;
    $$('.seg__btn', lockSeg).forEach(function (button) {
      button.classList.toggle('is-on', Number(button.dataset.val) === Number(value));
    });
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
      box.appendChild(el('p', 'round-hint', lockLabel(editing, match)));
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
  if (lockSeg) {
    $$('.seg__btn', lockSeg).forEach(function (button) {
      button.addEventListener('click', function () {
        if (!editable()) return;
        editing.lock = Number(button.dataset.val);
        selectLock(editing.lock);
        renderMatches();
      });
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

  function renderDays() {
    if (!dayStrip) return;
    var fragment = document.createDocumentFragment();
    days.forEach(function (day, index) {
      var button = el('button', 'round-day' + (index === pickedDay ? ' is-on' : ''),
        day.weekday + ' ' + day.date + ' ' + day.month);
      button.type = 'button';
      button.addEventListener('click', function () {
        pickedDay = index;
        renderDays();
        renderFixtures();
      });
      fragment.appendChild(button);
    });
    dayStrip.replaceChildren(fragment);
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

  function nextDeadline() {
    if (!editing || !editing.matches.length) return '';
    var first = editing.matches[0];
    return lockLabel(editing, first);
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
        ' · ' + questions + ' questions · ' + nextDeadline() +
        '. Matches, questions and deadlines can’t be edited after publishing.',
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

  window.addEventListener('the90:screen', function (event) {
    if (event.detail === 'league-rounds') renderList();
    if (event.detail === 'league') renderPanel();
    else releaseBar();
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
  }, 1000);

  T.leagueRounds = {
    of: function () { return roundsOf(league()); },
    open: openEditor,
    templates: TEMPLATES
  };
})();
