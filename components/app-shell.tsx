"use client";
import React from 'react';

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Navbar, SidebarNav } from "@/components/navbar";
import { MonthlyMockProvider } from "@/components/monthly-mock-provider";

/**
 * Sheet chrome. Most routes stay at 1040px; /problems expands for the dense grid.
 */
export function AppShell({
  children,
  user,
  userMenu,
}: {
  children: ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  userMenu?: ReactNode;
}) {
  const pathname = usePathname();
  const wide = pathname.startsWith("/problems");

  return (
    <MonthlyMockProvider>
      <div className="relative flex min-h-screen w-full flex-col overflow-x-clip bg-background">
        <div
          className={cn(
            "relative z-20 mx-auto flex w-full flex-1 flex-col border-x border-border bg-background transition-[max-width] duration-modal ease-in-out-strong",
            wide ? "max-w-[1360px]" : "max-w-[1040px]"
          )}
        >
          <Navbar user={user} userMenu={userMenu} />
          <SidebarNav />
          <main className="w-full flex-1">{children}</main>
        </div>
      </div>
    </MonthlyMockProvider>
  );
}
