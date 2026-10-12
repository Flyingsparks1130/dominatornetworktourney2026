'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const contract = require('../assets/companion-contract.js');
const bridge = require('../scripts/companion_bridge.cjs');
const fixture = require('./fixtures/companion-approved.json');
const copy = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name, test) { test(); checks++; console.log(`PASS ${name}`); }
function rejects(edit, pattern) { const value = copy(fixture); edit(value); assert.throws(() => contract.validate(value), pattern); }
check('Accept the companion v1 export and exact approval snapshots', () => {
  assert.equal(contract.validate(fixture), fixture);
  assert.deepEqual(contract.standings(fixture.results, 'players').map(p => [p.id,p.points,p.rank,p.entries]), [['player-a',12,1,2],['player-b',12,1,2]]);
  assert.equal(contract.course(fixture.results[0].track), 'Tokyo · 2400 m · Turf · Firm · Sunny · Fall');
});
check('Match totals use only selected approved heats', () => {
  const result = contract.standings(fixture.results.filter(r => r.match.id === 'match-a'), 'teams');
  assert.deepEqual(result.map(t => [t.name,t.points,t.rank]), [['Demo Red',8,1],['Demo Blue',4,2]]);
});
check('Countback resolves equal points using finishing positions', () => {
  const rows = copy(fixture.results.slice(0,1)); rows[0].rows.forEach(r => r.points = 6);
  assert.deepEqual(contract.standings(rows, 'players', 'shared').map(p => p.rank), [1,1]);
  assert.deepEqual(contract.standings(rows, 'players', 'countback').map(p => p.rank), [1,2]);
});
check('A not-yet-configured event is valid with no scores', () => {
  const value = copy(fixture); value.results=[]; value.voided=[]; value.tournament.scoring=null; value.standings={players:[],teams:[]};
  contract.validate(value);
});
check('Reject raw horseACT, private stores and unknown schema versions', () => {
  assert.throws(() => contract.validate({raceHorse:[]}), /Expected/);
  assert.throws(() => contract.validate({schema:1,races:[]}), /Expected/);
  rejects(b => b.schema='dominator-tournament/v2', /Expected/);
});
check('Tournament binding rejects another event', () => {
  assert.throws(() => contract.validate(fixture, 'another-tournament'), /different tournament/);
  contract.validate(fixture, fixture.tournament.id);
});
check('Duplicates cannot inflate totals', () => {
  rejects(b => b.results.push(copy(b.results[0])), /duplicated/);
  rejects(b => b.results[1].heat.id=b.results[0].heat.id, /Approved heat is duplicated/);
  rejects(b => b.results[1].fingerprint=b.results[0].fingerprint, /fingerprint is duplicated/);
});
check('Incomplete or conflicting approvals fail validation', () => {
  rejects(b => b.results[0].approvedAt='', /Approval time/);
  rejects(b => b.results[0].problems=['Review needed'], /operator review/);
  rejects(b => b.results[0].rows[1].rank=1, /Finish rank is duplicated/);
  rejects(b => b.results[0].rows[0].playerId='', /playerId/);
  rejects(b => b.results[0].rows[0].finishTime=0, /Finish time/);
  rejects(b => b.results[1].match.id=b.results[0].match.id, /conflicting metadata/);
});
check('Points and derived standings must match approvals', () => {
  rejects(b => b.results[0].rows[0].points=999, /rule snapshot/);
  rejects(b => b.standings.players[0].points=999, /Standings do not match/);
  rejects(b => b.standings.teams[0].rank=99, /Standings do not match/);
  rejects(b => b.standings.players[0].finishes[0]++, /Standings do not match/);
  rejects(b => b.tournament.scoring=null, /require scoring/);
});
check('Voids are excluded and cannot also be approved', () => {
  assert.equal(fixture.voided.length,1); assert.equal(fixture.standings.players[0].points,12);
  rejects(b => b.voided[0].raceId=b.results[0].raceId, /both approved and voided/);
});
check('Only same-site data paths and explicit match bindings are allowed', () => {
  const c = {schema:'dominator-companion-site/v1',resultsPath:'data/companion/approved-results.json',expectedTournamentId:null,matchLinks:[]};
  contract.config(c);
  for (const bad of ['../control.json','data/../control.json','/data/r.json','https://example.com/r.json','http://127.0.0.1:27840/api/ops/export','data/%2e%2e/r.json']) assert.throws(() => contract.config({...c,resultsPath:bad}), /inside data/);
  assert.throws(() => contract.config({...c,matchLinks:[{companionMatchId:'m',archiveRoundId:'R1',archiveMatchId:'r1-m1'}]}), /Bind a tournament/);
});
check('Staging is atomic, guards event identity and preserves existing data on failure', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dominator-bridge-'));
  try {
    fs.mkdirSync(path.join(temp,'config')); fs.copyFileSync(path.join(__dirname,'../config/companion.json'),path.join(temp,'config/companion.json'));
    assert.equal(bridge.checkSite(temp).configured,false);
    const input=path.join(temp,'input.json'); fs.writeFileSync(input,JSON.stringify(fixture));
    const staged=bridge.stage(input,temp); assert.equal(bridge.checkSite(temp).configured,true);
    const before=fs.readFileSync(staged.file,'utf8');
    const other=copy(fixture); other.tournament.id='different'; fs.writeFileSync(input,JSON.stringify(other));
    assert.throws(() => bridge.stage(input,temp), /another tournament/);
    fs.writeFileSync(input,'{broken'); assert.throws(() => bridge.stage(input,temp));
    assert.equal(fs.readFileSync(staged.file,'utf8'),before);
    fs.writeFileSync(input,JSON.stringify(fixture)); bridge.stage(input,temp);
    assert.deepEqual(fs.readdirSync(path.dirname(staged.file)),['approved-results.json']);
    assert.equal(fs.existsSync(path.join(temp,'Dominator Tournament')),false);
  } finally {
    // mkdtemp returns this test's dedicated absolute directory; never remove a caller path.
    assert.equal(path.dirname(temp),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('dominator-bridge-'));
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
console.log(`${checks} companion checks passed.`);
