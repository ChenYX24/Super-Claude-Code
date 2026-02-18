"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { fmtTokens } from "@/lib/format-utils";
import type { SessionDetail } from "./types";

interface SessionAnalyticsProps {
  detail: SessionDetail;
}

// Custom Tooltip for dark mode support
function ToolTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{payload[0].name}</p>
      <p className="text-sm font-mono font-bold mt-1">{payload[0].value} calls</p>
    </div>
  );
}

// Custom Tooltip for timeline
function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-md">
      <p className="text-sm font-medium font-mono">{label}</p>
      <div className="mt-2 space-y-1">
        <p className="text-xs text-muted-foreground">
          User: <span className="font-mono">{data.userCount}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Assistant: <span className="font-mono">{data.assistantCount}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Tokens: <span className="font-mono">{fmtTokens(data.tokens)}</span>
        </p>
      </div>
    </div>
  );
}

const TOOL_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export function SessionAnalytics({ detail }: SessionAnalyticsProps) {
  // Calculate tool usage statistics
  const toolStats = useMemo(() => {
    const toolCounts: Record<string, number> = {};

    for (const msg of detail.messages) {
      if (msg.toolUse && msg.toolUse.length > 0) {
        for (const tool of msg.toolUse) {
          toolCounts[tool.name] = (toolCounts[tool.name] || 0) + 1;
        }
      }
    }

    return Object.entries(toolCounts)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 tools
  }, [detail.messages]);

  // Calculate message timeline by time buckets (e.g., by hour or by 10-minute intervals)
  const timeline = useMemo(() => {
    if (detail.messages.length === 0) return [];

    // Group messages by time bucket (5-minute intervals)
    const buckets: Record<string, { userCount: number; assistantCount: number; tokens: number }> = {};

    for (const msg of detail.messages) {
      if (!msg.timestamp) continue;

      const date = new Date(msg.timestamp);
      const hour = date.getHours().toString().padStart(2, "0");
      const minute = Math.floor(date.getMinutes() / 5) * 5;
      const minuteStr = minute.toString().padStart(2, "0");
      const bucket = `${hour}:${minuteStr}`;

      if (!buckets[bucket]) {
        buckets[bucket] = { userCount: 0, assistantCount: 0, tokens: 0 };
      }

      if (msg.role === "user") {
        buckets[bucket].userCount++;
      } else if (msg.role === "assistant") {
        buckets[bucket].assistantCount++;
      }

      buckets[bucket].tokens += (msg.inputTokens || 0) + (msg.outputTokens || 0);
    }

    return Object.entries(buckets)
      .map(([time, stats]) => ({
        time,
        userCount: stats.userCount,
        assistantCount: stats.assistantCount,
        tokens: stats.tokens,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [detail.messages]);

  const totalToolCalls = toolStats.reduce((sum, t) => sum + t.value, 0);
  const totalMessages = detail.messages.filter(m => m.role === "user" || m.role === "assistant").length;
  const userMessages = detail.messages.filter(m => m.role === "user").length;
  const assistantMessages = detail.messages.filter(m => m.role === "assistant").length;

  return (
    <div className="space-y-4 p-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMessages}</div>
            <div className="text-xs text-muted-foreground">
              {userMessages} user / {assistantMessages} assistant
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Tool Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalToolCalls}</div>
            <div className="text-xs text-muted-foreground">
              {toolStats.length} unique tools
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tool Usage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tool Usage Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {toolStats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={toolStats}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={(props: PieLabelRenderProps) => {
                      const percent = ((props.percent ?? 0) as number) * 100;
                      return percent > 5 ? `${props.name ?? ""} ${percent.toFixed(0)}%` : "";
                    }}
                    labelLine={{ stroke: "hsl(var(--foreground))", strokeWidth: 1 }}
                  >
                    {toolStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TOOL_COLORS[index % TOOL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ToolTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Tool list */}
              <div className="mt-3 space-y-1.5 max-h-32 overflow-auto">
                {toolStats.map((tool, i) => (
                  <div key={tool.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: TOOL_COLORS[i % TOOL_COLORS.length] }}
                    />
                    <span className="font-mono flex-1 truncate">{tool.name}</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {tool.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-6 text-sm">
              No tool usage data
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Message Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip content={<TimelineTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  iconSize={10}
                />
                <Bar
                  dataKey="userCount"
                  name="User"
                  fill="#6366f1"
                  stackId="messages"
                />
                <Bar
                  dataKey="assistantCount"
                  name="Assistant"
                  fill="#22c55e"
                  stackId="messages"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-muted-foreground py-6 text-sm">
              No timeline data
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
