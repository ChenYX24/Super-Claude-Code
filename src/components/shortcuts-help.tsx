"use client";

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHORTCUTS = [
  {
    category: "Navigation",
    items: [
      { keys: ["1"], description: "Overview" },
      { keys: ["2"], description: "Team Board" },
      { keys: ["3"], description: "Sessions" },
      { keys: ["4"], description: "Chat" },
      { keys: ["5"], description: "Tokens" },
      { keys: ["6"], description: "Toolbox" },
      { keys: ["7"], description: "CLAUDE.md" },
      { keys: ["8"], description: "Settings" },
    ],
  },
  {
    category: "General",
    items: [
      { keys: ["?"], description: "Show/hide this help" },
      { keys: ["/"], description: "Focus search (if available)" },
      { keys: ["Esc"], description: "Close modals" },
    ],
  },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    document.addEventListener("toggle-shortcuts-help", handleToggle);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("toggle-shortcuts-help", handleToggle);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Keyboard Shortcuts
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {SHORTCUTS.map((category) => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.items.map((shortcut) => (
                  <div
                    key={shortcut.keys.join("+")}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="px-2 py-1 text-xs font-mono bg-muted border rounded min-w-[1.5rem] text-center"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Tip: Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-background border rounded">?</kbd> anytime to toggle this help dialog
          </p>
        </div>
      </div>
    </div>
  );
}
