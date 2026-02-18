import { NextRequest, NextResponse } from "next/server";

interface SearchResult {
  name: string;
  description: string;
  source: "npm" | "github";
  url: string;
  installCommand?: string;
}

// GET /api/toolbox/search?q=keyword&type=mcp|skill|agent|rule|hook
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const type = req.nextUrl.searchParams.get("type") || "mcp";

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: SearchResult[] = [];

  try {
    // Search npm registry
    const npmQuery = type === "mcp"
      ? `mcp+server+${q}`
      : `claude-code+${type}+${q}`;

    const npmRes = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(npmQuery)}&size=10`,
      { next: { revalidate: 300 } }  // cache 5 min
    );

    if (npmRes.ok) {
      const npmData = await npmRes.json();
      for (const obj of npmData.objects || []) {
        const pkg = obj.package;
        results.push({
          name: pkg.name,
          description: pkg.description || "",
          source: "npm",
          url: `https://www.npmjs.com/package/${pkg.name}`,
          installCommand: type === "mcp"
            ? `npx ${pkg.name}`
            : `npm install ${pkg.name}`,
        });
      }
    }
  } catch (e) {
    console.error("npm search error:", e);
  }

  try {
    // Search GitHub
    const ghQuery = type === "mcp"
      ? `${q} mcp server`
      : `${q} claude code ${type}`;

    const ghRes = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(ghQuery)}&sort=stars&per_page=10`,
      {
        headers: { "Accept": "application/vnd.github.v3+json" },
        next: { revalidate: 300 },
      }
    );

    if (ghRes.ok) {
      const ghData = await ghRes.json();
      for (const repo of ghData.items || []) {
        // Skip duplicates from npm
        if (results.some(r => r.name === repo.name)) continue;
        results.push({
          name: repo.full_name,
          description: repo.description || "",
          source: "github",
          url: repo.html_url,
        });
      }
    }
  } catch (e) {
    console.error("GitHub search error:", e);
  }

  return NextResponse.json({ results });
}
