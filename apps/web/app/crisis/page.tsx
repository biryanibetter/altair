"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ShieldAlert,
  Flame,
  Radio,
  Plane,
  Truck,
  Ship,
  ArrowRight,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  Zap,
  Activity,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DisruptionScenario {
  id: string;
  name: string;
  chokepoint: string;
  threatLevel: "CRITICAL" | "HIGH" | "MEDIUM";
  affectedTonnage: number;
  divertedVessels: number;
  mitigationRoute: string;
  status: "idle" | "active" | "mitigated";
}

export default function CrisisPage() {
  const { crisisMode, toggleCrisisMode, shipments } = useAppStore();
  const [activeScenarios, setActiveScenarios] = useState<string[]>([]);
  const [reservesUnlocked, setReservesUnlocked] = useState(false);
  const [airBridgeActive, setAirBridgeActive] = useState(false);
  const [executingReroute, setExecutingReroute] = useState(false);

  const scenarios: DisruptionScenario[] = [
    {
      id: "SCN-01",
      name: "Strait of Hormuz Full Maritime Blockade",
      chokepoint: "Strait of Hormuz (26.56°N, 56.25°E)",
      threatLevel: "CRITICAL",
      affectedTonnage: 184500,
      divertedVessels: 6,
      mitigationRoute: "Divert to Salalah (Oman) + Overland GCC Land Bridge via Abu Samra",
      status: crisisMode ? "active" : "idle",
    },
    {
      id: "SCN-02",
      name: "Red Sea & Bab el-Mandeb Anti-Ship Threat",
      chokepoint: "Bab el-Mandeb Strait (12.58°N, 43.33°E)",
      threatLevel: "HIGH",
      affectedTonnage: 92000,
      divertedVessels: 3,
      mitigationRoute: "Cape of Good Hope circumnavigation or Mediterranean-Air transshipment",
      status: "idle",
    },
    {
      id: "SCN-03",
      name: "Hamad Port Access Channel Sonar/Mine Warning",
      chokepoint: "Hamad Port Approaches (Qatar)",
      threatLevel: "CRITICAL",
      affectedTonnage: 140000,
      divertedVessels: 4,
      mitigationRoute: "Ras Laffan secondary industrial berths & King Abdulaziz Port (Dammam) feeder",
      status: "idle",
    },
    {
      id: "SCN-04",
      name: "GCC Single Customs Portal Cyber Infiltration",
      chokepoint: "State Digital Logistics Infrastructure",
      threatLevel: "HIGH",
      affectedTonnage: 65000,
      divertedVessels: 8,
      mitigationRoute: "Manual air-gapped sovereign cryptographic manifest validation",
      status: "idle",
    },
  ];

  const activeScenarioObjects = scenarios.filter(
    (s) => activeScenarios.includes(s.id) || (crisisMode && s.id === "SCN-01")
  );
  const simulatedScenarioObjects = scenarios.filter((s) => activeScenarios.includes(s.id));
  const affectedNames = (simulatedScenarioObjects.length > 0 ? simulatedScenarioObjects : activeScenarioObjects)
    .map((s) => s.chokepoint.split(" (")[0])
    .join(", ");
  const totalSimulatedTonnage = simulatedScenarioObjects.reduce((acc, s) => acc + s.affectedTonnage, 0);
  const totalSimulatedVessels = simulatedScenarioObjects.reduce((acc, s) => acc + s.divertedVessels, 0);

  const handleToggleScenario = (id: string) => {
    setActiveScenarios((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleEmergencyRerouteAll = () => {
    setExecutingReroute(true);
    setTimeout(() => {
      setExecutingReroute(false);
      alert("[SOVEREIGN PROTOCOL ACTIVATED]: All 6 high-risk vessels diverted to Salalah & Fujairah. Land-bridge convoys mobilized at Abu Samra.");
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              Wartime Crisis & Sovereign Disruption Engine
            </h1>
            <Badge
              variant={crisisMode ? "crisis" : activeScenarios.length > 0 ? "warning" : "outline"}
              className="font-mono text-[9px] tracking-wider uppercase font-bold"
            >
              {crisisMode
                ? "DEFCON 2 · EMERGENCY ACTIVE"
                : activeScenarios.length > 0
                ? `SIMULATION ACTIVE (${activeScenarios.length} INJECTED)`
                : "PEACETIME STANDBY"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instantaneous maritime chokepoint bypass, multimodal overland rerouting, and strategic stockpile releases
          </p>
        </div>

        {/* Master Crisis Toggle */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            onClick={toggleCrisisMode}
            className={cn(
              "font-bold text-xs tracking-wider transition-colors shadow-none px-4",
              crisisMode
                ? "bg-crisis/15 text-crisis border border-crisis/40 hover:bg-crisis/25"
                : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
            )}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {crisisMode ? "DEACTIVATE CRISIS PROTOCOL" : "ACTIVATE WARTIME CRISIS MODE"}
          </Button>
        </div>
      </div>

      {/* Dynamic Crisis Alert Banner */}
      {crisisMode ? (
        <div className="rounded-lg border border-crisis/40 bg-crisis/10 p-3 backdrop-blur shadow-none space-y-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-crisis/20 text-crisis/40 border border-crisis/30">
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-300 uppercase tracking-wide flex items-center gap-2">
                  Wartime Crisis Protocol Engaged — Strait of Hormuz Blocked
                  <Badge variant="crisis" className="text-[8px]">ACTIVE</Badge>
                </h3>
                <p className="text-xs text-red-300/80 mt-0.5">
                  Maritime navigation through Strait of Hormuz is halted. Inbound commercial tonnage is redirected to Port of Salalah (Oman) and transported overland via KSA road corridors through the Abu Samra customs gate.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleEmergencyRerouteAll}
                disabled={executingReroute}
                className="bg-crisis/10 text-crisis/80 text-xs font-bold shadow-none"
              >
                {executingReroute ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                    Transmitting AIS Reroutes
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Authorize Fleet Diversion (6 Ships)
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-crisis/30 text-xs text-red-400">
            <div>
              <span className="uppercase">Tonnage in Jeopardy</span>
              <p className="font-bold text-white">184,500 MT</p>
            </div>
            <div>
              <span className="uppercase">Overland Truck Corridors</span>
              <p className="text-emerald-400 font-bold">140 Trucks/Day Dispatched</p>
            </div>
            <div>
              <span className="uppercase">Air Corridor Capacity</span>
              <p className="text-sky-400 font-bold">1,200 MT/Day (QR Cargo)</p>
            </div>
            <div>
              <span className="uppercase">Strategic Buffer</span>
              <p className="text-amber-400 font-bold">45 Days Guaranteed</p>
            </div>
          </div>
        </div>
      ) : activeScenarios.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 backdrop-blur shadow-none space-y-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wide flex items-center gap-2">
                  Simulation Active · {affectedNames} Disrupted
                  <Badge variant="outline" className="text-[8px] font-mono border-amber-500/40 text-amber-400 bg-amber-500/10">
                    SIMULATOR ACTIVE
                  </Badge>
                </h3>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  Digital twin stress-test injected. Evaluating secondary routes, buffer drawdown, and multimodal diversion capacity across simulated affected corridors.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveScenarios([])}
                className="text-xs font-mono border-amber-500/40 text-amber-300 hover:bg-amber-500/20 h-7"
              >
                Clear Simulation ({activeScenarios.length})
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-500/30 text-xs text-amber-300">
            <div>
              <span className="uppercase text-[10px] text-muted-foreground">Simulated Tonnage in Jeopardy</span>
              <p className="font-bold text-foreground text-sm">{totalSimulatedTonnage.toLocaleString()} MT</p>
            </div>
            <div>
              <span className="uppercase text-[10px] text-muted-foreground">Simulated Vessels Diverted</span>
              <p className="font-bold text-foreground text-sm">{totalSimulatedVessels} Vessels Diverted</p>
            </div>
            <div>
              <span className="uppercase text-[10px] text-muted-foreground">Injected Scenarios</span>
              <p className="font-bold text-foreground text-sm">{activeScenarios.length} Disruptions</p>
            </div>
            <div>
              <span className="uppercase text-[10px] text-muted-foreground">Mitigation Status</span>
              <p className="font-bold text-emerald-400 text-sm">Contingency Lanes Available</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Peacetime Operations · All Corridors Normal
              </h4>
              <p className="text-xs text-muted-foreground">
                All maritime chokepoints and sovereign overland corridors are operating at standard capacity.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
            Peacetime Operations · All Corridors Normal
          </Badge>
        </div>
      )}

      {/* Disruption Scenario Injector & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Chokepoint Scenarios */}
        <Card className="bg-card/80 border-border/60">
          <CardHeader className="p-3 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span>Chokepoint Disruption Scenarios</span>
              </CardTitle>
              <Badge variant="outline" className="text-[9px] font-mono border-primary/40 text-primary bg-primary/5 w-fit">
                Digital Twin Sandbox · Inject disruptions to test response
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Simulate individual or cascading chokepoint closures to stress-test resilience
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-2 space-y-2">
            {scenarios.map((scn) => {
              const isActive = activeScenarios.includes(scn.id) || (crisisMode && scn.id === "SCN-01");
              return (
                <div
                  key={scn.id}
                  className={cn(
                    "p-2.5 rounded-lg border transition-colors space-y-1.5",
                    isActive ? "bg-crisis/10 border-crisis/30" : "bg-secondary/40 border-border/30 hover:border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{scn.name}</span>
                      <Badge
                        variant={scn.threatLevel === "CRITICAL" ? "destructive" : "warning"}
                        className="text-[8px] font-bold"
                      >
                        {scn.threatLevel}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant={isActive ? "destructive" : "outline"}
                      onClick={() => handleToggleScenario(scn.id)}
                      className="text-[9px] h-6 px-2 font-mono"
                    >
                      {isActive ? "Active in Simulator · Remove" : "Inject Scenario"}
                    </Button>
                  </div>

                  <p className="text-[9px] text-muted-foreground">
                    Location: <span className="text-foreground">{scn.chokepoint}</span>
                  </p>

                  <div className="text-[9px] bg-secondary/40 p-1.5 rounded">
                    <span className="text-muted-foreground">Affected Volume:</span>
                    <span className="font-semibold text-foreground">
                      {scn.affectedTonnage.toLocaleString()} MT ({scn.divertedVessels} Vessels)
                    </span>
                  </div>

                  <div className="text-[9px] text-emerald-400 flex items-center gap-1">
                    <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                    <span>Mitigation: {scn.mitigationRoute}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right Column: Sovereign Resilience Actuators */}
        <div className="space-y-5">
          {/* Actuator 1: Strategic Reserve Release */}
          <Card className="bg-card/80 border-border/60">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
                <span>National Strategic Reserve Actuator</span>
                {reservesUnlocked ? (
                  <Badge variant="crisis" className="text-[8px]">Reserves Unlocked</Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] text-muted-foreground">Standby</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Unlock sovereign underground grain silos, industrial metal reserves, and medical stockpiles
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-2 space-y-2">
              <p className="text-[9px] text-muted-foreground">
                In emergency posture, sovereign storage hubs at Hamad Port, Mesaieed, and Industrial Area can release up to 45,000 MT/week of raw materials to keep local infrastructure and healthcare functional without external imports.
              </p>

              <div className="p-2.5 rounded bg-secondary/40 border border-border/30 space-y-1 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wheat & Food Grains (Hamad Silos):</span>
                  <span className="font-bold text-foreground">125,000 MT (45 Days)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Industrial Steel Coils (Mesaieed):</span>
                  <span className="font-bold text-foreground">18,500 MT (12 Days)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Medical Insulin & Critical APIs:</span>
                  <span className="font-bold text-foreground">2,400 MT (13 Days)</span>
                </div>
              </div>

              <Button
                onClick={() => setReservesUnlocked(!reservesUnlocked)}
                className={cn(
                  "w-full text-xs font-bold h-8",
                  reservesUnlocked
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : "bg-primary hover:bg-primary/90 text-white"
                )}
              >
                {reservesUnlocked ? (
                  <>
                    <Lock className="h-3 w-3 mr-1.5" />
                    Lock Strategic Stockpiles
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3 mr-1.5" />
                    Authorize Emergency Stockpile Release
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Actuator 2: Emergency Air Corridor Activation */}
          <Card className="bg-card/80 border-border/60">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Qatar Airways Cargo Airlift Bridge</span>
                {airBridgeActive ? (
                  <Badge variant="success" className="text-[8px]">Air Bridge Active</Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] text-muted-foreground">Inactive</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Mobilize national cargo fleet (B777F & A330F) to circumvent maritime blockades
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-2 space-y-2">
              <p className="text-[9px] text-muted-foreground">
                Diverts high-priority perishables, semiconductors, and emergency pharmaceuticals to air freight lanes originating from Frankfurt, Istanbul, and Mumbai directly into Hamad International Airport (DOH).
              </p>

              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <div className="p-1.5 rounded bg-secondary/30 border border-border/30">
                  <span className="text-muted-foreground">Flight Rotations</span>
                  <p className="font-bold text-foreground">14 Flights / 24h</p>
                </div>
                <div className="p-1.5 rounded bg-secondary/30 border border-border/30">
                  <span className="text-muted-foreground">Net Lift Capacity</span>
                  <p className="font-bold text-foreground">1,250 MT / Day</p>
                </div>
              </div>

              <Button
                variant={airBridgeActive ? "secondary" : "default"}
                onClick={() => setAirBridgeActive(!airBridgeActive)}
                className="w-full text-xs font-bold h-8 bg-sky-600 hover:bg-sky-500 text-white"
              >
                <Plane className="h-3 w-3 mr-1" />
                {airBridgeActive ? "Cease Emergency Airlift Bridge" : "Activate Sovereign Air Corridor"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}