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
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

interface FeishuStatus {
  configured: boolean;
  appId?: string;
  error?: string;
}

interface EnvVar {
  value: string;
  masked: string;
  source: "env.local" | "process";
}

export function FeishuSettings() {
  const [status, setStatus] = useState<FeishuStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Env config state
  const [envVars, setEnvVars] = useState<Record<string, EnvVar>>({});
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [encryptKey, setEncryptKey] = useState("");
  const [allowedChats, setAllowedChats] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);

  useEffect(() => {
    fetch("/api/bot/feishu/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ configured: false, error: "Failed to check" }))
      .finally(() => setLoading(false));
  }, []);

  // Load env vars
  useEffect(() => {
    fetch("/api/env")
      .then((r) => r.json())
      .then((data) => {
        const vars: Record<string, EnvVar> = data.vars || {};
        setEnvVars(vars);
        if (vars.FEISHU_APP_ID) setAppId(vars.FEISHU_APP_ID.value);
        if (vars.FEISHU_APP_SECRET) setAppSecret(vars.FEISHU_APP_SECRET.value);
        if (vars.FEISHU_VERIFICATION_TOKEN) setVerifyToken(vars.FEISHU_VERIFICATION_TOKEN.value);
        if (vars.FEISHU_ENCRYPT_KEY) setEncryptKey(vars.FEISHU_ENCRYPT_KEY.value);
        if (vars.FEISHU_ALLOWED_CHATS) setAllowedChats(vars.FEISHU_ALLOWED_CHATS.value);
      })
      .catch(() => {});
  }, []);

  const handleSaveEnv = async () => {
    setSavingEnv(true);
    try {
      const updates: Record<string, string> = {};
      const check = (key: string, val: string) => {
        if (val !== (envVars[key]?.value || "")) updates[key] = val;
      };
      check("FEISHU_APP_ID", appId);
      check("FEISHU_APP_SECRET", appSecret);
      check("FEISHU_VERIFICATION_TOKEN", verifyToken);
      check("FEISHU_ENCRYPT_KEY", encryptKey);
      check("FEISHU_ALLOWED_CHATS", allowedChats);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Feishu Bot
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect a Feishu (Lark) bot for remote session management and chat.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking Feishu bot status...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {status?.configured ? (
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Configured
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="h-3 w-3 mr-1" />
                Not Configured
              </Badge>
            )}
          </div>
        )}

        {/* Configuration Fields */}
        <div className="space-y-4">
          <div className="text-sm font-medium">Configuration</div>

          {/* App ID */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">App ID</label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="cli_xxxxxxxxxxxx"
            />
          </div>

          {/* App Secret */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">App Secret</label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                className="w-full px-3 py-1.5 pr-10 text-sm font-mono border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Verification Token */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Verification Token <span className="text-xs">(optional)</span></label>
            <input
              type="text"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional verification token"
            />
          </div>

          {/* Encrypt Key */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Encrypt Key <span className="text-xs">(optional)</span></label>
            <input
              type="text"
              value={encryptKey}
              onChange={(e) => setEncryptKey(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional encryption key"
            />
          </div>

          {/* Allowed Chats */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Allowed Chat IDs</label>
            <input
              type="text"
              value={allowedChats}
              onChange={(e) => setAllowedChats(e.target.value)}
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
