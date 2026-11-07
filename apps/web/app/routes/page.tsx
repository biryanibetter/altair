"use client";

import React, { useState } from "react";
import { routeOptions, RouteOption } from "@/lib/mock-data";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Route,
  Clock,
  DollarSign,
  ShieldAlert,
  Leaf,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// Comprehensive route list ensuring every strategic origin corridor has baseline and alternative lanes
const allRoutes: RouteOption[] = [
  ...routeOptions,
  {
    id: "RT-04B",
    name: "Mumbai → Doha (Air Cargo Express)",
    mode: "air",
    origin: "Mumbai",
    destination: "Doha (DOH)",
    distance: 2300,
    transitDays: 1,
    costUSD: 185000,
    costQAR: 673400,
    carbonKg: 12500,
    riskScore: 8,
    customs: 4000,
    handling: 6500,
    insurance: 3200,
    reliability: 98,
    waypoints: [[18.95, 72.95], [25.27, 51.61]],
  },
];

type Corridor = "all" | "Shanghai" | "Rotterdam" | "Mumbai";

const corridors: { id: Corridor; label: string }[] = [
  { id: "all", label: "All Corridors" },
  { id: "Shanghai", label: "Shanghai → Qatar (Far East)" },
  { id: "Rotterdam", label: "Rotterdam → Qatar (Europe)" },
  { id: "Mumbai", label: "Mumbai → Qatar (South Asia)" },
];

