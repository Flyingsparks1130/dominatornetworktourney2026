const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const E=require('../assets/award-engine.js'),UI=require('../assets/awards.js');
const catalogue=JSON.parse(fs.readFileSync('assets/award-skills.json')).skills;
let checks=0;const check=(name,fn)=>{fn();checks++;};
const buy=(variant,ids)=>E.purchasedSkills({variant_id:variant,skills:ids.map(id=>({id}))},catalogue);
check('Native unique excluded, purchased inheritance included',()=>{
 assert.equal(buy(100602,[110061]).cost,0);
 assert.equal(buy(100701,[910061]).cost,200);
 assert.equal(buy(100701,[110061]).cost,200);
 assert.equal(buy(100701,[200461]).cost,340);
 assert.equal(buy(100701,[200461,200462]).cost,340);
 assert.equal(buy(100701,[200014]).cost,330);
 const negative=Object.entries(catalogue).find(([,s])=>s.negative);
 assert.equal(buy(100701,[Number(negative[0])]).cost,0);
 assert.equal(buy(100701,[Number(negative[0])]).skill_count,0);
 assert.equal(buy(100701,[9999999]).cost,null);
});
check('Opponent effects exclude Racing Spirit and self penalties',()=>{
 assert.equal(catalogue[210101].debuff,false);
 assert.equal(catalogue[200771].debuff,true);
});
function fixture(){
 const teams=[{id:'a',name:'Club A',seed:1},{id:'b',name:'Club B',seed:2}];
 const results=['Ada','Bea','Cy'].map((owner,i)=>({entry_id:String(i),owner,eligible:true,team_id:i===2?'b':'a',variant_id:100701,uma:'Gold Ship',stats:{speed:1000+i*10,stamina:500,power:800,guts:400,wisdom:600},skills:[{id:200771},{id:210101}],running_style_code:2,raw_seconds:3.5,scoring_place:i+1,place:i+1,points:[4,2,1][i]}));
 const runners=results.map((r,i)=>({entry_id:r.entry_id,frame_index:i,start_delay_ms:[70,66,50][i],duel_events:1,skill_outcomes:{200771:{status:i===0?'failed_wit':'failed_condition'},210101:{status:'activated'}}}));
 const state=(rush,blocked)=>[0,0,20,100,rush,blocked];
 const frames=[{t:0,r:[state(0,-1),state(0,-1),state(0,-1)]},{t:1,r:[state(1,1),state(0,-1),state(0,-1)]},{t:2,r:[state(2,2),state(0,-1),state(0,-1)]},{t:3,r:[state(0,-1),state(0,-1),state(0,-1)]},{t:4,r:[state(3,1),state(0,-1),state(0,-1)]}];
 const race={id:'race2',raw_sha256:'hash2',scoring_verified:true,raw_path:'test-source.json',race_folder:'01 - Test',results,replay:{status:'ready',skill_lottery:{verified:true},runners,frames,events:[]}};
 const match={id:'r2-m1',round:'R2',participants:teams,status:'complete',winner_id:'a',loser_id:'b',scores:{a:6,b:1},races:[{id:race.id,race_folder:race.race_folder,data_file:'test.json'}],reported_results:{races:[{number:1,podium:[]}]},lineup:[]};
 return {index:{matches:[match],teams,eliminated:['b']},docs:{race2:race},config:{performance_round_min:2,disqualifications:[]}};
}
const run=f=>E.compute(f.index,f.docs,f.config,catalogue),award=(s,id)=>s.awards.find(a=>a.id===id);
check('Race results, received blocking, Rushed, wit and debuffs',()=>{
 const s=run(fixture()),p=s.players.find(p=>p.name==='Ada'),other=s.players.find(p=>p.name==='Bea');
 assert.equal(p.points,4);assert.equal(p.base_total,3300);assert.equal(p.debuffs,1);assert.equal(p.failed_wit,1);assert.equal(other.failed_wit,0);
 assert.equal(p.blocked_incidents,2);assert.equal(p.blocked_seconds,2.5);assert.equal(other.blocked_incidents,0);
 assert.equal(p.rushed,2);assert.equal(p.rushed_seconds,2.5);assert.equal(p.late_starts,1);
 assert.equal(award(s,'neck').status,'unavailable');assert.equal(award(s,'fences').status,'unavailable');assert.equal(award(s,'wheelchair').status,'pending');assert.equal(award(s,'mvp').status,'pending');
 assert.equal(award(s,'hard-carry').winner.name,'Ada');assert.equal(award(s,'hard-carry').runners_up.length,2);
});
check('Distinct builds, exports, and rounds do not double count',()=>{
 const f=fixture(),m=f.index.matches[0],r=structuredClone(f.docs.race2);r.id='race3';r.raw_sha256='hash3';r.race_folder='02 - Test';f.docs.race3=r;m.races.push({id:r.id,race_folder:r.race_folder});
 let s=run(f);assert.equal(s.players[0].build_count,1);assert.equal(s.players[0].starts,2);
 m.races.push({id:r.id,race_folder:r.race_folder});s=run(f);assert.equal(s.players[0].starts,2);
 const r3=structuredClone(r);r3.id='race4';r3.raw_sha256='hash4';f.docs.race4=r3;f.index.matches.push({...m,id:'r3-m1',round:'R3',races:[{id:r3.id,race_folder:'01 - Test'}],reported_results:null});
 s=run(f);assert.equal(s.players[0].build_count,2);assert.equal(s.players[0].starts,3);assert.equal(award(s,'wheelchair').status,'provisional');assert.equal(award(s,'mvp').winner.name,'Ada');assert.equal(award(s,'wheelchair').winner.name,'Cy');
});
check('Flyingsparks counts activations across races, not equipped builds',()=>{
 const f=fixture(),r=f.docs.race2,m=f.index.matches[0];
 const extra=Number(Object.keys(catalogue).find(id=>catalogue[id].debuff&&Number(id)!==200771));
 r.results[1].skills.push({id:extra});
 r.replay.events=[
  {type:3,t:1,params:[0,200771]},{type:3,t:2,params:[0,200771]},
  {type:3,t:1,params:[1,200771]},
  {type:3,t:2,params:[0,210101]},
  {type:3,t:4,params:[0,200771]},{type:3,t:-1,params:[0,200771]},
  {type:5,t:1,params:[0,200771]}
 ];
 const r2=structuredClone(r);r2.id='race3';r2.raw_sha256='hash3';r2.race_folder='02 - Test';f.docs.race3=r2;m.races.push({id:r2.id,race_folder:r2.race_folder});
 const s=run(f),a=award(s,'flyingsparks'),ada=s.players.find(p=>p.name==='Ada'),bea=s.players.find(p=>p.name==='Bea');
 assert.equal(ada.build_count,1);assert.equal(ada.debuffs,1);assert.equal(bea.debuffs,2);
 assert.equal(ada.debuff_activations,4);assert.equal(bea.debuff_activations,2);
 assert.deepEqual(ada.races.map(r=>r.debuff_activations),[2,2]);
 assert.equal(a.metric,'debuff_activations');assert.equal(a.winner.name,'Ada');assert.equal(a.winner.value,4);
 const html=UI.awardCard(a,{revealed:true,standings:s});assert(html.includes('2 debuff activations'));assert(!html.includes('once per fielded build'));
});
check('Flyingsparks requires activation evidence and does not break ties by skills bought',()=>{
 const f=fixture();
 assert.equal(award(run(f),'flyingsparks').status,'tie');
 delete f.docs.race2.replay.events;
 assert.equal(award(run(f),'flyingsparks').status,'unavailable');
 f.docs.race2.replay.events=[];f.docs.race2.replay.runners.pop();
 assert.equal(award(run(f),'flyingsparks').status,'unavailable');
 delete f.docs.race2;
 f.index.matches[0].lineup=[{team_id:'a',display_name:'Ada',uma:'Gold Ship'}];
 assert.equal(award(run(f),'flyingsparks').status,'unavailable');
});
check('Only Round 1 DQs enter, other Round 1 performance is excluded',()=>{
 const f=fixture();f.index.matches.push({...f.index.matches[0],id:'r1-m1',round:'R1'});
 const dq={id:'dq1',player:'DQ player',team_id:'b',round:'R1',match_id:'r1-m1',count:1,source:'Organizer confirmation'};
 f.config.disqualifications=[dq,dq];const s=run(f);assert.equal(s.coverage.verified_races,1);assert.equal(award(s,'gate-kept').winner.value,1);assert.equal(award(s,'gate-kept').runners_up.length,0);assert.equal(s.players.find(p=>p.name==='DQ player').starts,0);
 f.config.disqualifications=[{...dq,round:'R2'}];assert.throws(()=>run(f),/Round 1/);
});
check('Missing evidence does not silently become zero',()=>{
 const f=fixture();f.docs.race2.replay.skill_lottery.verified=false;assert.equal(award(run(f),'bourbon').status,'unavailable');
 f.docs.race2.replay.skill_lottery.verified=true;f.docs.race2.replay.runners[0].skill_outcomes[200771].status='unresolved';assert.equal(award(run(f),'bourbon').status,'unavailable');
 f.docs.race2.replay.runners[0].start_delay_ms=null;assert.equal(award(run(f),'nitro').status,'unavailable');
 delete f.docs.race2;assert.equal(run(f).coverage.verified_races,0);
});
check('Verified duration/loss inputs work and need sources',()=>{
 const f=fixture();f.config.verified_metrics=f.docs.race2.results.flatMap((r,i)=>['duel_seconds','lane_loss_m'].map(metric=>({race_id:'race2',team_id:r.team_id,player:r.owner,metric,value:3-i,verified:true,source:'Frame review',})));
 let s=run(f);assert.equal(award(s,'neck').winner.name,'Ada');assert.equal(award(s,'fences').winner.value,3);
 f.config.verified_metrics[0].source='';assert.equal(award(run(f),'neck').status,'unavailable');
 f.config.verified_metrics[0].source='Frame review';f.config.verified_metrics[0].value=-1;assert.equal(award(run(f),'neck').status,'unavailable');
});
check('Exact ties stay pending until one sourced choice',()=>{
 const f=fixture();for(const r of f.docs.race2.results)r.stats.speed=1000;
 let s=run(f);assert.equal(award(s,'all-star').status,'tie');assert.equal(award(s,'all-star').winner,null);
 f.config.tie_decisions={'all-star':{player_id:'a:bea',source:'Organizer tiebreak'}};s=run(f);assert.equal(award(s,'all-star').winner.name,'Bea');assert.equal(award(s,'all-star').runners_up.length,2);
});
check('Public HTML hides all award results and private HTML escapes names',()=>{
 const f=fixture(),s=run(f),publicHTML=UI.page(f.index,f.config,s,{revealed:false});
 assert.equal((publicHTML.match(/data-open-award=/g)||[]).length,21);assert.equal((publicHTML.match(/class="award-group /g)||[]).length,3);assert(!publicHTML.includes('Bakushin'));assert(!publicHTML.includes('Ada'));assert(!publicHTML.includes('See the receipts'));assert(publicHTML.includes('Tournament statistics'));
 assert.deepEqual(E.groups.map(group=>group.name),['Tournament Honors','Build & Strategy','Race Moments']);
 assert(!publicHTML.includes('Featured Honors'));assert(publicHTML.includes('Agnes Digital Award'));assert(publicHTML.includes('Gate Kept (Falcon) Award'));
 assert(!/Round 2 onward/i.test(publicHTML));assert(!publicHTML.includes('Change PNG / GIF'));assert(!publicHTML.includes('data-art='));
 const configured=E.catalog({images:{'hard-carry':'hard.png','top-road':'ntr.png',nature:'nature.gif'}});assert.equal(configured.find(a=>a.id==='hard-carry').image,'hard.png');assert.equal(configured.find(a=>a.id==='top-road').image,'ntr.png');assert.equal(configured.find(a=>a.id==='nature').image,'nature.gif');
 award(s,'hard-carry').winner.name='<img onerror="alert(1)">';const privateHTML=UI.page(f.index,f.config,s,{revealed:true,local:true});assert(privateHTML.includes('&lt;img onerror='));assert(!privateHTML.includes('<img onerror='));assert(UI.awardCard(award(s,'hard-carry'),{revealed:true,standings:s}).includes('See the receipts'));assert(!/Round 2 onward/i.test(privateHTML));assert(!privateHTML.includes('Change PNG / GIF'));assert(!privateHTML.includes('data-art='));
});
check('Individual build awards do not reward accumulated rounds or build totals',()=>{
 const f=fixture(),r=f.docs.race2;
 r.results[0].stats={speed:1100,stamina:900,power:900,guts:700,wisdom:100};
 r.results[0].skills=[{id:200461},{id:200014}];
 for(const row of r.results.slice(1))row.skills=[{id:200014}];
 const ids=['all-star','hot-headed','fine-motion','mejiro'],initial=run(f);
 for(let i=0;i<4;i++){
  const next=structuredClone(r);next.id='extra'+i;next.raw_sha256=next.id;next.results=next.results.slice(1);
  next.results[0].stats.speed+=i;f.docs[next.id]=next;
  f.index.matches.push({...f.index.matches[0],id:'r3-m'+i,round:'R3',races:[{id:next.id,race_folder:'01 - Test'}]});
 }
 const after=run(f);
 assert(after.players.find(p=>p.name==='Bea').base_total>after.players.find(p=>p.name==='Ada').base_total);
 for(const id of ids){const a=award(after,id);assert.equal(a.winner.name,'Ada');assert.equal(a.winner.value,award(initial,id).winner.value);assert.equal(a.winner.build.uma,'Gold Ship');assert.equal(a.winner.build.match_id,'r2-m1');assert.equal(a.tiebreaks?.length||a.tie.length,0);}
 assert.equal(award(after,'mejiro').winner.value,670);
 const html=UI.awardCard(award(after,'all-star'),{revealed:true,standings:after});assert(html.includes('One individual Uma build'));assert(html.includes('Gold Ship'));
});
check('Single-build values tie without using number of rounds; missing stats and prices stay unavailable',()=>{
 const f=fixture();f.docs.race2.results[0].stats={...f.docs.race2.results[2].stats};
 const r=structuredClone(f.docs.race2);r.id='second';r.raw_sha256=r.id;r.results=r.results.slice(0,1);f.docs.second=r;
 f.index.matches.push({...f.index.matches[0],id:'r3-m1',round:'R3',races:[{id:r.id,race_folder:'01 - Test'}]});
 assert.equal(award(run(f),'all-star').status,'tie');
 delete f.docs.race2.results[1].stats.wisdom;assert.equal(award(run(f),'all-star').status,'unavailable');
 f.docs.race2.results[1].skills.push({id:9999999});assert.equal(award(run(f),'mejiro').status,'unavailable');
});
check('Zero HP counts exact finishes once per runner and never rounds positive HP down',()=>{
 const f=fixture(),r=f.docs.race2;
 for(const frame of r.replay.frames){frame.r[0][3]=0;frame.r[1][3]=.02;frame.r[2][3]=1;}
 r.replay.frames.at(-1).r[2][3]=0;
 const second=structuredClone(r);second.id='second';second.raw_sha256=second.id;second.race_folder='02 - Test';f.docs.second=second;f.index.matches[0].races.push({id:second.id,race_folder:second.race_folder});
 let s=run(f),a=award(s,'goo-goo');assert.equal(a.winner.name,'Ada');assert.equal(a.winner.value,2);assert.equal(s.players.find(p=>p.name==='Bea').zero_hp_finishes,0);assert.equal(s.players.find(p=>p.name==='Cy').zero_hp_finishes,0);assert.equal(s.players[0].build_count,1);
 assert(UI.awardCard(a,{revealed:true,standings:s}).includes('0 HP at finish · Counts'));
 delete r.replay.frames.at(-1).r[1][3];assert.equal(award(run(f),'goo-goo').status,'unavailable');
 const clean=fixture();assert.equal(award(run(clean),'goo-goo').status,'pending');
 clean.docs.race2.replay.frames[1].r[0][3]=0;assert.equal(award(run(clean),'goo-goo').status,'pending');
});
check('Public trophy details contain rules but cannot expose supplied private winners',()=>{
 const f=fixture(),s=run(f),a=award(s,'all-star');
 const html=UI.awardCard(a,{revealed:false,standings:s});assert(html.includes('How this award is decided'));assert(html.includes('To be revealed'));assert(!html.includes('Cy'));assert(!html.includes('See the receipts'));
 const page=UI.page(f.index,f.config,s,{revealed:false});assert(page.includes('<dialog'));assert(page.includes('aria-haspopup="dialog"'));assert(!page.includes('CURRENT LEADER'));
});
const index=JSON.parse(fs.readFileSync('data/tournament-index.json')),config=JSON.parse(fs.readFileSync('config/awards.json')),docs={};
for(const m of index.matches)for(const f of m.races)docs[f.id]=JSON.parse(fs.readFileSync(f.data_file));
require('../assets/award-telemetry.js');
const real=E.compute(index,docs,config,catalogue,require('../assets/award-telemetry-data.json'));
assert.deepEqual(real.awards.map(a=>a.id),['mvp','wheelchair','hard-carry','top-road','nature','gate-kept','all-star','performance-anxiety','hot-headed','fine-motion','mejiro','festa','flyingsparks','nitro','double-jet','bourbon','blocked-count','blocked-time','neck','fences','goo-goo']);
assert.equal(award(real,'neck').status,'provisional');assert.equal(award(real,'fences').status,'provisional');
check('Every current export is included, and official points agree',()=>{
 assert.deepEqual(real.issues,[]);
 const races=index.matches.filter(m=>Number(m.round.slice(1))>=2).flatMap(m=>m.races);
 assert.equal(real.coverage.verified_races,races.length);
 assert.equal(real.players.reduce((n,p)=>n+p.points,0),races.reduce((n,f)=>n+Object.values(docs[f.id].team_points).reduce((n,v)=>n+v,0),0));
 assert(real.coverage.played_builds>=40);assert(real.coverage.verified_races>=24);
 assert(real.players.filter(p=>p.starts).every(p=>p.coverage.wit===p.starts&&p.coverage.sp===p.build_count));
 assert(real.awards.filter(a=>a.winner).every(a=>a.runners_up.length<=2));
 assert.equal(award(real,'gate-kept').winner.name,'CallMeNeko');
});
(async()=>{
 const dialog={querySelector:()=>({})},root={innerHTML:'',querySelector:()=>dialog,querySelectorAll:()=>[]},requests=[],ctx={console,URLSearchParams,location:{search:'?reveal=true&private=true'},document:{getElementById:()=>root},fetch:async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('index')?index:{...config,reveal:true}};}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/award-engine.js','utf8'),ctx);vm.runInContext(fs.readFileSync('assets/awards.js','utf8'),ctx);
 ctx.AwardEngine.compute=()=>{throw Error('Public page attempted to calculate winners');};await ctx.AwardUI.publicMount();
 assert.deepEqual(requests.sort(),['config/awards.json','data/tournament-index.json']);assert(root.innerHTML.includes('Their winners are still under wraps'));assert.equal((root.innerHTML.match(/data-open-award=/g)||[]).length,21);assert(!root.innerHTML.includes('CURRENT LEADER'));assert(!root.innerHTML.includes('could not load'));checks++;
 console.log(`${checks} award scenarios passed; ${real.coverage.verified_races} real races reconciled. Public winner data remains absent.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
