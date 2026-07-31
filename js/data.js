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
  var MARGIN    = 0.92;   // bookmaker payout (8% margin)
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

  function scoreProb(m, h, a) {
    if (h > MAX_GOALS || a > MAX_GOALS) return 0.0004;
    return grid(m)[h][a];
  }

  /* ---------------- odds & points ---------------- */

  function odds(prob) {
    if (prob <= 0) return 999;
    return (1 / prob) * MARGIN;
  }

  // one unit per market — tuned so a single 1X2 pick lands around +100…+250,
  // the same order of magnitude as the Figma mock (+150)
  var UNIT = { outcome: 50, score: 15, btts: 25 };
  var SCORE_CAP = 900;

  function outcomeOdds(m) {
    var p = probs(m);
    return { home: odds(p.home), draw: odds(p.draw), away: odds(p.away) };
  }

  function bttsOdds(m) {
    var p = probs(m);
    return { yes: odds(p.bttsYes), no: odds(p.bttsNo) };
  }

  // points for a complete pick on one card
  function pickPoints(m, pick) {
    var out = 0, sc = 0, bt = 0;

    if (pick.outcome) {
      out = Math.round(outcomeOdds(m)[pick.outcome] * UNIT.outcome);
    }
    if (pick.score && pick.score.home !== null && pick.score.away !== null) {
      sc = Math.min(
        SCORE_CAP,
        Math.round(odds(scoreProb(m, pick.score.home, pick.score.away)) * UNIT.score)
      );
    }
    if (pick.btts) {
      bt = Math.round(bttsOdds(m)[pick.btts] * UNIT.btts);
    }
    return { outcome: out, score: sc, btts: bt, total: out + sc + bt };
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
  var WDAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function buildCalendar() {
    var days = [], today = new Date();
    for (var i = -1; i <= 5; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      days.push({
        key: key,
        month: MONTHS[d.getMonth()],
        date: d.getDate(),
        weekday: i === 0 ? 'Today' : WDAYS[d.getDay()],
        isToday: i === 0,
        isPast: i < 0,
        matches: buildDay(key)
      });
    }
    return days;
  }

  /* ---------------- live match ---------------- */

  var LIVE = { home: 'arsenal', away: 'chelsea', scoreHome: 2, scoreAway: 2, minute: 67 };

  return {
    CLUBS: CLUBS,
    club: club,
    logo: logo,
    bg: bg,
    outcomeOdds: outcomeOdds,
    bttsOdds: bttsOdds,
    pickPoints: pickPoints,
    crowd: crowd,
    buildCalendar: buildCalendar,
    LIVE: LIVE
  };
})();
