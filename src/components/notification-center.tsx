"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bell, DollarSign, Clock, Info, X, CheckCheck,
  Puzzle, MessageSquare, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ServerNotification {
  id: string;
  type: "cost" | "session" | "system" | "plugin" | "bot";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source?: string;
  meta?: Record<string, unknown>;
}

/**
 * Enhanced notification bell with real-time SSE updates from the
 * server-side notification queue (/api/notifications).
 */
export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // SSE connection for real-time updates
  useEffect(() => {
    const connect = () => {
      const es = new EventSource("/api/notifications?stream=true");
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "init" || data.type === "update") {
            setNotifications(data.notifications || []);
            setUnreadCount(data.unread ?? 0);
          }
        } catch {
          /* ignore parse errors */
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Fallback: poll every 30s if SSE drops
  useEffect(() => {
    if (connected) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/notifications?limit=20");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread ?? 0);
        }
      } catch {
        /* ignore */
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [connected]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", id }),
      });
    } catch {
      /* SSE will resync */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
    } catch {
      /* SSE will resync */
    }
  }, []);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
    } catch {
      /* SSE will resync */
    }
  }, []);

  const getIcon = (type: ServerNotification["type"]) => {
    switch (type) {
      case "cost":
        return <DollarSign className="h-4 w-4 text-orange-500" />;
      case "session":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "system":
        return <Info className="h-4 w-4 text-purple-500" />;
      case "plugin":
        return <Puzzle className="h-4 w-4 text-green-500" />;
      case "bot":
        return <MessageSquare className="h-4 w-4 text-pink-500" />;
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-background border rounded-lg shadow-lg z-50 max-h-[500px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Notifications</h3>
              <span title={connected ? "Real-time connected" : "Polling mode"}>
                {connected ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={markAllRead}
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Read all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={clearAll}
                    title="Clear all notifications"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                      !notification.read ? "bg-muted/30" : ""
                    }`}
                    onClick={() => {
                      if (!notification.read) markRead(notification.id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{getIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                          {notification.source && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              {notification.source}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
