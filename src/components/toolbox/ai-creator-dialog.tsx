"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/markdown-content";
import { useToast } from "@/components/toast";
import {
  Sparkles,
  Bot,
  BookOpen,
  X,
  Eye,
  Pencil,
  Loader2,
  Wand2,
  Save,
  RotateCcw,
} from "lucide-react";

// ---- Types ----

type CreatorType = "skill" | "agent" | "rule";

interface AiCreatorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: CreatorType;
}

const TYPE_CONFIG: Record<CreatorType, { label: string; icon: typeof Sparkles; color: string; description: string }> = {
  skill: {
    label: "Skill",
    icon: Sparkles,
    color: "text-amber-500",
    description: "Reusable prompt template invoked via the Skill tool",
  },
  agent: {
    label: "Agent",
    icon: Bot,
    color: "text-pink-500",
    description: "Specialized persona with system prompt and model preference",
  },
  rule: {
    label: "Rule",
    icon: BookOpen,
    color: "text-cyan-500",
    description: "Instruction file Claude follows automatically",
  },
};

// ---- Step definitions ----

type Step = "input" | "generating" | "preview";

// ---- Helper: parse SSE stream for generated text ----

function parseAssistantText(event: Record<string, unknown>): string {
  if (event.type !== "assistant") return "";
  const message = event.message as Record<string, unknown> | undefined;
  if (!message?.content) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    let text = "";
    for (const block of content) {
      if (block?.type === "text" && typeof block.text === "string") {
        text += block.text;
      }
    }
    return text;
  }
  return "";
}

function parseResultText(event: Record<string, unknown>): string {
  if (event.type !== "result") return "";
  const result = event.result;
  if (typeof result === "string") return result;
  return "";
}

// ---- Component ----

