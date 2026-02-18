"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen, Hash, RefreshCw, DollarSign, Clock, LayoutGrid, List,
  Search, ArrowUpDown, X, Star, Calendar, Cpu,
} from "lucide-react";
import { fmtCost, fmtTokens, timeAgo, formatDT, shortModel } from "@/lib/format-utils";
import { SessionBlock, StatusLegend, STATUS_CONFIG, highlightText } from "./session-block";
import type { SessionsData, SessionStatus } from "./types";
import { useFavorites } from "@/hooks/use-favorites";

const PAGE_SIZE = 24;

type DateRange = "all" | "today" | "week" | "month";
type ModelFilter = "all" | "opus" | "sonnet" | "haiku";
type SortBy = "date" | "cost" | "messages" | "tokens";

export function SessionList({ data, onSelect, onRefresh, refreshing }: {
  data: SessionsData;
  onSelect: (p: string, id: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter and sort sessions
  const sessions = useMemo(() => {
    let filtered = filter ? data.recentSessions.filter(s => s.project === filter) : data.recentSessions;

    // Apply favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter(s => favorites.includes(s.id));
    }

    // Apply date range filter
    if (dateRange !== "all") {
      const now = Date.now();
      const cutoff = dateRange === "today" ? now - 24 * 60 * 60 * 1000 :
                     dateRange === "week" ? now - 7 * 24 * 60 * 60 * 1000 :
                     now - 30 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(s => s.lastActive >= cutoff);
    }

    // Apply model filter
    if (modelFilter !== "all") {
      filtered = filtered.filter(s => {
        const model = s.model?.toLowerCase() || "";
        return model.includes(modelFilter);
      });
    }

    // Apply search filter
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter(s =>
        (s.firstMessage?.toLowerCase().includes(search)) ||
        (s.projectName.toLowerCase().includes(search)) ||
        (s.model?.toLowerCase().includes(search)) ||
        (s.id.toLowerCase().includes(search))
      );
    }

    // Apply sorting
    const sorted = [...filtered];
    if (sortBy === "date") {
      sorted.sort((a, b) => b.lastActive - a.lastActive);
    } else if (sortBy === "cost") {
      sorted.sort((a, b) => b.estimatedCost - a.estimatedCost);
    } else if (sortBy === "messages") {
      sorted.sort((a, b) => b.messageCount - a.messageCount);
    } else if (sortBy === "tokens") {
      sorted.sort((a, b) => (b.totalInputTokens + b.totalOutputTokens) - (a.totalInputTokens + a.totalOutputTokens));
    }

    return sorted;
  }, [data.recentSessions, filter, debouncedSearch, sortBy, showFavoritesOnly, favorites, dateRange, modelFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedSessions = sessions.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  // Reset page when filter/search changes
  useEffect(() => { setCurrentPage(1); }, [filter, debouncedSearch, sortBy, showFavoritesOnly, dateRange, modelFilter]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Sessions</h1>
          {onRefresh && (
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-refresh
          </div>
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm" className="h-7 w-7 p-0"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm" className="h-7 w-7 p-0"
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: FolderOpen, label: "Projects", value: data.projects.length },
          { icon: Hash, label: "Sessions", value: data.totalSessions },
          { icon: DollarSign, label: "Est. Cost", value: fmtCost(data.recentSessions.reduce((s, x) => s + x.estimatedCost, 0)) },
          { icon: Clock, label: "Showing", value: sessions.length },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" />{label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Sort Controls */}
      <div className="flex gap-3 items-center flex-wrap">
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="h-9 px-3"
        >
          <Star className="h-4 w-4 mr-2" fill={showFavoritesOnly ? "currentColor" : "none"} />
          Favorites
        </Button>
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search sessions (message, project, model, ID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="cost">Sort by Cost</SelectItem>
            <SelectItem value="messages">Sort by Messages</SelectItem>
            <SelectItem value="tokens">Sort by Tokens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range and Model Filters — same row */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          {(["all", "today", "week", "month"] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setDateRange(range)}
            >
              {range === "all" ? "All Time" :
               range === "today" ? "Today" :
               range === "week" ? "This Week" :
               "This Month"}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-0.5">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          {(["all", "opus", "sonnet", "haiku"] as ModelFilter[]).map((model) => (
            <Button
              key={model}
              variant={modelFilter === model ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setModelFilter(model)}
            >
              {model === "all" ? "All Models" :
               model.charAt(0).toUpperCase() + model.slice(1)}
            </Button>
          ))}
        </div>
        {(dateRange !== "all" || modelFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => {
              setDateRange("all");
              setModelFilter("all");
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap gap-2">
          <Badge variant={filter === "" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("")}>All</Badge>
          {data.projects.map(p => (
            <Badge key={p.path} variant={filter === p.path ? "default" : "outline"} className="cursor-pointer"
              onClick={() => setFilter(filter === p.path ? "" : p.path)}>
              {p.name.length > 20 ? "..." + p.name.slice(-18) : p.name} ({p.sessionCount})
            </Badge>
          ))}
        </div>
        {viewMode === "grid" && <StatusLegend sessions={sessions} />}
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {paginatedSessions.map(s => (
            <SessionBlock
              key={`${s.project}-${s.id}`}
              session={s}
              onClick={() => onSelect(s.project, s.id)}
              searchQuery={debouncedSearch}
              isFavorite={isFavorite(s.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {paginatedSessions.map(s => {
            const status = (s.status || "idle") as SessionStatus;
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
            return (
              <Card key={`${s.project}-${s.id}`} className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                onClick={() => onSelect(s.project, s.id)}>
                <CardContent className="py-2.5 flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(s.id);
                    }}
                    className={`flex-shrink-0 transition-colors ${
                      isFavorite(s.id)
                        ? "text-yellow-400"
                        : "text-muted-foreground hover:text-yellow-400"
                    }`}
                  >
                    <Star className="h-3.5 w-3.5" fill={isFavorite(s.id) ? "currentColor" : "none"} />
                  </button>
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.dot} ${cfg.animation || ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {debouncedSearch ? highlightText(s.firstMessage || s.id.slice(0, 12), debouncedSearch) :
                       (s.firstMessage || s.id.slice(0, 12))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDT(s.startTime)} · {timeAgo(s.lastActive)} · {debouncedSearch ? highlightText(s.projectName, debouncedSearch) : s.projectName}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {s.model && <Badge variant="secondary" className="text-xs">{shortModel(s.model)}</Badge>}
                    <Badge variant="outline" className="text-xs font-mono">
                      <DollarSign className="h-3 w-3 mr-0.5" />{fmtCost(s.estimatedCost)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{s.messageCount} lines</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline" size="sm" className="text-xs h-8"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(safeCurrentPage - 1)}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (safeCurrentPage <= 4) {
                pageNum = i + 1;
              } else if (safeCurrentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = safeCurrentPage - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === safeCurrentPage ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline" size="sm" className="text-xs h-8"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(safeCurrentPage + 1)}
          >
            Next
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            {sessions.length} sessions
          </span>
        </div>
      )}
    </div>
  );
}
