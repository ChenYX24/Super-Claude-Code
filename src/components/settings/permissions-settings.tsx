"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, XCircle } from "lucide-react";
import { SettingRow } from "./setting-row";
import type { ClaudeSettings } from "@/lib/settings-reader";

interface PermissionsSettingsProps {
  merged: ClaudeSettings;
}

export function PermissionsSettings({ merged }: PermissionsSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permissions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tool access controls and auto-approval settings.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <SettingRow
          label="Auto Approve Tools"
          value={merged.permissions?.autoApprove ?? false}
          type="boolean"
        />
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Allowed Tools</div>
          <div className="flex flex-wrap gap-2">
            {merged.permissions?.allowedTools &&
            merged.permissions.allowedTools.length > 0 ? (
              merged.permissions.allowedTools.map((tool) => (
                <Badge key={tool} variant="secondary">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  {tool}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                All tools allowed (default)
              </span>
            )}
          </div>
        </div>
        {merged.permissions?.deniedTools &&
          merged.permissions.deniedTools.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Denied Tools</div>
              <div className="flex flex-wrap gap-2">
                {merged.permissions.deniedTools.map((tool) => (
                  <Badge key={tool} variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
