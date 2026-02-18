"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { MCP_REGISTRY, MCP_CATEGORIES, type MCPRegistryEntry } from "@/lib/mcp-registry";
import {
  Plug, RefreshCw, FolderOpen, Plus, Pencil, Trash2,
  ShoppingBag, Search, ExternalLink, CheckCircle,
} from "lucide-react";
import { OnlineSearch } from "./online-search";
import type { MCPServersData, MCPServerConfig, HealthStatus } from "./types";

const HEALTH_CONFIG: Record<HealthStatus, { color: string; icon: typeof CheckCircle; label: string }> = {
  healthy: { color: "text-green-500", icon: CheckCircle, label: "Healthy" },
  warning: { color: "text-yellow-500", icon: CheckCircle, label: "Warning" },
  timeout: { color: "text-orange-500", icon: CheckCircle, label: "Timeout" },
  error: { color: "text-red-500", icon: CheckCircle, label: "Error" },
  checking: { color: "text-muted-foreground animate-spin", icon: RefreshCw, label: "Checking" },
  unknown: { color: "text-muted-foreground", icon: CheckCircle, label: "Unknown" },
};

interface MCPTabProps {
  data: MCPServersData;
  health: Record<string, HealthStatus>;
  onCheckHealth: (name: string, command: string) => void;
  onRefresh: () => void;
  MCPServerDialog: React.ComponentType<any>;
  MarketplaceInstallDialog: React.ComponentType<any>;
  DeleteConfirmDialog: React.ComponentType<any>;
}

