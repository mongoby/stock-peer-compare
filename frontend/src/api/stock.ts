const API_BASE = '/api';

export interface StockResult {
  code: string;
  market: string;
  name: string;
}

export interface StockQuote {
  code: string;
  market: string;
  name: string;
  price: number;
  change_pct: number;
  change_amt: number;
  high: number;
  low: number;
  open: number;
  yclose: number;
  volume: number;
  amount: number;
  pe: number;
  market_cap: number;
  turnover: number;
  amplitude: number;
}

export interface StockDetail {
  code: string;
  market: string;
  name: string;
  price: number;
  change_pct: number;
  change_amt: number;
  high: number;
  low: number;
  open: number;
  yclose: number;
  volume: number;
  amount: number;
  pe: number;
  market_cap: number;
  turnover: number;
  amplitude: number;
  ths?: {
    pe_static: number | null;
    pe_dynamic: number | null;
    free_cap: number | null;
    highest_52w: number | null;
    lowest_52w: number | null;
  };
}

export interface FinData {
  code: string;
  report_date: string;
  eps: number;
  revenue: number;
  net_profit: number;
  roe: number;
  gross_margin: number;
  revenue_yoy: number;
  profit_yoy: number;
  bps: number;
}

export interface Kline {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface MarketIndex {
  code: string;
  name: string;
  price: number;
  change_pct: number;
}

export async function searchStock(q: string): Promise<StockResult[]> {
  const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  const d = await r.json();
  return d.results || [];
}

export async function getPeers(codes: string[]): Promise<StockQuote[]> {
  const r = await fetch(`${API_BASE}/peers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes }),
  });
  const d = await r.json();
  return d.results || [];
}

export async function getStockDetail(code: string): Promise<StockDetail | null> {
  const r = await fetch(`${API_BASE}/quote?code=${encodeURIComponent(code)}`);
  if (!r.ok) return null;
  return await r.json();
}

export async function getHistory(code: string, days = 60): Promise<Kline[]> {
  const r = await fetch(`${API_BASE}/history?code=${code}&days=${days}`);
  const d = await r.json();
  return d.klines || [];
}

export async function getMarket(): Promise<MarketIndex[]> {
  const r = await fetch(`${API_BASE}/market`);
  const d = await r.json();
  return (d.indices || []).map((i: any) => ({
    code: i.code,
    name: i.name,
    price: i.price,
    change_pct: i.change_pct,
  }));
}

export async function getFinancialData(codes: string[]): Promise<Record<string, FinData>> {
  const r = await fetch(`${API_BASE}/finance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes }),
  });
  if (!r.ok) return {};
  const d = await r.json();
  return d.results || {};
}
