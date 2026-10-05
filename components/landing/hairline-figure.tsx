"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/** Show the interactive drawing only; the feature copy around it provides context. */
export function HairlineFigure({ page, title, id }: { page: string; title: string; id?: string }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const [background, setBackground] = useState("");

  useEffect(() => {
    setBackground(window.getComputedStyle(document.body).backgroundColor);
  }, [resolvedTheme]);

  const query = new URLSearchParams({ theme, embed: "1", ground: background });

  return (
    <iframe
      id={id}
      title={title}
      src={`/${page}?${query.toString()}`}
      className="mx-auto block aspect-[5/4] w-full max-w-[400px] border-0"
      loading="lazy"
    />
  );
}
