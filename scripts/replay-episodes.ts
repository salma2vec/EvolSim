/** Replay archived model responses through the actual simulator; never use the network. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { runSimulation } from '../lib/server/simulation';
import { assertWorldState } from '../lib/sim/guards';

const input=process.argv[2];
const output=process.argv[3];
if(!input || !output)throw new Error('Pass input artifact and a fresh replay report path');
const artifact=JSON.parse(readFileSync(input,'utf8'));
if(artifact.protocol !== 'local-episode-pilot-v1')throw new Error('Unsupported episode protocol');
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
const source=createHash('sha256');
for(const file of [...files('lib'),'scripts/research-episodes.ts','docs/EPISODE_PILOT.md','package-lock.json'].sort())source.update(file).update(readFileSync(file));
assert.equal(source.digest('hex'),artifact.sourceSha256);
assert.equal(artifact.digestContinuity,true);
for(const call of artifact.calls){assert.equal(sha(call.request),call.requestSha256);assert.equal(sha(call.response),call.responseSha256);}
process.env.OPENAI_API_KEY='ollama-local-validation';
process.env.OPENAI_BASE_URL='http://127.0.0.1:11434/v1';
process.env.EVOLSIM_ENABLE_LLM='true';
process.env.EVOLSIM_MODELS=artifact.model.name;
process.env.EVOLSIM_TOKEN_LIMIT_FIELD='max_tokens';
delete process.env.OPENAI_ORG_ID;delete process.env.OPENAI_PROJECT_ID;
let cursor=0;
globalThis.fetch=async(input,init)=>{
 const req=new Request(input,init);const saved=artifact.calls[cursor++];
 assert(saved,'No unrecorded calls allowed');assert.equal(req.url,'http://127.0.0.1:11434/v1/chat/completions');
 assert.equal(await req.text(),saved.request);
 return new Response(saved.response,{status:saved.status,headers:{'Content-Type':'application/json'}});
};
async function main(){
const rows=[];
for(const saved of artifact.runs){
 const partial:any[]=[];let result:any,error:string|undefined;
 const models=Object.fromEntries(saved.partialHistory[0].species.map((s:any)=>[s.traits.id,artifact.model.name]));
 try{result=await runSimulation('two_species_simple_lake',4,saved.seed,models,{useBaselineAgents:false,useStructuredDecisions:saved.arm==='grounded_schema',llmTemperature:0,llmSeed:saved.seed},state=>partial.push(state));}
 catch(e){error=e instanceof Error?e.message:String(e);}
 assert.deepEqual(JSON.parse(JSON.stringify(partial)),saved.partialHistory);assert.equal(error,saved.error);
 if(result){assert.deepEqual(JSON.parse(JSON.stringify(result)),saved.result);assert.equal(sha(JSON.stringify(result.history)),result.provenance.trajectorySha256);}
 for(const state of partial)assertWorldState(state);
 assert.equal(saved.reportedDigestBeforeEpisode,artifact.model.digest);
 rows.push({seed:saved.seed,arm:saved.arm,status:saved.status,completedSteps:partial.length-1,calls:saved.callCount,trajectoryMatches:true,error});
}
assert.equal(cursor,artifact.calls.length);
const report={protocol:'offline-episode-replay-v1',sourceHashVerified:true,requestResponseHashesVerified:artifact.calls.length*2,newInferenceCalls:0,exactRequestsMatched:cursor,allTrajectoriesMatch:true,digestContinuity:true,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
