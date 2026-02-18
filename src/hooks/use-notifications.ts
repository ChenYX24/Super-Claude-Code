"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "scc-notifications";
const ALERTS_KEY = "scc-alerts";
const MAX_NOTIFICATIONS = 50;

export interface Notification {
  id: string;
  type: "cost" | "session" | "system";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface AlertConfig {
  dailyBudget: number; // 0 = disabled
  weeklyBudget: number; // 0 = disabled
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    dailyBudget: 0,
    weeklyBudget: 0,
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }

      const storedAlerts = localStorage.getItem(ALERTS_KEY);
      if (storedAlerts) {
        setAlertConfig(JSON.parse(storedAlerts));
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, []);

  // Save helpers
  const save = useCallback((items: Notification[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setNotifications(items);
    } catch (error) {
      console.error("Failed to save notifications:", error);
    }
  }, []);

  const saveAlerts = useCallback((config: AlertConfig) => {
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(config));
      setAlertConfig(config);
    } catch (error) {
      console.error("Failed to save alert config:", error);
    }
  }, []);

  // Add notification (dedup by title within last hour)
  const addNotification = useCallback(
    (
      type: Notification["type"],
      title: string,
      message: string
    ): void => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Check for duplicate notifications with same title within last hour
      const isDuplicate = notifications.some(
        (n) => n.title === title && n.timestamp > oneHourAgo
      );

      if (isDuplicate) {
        return;
      }

      const newNotification: Notification = {
        id: `${type}-${now}-${Math.random().toString(36).slice(2)}`,
        type,
        title,
        message,
        timestamp: now,
        read: false,
      };

      const updated = [newNotification, ...notifications].slice(
        0,
        MAX_NOTIFICATIONS
      );
      save(updated);
    },
    [notifications, save]
  );

  // Mark as read
  const markRead = useCallback(
    (id: string) => {
      const updated = notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      save(updated);
    },
    [notifications, save]
  );

  const markAllRead = useCallback(() => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    save(updated);
  }, [notifications, save]);

  // Clear all
  const clearAll = useCallback(() => {
    save([]);
  }, [save]);

  // Unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Update alert config
  const updateAlertConfig = useCallback(
    (config: Partial<AlertConfig>) => {
      const updated = { ...alertConfig, ...config };
      saveAlerts(updated);
    },
    [alertConfig, saveAlerts]
  );

  // Check costs and generate alerts
  const checkCosts = useCallback(async () => {
    if (alertConfig.dailyBudget === 0 && alertConfig.weeklyBudget === 0) {
      return;
    }

    try {
      const res = await fetch("/api/tokens");
      if (!res.ok) return;

      const data = await res.json();
      const today = new Date().toISOString().split("T")[0];
      const todayCost = data.byDate?.[today]?.cost || 0;

      // Check daily budget
      if (alertConfig.dailyBudget > 0 && todayCost > alertConfig.dailyBudget) {
        addNotification(
          "cost",
          "Daily budget exceeded",
          `Today's cost ($${todayCost.toFixed(
            2
          )}) exceeded your daily budget ($${alertConfig.dailyBudget.toFixed(
            2
          )})`
        );
      }

      // Check weekly budget
      if (alertConfig.weeklyBudget > 0) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        let weekCost = 0;
        const dates = Object.keys(data.byDate || {});
        for (const date of dates) {
          const dateObj = new Date(date);
          if (dateObj >= startOfWeek) {
            weekCost += data.byDate[date].cost || 0;
          }
        }

        if (weekCost > alertConfig.weeklyBudget) {
          addNotification(
            "cost",
            "Weekly budget exceeded",
            `This week's cost ($${weekCost.toFixed(
              2
            )}) exceeded your weekly budget ($${alertConfig.weeklyBudget.toFixed(
              2
            )})`
          );
        }
      }
    } catch (error) {
      console.error("Failed to check costs:", error);
    }
  }, [alertConfig, addNotification]);

  return {
    notifications,
    unreadCount,
    alertConfig,
    addNotification,
    markRead,
    markAllRead,
    clearAll,
    updateAlertConfig,
    checkCosts,
  };
}
