'use strict';
siteHeader(''); siteFooter();
const contract = CompanionContract;
const byId = id => document.getElementById(id);
let connection = null, current = null, generation = 0, downloadURL = null;
const status = (message, state = '') => {
  byId('connection-status').textContent = message;
  byId('connection-status').dataset.state = state;
};
function clear() {
  current = null; byId('results').replaceChildren(); byId('results').hidden = true;
  byId('event-name').textContent = 'Tournament connection'; byId('download').hidden = true;
  if (downloadURL) URL.revokeObjectURL(downloadURL); downloadURL = null;
}
async function readJSON(response) {
  if (Number(response.headers.get('content-length')) > contract.MAX_BYTES) throw new Error('Export exceeds 10 MB.');
  const raw = await response.text();
  if (new Blob([raw]).size > contract.MAX_BYTES) throw new Error('Export exceeds 10 MB.');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}
async function loadConnection() {
  const response = await fetch('config/companion.json', {cache:'no-store'});
  if (!response.ok) throw new Error(`Connection settings could not be loaded (HTTP ${response.status}).`);
  return contract.config(await readJSON(response));
}
async function published() {
  const request = ++generation;
  clear(); byId('end-preview').hidden = true; status('Loading published results…');
  try {
    const settings = await loadConnection(); if (request !== generation) return;
    connection = settings;
    const response = await fetch(settings.resultsPath, {cache:'no-store'});
    if (request !== generation) return;
    if (response.status === 404) {
      status('Connection ready. No approved results have been published yet. You can preview a companion export while the tournament format is being decided.'); return;
    }
    if (!response.ok) throw new Error(`Results could not be loaded (HTTP ${response.status}).`);
    const bundle = contract.validate(await readJSON(response), settings.expectedTournamentId);
    if (request !== generation) return;
    display(bundle, false);
  } catch (error) {
    if (request === generation) { clear(); status(error.message, 'error'); }
  }
}
async function preview(file) {
  if (!file) return;
  const request = ++generation;
  clear(); byId('end-preview').hidden = false; status('Reading local preview…', 'preview');
  try {
    if (file.size > contract.MAX_BYTES) throw new Error('Export exceeds 10 MB.');
    const settings = await loadConnection();
    const bundle = contract.validate(JSON.parse((await file.text()).replace(/^\uFEFF/, '')), settings.expectedTournamentId);
    if (request !== generation) return;
    connection = settings; display(bundle, true);
  } catch (error) {
    if (request === generation) { clear(); status(error.message, 'error'); }
  } finally { byId('preview-file').value = ''; }
}
function display(bundle, isPreview) {
  current = bundle; byId('results').hidden = false;
  byId('event-name').textContent = bundle.tournament.name;
  const last = bundle.results.map(r => r.approvedAt).sort((a,b) => Date.parse(b)-Date.parse(a))[0];
  status(isPreview ? 'LOCAL PREVIEW · This export is visible only on this device. Nothing has been published.' :
    `Published approved results${last ? ' · Last approval: ' + new Date(last).toLocaleString() : ' · No approved heats yet'}.`, isPreview ? 'preview' : '');
  downloadURL = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2) + '\n'], {type:'application/json'}));
  byId('download').href = downloadURL; byId('download').download = 'approved-results.json'; byId('download').hidden = false;
  const matches = [...new Map(bundle.results.map(r => [r.match.id, r.match])).values()];
  const rules = bundle.tournament.scoring;
  byId('results').innerHTML = `
    <div class="cp-summary">
      <div class="cp-stat"><strong>${bundle.results.length}</strong><span>Approved heats</span></div>
      <div class="cp-stat"><strong>${matches.length}</strong><span>Matches with results</span></div>
      <div class="cp-stat"><strong>${bundle.standings.players.length}</strong><span>Scored players</span></div>
    </div>
    <section class="cp-panel"><h2>Scoring format</h2>${rules ? `
      <ul class="cp-rule-points">${rules.points.map((n,i) => `<li>Place ${i+1} <strong>+${esc(n)}</strong></li>`).join('')}</ul>
      <p class="cp-meta">Points add across approved Uma entries. Unlisted places receive 0 points. Ties: ${rules.tiebreak === 'countback' ? 'countback by finishing position' : 'shared rank'}.</p>
      <p class="cp-meta">Each heat keeps the scoring rules used at approval. These totals do not decide bracket advancement.</p>` :
      '<p class="cp-meta">To be decided. Set the format in the local tournament desk before approving results.</p>'}</section>
    <div class="cp-filter"><label for="match-select">Show results for</label><select id="match-select"><option value="">All matches · event totals</option>${matches.map(m => `<option value="${esc(m.id)}">${esc([m.round,m.stage,m.name].filter(Boolean).join(' / '))}</option>`).join('')}</select></div>
    <div id="match-results"></div>
    ${bundle.voided.length ? `<details class="cp-panel cp-audit"><summary>Voided races (${bundle.voided.length}) · excluded from scores</summary><ul>${bundle.voided.map(v => `<li>${esc(v.reason)}<br>Race ${esc(v.raceId)}${v.heatId ? ' · Heat '+esc(v.heatId) : ''}</li>`).join('')}</ul></details>` : ''}`;
  const selected = new URLSearchParams(location.search).get('match');
  if (matches.some(m => m.id === selected)) byId('match-select').value = selected;
  byId('match-select').addEventListener('change', () => { renderMatches(); });
  renderMatches();
}
function table(headers, rows) {
  return `<div class="cp-table-wrap"><table class="cp-table"><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function standingTable(entries, label) {
  return `<section class="cp-panel"><h2>${esc(label)}</h2>${entries.length ? table(['Rank','Name','Points','Uma entries'], entries.map(e =>
    `<tr><td>${e.rank}</td><th scope="row" class="cp-name">${esc(e.name)}</th><td>${esc(e.points)}</td><td>${e.entries}</td></tr>`).join('')) : '<p class="cp-meta">No scored entries in this selection.</p>'}</section>`;
}
function renderMatches() {
  if (!current) return;
  const selected = byId('match-select').value;
  const results = current.results.filter(r => !selected || r.match.id === selected);
  const ties = current.tournament.scoring?.tiebreak;
  const players = contract.standings(results, 'players', ties), teams = contract.standings(results, 'teams', ties);
  const link = connection.matchLinks.find(m => m.companionMatchId === selected);
  const archiveURL = link ? `archive.html?${new URLSearchParams({round:link.archiveRoundId,match:link.archiveMatchId})}` : null;
  byId('match-results').innerHTML = `
    ${archiveURL ? `<p><a class="cp-link" href="${esc(archiveURL)}">View linked archive match →</a></p>` : ''}
    <p class="cp-meta">${selected ? 'Selected match' : 'Entire event'} · ${results.length} approved heats. Each Uma contributes its awarded points to its player and, when assigned, team.</p>
    <div class="cp-standings">${standingTable(players,'Player standings')}${standingTable(teams,'Team standings')}</div>
    ${results.length ? [...results].sort((a,b) => a.match.id.localeCompare(b.match.id) || a.heat.number-b.heat.number).map(r => `
      <section class="cp-panel"><div class="cp-heat-head"><div><h3>${esc(r.match.name)} · Heat ${r.heat.number}</h3>
        <p class="cp-meta">${esc([r.match.round,r.match.stage].filter(Boolean).join(' · '))}</p><p class="cp-meta">${esc(contract.course(r.track))}</p></div>
        <div class="cp-meta">Approved ${esc(new Date(r.approvedAt).toLocaleString())}<br>By ${esc(r.operator)}</div></div>
        ${table(['Place','Uma','Player','Team','Gate','Time (s)','Points'], [...r.rows].sort((a,b) => a.rank-b.rank).map(row => `
          <tr><td>${row.rank}</td><td class="cp-name">${esc(row.name)}${row.card ? `<div class="cp-meta">Card ${row.card}</div>` : ''}</td>
          <td>${esc(row.playerName)}</td><td>${esc(row.team || '—')}</td><td>${row.gate}</td><td>${row.finishTime.toFixed(3)}</td><td>${esc(row.points)}</td></tr>`).join(''))}
        <details class="cp-audit"><summary>Approval details &amp; scoring snapshot</summary><p>Race ${esc(r.raceId)} · Heat ${esc(r.heat.id)}</p>
          <p>Points by place: ${r.rules.points.map(esc).join(', ')} · ${esc(r.rules.tiebreak)} ties</p><p>Fingerprint: ${esc(r.fingerprint)}</p></details>
      </section>`).join('') : '<section class="cp-panel"><h2>Ready for the first approved heat</h2><p class="cp-meta">Run a race, review it in the tournament desk, then approve and publish when ready.</p></section>'}`;
}
byId('refresh').addEventListener('click', published);
byId('end-preview').addEventListener('click', published);
byId('preview-file').addEventListener('change', event => preview(event.target.files[0]));
window.addEventListener('pagehide', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); });
published();
