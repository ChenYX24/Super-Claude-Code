"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, DollarSign, CheckCircle } from "lucide-react";

interface CostAlertSettingsProps {
  dailyBudget: number;
  weeklyBudget: number;
  onDailyBudgetChange: (v: number) => void;
  onWeeklyBudgetChange: (v: number) => void;
}

export function CostAlertSettings({
  dailyBudget,
  weeklyBudget,
  onDailyBudgetChange,
  onWeeklyBudgetChange,
}: CostAlertSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Cost Alerts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set budget limits to receive notifications when costs exceed thresholds. Set to 0 to disable.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Daily Budget */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Daily Budget</div>
            <div className="text-xs text-muted-foreground">
              Maximum spend per day before alerting
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={dailyBudget}
              onChange={(e) => onDailyBudgetChange(Number(e.target.value))}
              className="bg-muted border border-border rounded px-3 py-1.5 text-sm font-mono w-28 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.00"
            />
            <span className="text-xs text-muted-foreground w-16">
              {dailyBudget === 0 ? "(disabled)" : "per day"}
            </span>
          </div>
        </div>

        {/* Weekly Budget */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Weekly Budget</div>
            <div className="text-xs text-muted-foreground">
              Maximum spend per week before alerting
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={weeklyBudget}
              onChange={(e) => onWeeklyBudgetChange(Number(e.target.value))}
              className="bg-muted border border-border rounded px-3 py-1.5 text-sm font-mono w-28 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.00"
            />
            <span className="text-xs text-muted-foreground w-16">
              {weeklyBudget === 0 ? "(disabled)" : "per week"}
            </span>
          </div>
        </div>

        {/* Alert Status */}
        {(dailyBudget > 0 || weeklyBudget > 0) && (
          <div className="p-3 bg-muted/50 rounded-md">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Alerts enabled</p>
                <p className="text-muted-foreground text-xs mt-1">
                  You&apos;ll receive notifications when costs exceed your budget limits.
                  Checks run every 60 seconds.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
