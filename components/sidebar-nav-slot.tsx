import React from "react";
import { getSession } from "@/lib/auth";
import { canSeeRoadmap } from "@/lib/roadmap-access";
import { SidebarNav } from "@/components/navbar";

/** Server side of the sub-nav: decides whether the owner-only Roadmap tab is shown. */
export async function SidebarNavSlot() {
  const session = await getSession();
  return <SidebarNav showRoadmap={canSeeRoadmap(session?.user?.email)} />;
}
