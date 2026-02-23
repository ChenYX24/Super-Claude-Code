"use client";

import { Key, Construction } from "lucide-react";

export function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Key className="h-6 w-6" />
          API Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage API keys and provider configurations
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-muted/20">
        <Construction className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Coming Soon</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md text-center">
          This plugin will provide centralized API key management, provider health
          monitoring, and usage analytics across all your AI providers.
        </p>
      </div>
    </div>
  );
}
