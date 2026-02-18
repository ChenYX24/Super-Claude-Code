"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { Bot, X } from "lucide-react";

interface AgentInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

interface AgentDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  agent: AgentInfo | null;
  onSuccess: () => void;
}

const AGENT_TEMPLATE = `---
name: agent-name
description: What this agent does
model: sonnet
---

# Instructions

Describe the agent's behavior here.`;

export function AgentDialog({ open, onClose, mode, agent, onSuccess }: AgentDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(agent?.name || "");
  const [content, setContent] = useState(agent?.content || AGENT_TEMPLATE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(agent?.name || "");
      setContent(agent?.content || AGENT_TEMPLATE);
    }
  }, [open, agent]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) {
      toast("Name and content are required", "error");
      return;
    }

    setSubmitting(true);

    try {
      const method = mode === "add" ? "POST" : "PUT";
      const res = await fetch("/api/toolbox/agents", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), content }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || `Agent ${mode === "add" ? "created" : "updated"} successfully`, "success");
        onSuccess();
        onClose();
      } else {
        toast(data.error || "Operation failed", "error");
      }
    } catch (error) {
      toast("Failed to save agent", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-background z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {mode === "add" ? "Create Agent" : "Edit Agent"}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Agent Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="my-agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === "edit"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Alphanumeric characters, hyphens, and underscores only
            </p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Content *</label>
            <textarea
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background min-h-[400px] resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Markdown with YAML frontmatter (name, description, model)
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Create Agent" : "Update Agent"}
          </Button>
        </div>
      </div>
    </div>
  );
}
