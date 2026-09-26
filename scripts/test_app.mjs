import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
function setup() {
  const nodes = new Map(); let operationSequence=0;
  const node = () => ({innerHTML:'',className:'',style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},querySelector(){return node();},querySelectorAll(){return [];}});
  const c = vm.createContext({console,URLSearchParams,AbortSignal,Date,Set,Map,Promise,
    localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#/'},
    document:{readyState:'loading',getElementById(){return null;},addEventListener(){},documentElement:{style:{setProperty(){}},dataset:{}},querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];}},
    window:{BdfzLearningRecords:{scope:'a'.repeat(64),id:()=> 'synthetic-message-id',build:(action,content,context,options)=>({operationId:'synthetic-operation-'+(++operationSequence),occurredAt:'2026-09-25T14:00:00Z',action,content,context,options}),record:async()=>({ok:true})},scrollTo(){},addEventListener(){}},fetch:async()=>({ok:true,json:async()=>({})})});
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
function appearance(stored = {}, matches = false) {
  const style = {}, c = {console,window:{},localStorage:{getItem(k){return stored[k] || null;},setItem(k,v){stored[k]=v;}},matchMedia(){return {matches,addEventListener(){}};},document:{documentElement:{dataset:{},style:{setProperty(k,v){style[k]=v;}}},querySelector(){return null;},querySelectorAll(){return [];}}};
  vm.runInNewContext(readFileSync(new URL('../assets/js/appearance.js',import.meta.url),'utf8'),c);
  return c;
}
test('appearance keeps old mode, restores new palette and rejects corrupt preferences',()=>{
  assert.equal(appearance({hlm_theme:'"dark"'}).document.documentElement.dataset.theme,'dark');
  const c=appearance({hlm_appearance:'{"palette":"yutanqing","mode":"light"}'},true);
  assert.equal(c.document.documentElement.dataset.palette,'yutanqing');
  assert.equal(c.document.documentElement.dataset.theme,'light');
  assert.equal(appearance({hlm_appearance:'{"palette":"bad","mode":"bad"}'},true).document.documentElement.dataset.palette,'classic');
  assert.equal(appearance({hlm_appearance:'broken'},true).document.documentElement.dataset.theme,'dark');
});
test('all 18 palettes pass text, UI and action contrast in both modes',()=>{
  const api=appearance().window.HLMAppearance;assert.equal(api.palettes.length,18);
  for(const p of api.palettes) for(const dark of [false,true]) {
    const c=api.colors(p,dark);
    for(const bg of ['paper','paper-2','card','line-2']) {
      assert.ok(api.contrast(c.ink,c[bg])>=7,p.id+' text '+bg);
      for(const k of ['ink-2','ink-3','zhu','qing','gold','ok']) assert.ok(api.contrast(c[k],c[bg])>=4.5,p.id+' '+k+' '+bg);
    }
    assert.ok(api.contrast(c.zhu,c['on-accent'])>=4.5,p.id+' primary button');
    assert.ok(api.contrast(c.ok,c['on-ok'])>=4.5,p.id+' completed task');
  }
});
test('palette backgrounds carry distinct washes through light and dark surface layers',()=>{
  const api=appearance().window.HLMAppearance;
  const distance=(a,b)=>Math.max(...a.slice(1).match(/../g).map((v,i)=>Math.abs(parseInt(v,16)-parseInt(b.slice(1).match(/../g)[i],16))));
  for(const dark of [false,true]) {
    const schemes=api.palettes.map(p=>api.colors(p,dark));
    for(const surface of ['paper','card','paper-2','line-2']) {
      assert.equal(new Set(schemes.map(c=>c[surface])).size,18,surface+' must reflect each palette');
      // These presets share an accent but have different canonical washes.
      const a=schemes[api.palettes.findIndex(p=>p.id==='yutanqing')];
      const b=schemes[api.palettes.findIndex(p=>p.id==='yuhonglan')];
      assert.ok(distance(a[surface],b[surface])>=(dark?15:4),surface+' must visibly distinguish the two washes');
    }
    for(const [i,c] of schemes.entries()) {
      assert.ok(distance(c.paper,c.card)>=5,api.palettes[i].id+' card remains distinct from page');
      assert.ok(distance(c.card,c['paper-2'])>=5,api.palettes[i].id+' sidebar remains distinct from card');
      assert.notEqual(c.card.toLowerCase(),'#ffffff','cards retain a palette tint');
    }
  }
});


test('AI stores raw full reply, request and failure without promoting source context to student work',async()=>{
 const c=setup();c.records=[];c.window.BdfzLearningRecords.record=async op=>{c.records.push(op);return{ok:true};};
 c.fetch=async()=>({ok:true,text:async()=>JSON.stringify({answer:'  synthetic < reply\n',model:'declared'})});
 await run(c,"callAI('synthetic prompt')");assert.equal(c.records[0].action,'ai.request');assert.equal(c.records[1].content.text,'  synthetic < reply\n');assert.equal(c.records[1].options.assessment.modelProvenance,'response_declared');
});
test('local persistence failure prevents a provider attempt',async()=>{
 const c=setup();let calls=0;c.fetch=async()=>{calls++;};c.window.BdfzLearningRecords.record=async()=>{throw Error('storage unavailable');};
 await assert.rejects(run(c,"callAI('synthetic')"),/storage/);assert.equal(calls,0);
});

