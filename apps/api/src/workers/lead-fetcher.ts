import {Prisma} from "@prisma/client";
import {prisma} from "../db";
import {dedupeFormattedLeads,formatSearchCandidate} from "../services/lead-formatter";
import {searchBusinessLeads} from "../services/lead-search";
import {buildCallingStrategy} from "../services/calling-expert";

let scheduledRunning=false;
const campaignRuns=new Set<string>();
const vendorTerms=/\b(hr software|human resource software|payroll software|attendance (management )?(software|system)|time\s*&?\s*attendance|workforce management software|recruitment agency|recruitment service|hr outsourcing|hr consulting|human resource consulting)\b/i;
const junkTerms=/\b(top \d+|best companies|best hotels|best restaurants|best bakeries|what (is|are) the best|which .* software|directory|list of|blog|article|guide|comparison|review|looking for a workforce|job vacancy|jobs in|hiring now|career opportunities|wait\.\.\. they have|from the us straight to)\b/i;
const genericCategory=/^(cafes?|restaurants?|coffee shops?|bakeries?|retail shops?|supermarkets?|hotels?|guest houses?|clinics?|pharmacies?|salons?|workshops?|garages?|warehouses?|small factories|construction companies|logistics companies|manufacturing)( business)?$/i;
const productTerms=/\b(hr|human resources?|payroll|attendance|workforce|software|saas|erp)\b/gi;
const categories=["cafes","restaurants","coffee shops","bakeries","retail shops","supermarkets","hotels","guest houses","clinics","pharmacies","salons","workshops","garages","warehouses","small factories","construction companies","logistics companies"];
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

function discoveryQueries(campaign:any){
 const raw=String(campaign.query||"").replace(productTerms," ").replace(/\s+/g," ").trim();
 const place=String(campaign.location||"").trim();
 const industry=campaign.industry?String(campaign.industry):"";
 const campaignQuery=industry?`${industry} companies`:raw&&raw.length>8?raw:"companies with operational teams";
 return [...new Set([[campaignQuery,place].filter(Boolean).join(" "),...categories.map(category=>[category,place].filter(Boolean).join(" "))].filter(Boolean))];
}

function isJunk(company:string,description?:string|null){
 return junkTerms.test(company)||junkTerms.test(description||"")||genericCategory.test(company.trim());
}

async function cleanupOldFalseLeads(tenantId:string){
 const rows=await prisma.discoveredLead.findMany({where:{tenantId,convertedLeadId:{not:null}},select:{id:true,company:true,description:true,convertedLeadId:true}});
 let cleaned=0;
 for(const row of rows){
  if(!isJunk(row.company,row.description))continue;
  if(row.convertedLeadId){
   await prisma.lead.deleteMany({where:{id:row.convertedLeadId,tenantId,source:{startsWith:"AI Discovery"}}});
  }
  await prisma.discoveredLead.update({where:{id:row.id},data:{status:"EXCLUDED",convertedLeadId:null,rejectionReason:"Removed automatically: search result was not a real business entity."}});
  cleaned++;
 }
 return cleaned;
}

async function analyzeWithRetry(lead:any,campaign:any){
 for(let attempt=0;attempt<3;attempt++){
  try{return await buildCallingStrategy(lead,campaign)}
  catch(e){const m=e instanceof Error?e.message:String(e);if(!m.includes("429")||attempt===2)throw e;await sleep(1000*2**attempt)}
 }
}

async function createCrmLead(tenantId:string,d:any,score:number){
 const parts=String(d.name||d.company).trim().split(/\s+/),firstName=parts.shift()||d.company,lastName=parts.join(" ")||"Business";
 return prisma.lead.create({data:{tenantId,firstName,lastName,email:d.email,phone:d.phone,company:d.company,title:d.industry,source:`AI Discovery · ${d.website?"Website found":"No website"}`,score}});
}

