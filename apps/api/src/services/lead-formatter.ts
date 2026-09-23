export type SearchCandidate={title:string;link:string;snippet?:string;source?:string};
export type FormattedLead={name:string;company:string;website?:string;location?:string;industry?:string;sourceUrl:string;sourceName?:string;description?:string;rawData:SearchCandidate};
const strip=(v:string)=>v.replace(/\s+/g," ").trim();
const companyFromTitle=(title:string)=>strip(title.split(/[|–—-]/)[0]||title).slice(0,160);\nconst directoryHost=/\\b(facebook\\.com|instagram\\.com|linkedin\\.com|google\\.[^/]+|maps\\.google|tripadvisor\\.|yellowpages|cybo\\.|foursquare\\.)/i;
export function formatSearchCandidate(candidate:SearchCandidate, campaign:{industry?:string|null;location?:string|null}):FormattedLead|null{
 if(!candidate.link?.startsWith("http")||!candidate.title?.trim())return null;
 const company=companyFromTitle(candidate.title);if(!company)return null;
 const url=new URL(candidate.link);const website=directoryHost.test(url.hostname)?undefined:url.origin;\n return {name:company,company,website,location:campaign.location||undefined,industry:campaign.industry||undefined,sourceUrl:candidate.link,sourceName:candidate.source||new URL(candidate.link).hostname,description:candidate.snippet?strip(candidate.snippet).slice(0,1200):undefined,rawData:candidate};
}
export function dedupeFormattedLeads(leads:FormattedLead[]){const seen=new Set<string>();return leads.filter(x=>{const key=x.sourceUrl.toLowerCase().replace(/\/$/,"");if(seen.has(key))return false;seen.add(key);return true})}
