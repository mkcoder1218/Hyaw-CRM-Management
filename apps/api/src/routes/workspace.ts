import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireAnyPermission, requirePermission } from "../auth";

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);
const tenantId = (req: any): string => String(req.auth!.tenantId);
const leadStage = z.enum(["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"]);
const schemas: Record<string, z.ZodTypeAny> = {
  leads: z.object({firstName:z.string().min(1),lastName:z.string().min(1),email:z.string().optional(),phone:z.string().optional(),company:z.string().optional(),title:z.string().optional(),source:z.string().optional(),status:leadStage.default("NEW"),score:z.coerce.number().int().min(0).max(100).default(0),estimatedValue:z.coerce.number().nonnegative().default(0),nextFollowUpAt:z.string().optional(),ownerId:z.string().optional()}),
  contacts: z.object({name:z.string().min(1),email:z.string().optional(),phone:z.string().optional(),company:z.string().optional(),jobTitle:z.string().optional(),notes:z.string().optional()}),
  companies: z.object({name:z.string().min(1),industry:z.string().optional(),phone:z.string().optional(),email:z.string().optional(),website:z.string().optional(),address:z.string().optional()}),
  opportunities: z.object({name:z.string().min(1),company:z.string().optional(),value:z.coerce.number().nonnegative().default(0),stage:leadStage.default("NEW"),closeDate:z.string().optional(),notes:z.string().optional()}),
  tasks: z.object({title:z.string().min(1),dueDate:z.string().optional(),priority:z.string().default("MEDIUM"),assignee:z.string().optional(),description:z.string().optional()}),
  activities: z.object({subject:z.string().min(1),type:z.enum(["NOTE","CALL","EMAIL","MEETING","TASK","STATUS_CHANGE"]).default("NOTE"),body:z.string().optional(),dueAt:z.string().optional(),leadId:z.string().optional()}),
};
const clean=(o:any)=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==""&&v!==undefined));

workspaceRouter.get("/dashboard",requireAnyPermission("lead.view","activity.view","task.view","opportunity.view"),async(req,res,next)=>{try{
 const tid=tenantId(req), month=new Date(new Date().getFullYear(),new Date().getMonth(),1);
 const [leads,opps,tasks]=await Promise.all([
  prisma.lead.findMany({where:{tenantId:tid},include:{owner:{select:{firstName:true,lastName:true}}},orderBy:{estimatedValue:"desc"}}),
  prisma.opportunity.findMany({where:{tenantId:tid}}),
  prisma.crmTask.findMany({where:{tenantId:tid,completed:false},orderBy:{createdAt:"desc"},take:6})
 ]);
 const open=leads.filter(x=>!["WON","LOST"].includes(x.status));
 const pipelineValue=open.reduce((s,x)=>s+Number(x.estimatedValue),0)+opps.filter(x=>!["WON","LOST"].includes(x.stage)).reduce((s,x)=>s+Number(x.value),0);
 const wonValue=leads.filter(x=>x.status==="WON"&&x.updatedAt>=month).reduce((s,x)=>s+Number(x.estimatedValue),0)+opps.filter(x=>x.stage==="WON"&&x.updatedAt>=month).reduce((s,x)=>s+Number(x.value),0);
 const stages=["NEW","CONTACTED","QUALIFIED","PROPOSAL"].map(name=>({name,value:leads.filter(x=>x.status===name).reduce((s,x)=>s+Number(x.estimatedValue),0)+opps.filter(x=>x.stage===name).reduce((s,x)=>s+Number(x.value),0)}));
 res.json({data:{stats:{openLeads:open.length,pipelineValue,wonValue,conversion:leads.length?Math.round(leads.filter(x=>x.status==="WON").length/leads.length*1000)/10:0},stages,tasks,priorityLeads:leads.slice(0,6)}});
}catch(e){next(e)}});