export async function runLeadDiscovery(campaignId?:string){
 if(campaignId&&campaignRuns.has(campaignId))return {processed:0,duplicates:0,excluded:0,aiPending:0,cleaned:0,skipped:true};
 if(!campaignId&&scheduledRunning)return {processed:0,duplicates:0,excluded:0,aiPending:0,cleaned:0,skipped:true};
 if(campaignId)campaignRuns.add(campaignId);else scheduledRunning=true;
 let processed=0,duplicates=0,excluded=0,aiPending=0,cleaned=0;
 try{
  const campaigns=await prisma.leadCampaign.findMany({where:{active:true,...(campaignId?{id:campaignId}:{})}});
  const cleanedTenants=new Set<string>();
  for(const campaign of campaigns){
   if(!cleanedTenants.has(campaign.tenantId)){cleaned+=await cleanupOldFalseLeads(campaign.tenantId);cleanedTenants.add(campaign.tenantId)}
   const raw=(await Promise.all(discoveryQueries(campaign).map(q=>searchBusinessLeads(q)))).flat();
   const candidates=dedupeFormattedLeads(raw.map(x=>formatSearchCandidate(x,campaign)).filter((x):x is NonNullable<typeof x>=>Boolean(x)));
   candidates.sort((a,b)=>Number(Boolean(a.website))-Number(Boolean(b.website)));
   for(const lead of candidates){
    if(await prisma.discoveredLead.findUnique({where:{tenantId_sourceUrl:{tenantId:campaign.tenantId,sourceUrl:lead.sourceUrl}}})){duplicates++;continue}
    const evidence=[lead.company,lead.description,lead.industry].filter(Boolean).join(" ");
    const deterministicCompetitor=vendorTerms.test(evidence);
    const junk=isJunk(lead.company,lead.description);
    const noWebsite=!lead.website;
    let strategy:any;
    if(lead.isBusinessEntity&&!deterministicCompetitor&&!junk){
     try{strategy=await analyzeWithRetry(lead,campaign)}
     catch(e){console.error("AI lead qualification failed; using business-entity evidence",lead.sourceUrl,e);aiPending++}
    }
    const aiRejected=strategy?.isCompetitor===true||(strategy?.nextAction==="EXCLUDE"&&Number(strategy?.confidence||0)>=70);
    const realBusinessCandidate=lead.isBusinessEntity&&!deterministicCompetitor&&!junk&&!aiRejected;
    let score=Math.max(0,Number(strategy?.fitScore)||40);
    if(noWebsite)score=Math.min(100,score+15);
    const qualified=realBusinessCandidate&&(strategy?.isPotentialCustomer===true||noWebsite||Number(strategy?.confidence||0)<50);
    const status=qualified?"QUALIFIED":realBusinessCandidate?"REVIEWED":"EXCLUDED";
    const reason=junk?"Excluded because this is a list, article, job page, generic category, or other non-business result.":deterministicCompetitor?"Excluded as an HR/workforce competitor or vendor.":!lead.isBusinessEntity?"Excluded because the source did not provide a validated business entity.":strategy?.qualificationReason||(noWebsite?"Validated local business with no dedicated website; prioritized for seller discovery.":"Validated business retained for seller discovery.");
    try{
     const discovered=await prisma.discoveredLead.create({data:{
      tenantId:campaign.tenantId,campaignId:campaign.id,name:lead.name,company:lead.company,website:lead.website,phone:lead.phone,location:lead.location,industry:lead.industry,
      sourceUrl:lead.sourceUrl,sourceName:lead.sourceName,description:lead.description,rawData:lead.rawData as any,fitScore:score,priority:score>=75?"HIGH":score>=50?"MEDIUM":"LOW",
      isCompetitor:deterministicCompetitor||strategy?.isCompetitor===true,businessType:strategy?.businessType??(junk?"NON_COMPANY":deterministicCompetitor?"HR_VENDOR":lead.isBusinessEntity?"LOCAL_BUSINESS":"UNKNOWN"),
      confidence:strategy?.confidence??0,qualificationReason:reason,likelyProblems:strategy?.likelyProblems??[],strategy:strategy?.strategy??"",openingLine:strategy?.openingLine??"",
      firstCallGoal:strategy?.firstCallGoal??"Confirm employee count and how attendance, shifts and HR are managed today.",objections:(strategy?.objections??[]) as any,nextAction:qualified?"CALL":"REVIEW",status
     }});
     if(qualified){
      const crm=await createCrmLead(campaign.tenantId,lead,score);
      await prisma.discoveredLead.update({where:{id:discovered.id},data:{convertedLeadId:crm.id}});
     }
     if(status==="EXCLUDED")excluded++;else processed++;
    }catch(e){
     if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002"){duplicates++;continue}
     throw e
    }
   }
  }
  return {processed,duplicates,excluded,aiPending,cleaned,skipped:false};
 }finally{
  if(campaignId)campaignRuns.delete(campaignId);else scheduledRunning=false
 }
}

export function startLeadFetcherWorker(){
 const minutes=Math.max(15,Number(process.env.LEAD_DISCOVERY_INTERVAL_MINUTES)||60);
 setInterval(()=>{void runLeadDiscovery().catch(e=>console.error("Lead discovery worker failed",e))},minutes*60_000);
 console.log(`Lead discovery worker scheduled every ${minutes} minutes`)
}
