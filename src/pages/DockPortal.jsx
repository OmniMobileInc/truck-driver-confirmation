import React,{useEffect,useState} from "react";
import {createClient} from "@supabase/supabase-js";
const url=import.meta.env.VITE_SUPABASE_URL;
const anon=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url&&anon?createClient(url,anon):null;
export default function DockPortal(){
 const[email,setEmail]=useState(""),[session,setSession]=useState(null),[data,setData]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!session)return;let active=true;setBusy(true);fetch("/api/facility_queue",{headers:{Authorization:"Bearer "+session.access_token}}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Queue unavailable");return j}).then(j=>{if(active){setData(j);setError("")}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[session]);
 const style={background:"#101923",color:"#f2f6fa",minHeight:"100vh",padding:"clamp(20px,5vw,55px)",fontFamily:"Arial,sans-serif"};
 const input={padding:12,borderRadius:8,width:"min(360px,100%)",marginRight:8};
 if(!supabase)return <main style={style}><h1>QueCab AdbS — Dock Portal</h1><p>Setup pending: configure Supabase public URL and anon key for this application.</p></main>;
 return <main style={style}><h1>QueCab AdbS™ — Dock Portal</h1><p>Facility access is free. Brokers continue using their existing AdbS subscription.</p>
 {!session?<section><h2>Facility sign in</h2><p>Authorized facility personnel only. Receive a secure sign-in link by email.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);const{error:e2}=await supabase.auth.signInWithOtp({email,emailRedirectTo:location.origin+"/dock"});setError(e2?.message||"Check your email for your sign-in link.");setBusy(false)}}><input style={input} type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Work email"/><button disabled={busy}>Send sign-in link</button></form></section>:
 <section><button onClick={()=>supabase.auth.signOut()}>Sign out</button><h2>Assigned verification queue</h2>{busy&&<p>Loading…</p>}{data&&<><p>Facility: {data.facility_id}</p><table style={{borderSpacing:"0 14px",width:"100%",textAlign:"left"}}><thead><tr><th>Load ID</th><th>Carrier</th><th>Status</th><th>Verification</th></tr></thead><tbody>{data.loads.map(l=><tr key={l.token}><td>{l.load_id||"—"}</td><td>{l.carrier_company||"—"}</td><td>{l.status}</td><td><a style={{color:"#9bc8ff"}} href={"/v.html?t="+encodeURIComponent(l.token)}>Open verification</a></td></tr>)}</tbody></table>{!data.loads.length&&<p>No assigned loads yet.</p>}</>}</section>}
 {error&&<p role="alert">{error}</p>}<p style={{opacity:.7,marginTop:30}}>Beta preview — access requires verified facility membership.</p></main>
}
