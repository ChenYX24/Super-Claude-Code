"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, Info, Database, Download,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { fmtCost, fmtTokens } from "@/lib/format-utils";
import { useToast } from "@/components/toast";

interface TokensData {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCost: number;
  byModel: Record<string, { input: number; output: number; cost: number; sessions: number }>;
  byDate: Record<string, { input: number; output: number; cost: number; sessions: number }>;
  sessionCount: number;
}

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

// Custom Tooltip for dark mode support
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{payload[0].name}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {payload[0].payload.sessions} sessions
      </p>
      <p className="text-sm font-mono font-bold mt-1">{fmtCost(payload[0].value)}</p>
    </div>
  );
}

// Custom Tooltip for AreaChart
function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-md">
      <p className="text-sm font-medium font-mono">{label}</p>
      <div className="mt-2 space-y-1">
        <p className="text-xs text-muted-foreground">
          Sessions: <span className="font-mono">{data.sessions}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Input: <span className="font-mono">{fmtTokens(data.input)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Output: <span className="font-mono">{fmtTokens(data.output)}</span>
        </p>
        <p className="text-sm font-mono font-bold mt-1">{fmtCost(data.cost)}</p>
      </div>
    </div>
  );
}

type TimeRange = "7d" | "14d" | "30d" | "all";
type ViewMode = "chart" | "table";

export default function TokensPage() {
  const [data, setData] = useState<TokensData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("14d");
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 10;
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/tokens").then(r => r.json()).then((d: TokensData) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleExport = (type: "detail" | "summary") => {
    const url = `/api/tokens/export?type=${type}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `claude-tokens-${type}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`Token ${type} CSV exported`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Token Usage & Cost</h1>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cost by Model Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>

          {/* Pricing Reference Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
              <Skeleton className="h-20 w-full mt-4" />
            </CardContent>
          </Card>
        </div>

        {/* Daily Usage Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return <div className="text-center py-16"><DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h2 className="text-lg">No data</h2></div>;

  // Prepare model data for PieChart
  const modelData = Object.entries(data.byModel)
    .filter(([, v]) => v.cost > 0)
    .map(([model, stats]) => ({
      name: MODEL_NAMES[model] || model.split("-").slice(-2).join(" "),
      value: stats.cost,
      color: MODEL_COLORS[model] || "#888",
      sessions: stats.sessions,
    }))
    .sort((a, b) => b.value - a.value);

  // Prepare date data for AreaChart (chronological order)
  const allDateData = Object.entries(data.byDate)
    .filter(([k]) => k !== "unknown")
    .sort((a, b) => a[0].localeCompare(b[0])) // Chronological order
    .map(([date, stats]) => ({
      date,
      cost: stats.cost,
      input: stats.input,
      output: stats.output,
      sessions: stats.sessions,
    }));

  // Filter by time range
  const dateData =
    timeRange === "all"
      ? allDateData
      : timeRange === "30d"
      ? allDateData.slice(-30)
      : timeRange === "14d"
      ? allDateData.slice(-14)
      : allDateData.slice(-7);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Token Usage & Cost</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("detail")}>
            <Download className="h-4 w-4 mr-2" />
            Export Detail CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("summary")}>
            <Download className="h-4 w-4 mr-2" />
            Export Summary CSV
          </Button>
        </div>
      </div>

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
        {/* Cost by Model - PieChart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Cost by Model</CardTitle></CardHeader>
          <CardContent>
            {modelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={modelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={(props: PieLabelRenderProps) => `${props.name ?? ""} ${(((props.percent ?? 0) as number) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "hsl(var(--foreground))", strokeWidth: 1 }}
                  >
                    {modelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-6 text-sm">No data (only first 30 lines of each session are scanned)</div>
            )}
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

      {/* Daily Usage - AreaChart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Daily Cost Trend</CardTitle>
            <div className="flex items-center gap-2">
              {/* Time Range Selector */}
              <div className="flex border rounded-md">
                {(["7d", "14d", "30d", "all"] as TimeRange[]).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2 rounded-none first:rounded-l-md last:rounded-r-md"
                    onClick={() => { setTimeRange(range); setTablePage(0); }}
                  >
                    {range === "all" ? "All" : range.toUpperCase()}
                  </Button>
                ))}
              </div>
              {/* Chart/Table Toggle */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "chart" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-2 rounded-l-md rounded-r-none"
                  onClick={() => setViewMode("chart")}
                >
                  Chart
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-2 rounded-r-md rounded-l-none"
                  onClick={() => setViewMode("table")}
                >
                  Table
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dateData.length > 0 ? (
            viewMode === "chart" ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={dateData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    tickFormatter={(v) => fmtCost(v)}
                  />
                  <Tooltip content={<DailyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#costGradient)"
                    animationDuration={800}
                  />
                  <Brush
                    dataKey="date"
                    height={30}
                    stroke="hsl(var(--border))"
                    fill="hsl(var(--muted))"
                    travellerWidth={8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div>
                {(() => {
                  const totalPages = Math.ceil(dateData.length / TABLE_PAGE_SIZE);
                  const safePage = Math.min(tablePage, totalPages - 1);
                  const pageData = dateData.slice(safePage * TABLE_PAGE_SIZE, (safePage + 1) * TABLE_PAGE_SIZE);
                  return (
                    <>
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 border-b">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sessions</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Input</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Output</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pageData.map((row) => (
                            <tr key={row.date} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2 px-3 font-mono text-xs">{row.date}</td>
                              <td className="py-2 px-3 text-right font-mono">{row.sessions}</td>
                              <td className="py-2 px-3 text-right font-mono">{fmtTokens(row.input)}</td>
                              <td className="py-2 px-3 text-right font-mono">{fmtTokens(row.output)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">{fmtCost(row.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t mt-2">
                          <span className="text-xs text-muted-foreground">
                            {safePage * TABLE_PAGE_SIZE + 1}-{Math.min((safePage + 1) * TABLE_PAGE_SIZE, dateData.length)} of {dateData.length} days
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={safePage === 0}
                              onClick={() => setTablePage(safePage - 1)}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            {Array.from({ length: totalPages }, (_, i) => (
                              <Button
                                key={i}
                                variant={i === safePage ? "default" : "outline"}
                                size="sm"
                                className="h-7 w-7 p-0 text-xs"
                                onClick={() => setTablePage(i)}
                              >
                                {i + 1}
                              </Button>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={safePage >= totalPages - 1}
                              onClick={() => setTablePage(safePage + 1)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )
          ) : (
            <div className="text-center text-muted-foreground py-6 text-sm">No daily data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
