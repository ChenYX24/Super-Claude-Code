/**
 * Typed Event Emitter
 *
 * A strongly-typed publish/subscribe event bus for cross-component and
 * cross-plugin communication within the SCC dashboard.
 */

// ---- Event type map ----

export interface EventMap {
  /** A session has completed (from session monitor or chat) */
  "session.complete": { sessionId: string; project?: string; cost?: number; durationMs?: number };
  /** A session started */
  "session.start": { sessionId: string; project?: string };
  /** Cost threshold alert */
  "cost.alert": { type: "daily" | "weekly"; current: number; budget: number };
  /** A plugin emitted a custom event */
  "plugin.event": { pluginId: string; action: string; data?: unknown };
  /** Bot message received */
  "bot.message": { source: string; text: string; timestamp: number };
  /** Notification created */
  "notification.created": { id: string; type: string; title: string };
  /** Generic custom event (escape hatch) */
  "custom": { name: string; payload?: unknown };
}

export type EventName = keyof EventMap;

type Listener<T> = (data: T) => void;

// ---- Emitter class ----

class EventEmitter {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends EventName>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener as Listener<unknown>);

    return () => {
      set.delete(listener as Listener<unknown>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /** Subscribe to an event, but only fire once. */
  once<K extends EventName>(event: K, listener: Listener<EventMap[K]>): () => void {
    const unsub = this.on(event, (data) => {
      unsub();
      listener(data);
    });
    return unsub;
  }

  /** Publish an event to all subscribers. */
  emit<K extends EventName>(event: K, data: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(data);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
    }
  }

  /** Remove all listeners for a specific event, or all events if no event specified. */
  removeAll(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /** Get the number of listeners for an event. */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// ---- Singleton ----

export const eventBus = new EventEmitter();
