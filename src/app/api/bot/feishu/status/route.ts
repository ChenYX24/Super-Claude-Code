/**
 * Feishu Bot status endpoint.
 * GET /api/bot/feishu/status
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json({
      configured: false,
      error: "FEISHU_APP_ID and FEISHU_APP_SECRET not configured",
    });
  }

  return NextResponse.json({
    configured: true,
    appId: `${appId.slice(0, 4)}...${appId.slice(-4)}`,
  });
}
