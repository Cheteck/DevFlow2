/**
 * @mosaix/dev-server — structured event bus + bounded circular history.
 */
import type {
  EventCategory,
  EventLevel,
  LogEntry,
  LogStream,
  ServiceName,
  SupervisorEvent,
} from "./supervisor-types.js";
import { redactSecrets } from "./secret-guard.js";

export const DEFAULT_EVENT_CAP = 300;
export const DEFAULT_LOG_CAP = 800;

export class EventHistory {
  private events: SupervisorEvent[] = [];
  private logs: LogEntry[] = [];
  private seq = 0;

  constructor(
    private readonly eventCap: number = DEFAULT_EVENT_CAP,
    private readonly logCap: number = DEFAULT_LOG_CAP,
  ) {}

  pushEvent(
    category: EventCategory,
    message: string,
    level: EventLevel = "info",
  ): SupervisorEvent {
    const event: SupervisorEvent = {
      seq: ++this.seq,
      at: Date.now(),
      category,
      level,
      message: redactSecrets(message),
    };
    this.events.push(event);
    if (this.events.length > this.eventCap) {
      this.events.splice(0, this.events.length - this.eventCap);
    }
    return event;
  }

  pushLog(
    service: ServiceName | "supervisor",
    stream: LogStream,
    text: string,
    level?: EventLevel,
  ): LogEntry {
    // Split multi-line chunks so rendering stays line-oriented.
    const lines = text.split(/\r?\n/);
    let last: LogEntry | null = null;
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (!line) continue;
      last = {
        seq: ++this.seq,
        at: Date.now(),
        service,
        stream,
        level,
        text: redactSecrets(line).slice(0, 2000),
      };
      this.logs.push(last);
      if (this.logs.length > this.logCap) {
        this.logs.splice(0, this.logs.length - this.logCap);
      }
    }
    // Always return an entry (callers may ignore it).
    return (
      last ?? {
        seq: ++this.seq,
        at: Date.now(),
        service,
        stream,
        level,
        text: "",
      }
    );
  }

  getEvents(): SupervisorEvent[] {
    return [...this.events];
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  get eventSize(): number {
    return this.events.length;
  }

  get logSize(): number {
    return this.logs.length;
  }
}

export type BusListener = (event: SupervisorEvent) => void;

/** Tiny emitter so supervisor parts stay decoupled and testable. */
export class EventBus {
  private listeners = new Set<BusListener>();

  constructor(private readonly history: EventHistory) {}

  emit(
    category: EventCategory,
    message: string,
    level: EventLevel = "info",
  ): SupervisorEvent {
    const event = this.history.pushEvent(category, message, level);
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        /* listener faults never break supervision */
      }
    }
    return event;
  }

  subscribe(listener: BusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
