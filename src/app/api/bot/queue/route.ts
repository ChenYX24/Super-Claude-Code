/**
 * Bot queue API — delegates to the canonical /api/queue endpoint.
 * Kept for backward compatibility with existing bot integrations.
 */

export { GET, POST } from "@/app/api/queue/route";
export const dynamic = "force-dynamic";
