import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../reader-completion-ui.js',import.meta.url),'utf8');
async function harness() {
  let paint, writes=0;
  let disabled=false;
  const button={style:{},setAttribute(){},isConnected:true,get disabled(){return disabled},set disabled(value){disabled=Boolean(value)}};
  const container={querySelectorAll(){return []},querySelector(){return null},appendChild(){},contains(){return true}};
  const root={BDFZ_READER_LEARNING_MANIFEST:{chapters:[{chapterId:'a',segmentIds:[]}]},
    BdfzReaderEvidence:{createTracker(options){paint=options.onStatus;return {detach(){},bindChapter(){return Promise.resolve()},completeChapter(){writes++;return Promise.resolve()}}}},
    location:{href:'https://hlm.bdfz.net/'},document:{createElement(){return button}},addEventListener(){},fetch(){throw Error('No automatic data writes permitted in UI render')}};
  vm.runInNewContext(source,{window:root});await root.ReaderCompletion.mount(container,'a');
  return {paint,button,writes:()=>writes};
}
test('historical completion stays visible while current evidence remains ineligible', async()=>{
 const h=await harness();h.paint({historicalCompleted:true,eligible:false,serverObservedSegmentCount:3,segmentCount:19});
 assert.match(h.button.textContent,/本章已讀.*歷史完成記錄已保留.*3 \/ 19/);assert.equal(h.button.disabled,true);assert.equal(h.writes(),0);
});
test('past completion cannot mask a failed history read or grant eligibility',async()=>{
 const h=await harness();h.paint({historyUnavailable:true,eligible:true});assert.match(h.button.textContent,/暫時無法核對/);assert.equal(h.button.disabled,true);assert.equal(h.writes(),0);
});
test('current verified completion still uses confirmed completion state',async()=>{
 const h=await harness();h.paint({completed:true,historicalCompleted:true});assert.match(h.button.textContent,/本章已完成/);assert.equal(h.button.disabled,true);assert.equal(h.writes(),0);
});
test('historical label preserves existing eligible retry behavior without auto-submitting',async()=>{
 const h=await harness();h.paint({historicalCompleted:true,eligible:true});assert.equal(h.button.disabled,false);assert.match(h.button.textContent,/本次閱讀已核驗/);
 h.paint({historicalCompleted:true,completionFailed:true});assert.equal(h.button.disabled,false);assert.match(h.button.textContent,/點此重試/);assert.equal(h.writes(),0);
});
test('paused or in-flight new session preserves history and disables interaction',async()=>{
 const h=await harness();for(const state of [{sourcePaused:true},{completing:true}]){h.paint({historicalCompleted:true,eligible:true,...state});assert.match(h.button.textContent,/歷史完成記錄已保留/);assert.equal(h.button.disabled,true);}assert.equal(h.writes(),0);
});
