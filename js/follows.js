/* Shared, persistent follows for onboarding and the calendar. */
(function () {
  'use strict';
  var T = window.THE90;
  var key = 'the90:follows';
  var state = { clubs: [], competitions: ['LAL'], matches: [] };
  function clean(list) {
    return Array.isArray(list) ? list.filter(function (id, i) {
      return typeof id === 'string' && list.indexOf(id) === i;
    }) : [];
  }
  try {
    var saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === 'object') {
      state = { clubs: clean(saved.clubs), competitions: clean(saved.competitions), matches: clean(saved.matches) };
    }
  } catch (error) { /* Keep defaults when storage is unavailable. */ }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (error) { /* In-memory follows still work. */ }
    document.dispatchEvent(new CustomEvent('the90:follows'));
  }
  function has(type, id) { return state[type].indexOf(id) !== -1; }
  function toggle(type, id) {
    var index = state[type].indexOf(id);
    if (index < 0) state[type].push(id);
    else state[type].splice(index, 1);
    save();
    return has(type, id);
  }
  T.follows = {
    clubs: function () { return state.clubs.slice(); },
    competitions: function () { return state.competitions.slice(); },
    matches: function () { return state.matches.slice(); },
    isClub: function (id) { return has('clubs', id); },
    isCompetition: function (id) { return has('competitions', id); },
    isMatch: function (id) { return has('matches', id); },
    toggleClub: function (id) { return toggle('clubs', id); },
    toggleCompetition: function (id) { return toggle('competitions', id); },
    toggleMatch: function (id) { return toggle('matches', id); },
    setClubs: function (list) { state.clubs = clean(list); save(); }
  };
})();
