"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Eye, EyeOff } from "lucide-react";
import { SettingRow } from "./setting-row";
import type { EnvironmentInfo as EnvInfoType } from "@/lib/settings-reader";

interface EnvironmentInfoProps {
  environment: EnvInfoType;
}

export function EnvironmentInfoCard({ environment }: EnvironmentInfoProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Environment
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          System information and runtime environment details.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <SettingRow label="Platform" value={environment.platform} />
        <SettingRow label="Node Version" value={environment.nodeVersion} />
        <SettingRow label="Home Directory" value={environment.homeDir} />
        <SettingRow label="Claude Directory" value={environment.claudeDir} />
        <SettingRow
          label="Codex Installed"
          value={environment.codexInstalled}
          type="boolean"
        />
        <SettingRow
          label="API Key Configured"
          value={environment.hasApiKey}
          type="boolean"
        />
        {environment.hasApiKey && environment.apiKeyMasked && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-[180px]">
              API Key
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {showApiKey ? environment.apiKeyMasked : "••••••••••••"}
              </code>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}
        {environment.proxyUrl && (
          <SettingRow label="Proxy" value={environment.proxyUrl} />
        )}
      </CardContent>
    </Card>
  );
}
