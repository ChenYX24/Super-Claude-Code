/**
 * Stock Simulation Plugin - Type Definitions
 */

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export interface CandlestickData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface Portfolio {
  id: string;
  name: string;
  cash: number;
  initialCash: number;
  holdings: PortfolioHolding[];
  totalValue: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  id: string;
  portfolioId: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  strategy?: string;
  timestamp: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  active: boolean;
  config: {
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyTrades: number;
  };
  performance: {
    totalTrades: number;
    winRate: number;
    totalReturn: number;
  };
}

export interface TechnicalIndicator {
  name: string;
  value: number;
  signal: "buy" | "sell" | "neutral";
}