export function MCPTab({
  data,
  health,
  onCheckHealth,
  onRefresh,
  MCPServerDialog,
  MarketplaceInstallDialog,
  DeleteConfirmDialog,
}: MCPTabProps) {
  const { toast } = useToast();
  const globalEntries = Object.entries(data.global);
  const hasGlobal = globalEntries.length > 0;
  const hasProject = data.projects.length > 0;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogScope, setDialogScope] = useState<"global" | string>("global");
  const [dialogServerName, setDialogServerName] = useState("");
  const [dialogServerConfig, setDialogServerConfig] = useState<MCPServerConfig | undefined>();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteServerName, setDeleteServerName] = useState("");
  const [deleteScope, setDeleteScope] = useState("");

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MCPRegistryEntry | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAddServer = () => {
    setDialogMode("add");
    setDialogScope("global");
    setDialogServerName("");
    setDialogServerConfig(undefined);
    setDialogOpen(true);
  };

  const handleEditServer = (name: string, config: MCPServerConfig, scope: string) => {
    setDialogMode("edit");
    setDialogScope(scope);
    setDialogServerName(name);
    setDialogServerConfig(config);
    setDialogOpen(true);
  };

  const handleDeleteClick = (name: string, scope: string) => {
    setDeleteServerName(name);
    setDeleteScope(scope);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await fetch("/api/toolbox/mcp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: deleteScope, name: deleteServerName }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Server deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete server", "error");
      }
    } catch (error) {
      toast("Failed to delete server", "error");
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleDialogSuccess = () => {
    onRefresh();
  };

  const handleInstallClick = (entry: MCPRegistryEntry) => {
    setSelectedEntry(entry);
    setInstallDialogOpen(true);
  };

  const handleInstallSuccess = () => {
    onRefresh();
  };

  // Get installed server names for checking
  const installedNames = new Set([
    ...Object.keys(data.global),
    ...data.projects.flatMap(p => Object.keys(p.servers)),
  ]);

  // Filter marketplace entries
  const filteredEntries = MCP_REGISTRY.filter((entry) => {
    const matchesCategory = categoryFilter === "All" || entry.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!hasGlobal && !hasProject) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={handleAddServer} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Server
          </Button>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Plug className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">No MCP servers configured</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              MCP servers extend Claude with external tools (filesystem, search, databases, etc.).
              Configure them in <code className="bg-muted px-1 rounded">~/.claude/settings.json</code> or project <code className="bg-muted px-1 rounded">.mcp.json</code>.
            </p>
          </CardContent>
        </Card>
        <MCPServerDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialogMode}
          scope={dialogScope}
          serverName={dialogServerName}
          serverConfig={dialogServerConfig}
          onSuccess={handleDialogSuccess}
        />
      </>
    );
  }

  const renderServer = (name: string, config: MCPServerConfig, scope: string) => {
    const status = health[name] || "unknown";
    const hcfg = HEALTH_CONFIG[status];
    const HIcon = hcfg.icon;
    const cmdDisplay = config.args?.length ? `${config.command} ${config.args.join(" ")}` : config.command;

    return (
      <Card key={`${scope}-${name}`} className="group hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center`}>
                <Plug className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-mono">{name}</CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant={scope === "Global" ? "default" : "secondary"} className="text-[10px] h-4 px-1">{scope}</Badge>
                  <span className={`text-[10px] flex items-center gap-0.5 ${hcfg.color}`}>
                    <HIcon className="h-3 w-3" /> {hcfg.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onCheckHealth(name, config.command)}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Check
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleEditServer(name, config, scope === "Global" ? "global" : scope)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => handleDeleteClick(name, scope === "Global" ? "global" : scope)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <code className="text-xs bg-muted px-2 py-1.5 rounded block break-all font-mono">{cmdDisplay}</code>
          {config.env && Object.keys(config.env).length > 0 && (
            <div className="space-y-0.5">
              {Object.entries(config.env).map(([k, v]) => (
                <div key={k} className="text-[11px] text-muted-foreground font-mono px-1">
                  <span className="text-foreground/70">{k}</span>=<span className="text-green-600 dark:text-green-400">{v}</span>
                </div>
              ))}
            </div>
          )}
          {config.cwd && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <FolderOpen className="h-3 w-3" /> {config.cwd}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddServer} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Server
        </Button>
      </div>

      <div className="space-y-6">
        {hasGlobal && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="default" className="text-xs">Global</Badge>
              <span className="text-xs text-muted-foreground">{globalEntries.length} server{globalEntries.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {globalEntries.map(([name, config]) => renderServer(name, config, "Global"))}
            </div>
          </section>
        )}
        {hasProject && data.projects.map(({ project, servers }) => (
          <section key={project}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-xs font-mono">{project}</Badge>
              <span className="text-xs text-muted-foreground">{Object.keys(servers).length} server{Object.keys(servers).length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(servers).map(([name, config]) => renderServer(name, config, project))}
            </div>
          </section>
        ))}

        {/* Separator */}
        <div className="border-t my-6" />

        {/* Marketplace Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">MCP Marketplace</h2>
            <Badge variant="outline" className="text-xs">{MCP_REGISTRY.length} available</Badge>
          </div>

          {/* Category Filter + Search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              {MCP_CATEGORIES.map((cat) => (
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
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search servers..."
                className="w-full h-7 pl-8 pr-3 text-xs border rounded-md bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Marketplace Cards */}
          {filteredEntries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No servers found matching your filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEntries.map((entry) => {
                const isInstalled = installedNames.has(entry.name);

                return (
                  <Card key={entry.name} className="group hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-mono truncate">{entry.name}</CardTitle>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                {entry.category}
                              </Badge>
                              {entry.official && (
                                <Badge variant="default" className="text-[10px] h-4 px-1">
                                  Official
                                </Badge>
                              )}
                              {isInstalled && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 text-green-600 border-green-600">
                                  Installed
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{entry.description}</p>
                      <Button
                        size="sm"
                        variant={isInstalled ? "outline" : "default"}
                        className="w-full h-7 text-xs"
                        disabled={isInstalled}
                        onClick={() => handleInstallClick(entry)}
                      >
                        {isInstalled ? "Installed" : "Install"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* External Links */}
          <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
            <a href="https://github.com/modelcontextprotocol/servers" target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />Official Servers
            </a>
            <a href="https://glama.ai/mcp/servers" target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />Glama Directory
            </a>
            <a href="https://smithery.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-primary flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />Smithery
            </a>
          </div>
        </section>

        <OnlineSearch type="mcp" />
      </div>

      {/* Dialogs */}
      <MCPServerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        scope={dialogScope}
        serverName={dialogServerName}
        serverConfig={dialogServerConfig}
        onSuccess={handleDialogSuccess}
      />
      <MarketplaceInstallDialog
        open={installDialogOpen}
        onClose={() => setInstallDialogOpen(false)}
        entry={selectedEntry}
        onSuccess={handleInstallSuccess}
      />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        serverName={deleteServerName}
        scope={deleteScope}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
