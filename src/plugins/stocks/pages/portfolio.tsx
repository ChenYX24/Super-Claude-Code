"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet, Plus, Trash2, TrendingUp, TrendingDown,
  ArrowRightLeft, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getPortfolios, createPortfolio, deletePortfolio,
  savePortfolio, addTrade, getPortfolio,
} from "../lib/store";
import { getQuote, getAllSymbols } from "../lib/simulator";
import type { Portfolio, Trade, PortfolioHolding } from "../types";

function TradeForm({
  portfolio,
  onTrade,
}: {
  portfolio: Portfolio;
  onTrade: () => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [error, setError] = useState("");

  const handleTrade = useCallback(() => {
    setError("");
    const sym = symbol.trim().toUpperCase();
    const qty = parseInt(shares, 10);

    if (!sym) {
      setError("Enter a symbol");
      return;
    }
    if (!qty || qty <= 0) {
      setError("Enter valid shares");
      return;
    }

    const quote = getQuote(sym);
    if (!quote) {
      setError(`Unknown symbol: ${sym}`);
      return;
    }

    const total = quote.price * qty;

    if (side === "buy") {
      if (total > portfolio.cash) {
        setError(`Insufficient cash. Need $${total.toFixed(2)}, have $${portfolio.cash.toFixed(2)}`);
        return;
      }

      // Update portfolio
      const holdingIdx = portfolio.holdings.findIndex((h) => h.symbol === sym);
      const updatedHoldings = [...portfolio.holdings];

      if (holdingIdx >= 0) {
        const existing = updatedHoldings[holdingIdx];
        const newShares = existing.shares + qty;
        const newTotalCost = existing.totalCost + total;
        updatedHoldings[holdingIdx] = {
          ...existing,
          shares: newShares,
          avgCost: newTotalCost / newShares,
          totalCost: newTotalCost,
          currentPrice: quote.price,
          totalValue: newShares * quote.price,
          profitLoss: newShares * quote.price - newTotalCost,
          profitLossPercent: ((newShares * quote.price - newTotalCost) / newTotalCost) * 100,
        };
      } else {
        updatedHoldings.push({
          symbol: sym,
          name: quote.name,
          shares: qty,
          avgCost: quote.price,
          currentPrice: quote.price,
          totalValue: total,
          totalCost: total,
          profitLoss: 0,
          profitLossPercent: 0,
        });
      }

      const newCash = portfolio.cash - total;
      const holdingsValue = updatedHoldings.reduce((a, h) => a + h.totalValue, 0);
      const totalValue = newCash + holdingsValue;

      savePortfolio({
        ...portfolio,
        cash: newCash,
        holdings: updatedHoldings,
        totalValue,
        totalProfitLoss: totalValue - portfolio.initialCash,
        totalProfitLossPercent: ((totalValue - portfolio.initialCash) / portfolio.initialCash) * 100,
        updatedAt: Date.now(),
      });
    } else {
      // Sell
      const holdingIdx = portfolio.holdings.findIndex((h) => h.symbol === sym);
      if (holdingIdx < 0) {
        setError(`No holdings of ${sym}`);
        return;
      }
      const existing = portfolio.holdings[holdingIdx];
      if (qty > existing.shares) {
        setError(`Only have ${existing.shares} shares`);
        return;
      }

      const updatedHoldings = [...portfolio.holdings];
      if (qty === existing.shares) {
        updatedHoldings.splice(holdingIdx, 1);
      } else {
        const newShares = existing.shares - qty;
        const newTotalCost = existing.avgCost * newShares;
        updatedHoldings[holdingIdx] = {
          ...existing,
          shares: newShares,
          totalCost: newTotalCost,
          currentPrice: quote.price,
          totalValue: newShares * quote.price,
          profitLoss: newShares * quote.price - newTotalCost,
          profitLossPercent: ((newShares * quote.price - newTotalCost) / newTotalCost) * 100,
        };
      }

      const newCash = portfolio.cash + total;
      const holdingsValue = updatedHoldings.reduce((a, h) => a + h.totalValue, 0);
      const totalValue = newCash + holdingsValue;

      savePortfolio({
        ...portfolio,
        cash: newCash,
        holdings: updatedHoldings,
        totalValue,
        totalProfitLoss: totalValue - portfolio.initialCash,
        totalProfitLossPercent: ((totalValue - portfolio.initialCash) / portfolio.initialCash) * 100,
        updatedAt: Date.now(),
      });
    }

    // Record trade
    const trade: Trade = {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      portfolioId: portfolio.id,
      symbol: sym,
      side,
      shares: qty,
      price: quote.price,
      total,
      timestamp: Date.now(),
    };
    addTrade(trade);

    setSymbol("");
    setShares("");
    onTrade();
  }, [symbol, shares, side, portfolio, onTrade]);

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 bg-muted/30 rounded-lg">
      <div className="flex gap-1">
        <Button
          variant={side === "buy" ? "default" : "outline"}
          size="sm"
          className={`h-8 text-xs ${side === "buy" ? "bg-green-600 hover:bg-green-700" : ""}`}
          onClick={() => setSide("buy")}
        >
          Buy
        </Button>
        <Button
          variant={side === "sell" ? "default" : "outline"}
          size="sm"
          className={`h-8 text-xs ${side === "sell" ? "bg-red-600 hover:bg-red-700" : ""}`}
          onClick={() => setSide("sell")}
        >
          Sell
        </Button>
      </div>
      <Input
        placeholder="Symbol"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="h-8 w-[100px] text-sm"
      />
      <Input
        placeholder="Shares"
        type="number"
        min="1"
        value={shares}
        onChange={(e) => setShares(e.target.value)}
        className="h-8 w-[80px] text-sm"
      />
      <Button size="sm" className="h-8" onClick={handleTrade}>
        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
        Execute
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCash, setNewCash] = useState("100000");

  const loadPortfolios = useCallback(() => {
    const pfs = getPortfolios();
    // Update current prices
    const updated = pfs.map((pf) => {
      const holdings = pf.holdings.map((h) => {
        const quote = getQuote(h.symbol);
        const price = quote?.price ?? h.currentPrice;
        const totalValue = h.shares * price;
        return {
          ...h,
          currentPrice: price,
          totalValue,
          profitLoss: totalValue - h.totalCost,
          profitLossPercent: ((totalValue - h.totalCost) / h.totalCost) * 100,
        };
      });
      const holdingsValue = holdings.reduce((a, h) => a + h.totalValue, 0);
      const totalValue = pf.cash + holdingsValue;
      return {
        ...pf,
        holdings,
        totalValue,
        totalProfitLoss: totalValue - pf.initialCash,
        totalProfitLossPercent: ((totalValue - pf.initialCash) / pf.initialCash) * 100,
      };
    });
    setPortfolios(updated);
  }, []);

  useEffect(() => {
    loadPortfolios();
    const interval = setInterval(loadPortfolios, 10000);
    return () => clearInterval(interval);
  }, [loadPortfolios]);

  const handleCreate = useCallback(() => {
    const name = newName.trim() || "My Portfolio";
    const cash = parseFloat(newCash) || 100000;
    const pf = createPortfolio(name, cash);
    setSelectedId(pf.id);
    setNewName("");
    setNewCash("100000");
    loadPortfolios();
  }, [newName, newCash, loadPortfolios]);

  const handleDelete = useCallback(
    (id: string) => {
      deletePortfolio(id);
      if (selectedId === id) setSelectedId(null);
      loadPortfolios();
    },
    [selectedId, loadPortfolios],
  );

  const selected = portfolios.find((p) => p.id === selectedId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Portfolios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage simulated trading portfolios
        </p>
      </div>

      {/* Create portfolio */}
      <div className="flex items-end gap-2 p-3 border rounded-lg">
        <div>
          <label className="text-xs font-medium">Name</label>
          <Input
            placeholder="Portfolio name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 w-[180px] text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Initial Cash ($)</label>
          <Input
            type="number"
            min="1000"
            value={newCash}
            onChange={(e) => setNewCash(e.target.value)}
            className="h-8 w-[120px] text-sm"
          />
        </div>
        <Button size="sm" className="h-8" onClick={handleCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Create
        </Button>
      </div>

      {/* Portfolio list */}
      <div className="grid gap-2">
        {portfolios.map((pf) => (
          <div
            key={pf.id}
            className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedId === pf.id ? "bg-muted/50 border-primary/30" : ""
            }`}
            onClick={() => setSelectedId(pf.id)}
          >
            <div className="min-w-[120px]">
              <div className="font-semibold text-sm">{pf.name}</div>
              <div className="text-xs text-muted-foreground">
                {pf.holdings.length} holding{pf.holdings.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="flex-1" />

            <div className="text-right">
              <div className="font-mono text-sm font-semibold">
                ${pf.totalValue.toFixed(2)}
              </div>
              <div
                className={`text-xs ${
                  pf.totalProfitLoss >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {pf.totalProfitLoss >= 0 ? "+" : ""}
                ${pf.totalProfitLoss.toFixed(2)} (
                {pf.totalProfitLossPercent.toFixed(2)}%)
              </div>
            </div>

            <div className="text-right text-xs text-muted-foreground min-w-[80px]">
              <div>
                Cash: ${pf.cash.toFixed(0)}
              </div>
              <div>
                Init: ${pf.initialCash.toFixed(0)}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(pf.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {portfolios.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No portfolios yet. Create one to start trading.
          </div>
        )}
      </div>

      {/* Selected portfolio detail */}
      {selected && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono">
                <DollarSign className="h-3 w-3 mr-0.5" />
                Cash: ${selected.cash.toFixed(2)}
              </Badge>
              <Badge
                variant={selected.totalProfitLoss >= 0 ? "default" : "destructive"}
                className="font-mono"
              >
                {selected.totalProfitLoss >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                )}
                {selected.totalProfitLoss >= 0 ? "+" : ""}
                {selected.totalProfitLossPercent.toFixed(2)}%
              </Badge>
            </div>
          </div>

          {/* Trade form */}
          <TradeForm portfolio={selected} onTrade={loadPortfolios} />

          {/* Holdings table */}
          {selected.holdings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Symbol</th>
                    <th className="text-right py-2 font-medium">Shares</th>
                    <th className="text-right py-2 font-medium">Avg Cost</th>
                    <th className="text-right py-2 font-medium">Price</th>
                    <th className="text-right py-2 font-medium">Value</th>
                    <th className="text-right py-2 font-medium">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.holdings.map((h) => (
                    <tr key={h.symbol} className="border-b border-muted">
                      <td className="py-2">
                        <div className="font-medium">{h.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {h.name}
                        </div>
                      </td>
                      <td className="text-right py-2 font-mono">{h.shares}</td>
                      <td className="text-right py-2 font-mono">${h.avgCost.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono">${h.currentPrice.toFixed(2)}</td>
                      <td className="text-right py-2 font-mono">${h.totalValue.toFixed(2)}</td>
                      <td
                        className={`text-right py-2 font-mono ${
                          h.profitLoss >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {h.profitLoss >= 0 ? "+" : ""}${h.profitLoss.toFixed(2)}
                        <div className="text-[10px]">
                          ({h.profitLossPercent.toFixed(2)}%)
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-4">
              No holdings yet. Use the form above to buy stocks.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
