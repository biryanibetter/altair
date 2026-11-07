"use client";

import React, { useState } from "react";
import { resilienceData } from "@/lib/mock-data";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  TrendingUp,
  Shield,
  Factory,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  Flame,
  Globe,
  Award,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

const strategicMilestones = [
  { year: "2024", title: "National Food Reserve Program", status: "completed", desc: "Built 125,000 MT strategic grain storage silos at Hamad Port." },
  { year: "2025", title: "Baladna Dairy & Agro Sovereignty", status: "completed", desc: "100% self-sufficiency achieved in fresh dairy & poultry products." },
  { year: "2026", title: "Mesaieed Industrial Steel Expansion", status: "in-progress", desc: "Targeting 55% domestic rebar and steel coil manufacturing." },
  { year: "2027", title: "Doha Pharma Biologics Plant", status: "in-progress", desc: "Local production of insulin, vaccines, and IV fluids to cover 35% of national demand." },
  { year: "2028", title: "Free Zone Semiconductor Assembly Hub", status: "planned", desc: "Precision assembly of critical energy and drone control microchips." },
  { year: "2030", title: "Qatar National Vision 2030 Fulfillment", status: "planned", desc: "Net sovereign import dependency below 40% across all vital security categories." },
];

export default function ResiliencePage() {
  const [selectedSector, setSelectedSector] = useState(resilienceData[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              National Resilience Planning & Qatar Vision 2030
            </h1>
            <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px]">
              QNV 2030 ROADMAP
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Long-term strategic roadmap tracking foreign import dependencies vs. domestic manufacturing capacity growth
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs h-8">
            <Award className="h-3.5 w-3.5 mr-1" />
            Download Sovereign Masterplan
          </Button>
        </div>
      </div>

      {/* Main Sector Comparison Bar Chart */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Import Dependency vs Local Manufacturing vs Vision 2030 Targets
              </CardTitle>
              <CardDescription className="text-xs">
                Percentage of national consumption by industrial sector
              </CardDescription>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">7 KEY SECTORS</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resilienceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="category" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="importDep" name="Current Import Dependency (%)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="localCap" name="Current Domestic Production (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target2030" name="Vision 2030 Domestic Target (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sector Resilience Heatmap Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Sector Sovereign Vulnerability Heatmap
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {resilienceData.map((sec) => {
            const gap = sec.target2030 - sec.localCap;
            return (
              <Card
                key={sec.category}
                className={cn(
                  "bg-card/70 border cursor-pointer transition-all hover:border-primary",
                  sec.importDep > 80 ? "border-red-500/30" : "border-border/70"
                )}
                onClick={() => setSelectedSector(sec)}
              >
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{sec.category}</span>
                    <Badge
                      variant={sec.importDep > 80 ? "crisis" : sec.importDep > 50 ? "warning" : "success"}
                      className="text-[9px]"
                    >
                      {sec.importDep}% Dep.
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Domestic Share</span>
                      <span className="font-mono text-foreground">{sec.localCap}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${sec.localCap}%` }} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex justify-between text-[10px]">
                    <span className="text-muted-foreground">2030 Goal: <strong>{sec.target2030}%</strong></span>
                    <span className="text-emerald-400 font-semibold">+{gap}% Needed</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Strategic Vision 2030 Milestones Timeline */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Sovereign Resilience Milestones (2024 - 2030)
          </CardTitle>
          <CardDescription className="text-xs">
            Infrastructure investments expanding domestic industrial security
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="relative border-l border-border/60 ml-4 space-y-6 py-2">
            {strategicMilestones.map((m, idx) => (
              <div key={idx} className="relative pl-6">
                <span className={cn(
                  "absolute -left-2 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                  m.status === "completed"
                    ? "bg-emerald-600 text-white"
                    : m.status === "in-progress"
                    ? "bg-primary text-white animate-pulse"
                    : "bg-secondary text-muted-foreground border border-border"
                )}>
                  {m.status === "completed" ? "✓" : idx + 1}
                </span>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-primary">{m.year}</span>
                    <h4 className="text-xs font-bold text-foreground">{m.title}</h4>
                  </div>
                  <Badge
                    variant={m.status === "completed" ? "success" : m.status === "in-progress" ? "secondary" : "outline"}
                    className="text-[9px] uppercase self-start sm:self-auto"
                  >
                    {m.status}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
