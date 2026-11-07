"use client";

import React, { useState } from "react";
import { riskFactors, riskTrendData, RiskFactor } from "@/lib/mock-data";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Brain,
  ShieldAlert,
  Flame,
  CloudSun,
  Activity,
  Globe,
  Sliders,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";

export default function RiskSimulatorPage() {
  // Sandbox Simulator State
  const [portClosureDays, setPortClosureDays] = useState(14);
  const [fuelSpikePercent, setFuelSpikePercent] = useState(35);
  const [blockadeSeverity, setBlockadeSeverity] = useState(60); // 0 to 100%
  const [cyberDisruptionHours, setCyberDisruptionHours] = useState(24);

  // Projected downstream impact calculations
  const projectedLossUSD = Math.round(
    (portClosureDays * 18_500_000 +
      fuelSpikePercent * 1_200_000 +
      blockadeSeverity * 4_500_000 +
      cyberDisruptionHours * 850_000)
  );

  const projectedDepletionRate = Math.min(
    100,
    Math.round(portClosureDays * 4.2 + blockadeSeverity * 0.45)
  );

  const criticalStockoutCount = Math.min(
    12,
    Math.max(1, Math.round(portClosureDays / 3 + blockadeSeverity / 25))
  );

  const handleResetSandbox = () => {
    setPortClosureDays(0);
    setFuelSpikePercent(0);
    setBlockadeSeverity(0);
    setCyberDisruptionHours(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Risk Assessment & Digital Twin Sandbox Simulator
            </h1>
            <Badge variant="outline" className="border-purple-500/50 text-purple-400 font-mono text-[10px]">
              DIGITAL TWIN TWIN-SYS 2026
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stress-test Qatar&apos;s national logistics ecosystem against geopolitical blockades, climate extremes, and fuel price volatility
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetSandbox}
            className="text-xs h-8"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset Variables
          </Button>
        </div>
      </div>

      {/* "What-If" Stress-Test Sandbox Simulator */}
      <Card className="bg-card/70 border-border/70 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4 text-purple-400" />
                What-If Sandbox Simulator: Cascading Disruption Engine
              </CardTitle>
              <CardDescription className="text-xs">
                Slide parameters to calculate compound systemic risk and downstream stockout projections
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] bg-purple-950/40 border-purple-500/40 text-purple-300">
              REAL-TIME MONTE CARLO
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2 space-y-6">
          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Hamad Port Sea Closure:</span>
                <span className="font-bold font-mono text-purple-400">{portClosureDays} Days</span>
              </div>
              <Slider
                value={[portClosureDays]}
                onValueChange={(val) => setPortClosureDays(val[0])}
                max={60}
                step={1}
              />
              <span className="text-[10px] text-muted-foreground">Normal operations = 0 days</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Global Bunker Fuel Surge:</span>
                <span className="font-bold font-mono text-amber-400">+{fuelSpikePercent}%</span>
              </div>
              <Slider
                value={[fuelSpikePercent]}
                onValueChange={(val) => setFuelSpikePercent(val[0])}
                max={100}
                step={5}
              />
              <span className="text-[10px] text-muted-foreground">Baseline spot index = $580/MT</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Hormuz Blockade Severity:</span>
                <span className="font-bold font-mono text-red-400">{blockadeSeverity}% Interdiction</span>
              </div>
              <Slider
                value={[blockadeSeverity]}
                onValueChange={(val) => setBlockadeSeverity(val[0])}
                max={100}
                step={5}
              />
              <span className="text-[10px] text-muted-foreground">Percentage of vessels stopped</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Customs EDI Cyber Outage:</span>
                <span className="font-bold font-mono text-sky-400">{cyberDisruptionHours} Hours</span>
              </div>
              <Slider
                value={[cyberDisruptionHours]}
                onValueChange={(val) => setCyberDisruptionHours(val[0])}
                max={96}
                step={6}
              />
              <span className="text-[10px] text-muted-foreground">Requires manual paperwork fallback</span>
            </div>
          </div>

          {/* Projected Impact Output Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-purple-950/20 border border-purple-500/30">
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300">Projected Sovereign Economic Loss</span>
              <p className="text-xl font-black text-foreground mt-0.5">
                {formatCurrency(projectedLossUSD)}
              </p>
              <p className="text-[10px] text-muted-foreground">In demurrages, air expedites & spoilage</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300">Stockpile Acceleration Burn</span>
              <p className="text-xl font-black text-amber-400 mt-0.5">
                +{projectedDepletionRate}% Faster Depletion
              </p>
              <p className="text-[10px] text-muted-foreground">National reserves consumed ahead of plan</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300">Critical Category Stockouts</span>
              <p className="text-xl font-black text-red-400 mt-0.5">
                {criticalStockoutCount} Material Lines Threatened
              </p>
              <p className="text-[10px] text-muted-foreground">Requiring domestic production reallocation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Risk Index Trajectory (Recharts Area Chart) */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">
            Multi-Domain Geopolitical & Operational Risk Trajectory
          </CardTitle>
          <CardDescription className="text-xs">
            Composite threat indexes (0-100) tracked over the past 7 months across GCC shipping lanes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="geopolitical" name="Geopolitical / Chokepoint Threat" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="supply" name="Supplier & Material Concentration" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="infrastructure" name="Port & Cyber Infrastructure" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="climate" name="Climate & Heat Wave Disruptions" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Active Geopolitical & Systemic Risk Factor Scorecards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Sovereign Risk Factor Matrix & Threat Registers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {riskFactors.map((rf) => (
            <Card key={rf.id} className="bg-card/70 border-border/70 hover:border-border transition-colors">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <Badge
                    variant={rf.category === "geopolitical" ? "crisis" : rf.category === "infrastructure" ? "warning" : "outline"}
                    className="text-[9px] uppercase font-bold"
                  >
                    {rf.category}
                  </Badge>
                  <span className={cn(
                    "font-bold font-mono text-sm",
                    rf.score >= 70 ? "text-red-400" : rf.score >= 50 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {rf.score} / 100
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-foreground leading-snug">{rf.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {rf.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Likelihood: <strong>{rf.likelihood}%</strong></span>
                  <span className={cn(
                    "font-semibold uppercase",
                    rf.trend === "rising" ? "text-red-400" : "text-muted-foreground"
                  )}>
                    Trend: {rf.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
