"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import {
  Users,
  MessageSquare,
  ListTodo,
  RefreshCw,
  Bot,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Crown,
  Search,
  Microscope,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---- Types ----

interface TeamMember {
  name: string;
  agentId: string;
  agentType: string;
  model: string;
  color?: string;
}

interface TaskItem {
  id: string;
  subject: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  owner?: string;
  activeForm?: string;
  blockedBy?: string[];
  blocks?: string[];
}

interface TeamMessage {
  from: string;
  to?: string;
  text: string;
  summary?: string;
  timestamp: string;
}

interface TeamData {
  config: { name: string; description: string; createdAt: number; members: TeamMember[] };
  tasks: TaskItem[];
  messages: TeamMessage[];
  memberStatus: Record<string, "working" | "idle" | "completed">;
}

interface TeamSummary {
  teams: { name: string; memberCount: number; taskCount: number; completedTasks: number }[];
}

// ---- Helpers ----

function formatTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function shortModel(model: string) {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

// Agent type → icon + color
const AGENT_STYLES: Record<string, { icon: typeof Bot; color: string; bg: string }> = {
  "team-lead": { icon: Crown, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/40" },
  "general-purpose": { icon: Cpu, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/40" },
  "researcher": { icon: Search, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/40" },
  "Explore": { icon: Microscope, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/40" },
};

function getAgentStyle(agentType: string, name: string) {
  if (name.includes("lead")) return AGENT_STYLES["team-lead"];
  if (name.includes("research")) return AGENT_STYLES["researcher"] || AGENT_STYLES["general-purpose"];
  return AGENT_STYLES[agentType] || AGENT_STYLES["general-purpose"];
}

const STATUS_DOT = {
  working: "bg-green-500 animate-pulse",
  idle: "bg-gray-400",
  completed: "bg-blue-500",
};

// ---- Components ----

function AgentItem({
  member, status, currentTask, isSelected, onClick, messageCount,
}: {
  member: TeamMember;
  status: "working" | "idle" | "completed";
  currentTask?: string;
  isSelected: boolean;
  onClick: () => void;
  messageCount: number;
}) {
  const style = getAgentStyle(member.agentType, member.name);
  const Icon = style.icon;

  return (
    <div
      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
        isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"
      }`}
      onClick={onClick}
    >
      <div className="relative flex-shrink-0">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${style.bg}`}>
          <Icon className={`h-4 w-4 ${style.color}`} />
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${STATUS_DOT[status]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{member.name}</div>
        <div className="text-xs text-muted-foreground">
          {shortModel(member.model)}
          {status === "working" && currentTask && (
            <span className="text-blue-500 ml-1">· {currentTask.slice(0, 20)}</span>
          )}
        </div>
      </div>
      {messageCount > 0 && (
        <Badge variant="secondary" className="text-xs h-5 min-w-5 justify-center">
          {messageCount}
        </Badge>
      )}
    </div>
  );
}

function MessageBubble({ msg, isExpanded, onToggle }: {
  msg: TeamMessage; isExpanded: boolean; onToggle: () => void;
}) {
  const style = getAgentStyle("", msg.from);
  const Icon = style.icon;
  const isLong = msg.text.length > 300;

  return (
    <div className="flex gap-3 py-3 px-4 hover:bg-muted/20 transition-colors">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg}`}>
        <Icon className={`h-4 w-4 ${style.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">{msg.from}</span>
          {msg.to && (
            <>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{msg.to}</span>
            </>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{formatTime(msg.timestamp)}</span>
        </div>
        {msg.summary && (
          <div className="text-xs font-medium text-primary/80 mb-1.5 px-2 py-1 bg-primary/5 rounded inline-block">
            {msg.summary}
          </div>
        )}
        <div className={!isExpanded && isLong ? "max-h-32 overflow-hidden relative" : ""}>
          <MarkdownContent content={msg.text} className="text-sm" />
          {!isExpanded && isLong && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
          )}
        </div>
        {isLong && (
          <button onClick={onToggle} className="text-xs text-primary hover:underline mt-1 flex items-center gap-1">
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {isExpanded ? "Collapse" : `Expand (${Math.ceil(msg.text.length / 100)} paragraphs)`}
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, isExpanded, onToggle }: {
  task: TaskItem; isExpanded: boolean; onToggle: () => void;
}) {
  const statusStyle = {
    pending: "border-l-gray-400",
    in_progress: "border-l-blue-500",
    completed: "border-l-green-500",
  }[task.status];

  return (
    <div
      className={`border rounded-lg border-l-4 ${statusStyle} p-3 cursor-pointer hover:shadow-sm transition-all bg-card`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">#{task.id} {task.subject}</div>
          {task.owner && (
            <Badge variant="outline" className="text-xs mt-1">{task.owner}</Badge>
          )}
          {task.activeForm && task.status === "in_progress" && (
            <div className="text-xs text-blue-500 mt-1 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />{task.activeForm}
            </div>
          )}
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5" /> : <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />}
      </div>
      {isExpanded && (
        <div className="mt-2 pt-2 border-t space-y-2">
          {task.description && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</div>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {task.blockedBy && task.blockedBy.length > 0 && (
              <span className="text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                Blocked by: {task.blockedBy.join(", ")}
              </span>
            )}
            {task.blocks && task.blocks.length > 0 && (
              <span className="text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                Blocks: {task.blocks.join(", ")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

export default function TeamPage() {
  const [teamList, setTeamList] = useState<TeamSummary | null>(null);
  const [activeTeam, setActiveTeam] = useState("");
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [expandedMsgs, setExpandedMsgs] = useState<Set<number>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">("chat");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/teams").then(r => r.json()).then((d: TeamSummary) => {
      setTeamList(d);
      if (d.teams.length > 0 && !activeTeam) setActiveTeam(d.teams[0].name);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    const load = () => {
      fetch(`/api/teams/${activeTeam}`).then(r => r.json()).then(d => {
        if (d && !d.error) setTeamData(d);
      }).catch(() => {});
    };
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [activeTeam]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [teamData?.messages?.length]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!teamList || teamList.teams.length === 0) return (
    <div className="text-center py-16">
      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-lg font-medium">No Active Teams</h2>
      <p className="text-muted-foreground mt-1">Use TeamCreate in Claude Code to start one</p>
    </div>
  );

  const tasks = teamData?.tasks || [];
  const messages = teamData?.messages || [];
  const members = teamData?.config?.members || [];
  const memberStatus = teamData?.memberStatus || {};

  // Count messages per agent
  const msgCount: Record<string, number> = {};
  for (const m of messages) {
    msgCount[m.from] = (msgCount[m.from] || 0) + 1;
    if (m.to) msgCount[m.to] = (msgCount[m.to] || 0) + 1;
  }

  const filteredMsgs = selectedAgent
    ? messages.filter(m => m.from === selectedAgent || m.to === selectedAgent)
    : messages;

  const completedCount = tasks.filter(t => t.status === "completed").length;

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left sidebar */}
      <div className="w-60 border-r flex flex-col bg-muted/5">
        {/* Team tabs */}
        <div className="p-2 border-b">
          <div className="flex gap-1">
            {teamList.teams.map(t => (
              <button
                key={t.name}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTeam === t.name
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => { setActiveTeam(t.name); setSelectedAgent(""); }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Team info */}
        {teamData?.config && (
          <div className="px-3 py-2.5 border-b">
            <div className="text-xs text-muted-foreground line-clamp-2">{teamData.config.description}</div>
            <div className="flex gap-2 mt-1.5 text-xs text-muted-foreground">
              <span>{members.length} agents</span>
              <span>{completedCount}/{tasks.length} tasks</span>
            </div>
          </div>
        )}

        {/* Agents */}
        <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
          <div
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${!selectedAgent ? "bg-primary/10 font-medium" : "hover:bg-muted/60 text-muted-foreground"}`}
            onClick={() => setSelectedAgent("")}
          >
            <MessageSquare className="h-4 w-4" />
            <span>All Messages</span>
            <Badge variant="secondary" className="ml-auto text-xs h-5">{messages.length}</Badge>
          </div>
          {members.map(m => (
            <AgentItem
              key={m.agentId}
              member={m}
              status={memberStatus[m.name] || "idle"}
              currentTask={tasks.find(t => t.owner === m.name && t.status === "in_progress")?.subject}
              isSelected={selectedAgent === m.name}
              onClick={() => setSelectedAgent(selectedAgent === m.name ? "" : m.name)}
              messageCount={msgCount[m.name] || 0}
            />
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Tab bar */}
        <div className="flex items-center border-b h-10 px-3">
          {(["chat", "tasks"] as const).map(tab => (
            <button
              key={tab}
              className={`px-3 h-full text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "chat" ? (
                <><MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />Messages ({filteredMsgs.length})</>
              ) : (
                <><ListTodo className="h-3.5 w-3.5 inline mr-1.5" />Tasks ({tasks.length})</>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </div>
        </div>

        {/* Content */}
        {activeTab === "chat" ? (
          <div className="flex-1 overflow-auto">
            {filteredMsgs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No messages yet</div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredMsgs.map((msg, i) => (
                  <MessageBubble
                    key={i}
                    msg={msg}
                    isExpanded={expandedMsgs.has(i)}
                    onToggle={() => {
                      const s = new Set(expandedMsgs);
                      s.has(i) ? s.delete(i) : s.add(i);
                      setExpandedMsgs(s);
                    }}
                  />
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-3 gap-4 h-full">
              {([
                { key: "pending" as const, label: "Pending", color: "text-gray-500" },
                { key: "in_progress" as const, label: "In Progress", color: "text-blue-500" },
                { key: "completed" as const, label: "Completed", color: "text-green-500" },
              ]).map(col => {
                const colTasks = tasks.filter(t => t.status === col.key);
                return (
                  <div key={col.key} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                      <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                    </div>
                    <div className="flex-1 overflow-auto space-y-2">
                      {colTasks.map(t => (
                        <TaskCard key={t.id} task={t}
                          isExpanded={expandedTasks.has(t.id)}
                          onToggle={() => {
                            const s = new Set(expandedTasks);
                            s.has(t.id) ? s.delete(t.id) : s.add(t.id);
                            setExpandedTasks(s);
                          }}
                        />
                      ))}
                      {colTasks.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Empty</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
