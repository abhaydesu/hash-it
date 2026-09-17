import { SheetSection } from "@/components/ui/sheet-section";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="mx-auto max-w-2xl space-y-5 py-8" last>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-36 bg-muted rounded"></div>
          </div>

          <div className="h-8 w-96 bg-muted rounded"></div>

          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded"></div>
            <div className="h-4 w-5/6 bg-muted rounded"></div>
          </div>

          <div className="h-4 w-4/5 bg-muted/70 rounded"></div>

          <div className="space-y-2.5 border border-border bg-dither-25 p-4">
            <div className="h-4 w-32 bg-muted rounded"></div>
            <div className="space-y-2 pt-1">
              <div className="h-3 w-3/4 bg-muted/60 rounded"></div>
              <div className="h-3 w-5/6 bg-muted/60 rounded"></div>
              <div className="h-3 w-2/3 bg-muted/60 rounded"></div>
              <div className="h-3 w-4/5 bg-muted/60 rounded"></div>
            </div>
          </div>

          <div className="pt-2">
            <div className="h-9 w-36 bg-muted rounded"></div>
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
