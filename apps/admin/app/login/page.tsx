"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "../../components/ui/button";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Unable to sign in");
      if (body.data?.role !== "SUPER_ADMIN") {
        await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
        throw new Error("Super admin access is required");
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally { setLoading(false); }
  }

  return <main className="admin-login-page">
    <div className="admin-login-shell">
      <section className="admin-login-intro">
        <div className="admin-login-logo"><span>H</span><strong>Hyaw</strong></div>
        <div><span className="admin-login-kicker">HYAW CRM</span><h1>Run the platform from one secure place.</h1><p>Manage businesses, subscriptions, users and platform permissions from the Hyaw administration workspace.</p></div>
        <div className="admin-security-note"><LockKeyhole size={18}/><span>Restricted to Hyaw super administrators</span></div>
      </section>
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-heading"><span>PLATFORM ADMINISTRATION</span><h2>Welcome back</h2><p>Enter your administrator credentials to continue.</p></div>
        <label>Email address<input name="email" type="email" placeholder="admin@hyaw.com" required autoComplete="email"/></label>
        <label>Password<div className="admin-password-field"><input name="password" type={showPassword?"text":"password"} placeholder="Enter your password" required autoComplete="current-password"/><button type="button" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        {error?<p className="admin-login-error">{error}</p>:null}
        <Button type="submit" disabled={loading}>{loading?"Signing in...":"Sign in to Admin"}</Button>
        <p className="admin-login-help">Access is logged and protected by your assigned platform role.</p>
      </form>
    </div>
  </main>;
}
