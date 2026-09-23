"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useMemo,useState,type ReactNode} from "react";
import {LogOut} from "lucide-react";
import {Button} from "../../components/ui/button";
const apiUrl=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,"")??"http://localhost:4000/api";
type NavItem={label:string;href:string;permission?:string};
const items:NavItem[]=[
 {label:"Overview",href:"/"},
 {label:"Leads",href:"/leads",permission:"lead.view"},
 {label:"AI Lead Finder",href:"/ai-leads",permission:"settings.manage"},
 {label:"New Requests",href:"/requests",permission:"settings.manage"},
 {label:"Contacts",href:"/contacts",permission:"contact.view"},
 {label:"Companies",href:"/companies",permission:"company.view"},
 {label:"Opportunities",href:"/opportunities",permission:"opportunity.view"},
 {label:"Pipeline",href:"/pipeline",permission:"opportunity.view"},
 {label:"Activities",href:"/activities",permission:"activity.view"},
 {label:"Tasks",href:"/tasks",permission:"task.view"},
 {label:"SOP Process",href:"/sop",permission:"sop.view"},
 {label:"Reports",href:"/reports",permission:"report.view"},
];
const bottom:NavItem[]=[
 {label:"Team",href:"/team",permission:"team.view"},
 {label:"Roles & permissions",href:"/roles",permission:"role.manage"},
 {label:"Settings",href:"/settings",permission:"settings.manage"},
];
export function AppShell({children}:{children:ReactNode}){const pathname=usePathname();const[user,setUser]=useState<any>(null);const[checking,setChecking]=useState(pathname!=="/login");
 useEffect(()=>{if(pathname==="/login"){setChecking(false);return}setChecking(true);fetch(apiUrl+"/auth/me",{credentials:"include"}).then(async r=>{if(!r.ok){window.location.replace("/login");return null}return r.json()}).then(b=>{if(b?.data)setUser(b.data)}).finally(()=>setChecking(false))},[pathname]);
 const permissions=useMemo(()=>new Set<string>(Array.isArray(user?.permissions)?user.permissions:[]),[user]);
 const allowed=(item:NavItem)=>!item.permission||permissions.has(item.permission);
 useEffect(()=>{if(!user||pathname==="/login")return;const all=[...items,...bottom];const route=all.filter(x=>x.href!=="/").sort((a,b)=>b.href.length-a.href.length).find(x=>pathname===x.href||pathname.startsWith(x.href+"/"));if(route&&!allowed(route))window.location.replace("/")},[user,pathname]);
 if(pathname==="/login")return <>{children}</>;if(checking||!user)return <main className="authChecking">Checking workspace access...</main>;
 const active=(h:string)=>h==="/"?pathname==="/":pathname===h||pathname.startsWith(h+"/");async function logout(){await fetch(apiUrl+"/auth/logout",{method:"POST",credentials:"include"});window.location.replace("/login")}
 const render=(x:NavItem)=><Button asChild variant={active(x.href)?"default":"ghost"} key={x.href}><Link href={x.href}>{x.label}</Link></Button>;
 return <main className="shell"><aside className="sidebar"><Link href="/" className="brand"><div className="mark">H</div><div><strong>Hyaw CRM</strong><span>Sales workspace</span></div></Link><nav>{items.filter(allowed).map(render)}</nav><div className="sidebarBottom">{bottom.filter(allowed).map(render)}<div className="workspaceUser"><span><strong>{[user.firstName,user.lastName].filter(Boolean).join(" ")}</strong><small>{user.role||""}</small></span><button type="button" onClick={logout} title="Log out"><LogOut size={16}/></button></div></div></aside><section className="content">{children}</section></main>}
