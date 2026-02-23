import { NextRequest, NextResponse } from "next/server";
import { getTokenSummary } from "@/lib/session-reader";
import type { SessionProvider } from "@/lib/session-reader";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = new Set<SessionProvider>(["claude", "codex", "unknown"]);

export function GET(request: NextRequest) {
  const providerParam = request.nextUrl.searchParams.get("provider");
  const provider = providerParam && VALID_PROVIDERS.has(providerParam as SessionProvider)
    ? (providerParam as SessionProvider)
    : undefined;
  const summary = getTokenSummary(provider);
  return NextResponse.json(summary);
}
