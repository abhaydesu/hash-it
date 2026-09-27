"use client";

import { useEffect, useState } from "react";

/**
 * False during SSR and the first client render, true after. Gate anything that depends
 * on the browser's clock, locale or timezone behind it so server and client HTML match.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
