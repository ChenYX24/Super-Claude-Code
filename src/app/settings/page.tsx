"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import {
  Settings as SettingsIcon,
  Shield,
  Zap,
  Globe,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Bell,
  DollarSign,
} from "lucide-react";
import type { ClaudeSettings, EnvironmentInfo } from "@/lib/settings-reader";
import { useNotifications } from "@/hooks/use-notifications";

interface SettingsResponse {
  global: ClaudeSettings;
  local: ClaudeSettings;
  merged: ClaudeSettings;
  environment: EnvironmentInfo;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();
  const { alertConfig, updateAlertConfig } = useNotifications();

  // Editable fields
  const [defaultModel, setDefaultModel] = useState("");
  const [theme, setTheme] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [alwaysThinkingEnabled, setAlwaysThinkingEnabled] = useState(true);

  // Cost alert fields
  const [dailyBudget, setDailyBudget] = useState(0);
  const [weeklyBudget, setWeeklyBudget] = useState(0);

  // Track original values to detect changes
  const [originalValues, setOriginalValues] = useState({
    defaultModel: "",
    theme: "",
    autoUpdate: true,
    alwaysThinkingEnabled: true,
    dailyBudget: 0,
    weeklyBudget: 0,
  });

  // Track if there are unsaved changes
  const hasChanges =
    defaultModel !== originalValues.defaultModel ||
    theme !== originalValues.theme ||
    autoUpdate !== originalValues.autoUpdate ||
    alwaysThinkingEnabled !== originalValues.alwaysThinkingEnabled ||
    dailyBudget !== originalValues.dailyBudget ||
    weeklyBudget !== originalValues.weeklyBudget;

  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = () => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((response) => {
        setData(response);
        const merged = response.merged;

        // Initialize editable fields
        const model = merged.defaultModel || "claude-sonnet-4-5-20250929";
        const themeValue = merged.theme || "system";
        const autoUpdateValue = merged.autoUpdate ?? true;
        const thinkingValue = merged.alwaysThinkingEnabled ?? true;

        setDefaultModel(model);
        setTheme(themeValue);
        setAutoUpdate(autoUpdateValue);
        setAlwaysThinkingEnabled(thinkingValue);

        // Store original values
        setOriginalValues({
          defaultModel: model,
          theme: themeValue,
          autoUpdate: autoUpdateValue,
          alwaysThinkingEnabled: thinkingValue,
          dailyBudget: alertConfig.dailyBudget,
          weeklyBudget: alertConfig.weeklyBudget,
        });
      });
  };

  // Load alert config on mount
  useEffect(() => {
    setDailyBudget(alertConfig.dailyBudget);
    setWeeklyBudget(alertConfig.weeklyBudget);
  }, [alertConfig]);

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save Claude settings
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultModel,
          theme,
          autoUpdate,
          alwaysThinkingEnabled,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Save alert config to localStorage
        updateAlertConfig({
          dailyBudget,
          weeklyBudget,
        });

        toast("Settings saved successfully", "success");
        // Reload to get updated values
        loadSettings();
      } else {
        toast(result.error || "Failed to save settings", "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast("Failed to save settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span>Unsaved changes</span>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            variant="default"
            size="sm"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default Model */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-[180px]">
              Default Model
            </div>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="claude-opus-4-6">Opus 4.6</option>
              <option value="claude-sonnet-4-5-20250929">Sonnet 4.5</option>
              <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
            </select>
          </div>

          {/* Theme */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-[180px]">
              Theme
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-muted border border-border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          {/* Auto Update */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-[180px]">
              Auto Update
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoUpdate}
                onChange={(e) => setAutoUpdate(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
              />
              <Badge variant={autoUpdate ? "default" : "secondary"}>
                {autoUpdate ? (
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
            </label>
          </div>

          {/* Extended Thinking Enabled */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-[180px]">
              Extended Thinking Enabled
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alwaysThinkingEnabled}
                onChange={(e) => setAlwaysThinkingEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring"
              />
              <Badge variant={alwaysThinkingEnabled ? "default" : "secondary"}>
                {alwaysThinkingEnabled ? (
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
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Cost Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Cost Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Set budget limits to receive notifications when costs exceed thresholds. Set to 0 to disable.
          </div>

          {/* Daily Budget */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-[180px]">
              Daily Budget
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Number(e.target.value))}
                className="bg-muted border border-border rounded px-3 py-1.5 text-sm font-mono w-32 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">
                {dailyBudget === 0 ? "(disabled)" : "per day"}
              </span>
            </div>
          </div>

          {/* Weekly Budget */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground min-w-[180px]">
              Weekly Budget
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={weeklyBudget}
                onChange={(e) => setWeeklyBudget(Number(e.target.value))}
                className="bg-muted border border-border rounded px-3 py-1.5 text-sm font-mono w-32 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0.00"
              />
              <span className="text-xs text-muted-foreground">
                {weeklyBudget === 0 ? "(disabled)" : "per week"}
              </span>
            </div>
          </div>

          {/* Alert Status */}
          {(dailyBudget > 0 || weeklyBudget > 0) && (
            <div className="mt-4 p-3 bg-muted/50 rounded-md">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Alerts enabled</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    You'll receive notifications when costs exceed your budget limits.
                    Checks run every 60 seconds.
                  </p>
                </div>
              </div>
            </div>
          )}
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
