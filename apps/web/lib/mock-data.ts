// Qatar National Supply Chain & Logistics Resilience Platform - Mock Data

export interface Port {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "sea" | "air" | "land";
  country: string;
  status: "operational" | "congested" | "disrupted" | "blocked";
  throughput: number;
  capacity: number;
}

export interface Shipment {
  id: string;
  vessel: string;
  type: "sea" | "air" | "land";
  origin: string;
  destination: string;
  cargo: string;
  tonnage: number;
  status: "in-transit" | "delayed" | "arrived" | "at-risk" | "rerouted";
  eta: string;
  progress: number;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  route: [number, number][];
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface Alert {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  timestamp: string;
  category: string;
  acknowledged: boolean;
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  maxCapacity: number;
  dailyConsumption: number;
  daysRemaining: number;
  unit: string;
  trend: number[];
  status: "critical" | "low" | "adequate" | "surplus";
  warehouse: string;
}

export interface Supplier {
  id: string;
  name: string;
  location: string;
  category: string;
  products: string[];
  reliability: number;
  leadTime: number;
  isLocal: boolean;
  certifications: string[];
  contactEmail: string;
  phone: string;
  status: "active" | "pending" | "emergency-ready";
  capacity: number;
}

export interface RouteOption {
  id: string;
  name: string;
  mode: "sea" | "air" | "land" | "multimodal";
  origin: string;
  destination: string;
  distance: number;
  transitDays: number;
  costUSD: number;
  costQAR: number;
  carbonKg: number;
  riskScore: number;
  customs: number;
  handling: number;
  insurance: number;
  reliability: number;
  waypoints: [number, number][];
}

export interface RiskFactor {
  id: string;
  name: string;
  category: "geopolitical" | "climate" | "supplier" | "infrastructure" | "economic";
  score: number;
  trend: "rising" | "stable" | "declining";
  impact: string;
  likelihood: number;
  description: string;
}

export interface ComplianceItem {
  id: string;
  shipmentId: string;
  type: "hazmat" | "customs" | "embargo" | "documentation" | "inspection";
  status: "passed" | "pending" | "failed" | "warning";
  description: string;
  dueDate: string;
  assignee: string;
}

export interface WarehouseNode {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  capacity: number;
  utilization: number;
  type: "distribution" | "industrial" | "cold-storage" | "hazmat";
}

// ═══════════════ PORTS & CHOKEPOINTS ═══════════════
export const ports: Port[] = [
  { id: "hamad", name: "Hamad Port", lat: 25.0147, lng: 51.5508, type: "sea", country: "Qatar", status: "operational", throughput: 7200, capacity: 10000 },
  { id: "ras-laffan", name: "Ras Laffan Industrial Port", lat: 25.9058, lng: 51.5339, type: "sea", country: "Qatar", status: "operational", throughput: 5800, capacity: 8000 },
  { id: "mesaieed", name: "Mesaieed Port", lat: 24.9833, lng: 51.5500, type: "sea", country: "Qatar", status: "operational", throughput: 4100, capacity: 6000 },
  { id: "dia", name: "Doha Intl Airport (DOH)", lat: 25.2731, lng: 51.6081, type: "air", country: "Qatar", status: "operational", throughput: 2800, capacity: 4000 },
  { id: "jebel-ali", name: "Jebel Ali Port", lat: 25.0045, lng: 55.0272, type: "sea", country: "UAE", status: "operational", throughput: 15400, capacity: 22000 },
  { id: "salalah", name: "Port of Salalah", lat: 16.9400, lng: 54.0000, type: "sea", country: "Oman", status: "congested", throughput: 3900, capacity: 5000 },
  { id: "hormuz", name: "Strait of Hormuz", lat: 26.5667, lng: 56.2500, type: "sea", country: "International", status: "operational", throughput: 21000, capacity: 25000 },
  { id: "bab-mandeb", name: "Bab el-Mandeb Strait", lat: 12.5833, lng: 43.3333, type: "sea", country: "International", status: "congested", throughput: 6200, capacity: 12000 },
  { id: "suez", name: "Suez Canal", lat: 30.4583, lng: 32.3500, type: "sea", country: "Egypt", status: "operational", throughput: 19500, capacity: 24000 },
  { id: "singapore", name: "Port of Singapore", lat: 1.2655, lng: 103.8200, type: "sea", country: "Singapore", status: "operational", throughput: 37000, capacity: 45000 },
  { id: "shanghai", name: "Port of Shanghai", lat: 31.3600, lng: 121.5900, type: "sea", country: "China", status: "operational", throughput: 43500, capacity: 50000 },
  { id: "mumbai", name: "Nhava Sheva (JNPT)", lat: 18.9500, lng: 72.9500, type: "sea", country: "India", status: "operational", throughput: 5600, capacity: 8000 },
  { id: "abu-samra", name: "Abu Samra Border", lat: 24.7239, lng: 50.8431, type: "land", country: "Qatar/Saudi", status: "operational", throughput: 1200, capacity: 2000 },
];

// ═══════════════ SHIPMENTS ═══════════════
export const shipments: Shipment[] = [
  {
    id: "QSC-2401", vessel: "MV Al Wakrah", type: "sea", origin: "Shanghai", destination: "Hamad Port",
    cargo: "Industrial Steel Coils", tonnage: 24500, status: "in-transit", eta: "2026-11-12",
    progress: 68, lat: 14.5, lng: 65.2, heading: 285, speed: 14.2,
    riskLevel: "medium",
    route: [[31.36, 121.59], [22.3, 114.2], [10.5, 98.0], [6.0, 80.0], [14.5, 65.2], [24.0, 56.0], [25.0, 51.55]],
  },
  {
    id: "QSC-2402", vessel: "MV Qatar Spirit", type: "sea", origin: "Mumbai", destination: "Hamad Port",
    cargo: "Pharmaceutical Raw Materials", tonnage: 8200, status: "in-transit", eta: "2026-11-09",
    progress: 82, lat: 23.5, lng: 56.8, heading: 310, speed: 12.8,
    riskLevel: "low",
    route: [[18.95, 72.95], [20.0, 66.0], [23.5, 56.8], [25.0, 51.55]],
  },
  {
    id: "QSC-2403", vessel: "Boeing 777F QR-8812", type: "air", origin: "Frankfurt", destination: "Doha (DOH)",
    cargo: "Medical Equipment & Vaccines", tonnage: 85, status: "in-transit", eta: "2026-11-07",
    progress: 45, lat: 38.5, lng: 32.0, heading: 145, speed: 890,
    riskLevel: "low",
    route: [[50.0, 8.6], [44.0, 20.0], [38.5, 32.0], [25.27, 51.61]],
  },
  {
    id: "QSC-2404", vessel: "MV Desert Falcon", type: "sea", origin: "Singapore", destination: "Hamad Port",
    cargo: "Electronic Components", tonnage: 12100, status: "delayed", eta: "2026-11-15",
    progress: 42, lat: 8.5, lng: 76.5, heading: 290, speed: 8.5,
    riskLevel: "high",
    route: [[1.27, 103.82], [5.5, 90.0], [8.5, 76.5], [15.0, 60.0], [25.0, 51.55]],
  },
  {
    id: "QSC-2405", vessel: "Convoy TR-441", type: "land", origin: "Riyadh", destination: "Doha",
    cargo: "Fresh Produce & Dairy", tonnage: 340, status: "in-transit", eta: "2026-11-07",
    progress: 72, lat: 24.85, lng: 50.95, heading: 90, speed: 85,
    riskLevel: "low",
    route: [[24.69, 46.72], [24.4, 48.5], [24.85, 50.95], [25.28, 51.52]],
  },
  {
    id: "QSC-2406", vessel: "MV Gulf Carrier", type: "sea", origin: "Rotterdam", destination: "Hamad Port",
    cargo: "Heavy Machinery & Turbines", tonnage: 18700, status: "at-risk", eta: "2026-11-20",
    progress: 31, lat: 32.0, lng: 30.5, heading: 120, speed: 11.2,
    riskLevel: "critical",
    route: [[51.9, 4.5], [36.0, -5.0], [35.9, 14.5], [32.0, 30.5], [30.0, 32.5], [25.0, 51.55]],
  },
  {
    id: "QSC-2407", vessel: "A330F QR-6634", type: "air", origin: "Tokyo Narita", destination: "Doha (DOH)",
    cargo: "Semiconductor Chips", tonnage: 42, status: "in-transit", eta: "2026-11-07",
    progress: 60, lat: 28.5, lng: 68.5, heading: 250, speed: 850,
    riskLevel: "medium",
    route: [[35.76, 140.39], [30.0, 110.0], [28.5, 68.5], [25.27, 51.61]],
  },
  {
    id: "QSC-2408", vessel: "MV Doha Express", type: "sea", origin: "Durban", destination: "Hamad Port",
    cargo: "Grain & Cereals", tonnage: 35000, status: "in-transit", eta: "2026-11-18",
    progress: 55, lat: -2.0, lng: 48.0, heading: 20, speed: 13.5,
    riskLevel: "medium",
    route: [[-29.87, 31.05], [-12.0, 42.0], [-2.0, 48.0], [12.0, 44.0], [25.0, 51.55]],
  },
  {
    id: "QSC-2409", vessel: "MV Lusail Star", type: "sea", origin: "Hamad Port", destination: "Yokohama",
    cargo: "LNG (Export)", tonnage: 72000, status: "in-transit", eta: "2026-11-22",
    progress: 25, lat: 20.0, lng: 62.5, heading: 80, speed: 16.0,
    riskLevel: "low",
    route: [[25.0, 51.55], [24.5, 56.0], [20.0, 62.5], [10.0, 80.0], [5.0, 100.0], [35.44, 139.64]],
  },
  {
    id: "QSC-2410", vessel: "Convoy TR-445", type: "land", origin: "Dammam", destination: "Mesaieed",
    cargo: "Construction Materials", tonnage: 520, status: "arrived", eta: "2026-11-06",
    progress: 100, lat: 24.98, lng: 51.55, heading: 0, speed: 0,
    riskLevel: "low",
    route: [[26.43, 50.1], [25.5, 50.5], [24.98, 51.55]],
  },
];

// ═══════════════ ALERTS ═══════════════
export const alerts: Alert[] = [
  { id: "ALR-001", severity: "critical", title: "Strait of Hormuz Threat Level Elevated", description: "Military activity detected near Hormuz passage. 4 vessels holding at anchorage. Reroute advisory issued.", timestamp: "2026-11-06T14:22:00Z", category: "Geopolitical", acknowledged: false },
  { id: "ALR-002", severity: "high", title: "QSC-2404 Delayed - Engine Malfunction", description: "MV Desert Falcon reporting engine issues off Kerala coast. ETA delayed by 72hrs. Electronic components shipment affected.", timestamp: "2026-11-06T12:15:00Z", category: "Fleet", acknowledged: false },
  { id: "ALR-003", severity: "high", title: "Steel Reserve Below 15-Day Threshold", description: "Industrial steel coil inventory at Mesaieed Industrial has dropped below critical threshold. Current: 12 days supply.", timestamp: "2026-11-06T10:00:00Z", category: "Inventory", acknowledged: true },
  { id: "ALR-004", severity: "medium", title: "Bab el-Mandeb Congestion Advisory", description: "Increased vessel queue at Bab el-Mandeb. Average transit delay: +18hrs. Houthi activity in adjacent waters.", timestamp: "2026-11-06T08:30:00Z", category: "Maritime", acknowledged: true },
  { id: "ALR-005", severity: "medium", title: "Fuel Price Surge - Bunker +12%", description: "Singapore bunker fuel index up 12% week-over-week. Freight rate increases expected across Indian Ocean routes.", timestamp: "2026-11-06T06:00:00Z", category: "Market", acknowledged: false },
  { id: "ALR-006", severity: "low", title: "QSC-2405 Customs Clearance Complete", description: "Convoy TR-441 fresh produce shipment cleared Abu Samra border. On schedule for Doha delivery.", timestamp: "2026-11-06T05:45:00Z", category: "Customs", acknowledged: true },
  { id: "ALR-007", severity: "critical", title: "Pharmaceutical Stockout Warning - Insulin", description: "Insulin supply critically low at Qatar Central Medical Stores. 8 days remaining. Emergency procurement triggered.", timestamp: "2026-11-06T03:00:00Z", category: "Health", acknowledged: false },
  { id: "ALR-008", severity: "info", title: "Monthly Compliance Audit Scheduled", description: "Scheduled HAZMAT compliance audit for Ras Laffan storage facilities on Nov 10th.", timestamp: "2026-11-05T22:00:00Z", category: "Compliance", acknowledged: true },
  { id: "ALR-009", severity: "high", title: "QSC-2406 Route Risk: Suez Passage Uncertainty", description: "MV Gulf Carrier approaching Suez Canal. Reports of inspection delays. Machinery delivery timeline at risk.", timestamp: "2026-11-06T13:00:00Z", category: "Maritime", acknowledged: false },
  { id: "ALR-010", severity: "medium", title: "Abu Samra Border Queue Extended", description: "Land border crossing times increased to 6+ hours due to enhanced security screening.", timestamp: "2026-11-06T09:30:00Z", category: "Logistics", acknowledged: false },
];

// ═══════════════ STOCK / INVENTORY ═══════════════
export const stockItems: StockItem[] = [
  { id: "STK-001", name: "Industrial Steel Coils", category: "Construction", currentStock: 18500, maxCapacity: 85000, dailyConsumption: 1540, daysRemaining: 12, unit: "tonnes", trend: [45000, 42000, 38000, 34000, 29000, 24000, 18500], status: "critical", warehouse: "Mesaieed Industrial" },
  { id: "STK-002", name: "Pharmaceutical APIs", category: "Healthcare", currentStock: 2400, maxCapacity: 8000, dailyConsumption: 180, daysRemaining: 13, unit: "tonnes", trend: [5200, 4800, 4300, 3800, 3200, 2800, 2400], status: "critical", warehouse: "Qatar Central Medical" },
  { id: "STK-003", name: "Wheat & Grain", category: "Food", currentStock: 125000, maxCapacity: 200000, dailyConsumption: 2800, daysRemaining: 45, unit: "tonnes", trend: [160000, 155000, 148000, 140000, 135000, 130000, 125000], status: "adequate", warehouse: "Hamad Port Silos" },
  { id: "STK-004", name: "Semiconductor Components", category: "Technology", currentStock: 340, maxCapacity: 1200, dailyConsumption: 28, daysRemaining: 12, unit: "units (K)", trend: [680, 620, 560, 500, 440, 390, 340], status: "critical", warehouse: "Free Zone Warehouse" },
  { id: "STK-005", name: "Cement (Portland)", category: "Construction", currentStock: 320000, maxCapacity: 500000, dailyConsumption: 5200, daysRemaining: 62, unit: "tonnes", trend: [400000, 385000, 370000, 355000, 340000, 330000, 320000], status: "adequate", warehouse: "Industrial Area" },
  { id: "STK-006", name: "Diesel Fuel", category: "Energy", currentStock: 85000, maxCapacity: 150000, dailyConsumption: 2100, daysRemaining: 40, unit: "m³", trend: [105000, 100000, 96000, 92000, 89000, 87000, 85000], status: "adequate", warehouse: "Mesaieed Storage" },
  { id: "STK-007", name: "Medical PPE & Supplies", category: "Healthcare", currentStock: 15000, maxCapacity: 50000, dailyConsumption: 420, daysRemaining: 36, unit: "pallets", trend: [28000, 25000, 22000, 20000, 18000, 16500, 15000], status: "low", warehouse: "Qatar Central Medical" },
  { id: "STK-008", name: "Aluminum Ingots", category: "Manufacturing", currentStock: 22000, maxCapacity: 60000, dailyConsumption: 680, daysRemaining: 32, unit: "tonnes", trend: [38000, 35000, 32000, 29000, 26000, 24000, 22000], status: "adequate", warehouse: "Industrial Area" },
  { id: "STK-009", name: "Fresh Produce", category: "Food", currentStock: 4200, maxCapacity: 12000, dailyConsumption: 850, daysRemaining: 5, unit: "tonnes", trend: [8500, 7800, 7000, 6200, 5500, 4800, 4200], status: "critical", warehouse: "Cold Storage Hub" },
  { id: "STK-010", name: "LNG Ship Spare Parts", category: "Energy", currentStock: 890, maxCapacity: 2000, dailyConsumption: 15, daysRemaining: 59, unit: "units", trend: [1100, 1060, 1020, 980, 950, 920, 890], status: "adequate", warehouse: "Ras Laffan Stores" },
  { id: "STK-011", name: "Water Treatment Chemicals", category: "Utilities", currentStock: 5600, maxCapacity: 15000, dailyConsumption: 320, daysRemaining: 18, unit: "tonnes", trend: [9800, 9000, 8200, 7400, 6800, 6200, 5600], status: "low", warehouse: "Industrial Area" },
  { id: "STK-012", name: "Insulin & Biologics", category: "Healthcare", currentStock: 1200, maxCapacity: 5000, dailyConsumption: 150, daysRemaining: 8, unit: "units (K)", trend: [3200, 2800, 2400, 2000, 1700, 1400, 1200], status: "critical", warehouse: "Qatar Central Medical" },
];

// ═══════════════ SUPPLIERS ═══════════════
export const suppliers: Supplier[] = [
  { id: "SUP-001", name: "Qatar Steel Company", location: "Mesaieed, Qatar", category: "Construction", products: ["Steel rebar", "Coils", "Structural beams"], reliability: 94, leadTime: 2, isLocal: true, certifications: ["ISO 9001", "OHSAS 18001"], contactEmail: "sales@qatarsteel.qa", phone: "+974 4477 8800", status: "active", capacity: 85 },
  { id: "SUP-002", name: "Industries Qatar (IQ)", location: "Doha, Qatar", category: "Manufacturing", products: ["Petrochemicals", "Fertilizers", "Steel products"], reliability: 96, leadTime: 1, isLocal: true, certifications: ["ISO 14001", "ISO 9001"], contactEmail: "procurement@iq.qa", phone: "+974 4401 3333", status: "active", capacity: 78 },
  { id: "SUP-003", name: "QAPCO", location: "Mesaieed, Qatar", category: "Petrochemicals", products: ["Ethylene", "Polyethylene", "Chemical compounds"], reliability: 91, leadTime: 3, isLocal: true, certifications: ["ISO 9001", "RC 14001"], contactEmail: "supply@qapco.qa", phone: "+974 4477 6000", status: "active", capacity: 82 },
  { id: "SUP-004", name: "Doha Pharma", location: "Industrial Area, Qatar", category: "Healthcare", products: ["Generic pharmaceuticals", "Medical supplies", "PPE"], reliability: 88, leadTime: 5, isLocal: true, certifications: ["GMP", "ISO 13485"], contactEmail: "orders@dohapharma.qa", phone: "+974 4460 1200", status: "active", capacity: 65 },
  { id: "SUP-005", name: "Al Meera Consumer Goods", location: "Doha, Qatar", category: "Food", products: ["Canned goods", "Dry produce", "Packaged foods"], reliability: 92, leadTime: 1, isLocal: true, certifications: ["HACCP", "ISO 22000"], contactEmail: "supply@almeera.qa", phone: "+974 4454 5454", status: "active", capacity: 90 },
  { id: "SUP-006", name: "Baladna Food Industries", location: "Al Khor, Qatar", category: "Food", products: ["Fresh dairy", "Poultry", "Juice beverages"], reliability: 95, leadTime: 1, isLocal: true, certifications: ["HACCP", "Halal Certified"], contactEmail: "sales@baladna.qa", phone: "+974 4032 5000", status: "active", capacity: 88 },
  { id: "SUP-007", name: "ArcelorMittal Gulf", location: "Jebel Ali, UAE", category: "Construction", products: ["Steel plates", "Heavy coils", "Wire rods"], reliability: 87, leadTime: 7, isLocal: false, certifications: ["ISO 9001"], contactEmail: "gulf@arcelormittal.com", phone: "+971 4 801 2000", status: "active", capacity: 92 },
  { id: "SUP-008", name: "SABIC", location: "Riyadh, Saudi Arabia", category: "Manufacturing", products: ["Polymers", "Chemicals", "Metals"], reliability: 90, leadTime: 5, isLocal: false, certifications: ["ISO 9001", "ISO 14001", "RC 14001"], contactEmail: "sales@sabic.com", phone: "+966 11 225 8000", status: "active", capacity: 95 },
  { id: "SUP-009", name: "GlaxoSmithKline MEA", location: "Dubai, UAE", category: "Healthcare", products: ["Vaccines", "Insulin", "Biologics"], reliability: 93, leadTime: 10, isLocal: false, certifications: ["GMP", "FDA Approved"], contactEmail: "mea@gsk.com", phone: "+971 4 341 3400", status: "emergency-ready", capacity: 70 },
  { id: "SUP-010", name: "Sohar Flour Mills", location: "Sohar, Oman", category: "Food", products: ["Wheat flour", "Animal feed", "Grain products"], reliability: 86, leadTime: 4, isLocal: false, certifications: ["HACCP", "ISO 22000"], contactEmail: "sales@soharflour.om", phone: "+968 2685 0500", status: "active", capacity: 75 },
];

// ═══════════════ ROUTE OPTIONS ═══════════════
export const routeOptions: RouteOption[] = [
  { id: "RT-01", name: "Shanghai → Hamad (Direct Sea)", mode: "sea", origin: "Shanghai", destination: "Hamad Port", distance: 11200, transitDays: 28, costUSD: 245000, costQAR: 892250, carbonKg: 18500, riskScore: 35, customs: 12000, handling: 8500, insurance: 15200, reliability: 88, waypoints: [[31.36, 121.59], [22.3, 114.2], [1.27, 103.82], [6.0, 80.0], [12.5, 44.0], [25.0, 51.55]] },
  { id: "RT-02", name: "Shanghai → Hamad (Via Suez)", mode: "sea", origin: "Shanghai", destination: "Hamad Port", distance: 10800, transitDays: 32, costUSD: 268000, costQAR: 975640, carbonKg: 22100, riskScore: 52, customs: 14000, handling: 9200, insurance: 22000, reliability: 75, waypoints: [[31.36, 121.59], [22.3, 114.2], [1.27, 103.82], [12.5, 44.0], [30.46, 32.35], [25.0, 51.55]] },
  { id: "RT-03", name: "Shanghai → Doha (Air Freight)", mode: "air", origin: "Shanghai", destination: "Doha (DOH)", distance: 7800, transitDays: 2, costUSD: 890000, costQAR: 3240500, carbonKg: 45200, riskScore: 12, customs: 5000, handling: 12000, insurance: 8500, reliability: 97, waypoints: [[31.36, 121.59], [28.0, 86.0], [25.27, 51.61]] },
  { id: "RT-04", name: "Mumbai → Hamad (Direct Sea)", mode: "sea", origin: "Mumbai", destination: "Hamad Port", distance: 2100, transitDays: 5, costUSD: 62000, costQAR: 225780, carbonKg: 4200, riskScore: 28, customs: 6000, handling: 4500, insurance: 5800, reliability: 92, waypoints: [[18.95, 72.95], [22.0, 62.0], [25.0, 51.55]] },
  { id: "RT-05", name: "Rotterdam → Hamad (Via Suez)", mode: "sea", origin: "Rotterdam", destination: "Hamad Port", distance: 9600, transitDays: 22, costUSD: 198000, costQAR: 720720, carbonKg: 16800, riskScore: 48, customs: 11000, handling: 7800, insurance: 18500, reliability: 80, waypoints: [[51.9, 4.5], [36.0, -5.0], [30.46, 32.35], [25.0, 51.55]] },
  { id: "RT-06", name: "Rotterdam → Doha (Multimodal: Sea-Air)", mode: "multimodal", origin: "Rotterdam", destination: "Doha (DOH)", distance: 6200, transitDays: 8, costUSD: 425000, costQAR: 1547000, carbonKg: 28900, riskScore: 22, customs: 18000, handling: 15000, insurance: 12000, reliability: 90, waypoints: [[51.9, 4.5], [36.0, -5.0], [30.46, 32.35], [25.27, 51.61]] },
  { id: "RT-07", name: "Riyadh → Doha (Land Bridge)", mode: "land", origin: "Riyadh", destination: "Doha", distance: 550, transitDays: 1, costUSD: 18000, costQAR: 65520, carbonKg: 2200, riskScore: 15, customs: 2000, handling: 1500, insurance: 1200, reliability: 95, waypoints: [[24.69, 46.72], [24.4, 48.5], [24.72, 50.84], [25.28, 51.52]] },
  { id: "RT-08", name: "Durban → Hamad (Cape Route)", mode: "sea", origin: "Durban", destination: "Hamad Port", distance: 7400, transitDays: 18, costUSD: 175000, costQAR: 637250, carbonKg: 14200, riskScore: 30, customs: 9000, handling: 6500, insurance: 11000, reliability: 85, waypoints: [[-29.87, 31.05], [-12.0, 42.0], [12.5, 44.0], [25.0, 51.55]] },
];

// ═══════════════ RISK FACTORS ═══════════════
export const riskFactors: RiskFactor[] = [
  { id: "RF-01", name: "Strait of Hormuz Closure Risk", category: "geopolitical", score: 78, trend: "rising", impact: "Critical - 40% of Qatar maritime imports transit this strait", likelihood: 35, description: "Increased military posturing by regional actors. Insurance premiums up 22%." },
  { id: "RF-02", name: "Red Sea / Houthi Disruption", category: "geopolitical", score: 72, trend: "stable", impact: "High - Forces rerouting via Cape of Good Hope adding 12-15 days", likelihood: 60, description: "Ongoing attacks on commercial vessels in Bab el-Mandeb approaches." },
  { id: "RF-03", name: "Summer Heat Waves (>52°C)", category: "climate", score: 45, trend: "rising", impact: "Medium - Reduces outdoor port labor capacity by 30%", likelihood: 75, description: "Projected increase in extreme heat days affecting construction logistics." },
  { id: "RF-04", name: "Single-Source Dependency: Steel", category: "supplier", score: 65, trend: "stable", impact: "High - 68% steel imported from 2 countries", likelihood: 45, description: "Concentration risk in steel supply chain. Local capacity covers only 32%." },
  { id: "RF-05", name: "Food Import Dependency", category: "economic", score: 58, trend: "declining", impact: "Medium - 90% of food imported, local production growing", likelihood: 40, description: "Qatar Food Security Program reducing import dependency. Baladna expansion underway." },
  { id: "RF-06", name: "Suez Canal Disruption", category: "infrastructure", score: 52, trend: "stable", impact: "High - Alternative routes add 35-40% to transit costs", likelihood: 25, description: "Post-Ever Given reforms reducing but not eliminating blockage risk." },
  { id: "RF-07", name: "Cybersecurity - Port Systems", category: "infrastructure", score: 61, trend: "rising", impact: "Critical - Could halt port operations for 48-72hrs", likelihood: 30, description: "Increasing sophistication of attacks on maritime logistics systems." },
  { id: "RF-08", name: "Currency Fluctuation (QAR Peg)", category: "economic", score: 22, trend: "stable", impact: "Low - QAR pegged to USD, minimal forex risk", likelihood: 10, description: "Dollar peg provides stability. Low probability of regime change." },
];

// ═══════════════ COMPLIANCE ═══════════════
export const complianceItems: ComplianceItem[] = [
  { id: "CMP-001", shipmentId: "QSC-2401", type: "customs", status: "pending", description: "Import declaration for steel coils - HS Code 7208", dueDate: "2026-11-12", assignee: "Customs Dept" },
  { id: "CMP-002", shipmentId: "QSC-2403", type: "documentation", status: "passed", description: "Air waybill & phytosanitary certificate verified", dueDate: "2026-11-07", assignee: "Air Cargo Ops" },
  { id: "CMP-003", shipmentId: "QSC-2406", type: "hazmat", status: "warning", description: "Turbine lubricant classification requires MSDS update", dueDate: "2026-11-18", assignee: "Safety Officer" },
  { id: "CMP-004", shipmentId: "QSC-2404", type: "embargo", status: "passed", description: "Origin screening - Singapore. No embargo flags.", dueDate: "2026-11-10", assignee: "Trade Compliance" },
  { id: "CMP-005", shipmentId: "QSC-2408", type: "inspection", status: "pending", description: "Phytosanitary inspection for grain cargo at discharge", dueDate: "2026-11-18", assignee: "MOPH Inspector" },
  { id: "CMP-006", shipmentId: "QSC-2401", type: "documentation", status: "pending", description: "Certificate of Origin authentication", dueDate: "2026-11-11", assignee: "Trade Compliance" },
  { id: "CMP-007", shipmentId: "QSC-2409", type: "hazmat", status: "passed", description: "LNG cargo IMDG Class 2.1 documentation complete", dueDate: "2026-11-08", assignee: "Safety Officer" },
  { id: "CMP-008", shipmentId: "QSC-2406", type: "customs", status: "pending", description: "Temporary import permit for heavy machinery", dueDate: "2026-11-19", assignee: "Customs Dept" },
  { id: "CMP-009", shipmentId: "QSC-2402", type: "inspection", status: "passed", description: "GMP compliance verification for pharma raw materials", dueDate: "2026-11-09", assignee: "MOPH Inspector" },
  { id: "CMP-010", shipmentId: "QSC-2407", type: "embargo", status: "pending", description: "Dual-use technology screening for semiconductor components", dueDate: "2026-11-08", assignee: "Trade Compliance" },
];

// ═══════════════ WAREHOUSES ═══════════════
export const warehouses: WarehouseNode[] = [
  { id: "WH-01", name: "Hamad Port Terminal", location: "Hamad Port", lat: 25.0147, lng: 51.5508, capacity: 150000, utilization: 78, type: "distribution" },
  { id: "WH-02", name: "Mesaieed Industrial Hub", location: "Mesaieed", lat: 24.9833, lng: 51.5500, capacity: 200000, utilization: 85, type: "industrial" },
  { id: "WH-03", name: "Ras Laffan Storage", location: "Ras Laffan", lat: 25.9058, lng: 51.5339, capacity: 180000, utilization: 62, type: "hazmat" },
  { id: "WH-04", name: "Qatar Free Zone Warehouse", location: "Umm Alhoul", lat: 25.05, lng: 51.58, capacity: 80000, utilization: 71, type: "distribution" },
  { id: "WH-05", name: "Cold Storage Hub", location: "Industrial Area", lat: 25.18, lng: 51.45, capacity: 45000, utilization: 88, type: "cold-storage" },
  { id: "WH-06", name: "Lusail Logistics Center", location: "Lusail", lat: 25.42, lng: 51.49, capacity: 60000, utilization: 55, type: "distribution" },
  { id: "WH-07", name: "Industrial Area Depot", location: "Industrial Area", lat: 25.17, lng: 51.42, capacity: 120000, utilization: 73, type: "industrial" },
];

// ═══════════════ DASHBOARD METRICS ═══════════════
export const dashboardMetrics = {
  importDependencyIndex: 76.3,
  activeShipments: 47,
  atRiskShipments: 8,
  totalTonnageInTransit: 428500,
  criticalReserves: 4,
  avgTransitDelay: 2.3,
  fleetUtilization: 82.5,
  activeAlerts: 6,
  criticalAlerts: 2,
  chokepointsThreatened: 2,
  localProcurementRate: 23.7,
  monthlyImportValue: 3_240_000_000,
  portThroughputRate: 94.2,
  complianceRate: 91.8,
};

// ═══════════════ TIME SERIES DATA (for charts) ═══════════════
export const importTrendData = [
  { month: "May", imports: 2850, exports: 4200, local: 680 },
  { month: "Jun", imports: 3100, exports: 4500, local: 720 },
  { month: "Jul", imports: 2900, exports: 4100, local: 750 },
  { month: "Aug", imports: 3200, exports: 4800, local: 790 },
  { month: "Sep", imports: 3050, exports: 4300, local: 830 },
  { month: "Oct", imports: 3400, exports: 4600, local: 870 },
  { month: "Nov", imports: 3240, exports: 4400, local: 910 },
];

export const riskTrendData = [
  { month: "May", geopolitical: 62, supply: 45, climate: 38, infrastructure: 42 },
  { month: "Jun", geopolitical: 65, supply: 48, climate: 40, infrastructure: 41 },
  { month: "Jul", geopolitical: 68, supply: 50, climate: 52, infrastructure: 43 },
  { month: "Aug", geopolitical: 70, supply: 52, climate: 55, infrastructure: 44 },
  { month: "Sep", geopolitical: 73, supply: 55, climate: 42, infrastructure: 48 },
  { month: "Oct", geopolitical: 75, supply: 58, climate: 40, infrastructure: 52 },
  { month: "Nov", geopolitical: 78, supply: 62, climate: 38, infrastructure: 55 },
];

export const resilienceData = [
  { category: "Food", importDep: 90, localCap: 10, target2030: 40 },
  { category: "Steel", importDep: 68, localCap: 32, target2030: 55 },
  { category: "Pharma", importDep: 85, localCap: 15, target2030: 35 },
  { category: "Energy Parts", importDep: 55, localCap: 45, target2030: 70 },
  { category: "Tech", importDep: 95, localCap: 5, target2030: 20 },
  { category: "Construction", importDep: 60, localCap: 40, target2030: 65 },
  { category: "Chemicals", importDep: 40, localCap: 60, target2030: 75 },
];

export const portThroughputHistory = [
  { date: "Mon", hamad: 7100, rasLaffan: 5600, mesaieed: 3900 },
  { date: "Tue", hamad: 7300, rasLaffan: 5750, mesaieed: 4050 },
  { date: "Wed", hamad: 6900, rasLaffan: 5500, mesaieed: 3800 },
  { date: "Thu", hamad: 7400, rasLaffan: 5900, mesaieed: 4200 },
  { date: "Fri", hamad: 6200, rasLaffan: 4800, mesaieed: 3500 },
  { date: "Sat", hamad: 7200, rasLaffan: 5800, mesaieed: 4100 },
  { date: "Sun", hamad: 7500, rasLaffan: 6000, mesaieed: 4300 },
];
