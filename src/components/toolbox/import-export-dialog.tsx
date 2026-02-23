"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/toast";
import {
  X, Download, Upload, FileUp, Link, Check, AlertCircle,
  Package, Sparkles, Bot, BookOpen, Loader2, CheckSquare, Square,
} from "lucide-react";
import type { SkillInfo, AgentInfo, RuleInfo } from "./types";

// ---- Types ----

interface BundleItem {
  type: "skill" | "agent" | "rule";
  name: string;
  group?: string;
  content: string;
}

interface ExportBundle {
  version: string;
  exported_at: string;
  items: BundleItem[];
}

// ---- Export Dialog ----

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  skills: SkillInfo[];
  agents: AgentInfo[];
  rules: RuleInfo[];
}

export function ExportDialog({ open, onClose, skills, agents, rules }: ExportDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const allItems = [
    ...skills.map((s) => ({ id: `skill:${s.name}`, type: "skill" as const, name: s.name, desc: s.description })),
    ...agents.map((a) => ({ id: `agent:${a.name}`, type: "agent" as const, name: a.name, desc: a.description })),
    ...rules.map((r) => ({ id: `rule:${r.group}/${r.name}`, type: "rule" as const, name: `${r.group}/${r.name}`, desc: r.preview.slice(0, 80) })),
  ];

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === allItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allItems.map((i) => i.id)));
    }
  };

  const handleExport = async () => {
    if (selected.size === 0) {
      toast("Select at least one item to export", "error");
      return;
    }

    setExporting(true);
    try {
      const types = new Set<string>();
      const items = Array.from(selected);
      for (const item of items) {
        const type = item.split(":")[0];
        types.add(type === "skill" ? "skills" : type === "agent" ? "agents" : "rules");
      }

      const res = await fetch("/api/toolbox/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types: Array.from(types), items }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Export failed", "error");
        return;
      }

      const bundle: ExportBundle = data.bundle;
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claude-toolbox-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast(`Exported ${bundle.items.length} item(s)`, "success");
      if (data.errors?.length > 0) {
        toast(`Warnings: ${data.errors.join(", ")}`, "error");
      }
      onClose();
    } catch {
      toast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "skill": return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
      case "agent": return <Bot className="h-3.5 w-3.5 text-pink-500" />;
      case "rule": return <BookOpen className="h-3.5 w-3.5 text-cyan-500" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Toolbox Bundle
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {selected.size === allItems.length ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Select all ({allItems.length})
          </button>
          <Badge variant="secondary" className="text-xs">
            {selected.size} selected
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {allItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No items to export. Add skills, agents, or rules first.
            </p>
          ) : (
            <div className="space-y-1">
              {allItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 text-left"
                >
                  {selected.has(item.id) ? (
                    <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  {typeIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    {item.desc && (
                      <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">
                    {item.type}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
            className="gap-1.5"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Import Dialog ----

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportTab = "file" | "url" | "paste";

export function ImportDialog({ open, onClose, onSuccess }: ImportDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ImportTab>("file");
  const [bundleData, setBundleData] = useState<ExportBundle | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const resetState = () => {
    setBundleData(null);
    setPasteContent("");
    setUrlInput("");
    setResult(null);
    setOverwrite(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !Array.isArray(data.items)) {
          toast("Invalid bundle format", "error");
          return;
        }
        setBundleData(data);
        setResult(null);
      } catch {
        toast("Failed to parse JSON file", "error");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handlePasteLoad = () => {
    try {
      const data = JSON.parse(pasteContent);
      if (!data.version || !Array.isArray(data.items)) {
        toast("Invalid bundle format", "error");
        return;
      }
      setBundleData(data);
      setResult(null);
    } catch {
      toast("Invalid JSON content", "error");
    }
  };

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return;

    try {
      new URL(urlInput);
    } catch {
      toast("Invalid URL format", "error");
      return;
    }

    setFetching(true);
    try {
      const res = await fetch(`/api/toolbox/import?url=${encodeURIComponent(urlInput)}`);
      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Failed to fetch bundle", "error");
        return;
      }

      if (data.bundle) {
        setBundleData(data.bundle);
        setResult(null);
      } else {
        toast("No valid bundle found at URL", "error");
      }
    } catch {
      toast("Failed to fetch bundle from URL", "error");
    } finally {
      setFetching(false);
    }
  };

  const handleImport = async () => {
    if (!bundleData) return;

    setImporting(true);
    try {
      const url = `/api/toolbox/import${overwrite ? "?overwrite=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundleData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Import failed", "error");
        return;
      }

      setResult(data);

      if (data.imported > 0) {
        toast(`Imported ${data.imported} item(s)`, "success");
        onSuccess();
      } else if (data.skipped > 0) {
        toast(`All ${data.skipped} item(s) already exist (skipped)`, "success");
      }
    } catch {
      toast("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "skill": return <Sparkles className="h-3.5 w-3.5 text-amber-500" />;
      case "agent": return <Bot className="h-3.5 w-3.5 text-pink-500" />;
      case "rule": return <BookOpen className="h-3.5 w-3.5 text-cyan-500" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Toolbox Bundle
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!bundleData ? (
          /* Source selection */
          <div className="px-6 py-4">
            {/* Tab buttons */}
            <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
              {([
                { id: "file" as ImportTab, icon: FileUp, label: "File" },
                { id: "url" as ImportTab, icon: Link, label: "URL" },
                { id: "paste" as ImportTab, icon: Package, label: "Paste" },
              ]).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {tab === "file" && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed rounded-lg py-10 flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  <FileUp className="h-8 w-8" />
                  <div>
                    <p className="text-sm font-medium">Click to select a JSON file</p>
                    <p className="text-xs mt-1">or drag and drop (*.json)</p>
                  </div>
                </button>
              </div>
            )}

            {tab === "url" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Bundle URL</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
                    placeholder="https://example.com/my-bundle.json"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUrlFetch()}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleUrlFetch}
                  disabled={!urlInput.trim() || fetching}
                  className="gap-1.5"
                >
                  {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                  Fetch Bundle
                </Button>
              </div>
            )}

            {tab === "paste" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Paste JSON</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md text-xs font-mono bg-background resize-none h-40"
                    placeholder='{"version": "1.0", "items": [...]}'
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handlePasteLoad}
                  disabled={!pasteContent.trim()}
                  className="gap-1.5"
                >
                  <Package className="h-3.5 w-3.5" />
                  Load Bundle
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Preview + Import */
          <>
            <div className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0">
              <div className="text-sm">
                <span className="font-medium">{bundleData.items.length} item(s)</span>
                {bundleData.exported_at && (
                  <span className="text-muted-foreground ml-2">
                    exported {new Date(bundleData.exported_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => { setBundleData(null); setResult(null); }}
              >
                Change source
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-2">
              <div className="space-y-1">
                {bundleData.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
                    {typeIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.type === "rule" && item.group ? `${item.group}/` : ""}
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.content.split("\n")[0]?.slice(0, 80)}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      {item.type}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Overwrite option */}
              <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">Overwrite existing items</span>
              </label>

              {/* Result */}
              {result && (
                <div className="mt-4 p-3 rounded-lg border bg-muted/20 space-y-1">
                  {result.imported > 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <Check className="h-4 w-4" />
                      {result.imported} imported
                    </div>
                  )}
                  {result.skipped > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      {result.skipped} skipped (already exist)
                    </div>
                  )}
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <X className="h-4 w-4" />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={handleClose}>
                {result ? "Done" : "Cancel"}
              </Button>
              {!result && (
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={importing}
                  className="gap-1.5"
                >
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Import {bundleData.items.length} item(s)
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
