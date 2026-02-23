"use client";

import { useEffect, useRef } from "react";
import { eventBus } from "@/lib/event-bus/event-emitter";
import type { EventMap, EventName } from "@/lib/event-bus/event-emitter";

/**
 * Subscribe to an event bus event within a React component.
 * Automatically cleans up on unmount.
 */
export function useEventBus<K extends EventName>(
  event: K,
  handler: (data: EventMap[K]) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = eventBus.on(event, (data) => {
      handlerRef.current(data);
    });
    return unsub;
  }, [event]);
}

/**
 * Get a stable emit function for publishing events.
 */
export function useEmit() {
  return eventBus.emit.bind(eventBus);
}
