"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  Coins,
  FileEdit,
  Wrench,
  Settings,
  Menu,
  X,
  Keyboard,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ShortcutsHelp } from "@/components/shortcuts-help";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/team", label: "Team Board", icon: Users },
  { href: "/sessions", label: "Sessions", icon: Clock },
  { href: "/tokens", label: "Tokens", icon: Coins },
  { href: "/toolbox", label: "Toolbox", icon: Wrench },
  { href: "/editor", label: "CLAUDE.md", icon: FileEdit },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const handleShowHelp = () => {
    document.dispatchEvent(new CustomEvent("toggle-shortcuts-help"));
  };

  return (
    <>
      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutsHelp />

      {/* Mobile Hamburger Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden h-8 w-8 p-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static
          inset-y-0 left-0
          z-40
          w-56
          border-r
          bg-background
          p-4
          flex
          flex-col
          transition-transform
          duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="font-bold text-lg mb-6 flex items-center gap-2">
          <span className="text-xl">⚡</span>
          Super Claude Code
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted"
                  }
                `}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">v0.5.0</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-70 hover:opacity-100 transition-opacity"
              onClick={handleShowHelp}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
