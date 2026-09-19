import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(process.env.READER_TEST_SOURCE || new URL('../reader-learning-evidence-v1.js',import.meta.url),'utf8');
const manifest={schema:'bdfz-reader-learning-manifest-v1',bookId:'book',siteKey:'cxzgjy',bookTitle:'Book',manifestVersion:'v1',manifestDigest:'sha256:test',completionContract:{minVisibleRatio:0.6,minSegmentVisibleMs:800},chapters:[{chapterId:'a',itemKey:'book:chapter:a',title:'A',segmentIds:['a1','a2','a3','a4','a5','a6'],requiredActiveDwellMs:1000}]};
const settle=()=>new Promise(r=>setImmediate(r));
function harness(store={clock:0,active:0,segments:{},previous:[],last:0,completed:false,rows:[],evidence:0}, options={}) {
 let timer, offline=false, failProjection=false, releaseComplete;
 const calls={start:0,heartbeat:0,complete:0,progress:0};
 const context={console,Date,Promise,Set,Object,Number,String,Math,setInterval(fn){timer=fn;return 1;},clearInterval(){timer=null;},document:{hidden:false,addEventListener(){},removeEventListener(){}},IntersectionObserver:class{observe(){}disconnect(){}}};
 vm.runInNewContext(source,context);
 const result=()=>({ok:true,activeMs:store.active,observedSegmentCount:manifest.chapters[0].segmentIds.filter(k=>(store.segments[k]||0)>=800).length,observedSegmentMinimumMs:Math.min(...manifest.chapters[0].segmentIds.map(k=>store.segments[k]||0)),segmentCount:6,requiredActiveDwellMs:1000,completionReady:manifest.chapters[0].segmentIds.every(k=>(store.segments[k]||0)>=800)&&store.active>=1000});
 const tracker=context.BdfzReaderEvidence.createTracker({manifest,now:()=>store.clock,getSession:async()=>({authenticated:true}),getProgress:async()=>({items:store.rows}),putProgress:async p=>{calls.progress++;if(failProjection)return null;store.rows=[JSON.parse(JSON.stringify(p))];return {ok:true};},putRecord:async()=>({ok:true}),startReading:async()=>{calls.start++;store.previous=[];store.last=store.clock;return {ok:true,sessionId:'reader-session-00000001',alreadyCompleted:store.completed};},heartbeatReading:async p=>{calls.heartbeat++;if(offline)throw Error('offline');if(!store.completed){const elapsed=store.clock-store.last;if(elapsed>=1000&&elapsed<=10000&&store.previous.length){store.active+=elapsed;for(const id of store.previous)store.segments[id]=(store.segments[id]||0)+elapsed;}store.last=store.clock;store.previous=p.visibleSegmentIds;}return {...result(),sequence:p.sequence,...options.receipt};},completeReading:async()=>{calls.complete++;if(options.delayComplete)await new Promise(r=>{releaseComplete=r;});assert.equal(result().completionReady,true,'server rejects incomplete evidence');if(options.rejectComplete)throw Error('rejected');if(!store.completed){store.completed=true;store.evidence++;}return {ok:true};}});
 return {tracker,store,calls,async open(){await tracker.bindChapter({querySelectorAll:()=>[]},'a');for(const id of manifest.chapters[0].segmentIds)tracker.setSegmentVisibility(id,1,store.clock);},async step(n=1){for(let i=0;i<n;i++){store.clock+=250;timer?.();await settle();await settle();}},offline(v){offline=v;},failProjection(v){failProjection=v;},release(){releaseComplete?.();}};
}

test('local eligibility never claims a server checkpoint or writes a completion',async()=>{
 const h=harness();await h.open();h.store.clock=1000;h.tracker.tick(1000);
 assert.equal(h.tracker.snapshot().locallyEligible,true);
 assert.equal(h.tracker.snapshot().eligible,false);
 assert.equal((await h.tracker.completeChapter()).ok,false);assert.equal(h.calls.complete,0);
});
test('six simultaneously visible paragraphs all accrue and automatically enter evaluation once',async()=>{
 const h=harness();await h.open();await h.step(30);
 assert.equal(h.store.evidence,1);assert.equal(h.tracker.snapshot().completed,true);
 assert.equal(h.store.rows[0].state,'completed');assert.equal(h.store.rows[0].meta.observedSegmentCount,6);
 assert.equal(h.store.rows[0].meta.observedActiveDwellMs,h.store.active);
 const beats=h.calls.heartbeat;await h.step(40);await h.tracker.completeChapter();
 assert.equal(h.store.evidence,1);assert.equal(h.calls.complete,1);assert.equal(h.calls.heartbeat,beats);
});
test('delayed completion, timer and double click share one submission',async()=>{
 const h=harness(undefined,{delayComplete:true});await h.open();await h.step(20);
 const p=h.tracker.completeChapter(),q=h.tracker.completeChapter();assert.equal(p,q);assert.equal(h.calls.complete,1);
 h.release();await p;assert.equal(h.store.evidence,1);assert.equal(h.tracker.snapshot().completed,true);
});
test('failed projection preserves source evidence and explicit retry repairs readback without duplicate credit',async()=>{
 const h=harness();h.failProjection(true);await h.open();await h.step(25);
 assert.equal(h.store.evidence,1);assert.equal(h.tracker.snapshot().completed,false);assert.equal(h.tracker.snapshot().completionFailed,true);
 const attempts=h.calls.complete;await h.step(25);assert.equal(h.calls.complete,attempts);
 h.failProjection(false);assert.equal((await h.tracker.completeChapter()).ok,true);assert.equal(h.store.evidence,1);
});
test('reload of confirmed completion makes no new heartbeat or completion write',async()=>{
 const h=harness();await h.open();await h.step(25);h.tracker.detach();
 const reloaded=harness(h.store);await reloaded.open();await reloaded.step(20);
 assert.equal(reloaded.tracker.snapshot().completed,true);assert.equal(reloaded.calls.heartbeat,0);assert.equal(reloaded.calls.complete,0);assert.equal(h.store.evidence,1);
});
test('offline pauses finitely; reload reconnects to server progress and completes once',async()=>{
 const h=harness();await h.open();h.offline(true);await h.step(30);
 assert.equal(h.tracker.snapshot().sourcePaused,true);const calls=h.calls.heartbeat;await h.step(40);assert.equal(h.calls.heartbeat,calls);assert.equal(h.store.evidence,0);
 h.tracker.detach();const fresh=harness(h.store);await fresh.open();await fresh.step(30);assert.equal(fresh.store.evidence,1);
});
test('mismatching server checkpoint cannot enable or automatically submit completion',async()=>{
 const h=harness(undefined,{receipt:{segmentCount:5}});await h.open();await h.step(30);assert.equal(h.calls.complete,0);assert.equal(h.tracker.snapshot().eligible,false);
});
test('rejected source completion never writes a completed progress projection',async()=>{
 const h=harness(undefined,{rejectComplete:true});await h.open();await h.step(30);assert.equal(h.store.evidence,0);assert.equal(h.store.rows[0].state,'in_progress');assert.equal(h.tracker.snapshot().completed,false);
});
