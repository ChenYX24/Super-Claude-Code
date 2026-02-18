"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { MarkdownContent } from "@/components/markdown-content";
import { BookOpen, X, Eye, Pencil } from "lucide-react";

interface RuleInfo {
  name: string;
  group: string;
  preview: string;
  content: string;
  path: string;
}

interface RuleDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  rule: RuleInfo | null;
  existingGroups: string[];
  onSuccess: () => void;
}

export function RuleDialog({ open, onClose, mode, rule, existingGroups, onSuccess }: RuleDialogProps) {
  const { toast } = useToast();
  const [group, setGroup] = useState(rule?.group || "common");
  const [name, setName] = useState(rule?.name || "");
  const [content, setContent] = useState(rule?.content || "# Rule Title\n\nRule content here...");
  const [submitting, setSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (open) {
      setGroup(rule?.group || "common");
      setName(rule?.name || "");
      setContent(rule?.content || "# Rule Title\n\nRule content here...");
      setPreviewMode(false);
    }
  }, [open, rule]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim() || !group.trim()) {
      toast("Group, name, and content are required", "error");
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "add") {
        const res = await fetch("/api/toolbox/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group: group.trim(),
            name: name.trim(),
            content,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          toast(data.message || "Rule created successfully", "success");
          onSuccess();
          onClose();
        } else {
          toast(data.error || "Operation failed", "error");
        }
      } else {
        // Edit mode - use path
        const res = await fetch("/api/toolbox/rules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: rule?.path,
            content,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          toast(data.message || "Rule updated successfully", "success");
          onSuccess();
          onClose();
        } else {
          toast(data.error || "Operation failed", "error");
        }
      }
    } catch (error) {
      toast("Failed to save rule", "error");
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
            <BookOpen className="h-5 w-5 text-primary" />
            {mode === "add" ? "Create Rule" : "Edit Rule"}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {mode === "add" && (
            <div>
              <label className="text-sm font-medium block mb-1.5">Group *</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 px-3 py-2 border rounded-md text-sm bg-background"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  {existingGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="">-- New Group --</option>
                </select>
                {!group && (
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border rounded-md text-sm font-mono bg-background"
                    placeholder="new-group"
                    onChange={(e) => setGroup(e.target.value)}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Select existing group or create new
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1.5">Rule Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
              placeholder="my-rule"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mode === "edit"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be saved as {name || "rule-name"}.md
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
              Markdown content for the rule
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "add" ? "Create Rule" : "Update Rule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
