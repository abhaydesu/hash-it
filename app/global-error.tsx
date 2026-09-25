"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center text-foreground font-sans antialiased">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-medium tracking-tight">Critical Application Error</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A critical error occurred at the root level of the application.
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="pressable border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
