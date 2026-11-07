"use client";

import React, { useState } from "react";
import { complianceItems, ComplianceItem, shipments } from "@/lib/mock-data";
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
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ExternalLink,
  ShieldAlert,
  Flame,
  Globe,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompliancePage() {
  const [items, setItems] = useState<ComplianceItem[]>(complianceItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeItemModal, setActiveItemModal] = useState<ComplianceItem | null>(null);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.assignee.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleResolve = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: "passed" as const } : it))
    );
    setActiveItemModal(null);
  };

  const passedCount = items.filter((i) => i.status === "passed").length;
  const warningCount = items.filter((i) => i.status === "warning").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Cargo Safety, Hazmat & Regulatory Compliance Matrix
            </h1>
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 font-mono text-[10px]">
              QATAR CUSTOMS / IMO COLIREG
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Continuous verification of IMDG dangerous goods declarations, dual-use embargo screening, and sanitary certificates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs h-8">
            <Upload className="h-3.5 w-3.5 mr-1" />
            Bulk Import Bill of Lading
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs h-8">
            <FileCheck className="h-3.5 w-3.5 mr-1" />
            Issue IMO Safety Clearance
          </Button>
        </div>
      </div>

      {/* Compliance Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="bg-card/70 border-border/70">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Overall Compliance Rate</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-foreground">
                {((passedCount / items.length) * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">9/10 Target Met</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Qatar Customs Authority Standard</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Hazmat Dangerous Goods</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-amber-400">{warningCount} Flagged</span>
              <Flame className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Requires Class 2.1 MSDS re-audit</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Customs Documentation Holds</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-foreground">{pendingCount} Pending</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Average resolution time: 2.4 hrs</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70">
          <CardContent className="p-4">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Embargo & Sanctions Check</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-emerald-400">100% Cleared</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Zero UN/OFAC embargo matches</p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Filter & Table */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Regulatory Checklist & Verification Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                Active screening items sorted by shipment and regulatory authority
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search item, ship ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Verification Types</option>
                <option value="hazmat">Dangerous Goods (Hazmat)</option>
                <option value="customs">Customs Clearance</option>
                <option value="documentation">Documentation & BL</option>
                <option value="embargo">Embargo & Sanctions</option>
                <option value="inspection">Phytosanitary Inspection</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="passed">Passed</option>
                <option value="warning">Warning</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Check ID</TableHead>
                <TableHead>Shipment Reference</TableHead>
                <TableHead>Verification Domain</TableHead>
                <TableHead>Compliance Description</TableHead>
                <TableHead>Assigned Authority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="border-border/30 hover:bg-secondary/40">
                  <TableCell className="font-mono text-xs font-semibold text-foreground">
                    {item.id}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {item.shipmentId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs uppercase font-medium text-muted-foreground">
                    {item.type}
                  </TableCell>
                  <TableCell className="text-xs text-foreground max-w-xs">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.assignee}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {item.dueDate}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "passed"
                          ? "success"
                          : item.status === "warning"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[9px] uppercase font-bold"
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status !== "passed" ? (
                      <Button
                        size="sm"
                        onClick={() => handleResolve(item.id)}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        Approve Clearance
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-medium flex items-center justify-end gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Validated
                      </span>
                    )}
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
