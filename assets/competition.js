/* Shared match cards keep club colors, scores and lineups consistent across pages. */
(function(global){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const url=(m,view)=>'archive.html?'+new URLSearchParams({round:m.round,match:m.id,...(view?{view}:{})});
 const status=m=>({complete:'Final',forfeit:'Forfeit',ready:'Ready to race',awaiting_opponent:'Awaiting opponent',in_progress:'Racing',needs_review:'Under review'}[m.status]||m.status);
 const seal=t=>`<span class="dt-team-seal" aria-label="${t?'Seed '+esc(t.seed):'Opponent pending'}">${t?esc(t.seed):'?'}</span>`;
 const opponent=(m,i)=>m.participants[i]?.name||`Winner of ${m.sources[i].winner_of.toUpperCase()}`;
 function matchCard(m,{view}={}){
  const count=m.reported_results?.races.length||m.races.length;
  const draftStatus=m.draft_has_content?`${m.draft.status.replaceAll('_',' ')} · ${m.draft.final_tracks.length} tracks`:'Draft not added';
  const action=view==='draft'?'View match draft':'View match';
  const lineup=m.draft_lineup?.length?m.draft_lineup:m.lineup||[];
  return `<a class="dt-match-card race-match-card" href="${url(m,view)}" aria-label="${esc(m.participants.map((_,i)=>opponent(m,i)).join(' vs '))}: ${action}">
   <div class="race-match-top"><span>${esc(m.id.toUpperCase())}</span><span class="race-status ${m.winner_id?'is-final':m.status==='ready'?'is-ready':''}">${esc(status(m))}</span></div>
   <div class="race-match-face"><span class="race-versus" aria-hidden="true">VS</span>${m.participants.map((t,i)=>{
    const rows=lineup.filter(p=>p.team_id===t?.id&&!p.benched);
    return `<section class="race-match-side dt-side-${i} ${t&&m.winner_id===t.id?'is-winner':''}"><div class="race-team-heading">${seal(t)}<h3>${esc(opponent(m,i))}</h3></div><div class="race-score"><strong>${t&&m.scores?esc(m.scores[t.id]??'—'):'—'}</strong><span>${t&&m.winner_id===t.id?'WINNER':m.winner_id?'FINAL SCORE':'AWAITING RACE'}</span></div><div class="race-mini-lineup" aria-label="${esc(t?.name||'Pending')} match lineup">${rows.length?rows.map(p=>p.portrait?`<img src="${esc(p.portrait)}" alt="${esc(p.uma)}" title="${esc(p.display_name||p.uma)}" loading="lazy">`:'').join(''):'<span>Lineup to be announced</span>'}</div></section>`;
   }).join('')}</div><div class="race-match-foot"><span>${view==='draft'?esc(draftStatus):count?count+' races recorded':m.score_only?'Official result':'Draft & race details'}</span><strong>${action} <span aria-hidden="true">↗</span></strong></div></a>`;
 }
 function scoreboard(m){
  return `<div class="race-scoreboard"><span class="race-versus" aria-hidden="true">VS</span>${m.participants.map((t,i)=>`<section class="race-score-team dt-side-${i}"><div class="race-team-heading">${seal(t)}<div><span class="race-eyebrow">${t&&m.winner_id===t.id?'MATCH WINNER':m.winner_id?'FINAL SCORE':'ON THE STARTING LINE'}</span><h2>${esc(opponent(m,i))}</h2></div></div><div class="race-score"><strong>${t&&m.scores?esc(m.scores[t.id]??'—'):'—'}</strong><span>${m.scores?'POINTS':'TO RACE'}</span></div></section>`).join('')}</div>`;
 }
 global.TournamentUI={matchCard,scoreboard,seal,status,url};
})(window);
