"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClaudeSettings, CodexSettings } from "@/lib/settings-reader";

interface RawConfigPreviewProps {
  global: ClaudeSettings;
  local: ClaudeSettings;
  codex: CodexSettings | null;
}

export function RawConfigPreview({ global, local, codex }: RawConfigPreviewProps) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        View Raw Configuration
      </summary>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Global (~/.claude/settings.json)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(global, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Local (~/.claude/settings.local.json)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(local, null, 2)}
            </pre>
          </CardContent>
        </Card>
        {codex && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Codex (~/.codex/config.toml)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                {JSON.stringify(codex, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </details>
  );
}
