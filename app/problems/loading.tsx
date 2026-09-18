import { SheetSection } from "@/components/ui/sheet-section";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="h-7 w-32 bg-muted rounded"></div>
        <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
      </SheetSection>
      <SheetSection innerClassName="pb-10 pt-2" band="none" last>
        <div className="space-y-4">
          <div className="flex gap-2 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 w-24 bg-muted rounded"></div>
            ))}
          </div>
          <div className="flex justify-between mb-2">
            <div className="h-8 w-64 bg-muted rounded"></div>
            <div className="flex gap-2">
              <div className="h-8 w-32 bg-muted rounded"></div>
              <div className="h-8 w-32 bg-muted rounded"></div>
              <div className="h-8 w-32 bg-muted rounded"></div>
            </div>
          </div>
          <div className="w-full border border-border">
            <div className="h-10 border-b border-border bg-muted/30"></div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 border-b border-border bg-muted/10"></div>
            ))}
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
