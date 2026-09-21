"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000/api";

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(pathname === "/login");

  useEffect(() => {
    if (pathname === "/login") {
      setReady(true);
      return;
    }
    setReady(false);
    fetch(`${apiUrl}/auth/me`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("Unauthenticated");
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [pathname, router]);

  if (!ready) return <main className="authPage"><p>Loading workspace...</p></main>;
  return <>{children}</>;
}
