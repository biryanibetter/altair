"use client";

import React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { AICopilot } from "@/components/copilot/ai-copilot";
import { LiveSimulationTicker } from "@/components/telemetry/live-simulation-ticker";
import { LiveFleetProvider } from "@/components/providers/live-fleet-provider";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, crisisMode } = useAppStore();

  return (
    <LiveFleetProvider>
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <LiveSimulationTicker />
      <Sidebar />
      <Topbar />

      <main
        className={cn(
          "flex flex-col min-h-screen pt-10 pb-4 transition-[padding] duration-300",
          sidebarCollapsed ? "pl-4 md:pl-14" : "pl-4 md:pl-56"
        )}
      >
        {crisisMode && (
          <div className="bg-crisis/15 border-b border-crisis/40 px-3 py-1.5 flex items-center justify-between text-[10px] text-crisis-foreground">
            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 rounded-full bg-crisis" />
              <strong className="tracking-wide">Critical Advisory:</strong>
              <span>
                Wartime Supply Chain Protocol Active — Strait of Hormuz maritime corridor impassable. Land bridge & emergency airlift protocols prioritized.
              </span>
            </div>
            <span className="text-[10px] font-mono text-crisis">Defcon Level 2</span>
          </div>
        )}

        <div className="flex-1 p-3 md:p-4 space-y-3 max-w-none w-full overflow-y-auto">
          {children}
        </div>
      </main>

      <AICopilot />
    </div>
    </LiveFleetProvider>
  );
}
