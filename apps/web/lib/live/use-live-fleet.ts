"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import type { FleetSnapshot, LiveVessel } from "./types";

/** One-shot snapshot refresh. Safe to call from any client component. */
export async function refreshLiveFleet(force = true): Promise<FleetSnapshot> {
  const response = await fetch(`/api/live/fleet${force ? "?force=1" : ""}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Live fleet request failed (${response.status})`);
  const snapshot = (await response.json()) as FleetSnapshot;
  useAppStore.getState().setLiveSnapshot(snapshot);
  return snapshot;
}

/**
 * App-wide live feed.
 *
 * Opens one SSE connection which fans out the shared AISStream socket plus a
 * 15s VesselAPI snapshot. If SSE is unavailable (proxies, some hosts) it falls
 * back to 30s polling so the dashboard never goes stale.
 */
export function useLiveFleetFeed() {
  useEffect(() => {
    let disposed = false;
    let eventSource: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let errorCount = 0;

    const store = useAppStore.getState();
    store.setLiveStatus("connecting");

    const startPolling = () => {
      if (pollTimer || disposed) return;
      pollTimer = setInterval(() => {
        refreshLiveFleet(true).catch((error: Error) => {
          useAppStore.getState().setLiveStatus("offline", error.message);
        });
      }, 30_000);
    };

    const apply = (raw: string) => {
      try {
        const snapshot = JSON.parse(raw) as FleetSnapshot;
        if (Array.isArray(snapshot.vessels)) useAppStore.getState().setLiveSnapshot(snapshot);
      } catch {
        // ignore malformed frames
      }
    };

    refreshLiveFleet(false).catch((error: Error) => {
      useAppStore.getState().setLiveStatus("offline", error.message);
    });

    try {
      eventSource = new EventSource("/api/live/stream");
    } catch {
      startPolling();
      return () => {
        disposed = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    eventSource.onopen = () => {
      errorCount = 0;
      useAppStore.getState().setLiveStatus("live");
    };

    eventSource.addEventListener("fleet", (event) => apply((event as MessageEvent).data));

    eventSource.addEventListener("vessel", (event) => {
      try {
        const vessel = JSON.parse((event as MessageEvent).data) as LiveVessel;
        if (vessel?.mmsi) useAppStore.getState().applyLiveVessel(vessel);
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener("source", (event) => {
      try {
        const patch = JSON.parse((event as MessageEvent).data);
        useAppStore.getState().patchLiveSource(patch);
      } catch {
        // ignore
      }
    });

    eventSource.onerror = () => {
      if (disposed) return;
      errorCount += 1;
      const state = useAppStore.getState();
      if (state.liveVessels.length === 0) {
        state.setLiveStatus("degraded", "live stream reconnecting");
      }
      if (errorCount >= 3) {
        eventSource?.close();
        eventSource = null;
        startPolling();
      }
    };

    return () => {
      disposed = true;
      eventSource?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);
}
