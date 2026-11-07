"use client";

import React from "react";
import { useLiveFleetFeed } from "@/lib/live/use-live-fleet";

/** Runs the single app-wide live feed (SSE + polling fallback). */
export function LiveFleetProvider({ children }: { children: React.ReactNode }) {
  useLiveFleetFeed();
  return <>{children}</>;
}
