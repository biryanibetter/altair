"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  Bell,
  AlertTriangle,
  Shield,
  Clock,
} from "lucide-react";

export function Topbar() {
  const { crisisMode, toggleCrisisMode, notificationCount } = useAppStore();
  const [currentTime, setCurrentTime] = useState("07 Nov 2026 — 01:56 AST");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} AST`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-10 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 sm:px-4 transition-all duration-300",
        "left-0 md:left-56"
      )}
    >
      {/* Crisis banner */}
      {crisisMode && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-crisis" />
      )}

      {/* Left: page context */}
      <div className="flex items-center gap-2">
        {crisisMode && (
          <div className="flex items-center gap-1 rounded-md bg-crisis/15 px-1.5 py-0.5 border border-crisis/30">
            <AlertTriangle className="h-3 w-3 text-crisis" />
            <span className="text-[10px] font-bold text-crisis tracking-wide uppercase">Crisis Active</span>
          </div>
        )}
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Right: status + actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="live-dot" />
          <span className="hidden xs:inline">Live</span>
        </div>

        <button
          aria-label={notificationCount > 0 ? `${notificationCount} unread notifications` : "Notifications"}
          className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary transition-colors"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-crisis text-[10px] font-bold text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        <button
          onClick={toggleCrisisMode}
          aria-label={crisisMode ? "Exit crisis mode" : "Activate crisis mode"}
          className={cn(
            "flex items-center gap-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-colors border shadow-none",
            crisisMode
              ? "bg-crisis/15 text-crisis border-crisis/30 hover:bg-crisis/25"
              : "bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground"
          )}
        >
          <Shield className="h-3 w-3" />
          <span className="hidden sm:inline">{crisisMode ? "Exit Crisis" : "Crisis Mode"}</span>
        </button>
      </div>
    </header>
  );
}
