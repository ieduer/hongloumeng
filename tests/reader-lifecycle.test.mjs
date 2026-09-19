import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(process.env.READER_TEST_SOURCE || new URL('../reader-learning-evidence-v1.js',import.meta.url),'utf8');
const settle=()=>new Promise(r=>setImmediate(r));
function harness({getProgress,getSession}={}) {
 let clock=0,timer,observer,top=0;
 const writes=[],beats=[];
 const node={getAttribute:()=> 'long-1',getBoundingClientRect:()=>({top,height:1800})};
 const ctx={Date,Promise,Set,Map,Object,Array,Number,String,Math,innerHeight:800,
 document:{hidden:false,addEventListener(){},removeEventListener(){}},
 setInterval(fn){timer=fn;return 1;},clearInterval(){timer=null;},
 IntersectionObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}}};
 vm.runInNewContext(source,ctx);
 const tracker=ctx.BdfzReaderEvidence.createTracker({
 manifest:{schema:'bdfz-reader-learning-manifest-v1',siteKey:'fixture',bookId:'fixture',bookTitle:'Fixture',manifestVersion:'v1',manifestDigest:'sha256:test',completionContract:{minVisibleRatio:.6,minSegmentVisibleMs:800},chapters:[{chapterId:'a',title:'A',segmentIds:['long-1'],requiredActiveDwellMs:15000}]},
 now:()=>clock,getSession:getSession||(async()=>({authenticated:true})),getProgress:getProgress||(async()=>({items:[]})),putProgress:async p=>writes.push(p),
 startReading:async()=>({ok:true,sessionId:'fixture-reading-session-001'}),heartbeatReading:async p=>{beats.push(p);return {ok:true};}});
 return {tracker,writes,beats,node,async open(){return tracker.bindChapter({querySelectorAll:()=>[node]},'a');},async step(n=1){for(let i=0;i<n;i++){clock+=250;timer?.();await settle();}},scroll(v){top=v;},observe(ratio){observer([{target:node,intersectionRatio:ratio,boundingClientRect:{height:1800}}]);}};
}
test('long paragraphs require all viewport portions before one source segment is sampled',async()=>{
 const h=harness();await h.open();h.observe(.45);await h.step(12);
 assert.equal(h.beats.length,0,'watching only the first portion cannot count the paragraph');
 h.scroll(-600);await h.step(4);assert.equal(h.beats.length,0);
 h.scroll(-1200);await h.step(8);assert.ok(h.beats.some(b=>b.visibleSegmentIds.includes('long-1')));
 assert.equal(h.tracker.snapshot().eligible,false,'geometry alone never grants server completion');
});
test('hidden-page time cannot satisfy tall-paragraph coverage',async()=>{
 const h=harness();await h.open();h.tracker.setPageActive(false,0);await h.step(8);h.scroll(-600);await h.step(8);h.scroll(-1200);await h.step(8);
 assert.ok(h.beats.every(b=>b.visibleSegmentIds.length===0));h.tracker.setPageActive(true);await h.step(8);assert.ok(h.beats.every(b=>b.visibleSegmentIds.length===0),'earlier hidden portions still need reading');
});
test('detach retires delayed open reads before they can write progress',async()=>{
 let release;const wait=new Promise(r=>release=r);const h=harness({getProgress:()=>wait});const opened=h.open();await settle();h.tracker.detach();release({items:[]});await opened;
 assert.equal(h.writes.length,0);assert.equal(h.tracker.snapshot(),null);await h.step(20);assert.equal(h.beats.length,0);
});
test('failed central authentication never registers an eligible open',async()=>{
 const h=harness({getSession:async()=>({authenticated:false})});await h.open();assert.equal(h.writes.length,0);assert.equal(h.tracker.snapshot().sourcePaused,true);assert.equal(h.tracker.snapshot().eligible,false);
});
