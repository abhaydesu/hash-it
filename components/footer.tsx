import React from "react";
import Link from "next/link";
import { SheetSection } from "@/components/ui/sheet-section";
import { GUIDE_PATH } from "@/lib/site";

export function Footer() {
  return (
    <SheetSection last>
      <div className="flex flex-wrap items-center justify-between gap-2 py-4 text-muted-foreground">
        <Link href="/" className="flex items-center gap-2 hover:text-foreground">
          <span className="">hash-it</span>
        </Link>
        <nav className="flex items-center gap-1 text-xs">
          <Link href={GUIDE_PATH} className="mr-3 hover:text-foreground">
            Spaced repetition guide
          </Link>
          <span>Built by</span>
          <Link target="_blank" href="https://abhaydesu.me" className="hover:text-foreground">@abhaydesu</Link>
        </nav>
      </div>
    </SheetSection>
  );
}
