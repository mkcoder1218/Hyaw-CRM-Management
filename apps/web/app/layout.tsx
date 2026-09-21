import "./styles.css";
import type { ReactNode } from "react";
import { AppShell } from "./components/app-shell";
import { AuthGuard } from "./components/auth-guard";

export const metadata={title:"Hyaw CRM",description:"Clean multi-tenant CRM for growing sales teams"};

export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="en"><body><AuthGuard><AppShell>{children}</AppShell></AuthGuard></body></html>;
}
