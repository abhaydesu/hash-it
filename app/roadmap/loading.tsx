import { SheetSection } from "@/components/ui/sheet-section";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-7 w-48 bg-muted rounded"></div>
            <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
          </div>
          <div className="flex shrink-0 items-center gap-4 bg-muted/30 px-4 py-3 border border-border">
            <div className="space-y-1">
              <div className="h-3 w-20 bg-muted rounded"></div>
              <div className="h-4 w-12 bg-muted rounded"></div>
            </div>
            <div className="space-y-1">
              <div className="h-3 w-8 bg-muted rounded ml-auto"></div>
              <div className="h-1.5 w-24 bg-muted rounded"></div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-stretch justify-between gap-3 pt-2 text-xs sm:flex-row sm:items-center">
          <div className="h-8 w-full max-w-md bg-muted/40 border border-border"></div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-44 bg-muted/40 border border-border"></div>
            <div className="h-8 w-24 bg-muted/40 border border-border"></div>
          </div>
        </div>
      </SheetSection>
      <SheetSection innerClassName="py-6" last>
        <div className="divide-y divide-border border border-border bg-background">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="flex w-full items-center justify-between bg-muted/30 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 bg-muted rounded"></div>
                  <div className="h-5 w-5 bg-background border border-border"></div>
                  <div className="h-4 w-40 bg-muted rounded"></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 w-20 bg-muted rounded"></div>
                  <div className="hidden h-1.5 w-16 bg-muted sm:block"></div>
                </div>
              </div>
              {i === 0 && (
                <div className="divide-y divide-border border-t border-border bg-background">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-4 bg-muted/60 rounded"></div>
                        <div className="h-4 w-4 rounded-full border border-border"></div>
                        <div className="h-4 w-56 bg-muted rounded"></div>
                      </div>
                      <div className="h-3 w-16 bg-muted/60 rounded"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
