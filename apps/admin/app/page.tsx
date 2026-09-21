"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  MoreVertical,
  Pencil,
  Settings2,
  UserRoundCog,
  Ban,
  LogOut,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

type Section =
  | "overview"
  | "businesses"
  | "subscriptions"
  | "users"
  | "permissions"
  | "audit"
  | "settings";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  userCount: number;
  plan: string;
  subscriptionStatus: string | null;
};

type Overview = {
  businesses: number;
  activeUsers: number;
  activeSubscriptions: number;
  trials: number;
};

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["businesses", "Businesses", Building2],
  ["subscriptions", "Subscriptions", CreditCard],
  ["users", "Users", Users],
  ["permissions", "Permissions", ShieldCheck],
  ["audit", "Audit log", Activity],
  ["settings", "Platform settings", Settings],
] as const;

export default function AdminPage() {
  const [section, setSection] = useState<Section>("overview");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [overview, setOverview] = useState<Overview>({
    businesses: 0,
    activeUsers: 0,
    activeSubscriptions: 0,
    trials: 0,
  });
  const [moduleData, setModuleData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<{ firstName?: string; lastName?: string; email?: string; role?: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [businessMenu, setBusinessMenu] = useState<string | null>(null);
  const [businessAction, setBusinessAction] = useState<{ tenant: Tenant; type: "edit" | "subscription" | "users" | "roles" | "settings" | "status" } | null>(null);
  const [apiState, setApiState] = useState<"loading" | "online" | "offline">(
    "loading",
  );

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { credentials: "include" }).then((response) => {
        if (response.status === 401 || response.status === 403) throw new Error("ADMIN_AUTH");
        if (!response.ok) throw new Error("ADMIN_AUTH");
        return response.json();
      }),
      fetch(`${apiUrl}/health`, { credentials: "include" }).then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      }),
      fetch(`${apiUrl}/admin/overview`, { credentials: "include" }).then((response) => {
        if (response.status === 401 || response.status === 403) throw new Error("ADMIN_AUTH");
        if (!response.ok) throw new Error("Overview unavailable");
        return response.json();
      }),
      fetch(`${apiUrl}/admin/tenants`, { credentials: "include" }).then((response) => {
        if (response.status === 401 || response.status === 403) throw new Error("ADMIN_AUTH");
        if (!response.ok) throw new Error("Businesses unavailable");
        return response.json();
      }),
    ])
      .then(([meResponse, , overviewResponse, tenantResponse]) => {
        setCurrentUser(meResponse.data);
        setOverview(overviewResponse.data);
        setTenants(tenantResponse.data);
        setApiState("online");
      })
      .catch((error) => {
        if (error instanceof Error && error.message === "ADMIN_AUTH") {
          window.location.assign("/login");
          return;
        }
        setApiState("offline");
      });
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      window.location.replace("/login");
    }
  }

  async function refreshAdminData() {
    const [overviewResponse, tenantResponse] = await Promise.all([
      fetch(`${apiUrl}/admin/overview`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${apiUrl}/admin/tenants`, { credentials: "include" }).then((r) => r.json()),
    ]);
    setOverview(overviewResponse.data);
    setTenants(tenantResponse.data);
  }

  useEffect(() => {
    if (["subscriptions","users","permissions","audit","settings"].includes(section)) {
      setModuleLoading(true); setModuleData(null);
      fetch(`${apiUrl}/admin/${section}`, { credentials: "include" })
        .then(async r => {
          const contentType = r.headers.get("content-type") ?? "";
          const body = contentType.includes("application/json") ? await r.json() : null;
          if (r.status === 401 || r.status === 403) throw new Error("ADMIN_AUTH");
          if (!r.ok) throw new Error(body?.message ?? `Could not load ${section} (HTTP ${r.status})`);
          if (!body) throw new Error(`Invalid API response for ${section}`);
          return body;
        })
        .then(body => setModuleData(body.data))
        .catch(error => {
          if (error instanceof Error && error.message === "ADMIN_AUTH") { window.location.assign("/login"); return; }
          setModuleData({ error: error instanceof Error ? error.message : "Could not load module" });
        })
        .finally(() => setModuleLoading(false));
    }
  }, [section]);

  const title = useMemo(
    () => nav.find(([key]) => key === section)?.[1] ?? "Overview",
    [section],
  );

  return (
    <main>
      <aside>
        <h1>
          Hyaw <span>Admin</span>
        </h1>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <Button
              key={key}
              type="button"
              variant={section === key ? "default" : "ghost"}
              onClick={() => setSection(key)}
            >
              <Icon size={16} />
              {label}
            </Button>
          ))}
        </nav>
        <div className="admin-sidebar-account">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">{currentUser?.firstName?.[0] ?? currentUser?.email?.[0]?.toUpperCase() ?? "A"}</div>
            <div><strong>{[currentUser?.firstName,currentUser?.lastName].filter(Boolean).join(" ") || "Super Admin"}</strong><small>{currentUser?.email ?? "Signed in"}</small></div>
          </div>
          <Button type="button" variant="outline" onClick={logout} disabled={loggingOut}>
            <LogOut size={15}/>{loggingOut ? "Signing out..." : "Log out"}
          </Button>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <small>Platform administration</small>
            <h2>{title}</h2>
            <p>
              {apiState === "online"
                ? "Connected to the Hyaw CRM API."
                : apiState === "offline"
                  ? `API cannot be reached at ${apiUrl}. Check the API process and PostgreSQL.`
                  : "Checking API connection..."}
            </p>
          </div>
          {section === "businesses" || section === "overview" ? (
            <Button type="button" onClick={() => setSection("businesses")}>
              + Add business
            </Button>
          ) : null}
        </header>

        {section === "overview" ? (
          <>
            <div className="cards">
              <Metric label="Businesses" value={overview.businesses} detail="All tenants" />
              <Metric label="Active users" value={overview.activeUsers} detail="Across all tenants" />
              <Metric
                label="Subscriptions"
                value={overview.activeSubscriptions}
                detail="Currently active"
              />
              <Metric label="Trials" value={overview.trials} detail="Trial businesses" />
            </div>
            <BusinessesTable tenants={tenants} openMenu={businessMenu} setOpenMenu={setBusinessMenu} onAction={(tenant, type) => { setBusinessMenu(null); setBusinessAction({ tenant, type }); }} />
          </>
        ) : section === "businesses" ? (
          <BusinessesTable tenants={tenants} openMenu={businessMenu} setOpenMenu={setBusinessMenu} onAction={(tenant, type) => { setBusinessMenu(null); setBusinessAction({ tenant, type }); }} />
        ) : (
          <AdminModule section={section} data={moduleData} loading={moduleLoading} reload={() => setSection(section)} />
        )}
      </section>
      {businessAction ? <BusinessActionModal action={businessAction} onClose={() => setBusinessAction(null)} onSaved={refreshAdminData} /> : null}
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardContent>
        <span>{label}</span>
        <b>{value}</b>
        <small>{detail}</small>
      </CardContent>
    </Card>
  );
}

function BusinessesTable({ tenants, openMenu, setOpenMenu, onAction }: { tenants: Tenant[]; openMenu: string | null; setOpenMenu: (id: string | null) => void; onAction: (tenant: Tenant, type: "edit" | "subscription" | "users" | "roles" | "settings" | "status") => void }) {
  return (
    <Card>
      <CardHeader className="head">
        <div>
          <CardTitle>Businesses</CardTitle>
          <CardDescription>Tenant activity from the backend</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="actions-head">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length ? (
              tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <strong>{tenant.name}</strong>
                  </TableCell>
                  <TableCell>{tenant.userCount}</TableCell>
                  <TableCell>{tenant.plan}</TableCell>
                  <TableCell>
                    <Badge>{tenant.status}</Badge>
                  </TableCell>
                  <TableCell className="business-actions">
                    <button className="business-menu-trigger" type="button" aria-label={`Actions for ${tenant.name}`} onClick={() => setOpenMenu(openMenu === tenant.id ? null : tenant.id)}>
                      <MoreVertical size={18} />
                    </button>
                    {openMenu === tenant.id ? (
                      <div className="business-menu">
                        <button type="button" onClick={() => onAction(tenant, "edit")}><Pencil size={15}/><span><strong>Edit business</strong><small>Name, slug and status</small></span></button>
                        <button type="button" onClick={() => onAction(tenant, "subscription")}><CreditCard size={15}/><span><strong>Subscription</strong><small>Plan, seats and billing status</small></span></button>
                        <button type="button" onClick={() => onAction(tenant, "users")}><UserRoundCog size={15}/><span><strong>Manage users</strong><small>Members and access</small></span></button>
                        <button type="button" onClick={() => onAction(tenant, "roles")}><ShieldCheck size={15}/><span><strong>Roles & permissions</strong><small>Business access rules</small></span></button>
                        <button type="button" onClick={() => onAction(tenant, "settings")}><Settings2 size={15}/><span><strong>Business settings</strong><small>Workspace configuration</small></span></button>
                        <div className="business-menu-separator"/>
                        <button type="button" className="danger" onClick={() => onAction(tenant, "status")}><Ban size={15}/><span><strong>{tenant.status === "SUSPENDED" ? "Reactivate business" : "Suspend business"}</strong><small>Control workspace access</small></span></button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5}>
                  No businesses yet. The table no longer uses hard-coded demo data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdminModule({ section, data, loading, reload: _reload }: { section: Section; data: any; loading: boolean; reload: () => void }) {
  if (loading) return <Card><CardContent><p>Loading {section}...</p></CardContent></Card>;
  if (data?.error) return <Card><CardContent><p className="business-form-error">{data.error}</p></CardContent></Card>;
  if (section === "subscriptions") return <Card><CardHeader><CardTitle>Subscriptions</CardTitle><CardDescription>Plans and seat allocation stored in PostgreSQL.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Plan</TableHead><TableHead>Seats</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead></TableRow></TableHeader><TableBody>{(data??[]).map((s:any)=><TableRow key={s.id}><TableCell><strong>{s.tenant.name}</strong></TableCell><TableCell>{s.plan}</TableCell><TableCell>{s.seats}</TableCell><TableCell><Badge>{s.status}</Badge></TableCell><TableCell>{new Date(s.startsAt).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
  if (section === "users") return <Card><CardHeader><CardTitle>Platform users</CardTitle><CardDescription>Users, businesses, roles and account access.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Business</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{(Array.isArray(data)?data:[]).map((u:any)=>{const memberships=Array.isArray(u.tenants)?u.tenants:[];return <TableRow key={u.id}><TableCell><strong>{[u.firstName,u.lastName].filter(Boolean).join(" ")||"Unnamed user"}</strong></TableCell><TableCell>{u.email??"—"}</TableCell><TableCell>{memberships.map((m:any)=>m.tenant?.name).filter(Boolean).join(", ")||"Platform"}</TableCell><TableCell>{memberships.map((m:any)=>m.role?.name).filter(Boolean).join(", ")||"—"}</TableCell><TableCell><Badge>{u.active===false?"DISABLED":"ACTIVE"}</Badge></TableCell><TableCell>{u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</TableCell><TableCell><Button type="button" variant="outline" onClick={async()=>{const r=await fetch(`${apiUrl}/admin/users/${u.id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!u.active})});if(r.ok) window.location.reload();}}>{u.active?"Disable":"Enable"}</Button></TableCell></TableRow>})}</TableBody></Table></CardContent></Card>;
  if (section === "permissions") return <Card><CardHeader><CardTitle>Permissions</CardTitle><CardDescription>Platform permission registry used by tenant roles.</CardDescription></CardHeader><CardContent><div className="permission-catalog">{(data??[]).map((p:any)=><div key={p.id}><code>{p.key}</code><span>{p.description??"No description"}</span></div>)}</div></CardContent></Card>;
  if (section === "audit") return <Card><CardHeader><CardTitle>Audit log</CardTitle><CardDescription>Recent Super Admin changes recorded by the backend.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Business</TableHead><TableHead>Time</TableHead></TableRow></TableHeader><TableBody>{(Array.isArray(data)?data:[]).map((l:any)=><TableRow key={l.id}><TableCell><strong>{typeof l.action==="string"?l.action.replaceAll("_"," "):"UNKNOWN ACTION"}</strong></TableCell><TableCell>{l.entity??"Unknown"}</TableCell><TableCell>{l.tenant?.name??"Platform"}</TableCell><TableCell>{l.createdAt?new Date(l.createdAt).toLocaleString():"—"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
  if (section === "settings") return <PlatformSettings data={data} />;
  return null;
}
function PlatformSettings({data}:{data:any}) {
 const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setMessage("");const f=new FormData(e.currentTarget);const body={platformName:f.get("platformName"),supportEmail:f.get("supportEmail"),defaultPlan:f.get("defaultPlan"),defaultSeats:Number(f.get("defaultSeats")),allowTrials:f.get("allowTrials")==="on",trialDays:Number(f.get("trialDays"))};const r=await fetch(`${apiUrl}/admin/settings`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});setMessage(r.ok?"Settings saved":"Could not save settings");setSaving(false);}
 return <div className="platform-settings-layout"><Card><CardHeader><CardTitle>General</CardTitle><CardDescription>Defaults for the whole Hyaw CRM platform.</CardDescription></CardHeader><CardContent><form className="business-form" onSubmit={submit}><div className="form-grid"><label>Platform name<input name="platformName" defaultValue={data?.platformName??"Hyaw CRM"} required/></label><label>Support email<input name="supportEmail" type="email" defaultValue={data?.supportEmail??"support@hyaw.tech"} required/></label><label>Default plan<input name="defaultPlan" defaultValue={data?.defaultPlan??"Starter"} required/></label><label>Default seats<input name="defaultSeats" type="number" min="1" defaultValue={data?.defaultSeats??5} required/></label><label>Trial days<input name="trialDays" type="number" min="0" defaultValue={data?.trialDays??14} required/></label></div><label className="toggle-row"><span><strong>Allow trials</strong><small>Allow newly created businesses to start on a trial.</small></span><input name="allowTrials" type="checkbox" defaultChecked={data?.allowTrials??true}/></label>{message?<p className="settings-message">{message}</p>:null}<div className="business-form-actions"><Button disabled={saving} type="submit">{saving?"Saving...":"Save platform settings"}</Button></div></form></CardContent></Card></div>;
}

