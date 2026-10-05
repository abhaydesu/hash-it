"use client";

import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect, useRef } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function syncIframeTheme(iframe: HTMLIFrameElement | null, isDark: boolean) {
  const root = iframe?.contentDocument?.documentElement;
  if (!root) return;
  const theme = isDark ? "dark" : "light";
  const ground = isDark ? "hsl(30, 6%, 8%)" : "hsl(50, 8%, 97%)";
  root.dataset.embed = "true";
  root.dataset.theme = theme;
  root.style.setProperty("--ground", ground);
  root.style.setProperty("--hairline-plate", ground);
}

/** Show the interactive drawing only; the feature copy around it provides context. */
export function HairlineFigure({ page, title, id }: { page: string; title: string; id?: string }) {
  const { resolvedTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!resolvedTheme) return;
    syncIframeTheme(iframeRef.current, resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const syncFromDom = () => {
      syncIframeTheme(iframeRef.current, root.classList.contains("dark"));
    };
    syncFromDom();
    const observer = new MutationObserver(syncFromDom);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <iframe
      ref={iframeRef}
      id={id}
      title={title}
      src={`/${page}?embed=1`}
      onLoad={() => {
        const isDark =
          resolvedTheme != null
            ? resolvedTheme === "dark"
            : document.documentElement.classList.contains("dark");
        syncIframeTheme(iframeRef.current, isDark);
      }}
      className="mx-auto block aspect-[5/4] w-full max-w-[400px] border-0"
      loading="lazy"
    />
  );
}
