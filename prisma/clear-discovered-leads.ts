import "dotenv/config";
import {PrismaClient} from "@prisma/client";

const prisma=new PrismaClient();

async function main(){
 const discovered=await prisma.discoveredLead.findMany({
  select:{convertedLeadId:true}
 });
 const convertedIds=[...new Set(discovered.map(x=>x.convertedLeadId).filter((id):id is string=>Boolean(id)))];

 const result=await prisma.$transaction(async tx=>{
  const aiLeads=convertedIds.length
   ? await tx.lead.deleteMany({where:{id:{in:convertedIds},source:{startsWith:"AI Discovery"}}})
   : {count:0};
  const orphanAiLeads=await tx.lead.deleteMany({where:{source:{startsWith:"AI Discovery"}}});
  const discoveries=await tx.discoveredLead.deleteMany({});
  return {discoveries:discoveries.count,crmLeads:aiLeads.count+orphanAiLeads.count};
 });

 console.log(`One-time AI discovery cleanup complete: removed ${result.discoveries} discovered records and ${result.crmLeads} AI-created CRM leads.`);
 console.log("Lead campaigns were preserved. You can run Search Now again with the new business discovery logic.");
}

main()
 .catch(error=>{console.error("AI discovery cleanup failed:",error);process.exitCode=1})
 .finally(()=>prisma.$disconnect());
