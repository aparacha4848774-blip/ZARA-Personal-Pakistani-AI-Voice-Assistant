import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.ts';
import type { Env } from './env';

function createDb() {
  const rows: Record<string, any[]> = {memories:[],usage_logs:[],settings:[],whatsapp_messages:[],automation_history:[],rate_limits:[]};
  const db:any={
    prepare(sql:string){
      let params:any[]=[];
      const statement:any={
        bind(...args:any[]){params=args;return statement;},
        async first(){if(sql.includes('SELECT 1'))return {ok:1};if(sql.includes('SELECT data_json'))return null;if(sql.includes('SELECT * FROM memories WHERE'))return rows.memories.find(r=>r.id===params[0])||null;if(sql.includes('SELECT request_count'))return rows.rate_limits.find(r=>r.bucket_key===params[0])||null;return null;},
        async all(){if(sql.includes('FROM memories'))return {results:rows.memories};if(sql.includes('FROM usage_logs'))return {results:rows.usage_logs};if(sql.includes('FROM whatsapp_messages'))return {results:rows.whatsapp_messages};if(sql.includes('FROM automation_history'))return {results:rows.automation_history};return {results:[]};},
        async run(){if(sql.includes('INSERT INTO rate_limits')){const old=rows.rate_limits.find(r=>r.bucket_key===params[0]);if(old)old.request_count++;else rows.rate_limits.push({bucket_key:params[0],request_count:1});}if(sql.includes('INSERT INTO usage_logs'))rows.usage_logs.push({id:params[0],model_id:params[1],task_type:params[2],input_tokens:params[3],output_tokens:params[4],latency_ms:params[5],status:params[6],created_at:params[7]});if(sql.includes('INSERT INTO memories'))rows.memories.push({id:params[0],category:params[1],memory_key:params[2],value:params[3],importance:params[4],user_approved:params[5],is_active:1,created_at:params[6]});if(sql.includes('INSERT INTO whatsapp_messages'))rows.whatsapp_messages.push({id:params[0],contact_name:params[1],contact_identifier:params[2],message_text:params[3],status:params[4],user_confirmed:params[5],is_sensitive:params[6],created_at:params[7]});return {success:true,meta:{changes:1}};}
      };return statement;
    }
  };return db;
}
function env(overrides:Partial<Env>={}):Env{return {ASSETS:{fetch:async()=>new Response('asset')},DB:createDb(),AI:{run:async()=>({response:'Adaab Boss'})},ZARA_AUTH_TOKEN:'a'.repeat(48),ALLOWED_ORIGIN:'https://zara.example',...overrides};}
test('health reports D1 readiness and does not claim live model readiness',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/health'),env());const b:any=await r.json();assert.equal(r.status,200);assert.equal(b.dependencies.d1,true);assert.equal(b.capabilities.persistence,'d1');});
test('health marks auth unconfigured',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/health'),env({ZARA_AUTH_TOKEN:undefined}));const b:any=await r.json();assert.equal(b.dependencies.authConfigured,false);});
test('untrusted CORS origin is not reflected',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/health',{headers:{Origin:'https://evil.example'}}),env());assert.equal(r.headers.get('access-control-allow-origin'),null);});
test('valid CORS preflight is allowed only for explicit origin',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/chat',{method:'OPTIONS',headers:{Origin:'https://zara.example','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,authorization'}}),env());assert.equal(r.status,204);});
test('invalid CORS preflight is rejected',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/chat',{method:'OPTIONS',headers:{Origin:'https://evil.example','Access-Control-Request-Method':'POST'}}),env());assert.equal(r.status,403);});
test('private memory API fails closed without auth',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/memories'),env());assert.equal(r.status,401);});
test('memory API authorizes only configured bearer secret',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/memories',{headers:{Authorization:'Bearer '+'a'.repeat(48)}}),env());assert.equal(r.status,200);});
test('unknown API path returns JSON 404',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/not-real'),env());assert.equal(r.status,404);});
test('chat validates missing and oversized messages',async()=>{const e=env();const a=await worker.fetch(new Request('https://zara.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:''})}),e);assert.equal(a.status,400);const b=await worker.fetch(new Request('https://zara.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'x'.repeat(4001)})}),e);assert.equal(b.status,413);});
test('TTS validates text and returns browser fallback without key',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/voice/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Assalam Boss',language:'roman_urdu'})}),env({GEMINI_API_KEY:undefined}));const b:any=await r.json();assert.equal(r.status,200);assert.equal(b.status,'fallback');});
test('WhatsApp dispatch requires explicit confirmation',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/whatsapp/send',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({id:'x',confirmed:false})}),env());assert.equal(r.status,400);});
test('non-API requests use static assets binding',async()=>{const r=await worker.fetch(new Request('https://zara.example/settings'),env());assert.equal(await r.text(),'asset');});
