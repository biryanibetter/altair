"use client";

import React, { useState } from "react";
import { stockItems, StockItem, warehouses } from "@/lib/mock-data";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Package,
  TrendingDown,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Warehouse,
  Truck,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface RedistributionTransfer {
  id: string;
  material: string;
  sourceHub: string;
  destHub: string;
  amount: number;
  unit: string;
  etaHours: number;
  priority: "HIGH" | "CRITICAL" | "MEDIUM";
  status: "suggested" | "dispatched";
}

const initialTransfers: RedistributionTransfer[] = [
  {
    id: "TRF-901",
    material: "Industrial Steel Coils",
    sourceHub: "Hamad Port Terminal",
    destHub: "Mesaieed Industrial Hub",
    amount: 4500,
    unit: "tonnes",
    etaHours: 3,
    priority: "CRITICAL",
    status: "suggested",
  },
  {
    id: "TRF-902",
    material: "Insulin & Biologics",
    sourceHub: "Hamad Port Terminal",
    destHub: "Qatar Central Medical",
    amount: 350,
    unit: "units (K)",
    etaHours: 2,
    priority: "CRITICAL",
    status: "suggested",
  },
  {
    id: "TRF-903",
    material: "Water Treatment Chemicals",
    sourceHub: "Ras Laffan Storage",
    destHub: "Industrial Area Depot",
    amount: 1200,
    unit: "tonnes",
    etaHours: 4,
    priority: "HIGH",
    status: "suggested",
  },
  {
    id: "TRF-904",
    material: "Cement (Portland)",
    sourceHub: "Industrial Area Depot",
    destHub: "Lusail Logistics Center",
    amount: 8000,
    unit: "tonnes",
    etaHours: 5,
    priority: "MEDIUM",
    status: "suggested",
  },
];

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>(stockItems);
  const [selectedItem, setSelectedItem] = useState<StockItem>(stockItems[0]); // Steel coils
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [transfers, setTransfers] = useState<RedistributionTransfer[]>(initialTransfers);
  const [activeTransferModal, setActiveTransferModal] = useState<RedistributionTransfer | null>(null);

  const filteredItems = items.filter((item) => {
    if (categoryFilter === "all") return true;
    return item.category.toLowerCase() === categoryFilter.toLowerCase();
  });

  const handleExecuteTransfer = (id: string) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "dispatched" as const } : t))
    );
    setActiveTransferModal(null);
  };

  // Build projected 14-day depletion curve for selected item
  const projectionData = [
    { day: "Day 0 (Now)", stock: selectedItem.currentStock, safeThreshold: selectedItem.maxCapacity * 0.2 },
    { day: "Day 3", stock: Math.max(0, selectedItem.currentStock - selectedItem.dailyConsumption * 3), safeThreshold: selectedItem.maxCapacity * 0.2 },
    { day: "Day 6", stock: Math.max(0, selectedItem.currentStock - selectedItem.dailyConsumption * 6), safeThreshold: selectedItem.maxCapacity * 0.2 },
    { day: "Day 9", stock: Math.max(0, selectedItem.currentStock - selectedItem.dailyConsumption * 9), safeThreshold: selectedItem.maxCapacity * 0.2 },
    { day: "Day 12", stock: Math.max(0, selectedItem.currentStock - selectedItem.dailyConsumption * 12), safeThreshold: selectedItem.maxCapacity * 0.2 },
    { day: "Day 15", stock: Math.max(0, selectedItem.currentStock - selectedItem.dailyConsumption * 15), safeThreshold: selectedItem.maxCapacity * 0.2 },
    { day: "Day 18", stock: Math.max(0, selectedItem.currentStock - selectedItem.dailyConsumption * 18), safeThreshold: selectedItem.maxCapacity * 0.2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Shortage Prediction & Smart Inventory Redistribution
            </h1>
            <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px]">
              PREDICTIVE AI v2.9
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Days-of-supply burn rate projection, strategic reserve surveillance, and inter-hub load balancing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setTransfers((prev) => prev.map((t) => ({ ...t, status: "dispatched" as const })));
              alert("All 4 AI Sovereign Transfer Convoys Dispatched!");
            }}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-md"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Execute All Recommended Transfers
          </Button>
        </div>
      </div>

      {/* Depletion Forecast & Simulation Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column (2 cols) */}
        <Card className="lg:col-span-2 bg-card/70 border-border/70">
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  Predictive Depletion Curve: {selectedItem.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  Burn rate: {selectedItem.dailyConsumption.toLocaleString()} {selectedItem.unit}/day · Hub: {selectedItem.warehouse}
                </CardDescription>
              </div>

              <select
                value={selectedItem.id}
                onChange={(e) => {
                  const it = items.find((x) => x.id === e.target.value);
                  if (it) setSelectedItem(it);
                }}
                className="px-2.5 py-1 rounded bg-secondary text-xs text-foreground border border-border"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.daysRemaining}d left)
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Line
                    type="monotone"
                    dataKey="stock"
                    name={`Available Stock (${selectedItem.unit})`}
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#ef4444" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="safeThreshold"
                    name="Sovereign Safety Reserve Minimum"
                    stroke="#eab308"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-red-950/20 border border-red-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-red-300">
                  Estimated Stockout Event: In <strong>{selectedItem.daysRemaining} days</strong> unless replenished by inbound shipment QSC-2401 or domestic redistribution.
                </span>
              </div>
              <Badge variant="crisis" className="text-[10px]">CRITICAL</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Warehouse Network Status (1 col) */}
        <Card className="bg-card/70 border-border/70">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
              <span>National Hub Capacity</span>
              <Warehouse className="h-4 w-4 text-primary" />
            </CardTitle>
            <CardDescription className="text-xs">
              Regional storage utilization & available rebalance buffer
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {warehouses.map((wh) => (
              <div key={wh.id} className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{wh.name}</span>
                  <span className={cn(
                    "font-mono text-[11px]",
                    wh.utilization > 80 ? "text-amber-400 font-bold" : "text-emerald-400"
                  )}>
                    {wh.utilization}% Full
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      wh.utilization > 80 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${wh.utilization}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Type: {wh.type}</span>
                  <span>Cap: {wh.capacity.toLocaleString()} MT</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Smart Redistribution Recommendation Matrix */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
                Autonomous Inter-Hub Redistribution Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                AI load-balancing suggestions shifting surplus materials to critical deficit hubs
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {transfers.filter((t) => t.status === "suggested").length} Pending Transfers
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {transfers.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "p-3.5 rounded-lg border transition-all space-y-2.5",
                  t.status === "dispatched"
                    ? "bg-emerald-950/20 border-emerald-500/40"
                    : "bg-secondary/30 border-border/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{t.material}</span>
                    <Badge
                      variant={t.priority === "CRITICAL" ? "crisis" : "warning"}
                      className="text-[9px]"
                    >
                      {t.priority}
                    </Badge>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{t.id}</span>
                </div>

                <div className="flex items-center justify-between text-xs bg-secondary/50 p-2 rounded">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">Source</span>
                    <p className="font-semibold text-foreground">{t.sourceHub}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">Destination</span>
                    <p className="font-semibold text-foreground">{t.destHub}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Transfer Volume: <strong className="text-foreground">{t.amount.toLocaleString()} {t.unit}</strong>
                  </span>
                  <span className="text-muted-foreground">ETA: {t.etaHours} hrs convoy</span>
                </div>

                <div className="pt-1">
                  {t.status === "suggested" ? (
                    <Button
                      size="sm"
                      onClick={() => handleExecuteTransfer(t.id)}
                      className="w-full text-xs h-7 bg-primary hover:bg-primary/90 text-white"
                    >
                      <Truck className="h-3.5 w-3.5 mr-1.5" />
                      Dispatch Autonomous Convoy
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-medium py-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Convoy Dispatched & En Route
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full National Stockpiles Inventory Table */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Sovereign Stockpile Depletion Registry
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time days of supply remaining across medical, metallurgical, energy, and food stocks
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Categories</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Construction">Construction</option>
                <option value="Food">Food & Agriculture</option>
                <option value="Energy">Energy</option>
                <option value="Technology">Technology</option>
                <option value="Utilities">Utilities</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Material / Commodity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Warehouse Hub</TableHead>
                <TableHead>Current Reserve</TableHead>
                <TableHead>Daily Burn</TableHead>
                <TableHead>Days of Supply</TableHead>
                <TableHead>Health Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-border/30 hover:bg-secondary/40 cursor-pointer"
                  onClick={() => setSelectedItem(item)}
                >
                  <TableCell className="font-semibold text-xs text-foreground">
                    <div>
                      <p>{item.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{item.id}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground uppercase">{item.category}</TableCell>
                  <TableCell className="text-xs text-foreground">{item.warehouse}</TableCell>
                  <TableCell className="text-xs font-mono font-medium">
                    {item.currentStock.toLocaleString()} {item.unit}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {item.dailyConsumption.toLocaleString()} {item.unit}/d
                  </TableCell>
                  <TableCell className="text-xs font-bold font-mono">
                    <span className={cn(
                      item.daysRemaining <= 8 ? "text-red-500" : item.daysRemaining <= 15 ? "text-amber-400" : "text-emerald-400"
                    )}>
                      {item.daysRemaining} Days
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "critical"
                          ? "crisis"
                          : item.status === "low"
                          ? "warning"
                          : "success"
                      }
                      className="text-[9px] uppercase font-bold"
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs hover:bg-secondary text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                      }}
                    >
                      Analyze Burn
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
