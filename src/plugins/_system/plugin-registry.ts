/**
 * Plugin Registry
 *
 * Central registry for discovering, registering, enabling, and disabling plugins.
 * Operates as an in-memory singleton. Plugin enable/disable state is persisted
 * to localStorage on the client side.
 */

import type { PluginModule, PluginEntry, PluginManifest, PluginSidebarItem } from "./plugin-types";

// ---- Storage Key ----

const STORAGE_KEY = "scc-plugin-state";

// ---- Listener type ----

type RegistryListener = () => void;

// ---- Registry Class ----

class PluginRegistry {
  private plugins: Map<string, PluginEntry> = new Map();
  private listeners: Set<RegistryListener> = new Set();

  /** Register and load a plugin module */
  async register(module: PluginModule): Promise<void> {
    const { manifest } = module;

    if (!manifest.id || !manifest.name) {
      console.error("[PluginRegistry] Invalid manifest: missing id or name");
      return;
    }

    if (this.plugins.has(manifest.id)) {
      console.warn(`[PluginRegistry] Plugin "${manifest.id}" already registered, skipping`);
      return;
    }

    // Check persisted enable/disable state
    const enabled = this.getPersistedState(manifest.id);

    const entry: PluginEntry = {
      manifest,
      module,
      enabled,
      loadedAt: Date.now(),
    };

    this.plugins.set(manifest.id, entry);

    if (enabled) {
      try {
        await module.onLoad?.();
      } catch (err) {
        console.error(`[PluginRegistry] onLoad failed for "${manifest.id}":`, err);
      }
    }

    this.notify();
  }

  /** Unregister a plugin and call its onUnload hook */
  async unregister(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry) return;

    if (entry.enabled) {
      try {
        await entry.module.onUnload?.();
      } catch (err) {
        console.error(`[PluginRegistry] onUnload failed for "${pluginId}":`, err);
      }
    }

    this.plugins.delete(pluginId);
    this.notify();
  }

  /** Enable a plugin */
  async enable(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry || entry.enabled) return;

    try {
      await entry.module.onLoad?.();
    } catch (err) {
      console.error(`[PluginRegistry] onLoad failed for "${pluginId}":`, err);
      return;
    }

    const updated: PluginEntry = { ...entry, enabled: true };
    this.plugins.set(pluginId, updated);
    this.persistState(pluginId, true);
    this.notify();
  }

  /** Disable a plugin */
  async disable(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry || !entry.enabled) return;

    try {
      await entry.module.onUnload?.();
    } catch (err) {
      console.error(`[PluginRegistry] onUnload failed for "${pluginId}":`, err);
    }

    const updated: PluginEntry = { ...entry, enabled: false };
    this.plugins.set(pluginId, updated);
    this.persistState(pluginId, false);
    this.notify();
  }

  /** Get a plugin entry by ID */
  get(pluginId: string): PluginEntry | undefined {
    return this.plugins.get(pluginId);
  }

  /** Get all registered plugins */
  getAll(): PluginEntry[] {
    return Array.from(this.plugins.values());
  }

  /** Get only enabled plugins */
  getEnabled(): PluginEntry[] {
    return this.getAll().filter((p) => p.enabled);
  }

  /** Get all sidebar items from enabled plugins, sorted */
  getSidebarItems(): { pluginId: string; manifest: PluginManifest; items: PluginSidebarItem[] }[] {
    return this.getEnabled()
      .filter((p) => p.manifest.sidebarItems.length > 0)
      .map((p) => ({
        pluginId: p.manifest.id,
        manifest: p.manifest,
        items: [...p.manifest.sidebarItems].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
      }));
  }

  /** Subscribe to registry changes */
  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal ----

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* ignore */
      }
    }
  }

  private getPersistedState(pluginId: string): boolean {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return true; // enabled by default
      const state = JSON.parse(raw);
      return state[pluginId] !== false;
    } catch {
      return true;
    }
  }

  private persistState(pluginId: string, enabled: boolean): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const state = raw ? JSON.parse(raw) : {};
      state[pluginId] = enabled;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
}

// ---- Singleton ----

export const pluginRegistry = new PluginRegistry();
