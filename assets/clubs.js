'use strict';
const clubPlayerName=value=>/^<@!?\d+>$/.test(String(value||''))?'Name pending':String(value||'').replace(/^@+/,'')||'Name pending';
(async()=>{
 const data=await getJSON('data/tournament-index.json');
 const status=c=>data.champion_id===c.id?'Champion':data.eliminated.includes(c.id)?'Eliminated':'In contention';
 const names=c=>(data.club_rosters?.[c.id]?.members||[]).map(r=>r.display_name).filter(Boolean);
 if(document.getElementById('club-rows')){
  const rows=document.getElementById('club-rows'),search=document.getElementById('club-search');
  function render(){
   const query=search.value.trim().toLowerCase();
   rows.innerHTML=data.teams.filter(c=>!query||[c.name,...names(c)].join(' ').toLowerCase().includes(query)).sort((a,b)=>a.seed-b.seed).map(c=>{
    const entry=data.matches.find(m=>m.sources.some(s=>s.team===c.id)),roster=data.club_rosters?.[c.id];
    return `<tr><td class="draw-cell">#${esc(c.seed)}</td><td class="club-cell"><a href="club.html?id=${encodeURIComponent(c.id)}">${esc(c.name)}</a></td><td class="club-player-list">${names(c).length?names(c).map(n=>`<span>${esc(n)}</span>`).join(''):esc(roster?'Names pending':'Not announced')}${roster?`<small>${esc(roster.round)} lineup</small>`:''}</td><td>${esc(entry?.round||'—')}</td><td>${esc(status(c))}</td></tr>`;
   }).join('');
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
 const matches=data.matches.filter(m=>m.participants.some(t=>t?.id===c.id));
 document.title=`${c.name} · The Dominator`;
 root.innerHTML=`<div class="page-head club-detail-head"><div><div class="section-kicker">SEED ${esc(c.seed)} · ${esc(status(c))}</div><h1>${esc(c.name)}</h1></div><a class="btn" href="clubs.html">All clubs</a></div><div class="section-kicker">${roster.round?esc(roster.round)+' LINEUP':'PLAYERS'}</div><div class="member-grid">${Array.from({length:5},(_,i)=>{const player=roster.members[i];return `<article class="member-card"><div class="role">PLAYER ${i+1}</div><h3>${esc(player?.display_name||'Name pending')}</h3>${player?.uma?`<p>${esc(player.uma)}</p>`:''}</article>`}).join('')}</div><div class="rule"></div><div class="section-kicker">MATCHES</div>${matches.map(m=>`<p><a class="btn" href="archive.html?${new URLSearchParams({round:m.round,match:m.id})}">${esc(m.round)} · ${esc(m.participants.map(t=>t?.name||'Opponent pending').join(' vs '))} →</a></p>`).join('')}`;
})().catch(e=>{const root=document.getElementById('club-detail')||document.getElementById('club-rows');root.textContent=e.message});
