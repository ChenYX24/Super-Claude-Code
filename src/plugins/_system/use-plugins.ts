"use client";

/**
 * React hook for consuming plugin registry state.
 * Re-renders when plugins are registered, enabled, or disabled.
 */

import { useEffect, useState } from "react";
import { pluginRegistry } from "./plugin-registry";
import type { PluginEntry, PluginManifest, PluginSidebarItem } from "./plugin-types";

/** Get all registered plugins (enabled and disabled) */
export function usePlugins(): PluginEntry[] {
  const [plugins, setPlugins] = useState<PluginEntry[]>(() => pluginRegistry.getAll());

  useEffect(() => {
    // Initial sync
    setPlugins(pluginRegistry.getAll());

    const unsub = pluginRegistry.subscribe(() => {
      setPlugins(pluginRegistry.getAll());
    });

    return unsub;
  }, []);

  return plugins;
}

/** Get only enabled plugins */
export function useEnabledPlugins(): PluginEntry[] {
  const all = usePlugins();
  return all.filter((p) => p.enabled);
}

/** Get sidebar items from all enabled plugins */
export function usePluginSidebarItems(): {
  pluginId: string;
  manifest: PluginManifest;
  items: PluginSidebarItem[];
}[] {
  const [sidebarData, setSidebarData] = useState(() => pluginRegistry.getSidebarItems());

  useEffect(() => {
    setSidebarData(pluginRegistry.getSidebarItems());

    const unsub = pluginRegistry.subscribe(() => {
      setSidebarData(pluginRegistry.getSidebarItems());
    });

    return unsub;
  }, []);

  return sidebarData;
}