test('account change during durable request storage prevents dispatch',async()=>{
 const c=setup();let release,calls=0;c.window.BdfzLearningRecords.record=()=>new Promise(r=>release=r);c.fetch=async()=>{calls++;};const task=run(c,"callAI('original prompt')");c.window.BdfzLearningRecords.scope='b'.repeat(64);release();await assert.rejects(task,/帳號已變更/);assert.equal(calls,0);
});
test('full reply save failure retains exact operation; storage retry never repeats a model call',async()=>{
 const c=setup(),rows=[];let broken=true,calls=0;c.window.BdfzLearningRecords.record=async op=>{if(broken&&op.action==='assistant.reply')throw Error('storage full');rows.push(op);};c.window.BdfzLearningRecords.retry=async()=>({ok:true});const answer=' 完整回覆\n'.repeat(5000);c.fetch=async()=>{calls++;return{ok:true,text:async()=>JSON.stringify({answer,model:'fixture',modelVersion:'v1'})};};await assert.rejects(run(c,"callAI('question')"),/storage full/);assert.equal(run(c,'detailedPending.size'),1);assert.equal(rows.length,1);broken=false;await run(c,'retryDetailedStorage()');assert.equal(calls,1);assert.equal(rows[1].action,'assistant.reply');assert.equal(rows[1].content.text,answer);assert.equal(rows[1].content.response.modelVersion,'v1');assert.equal(rows[1].options.assessment.reportedModelVersion,'v1');assert.equal(run(c,'detailedPending.size'),0);
});
test('bounded retry records failure and links the next request to it',async()=>{
 const c=setup(),rows=[];c.window.BdfzLearningRecords.record=async op=>rows.push(op);run(c,"globalThis.fixtureContext=detailedContext('exam:test')");c.fetch=async()=>({ok:false,status:503,text:async()=>'synthetic failure body'});await assert.rejects(run(c,"callAI('prompt',fixtureContext,1)"));c.fetch=async()=>({ok:true,text:async()=>'{"answer":"full reply"}'});await run(c,"callAI('prompt',fixtureContext,2)");assert.deepEqual(rows.map(x=>x.action),['ai.request','ai.failure','ai.request','assistant.reply']);assert.equal(rows[2].options.parentOperationId,rows[1].operationId);assert.equal(rows[3].options.parentOperationId,rows[2].operationId);assert.equal(rows[3].options.assessment.reportedModel,null);assert(rows.every(x=>x.options.assessment.scoringEligibility==='record_only'));
});
test('submitted original answer is saved before its request and full response',async()=>{
 const c=setup(),rows=[];c.window.BdfzLearningRecords.record=async op=>rows.push(op);c.fetch=async()=>{assert.equal(rows.length,2);return{ok:true,text:async()=>'{"answer":"reply"}'};};run(c,"bubble=()=>({innerHTML:'',querySelector:()=>null}); globalThis.fixtureContext=detailedContext('exam:test');globalThis.submission=detailedCapture('answer.submit',{text:' original answer \\n',question:{id:'test'}},{actor:'student'},fixtureContext)");await run(c,"ask('generated prompt','label',fixtureContext,submission)");assert.equal(rows[0].content.text,' original answer \n');assert.equal(rows[1].options.parentOperationId,rows[0].operationId);assert.equal(rows[2].options.parentOperationId,rows[1].operationId);
});
test('late reply stays with original scope and cannot paint or archive under a new account',async()=>{
 const c=setup(),rows=[];c.window.BdfzLearningRecords.record=async op=>rows.push(op);run(c,"globalThis.responseBubble={innerHTML:'',querySelector:()=>null};bubble=()=>responseBubble");c.fetch=async()=>{c.window.BdfzLearningRecords.scope='b'.repeat(64);return{ok:true,text:async()=>'{"answer":"private old-owner reply"}'};};await run(c,"ask('prompt','waiting')");assert(!run(c,'responseBubble.innerHTML').includes('private'));assert(rows.every(x=>x.context.captureScope==='a'.repeat(64)));assert.equal(run(c,'convo.length'),0);
});
test('draft ancestry is isolated by account and persists in the existing browser storage',async()=>{
 const c=setup(),values=new Map();c.localStorage.getItem=k=>values.get(k)||null;c.localStorage.setItem=(k,v)=>values.set(k,v);const first=run(c,"detailedCapture('draft.edit',{text:'original'},{},detailedContext('exam:test'))");await first.saved;assert.equal(run(c,"detailedContext('exam:test').parentOperationId"),first.operation.operationId);c.window.BdfzLearningRecords.scope='b'.repeat(64);assert.equal(run(c,"detailedContext('exam:test').parentOperationId"),'');
});
test('retrying a failed draft persists its original account ancestry',async()=>{
 const c=setup(),values=new Map();c.localStorage.getItem=k=>values.get(k)||null;c.localStorage.setItem=(k,v)=>values.set(k,v);c.window.BdfzLearningRecords.record=async()=>{throw Error('storage unavailable');};c.window.BdfzLearningRecords.retry=async()=>({ok:true});const first=run(c,"detailedCapture('draft.edit',{text:'original'},{},detailedContext('exam:test'))");await assert.rejects(first.saved);c.window.BdfzLearningRecords.record=async()=>({ok:true});await run(c,'retryDetailedStorage()');assert.equal(run(c,"detailedContext('exam:test').parentOperationId"),first.operation.operationId);
});