export default function RoutesPage() {
  const [selectedCorridor, setSelectedCorridor] = useState<Corridor>("Shanghai");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("RT-01");
  const [manualComparisonId, setManualComparisonId] = useState<string | null>(null);

  // Weights for optimization engine (0 to 100)
  const [costWeight, setCostWeight] = useState(50);
  const [speedWeight, setSpeedWeight] = useState(70);
  const [riskWeight, setRiskWeight] = useState(80);
  const [carbonWeight, setCarbonWeight] = useState(30);

  // Calculate normalized weight percentages (Sum = 100%)
  const totalWeight = costWeight + speedWeight + riskWeight + carbonWeight || 1;
  const rawCostPct = Math.round((costWeight / totalWeight) * 100);
  const rawSpeedPct = Math.round((speedWeight / totalWeight) * 100);
  const rawRiskPct = Math.round((riskWeight / totalWeight) * 100);
  const rawCarbonPct = 100 - (rawCostPct + rawSpeedPct + rawRiskPct);

  const costPercent = Math.max(0, rawCostPct);
  const speedPercent = Math.max(0, rawSpeedPct);
  const riskPercent = Math.max(0, rawRiskPct);
  const carbonPercent = Math.max(0, rawCarbonPct);

  // Filter routes based on active strategic corridor
  const filteredRoutes =
    selectedCorridor === "all"
      ? allRoutes
      : allRoutes.filter((r) => r.origin.toLowerCase() === selectedCorridor.toLowerCase());

  // Compute composite score for each route within the corridor
  const scoredRoutes = filteredRoutes
    .map((r) => {
      const costScore = (1 - r.costUSD / 1_000_000) * 100;
      const speedScore = (1 - r.transitDays / 35) * 100;
      const safetyScore = (1 - r.riskScore / 100) * 100;
      const carbonScore = (1 - r.carbonKg / 50_000) * 100;

      const totalScore =
        (costScore * costWeight +
          speedScore * speedWeight +
          safetyScore * riskWeight +
          carbonScore * carbonWeight) /
        totalWeight;

      return {
        ...r,
        compositeScore: Math.round(totalScore),
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const bestRoute = scoredRoutes[0] || filteredRoutes[0] || allRoutes[0];

  // Resolve Candidate Route A
  const selectedRoute =
    scoredRoutes.find((r) => r.id === selectedRouteId) || bestRoute;

  // Candidate B is tied directly as the top alternative for Candidate A
  const topAlternative =
    scoredRoutes.find((r) => r.id !== selectedRoute.id) || selectedRoute;

  const comparisonRoute =
    manualComparisonId && manualComparisonId !== selectedRoute.id
      ? scoredRoutes.find((r) => r.id === manualComparisonId) || topAlternative
      : topAlternative;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <Route className="h-6 w-6 text-primary" />
              AI Route & Multi-Criteria Cost Optimization Engine
            </h1>
            <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px] bg-primary/5">
              Algorithmic Simulation v4.2 · Calibrated for Qatar Sovereign Logistics
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Algorithmic trade-off engine balancing freight cost (USD / QAR), transit latency, geopolitical risk, and maritime insurance surcharges
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setSelectedRouteId(bestRoute.id);
              setManualComparisonId(null);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Select AI Recommended ({bestRoute.name})
          </Button>
        </div>
      </div>

      {/* Strategic Corridor Selector Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/70 p-3 rounded-lg border border-border/70">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Corridor Filter:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {corridors.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={selectedCorridor === c.id ? "default" : "outline"}
              onClick={() => {
                setSelectedCorridor(c.id);
                setManualComparisonId(null);
                const matching =
                  c.id === "all"
                    ? allRoutes
                    : allRoutes.filter((r) => r.origin.toLowerCase() === c.id.toLowerCase());
                if (matching.length > 0) {
                  setSelectedRouteId(matching[0].id);
                }
              }}
              className={cn(
                "text-xs h-7 px-2.5 font-medium transition-colors",
                selectedCorridor === c.id
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Multi-Criteria Optimization Sliders */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Decision Matrix Weights & Optimization Priorities
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
              Total Weight: 100% Normalized
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Adjust strategic priorities to calibrate the neural route scoring model in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                  Cost Sensitivity
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-foreground">{costWeight}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                    {costPercent}%
                  </Badge>
                </div>
              </div>
              <Slider
                value={[costWeight]}
                onValueChange={(val) => setCostWeight(val[0])}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">Prioritizes bulk maritime rates</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-sky-400" />
                  Speed & Transit Latency
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-foreground">{speedWeight}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-sky-500/40 text-sky-400 bg-sky-500/10">
                    {speedPercent}%
                  </Badge>
                </div>
              </div>
              <Slider
                value={[speedWeight]}
                onValueChange={(val) => setSpeedWeight(val[0])}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">Prioritizes air corridors & fast freight</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                  Geopolitical Risk Avoidance
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-foreground">{riskWeight}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-red-500/40 text-red-400 bg-red-500/10">
                    {riskPercent}%
                  </Badge>
                </div>
              </div>
              <Slider
                value={[riskWeight]}
                onValueChange={(val) => setRiskWeight(val[0])}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">Avoids Hormuz & Bab-el-Mandeb</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Leaf className="h-3.5 w-3.5 text-emerald-500" />
                  Carbon & ESG Footprint
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-foreground">{carbonWeight}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                    {carbonPercent}%
                  </Badge>
                </div>
              </div>
              <Slider
                value={[carbonWeight]}
                onValueChange={(val) => setCarbonWeight(val[0])}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">Minimizes emissions per tonne-km</p>
            </div>
          </div>

          {/* Trade-off Explanation */}
          <div className="mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground bg-secondary/20 p-2.5 rounded-lg flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong className="text-foreground font-semibold">Weighted Criteria (Normalized to 100%):</strong>{" "}
              Cost Sensitivity favors bulk sea lanes; Speed favors air cargo; Risk Avoidance bypasses chokepoints (Hormuz/Bab el-Mandeb); Carbon favors direct low-emission routes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Direct Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Option A */}
        <Card className="bg-card/70 border-border/70 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Candidate Route A</span>
                  <Badge variant="outline" className="text-[8px] font-mono border-primary/40 text-primary bg-primary/5">
                    PRIMARY BASELINE
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold text-foreground mt-0.5">{selectedRoute.name}</CardTitle>
              </div>
              <select
                value={selectedRoute.id}
                onChange={(e) => {
                  setSelectedRouteId(e.target.value);
                  setManualComparisonId(null);
                }}
                className="px-2 py-1 rounded bg-secondary text-xs text-foreground border border-border"
              >
                {scoredRoutes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-secondary/30 border border-border/40 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Transit Time</span>
                <p className="text-base font-bold text-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {selectedRoute.transitDays} Days
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Total Cost</span>
                <p className="text-base font-bold text-emerald-400">
                  {formatCurrency(selectedRoute.costUSD)}
                </p>
                <span className="text-[10px] text-muted-foreground">{formatCurrency(selectedRoute.costQAR, "QAR")}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Risk Rating</span>
                <p className={cn(
                  "text-base font-bold",
                  selectedRoute.riskScore > 50 ? "text-red-400" : selectedRoute.riskScore > 30 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {selectedRoute.riskScore} / 100
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Carbon Output</span>
                <p className="text-base font-bold text-muted-foreground">
                  {selectedRoute.carbonKg.toLocaleString()} kg
                </p>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Comprehensive Surcharge & Customs Breakdown</span>
              <div className="space-y-1 bg-secondary/20 p-2.5 rounded-lg border border-border/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customs Clearance Tariff:</span>
                  <span className="font-mono">{formatCurrency(selectedRoute.customs)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Port & Handling Terminal Dues:</span>
                  <span className="font-mono">{formatCurrency(selectedRoute.handling)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">War Risk Maritime Insurance:</span>
                  <span className="font-mono text-amber-400">{formatCurrency(selectedRoute.insurance)}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1 font-semibold">
                  <span className="text-foreground">Calculated Reliability Index:</span>
                  <span className="text-emerald-400">{selectedRoute.reliability}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Option B (Tied directly as top alternative) */}
        <Card className="bg-card/70 border-border/70 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500" />
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">Candidate Route B</span>
                  <Badge variant="outline" className="text-[8px] font-mono border-sky-500/40 text-sky-400 bg-sky-500/10">
                    TOP ALTERNATIVE
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold text-foreground mt-0.5">{comparisonRoute.name}</CardTitle>
              </div>
              <select
                value={comparisonRoute.id}
                onChange={(e) => {
                  setManualComparisonId(e.target.value);
                }}
                className="px-2 py-1 rounded bg-secondary text-xs text-foreground border border-border"
              >
                {scoredRoutes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.id === topAlternative.id ? "(Top Alternative)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-secondary/30 border border-border/40 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Transit Time</span>
                <p className="text-base font-bold text-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-sky-400" />
                  {comparisonRoute.transitDays} Days
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Total Cost</span>
                <p className="text-base font-bold text-emerald-400">
                  {formatCurrency(comparisonRoute.costUSD)}
                </p>
                <span className="text-[10px] text-muted-foreground">{formatCurrency(comparisonRoute.costQAR, "QAR")}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Risk Rating</span>
                <p className={cn(
                  "text-base font-bold",
                  comparisonRoute.riskScore > 50 ? "text-red-400" : comparisonRoute.riskScore > 30 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {comparisonRoute.riskScore} / 100
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Carbon Output</span>
                <p className="text-base font-bold text-muted-foreground">
                  {comparisonRoute.carbonKg.toLocaleString()} kg
                </p>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Comprehensive Surcharge & Customs Breakdown</span>
              <div className="space-y-1 bg-secondary/20 p-2.5 rounded-lg border border-border/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customs Clearance Tariff:</span>
                  <span className="font-mono">{formatCurrency(comparisonRoute.customs)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Port & Handling Terminal Dues:</span>
                  <span className="font-mono">{formatCurrency(comparisonRoute.handling)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">War Risk Maritime Insurance:</span>
                  <span className="font-mono text-amber-400">{formatCurrency(comparisonRoute.insurance)}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1 font-semibold">
                  <span className="text-foreground">Calculated Reliability Index:</span>
                  <span className="text-emerald-400">{comparisonRoute.reliability}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scored Routes Leaderboard */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Neural Optimization Leaderboard ({selectedCorridor === "all" ? "All Corridors" : selectedCorridor})
            </span>
            <Badge variant="outline" className="text-[10px]">Ranked by Weighted Fit</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Dynamic suitability ranking recalculating continuously based on normalized slider criteria within the active corridor
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="space-y-2">
            {scoredRoutes.map((r, idx) => (
              <div
                key={r.id}
                className={cn(
                  "p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                  r.id === selectedRoute.id
                    ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                    : idx === 0
                    ? "bg-emerald-950/20 border-emerald-500/40"
                    : "bg-secondary/30 border-border/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs font-mono",
                    idx === 0 ? "bg-emerald-600 text-white" : "bg-secondary text-muted-foreground"
                  )}>
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">{r.name}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {r.mode}
                      </Badge>
                      {idx === 0 && (
                        <Badge variant="success" className="text-[9px]">BEST FIT</Badge>
                      )}
                      {r.id === selectedRoute.id && (
                        <Badge variant="secondary" className="text-[9px] bg-primary text-primary-foreground">CANDIDATE A</Badge>
                      )}
                      {r.id === comparisonRoute.id && r.id !== selectedRoute.id && (
                        <Badge variant="outline" className="text-[9px] border-sky-400 text-sky-400">CANDIDATE B</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {r.transitDays} Days · {formatCurrency(r.costUSD)} · Risk: {r.riskScore}/100 · Reliability: {r.reliability}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase">Fit Score</span>
                    <p className="text-sm font-bold font-mono text-emerald-400">{r.compositeScore} / 100</p>
                  </div>
                  <Button
                    size="sm"
                    variant={r.id === selectedRoute.id ? "secondary" : "outline"}
                    className="text-xs h-8"
                    onClick={() => {
                      setSelectedRouteId(r.id);
                      setManualComparisonId(null);
                    }}
                  >
                    {r.id === selectedRoute.id ? "Selected" : "Select"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
