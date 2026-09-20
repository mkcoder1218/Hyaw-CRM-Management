import { Router } from "express";
import { z } from "zod";
export const leadsRouter=Router();
const schema=z.object({firstName:z.string().min(1),lastName:z.string().min(1),email:z.string().email().optional(),phone:z.string().optional(),company:z.string().optional(),source:z.string().optional(),estimatedValue:z.number().nonnegative().default(0)});
const demo=[{id:"lead_1",name:"Abel Tesfaye",company:"Acme Ethiopia",stage:"Qualified",owner:"Sara",value:145000,score:84},{id:"lead_2",name:"Marta Bekele",company:"Nova Retail",stage:"Contacted",owner:"Nahom",value:82000,score:71},{id:"lead_3",name:"Daniel Kassa",company:"Orbit Logistics",stage:"Proposal",owner:"Sara",value:210000,score:91}];
leadsRouter.get("/",(_req,res)=>res.json({data:demo,total:demo.length}));
leadsRouter.post("/",(req,res)=>{const p=schema.safeParse(req.body);if(!p.success)return res.status(400).json({errors:p.error.flatten()});return res.status(201).json({id:crypto.randomUUID(),...p.data,createdAt:new Date().toISOString()});});
