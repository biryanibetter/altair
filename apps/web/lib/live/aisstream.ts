import WebSocket, { type RawData } from "ws";
import type { LiveVessel, SourceState } from "./types";
import { classifyZone, isUnderway, navStatusLabel } from "./vesselapi";

const STREAM_URL = "wss://stream.aisstream.io/v0/stream";

/** Qatar operational box — same footprint used for the VesselAPI REST snapshot. */
const QATAR_BOUNDING_BOX: [[number, number], [number, number]] = [
  [24.3, 50.4],
  [26.3, 52.0],
];

const MESSAGE_TYPES = ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport"];

const POSITION_TTL_MS = 15 * 60 * 1000;
const MAX_POSITIONS = 750;
const IDLE_SHUTDOWN_MS = 5 * 60 * 1000;

type AisStatus = "idle" | "connecting" | "live" | "reconnecting" | "error" | "disabled";

interface AisEnvelope {
  MessageType?: string;
  MetaData?: {
    MMSI?: number;
    MMSI_String?: number;
    ShipName?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: {
      Sog?: number;
      Cog?: number;
      TrueHeading?: number;
      NavigationalStatus?: number;
      Latitude?: number;
      Longitude?: number;
      Timestamp?: number;
    };
    StandardClassBPositionReport?: {
      Sog?: number;
      Cog?: number;
      TrueHeading?: number;
      Latitude?: number;
      Longitude?: number;
      NavigationalStatus?: number;
    };
    ExtendedClassBPositionReport?: {
      Sog?: number;
      Cog?: number;
      TrueHeading?: number;
      Latitude?: number;
      Longitude?: number;
      NavigationalStatus?: number;
    };
    CompressionEnabled?: boolean;
  };
}

export interface AisStreamEvent {
  type: "position" | "status";
  vessel?: LiveVessel;
  status?: SourceState;
}

type Listener = (event: AisStreamEvent) => void;

class AisStreamHub {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private positions = new Map<number, LiveVessel>();
  private status: AisStatus = "idle";
  private detail = "awaiting subscription";
  private lastError: string | null = null;
  private messageCount = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt: string | null = null;

  get isEnabled(): boolean {
    return Boolean(process.env.AISSTREAM_API_KEY);
  }

  /** Opens the single shared upstream socket (idempotent). */
  connect(): void {
    if (!this.isEnabled) {
      this.setStatus("disabled", "AISSTREAM_API_KEY not configured");
      return;
    }
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting", "opening upstream socket");

    const socket = new WebSocket(STREAM_URL, {
      perMessageDeflate: true,
      handshakeTimeout: 10_000,
    });
    this.socket = socket;

    socket.on("open", () => {
      this.reconnectAttempts = 0;
      this.startedAt = new Date().toISOString();
      this.setStatus("live", "subscription sent");
      socket.send(
        JSON.stringify({
          APIKey: process.env.AISSTREAM_API_KEY,
          BoundingBoxes: [QATAR_BOUNDING_BOX],
          FilterMessageTypes: MESSAGE_TYPES,
        })
      );
    });

    socket.on("message", (raw: RawData) => {
      this.handleMessage(raw);
    });

    socket.on("error", (error: Error) => {
      this.lastError = error.message;
      this.setStatus("error", error.message.slice(0, 160));
    });

    socket.on("close", (code: number, reason: Buffer) => {
      this.socket = null;
      const why = reason?.toString() || `code ${code}`;
      this.lastError = why;
      if (this.listeners.size === 0) {
        this.setStatus("idle", "no subscribers");
        return;
      }
      this.setStatus("reconnecting", `closed (${why}) — reconnecting`);
      this.scheduleReconnect();
    });
  }

