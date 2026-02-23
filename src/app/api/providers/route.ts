import { registry } from "@/lib/providers";

export async function GET() {
  const providers = registry.list().map((p) => ({
    name: p.name,
    displayName: p.displayName,
    available: p.isAvailable(),
    capabilities: p.getCapabilities(),
  }));

  return new Response(JSON.stringify({ providers }), {
    headers: { "Content-Type": "application/json" },
  });
}
