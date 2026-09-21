"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {CreateModal} from "./components/create-modal";
import {Button} from "../components/ui/button";
import {Card,CardContent,CardHeader,CardTitle,CardDescription} from "../components/ui/card";
import {Badge} from "../components/ui/badge";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "../components/ui/table";
const apiUrl=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,"")??"http://localhost:4000/api";
const leadFields=[{name:"firstName",label:"First name",required:true},{name:"lastName",label:"Last name",required:true},{name:"email",label:"Email",type:"email" as const},{name:"phone",label:"Phone",type:"tel" as const},{name:"company",label:"Company"},{name:"source",label:"Source",type:"select" as const,options:["Website","Referral","Cold call","Social media","Event","Other"]},{name:"estimatedValue",label:"Estimated value",type:"number" as const}];
const fmt=(n:number)=>"ETB "+Number(n||0).toLocaleString();
export default function Page(){const[d,setD]=useState<any>(null),[error,setError]=useState("");
 async function load(){try{const r=await fetch(apiUrl+"/workspace/dashboard",{credentials:"include"});const b=await r.json();if(!r.ok)throw new Error(b.message||"Could not load dashboard");setD(b.data)}catch(e){setError(e instanceof Error?e.message:"Could not load dashboard")}}
 useEffect(()=>{void load()},[]);
 async function create(v:Record<string,string>){const r=await fetch(apiUrl+"/workspace/leads",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)});if(!r.ok){const b=await r.json();throw new Error(b.message||"Could not create lead")}await load()}
 if(error)return <Card><CardContent><p className="dataError">{error}</p></CardContent></Card>;
 if(!d)return <p>Loading sales workspace...</p>;
 const stats=[["Open leads",d.stats.openLeads],["Pipeline value",fmt(d.stats.pipelineValue)],["Won this month",fmt(d.stats.wonValue)],["Conversion",d.stats.conversion+"%"]];
 const total=Math.max(1,d.stages.reduce((s:number,x:any)=>s+x.value,0));
 return <><header><div><p className="eyebrow">Sales workspace</p><h1>Overview</h1><p>Live sales activity from your workspace.</p></div><div className="actions"><Button asChild variant="outline"><Link href="/leads">All leads</Link></Button><CreateModal entity="lead" fields={leadFields} onCreated={create}/></div></header>
 <div className="stats">{stats.map(([l,v])=><Card key={String(l)}><CardContent><span>{l}</span><strong>{v}</strong><small>Live data</small></CardContent></Card>)}</div>
 <div className="grid"><Card className="pipeline"><CardHeader className="panelHead"><div><CardTitle>Pipeline</CardTitle><CardDescription>Value across active records</CardDescription></div><Button asChild variant="outline" size="sm"><Link href="/pipeline">View pipeline</Link></Button></CardHeader><CardContent><div className="pipelineBar">{d.stages.map((x:any)=><i key={x.name} style={{width:(x.value/total*100)+"%"}}/>)}</div><div className="stages">{d.stages.map((x:any)=><div key={x.name}><span>{x.name}</span><strong>{fmt(x.value)}</strong></div>)}</div></CardContent></Card>
 <Card className="focus"><CardHeader className="panelHead"><div><CardTitle>Today</CardTitle><CardDescription>Open tasks</CardDescription></div><Badge>{d.tasks.length} tasks</Badge></CardHeader><CardContent>{d.tasks.length?d.tasks.map((x:any)=><div className="task" key={x.id}><div className="check"/><div><strong>{x.title}</strong><span>{x.dueDate?new Date(x.dueDate).toLocaleDateString():"No due date"}</span></div></div>):<p>No open tasks.</p>}</CardContent></Card></div>
 <Card className="tablePanel"><CardHeader className="panelHead"><div><CardTitle>Priority leads</CardTitle><CardDescription>Highest-value leads in the database</CardDescription></div><Button asChild variant="outline" size="sm"><Link href="/leads">All leads</Link></Button></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Company</TableHead><TableHead>Stage</TableHead><TableHead>Owner</TableHead><TableHead>Value</TableHead><TableHead>Score</TableHead></TableRow></TableHeader><TableBody>{d.priorityLeads.length?d.priorityLeads.map((l:any)=><TableRow key={l.id}><TableCell><strong>{l.firstName} {l.lastName}</strong></TableCell><TableCell>{l.company||"—"}</TableCell><TableCell><Badge>{l.status}</Badge></TableCell><TableCell>{l.owner?l.owner.firstName+" "+l.owner.lastName:"Unassigned"}</TableCell><TableCell>{fmt(l.estimatedValue)}</TableCell><TableCell><Badge>{l.score}</Badge></TableCell></TableRow>):<TableRow><TableCell colSpan={6}>No leads yet.</TableCell></TableRow>}</TableBody></Table></CardContent></Card></>}
