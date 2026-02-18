"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { useToast } from "@/components/toast";
import { Sparkles, X, Eye, Pencil } from "lucide-react";

interface SkillInfo {
  name: string;
  description: string;
  content: string;
  path: string;
}

interface SkillDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  skill: SkillInfo | null;
  onSuccess: () => void;
}

const SKILL_TEMPLATE = `# Skill Name

Description of what this skill does.

## Instructions

Describe the skill's behavior here.`;

export function SkillDialog({ open, onClose, mode, skill, onSuccess }: SkillDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(skill?.name || "");
  const [content, setContent] = useState(skill?.content || SKILL_TEMPLATE);
  const [submitting, setSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (open) {
      setName(skill?.name || "");
      setContent(skill?.content || SKILL_TEMPLATE);
      setPreviewMode(false);
    }
  }, [open, skill]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) {
      toast("Name and content are required", "error");
      return;
    }

    setSubmitting(true);

    try {
      const method = mode === "add" ? "POST" : "PUT";
      const res = await fetch("/api/toolbox/skills", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), content }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || `Skill ${mode === "add" ? "created" : "updated"} successfully`, "success");
        onSuccess();
        onClose();
      } else {
        toast(data.error || "Operation failed", "error");
      }
    } catch (error) {
      toast("Failed to save skill", "error");
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
            <Sparkles className="h-5 w-5 text-amber-500" />
            {mode === "add" ? "Create Skill" : "Edit Skill"}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Skill Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="my-skill"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === "edit"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be saved as ~/.claude/skills/{name || "skill-name"}/SKILL.md
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Content *</label>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  className={`px-3 py-1 text-xs flex items-center gap-1 transition-colors ${
                    !previewMode ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                  onClick={() => setPreviewMode(false)}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  className={`px-3 py-1 text-xs flex items-center gap-1 transition-colors ${
                    previewMode ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                  onClick={() => setPreviewMode(true)}
                >
                  <Eye className="h-3 w-3" /> Preview
                </button>
              </div>
            </div>
            {previewMode ? (
              <div className="w-full px-3 py-2 border rounded-md bg-background min-h-[400px] overflow-auto">
                <MarkdownContent content={content} className="text-sm" />
              </div>
            ) : (
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background min-h-[400px] resize-y"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Markdown content for the skill
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Create Skill" : "Update Skill"}
          </Button>
        </div>
      </div>
    </div>
  );
}
