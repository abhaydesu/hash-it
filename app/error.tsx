"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { SheetSection } from "@/components/ui/sheet-section";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SheetSection innerClassName="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center" last>
      <div className="flex flex-col items-center gap-2">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h2 className="type-heading text-foreground">Something went wrong</h2>
        <p className="max-w-md type-body text-muted-foreground">
          An unexpected error occurred while rendering this page.
        </p>
      </div>
      <button
        onClick={() => reset()}
        className="pressable border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        Try again
      </button>
    </SheetSection>
  );
}
