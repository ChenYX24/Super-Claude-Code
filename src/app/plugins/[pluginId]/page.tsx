"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { pluginRegistry } from "@/plugins/_system/plugin-registry";
import { loadAllPlugins } from "@/plugins/_system/plugin-loader";
import { Puzzle, AlertCircle } from "lucide-react";
import type { PluginEntry } from "@/plugins/_system/plugin-types";

export default function PluginPage() {
  const params = useParams();
  const pluginId = params.pluginId as string;
  const [entry, setEntry] = useState<PluginEntry | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAllPlugins().then(() => {
      setEntry(pluginRegistry.get(pluginId));
      setLoaded(true);
    });

    const unsubscribe = pluginRegistry.subscribe(() => {
      setEntry(pluginRegistry.get(pluginId));
    });

    return unsubscribe;
  }, [pluginId]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Puzzle className="h-6 w-6 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mb-3" />
        <h2 className="text-lg font-semibold text-foreground">Plugin Not Found</h2>
        <p className="text-sm mt-1">
          No plugin with ID &quot;{pluginId}&quot; is registered.
        </p>
      </div>
    );
  }

  if (!entry.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Puzzle className="h-10 w-10 mb-3" />
        <h2 className="text-lg font-semibold text-foreground">{entry.manifest.name}</h2>
        <p className="text-sm mt-1">This plugin is currently disabled.</p>
      </div>
    );
  }

  // Resolve page component: use "" (index) or first route
  const PageComponent = entry.module.pages[""] ?? Object.values(entry.module.pages)[0];

  if (!PageComponent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Puzzle className="h-10 w-10 mb-3" />
        <h2 className="text-lg font-semibold text-foreground">{entry.manifest.name}</h2>
        <p className="text-sm mt-1">This plugin has no pages.</p>
      </div>
    );
  }

  return <PageComponent />;
}
