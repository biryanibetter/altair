"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  LayoutDashboard,
  Map,
  AlertTriangle,
  Route,
  Package,
  Factory,
  Brain,
  ShieldCheck,
  Target,
  Bot,
  ChevronLeft,
  ChevronRight,
  Anchor,
  Activity,
  X,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const navItems = [
  { id: "dashboard", label: "Command Center", icon: LayoutDashboard, href: "/" },
  { id: "tracking", label: "Fleet Tracking", icon: Map, href: "/tracking" },
  { id: "crisis", label: "Crisis Mode", icon: AlertTriangle, href: "/crisis" },
  { id: "routes", label: "Route Optimizer", icon: Route, href: "/routes" },
  { id: "inventory", label: "Inventory & Shortage", icon: Package, href: "/inventory" },
  { id: "suppliers", label: "Supplier Hub", icon: Factory, href: "/suppliers" },
  { id: "risk", label: "Risk & Digital Twin", icon: Brain, href: "/risk" },
  { id: "compliance", label: "Compliance Matrix", icon: ShieldCheck, href: "/compliance" },
  { id: "resilience", label: "Resilience Planning", icon: Target, href: "/resilience" },
  { id: "copilot", label: "AI Copilot", icon: Bot, href: "/copilot" },
];

export function Sidebar() {
  const {
    sidebarCollapsed,
    toggleSidebar,
    crisisMode,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useAppStore();
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  return (
    <>
      {/* Mobile Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <button className="hidden sm:inline" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-border bg-sidebar-bg shadow-none">
          <div className="flex items-center justify-between px-3 py-3 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm">
                <Anchor className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold tracking-tight text-foreground truncate">QATAR NSCL</p>
            </div>
            <SheetClose asChild>
              <button className="rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </SheetClose>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-1 space-y-0.5" aria-label="Navigation Links">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? crisisMode ? "bg-crisis/10 text-crisis font-semibold" : "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border px-3 py-2 space-y-1">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide">
              <Activity className="h-2.5 w-2.5" />
              System Status
            </div>
            <div className="space-y-1 text-[9px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uplink</span>
                <span className="flex items-center gap-1 text-success">
                  <span className="live-dot" />
                  Connected
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Feed</span>
                <span className="flex items-center gap-1 text-success">
                  <span className="live-dot" />
                  Live
                </span>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar — narrow persistent rail */}
      <aside
        aria-label="Main Navigation"
        className={cn(
          "hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col border-r border-sidebar-border bg-sidebar-bg",
          sidebarCollapsed ? "w-14" : "w-56"
        )}
      >
        <div className="flex items-center gap-2 px-2 py-3 border-b border-sidebar-border">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm",
              crisisMode ? "bg-crisis/15 text-crisis" : "bg-primary/15 text-primary"
            )}
          >
            <Anchor className="h-3.5 w-3.5" />
          </div>
          {!sidebarCollapsed && (
            <p className="text-[10px] font-bold tracking-tight text-foreground truncate">QATAR NSCL</p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-1.5 px-0.5 space-y-0.5" aria-label="Navigation Links">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? crisisMode ? "bg-crisis/10 text-crisis font-semibold" : "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  sidebarCollapsed ? "justify-center px-1" : ""
                )}
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={sidebarCollapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="border-t border-sidebar-border px-2 py-2 space-y-1">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide">
              <Activity className="h-2.5 w-2.5" />
              System Status
            </div>
            <div className="space-y-1 text-[9px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uplink</span>
                <span className="flex items-center gap-1 text-success">
                  <span className="live-dot" />
                  Connected
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Feed</span>
                <span className="flex items-center gap-1 text-success">
                  <span className="live-dot" />
                  Live
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center border-t border-sidebar-border py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Mobile hamburger trigger (outside Sheet, for header) */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open navigation menu"
        className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
    </>
  );
}
