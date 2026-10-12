#!/usr/bin/env node
/* Validate or stage the companion's public export. Never changes archive scores. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const contract = require('../assets/companion-contract.js');
const DEFAULT_ROOT = path.resolve(__dirname, '..');
function read(file) {
  if (fs.statSync(file).size > contract.MAX_BYTES) throw new Error('JSON exceeds 10 MB.');
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function settings(root) { return contract.config(read(path.join(root, 'config', 'companion.json'))); }
function destination(root, relative) {
  const base = fs.realpathSync(root), target = path.resolve(base, relative);
  let existing = target;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const actual = fs.realpathSync(existing), relation = path.relative(base, actual);
  if (relation.startsWith('..') || path.isAbsolute(relation)) throw new Error('Results path resolves outside the site copy.');
  return target;
}
function checkSite(root = DEFAULT_ROOT) {
  const config = settings(root), file = destination(root, config.resultsPath);
  if (!fs.existsSync(file)) return {configured: false, message: 'Connection ready; no approved feed staged yet.'};
  const bundle = contract.validate(read(file), config.expectedTournamentId);
  return {configured: true, message: `${bundle.tournament.name}: ${bundle.results.length} approved heats validated.`};
}
function stage(input, root = DEFAULT_ROOT) {
  const config = settings(root), bundle = contract.validate(read(input), config.expectedTournamentId);
  const file = destination(root, config.resultsPath);
  if (fs.existsSync(file)) {
    const previous = contract.validate(read(file), config.expectedTournamentId);
    if (previous.tournament.id !== bundle.tournament.id) throw new Error('Refusing to overwrite another tournament. Use a separate results path for a new event.');
  }
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temporary = `${file}.${crypto.randomUUID()}.json.tmp`;
  try { fs.writeFileSync(temporary, JSON.stringify(bundle, null, 2) + '\n', {flag:'wx'}); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return {file, bundle};
}
function main(args) {
  const [command, input] = args;
  if (command === 'check' && args.length === 1) console.log(checkSite().message);
  else if (command === 'validate' && args.length === 2) {
    const bundle = contract.validate(read(path.resolve(input)), settings(DEFAULT_ROOT).expectedTournamentId);
    console.log(`Valid ${bundle.schema}: ${bundle.results.length} approved heats for ${bundle.tournament.name}.`);
  } else if (command === 'stage' && args.length === 2) {
    const result = stage(path.resolve(input));
    console.log(`Staged ${result.bundle.results.length} approved heats at ${result.file}.\nLocal copy only. Review the diff before publishing through GitHub.`);
  } else throw new Error('Usage: node scripts/companion_bridge.cjs check | validate <export.json> | stage <export.json>');
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1; } }
module.exports = {read, checkSite, stage};
