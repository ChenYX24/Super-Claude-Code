"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { HookDisplay } from "./setting-row";
import type { ClaudeSettings } from "@/lib/settings-reader";

interface HooksSettingsProps {
  merged: ClaudeSettings;
}

export function HooksSettings({ merged }: HooksSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Hooks
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Shell commands that execute in response to tool lifecycle events.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <HookDisplay
          label="PreToolUse Hook"
          hook={merged.preToolUseHook}
        />
        <HookDisplay
          label="PostToolUse Hook"
          hook={merged.postToolUseHook}
        />
        <HookDisplay label="Stop Hook" hook={merged.stopHook} />
      </CardContent>
    </Card>
  );
}
