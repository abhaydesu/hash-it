import { SheetSection } from "@/components/ui/sheet-section";

export default function Loading() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <div className="h-7 w-48 bg-muted rounded"></div>
          <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="none">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-20 bg-background p-3 flex flex-col justify-between">
              <div className="h-3 w-20 bg-muted rounded"></div>
              <div className="flex justify-between">
                <div className="h-4 w-8 bg-muted rounded"></div>
                <div className="h-3 w-12 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
