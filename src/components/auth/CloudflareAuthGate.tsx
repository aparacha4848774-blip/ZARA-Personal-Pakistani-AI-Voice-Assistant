import React, { useEffect, useState } from 'react';
import { setStoredAuthToken } from '../../utils/apiClient';

type GateState = 'checking' | 'local' | 'login' | 'unconfigured' | 'authenticated';

export function CloudflareAuthGate({ children }: { children: React.ReactNode }) {
  const [state,setState]=useState<GateState>('checking');
  const [token,setToken]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const health=await fetch('/api/health',{headers:{accept:'application/json'}});
        const healthData:any=await health.json().catch(()=>null);
        if(healthData?.runtime!=='cloudflare-workers'){if(active)setState('local');return;}
        // The Worker uses a Secure, HttpOnly cookie. Remove any legacy
        // localStorage bearer token so it is not exposed to browser scripts.
        setStoredAuthToken(null);
        const response=await fetch('/api/auth/status',{headers:{accept:'application/json'},credentials:'same-origin'});
        const auth:any=await response.json();
        if(!active)return;
        if(!auth.configured)setState('unconfigured');
        else setState(auth.authenticated?'authenticated':'login');
      } catch {
        if(active)setState('local');
      }
    })();
    return ()=>{active=false;};
  },[]);

  const login=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');
    if(token.length<32){setError('Owner access key must be at least 32 characters.');return;}
    setBusy(true);
    try{
      const response=await fetch('/api/auth/session',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({token})});
      const data:any=await response.json();
      if(!response.ok)throw new Error(data.error||'Sign in failed.');
      setToken('');
      setState('authenticated');
    }catch(err){setError(err instanceof Error?err.message:'Unable to sign in.');}
    finally{setBusy(false);}
  };

  if(state==='checking')return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-zinc-400">Connecting to ZARA…</div>;
  if(state==='local'||state==='authenticated')return <>{children}</>;
  if(state==='unconfigured')return <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-6"><div className="w-full max-w-md rounded-3xl border border-amber-400/20 bg-[#111118] p-8 shadow-2xl"><div className="text-amber-300 text-sm font-semibold tracking-widest">ZARA SECURITY SETUP</div><h1 className="mt-3 text-2xl font-bold">Owner access is not configured</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Set a secret named <code className="text-amber-200">ZARA_AUTH_TOKEN</code> in Cloudflare Worker settings. Use a unique random value with at least 32 characters, then reload this page.</p><p className="mt-4 text-xs text-zinc-500">Do not paste your secret into GitHub or public files.</p></div></div>;
  return <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-6"><form onSubmit={login} className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-[#111118] p-8 shadow-2xl"><div className="text-violet-300 text-sm font-semibold tracking-widest">ZARA • PRIVATE ASSISTANT</div><h1 className="mt-3 text-3xl font-bold">Welcome back, Boss</h1><p className="mt-2 text-sm text-zinc-400">Enter your owner access key to unlock your private memories, settings and WhatsApp records.</p><label className="mt-7 block text-sm text-zinc-300" htmlFor="zara-owner-key">Owner access key</label><input id="zara-owner-key" type="password" autoComplete="current-password" value={token} onChange={e=>setToken(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-violet-400" placeholder="Enter your private access key" required/><button disabled={busy} type="submit" className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold transition hover:bg-violet-500 disabled:opacity-50">{busy?'Verifying…':'Unlock ZARA'}</button>{error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}<p className="mt-5 text-xs text-zinc-500">Your key is exchanged for a Secure, HttpOnly session cookie and is not stored in browser local storage.</p></form></div>;
}
