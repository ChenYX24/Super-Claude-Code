import { NextResponse } from "next/server";
import { readSettings, getEnvironmentInfo } from "@/lib/settings-reader";

export const dynamic = "force-dynamic";

export function GET() {
  const settings = readSettings();
  const environment = getEnvironmentInfo(settings.merged);

  return NextResponse.json({
    ...settings,
    environment,
  });
}
