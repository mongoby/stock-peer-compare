import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { createChart, LineData, Time, IChartApi, ColorType } from 'lightweight-charts';
import { getHistory, Kline } from '../api/stock';

interface Props {
  code: string;
  days: number;
  timeRange?: { from: number; to: number } | null;
  onTimeRangeChange?: (range: { from: number; to: number } | null) => void;
}

const COLORS = {
  bg: '#020617', muted: '#94A3B8',
  border: '#1E293B', grid: '#0F172A',
  ma5: '#F59E0B', ma20: '#3B82F6',
};

export default function KLineMAChart({ code, days, timeRange, onTimeRangeChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let chart: IChartApi | null = null;
    let cancelled = false;

    (async () => {
      try {
        const data: Kline[] = await getHistory(code, days);
        if (cancelled || !data || data.length < 5) { setLoading(false); return; }

        const sorted = [...data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        await new Promise(r => setTimeout(r, 50));
        if (cancelled || !container.current) return;

        chart = createChart(container.current, {
          width: container.current.clientWidth || 700,
          height: container.current.clientHeight || 180,
          layout: { background: { type: ColorType.Solid, color: COLORS.bg }, textColor: COLORS.muted, fontSize: 10 },
          grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
          timeScale: { borderColor: COLORS.border, timeVisible: true, secondsVisible: false },
          rightPriceScale: { borderColor: COLORS.border, scaleMargins: { top: 0.15, bottom: 0.15 } },
        });

        chartRef.current = chart;
        const toTime = (d: string) => (new Date(d).getTime() / 1000) as Time;

        if (sorted.length >= 5) {
          const ma5: LineData[] = [];
          for (let i = 4; i < sorted.length; i++) {
            let sum = 0;
            for (let j = i - 4; j <= i; j++) sum += sorted[j].close;
            ma5.push({ time: toTime(sorted[i].date), value: sum / 5 });
          }
          chart.addLineSeries({ color: COLORS.ma5, lineWidth: 2, priceLineVisible: false, lastValueVisible: false }).setData(ma5);
        }

        if (sorted.length >= 20) {
          const ma20: LineData[] = [];
          for (let i = 19; i < sorted.length; i++) {
            let sum = 0;
            for (let j = i - 19; j <= i; j++) sum += sorted[j].close;
            ma20.push({ time: toTime(sorted[i].date), value: sum / 20 });
          }
          chart.addLineSeries({ color: COLORS.ma20, lineWidth: 2, priceLineVisible: false, lastValueVisible: false }).setData(ma20);
        }

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
        console.error('MA chart error:', e);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; if (chart) chart.remove(); };
  }, [code, days]);

  // Sync time range from parent
  useEffect(() => {
    if (chartRef.current && timeRange) {
      chartRef.current.timeScale().setVisibleRange({
        from: timeRange.from as Time,
        to: timeRange.to as Time,
      });
    }
  }, [timeRange]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', top: 4, left: 8, zIndex: 5,
        display: 'flex', gap: 12, fontSize: 11,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
          <span style={{ width: 16, height: 2, background: COLORS.ma5, display: 'inline-block' }} />
          MA5
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
          <span style={{ width: 16, height: 2, background: COLORS.ma20, display: 'inline-block' }} />
          MA20
        </span>
      </div>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.7)', zIndex: 10 }}>
          <Spin size="small" />
        </div>
      )}
      <div ref={container} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
