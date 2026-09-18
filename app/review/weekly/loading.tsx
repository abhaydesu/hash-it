import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="h-7 w-64 bg-muted rounded"></div>
            <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-8 w-32 bg-muted rounded"></div>
            <div className="h-8 w-24 bg-muted rounded"></div>
          </div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
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

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-muted rounded"></div>
          <div className="h-4 w-20 bg-muted rounded"></div>
        </div>
        <div className="divide-y divide-border border border-border bg-background">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="h-4 w-3/4 bg-muted rounded"></div>
              <div className="h-4 w-1/2 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
