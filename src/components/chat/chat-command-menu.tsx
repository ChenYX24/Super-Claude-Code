"use client";

import { useEffect, useRef } from "react";
import { Terminal, Zap, Hash } from "lucide-react";
import type { ChatCommand } from "@/lib/chat-commands";
import { filterCommands, groupByCategory, CATEGORY_LABELS } from "@/lib/chat-commands";

interface ChatCommandMenuProps {
  input: string;
  commands: ChatCommand[];
  selectedIndex: number;
  onSelect: (cmd: ChatCommand) => void;
}

const CATEGORY_ICONS: Record<string, typeof Terminal> = {
  "built-in": Terminal,
  slash: Hash,
  skill: Zap,
};

export function ChatCommandMenu({ input, commands, selectedIndex, onSelect }: ChatCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = filterCommands(commands, input);
  const groups = groupByCategory(filtered);

  // Build flat list for index mapping
  const flatList: ChatCommand[] = [];
  for (const [, cmds] of groups) flatList.push(...cmds);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < flatList.length) {
      const el = menuRef.current?.querySelector(`[data-cmd-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, input]);

  if (flatList.length === 0) {
    return (
      <div
        ref={menuRef}
        className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-lg shadow-lg p-3 z-50"
      >
        <p className="text-sm text-muted-foreground text-center">No matching commands</p>
      </div>
    );
  }

  let globalIdx = 0;

  return (
    <div
      ref={menuRef}
      id="cmd-menu"
      role="listbox"
      aria-label="Commands"
      className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
    >
      <div className="max-h-[280px] overflow-y-auto p-1.5">
        {groups.map(([category, cmds]) => {
          const Icon = CATEGORY_ICONS[category] || Terminal;
          const label = CATEGORY_LABELS[category] || category;
          return (
            <div key={category}>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <Icon className="h-3 w-3" />
                {label}
              </div>
              {cmds.map((cmd) => {
                const idx = globalIdx++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.name}
                    id={`cmd-item-${idx}`}
                    data-cmd-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
                      isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                    }`}
                    onClick={() => onSelect(cmd)}
                    onPointerDown={(e) => e.preventDefault()}
                  >
                    <span className="font-mono text-sm font-medium min-w-[100px]">{cmd.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{cmd.description}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
