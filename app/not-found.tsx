import Link from "next/link";
import { SheetSection } from "@/components/ui/sheet-section";

export default function NotFound() {
  return (
    <SheetSection innerClassName="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center" last>
      <div className="flex flex-col items-center gap-2">
        <h2 className="type-heading text-foreground">Page not found</h2>
        <p className="max-w-md type-body text-muted-foreground">
          The page you requested does not exist or was moved.
        </p>
      </div>
      <Link
        href="/today"
        className="pressable border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        Back to Today
      </Link>
    </SheetSection>
  );
}
