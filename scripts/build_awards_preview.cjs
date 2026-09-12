#!/usr/bin/env node
// A private, portable review copy. Its output must never enter the public tree.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),E=require('../assets/award-engine.js');
const output=path.resolve(process.argv[2]||path.join(root,'..','dominator-awards-preview.html'));
if(output===root||output.startsWith(root+path.sep))throw Error('Save the private preview outside the repository and public build directory.');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const index=json('data/tournament-index.json'),config=json('config/awards.json'),skills=json('assets/award-skills.json').skills,docs={},assets={};
for(const match of index.matches.filter(m=>Number(m.round.slice(1))>=config.performance_round_min))for(const file of match.races)docs[file.id]=json(file.data_file);
const standings=E.compute(index,docs,config,skills);
for(const name of fs.readdirSync(path.join(root,'assets/awards'))){const p='assets/awards/'+name;assets[p]='data:image/'+(name.endsWith('.gif')?'gif':'png')+';base64,'+fs.readFileSync(path.join(root,p)).toString('base64');}
const seed=JSON.stringify({index,config,standings,skills,assets}).replaceAll('<','\\u003c');
const styles=['site','ui','competition','awards'].map(n=>read('assets/'+n+'.css')).join('\n');
const scripts=['site','award-engine','awards'].map(n=>read('assets/'+n+'.js')).join('\n');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><base href="https://flyingsparks1130.github.io/dominatornetworktourney2026/"><title>PRIVATE · Dominator Awards Preview</title><style>${styles}</style></head><body><main class="page awards-page" id="awards-root"></main><script>${scripts}</script><script type="application/json" id="private-snapshot">${seed}</script><script>siteHeader('stats');AwardUI.previewMount(JSON.parse(document.getElementById('private-snapshot').textContent));siteFooter();</script></body></html>`;
fs.writeFileSync(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),coverage:standings.coverage,statuses:standings.awards.map(a=>({id:a.id,status:a.status})),issues:standings.issues},null,2));
