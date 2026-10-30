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
        async first(){if(sql.includes('SELECT 1'))return {ok:1};if(sql.includes('SELECT data_json'))return null;if(sql.includes('SELECT * FROM memories WHERE'))return rows.memories.find(r=>r.id===params[0])||null;if(sql.includes('SELECT * FROM whatsapp_messages WHERE'))return rows.whatsapp_messages.find(r=>r.id===params[0])||null;if(sql.includes('SELECT request_count'))return rows.rate_limits.find(r=>r.bucket_key===params[0])||null;return null;},
        async all(){if(sql.includes('FROM memories'))return {results:rows.memories};if(sql.includes('FROM usage_logs'))return {results:rows.usage_logs};if(sql.includes('FROM whatsapp_messages'))return {results:rows.whatsapp_messages};if(sql.includes('FROM automation_history'))return {results:rows.automation_history};return {results:[]};},
        async run(){let changes=1;if(sql.includes('INSERT INTO rate_limits')){const old=rows.rate_limits.find(r=>r.bucket_key===params[0]);if(old)old.request_count++;else rows.rate_limits.push({bucket_key:params[0],request_count:1});}if(sql.includes('INSERT INTO usage_logs'))rows.usage_logs.push({id:params[0],model_id:params[1],task_type:params[2],input_tokens:params[3],output_tokens:params[4],latency_ms:params[5],status:params[6],created_at:params[7]});if(sql.includes('INSERT INTO memories'))rows.memories.push({id:params[0],category:params[1],memory_key:params[2],value:params[3],importance:params[4],user_approved:params[5],is_active:1,created_at:params[6]});if(sql.includes('INSERT INTO whatsapp_messages'))rows.whatsapp_messages.push({id:params[0],contact_name:params[1],contact_identifier:params[2],message_text:params[3],status:params[4],user_confirmed:params[5],is_sensitive:params[6],created_at:params[7]});if(sql.includes("UPDATE whatsapp_messages SET status='confirmed'")){const row=rows.whatsapp_messages.find(r=>r.id===params[0]);if(row&&row.status==='pending'&&row.user_confirmed===0){row.status='confirmed';row.user_confirmed=1;}else changes=0;}if(sql.includes('UPDATE whatsapp_messages SET status=?,user_confirmed=1')){const row=rows.whatsapp_messages.find(r=>r.id===params[3]);if(row){row.status=params[0];row.user_confirmed=params[1];row.sent_at=params[2];row.provider_message_id=params[3];}}if(sql.includes("UPDATE whatsapp_messages SET status='pending'")){const row=rows.whatsapp_messages.find(r=>r.id===params[0]);if(row){row.status='pending';row.user_confirmed=0;}}return {success:true,meta:{changes}};}
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
test('chat validates missing and oversized messages',async()=>{const e=env();const a=await worker.fetch(new Request('https://zara.example/api/chat',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({message:''})}),e);assert.equal(a.status,400);const b=await worker.fetch(new Request('https://zara.example/api/chat',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({message:'x'.repeat(4001)})}),e);assert.equal(b.status,413);});
test('TTS validates text and returns browser fallback without key',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/voice/tts',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({text:'Assalam Boss',language:'roman_urdu'})}),env({GEMINI_API_KEY:undefined}));const b:any=await r.json();assert.equal(r.status,200);assert.equal(b.status,'fallback');});
test('WhatsApp dispatch requires explicit confirmation',async()=>{const r=await worker.fetch(new Request('https://zara.example/api/whatsapp/send',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({id:'x',confirmed:false})}),env());assert.equal(r.status,400);});
test('non-API requests use static assets binding',async()=>{const r=await worker.fetch(new Request('https://zara.example/settings'),env());assert.equal(await r.text(),'asset');});

test('owner login sets an HttpOnly Secure SameSite session cookie',async()=>{
 const response=await worker.fetch(new Request('https://zara.example/api/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'a'.repeat(48)})}),env());
 assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie')||'';
 assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=Strict/i);
});
test('HttpOnly owner session cookie grants private memory access',async()=>{
 const e=env();
 const login=await worker.fetch(new Request('https://zara.example/api/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'a'.repeat(48)})}),e);
 const cookie=login.headers.get('set-cookie')||'';
 const response=await worker.fetch(new Request('https://zara.example/api/memories',{headers:{Cookie:cookie.split(';')[0]}}),e);
 assert.equal(response.status,200);
});
test('chat cannot expose saved owner memories to unauthenticated callers',async()=>{
 const response=await worker.fetch(new Request('https://zara.example/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'What do you remember about me?'})}),env());
 assert.equal(response.status,401);
});

test('settings store-compatible key route validates and saves preferences',async()=>{
 const response=await worker.fetch(new Request('https://zara.example/api/settings/preferredLanguage',{method:'PUT',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({value:'urdu'})}),env());
 assert.equal(response.status,200);
 const body:any=await response.json();
 assert.equal(body.settings.preferredLanguage,'urdu');
});
test('conversation history writes require owner authentication',async()=>{
 const response=await worker.fetch(new Request('https://zara.example/api/conversations/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({conversationId:'session-default',role:'user',content:'hello',language:'english'})}),env());
 assert.equal(response.status,401);
});
test('conversation history can be persisted after owner authentication',async()=>{
 const response=await worker.fetch(new Request('https://zara.example/api/conversations/messages',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({conversationId:'session-default',role:'user',content:'hello',language:'english'})}),env());
 assert.equal(response.status,201);
});

test('authenticated chat uses Workers AI fallback and records a usage entry',async()=>{
 const response=await worker.fetch(new Request('https://zara.example/api/chat',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+'a'.repeat(48)},body:JSON.stringify({message:'Assalam o alaikum Boss',language:'roman_urdu'})}),env());
 assert.equal(response.status,200);
 const body:any=await response.json();
 assert.equal(body.response,'Adaab Boss');
 assert.equal(body.providerStatus,'fallback');
 assert.equal(body.modelUsed,'@cf/google/gemma-4-26b-a4b-it');
});

test('WhatsApp dispatch is idempotent after a successful send',async()=>{
 const e=env({WHATSAPP_API_TOKEN:'test-token',WHATSAPP_PHONE_NUMBER_ID:'123456'});
 const auth={Authorization:'Bearer '+'a'.repeat(48)};
 const draft=await worker.fetch(new Request('https://zara.example/api/whatsapp/draft',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({contactName:'Test',contactIdentifier:'+923001234567',messageText:'Hello'})}),e);
 assert.equal(draft.status,201);
 const draftBody:any=await draft.json();
 const originalFetch=globalThis.fetch;
 let providerCalls=0;
 globalThis.fetch=async()=>{providerCalls++;return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}),{status:200,headers:{'content-type':'application/json'}});};
 try {
  const makeRequest=()=>new Request('https://zara.example/api/whatsapp/send',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({id:draftBody.draft.id,confirmed:true})});
  const first=await worker.fetch(makeRequest(),e);
  assert.equal(first.status,200);
  const second=await worker.fetch(makeRequest(),e);
  const result:any=await second.json();
  assert.equal(second.status,200);
  assert.equal(result.idempotent,true);
  assert.equal(providerCalls,1);
 } finally { globalThis.fetch=originalFetch; }
});
