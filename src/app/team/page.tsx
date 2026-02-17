"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  config: {
    name: string;
    description: string;
    createdAt: number;
    members: TeamMember[];
    leadSessionId?: string;
  };
  tasks: TaskItem[];
  messages: TeamMessage[];
  memberStatus: Record<string, "working" | "idle" | "completed" | "stale" | "terminated">;
  pastMembers: TeamMember[];
}

interface TeamSummaryItem {
  name: string;
  description: string;
  memberCount: number;
  taskCount: number;
  completedTasks: number;
  activeSince: number;
}

interface TeamSummary {
  teams: TeamSummaryItem[];
}

// ---- Helpers ----

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function shortModel(model: string) {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

// Agent type → icon + color
const AGENT_STYLES: Record<
  string,
  { icon: typeof Bot; color: string; bg: string }
> = {
  "team-lead": {
    icon: Crown,
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-900/40",
  },
  "general-purpose": {
    icon: Cpu,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/40",
  },
  researcher: {
    icon: Search,
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-900/40",
  },
  Explore: {
    icon: Microscope,
    color: "text-purple-600",
    bg: "bg-purple-100 dark:bg-purple-900/40",
  },
};

function getAgentStyle(agentType: string, name: string) {
  if (name.includes("lead")) return AGENT_STYLES["team-lead"];
  if (name.includes("research"))
    return AGENT_STYLES["researcher"] || AGENT_STYLES["general-purpose"];
  return AGENT_STYLES[agentType] || AGENT_STYLES["general-purpose"];
}

const STATUS_DOT: Record<string, string> = {
  working: "bg-green-500 animate-pulse",
  idle: "bg-gray-400",
  completed: "bg-blue-500",
  stale: "bg-amber-500 animate-pulse",
  terminated: "bg-red-400",
};

// ---- Components ----

function AgentItem({
  member,
  status,
  currentTask,
  isSelected,
  onClick,
  messageCount,
}: {
  member: TeamMember;
  status: string;
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
        isSelected
          ? "bg-primary/10 ring-1 ring-primary"
          : "hover:bg-muted/60"
      }`}
      onClick={onClick}
    >
      <div className="relative flex-shrink-0">
        <div
          className={`h-9 w-9 rounded-full flex items-center justify-center ${style.bg}`}
        >
          <Icon className={`h-4 w-4 ${style.color}`} />
        </div>
        <div
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${STATUS_DOT[status] || STATUS_DOT.idle}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{member.name}</div>
        <div className="text-xs text-muted-foreground">
          {member.model !== "unknown" ? shortModel(member.model) : ""}
          {status === "terminated" && (
            <span className="text-red-400 ml-1">{member.model !== "unknown" ? "· " : ""}Terminated</span>
          )}
          {status === "stale" && (
            <span className="text-amber-500 ml-1">· Stale</span>
          )}
          {status === "working" && currentTask && (
            <span className="text-blue-500 ml-1">
              · {currentTask.slice(0, 20)}
            </span>
          )}
        </div>
      </div>
      {messageCount > 0 && (
        <Badge
          variant="secondary"
          className="text-xs h-5 min-w-5 justify-center"
        >
          {messageCount}
        </Badge>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  isSelected,
  onSelect,
}: {
  msg: TeamMessage;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const style = getAgentStyle("", msg.from);
  const Icon = style.icon;
  const isLong = msg.text.length > 300;

  return (
    <div
      className={`flex gap-3 py-3 px-4 transition-colors cursor-pointer ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/20"
      }`}
      onClick={onSelect}
    >
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg}`}
      >
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
          <span className="text-xs text-muted-foreground ml-auto">
            {formatTime(msg.timestamp)}
          </span>
        </div>
        {msg.summary && (
          <div className="text-xs font-medium text-primary/80 mb-1.5 px-2 py-1 bg-primary/5 rounded inline-block">
            {msg.summary}
          </div>
        )}
        <div className={isLong ? "max-h-24 overflow-hidden relative" : ""}>
          <MarkdownContent content={msg.text} className="text-sm" />
          {isLong && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
          )}
        </div>
        {isLong && (
          <div className="text-xs text-primary/60 mt-1 flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            Click to read full message
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Message Detail Panel (right side) ----

function MessageDetailPanel({
  msg,
  onClose,
}: {
  msg: TeamMessage;
  onClose: () => void;
}) {
  const style = getAgentStyle("", msg.from);
  const Icon = style.icon;

  return (
    <div className="w-[45%] border-l flex flex-col bg-muted/5">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${style.bg}`}>
          <Icon className={`h-4 w-4 ${style.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{msg.from}</span>
            {msg.to && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{msg.to}</span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{formatTime(msg.timestamp)}</div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          ×
        </Button>
      </div>

      {/* Summary badge */}
      {msg.summary && (
        <div className="px-4 py-2 border-b">
          <div className="text-xs font-medium text-primary/80 px-2 py-1 bg-primary/5 rounded inline-block">
            {msg.summary}
          </div>
        </div>
      )}

      {/* Full message content */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <MarkdownContent content={msg.text} className="text-sm" />
      </div>

      {/* Footer: char count */}
      <div className="px-4 py-1.5 border-t text-xs text-muted-foreground">
        {msg.text.length} characters
      </div>
    </div>
  );
}

function TaskCard({
  task,
  isExpanded,
  onToggle,
}: {
  task: TaskItem;
  isExpanded: boolean;
  onToggle: () => void;
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
          <div className="text-sm font-medium">
            #{task.id} {task.subject}
          </div>
          {task.owner && (
            <Badge variant="outline" className="text-xs mt-1">
              {task.owner}
            </Badge>
          )}
          {task.activeForm && task.status === "in_progress" && (
            <div className="text-xs text-blue-500 mt-1 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {task.activeForm}
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
        )}
      </div>
      {isExpanded && (
        <div className="mt-2 pt-2 border-t space-y-2">
          {task.description && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.description}
            </div>
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

// ---- Team Selector Dropdown ----

function TeamSelector({
  teams,
  activeTeam,
  onSelect,
}: {
  teams: TeamSummaryItem[];
  activeTeam: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = teams.find((t) => t.name === activeTeam);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors w-full"
        onClick={() => setOpen(!open)}
      >
        <Users className="h-4 w-4 text-primary" />
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium truncate">
            {current?.name || "Select Team"}
          </div>
          {current && (
            <div className="text-xs text-muted-foreground">
              {current.memberCount} agents ·{" "}
              {current.completedTasks}/{current.taskCount} tasks
            </div>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          {teams.map((t) => (
            <button
              key={t.name}
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors border-b last:border-b-0 ${
                activeTeam === t.name ? "bg-primary/5" : ""
              }`}
              onClick={() => {
                onSelect(t.name);
                setOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {t.completedTasks}/{t.taskCount}
                </Badge>
              </div>
              {t.description && (
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {t.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

function TeamPageInner() {
  const searchParams = useSearchParams();
  const urlTeamName = searchParams.get("name");

  const [teamList, setTeamList] = useState<TeamSummary | null>(null);
  const [activeTeam, setActiveTeam] = useState("");
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedMsgIdx, setSelectedMsgIdx] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">("chat");
  const [showPastAgents, setShowPastAgents] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const initialTeamSet = useRef(false);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d: TeamSummary) => {
        setTeamList(d);
        if (!initialTeamSet.current && d.teams.length > 0) {
          // Use URL param if provided and valid, otherwise use first team
          const target = urlTeamName && d.teams.some((t) => t.name === urlTeamName)
            ? urlTeamName
            : d.teams[0].name;
          setActiveTeam(target);
          initialTeamSet.current = true;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [urlTeamName]);

  useEffect(() => {
    if (!activeTeam) return;
    const load = () => {
      fetch(`/api/teams/${activeTeam}`)
        .then((r) => r.json())
        .then((d) => {
          if (d && !d.error) setTeamData(d);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [activeTeam]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [teamData?.messages?.length]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!teamList || teamList.teams.length === 0)
    return (
      <div className="text-center py-16">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">No Active Teams</h2>
        <p className="text-muted-foreground mt-1">
          Use TeamCreate in Claude Code to start one
        </p>
      </div>
    );

  const tasks = teamData?.tasks || [];
  const messages = teamData?.messages || [];
  const members = teamData?.config?.members || [];
  const memberStatus = teamData?.memberStatus || {};
  const pastMembers = teamData?.pastMembers || [];

  // Count messages per agent
  const msgCount: Record<string, number> = {};
  for (const m of messages) {
    msgCount[m.from] = (msgCount[m.from] || 0) + 1;
    if (m.to) msgCount[m.to] = (msgCount[m.to] || 0) + 1;
  }

  // Filter messages/tasks by selected agent
  const filteredMsgs = selectedAgent
    ? messages.filter(
        (m) => m.from === selectedAgent || m.to === selectedAgent
      )
    : messages;

  const filteredTasks = selectedAgent === "__unassigned__"
    ? tasks.filter((t) => !t.owner)
    : selectedAgent
      ? tasks.filter((t) => t.owner === selectedAgent)
      : tasks;

  const completedCount = tasks.filter(
    (t) => t.status === "completed"
  ).length;

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left sidebar */}
      <div className="w-60 border-r flex flex-col bg-muted/5">
        {/* Team selector dropdown */}
        <div className="p-2 border-b">
          <TeamSelector
            teams={teamList.teams}
            activeTeam={activeTeam}
            onSelect={(name) => {
              setActiveTeam(name);
              setSelectedAgent("");
            }}
          />
        </div>

        {/* Team info */}
        {teamData?.config && (
          <div className="px-3 py-2.5 border-b">
            <div className="text-xs text-muted-foreground line-clamp-2">
              {teamData.config.description}
            </div>
            <div className="flex gap-2 mt-1.5 text-xs text-muted-foreground">
              <span>{members.length} active{pastMembers.length > 0 ? ` + ${pastMembers.length} past` : ""}</span>
              <span>
                {completedCount}/{tasks.length} tasks
              </span>
            </div>
            {teamData.config.leadSessionId && (
              <Link
                href={`/sessions?session=${teamData.config.leadSessionId}`}
                className="flex items-center gap-1 mt-1.5 text-xs text-primary hover:underline"
              >
                <Terminal className="h-3 w-3" />
                Session: {teamData.config.leadSessionId.slice(0, 8)}...
              </Link>
            )}
          </div>
        )}

        {/* Agents list */}
        <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
          <div
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${
              !selectedAgent
                ? "bg-primary/10 font-medium"
                : "hover:bg-muted/60 text-muted-foreground"
            }`}
            onClick={() => setSelectedAgent("")}
          >
            <MessageSquare className="h-4 w-4" />
            <span>All Messages</span>
            <Badge
              variant="secondary"
              className="ml-auto text-xs h-5"
            >
              {messages.length}
            </Badge>
          </div>

          {/* Active agents */}
          {members.map((m) => (
            <AgentItem
              key={m.agentId}
              member={m}
              status={memberStatus[m.name] || "idle"}
              currentTask={
                tasks.find(
                  (t) =>
                    t.owner === m.name && t.status === "in_progress"
                )?.subject
              }
              isSelected={selectedAgent === m.name}
              onClick={() =>
                setSelectedAgent(
                  selectedAgent === m.name ? "" : m.name
                )
              }
              messageCount={msgCount[m.name] || 0}
            />
          ))}

          {/* Past agents (collapsible) */}
          {pastMembers.length > 0 && (
            <>
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 mt-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPastAgents(!showPastAgents)}
              >
                {showPastAgents ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>Past Agents ({pastMembers.length})</span>
              </div>
              {showPastAgents &&
                pastMembers.map((m) => (
                  <AgentItem
                    key={m.agentId}
                    member={m}
                    status="terminated"
                    isSelected={selectedAgent === m.name}
                    onClick={() =>
                      setSelectedAgent(
                        selectedAgent === m.name ? "" : m.name
                      )
                    }
                    messageCount={msgCount[m.name] || 0}
                  />
                ))}
            </>
          )}

          {/* Unassigned tasks indicator */}
          {tasks.filter((t) => !t.owner).length > 0 && (
            <div
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm mt-1 ${
                selectedAgent === "__unassigned__"
                  ? "bg-primary/10 font-medium"
                  : "hover:bg-muted/60 text-muted-foreground"
              }`}
              onClick={() =>
                setSelectedAgent(
                  selectedAgent === "__unassigned__" ? "" : "__unassigned__"
                )
              }
            >
              <ListTodo className="h-4 w-4 text-orange-500" />
              <span>Unassigned</span>
              <Badge variant="secondary" className="ml-auto text-xs h-5">
                {tasks.filter((t) => !t.owner).length}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Tab bar */}
        <div className="flex items-center border-b h-10 px-3">
          {(["chat", "tasks"] as const).map((tab) => (
            <button
              key={tab}
              className={`px-3 h-full text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "chat" ? (
                <>
                  <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />
                  Messages ({filteredMsgs.length})
                </>
              ) : (
                <>
                  <ListTodo className="h-3.5 w-3.5 inline mr-1.5" />
                  Tasks ({filteredTasks.length})
                </>
              )}
            </button>
          ))}
          {selectedAgent && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {selectedAgent}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </div>
        </div>

        {/* Content */}
        {activeTab === "chat" ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Message list */}
            <div className={`${selectedMsgIdx !== null ? "w-[55%]" : "flex-1"} overflow-auto relative`} ref={chatScrollRef}>
              {filteredMsgs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No messages yet
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredMsgs.map((msg, i) => (
                    <MessageBubble
                      key={i}
                      msg={msg}
                      isSelected={selectedMsgIdx === i}
                      onSelect={() => setSelectedMsgIdx(selectedMsgIdx === i ? null : i)}
                    />
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* Floating scroll controls - right side */}
              {filteredMsgs.length > 5 && (
                <div className="sticky bottom-4 float-right mr-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 shadow-md bg-background"
                    onClick={() =>
                      chatScrollRef.current?.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      })
                    }
                  >
                    <ChevronsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 shadow-md bg-background"
                    onClick={() =>
                      chatEndRef.current?.scrollIntoView({
                        behavior: "smooth",
                      })
                    }
                  >
                    <ChevronsDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Right-side message detail panel */}
            {selectedMsgIdx !== null && filteredMsgs[selectedMsgIdx] && (
              <MessageDetailPanel
                msg={filteredMsgs[selectedMsgIdx]}
                onClose={() => setSelectedMsgIdx(null)}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-3 gap-4 h-full">
              {(
                [
                  {
                    key: "pending" as const,
                    label: "Pending",
                    color: "text-gray-500",
                  },
                  {
                    key: "in_progress" as const,
                    label: "In Progress",
                    color: "text-blue-500",
                  },
                  {
                    key: "completed" as const,
                    label: "Completed",
                    color: "text-green-500",
                  },
                ] as const
              ).map((col) => {
                const colTasks = filteredTasks.filter(
                  (t) => t.status === col.key
                );
                return (
                  <div key={col.key} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <span className={`text-sm font-semibold ${col.color}`}>
                        {col.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {colTasks.length}
                      </Badge>
                    </div>
                    <div className="flex-1 overflow-auto space-y-2">
                      {colTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          isExpanded={expandedTasks.has(t.id)}
                          onToggle={() => {
                            const s = new Set(expandedTasks);
                            s.has(t.id) ? s.delete(t.id) : s.add(t.id);
                            setExpandedTasks(s);
                          }}
                        />
                      ))}
                      {colTasks.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          Empty
                        </div>
                      )}
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

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TeamPageInner />
    </Suspense>
  );
}
