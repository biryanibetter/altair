"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  X,
  Minus,
  Send,
  AlertTriangle,
  RefreshCw,
  Route,
  Package,
  ShieldAlert,
  CornerDownLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  action?: {
    type: "reroute" | "rfq" | "crisis" | "inspect";
    label: string;
    payload?: Record<string, string>;
  };
}

const quickPrompts = [
  { label: "Analyze Hormuz Bottleneck", prompt: "Evaluate the current risk at Strait of Hormuz and recommend diversion routes for MV Al Wakrah." },
  { label: "Predict Steel Stock-out", prompt: "When will Industrial Steel Coils reach critical depletion and what local alternatives exist?" },
  { label: "Execute Air Corridor Shift", prompt: "Prepare emergency airlift allocation for critical pharmaceutical APIs from Mumbai to DOH." },
  { label: "Check Hazmat Compliance", prompt: "Identify all active shipments flagged with Hazmat or documentation warnings." },
];

export function AICopilot() {
  const { copilotOpen, toggleCopilot, crisisMode, toggleCrisisMode } = useAppStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-1",
      sender: "copilot",
      text: "Q-Logistics Sovereign Copilot v3.8 active. Monitoring 47 maritime, air, and overland routes across the GCC. How may I assist sovereign supply continuity today?",
      timestamp: "14:20",
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCounter = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: `msg-${++messageCounter.current}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsThinking(true);

    setTimeout(() => {
      let responseText = "";
      let action: Message["action"] | undefined = undefined;

      const lower = query.toLowerCase();
      if (lower.includes("hormuz") || lower.includes("strait")) {
        responseText =
          "Strait of Hormuz Threat Index is currently HIGH (Score 78). If maritime choke point closes, 40% of standard inbound TEU volume will be trapped in the Gulf of Oman. Recommended contingency: Reroute inbound vessels (QSC-2401 & QSC-2406) via Fujairah / Salalah ports + overland GCC land bridge through Abu Samra corridor.";
        action = {
          type: "reroute",
          label: "Execute Salalah Land-Bridge Reroute",
          payload: { routeId: "RT-07" },
        };
      } else if (lower.includes("steel") || lower.includes("stock-out")) {
        responseText =
          "Industrial Steel Coils inventory at Mesaieed sits at 18,500 tonnes (12.0 days of supply remaining at 1,540 t/day burn). Qatar Steel Company (SUP-001) has 85% available capacity. Issuing an emergency RFQ of 10,000 tonnes will bridge supply until MV Al Wakrah arrives.";
        action = {
          type: "rfq",
          label: "Issue Emergency RFQ to Qatar Steel",
          payload: { supplierId: "SUP-001", volume: "10,000 MT" },
        };
      } else if (lower.includes("air") || lower.includes("corridor") || lower.includes("pharma")) {
        responseText =
          "Qatar Airways Cargo Boeing 777F / A330F capacity can accommodate 85 tonnes of high-priority pharmaceutical APIs from Mumbai & Frankfurt. Estimated transit: 5 hours vs 6 days maritime. Cost delta: +$145,000 USD, but prevents critical hospital stockout.";
        action = {
          type: "reroute",
          label: "Authorize Air Cargo Emergency Shift",
          payload: { flight: "QR-8812" },
        };
      } else if (lower.includes("crisis")) {
        responseText =
          crisisMode
            ? "Crisis Mode is currently active. Strategic reserves unlocked, 45-day buffer operational, and border expedited lanes active."
            : "Wartime Crisis Mode will trigger automatic chokepoint bypass protocols, prioritize high-tier medical & energy logistics, and alert state security coordination.";
        action = {
          type: "crisis",
          label: crisisMode ? "Deactivate Crisis Mode" : "Engage Wartime Crisis Mode",
        };
      } else if (lower.includes("hazmat") || lower.includes("compliance")) {
        responseText =
          "Audit indicates 1 HAZMAT flag: MV Gulf Carrier (QSC-2406) carrying turbine lubricant without updated MSDS certification (due Nov 18). Also, 1 dual-use export screening pending for semiconductor shipment QSC-2407.";
        action = {
          type: "inspect",
          label: "Open Compliance Checklist",
        };
      } else {
        responseText = `Acknowledged sovereign operational query: "${query}". Real-time telemetry confirms port operations at Hamad Port at 94.2% throughput efficiency, with 8 vessels in transit. Digital twin analysis shows overall GCC supply chain risk factor at 48/100 (Moderate).`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `copilot-${++messageCounter.current}`,
          sender: "copilot",
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          action,
        },
      ]);
      setIsThinking(false);
    }, 900);
  };

  const handleActionClick = (action: Message["action"]) => {
    if (!action) return;
    if (action.type === "crisis") {
      toggleCrisisMode();
    } else {
      alert(`[CO-PILOT PROTOCOL EXECUTED]: ${action.label}`);
    }
  };

  if (!copilotOpen) {
    return (
      <button
        onClick={toggleCopilot}
        aria-label="AI Logistics Copilot"
        className={cn(
          "fixed bottom-10 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full shadow-none transition-transform active:scale-95 border md:hidden",
          crisisMode
            ? "bg-crisis text-white border-crisis/30 hover:bg-crisis/90"
            : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
        )}
      >
        <Bot className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed top-14 right-4 sm:top-14 sm:right-6 z-50 flex h-[560px] w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] max-h-[80vh] flex-col rounded-lg border border-border/80 bg-card/95 shadow-none backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 bg-secondary/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground tracking-wide flex items-center gap-1.5">
              SOVEREIGN LOGISTICS COPILOT
              <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/40 text-emerald-400">
                AI v3.8
              </Badge>
            </h3>
            <p className="text-[10px] text-muted-foreground">Digital Twin Neural Advisory Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleCopilot}
            aria-label="Minimize AI Copilot"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={toggleCopilot}
            aria-label="Dismiss AI Copilot"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="shrink-0 border-b border-border/40 bg-background/50 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(qp.prompt)}
            className="shrink-0 rounded-full border border-border/60 bg-secondary/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col max-w-[85%] rounded-md p-2.5 text-xs leading-relaxed",
              m.sender === "user"
                ? "ml-auto bg-primary text-primary-foreground font-medium rounded-br-md"
                : "mr-auto bg-secondary/80 text-foreground border border-border/40 rounded-bl-md"
            )}
          >
            <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-70">
              <span className="font-semibold uppercase tracking-wider">
                {m.sender === "user" ? "Command Ops" : "Copilot Neural AI"}
              </span>
              <span>{m.timestamp}</span>
            </div>
            <p className="whitespace-pre-line">{m.text}</p>

            {/* Action pill if applicable */}
            {m.action && (
              <div className="mt-2.5 pt-2 border-t border-border/40">
                <Button
                  size="sm"
                  onClick={() => handleActionClick(m.action)}
                  className="w-full text-[10px] h-7 bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {m.action.label}
                </Button>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="mr-auto flex items-center gap-2 rounded-md bg-secondary/60 p-2.5 text-[10px] text-muted-foreground border border-border/30">
            <RefreshCw className="h-3 w-3 animate-spin text-primary" />
            <span>Analyzing neural network telemetry & route matrices...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="shrink-0 border-t border-border/50 bg-secondary/30 p-2.5 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask logistics copilot or issue emergency command..."
          className="flex-1 rounded-md border border-border/60 bg-background/80 px-3 py-2 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim()}
          className="h-8 px-3 bg-primary hover:bg-primary/90 text-white"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}