type BusinessAction = { tenant: Tenant; type: "edit" | "subscription" | "users" | "roles" | "settings" | "status" };
function BusinessActionModal({ action, onClose, onSaved }: { action: BusinessAction; onClose: () => void; onSaved: () => Promise<void> }) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [data,setData]=useState<any>([]);
  useEffect(()=>{ if(["users","roles","settings"].includes(action.type)) fetch(`${apiUrl}/admin/tenants/${action.tenant.id}/${action.type}`,{credentials:"include"}).then(r=>r.json()).then(b=>setData(b.data??[])).catch(()=>setError("Could not load data")); },[action]);
  async function save(event: React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const f=new FormData(event.currentTarget);let path=`/admin/tenants/${action.tenant.id}`;let body:any={};
    if(action.type==="edit") body={name:f.get("name"),slug:f.get("slug"),status:f.get("status")};
    if(action.type==="settings"){path+="/settings";body={timezone:f.get("timezone"),currency:f.get("currency"),locale:f.get("locale"),leadAssignment:f.get("leadAssignment"),callerTracking:f.get("callerTracking")==="on"};}
    if(action.type==="subscription"){path+="/subscription";body={plan:f.get("plan"),seats:Number(f.get("seats")),status:f.get("subscriptionStatus")};}
    if(action.type==="status") body={status:action.tenant.status==="SUSPENDED"?"ACTIVE":"SUSPENDED"};
    try{const r=await fetch(apiUrl+path,{method:action.type==="settings"?"PUT":"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw new Error(b.message??"Update failed");await onSaved();onClose();}catch(e){setError(e instanceof Error?e.message:"Update failed")}finally{setBusy(false)}
  }
  const title={edit:"Edit business",subscription:"Subscription",users:"Manage users",roles:"Roles & permissions",settings:"Business settings",status:action.tenant.status==="SUSPENDED"?"Reactivate business":"Suspend business"}[action.type];
  return <div className="business-modal-backdrop" onMouseDown={onClose}><section className="business-modal" onMouseDown={e=>e.stopPropagation()}><div className="business-modal-head"><div><small>{action.tenant.name}</small><h3>{title}</h3></div><button type="button" onClick={onClose}>×</button></div>
    {action.type==="users"?<div className="business-list">{data.map((m:any)=><div key={m.id}><span><strong>{m.user.firstName} {m.user.lastName}</strong><small>{m.user.email}</small></span><div className="member-actions"><select defaultValue={m.role?.id??""} onChange={async e=>{await fetch(`${apiUrl}/admin/tenants/${action.tenant.id}/users/${m.id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({roleId:e.target.value||null})});}}><option value="">No role</option><option value={m.role?.id??""}>{m.role?.name??"Current role"}</option></select><button type="button" onClick={async()=>{await fetch(`${apiUrl}/admin/tenants/${action.tenant.id}/users/${m.id}`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!m.user.active})});setData((old:any[])=>old.map(x=>x.id===m.id?{...x,user:{...x.user,active:!x.user.active}}:x));}}>{m.user.active?"Disable":"Enable"}</button></div></div>)}</div>
    :action.type==="roles"?<div className="role-grid">{data.roles?.map((r:any)=><section className="role-card" key={r.id}><div><strong>{r.name}</strong><small>{r._count.members} users · {r.permissions.length} permissions</small></div><div className="permission-grid">{data.permissions?.map((p:any)=><label key={p.id}><input type="checkbox" defaultChecked={r.permissions.some((rp:any)=>rp.permission.id===p.id)} onChange={async e=>{const current=r.permissions.map((rp:any)=>rp.permission.id);const ids=e.target.checked?[...new Set([...current,p.id])]:current.filter((id:string)=>id!==p.id);await fetch(`${apiUrl}/admin/tenants/${action.tenant.id}/roles/${r.id}/permissions`,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({permissionIds:ids})});r.permissions=data.permissions.filter((x:any)=>ids.includes(x.id)).map((permission:any)=>({permission}));}}/><span>{p.description??p.key}</span></label>)}</div></section>)}</div>
    :<form className="business-form" onSubmit={save}>
      {action.type==="edit"&&<><div className="form-section-title"><strong>Business identity</strong><small>Core tenant information used across the platform.</small></div><label>Business name<input name="name" defaultValue={action.tenant.name} required/></label><label>Workspace slug<input name="slug" defaultValue={action.tenant.slug} required/></label><label>Business status<select name="status" defaultValue={action.tenant.status}><option>ACTIVE</option><option>TRIAL</option><option>SUSPENDED</option><option>CANCELLED</option></select></label></>}
      {action.type==="settings"&&<><div className="form-section-title"><strong>Workspace defaults</strong><small>Operational defaults applied inside this business.</small></div><div className="form-grid"><label>Timezone<input name="timezone" defaultValue={data.timezone??"Africa/Addis_Ababa"} required/></label><label>Currency<input name="currency" defaultValue={data.currency??"ETB"} maxLength={3} required/></label><label>Locale<input name="locale" defaultValue={data.locale??"en"} required/></label><label>Lead assignment<select name="leadAssignment" defaultValue={data.leadAssignment??"manual"}><option value="manual">Manual</option><option value="round_robin">Round robin</option></select></label></div><label className="toggle-row"><span><strong>Caller activity tracking</strong><small>Record caller activity for reporting and performance tracking.</small></span><input name="callerTracking" type="checkbox" defaultChecked={data.callerTracking??true}/></label></>}
      {action.type==="subscription"&&<><label>Plan<input name="plan" defaultValue={action.tenant.plan} required/></label><label>Seats<input name="seats" type="number" min="1" defaultValue={Math.max(action.tenant.userCount,1)} required/></label><label>Subscription status<select name="subscriptionStatus" defaultValue={action.tenant.subscriptionStatus??"ACTIVE"}><option>ACTIVE</option><option>TRIAL</option><option>PAST_DUE</option><option>CANCELLED</option></select></label></>}
      {action.type==="status"&&<p className="business-confirm">This will {action.tenant.status==="SUSPENDED"?"restore":"block"} workspace access for <strong>{action.tenant.name}</strong>.</p>}
      {error?<p className="business-form-error">{error}</p>:null}<div className="business-form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy?"Saving...":action.type==="status"?(action.tenant.status==="SUSPENDED"?"Reactivate":"Suspend"):"Save changes"}</Button></div>
    </form>}
  </section></div>;
}