  /** Subscribe a consumer (SSE stream / route handler). Returns an unsubscribe fn. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.idleTimer = setTimeout(() => this.shutdown(), IDLE_SHUTDOWN_MS);
        this.idleTimer.unref?.();
      }
    };
  }

  getRecentPositions(limit = 100): LiveVessel[] {
    this.purge();
    return [...this.positions.values()]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, limit);
  }

  getSourceState(): SourceState {
    const label: Record<AisStatus, SourceState["status"]> = {
      idle: "standby",
      connecting: "standby",
      live: "live",
      reconnecting: "degraded",
      error: "degraded",
      disabled: "offline",
    };
    return {
      status: label[this.status],
      detail:
        this.status === "live"
          ? `connected · ${this.messageCount} msgs · ${this.positions.size} tracks`
          : this.detail,
      updatedAt: this.startedAt ?? undefined,
    };
  }

  getDiagnostics() {
    return {
      status: this.status,
      messageCount: this.messageCount,
      tracks: this.positions.size,
      lastError: this.lastError,
      startedAt: this.startedAt,
    };
  }

  private handleMessage(raw: RawData): void {
    let envelope: AisEnvelope;
    try {
      envelope = JSON.parse(raw.toString()) as AisEnvelope;
    } catch {
      return;
    }

    if (envelope.MessageType === "SubscriptionConfirmation") {
      const compressed = envelope.Message?.CompressionEnabled ? "compressed" : "uncompressed";
      this.setStatus("live", `subscribed (${compressed})`);
      return;
    }

    const meta = envelope.MetaData;
    if (!meta?.MMSI) return;

    const lat = meta.latitude ?? this.bodyLat(envelope);
    const lng = meta.longitude ?? this.bodyLng(envelope);
    if (typeof lat !== "number" || typeof lng !== "number") return;

    const body =
      envelope.Message?.PositionReport ??
      envelope.Message?.StandardClassBPositionReport ??
      envelope.Message?.ExtendedClassBPositionReport ??
      {};

    const sog = typeof body.Sog === "number" && Number.isFinite(body.Sog) ? Math.max(0, body.Sog) : 0;
    const navStatus = typeof body.NavigationalStatus === "number" ? body.NavigationalStatus : null;

    const vessel: LiveVessel = {
      mmsi: meta.MMSI,
      name: (meta.ShipName || `MMSI ${meta.MMSI}`).trim(),
      lat,
      lng,
      sog: Math.round(sog * 10) / 10,
      cog: typeof body.Cog === "number" ? body.Cog : null,
      heading: typeof body.TrueHeading === "number" ? body.TrueHeading : null,
      navStatus,
      navStatusLabel: navStatusLabel(navStatus, sog),
      timestamp: meta.time_utc ? new Date(meta.time_utc.replace(" ", "T")).toISOString() : new Date().toISOString(),
      zone: classifyZone(lat, lng),
      moving: isUnderway(navStatus, sog),
      source: "aisstream",
    };

    this.messageCount += 1;
    this.positions.set(vessel.mmsi, vessel);
    this.purge();
    this.emit({ type: "position", vessel });
  }

  private bodyLat(envelope: AisEnvelope): number | undefined {
    return (
      envelope.Message?.PositionReport?.Latitude ??
      envelope.Message?.StandardClassBPositionReport?.Latitude ??
      envelope.Message?.ExtendedClassBPositionReport?.Latitude
    );
  }

  private bodyLng(envelope: AisEnvelope): number | undefined {
    return (
      envelope.Message?.PositionReport?.Longitude ??
      envelope.Message?.StandardClassBPositionReport?.Longitude ??
      envelope.Message?.ExtendedClassBPositionReport?.Longitude
    );
  }

  private purge(): void {
    const cutoff = Date.now() - POSITION_TTL_MS;
    for (const [mmsi, vessel] of this.positions) {
      if (Date.parse(vessel.timestamp) < cutoff) this.positions.delete(mmsi);
    }
    if (this.positions.size > MAX_POSITIONS) {
      const oldest = [...this.positions.entries()].sort(
        (a, b) => Date.parse(a[1].timestamp) - Date.parse(b[1].timestamp)
      );
      for (const [mmsi] of oldest.slice(0, this.positions.size - MAX_POSITIONS)) {
        this.positions.delete(mmsi);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(2000 * 2 ** (this.reconnectAttempts - 1), 60_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  private shutdown(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close(1000, "idle");
    this.socket = null;
    this.setStatus("idle", "no subscribers");
  }

  private setStatus(status: AisStatus, detail: string): void {
    this.status = status;
    this.detail = detail;
    this.emit({ type: "status", status: this.getSourceState() });
  }

  private emit(event: AisStreamEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A broken SSE client must not kill the socket.
      }
    }
  }
}

const globalForAis = globalThis as unknown as { __qatarAisHub?: AisStreamHub };
export const aisHub: AisStreamHub = globalForAis.__qatarAisHub ?? new AisStreamHub();
if (process.env.NODE_ENV !== "production") globalForAis.__qatarAisHub = aisHub;
