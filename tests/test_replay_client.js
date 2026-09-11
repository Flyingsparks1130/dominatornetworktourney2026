// Pure playback checks use real generated race documents; no DOM or browser needed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/replay.js','utf8'),context);
const {sample,orderRows}=context.RaceReplay;
vm.runInContext(fs.readFileSync('assets/runner-analysis.js','utf8'),context);
let races=0;
for(const file of fs.readdirSync('data/tournament-races')){
 const data=JSON.parse(fs.readFileSync(path.join('data/tournament-races',file)));
 if(data.replay?.status!=='ready')continue;
 const rep=data.replay;
 const start=sample(rep,-20);assert.equal(start.index,0);assert.equal(start.time,0);
 for(let i=0;i<rep.frames.length;i++){
  const frame=sample(rep,rep.frames[i].t);
  assert.equal(frame.index,i);
  assert.equal(JSON.stringify(frame.rows),JSON.stringify(rep.frames[i].r));
 }
 const a=rep.frames[30],b=rep.frames[31],mid=sample(rep,(a.t+b.t)/2);
 for(let i=0;i<10;i++)assert(Math.abs(mid.rows[i][0]-(a.r[i][0]+b.r[i][0])/2)<1e-7);
 const end=sample(rep,rep.duration_s+30);assert.equal(end.time,rep.duration_s);
 assert.equal(JSON.stringify(orderRows(data,end).map(r=>r.place)),JSON.stringify([1,2,3,4,5,6,7,8,9,10]));
 assert.equal(new Set(orderRows(data,mid).map(r=>r.entry_id)).size,10);
 for(const runner of data.results){
  const phases=context.RunnerAnalysis.phases(data,runner);
  assert.equal(phases.length,4);
  for(const p of phases){
   if(p.position!==null)assert(p.position>=1&&p.position<=10);
   if(p.speed!==null)assert(p.speed>0&&p.speed<40);
  }
 }
 const event=rep.events.find(e=>e.type===3&&e.t>3);
 assert(context.RaceReplay.recentSkills(rep,event.t).some(e=>e===event));
 assert(!context.RaceReplay.recentSkills(rep,event.t+2.01).some(e=>e===event));
 races++;
}
const bubbles=context.RaceReplay.placeBubbles(Array.from({length:10},(_,i)=>({ax:500,ay:180,lines:['Groundwork '+i]})));
for(let i=0;i<bubbles.length;i++){
 const a=bubbles[i];assert(a.x>=55&&a.x+a.w<=1065&&a.y>=32&&a.y+a.h<=372);
 for(const b of bubbles.slice(i+1))assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'Overlapping skill labels');
}
assert(races>0,'No real replay data was tested');
console.log(`Playback, phase summaries, skill popup timing and layout passed for ${races} races.`);
