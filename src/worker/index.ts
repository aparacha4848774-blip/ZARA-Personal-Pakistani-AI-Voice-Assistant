import type { Env } from './env';
import { checkRateLimit, cleanupRateLimits, createMemoryBackup } from './services';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

const METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const HEADERS = 'content-type,authorization,x-zara-auth';
const MAX_BODY_BYTES = 64 * 1024;
const CHAT_MODEL = 'gemini-3.8-flash';
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const WORKERS_MODEL = '@cf/google/gemma-4-26b-a4b-it';

type Json = Record<string, any>;

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const out = new Headers(JSON_HEADERS);
  new Headers(headers).forEach((v, k) => out.set(k, v));
  return new Response(JSON.stringify(data), { status, headers: out });
}

function originAllowed(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  headers.set('vary', 'Origin');
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', METHODS);
    headers.set('access-control-allow-headers', HEADERS);
    headers.set('access-control-max-age', '86400');
  }
  return headers;
}

function preflight(request: Request, env: Env): Response {
  const origin = originAllowed(request, env);
  const method = request.headers.get('Access-Control-Request-Method')?.toUpperCase();
  const headers = (request.headers.get('Access-Control-Request-Headers') || '')
    .split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!origin || !method || !METHODS.split(',').includes(method) ||
      headers.some((h) => !HEADERS.split(',').includes(h))) {
    return new Response(null, { status: 403, headers: corsHeaders(null) });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function getClientKey(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return ip.slice(0, 80);
}

function authorized(request: Request, env: Env): boolean {
  const expected = env.ZARA_AUTH_TOKEN;
  if (!expected || expected.length < 32) return false;
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\\s+/i, '').trim();
  const custom = request.headers.get('X-ZARA-AUTH')?.trim();
  const cookie = request.headers.get('Cookie') || '';
  const session = cookie.split(';').map((v) => v.trim()).find((v) => v.startsWith('zara_session='));
  const cookieToken = session ? decodeURIComponent(session.slice('zara_session='.length)) : '';
  const candidates = [bearer, custom, cookieToken].filter((value): value is string => Boolean(value));
  return candidates.some((supplied) => {
    if (supplied.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
    return mismatch === 0;
  });
}

async function readJson(request: Request): Promise<Json> {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) throw new Error('content_type');
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) throw new Error('too_large');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('too_large');
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_body');
  return value;
}

function mapMemory(row: Json): Json {
  return {
    id: row.id, category: row.category, key: row.memory_key, value: row.value,
    importance: row.importance, userApproved: Boolean(row.user_approved),
    isActive: Boolean(row.is_active), createdAt: row.created_at, updatedAt: row.updated_at || undefined,
  };
}

async function getMemories(env: Env): Promise<Json[]> {
  const result = await env.DB.prepare('SELECT * FROM memories ORDER BY CASE importance WHEN "high" THEN 3 WHEN "medium" THEN 2 ELSE 1 END DESC, created_at DESC').all<Json>();
  return (result.results || []).map(mapMemory);
}

async function getSettings(env: Env): Promise<Json> {
  const row = await env.DB.prepare('SELECT data_json FROM settings WHERE id = ?').bind('owner').first<{data_json:string}>();
  return row ? JSON.parse(row.data_json) : {
    ownerName:'Boss', preferredLanguage:'roman_urdu', voiceSpeed:1, voiceVolume:1,
    wakeWordsEnabled:true, continuousConversation:true, sleepModeActive:false,
    highThinkingMode:false, silenceTimeoutMs:1500, selectedMicDevice:'default', selectedSpeakerDevice:'default',
  };
}

