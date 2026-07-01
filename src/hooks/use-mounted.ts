"use client";

import { useSyncExternalStore } from "react";

/**
 * useMounted — SSR-safe "are we on the client?" using useSyncExternalStore
 * (the React-recommended pattern; avoids setState-in-effect lint issues).
 */
const emptySubscribe = () => () => {};
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false // server snapshot
  );
}
