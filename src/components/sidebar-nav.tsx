"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { usePluginSidebarItems } from "@/hooks/use-plugins";
import type { LucideIcon } from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/team", label: "Team Board", icon: Users },
  { href: "/sessions", label: "Sessions", icon: Clock },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/tokens", label: "Tokens", icon: Coins },
  { href: "/toolbox", label: "Toolbox", icon: Wrench },
  { href: "/editor", label: "Instructions", icon: FileEdit },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const pluginSidebarGroups = usePluginSidebarItems();

  // Persist collapsed state in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  const handleShowHelp = () => {
    document.dispatchEvent(new CustomEvent("toggle-shortcuts-help"));
  };

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Swipe-to-open: detect edge swipe from left
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Only capture edge swipes (within 20px of left edge)
      if (touch.clientX < 20 && !isOpen) {
        touchStartXRef.current = touch.clientX;
      }
      // Capture swipes on the sidebar when open
      if (isOpen && sidebarRef.current) {
        touchStartXRef.current = touch.clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartXRef.current === null) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartXRef.current;

      // Swipe right from edge to open
      if (!isOpen && deltaX > 60) {
        setIsOpen(true);
        touchStartXRef.current = null;
      }
      // Swipe left to close
      if (isOpen && deltaX < -60) {
        setIsOpen(false);
        touchStartXRef.current = null;
      }
    };

    const handleTouchEnd = () => {
      touchStartXRef.current = null;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    },
    [isOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutsHelp />

      {/* Mobile Hamburger Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-3 left-3 z-50 lg:hidden h-10 w-10 p-0 touch-manipulation"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-30 lg:hidden
          transition-opacity duration-300
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed lg:static
          inset-y-0 left-0
          z-40
          ${collapsed ? "lg:w-14" : "lg:w-56"}
          w-64
          border-r
          bg-background
          ${collapsed ? "lg:px-2 lg:py-4 px-4 py-4" : "p-4"}
          flex
          flex-col
          transition-all
          duration-300
          ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className={`font-bold text-lg mb-6 flex items-center ${collapsed ? "lg:justify-center" : "justify-between"} gap-2`}>
          {collapsed ? (
            <>
              {/* On mobile when sidebar is open, show full header even if collapsed on desktop */}
              <div className="lg:hidden flex items-center gap-2 min-w-0">
                <span className="text-xl">⚡</span>
                <span className="truncate">Super Claude Code</span>
              </div>
              <span className="text-xl hidden lg:block" title="Super Claude Code">⚡</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl">⚡</span>
                <span className="truncate">Super Claude Code</span>
              </div>
              <NotificationBell />
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center ${collapsed ? "lg:justify-center" : "gap-3"} gap-3
                  ${collapsed ? "lg:px-0 lg:py-2 px-3 py-3" : "px-3 py-3"}
                  rounded-md text-sm transition-colors
                  min-h-[44px]
                  touch-manipulation
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted active:bg-muted/80"
                  }
                `}
              >
                <item.icon className="h-5 w-5 flex-shrink-0 lg:h-4 lg:w-4" />
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
              </Link>
            );
          })}

          {/* Plugin sidebar items */}
          {pluginSidebarGroups.length > 0 && (
            <>
              <div className={`pt-3 pb-1 ${collapsed ? "lg:hidden" : ""}`}>
                <div className="flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Puzzle className="h-3 w-3" />
                  <span>Plugins</span>
                </div>
              </div>
              {pluginSidebarGroups.map((group) =>
                group.items.map((sidebarItem) => {
                  const href = sidebarItem.path.startsWith("/")
                    ? sidebarItem.path
                    : `/plugins/${group.pluginId}${sidebarItem.path ? `/${sidebarItem.path}` : ""}`;
                  const isActive = pathname === href || pathname.startsWith(`${href}/`);
                  const Icon: LucideIcon = (typeof sidebarItem.icon === "function" ? sidebarItem.icon : Puzzle) as LucideIcon;

                  return (
                    <Link
                      key={`${group.pluginId}-${sidebarItem.path}`}
                      href={href}
                      onClick={() => setIsOpen(false)}
                      title={collapsed ? sidebarItem.label : undefined}
                      className={`
                        flex items-center ${collapsed ? "lg:justify-center" : "gap-3"} gap-3
                        ${collapsed ? "lg:px-0 lg:py-2 px-3 py-3" : "px-3 py-3"}
                        rounded-md text-sm transition-colors
                        min-h-[44px]
                        touch-manipulation
                        ${
                          isActive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted active:bg-muted/80"
                        }
                      `}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0 lg:h-4 lg:w-4" />
                      <span className={collapsed ? "lg:hidden" : ""}>{sidebarItem.label}</span>
                    </Link>
                  );
                })
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={`flex items-center ${collapsed ? "lg:flex-col lg:gap-2 gap-2" : "justify-between"} pt-4 border-t`}>
          {collapsed ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 opacity-70 hover:opacity-100 hidden lg:flex touch-manipulation"
                onClick={toggleCollapsed}
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">v1.2.0</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-70 hover:opacity-100 transition-opacity touch-manipulation"
                  onClick={handleShowHelp}
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 opacity-70 hover:opacity-100 hidden lg:flex touch-manipulation"
                  onClick={toggleCollapsed}
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
                <ThemeToggle />
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
