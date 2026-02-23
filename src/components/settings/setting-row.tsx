"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

export function SettingRow({
  label,
  value,
  type = "string",
}: {
  label: string;
  value: string | boolean | number | undefined;
  type?: "string" | "boolean" | "number";
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-muted-foreground min-w-[180px]">{label}</div>
      <div>
        {type === "boolean" ? (
          <Badge variant={value ? "default" : "secondary"}>
            {value ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Disabled
              </>
            )}
          </Badge>
        ) : (
          <code className="text-sm bg-muted px-2 py-1 rounded">
            {String(value || "—")}
          </code>
        )}
      </div>
    </div>
  );
}

export function HookDisplay({
  label,
  hook,
}: {
  label: string;
  hook?: { command: string; description?: string };
}) {
  if (!hook) {
    return (
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Not Configured
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="space-y-1">
        <Badge variant="default">
          <CheckCircle className="h-3 w-3 mr-1" />
          Configured
        </Badge>
        <code className="block text-xs bg-muted p-2 rounded mt-1">
          {hook.command}
        </code>
        {hook.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {hook.description}
          </p>
        )}
      </div>
    </div>
  );
}
