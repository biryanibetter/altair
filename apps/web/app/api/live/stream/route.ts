import { getFleetSnapshot } from "@/lib/live/fleet";
import { aisHub } from "@/lib/live/aisstream";

/**
 * GET /api/live/stream — Server-Sent Events.
 *
 * Browsers are not allowed to open AISStream sockets directly (their docs
 * forbid it and the key must stay server-side), so this route fans out one
 * shared upstream WebSocket to every connected client.
 *
 * Events:
 *   fleet   — full snapshot, every 15s
 *   vessel  — a single AIS position pushed by the stream
 *   source  — upstream status change
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let snapshotTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (snapshotTimer) clearInterval(snapshotTimer);
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Initial snapshot, then subscribe to the shared AISStream socket.
      void getFleetSnapshot().then((snapshot) => send("fleet", snapshot));

      unsubscribe = aisHub.subscribe((event) => {
        if (event.type === "position" && event.vessel) {
          send("vessel", event.vessel);
        } else if (event.type === "status" && event.status) {
          send("source", { aisStream: event.status });
        }
      });

      snapshotTimer = setInterval(() => {
        void getFleetSnapshot({ force: true }).then((snapshot) => send("fleet", snapshot));
      }, 15_000);

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          close();
        }
      }, 20_000);

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
