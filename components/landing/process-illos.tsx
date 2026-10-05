export function ImportStepIllo({ kind }: { kind: "screenshot" | "prompt" | "upload" }) {
  return (
    <svg viewBox="0 0 160 66" className="block h-16 w-full" aria-hidden="true">
      {kind === "screenshot" && (
        <>
          <rect x="17" y="7" width="126" height="52" className="fill-background stroke-border" strokeWidth="1.25" />
          <path d="M17 17h126" className="fill-none stroke-border" strokeWidth="1" />
          <rect x="25" y="25" width="47" height="26" className="fill-muted/20 stroke-border" strokeWidth="1" />
          <path d="M31 45l9-9 7 5 9-10 10 10" className="fill-none stroke-primary" strokeWidth="1.5" />
          <path d="M82 27h50m-50 7h40m-40 7h45m-45 7h31" className="fill-none stroke-border" strokeWidth="2" />
        </>
      )}
      {kind === "prompt" && (
        <>
          <path d="M20 15h75v25H35l-9 8v-8h-6z" className="fill-background stroke-border" strokeWidth="1.25" />
          <path d="M29 24h54m-54 7h42" className="fill-none stroke-border" strokeWidth="2" />
          <path d="M63 43h76v15H73l-10 6z" className="fill-muted/20 stroke-border" strokeWidth="1.25" />
          <path d="M73 50h56" className="fill-none stroke-primary" strokeWidth="2" />
        </>
      )}
      {kind === "upload" && (
        <>
          <rect x="31" y="6" width="98" height="54" className="fill-background stroke-border" strokeWidth="1.25" />
          <path d="M31 19h98M57 19v41m31-41v41" className="fill-none stroke-border" strokeWidth="1" />
          <path d="M36 29h15m-15 10h15m-15 10h15M62 29h22m-22 10h22m-22 10h17" className="fill-none stroke-border" strokeWidth="2" />
          <path d="m98 40 5 5 10-12" className="fill-none stroke-primary" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
