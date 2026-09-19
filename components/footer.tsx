import React from "react";
import Link from "next/link";
import { SheetSection } from "@/components/ui/sheet-section";

export function Footer() {
  return (
    <SheetSection last>
      <div className="flex items-center justify-between py-4 text-muted-foreground">
        <Link href="/" className="flex items-center gap-2 hover:text-foreground">
          <span className="">hash-it</span>
        </Link>
        <nav className="flex items-center gap-1 text-xs">
          <span>Built by</span>
          <Link target="_blank" href="https://abhaydesu.me" className="hover:text-foreground">@abhaydesu</Link>
        </nav>
      </div>
    </SheetSection>
  );
}
