"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Bot,
  SlidersHorizontal,
  Monitor,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ClaudeSettings, CodexSettings, EnvironmentInfo } from "@/lib/settings-reader";
import { useNotifications } from "@/hooks/use-notifications";
import { GeneralSettings } from "@/components/settings/general-settings";
import { CostAlertSettings } from "@/components/settings/cost-alert-settings";
import { PermissionsSettings } from "@/components/settings/permissions-settings";
import { HooksSettings } from "@/components/settings/hooks-settings";
import { ClaudeCliSettings } from "@/components/settings/claude-cli-settings";
import { CodexSettingsComponent } from "@/components/settings/codex-settings";
import { TelegramSettings } from "@/components/settings/telegram-settings";
import { FeishuSettings } from "@/components/settings/feishu-settings";
import { EnvironmentInfoCard } from "@/components/settings/environment-info";
import { RawConfigPreview } from "@/components/settings/raw-config-preview";

interface SettingsResponse {
  global: ClaudeSettings;
  local: ClaudeSettings;
  merged: ClaudeSettings;
  codex: CodexSettings | null;
  environment: EnvironmentInfo;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const { toast } = useToast();
  const { alertConfig, updateAlertConfig } = useNotifications();
  const tMsg = useTranslations("settings");

  // Editable fields
  const [defaultModel, setDefaultModel] = useState("");
  const [codexDefaultModel, setCodexDefaultModel] = useState("");
  const [theme, setTheme] = useState("");
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [alwaysThinkingEnabled, setAlwaysThinkingEnabled] = useState(true);

  // Cost alert fields
  const [dailyBudget, setDailyBudget] = useState(0);
  const [weeklyBudget, setWeeklyBudget] = useState(0);

  // Track original values to detect changes
  const [originalValues, setOriginalValues] = useState({
    defaultModel: "",
    codexDefaultModel: "",
    theme: "",
    autoUpdate: true,
    alwaysThinkingEnabled: true,
    dailyBudget: 0,
    weeklyBudget: 0,
  });

  const hasChanges =
    defaultModel !== originalValues.defaultModel ||
    codexDefaultModel !== originalValues.codexDefaultModel ||
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

        const model = merged.defaultModel || "claude-sonnet-4-5-20250929";
        const codexModel = merged.codexDefaultModel as string || "o3";
        const themeValue = merged.theme || "system";
        const autoUpdateValue = merged.autoUpdate ?? true;
        const thinkingValue = merged.alwaysThinkingEnabled ?? true;

        setDefaultModel(model);
        setCodexDefaultModel(codexModel);
        setTheme(themeValue);
        setAutoUpdate(autoUpdateValue);
        setAlwaysThinkingEnabled(thinkingValue);

        setOriginalValues({
          defaultModel: model,
          codexDefaultModel: codexModel,
          theme: themeValue,
          autoUpdate: autoUpdateValue,
          alwaysThinkingEnabled: thinkingValue,
          dailyBudget: alertConfig.dailyBudget,
          weeklyBudget: alertConfig.weeklyBudget,
        });
      });
  };

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
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultModel,
          codexDefaultModel,
          theme,
          autoUpdate,
          alwaysThinkingEnabled,
        }),
      });

      const result = await response.json();

      if (result.success) {
        updateAlertConfig({ dailyBudget, weeklyBudget });
        toast(tMsg("savedSuccess"), "success");
        loadSettings();
      } else {
        toast(result.error || tMsg("savedError"), "error");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast(tMsg("savedError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-[180px]" />
                  <Skeleton className="h-9 w-48" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { merged, environment } = data;
  const t = tMsg;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span>{t("unsavedChanges")}</span>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            variant="default"
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="general">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.general")}</span>
          </TabsTrigger>
          <TabsTrigger value="bots">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.bots")}</span>
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.advanced")}</span>
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <GeneralSettings
            defaultModel={defaultModel}
            codexDefaultModel={codexDefaultModel}
            codexInstalled={environment.codexInstalled}
            theme={theme}
            autoUpdate={autoUpdate}
            alwaysThinkingEnabled={alwaysThinkingEnabled}
            onDefaultModelChange={setDefaultModel}
            onCodexDefaultModelChange={setCodexDefaultModel}
            onThemeChange={setTheme}
            onAutoUpdateChange={setAutoUpdate}
            onThinkingChange={setAlwaysThinkingEnabled}
          />
          <CostAlertSettings
            dailyBudget={dailyBudget}
            weeklyBudget={weeklyBudget}
            onDailyBudgetChange={setDailyBudget}
            onWeeklyBudgetChange={setWeeklyBudget}
          />
          <PermissionsSettings merged={merged} />
          <HooksSettings merged={merged} />
        </TabsContent>

        {/* Bots Tab */}
        <TabsContent value="bots" className="space-y-6">
          <TelegramSettings />
          <FeishuSettings />
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <ClaudeCliSettings environment={environment} merged={merged} />
          <CodexSettingsComponent codex={data.codex} />
          <EnvironmentInfoCard environment={environment} />
          <RawConfigPreview
            global={data.global}
            local={data.local}
            codex={data.codex}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
