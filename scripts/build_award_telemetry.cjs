// Rebuild the standalone Hakuraku estimator with Node 24; no npm dependencies.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const {stripTypeScriptTypes} = require('node:module');
const {execFileSync} = require('node:child_process');
const source = process.argv[2], root = path.resolve(__dirname, '..');
const revision = '88015af9f6473fa4b76463b9cf217a3c79817811';
if (!source) throw Error('Usage: node scripts/build_award_telemetry.cjs /path/to/hakuraku');
if (execFileSync('git', ['rev-parse', 'HEAD'], {cwd: source, encoding: 'utf8'}).trim() !== revision) throw Error('Use the pinned Hakuraku revision.');
const files = [
 'src/components/RaceReplay/utils/raceConstants.ts',
 'src/components/RaceReplay/utils/speedCalculations.ts',
 'src/components/RaceReplay/utils/SkillDataUtils.ts',
 'src/data/RaceDataUtils.ts',
 'src/components/RaceReplay/utils/analysisUtils.ts'
];
let body = files.map(file => {
 let code = fs.readFileSync(path.join(source, file), 'utf8');
 if (file.endsWith('analysisUtils.ts')) code = code.split('export type MaxAdjustedSpeedDebug')[0];
 // Imports are supplied by the small standalone adapter. Keep the formulas intact.
 code = code.replace(/^import[\s\S]*?;\s*$/gm, '').replace(/^export /gm, '');
 return `// Source: ${file}\n` + stripTypeScriptTypes(code).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}).join('\n');
const adapter = `
 const UMDatabaseWrapper = {skills: data.skills};
 const GameDataLoader = {courseData: data.courses, racetracks: data.racetracks};
 const RaceSimulateEventData_SimulateEventType = {SKILL: 3, COMPETE_FIGHT: 5, COMPETE_TOP: 4};
 const RaceSimulateHorseResultData_RunningStyle = {NIGE: 1, SENKO: 2, SASHI: 3, OIKOMI: 4};
 // Full horseACT response fields are already hydrated. Rank scoring is not used.
 function fromRaceHorseData(d) {
  const mapping = names => Object.fromEntries(names.map((name,i) => [i+1,d[name]]));
  return {speed:d.speed,stamina:d.stamina,pow:d.pow||d.power,guts:d.guts,wiz:d.wiz,
   skills:(d.skill_array||[]).map(s=>({skillId:s.skill_id,level:s.level})),
   properDistances:mapping(['proper_distance_short','proper_distance_mile','proper_distance_middle','proper_distance_long']),
   properRunningStyles:mapping(['proper_running_style_nige','proper_running_style_senko','proper_running_style_sashi','proper_running_style_oikomi']),
   properGroundTurf:d.proper_ground_turf,properGroundDirt:d.proper_ground_dirt,
   fanCount:Number(d.fan_count),rawData:d};
 }
`;
const header = `/* Generated from ayaliz/hakuraku @ ${revision} (MIT).
 * Copyright (c) 2021 SSHZ.ORG. See THIRD_PARTY_NOTICES.md.
 * Rebuild: node scripts/build_award_telemetry.cjs /path/to/pinned/hakuraku
 * Source formulas are retained; imports/types and unused analysis exports are removed.
 */\n`;
fs.writeFileSync(path.join(root,'assets/hakuraku-award-telemetry.js'), header + `(function(global){\n'use strict';\nfunction estimateOtherEvents(raceData,raceHorseInfo,courseId,activations,distance,condition,data){\n` + adapter + body + '\nreturn computeOtherEvents(raceData,raceHorseInfo,courseId,activations,distance,condition);\n}\nglobal.HakurakuAwardTelemetry={estimateOtherEvents};\nif(typeof module!=="undefined")module.exports=global.HakurakuAwardTelemetry;\n})(typeof window!=="undefined"?window:globalThis);\n');
const db = JSON.parse(fs.readFileSync(path.join(source,'public/data/umdb.json')));
const game = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(source,'public/data/gamedata.bin.gz'))));
const skills = Object.fromEntries(db.skill.map(s => [s.id,{conditionGroups:(s.conditionGroups||[]).map(g=>({...g,effects:g.effects||[]}))}]));
const courses = Object.fromEntries(Object.entries(game['tracks/course_data']).map(([id,c])=>[id,{surface:c.surface,courseSetStatus:c.courseSetStatus,slopes:c.slopes}]));
const racetracks={pageProps:{racetrackFilterData:game['tracks/racetracks'].pageProps.racetrackFilterData.map(t=>({id:t.id,statThresholds:t.statThresholds}))}};
fs.writeFileSync(path.join(root,'assets/award-telemetry-data.json'), JSON.stringify({revision,skills,courses,racetracks})+'\n');
console.log(`Generated estimator with ${Object.keys(skills).length} skills and ${Object.keys(courses).length} courses.`);
