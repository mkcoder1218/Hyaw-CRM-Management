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
  const [businessMenu, setBusinessMenu] = useState<string | null>(null);
  const [businessAction, setBusinessAction] = useState<{ tenant: Tenant; type: "edit" | "subscription" | "users" | "roles" | "settings" | "status" } | null>(null);
  const [apiState, setApiState] = useState<"loading" | "online" | "offline">(
    "loading",
  );

  useEffect(() => {
    Promise.all([
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
      .then(([, overviewResponse, tenantResponse]) => {
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

  async function refreshAdminData() {
    const [overviewResponse, tenantResponse] = await Promise.all([
      fetch(`${apiUrl}/admin/overview`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${apiUrl}/admin/tenants`, { credentials: "include" }).then((r) => r.json()),
    ]);
    setOverview(overviewResponse.data);
    setTenants(tenantResponse.data);
  }

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
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                This section is connected to admin navigation and ready for its
                platform-management workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                The backend foundation is running through the admin API. Add
                module-specific actions here as the platform rules are defined.
              </p>
            </CardContent>
          </Card>
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

type BusinessAction = { tenant: Tenant; type: "edit" | "subscription" | "users" | "roles" | "settings" | "status" };
function BusinessActionModal({ action, onClose, onSaved }: { action: BusinessAction; onClose: () => void; onSaved: () => Promise<void> }) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [data,setData]=useState<any[]>([]);
  useEffect(()=>{ if(action.type==="users"||action.type==="roles") fetch(`${apiUrl}/admin/tenants/${action.tenant.id}/${action.type}`,{credentials:"include"}).then(r=>r.json()).then(b=>setData(b.data??[])).catch(()=>setError("Could not load data")); },[action]);
  async function save(event: React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const f=new FormData(event.currentTarget);let path=`/admin/tenants/${action.tenant.id}`;let body:any={};
    if(action.type==="edit"||action.type==="settings") body={name:f.get("name"),slug:f.get("slug"),status:f.get("status")};
    if(action.type==="subscription"){path+="/subscription";body={plan:f.get("plan"),seats:Number(f.get("seats")),status:f.get("subscriptionStatus")};}
    if(action.type==="status") body={status:action.tenant.status==="SUSPENDED"?"ACTIVE":"SUSPENDED"};
    try{const r=await fetch(apiUrl+path,{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw new Error(b.message??"Update failed");await onSaved();onClose();}catch(e){setError(e instanceof Error?e.message:"Update failed")}finally{setBusy(false)}
  }
  const title={edit:"Edit business",subscription:"Subscription",users:"Manage users",roles:"Roles & permissions",settings:"Business settings",status:action.tenant.status==="SUSPENDED"?"Reactivate business":"Suspend business"}[action.type];
  return <div className="business-modal-backdrop" onMouseDown={onClose}><section className="business-modal" onMouseDown={e=>e.stopPropagation()}><div className="business-modal-head"><div><small>{action.tenant.name}</small><h3>{title}</h3></div><button type="button" onClick={onClose}>×</button></div>
    {action.type==="users"?<div className="business-list">{data.map((m:any)=><div key={m.id}><span><strong>{m.user.firstName} {m.user.lastName}</strong><small>{m.user.email}</small></span><Badge>{m.role?.name??"No role"}</Badge></div>)}</div>
    :action.type==="roles"?<div className="business-list">{data.map((r:any)=><div key={r.id}><span><strong>{r.name}</strong><small>{r.permissions.length} permissions</small></span><Badge>{r._count.members} users</Badge></div>)}</div>
    :<form className="business-form" onSubmit={save}>
      {(action.type==="edit"||action.type==="settings")&&<><label>Business name<input name="name" defaultValue={action.tenant.name} required/></label><label>Slug<input name="slug" defaultValue={action.tenant.slug} required/></label><label>Status<select name="status" defaultValue={action.tenant.status}><option>ACTIVE</option><option>TRIAL</option><option>SUSPENDED</option><option>CANCELLED</option></select></label></>}
      {action.type==="subscription"&&<><label>Plan<input name="plan" defaultValue={action.tenant.plan} required/></label><label>Seats<input name="seats" type="number" min="1" defaultValue={Math.max(action.tenant.userCount,1)} required/></label><label>Subscription status<select name="subscriptionStatus" defaultValue={action.tenant.subscriptionStatus??"ACTIVE"}><option>ACTIVE</option><option>TRIAL</option><option>PAST_DUE</option><option>CANCELLED</option></select></label></>}
      {action.type==="status"&&<p className="business-confirm">This will {action.tenant.status==="SUSPENDED"?"restore":"block"} workspace access for <strong>{action.tenant.name}</strong>.</p>}
      {error?<p className="business-form-error">{error}</p>:null}<div className="business-form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy?"Saving...":action.type==="status"?(action.tenant.status==="SUSPENDED"?"Reactivate":"Suspend"):"Save changes"}</Button></div>
    </form>}
  </section></div>;
}