async function saveUsage(env: Env, model: string, task: string, input: number, output: number, latency: number, status: string): Promise<void> {
  await env.DB.prepare('INSERT INTO usage_logs (id,model_id,task_type,input_tokens,output_tokens,latency_ms,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), model, task, input, output, latency, status, new Date().toISOString()).run();
}

async function geminiGenerate(env: Env, model: string, contents: Json[], systemInstruction: string, thinking: boolean): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini provider is not configured');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method:'POST',
    headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:systemInstruction}]},
      contents,
      generationConfig:{temperature:0.8,maxOutputTokens:4096,thinkingConfig:{thinkingLevel:thinking?'high':'low'}},
    }),
    signal:AbortSignal.timeout(25000),
  });
  const data = await response.json() as Json;
  if (!response.ok) throw new Error(`Gemini provider returned HTTP ${response.status}`);
  const text = data.candidates?.[0]?.content?.parts?.filter((p:Json)=>typeof p.text==='string').map((p:Json)=>p.text).join('') || '';
  if (!text.trim()) throw new Error('Gemini returned an empty response');
  return text;
}

async function workersAiGenerate(env: Env, contents: Json[], systemInstruction: string): Promise<string> {
  if (!env.AI) throw new Error('Workers AI binding is unavailable');
  const messages = [
    {role:'system',content:systemInstruction},
    ...contents.map((c:Json)=>({role:c.role==='model'?'assistant':'user',content:c.parts?.map((p:Json)=>p.text||'').join('')||''})),
  ];
  const result = await env.AI.run(env.WORKERS_AI_MODEL || WORKERS_MODEL,{messages,max_tokens:2048,temperature:0.7}) as Json;
  const text = result?.response || result?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Workers AI returned an empty response');
  return text;
}

function persona(language: string, memories: Json[], emotion: string): string {
  const memoryText = memories.filter(m=>m.isActive && m.userApproved).map(m=>`- [${String(m.category).toUpperCase()}] ${m.key}: ${m.value}`).join('\n') || 'No saved long-term memories yet.';
  const base = 'You are ZARA, a personal Pakistani AI voice assistant and friendly best friend. Always address the user as Boss, never Sir. Be direct, accurate, warm, natural, and do not invent facts. Preserve the user\'s requested language. Never claim local desktop actions were performed by a cloud Worker.';
  const lang = language==='urdu'?'Respond naturally in Pakistani Urdu script.':language==='english'?'Respond in natural Pakistani English.':'Respond in natural Pakistani Roman Urdu.';
  return `${base}\n${lang}\nActive approved memories:\n${memoryText}\nCurrent emotion context: ${emotion}.`;
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const message = body.message;
  if (typeof message !== 'string' || !message.trim()) return json({error:'Message text is required.'},400);
  if (message.length > 4000) return json({error:'Message exceeds 4000 characters.'},413);
  const history = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
  if (history.length > 40 || history.some((m:Json)=>!m || !['user','zara','model','assistant'].includes(m.role) || typeof (m.content||m.text)!=='string' || String(m.content||m.text).length>4000)) {
    return json({error:'Invalid or oversized conversation history.'},400);
  }
  const started = Date.now();
  const settings = await getSettings(env);
  const language = ['urdu','roman_urdu','english'].includes(body.language) ? body.language : settings.preferredLanguage;
  const memories = await getMemories(env);
  const contents = history.map((item:Json)=>({role:item.role==='zara'||item.role==='assistant'||item.role==='model'?'model':'user',parts:[{text:String(item.content||item.text).slice(0,4000)}]}));
  contents.push({role:'user',parts:[{text:message.trim()}]});
  const system = persona(language,memories,String(body.currentEmotion||'Confident').slice(0,40));
  const thinking = Boolean(body.highThinking || settings.highThinkingMode);
  const preferred = env.GEMINI_CHAT_MODEL || CHAT_MODEL;
  let responseText = '';
  let modelUsed = '';
  let providerStatus = 'success';
  let failure = '';
  if (env.GEMINI_API_KEY) {
    try { responseText = await geminiGenerate(env,preferred,contents,system,thinking); modelUsed=preferred; }
    catch (error) { failure=error instanceof Error?error.message:'Gemini failed'; }
  }
  if (!responseText) {
    try { responseText=await workersAiGenerate(env,contents,system); modelUsed=env.WORKERS_AI_MODEL||WORKERS_MODEL; providerStatus='fallback'; }
    catch (error) { failure=failure || (error instanceof Error?error.message:'AI provider failed'); }
  }
  const latency=Date.now()-started;
  if (!responseText) {
    await saveUsage(env,preferred,'chat',Math.ceil(message.length/4),0,latency,'failed').catch(()=>{});
    return json({error:'AI providers are currently unavailable. Check Gemini/Workers AI configuration.',status:'provider_unavailable',details:failure.slice(0,180)},503);
  }
  const approxInput=Math.ceil((message.length+contents.reduce((n,c)=>n+c.parts[0].text.length,0))/4);
  const approxOutput=Math.ceil(responseText.length/4);
  await saveUsage(env,modelUsed,'chat',approxInput,approxOutput,latency,providerStatus);
  return json({response:responseText,emotion:'Confident',intensity:80,confidence:'medium',style:language==='urdu'?'Pakistani Urdu Script':language==='english'?'Pakistani English':'Dostana Pakistani Roman Urdu',tokensUsed:approxInput+approxOutput,modelUsed,isThinking:thinking,providerStatus,latencyMs:latency});
}

