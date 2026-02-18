"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Clock } from "lucide-react";
import { SessionList } from "@/components/sessions/session-list";
import { SessionDetailView } from "@/components/sessions/session-detail";
import type { SessionsData } from "@/components/sessions/types";

function SessionsPageInner() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<{ project: string; id: string } | null>(null);
  const searchParams = useSearchParams();
  const deepLinked = useRef(false);

  const loadData = useCallback((isManual = false) => {
    if (isManual) setRefreshing(true);
    fetch("/api/sessions").then(r => r.json()).then((d: SessionsData) => {
      setData(d);
      setLoading(false);
      setRefreshing(false);

      // Deep-link: ?session=UUID auto-opens that session
      if (!deepLinked.current) {
        const sessionId = searchParams.get("session");
        if (sessionId && d.recentSessions) {
          const match = d.recentSessions.find(s => s.id === sessionId);
          if (match) {
            setActive({ project: match.project, id: match.id });
            deepLinked.current = true;
          }
        }
      }
    }).catch(() => { setLoading(false); setRefreshing(false); });
  }, [searchParams]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 10s when on list view
  useEffect(() => {
    if (active) return;
    const iv = setInterval(() => loadData(), 10000);
    return () => clearInterval(iv);
  }, [active, loadData]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (active) return <SessionDetailView projectPath={active.project} sessionId={active.id} onBack={() => setActive(null)} />;
  if (!data) return <div className="text-center py-16"><Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h2 className="text-lg">No data</h2></div>;
  return <SessionList data={data} onRefresh={() => loadData(true)} refreshing={refreshing} onSelect={(p, id) => setActive({ project: p, id })} />;
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <SessionsPageInner />
    </Suspense>
  );
}
