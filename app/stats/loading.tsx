import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="h-7 w-64 bg-muted rounded"></div>
        <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SpecCell
              key={i}
              label={<div className="h-3 w-28 bg-muted/60 rounded" />}
              value={<div className="h-6 w-16 bg-muted rounded mt-1" />}
              subvalue={<div className="h-3 w-36 bg-muted/40 rounded mt-1" />}
            />
          ))}
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-36 bg-muted rounded"></div>
            <div className="mt-1 h-3 w-48 bg-muted rounded"></div>
          </div>
          <div className="h-8 w-32 bg-muted rounded"></div>
        </div>
        <div className="h-36 w-full border border-border bg-muted/10"></div>
      </SheetSection>
    </div>
  );
}
