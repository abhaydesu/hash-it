import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <div className="h-7 w-32 bg-muted rounded"></div>
          <div className="mt-2 h-4 w-64 bg-muted rounded"></div>
        </div>
        <div className="h-8 w-32 bg-muted rounded"></div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SpecCell
              key={i}
              label={<div className="h-3 w-20 bg-muted/60 rounded" />}
              value={<div className="h-6 w-12 bg-muted rounded mt-1" />}
            />
          ))}
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="py-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-5 w-24 bg-muted rounded"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 w-full bg-muted/40 border border-border"></div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
