// Rebuild from the pinned Hakuraku public/data/umdb.json, without runtime APIs.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/build_award_catalog.cjs /path/to/umdb.json');
const db=JSON.parse(fs.readFileSync(input,'utf8'));
const definitions=new Map(db.skill.map(s=>[s.id,s]));
const prices=new Map(db.singleModeSkillNeedPoint.map(s=>[s.id,s.needSkillPoint]));
const metadata=JSON.parse(fs.readFileSync(path.join(root,'assets/skill-metadata.json'),'utf8'));
const skills={};
for(const id of new Set([...definitions.keys(),...prices.keys(),...Object.keys(metadata).map(Number)])){
 const d=definitions.get(id),requires=[];const rarity=d?.rarity??metadata[id]?.rarity;
 if(rarity===2){
  const last=id%10,paired=last===4?id-3:last===1?id+1:id-1;
  if(definitions.get(paired)?.rarity===1&&!/[×✕]/u.test(definitions.get(paired).name))requires.push(paired);
 }else if(rarity===1&&id%10===1&&definitions.get(id+1)?.rarity===1)requires.push(id+1);
 skills[id]={name:d?.name||null,cost:prices.get(id)??null,rarity:rarity??null,requires,negative:/[×✕]/u.test(d?.name||''),debuff:Boolean(d?.tagId?.includes('406')),activate_lot:d?.activateLot??metadata[id]?.activate_lot??null};
}
fs.writeFileSync(path.join(root,'assets/award-skills.json'),JSON.stringify({source:'ayaliz/hakuraku',revision:'88015af9f6473fa4b76463b9cf217a3c79817811',skills})+'\n');
console.log(`Wrote ${Object.keys(skills).length} skill prices and classifications.`);
