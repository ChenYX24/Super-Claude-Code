"use client";
import { useState, useCallback, useEffect } from "react";

export interface SessionMetaEntry {
  displayName: string | null;
  pinned: boolean;
  tags: string[];
  deleted: boolean;
}

export type SessionMetaMap = Record<string, SessionMetaEntry>;

export function useSessionMeta() {
  const [metaMap, setMetaMap] = useState<SessionMetaMap>({});
  const [loading, setLoading] = useState(true);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions/metadata");
      if (res.ok) {
        const data: SessionMetaMap = await res.json();
        setMetaMap(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const updateMeta = useCallback(
    async (
      sessionId: string,
      updates: Partial<Pick<SessionMetaEntry, "displayName" | "pinned" | "tags" | "deleted">>
    ) => {
      // Optimistic update
      setMetaMap((prev) => {
        const existing = prev[sessionId] || {
          displayName: null,
          pinned: false,
          tags: [],
          deleted: false,
        };
        return {
          ...prev,
          [sessionId]: { ...existing, ...updates },
        };
      });

      try {
        const res = await fetch("/api/sessions/metadata", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...updates }),
        });
        if (res.ok) {
          const result = await res.json();
          setMetaMap((prev) => ({
            ...prev,
            [sessionId]: {
              displayName: result.displayName,
              pinned: result.pinned,
              tags: result.tags,
              deleted: result.deleted,
            },
          }));
        }
      } catch {
        // Revert optimistic update on failure
        await fetchMeta();
      }
    },
    [fetchMeta]
  );

  const getMeta = useCallback(
    (sessionId: string): SessionMetaEntry =>
      metaMap[sessionId] || { displayName: null, pinned: false, tags: [], deleted: false },
    [metaMap]
  );

  return { metaMap, loading, getMeta, updateMeta, refetch: fetchMeta };
}
