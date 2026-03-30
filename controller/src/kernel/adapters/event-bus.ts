/**
 * EventBus adapter — wraps the upstream EventManager.
 */
import type { EventBus, ControllerEvent } from "../interfaces";

let _counter = 0;
const nextEventId = (): string => `kevt-${String(++_counter).padStart(6, "0")}`;

/**
 * Wraps the upstream `EventManager` behind the kernel EventBus port.
 *
 * The upstream EventManager is async/SSE-oriented. This adapter also
 * maintains an in-memory event log so the kernel can query recent events
 * (e.g. for the snapshot endpoint).
 */
export class EventBusAdapter implements EventBus {
  private readonly events: ControllerEvent[] = [];
  private readonly upstream: {
    publish(event: { type: string; data: Record<string, unknown> }): Promise<void> | void;
  } | null;
  private readonly maxEvents: number;

  constructor(
    upstream?: {
      publish(event: { type: string; data: Record<string, unknown> }): Promise<void> | void;
    } | null,
    maxEvents = 2000,
  ) {
    this.upstream = upstream ?? null;
    this.maxEvents = maxEvents;
  }

  publish<T>(type: string, data: T): ControllerEvent<T> {
    const event: ControllerEvent<T> = {
      id: nextEventId(),
      type,
      ts: new Date().toISOString(),
      data,
    };
    this.events.push(event as ControllerEvent);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }

    if (this.upstream) {
      // Fire-and-forget; upstream publish is best-effort for SSE delivery
      void this.upstream.publish({
        type,
        data: data as unknown as Record<string, unknown>,
      });
    }

    return event;
  }

  list(): ControllerEvent[] {
    return [...this.events];
  }
}
