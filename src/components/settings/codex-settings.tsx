"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, XCircle } from "lucide-react";
import { SettingRow } from "./setting-row";
import type { CodexSettings } from "@/lib/settings-reader";

interface CodexSettingsComponentProps {
  codex: CodexSettings | null;
}

export function CodexSettingsComponent({ codex }: CodexSettingsComponentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Codex CLI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          OpenAI Codex CLI configuration and trusted projects.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {codex ? (
          <>
            <SettingRow label="Installed" value={true} type="boolean" />
            <SettingRow label="Config Path" value="~/.codex/config.toml" />
            {codex.sandbox && (
              <SettingRow label="Sandbox" value={String(codex.sandbox)} />
            )}
            {codex.projects.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Trusted Projects</div>
                <div className="space-y-1">
                  {codex.projects.map((p) => (
                    <div key={p.path} className="flex items-center gap-2">
                      <Badge
                        variant={p.trust_level === "trusted" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {p.trust_level}
                      </Badge>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-md">
                        {p.path}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              Install Codex CLI to enable Codex integration:
            </div>
            <code className="block text-xs bg-muted px-3 py-2 rounded-md">
              npm install -g @openai/codex
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
