import { PageSkeleton } from "@/components/ui/loader";
import { SheetSection } from "@/components/ui/sheet-section";

export default function Loading() {
  return (
    <SheetSection band="none" last>
      <PageSkeleton rows={5} />
    </SheetSection>
  );
}
