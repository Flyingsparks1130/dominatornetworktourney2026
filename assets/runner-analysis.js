/* Runner detail dialog. Charts and phase summaries use recorded simulation samples. */
(function(global){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):'—';
 const name=x=>String(x||'').replace(/^@+/,'');
 const styles={1:'Front runner',2:'Pace chaser',3:'Late surger',4:'End closer'};
 const statColors={speed:'#61b8ff',stamina:'#f38c76',power:'#efb051',guts:'#ed7faf',wisdom:'#70d3a2'};
 function statSegments(value){
  const amount=Number.isFinite(value)?Math.max(0,Math.min(2000,value)):0;
  return {color:Math.min(1200,amount)/20,pearl:Math.max(0,amount-1200)/20,capped:amount>=1200};
 }
 function statsMarkup(stats,base={}){
  return Object.entries(stats).map(([key,value])=>{
   const bar=statSegments(value),icon=key==='wisdom'?'wit':key;
   return `<div class="${bar.capped?'ra-stat-high':''}" style="--stat-color:${statColors[key]||'#ed8799'}"><span class="ra-stat-label">${statColors[key]?`<img src="assets/icons/stats/${icon}.webp" alt="">`:''}<span>${esc(key)}</span></span><div class="ra-stat-bar" role="img" aria-label="${esc(key)}: ${esc(value??'not recorded')}; scale 0 to 2000; threshold 1200"><i style="width:${bar.color}%"></i><b style="width:${bar.pearl}%"></b><em></em></div><strong>${esc(value??'—')}</strong><small>${fmt(base[key],0)}</small></div>`;
  }).join('');
 }
 function skillGroups(r,rep,m){
  const groups={activated:[],failed_wit:[],failed_condition:[],unresolved:[]};
  const allEvents=m?rep.events.filter(e=>e.type===3&&e.params[0]===m.frame_index):[];
  for(const s of r.skills){
   const outcome=m?.skill_outcomes?.[s.id],sid=outcome?.replay_skill_id??s.id;
   const occurrences=allEvents.filter(e=>e.params[1]===s.id||e.params[1]===sid);
   const status=occurrences.length?'activated':outcome?.status||'unresolved';
   (groups[status]||groups.unresolved).push({...s,outcome,occurrences});
  }
  groups.activated.sort((a,b)=>a.occurrences[0].t-b.occurrences[0].t||a.id-b.id);
  return groups;
 }
 function phases(data,runner){
  const rep=data.replay,meta=rep.runners.find(r=>r.entry_id===runner.entry_id),distance=rep.distance_m;
  const start=meta.last_spurt_m>0?meta.last_spurt_m:distance;
  const ranges=[['Opening',0,distance/6],['Middle',distance/6,distance*2/3],['Final',distance*2/3,distance],['Spurt',start,distance]];
  return ranges.map(([label,min,max])=>{
   let duration=0,position=0,speed=0;
   for(let i=0;i<rep.frames.length-1;i++){
    const a=rep.frames[i],b=rep.frames[i+1],h=a.r[meta.frame_index],next=b.r[meta.frame_index];
    const delta=next[0]-h[0];if(delta<=0||a.t>=runner.raw_seconds)continue;
    const from=Math.max(0,(min-h[0])/delta),to=Math.min(1,(max-h[0])/delta,(runner.raw_seconds-a.t)/(b.t-a.t));
    if(to<=from)continue;
    const dt=(b.t-a.t)*(to-from),mid=(from+to)/2,d=h[0]+delta*mid;
    const place=1+a.r.filter((other,j)=>j!==meta.frame_index&&other[0]+(b.r[j][0]-other[0])*mid>d).length;
    duration+=dt;position+=place*dt;speed+=(h[2]+(next[2]-h[2])*mid)*dt;
   }
   return {label,position:duration?position/duration:null,speed:duration?speed/duration:null};
  });
 }
 function open({data,runner:r,labels,teamName,sample,seek}){
  document.querySelector('.ra-dialog')?.close();
  const rep=data.replay?.status==='ready'?data.replay:null,m=rep?.runners.find(x=>x.entry_id===r.entry_id);
  const events=rep?.events.filter(e=>e.type===3&&e.params[0]===m.frame_index)||[];
  const skill=id=>labels.skills[id]||`Skill ${id}`;
  const portrait=labels.portraits[r.variant_id];
  const phase=rep?phases(data,r):[],groups=skillGroups(r,rep,m);
  const metrics=[['Time',r.raw_display],['Behind winner',r.place===1?'Winner':`+${fmt(r.raw_seconds-data.results[0].raw_seconds,3)} s`],
   ['Start delay',m?`${fmt(m.start_delay_ms)} ms · ${global.RaceReplay.startStatus(m.start_delay_ms)||'—'}`:'—'],['Peak speed',m?`${fmt(m.peak_speed_mps,2)} m/s`:'—'],
   ['Last spurt',m?.last_spurt_m!=null?`${fmt(m.last_spurt_m)} m`:'—'],['Spurt delay',m?`${fmt(m.spurt_delay_m)} m`:'—'],
   ['Duel triggers',m?.duel_events??'—'],['Finish HP',m?`${fmt(m.hp_finish,0)} · ${fmt(100*m.hp_finish/m.hp_start)}%`:'—'],
   ['Scaled time',r.scaled_display||'—'],['Points',r.points],['Skill activations',m?.skill_activations??'—'],
   ['HP depleted',m?.hp_zero_remaining_m!=null?`${fmt(m.hp_zero_remaining_m)} m before finish`:'No depletion recorded']];
  const skillSections=Object.entries(groups).map(([status,skills])=>{
   if(!skills.length&&status!=='activated')return '';
   const heading={activated:'Skill kit',failed_wit:'Failed wit check',failed_condition:'Failed condition',unresolved:'Not activated · reason unavailable'}[status];
   return `<section class="ra-skill-group"><div class="ra-section-title"><h3>${heading}</h3><span>${status==='activated'?skills.length+' / '+r.skills.length:skills.length}</span></div><ul class="ra-skills">${skills.map(s=>{
    const def=labels.skill_meta?.[s.id]||labels.skill_meta?.[s.outcome?.replay_skill_id],category=def?.category||'regular',failed=status!=='activated';
    const reason=status==='failed_wit'?`Roll ${fmt(s.outcome?.roll,2)}% · activation chance ${fmt(s.outcome?.activation_chance,2)}%`:status==='failed_condition'?'Activation condition was not met.':status==='unresolved'?'The export cannot establish a failure reason.':'';
    return `<li class="ra-skill-${category} ${failed?'ra-failed':'ra-triggered'} ${def?.rarity===2?'ra-gold':''}" title="${esc([def?.description,reason].filter(Boolean).join(' '))}"><div><span class="ra-skill-icon">${def?.icon_id?`<img src="assets/icons/skills/${def.icon_id}.webp" alt="${category} skill">`:'<span aria-hidden="true">◇</span>'}</span><strong>${esc(skill(s.id))}</strong>${failed?`<span class="ra-failure-x" aria-label="${esc(heading)}">×</span>`:`<small>Lv ${esc(s.level)}</small>`}</div>${!failed?`<div class="ra-skill-times">${s.occurrences.map(e=>`<button data-seek="${e.t}" title="Jump to activation">${fmt(sample(rep,e.t).rows[m.frame_index][0],0)} m · ${fmt(e.t,2)} s</button>`).join('')}</div>`:''}</li>`;
   }).join('')||'<li>No activations recorded</li>'}</ul></section>`;
  }).join('');
  let chart='',states='';
  if(rep){
   const xs=d=>48+Math.max(0,Math.min(1,d/rep.distance_m))*720,ys=(v,max)=>220-Math.max(0,Math.min(1,v/max))*180;
   const history=rep.frames.filter(f=>f.t<=r.raw_seconds).map(f=>f.r[m.frame_index]);
   history.push(sample(rep,r.raw_seconds).rows[m.frame_index]);
   const speedMax=Math.max(30,...history.map(h=>h[2]));
   const path=(column,max)=>history.map((h,i)=>`${i?'L':'M'}${xs(h[0]).toFixed(2)},${ys(h[column],max).toFixed(2)}`).join(' ');
   const bounds=[0,rep.distance_m/6,rep.distance_m*2/3,rep.distance_m];
   const ticks=bounds.map(d=>`<line x1="${xs(d)}" x2="${xs(d)}" y1="26" y2="225" class="ra-grid"/><text x="${xs(d)}" y="252" text-anchor="middle">${fmt(d,0)} m</text>`).join('');
   chart=`<svg viewBox="0 0 820 270" role="img" aria-label="HP and speed over race distance"><title>${esc(r.uma)}: recorded HP and speed</title>${ticks}${events.map(e=>`<line x1="${xs(sample(rep,e.t).rows[m.frame_index][0])}" x2="${xs(sample(rep,e.t).rows[m.frame_index][0])}" y1="26" y2="225" class="ra-event"><title>${esc(skill(e.params[1]))} · ${fmt(e.t,2)} s</title></line>`).join('')}<path d="${path(3,m.hp_start)}" class="ra-hp-line"/><path d="${path(2,speedMax)}" class="ra-speed-line"/><text x="48" y="17">HP ${m.hp_start}</text><text x="768" y="17" text-anchor="end">Speed ${fmt(speedMax,0)} m/s</text><text x="30" y="223">0</text></svg>`;
   const stateEvents=rep.events.filter(e=>e.params[0]===m.frame_index&&[4,5,6].includes(e.type));
   states=`<div class="ra-state-track"><span>Start</span><span>Finish</span>${m.last_spurt_m>=0?`<i style="left:${100*Math.min(1,m.last_spurt_m/rep.distance_m)}%" title="Last spurt at ${fmt(m.last_spurt_m)} m">Spurt</i>`:''}${stateEvents.map(e=>`<b style="left:${100*Math.min(1,sample(rep,e.t).rows[m.frame_index][0]/rep.distance_m)}%" title="${{4:'Lead contest',5:'Duel',6:'Release power'}[e.type]} · ${fmt(e.t,2)} s">•</b>`).join('')}</div>`;
  }
  const dialog=document.createElement('dialog');dialog.className='ra-dialog';dialog.setAttribute('aria-labelledby','ra-title');
  dialog.innerHTML=`<header class="ra-header">${portrait?`<img src="${esc(portrait)}" alt="">`:''}<div><h2 id="ra-title">${r.place}. ${esc(r.uma)} <span>${esc(name(r.owner))} · ${esc(teamName(r.team_id))}</span></h2><p>${esc(labels.cards[r.variant_id]||'')} · ${esc(data.race_folder)}</p></div><button class="ra-close" aria-label="Close runner analysis">×</button></header><div class="ra-layout"><aside class="ra-sidebar"><p class="ra-style">No. ${r.gate} · ${esc(styles[r.running_style_code]||'Unknown style')} · ${esc(r.mood||'')}</p><div class="ra-section-title"><h3>Stats</h3><span>Raw / Base</span></div><p class="ra-stat-scale">0–2000 <span>1200 threshold</span></p><div class="ra-stats">${statsMarkup(r.stats,r.base_stats)}</div><div class="ra-section-title"><h3>Aptitudes</h3></div><div class="ra-aptitudes"><span>${esc(data.course.surface)} <b>${esc(r.aptitudes.surface??'—')}</b></span><span>${data.course.distance_m} m <b>${esc(r.aptitudes.distance??'—')}</b></span></div>${skillSections}<details class="ra-supports"><summary>Support cards</summary><ul>${r.support.map(s=>`<li>Card ${esc(s.id)} · ${esc(s.limit_breaks)} LB</li>`).join('')}</ul></details></aside><div class="ra-report"><div class="ra-metrics">${metrics.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>${rep?`<table class="ra-phases"><thead><tr><th>Phase</th>${phase.map(p=>`<th>${p.label}</th>`).join('')}</tr></thead><tbody><tr><th>Avg. position</th>${phase.map(p=>`<td>${fmt(p.position)}</td>`).join('')}</tr><tr><th>Avg. speed</th>${phase.map(p=>`<td>${fmt(p.speed)} <small>m/s</small></td>`).join('')}</tr></tbody></table><div class="ra-section-title"><h3>Race events</h3></div>${states}<div class="ra-section-title"><h3>On the course</h3><span><b class="ra-hp-key">HP</b> / <b class="ra-speed-key">Speed</b></span></div><div class="ra-chart">${chart}</div><p class="ra-chart-caption">Vertical marks show skill activations. Select a skill timestamp to jump to that moment.</p><p data-selection class="ra-selection" role="status"></p>`:'<p>No replay data for this runner.</p>'}</div></div>`;
  const focused=document.activeElement,overflow=document.body.style.overflow;
  document.body.appendChild(dialog);document.body.style.overflow='hidden';dialog.showModal();
  dialog.querySelector('.ra-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close()}});
  dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;dialog.remove();(focused?.isConnected?focused:document.querySelector('[data-play]'))?.focus()},{once:true});
  for(const button of dialog.querySelectorAll('[data-seek]'))button.onclick=()=>{const t=Number(button.dataset.seek);seek(t);const h=sample(rep,t).rows[m.frame_index];dialog.querySelector('[data-selection]').textContent=`${fmt(t,2)} s · ${fmt(h[0])} m · ${fmt(h[2],2)} m/s · ${fmt(h[3],0)} HP`};
 }
 global.RunnerAnalysis={open,phases,statSegments,statsMarkup,skillGroups};
})(typeof window==='undefined'?globalThis:window);
