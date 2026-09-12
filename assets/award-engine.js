/* Pure award calculations. The public Stats page never calls compute(). */
(function(global){
 'use strict';
 const sum=values=>values.reduce((n,v)=>n+v,0);
 const number=v=>typeof v==='number'&&Number.isFinite(v);
 const clean=s=>String(s??'').normalize('NFKC').replace(/^@+/,'').trim();
 const key=(team,name)=>team+':'+clean(name).toLocaleLowerCase('en');
 const roundNumber=id=>Number(String(id).replace(/^R/i,''));
 const stats=['speed','stamina','power','guts','wisdom'];
 const specs=[
  ['nitro','The 5 Nitro Incident Award','Given to the player whose Umas late-started the most. The 12-billion-yen incident, now on a five-Nitro budget.','late_starts','late starts',-1,['late_delay_ms',-1,'max_delay_ms',-1]],
  ['all-star','All Star Trainer Award','Given to the player with the most combined base stats across all their fielded builds.','base_total','base stats',-1,['average_stats',-1]],
  ['performance-anxiety','Professor of Performance Anxiety Award','Given to the player whose fielded stats earned the fewest points in return.','efficiency','points / 1,000 stats',1,['base_total',-1]],
  ['festa','Nakayama Festa Award','Given to the player who won the most points relative to the stats they fielded.','efficiency','points / 1,000 stats',-1,['base_total',1]],
  ['top-road','Crying NTR Award','Given to the player whose Umas finished second the most.','seconds','second places',-1,['second_rate',-1,'points',-1]],
  ['flyingsparks','The Flyingsparks Award','Given to the player who fielded the most opponent-debuff skills across their played builds.','debuffs','debuff skills',-1,['debuff_activations',-1]],
  ['nature','Force of Nature Award','Given to the player whose Umas finished third the most.','thirds','third places',-1,['third_rate',-1,'points',-1]],
  ['double-jet','Double Jet Award','Given to the player whose Umas entered Rushed mode the most times.','rushed','Rushed incidents',-1,['rushed_seconds',-1]],
  ['hard-carry','Hard Carry Award','Given to the player whose Umas took the most first-place finishes.','firsts','first places',-1,['win_rate',-1,'points',-1]],
  ['bourbon','Retired Bourbon Award','Given to the player with the most verified failed wit checks across all races. Unmet skill conditions do not count.','failed_wit','failed wit checks',-1,['wit_failure_rate',-1]],
  ['hot-headed','Hot Headed Award','Given to the player with the most combined base Guts across their fielded builds.','guts','Guts',-1,['average_guts',-1]],
  ['fine-motion','Fine Motion Wit Award','Given to the player with the least combined base Wit across their fielded builds.','wisdom','Wit',1,['average_wisdom',1]],
  ['mejiro','The Mejiro Fund Award','Given to the player with the highest full-price SP total for purchased skills across their played builds, before hint discounts.','sp','SP',-1,['bought_skills',-1]],
  ['blocked-count','Asslicker Award','Given to the player whose Umas were blocked the most times.','blocked_incidents','blocking incidents received',-1,['blocked_seconds',-1]],
  ['blocked-time','Asslicker Award','Given to the player whose Umas spent the longest total time being blocked.','blocked_seconds','seconds blocked',-1,['blocked_incidents',-1]],
  ['neck','The Neck and Neck Award','Given to the player whose Umas spent the most estimated total time dueling.','duel_seconds','seconds dueling',-1,[]],
  ['gate-kept','Gate Kept Award','Given to the player with the most official disqualifications. Round 1 DQ records count here.','dqs','disqualifications',-1,[]],
  ['fences','Swing for the Fences Award','Given to the player whose Umas lost the most estimated distance to lane changes and wider cornering (WT).','lane_loss_m','metres lost',-1,[]],
  ['mvp','MVP Award','Given to the player who earned the most tournament points after playing at least two rounds from Round 2 onward.','points','points',-1,['points_per_race',-1,'starts',1]],
  ['wheelchair','The Wheelchair Award','Given to the player who earned the fewest tournament points after playing at least two rounds from Round 2 onward.','points','points',1,['points_per_race',1,'starts',-1]]
 ];
 const rules={
  nitro:'Recorded start delay ≥ 66 ms. Ties: total delay on late starts, then worst start delay.',
  'all-star':'Sum Speed + Stamina + Power + Guts + Wit before mood/race bonuses, once per fielded build per matchup. Tie: average build total.',
  'performance-anxiety':'Lowest points per 1,000 fielded base stats. Tie: higher total stats. Zero-point builds are included.',
  festa:'Highest points per 1,000 fielded base stats. Tie: lower total stats.',
  'top-road':'Official second-place finishes. Ties: second-place rate, then points.',
  flyingsparks:'Count opponent-debuff skills once per fielded build, including skills that did not activate. Tie: recorded debuff activations. Self costs and negative personal traits are excluded.',
  nature:'Official third-place finishes. Ties: third-place rate, then points.',
  'double-jet':'A continuous nonzero Rushed mode is one incident, including mode changes. Tie: total observed Rushed time.',
  'hard-carry':'Official first-place finishes. Ties: win rate, then points.',
  bourbon:'Only verified failed_wit outcomes. Failed conditions and unresolved outcomes are excluded. Tie: failure rate among verified wit rolls.',
  'hot-headed':'Base Guts summed once per fielded build per matchup. Tie: average build Guts.',
  'fine-motion':'Base Wit summed once per fielded build per matchup. Tie: average build Wit.',
  mejiro:'Full listed purchase SP, including prerequisite tiers once and purchased inherited uniques. The runner’s native unique and negative traits are excluded. Tie: purchased skill count.',
  'blocked-count':'Count unblocked → blocked transitions on the affected runner. Changing blocker without a free interval stays one incident. Tie: total blocked time.',
  'blocked-time':'Sum observed blocked intervals on the affected runner, clipped to their finish. Tie: incident count.',
  neck:'Sum Hakuraku-estimated duel intervals across each player’s runners and races. Uses start events, HP, opponent gaps, skill-adjusted speed, hills and finish time. Sourced verified observations override estimates.',
  'gate-kept':'Deduplicated organizer-confirmed DQ incidents. No automatic inference from eligibility or skill failures.',
  fences:'Sum estimated WT loss: max(0, min(previous speed, current speed) × frame duration − forward progress), interpolated at each runner’s finish. Includes lane changes and wider cornering. Sourced verified observations override estimates.',
  mvp:'At least two distinct played rounds, starting with R2. Most points; ties: more points per race, then fewer starts.',
  wheelchair:'At least two distinct played rounds, starting with R2. Ties: fewer points per race, then more starts.'
 };
 const firstAwards=['nitro','fine-motion','hard-carry','top-road','nature'];
 function catalog(config={}){return [...firstAwards.map(id=>specs.find(s=>s[0]===id)),...specs.filter(s=>!firstAwards.includes(s[0]))].map(([id,name,description,metric,unit,direction,tie])=>({id,name,description,metric,unit,direction,tie,rule:rules[id],image:config.images?.[id]||'',trophy:id==='nitro'?'nitro':id==='fine-motion'?'wit':'champion',category:id.startsWith('blocked-')?(id==='blocked-count'?'Most incidents received':'Longest time blocked'):id==='gate-kept'?'Official record':id==='neck'||id==='fences'?'Race analysis':'Round 2 onward'}));}
 function nativeUnique(id,variant){
  const text=String(variant),own=100000+10000*(Number(text.slice(-2))-1)+Number(text.slice(1,-2))*10+1;
  return id===own||id===own-90000;
 }
 function purchasedSkills(row,catalogue){
  const visited=new Set(),missing=new Set(),priced=new Set();let cost=0;
  function add(id){
   if(visited.has(id)||nativeUnique(id,row.variant_id))return;
   let actual=id;if(id>=100000&&id<200000)actual=id+800000;
   if(visited.has(actual))return;visited.add(actual);
   const def=catalogue[actual];
   if(!def||!number(def.cost)){missing.add(actual);return;}
   if(def.negative)return;
   priced.add(actual);cost+=def.cost;
   for(const prerequisite of def.requires||[])add(prerequisite);
  }
  for(const s of row.skills||[])add(s.id);
  return {cost:missing.size?null:cost,known_cost:cost,missing:[...missing],skill_count:priced.size};
 }
 function observedIntervals(rep,runner,finish,predicate){
  let count=0,seconds=0,active=false;const intervals=[];
  for(let i=0;i<rep.frames.length-1;i++){
   const a=rep.frames[i],b=rep.frames[i+1],start=Math.max(0,a.t),end=Math.min(finish,b.t);
   if(end<=start)continue;
   // A received frame describes the state over the interval ending at it.
   const on=predicate(b.r[runner.frame_index]);
   if(on){if(!active){count++;intervals.push({start,end});}else intervals.at(-1).end=end;seconds+=end-start;}
   active=on;
  }
  return {count,seconds,intervals};
 }
 function compute(index,raceDocs,config={},skillCatalog={},telemetryData=null){
  const players=new Map(),issues=[],covered=new Set(),builds=new Map();let expectedRaces=0,loadedRaces=0,verifiedRaces=0;
  const docs=raceDocs instanceof Map?raceDocs:new Map(Object.entries(raceDocs));
  const minRound=config.performance_round_min??2;
  const matches=index.matches.filter(m=>roundNumber(m.round)>=minRound);
  const selectedIds=new Set(matches.map(m=>m.id));
  function player(team,name){
   const normalized=clean(name),alias=config.player_aliases?.[key(team,normalized)]||normalized,k=key(team,alias);
   if(!players.has(k))players.set(k,{id:k,name:alias,team_id:team,team:index.teams.find(t=>t.id===team)?.name||team,points:0,starts:0,firsts:0,seconds:0,thirds:0,late_starts:0,late_delay_ms:0,max_delay_ms:0,failed_wit:0,wit_rolls:0,rushed:0,rushed_seconds:0,blocked_incidents:0,blocked_seconds:0,debuff_activations:0,debuffs:0,dqs:0,base_total:0,guts:0,wisdom:0,sp:0,bought_skills:0,duel_seconds:0,lane_loss_m:0,rounds:new Set(),matches:new Set(),builds:[],races:[],dq_records:[],coverage:{stats:0,sp:0,replay:0,wit:0,duel:0,lane:0}});
   return players.get(k);
  }
  const finish=(p,place,points)=>{p.points+=points||0;p.firsts+=place===1;p.seconds+=place===2;p.thirds+=place===3;};
  for(const match of matches){
   const groups=new Map();
   for(const file of match.races||[]){const n=Number(file.race_folder.match(/^(\d+)/)?.[1]);const k=Number.isFinite(n)?n:file.race_folder;(groups.get(k)||groups.set(k,[]).get(k)).push(file);}
   expectedRaces+=(match.reported_results?.races.length||groups.size);
   const handled=new Set();
   for(const [n,files]of groups){
    const candidates=files.map(f=>docs.get(f.id)).filter(Boolean);loadedRaces+=candidates.length;
    const unique=[...new Map(candidates.filter(d=>d.scoring_verified).map(d=>[d.raw_sha256||d.id,d])).values()];
    if(unique.length!==1){issues.push(`${match.id} race ${n}: ${unique.length?'multiple verified runs need an official selection':'verified export unavailable'}.`);continue;}
    const race=unique[0];if(covered.has(race.raw_sha256||race.id)){issues.push(`Duplicate export skipped: ${race.id}`);continue;}
    covered.add(race.raw_sha256||race.id);verifiedRaces++;handled.add(n);
    const telemetry=telemetryData&&global.AwardTelemetry?global.AwardTelemetry.estimate(race,telemetryData):{};
    for(const row of race.results.filter(r=>r.eligible&&r.team_id&&clean(r.owner))){
     const p=player(row.team_id,row.owner);p.rounds.add(match.round);p.matches.add(match.id);p.starts++;
     finish(p,row.scoring_place??row.place,row.points);
     const record={race_id:race.id,match_id:match.id,round:match.round,race_folder:race.race_folder,uma:row.uma,variant_id:row.variant_id,place:row.scoring_place??row.place,points:row.points,source:race.raw_path,url:'archive.html?'+new URLSearchParams({round:match.round,match:match.id,race:race.race_folder,file:race.id})};
     const fingerprint=JSON.stringify([row.variant_id,row.stats,row.skills,row.running_style_code]),buildKey=p.id+'|'+match.id+'|'+fingerprint;
     if(!builds.has(buildKey)){
      const full=stats.every(k=>number(row.stats?.[k])),sp=purchasedSkills(row,skillCatalog);
      const build={match_id:match.id,round:match.round,uma:row.uma,variant_id:row.variant_id,stats:row.stats,total:full?sum(stats.map(k=>row.stats[k])):null,sp:sp.cost,missing_prices:sp.missing,skills:row.skills.map(s=>({id:s.id,name:skillCatalog[s.id]?.name||String(s.id)})),source:race.raw_path};
      p.builds.push(build);builds.set(buildKey,build);
      if(full){p.coverage.stats++;p.base_total+=build.total;p.guts+=row.stats.guts;p.wisdom+=row.stats.wisdom;}
      if(sp.cost!==null){p.coverage.sp++;p.sp+=sp.cost;p.bought_skills+=sp.skill_count;}
      p.debuffs+=new Set(row.skills.filter(s=>skillCatalog[s.id]?.debuff).map(s=>s.id)).size;
     }
     const rep=race.replay,runner=rep?.status==='ready'?rep.runners.find(r=>r.entry_id===row.entry_id):null;
     if(runner){
      p.coverage.replay++;
      record.start_delay_ms=runner.start_delay_ms;
      if(number(runner.start_delay_ms)){p.max_delay_ms=Math.max(p.max_delay_ms,runner.start_delay_ms);if(runner.start_delay_ms>=66){p.late_starts++;p.late_delay_ms+=runner.start_delay_ms;}}
      const rush=observedIntervals(rep,runner,row.raw_seconds,r=>r[4]>0),blocked=observedIntervals(rep,runner,row.raw_seconds,r=>r[5]>=0);
      p.rushed+=rush.count;p.rushed_seconds+=rush.seconds;p.blocked_incidents+=blocked.count;p.blocked_seconds+=blocked.seconds;
      Object.assign(record,{rushed:rush.count,rushed_seconds:rush.seconds,blocked_incidents:blocked.count,blocked_seconds:blocked.seconds,blocked_intervals:blocked.intervals});
      const outcomes=Object.values(runner.skill_outcomes||{});
      if(rep.skill_lottery?.verified&&outcomes.length===row.skills.length&&!outcomes.some(o=>o.status==='unresolved')){
       p.coverage.wit++;record.failed_wit=outcomes.filter(o=>o.status==='failed_wit').length;p.failed_wit+=record.failed_wit;p.wit_rolls+=row.skills.filter(s=>skillCatalog[s.id]?.activate_lot===1).length;
      }
      const fired=rep.events.filter(e=>e.type===3&&e.params[0]===runner.frame_index&&e.t<=row.raw_seconds);
      p.debuff_activations+=fired.filter(e=>skillCatalog[e.params[1]]?.debuff).length;
      for(const [field,coverageKey]of [['duel_seconds','duel'],['lane_loss_m','lane']]){
       const override=(config.verified_metrics||[]).find(v=>v.race_id===race.id&&key(v.team_id,v.player)===p.id&&v.metric===field&&v.verified===true&&v.source);
       const direct=runner.award_metrics?.[field];
       const estimated=telemetry[runner.entry_id]?.[field];
       const value=override?.value??(direct?.verified&&direct.source?direct.value:null);
       // A runner with no recorded duel starts has exactly zero duel time.
       const known=value??estimated?.value??(field==='duel_seconds'&&runner.duel_events===0?0:null);
       if(number(known)&&known>=0){p[field]+=known;p.coverage[coverageKey]++;record[field]=known;record[field+'_source']=override?.source||direct?.source||estimated?.source||'No recorded duel starts';record[field+'_estimated']=value==null&&Boolean(estimated);}
      }
     }
     p.races.push(record);
    }
   }
   for(const report of match.reported_results?.races||[]){
    if(handled.has(report.number))continue;
    for(const row of (match.lineup||[]).filter(r=>!r.benched)){
     const name=row.display_name||row.discord;if(!clean(name))continue;
     const p=player(row.team_id,name);p.starts++;p.rounds.add(match.round);p.matches.add(match.id);
     const podium=report.podium.find(r=>r.team_id===row.team_id&&(r.variant_id&&r.variant_id===row.variant_id||r.uma===row.uma));
     if(podium)finish(p,podium.place,podium.points);
     p.races.push({match_id:match.id,round:match.round,race_folder:report.track,uma:row.uma,place:podium?.place??null,points:podium?.points??0,report_only:true,source:match.report_path});
    }
   }
  }
  const dqSeen=new Set();
  for(const d of config.disqualifications||[]){
   if(dqSeen.has(d.id))continue;dqSeen.add(d.id);
   if(!d.id||!d.source||d.round!=='R1'||!Number.isInteger(d.count)||d.count<1)throw Error('Every DQ needs a unique Round 1 incident ID, source and positive count.');
   const p=player(d.team_id,d.player);p.dqs+=d.count;p.dq_records.push(d);
  }
  for(const p of players.values()){
   p.rounds=[...p.rounds].sort();p.matches=[...p.matches];p.build_count=p.builds.length;
   p.average_stats=p.build_count?p.base_total/p.build_count:0;p.average_guts=p.build_count?p.guts/p.build_count:0;p.average_wisdom=p.build_count?p.wisdom/p.build_count:0;
   p.efficiency=p.base_total?p.points*1000/p.base_total:null;
   p.points_per_race=p.starts?p.points/p.starts:0;p.win_rate=p.starts?p.firsts/p.starts:0;p.second_rate=p.starts?p.seconds/p.starts:0;p.third_rate=p.starts?p.thirds/p.starts:0;p.wit_failure_rate=p.wit_rolls?p.failed_wit/p.wit_rolls:0;
  }
  const list=[...players.values()].sort((a,b)=>a.team.localeCompare(b.team)||a.name.localeCompare(b.name));
  const awards=catalog(config).map(a=>{
   let eligible=list.filter(p=>a.id==='gate-kept'?p.dqs>0:p.starts>0),reason='';
   if(['wheelchair','mvp'].includes(a.id))eligible=eligible.filter(p=>p.rounds.length>=(config.wheelchair_min_rounds??2));
   const metricCoverage=['base_total','guts','wisdom','efficiency','debuffs'].includes(a.metric)?'stats':a.metric==='sp'?'sp':a.metric==='failed_wit'?'wit':a.metric==='duel_seconds'?'duel':a.metric==='lane_loss_m'?'lane':['late_starts','rushed','blocked_incidents','blocked_seconds'].includes(a.metric)?'replay':null;
   if(metricCoverage){
    const complete=p=>['stats','sp'].includes(metricCoverage)?p.build_count>0&&p.coverage[metricCoverage]===p.build_count&&p.races.every(r=>!r.report_only):p.coverage[metricCoverage]===p.starts;
    if(eligible.some(p=>!complete(p)||(a.metric==='late_starts'&&p.races.some(r=>!number(r.start_delay_ms))))){reason=`Complete ${a.metric.replaceAll('_',' ')} evidence is not yet available for every player.`;eligible=[];}
   }
   const compare=(p,q)=>{
    for(const [field,dir]of [[a.metric,a.direction],...Array.from({length:a.tie.length/2},(_,i)=>a.tie.slice(i*2,i*2+2))]){const delta=(p[field]-q[field])*dir;if(Math.abs(delta)>1e-9)return delta;}
    return 0;
   };
   eligible.sort((p,q)=>compare(p,q)||p.id.localeCompare(q.id));
   const tied=eligible.length>1&&compare(eligible[0],eligible[1])===0;
   let chosen=eligible[0];
   const decision=config.tie_decisions?.[a.id];
   if(tied&&decision?.source){const selected=eligible.find(p=>p.id===decision.player_id&&compare(p,eligible[0])===0);if(selected)chosen=selected;}
   const unresolved=tied&&(!decision?.source||chosen?.id!==decision.player_id);
   const entry=p=>({player_id:p.id,name:p.name,team:p.team,value:p[a.metric],points:p.points,build_count:p.build_count,starts:p.starts,base_total:p.base_total,rounds:p.rounds,tiebreaks:a.tie.filter((_,i)=>i%2===0).map(field=>({field,value:p[field]}))});
   return {...a,status:reason?'unavailable':!eligible.length?'pending':unresolved?'tie':'provisional',reason:reason||(!eligible.length?(['wheelchair','mvp'].includes(a.id)?'No player has completed two played rounds from R2 yet.':'No qualifying record yet.'):unresolved?'The metric and all published tiebreakers are tied. One organizer decision is required.':''),winner:chosen&&!unresolved?entry(chosen):null,runners_up:eligible.filter(p=>!chosen||p.id!==chosen.id||unresolved).slice(0,2).map(entry),tie_count:tied?eligible.filter(p=>compare(p,eligible[0])===0).length:0,decision:decision?.source||null};
  });
  return {schema_version:1,generated_at:new Date().toISOString(),round_min:minRound,players:list,awards,coverage:{expected_races:expectedRaces,loaded_files:loadedRaces,verified_races:verifiedRaces,played_builds:builds.size,players:list.filter(p=>p.starts>0).length},issues,selected_matches:[...selectedIds]};
 }
 global.AwardEngine={catalog,compute,purchasedSkills,nativeUnique,observedIntervals};
 if(typeof module!=='undefined'&&module.exports)module.exports=global.AwardEngine;
})(typeof window!=='undefined'?window:globalThis);
