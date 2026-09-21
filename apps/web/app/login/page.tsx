"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const apiUrl=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,"")??"http://localhost:4000/api";

export default function LoginPage(){
 const router=useRouter(); const[error,setError]=useState(""); const[loading,setLoading]=useState(false); const[showPassword,setShowPassword]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setLoading(true);setError("");const data=new FormData(event.currentTarget);try{const response=await fetch(`${apiUrl}/auth/login`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:data.get("email"),password:data.get("password")})});const body=await response.json();if(!response.ok)throw new Error(body.message??"Unable to sign in");router.replace("/");router.refresh()}catch(err){setError(err instanceof Error?err.message:"Unable to sign in")}finally{setLoading(false)}}
 return <main className="authPage"><div className="authShell"><section className="authIntro"><div className="authLogo"><span>H</span><strong>Hyaw</strong></div><div><p className="eyebrow">HYAW CRM</p><h1>Keep every lead moving.</h1><p>Calls, follow-ups, opportunities and your sales pipeline in one focused workspace.</p></div><div className="authIntroMeta"><span>Sales</span><span>Calling</span><span>Follow-ups</span></div></section><section className="authCard"><div className="authHeading"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to your workspace</h2><p>Use your Hyaw seller, caller or administrator account.</p></div><form onSubmit={submit} className="authForm"><div><Label htmlFor="email">Email address</Label><Input id="email" name="email" type="email" placeholder="you@company.com" required autoComplete="email"/></div><div><Label htmlFor="password">Password</Label><div className="authPassword"><Input id="password" name="password" type={showPassword?"text":"password"} placeholder="Enter your password" required autoComplete="current-password"/><button type="button" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>{error?<p className="authError">{error}</p>:null}<Button type="submit" disabled={loading}>{loading?"Signing in...":"Sign in"}</Button></form></section></div></main>;
}
