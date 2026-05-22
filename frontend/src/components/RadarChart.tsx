import React, { useMemo } from 'react';
import { StockQuote } from '../api/stock';

interface RadarChartProps {
  quotes: StockQuote[];
  visible: boolean;
}

interface DimensionConfig {
  key: keyof StockQuote;
  label: string;
  unit: string;
}

const DIMENSIONS: DimensionConfig[] = [
  { key: 'pe', label: '市盈率', unit: '' },
  { key: 'turnover', label: '换手率', unit: '%' },
  { key: 'amplitude', label: '振幅', unit: '%' },
  { key: 'amount', label: '成交额', unit: '' },
  { key: 'market_cap', label: '市值', unit: '' },
];

const CHART_SIZE = 600;
const CENTER = CHART_SIZE / 2;
const RADIUS = 150;
const LEVELS = 5;

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleInDeg: number
): { x: number; y: number } {
  const angleInRad = (angleInDeg - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(angleInRad),
    y: cy + r * Math.sin(angleInRad),
  };
}

function getStockValue(stock: StockQuote, key: keyof StockQuote): number {
  const val = stock[key];
  if (val === undefined || val === null || isNaN(Number(val))) return 0;
  return Number(val);
}

const RadarChart: React.FC<RadarChartProps> = ({ quotes, visible }) => {
  const chartData = useMemo(() => {
    if (!quotes || quotes.length < 2 || !visible) return null;

    const validQuotes = quotes.filter((q) => {
      return DIMENSIONS.every((dim) => {
        const v = q[dim.key];
        return v !== undefined && v !== null && !isNaN(Number(v));
      });
    });

    if (validQuotes.length < 2) return null;

    const dimRanges = DIMENSIONS.map((dim) => {
      const values = validQuotes.map((q) => getStockValue(q, dim.key));
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { min, max, range: max - min || 1 };
    });

    const result = validQuotes.map((q) => {
      const name = q.name || q.code;
      const points = DIMENSIONS.map((dim, i) => {
        const raw = getStockValue(q, dim.key);
        const { min, range } = dimRanges[i];
        const normalized = (raw - min) / range;
        return normalized;
      });
      return { name, code: q.code, points };
    });

    return { stocks: result, dimRanges };
  }, [quotes, visible]);

  if (!visible || !chartData || chartData.stocks.length < 2) {
    return null;
  }

  const { stocks, dimRanges } = chartData;
  const numDims = DIMENSIONS.length;
  const angleStep = 360 / numDims;

  const STOCK_COLORS = [
    { stroke: '#EF5350', fill: 'rgba(239, 83, 80, 0.15)' },
    { stroke: '#3B82F6', fill: 'rgba(59, 130, 246, 0.15)' },
    { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.15)' },
    { stroke: '#22C55E', fill: 'rgba(34, 197, 94, 0.15)' },
    { stroke: '#A855F7', fill: 'rgba(168, 85, 247, 0.15)' },
    { stroke: '#EC4899', fill: 'rgba(236, 72, 153, 0.15)' },
  ];

  // Build grid polygons
  const gridPolygons = [];
  for (let level = 1; level <= LEVELS; level++) {
    const r = (RADIUS / LEVELS) * level;
    const pts: string[] = [];
    for (let i = 0; i < numDims; i++) {
      const angle = i * angleStep;
      const p = polarToCartesian(CENTER, CENTER, r, angle);
      pts.push(`${p.x},${p.y}`);
    }
    gridPolygons.push(pts.join(' '));
  }

  // Axis lines and labels
  const axes = [];
  for (let i = 0; i < numDims; i++) {
    const angle = i * angleStep;
    const end = polarToCartesian(CENTER, CENTER, RADIUS + 5, angle);
    const labelPos = polarToCartesian(CENTER, CENTER, RADIUS + 48, angle);
    const rangePos = polarToCartesian(CENTER, CENTER, RADIUS + 80, angle);

    // Calculate label alignment based on angle
    const labelAngle = (angle - 90) * (Math.PI / 180);
    const cos = Math.cos(labelAngle);
    const sin = Math.sin(labelAngle);
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    if (cos > 0.1) textAnchor = 'start';
    else if (cos < -0.1) textAnchor = 'end';
    let dominantBaseline: 'auto' | 'central' | 'hanging' = 'central';
    if (sin > 0.1) dominantBaseline = 'hanging';
    else if (sin < -0.1) dominantBaseline = 'auto';

    const rangeInfo = dimRanges[i];
    const minVal = rangeInfo.min.toFixed(1);
    const maxVal = rangeInfo.max.toFixed(1);
    const dim = DIMENSIONS[i];

    axes.push(
      <g key={`axis-${i}`}>
        {/* Axis line */}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={end.x}
          y2={end.y}
          stroke="#334155"
          strokeWidth={1}
        />
        {/* Dimension label */}
        <text
          x={labelPos.x}
          y={labelPos.y}
          fill="#94A3B8"
          fontSize={13}
          fontWeight={600}
          textAnchor={textAnchor}
          dominantBaseline={dominantBaseline}
        >
          {dim.label}
        </text>
      </g>
    );
  }

  // Build stock polygons
  const stockPolygons = stocks.map((stock, idx) => {
    const color = STOCK_COLORS[idx % STOCK_COLORS.length];
    const pts: string[] = [];
    const dots: { x: number; y: number; dimIdx: number }[] = [];

    for (let i = 0; i < numDims; i++) {
      const normalized = stock.points[i];
      const r = normalized * RADIUS;
      const angle = i * angleStep;
      const p = polarToCartesian(CENTER, CENTER, r, angle);
      pts.push(`${p.x},${p.y}`);
      dots.push({ x: p.x, y: p.y, dimIdx: i });
    }

    return (
      <g key={`stock-${stock.code}`}>
        {/* Filled polygon */}
        <polygon points={pts.join(' ')} fill={color.fill} stroke="none" />
        {/* Stroked polygon */}
        <polygon
          points={pts.join(' ')}
          fill="none"
          stroke={color.stroke}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* Data points */}
        {dots.map((dot, di) => (
          <circle
            key={`dot-${idx}-${di}`}
            cx={dot.x}
            cy={dot.y}
            r={4.5}
            fill={color.stroke}
            stroke="#020617"
            strokeWidth={1.5}
          />
        ))}
      </g>
    );
  });

  // Legend
  const legend = stocks.map((stock, idx) => {
    const color = STOCK_COLORS[idx % STOCK_COLORS.length];
    return (
      <div
        key={stock.code}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: '#F8FAFC',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 2,
            backgroundColor: color.stroke,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 120,
          }}
        >
          {stock.name}
        </span>
      </div>
    );
  });

  return (
    <div
      style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          color: '#94A3B8',
          fontSize: 13,
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        多维雷达对比
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
          width: '100%',
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
          style={{ display: 'block', maxHeight: 400 }}
        >
          {/* Grid rings */}
          {gridPolygons.map((pts, i) => (
            <polygon
              key={`grid-${i}`}
              points={pts}
              fill="none"
              stroke="#1E293B"
              strokeWidth={1}
              strokeDasharray={i === LEVELS - 1 ? 'none' : '3,3'}
            />
          ))}

          {/* Center point */}
          <circle cx={CENTER} cy={CENTER} r={2} fill="#334155" />

          {/* Axes and labels */}
          {axes}

          {/* Stock data polygons */}
          {stockPolygons}
        </svg>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          marginTop: 12,
        }}
      >
        {legend}
      </div>
    </div>
  );
};

export default RadarChart;
