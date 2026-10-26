import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const app=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const recorderSource=readFileSync(new URL('../assets/js/learning-records.js',import.meta.url),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const node=()=>({innerHTML:'',className:'',textContent:'',disabled:false,scrollTop:0,scrollHeight:0,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},
  appendChild(){},remove(){},querySelector:()=>null,querySelectorAll:()=>[]});

// The real page: app.js, the shared capture service from learning-records.js and an identity SDK that may load late,
// refuse a signed-out reader or switch accounts. Captured rows are kept exactly as the inbox receives them; events
// records the order of inbox writes and provider requests.
function page({identityDelay=0,authenticated=true}={}){
  const listeners=new Map(),rows=[],events=[],local=new Map(),bubbles=[];
  const root={document:{currentScript:{dataset:{siteKey:'hlm'}}},crypto:webcrypto,setTimeout,clearTimeout,scrollTo(){},
    addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}};
  vm.createContext(root);vm.runInContext(recorderSource,root);
  root.BdfzLearningRecords=root.BdfzLearningRecordsFactory.createService({add:async row=>{rows.push(row);events.push(`row:${row.operation.action}`);return true;},list:async()=>[],remove:async()=>{}});
  const identity={account:'owner-a',getSession:async()=>({authenticated}),
    createLearningRecorder:async()=>({scope:identity.account,record:async()=>{},flush:async()=>{},retry:async()=>{},close(){}})};
  if(identityDelay)setTimeout(()=>{root.BdfzIdentity=identity;},identityDelay);else root.BdfzIdentity=identity;
  const nodes=new Map();
  const document={readyState:'loading',title:'紅樓夢',addEventListener(){},getElementById:()=>null,createElement:()=>{const b=node();bubbles.push(b);return b;},
    documentElement:{style:{setProperty(){}},dataset:{}},querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll:()=>[]};
  const context=vm.createContext({console,setTimeout,clearTimeout,AbortSignal,URLSearchParams,window:root,document,location:{hash:'#/exam',href:'https://hlm.bdfz.net/#/exam'},
    localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},
    fetch:async(url,init)=>{
      if(url!=='https://ai.bdfz.net/')return {ok:true,json:async()=>({}),text:async()=>'{}'};
      events.push('fetch:ai');assert.equal(init.headers['X-Request-ID'],rows.find(row=>row.operation.action==='ai.request')?.operation.operationId,'provider request carries the saved attempt id');
      return {ok:true,text:async()=>JSON.stringify({answer:'synthetic reply',model:'test-model'})};
    }});
  vm.runInContext(app,context);
  const run=code=>vm.runInContext(code,context);
  const captures=action=>rows.filter(row=>!action||row.operation.action===action)
    .map(row=>({action:row.operation.action,scope:row.scope,key:row.operation.resourceKey,version:row.operation.resourceVersion,at:row.operation.occurredAt,id:row.operation.operationId,parent:row.operation.parentOperationId,revises:row.operation.revisesOperationId}));
  return {run,root,identity,rows,events,bubbles,local,captures,focus:()=>(listeners.get('focus')||[]).forEach(fn=>fn({}))};
}
const exam={id:'2026-1',year:2026,stem:'題目',answer:'本站要點',answerSource:'本站考訂',authorityNote:'非官方答案',score:6};

test('a reading marker set before the identity SDK loads is owned by the student, with the time it was set',async()=>{
  const p=page({identityDelay:400});
  const markedAt=new Date().toISOString();
  p.run('setRead(12,true)');
  assert.equal(p.captures().length,0,'nothing is stored before the owner is known');
  await wait(1200);
  const [row]=p.captures('reading.marker');
  assert.deepEqual([row.key,row.scope],['chapter:12','owner-a']);
  assert.ok(row.at>=markedAt && Date.parse(row.at)<Date.parse(markedAt)+400,'occurredAt is the moment it was set, not when the owner resolved');
});

