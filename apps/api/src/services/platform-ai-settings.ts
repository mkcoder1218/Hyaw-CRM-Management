import crypto from "node:crypto";import {prisma} from "../db";
const SECRET_KEYS=new Set(["groqApiKey","leadSearchApiKey"]);
function key(){return crypto.createHash("sha256").update(process.env.JWT_SECRET||"change-this-to-a-long-random-secret").digest()}
function encrypt(v:string){const iv=crypto.randomBytes(12),c=crypto.createCipheriv("aes-256-gcm",key(),iv);const data=Buffer.concat([c.update(v,"utf8"),c.final()]);return ["enc",iv.toString("base64"),c.getAuthTag().toString("base64"),data.toString("base64")].join(":")}
function decrypt(v:string){if(!v.startsWith("enc:"))return v;const[,iv,tag,data]=v.split(":");const d=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64"));d.setAuthTag(Buffer.from(tag,"base64"));return Buffer.concat([d.update(Buffer.from(data,"base64")),d.final()]).toString("utf8")}
export async function getPlatformValue(name:string){const r=await prisma.platformSetting.findUnique({where:{key:name}});if(!r)return "";let v:string;try{v=JSON.parse(r.value)}catch{v=r.value}return SECRET_KEYS.has(name)?decrypt(String(v||"")):String(v||"")}
export async function setPlatformValue(name:string,value:string){const stored=SECRET_KEYS.has(name)&&value?encrypt(value):value;await prisma.platformSetting.upsert({where:{key:name},update:{value:JSON.stringify(stored)},create:{key:name,value:JSON.stringify(stored)}})}
export function maskSecret(v:string){return v?v.slice(0,3)+"••••••••"+v.slice(-3):""}
