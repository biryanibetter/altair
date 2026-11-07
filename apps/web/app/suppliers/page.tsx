"use client";

import React, { useState } from "react";
import { suppliers, Supplier, stockItems } from "@/lib/mock-data";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Factory,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  Zap,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SuppliersPage() {
  const [supplierList, setSupplierList] = useState<Supplier[]>(suppliers);
  const [searchTerm, setSearchTerm] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [rfqModalSupplier, setRfqModalSupplier] = useState<Supplier | null>(null);
  const [rfqMaterial, setRfqMaterial] = useState("Industrial Steel Coils");
  const [rfqQuantity, setRfqQuantity] = useState("5000");
  const [rfqUrgency, setRfqUrgency] = useState("CRITICAL (24-48 Hours)");
  const [submittedRfq, setSubmittedRfq] = useState(false);

  const filteredSuppliers = supplierList.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.products.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLocal = !localOnly || s.isLocal;
    const matchesCategory = categoryFilter === "all" || s.category.toLowerCase() === categoryFilter.toLowerCase();

    return matchesSearch && matchesLocal && matchesCategory;
  });

  const handleSendRFQ = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedRfq(true);
    setTimeout(() => {
      setSubmittedRfq(false);
      setRfqModalSupplier(null);
      alert(`[SOVEREIGN EMERGENCY RFQ DISPATCHED]\n\nSupplier: ${rfqModalSupplier?.name}\nMaterial: ${rfqMaterial}\nQuantity: ${rfqQuantity} MT\nUrgency: ${rfqUrgency}\n\nSupplier has been notified via secure government procurement EDI.`);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <Factory className="h-6 w-6 text-primary" />
              Local Supplier Discovery & Emergency RFQ Hub
            </h1>
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 font-mono text-[10px]">
              MADE IN QATAR
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sovereign domestic manufacturer database replacing vulnerable foreign import dependencies during crises
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setRfqModalSupplier(suppliers[0]); // Qatar Steel
            }}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md"
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Quick Emergency RFQ
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-card/70 border-border/70">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search manufacturer, materials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-60"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Sectors</option>
                <option value="Construction">Construction & Steel</option>
                <option value="Manufacturing">Manufacturing & Chemicals</option>
                <option value="Healthcare">Healthcare & Pharma</option>
                <option value="Food">Food & Agriculture</option>
                <option value="Petrochemicals">Petrochemicals</option>
              </select>

              <button
                onClick={() => setLocalOnly(!localOnly)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  localOnly
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Qatar-Based Only ({suppliers.filter((s) => s.isLocal).length})
              </button>
            </div>

            <span className="text-xs text-muted-foreground">
              Showing {filteredSuppliers.length} of {suppliers.length} Qualified Producers
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((s) => (
          <Card
            key={s.id}
            className={cn(
              "bg-card/70 border transition-all hover:border-primary/50 relative overflow-hidden flex flex-col justify-between",
              s.isLocal ? "border-emerald-500/30" : "border-border/70"
            )}
          >
            {s.isLocal && (
              <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">
                DOMESTIC SOVEREIGN PRODUCER
              </div>
            )}

            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    {s.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {s.location} · {s.category}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Key Product Output
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.products.map((prod, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-secondary/80 text-foreground px-2 py-0.5 rounded border border-border/40"
                      >
                        {prod}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-secondary/30 p-2 rounded border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase">Reliability Index</span>
                    <p className="font-bold text-emerald-400">{s.reliability}%</p>
                  </div>
                  <div className="bg-secondary/30 p-2 rounded border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase">Emergency Lead Time</span>
                    <p className="font-bold text-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-primary" />
                      {s.leadTime} Days
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Available Capacity</span>
                    <span className="font-mono text-foreground">{s.capacity}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${s.capacity}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Certifications: {s.certifications.join(", ")}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                <div className="text-[10px] text-muted-foreground truncate">
                  <p>{s.contactEmail}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setRfqModalSupplier(s)}
                  className="text-xs h-7 bg-red-600 hover:bg-red-500 text-white font-medium shrink-0"
                >
                  Emergency RFQ
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Emergency RFQ Modal */}
      {rfqModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg bg-card border-border shadow-2xl">
            <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-red-500" />
                  Sovereign Emergency RFQ: {rfqModalSupplier.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  Direct government procurement requisition under Emergency Resilience Act
                </CardDescription>
              </div>
              <button
                className="text-muted-foreground hover:text-foreground text-sm"
                onClick={() => setRfqModalSupplier(null)}
              >
                ✕
              </button>
            </CardHeader>
            <form onSubmit={handleSendRFQ}>
              <CardContent className="p-4 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                    Required Raw Material / Item
                  </label>
                  <select
                    value={rfqMaterial}
                    onChange={(e) => setRfqMaterial(e.target.value)}
                    className="w-full p-2 rounded-md bg-secondary border border-border text-foreground text-xs"
                  >
                    {stockItems.map((stk) => (
                      <option key={stk.id} value={stk.name}>
                        {stk.name} (Current Reserve: {stk.daysRemaining} days remaining)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Requested Volume (Metric Tonnes)
                    </label>
                    <input
                      type="number"
                      value={rfqQuantity}
                      onChange={(e) => setRfqQuantity(e.target.value)}
                      className="w-full p-2 rounded-md bg-secondary border border-border text-foreground text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">
                      Urgency SLA
                    </label>
                    <select
                      value={rfqUrgency}
                      onChange={(e) => setRfqUrgency(e.target.value)}
                      className="w-full p-2 rounded-md bg-secondary border border-border text-foreground text-xs"
                    >
                      <option>CRITICAL (24-48 Hours)</option>
                      <option>EXPEDITED (3-5 Days)</option>
                      <option>STANDARD (7-10 Days)</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                  Notice: Emergency RFQs bypass standard commercial bidding cycles pursuant to Qatar National Food & Material Security Protocols. Expedited payment guarantee authorized by Ministry of Finance.
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => setRfqModalSupplier(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittedRfq}
                    className="text-xs h-8 bg-red-600 hover:bg-red-500 text-white font-bold"
                  >
                    {submittedRfq ? "Transmitting Sovereign Tender..." : "Issue Emergency Requisition"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
