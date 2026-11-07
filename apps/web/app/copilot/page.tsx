"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Send,
  Sparkles,
  Terminal,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Route,
  Package,
  ShieldAlert,
  Radio,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsoleMessage {
  id: string;
  sender: "ops" | "ai";
  text: string;
  timestamp: string;
  actions?: { label: string; action: string }[];
}

const suggestedScenarios = [
  {
    title: "Strait of Hormuz Rapid Diversion",
    command: "EXECUTE_REROUTE --chokepoint='HORMUZ' --diversion_port='SALALAH' --mode='MULTIMODAL_LANDBRIDGE'",
    desc: "Re-channels 184,500 MT of maritime steel & fuel away from blocked strait via Omani port.",
  },
  {
    title: "Critical Pharmaceutical Airlift",
    command: "DISPATCH_AIRLIFT --origin='BOM' --dest='DOH' --carrier='QR_CARGO_777F' --priority='CRITICAL'",
    desc: "Mobilizes Qatar Airways cargo fleet for 85 MT of temperature-sensitive medical APIs.",
  },
  {
    title: "National Steel Stockpile Rebalance",
    command: "REBALANCE_INVENTORY --material='STEEL_COILS' --source='HAMAD_SILO' --dest='MESAIEED'",
    desc: "Automates 4,500 MT convoy transfer preventing industrial construction stoppage.",
  },
  {
    title: "Emergency Domestic RFQ Requisition",
    command: "TRIGGER_EMERGENCY_RFQ --supplier='QATAR_STEEL' --qty='10000MT' --sovereign_guarantee=TRUE",
    desc: "Engages domestic producer at 85% capacity under Qatar Food & Material Security Decree.",
  },
];

export default function CopilotPage() {
  const { crisisMode, toggleCrisisMode } = useAppStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: "init",
      sender: "ai",
      text: "SOVEREIGN AI LOGISTICS COPILOT v3.8 TERMINAL READY.\nActive connections: 47 Vessel Transponders, 13 GCC Ports, State Customs Clearing EDI.\nAll strategic stockpiles synced. Enter command or choose operational contingency below.",
      timestamp: "14:00",
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleCommand = (cmd: string) => {
    if (!cmd.trim()) return;

    const userEntry: ConsoleMessage = {
      id: `usr-${messageCounter.current++}`,
      sender: "ops",
      text: cmd,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userEntry]);
    setInput("");
    setIsProcessing(true);

    setTimeout(() => {
      let response = "";
      if (cmd.includes("REROUTE") || cmd.includes("HORMUZ")) {
        response = `[CRITICAL ACTION CONFIRMED]: Strait of Hormuz avoidance engaged.\n- 6 Maritime vessels rerouted to Salalah & Fujairah anchorage.\n- 140 overland semi-trailers scheduled at Abu Samra border corridor.\n- Projected transit delay: +36 hours (vs 14 days full stoppage).`;
      } else if (cmd.includes("AIRLIFT") || cmd.includes("PHARMA")) {
        response = `[AIRLIFT DISPATCHED]: Flight QR-8812 (Boeing 777F) cleared for pharmaceutical transit.\n- Departure: Mumbai International (BOM) -> Hamad International (DOH).\n- Cargo: 85 MT Medical APIs & Insulin.\n- Real-time landing window: Today, 21:45 AST.`;
      } else if (cmd.includes("REBALANCE") || cmd.includes("STEEL")) {
        response = `[INVENTORY TRANSFER QUEUED]: 4,500 MT Industrial Steel Coils ordered for transfer from Hamad Port to Mesaieed Industrial Hub.\n- Estimated convoy dispatch: 15 minutes.\n- Rebalance restores Mesaieed days-of-supply from 12 days to 28 days.`;
      } else if (cmd.includes("RFQ")) {
        response = `[SOVEREIGN RFQ ISSUED]: State requisition submitted to Qatar Steel Company (SUP-001).\n- Requested: 10,000 MT rebar and structural coils.\n- Expedited delivery terms activated under Emergency Decree.\n- Vendor response acknowledged.`;
      } else {
        response = `Neural Copilot analyzed query: "${cmd}".\n- Hamad Port operating at 94.2% operational throughput.\n- Ras Laffan LNG export lanes: GREEN / CLEAR.\n- Zero high-priority cybersecurity alarms detected in last 120 minutes.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${messageCounter.current++}`,
          sender: "ai",
          text: response,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setIsProcessing(false);
    }, 800);
  };

  const messageCounter = useRef(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              Sovereign AI Logistics Copilot & Command Terminal
            </h1>
            <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px]">
              AUTONOMOUS DEF-OPS
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full-screen conversational neural assistant with direct actuators for rerouting, stockpile reallocation, and emergency tenders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setMessages([
                {
                  id: "init",
                  sender: "ai",
                  text: "Terminal reset. AI Copilot online and awaiting orders.",
                  timestamp: "14:00",
                },
              ])
            }
            className="text-xs h-8"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Clear Terminal
          </Button>
        </div>
      </div>

      {/* Suggested Command Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {suggestedScenarios.map((sc, i) => (
          <Card
            key={i}
            className="bg-card/70 border-border/70 hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => handleCommand(sc.command)}
          >
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{sc.title}</span>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {sc.desc}
              </p>
              <div className="font-mono text-[10px] text-primary truncate bg-secondary/60 p-1.5 rounded">
                $ {sc.command}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Interactive Command Terminal */}
      <Card className="bg-[#05070c] border-border/80 shadow-2xl overflow-hidden font-mono text-xs">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d121d] border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-[11px] text-muted-foreground ml-2 font-semibold">
              qatar-sovereign-copilot@mil-ops-node-01: ~
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            <span>NEURAL WEIGHTS SYNCED</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div ref={scrollRef} className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "p-3 rounded leading-relaxed whitespace-pre-line border",
                m.sender === "ops"
                  ? "bg-primary/10 border-primary/30 text-sky-200"
                  : "bg-secondary/20 border-border/40 text-emerald-300"
              )}
            >
              <div className="flex items-center justify-between text-[10px] opacity-60 mb-1 border-b border-white/10 pb-1">
                <span>{m.sender === "ops" ? ">>> OPERATOR COMMAND" : "<<< SOVEREIGN COPILOT RESPONSE"}</span>
                <span>{m.timestamp}</span>
              </div>
              <p className="text-xs">{m.text}</p>
            </div>
          ))}

          {isProcessing && (
            <div className="text-muted-foreground text-xs flex items-center gap-2 py-2">
              <span className="animate-spin text-primary">⚙</span>
              <span>Running sovereign risk heuristics and routing graph matrices...</span>
            </div>
          )}
        </div>

        {/* Terminal Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCommand(input);
          }}
          className="flex items-center gap-2 p-3 bg-[#0a0e17] border-t border-border/40"
        >
          <span className="text-emerald-400 font-bold">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type sovereign command or ask logistics question..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none font-mono"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim()}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            <Send className="h-3 w-3 mr-1" />
            Execute
          </Button>
        </form>
      </Card>
    </div>
  );
}
