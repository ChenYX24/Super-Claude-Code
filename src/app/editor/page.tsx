"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClaudeMdFile } from "@/lib/claudemd";
import { Save, AlertCircle, Check, Plus, X, FolderPlus } from "lucide-react";

interface ProjectOption {
  encoded: string;
  decoded: string;
  hasClaudeMd: boolean;
  claudeMdPath: string;
}

export default function EditorPage() {
  const [files, setFiles] = useState<ClaudeMdFile[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const loadFileList = useCallback(() => {
    fetch("/api/claudemd")
      .then((res) => res.json())
      .then((data) => {
        setFiles(data.files || []);
        setProjects(data.projects || []);
        if (!selectedFile && data.files && data.files.length > 0) {
          setSelectedFile(data.files[0].path);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedFile]);

  // Load file list
  useEffect(() => { loadFileList(); }, [loadFileList]);

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedFile) return;
    setLoading(true);
    fetch(`/api/claudemd/content?path=${encodeURIComponent(selectedFile)}`)
      .then((res) => res.json())
      .then((data) => {
        setContent(data.content || "");
        setOriginalContent(data.content || "");
        setLoading(false);
        setSaveStatus("idle");
      })
      .catch(() => setLoading(false));
  }, [selectedFile]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/claudemd/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedFile, content }),
      });
      if (res.ok) {
        setOriginalContent(content);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [selectedFile, content]);

  // Create CLAUDE.md for a project
  const handleCreate = async (projectEncoded: string) => {
    setCreating(true);
    try {
      const res = await fetch("/api/claudemd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectEncoded }),
      });
      const data = await res.json();
      if (res.ok && data.path) {
        setShowCreateDialog(false);
        // Reload file list and select the new file
        const listRes = await fetch("/api/claudemd");
        const listData = await listRes.json();
        setFiles(listData.files || []);
        setProjects(listData.projects || []);
        setSelectedFile(data.path);
      }
    } catch { /* skip */ }
    finally { setCreating(false); }
  };

  // Ctrl+S shortcut
  const hasChanges = content !== originalContent;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !saving) handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasChanges, saving, handleSave]);

  // Close dialog on outside click
  useEffect(() => {
    if (!showCreateDialog) return;
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setShowCreateDialog(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCreateDialog]);

  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Projects that don't have CLAUDE.md yet
  const creatableProjects = projects.filter((p) => !p.hasClaudeMd);

  const selectedFileObj = files.find((f) => f.path === selectedFile);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">CLAUDE.md Editor</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Edit global and project-level CLAUDE.md files
        </p>

        {/* File Selector + Create Button */}
        <div className="flex items-center gap-3">
          <select
            value={selectedFile || ""}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background text-sm cursor-pointer"
          >
            {files.length === 0 && (
              <option value="">No CLAUDE.md files</option>
            )}
            {files.map((file) => (
              <option key={file.path} value={file.path}>
                {file.label}
              </option>
            ))}
          </select>

          {/* Create button */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(!showCreateDialog)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>

            {/* Create dialog dropdown */}
            {showCreateDialog && (
              <div
                ref={dialogRef}
                className="absolute top-full left-0 mt-1 w-80 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <FolderPlus className="h-4 w-4" />
                    Create CLAUDE.md
                  </span>
                  <button onClick={() => setShowCreateDialog(false)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="max-h-64 overflow-auto">
                  {creatableProjects.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      All projects already have CLAUDE.md
                    </div>
                  ) : (
                    creatableProjects.map((project) => (
                      <button
                        key={project.encoded}
                        disabled={creating}
                        onClick={() => handleCreate(project.encoded)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors border-b last:border-b-0 flex items-center gap-2"
                      >
                        <FolderPlus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{project.decoded}</span>
                        <Badge variant="outline" className="ml-auto text-xs flex-shrink-0">
                          New
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedFileObj && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-md">
              {selectedFileObj.path}
            </span>
          )}
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
        {/* Left: Editor */}
        <div className="flex flex-col border rounded-md overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b">
            <h2 className="text-sm font-medium">Editor</h2>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 p-4 font-mono text-sm bg-background resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Right: Preview */}
        <div className="flex flex-col border rounded-md overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b">
            <h2 className="text-sm font-medium">Preview</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <MarkdownContent content={content} />
          </div>
        </div>
      </div>

      {/* Footer: Save Button */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {hasChanges && (
            <span className="text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Unsaved changes
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" />
              Saved successfully
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Save failed
            </span>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save (Ctrl+S)"}
        </Button>
      </div>
    </div>
  );
}
