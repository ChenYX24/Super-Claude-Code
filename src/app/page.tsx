"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ListTodo, CheckCircle, FolderOpen } from "lucide-react";
import Link from "next/link";

interface TeamSummary {
  teams: {
    name: string;
    description: string;
    memberCount: number;
    taskCount: number;
    completedTasks: number;
    activeSince: number;
  }[];
}

export default function HomePage() {
  const [data, setData] = useState<TeamSummary | null>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const totalTeams = data?.teams.length || 0;
  const totalAgents = data?.teams.reduce((s, t) => s + t.memberCount, 0) || 0;
  const totalTasks = data?.teams.reduce((s, t) => s + t.taskCount, 0) || 0;
  const completedTasks =
    data?.teams.reduce((s, t) => s + t.completedTasks, 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      {/* Team List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Active Teams</h2>
        {data && data.teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.teams.map((team) => (
              <Link key={team.name} href="/team">
                <Card className="transition-all hover:shadow-md cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{team.name}</CardTitle>
                      <Badge variant="outline">
                        {team.completedTasks}/{team.taskCount} tasks
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {team.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>
                        <Users className="h-3 w-3 inline mr-1" />
                        {team.memberCount} agents
                      </span>
                      <span>
                        created{" "}
                        {new Date(team.activeSince).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${team.taskCount > 0 ? (team.completedTasks / team.taskCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无活跃 Team。使用 Claude Code 的 TeamCreate 创建一个。
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