function pcmToWavBase64(base64: string, sampleRate: number, channels = 1): string {
  const pcm = atob(base64);
  const bytes = new Uint8Array(44 + pcm.length);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, pcm.length, true);
  for (let i = 0; i < pcm.length; i++) bytes[44 + i] = pcm.charCodeAt(i);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

async function handleTts(request: Request, env: Env): Promise<Response> {
  const body=await readJson(request);
  if(typeof body.text!=='string'||!body.text.trim()) return json({error:'Text is required.'},400);
  if(body.text.length>3000) return json({error:'Text exceeds 3000 characters.'},413);
  const model=env.GEMINI_TTS_MODEL||TTS_MODEL;
  if(!env.GEMINI_API_KEY) return json({audioBase64:null,format:'client-voice',status:'fallback',notice:'Gemini TTS is not configured; use browser speech synthesis.'});
  const lang=['urdu','roman_urdu','english'].includes(body.language)?body.language:'roman_urdu';
  const voice=typeof body.voiceConfig?.voiceName==='string'?body.voiceConfig.voiceName:'Kore';
  const style=typeof body.speechStyle==='string'?body.speechStyle.slice(0,500):'Warm, natural Pakistani conversational voice.';
  const prompt=lang==='urdu'? `Speak naturally in Pakistani Urdu: ${body.text}`:lang==='english'?body.text:`Speak naturally in Pakistani Roman Urdu with Pakistani pronunciation: ${body.text}`;
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:`${style}\n${prompt}`}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}}),
    signal:AbortSignal.timeout(25000),
  });
  const data=await response.json() as Json;
  const audio=data.candidates?.[0]?.content?.parts?.find((p:Json)=>p.inlineData?.data)?.inlineData;
  if(!response.ok||!audio?.data) return json({audioBase64:null,format:'client-voice',status:'fallback',notice:'TTS provider unavailable; use browser speech synthesis.'});
  const sampleRate = Number(String(audio.mimeType || '').match(/rate=(\d+)/i)?.[1] || 24000);
  const wav = pcmToWavBase64(audio.data, Number.isFinite(sampleRate) ? sampleRate : 24000);
  return json({audioBase64:wav,mimeType:'audio/wav',format:'gemini-audio',modelUsed:model,voiceName:voice,status:'success'});
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if(method==='GET'&&path==='/api/health') {
    const db=await env.DB.prepare('SELECT 1 AS ok').first<{ok:number}>().then(()=>true).catch(()=>false);
    return json({status:db?'ok':'degraded',service:'zara-worker',runtime:'cloudflare-workers',timestamp:new Date().toISOString(),dependencies:{d1:db,workersAI:Boolean(env.AI),gemini:Boolean(env.GEMINI_API_KEY),authConfigured:Boolean(env.ZARA_AUTH_TOKEN&&env.ZARA_AUTH_TOKEN.length>=32)},capabilities:{chat:db?'gemini_with_workers_ai_fallback':'unavailable',persistence:'d1',voice:'browser_recognition_and_gemini_tts_optional',desktopControl:'electron_local_runtime',whatsapp:Boolean(env.WHATSAPP_API_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID)}} ,db?200:503);
  }
  if(method==='GET'&&path==='/api/auth/status') return json({configured:Boolean(env.ZARA_AUTH_TOKEN&&env.ZARA_AUTH_TOKEN.length>=32),authenticated:authorized(request,env)});
  if(method==='POST'&&path==='/api/auth/session') {
    const b=await readJson(request),expected=env.ZARA_AUTH_TOKEN;
    if(!expected||expected.length<32)return json({error:'Owner authentication is not configured. Set ZARA_AUTH_TOKEN as a Worker secret (32+ characters).'},503);
    const supplied=typeof b.token==='string'?b.token:'';
    if(supplied.length!==expected.length)return json({error:'Invalid owner password.'},401);
    let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^supplied.charCodeAt(i);
    if(mismatch!==0)return json({error:'Invalid owner password.'},401);
    return json({success:true},200, { 'set-cookie': `zara_session=${encodeURIComponent(expected)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200` });
  }
  const privatePath=/^\/api\/(memory|memories|settings|whatsapp|usage|automation|chat|voice)/.test(path);
  if(privatePath&&!authorized(request,env)) return json({error:env.ZARA_AUTH_TOKEN?'Unauthorized. Configure a valid ZARA session token.':'Private API is locked until ZARA_AUTH_TOKEN (32+ chars) is configured.'},401);

  if(method==='POST'&&path==='/api/auth/logout') {
    return json({success:true},200,{'set-cookie':'zara_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
  }
  if(method==='POST'&&path==='/api/chat') return handleChat(request,env);
  if(method==='POST'&&path==='/api/voice/tts') return handleTts(request,env);

  if(path==='/api/memory'||path==='/api/memories') {
    if(method==='GET') return json({memories:await getMemories(env)});
    if(method==='POST') {
      const b=await readJson(request);
      if(typeof b.key!=='string'||!b.key.trim()||typeof b.value!=='string'||!b.value.trim()||b.key.length>120||b.value.length>2000) return json({error:'Valid key and value are required.'},400);
      const category=['preference','fact','instruction','contact','task'].includes(b.category)?b.category:'fact';
      const importance=['high','medium','low'].includes(b.importance)?b.importance:'medium';
      const id=crypto.randomUUID(),now=new Date().toISOString(),approved=b.userApproved===true?1:0;
      await env.DB.prepare('INSERT INTO memories(id,category,memory_key,value,importance,user_approved,is_active,created_at) VALUES(?,?,?,?,?,?,1,?)').bind(id,category,b.key.trim(),b.value.trim(),importance,approved,now).run();
      const row=await env.DB.prepare('SELECT * FROM memories WHERE id=?').bind(id).first<Json>();
      return json({memory:mapMemory(row!)},201);
    }
    if(method==='DELETE') { await env.DB.prepare('UPDATE memories SET is_active=0 WHERE is_active=1').run(); return json({success:true,count:0,memories:[]}); }
  }
  const memoryMatch=path.match(/^\/api\/(?:memory|memories)\/([^/]+)$/);
  if(memoryMatch) {
    const id=decodeURIComponent(memoryMatch[1]);
    if(method==='PUT'||method==='PATCH') {
      const b=await readJson(request),existing=await env.DB.prepare('SELECT * FROM memories WHERE id=?').bind(id).first<Json>();
      if(!existing)return json({error:'Memory item not found.'},404);
      const next={category:['preference','fact','instruction','contact','task'].includes(b.category)?b.category:existing.category,key:typeof b.key==='string'?b.key.slice(0,120):existing.memory_key,value:typeof b.value==='string'?b.value.slice(0,2000):existing.value,importance:['high','medium','low'].includes(b.importance)?b.importance:existing.importance,userApproved:typeof b.userApproved==='boolean'?(b.userApproved?1:0):existing.user_approved,isActive:typeof b.isActive==='boolean'?(b.isActive?1:0):existing.is_active};
      await env.DB.prepare('UPDATE memories SET category=?,memory_key=?,value=?,importance=?,user_approved=?,is_active=?,updated_at=? WHERE id=?').bind(next.category,next.key,next.value,next.importance,next.userApproved,next.isActive,new Date().toISOString(),id).run();
      return json({memory:mapMemory(await env.DB.prepare('SELECT * FROM memories WHERE id=?').bind(id).first<Json>())});
    }
    if(method==='DELETE'){await env.DB.prepare('UPDATE memories SET is_active=0 WHERE id=?').bind(id).run();return json({success:true,id});}
  }
  if(path==='/api/settings') {
    if(method==='GET')return json({settings:await getSettings(env)});
    if(method==='PUT'||method==='PATCH') {
      const b=await readJson(request),old=await getSettings(env),allowed=['ownerName','preferredLanguage','voiceSpeed','voiceVolume','wakeWordsEnabled','continuousConversation','sleepModeActive','highThinkingMode','silenceTimeoutMs','selectedMicDevice','selectedSpeakerDevice'];
      for(const key of allowed) if(b[key]!==undefined) old[key]=b[key];
      if(!['urdu','roman_urdu','english'].includes(old.preferredLanguage))return json({error:'Invalid preferred language.'},400);
      await env.DB.prepare('INSERT INTO settings(id,data_json,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at').bind('owner',JSON.stringify(old),new Date().toISOString()).run();
      return json({settings:old});
    }
  }
  if(path==='/api/whatsapp/messages'&&method==='GET') {
    const rows=await env.DB.prepare('SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 200').all<Json>();
    return json({messages:(rows.results||[]).map((r: Json)=>({id:r.id,contactName:r.contact_name,contactIdentifier:r.contact_identifier,messageText:r.message_text,status:r.status,userConfirmed:Boolean(r.user_confirmed),isSensitive:Boolean(r.is_sensitive),sentAt:r.sent_at,createdAt:r.created_at}))});
  }
  if(path==='/api/whatsapp/draft'&&method==='POST') {
    const b=await readJson(request);
    if(typeof b.contactName!=='string'||!b.contactName.trim()||typeof b.messageText!=='string'||!b.messageText.trim()||b.messageText.length>4000)return json({error:'Valid contact and message text are required.'},400);
    const phone=String(b.contactIdentifier||'').replace(/[\s()-]/g,'');
    if(!/^\+?[1-9]\d{9,14}$/.test(phone))return json({error:'A valid E.164 contact number is required.'},400);
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare('INSERT INTO whatsapp_messages(id,contact_name,contact_identifier,message_text,status,user_confirmed,is_sensitive,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,b.contactName.trim().slice(0,120),phone,b.messageText.trim(), 'pending',0,Boolean(b.isSensitive)?1:0,now).run();
    return json({draft:{id,contactName:b.contactName.trim(),contactIdentifier:phone,messageText:b.messageText.trim(),status:'pending',userConfirmed:false,isSensitive:Boolean(b.isSensitive),createdAt:now}},201);
  }
  if(path==='/api/whatsapp/send'&&method==='POST') {
    const b=await readJson(request);
    if(typeof b.id!=='string'||b.confirmed!==true)return json({error:'Explicit confirmation is required before sending.'},400);
    const msg=await env.DB.prepare('SELECT * FROM whatsapp_messages WHERE id=?').bind(b.id).first<Json>();
    if(!msg)return json({success:false,messageId:b.id,deliveryStatus:'failed',notice:'Message draft not found.'},404);
    if(!env.WHATSAPP_API_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID)return json({success:false,messageId:b.id,deliveryStatus:'not_configured',provider:'local_store',notice:'WhatsApp Cloud API credentials are not configured. Draft remains saved.'},503);
    const version=env.WHATSAPP_API_VERSION||'v23.0';
    const send=await fetch(`https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_API_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:String(msg.contact_identifier).replace(/\D/g,''),type:'text',text:{body:msg.message_text}}),signal:AbortSignal.timeout(15000)});
    const data=await send.json() as Json;
    if(!send.ok||!data.messages?.[0]?.id)return json({success:false,messageId:b.id,deliveryStatus:'failed',provider:'whatsapp_cloud_api',notice:'WhatsApp provider rejected the message.'},502);
    await env.DB.prepare('UPDATE whatsapp_messages SET status=?,user_confirmed=1,sent_at=?,provider_message_id=? WHERE id=?').bind('sent',new Date().toISOString(),data.messages[0].id,b.id).run();
    return json({success:true,messageId:b.id,providerMessageId:data.messages[0].id,deliveryStatus:'sent',provider:'whatsapp_cloud_api',notice:'WhatsApp accepted the message for dispatch.'});
  }
  if(path==='/api/usage'&&method==='GET') {
    const rows=await env.DB.prepare('SELECT * FROM usage_logs ORDER BY created_at DESC LIMIT 100').all<Json>();
    const totals=await env.DB.prepare('SELECT COUNT(*) AS totalRequests, SUM(input_tokens) AS inputTokens, SUM(output_tokens) AS outputTokens FROM usage_logs').first<Json>();
    return json({usage:{totalRequests:totals?.totalRequests||0,totalInputTokens:totals?.inputTokens||0,totalOutputTokens:totals?.outputTokens||0,estimatedCostUsd:0,recentLogs:rows.results||[]}});
  }
  if(path==='/api/automation/history'&&method==='GET') {
    const rows=await env.DB.prepare('SELECT * FROM automation_history ORDER BY started_at DESC LIMIT 100').all<Json>();
    return json({history:rows.results||[]});
  }
  return json({error:'API route not found.'},404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) {
      if(request.method==='OPTIONS')return preflight(request,env);
      const origin=originAllowed(request,env);
      const limit=await checkRateLimit(env.DB,`ip:${getClientKey(request)}`,120,60).catch(()=>({allowed:false,retryAfterSeconds:60}));
      if(!limit.allowed)return json({error:'Rate limit exceeded.',status:'rate_limited',retryAfterSeconds:limit.retryAfterSeconds},429,corsHeaders(origin));
      if(url.pathname==='/api/auth/session') {
        const loginLimit=await checkRateLimit(env.DB,`login:${getClientKey(request)}`,5,300).catch(()=>({allowed:false,retryAfterSeconds:300}));
        if(!loginLimit.allowed)return json({error:'Too many login attempts. Try again later.'},429,corsHeaders(origin));
      }
      if(url.pathname==='/api/chat'||url.pathname==='/api/voice/tts') {
        const specific=await checkRateLimit(env.DB,`ai:${getClientKey(request)}`,30,60).catch(()=>({allowed:false,retryAfterSeconds:60}));
        if(!specific.allowed)return json({error:'AI rate limit exceeded.',status:'rate_limited',retryAfterSeconds:specific.retryAfterSeconds},429,corsHeaders(origin));
      }
      try {
        const response=await handleApi(request,env);
        const headers=new Headers(response.headers);
        corsHeaders(origin).forEach((v,k)=>headers.set(k,v));
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      } catch(error) {
        const reason=error instanceof Error?error.message:'internal_error';
        const status=error instanceof SyntaxError?400:reason==='content_type'?415:reason==='too_large'?413:reason==='invalid_body'?400:500;
        return json({error:status===500?'Internal server error.':reason},status,corsHeaders(origin));
      }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event: { cron: string }, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil((async()=>{
      await createMemoryBackup(env.DB);
      await cleanupRateLimits(env.DB);
    })());
  },
};
