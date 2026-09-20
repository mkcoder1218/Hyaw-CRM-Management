import "./styles.css";
import type { ReactNode } from "react";
export const metadata={title:"Hyaw CRM Admin"};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body>{children}</body></html>}
