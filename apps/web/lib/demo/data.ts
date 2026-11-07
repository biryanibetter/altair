// ALTAIR Demo Data
// Comprehensive sample dataset for Qatar-based import business
// All data is fictional and for demonstration purposes only

import { z } from 'zod'
import type { Location, RouteAlternative } from '@altair/shared/contracts'
import { locationSchema, shipmentSchema, supplierSchema, productSchema, inventoryRecordSchema, shipmentRecordSchema } from '@altair/shared/contracts'

// Use the complete inventory record type from supply contracts (includes id, reservedQuantity, historyStart, etc.)
export type Inventory = z.infer<typeof inventoryRecordSchema> & { 
  createdAt?: string; 
  updatedAt?: string;
  ownerId: string;
}

// Use the complete shipment record type from integration contracts (includes id, quantity, unit, etc.)
export type Shipment = z.infer<typeof shipmentRecordSchema> & { 
  ownerId: string;
  createdAt?: string;
}

// ============================================================================
// Deterministic ID Generation
// ============================================================================
const DEMO_NAMESPACE = 'demo'
function demoId(suffix: string): string {
  // Generate deterministic UUIDs from string seeds
  // Format: 00000000-0000-4000-8000-xxxxxxxxxxxx (version 4 variant)
  let hash = 0
  for (let i = 0; i < suffix.length; i++) {
    hash = ((hash << 5) - hash) + suffix.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

// ============================================================================
// Real Qatar & Regional Locations (with actual coordinates)
// ============================================================================
export interface DemoLocation extends Location {
  id: string
  coordinates: [number, number] | null
}

export const demoLocations: DemoLocation[] = [
  {
    id: demoId('hamad-port'),
    name: 'Hamad Port',
    kind: 'port',
    countryCode: 'QA',
    code: 'QAHMD',
    coordinates: [51.55, 25.1],
  },
  {
    id: demoId('hamad-airport'),
    name: 'Hamad International Airport',
    kind: 'airport',
    countryCode: 'QA',
    code: 'DOH',
    coordinates: [51.6081, 25.2731],
  },
  {
    id: demoId('doha-hub'),
    name: 'Doha Distribution Hub',
    kind: 'hub',
    countryCode: 'QA',
    coordinates: [51.5, 25.3],
  },
  {
    id: demoId('jebel-ali'),
    name: 'Jebel Ali Port',
    kind: 'port',
    countryCode: 'AE',
    code: 'AEJEA',
    coordinates: [55.0044, 25.0054],
  },
  {
    id: demoId('abu-dhabi-airport'),
    name: 'Abu Dhabi International Airport',
    kind: 'airport',
    countryCode: 'AE',
    code: 'AUH',
    coordinates: [54.6511, 24.4330],
  },
  {
    id: demoId('sohar-port'),
    name: 'Sohar Port',
    kind: 'port',
    countryCode: 'OM',
    code: 'OMSOH',
    coordinates: [56.6219, 24.3407],
  },
  {
    id: demoId('bahrain-hub'),
    name: 'Bahrain Logistics Hub',
    kind: 'hub',
    countryCode: 'BH',
    coordinates: [50.5577, 26.2172],
  },
  {
    id: demoId('kuwait-port'),
    name: 'Shuwaikh Port',
    kind: 'port',
    countryCode: 'KW',
    code: 'KWSWK',
    coordinates: [47.95, 29.35],
  },
]

// ============================================================================
// Transport Connections (with realistic costs and durations)
// ============================================================================
export const demoConnections = [
  // Sea routes
  { originId: demoId('jebel-ali'), destinationId: demoId('hamad-port'), mode: 'sea' as const, typicalDurationHours: 36, costUsd: 500, distanceKm: 380 },
  { originId: demoId('sohar-port'), destinationId: demoId('hamad-port'), mode: 'sea' as const, typicalDurationHours: 24, costUsd: 400, distanceKm: 450 },
  { originId: demoId('bahrain-hub'), destinationId: demoId('hamad-port'), mode: 'sea' as const, typicalDurationHours: 12, costUsd: 200, distanceKm: 160 },
  { originId: demoId('kuwait-port'), destinationId: demoId('hamad-port'), mode: 'sea' as const, typicalDurationHours: 48, costUsd: 600, distanceKm: 580 },
  // Land routes
  { originId: demoId('jebel-ali'), destinationId: demoId('doha-hub'), mode: 'land' as const, typicalDurationHours: 20, costUsd: 900, distanceKm: 650 },
  { originId: demoId('sohar-port'), destinationId: demoId('doha-hub'), mode: 'land' as const, typicalDurationHours: 18, costUsd: 800, distanceKm: 600 },
  { originId: demoId('bahrain-hub'), destinationId: demoId('doha-hub'), mode: 'land' as const, typicalDurationHours: 4, costUsd: 150, distanceKm: 180 },
  // Air routes
  { originId: demoId('abu-dhabi-airport'), destinationId: demoId('hamad-airport'), mode: 'air' as const, typicalDurationHours: 1.5, costUsd: 2000, distanceKm: 330 },
  { originId: demoId('bahrain-hub'), destinationId: demoId('hamad-airport'), mode: 'air' as const, typicalDurationHours: 0.75, costUsd: 1500, distanceKm: 160 },
  { originId: demoId('jebel-ali'), destinationId: demoId('hamad-airport'), mode: 'air' as const, typicalDurationHours: 1, costUsd: 2500, distanceKm: 380 },
]

// ============================================================================
// Products (10-15 essential equipment categories)
// ============================================================================
export interface DemoProduct extends z.infer<typeof productSchema> {
  id: string
}

export const demoProducts: DemoProduct[] = [
  { id: demoId('med-ventilators'), name: 'Medical Ventilators', hsCode: '90192000' },
  { id: demoId('patient-monitors'), name: 'Patient Monitoring Systems', hsCode: '90181900' },
  { id: demoId('dialysis-machines'), name: 'Dialysis Machines', hsCode: '90189010' },
  { id: demoId('surgical-lights'), name: 'Surgical Operating Lights', hsCode: '94054000' },
  { id: demoId('anesthesia-machines'), name: 'Anesthesia Delivery Systems', hsCode: '90192010' },
  { id: demoId('imaging-ultrasound'), name: 'Ultrasound Imaging Systems', hsCode: '90181200' },
  { id: demoId('imaging-xray'), name: 'Digital X-Ray Systems', hsCode: '90221400' },
  { id: demoId('lab-analyzers'), name: 'Clinical Chemistry Analyzers', hsCode: '90278000' },
  { id: demoId('sterilization'), name: 'Sterilization Equipment', hsCode: '84192000' },
  { id: demoId('hospital-beds'), name: 'ICU Hospital Beds', hsCode: '94029000' },
  { id: demoId('infusion-pumps'), name: 'Infusion Pumps', hsCode: '90189020' },
  { id: demoId('defibrillators'), name: 'Defibrillators', hsCode: '90189030' },
  { id: demoId('ecg-machines'), name: 'ECG Machines', hsCode: '90181100' },
  { id: demoId('surgical-instruments'), name: 'Surgical Instrument Sets', hsCode: '90189040' },
  { id: demoId('medical-gas'), name: 'Medical Gas Supply Systems', hsCode: '84138100' },
]

// ============================================================================
// Suppliers (5-8 fictional suppliers with realistic profiles)
// ============================================================================
export interface DemoSupplier extends z.infer<typeof supplierSchema> {
  id: string
}

export const demoSuppliers: DemoSupplier[] = [
  {
    id: demoId('gulf-medical'),
    name: 'Gulf Medical Technologies LLC',
    organizationId: demoId('org-gulf-medical'),
    locationId: demoId('jebel-ali'),
    website: 'https://gulfmedical.example.ae',
  },
  {
    id: demoId('emirates-healthcare'),
    name: 'Emirates Healthcare Supply Co.',
    organizationId: demoId('org-emirates-hc'),
    locationId: demoId('abu-dhabi-airport'),
    website: 'https://emirateshc.example.ae',
  },
  {
    id: demoId('bahrain-med'),
    name: 'Bahrain Medical Distribution',
    organizationId: demoId('org-bahrain-med'),
    locationId: demoId('bahrain-hub'),
    website: 'https://bahrainmed.example.bh',
  },
  {
    id: demoId('sohar-trading'),
    name: 'Sohar International Trading',
    organizationId: demoId('org-sohar-trading'),
    locationId: demoId('sohar-port'),
    website: 'https://sohartinternational.example.om',
  },
  {
    id: demoId('kuwait-medsupply'),
    name: 'Kuwait Medical Supply Group',
    organizationId: demoId('org-kwt-med'),
    locationId: demoId('kuwait-port'),
    website: 'https://kwtmedical.example.kw',
  },
  {
    id: demoId('qatar-health'),
    name: 'Qatar Health Equipment Co.',
    organizationId: demoId('org-qatar-health'),
    locationId: demoId('doha-hub'),
    website: 'https://qatarhealth.example.qa',
  },
  {
    id: demoId('doha-medical'),
    name: 'Doha Medical Logistics',
    organizationId: demoId('org-doha-med'),
    locationId: demoId('doha-hub'),
    website: 'https://dohamedlogistics.example.qa',
  },
  {
    id: demoId('arabian-health'),
    name: 'Arabian Healthcare Solutions',
    organizationId: demoId('org-arabian-hs'),
    locationId: demoId('jebel-ali'),
    website: 'https://arabianhealth.example.ae',
  },
]

// ============================================================================
// Shipments (7-10 shipments with various statuses and milestones)
// ============================================================================
const now = new Date()
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

// Default route request with all required fields
const defaultRouteRequest = (originId: string, destinationId: string, modes: ('land' | 'sea' | 'air')[], allowHypothetical = false) => ({
  originId,
  destinationId,
  shipment: { handling: [] },
  preferences: { modes, allowHypothetical, enrichGeometry: false },
  constraints: { maxHops: 6, maxExpansions: 5000, maxAlternatives: 10, requireConfirmed: false, minConfidence: 0, excludedNodeIds: [], excludedEdgeIds: [] },
  priorities: { cost: 1, time: 1, risk: 1 },
})

export const demoShipments: Shipment[] = [
  {
    id: demoId('shipment-001'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-001',
    productId: demoId('med-ventilators'),
    supplierId: demoId('gulf-medical'),
    originId: demoId('jebel-ali'),
    destinationId: demoId('hamad-port'),
    status: 'in_transit',
    estimatedArrival: daysFromNow(2),
    quantity: '50',
    unit: 'units',
    verifiedUntil: daysFromNow(5),
    routeRequest: defaultRouteRequest(demoId('jebel-ali'), demoId('hamad-port'), ['sea']),
    inventoryId: null,
    confirmedQuantity: null,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
  },
  {
    id: demoId('shipment-002'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-002',
    productId: demoId('patient-monitors'),
    supplierId: demoId('emirates-healthcare'),
    originId: demoId('abu-dhabi-airport'),
    destinationId: demoId('hamad-airport'),
    status: 'in_transit',
    estimatedArrival: daysFromNow(1),
    quantity: '100',
    unit: 'units',
    verifiedUntil: daysFromNow(3),
    routeRequest: defaultRouteRequest(demoId('abu-dhabi-airport'), demoId('hamad-airport'), ['air']),
    inventoryId: null,
    confirmedQuantity: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
  {
    id: demoId('shipment-003'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-003',
    productId: demoId('dialysis-machines'),
    supplierId: demoId('bahrain-med'),
    originId: demoId('bahrain-hub'),
    destinationId: demoId('hamad-port'),
    status: 'delayed',
    estimatedArrival: daysFromNow(5),
    quantity: '20',
    unit: 'units',
    verifiedUntil: daysFromNow(7),
    routeRequest: defaultRouteRequest(demoId('bahrain-hub'), demoId('hamad-port'), ['sea']),
    inventoryId: null,
    confirmedQuantity: null,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(3),
  },
  {
    id: demoId('shipment-004'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-004',
    productId: demoId('surgical-lights'),
    supplierId: demoId('sohar-trading'),
    originId: demoId('sohar-port'),
    destinationId: demoId('hamad-port'),
    status: 'planned',
    estimatedArrival: daysFromNow(10),
    quantity: '30',
    unit: 'units',
    verifiedUntil: daysFromNow(14),
    routeRequest: defaultRouteRequest(demoId('sohar-port'), demoId('hamad-port'), ['sea', 'land'], true),
    inventoryId: null,
    confirmedQuantity: null,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: demoId('shipment-005'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-005',
    productId: demoId('anesthesia-machines'),
    supplierId: demoId('kuwait-medsupply'),
    originId: demoId('kuwait-port'),
    destinationId: demoId('hamad-port'),
    status: 'in_transit',
    estimatedArrival: daysFromNow(4),
    quantity: '15',
    unit: 'units',
    verifiedUntil: daysFromNow(6),
    routeRequest: defaultRouteRequest(demoId('kuwait-port'), demoId('hamad-port'), ['sea']),
    inventoryId: null,
    confirmedQuantity: null,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(1),
  },
  {
    id: demoId('shipment-006'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-006',
    productId: demoId('imaging-ultrasound'),
    supplierId: demoId('qatar-health'),
    originId: demoId('doha-hub'),
    destinationId: demoId('hamad-port'),
    status: 'delivered',
    estimatedArrival: daysAgo(5),
    quantity: '25',
    unit: 'units',
    verifiedUntil: daysAgo(1),
    routeRequest: defaultRouteRequest(demoId('doha-hub'), demoId('hamad-port'), ['sea']),
    inventoryId: demoId('inv-ultrasound'),
    confirmedQuantity: '25',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
  },
  {
    id: demoId('shipment-007'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-007',
    productId: demoId('imaging-xray'),
    supplierId: demoId('doha-medical'),
    originId: demoId('jebel-ali'),
    destinationId: demoId('hamad-airport'),
    status: 'planned',
    estimatedArrival: daysFromNow(7),
    quantity: '10',
    unit: 'units',
    verifiedUntil: daysFromNow(10),
    routeRequest: defaultRouteRequest(demoId('jebel-ali'), demoId('hamad-airport'), ['air', 'sea'], true),
    inventoryId: null,
    confirmedQuantity: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: demoId('shipment-008'),
    ownerId: demoId('demo-owner'),
    trackingNumber: 'MED-QTR-2026-008',
    productId: demoId('lab-analyzers'),
    supplierId: demoId('arabian-health'),
    originId: demoId('jebel-ali'),
    destinationId: demoId('hamad-port'),
    status: 'cancelled',
    estimatedArrival: daysFromNow(14),
    quantity: '12',
    unit: 'units',
    verifiedUntil: daysFromNow(16),
    routeRequest: defaultRouteRequest(demoId('jebel-ali'), demoId('hamad-port'), ['sea']),
    inventoryId: null,
    confirmedQuantity: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
]

// ============================================================================
// Warehouses (2-3 storage locations)
// ============================================================================
export const demoWarehouses = [
  {
    id: demoId('warehouse-main'),
    ownerId: demoId('demo-owner'),
    name: 'Main Medical Warehouse - Doha',
    locationId: demoId('doha-hub'),
  },
  {
    id: demoId('warehouse-port'),
    ownerId: demoId('demo-owner'),
    name: 'Port Storage Facility - Hamad Port',
    locationId: demoId('hamad-port'),
  },
  {
    id: demoId('warehouse-airport'),
    ownerId: demoId('demo-owner'),
    name: 'Airport Cold Storage - Hamad Airport',
    locationId: demoId('hamad-airport'),
  },
]

// ============================================================================
// Inventory (meaningful stock levels and consumption history)
// ============================================================================
export const demoInventory: Inventory[] = [
  {
    id: demoId('inv-ventilators'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('med-ventilators'),
    quantity: '45',
    unit: 'units',
    reservedQuantity: '5',
    historyStart: daysAgo(90),
    createdAt: daysAgo(90),
    updatedAt: daysAgo(5),
  },
  {
    id: demoId('inv-monitors'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('patient-monitors'),
    quantity: '120',
    unit: 'units',
    reservedQuantity: '10',
    historyStart: daysAgo(90),
    createdAt: daysAgo(90),
    updatedAt: daysAgo(3),
  },
  {
    id: demoId('inv-dialysis'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('dialysis-machines'),
    quantity: '8',
    unit: 'units',
    reservedQuantity: '2',
    historyStart: daysAgo(60),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(10),
  },
  {
    id: demoId('inv-surgical-lights'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-port'),
    productId: demoId('surgical-lights'),
    quantity: '15',
    unit: 'units',
    reservedQuantity: '0',
    historyStart: daysAgo(45),
    createdAt: daysAgo(45),
    updatedAt: daysAgo(15),
  },
  {
    id: demoId('inv-anesthesia'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('anesthesia-machines'),
    quantity: '22',
    unit: 'units',
    reservedQuantity: '3',
    historyStart: daysAgo(90),
    createdAt: daysAgo(90),
    updatedAt: daysAgo(7),
  },
  {
    id: demoId('inv-ultrasound'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('imaging-ultrasound'),
    quantity: '30',
    unit: 'units',
    reservedQuantity: '5',
    historyStart: daysAgo(60),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(2),
  },
  {
    id: demoId('inv-xray'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-airport'),
    productId: demoId('imaging-xray'),
    quantity: '5',
    unit: 'units',
    reservedQuantity: '0',
    historyStart: daysAgo(30),
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
  },
  {
    id: demoId('inv-analyzers'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('lab-analyzers'),
    quantity: '18',
    unit: 'units',
    reservedQuantity: '2',
    historyStart: daysAgo(90),
    createdAt: daysAgo(90),
    updatedAt: daysAgo(4),
  },
  {
    id: demoId('inv-sterilization'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-port'),
    productId: demoId('sterilization'),
    quantity: '10',
    unit: 'units',
    reservedQuantity: '1',
    historyStart: daysAgo(60),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(20),
  },
  {
    id: demoId('inv-beds'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('hospital-beds'),
    quantity: '200',
    unit: 'units',
    reservedQuantity: '20',
    historyStart: daysAgo(120),
    createdAt: daysAgo(120),
    updatedAt: daysAgo(1),
  },
  {
    id: demoId('inv-infusion'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('infusion-pumps'),
    quantity: '80',
    unit: 'units',
    reservedQuantity: '8',
    historyStart: daysAgo(90),
    createdAt: daysAgo(90),
    updatedAt: daysAgo(3),
  },
  {
    id: demoId('inv-defib'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-airport'),
    productId: demoId('defibrillators'),
    quantity: '25',
    unit: 'units',
    reservedQuantity: '2',
    historyStart: daysAgo(60),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(5),
  },
  {
    id: demoId('inv-ecg'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('ecg-machines'),
    quantity: '40',
    unit: 'units',
    reservedQuantity: '5',
    historyStart: daysAgo(90),
    createdAt: daysAgo(90),
    updatedAt: daysAgo(2),
  },
  {
    id: demoId('inv-instruments'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-port'),
    productId: demoId('surgical-instruments'),
    quantity: '50',
    unit: 'sets',
    reservedQuantity: '5',
    historyStart: daysAgo(60),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(10),
  },
  {
    id: demoId('inv-medgas'),
    ownerId: demoId('demo-owner'),
    warehouseId: demoId('warehouse-main'),
    productId: demoId('medical-gas'),
    quantity: '15',
    unit: 'systems',
    reservedQuantity: '1',
    historyStart: daysAgo(45),
    createdAt: daysAgo(45),
    updatedAt: daysAgo(15),
  },
]

// ============================================================================
// Simulated Observations (vessel/aircraft positions for map)
// ============================================================================
export const demoObservations = [
  // Vessels near Qatar
  {
    id: demoId('obs-vessel-1'),
    provider: 'AISStream Demo',
    nature: 'attributed' as const,
    observedAt: daysAgo(0.1),
    data: {
      kind: 'vessel' as const,
      providerId: 'IMO-9876543',
      latitude: 51.55,
      longitude: 25.1,
      heading: 315,
      speedKnots: 12.5,
      freshUntil: daysFromNow(0.5),
    },
  },
  {
    id: demoId('obs-vessel-2'),
    provider: 'AISStream Demo',
    nature: 'attributed' as const,
    observedAt: daysAgo(0.2),
    data: {
      kind: 'vessel' as const,
      providerId: 'IMO-9876544',
      latitude: 51.4,
      longitude: 25.2,
      heading: 290,
      speedKnots: 14.2,
      freshUntil: daysFromNow(0.5),
    },
  },
  {
    id: demoId('obs-vessel-3'),
    provider: 'AISStream Demo',
    nature: 'attributed' as const,
    observedAt: daysAgo(0.3),
    data: {
      kind: 'vessel' as const,
      providerId: 'IMO-9876545',
      latitude: 55.0,
      longitude: 25.0,
      heading: 270,
      speedKnots: 11.8,
      freshUntil: daysFromNow(0.5),
    },
  },
  {
    id: demoId('obs-vessel-4'),
    provider: 'AISStream Demo',
    nature: 'attributed' as const,
    observedAt: daysAgo(0.4),
    data: {
      kind: 'vessel' as const,
      providerId: 'IMO-9876546',
      latitude: 56.62,
      longitude: 24.34,
      heading: 305,
      speedKnots: 13.1,
      freshUntil: daysFromNow(0.5),
    },
  },
  // Aircraft
  {
    id: demoId('obs-aircraft-1'),
    provider: 'OpenSky Demo',
    nature: 'attributed' as const,
    observedAt: daysAgo(0.05),
    data: {
      kind: 'aircraft' as const,
      providerId: 'UAE-1234',
      latitude: 51.6,
      longitude: 25.27,
      heading: 180,
      speedKnots: 450,
      altitudeFt: 35000,
      freshUntil: daysFromNow(0.1),
    },
  },
  {
    id: demoId('obs-aircraft-2'),
    provider: 'OpenSky Demo',
    nature: 'attributed' as const,
    observedAt: daysAgo(0.1),
    data: {
      kind: 'aircraft' as const,
      providerId: 'QTR-5678',
      latitude: 51.5,
      longitude: 25.3,
      heading: 90,
      speedKnots: 420,
      altitudeFt: 33000,
      freshUntil: daysFromNow(0.1),
    },
  },
  {
    id: demoId('obs-aircraft-3'),
    provider: 'OpenSky Demo',
    nature: 'attributed' as const,
    observedAt: daysAgo(0.15),
    data: {
      kind: 'aircraft' as const,
      providerId: 'BH-9012',
      latitude: 50.55,
      longitude: 26.21,
      heading: 260,
      speedKnots: 430,
      altitudeFt: 34000,
      freshUntil: daysFromNow(0.1),
    },
  },
]

// ============================================================================
// Alerts (pre-configured for demo)
// ============================================================================
export const demoAlerts = [
  {
    id: demoId('alert-001'),
    ownerId: demoId('demo-owner'),
    title: 'Shipment MED-QTR-2026-003 delayed beyond threshold',
    shipmentId: demoId('shipment-003'),
    rule: 'stale_shipment',
    severity: 'high' as const,
    state: 'open' as const,
    evidence: ['Last milestone 72 hours ago', 'No carrier update received', 'Route passes through disruption zone'],
    occurrence: '2026-11-05T14:30:00.000Z',
    targetKind: 'shipment',
    targetId: demoId('shipment-003'),
    notificationCount: 2,
    readAt: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
  },
  {
    id: demoId('alert-002'),
    ownerId: demoId('demo-owner'),
    title: 'Route cost increase detected for Jebel Ali → Hamad Port',
    shipmentId: demoId('shipment-001'),
    rule: 'increased_cost',
    severity: 'medium' as const,
    state: 'acknowledged' as const,
    evidence: ['Baseline cost: $500', 'Current quote: $625 (+25%)', 'Fuel surcharge applied'],
    occurrence: '2026-11-04T10:15:00.000Z',
    targetKind: 'route',
    targetId: demoId('jebel-ali'),
    notificationCount: 1,
    readAt: daysAgo(2),
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: demoId('alert-003'),
    ownerId: demoId('demo-owner'),
    title: 'Potential stockout: Dialysis Machines (8 units on hand, 12/month demand)',
    rule: 'potential_stockout',
    severity: 'high' as const,
    state: 'open' as const,
    evidence: ['Current stock: 8 units', '30-day avg consumption: 12 units', 'Lead time: 45 days', 'Reorder point breached'],
    occurrence: '2026-11-03T09:00:00.000Z',
    targetKind: 'inventory',
    targetId: demoId('inv-dialysis'),
    notificationCount: 3,
    readAt: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: demoId('alert-004'),
    ownerId: demoId('demo-owner'),
    title: 'Severe weather advisory: Arabian Gulf',
    rule: 'severe_environment',
    severity: 'medium' as const,
    state: 'open' as const,
    evidence: ['Wave height: 4.5m', 'Wind: 35 knots sustained', 'Affects sea routes Jebel Ali → Hamad Port'],
    occurrence: '2026-11-05T06:00:00.000Z',
    targetKind: 'location',
    targetId: demoId('hamad-port'),
    notificationCount: 1,
    readAt: null,
    createdAt: daysAgo(0.5),
    updatedAt: daysAgo(0.5),
  },
  {
    id: demoId('alert-005'),
    ownerId: demoId('demo-owner'),
    title: 'Route delay: Sohar → Hamad Port (land)',
    shipmentId: demoId('shipment-004'),
    rule: 'route_delay',
    severity: 'medium' as const,
    state: 'resolved' as const,
    evidence: ['Border crossing delay: 12 hours', 'Alternative route identified', 'New ETA: +1 day'],
    occurrence: '2026-11-02T16:00:00.000Z',
    targetKind: 'shipment',
    targetId: demoId('shipment-004'),
    notificationCount: 1,
    readAt: daysAgo(2),
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
  },
]

// ============================================================================
// Crisis Scenarios (pre-built for demo)
// ============================================================================
export const demoScenarios = [
  {
    id: demoId('scenario-gulf-disruption'),
    ownerId: demoId('demo-owner'),
    name: 'Arabian Gulf Shipping Disruption',
    routeRequest: {
      originId: demoId('jebel-ali'),
      destinationId: demoId('hamad-port'),
      preferences: { modes: ['sea', 'land', 'air'], allowHypothetical: true },
      constraints: { maxHops: 4, maxExpansions: 2000, maxAlternatives: 10 },
      priorities: { cost: 1, time: 1.5, risk: 2 },
    },
    horizonHours: 168,
    hypothetical: false,
    assumptions: [
      'Strait of Hormuz transit restricted',
      'Insurance premiums increased 300%',
      'Vessel availability reduced 40%',
    ],
    demand: [],
    replenishments: [],
    modifications: [
      { kind: 'supplier_unavailable', supplierId: demoId('gulf-medical') },
      { kind: 'replenishment_delay', shipmentId: demoId('shipment-001'), delayHours: 72 },
      { kind: 'replenishment_delay', shipmentId: demoId('shipment-003'), delayHours: 120 },
    ],
    createdAt: daysAgo(5),
    engineVersion: 'twin-2026.11',
    baselineReference: 'baseline-2026-11-05',
    executed: true,
  },
  {
    id: demoId('scenario-supplier-failure'),
    ownerId: demoId('demo-owner'),
    name: 'Primary Supplier Failure - Gulf Medical',
    routeRequest: {
      originId: demoId('jebel-ali'),
      destinationId: demoId('hamad-port'),
      preferences: { modes: ['sea', 'land', 'air'], allowHypothetical: true },
      constraints: { maxHops: 3, maxExpansions: 1500, maxAlternatives: 8 },
      priorities: { cost: 1.2, time: 1, risk: 1.5 },
    },
    horizonHours: 720,
    hypothetical: false,
    assumptions: [
      'Gulf Medical Technologies ceases operations',
      'Alternative suppliers require qualification',
      'Regulatory approval needed for new sources',
    ],
    demand: [],
    replenishments: [],
    modifications: [
      { kind: 'supplier_unavailable', supplierId: demoId('gulf-medical') },
      { kind: 'inventory_reduction', inventoryId: demoId('inv-ventilators'), quantity: '30' },
    ],
    createdAt: daysAgo(2),
    engineVersion: 'twin-2026.11',
    baselineReference: 'baseline-2026-11-05',
    executed: false,
  },
  {
    id: demoId('scenario-demand-surge'),
    ownerId: demoId('demo-owner'),
    name: 'Regional Health Emergency - Demand Surge',
    routeRequest: {
      originId: demoId('jebel-ali'),
      destinationId: demoId('hamad-port'),
      preferences: { modes: ['sea', 'air'], allowHypothetical: true },
      constraints: { maxHops: 3, maxExpansions: 2000, maxAlternatives: 10 },
      priorities: { cost: 0.5, time: 2, risk: 1 },
    },
    horizonHours: 720,
    hypothetical: true,
    assumptions: [
      'Regional health emergency declared',
      'Demand for critical equipment increases 300%',
      'Air freight prioritized over sea',
    ],
    demand: [
      { productId: demoId('med-ventilators'), unit: 'units', quantity: '150' },
      { productId: demoId('patient-monitors'), unit: 'units', quantity: '300' },
      { productId: demoId('infusion-pumps'), unit: 'units', quantity: '200' },
    ],
    replenishments: [],
    modifications: [],
    createdAt: daysAgo(1),
    engineVersion: 'twin-2026.11',
    baselineReference: 'baseline-2026-11-05',
    executed: false,
  },
]

// ============================================================================
// Demo State Management
// ============================================================================
export interface DemoState {
  shipments: Shipment[]
  inventory: Inventory[]
  alerts: typeof demoAlerts
  scenarios: typeof demoScenarios
  // Track user actions in demo mode
  createdShipments: string[]
  acknowledgedAlerts: string[]
  resolvedAlerts: string[]
  executedScenarios: string[]
  savedRoutes: Array<{ shipmentId: string; alternative: RouteAlternative }>
  lastReset: string
}

export const initialDemoState: DemoState = {
  shipments: [...demoShipments],
  inventory: [...demoInventory],
  alerts: [...demoAlerts],
  scenarios: [...demoScenarios],
  createdShipments: [],
  acknowledgedAlerts: [],
  resolvedAlerts: [],
  executedScenarios: [],
  savedRoutes: [],
  lastReset: new Date().toISOString(),
}

// Helper to get demo state from localStorage
export function getDemoState(): DemoState {
  if (typeof window === 'undefined') return initialDemoState
  try {
    const stored = localStorage.getItem('altair-demo-state')
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with initial state to handle new fields
      return { ...initialDemoState, ...parsed }
    }
  } catch {
    // Ignore parse errors
  }
  return initialDemoState
}

export function setDemoState(state: DemoState): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('altair-demo-state', JSON.stringify(state))
  }
}

export function resetDemoState(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('altair-demo-state', JSON.stringify(initialDemoState))
    window.location.reload()
  }
}