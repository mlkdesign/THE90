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
    locked: 'Locked', pending: 'Results pending', completed: 'Completed'
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

    var live = publishedOf(league());
    live.forEach(function (round) {
      var box = card(round.name,
        round.matches.length + ' ' + (round.matches.length === 1 ? 'match' : 'matches') +
        ' · ' + (Number(round.lock) ? 'Picks lock ' + round.lock + ' min before kickoff'
                                    : 'Picks lock at kickoff'),
        [], round.state);
      if (round.state === 'open' || round.state === 'published') {
        box.appendChild(el('p', 'league-round-note',
          '0 / ' + questionCount(round) + ' picks locked'));
      }
      panel.appendChild(box);
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
      head.appendChild(pill(round.state));
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

  function openEditor(id) {
    var rounds = roundsOf(league());
    editing = id ? rounds.filter(function (round) { return round.id === id; })[0] : blankRound();
    if (!editing) return;
    dressEditor();
    if (T.go) T.go('league-round-edit');
  }

  function editable() { return editing && editing.state === 'draft'; }

  function dressEditor() {
    if (!editing) return;
    if (head) head.textContent = editable() ? (editing.name ? 'Edit round' : 'Create round') : editing.name;
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

  window.addEventListener('the90:screen', function (event) {
    if (event.detail === 'league-rounds') renderList();
    if (event.detail === 'league') renderPanel();
    if (event.detail !== 'league-round-edit') closePicker();
  });

  renderPanel();

  T.leagueRounds = {
    of: function () { return roundsOf(league()); },
    open: openEditor,
    templates: TEMPLATES
  };
})();
