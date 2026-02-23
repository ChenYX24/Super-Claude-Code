"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import {
  AGENT_TEMPLATES,
  TOOL_CATEGORIES,
  type ToolTemplate,
} from "@/lib/tools-registry";
import {
  Bot, Info, Plus, Pencil, Trash2, AlertCircle, X,
  ShoppingBag, Search, CheckCircle, Play,
  Globe, Star, RefreshCw, User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { OnlineSearch } from "./online-search";
import { useCommunityTemplates } from "@/hooks/use-community-templates";
import type { RemoteTemplate } from "@/lib/remote-registry";
import type { AgentInfo } from "./types";

interface AgentsTabProps {
  agents: AgentInfo[];
  onRefresh: () => void;
  AgentDialog: React.ComponentType<any>;
}

export function AgentsTab({ agents, onRefresh, AgentDialog }: AgentsTabProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingAgent, setEditingAgent] = useState<AgentInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AgentInfo | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);

  const community = useCommunityTemplates();
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");

  const handleAddAgent = () => {
    setDialogMode("add");
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const handleEditAgent = (agent: AgentInfo) => {
    setDialogMode("edit");
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const handleDeleteClick = (agent: AgentInfo) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;

    try {
      const res = await fetch("/api/toolbox/agents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentToDelete.name }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Agent deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete agent", "error");
      }
    } catch (error) {
      toast("Failed to delete agent", "error");
    } finally {
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  };

  // Get installed agent names
  const installedNames = new Set(agents.map(a => a.name));

  // Filter templates
  const filteredTemplates = AGENT_TEMPLATES.filter((template) => {
    const matchesCategory = categoryFilter === "All" || template.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = async (template: ToolTemplate) => {
    setInstalling(template.name);
    try {
      const res = await fetch("/api/toolbox/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          content: template.content,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Agent installed successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Installation failed", "error");
      }
    } catch (error) {
      toast("Failed to install agent", "error");
    } finally {
      setInstalling(null);
    }
  };

  const handleInstallCommunity = async (template: RemoteTemplate) => {
    setInstalling(template.name);
    try {
      const res = await fetch("/api/toolbox/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.name, content: template.content }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "Community agent installed successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Installation failed", "error");
      }
    } catch {
      toast("Failed to install community agent", "error");
    } finally {
      setInstalling(null);
    }
  };

  const filteredCommunityAgents = community.agents.filter((t) => {
    if (!communitySearchQuery) return true;
    const q = communitySearchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.author.toLowerCase().includes(q);
  });

  if (agents.length === 0 && filteredTemplates.length === 0) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={handleAddAgent} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Agent
          </Button>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">No custom agents found</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Custom agents define specialized personas with their own prompts and tool access.
              Create them at <code className="bg-muted px-1 rounded">~/.claude/agents/</code>.
            </p>
          </CardContent>
        </Card>
        <AgentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialogMode}
          agent={editingAgent}
          onSuccess={onRefresh}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddAgent} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Agent
        </Button>
      </div>
      <div className="space-y-6">
        {/* Installed Agents */}
        {agents.length > 0 && (
          <section>
            <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5 mb-3">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Custom agent definitions with specialized prompts and tool access. Located in <code className="bg-muted px-1 rounded">~/.claude/agents/</code>
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {agents.map((agent) => (
                <div key={agent.name} className="group relative">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-md bg-pink-500/10 flex items-center justify-center flex-shrink-0"><Bot className="h-3.5 w-3.5 text-pink-500" /></div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <CardTitle className="text-sm font-mono truncate">{agent.name}</CardTitle>
                              {agent.provider === "codex" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0">Codex</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agent.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                            title="Run in Chat"
                            onClick={(e) => { e.stopPropagation(); router.push(`/chat?run=${encodeURIComponent(`@${agent.name}`)}`); }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); handleEditAgent(agent); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(agent); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Separator */}
        {agents.length > 0 && <div className="border-t my-6" />}

        {/* Agent Templates Marketplace */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-4 w-4 text-pink-500" />
            <span className="text-sm font-semibold">Agent Templates</span>
            <Badge variant="outline" className="text-xs">{AGENT_TEMPLATES.length}</Badge>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="flex gap-1 flex-wrap">
              {TOOL_CATEGORIES.agents.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search templates..."
                className="w-full h-7 pl-7 pr-2 text-xs border rounded-md bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Template Cards */}
          {filteredTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No templates found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredTemplates.map((template) => {
                const isInstalled = installedNames.has(template.name);
                return (
                  <Card key={template.name} className="group hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-3 px-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-mono font-semibold truncate">{template.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {template.description}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                          {template.category}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        {isInstalled ? (
                          <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400">
                            <CheckCircle className="h-2.5 w-2.5 mr-1" />
                            Installed
                          </Badge>
                        ) : (
                          <div />
                        )}
                        <Button
                          size="sm"
                          variant={isInstalled ? "outline" : "default"}
                          className="h-7 text-xs"
                          onClick={() => handleInstall(template)}
                          disabled={isInstalled || installing === template.name}
                        >
                          {installing === template.name ? "Installing..." : isInstalled ? "Reinstall" : "Install"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Community Templates */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-teal-500" />
              <span className="text-sm font-semibold">Community Templates</span>
              {!community.loading && !community.error && (
                <Badge variant="outline" className="text-xs">{community.agents.length}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={community.refresh}
              title="Refresh community templates"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${community.loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {community.loading ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading community templates...</p>
              </CardContent>
            </Card>
          ) : community.error ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Could not load community templates. Showing local templates only.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {community.agents.length > 0 && (
                <div className="relative mb-3 max-w-xs">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search community agents..."
                    className="w-full h-7 pl-7 pr-2 text-xs border rounded-md bg-background"
                    value={communitySearchQuery}
                    onChange={(e) => setCommunitySearchQuery(e.target.value)}
                  />
                </div>
              )}
              {filteredCommunityAgents.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">No community agent templates found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredCommunityAgents.map((template) => {
                    const isInstalled = installedNames.has(template.name);
                    return (
                      <Card key={template.name} className="group hover:shadow-md transition-shadow">
                        <CardContent className="pt-4 pb-3 px-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-mono font-semibold truncate">{template.name}</h3>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px] flex-shrink-0">{template.category}</Badge>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <User className="h-2.5 w-2.5" /> {template.author}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-amber-500">
                                <Star className="h-2.5 w-2.5" /> {template.stars}
                              </span>
                              {isInstalled && (
                                <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400">
                                  <CheckCircle className="h-2.5 w-2.5 mr-1" /> Installed
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={isInstalled ? "outline" : "default"}
                              className="h-7 text-xs"
                              onClick={() => handleInstallCommunity(template)}
                              disabled={isInstalled || installing === template.name}
                            >
                              {installing === template.name ? "Installing..." : isInstalled ? "Reinstall" : "Install"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <OnlineSearch type="agent" />
      </div>

      <AgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        agent={editingAgent}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation */}
      {deleteDialogOpen && agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteDialogOpen(false)}>
          <div
            className="bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Agent
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the agent{" "}
                <span className="font-mono font-semibold text-foreground">{agentToDelete.name}</span>?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
