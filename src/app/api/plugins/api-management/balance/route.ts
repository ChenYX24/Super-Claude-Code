/**
 * API Management Plugin - Balance / Usage Check
 *
 * GET /api/plugins/api-management/balance?id=...
 *
 * Checks the remaining balance or usage for a stored API key.
 * Currently supports: Anthropic, OpenAI.
 * For unsupported providers returns { supported: false }.
 */

import { NextRequest, NextResponse } from "next/server";
import { getKey, getDecryptedKey } from "@/lib/api-vault/key-store";
import { checkRateLimit } from "@/lib/api-vault/rate-limiter";

interface BalanceResult {
  provider: string;
  supported: boolean;
  balance?: number | null;
  usage?: number | null;
  limit?: number | null;
  currency?: string;
  error?: string;
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt: number;
    blocked: boolean;
  };
}

async function checkAnthropicBalance(apiKey: string): Promise<Partial<BalanceResult>> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.status === 401) {
      return { error: "Invalid API key" };
    }
    if (res.status === 429) {
      return { error: "Rate limited" };
    }

    // Anthropic does not expose a balance endpoint.
    // A successful or 400-level response means the key is valid.
    const rateLimitRemaining = res.headers.get("x-ratelimit-limit-requests");
    const rateLimitUsed = res.headers.get("x-ratelimit-remaining-requests");

    return {
      balance: null, // Not available via API
      usage: rateLimitUsed ? Number(rateLimitUsed) : null,
      limit: rateLimitRemaining ? Number(rateLimitRemaining) : null,
    };
  } catch {
    return { error: "Failed to connect to Anthropic API" };
  }
}

async function checkOpenAIBalance(apiKey: string): Promise<Partial<BalanceResult>> {
  try {
    // Check organization billing - this endpoint may require org admin access
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (res.status === 401) {
      return { error: "Invalid API key" };
    }
    if (res.status === 429) {
      return { error: "Rate limited" };
    }

    // OpenAI does not expose balance via public API.
    // A 200 response means the key is valid.
    return {
      balance: null,
    };
  } catch {
    return { error: "Failed to connect to OpenAI API" };
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const keyRecord = getKey(id);
    if (!keyRecord) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const apiKey = getDecryptedKey(id);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Failed to decrypt key" },
        { status: 500 }
      );
    }

    const rateStatus = checkRateLimit(id, keyRecord.provider);

    let providerResult: Partial<BalanceResult> = {};
    let supported = false;

    switch (keyRecord.provider) {
      case "anthropic":
        supported = true;
        providerResult = await checkAnthropicBalance(apiKey);
        break;
      case "openai":
        supported = true;
        providerResult = await checkOpenAIBalance(apiKey);
        break;
      default:
        supported = false;
    }

    const result: BalanceResult = {
      provider: keyRecord.provider,
      supported,
      ...providerResult,
      currency: "USD",
      rateLimit: {
        remaining: rateStatus.remaining,
        limit: rateStatus.limit,
        resetAt: rateStatus.resetAt,
        blocked: rateStatus.blocked,
      },
    };

    return NextResponse.json({ balance: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
