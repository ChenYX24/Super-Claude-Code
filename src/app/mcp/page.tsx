"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, RefreshCw, Info } from "lucide-react";

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  type?: string;
}

interface MCPServersData {
  global: Record<string, MCPServerConfig>;
  projects: { project: string; servers: Record<string, MCPServerConfig> }[];
}

function ServerCard({ name, config, scope }: { name: string; config: MCPServerConfig; scope: string }) {
  const commandDisplay = config.args && config.args.length > 0
    ? `${config.command} ${config.args.join(" ")}`
    : config.command;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-mono">{name}</CardTitle>
          <Badge variant={scope === "Global" ? "default" : "secondary"}>
            {scope}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Command</div>
          <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
            {commandDisplay}
          </code>
        </div>
        {config.env && Object.keys(config.env).length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Environment Variables</div>
            <div className="space-y-1">
              {Object.entries(config.env).map(([key, value]) => (
                <div key={key} className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">
                  {key}: {value}
                </div>
              ))}
            </div>
          </div>
        )}
        {config.cwd && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Working Directory</div>
            <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
              {config.cwd}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MCPPage() {
  const [data, setData] = useState<MCPServersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mcp")
      .then(r => r.json())
      .then((d: MCPServersData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg">Failed to load MCP servers</h2>
      </div>
    );
  }

  const hasGlobalServers = Object.keys(data.global).length > 0;
  const hasProjectServers = data.projects.length > 0;
  const hasAnyServers = hasGlobalServers || hasProjectServers;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Plug className="h-6 w-6" />
        MCP Servers
      </h1>

      {!hasAnyServers && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                No MCP servers configured
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Add MCP servers in <code>~/.claude/settings.json</code> under the <code>mcpServers</code> field,
                or create <code>.mcp.json</code> files in your project directories.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Servers */}
      {hasGlobalServers && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Badge variant="default" className="text-xs">Global</Badge>
            <span className="text-muted-foreground text-sm">
              {Object.keys(data.global).length} server{Object.keys(data.global).length !== 1 ? "s" : ""}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.global).map(([name, config]) => (
              <ServerCard key={name} name={name} config={config} scope="Global" />
            ))}
          </div>
        </section>
      )}

      {/* Project Servers */}
      {hasProjectServers && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Project Servers</h2>
          <div className="space-y-6">
            {data.projects.map(({ project, servers }) => (
              <div key={project}>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{project}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {Object.keys(servers).length} server{Object.keys(servers).length !== 1 ? "s" : ""}
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(servers).map(([name, config]) => (
                    <ServerCard key={name} name={name} config={config} scope={project} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
