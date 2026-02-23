"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchRemoteRegistry,
  invalidateRegistryCache,
  type RemoteTemplate,
} from "@/lib/remote-registry";

interface UseCommunityTemplatesResult {
  skills: RemoteTemplate[];
  agents: RemoteTemplate[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

export function useCommunityTemplates(): UseCommunityTemplatesResult {
  const [skills, setSkills] = useState<RemoteTemplate[]>([]);
  const [agents, setAgents] = useState<RemoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const registry = await fetchRemoteRegistry();
    if (registry) {
      setSkills(registry.skills);
      setAgents(registry.agents);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    invalidateRegistryCache();
    load();
  }, [load]);

  return { skills, agents, loading, error, refresh };
}
