#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const index=read('data/tournament-index.json'),config=read('config/awards.json'),docs={};
for(const m of index.matches)for(const f of m.races)docs[f.id]=read(f.data_file);
const catalogues={supports:read('assets/support-cards.json').cards,portraits:read('assets/uma-portraits.json'),skills:read('assets/award-skills.json').skills,skillMeta:read('assets/skill-metadata.json')};
const statistics=require('./tournament_statistics.cjs').compute(index,docs,catalogues);
// Only reference artwork actually bundled in this static site.
for(const key of ['support','skills','fielded','veto','preban'])for(const row of statistics[key])if(row.image&&!fs.existsSync(path.join(root,row.image)))row.image=null;
require('../assets/award-telemetry.js');
const standings=config.reveal?require('../assets/award-engine.js').compute(index,docs,config,catalogues.skills,read('assets/award-telemetry-data.json')):null;
if(standings)standings.generated_at=index.generated_at; // Reproducible source snapshot.
const snapshot={schema_version:1,revision:index.revision,generated_at:index.generated_at,standings,statistics};
fs.writeFileSync(path.join(root,'data/tournament-statistics.json'),JSON.stringify(snapshot)+'\n');
console.log(JSON.stringify({revision:index.revision,revealed:!!standings,coverage:statistics.coverage}));
