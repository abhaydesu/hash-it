import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-bold tracking-tight">Page not found</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you requested does not exist or was moved.
        </p>
      </div>
      <Link
        href="/today"
        className="pressable border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        Back to Today
      </Link>
    </div>
  );
}
