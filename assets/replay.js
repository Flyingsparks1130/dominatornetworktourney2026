/* Shared playback for every race export. */
(function(global){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n):'—';
 const clean=x=>String(x||'').replace(/^@+/,'');
 const styles={1:'Front',2:'Pace',3:'Late',4:'End'};
 const colors=['#f48194','#70c5ff','#c4a2ff','#f4ca6a','#64d9ba','#f89862','#b5d877','#8fa9ff','#e6a7d5','#b6ccd6'];
 let labelsPromise;
 function sample(replay,time){
  const frames=replay.frames,t=Math.max(frames[0].t,Math.min(time,frames.at(-1).t));
  let lo=0,hi=frames.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].t<=t)lo=mid;else hi=mid-1}
  const a=frames[lo],b=frames[lo+1]||a,w=b.t>a.t?(t-a.t)/(b.t-a.t):0;
  return {time:t,index:lo,rows:a.r.map((r,i)=>r.map((v,k)=>k<4?v+(b.r[i][k]-v)*w:(w>=.5?b.r[i][k]:v)))};
 }
 function orderRows(data,s){
  return data.results.map(r=>{const frame=data.replay.runners.find(x=>x.entry_id===r.entry_id);return {...r,frame,state:s.rows[frame.frame_index],finished:s.time>=r.raw_seconds}})
   .sort((a,b)=>a.finished&&b.finished?a.place-b.place:a.finished?-1:b.finished?1:b.state[0]-a.state[0]||a.gate-b.gate);
 }
 function recentSkills(replay,time){return replay.events.filter(e=>e.type===3&&e.params.length>1&&e.t<=time&&time-e.t<2)}
 function placeBubbles(items,obstacles=[]){
  const occupied=obstacles.slice(),placed=[];
  const overlap=(a,b)=>a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y;
  for(const item of items){
   const w=Math.min(292,Math.max(136,...item.lines.map(t=>Array.from(t).length*7.1+22))),h=item.lines.length*21+14;
   let best;
   for(const dx of [28,-w-28,180,-w-180,340,-w-340]){
    for(const dy of [0,-40,40,-80,80,-120,120,-160,160,-200,200,-240,240,-280,280]){
     const box={x:Math.max(55,Math.min(1065-w,item.ax+dx)),y:Math.max(32,Math.min(372-h,item.ay-h/2+dy)),w,h};
     const hits=occupied.filter(other=>overlap(box,other)).length;
     if(!best||hits<best.hits)best={...box,hits};
     if(!hits)break;
    }
    if(!best.hits)break;
   }
   occupied.push(best);placed.push({...item,...best});
  }
  return placed;
 }
 async function mount(host,data,teamName){
  let destroyed=false,raf=0,playing=false,last=0,time=0,speed=1,view='pack',selected='',showSkills=true;
  const cleanup=()=>{destroyed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);document.querySelector('.ra-dialog')?.close()};
  cleanup.pause=()=>{pause();document.querySelector('.ra-dialog')?.close()};
  function visibility(){if(document.hidden)pause()}
  function pause(){playing=false;cancelAnimationFrame(raf);const button=host.querySelector('[data-play]');if(button)button.textContent='Play'}
  labelsPromise??=fetch('assets/race-labels.json').then(r=>{if(!r.ok)throw Error('labels');return r.json()}).catch(()=>({skills:{},cards:{},portraits:{}}));
  const labels=await labelsPromise;
  if(!host.isConnected)return cleanup;
  const replay=data.replay?.status==='ready'?data.replay:null,info=new Map((replay?.runners||[]).map(r=>[r.entry_id,r]));
  const skill=id=>labels.skills[id]||`Skill ${id}`;
  const portrait=r=>labels.portraits[r.variant_id]?`<img class="rp-portrait" src="${esc(labels.portraits[r.variant_id])}" alt="" loading="lazy">`:`<span class="rp-number">${esc(r.gate)}</span>`;
  const runner=r=>`<button class="rp-runner" data-inspect="${esc(r.entry_id)}" aria-label="Analyze ${esc(r.uma)} — ${esc(clean(r.owner))}">${portrait(r)}<span><strong>${esc(r.uma)}</strong><span>${esc(clean(r.owner))} · ${esc(r.team_id?teamName(r.team_id):'Unassigned')}${r.eligible===false?' · Non-scoring':''}</span></span></button>`;
  const td=(label,value)=>`<td data-label="${label}">${value}</td>`;
  const resultRows=data.results.map(r=>{
   const m=info.get(r.entry_id);
   return `<tr>${td('Finish',`<b class="rp-place">${r.place}</b>`)}${td('No.',r.gate)}${td('Character / trainer',runner(r))}${td('Time',`<strong>${esc(r.raw_display)}</strong>`)}${td('Style',`${esc(styles[r.running_style_code]||'—')}<small>${esc(r.mood==='Max'?'Great':r.mood||'')}</small>`)}${td('Start delay',m?`${fmt(m.start_delay_ms)} ms`:'—')}${td('Spurt delay',m?`${fmt(m.spurt_delay_m)} m`:'—')}${td('Finish HP',m?`<strong class="${m.hp_finish>0?'rp-good':'rp-low'}">${fmt(m.hp_finish,0)}</strong><small>${fmt(100*m.hp_finish/m.hp_start)}%</small>`:'—')}${td('Peak speed',m?`${fmt(m.peak_speed_mps,2)} m/s`:'—')}${td('Points',`${r.points}${data.scoring_verified?'':'*'}`)}</tr>`;
  }).join('');
  host.innerHTML=`<section class="rp-summary"><div class="dt-caption"><h2>Race results</h2><span class="dt-small">Select a runner for details</span></div><table class="rp-table rp-results-table"><colgroup>${[4,4,24,10,10,8,10,12,12,6].map(w=>`<col style="width:${w}%">`).join('')}</colgroup><thead><tr>${['Finish','No.','Character / trainer','Time','Style','Start delay','Spurt delay','Finish HP','Peak speed','Points'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${resultRows}</tbody></table></section>${replay?`
   <section class="rp-playback"><div class="dt-caption"><h2>Race replay</h2></div>
    <div class="rp-controls"><button class="dt-button primary" data-play>Play</button><button class="dt-button" data-back aria-label="Previous recorded frame">‹ Frame</button><button class="dt-button" data-next aria-label="Next recorded frame">Frame ›</button>
     <label>Speed <select data-speed><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
     <label>View <select data-view><option value="pack">Follow pack</option><option value="full">Full course</option></select></label>
     <label>Highlight <select data-runner><option value="">All runners</option>${data.results.map(r=>`<option value="${esc(r.entry_id)}">#${r.gate} ${esc(r.uma)} · ${esc(clean(r.owner))}</option>`).join('')}</select></label>
     <label class="rp-check"><input type="checkbox" data-skills checked> Skill popups</label>
    </div>
    <div class="rp-course"><div data-progress></div><span>Start</span><span>${replay.distance_m} m · finish</span></div>
    <div class="rp-track"><svg data-track viewBox="0 0 1120 420" role="img" aria-label="Race positions"><title>Race replay</title><defs>${data.results.map(r=>`<clipPath id="rp-clip-${r.gate}"><circle cx="0" cy="0" r="18"/></clipPath>`).join('')}</defs><rect x="52" y="30" width="1020" height="345" rx="6" fill="#17171e"/><g data-grid></g><g data-markers>${data.results.map(r=>`<g data-marker="${esc(r.entry_id)}" tabindex="0" role="button" aria-label="Highlight ${esc(r.uma)} ${esc(clean(r.owner))}"><title>${esc(r.uma)} · ${esc(clean(r.owner))}</title><circle r="21" fill="#24212b" stroke="${colors[(r.gate-1)%colors.length]}" stroke-width="3"/>${labels.portraits[r.variant_id]?`<image href="${esc(labels.portraits[r.variant_id])}" x="-18" y="-18" width="36" height="36" clip-path="url(#rp-clip-${r.gate})"/>`:''}<text y="34" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">#${r.gate}</text></g>`).join('')}</g><g data-popups></g><text x="4" y="30" fill="#b9b6c1" font-size="13">Outer</text><text x="4" y="375" fill="#b9b6c1" font-size="13">Inner</text></svg></div>
    <div class="rp-scrubber"><input data-time type="range" min="0" max="${replay.duration_s}" step="0.001" value="0" aria-label="Race playback time"><output data-clock></output></div><p class="rp-frame" data-frame></p>
   </section>
   <section class="rp-live"><div class="dt-caption"><h2>Live positioning</h2><span class="dt-small" data-live-time></span></div><table class="rp-table"><thead><tr>${['Position','Runner','Distance','Gap','Speed','HP','Lane','Blocked by','Recent skill'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody data-live></tbody></table></section>
  `:`<section class="dt-empty"><h2>Replay unavailable</h2><p>This file has no supported replay data.</p></section>`}`;
  if(data.review_reasons?.length)host.insertAdjacentHTML('afterbegin','<div class="dt-notice">Club assignments need review. Points are provisional.</div>');
  function seek(value){if(!replay)return;pause();time=Math.max(0,Math.min(replay.duration_s,value));render()}
  host.addEventListener('click',e=>{const button=e.target.closest('[data-inspect]');if(!button)return;pause();const r=data.results.find(r=>r.entry_id===button.dataset.inspect);if(r)RunnerAnalysis.open({data,runner:r,labels,teamName,sample,seek})});
  if(!replay)return cleanup;
  const q=s=>host.querySelector(s),byIndex=new Map(replay.runners.map(m=>[m.frame_index,data.results.find(r=>r.entry_id===m.entry_id)]));
  const laneMax=replay.frames.reduce((max,f)=>f.r.reduce((m,h)=>Math.max(m,h[1]),max),.6)+.08;
  const markers=[...host.querySelectorAll('[data-marker]')];
  function render(){
   if(destroyed)return;
   const s=sample(replay,time),ordered=orderRows(data,s),leader=Math.min(replay.distance_m,Math.max(...s.rows.map(h=>h[0])));
   const span=view==='full'?replay.distance_m:Math.max(100,Math.min(300,leader-Math.min(...s.rows.map(h=>h[0]))+30));
   const start=view==='full'?0:Math.max(0,Math.min(replay.distance_m-span,leader-span+20));
   const x=d=>52+Math.max(0,Math.min(1,(Math.min(d,replay.distance_m)-start)/span))*1020,y=h=>354-h[1]/laneMax*294;
   q('[data-grid]').innerHTML=Array.from({length:6},(_,i)=>{const xx=52+i*204;return `<line x1="${xx}" x2="${xx}" y1="30" y2="375" stroke="#34313e"/><text x="${xx}" y="410" text-anchor="middle" fill="#bbb8c3" font-size="14">${Math.round(start+span*i/5)} m</text>`}).join('')+(start+span>=replay.distance_m?`<line x1="${x(replay.distance_m)}" x2="${x(replay.distance_m)}" y1="30" y2="375" stroke="#f48194" stroke-width="3"/>`:'');
   for(const marker of markers){const m=info.get(marker.dataset.marker),h=s.rows[m.frame_index];marker.setAttribute('transform',`translate(${x(h[0])} ${y(h)})`);marker.style.opacity=selected&&selected!==m.entry_id?'.28':'1';marker.querySelector('circle').setAttribute('stroke-width',selected===m.entry_id?'5':'3')}
   const recent=recentSkills(replay,time),skillsFor=i=>recent.filter(e=>e.params[0]===i).map(e=>skill(e.params[1]));
   const bubbles=showSkills?replay.runners.filter(m=>!selected||selected===m.entry_id).map(m=>{
    const all=skillsFor(m.frame_index),h=s.rows[m.frame_index];return {ax:x(h[0]),ay:y(h),lines:all.slice(0,3).concat(all.length>3?[`+${all.length-3} skills`]:[])};
   }).filter(b=>b.lines.length):[];
   const obstacles=s.rows.map(h=>({x:x(h[0])-23,y:y(h)-23,w:46,h:58}));
   q('[data-popups]').innerHTML=placeBubbles(bubbles,obstacles).map(b=>`<g class="rp-skill-popup"><line x1="${b.ax}" y1="${b.ay}" x2="${b.x+b.w/2}" y2="${b.y+b.h/2}"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5"/>${b.lines.map((line,i)=>`<text x="${b.x+11}" y="${b.y+22+i*21}">${esc(Array.from(line).length>38?Array.from(line).slice(0,37).join('')+'…':line)}</text>`).join('')}</g>`).join('');
   q('[data-live]').innerHTML=ordered.map((r,i)=>`<tr class="${selected===r.entry_id?'rp-selected':''}">${td('Position',`<b class="rp-place">${time===0?'—':i+1}</b>${r.finished?'<small>Finished</small>':''}`)}${td('Runner',runner(r))}${td('Distance',`${fmt(Math.min(r.state[0],replay.distance_m))} m`)}${td('Gap',`${fmt(Math.max(0,leader-Math.min(r.state[0],replay.distance_m)))} m`)}${td('Speed',`${fmt(r.state[2],2)} m/s`)}${td('HP',`${fmt(r.state[3],0)}<small>${fmt(100*r.state[3]/r.frame.hp_start)}%</small>`)}${td('Lane',`${fmt(r.state[1]*100)}%`)}${td('Blocked by',r.state[5]>=0?'#'+esc(byIndex.get(r.state[5])?.gate??'?'):'—')}${td('Recent skill',esc(skillsFor(r.frame.frame_index).join(', ')||'—'))}</tr>`).join('');
   q('[data-progress]').style.width=100*leader/replay.distance_m+'%';q('[data-time]').value=time;
   q('[data-clock]').textContent=`${fmt(time,2)} / ${fmt(replay.duration_s,2)} s`;
   q('[data-frame]').textContent=`Frame ${s.index+1} / ${replay.frame_count}`;q('[data-live-time]').textContent=fmt(time,2)+' s';
  }
  function tick(now){if(!playing||destroyed)return;time=Math.min(replay.duration_s,time+(now-last)/1000*speed);last=now;render();if(time>=replay.duration_s)pause();else raf=requestAnimationFrame(tick)}
  q('[data-play]').onclick=()=>{if(playing){pause();return}if(time>=replay.duration_s)time=0;playing=true;last=performance.now();q('[data-play]').textContent='Pause';raf=requestAnimationFrame(tick)};
  q('[data-time]').oninput=e=>seek(Number(e.target.value));
  q('[data-back]').onclick=()=>{const i=sample(replay,time).index;seek(replay.frames[Math.max(0,i-(Math.abs(time-replay.frames[i].t)<1e-6?1:0))].t)};
  q('[data-next]').onclick=()=>seek(replay.frames[Math.min(replay.frame_count-1,sample(replay,time).index+1)].t);
  q('[data-speed]').onchange=e=>{speed=Number(e.target.value)};q('[data-view]').onchange=e=>{view=e.target.value;render()};
  q('[data-runner]').onchange=e=>{selected=e.target.value;render()};q('[data-skills]').onchange=e=>{showSkills=e.target.checked;render()};
  for(const marker of markers){const select=()=>{selected=selected===marker.dataset.marker?'':marker.dataset.marker;q('[data-runner]').value=selected;render()};marker.onclick=select;marker.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}}}
  document.addEventListener('visibilitychange',visibility);render();return cleanup;
 }
 global.RaceReplay={mount,sample,orderRows,recentSkills,placeBubbles};
})(typeof window==='undefined'?globalThis:window);
