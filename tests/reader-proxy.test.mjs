import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {handleLearningEvidenceRequest as handle} from '../functions/_shared/learning-evidence-proxy.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../learning-manifest.json',import.meta.url)));
function req(path,body,headers={}){return new Request('https://reader.example'+path,{method:'POST',headers:{Origin:'https://reader.example',Cookie:'bdfz_uc_session=fixture','Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
test('proxy uses the bound service and refuses forged origin, source identity and oversized heartbeats',async()=>{
 let writes=0;const env={GROWTH_EVIDENCE:{startReading:async(cookie,payload)=>{writes++;assert.match(cookie,/fixture/);assert.equal(payload.resourceKey,manifest.chapters[0].itemKey);return {ok:true};}}};
 let p='/api/learning/start';assert.equal((await handle(req(p,{resourceKey:manifest.chapters[0].itemKey}),env,p)).status,200);assert.equal(writes,1);
 assert.equal((await handle(req(p,{resourceKey:manifest.chapters[0].itemKey},{Origin:'https://attacker.example'}),env,p)).status,403);
 assert.equal((await handle(req(p,{resourceKey:manifest.chapters[0].itemKey,sourceSiteKey:'other'}),env,p)).status,400);
 assert.equal((await handle(req(p,{resourceKey:manifest.chapters[0].itemKey},{Cookie:''}),env,p)).status,401);
 p='/api/learning/heartbeat';assert.equal((await handle(req(p,{sessionId:'fixture-session-00000001',sequence:1,visibleSegmentIds:['a','b','c','d']}),env,p)).status,400);
 assert.equal(writes,1);
});
test('source health requires exact public manifest identity and fails closed without a matching binding receipt',async()=>{
 const request=new Request('https://reader.example/api/learning/health');
 const env={ASSETS:{fetch:async()=>Response.json(manifest)},GROWTH_EVIDENCE:{getSourceReceipt:async descriptor=>({ok:true,status:'active',...descriptor})}};
 assert.equal((await handle(request,env,'/api/learning/health')).status,200);
 env.GROWTH_EVIDENCE.getSourceReceipt=async descriptor=>({ok:true,status:'active',...descriptor,manifestDigest:'sha256:'+'0'.repeat(64)});
 assert.equal((await handle(request,env,'/api/learning/health')).status,503);
 assert.equal((await handle(request,{},'/api/learning/health')).status,503);
});
