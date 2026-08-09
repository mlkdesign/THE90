/* =========================================================
   THE90 — leaderboard shape

   A board is only worth reading in two places: the very top,
   and wherever you are standing. Everything in between is
   scroll. Both the global rankings and the league participant
   list are built from this one plan.
   ========================================================= */

(function () {
  'use strict';

  var TOP_COUNT = 20;

  /* Which ranks a board should actually render.
       lead       — the leading block, 1…topCount
       gap        — true when ranks were skipped between the two blocks
       neighbours — the rows around the player; empty when already in the lead

     Handles the awkward ends on its own: a player sitting right below the
     lead gets no gap, #1 and the last place simply lose the row they have
     no neighbour for. */
  function plan(total, you, topCount) {
    var limit = Math.min(topCount || TOP_COUNT, total);
    var lead = [];
    for (var rank = 1; rank <= limit; rank += 1) lead.push(rank);

    if (!you || you <= limit) return { lead: lead, gap: false, neighbours: [] };

    var neighbours = [];
    if (you - 1 > limit) neighbours.push(you - 1);
    neighbours.push(you);
    if (you + 1 <= total) neighbours.push(you + 1);

    return { lead: lead, gap: neighbours[0] > limit + 1, neighbours: neighbours };
  }

  /* "17 points to pass Iris Kowalski (#46)" — the one number on the screen
     that says what to do next. Both people are passed in already rendered,
     so the hint can never disagree with the rows above it. */
  function chaseHint(you, chased, unit) {
    var word = unit || 'points';
    if (!chased) return 'You are #' + you.rank + ' — nobody left to chase.';

    var behind = chased.score - you.score;
    if (behind <= 0) return 'You are level with ' + chased.name + ' (#' + chased.rank + ')';
    return format(behind) + ' ' + word + ' to pass ' + chased.name + ' (#' + chased.rank + ')';
  }

  function format(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  window.THE90 = window.THE90 || {};
  window.THE90.board = {
    TOP_COUNT: TOP_COUNT,
    plan: plan,
    chaseHint: chaseHint,
    format: format
  };
})();
