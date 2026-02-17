/**
 * Process Reader - detect active Claude CLI processes
 */

import { execSync } from "child_process";
import os from "os";

export interface ProcessInfo {
  pid: number;
  name: string;
  startTime: string;
  memoryMB: number;
  command?: string;
}

export function getClaudeProcesses(): ProcessInfo[] {
  const platform = os.platform();
  const processes: ProcessInfo[] = [];

  try {
    if (platform === "win32") {
      // Windows: use tasklist + wmic for more details
      const output = execSync(
        'tasklist /FI "IMAGENAME eq claude.exe" /FO CSV /NH 2>NUL & tasklist /FI "IMAGENAME eq claude-agent.exe" /FO CSV /NH 2>NUL',
        { encoding: "utf-8", timeout: 5000 }
      );

      for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("INFO:")) continue;

        // CSV format: "name","pid","session","session#","memory"
        const parts = trimmed.match(/"([^"]*)"/g);
        if (!parts || parts.length < 5) continue;

        const name = parts[0].replace(/"/g, "");
        const pid = parseInt(parts[1].replace(/"/g, ""), 10);
        const memStr = parts[4].replace(/"/g, "").replace(/[^0-9]/g, "");
        const memKB = parseInt(memStr, 10) || 0;

        if (isNaN(pid)) continue;
        processes.push({
          pid,
          name,
          startTime: "",
          memoryMB: Math.round(memKB / 1024),
        });
      }

      // Also check for node processes running Claude
      try {
        const wmicOutput = execSync(
          'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine,WorkingSetSize /FORMAT:CSV 2>NUL',
          { encoding: "utf-8", timeout: 5000 }
        );

        for (const line of wmicOutput.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("Node,") || !trimmed.includes("claude")) continue;

          const parts = trimmed.split(",");
          if (parts.length < 4) continue;

          const cmdLine = parts[1] || "";
          const pid = parseInt(parts[2], 10);
          const memBytes = parseInt(parts[3], 10) || 0;

          if (isNaN(pid) || !cmdLine.toLowerCase().includes("claude")) continue;
          processes.push({
            pid,
            name: "node (claude)",
            startTime: "",
            memoryMB: Math.round(memBytes / (1024 * 1024)),
            command: cmdLine.slice(0, 120),
          });
        }
      } catch { /* skip wmic errors */ }
    } else {
      // Unix: ps aux | grep claude
      const output = execSync(
        "ps aux | grep -i claude | grep -v grep",
        { encoding: "utf-8", timeout: 5000 }
      );

      for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parseInt(parts[1], 10);
        const memPercent = parseFloat(parts[3]) || 0;
        const startTime = parts[8] || "";
        const command = parts.slice(10).join(" ");

        if (isNaN(pid)) continue;

        const totalMemMB = os.totalmem() / (1024 * 1024);
        processes.push({
          pid,
          name: parts[10]?.split("/").pop() || "claude",
          startTime,
          memoryMB: Math.round((memPercent / 100) * totalMemMB),
          command: command.slice(0, 120),
        });
      }
    }
  } catch {
    // No matching processes or command failed
  }

  return processes;
}
