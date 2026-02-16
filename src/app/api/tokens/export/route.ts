import { NextRequest, NextResponse } from "next/server";
import { getTokenExportData, getTokenSummary } from "@/lib/session-reader";

export const dynamic = "force-dynamic";

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateDetailCSV(): string {
  const data = getTokenExportData();
  const headers = ["Date", "Project", "Session ID", "Model", "Input Tokens", "Output Tokens", "Cache Read", "Est. Cost"];
  const rows = [headers.join(",")];

  for (const row of data) {
    rows.push([
      escapeCSV(row.date),
      escapeCSV(row.project),
      escapeCSV(row.sessionId),
      escapeCSV(row.model),
      escapeCSV(row.inputTokens),
      escapeCSV(row.outputTokens),
      escapeCSV(row.cacheReadTokens),
      escapeCSV(row.estimatedCost.toFixed(4)),
    ].join(","));
  }

  return rows.join("\n");
}

function generateSummaryCSV(): string {
  const summary = getTokenSummary();
  const headers = ["Date", "Sessions", "Input Tokens", "Output Tokens", "Cache Read", "Est. Cost"];
  const rows = [headers.join(",")];

  const dateEntries = Object.entries(summary.byDate)
    .filter(([date]) => date !== "unknown")
    .sort((a, b) => b[0].localeCompare(a[0]));

  for (const [date, stats] of dateEntries) {
    rows.push([
      escapeCSV(date),
      escapeCSV(stats.sessions),
      escapeCSV(stats.input),
      escapeCSV(stats.output),
      escapeCSV(summary.totalCacheRead), // Note: byDate doesn't track cacheRead separately
      escapeCSV(stats.cost.toFixed(4)),
    ].join(","));
  }

  return rows.join("\n");
}

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "detail";

  const today = new Date().toISOString().split("T")[0];
  const csv = type === "summary" ? generateSummaryCSV() : generateDetailCSV();
  const filename = `claude-tokens-${type}-${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
