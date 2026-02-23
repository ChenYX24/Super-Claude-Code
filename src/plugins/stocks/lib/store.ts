/**
 * Stock Simulation Plugin - Client-side Store
 *
 * Uses localStorage for persistence of portfolios, trades, and strategies.
 * This keeps the plugin self-contained without requiring SQLite schema changes.
 */

import type { Portfolio, Trade, TradingStrategy } from "../types";

const STORAGE_KEYS = {
  portfolios: "scc-stocks-portfolios",
  trades: "scc-stocks-trades",
  strategies: "scc-stocks-strategies",
  watchlist: "scc-stocks-watchlist",
} as const;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ---- Portfolios ----

export function getPortfolios(): Portfolio[] {
  return readJSON<Portfolio[]>(STORAGE_KEYS.portfolios, []);
}

export function getPortfolio(id: string): Portfolio | undefined {
  return getPortfolios().find((p) => p.id === id);
}

export function savePortfolio(portfolio: Portfolio): void {
  const all = getPortfolios();
  const idx = all.findIndex((p) => p.id === portfolio.id);
  if (idx >= 0) {
    all[idx] = portfolio;
  } else {
    all.push(portfolio);
  }
  writeJSON(STORAGE_KEYS.portfolios, all);
}

export function deletePortfolio(id: string): void {
  const all = getPortfolios().filter((p) => p.id !== id);
  writeJSON(STORAGE_KEYS.portfolios, all);
  // Also remove related trades
  const trades = getTrades().filter((t) => t.portfolioId !== id);
  writeJSON(STORAGE_KEYS.trades, trades);
}

export function createPortfolio(name: string, initialCash: number): Portfolio {
  const portfolio: Portfolio = {
    id: `pf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    cash: initialCash,
    initialCash,
    holdings: [],
    totalValue: initialCash,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  savePortfolio(portfolio);
  return portfolio;
}

// ---- Trades ----

export function getTrades(portfolioId?: string): Trade[] {
  const all = readJSON<Trade[]>(STORAGE_KEYS.trades, []);
  if (portfolioId) return all.filter((t) => t.portfolioId === portfolioId);
  return all;
}

export function addTrade(trade: Trade): void {
  const all = getTrades();
  all.unshift(trade);
  writeJSON(STORAGE_KEYS.trades, all);
}

// ---- Strategies ----

const DEFAULT_STRATEGIES: TradingStrategy[] = [
  {
    id: "momentum",
    name: "Momentum",
    description: "Buy stocks with strong upward price momentum, sell when momentum fades",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250514",
    active: false,
    config: {
      maxPositionSize: 0.2,
      stopLossPercent: 5,
      takeProfitPercent: 15,
      maxDailyTrades: 3,
    },
    performance: { totalTrades: 0, winRate: 0, totalReturn: 0 },
  },
  {
    id: "value",
    name: "Value Investing",
    description: "Identify undervalued stocks based on fundamental analysis indicators",
    provider: "openai",
    model: "gpt-4o",
    active: false,
    config: {
      maxPositionSize: 0.3,
      stopLossPercent: 10,
      takeProfitPercent: 25,
      maxDailyTrades: 1,
    },
    performance: { totalTrades: 0, winRate: 0, totalReturn: 0 },
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    description: "Buy when prices drop below historical average, sell when they return",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    active: false,
    config: {
      maxPositionSize: 0.15,
      stopLossPercent: 3,
      takeProfitPercent: 8,
      maxDailyTrades: 5,
    },
    performance: { totalTrades: 0, winRate: 0, totalReturn: 0 },
  },
];

export function getStrategies(): TradingStrategy[] {
  const saved = readJSON<TradingStrategy[]>(STORAGE_KEYS.strategies, []);
  if (saved.length === 0) {
    writeJSON(STORAGE_KEYS.strategies, DEFAULT_STRATEGIES);
    return DEFAULT_STRATEGIES;
  }
  return saved;
}

export function saveStrategy(strategy: TradingStrategy): void {
  const all = getStrategies();
  const idx = all.findIndex((s) => s.id === strategy.id);
  if (idx >= 0) {
    all[idx] = strategy;
  } else {
    all.push(strategy);
  }
  writeJSON(STORAGE_KEYS.strategies, all);
}

// ---- Watchlist ----

const DEFAULT_WATCHLIST = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META"];

export function getWatchlist(): string[] {
  return readJSON<string[]>(STORAGE_KEYS.watchlist, DEFAULT_WATCHLIST);
}

export function setWatchlist(symbols: string[]): void {
  writeJSON(STORAGE_KEYS.watchlist, symbols);
}

export function addToWatchlist(symbol: string): void {
  const list = getWatchlist();
  if (!list.includes(symbol.toUpperCase())) {
    list.push(symbol.toUpperCase());
    setWatchlist(list);
  }
}

export function removeFromWatchlist(symbol: string): void {
  setWatchlist(getWatchlist().filter((s) => s !== symbol.toUpperCase()));
}
