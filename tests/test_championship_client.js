const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/tournament.js','utf8').replace(/boot\(\);?\s*$/,'');
const real=JSON.parse(fs.readFileSync('data/tournament-index.json','utf8'));
const root={innerHTML:''};
const context={console,URLSearchParams,document:{querySelector:()=>root,querySelectorAll:()=>[]},fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('config/timeline.json','utf8'))})};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('assets/competition.js','utf8'),context);vm.runInContext(source,context);
async function render(data){context.seed=data;vm.runInContext('index=seed',context);await vm.runInContext('home()',context);return root.innerHTML;}
(async()=>{
 const pending=structuredClone(real);pending.champion_id=null;pending.matches.find(m=>m.round==='R4').winner_id=null;
 const before=await render(pending);assert(before.includes('The race for'));assert(!before.includes('2026 champions.'));assert.equal(vm.runInContext('championshipBanner()',context),'');
 const after=await render(real);assert(after.includes('Dominance.<br><em>2026 champions.'));assert(after.includes('25–17'));assert(after.includes('Match MVP: Essential'));assert(!after.includes('TBD'));assert.equal((after.match(/class="dn-round-complete"/g)||[]).length,4);assert(after.includes('archive.html?round=R4&amp;')===false);assert(after.includes('archive.html?round=R4&match=r4-m1'));
 vm.runInContext('overview()',context);assert(root.innerHTML.includes('Dominance are the champions.'));assert(root.innerHTML.includes('25–17'));assert(root.innerHTML.includes('Match MVP: Essential'));assert(!root.innerHTML.includes('NOW OPEN'));
 console.log('Championship homepage and bracket checks passed; an unconfirmed score cannot announce a champion.');
})().catch(e=>{console.error(e);process.exitCode=1});
