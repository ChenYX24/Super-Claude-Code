"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, CheckCircle, XCircle } from "lucide-react";
import { SettingRow } from "./setting-row";
import type { EnvironmentInfo, ClaudeSettings } from "@/lib/settings-reader";

interface ClaudeCliSettingsProps {
  environment: EnvironmentInfo;
  merged: ClaudeSettings;
}

export function ClaudeCliSettings({ environment, merged }: ClaudeCliSettingsProps) {
  const mcpServerCount = merged.mcpServers ? Object.keys(merged.mcpServers).length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Claude Code CLI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Anthropic Claude Code CLI configuration and status.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {environment.claudeInstalled ? (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Installed
              </Badge>
            </div>
            <SettingRow
              label="Config Path"
              value={`${environment.claudeDir}/settings.json`}
            />
            <SettingRow
              label="Claude Directory"
              value={environment.claudeDir}
            />
            <SettingRow
              label="MCP Servers"
              value={String(mcpServerCount)}
            />
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Not Installed
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Install Claude Code CLI:
            </div>
            <code className="block text-xs bg-muted px-3 py-2 rounded-md">
              npm install -g @anthropic-ai/claude-code
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
