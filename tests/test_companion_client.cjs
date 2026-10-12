'use strict';
// Browser-independent controller checks: real renderer, simulated DOM and HTTP.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const contract = require('../assets/companion-contract.js');
const fixture = require('./fixtures/companion-approved.json');
const config = require('../config/companion.json');
const source = fs.readFileSync(path.join(__dirname,'../assets/companion.js'),'utf8');
const shared = fs.readFileSync(path.join(__dirname,'../assets/site.js'),'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function harness(reply) {
  const elements = new Map(), calls = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id,{id,hidden:false,textContent:'',dataset:{},value:'',html:'',listeners:{},
      get innerHTML(){return this.html;},
      set innerHTML(value){this.html=value; for(const match of value.matchAll(/id="([^"]+)"/g)) element(match[1]);},
      replaceChildren(){this.html='';},addEventListener(event,fn){this.listeners[event]=fn;}});
    return elements.get(id);
  };
  const context = vm.createContext({console,Response,URL,URLSearchParams,Blob,Date,CompanionContract:contract,
    location:{search:''},window:{addEventListener(){}},
    document:{body:{insertAdjacentHTML(){}},querySelector(){return null;},getElementById:element},
    fetch:async url=>{calls.push(url);return url==='config/companion.json'?new Response(JSON.stringify(config)):reply(url);}});
  vm.runInContext(shared,context);
  return {context,element,calls,ready:vm.runInContext(source,context)};
}
(async()=>{
  let status=404, data=fixture;
  const h=harness(()=>new Response(JSON.stringify(data),{status})); await h.ready;
  assert.match(h.element('connection-status').textContent,/No approved results/);
  assert.equal(h.element('results').hidden,true);
  status=200; await vm.runInContext('published()',h.context);
  assert.match(h.element('connection-status').textContent,/Published approved results/);
  assert.match(h.element('match-results').innerHTML,/Demo match A/);
  assert.match(h.element('match-results').innerHTML,/Demo match B/);
  h.element('match-select').value='match-a'; vm.runInContext('renderMatches()',h.context);
  assert.match(h.element('match-results').innerHTML,/Demo match A/);
  assert.doesNotMatch(h.element('match-results').innerHTML,/Demo match B/);
  h.context.upload=new Blob([JSON.stringify(fixture)]);
  await vm.runInContext('preview(upload)',h.context);
  assert.match(h.element('connection-status').textContent,/LOCAL PREVIEW/);
  assert.equal(h.element('end-preview').hidden,false);
  assert.ok(h.calls.every(url=>!url.includes('127.0.0.1')&&!url.includes('/api/')));
  data=clone(fixture); data.results[0].rows[0].points=999;
  await vm.runInContext('published()',h.context);
  assert.equal(h.element('connection-status').dataset.state,'error');
  assert.equal(h.element('results').hidden,true); assert.equal(h.element('download').hidden,true);
  status=503; await vm.runInContext('published()',h.context);
  assert.match(h.element('connection-status').textContent,/HTTP 503/);
  assert.doesNotMatch(h.element('connection-status').textContent,/No approved results/);
  status=200; data=clone(fixture); data.results[0].rows[0].name='<img src=x onerror=alert(1)>';
  await vm.runInContext('published()',h.context);
  assert.doesNotMatch(h.element('match-results').innerHTML,/<img src=x/);
  assert.match(h.element('match-results').innerHTML,/&lt;img src=x/);
  data={schema:contract.SCHEMA,tournament:{id:'empty',name:'To be decided',scoring:null},results:[],standings:{players:[],teams:[]},voided:[]};
  await vm.runInContext('published()',h.context);
  assert.match(h.element('results').innerHTML,/To be decided/);
  assert.match(h.element('match-results').innerHTML,/first approved heat/);
  // A slow published fetch must not replace a newer local preview.
  let resolveSlow;
  const slow=harness(()=>new Promise(resolve=>{resolveSlow=resolve;}));
  while(!resolveSlow) await new Promise(resolve=>setImmediate(resolve));
  slow.context.upload=new Blob([JSON.stringify(fixture)]);
  await vm.runInContext('preview(upload)',slow.context);
  resolveSlow(new Response(JSON.stringify(data))); await slow.ready;
  assert.match(slow.element('connection-status').textContent,/LOCAL PREVIEW/);
  assert.equal(slow.element('event-name').textContent,fixture.tournament.name);
  vm.runInContext('clear()',h.context); vm.runInContext('clear()',slow.context);
  console.log('Client checks passed: missing feed, published results, match selection, local-only preview, error clearing, escaping, undecided format and stale-response protection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