export function AiCreatorDialog({ open, onClose, onSuccess, defaultType = "skill" }: AiCreatorDialogProps) {
  const { toast } = useToast();

  // State
  const [step, setStep] = useState<Step>("input");
  const [type, setType] = useState<CreatorType>(defaultType);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [ruleGroup, setRuleGroup] = useState("common");
  const [generatedContent, setGeneratedContent] = useState("");
  const [previewMode, setPreviewMode] = useState(true);
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("input");
      setType(defaultType);
      setDescription("");
      setName("");
      setRuleGroup("common");
      setGeneratedContent("");
      setPreviewMode(true);
      setSaving(false);
    }
  }, [open, defaultType]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  // ---- Generate ----

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) {
      toast("Please describe what you want to create", "error");
      return;
    }

    setStep("generating");
    setGeneratedContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/toolbox/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), type }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        toast(err.error || "Generation failed", "error");
        setStep("input");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);

          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);

            const assistantText = parseAssistantText(event);
            if (assistantText) {
              fullText = assistantText;
              setGeneratedContent(fullText);
            }

            const resultText = parseResultText(event);
            if (resultText && !fullText) {
              fullText = resultText;
              setGeneratedContent(fullText);
            }

            if (event.type === "error") {
              toast(`Generation error: ${event.error}`, "error");
              setStep("input");
              return;
            }
          } catch {
            /* skip malformed JSON */
          }
        }
      }

      if (fullText.trim()) {
        // Strip code fences if the model wrapped the output
        const cleaned = stripCodeFences(fullText.trim());
        setGeneratedContent(cleaned);
        setStep("preview");

        // Try to extract a name from the content
        if (!name.trim()) {
          const extracted = extractName(cleaned, type);
          if (extracted) setName(extracted);
        }
      } else {
        toast("No content generated. Please try again.", "error");
        setStep("input");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      toast("Failed to connect to Claude. Is the CLI installed?", "error");
      setStep("input");
    } finally {
      abortRef.current = null;
    }
  }, [description, type, name, toast]);

  // ---- Save ----

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast("Please provide a name", "error");
      return;
    }
    if (!generatedContent.trim()) {
      toast("No content to save", "error");
      return;
    }

    // Validate name format
    if (/[/\\.]/.test(name)) {
      toast("Name must not contain /, \\, or . characters", "error");
      return;
    }

    setSaving(true);

    try {
      let endpoint: string;
      let body: Record<string, string>;

      if (type === "skill") {
        endpoint = "/api/toolbox/skills";
        body = { name: name.trim(), content: generatedContent };
      } else if (type === "agent") {
        endpoint = "/api/toolbox/agents";
        body = { name: name.trim(), content: generatedContent };
      } else {
        endpoint = "/api/toolbox/rules";
        body = { group: ruleGroup.trim() || "common", name: name.trim(), content: generatedContent };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || `${TYPE_CONFIG[type].label} created successfully`, "success");
        onSuccess();
        onClose();
      } else {
        toast(data.error || "Save failed", "error");
      }
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }, [name, generatedContent, type, ruleGroup, toast, onSuccess, onClose]);

  // ---- Helpers ----

  if (!open) return null;

  const TypeIcon = TYPE_CONFIG[type].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI Creator
            {step !== "input" && (
              <Badge variant="secondary" className="ml-2 gap-1">
                <TypeIcon className={`h-3 w-3 ${TYPE_CONFIG[type].color}`} />
                {TYPE_CONFIG[type].label}
              </Badge>
            )}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {step === "input" && (
            <>
              {/* Type selector */}
              <div>
                <label className="text-sm font-medium block mb-2">What do you want to create?</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(TYPE_CONFIG) as CreatorType[]).map((t) => {
                    const config = TYPE_CONFIG[t];
                    const Icon = config.icon;
                    const selected = type === t;
                    return (
                      <button
                        key={t}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-muted/30 hover:bg-muted/60"
                        }`}
                        onClick={() => setType(t)}
                      >
                        <Icon className={`h-6 w-6 ${config.color}`} />
                        <span className="text-sm font-medium">{config.label}</span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">
                          {config.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description input */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Describe what you want this {TYPE_CONFIG[type].label.toLowerCase()} to do
                </label>
                <textarea
                  ref={textareaRef}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background min-h-[120px] resize-y"
                  placeholder={getPlaceholder(type)}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Be specific about the behavior, constraints, and use cases you have in mind.
                </p>
              </div>

              {/* Optional: pre-fill name */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Name <span className="text-muted-foreground font-normal">(optional, can set after generation)</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
                  placeholder={type === "skill" ? "my-skill" : type === "agent" ? "my-agent" : "my-rule"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Rule group selector */}
              {type === "rule" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Rule Group</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
                    placeholder="common"
                    value={ruleGroup}
                    onChange={(e) => setRuleGroup(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Group folder under ~/.claude/rules/ (e.g., common, python, typescript)
                  </p>
                </div>
              )}
            </>
          )}

          {step === "generating" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Generating {TYPE_CONFIG[type].label.toLowerCase()}...</p>
                  <p className="text-xs text-muted-foreground">Claude is creating your content</p>
                </div>
              </div>
              {generatedContent && (
                <div className="border rounded-lg p-4 bg-muted/20 max-h-[400px] overflow-auto">
                  <MarkdownContent content={generatedContent} className="text-sm" />
                </div>
              )}
            </div>
          )}

          {step === "preview" && (
            <>
              {/* Name (required before save) */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  {TYPE_CONFIG[type].label} Name *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
                  placeholder={type === "skill" ? "my-skill" : type === "agent" ? "my-agent" : "my-rule"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {type === "skill"
                    ? `Will be saved as ~/.claude/skills/${name || "skill-name"}/SKILL.md`
                    : type === "agent"
                    ? `Will be saved as ~/.claude/agents/${name || "agent-name"}.md`
                    : `Will be saved as ~/.claude/rules/${ruleGroup}/${name || "rule-name"}.md`}
                </p>
              </div>

              {/* Rule group (editable in preview too) */}
              {type === "rule" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Rule Group</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background"
                    placeholder="common"
                    value={ruleGroup}
                    onChange={(e) => setRuleGroup(e.target.value)}
                  />
                </div>
              )}

              {/* Content with edit/preview toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium">Generated Content</label>
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
                  <div className="w-full px-3 py-2 border rounded-md bg-background min-h-[300px] max-h-[400px] overflow-auto">
                    <MarkdownContent content={generatedContent} className="text-sm" />
                  </div>
                ) : (
                  <textarea
                    className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-background min-h-[300px] max-h-[400px] resize-y"
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    spellCheck={false}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between shrink-0">
          <div>
            {step === "preview" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setStep("input");
                  setGeneratedContent("");
                  setPreviewMode(true);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            {step === "input" && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleGenerate}
                disabled={!description.trim()}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Generate
              </Button>
            )}
            {step === "generating" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  abortRef.current?.abort();
                  setStep("input");
                }}
              >
                Cancel Generation
              </Button>
            )}
            {step === "preview" && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save {TYPE_CONFIG[type].label}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Utility functions ----

function getPlaceholder(type: CreatorType): string {
  switch (type) {
    case "skill":
      return "e.g., A skill that reviews pull requests focusing on security vulnerabilities, code quality, and performance. It should check for OWASP top 10 issues and suggest fixes.";
    case "agent":
      return "e.g., A documentation agent that generates API docs from source code. It should analyze function signatures, JSDoc comments, and usage patterns to produce comprehensive markdown documentation.";
    case "rule":
      return "e.g., Rules for Python projects: always use type hints, prefer dataclasses over dicts, use pathlib instead of os.path, follow PEP 8 naming conventions.";
  }
}

function stripCodeFences(text: string): string {
  // Remove wrapping ```markdown ... ``` or ``` ... ```
  const fenceMatch = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) return fenceMatch[1];
  return text;
}

function extractName(content: string, type: CreatorType): string {
  // Try to extract from YAML frontmatter
  const fmMatch = content.match(/^---\r?\n[\s\S]*?name:\s*(.+?)\r?\n[\s\S]*?---/);
  if (fmMatch) return fmMatch[1].trim();

  // Try to extract from first heading
  const headingMatch = content.match(/^#\s+(.+)/m);
  if (headingMatch) {
    const raw = headingMatch[1].trim();
    // Convert to kebab-case
    const kebab = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (kebab && kebab.length <= 40) return kebab;
  }

  return "";
}
