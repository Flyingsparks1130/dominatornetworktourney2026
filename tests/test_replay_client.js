// Pure playback checks use real generated race documents; no DOM or browser needed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/replay.js','utf8'),context);
const {sample,orderRows}=context.RaceReplay;
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
 races++;
}
assert(races>0,'No real replay data was tested');
console.log(`Playback: exact frames, interpolation, boundaries, identities and final order passed for ${races} races.`);
