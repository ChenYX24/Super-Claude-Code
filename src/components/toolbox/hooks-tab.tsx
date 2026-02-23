"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import {
  Shield, Info, Plus, Pencil, Trash2, Clock, AlertCircle, X,
} from "lucide-react";
import { OnlineSearch } from "./online-search";
import type { HookEntry } from "./types";

const HOOK_TYPES = [
  "PreToolUse", "PostToolUse", "Stop", "SessionStart", "SessionEnd",
  "PreCompact", "PermissionRequest", "SubagentStart", "SubagentStop",
];

const HOOK_COLORS: Record<string, string> = {
  PreToolUse: "bg-blue-500/10 text-blue-500",
  PostToolUse: "bg-cyan-500/10 text-cyan-500",
  Stop: "bg-red-500/10 text-red-500",
  SessionStart: "bg-green-500/10 text-green-500",
  SessionEnd: "bg-orange-500/10 text-orange-500",
  PreCompact: "bg-purple-500/10 text-purple-500",
  PermissionRequest: "bg-amber-500/10 text-amber-500",
};

interface HooksTabProps {
  hooks: HookEntry[];
  onRefresh: () => void;
  HookDialog: React.ComponentType<any>;
}

export function HooksTab({ hooks, onRefresh, HookDialog }: HooksTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingHook, setEditingHook] = useState<HookEntry | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hookToDelete, setHookToDelete] = useState<HookEntry | null>(null);

  const handleAddHook = () => {
    setDialogMode("add");
    setEditingHook(null);
    setDialogOpen(true);
  };

  const handleEditHook = (hook: HookEntry) => {
    setDialogMode("edit");
    setEditingHook(hook);
    setDialogOpen(true);
  };

  const handleDeleteClick = (hook: HookEntry) => {
    setHookToDelete(hook);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!hookToDelete) return;

    try {
      const res = await fetch("/api/toolbox/hooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: hookToDelete.type,
          index: hookToDelete.index,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Hook deleted successfully", "success");
        onRefresh();
      } else {
        toast(data.error || "Failed to delete hook", "error");
      }
    } catch (error) {
      toast("Failed to delete hook", "error");
    } finally {
      setDeleteDialogOpen(false);
      setHookToDelete(null);
    }
  };

  if (hooks.length === 0) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={handleAddHook} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Hook
          </Button>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">No hooks configured</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Hooks run shell commands at lifecycle events (before/after tool use, session start/end, etc.).
            </p>
          </CardContent>
        </Card>
        <HookDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialogMode}
          hook={editingHook}
          onSuccess={onRefresh}
        />
      </>
    );
  }

  const grouped = new Map<string, HookEntry[]>();
  for (const hook of hooks) {
    const list = grouped.get(hook.type) || [];
    list.push(hook);
    grouped.set(hook.type, list);
  }

  const allTypes = [...HOOK_TYPES, ...Array.from(grouped.keys()).filter(t => !HOOK_TYPES.includes(t))];

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={handleAddHook} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Hook
        </Button>
      </div>
      <div className="space-y-4">
        <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Shell commands that run automatically at lifecycle events. Configured in settings files
          </p>
        </div>
        {allTypes.map((type) => {
          const items = grouped.get(type);
          if (!items) return null;
          const colorClass = HOOK_COLORS[type] || "bg-zinc-500/10 text-zinc-500";

          return (
            <section key={type}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-6 px-2 rounded-md text-[11px] font-mono font-semibold flex items-center ${colorClass}`}>
                  {type}
                </div>
                <Badge variant="outline" className="text-[10px]">{items.length} hook{items.length > 1 ? "s" : ""}</Badge>
              </div>
              <div className="space-y-1.5">
                {items.map((hook, i) => (
                  <Card key={i} className="bg-muted/20 group hover:shadow-md transition-shadow">
                    <CardContent className="py-2.5 px-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {hook.description && (
                            <p className="text-xs text-foreground/80 mb-1">{hook.description}</p>
                          )}
                          {hook.matcher && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] text-muted-foreground">match:</span>
                              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">{hook.matcher}</code>
                            </div>
                          )}
                          <div className="bg-zinc-900 dark:bg-zinc-950 text-green-400 px-2.5 py-1.5 rounded font-mono text-[11px] break-all">
                            $ {hook.command}
                          </div>
                        </div>
                        <div className="flex items-start gap-1">
                          {hook.timeout && (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">
                              <Clock className="h-2.5 w-2.5 mr-0.5" /> {hook.timeout}s
                            </Badge>
                          )}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditHook(hook)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => handleDeleteClick(hook)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <OnlineSearch type="hook" />

      <HookDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        hook={editingHook}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation */}
      {deleteDialogOpen && hookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteDialogOpen(false)}>
          <div
            className="bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Hook
              </h2>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this{" "}
                <span className="font-mono font-semibold text-foreground">{hookToDelete.type}</span> hook?
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
