"use client";

import { useEffect, useState } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import type { ClaudeMdFile } from "@/lib/claudemd";
import { Save, AlertCircle, Check } from "lucide-react";

export default function EditorPage() {
  const [files, setFiles] = useState<ClaudeMdFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  // Load file list
  useEffect(() => {
    fetch("/api/claudemd")
      .then((res) => res.json())
      .then((data) => {
        setFiles(data.files || []);
        if (data.files && data.files.length > 0) {
          setSelectedFile(data.files[0].path);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load files:", err);
        setLoading(false);
      });
  }, []);

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
      .catch((err) => {
        console.error("Failed to load content:", err);
        setLoading(false);
      });
  }, [selectedFile]);

  // Save handler
  const handleSave = async () => {
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
    } catch (err) {
      console.error("Failed to save:", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !saving) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, originalContent, saving, selectedFile]);

  const hasChanges = content !== originalContent;

  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No CLAUDE.md files found</p>
      </div>
    );
  }

  const selectedFileObj = files.find((f) => f.path === selectedFile);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">CLAUDE.md Editor</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Edit global and project-level CLAUDE.md files
        </p>

        {/* File Selector */}
        <div className="flex items-center gap-4">
          <select
            value={selectedFile || ""}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background text-sm"
          >
            {files.map((file) => (
              <option key={file.path} value={file.path}>
                {file.label}
              </option>
            ))}
          </select>

          {selectedFileObj && (
            <span className="text-xs text-muted-foreground font-mono">
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

        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save (Ctrl+S)"}
        </button>
      </div>
    </div>
  );
}
