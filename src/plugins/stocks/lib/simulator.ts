/**
 * Stock Simulation Plugin - Market Simulator
 *
 * Generates realistic simulated stock data. In a production version,
 * this would call a free API like Yahoo Finance or Alpha Vantage.
 * For the plugin demo, we use seeded random walks.
 */

import type { StockQuote, CandlestickData, TechnicalIndicator } from "../types";

const STOCKS: Record<string, { name: string; basePrice: number }> = {
  AAPL: { name: "Apple Inc.", basePrice: 195 },
  GOOGL: { name: "Alphabet Inc.", basePrice: 175 },
  MSFT: { name: "Microsoft Corp.", basePrice: 420 },
  AMZN: { name: "Amazon.com Inc.", basePrice: 185 },
  TSLA: { name: "Tesla Inc.", basePrice: 250 },
  NVDA: { name: "NVIDIA Corp.", basePrice: 880 },
  META: { name: "Meta Platforms Inc.", basePrice: 500 },
  JPM: { name: "JPMorgan Chase & Co.", basePrice: 195 },
  V: { name: "Visa Inc.", basePrice: 280 },
  WMT: { name: "Walmart Inc.", basePrice: 170 },
  JNJ: { name: "Johnson & Johnson", basePrice: 155 },
  UNH: { name: "UnitedHealth Group", basePrice: 520 },
  XOM: { name: "Exxon Mobil Corp.", basePrice: 105 },
  PG: { name: "Procter & Gamble", basePrice: 165 },
  HD: { name: "Home Depot Inc.", basePrice: 370 },
};

/** Simple seeded PRNG for reproducible per-symbol noise */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** Get a simulated price that drifts slowly from the base price */
function getSimulatedPrice(symbol: string, timestamp: number): number {
  const stock = STOCKS[symbol];
  if (!stock) return 100;

  const daysSinceEpoch = Math.floor(timestamp / 86400000);
  const hourOfDay = (timestamp % 86400000) / 3600000;

  // Long-term drift
  const drift = seededRandom(daysSinceEpoch * 7 + symbol.charCodeAt(0)) * 0.02 - 0.01;
  // Intraday noise
  const noise = (seededRandom(timestamp / 60000 + symbol.charCodeAt(1)) - 0.5) * 0.01;
  // Volatility varies by hour
  const volatility = 1 + Math.sin(hourOfDay * 0.5) * 0.3;

  const factor = 1 + (drift + noise * volatility);
  return Math.round(stock.basePrice * factor * 100) / 100;
}

export function getQuote(symbol: string): StockQuote | null {
  const upper = symbol.toUpperCase();
  const stock = STOCKS[upper];
  if (!stock) return null;

  const now = Date.now();
  const price = getSimulatedPrice(upper, now);
  const previousClose = getSimulatedPrice(upper, now - 86400000);
  const change = Math.round((price - previousClose) * 100) / 100;
  const changePercent = Math.round((change / previousClose) * 10000) / 100;

  const dayHigh = Math.round((price * (1 + seededRandom(now / 3600000) * 0.02)) * 100) / 100;
  const dayLow = Math.round((price * (1 - seededRandom(now / 7200000) * 0.02)) * 100) / 100;
  const openPrice = getSimulatedPrice(upper, now - (now % 86400000));

  return {
    symbol: upper,
    name: stock.name,
    price,
    change,
    changePercent,
    volume: Math.floor(seededRandom(now / 60000 + upper.length) * 50000000 + 5000000),
    high: Math.max(dayHigh, price),
    low: Math.min(dayLow, price),
    open: openPrice,
    previousClose,
    timestamp: now,
  };
}

export function getQuotes(symbols: string[]): StockQuote[] {
  return symbols
    .map((s) => getQuote(s))
    .filter((q): q is StockQuote => q !== null);
}

export function getAllSymbols(): Array<{ symbol: string; name: string }> {
  return Object.entries(STOCKS).map(([symbol, { name }]) => ({ symbol, name }));
}

export function getCandlestickData(symbol: string, days: number = 30): CandlestickData[] {
  const upper = symbol.toUpperCase();
  const data: CandlestickData[] = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = now - i * 86400000;
    const date = new Date(dayStart).toISOString().split("T")[0];

    const open = getSimulatedPrice(upper, dayStart);
    const close = getSimulatedPrice(upper, dayStart + 23 * 3600000);
    const mid = (open + close) / 2;
    const range = Math.abs(open - close) * (1 + seededRandom(dayStart) * 0.5);

    data.push({
      date,
      open: Math.round(open * 100) / 100,
      close: Math.round(close * 100) / 100,
      high: Math.round((mid + range) * 100) / 100,
      low: Math.round((mid - range) * 100) / 100,
      volume: Math.floor(seededRandom(dayStart + 999) * 40000000 + 8000000),
    });
  }

  return data;
}

export function getTechnicalIndicators(symbol: string): TechnicalIndicator[] {
  const quote = getQuote(symbol);
  if (!quote) return [];

  const candles = getCandlestickData(symbol, 14);
  const closes = candles.map((c) => c.close);

  // Simple Moving Average (14-day)
  const sma14 = closes.reduce((a, b) => a + b, 0) / closes.length;
  const smaSignal: "buy" | "sell" | "neutral" =
    quote.price > sma14 * 1.01 ? "buy" : quote.price < sma14 * 0.99 ? "sell" : "neutral";

  // RSI approximation
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / (closes.length - 1);
  const avgLoss = losses / (closes.length - 1) || 0.01;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  const rsiSignal: "buy" | "sell" | "neutral" =
    rsi < 30 ? "buy" : rsi > 70 ? "sell" : "neutral";

  // MACD approximation (simplified)
  const shortMA = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const longMA = sma14;
  const macd = shortMA - longMA;
  const macdSignal: "buy" | "sell" | "neutral" =
    macd > 0.5 ? "buy" : macd < -0.5 ? "sell" : "neutral";

  // Volume trend
  const recentVolumes = candles.slice(-5).map((c) => c.volume);
  const avgRecentVol = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const avgOlderVol = candles.slice(0, 9).reduce((a, c) => a + c.volume, 0) / 9;
  const volTrend = avgRecentVol / avgOlderVol;
  const volSignal: "buy" | "sell" | "neutral" =
    volTrend > 1.2 ? "buy" : volTrend < 0.8 ? "sell" : "neutral";

  return [
    { name: "SMA(14)", value: Math.round(sma14 * 100) / 100, signal: smaSignal },
    { name: "RSI(14)", value: Math.round(rsi * 100) / 100, signal: rsiSignal },
    { name: "MACD", value: Math.round(macd * 100) / 100, signal: macdSignal },
    { name: "Volume Trend", value: Math.round(volTrend * 100) / 100, signal: volSignal },
  ];
}
