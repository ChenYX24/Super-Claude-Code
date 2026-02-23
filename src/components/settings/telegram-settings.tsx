"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import {
  MessageCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Save,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface BotStatus {
  configured: boolean;
  url: string | null;
  pendingUpdateCount?: number;
  lastErrorMessage?: string | null;
  error?: string;
}

interface EnvVar {
  value: string;
  masked: string;
  source: "env.local" | "process";
}

export function TelegramSettings() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botLoading, setBotLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookAutoFilled, setWebhookAutoFilled] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { toast } = useToast();

  // Env config state
  const [envVars, setEnvVars] = useState<Record<string, EnvVar>>({});
  const [tokenInput, setTokenInput] = useState("");
  const [chatIdsInput, setChatIdsInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);

  // Load bot status + auto-fill webhook from SCC_BASE_URL
  useEffect(() => {
    const loadBotAndEnv = async () => {
      try {
        const [botRes, envRes] = await Promise.all([
          fetch("/api/bot/telegram/setup").then((r) => r.json()),
          fetch("/api/env").then((r) => r.json()),
        ]);

        setBotStatus(botRes);
        const vars = envRes.vars || {};
        setEnvVars(vars);

        if (vars.TELEGRAM_BOT_TOKEN) setTokenInput(vars.TELEGRAM_BOT_TOKEN.value);
        if (vars.TELEGRAM_CHAT_IDS) setChatIdsInput(vars.TELEGRAM_CHAT_IDS.value);

        // Auto-fill webhook URL: use existing URL, or preset from SCC_BASE_URL
        if (botRes.url) {
          setWebhookUrl(botRes.url);
        } else if (vars.SCC_BASE_URL) {
          const presetUrl = `${vars.SCC_BASE_URL.value}/api/bot/telegram`;
          setWebhookUrl(presetUrl);
          setWebhookAutoFilled(true);
        }
      } catch {
        setBotStatus({ configured: false, url: null, error: "Failed to connect" });
      } finally {
        setBotLoading(false);
      }
    };
    loadBotAndEnv();
  }, []);

  const handleSetWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast("Please enter a webhook URL", "error");
      return;
    }
    setSettingWebhook(true);
    try {
      const res = await fetch("/api/bot/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("Webhook set successfully", "success");
        setBotStatus({
          configured: true,
          url: webhookUrl.trim(),
          pendingUpdateCount: 0,
          lastErrorMessage: null,
        });
      } else {
        toast(data.error || "Failed to set webhook", "error");
      }
    } catch {
      toast("Failed to set webhook", "error");
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingSend(true);
    try {
      const res = await fetch("/api/bot/telegram/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("Test message sent successfully!", "success");
      } else {
        toast(data.error || "Failed to send test message", "error");
      }
    } catch {
      toast("Failed to send test message", "error");
    } finally {
      setTestingSend(false);
    }
  };

  const handleSaveEnv = async () => {
    setSavingEnv(true);
    try {
      const updates: Record<string, string> = {};
      if (tokenInput !== (envVars.TELEGRAM_BOT_TOKEN?.value || "")) {
        updates.TELEGRAM_BOT_TOKEN = tokenInput;
      }
      if (chatIdsInput !== (envVars.TELEGRAM_CHAT_IDS?.value || "")) {
        updates.TELEGRAM_CHAT_IDS = chatIdsInput;
      }

      if (Object.keys(updates).length === 0) {
        toast("No changes to save", "info");
        setSavingEnv(false);
        return;
      }

      const res = await fetch("/api/env", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("Saved! Restart server to apply changes.", "success");
      } else {
        toast(data.error || "Failed to save", "error");
      }
    } catch {
      toast("Failed to save env vars", "error");
    } finally {
      setSavingEnv(false);
    }
  };

  const isTokenConfigured = !!envVars.TELEGRAM_BOT_TOKEN || botStatus?.error !== "TELEGRAM_BOT_TOKEN not configured";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Telegram Bot
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect a Telegram bot for remote session management and chat.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Configuration */}
        <div className="space-y-4">
          <div className="text-sm font-medium">Configuration</div>

          {/* Bot Token */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Bot Token</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? "text" : "password"}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-3 py-1.5 pr-10 text-sm font-mono border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="123456:ABC-DEF..."
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {envVars.TELEGRAM_BOT_TOKEN && (
              <div className="text-xs text-muted-foreground">
                Source: {envVars.TELEGRAM_BOT_TOKEN.source}
              </div>
            )}
          </div>

          {/* Chat IDs */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Allowed Chat IDs</label>
            <input
              type="text"
              value={chatIdsInput}
              onChange={(e) => setChatIdsInput(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Comma-separated chat IDs (empty = allow all)"
            />
          </div>

          {/* Save button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveEnv}
            disabled={savingEnv}
          >
            {savingEnv ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save to .env.local
          </Button>
        </div>

        {/* Status */}
        {botLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking bot status...
          </div>
        ) : isTokenConfigured ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Token Configured
              </Badge>
              {botStatus?.configured && botStatus.url && (
                <Badge variant="default">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Webhook Active
                </Badge>
              )}
            </div>

            {botStatus?.url && (
              <div className="bg-muted/50 rounded-md p-3 space-y-1">
                <div className="text-xs font-medium">Current Webhook</div>
                <code className="text-xs break-all">{botStatus.url}</code>
                {botStatus.pendingUpdateCount !== undefined &&
                  botStatus.pendingUpdateCount > 0 && (
                    <div className="text-xs text-amber-600 mt-1">
                      {botStatus.pendingUpdateCount} pending update(s)
                    </div>
                  )}
                {botStatus.lastErrorMessage && (
                  <div className="text-xs text-red-500 mt-1">
                    Last error: {botStatus.lastErrorMessage}
                  </div>
                )}
              </div>
            )}

            {/* Set/Update Webhook */}
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {botStatus?.url ? "Update" : "Set"} Webhook URL
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => {
                    setWebhookUrl(e.target.value);
                    setWebhookAutoFilled(false);
                  }}
                  className="flex-1 px-3 py-1.5 text-sm font-mono border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="https://your-domain.com/api/bot/telegram"
                />
                <Button
                  size="sm"
                  onClick={handleSetWebhook}
                  disabled={settingWebhook || !webhookUrl.trim()}
                >
                  {settingWebhook ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Setting...
                    </>
                  ) : (
                    "Set Webhook"
                  )}
                </Button>
              </div>
              {webhookAutoFilled && (
                <div className="text-xs text-muted-foreground">
                  Auto-filled from SCC_BASE_URL
                </div>
              )}
            </div>

            {/* Test Connection */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingSend || !botStatus?.configured}
            >
              {testingSend ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1" />
              )}
              Test Connection
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <XCircle className="h-3 w-3 mr-1" />
              Not Active
            </Badge>
            <span className="text-xs text-muted-foreground">
              Configure and save token above, then restart server.
            </span>
          </div>
        )}

        {/* Setup Guide */}
        <div className="space-y-2">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1 text-sm font-medium hover:text-foreground transition-colors"
          >
            {showGuide ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Setup Guide
          </button>
          {showGuide && (
            <div className="bg-muted/50 rounded-md p-3 space-y-2 text-xs text-muted-foreground">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Create a bot via <code className="bg-muted px-1 rounded">@BotFather</code> on Telegram</li>
                <li>Copy the bot token and paste it above</li>
                <li>Set webhook URL to <code className="bg-muted px-1 rounded">https://your-domain/api/bot/telegram</code></li>
                <li>Get your chat ID by messaging <code className="bg-muted px-1 rounded">@userinfobot</code></li>
                <li>Add chat ID above (optional, leave empty to allow all)</li>
                <li>Save to .env.local and restart the server</li>
                <li>Click &quot;Test Connection&quot; to verify</li>
              </ol>
            </div>
          )}
        </div>

        {/* Supported Commands */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Supported Commands</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { cmd: "/help", desc: "Show available commands" },
              { cmd: "/sessions", desc: "List active sessions" },
              { cmd: "/status", desc: "Dashboard status overview" },
              { cmd: "/chat", desc: "Chat with Claude session" },
              { cmd: "/bg", desc: "Run background task" },
              { cmd: "/queue", desc: "View task queue" },
            ].map((item) => (
              <div
                key={item.cmd}
                className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5"
              >
                <code className="font-mono font-medium text-primary">
                  {item.cmd}
                </code>
                <span className="text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
