import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { createChart, CandlestickData, HistogramData, Time, ColorType } from 'lightweight-charts';
import { getHistory, Kline } from '../api/stock';

interface Props {
  code: string;
  days: number;
  onTimeRangeChange?: (range: { from: number; to: number } | null) => void;
}

const COLORS = {
  bg: '#020617', muted: '#94A3B8',
  border: '#1E293B', grid: '#0F172A',
  up: '#EF5350', down: '#22C55E',
  volUp: 'rgba(239,83,80,0.4)', volDown: 'rgba(34,197,94,0.4)',
};

export default function KLineChart({ code, days, onTimeRangeChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let chart: ReturnType<typeof createChart> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const data: Kline[] = await getHistory(code, days);
        if (cancelled) return;
        if (!data || data.length === 0) {
          setError('暂无K线数据'); setLoading(false); return;
        }

        const sorted = [...data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        await new Promise(r => setTimeout(r, 50));
        if (cancelled || !container.current) return;

        chart = createChart(container.current, {
          width: container.current.clientWidth || 700,
          height: container.current.clientHeight || 300,
          layout: { background: { type: ColorType.Solid, color: COLORS.bg }, textColor: COLORS.muted, fontSize: 11 },
          grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
          timeScale: { borderColor: COLORS.border, timeVisible: true, secondsVisible: false },
          rightPriceScale: { borderColor: COLORS.border, scaleMargins: { top: 0.05, bottom: 0.25 } },
        });

        const candles = chart.addCandlestickSeries({
          upColor: COLORS.up, downColor: COLORS.down,
          borderUpColor: COLORS.up, borderDownColor: COLORS.down,
          wickUpColor: COLORS.up, wickDownColor: COLORS.down,
        });

        const volume = chart.addHistogramSeries({
          priceFormat: { type: 'volume' }, priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

        const toTime = (d: string) => (new Date(d).getTime() / 1000) as Time;
        candles.setData(sorted.map(k => ({ time: toTime(k.date), open: k.open, high: k.high, low: k.low, close: k.close })));
        volume.setData(sorted.map(k => ({ time: toTime(k.date), value: k.volume, color: k.close >= k.open ? COLORS.volUp : COLORS.volDown })));

        chart.timeScale().fitContent();

        // Sync time range changes to parent
        if (onTimeRangeChange) {
          chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (range) {
              onTimeRangeChange({ from: (range.from as number), to: (range.to as number) });
            } else {
              onTimeRangeChange(null);
            }
          });
        }

        setLoading(false);
      } catch (e) {
        if (!cancelled) { console.error(e); setError('数据加载失败'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; if (chart) chart.remove(); };
  }, [code, days]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.7)', zIndex: 10 }}><Spin size="large" /></div>}
      {error && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.muted, zIndex: 10 }}>{error}</div>}
      <div ref={container} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
