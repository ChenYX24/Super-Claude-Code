/**
 * API Management Plugin - Key CRUD Routes
 *
 * GET    /api/plugins/api-management/keys         — List all keys
 * POST   /api/plugins/api-management/keys         — Add a new key
 * PUT    /api/plugins/api-management/keys?id=...   — Update a key
 * DELETE /api/plugins/api-management/keys?id=...   — Delete a key
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listKeys,
  getKey,
  addKey,
  updateKey,
  deleteKey,
} from "@/lib/api-vault/key-store";

export async function GET() {
  try {
    const keys = listKeys();
    return NextResponse.json({ keys });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, name, key, monthly_budget, notes } = body;

    if (!provider || !name || !key) {
      return NextResponse.json(
        { error: "provider, name, and key are required" },
        { status: 400 }
      );
    }

    if (typeof key !== "string" || key.trim().length < 4) {
      return NextResponse.json(
        { error: "key must be at least 4 characters" },
        { status: 400 }
      );
    }

    const record = addKey({
      provider: String(provider),
      name: String(name),
      key: String(key).trim(),
      monthly_budget: monthly_budget != null ? Number(monthly_budget) : null,
      notes: notes != null ? String(notes) : "",
    });

    return NextResponse.json({ key: record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = await req.json();
    const updates: {
      name?: string;
      key?: string;
      monthly_budget?: number | null;
      notes?: string;
    } = {};

    if (body.name !== undefined) updates.name = String(body.name);
    if (body.key !== undefined) {
      if (typeof body.key !== "string" || body.key.trim().length < 4) {
        return NextResponse.json(
          { error: "key must be at least 4 characters" },
          { status: 400 }
        );
      }
      updates.key = String(body.key).trim();
    }
    if (body.monthly_budget !== undefined) {
      updates.monthly_budget =
        body.monthly_budget != null ? Number(body.monthly_budget) : null;
    }
    if (body.notes !== undefined) updates.notes = String(body.notes);

    const record = updateKey(id, updates);
    if (!record) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ key: record });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = getKey(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    deleteKey(id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
