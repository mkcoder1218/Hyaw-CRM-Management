import "./styles.css";
import type { ReactNode } from "react";
export const metadata={title:"Hyaw CRM",description:"Clean multi-tenant CRM for growing sales teams"};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body>{children}</body></html>}
