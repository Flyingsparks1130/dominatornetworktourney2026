/* Runner detail dialog. Charts and phase summaries use recorded simulation samples. */
(function(global){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):'—';
 const name=x=>String(x||'').replace(/^@+/,'');
 const styles={1:'Front runner',2:'Pace chaser',3:'Late surger',4:'End closer'};
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
  const activated=new Set(events.map(e=>e.params[1]));
  const skill=id=>labels.skills[id]||`Skill ${id}`;
  const portrait=labels.portraits[r.variant_id];
  const stats=Object.entries(r.stats),phase=rep?phases(data,r):[];
  const metrics=[['Time',r.raw_display],['Behind winner',r.place===1?'Winner':`+${fmt(r.raw_seconds-data.results[0].raw_seconds,3)} s`],
   ['Start delay',m?`${fmt(m.start_delay_ms)} ms · ${global.RaceReplay.startStatus(m.start_delay_ms)||'—'}`:'—'],['Peak speed',m?`${fmt(m.peak_speed_mps,2)} m/s`:'—'],
   ['Last spurt',m?.last_spurt_m!=null?`${fmt(m.last_spurt_m)} m`:'—'],['Spurt delay',m?`${fmt(m.spurt_delay_m)} m`:'—'],
   ['Duel triggers',m?.duel_events??'—'],['Finish HP',m?`${fmt(m.hp_finish,0)} · ${fmt(100*m.hp_finish/m.hp_start)}%`:'—'],
   ['Scaled time',r.scaled_display||'—'],['Points',r.points],['Skill activations',m?.skill_activations??'—'],
   ['HP depleted',m?.hp_zero_remaining_m!=null?`${fmt(m.hp_zero_remaining_m)} m before finish`:'No depletion recorded']];
  const skillList=r.skills.map(s=>{
   const occurrences=events.filter(e=>e.params[1]===s.id);
   return `<li class="${activated.has(s.id)?'ra-triggered':''}"><div><span class="ra-skill-mark" aria-hidden="true">${activated.has(s.id)?'◆':'◇'}</span><strong>${esc(skill(s.id))}</strong><small>Lv ${esc(s.level)}</small></div>${occurrences.length?`<div class="ra-skill-times">${occurrences.map(e=>`<button data-seek="${e.t}" title="Jump to activation">${fmt(sample(rep,e.t).rows[m.frame_index][0],0)} m · ${fmt(e.t,2)} s</button>`).join('')}</div>`:'<small>No activation recorded</small>'}</li>`;
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
  dialog.innerHTML=`<header class="ra-header">${portrait?`<img src="${esc(portrait)}" alt="">`:''}<div><h2 id="ra-title">${r.place}. ${esc(r.uma)} <span>${esc(name(r.owner))} · ${esc(teamName(r.team_id))}</span></h2><p>${esc(labels.cards[r.variant_id]||'')} · ${esc(data.race_folder)}</p></div><button class="ra-close" aria-label="Close runner analysis">×</button></header><div class="ra-layout"><aside class="ra-sidebar"><p class="ra-style">No. ${r.gate} · ${esc(styles[r.running_style_code]||'Unknown style')} · ${esc(r.mood||'')}</p><div class="ra-section-title"><h3>Stats</h3><span>Raw / Base</span></div><div class="ra-stats">${stats.map(([key,value])=>`<div><span>${esc(key)}</span><div class="ra-stat-bar"><i style="width:${Math.min(100,Math.max(0,(value||0)/2000*100))}%"></i></div><strong>${esc(value??'—')}</strong><small>${fmt(r.base_stats?.[key],0)}</small></div>`).join('')}</div><div class="ra-section-title"><h3>Aptitudes</h3></div><div class="ra-aptitudes"><span>${esc(data.course.surface)} <b>${esc(r.aptitudes.surface??'—')}</b></span><span>${data.course.distance_m} m <b>${esc(r.aptitudes.distance??'—')}</b></span></div><div class="ra-section-title"><h3>Skill kit</h3><span>${r.skills.filter(s=>activated.has(s.id)).length} / ${r.skills.length} triggered</span></div><ul class="ra-skills">${skillList||'<li>No skills recorded</li>'}</ul><details class="ra-supports"><summary>Support cards</summary><ul>${r.support.map(s=>`<li>Card ${esc(s.id)} · ${esc(s.limit_breaks)} LB</li>`).join('')}</ul></details></aside><div class="ra-report"><div class="ra-metrics">${metrics.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>${rep?`<table class="ra-phases"><thead><tr><th>Phase</th>${phase.map(p=>`<th>${p.label}</th>`).join('')}</tr></thead><tbody><tr><th>Avg. position</th>${phase.map(p=>`<td>${fmt(p.position)}</td>`).join('')}</tr><tr><th>Avg. speed</th>${phase.map(p=>`<td>${fmt(p.speed)} <small>m/s</small></td>`).join('')}</tr></tbody></table><div class="ra-section-title"><h3>Race events</h3></div>${states}<div class="ra-section-title"><h3>On the course</h3><span><b class="ra-hp-key">HP</b> / <b class="ra-speed-key">Speed</b></span></div><div class="ra-chart">${chart}</div><p class="ra-chart-caption">Vertical marks show skill activations. Select a skill timestamp to jump to that moment.</p><p data-selection class="ra-selection" role="status"></p>`:'<p>No replay data for this runner.</p>'}</div></div>`;
  const focused=document.activeElement,overflow=document.body.style.overflow;
  document.body.appendChild(dialog);document.body.style.overflow='hidden';dialog.showModal();
  dialog.querySelector('.ra-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close()}});
  dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;dialog.remove();(focused?.isConnected?focused:document.querySelector('[data-play]'))?.focus()},{once:true});
  for(const button of dialog.querySelectorAll('[data-seek]'))button.onclick=()=>{const t=Number(button.dataset.seek);seek(t);const h=sample(rep,t).rows[m.frame_index];dialog.querySelector('[data-selection]').textContent=`${fmt(t,2)} s · ${fmt(h[0])} m · ${fmt(h[2],2)} m/s · ${fmt(h[3],0)} HP`};
 }
 global.RunnerAnalysis={open,phases};
})(typeof window==='undefined'?globalThis:window);
