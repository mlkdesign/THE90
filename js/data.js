/* =========================================================
   THE90 — match data + scoring model
   =========================================================
   Everything (1X2 odds, exact-score odds, both-to-score odds)
   is derived from one Poisson model per fixture, so the numbers
   stay consistent with each other the way real betting markets do.
   ========================================================= */

window.THE90 = (function () {
  'use strict';

  /* ---------------- clubs ---------------- */

  var CLUBS = {
    'real-madrid': { name: 'Real Madrid',        short: 'RMA', strength: 1.95 },
    'barcelona':   { name: 'FC Barcelona',       short: 'BAR', strength: 1.90 },
    'man-united':  { name: 'Manchester United',  short: 'MUN', strength: 1.45 },
    'liverpool':   { name: 'Liverpool',          short: 'LIV', strength: 1.80 },
    'chelsea':     { name: 'Chelsea',            short: 'CHE', strength: 1.50 },
    'arsenal':     { name: 'Arsenal',            short: 'ARS', strength: 1.70 },
    'bayern':      { name: 'Bayern Munich',      short: 'BAY', strength: 1.98 },
    'dortmund':    { name: 'Borussia Dortmund',  short: 'DOR', strength: 1.55 }
  };

  var LEAGUE_OF = {
    'real-madrid': 'LAL', 'barcelona': 'LAL',
    'man-united': 'APL', 'liverpool': 'APL', 'chelsea': 'APL', 'arsenal': 'APL',
    'bayern': 'BUN', 'dortmund': 'BUN'
  };

  function club(slug) { return CLUBS[slug]; }
  function logo(slug) { return 'assets/clubs/' + slug + '.png'; }
  function bg(slug)   { return 'assets/clubs/bg-' + slug + '.jpg'; }

  /* ---------------- Poisson model ---------------- */

  var HOME_EDGE = 1.18;   // home advantage multiplier
  var MAX_GOALS = 8;

  function poisson(k, lambda) {
    var p = Math.exp(-lambda), f = 1;
    for (var i = 1; i <= k; i++) { f *= i; p *= lambda; }
    return p / f;
  }

  // expected goals for a fixture
  function lambdas(m) {
    var h = club(m.home).strength, a = club(m.away).strength;
    return {
      home: +(h * HOME_EDGE / Math.sqrt(a)).toFixed(3),
      away: +(a / Math.sqrt(h * HOME_EDGE)).toFixed(3)
    };
  }

  // full score grid → every market comes out of this one table
  function grid(m) {
    if (m._grid) return m._grid;
    var L = lambdas(m), g = [];
    for (var h = 0; h <= MAX_GOALS; h++) {
      g[h] = [];
      for (var a = 0; a <= MAX_GOALS; a++) g[h][a] = poisson(h, L.home) * poisson(a, L.away);
    }
    m._grid = g;
    return g;
  }

  function probs(m) {
    if (m._probs) return m._probs;
    var g = grid(m), p = { home: 0, draw: 0, away: 0, bttsYes: 0 };
    for (var h = 0; h <= MAX_GOALS; h++) {
      for (var a = 0; a <= MAX_GOALS; a++) {
        var v = g[h][a];
        if (h > a) p.home += v; else if (h === a) p.draw += v; else p.away += v;
        if (h > 0 && a > 0) p.bttsYes += v;
      }
    }
    p.bttsNo = 1 - p.bttsYes;
    m._probs = p;
    return p;
  }

  /* ---------------- points ----------------
     A daily pick is complete only when it has an exact score. That score
     already determines its winner or draw, so every completed match carries
     the same potential win: 40 points.
     ---------------------------------------- */

  var POINTS = {
    outcome:    10,   // shown as the first prediction step
    score:      40,   // exact score — the total value of a completed match
    liveWindow: 20    // separate market, answered during the match
  };

  var MAX_PER_MATCH = POINTS.score;   // 40

  // A complete daily pick is always worth 40 points.
  function pickPoints(m, pick) {
    var hasScore = pick.score && pick.score.home !== null && pick.score.away !== null;
    if (hasScore) return { outcome: 0, score: POINTS.score, total: POINTS.score };
    return { outcome: 0, score: 0, total: 0 };
  }

  /* ---------------- crowd split (shown after Accept) ---------------- */

  // Deterministic per fixture: the model's own probabilities, nudged by a
  // stable pseudo-random "public bias" so the numbers look like real punters.
  function crowd(m) {
    if (m._crowd) return m._crowd;
    var p = probs(m), r = seeded(m.id);
    var raw = [
      p.home * (0.85 + r() * 0.55),
      p.draw * (0.55 + r() * 0.45),   // the crowd under-backs draws
      p.away * (0.85 + r() * 0.55)
    ];
    var sum = raw[0] + raw[1] + raw[2];
    var pct = raw.map(function (v) { return Math.round(v / sum * 100); });
    pct[0] += 100 - (pct[0] + pct[1] + pct[2]);   // force exactly 100
    m._crowd = { home: pct[0], draw: pct[1], away: pct[2] };
    return m._crowd;
  }

  function seeded(seed) {
    var s = 0;
    for (var i = 0; i < String(seed).length; i++) s = (s * 31 + String(seed).charCodeAt(i)) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ---------------- fixtures ---------------- */

  var SLUGS = Object.keys(CLUBS);

  // 10 fixtures per day, no pairing repeated within a day
  function buildDay(dayKey) {
    var r = seeded('the90-' + dayKey), used = {}, list = [], guard = 0;

    while (list.length < 10 && guard++ < 500) {
      var i = Math.floor(r() * SLUGS.length);
      var j = Math.floor(r() * SLUGS.length);
      if (i === j) continue;

      var home = SLUGS[i], away = SLUGS[j];
      var key = home + '|' + away;
      if (used[key] || used[away + '|' + home]) continue;
      used[key] = true;

      var hour = 15 + Math.floor(r() * 7);              // 15:00 – 21:00
      var min  = r() < 0.5 ? '00' : '30';

      list.push({
        id: dayKey + '-' + list.length,
        home: home,
        away: away,
        league: LEAGUE_OF[home] === LEAGUE_OF[away] ? LEAGUE_OF[home] : 'UCL',
        kickoff: hour + ':' + min
      });
    }
    return list;
  }

  /* ---------------- calendar ---------------- */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // the date strip is tight and abbreviates; a fixture card has room to spell it
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var WDAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function buildCalendar() {
    var days = [], today = new Date();
    for (var i = -1; i <= 5; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      days.push({
        key: key,
        month: MONTHS[d.getMonth()],
        monthLong: MONTHS_FULL[d.getMonth()],
        date: d.getDate(),
        weekday: i === 0 ? 'Today' : WDAYS[d.getDay()],
        isToday: i === 0,
        isPast: i < 0,
        matches: buildDay(key)
      });
    }
    return days;
  }

  /* ---------------- live matches ----------------
     Three at once, so the main screen has something to swipe
     through and the live screen has something to open.
     ---------------------------------------------- */

  var LIVE_MATCHES = [
    {
      id: 'live-1',
      title: 'El Clásico · Live',
      league: 'La Liga',
      venue: 'Bernabéu',
      home: 'real-madrid', away: 'barcelona',
      scoreHome: 2, scoreAway: 1,
      minute: 67,
      window: {
        question: 'Who scores next?',
        options: [
          { id: 'home', label: 'Real Madrid', share: 41 },
          { id: 'none', label: 'No goal', share: 27 },
          { id: 'away', label: 'Barcelona', share: 32 }
        ]
      },
      events: [
        { minute: '64’', type: 'goal', title: 'Goal — Vinícius Júnior', detail: 'Real Madrid · assist by Bellingham', score: '2–1' },
        { minute: '58’', type: 'card', title: 'Yellow card — Pedri', detail: 'Barcelona · late tackle on Valverde' },
        { minute: '51’', type: 'goal', title: 'Goal — Lewandowski', detail: 'Barcelona · penalty, low to the left corner', score: '1–1' },
        { minute: '45+2’', type: 'whistle', title: 'Half-time', detail: 'Real Madrid lead at the break', score: '1–0' },
        { minute: '38’', type: 'goal', title: 'Goal — Mbappé', detail: 'Real Madrid · assist by Rodrygo', score: '1–0' },
        { minute: '12’', type: 'sub', title: 'Substitution — Gavi ↔ De Jong', detail: 'Barcelona' }
      ]
    },
    {
      id: 'live-2',
      title: 'London Derby · Live',
      league: 'Premier League',
      venue: 'Emirates',
      home: 'arsenal', away: 'chelsea',
      scoreHome: 2, scoreAway: 2,
      minute: 54,
      window: {
        question: 'Who scores next?',
        options: [
          { id: 'home', label: 'Arsenal', share: 38 },
          { id: 'none', label: 'No goal', share: 31 },
          { id: 'away', label: 'Chelsea', share: 31 }
        ]
      },
      events: [
        { minute: '52’', type: 'goal', title: 'Goal — Palmer', detail: 'Chelsea · low drive from the edge of the box', score: '2–2' },
        { minute: '47’', type: 'goal', title: 'Goal — Saka', detail: 'Arsenal · assist by Ødegaard', score: '2–1' },
        { minute: '45+1’', type: 'whistle', title: 'Half-time', detail: 'All square at the break', score: '1–1' },
        { minute: '33’', type: 'card', title: 'Yellow card — Caicedo', detail: 'Chelsea · pulling back a counter' },
        { minute: '21’', type: 'goal', title: 'Goal — Jackson', detail: 'Chelsea · header from a corner', score: '1–1' },
        { minute: '9’', type: 'goal', title: 'Goal — Havertz', detail: 'Arsenal · rebound from the post', score: '1–0' }
      ]
    },
    {
      id: 'live-3',
      title: 'Der Klassiker · Live',
      league: 'Bundesliga',
      venue: 'Allianz Arena',
      home: 'bayern', away: 'dortmund',
      scoreHome: 0, scoreAway: 1,
      minute: 31,
      window: {
        question: 'Who scores next?',
        options: [
          { id: 'home', label: 'Bayern Munich', share: 46 },
          { id: 'none', label: 'No goal', share: 24 },
          { id: 'away', label: 'Dortmund', share: 30 }
        ]
      },
      events: [
        { minute: '28’', type: 'card', title: 'Yellow card — Kimmich', detail: 'Bayern Munich · dissent' },
        { minute: '19’', type: 'goal', title: 'Goal — Adeyemi', detail: 'Dortmund · breakaway, round the keeper', score: '0–1' },
        { minute: '11’', type: 'sub', title: 'Substitution — Coman ↔ Sané', detail: 'Bayern Munich · early injury change' },
        { minute: '3’', type: 'whistle', title: 'Kick-off', detail: 'Dortmund get the game under way', score: '0–0' }
      ]
    }
  ];

  // Kept so anything still expecting a single fixture keeps working.
  var LIVE = LIVE_MATCHES[0];

  return {
    CLUBS: CLUBS,
    club: club,
    logo: logo,
    bg: bg,
    POINTS: POINTS,
    MAX_PER_MATCH: MAX_PER_MATCH,
    pickPoints: pickPoints,
    crowd: crowd,
    buildCalendar: buildCalendar,
    LIVE: LIVE,
    LIVE_MATCHES: LIVE_MATCHES
  };
})();
