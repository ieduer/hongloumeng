import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
function setup() {
  const nodes = new Map();
  const node = () => ({innerHTML:'',className:'',style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},querySelector(){return node();},querySelectorAll(){return [];}});
  const c = vm.createContext({console,URLSearchParams,AbortSignal,Date,Set,Map,Promise,
    localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#/'},
    document:{readyState:'loading',addEventListener(){},documentElement:{style:{setProperty(){}},dataset:{}},querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];}},
    window:{scrollTo(){},addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({})})});
  vm.runInContext(app,c); return c;
}
const run=(c,s)=>vm.runInContext(s,c);
test('calendar day is stable across DST and local evening',()=>{
  const c=setup();
  assert.equal(run(c,"localDate(new Date(2026,8,17,23,30))"),'2026-09-17');
  assert.equal(run(c,"planDayNumber({start:'2026-03-08'},new Date(2026,2,9,12))"),2);
  assert.equal(run(c,"planDayNumber({start:'2026-11-01'},new Date(2026,10,2,12))"),2);
  assert.equal(run(c,"planDayNumber({start:'bad'})"),null);
});
test('late poem load cannot overwrite the current route',async()=>{
  const c=setup();
  run(c,"D.poems=()=>new Promise(resolve=>{globalThis.finish=resolve}); D.chapters=async()=>({}); D.people=async()=>({items:[]}); globalThis.view={innerHTML:'new page'}; state.renderId=1;");
  const pending=run(c,"viewPoems(view,{q:new URLSearchParams('kind=判词')})");
  run(c,"state.renderId=2; finish({items:[]})");await pending;
  assert.equal(run(c,'view.innerHTML'),'new page');
});
test('late search load cannot access a replacement page',async()=>{
  const c=setup();run(c,"D.chapters=()=>new Promise(resolve=>{globalThis.finish=resolve}); D.exams=D.people=D.poems=async()=>({items:[]});D.research=async()=>({items:[]});globalThis.view={innerHTML:''};state.renderId=1;");
  const pending=run(c,"viewSearch(view,{q:new URLSearchParams('q=晴雯')})");
  run(c,"state.renderId=2;view.innerHTML='current page';finish({items:[]})");await pending;
  assert.equal(run(c,'view.innerHTML'),'current page');
});
test('AI HTTP errors do not expose upstream response bodies',async()=>{
  const c=setup();c.fetch=async(_url,opts)=>{assert.ok(opts.signal);return {ok:false,status:503,text:async()=>'PRIVATE_UPSTREAM_DIAGNOSTIC'};};
  await assert.rejects(run(c,"callAI('public test')"),e=>e.status===503&&!e.message.includes('PRIVATE'));
});
test('AI validates answer shape; valid answers still work',async()=>{
  const c=setup();c.fetch=async()=>({ok:true,text:async()=>'{"answer":42}'});
  await assert.rejects(run(c,"callAI('test')"),/空回應/);
  c.fetch=async()=>({ok:true,text:async()=>'{"answer":" 正常回答 "}'});
  assert.equal(await run(c,"callAI('test')"),'正常回答');
});
test('legacy progress key is unchanged',()=>assert.equal(run(setup(),'itemKey(12)'),'chapter-第12章'));
test('exam AI keeps reference-answer authority limits',()=>{
  const c=setup();
  run(c,"bubble=()=>({}); ask=(prompt)=>{globalThis.sent=prompt}; askExam({year:2026,stem:'題目',answer:'本站要點',answerSource:'本站考訂',authorityNote:'非官方答案'},'');");
  assert.match(run(c,'sent'),/本站考訂/);
  assert.match(run(c,'sent'),/非官方答案/);
});
test('theme restores the JSON-encoded preference',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const first=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const c={localStorage:{getItem(){return '"dark"';}},document:{documentElement:{dataset:{}}},matchMedia(){return {matches:false};}};
  vm.runInNewContext(first,c);assert.equal(c.document.documentElement.dataset.theme,'dark');
});
