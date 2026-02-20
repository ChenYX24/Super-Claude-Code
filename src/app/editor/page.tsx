"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClaudeMdFile } from "@/lib/claudemd";
import {
  Save, AlertCircle, Check, Plus, X, FolderPlus,
  Folder, FolderOpen, ChevronRight, ArrowUp, FileText,
  Trash2, HardDrive,
} from "lucide-react";
import { useToast } from "@/components/toast";

interface ProjectOption {
  encoded: string;
  decoded: string;
  hasClaudeMd: boolean;
  claudeMdPath: string;
}

interface BrowseEntry {
  name: string;
  path: string;
  isDir: boolean;
  hasClaudeMd: boolean;
}

type CreateTab = "projects" | "browse" | "custom";

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
  const [createTab, setCreateTab] = useState<CreateTab>("projects");
  // Browse state
  const [browsePath, setBrowsePath] = useState<string>("");
  const [browseEntries, setBrowseEntries] = useState<BrowseEntry[]>([]);
  const [browseParent, setBrowseParent] = useState<string | null>(null);
  const [browseHasClaudeMd, setBrowseHasClaudeMd] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  // Custom path state
  const [customPath, setCustomPath] = useState<string>("");
  const [createError, setCreateError] = useState<string>("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  useEffect(() => { loadFileList(); }, [loadFileList]);

  // Load file content
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
        toast("CLAUDE.md saved successfully");
      } else {
        setSaveStatus("error");
        toast("Failed to save CLAUDE.md", "error");
      }
    } catch {
      setSaveStatus("error");
      toast("Failed to save CLAUDE.md", "error");
    }
    finally { setSaving(false); }
  }, [selectedFile, content, toast]);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!selectedFile) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/claudemd?path=${encodeURIComponent(selectedFile)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShowDeleteConfirm(false);
        const listRes = await fetch("/api/claudemd");
        const listData = await listRes.json();
        setFiles(listData.files || []);
        setProjects(listData.projects || []);
        setSelectedFile(listData.files?.[0]?.path || null);
        setContent("");
        setOriginalContent("");
      }
    } catch {
      toast("Failed to delete CLAUDE.md", "error");
    } finally { setDeleting(false); }
  };

  // Reload files and select new path
  const afterCreate = async (newPath: string) => {
    setShowCreateDialog(false);
    setCreateError("");
    const listRes = await fetch("/api/claudemd");
    const listData = await listRes.json();
    setFiles(listData.files || []);
    setProjects(listData.projects || []);
    setSelectedFile(newPath);
  };

  // Open an existing file by path (register it if not in list)
  const openFilePath = async (filePath: string) => {
    // Check if already in file list
    const existing = files.find((f) => f.path === filePath);
    if (existing) {
      setSelectedFile(filePath);
      return;
    }
    // Register the file via API so it appears in future lists
    await fetch("/api/claudemd/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    // Reload file list
    const listRes = await fetch("/api/claudemd");
    const listData = await listRes.json();
    setFiles(listData.files || []);
    setProjects(listData.projects || []);
    setSelectedFile(filePath);
  };

  // Create from project preset
  const handleCreateFromProject = async (projectEncoded: string) => {
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/claudemd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectEncoded }),
      });
      const data = await res.json();
      if (res.ok && data.path) {
        await afterCreate(data.path);
      } else {
        setCreateError(data.error || "Failed to create");
      }
    } catch { setCreateError("Network error"); }
    finally { setCreating(false); }
  };

  // Create from custom/browse path
  const handleCreateAtPath = async (dirPath: string) => {
    if (!dirPath.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/claudemd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPath: dirPath.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.path) {
        await afterCreate(data.path);
      } else {
        setCreateError(data.error || "Failed to create");
      }
    } catch { setCreateError("Network error"); }
    finally { setCreating(false); }
  };

  const [browseIsDriveList, setBrowseIsDriveList] = useState(false);

  // Browse directory (updated to handle drive list)
  const browseToDir = async (dirPath: string) => {
    setBrowseLoading(true);
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (res.ok) {
        setBrowsePath(data.current);
        setBrowseEntries(data.entries || []);
        setBrowseParent(data.parent);
        setBrowseHasClaudeMd(data.hasClaudeMd);
        setBrowseIsDriveList(!!data.isDriveList);
      }
    } catch { /* skip */ }
    finally { setBrowseLoading(false); }
  };

  // Alias for JSX usage
  const browseTo = browseToDir;

  // Initialize browse when tab opens — start at drive list
  useEffect(() => {
    if (createTab === "browse" && !browsePath) {
      browseToDir("__drives__");
    }
  }, [createTab, browsePath]);

  // Ctrl+S
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

        <div className="flex items-center gap-3">
          <select
            value={selectedFile || ""}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background text-sm cursor-pointer"
          >
            {files.length === 0 && <option value="">No CLAUDE.md files</option>}
            {files.map((file) => (
              <option key={file.path} value={file.path}>{file.label}</option>
            ))}
          </select>

          {/* Create button */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowCreateDialog(!showCreateDialog); setCreateError(""); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>

            {/* Create dialog */}
            {showCreateDialog && (
              <div
                ref={dialogRef}
                className="absolute top-full left-0 mt-1 w-96 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
              >
                {/* Dialog header */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <FolderPlus className="h-4 w-4" />
                    Create CLAUDE.md
                  </span>
                  <button onClick={() => setShowCreateDialog(false)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                  {([
                    { key: "projects" as const, label: "Projects" },
                    { key: "browse" as const, label: "Browse" },
                    { key: "custom" as const, label: "Custom Path" },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                        createTab === tab.key
                          ? "border-b-2 border-primary text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setCreateTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Error display */}
                {createError && (
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 text-red-600 text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {createError}
                  </div>
                )}

                {/* Tab content */}
                <div className="max-h-72 overflow-auto">
                  {/* Projects tab */}
                  {createTab === "projects" && (
                    creatableProjects.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                        All projects already have CLAUDE.md
                      </div>
                    ) : (
                      creatableProjects.map((project) => (
                        <button
                          key={project.encoded}
                          disabled={creating}
                          onClick={() => handleCreateFromProject(project.encoded)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors border-b last:border-b-0 flex items-center gap-2"
                        >
                          <FolderPlus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{project.decoded}</span>
                          <Badge variant="outline" className="ml-auto text-xs flex-shrink-0">New</Badge>
                        </button>
                      ))
                    )
                  )}

                  {/* Browse tab */}
                  {createTab === "browse" && (
                    <div>
                      {/* Current path */}
                      <div className="px-3 py-2 bg-muted/20 border-b flex items-center gap-2">
                        {browseIsDriveList ? (
                          <HardDrive className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-xs font-mono truncate flex-1">{browsePath}</span>
                        {browseHasClaudeMd && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            <FileText className="h-3 w-3 mr-1" />
                            Exists
                          </Badge>
                        )}
                      </div>

                      {/* Create here / Open + Go up / Drives buttons */}
                      {!browseIsDriveList && (
                        <div className="px-3 py-2 border-b flex gap-2">
                          {browseHasClaudeMd ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                const sep = browsePath.includes("/") ? "/" : "\\";
                                const claudeMdPath = browsePath.replace(/[/\\]$/, "") + sep + "CLAUDE.md";
                                openFilePath(claudeMdPath);
                                setShowCreateDialog(false);
                              }}
                              className="flex-1 text-xs"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Open existing
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={creating}
                              onClick={() => handleCreateAtPath(browsePath)}
                              className="flex-1 text-xs"
                            >
                              <FolderPlus className="h-3.5 w-3.5 mr-1" />
                              Create here
                            </Button>
                          )}
                          {browseParent ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => browseTo(browseParent)}
                              disabled={browseLoading}
                              className="text-xs"
                            >
                              <ArrowUp className="h-3.5 w-3.5 mr-1" />
                              Up
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => browseToDir("__drives__")}
                              disabled={browseLoading}
                              className="text-xs"
                            >
                              <HardDrive className="h-3.5 w-3.5 mr-1" />
                              Drives
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Directory listing */}
                      {browseLoading ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">Loading...</div>
                      ) : browseEntries.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">No subdirectories</div>
                      ) : (
                        browseEntries.map((entry) => (
                          <button
                            key={entry.path}
                            onClick={() => browseTo(entry.path)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors border-b last:border-b-0 flex items-center gap-2"
                          >
                            {browseIsDriveList ? (
                              <HardDrive className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            ) : entry.hasClaudeMd ? (
                              <FolderOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            ) : (
                              <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="truncate">{entry.name}</span>
                            {entry.hasClaudeMd && (
                              <Badge variant="secondary" className="ml-auto text-xs flex-shrink-0">
                                <FileText className="h-3 w-3" />
                              </Badge>
                            )}
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-auto" />
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Custom path tab */}
                  {createTab === "custom" && (
                    <div className="p-3 space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Directory path (CLAUDE.md will be created inside):
                        </label>
                        <input
                          type="text"
                          value={customPath}
                          onChange={(e) => setCustomPath(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateAtPath(customPath);
                          }}
                          placeholder="E:\my-project or /home/user/project"
                          className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
                          autoFocus
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!customPath.trim() || creating}
                        onClick={() => handleCreateAtPath(customPath)}
                        className="w-full"
                      >
                        <FolderPlus className="h-4 w-4 mr-1" />
                        {creating ? "Creating..." : "Create CLAUDE.md"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedFileObj && (
            <>
              <span className="text-xs text-muted-foreground font-mono truncate max-w-md">
                {selectedFileObj.path}
              </span>
              <div className="relative ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {showDeleteConfirm && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 p-3">
                    <p className="text-sm mb-2">
                      Delete <strong>{selectedFileObj.label}</strong>?
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      This will permanently delete the file.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
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

        <div className="flex flex-col border rounded-md overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b">
            <h2 className="text-sm font-medium">Preview</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <MarkdownContent content={content} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {hasChanges && (
            <span className="text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />Unsaved changes
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="h-4 w-4" />Saved successfully
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />Save failed
            </span>
          )}
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save (Ctrl+S)"}
        </Button>
      </div>
    </div>
  );
}
