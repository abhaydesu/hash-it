import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

export const alt = "Hash-It: a LeetCode and DSA tracker that schedules re-solves with spaced repetition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Shared link preview (Open Graph + Twitter). Rendered once at build time. */
export default function OpenGraphImage() {
  const host = new URL(SITE_URL).host;
  const days = [1, 3, 7, 16, 35];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#fafaf9",
          color: "#1c1917",
          borderTop: "16px solid #f97316",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#ea580c" }}>
          {/* The logo mark (public/logo-2.svg), drawn inline. */}
          <svg width="44" height="44" viewBox="0 0 96 96">
            <rect x="24" y="6" width="12" height="84" fill="#1c1917" />
            <rect x="60" y="6" width="12" height="84" fill="#1c1917" />
            <rect x="6" y="24" width="84" height="12" fill="#1c1917" />
            <rect x="6" y="60" width="84" height="12" fill="#1c1917" />
            <rect x="36" y="36" width="24" height="24" fill="#F97316" />
          </svg>
          <span style={{ fontWeight: 600 }}>Hash-It</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>
            Remember every LeetCode problem you solve.
          </div>
          <div style={{ fontSize: 30, color: "#57534e", lineHeight: 1.35 }}>
            A LeetCode &amp; DSA tracker that schedules each re-solve with spaced repetition, right before you forget.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, color: "#78716c" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {days.map((d) => (
              <div key={d} style={{ display: "flex", border: "2px solid #f97316", color: "#c2410c", padding: "6px 14px" }}>
                day {d}
              </div>
            ))}
          </div>
          <span>{host}</span>
        </div>
      </div>
    ),
    size,
  );
}
