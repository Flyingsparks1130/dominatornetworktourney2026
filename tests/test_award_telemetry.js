const assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('../assets/award-telemetry.js'),data=require('../assets/award-telemetry-data.json');
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
// Hand-calculated loss: 2 m over the first second and half of 4 m next.
const rep={frames:[{t:0,r:[[0,0,20]]},{t:1,r:[[18,0,20]]},{t:2,r:[[34,0,20]]}]};
near(T.worldTransformLoss(rep,{frame_index:0},1.5),4);
assert.equal(T.worldTransformLoss(rep,{frame_index:0},3),null);
const accelerating={frames:[{t:0,r:[[0,0,10]]},{t:1,r:[[12,0,20]]}]};
near(T.worldTransformLoss(accelerating,{frame_index:0},1),0); // No false loss from acceleration.
assert.equal(T.worldTransformLoss({frames:[{t:0,r:[[0,0,20]]},{t:1,r:[[]]}]},{frame_index:0},1),null);

function duelFixture(){
 const info=i=>({frame_order:i+1,speed:1000,stamina:1000,pow:1000,guts:600,wiz:1000,running_style:2,motivation:3,skill_array:[],fan_count:100000,
  proper_distance_short:7,proper_distance_mile:7,proper_distance_middle:7,proper_distance_long:7,
  proper_running_style_nige:7,proper_running_style_senko:7,proper_running_style_sashi:7,proper_running_style_oikomi:7});
 return {course:{course_id:10101,condition:1},results:[{entry_id:'a',raw_seconds:8.5},{entry_id:'b',raw_seconds:8.5}],replay:{status:'ready',distance_m:1200,
  runners:['a','b'].map((id,i)=>({entry_id:id,frame_index:i,duel_events:1,last_spurt_m:800,analysis_data:info(i)})),
  events:[{type:5,t:2,params:[0]},{type:5,t:2,params:[1]}],
  frames:Array.from({length:11},(_,t)=>({t,r:[[t*60,0,60,1000,0,-1],[t*60+1,0,60,1000,0,-1]]}))}};
}
let r=duelFixture();near(T.estimate(r,data).a.duel_seconds.value,6.5); // Clips at fractional finish.
r.replay.events.push({type:5,t:3,params:[0]});near(T.estimate(r,data).a.duel_seconds.value,6.5); // No duplicate runner-seconds.
r=duelFixture();r.replay.frames[6].r[0][3]=49;near(T.estimate(r,data).a.duel_seconds.value,4); // Under 5% starting HP.
r=duelFixture();r.replay.frames[5].r[1][0]+=5;near(T.estimate(r,data).a.duel_seconds.value,3); // All duelers at least 5 m away.
r=duelFixture();for(const f of r.replay.frames)for(const h of f.r)h[2]=10;
near(T.estimate(r,data).a.duel_seconds.value,0); // Speed-based early expiry, with no later resumption.
r=duelFixture();delete r.replay.runners[0].analysis_data;assert.equal(T.estimate(r,data).a.duel_seconds,undefined);
r=duelFixture();for(const e of r.replay.events)e.type=4;for(const runner of r.replay.runners)runner.duel_events=0;
near(T.estimate(r,data).a.duel_seconds.value,0); // Spot Struggle is a different event.

const index=require('../data/tournament-index.json');let runners=0,duelers=0;
for(const match of index.matches)for(const file of match.races){
 const race=JSON.parse(fs.readFileSync(file.data_file)),estimates=T.estimate(race,data);
 for(const row of race.results){
  const v=estimates[row.entry_id];assert(Number.isFinite(v.lane_loss_m.value));assert(Number.isFinite(v.duel_seconds.value));
  assert(v.duel_seconds.value>=0&&v.duel_seconds.value<=row.raw_seconds);
  const runner=race.replay.runners.find(r=>r.entry_id===row.entry_id);
  if(v.duel_seconds.value>0){duelers++;assert(runner.duel_events>0)}
  runners++;
 }
}
assert(runners>=240);assert(duelers>0);
console.log(`WT integration and duel expiry tests passed; complete estimates for ${runners} recorded starts (${duelers} positive duels).`);
