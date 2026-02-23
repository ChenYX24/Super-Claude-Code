"use client";

import { useState, useEffect } from "react";
import { Bot, ChevronDown } from "lucide-react";

interface ProviderInfo {
  name: string;
  displayName: string;
  available: boolean;
  capabilities: {
    streaming: boolean;
    thinking: boolean;
    toolUse: boolean;
    models: string[];
  };
}

interface ProviderSelectorProps {
  value: string;
  onChange: (provider: string) => void;
  disabled?: boolean;
}

export function ProviderSelector({ value, onChange, disabled }: ProviderSelectorProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        if (data.providers) setProviders(data.providers);
      })
      .catch(() => {
        // Fallback: show claude as default
        setProviders([
          {
            name: "claude",
            displayName: "Claude Code",
            available: true,
            capabilities: { streaming: true, thinking: true, toolUse: true, models: [] },
          },
        ]);
      });
  }, []);

  const current = providers.find((p) => p.name === value);

  return (
    <div className="relative flex items-center gap-1">
      <Bot className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="text-xs bg-muted border rounded-md px-2 py-1 pr-6 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 cursor-pointer appearance-none"
        title={current ? `${current.displayName} — ${current.available ? "Available" : "Not available"}` : "Select provider"}
      >
        {providers.map((p) => (
          <option key={p.name} value={p.name} disabled={!p.available}>
            {p.displayName}{!p.available ? " (unavailable)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 text-muted-foreground absolute right-1 pointer-events-none" />
    </div>
  );
}
