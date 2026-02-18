"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, ListTodo, CheckCircle, FolderOpen, Cpu, Clock,
  ArrowRight, Wrench, FileEdit, Coins, Zap, Activity,
} from "lucide-react";
import Link from "next/link";
import { fmtCost, fmtTokens, timeAgo, shortModel } from "@/lib/format-utils";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

// ---- Types ----

interface TeamSummary {
  teams: {
    name: string;
    description: string;
    memberCount: number;
    taskCount: number;
    completedTasks: number;
    activeSince: number;
    leadSessionId?: string;
  }[];
}

interface ProcessInfo {
  pid: number;
  name: string;
  startTime: string;
  memoryMB: number;
  command?: string;
}

interface SessionInfo {
  id: string;
  project: string;
  projectName: string;
  startTime: number;
  lastActive: number;
  messageCount: number;
  firstMessage?: string;
  model?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  status?: string;
}

interface SessionsData {
  totalSessions: number;
  recentSessions: SessionInfo[];
}

interface TokensData {
  byDate: Record<string, { input: number; output: number; cost: number; sessions: number }>;
}

// ---- Helpers ----

type SessionStatus = "reading" | "thinking" | "writing" | "waiting" | "completed" | "error" | "idle";

const STATUS_DOTS: Record<SessionStatus, string> = {
  reading: "bg-cyan-400",
  thinking: "bg-orange-400",
  writing: "bg-purple-400",
  waiting: "bg-yellow-400",
  completed: "bg-green-400",
  error: "bg-red-500",
  idle: "bg-zinc-500",
};

// ---- Main ----

export default function HomePage() {
  const [teams, setTeams] = useState<TeamSummary | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [sessions, setSessions] = useState<SessionsData | null>(null);
  const [tokensData, setTokensData] = useState<TokensData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()).then(setTeams).catch(() => {}),
      fetch("/api/processes").then((r) => r.json()).then((d) => setProcesses(d.processes || [])).catch(() => {}),
      fetch("/api/sessions").then((r) => r.json()).then(setSessions).catch(() => {}),
      fetch("/api/tokens").then((r) => r.json()).then(setTokensData).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const totalTeams = teams?.teams.length || 0;
  const totalAgents = teams?.teams.reduce((s, t) => s + t.memberCount, 0) || 0;
  const totalTasks = teams?.teams.reduce((s, t) => s + t.taskCount, 0) || 0;
  const completedTasks = teams?.teams.reduce((s, t) => s + t.completedTasks, 0) || 0;

  const recentSessions = sessions?.recentSessions.slice(0, 5) || [];
  const totalCost = sessions?.recentSessions.reduce((s, x) => s + x.estimatedCost, 0) || 0;
  const totalInputTokens = sessions?.recentSessions.reduce((s, x) => s + x.totalInputTokens, 0) || 0;
  const totalOutputTokens = sessions?.recentSessions.reduce((s, x) => s + x.totalOutputTokens, 0) || 0;

  // Prepare sparkline data (last 7 days)
  const sparklineData = tokensData
    ? Object.entries(tokensData.byDate)
        .filter(([k]) => k !== "unknown")
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7)
        .map(([date, stats]) => ({ cost: stats.cost }))
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Processes Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Token Usage Summary Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="text-center">
                    <Skeleton className="h-3 w-20 mx-auto mb-1" />
                    <Skeleton className="h-6 w-24 mx-auto" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-16 w-full mb-4" />
              <Skeleton className="h-5 w-full" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Teams Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTeams}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalAgents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ListTodo className="h-4 w-4" /> Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4" /> Processes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{processes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Coins className="h-4 w-4" /> Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmtCost(totalCost)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Processes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Active Processes
              </CardTitle>
              {processes.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />{processes.length} running
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {processes.length > 0 ? (
              <div className="space-y-2">
                {processes.map((p) => (
                  <div key={p.pid} className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-mono text-xs">{p.name}</span>
                      <span className="text-xs text-muted-foreground">PID {p.pid}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.memoryMB}MB</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No active Claude processes detected</p>
            )}
          </CardContent>
        </Card>

        {/* Token Usage Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4" /> Token Usage Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Input Tokens</div>
                <div className="text-lg font-bold font-mono">{fmtTokens(totalInputTokens)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Output Tokens</div>
                <div className="text-lg font-bold font-mono">{fmtTokens(totalOutputTokens)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Total Sessions</div>
                <div className="text-lg font-bold font-mono">{sessions?.totalSessions || 0}</div>
              </div>
            </div>
            {sparklineData.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1">Daily Cost Trend (7 days)</div>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={sparklineData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="miniCostGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      fill="url(#miniCostGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Total Cost</span>
                <span className="font-bold font-mono">{fmtCost(totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Recent Sessions
            </CardTitle>
            <Link href="/sessions">
              <Button variant="ghost" size="sm" className="text-xs">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentSessions.length > 0 ? (
            <div className="space-y-1.5">
              {recentSessions.map((s) => {
                const status = (s.status || "idle") as SessionStatus;
                const dot = STATUS_DOTS[status] || STATUS_DOTS.idle;
                return (
                  <Link key={`${s.project}-${s.id}`} href={`/sessions?session=${s.id}`}>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{s.firstMessage || s.id.slice(0, 12)}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.projectName}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {s.model && <Badge variant="secondary" className="text-[10px] h-4">{shortModel(s.model)}</Badge>}
                        <span className="text-xs text-muted-foreground">{timeAgo(s.lastActive)}</span>
                        <span className="text-xs font-mono text-muted-foreground">{fmtCost(s.estimatedCost)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No sessions found</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions + Active Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/sessions">
                <Button variant="outline" className="w-full justify-start gap-2 h-10">
                  <Clock className="h-4 w-4" /> Sessions
                </Button>
              </Link>
              <Link href="/toolbox">
                <Button variant="outline" className="w-full justify-start gap-2 h-10">
                  <Wrench className="h-4 w-4" /> Toolbox
                </Button>
              </Link>
              <Link href="/editor">
                <Button variant="outline" className="w-full justify-start gap-2 h-10">
                  <FileEdit className="h-4 w-4" /> CLAUDE.md
                </Button>
              </Link>
              <Link href="/tokens">
                <Button variant="outline" className="w-full justify-start gap-2 h-10">
                  <Coins className="h-4 w-4" /> Tokens
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Active Teams */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Active Teams
              </CardTitle>
              <Link href="/team">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {teams && teams.teams.length > 0 ? (
              <div className="space-y-2">
                {teams.teams.slice(0, 3).map((team) => (
                  <Link key={team.name} href={`/team?name=${encodeURIComponent(team.name)}`}>
                    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="text-sm font-medium">{team.name}</div>
                        <div className="text-xs text-muted-foreground">{team.memberCount} agents</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {team.completedTasks}/{team.taskCount} tasks
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No active teams</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
