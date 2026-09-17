// Tournament aggregates: one build per trainer/match, one reported race per match/number.
'use strict';
const distanceType=m=>m<=1400?'Sprint':m<=1800?'Mile':m<=2400?'Medium':'Long';
const trackKey=s=>{const m=String(s||'').match(/^(.+?\b\d{3,4}m)/i);return m?m[1].replace(/\s+/g,' ').trim()+' · '+(/dirt/i.test(s)?'Dirt':'Turf'):String(s||'Unknown');};
const add=(map,key,n=1)=>map.set(String(key),(map.get(String(key))||0)+n);
function ranking(map,describe=k=>({name:k})) {let last=-1,rank=0;return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([id,count],i)=>{if(count!==last)rank=i+1;last=count;return {id,...describe(id),count,rank};});}
function distribution(values,width=100){
 const v=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return {n:0,bins:[]};
 const q=p=>{const x=(v.length-1)*p,i=Math.floor(x);return v[i]+(v[Math.ceil(x)]-v[i])*(x-i);};
 const start=Math.floor(v[0]/width)*width,end=(Math.floor(v.at(-1)/width)+1)*width,bins=[];
 for(let x=start;x<end;x+=width)bins.push({low:x,high:x+width,count:v.filter(n=>n>=x&&n<x+width).length});
 return {n:v.length,min:v[0],max:v.at(-1),mean:v.reduce((n,x)=>n+x,0)/v.length,median:q(.5),q1:q(.25),q3:q(.75),bins};
}
function compute(index,docs,catalogues={}){
 const {supports={},portraits={},skills={},skillMeta={}}=catalogues;
 const builds=new Map(),seenRaces=new Set(),support=new Map(),skill=new Map(),fielded=new Map(),veto=new Map(),preban=new Map(),picks=new Map(),trackVeto=new Map(),dist=new Map(['Sprint','Mile','Medium','Long'].map(x=>[x,0])),surface=new Map([['Turf',0],['Dirt',0]]);
 const gradeKeys=['sprint','mile','medium','long','front','pace','late','end','turf','dirt'];
 const grades=Object.fromEntries(gradeKeys.map(k=>[k,{S:0,A:0,B:0,lower:0,unknown:0}]));
 const active=Object.fromEntries(['distance','style','surface'].map(k=>[k,{S:0,A:0,B:0,lower:0,unknown:0}]));
 const grade=(target,v)=>target[v==='S'?'S':v==='A'?'A':v==='B'?'B':/^[C-G]$/.test(v)?'lower':'unknown']++;
 let races=0,starts=0,draftMatches=0,pickMatches=0,fieldedSlots=0,rosterMatches=0,deckBuilds=0,skillBuilds=0;
 for(const m of index.matches){
  const d=m.draft||{};
  if(m.draft_has_content)draftMatches++;
  for(const x of d.uma_bans||[])add(veto,x.uma);
  for(const x of d.uma_pre_bans||[])add(preban,x.uma);
  if(d.track_picks?.length)pickMatches++;
  for(const x of d.track_picks||[])add(picks,trackKey(x.track));
  for(const x of d.track_vetoes||[])add(trackVeto,trackKey(x.track));
  if(d.roster?.length){rosterMatches++;for(const x of d.roster)if(x.benched===false){add(fielded,x.uma);fieldedSlots++;}}
  // Reported results are authoritative here; never add exported races to the same match.
  const played=m.reported_results?.races;
  const courses=played?.length?played.map(r=>({track:r.track,key:r.number})):m.races.map(r=>({track:r.race_folder,course:r.course,key:r.id}));
  const reported=new Set();for(const r of courses){if(reported.has(r.key))continue;reported.add(r.key);const metres=r.course?.distance_m||Number(String(r.track).match(/(\d{3,4})m/)?.[1]);if(metres){add(dist,distanceType(metres));add(surface,r.course?.surface||(/dirt/i.test(r.track)?'Dirt':'Turf'));races++;}}
  for(const f of m.races){const r=docs[f.id];if(!r?.scoring_verified)continue;const hash=r.raw_sha256||r.content_hash||r.id;if(seenRaces.has(hash))continue;seenRaces.add(hash);
   for(const row of r.results||[]){if(!row.eligible||!row.team_id||!row.owner)continue;starts++;
    grade(active.distance,row.aptitudes?.distance);grade(active.surface,row.aptitudes?.surface);grade(active.style,row.aptitudes?.[['','front','pace','late','end'][row.running_style_code]]);
    const fingerprint=row.build_fingerprint||JSON.stringify([row.variant_id,row.stats,row.skills,row.running_style_code,row.support]);
    const key=[m.id,row.team_id,row.owner.trim().toLowerCase().replace(/^@/,''),fingerprint].join('|');if(!builds.has(key))builds.set(key,row);
   }
  }
 }
 for(const b of builds.values()){
  for(const k of gradeKeys)grade(grades[k],b.aptitudes?.[k]);
  if(Array.isArray(b.support)&&b.support.length){deckBuilds++;for(const id of new Set(b.support.map(c=>c.id)))add(support,id);}
  if(Array.isArray(b.skills)){skillBuilds++;for(const id of new Set(b.skills.map(c=>c.id)))add(skill,id);}
 }
 const uma=name=>({name,image:portraits[name]?.portrait||null});
 const out={schema_version:1,coverage:{matches:index.matches.length,draft_matches:draftMatches,pick_matches:pickMatches,roster_matches:rosterMatches,reported_races:races,verified_races:seenRaces.size,starts,builds:builds.size,deck_builds:deckBuilds,skill_builds:skillBuilds,fielded_slots:fieldedSlots},
  support:ranking(support,id=>({name:supports[id]?.name||'Support card '+id,image:`assets/supports/${id}.webp`,rarity:Number(id)>=30000?'SSR':Number(id)>=20000?'SR':'R'})),
  skills:ranking(skill,id=>({name:skills[id]?.name||'Skill '+id,image:skillMeta[id]?.icon_id?`assets/icons/skills/${skillMeta[id].icon_id}.webp`:null})),
  fielded:ranking(fielded,uma),veto:ranking(veto,uma),preban:ranking(preban,uma),track_picks:ranking(picks),track_vetoes:ranking(trackVeto),distance:ranking(dist),surface:ranking(surface),aptitudes:grades,active_aptitudes:active,
  distributions:Object.fromEntries(['speed','stamina','power','guts','wisdom'].map(k=>[k,distribution([...builds.values()].map(b=>b.stats?.[k]))]))};
 return out;
}
module.exports={compute,distribution,trackKey,distanceType,ranking};
