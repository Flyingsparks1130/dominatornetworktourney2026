'use strict';
const clubPlayerName=value=>/^<@!?\d+>$/.test(String(value||''))?'Name pending':String(value||'').replace(/^@+/,'')||'Name pending';
(async()=>{
 const data=await getJSON('data/tournament-index.json');
 const status=c=>data.champion_id===c.id?'Champion':data.eliminated.includes(c.id)?'Eliminated':'In contention';
 const names=c=>(data.club_rosters?.[c.id]?.members||[]).map(r=>r.display_name).filter(Boolean);
 const clubUrl=c=>'club.html?id='+encodeURIComponent(c.id);
 const matchesFor=c=>data.matches.filter(m=>m.participants.some(t=>t?.id===c.id));
 const record=c=>{
  const completed=matchesFor(c).filter(m=>m.winner_id);
  return {wins:completed.filter(m=>m.winner_id===c.id).length,losses:completed.filter(m=>m.loser_id===c.id).length,points:completed.reduce((n,m)=>n+(m.scores?.[c.id]??0),0)};
 };
 if(document.getElementById('club-rows')){
  const rows=document.getElementById('club-rows'),search=document.getElementById('club-search');
  function render(){
   const query=search.value.trim().toLowerCase();
   const clubs=data.teams.filter(c=>!query||[c.name,...names(c)].join(' ').toLowerCase().includes(query)).sort((a,b)=>a.seed-b.seed);
   document.getElementById('club-count').textContent=`${clubs.length} of ${data.teams.length} clubs`;
   rows.innerHTML=clubs.map(c=>{
    const entry=data.matches.find(m=>m.sources.some(s=>s.team===c.id)),roster=data.club_rosters?.[c.id],r=record(c);
    return `<article class="race-club-card dt-side-${(c.seed-1)%2} ${data.eliminated.includes(c.id)?'is-eliminated':''}"><header><div class="race-team-heading">${TournamentUI.seal(c)}<div><span class="race-eyebrow">Seed ${esc(c.seed)} · Enters ${esc(entry?.round||'—')}</span><h2><a href="${clubUrl(c)}">${esc(c.name)}</a></h2></div></div><span class="race-status">${esc(status(c))}</span></header><div class="race-club-body"><div class="race-club-record"><span><strong>${r.wins}–${r.losses}</strong> W–L</span><span>${r.points} match points</span></div><span class="race-eyebrow">${roster?.round?esc(roster.round)+' roster':'Players'}</span><ul class="race-club-members">${names(c).length?names(c).map(n=>`<li>${esc(n)}</li>`).join(''):'<li>Roster to be announced</li>'}</ul><a class="btn" href="${clubUrl(c)}">Explore ${esc(c.name)} <span aria-hidden="true">↗</span></a></div></article>`;
   }).join('')||'<div class="dt-empty">No clubs or players match your search.</div>';
  }
  render();search.addEventListener('input',render);return;
 }
 const id=new URLSearchParams(location.search).get('id'),c=data.teams.find(c=>c.id===id||c.club_id===id),root=document.getElementById('club-detail');
 if(!c){root.innerHTML='<h1>Club not found</h1><a href="clubs.html">All clubs</a>';return}
 let roster=data.club_rosters?.[c.id];
 if(!roster){
  const fallback=await getJSON('config/clubs.json');
  const club=fallback.clubs.find(x=>x.id===c.club_id||x.id===c.id||x.name.toLowerCase()===c.name.toLowerCase());
  roster={members:(club?.members||[]).filter(m=>m.name&&!/ Player \d+$/.test(m.name)).map(m=>({display_name:clubPlayerName(m.name)}))};
 }
 const matches=matchesFor(c),r=record(c),upcoming=matches.filter(m=>!m.winner_id),completed=matches.filter(m=>m.winner_id).reverse();
 document.title=`${c.name} · The Dominator`;
 const matchSection=(title,list)=>list.length?`<section><div class="race-section-title"><h2>${title}</h2><span>${list.length} ${list.length===1?'match':'matches'}</span></div><div class="race-club-matches">${list.map(m=>TournamentUI.matchCard(m)).join('')}</div></section>`:'';
 root.innerHTML=`<div class="page-head club-detail-head race-club-hero"><div class="race-team-heading">${TournamentUI.seal(c)}<div><div class="section-kicker">SEED ${esc(c.seed)} · ${esc(status(c))}</div><h1>${esc(c.name)}</h1></div></div><a class="btn" href="clubs.html">All clubs →</a></div><div class="race-club-stats"><div><strong>${r.wins}</strong><span>Match wins</span></div><div><strong>${r.losses}</strong><span>Match losses</span></div><div><strong>${r.points}</strong><span>Match points</span></div></div><section><div class="race-section-title"><h2>Meet the players</h2><span>${roster.round?esc(roster.round)+' roster':'Player roster'}</span></div><div class="member-grid">${Array.from({length:5},(_,i)=>{const player=roster.members[i],name=player?.display_name||'Name pending',initials=player?.display_name?Array.from(player.display_name).slice(0,2).join('').toUpperCase():'?';return `<article class="member-card race-member-card"><div class="race-member-art" aria-hidden="true"><span>${esc(initials)}</span></div><div><div class="role">PLAYER ${String(i+1).padStart(2,'0')}</div><h3>${esc(name)}</h3></div></article>`}).join('')}</div></section>${matchSection('Next on the track',upcoming)}${matchSection('Match results',completed)}${!matches.length?'<p class="race-club-summary">Matchups will appear here once announced.</p>':''}`;
})().catch(e=>{const root=document.getElementById('club-detail')||document.getElementById('club-rows');root.textContent=e.message});
