"use client";

/**
 * Plugin Initializer Component
 *
 * Renders nothing visible. On mount, loads all registered plugins.
 * Place this component once in the app layout to ensure plugins are
 * loaded early in the lifecycle.
 */

import { useEffect, useRef } from "react";
import { loadAllPlugins } from "./plugin-loader";

export function PluginInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadAllPlugins();
  }, []);

  return null;
}
