import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requirePermission } from "../auth";
export const sopsRouter=Router();sopsRouter.use(requireAuth);
const step=z.object({name:z.string().min(1),description:z.string().optional(),dueAfterHours:z.number().int().nonnegative().optional(),required:z.boolean().default(true)});
const schema=z.object({name:z.string().min(2),description:z.string().optional(),active:z.boolean().default(true),steps:z.array(step).min(1)});
sopsRouter.get("/",requirePermission("sop.view"),async(req,res,next)=>{try{const data=await prisma.sop.findMany({where:{tenantId:req.auth!.tenantId},orderBy:{createdAt:"desc"},include:{steps:{orderBy:{position:"asc"}},runs:{include:{lead:{select:{firstName:true,lastName:true}},owner:{select:{firstName:true,lastName:true}},steps:true}},_count:{select:{runs:true}}}});res.json({data})}catch(e){next(e)}});
sopsRouter.post("/",requirePermission("sop.manage"),async(req,res,next)=>{try{const normalized={...req.body,steps:Array.isArray(req.body?.steps)?req.body.steps:[{name:"Review and complete",required:true}]};const parsed=schema.safeParse(normalized);if(!parsed.success){res.status(400).json({message:"Invalid SOP",issues:parsed.error.issues});return}const {steps,...data}=parsed.data;const row=await prisma.sop.create({data:{...data,tenantId:req.auth!.tenantId,steps:{create:steps.map((x,i)=>({...x,position:i+1}))}},include:{steps:true}});res.status(201).json({data:row})}catch(e){next(e)}});
