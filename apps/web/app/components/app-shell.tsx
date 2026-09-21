"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState,type ReactNode} from "react";
import {LogOut} from "lucide-react";
import {Button} from "../../components/ui/button";
const apiUrl=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,"")??"http://localhost:4000/api";
const items=[["Overview","/"],["Leads","/leads"],["Contacts","/contacts"],["Companies","/companies"],["Opportunities","/opportunities"],["Pipeline","/pipeline"],["Activities","/activities"],["Tasks","/tasks"],["SOP Process","/sop"],["Reports","/reports"]];
const bottom=[["Team","/team"],["Roles & permissions","/roles"],["Settings","/settings"]];
export function AppShell({children}:{children:ReactNode}){const pathname=usePathname();const[user,setUser]=useState<any>(null);useEffect(()=>{if(pathname!=="/login")fetch(apiUrl+"/auth/me",{credentials:"include"}).then(r=>r.ok?r.json():null).then(b=>setUser(b?.data??null))},[pathname]);if(pathname==="/login")return <>{children}</>;const active=(h:string)=>h==="/"?pathname==="/":pathname===h||pathname.startsWith(h+"/");async function logout(){await fetch(apiUrl+"/auth/logout",{method:"POST",credentials:"include"});window.location.replace("/login")}
return <main className="shell"><aside className="sidebar"><Link href="/" className="brand"><div className="mark">H</div><div><strong>Hyaw CRM</strong><span>Sales workspace</span></div></Link><nav>{items.map(([l,h])=><Button asChild variant={active(h)?"default":"ghost"} key={h}><Link href={h}>{l}</Link></Button>)}</nav><div className="sidebarBottom">{bottom.map(([l,h])=><Button asChild variant={active(h)?"default":"ghost"} key={h}><Link href={h}>{l}</Link></Button>)}<div className="workspaceUser"><span><strong>{user?[user.firstName,user.lastName].filter(Boolean).join(" "):"Account"}</strong><small>{user?.role||""}</small></span><button type="button" onClick={logout} title="Log out"><LogOut size={16}/></button></div></div></aside><section className="content">{children}</section></main>}
