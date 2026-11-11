/**
 * @mosaix/command-center — structured event bus + bounded circular history.
 */
import type {
  EventCategory,
  EventLevel,
  LogEntry,
  LogStream,
  ServiceName,
  SupervisorEvent,
  SupervisorServiceEvent,
} from "./supervisor-types.js";
import { redactSecrets } from "./secret-guard.js";

export const DEFAULT_EVENT_CAP = 5000;
export const DEFAULT_LOG_CAP = 5000;

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
    payload?: SupervisorServiceEvent,
  ): SupervisorEvent {
    const event: SupervisorEvent = {
      seq: ++this.seq,
      at: Date.now(),
      category,
      level,
      message: redactSecrets(message),
      ...(payload ? { payload } : {}),
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

  /** Recherche textuelle (insensible à la casse) dans les événements. */
  searchEvents(query: string): SupervisorEvent[] {
    const q = query.toLowerCase();
    return this.events.filter((e) => e.message.toLowerCase().includes(q));
  }

  /** Recherche textuelle (insensible à la casse) dans les logs. */
  searchLogs(query: string): LogEntry[] {
    const q = query.toLowerCase();
    return this.logs.filter((l) => l.text.toLowerCase().includes(q));
  }

  /** Filtre les événements par niveau de sévérité. */
  filterEventsByLevel(level: EventLevel): SupervisorEvent[] {
    return this.events.filter((e) => e.level === level);
  }

  /** Filtre les logs par niveau de sévérité. */
  filterLogsByLevel(level: EventLevel): LogEntry[] {
    return this.logs.filter((l) => l.level === level);
  }

  /** Vide les événements (complément de clearLogs). */
  clearEvents(): void {
    this.events = [];
  }

  /** Exporte tout l'historique en JSON (logs + événements). */
  toJSON(): { events: SupervisorEvent[]; logs: LogEntry[] } {
    return { events: [...this.events], logs: [...this.logs] };
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
    payload?: SupervisorServiceEvent,
  ): SupervisorEvent {
    const event = this.history.pushEvent(category, message, level, payload);
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