workspaceRouter.get("/leads",requirePermission("lead.view"),async(req,res,next)=>{try{res.json({data:await prisma.lead.findMany({where:{tenantId:tenantId(req)},include:{owner:{select:{firstName:true,lastName:true}}},orderBy:{createdAt:"desc"}})})}catch(e){next(e)}});
workspaceRouter.get("/contacts",requirePermission("contact.view"),async(req,res,next)=>{try{res.json({data:await prisma.contact.findMany({where:{tenantId:tenantId(req)},orderBy:{createdAt:"desc"}})})}catch(e){next(e)}});
workspaceRouter.get("/companies",requirePermission("company.view"),async(req,res,next)=>{try{res.json({data:await prisma.company.findMany({where:{tenantId:tenantId(req)},orderBy:{createdAt:"desc"}})})}catch(e){next(e)}});
workspaceRouter.get("/opportunities",requirePermission("opportunity.view"),async(req,res,next)=>{try{res.json({data:await prisma.opportunity.findMany({where:{tenantId:tenantId(req)},orderBy:{createdAt:"desc"}})})}catch(e){next(e)}});
workspaceRouter.get("/tasks",requirePermission("task.view"),async(req,res,next)=>{try{res.json({data:await prisma.crmTask.findMany({where:{tenantId:tenantId(req)},orderBy:{createdAt:"desc"}})})}catch(e){next(e)}});
workspaceRouter.get("/activities",requirePermission("activity.view"),async(req,res,next)=>{try{res.json({data:await prisma.activity.findMany({where:{tenantId:tenantId(req)},include:{user:{select:{firstName:true,lastName:true}},lead:{select:{firstName:true,lastName:true}}},orderBy:{createdAt:"desc"}})})}catch(e){next(e)}});
workspaceRouter.get("/pipeline",requirePermission("opportunity.view"),async(req,res,next)=>{try{const tid=tenantId(req);const [pipelines,opportunities]=await Promise.all([prisma.pipeline.findMany({where:{tenantId:tid},include:{stages:{orderBy:{position:"asc"}}}}),prisma.opportunity.findMany({where:{tenantId:tid}})]);res.json({data:{pipelines,opportunities}})}catch(e){next(e)}});
workspaceRouter.get("/team",requirePermission("team.view"),async(req,res,next)=>{try{res.json({data:await prisma.tenantUser.findMany({where:{tenantId:tenantId(req)},include:{user:{select:{id:true,firstName:true,lastName:true,email:true,active:true,createdAt:true}},role:true},orderBy:{createdAt:"asc"}})})}catch(e){next(e)}});
workspaceRouter.get("/roles",requirePermission("role.manage"),async(req,res,next)=>{try{res.json({data:await prisma.role.findMany({where:{tenantId:tenantId(req)},include:{permissions:{include:{permission:true}},_count:{select:{members:true}}},orderBy:{name:"asc"}})})}catch(e){next(e)}});
workspaceRouter.get("/settings",requirePermission("settings.manage"),async(req,res,next)=>{try{const rows=await prisma.tenantSetting.findMany({where:{tenantId:tenantId(req)}});res.json({data:Object.fromEntries(rows.map(x=>[x.key,x.value]))})}catch(e){next(e)}});
workspaceRouter.get("/reports",requirePermission("report.view"),async(req,res,next)=>{try{const tid=tenantId(req);const [leads,activities,opps]=await Promise.all([prisma.lead.findMany({where:{tenantId:tid}}),prisma.activity.count({where:{tenantId:tid}}),prisma.opportunity.findMany({where:{tenantId:tid}})]);res.json({data:{leads:leads.length,won:leads.filter(x=>x.status==="WON").length,lost:leads.filter(x=>x.status==="LOST").length,activities,pipeline:opps.reduce((s,x)=>s+Number(x.value),0),byStage:["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"].map(stage=>({stage,count:leads.filter(x=>x.status===stage).length}))}})}catch(e){next(e)}});

workspaceRouter.post("/:resource",async(req,res,next)=>{try{
 const needed:Record<string,string>={leads:"lead.create",contacts:"contact.manage",companies:"company.manage",opportunities:"opportunity.manage",tasks:"task.manage",activities:"activity.create"};const permission=needed[req.params.resource];if(permission&&!req.auth!.permissions.includes(permission)){res.status(403).json({message:"Permission denied",permission});return}
 const resource=req.params.resource,schema=schemas[resource];if(!schema){res.status(404).json({message:"Unknown CRM resource"});return}
 const parsed=schema.safeParse(req.body);if(!parsed.success){res.status(400).json({message:"Invalid data",issues:parsed.error.issues});return}
 const d:any=clean(parsed.data),tid=tenantId(req);let row:any;
 if(resource==="leads")row=await prisma.lead.create({data:{...d,tenantId:tid,nextFollowUpAt:d.nextFollowUpAt?new Date(d.nextFollowUpAt):undefined}});
 else if(resource==="contacts")row=await prisma.contact.create({data:{...d,tenantId:tid}});
 else if(resource==="companies")row=await prisma.company.create({data:{...d,tenantId:tid}});
 else if(resource==="opportunities")row=await prisma.opportunity.create({data:{...d,tenantId:tid,closeDate:d.closeDate?new Date(d.closeDate):undefined}});
 else if(resource==="tasks")row=await prisma.crmTask.create({data:{...d,tenantId:tid,dueDate:d.dueDate?new Date(d.dueDate):undefined}});
 else row=await prisma.activity.create({data:{...d,tenantId:tid,userId:req.auth!.userId,dueAt:d.dueAt?new Date(d.dueAt):undefined}});
 res.status(201).json({data:row});
}catch(e){next(e)}});

workspaceRouter.patch("/leads/:id",requirePermission("lead.update"),async(req,res,next)=>{try{const found=await prisma.lead.findFirst({where:{id:req.params.id,tenantId:tenantId(req)}});if(!found){res.status(404).json({message:"Lead not found"});return}const parsed=z.object({status:leadStage.optional(),ownerId:z.string().nullable().optional(),score:z.coerce.number().int().min(0).max(100).optional(),nextFollowUpAt:z.string().nullable().optional()}).safeParse(req.body);if(!parsed.success){res.status(400).json({message:"Invalid lead update",issues:parsed.error.issues});return}const d:any=parsed.data;res.json({data:await prisma.lead.update({where:{id:found.id},data:{...d,nextFollowUpAt:d.nextFollowUpAt===null?null:d.nextFollowUpAt?new Date(d.nextFollowUpAt):undefined}})})}catch(e){next(e)}});
workspaceRouter.patch("/tasks/:id",requirePermission("task.manage"),async(req,res,next)=>{try{const found=await prisma.crmTask.findFirst({where:{id:req.params.id,tenantId:tenantId(req)}});if(!found){res.status(404).json({message:"Task not found"});return}res.json({data:await prisma.crmTask.update({where:{id:found.id},data:{completed:Boolean(req.body.completed)}})})}catch(e){next(e)}});
workspaceRouter.put("/settings",requirePermission("settings.manage"),async(req,res,next)=>{try{const tid=tenantId(req);for(const [key,value] of Object.entries(req.body??{})){await prisma.tenantSetting.upsert({where:{tenantId_key:{tenantId:tid,key}},update:{value:String(value)},create:{tenantId:tid,key,value:String(value)}})}res.json({data:req.body})}catch(e){next(e)}});
