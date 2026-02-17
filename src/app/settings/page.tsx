"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon,
  Shield,
  Zap,
  Globe,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ClaudeSettings, EnvironmentInfo } from "@/lib/settings-reader";

interface SettingsResponse {
  global: ClaudeSettings;
  local: ClaudeSettings;
  merged: ClaudeSettings;
  environment: EnvironmentInfo;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading settings...
          </CardContent>
        </Card>
      </div>
    );
  }

  const { merged, environment } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            label="Default Model"
            value={merged.defaultModel || "claude-sonnet-4-5"}
          />
          <SettingRow
            label="Theme"
            value={merged.theme || "system"}
          />
          <SettingRow
            label="Auto Update"
            value={merged.autoUpdate ?? true}
            type="boolean"
          />
          <SettingRow
            label="Extended Thinking Enabled"
            value={merged.alwaysThinkingEnabled ?? true}
            type="boolean"
          />
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissions
          </CardTitle>
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

      {/* Hooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Hooks
          </CardTitle>
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

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Environment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow label="Platform" value={environment.platform} />
          <SettingRow label="Node Version" value={environment.nodeVersion} />
          <SettingRow label="Home Directory" value={environment.homeDir} />
          <SettingRow label="Claude Directory" value={environment.claudeDir} />
          <SettingRow
            label="API Key Configured"
            value={environment.hasApiKey}
            type="boolean"
          />
          {environment.hasApiKey && environment.apiKeyMasked && (
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground min-w-[150px]">
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

      {/* Raw Config Preview */}
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
                {JSON.stringify(data.global, null, 2)}
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
                {JSON.stringify(data.local, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
}

// ---- Helper Components ----

function SettingRow({
  label,
  value,
  type = "string",
}: {
  label: string;
  value: string | boolean | number | undefined;
  type?: "string" | "boolean" | "number";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-muted-foreground min-w-[180px]">{label}</div>
      <div>
        {type === "boolean" ? (
          <Badge variant={value ? "default" : "secondary"}>
            {value ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Disabled
              </>
            )}
          </Badge>
        ) : (
          <code className="text-sm bg-muted px-2 py-1 rounded">
            {String(value || "—")}
          </code>
        )}
      </div>
    </div>
  );
}

function HookDisplay({
  label,
  hook,
}: {
  label: string;
  hook?: { command: string; description?: string };
}) {
  if (!hook) {
    return (
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Not Configured
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="space-y-1">
        <Badge variant="default">
          <CheckCircle className="h-3 w-3 mr-1" />
          Configured
        </Badge>
        <code className="block text-xs bg-muted p-2 rounded mt-1">
          {hook.command}
        </code>
        {hook.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {hook.description}
          </p>
        )}
      </div>
    </div>
  );
}
