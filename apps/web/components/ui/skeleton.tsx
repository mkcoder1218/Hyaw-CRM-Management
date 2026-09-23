import * as React from "react";

export function Skeleton({className="",...props}:React.HTMLAttributes<HTMLDivElement>){
 return <div className={`animate-pulse rounded-md bg-muted ${className}`} {...props}/>;
}

export function TableRowsSkeleton({rows=6,colSpan}:{rows?:number;colSpan:number}){
 return <>{Array.from({length:rows},(_,i)=><tr key={i}><td colSpan={colSpan} style={{padding:"10px 12px"}}><Skeleton style={{height:38,width:"100%"}}/></td></tr>)}</>;
}
