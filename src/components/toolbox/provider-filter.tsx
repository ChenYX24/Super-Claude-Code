"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Provider = "claude" | "codex";
type ProviderFilterValue = "all" | Provider;

interface ProviderFilterProps {
  value: ProviderFilterValue;
  onChange: (value: ProviderFilterValue) => void;
  items: { provider?: Provider }[];
}

export function countByProvider(
  items: { provider?: Provider }[]
): { all: number; claude: number; codex: number } {
  let claude = 0;
  let codex = 0;

  for (const item of items) {
    if (item.provider === "codex") {
      codex++;
    } else {
      claude++;
    }
  }

  return { all: items.length, claude, codex };
}

export function filterByProvider<T extends { provider?: Provider }>(
  items: T[],
  filter: string
): T[] {
  if (filter === "all") return items;
  if (filter === "codex") return items.filter((item) => item.provider === "codex");
  return items.filter((item) => item.provider === undefined || item.provider === "claude");
}

const FILTERS: { label: string; value: ProviderFilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Claude", value: "claude" },
  { label: "Codex", value: "codex" },
];

export function ProviderFilter({ value, onChange, items }: ProviderFilterProps) {
  const counts = countByProvider(items);

  return (
    <div className="flex gap-1 flex-wrap">
      {FILTERS.map((filter) => (
        <Button
          key={filter.value}
          variant={value === filter.value ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
          <Badge
            variant={value === filter.value ? "secondary" : "outline"}
            className="h-4 min-w-4 px-1 text-[10px] leading-none"
          >
            {counts[filter.value]}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