test('drafts typed right after a window focus are owned and keep their revision chain',async()=>{
  const p=page();
  await p.root.BdfzLearningRecords.prepare();
  p.run("detailedDraft('第一稿','exam:2026-1')");
  await wait(50);
  p.focus();
  assert.equal(p.root.BdfzLearningRecords.scope,null);
  const typedAt=new Date().toISOString();
  p.run("detailedDraft('第二稿','exam:2026-1')");
  await wait(800);
  const [first,second]=p.captures('draft.edit');
  assert.deepEqual([first.scope,second.scope],['owner-a','owner-a']);
  assert.equal(second.revises,first.id,'the second draft revises the owner\'s first draft');
  assert.equal(second.parent,first.id);
  assert.ok(second.at>=typedAt && Date.parse(second.at)<Date.parse(typedAt)+200);
  assert.equal(p.local.get('hlm-learning-parent-v1:owner-a:exam:2026-1'),second.id);
});

test('an answer submitted right after a window focus: answer, request and reply are owned and linked, the provider waits for the saved request, and the reply is shown',async()=>{
  const p=page();
  await p.root.BdfzLearningRecords.prepare();
  p.focus();
  p.run(`askExam(${JSON.stringify(exam)},'我的作答')`);
  assert.ok(!p.events.includes('fetch:ai'),'no provider request before the answer and request are saved');
  await wait(1000);
  const [submit]=p.captures('answer.submit'),[request]=p.captures('ai.request'),[reply]=p.captures('assistant.reply');
  assert.deepEqual([submit.scope,request.scope,reply.scope],['owner-a','owner-a','owner-a']);
  assert.equal(request.parent,submit.id);
  assert.equal(reply.parent,request.id);
  assert.ok(p.events.indexOf('row:ai.request')<p.events.indexOf('fetch:ai'));
  assert.equal(p.events.filter(x=>x==='fetch:ai').length,1);
  assert.ok(p.bubbles.some(b=>b.innerHTML.includes('synthetic reply')),'the reply replaces the waiting bubble');
  assert.equal(p.run('aiBusy'),false);
});

test('an account switch during the wait is not adopted',async()=>{
  const p=page();
  await p.root.BdfzLearningRecords.prepare();
  p.run("detailedDraft('甲稿','chat:#/')");
  await wait(50);
  p.identity.account='owner-b';
  p.focus();
  p.run("detailedDraft('乙稿','chat:#/')");
  await wait(800);
  assert.deepEqual(p.captures('draft.edit').map(x=>x.scope),['owner-a',null]);
  p.run("detailedDraft('丙稿','chat:#/')");
  await wait(100);
  assert.equal(p.captures('draft.edit').at(-1).scope,'owner-b','once the new recorder is ready, its own captures are owned');
});

test('a signed-out reader stays unattributed without a long wait',async()=>{
  const p=page({authenticated:false});
  const started=Date.now();
  p.run("detailedDraft('未登入','chat:#/')");
  p.run('setRead(3,true)');
  await wait(600);
  assert.deepEqual(p.captures().map(x=>[x.action,x.scope]),[['draft.edit',null],['reading.marker',null]]);
  assert.ok(Date.now()-started<1500);
});

test('a retry during the wait cannot store an ownerless copy',async()=>{
  const p=page();
  await p.root.BdfzLearningRecords.prepare();
  p.focus();
  p.run("detailedDraft('等待中','chat:#/')");
  await p.run('retryDetailedStorage()').catch(()=>{});
  await wait(800);
  assert.deepEqual(p.captures().map(x=>[x.action,x.scope]),[['draft.edit','owner-a']]);
});

test('a capture made with a ready recorder is stored at once, unchanged',async()=>{
  const p=page();
  await p.root.BdfzLearningRecords.prepare();
  p.run('setRead(5,true)');
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(p.captures().map(x=>[x.action,x.scope]),[['reading.marker','owner-a']]);
});
