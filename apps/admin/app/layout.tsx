import "./styles.css";
import type { ReactNode } from "react";
import { AdminAuthGuard } from "./components/auth-guard";

export const metadata = { title: "Hyaw CRM Admin" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><AdminAuthGuard>{children}</AdminAuthGuard></body></html>;
}
