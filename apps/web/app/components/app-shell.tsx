"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const items=[
 ["Overview","/"],["Leads","/leads"],["Contacts","/contacts"],["Companies","/companies"],
 ["Opportunities","/opportunities"],["Pipeline","/pipeline"],["Activities","/activities"],
 ["Tasks","/tasks"],["SOP Process","/sop"],["Reports","/reports"]
];
const bottom=[["Team","/team"],["Roles & permissions","/roles"],["Settings","/settings"]];

export function AppShell({children}:{children:ReactNode}){
 const pathname=usePathname();
 const active=(href:string)=>href==="/"?pathname==="/":pathname===href||pathname.startsWith(href+"/");
 return <main className="shell">
  <aside className="sidebar">
   <Link href="/" className="brand"><div className="mark">H</div><div><strong>Hyaw CRM</strong><span>Sales workspace</span></div></Link>
   <nav>{items.map(([label,href])=><Link className={active(href)?"active":""} href={href} key={href}>{label}</Link>)}</nav>
   <div className="sidebarBottom">{bottom.map(([label,href])=><Link className={active(href)?"active":""} href={href} key={href}>{label}</Link>)}<div className="profile"><div className="avatar">MK</div><div><strong>Mikeyas</strong><span>Workspace owner</span></div></div></div>
  </aside>
  <section className="content">{children}</section>
 </main>
}
