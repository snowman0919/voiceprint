"use client";

import { useEffect } from "react";

export function StaticCacheRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/service-worker.js");
  }, []);
  return null;
}
