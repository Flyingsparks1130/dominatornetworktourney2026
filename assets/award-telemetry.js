/* Private award analysis, using Hakuraku's pinned duel and WT estimates. */
(function(global){
 'use strict';
 const finite = v => typeof v === 'number' && Number.isFinite(v);
 const revision = '88015af9f6473fa4b76463b9cf217a3c79817811';
 const source = `Hakuraku ${revision}; estimated from recorded frames, clipped at finish`;
 const H = typeof module !== 'undefined' ? require('./hakuraku-award-telemetry.js') : global.HakurakuAwardTelemetry;

 // Hakuraku's WT total depends on speed and forward distance, not track geometry.
 // Geometry is used only for the separate world/course ratio visualization.
 function worldTransformLoss(rep, runner, finish) {
  const frames = rep.frames, idx = runner.frame_index;
  if (!frames || frames.length < 2 || !finite(finish) || finish < frames[0].t || finish > frames.at(-1).t) return null;
  let loss = 0;
  for (let i=1; i<frames.length; i++) {
   const a=frames[i-1], b=frames[i], prev=a.r[idx], next=b.r[idx];
   if (a.t >= finish) break;
   if (!prev || !next || ![a.t,b.t,prev[0],next[0],prev[2],next[2]].every(finite) || b.t <= a.t) return null;
   const dt=b.t-a.t, progress=Math.max(0,next[0]-prev[0]);
   // Speeds in our decoded frames are already m/s (Hakuraku divides by 100).
   const intervalLoss=Math.max(0,Math.min(prev[2],next[2])*dt-progress);
   loss += intervalLoss * Math.min(1,(finish-a.t)/dt);
  }
  return loss;
 }

 function estimate(race, data) {
  const rep=race.replay, metrics={};
  if (rep?.status !== 'ready' || !Array.isArray(rep.frames) || !Array.isArray(rep.events)) return metrics;
  const rows=new Map(race.results.map(r=>[r.entry_id,r]));
  const starts=rep.events.filter(e=>e.type===5), validTimeline=rep.frames.length>=2;
  for (const runner of rep.runners) {
   const row=rows.get(runner.entry_id), wt=worldTransformLoss(rep,runner,row?.raw_seconds);
   metrics[runner.entry_id]={};
   if (wt!==null) metrics[runner.entry_id].lane_loss_m={value:wt,source};
   if (validTimeline && runner.duel_events===0 && !starts.some(e=>e.params[0]===runner.frame_index)) metrics[runner.entry_id].duel_seconds={value:0,source};
  }
  if (!starts.length) return metrics;
  // Do not silently run a reduced HP-only heuristic when analysis inputs are absent.
  if (!validTimeline || data?.revision!==revision || !data.courses?.[race.course?.course_id] || !H) return metrics;
  const info=rep.runners.map(r=>r.analysis_data);
  if (info.some(d=>!d || !['frame_order','speed','stamina','pow','guts','wiz','running_style','motivation',
   'proper_distance_short','proper_distance_mile','proper_distance_middle','proper_distance_long',
   'proper_running_style_nige','proper_running_style_senko','proper_running_style_sashi','proper_running_style_oikomi'].every(k=>finite(d[k])))) return metrics;
  if (rep.runners.some(r=>!finite(rows.get(r.entry_id)?.raw_seconds))) return metrics;
  const raceData={
   frame:rep.frames.map(f=>({time:f.t,horseFrame:f.r.map(r=>({distance:r[0],lanePosition:r[1]*10000,speed:r[2]*100,hp:r[3]}))})),
   event:rep.events.map(e=>({event:{type:e.type,frameTime:e.t,param:e.params,paramCount:e.params.length}})),
   horseResult:[]
  };
  for (const r of rep.runners) raceData.horseResult[r.frame_index]={finishTimeRaw:rows.get(r.entry_id).raw_seconds,lastSpurtStartDistance:r.last_spurt_m??-1};
  const activations={};
  for (const e of rep.events.filter(e=>e.type===3)) (activations[e.params[0]]??=[]).push({time:e.t,param:e.params});
  const other=H.estimateOtherEvents(raceData,info,race.course.course_id,activations,rep.distance_m,race.course.condition,data);
  for (const r of rep.runners) {
   const finish=rows.get(r.entry_id).raw_seconds;
   const intervals=(other[r.frame_index]||[]).filter(e=>e.name==='Dueling').map(e=>({start:Math.max(0,e.time),end:Math.min(finish,e.time+e.duration)})).filter(e=>e.end>e.start).sort((a,b)=>a.start-b.start);
   // A repeat notification cannot count the same runner-second twice.
   let total=0, end=-Infinity;
   for (const interval of intervals) {total+=Math.max(0,interval.end-Math.max(end,interval.start));end=Math.max(end,interval.end);}
   if (finite(total)) metrics[r.entry_id].duel_seconds={value:total,source,intervals};
  }
  return metrics;
 }
 global.AwardTelemetry={estimate,worldTransformLoss};
 if (typeof module!=='undefined') module.exports=global.AwardTelemetry;
})(typeof window!=='undefined'?window:globalThis);
