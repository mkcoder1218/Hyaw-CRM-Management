import type {SearchCandidate} from "./lead-formatter";
import {getPlatformValue} from "./platform-ai-settings";
type Provider="SERPER"|"BRAVE"|"TAVILY"|"EXA";
async function providerError(provider:string,r:Response){let detail="";try{detail=(await r.text()).trim()}catch{}throw new Error(`${provider} lead search failed (${r.status})${detail?`: ${detail.slice(0,500)}`:""}`)}
const clean=(items:any[],source:string):SearchCandidate[]=>items.map((x:any)=>({title:String(x.title||x.name||""),link:String(x.link||x.url||""),snippet:x.snippet||x.description||x.text?String(x.snippet||x.description||x.text):undefined,source,kind:"WEB" as const})).filter((x:SearchCandidate)=>x.title&&x.link);
const cleanPlaces=(items:any[]):SearchCandidate[]=>items.map((x:any)=>{
 const title=String(x.title||x.name||"").trim();
 const website=typeof x.website==="string"&&x.website.startsWith("http")?x.website:undefined;
 const cid=String(x.cid||x.placeId||x.place_id||"").trim();
 const address=String(x.address||"").trim();\n const link=String(x.link||x.url||x.mapsUrl||x.googleMapsUrl||"").trim()||(cid?`https://www.google.com/maps?cid=${encodeURIComponent(cid)}`:website||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([title,address].filter(Boolean).join(" "))}`);
 return {title,link,snippet:[x.category,x.address].filter(Boolean).join(" · ")||undefined,source:"serper-places",phone:String(x.phoneNumber||x.phone||"").trim()||undefined,address:address||undefined,website,category:String(x.category||x.type||"").trim()||undefined,kind:"BUSINESS" as const};
}).filter((x:SearchCandidate)=>Boolean(x.title&&x.link));

export async function searchBusinessLeads(query:string):Promise<SearchCandidate[]>{
 const provider=((await getPlatformValue("leadSearchProvider"))||"SERPER").toUpperCase() as Provider;
 const key=await getPlatformValue("leadSearchApiKey");
 if(!key)throw new Error(provider+" lead search API key is not configured");
 if(provider==="SERPER"){
  const r=await fetch("https://google.serper.dev/places",{method:"POST",headers:{"X-API-KEY":key,"Content-Type":"application/json"},body:JSON.stringify({q:query,num:20})});
  if(!r.ok)await providerError("Serper places",r);
  const b:any=await r.json();
  const places=cleanPlaces(b.places||[]);
  if(places.length)return places;
 }
 return searchPublicLeads(query);
}

export async function searchPublicLeads(query:string):Promise<SearchCandidate[]>{
 const provider=((await getPlatformValue("leadSearchProvider"))||"SERPER").toUpperCase() as Provider;
 const key=await getPlatformValue("leadSearchApiKey");if(!key)throw new Error(provider+" lead search API key is not configured");
 if(provider==="SERPER"){const r=await fetch("https://google.serper.dev/search",{method:"POST",headers:{"X-API-KEY":key,"Content-Type":"application/json"},body:JSON.stringify({q:query,num:20})});if(!r.ok)await providerError("Serper",r);const b:any=await r.json();return clean(b.organic||[],"serper")}
 if(provider==="BRAVE"){const r=await fetch("https://api.search.brave.com/res/v1/web/search?q="+encodeURIComponent(query)+"&count=20",{headers:{"X-Subscription-Token":key,"Accept":"application/json"}});if(!r.ok)await providerError("Brave",r);const b:any=await r.json();return clean(b.web?.results||[],"brave")}
 if(provider==="TAVILY"){const r=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:key,query,max_results:20,search_depth:"basic"})});if(!r.ok)await providerError("Tavily",r);const b:any=await r.json();return clean(b.results||[],"tavily")}
 if(provider==="EXA"){const r=await fetch("https://api.exa.ai/search",{method:"POST",headers:{"x-api-key":key,"Content-Type":"application/json"},body:JSON.stringify({query,numResults:20})});if(!r.ok)await providerError("Exa",r);const b:any=await r.json();return clean(b.results||[],"exa")}
 throw new Error("Unsupported lead search provider: "+provider)
}
