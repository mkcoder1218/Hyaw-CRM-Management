import { Router } from "express";
import { z } from "zod";

export const sopsRouter=Router();
const step=z.object({name:z.string().min(1),description:z.string().optional(),dueAfterHours:z.number().int().nonnegative().optional(),required:z.boolean().default(true)});
const sop=z.object({name:z.string().min(2),description:z.string().optional(),active:z.boolean().default(true),steps:z.array(step).min(1)});

const demo=[
 {id:"sop-1",name:"New lead qualification",description:"Consistent first-touch and qualification process.",active:true,runs:18,completion:82,steps:[{name:"Review lead profile",dueAfterHours:1},{name:"First contact",dueAfterHours:4},{name:"Qualify need and budget",dueAfterHours:24},{name:"Set next action",dueAfterHours:26}]},
 {id:"sop-2",name:"Proposal follow-up",description:"Follow every proposal until a decision is recorded.",active:true,runs:9,completion:67,steps:[{name:"Confirm proposal received",dueAfterHours:4},{name:"Follow up",dueAfterHours:48},{name:"Record decision",dueAfterHours:96}]}
];

sopsRouter.get("/",(_req,res)=>res.json({data:demo}));
sopsRouter.post("/",(req,res)=>{const parsed=sop.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Invalid SOP",issues:parsed.error.issues});return res.status(201).json({id:crypto.randomUUID(),...parsed.data,createdAt:new Date().toISOString()});});
