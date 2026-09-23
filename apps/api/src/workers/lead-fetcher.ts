import {Prisma} from "@prisma/client";
import {prisma} from "../db";
import {dedupeFormattedLeads,formatSearchCandidate} from "../services/lead-formatter";
import {searchPublicLeads} from "../services/lead-search";
import {buildCallingStrategy} from "../services/calling-expert";
let scheduledRunning=false;const campaignRuns=new Set<string>();
const vendorTerms=/\b(hr software|human resource software|payroll software|attendance (management )?(software|system)|time\s*&?\s*attendance|workforce management software|recruitment agency|recruitment service|hr outsourcing|hr consulting|human resource consulting)\b/i;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function analyzeWithRetry(lead:any,campaign:any){for(let attempt=0;attempt<3;attempt++){try{return await buildCallingStrategy(lead,campaign)}catch(e){const m=e instanceof Error?e.message:String(e);if(!m.includes("429")||attempt===2)throw e;await sleep(1000*2**attempt)}}}
async function createCrmLead(tenantId:string,d:any,score:number){const parts=String(d.name||d.company).trim().split(/\s+/),firstName=parts.shift()||d.company,lastName=parts.join(" ")||"Business";return prisma.lead.create({data:{tenantId,firstName,lastName,email:d.email,phone:d.phone,company:d.company,title:d.industry,source:`AI discovery: ${d.sourceName||"web"}`,score}})}
export async function runLeadDiscovery(campaignId?:string){
 if(campaignId&&campaignRuns.has(campaignId))return {processed:0,duplicates:0,excluded:0,aiPending:0,skipped:true};
 if(!campaignId&&scheduledRunning)return {processed:0,duplicates:0,excluded:0,aiPending:0,skipped:true};
 if(campaignId)campaignRuns.add(campaignId);else scheduledRunning=true;
 let processed=0,duplicates=0,excluded=0,aiPending=0;
 try{
  const campaigns=await prisma.leadCampaign.findMany({where:{active:true,...(campaignId?{id:campaignId}:{})}});
  for(const campaign of campaigns){
   const q=[campaign.query,campaign.industry,campaign.location,'-"HR software" -"payroll software" -"attendance software" -"HR outsourcing"'].filter(Boolean).join(" ");
   const candidates=dedupeFormattedLeads((await searchPublicLeads(q)).map(x=>formatSearchCandidate(x,campaign)).filter((x):x is NonNullable<typeof x>=>Boolean(x)));
   for(const lead of candidates){
    if(await prisma.discoveredLead.findUnique({where:{tenantId_sourceUrl:{tenantId:campaign.tenantId,sourceUrl:lead.sourceUrl}}})){duplicates++;continue}
    const deterministicCompetitor=vendorTerms.test([lead.company,lead.description,lead.industry].filter(Boolean).join(" "));
    let strategy:any;
    if(!deterministicCompetitor){try{strategy=await analyzeWithRetry(lead,campaign)}catch(e){console.error("AI lead qualification failed; saving for review",lead.sourceUrl,e);aiPending++}}
    const qualified=!deterministicCompetitor&&strategy?.isPotentialCustomer===true&&strategy?.isCompetitor!==true&&strategy.fitScore>=55&&strategy.confidence>=50;
    const status=deterministicCompetitor||strategy?.isCompetitor?"EXCLUDED":qualified?"QUALIFIED":"REVIEWED";
    try{
     const discovered=await prisma.discoveredLead.create({data:{tenantId:campaign.tenantId,campaignId:campaign.id,name:lead.name,company:lead.company,website:lead.website,location:lead.location,industry:lead.industry,sourceUrl:lead.sourceUrl,sourceName:lead.sourceName,description:lead.description,rawData:lead.rawData as any,fitScore:strategy?.fitScore??0,priority:strategy?.priority??"LOW",isCompetitor:deterministicCompetitor||strategy?.isCompetitor===true,businessType:strategy?.businessType??(deterministicCompetitor?"HR_VENDOR":"UNKNOWN"),confidence:strategy?.confidence??0,qualificationReason:deterministicCompetitor?"Excluded by competitor/vendor keyword filter.":strategy?.qualificationReason??"AI qualification pending; requires review.",likelyProblems:strategy?.likelyProblems??[],strategy:strategy?.strategy??"",openingLine:strategy?.openingLine??"",firstCallGoal:strategy?.firstCallGoal??"",objections:(strategy?.objections??[]) as any,nextAction:strategy?.nextAction??"REVIEW",status}});
     if(qualified){const crm=await createCrmLead(campaign.tenantId,{...lead,sourceName:lead.sourceName},strategy.fitScore);await prisma.discoveredLead.update({where:{id:discovered.id},data:{convertedLeadId:crm.id}})}
     if(status==="EXCLUDED")excluded++;else processed++;
    }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002"){duplicates++;continue}throw e}
   }
  }
  return {processed,duplicates,excluded,aiPending,skipped:false};
 }finally{if(campaignId)campaignRuns.delete(campaignId);else scheduledRunning=false}
}
export function startLeadFetcherWorker(){const minutes=Math.max(15,Number(process.env.LEAD_DISCOVERY_INTERVAL_MINUTES)||60);setInterval(()=>{void runLeadDiscovery().catch(e=>console.error("Lead discovery worker failed",e))},minutes*60_000);console.log(`Lead discovery worker scheduled every ${minutes} minutes`)}
