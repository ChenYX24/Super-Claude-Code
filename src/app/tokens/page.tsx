"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, Info, Database,
} from "lucide-react";

interface TokensData {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCost: number;
  byModel: Record<string, { input: number; output: number; cost: number; sessions: number }>;
  byDate: Record<string, { input: number; output: number; cost: number; sessions: number }>;
  sessionCount: number;
}

function fmtTokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

function fmtCost(n: number): string { return "$" + n.toFixed(2); }

const MODEL_NAMES: Record<string, string> = {
  "claude-opus-4-6": "Opus 4.6",
  "claude-sonnet-4-5": "Sonnet 4.5",
  "claude-haiku-4-5": "Haiku 4.5",
};

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "#6366f1",
  "claude-sonnet-4-5": "#22c55e",
  "claude-haiku-4-5": "#f59e0b",
};

function BarChart({ data }: { data: { label: string; value: number; color: string; extra?: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 0.01);
  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-28 text-xs text-muted-foreground truncate">{item.label}</div>
          <div className="flex-1 h-7 bg-muted/50 rounded overflow-hidden relative">
            <div className="h-full rounded transition-all" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }} />
            <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-mono font-medium">
              {fmtCost(item.value)}
            </span>
          </div>
          {item.extra && <div className="w-20 text-xs text-muted-foreground text-right">{item.extra}</div>}
        </div>
      ))}
    </div>
  );
}

export default function TokensPage() {
  const [data, setData] = useState<TokensData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tokens").then(r => r.json()).then((d: TokensData) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="text-center py-16"><DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h2 className="text-lg">No data</h2></div>;

  const modelData = Object.entries(data.byModel)
    .filter(([, v]) => v.cost > 0)
    .map(([model, stats]) => ({
      label: MODEL_NAMES[model] || model.split("-").slice(-2).join(" "),
      value: stats.cost,
      color: MODEL_COLORS[model] || "#888",
      extra: `${stats.sessions} sessions`,
    }))
    .sort((a, b) => b.value - a.value);

  const dateData = Object.entries(data.byDate)
    .filter(([k]) => k !== "unknown")
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Token Usage & Cost</h1>

      {data.sessionCount === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No session data found</p>
              <p className="text-xs text-amber-600 mt-1">Token data is calculated from session JSONL files in ~/.claude/projects/</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />Total Cost</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-primary">{fmtCost(data.totalCost)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ArrowUpRight className="h-4 w-4" />Input</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtTokens(data.totalInput)}</div>
            <div className="text-xs text-muted-foreground">{fmtCost(data.totalInput * 15 / 1e6)} (Opus rate)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ArrowDownRight className="h-4 w-4" />Output</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtTokens(data.totalOutput)}</div>
            <div className="text-xs text-muted-foreground">{fmtCost(data.totalOutput * 75 / 1e6)} (Opus rate)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Database className="h-4 w-4" />Cache Read</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtTokens(data.totalCacheRead)}</div>
            <div className="text-xs text-muted-foreground">Saved from cache</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Sessions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.sessionCount}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cost by Model */}
        <Card>
          <CardHeader><CardTitle className="text-base">Cost by Model</CardTitle></CardHeader>
          <CardContent>
            {modelData.length > 0 ? <BarChart data={modelData} /> : <div className="text-center text-muted-foreground py-6 text-sm">No data (only first 30 lines of each session are scanned)</div>}
          </CardContent>
        </Card>

        {/* Pricing Reference */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4" />Pricing Reference</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Opus 4.6", input: 15, output: 75, tier: "High", color: "destructive" as const },
                { name: "Sonnet 4.5", input: 3, output: 15, tier: "Mid", color: "secondary" as const },
                { name: "Haiku 4.5", input: 0.8, output: 4, tier: "Low", color: "outline" as const },
              ].map(m => (
                <div key={m.name} className="flex items-center gap-3 text-sm">
                  <span className="w-24 font-mono font-medium">{m.name}</span>
                  <span className="text-muted-foreground">${m.input}/M in</span>
                  <span className="text-muted-foreground">${m.output}/M out</span>
                  <Badge variant={m.color} className="ml-auto text-xs">{m.tier}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-muted/30 rounded text-xs text-muted-foreground">
              <p className="font-medium mb-1">Cost estimation notes:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>Only the first 30 JSONL lines per session are scanned for speed</li>
                <li>Actual cost may be higher for long sessions</li>
                <li>Cache reads reduce real cost but aren&apos;t subtracted here</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Usage */}
      <Card>
        <CardHeader><CardTitle className="text-base">Daily Usage</CardTitle></CardHeader>
        <CardContent>
          {dateData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-right py-2 font-medium">Sessions</th>
                    <th className="text-right py-2 font-medium">Input</th>
                    <th className="text-right py-2 font-medium">Output</th>
                    <th className="text-right py-2 font-medium">Est. Cost</th>
                    <th className="text-right py-2 font-medium w-48">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {dateData.map(([date, stats]) => {
                    const maxCost = Math.max(...dateData.map(([, s]) => s.cost), 0.01);
                    return (
                      <tr key={date} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 font-mono">{date}</td>
                        <td className="text-right py-2">{stats.sessions}</td>
                        <td className="text-right py-2 font-mono">{fmtTokens(stats.input)}</td>
                        <td className="text-right py-2 font-mono">{fmtTokens(stats.output)}</td>
                        <td className="text-right py-2 font-mono font-medium">{fmtCost(stats.cost)}</td>
                        <td className="text-right py-2">
                          <div className="h-4 bg-muted/50 rounded overflow-hidden inline-block w-full">
                            <div className="h-full bg-primary/60 rounded" style={{ width: `${(stats.cost / maxCost) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-6 text-sm">No daily data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
