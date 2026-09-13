/* The public trophy case loads the catalog only. Winners live in the local review file. */
(function(global){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
 const base='https://flyingsparks1130.github.io/dominatornetworktourney2026/';
 const asset=(path,options)=>options.assets?.[path]||(options.local&&path?base+path:path);
 const decimals=a=>['efficiency','blocked_seconds','duel_seconds','lane_loss_m'].includes(a.metric)?3:0;
 const value=(p,a)=>fmt(p?.value,decimals(a));
 const buildName=b=>b?`${b.uma} · ${b.round} / ${b.match_id.toUpperCase()}`:'';
 function receipts(a,winner,standings){
  const p=standings?.players.find(p=>p.id===winner?.player_id);if(!p)return '';
  const buildEvidence=b=>`<tr><td>${esc(buildName(b))}</td><td>${fmt(b.total)} total stats · ${fmt(b.stats?.guts)} Guts · ${fmt(b.stats?.wisdom)} Wit · ${fmt(b.sp)} SP<br><a href="${esc(base+encodeURI(b.source))}" target="_blank" rel="noopener">Source export ↗</a></td></tr>`;
  const rows=winner.build?buildEvidence(winner.build):a.metric==='dqs'?p.dq_records.map(d=>`<tr><td>${esc(d.match_id.toUpperCase())}</td><td>${fmt(d.count)} DQ · ${esc(d.source)}</td></tr>`).join(''):a.metric==='efficiency'?p.builds.map(buildEvidence).join(''):p.races.map(r=>{
   const detail=a.metric==='late_starts'?fmt(r.start_delay_ms,3)+' ms'+(r.start_delay_ms>=66?' · Late':''):a.metric==='debuff_activations'?fmt(r.debuff_activations)+' debuff activations':a.metric==='failed_wit'?fmt(r.failed_wit)+' failed wit checks':a.metric==='rushed'?fmt(r.rushed)+' incidents · '+fmt(r.rushed_seconds,3)+' s':a.metric==='blocked_incidents'||a.metric==='blocked_seconds'?fmt(r.blocked_incidents)+' incidents · '+fmt(r.blocked_seconds,3)+' s':a.metric==='duel_seconds'?fmt(r.duel_seconds,3)+' s'+(r.duel_seconds_estimated?' · estimated':''):a.metric==='lane_loss_m'?fmt(r.lane_loss_m,3)+' m'+(r.lane_loss_m_estimated?' · estimated WT':''):a.metric==='zero_hp_finishes'?fmt(r.finish_hp,6)+' HP at finish'+(r.zero_hp_finish?' · Counts':' · Does not count'):(r.place?'Place '+r.place:'Outside podium')+' · '+fmt(r.points)+' pts';
   return `<tr><td>${esc(r.match_id.toUpperCase())}<br>${esc(r.race_folder)}<br>${esc(r.uma)}</td><td>${esc(detail)}${r.url?`<br><a href="${esc(base+r.url)}" target="_blank" rel="noopener">Race evidence ↗</a>`:''}</td></tr>`;
  }).join('');
  return `<details class="award-proof"><summary>See the receipts</summary><p>${winner.build?'One individual Uma build. Other builds and rounds do not add to this score.':`${fmt(p.starts)} races · ${fmt(p.build_count)} fielded builds · ${esc(p.rounds.join(', '))}`}</p>${winner.tiebreaks?.length?`<p>Tiebreakers: ${winner.tiebreaks.map(t=>esc(t.field.replaceAll('_',' '))+': '+fmt(t.value,4)).join(' · ')}</p>`:''}<div class="award-proof-scroll"><table><thead><tr><th>Record</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div>${a.metric==='efficiency'?`<p>${fmt(p.points)} points ÷ ${fmt(p.base_total)} stats × 1,000 = ${fmt(p.efficiency,6)}</p>`:''}</details>`;
 }
 function awardCard(a,options={}){
  const revealed=Boolean(options.revealed),winner=revealed?a.winner:null;
  return `<article class="award-card award-${esc(a.id)}" data-award="${esc(a.id)}"><div class="award-art"><img src="${esc(asset(a.image,options))}" alt="${esc(a.name)} artwork"><span class="award-category">${esc(a.category)}</span></div><div class="award-copy"><h2 id="award-detail-title">${esc(a.name)}</h2><p class="award-description">${esc(a.description)}</p><div class="award-winner"><img class="award-trophy" src="${esc(asset(`assets/awards/trophy-${a.trophy}.png`,options))}" alt=""><div class="award-name"><span>${revealed?(winner?'CURRENT LEADER':a.status==='tie'?'TIE — REVIEW NEEDED':'AWAITING EVIDENCE'):'WINNER'}</span><strong>${winner?esc(winner.name):revealed?'Pending':'To be revealed'}</strong><small>${winner?esc(winner.team)+(winner.build?'<br>'+esc(buildName(winner.build)):''):revealed?esc(a.reason||'No qualifying record yet.'):'Revealed after the tournament.'}</small></div><div class="award-number"><b>${winner?value(winner,a):'—'}</b><small>${esc(a.unit)}</small></div></div><details class="award-runners"><summary>${a.status==='tie'&&revealed?'Tied contenders':'Runners-up'} <span>${revealed?'Current standings':'Revealed at the final'}</span></summary><ol>${revealed?(a.runners_up?.length?a.runners_up.map((p,i)=>`<li><span>${a.status==='tie'?'=':String(i+2).padStart(2,'0')}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.team)}${p.build?'<br>'+esc(buildName(p.build)):''}</small></div><b>${value(p,a)} <small>${esc(a.unit)}</small></b></li>`).join(''):'<li class="award-no-runner">No other qualifying contender yet.</li>'):'<li class="award-no-runner">Names and values will appear at the final reveal.</li>'}</ol>${revealed&&a.tie_count>2?`<p class="tie-note">${a.tie_count} contenders share the top value. Showing two; use the private standings export for full records.</p>`:''}</details><details class="award-proof award-rule"><summary>How this award is decided</summary><p>${esc(a.rule)}</p></details>${revealed?receipts(a,winner,options.standings):''}</div></article>`;
 }
 function trophy(a,options){
  const winner=options.revealed?a.winner:null;
  return `<button type="button" class="trophy-slot" data-open-award="${esc(a.id)}" aria-haspopup="dialog" aria-label="View ${esc(a.name)}"><span class="trophy-stage"><span class="trophy-light"></span><img class="shelf-trophy" src="${esc(asset(`assets/awards/trophy-${a.trophy}.png`,options))}" alt="" loading="lazy"><span class="shelf-preview" aria-hidden="true"><img src="${esc(asset(a.image,options))}" alt="" loading="lazy"></span></span><span class="trophy-plaque"><span class="plaque-name">${esc(a.name)}</span><span class="plaque-status">${options.revealed?(winner?esc(winner.name)+' · '+value(winner,a):a.status==='tie'?'Tied · review contenders':'Pending evidence'):'View award'} <span aria-hidden="true">↗</span></span></span></button>`;
 }
 function page(index,config,standings,options={}){
  const revealed=Boolean(options.revealed&&standings),cards=revealed?standings.awards:AwardEngine.catalog(config),byId=new Map(cards.map(a=>[a.id,a]));
  const localTools=options.local?`<aside class="preview-tools"><div><strong>Your private winners review</strong><p>Saved standings to date. This local file does not publish anything.</p></div><div class="preview-actions"><button id="refresh-awards" class="btn">Refresh from live data ↻</button><button id="toggle-reveal" class="btn">${revealed?'Preview public shelf':'Show private standings'}</button><button id="download-awards" class="btn">Export standings JSON</button><label class="btn">Import verified records<input id="import-award-records" type="file" accept="application/json,.json"></label></div><p id="preview-status" role="status">${standings?`${standings.coverage.verified_races} / ${standings.coverage.expected_races} verified races · saved ${new Date(standings.generated_at).toLocaleString()}`:'Ready'}</p></aside>`:'';
  const shelves=AwardEngine.groups.map((g,i)=>`<section class="award-group award-group-${g.id}" aria-labelledby="award-group-${g.id}"><div class="award-group-heading"><span class="case-number">0${i+1}</span><div><p class="awards-eyebrow">${g.awards.length} AWARDS</p><h2 id="award-group-${g.id}">${esc(g.name)}</h2><p>${esc(g.description)}</p></div></div><div class="trophy-shelf">${g.awards.map(id=>byId.get(id)).filter(Boolean).map(a=>trophy(a,{...options,revealed})).join('')}</div></section>`).join('');
  return `<section class="awards-hero"><div><p class="awards-eyebrow">DOMINATOR NETWORK · 2026</p><h1>The trophy room.</h1><p>One tournament. Some very specific achievements.</p></div><span class="awards-seal">${revealed?'PRIVATE WINNERS REVIEW':'REVEAL AT THE FINAL'}</span></section>${localTools}<div class="case-intro"><p>${revealed?'Current leaders are shown on each plaque. Open a trophy for the winning Uma, contenders and receipts.':'The trophies are ready. Their winners are still under wraps.'}</p><span>Hover to preview · Click or tap to explore</span></div><nav class="case-nav" aria-label="Award categories">${AwardEngine.groups.map(g=>`<a href="#award-group-${g.id}">${esc(g.name)} <span>${g.awards.length}</span></a>`).join('')}</nav><div class="award-groups" aria-label="Tournament awards">${shelves}</div><dialog class="award-dialog" aria-labelledby="award-detail-title"><button class="award-close" type="button" aria-label="Close award details">✕</button><div class="award-dialog-body"></div></dialog><section id="tournament-statistics" class="tournament-statistics"><div class="stats-section-heading"><div><p class="awards-eyebrow">BEYOND THE TROPHIES</p><h2>Tournament statistics</h2></div><a class="btn" href="bracket.html">Open bracket ↗</a></div>${clubStats(index)}${options.local&&revealed?`<section class="player-statistics"><div class="stats-section-heading"><h2>Player statistics</h2></div><div class="stats-filters"><label>Player or club<input id="stats-search" type="search" placeholder="Search trainers…"></label><label>View<select id="stats-view"><option value="results">Points & podiums</option><option value="builds">Individual build bests</option><option value="events">Race events</option></select></label></div><div id="player-stats-table"></div><details class="stats-method"><summary>Counting rules & evidence coverage</summary><p>All Star Trainer, Hot Headed, Fine Motion Wit and Mejiro Fund compare individual fielded Uma builds. Each player enters their highest stats, highest Guts, lowest Wit or highest full-price SP, respectively. Additional builds and rounds do not add to those values.</p><p>Performance Anxiety and Nakayama Festa retain their points-per-stats formulas. Race events and points accumulate across eligible verified races. No More Goo Goo Babies counts finishes at exactly 0 HP before display rounding. Missing evidence is never treated as zero. Exact ties remain unassigned until a sourced organizer decision.</p><p>MVP and Wheelchair require two played rounds within the R2+ window. Round 1 contributes only confirmed disqualifications. Duel time and WT loss are Hakuraku estimates.</p>${standings.issues.length?`<ul>${standings.issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:''}</details></section>`:''}</section>`;
 }
 function bindCase(root,cards,options={}){
  const dialog=root.querySelector('.award-dialog'),body=dialog.querySelector('.award-dialog-body');let opener=null;
  // The private file's public asset base must not turn section links into site navigation.
  if(options.local)for(const link of root.querySelectorAll('.case-nav a'))link.onclick=e=>{e.preventDefault();root.querySelector(link.getAttribute('href'))?.scrollIntoView({behavior:'smooth',block:'start'});};
  for(const button of root.querySelectorAll('[data-open-award]'))button.onclick=()=>{
   const a=cards.find(a=>a.id===button.dataset.openAward);if(!a)return;
   opener=button;body.innerHTML=awardCard(a,options);dialog.showModal();dialog.scrollTop=0;document.body.classList.add('award-modal-open');dialog.querySelector('.award-close').focus();
  };
  dialog.querySelector('.award-close').onclick=()=>dialog.close();
  dialog.onclick=e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}};
  dialog.onclose=()=>{document.body.classList.remove('award-modal-open');body.innerHTML='';opener?.focus();};
 }
 function clubStats(index){
  const completed=index.matches.filter(m=>m.winner_id);
  const races=completed.reduce((n,m)=>n+(m.reported_results?.races.length||m.races.length),0);
  return `<div class="stats-totals"><div><b>${index.teams.length}</b><span>Clubs</span></div><div><b>${completed.length}</b><span>Completed matches</span></div><div><b>${races}</b><span>Reported races</span></div><div><b>${index.matches.filter(m=>m.status==='ready').length}</b><span>Matches ready</span></div></div><div class="stats-table-wrap"><table class="stats-table"><caption>Club records · all tournament rounds</caption><thead><tr><th>Club</th><th>Wins</th><th>Losses</th><th>Points for</th><th>Points against</th><th>Status</th></tr></thead><tbody>${index.teams.slice().sort((a,b)=>a.seed-b.seed).map(t=>{const matches=completed.filter(m=>m.participants.some(p=>p?.id===t.id));return `<tr><th><a href="club.html?id=${encodeURIComponent(t.id)}">${esc(t.name)}</a></th><td>${matches.filter(m=>m.winner_id===t.id).length}</td><td>${matches.filter(m=>m.loser_id===t.id).length}</td><td>${matches.reduce((n,m)=>n+(m.scores?.[t.id]||0),0)}</td><td>${matches.reduce((n,m)=>n+Object.entries(m.scores||{}).filter(([id])=>id!==t.id).reduce((n,[,v])=>n+v,0),0)}</td><td>${index.champion_id===t.id?'Champion':index.eliminated.includes(t.id)?'Eliminated':'In contention'}</td></tr>`}).join('')}</tbody></table></div>`;
 }
 function playerTable(standings,query='',view='results'){
  const columns={results:[['starts','Races'],['points','Points'],['firsts','1st'],['seconds','2nd'],['thirds','3rd']],builds:[['build_count','Builds'],['single_stats','Highest stats / Uma'],['single_guts','Highest Guts / Uma'],['single_wisdom','Lowest Wit / Uma'],['single_sp','Highest SP / Uma']],events:[['zero_hp_finishes','0 HP finishes'],['late_starts','Late starts'],['rushed','Rushed'],['failed_wit','Wit failures'],['blocked_incidents','Blocked count'],['blocked_seconds','Blocked seconds'],['duel_seconds','Duel seconds ≈'],['lane_loss_m','WT metres lost ≈']]}[view];
  const rows=standings.players.filter(p=>p.starts>0&&(!query||(p.name+' '+p.team).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>b[columns[1][0]]-a[columns[1][0]]||a.name.localeCompare(b.name));
  return `<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Player</th><th>Club</th><th>Rounds</th>${columns.map(([,name])=>`<th>${name}</th>`).join('')}</tr></thead><tbody>${rows.map(p=>`<tr><th>${esc(p.name)}</th><td>${esc(p.team)}</td><td>${esc(p.rounds.join(', '))}</td>${columns.map(([field])=>`<td>${fmt(['duel_seconds','lane_loss_m'].includes(field)&&p.coverage[field==='duel_seconds'?'duel':'lane']!==p.starts?null:p[field],['blocked_seconds','duel_seconds','lane_loss_m'].includes(field)?3:0)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="8">No matching players.</td></tr>`}</tbody></table></div>`;
 }
 async function getJSON(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);return r.json();}
 async function publicMount(){
  const root=document.getElementById('awards-root');
  try{const [index,config]=await Promise.all([getJSON('data/tournament-index.json'),getJSON('config/awards.json')]);root.innerHTML=page(index,config,null,{revealed:false});bindCase(root,AwardEngine.catalog(config),{revealed:false});}
  catch(e){root.innerHTML=`<div class="dt-error">The Stats page could not load. Please refresh.<p>${esc(e.message)}</p></div>`;}
 }
 function previewMount(seed){
  let {index,config,standings,skills,assets,telemetryData}=seed,revealed=true;
  const root=document.getElementById('awards-root');
  function render(){
   root.innerHTML=page(index,config,standings,{local:true,revealed,assets});
   bindCase(root,revealed?standings.awards:AwardEngine.catalog(config),{local:true,revealed,assets,standings});
   root.querySelector('#toggle-reveal').onclick=()=>{revealed=!revealed;render();};
   root.querySelector('#download-awards').onclick=()=>{const blob=new Blob([JSON.stringify(standings,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dominator-award-standings-private.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
   root.querySelector('#refresh-awards').onclick=refresh;
   root.querySelector('#import-award-records').onchange=async e=>{
    try{const file=e.target.files[0];if(!file)return;const imported=JSON.parse(await file.text());if(!Array.isArray(imported.verified_metrics)&&!imported.tie_decisions)throw Error('Expected verified_metrics or tie_decisions.');config={...config,verified_metrics:imported.verified_metrics??config.verified_metrics,tie_decisions:imported.tie_decisions??config.tie_decisions};await refresh();}
    catch(err){root.querySelector('#preview-status').textContent=err.message;}
   };
   if(revealed){const draw=()=>{root.querySelector('#player-stats-table').innerHTML=playerTable(standings,root.querySelector('#stats-search').value,root.querySelector('#stats-view').value);};root.querySelector('#stats-search').oninput=draw;root.querySelector('#stats-view').onchange=draw;draw();}
  }
  async function refresh(){
   const button=root.querySelector('#refresh-awards'),status=root.querySelector('#preview-status');button.disabled=true;status.textContent='Reading current tournament records…';
   try{
    const [nextIndex,nextSkills]=await Promise.all([getJSON(base+'data/tournament-index.json'),getJSON(base+'assets/award-skills.json')]);
    const files=nextIndex.matches.filter(m=>Number(m.round.slice(1))>=(config.performance_round_min??2)).flatMap(m=>m.races),docs={};
    let completed=0;
    // Small batches keep refresh responsive and avoid flooding the host.
    for(let i=0;i<files.length;i+=4){await Promise.all(files.slice(i,i+4).map(async f=>{docs[f.id]=await getJSON(base+f.data_file);completed++;}));status.textContent=`Loaded ${completed} / ${files.length} race exports…`;}
    const computed=AwardEngine.compute(nextIndex,docs,config,nextSkills.skills,telemetryData);index=nextIndex;skills=nextSkills.skills;standings=computed;render();
   }catch(e){status.textContent='Refresh failed; the saved snapshot is still available. '+e.message;button.disabled=false;}
  }
  render();
 }
 global.AwardUI={awardCard,page,playerTable,publicMount,previewMount,bindCase};
 if(typeof module!=='undefined'&&module.exports)module.exports=global.AwardUI;
})(typeof window!=='undefined'?window:globalThis);
