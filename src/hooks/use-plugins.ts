"use client";

import { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import { pluginRegistry } from "@/plugins/_system/plugin-registry";
import { loadAllPlugins } from "@/plugins/_system/plugin-loader";
import type { PluginEntry, PluginManifest, PluginSidebarItem } from "@/plugins/_system/plugin-types";

/**
 * Subscribe to plugin registry changes and return all plugin entries.
 */
export function usePlugins(): PluginEntry[] {
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);

  useEffect(() => {
    // Load all plugins on first use
    loadAllPlugins();

    // Initial state
    setPlugins(pluginRegistry.getAll());

    // Subscribe to changes
    const unsubscribe = pluginRegistry.subscribe(() => {
      setPlugins(pluginRegistry.getAll());
    });

    return unsubscribe;
  }, []);

  return plugins;
}

/**
 * Get sidebar items from all enabled plugins.
 */
export function usePluginSidebarItems(): { pluginId: string; manifest: PluginManifest; items: PluginSidebarItem[] }[] {
  const [items, setItems] = useState<{ pluginId: string; manifest: PluginManifest; items: PluginSidebarItem[] }[]>([]);

  useEffect(() => {
    loadAllPlugins();
    setItems(pluginRegistry.getSidebarItems());

    const unsubscribe = pluginRegistry.subscribe(() => {
      setItems(pluginRegistry.getSidebarItems());
    });

    return unsubscribe;
  }, []);

  return items;
}
