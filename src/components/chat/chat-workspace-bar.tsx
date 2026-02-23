"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, ChevronUp, HardDrive, FileText, Columns2 } from "lucide-react";
import type { PermissionMode } from "@/lib/chat-types";
import { ProviderSelector } from "./provider-selector";

interface BrowseEntry {
  name: string;
  path: string;
  isDir: boolean;
  hasClaudeMd: boolean;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  hasClaudeMd: boolean;
  entries: BrowseEntry[];
  isDriveList?: boolean;
}

const PERMISSION_OPTIONS: { value: PermissionMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "trust", label: "Trust All" },
  { value: "acceptEdits", label: "Accept Edits" },
  { value: "readOnly", label: "Read Only" },
  { value: "plan", label: "Plan Mode" },
];

interface ChatWorkspaceBarProps {
  cwd: string;
  onCwdChange: (path: string) => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  provider: string;
  onProviderChange: (provider: string) => void;
  compareMode?: boolean;
  onCompareModeChange?: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ChatWorkspaceBar({
  cwd,
  onCwdChange,
  permissionMode,
  onPermissionModeChange,
  provider,
  onProviderChange,
  compareMode,
  onCompareModeChange,
  disabled,
}: ChatWorkspaceBarProps) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!browserOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setBrowserOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [browserOpen]);

  const browse = useCallback(async (dirPath?: string) => {
    setBrowseLoading(true);
    try {
      const url = dirPath
        ? `/api/browse?path=${encodeURIComponent(dirPath)}`
        : "/api/browse";
      const res = await fetch(url);
      if (res.ok) {
        setBrowseData(await res.json());
      }
    } catch (err) {
      console.error("Browse error:", err);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const openBrowser = () => {
    setBrowserOpen(true);
    // Browse from current cwd, or drives if none selected
    browse(cwd || undefined);
  };

  const selectFolder = (path: string) => {
    onCwdChange(path);
    setBrowserOpen(false);
  };

  // Truncate displayed path
  const displayPath = cwd
    ? cwd.length > 40
      ? "..." + cwd.slice(-37)
      : cwd
    : "Select working directory...";

  return (
    <div className="border-t bg-muted/20 px-4 py-1.5 flex-shrink-0">
      <div className="max-w-4xl mx-auto flex items-center gap-2">
        {/* Folder selector */}
        <div className="relative flex-1 min-w-0" ref={popoverRef}>
          <button
            type="button"
            onClick={openBrowser}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-full disabled:opacity-50"
            title={cwd || "Select working directory"}
          >
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{displayPath}</span>
          </button>

          {/* Directory browser popover */}
          {browserOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-80 max-h-72 bg-popover border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2 text-xs font-medium flex-shrink-0">
                <span className="truncate flex-1">
                  {browseData?.isDriveList ? "Drives" : browseData?.current || "..."}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {browseData?.parent && (
                    <button
                      type="button"
                      onClick={() => browse(browseData.parent!)}
                      className="p-1 rounded hover:bg-muted"
                      title="Go up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => browse()}
                    className="p-1 rounded hover:bg-muted"
                    title="Drives"
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Select current directory button */}
              {browseData && !browseData.isDriveList && (
                <button
                  type="button"
                  onClick={() => selectFolder(browseData.current)}
                  className="px-3 py-1.5 text-xs text-left hover:bg-primary/10 text-primary font-medium border-b flex items-center gap-1.5 flex-shrink-0"
                >
                  <FolderOpen className="h-3 w-3" />
                  Select this folder
                  {browseData.hasClaudeMd && (
                    <span title="Has CLAUDE.md"><FileText className="h-3 w-3 text-amber-500 ml-auto" /></span>
                  )}
                </button>
              )}

              {/* Entries */}
              <div className="overflow-y-auto flex-1">
                {browseLoading ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">Loading...</div>
                ) : browseData?.entries.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">No subdirectories</div>
                ) : (
                  browseData?.entries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => entry.isDir && browse(entry.path)}
                      onDoubleClick={() => entry.isDir && selectFolder(entry.path)}
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-1.5"
                      title={`${entry.path}${entry.hasClaudeMd ? " (has CLAUDE.md)" : ""} — double-click to select`}
                    >
                      <FolderOpen className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{entry.name}</span>
                      {entry.hasClaudeMd && (
                        <FileText className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Provider selector */}
        <ProviderSelector
          value={provider}
          onChange={onProviderChange}
          disabled={disabled}
        />

        {/* Permission mode selector */}
        <select
          value={permissionMode}
          onChange={(e) => onPermissionModeChange(e.target.value as PermissionMode)}
          disabled={disabled}
          className="text-xs bg-muted border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 cursor-pointer"
          title="Permission mode"
        >
          {PERMISSION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Compare mode toggle */}
        {onCompareModeChange && (
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onCompareModeChange(!compareMode)}
            disabled={disabled}
            title="Compare two providers side-by-side"
          >
            <Columns2 className="h-3.5 w-3.5 mr-1" />
            Compare
          </Button>
        )}
      </div>
    </div>
  );
}
