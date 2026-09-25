"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * `null` on the server and during hydration — the platform is unknown there,
 * so callers must not guess (guessing `false` flashes "Ctrl" on Macs).
 * Resolves to a boolean before first paint on the client.
 */
export function useIsMac(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeNever,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => null
  );
}
