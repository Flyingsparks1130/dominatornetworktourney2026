/* Shared by the static reader, local staging command and CI. No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CompanionContract = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 'dominator-tournament/v1';
  const MAX_BYTES = 10 * 1024 * 1024;
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function object(value, label) {
    assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  }
  function string(value, label, empty = false, max = 200) {
    assert(typeof value === 'string' && (empty || value.trim()) && value.length <= max, `${label} is missing or too long.`);
  }
  function number(value, label, min = 0) {
    assert(typeof value === 'number' && Number.isFinite(value) && value >= min, `${label} is invalid.`);
  }
  function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
    assert(Number.isSafeInteger(value) && value >= min && value <= max, `${label} is invalid.`);
  }
  function array(value, label, max = 10000) {
    assert(Array.isArray(value) && value.length <= max, `${label} must be an array (maximum ${max}).`);
  }
  function unique(set, value, label) {
    assert(!set.has(value), `${label} is duplicated: ${value}.`); set.add(value);
  }
  function rules(value) {
    object(value, 'Scoring rules'); array(value.points, 'Position points', 32);
    assert(value.points.length > 0, 'Position points are empty.');
    value.points.forEach(n => { number(n, 'Position points'); assert(n <= 100000, 'Position points exceed 100000.'); });
    assert(['shared', 'countback'].includes(value.tiebreak), 'Unknown tiebreak rule.');
    assert(value.aggregation === 'sum' && value.unlistedPlaces === 0, 'Unsupported scoring rule version.');
  }
  function standings(results, kind, tiebreak = 'shared') {
    const groups = new Map();
    for (const result of results) for (const row of result.rows) {
      const id = kind === 'teams' ? row.team : row.playerId;
      if (!id) continue;
      const entry = groups.get(id) || {id, name: kind === 'teams' ? row.team : row.playerName, points: 0, entries: 0, finishes: Array(32).fill(0)};
      entry.points = Math.round((entry.points + row.points) * 1000000) / 1000000;
      entry.entries++; entry.finishes[row.rank - 1]++; groups.set(id, entry);
    }
    const compare = (a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (tiebreak === 'countback') for (let i = 0; i < 32; i++) if (a.finishes[i] !== b.finishes[i]) return b.finishes[i] - a.finishes[i];
      return 0;
    };
    let previous = null, rank = 0;
    return [...groups.values()].sort((a, b) => compare(a, b) || a.name.localeCompare(b.name)).map((entry, i) => {
      if (!previous || compare(previous, entry) !== 0) rank = i + 1;
      previous = entry; return {...entry, rank};
    });
  }
  function validate(bundle, expectedTournamentId = null) {
    object(bundle, 'Export');
    assert(bundle.schema === SCHEMA, `Expected ${SCHEMA}. Download the approved-results export from the companion.`);
    object(bundle.tournament, 'Tournament');
    string(bundle.tournament.id, 'Tournament ID'); string(bundle.tournament.name, 'Tournament name');
    assert(!expectedTournamentId || bundle.tournament.id === expectedTournamentId, 'This export belongs to a different tournament.');
    if (bundle.tournament.scoring !== null) rules(bundle.tournament.scoring);
    array(bundle.results, 'Approved results'); array(bundle.voided, 'Voided races');
    assert(!bundle.results.length || bundle.tournament.scoring !== null, 'Approved results require scoring rules.');
    const raceIds = new Set(), heatIds = new Set(), fingerprints = new Set(), matches = new Map(), heatNumbers = new Set();
    for (const result of bundle.results) {
      object(result, 'Result'); string(result.raceId, 'Race ID'); unique(raceIds, result.raceId, 'Race');
      object(result.match, 'Match'); object(result.heat, 'Heat');
      for (const key of ['id', 'name', 'round', 'stage']) string(result.match[key], `Match ${key}`, ['round', 'stage'].includes(key));
      const previous = matches.get(result.match.id);
      assert(!previous || ['name', 'round', 'stage'].every(k => previous[k] === result.match[k]), 'A match has conflicting metadata.');
      matches.set(result.match.id, result.match);
      string(result.heat.id, 'Heat ID'); integer(result.heat.number, 'Heat number', 1);
      unique(heatIds, result.heat.id, 'Approved heat');
      unique(heatNumbers, JSON.stringify([result.match.id, result.heat.number]), 'Match heat number');
      string(result.approvedAt, 'Approval time'); assert(Number.isFinite(Date.parse(result.approvedAt)), 'Approval time is invalid.');
      string(result.operator, 'Approving operator');
      assert(typeof result.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(result.fingerprint), 'Race fingerprint is invalid.');
      unique(fingerprints, result.fingerprint, 'Race fingerprint');
      if (result.problems !== undefined) assert(Array.isArray(result.problems) && result.problems.length === 0, 'A result still needs operator review.');
      object(result.track, 'Track'); string(result.track.name, 'Track name', true);
      for (const key of ['id', 'surface', 'going', 'weather', 'season']) integer(result.track[key], `Track ${key}`);
      number(result.track.distance, 'Distance', 1);
      rules(result.rules); array(result.rows, 'Finishers', 32); assert(result.rows.length > 0, 'An approved race needs finishers.');
      const ranks = new Set(), indices = new Set(), gates = new Set();
      for (const row of result.rows) {
        object(row, 'Finisher'); integer(row.rank, 'Finish rank', 1, result.rows.length); unique(ranks, row.rank, 'Finish rank');
        integer(row.index, 'Runner index', 0, result.rows.length - 1); unique(indices, row.index, 'Runner index');
        integer(row.gate, 'Gate', 1, result.rows.length); unique(gates, row.gate, 'Gate');
        integer(row.card, 'Uma card'); integer(row.style, 'Running style');
        if (row.post !== null) integer(row.post, 'Post');
        for (const key of ['playerId', 'playerName', 'name', 'team', 'trainer', 'owner']) string(row[key], `Runner ${key}`, ['team', 'trainer', 'owner'].includes(key));
        number(row.finishTime, 'Finish time', Number.MIN_VALUE); number(row.points, 'Awarded points');
        assert(row.points === (result.rules.points[row.rank - 1] ?? 0), 'Awarded points do not match the approved rule snapshot.');
      }
    }
    const voidIds = new Set();
    for (const item of bundle.voided) {
      object(item, 'Voided race'); string(item.raceId, 'Voided race ID'); unique(voidIds, item.raceId, 'Voided race');
      assert(!raceIds.has(item.raceId), 'A race cannot be both approved and voided.');
      if (item.heatId !== null) string(item.heatId, 'Voided heat ID');
      string(item.reason, 'Void reason', false, 2000);
    }
    object(bundle.standings, 'Standings');
    for (const kind of ['players', 'teams']) {
      array(bundle.standings[kind], `${kind} standings`);
      const computed = standings(bundle.results, kind, bundle.tournament.scoring?.tiebreak);
      const supplied = new Map();
      for (const entry of bundle.standings[kind]) {
        object(entry, 'Standing'); string(entry.id, 'Standing ID');
        assert(!supplied.has(entry.id), 'Duplicate standings entry.'); supplied.set(entry.id, entry);
      }
      assert(supplied.size === computed.length, 'Standings do not match the approved races.');
      for (const entry of computed) {
        const actual = supplied.get(entry.id);
        assert(actual && ['name', 'points', 'entries', 'rank'].every(k => actual[k] === entry[k]) &&
          Array.isArray(actual.finishes) && actual.finishes.length === 32 && entry.finishes.every((n, i) => actual.finishes[i] === n),
        'Standings do not match the approved races.');
      }
    }
    return bundle;
  }
  function config(value) {
    object(value, 'Site connection');
    assert(value.schema === 'dominator-companion-site/v1', 'Unknown site connection version.');
    assert(typeof value.resultsPath === 'string' && /^data\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(value.resultsPath), 'Results path must be a JSON file inside data/.');
    if (value.expectedTournamentId !== null) string(value.expectedTournamentId, 'Expected tournament ID');
    array(value.matchLinks, 'Match links'); const ids = new Set();
    assert(!value.matchLinks.length || value.expectedTournamentId, 'Bind a tournament ID before linking archive matches.');
    for (const link of value.matchLinks) {
      object(link, 'Match link');
      for (const key of ['companionMatchId', 'archiveRoundId', 'archiveMatchId']) string(link[key], key);
      unique(ids, link.companionMatchId, 'Match link');
    }
    return value;
  }
  function course(track) {
    const label = (value, values, fallback) => values[value] || (value ? `${fallback} ${value}` : '');
    return [track.name || (track.id ? `Track ${track.id}` : ''), `${track.distance} m`,
      label(track.surface, {1:'Turf', 2:'Dirt'}, 'Surface'), label(track.going, {1:'Firm', 2:'Good', 3:'Soft', 4:'Heavy'}, 'Going'),
      label(track.weather, {1:'Sunny', 2:'Cloudy', 3:'Rainy', 4:'Snow'}, 'Weather'),
      label(track.season, {1:'Spring', 2:'Summer', 3:'Fall', 4:'Winter', 5:'Cherry blossom'}, 'Season')].filter(Boolean).join(' · ');
  }
  return {SCHEMA, MAX_BYTES, validate, config, standings, course};
});
