import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Plugin management API.
 *
 * Since the plugin registry runs client-side (in-memory + localStorage),
 * this API provides a server-side view of available plugin manifests
 * by scanning the plugins directory at build time.
 *
 * For v3.0, enable/disable state is managed client-side via localStorage.
 * A future iteration could persist to SQLite via db.ts.
 */

// Static list of known plugins (mirrors plugin-loader.ts registration)
const KNOWN_PLUGINS = [
  {
    id: "api-management",
    name: "API Management",
    version: "0.1.0",
    description: "Manage API keys and provider configurations",
    author: "SCC Team",
    icon: "Key",
  },
];

/** GET /api/plugins - List all available plugins */
export function GET() {
  return NextResponse.json({
    plugins: KNOWN_PLUGINS,
    total: KNOWN_PLUGINS.length,
  });
}

/** PUT /api/plugins - Enable/disable a plugin (noop for now, state is client-side) */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { pluginId, enabled } = body;

    if (!pluginId || typeof pluginId !== "string") {
      return NextResponse.json(
        { error: "pluginId is required" },
        { status: 400 }
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    const plugin = KNOWN_PLUGINS.find((p) => p.id === pluginId);
    if (!plugin) {
      return NextResponse.json(
        { error: `Plugin "${pluginId}" not found` },
        { status: 404 }
      );
    }

    // State is managed client-side via localStorage for now.
    // Future: persist to SQLite
    return NextResponse.json({
      success: true,
      message: `Plugin "${pluginId}" ${enabled ? "enabled" : "disabled"}`,
      note: "State is managed client-side. Server acknowledgment only.",
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
