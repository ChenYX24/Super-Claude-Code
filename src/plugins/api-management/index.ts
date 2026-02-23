/**
 * API Management Plugin (Demo)
 *
 * Demonstrates the plugin system with a minimal plugin that adds
 * an "API Keys" sidebar entry and a placeholder page.
 */

import type { PluginModule } from "@/plugins/_system/plugin-types";
import { ApiKeysPage } from "./pages";
import { Key } from "lucide-react";

export const plugin: PluginModule = {
  manifest: {
    id: "api-management",
    name: "API Management",
    version: "0.1.0",
    description: "Manage API keys and provider configurations",
    author: "SCC Team",
    icon: Key,
    routes: [
      { path: "", title: "API Keys" },
    ],
    sidebarItems: [
      {
        path: "",
        label: "API Keys",
        icon: Key,
        order: 1,
      },
    ],
  },

  pages: {
    "": ApiKeysPage,
  },

  onLoad: async () => {
    console.log("[Plugin] API Management loaded");
  },

  onUnload: async () => {
    console.log("[Plugin] API Management unloaded");
  },
};
