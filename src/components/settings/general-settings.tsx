"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/i18n/provider";
import { locales, localeLabels, type Locale } from "@/i18n/config";

interface GeneralSettingsProps {
  defaultModel: string;
  codexDefaultModel: string;
  codexInstalled: boolean;
  theme: string;
  autoUpdate: boolean;
  alwaysThinkingEnabled: boolean;
  onDefaultModelChange: (v: string) => void;
  onCodexDefaultModelChange: (v: string) => void;
  onThemeChange: (v: string) => void;
  onAutoUpdateChange: (v: boolean) => void;
  onThinkingChange: (v: boolean) => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 first:pt-0">
      {children}
    </div>
  );
}

export function GeneralSettings({
  defaultModel,
  codexDefaultModel,
  codexInstalled,
  theme,
  autoUpdate,
  alwaysThinkingEnabled,
  onDefaultModelChange,
  onCodexDefaultModelChange,
  onThemeChange,
  onAutoUpdateChange,
  onThinkingChange,
}: GeneralSettingsProps) {
  const t = useTranslations("settings.general");
  const { locale, setLocale } = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Models Section */}
        <SectionHeader>Models</SectionHeader>

        {/* Claude Default Model */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("defaultModel")}</div>
            <div className="text-xs text-muted-foreground">
              {t("defaultModelDesc")}
            </div>
          </div>
          <Select value={defaultModel} onValueChange={onDefaultModelChange}>
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-opus-4-6">Opus 4.6</SelectItem>
              <SelectItem value="claude-sonnet-4-5-20250929">Sonnet 4.5</SelectItem>
              <SelectItem value="claude-haiku-4-5-20251001">Haiku 4.5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Codex Default Model */}
        {codexInstalled && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Codex Default Model</div>
              <div className="text-xs text-muted-foreground">
                Default model for Codex CLI sessions
              </div>
            </div>
            <Select value={codexDefaultModel} onValueChange={onCodexDefaultModelChange}>
              <SelectTrigger size="sm" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="o3">o3</SelectItem>
                <SelectItem value="o4-mini">o4-mini</SelectItem>
                <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Appearance Section */}
        <SectionHeader>Appearance</SectionHeader>

        {/* Theme */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("theme")}</div>
            <div className="text-xs text-muted-foreground">
              {t("themeDesc")}
            </div>
          </div>
          <Select value={theme} onValueChange={onThemeChange}>
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("language")}</div>
            <div className="text-xs text-muted-foreground">
              {t("languageDesc")}
            </div>
          </div>
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {localeLabels[loc]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Behavior Section */}
        <SectionHeader>Behavior</SectionHeader>

        {/* Auto Update */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("autoUpdate")}</div>
            <div className="text-xs text-muted-foreground">
              {t("autoUpdateDesc")}
            </div>
          </div>
          <Switch checked={autoUpdate} onCheckedChange={onAutoUpdateChange} />
        </div>

        {/* Extended Thinking */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("extendedThinking")}</div>
            <div className="text-xs text-muted-foreground">
              {t("extendedThinkingDesc")}
            </div>
          </div>
          <Switch
            checked={alwaysThinkingEnabled}
            onCheckedChange={onThinkingChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
