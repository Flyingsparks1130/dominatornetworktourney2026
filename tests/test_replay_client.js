// Pure playback checks use real generated race documents; no DOM or browser needed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/replay.js','utf8'),context);
const {sample,orderRows}=context.RaceReplay;
for(const [ms,status] of [[0,'Normal'],[65.999,'Normal'],[66,'Late'],[66.001,'Late'],[120,'Late'],[null,null],[NaN,null]]){
 assert.equal(context.RaceReplay.startStatus(ms),status);
}
vm.runInContext(fs.readFileSync('assets/runner-analysis.js','utf8'),context);
for(const [value,color,pearl,capped] of [[null,0,0,false],[-1,0,0,false],[800,40,0,false],[1199,59.95,0,false],[1200,60,0,true],[1500,60,15,true],[2500,60,40,true]]){
 const s=context.RunnerAnalysis.statSegments(value);
 assert.equal(s.color,color);assert.equal(s.pearl,pearl);assert.equal(s.capped,capped);
}
// A small layout model verifies the actual row controller, including a new
// overtake that interrupts an existing animation before it reaches its rank.
{
 const children=[],calls=[],nodes=new Map();let reduce=false;
 const container={appendChild(node){const i=children.indexOf(node);if(i>=0)children.splice(i,1);children.push(node)}};
 for(const id of ['a','b','c']){
  const node={id,style:{},offset:0,getBoundingClientRect(){return {top:children.indexOf(this)*100+this.offset}},animate(frames,options){
   const animation={cancel:()=>{node.offset=0;animation.cancelled=true},onfinish:null};
   node.offset=Number(frames[0].transform.match(/\(([-.\d]+)px/)[1]);calls.push({id,frames,options,animation});return animation;
  }};nodes.set(id,node);
 }
 const list=context.RaceReplay.positionList(container,nodes,()=>reduce);
 list.update(['a','b','c']);assert.equal(calls.length,0);
 list.update(['b','a','c']);assert.equal(calls.length,2);
 assert.equal(nodes.get('b').style.zIndex,'3');assert.equal(nodes.get('a').style.zIndex,'1');
 assert.equal(calls[0].frames[0].transform,'translateY(100px)');
 list.update(['b','a','c']);assert.equal(calls.length,2,'Stable rankings must not restart motion');
 nodes.get('b').offset=40;nodes.get('a').offset=-40;
 list.update(['c','a','b']);assert(calls[0].animation.cancelled);
 assert.equal(calls.findLast(c=>c.id==='b').frames[0].transform,'translateY(-160px)','Retarget from current visual position');
 assert.equal(nodes.get('c').style.zIndex,'3');assert.equal(children.length,3);
 reduce=true;list.update(['a','b','c']);assert.equal(calls.length,5);assert([...nodes.values()].every(n=>n.style.zIndex===''));
 reduce=false;list.update(['c','b','a']);list.update(['c','b','a'],false);
 assert([...nodes.values()].every(n=>n.style.zIndex===''),'Seeking snaps and cancels unfinished motion');
 list.cancel();
}
let races=0;
const portraitLabels=JSON.parse(fs.readFileSync('assets/race-labels.json')).portraits;
for(const file of fs.readdirSync('data/tournament-races')){
 const data=JSON.parse(fs.readFileSync(path.join('data/tournament-races',file)));
 for(const runner of data.results){
  const portrait=portraitLabels[runner.variant_id];
  assert(portrait&&fs.existsSync(portrait),`Missing results portrait for ${runner.uma} (${runner.variant_id})`);
 }
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
  const meta=rep.runners.find(r=>r.entry_id===runner.entry_id);
  const groups=context.RunnerAnalysis.skillGroups(runner,rep,meta);
  assert.equal(Object.values(groups).flat().length,runner.skills.length);
  assert.equal(new Set(Object.values(groups).flat().map(s=>s.id)).size,runner.skills.length);
  for(const skill of groups.activated)assert(skill.occurrences.length>0);
  for(const skill of groups.failed_wit)assert(skill.outcome.roll>=skill.outcome.activation_chance);
  const phases=context.RunnerAnalysis.phases(data,runner);
  assert.equal(phases.length,4);
  for(const p of phases){
   // Weighted averages can exceed an endpoint by floating-point roundoff.
   if(p.position!==null)assert(p.position>=1-1e-9&&p.position<=10+1e-9);
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
