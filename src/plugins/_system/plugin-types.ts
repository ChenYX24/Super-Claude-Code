/**
 * Plugin System - Type Definitions
 *
 * Core types for the SCC plugin framework. Plugins extend the dashboard
 * with custom pages, sidebar entries, API routes, and lifecycle hooks.
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

// ---- Manifest ----

/** Sidebar navigation item contributed by a plugin */
export interface PluginSidebarItem {
  /** Route path relative to /plugins/{pluginId}/ */
  path: string;
  /** Display label in the sidebar */
  label: string;
  /** Lucide icon name (resolved at runtime) or a React component */
  icon?: string | LucideIcon;
  /** Sort order within the plugin section (lower = higher) */
  order?: number;
}

/** Route definition for plugin pages */
export interface PluginRoute {
  /** Route path relative to /plugins/{pluginId}/ (e.g. "" for index, "settings") */
  path: string;
  /** Display title for the page */
  title: string;
}

/** Static manifest describing a plugin */
export interface PluginManifest {
  /** Unique identifier (kebab-case, e.g. "session-analytics") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version (e.g. "1.0.0") */
  version: string;
  /** Brief description */
  description: string;
  /** Author name or organization */
  author?: string;
  /** Lucide icon name for the sidebar section header */
  icon?: string | LucideIcon;
  /** Routes this plugin contributes */
  routes: PluginRoute[];
  /** Sidebar items this plugin contributes */
  sidebarItems: PluginSidebarItem[];
  /** Minimum SCC dashboard version required */
  minDashboardVersion?: string;
}

// ---- Module ----

/** API route handler (mirrors Next.js route handler signature) */
export type PluginApiHandler = (
  req: Request,
) => Response | Promise<Response>;

/** A fully loaded plugin module */
export interface PluginModule {
  /** Static manifest */
  manifest: PluginManifest;

  /**
   * Page components keyed by route path.
   * Key "" = index page at /plugins/{id}
   * Key "settings" = /plugins/{id}/settings
   */
  pages: Record<string, ComponentType>;

  /**
   * API route handlers keyed by path.
   * Key "data" => GET /api/plugins/{id}/data
   */
  apiRoutes?: Record<string, PluginApiHandler>;

  /** Called when the plugin is loaded/enabled */
  onLoad?: () => void | Promise<void>;

  /** Called when the plugin is unloaded/disabled */
  onUnload?: () => void | Promise<void>;
}

// ---- Registry State ----

/** Runtime state of a registered plugin */
export interface PluginEntry {
  manifest: PluginManifest;
  module: PluginModule;
  enabled: boolean;
  loadedAt: number;
}
