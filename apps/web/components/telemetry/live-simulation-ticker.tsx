"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export function LiveSimulationTicker() {
  const { incrementTick, crisisMode } = useAppStore();

  useEffect(() => {
    // Tick every 4 seconds to animate simulated telemetry
    const interval = setInterval(() => {
      incrementTick();
    }, 4000);

    return () => clearInterval(interval);
  }, [incrementTick]);

  return null;
}
