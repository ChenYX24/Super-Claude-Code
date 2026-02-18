"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, ExternalLink } from "lucide-react";

interface SearchResult {
  name: string;
  description: string;
  source: "npm" | "github";
  url: string;
  installCommand?: string;
}

export function OnlineSearch({ type }: { type: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/toolbox/search?q=${encodeURIComponent(query)}&type=${type}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Search Online</span>
      </div>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search npm & GitHub for ${type}s...`}
            className="w-full h-8 pl-8 pr-3 text-sm border rounded-md bg-background"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={searching || query.trim().length < 2}>
          {searching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </Button>
      </div>
      {searched && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searching ? "Searching..." : "No results found"}
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {results.map((r, i) => (
                <Card key={`${r.source}-${r.name}-${i}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-3 px-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-mono font-medium truncate">{r.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                        {r.source}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {r.installCommand && (
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono truncate flex-1">
                          {r.installCommand}
                        </code>
                      )}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-0.5 flex-shrink-0"
                      >
                        <ExternalLink className="h-3 w-3" /> View
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
