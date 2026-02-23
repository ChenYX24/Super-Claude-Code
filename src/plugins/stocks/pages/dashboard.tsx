"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Plus, X,
  BarChart3, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getQuotes, getAllSymbols, getCandlestickData,
  getTechnicalIndicators,
} from "../lib/simulator";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "../lib/store";
import type { StockQuote, CandlestickData, TechnicalIndicator } from "../types";

/** Mini sparkline using recharts */
function MiniChart({ data }: { data: CandlestickData[] }) {
  if (data.length === 0) return null;

  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const width = 120;
  const height = 40;

  const points = closes
    .map((v, i) => {
      const x = (i / (closes.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = closes[closes.length - 1] >= closes[0];

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IndicatorBadge({ indicator }: { indicator: TechnicalIndicator }) {
  const colorMap = {
    buy: "bg-green-500/10 text-green-600 border-green-500/20",
    sell: "bg-red-500/10 text-red-600 border-red-500/20",
    neutral: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs ${colorMap[indicator.signal]}`}>
      <span className="font-medium">{indicator.name}</span>
      <span>{indicator.value}</span>
      <span className="uppercase text-[10px] font-bold">{indicator.signal}</span>
    </div>
  );
}

export function StocksDashboard() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [chartData, setChartData] = useState<CandlestickData[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    const wl = getWatchlist();
    setWatchlist(wl);
    setQuotes(getQuotes(wl));
  }, []);

  useEffect(() => {
    loadData();
    // Refresh every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (selectedSymbol) {
      setChartData(getCandlestickData(selectedSymbol, 30));
      setIndicators(getTechnicalIndicators(selectedSymbol));
    }
  }, [selectedSymbol]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    if (selectedSymbol) {
      setChartData(getCandlestickData(selectedSymbol, 30));
      setIndicators(getTechnicalIndicators(selectedSymbol));
    }
    setTimeout(() => setRefreshing(false), 500);
  }, [loadData, selectedSymbol]);

  const handleAddSymbol = useCallback(() => {
    const sym = searchInput.trim().toUpperCase();
    if (!sym) return;
    const allSymbols = getAllSymbols().map((s) => s.symbol);
    if (allSymbols.includes(sym)) {
      addToWatchlist(sym);
      setSearchInput("");
      loadData();
    }
  }, [searchInput, loadData]);

  const handleRemoveSymbol = useCallback(
    (symbol: string) => {
      removeFromWatchlist(symbol);
      if (selectedSymbol === symbol) setSelectedSymbol(null);
      loadData();
    },
    [selectedSymbol, loadData],
  );

  const allSymbols = getAllSymbols();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Market Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulated real-time market data and technical analysis
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Add to watchlist */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add symbol (e.g. JPM)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddSymbol();
          }}
          className="max-w-[200px] h-8 text-sm"
          list="stock-symbols"
        />
        <datalist id="stock-symbols">
          {allSymbols
            .filter((s) => !watchlist.includes(s.symbol))
            .map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.name}
              </option>
            ))}
        </datalist>
        <Button size="sm" variant="outline" onClick={handleAddSymbol} className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {/* Watchlist quotes */}
      <div className="grid gap-2">
        {quotes.map((quote) => (
          <div
            key={quote.symbol}
            className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedSymbol === quote.symbol ? "bg-muted/50 border-primary/30" : ""
            }`}
            onClick={() => setSelectedSymbol(quote.symbol)}
          >
            <div className="min-w-[100px]">
              <div className="font-semibold text-sm">{quote.symbol}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[100px]">
                {quote.name}
              </div>
            </div>

            <MiniChart data={getCandlestickData(quote.symbol, 7)} />

            <div className="flex-1" />

            <div className="text-right min-w-[80px]">
              <div className="font-mono text-sm font-semibold">
                ${quote.price.toFixed(2)}
              </div>
              <div
                className={`flex items-center justify-end gap-1 text-xs ${
                  quote.change >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {quote.change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>
                  {quote.change >= 0 ? "+" : ""}
                  {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="text-right min-w-[70px] text-xs text-muted-foreground">
              <div>Vol: {(quote.volume / 1e6).toFixed(1)}M</div>
              <div>
                H: ${quote.high.toFixed(2)} L: ${quote.low.toFixed(2)}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveSymbol(quote.symbol);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {quotes.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No symbols in watchlist. Add some above.
          </div>
        )}
      </div>

      {/* Selected stock detail */}
      {selectedSymbol && chartData.length > 0 && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {selectedSymbol} - 30 Day Chart
            </h2>
          </div>

          {/* Candlestick chart (simplified as bar chart) */}
          <div className="overflow-x-auto">
            <div className="flex items-end gap-[2px] h-[200px] min-w-[600px]">
              {chartData.map((candle) => {
                const closes = chartData.map((c) => c.close);
                const min = Math.min(...chartData.map((c) => c.low));
                const max = Math.max(...chartData.map((c) => c.high));
                const range = max - min || 1;

                const bodyTop = Math.max(candle.open, candle.close);
                const bodyBottom = Math.min(candle.open, candle.close);
                const isGreen = candle.close >= candle.open;

                const bodyHeight = Math.max(
                  ((bodyTop - bodyBottom) / range) * 200,
                  1,
                );
                const bodyBottomPos = ((bodyBottom - min) / range) * 200;
                const wickTop = ((candle.high - min) / range) * 200;
                const wickBottom = ((candle.low - min) / range) * 200;

                return (
                  <div
                    key={candle.date}
                    className="relative flex-1 min-w-[10px]"
                    style={{ height: "200px" }}
                    title={`${candle.date}\nO: $${candle.open.toFixed(2)}\nH: $${candle.high.toFixed(2)}\nL: $${candle.low.toFixed(2)}\nC: $${candle.close.toFixed(2)}`}
                  >
                    {/* Wick */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-[1px]"
                      style={{
                        bottom: `${wickBottom}px`,
                        height: `${wickTop - wickBottom}px`,
                        backgroundColor: isGreen ? "#22c55e" : "#ef4444",
                      }}
                    />
                    {/* Body */}
                    <div
                      className="absolute left-[15%] right-[15%] rounded-[1px]"
                      style={{
                        bottom: `${bodyBottomPos}px`,
                        height: `${bodyHeight}px`,
                        backgroundColor: isGreen ? "#22c55e" : "#ef4444",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 min-w-[600px]">
              <span>{chartData[0]?.date}</span>
              <span>{chartData[Math.floor(chartData.length / 2)]?.date}</span>
              <span>{chartData[chartData.length - 1]?.date}</span>
            </div>
          </div>

          {/* Technical indicators */}
          <div>
            <h3 className="text-sm font-medium mb-2">Technical Indicators</h3>
            <div className="flex flex-wrap gap-2">
              {indicators.map((ind) => (
                <IndicatorBadge key={ind.name} indicator={ind} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
