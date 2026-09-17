import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-4 bg-muted rounded"></div>
          <div className="h-4 w-24 bg-muted rounded"></div>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="h-8 w-64 bg-muted rounded"></div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-4 w-16 bg-muted rounded"></div>
              <div className="h-4 w-16 bg-muted rounded"></div>
            </div>
          </div>
          <div className="h-8 w-32 bg-muted rounded"></div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SpecCell
              key={i}
              label={<div className="h-3 w-20 bg-muted/60 rounded" />}
              value={<div className="h-6 w-16 bg-muted rounded mt-1" />}
            />
          ))}
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="space-y-6 py-6" band="none" last>
        <div className="space-y-4">
          <div className="h-5 w-32 bg-muted rounded"></div>
          <div className="h-20 w-full bg-muted/40 border border-border"></div>
        </div>
      </SheetSection>
    </div>
  );
}
