import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="h-7 w-48 bg-muted rounded"></div>
        <div className="mt-2 h-4 w-80 max-w-full bg-muted rounded"></div>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6" band="neutral">
        <div className="h-5 w-32 bg-muted rounded"></div>
        <SpecGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SpecCell
              key={i}
              label={<div className="h-3 w-24 bg-muted/60 rounded" />}
              value={<div className="h-6 w-12 bg-muted rounded mt-1" />}
            />
          ))}
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6" last>
        <div className="h-5 w-40 bg-muted rounded"></div>
        <div className="divide-y divide-border border border-border bg-background">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 p-4">
              <div className="h-4 w-2/3 bg-muted rounded"></div>
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-9 w-24 bg-muted/60 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
