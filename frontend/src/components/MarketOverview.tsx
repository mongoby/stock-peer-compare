import React, { useEffect, useState, useCallback } from 'react';
import { Card, Spin, List } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getMarket, MarketIndex } from '../api/stock';

interface MarketOverviewProps {
  onAddIndex: (code: string) => void;
}

const MARKET_NAMES: Record<string, string> = {
  '000001': '上证指数',
  '000688': '科创50',
  '000016': '上证50',
  '399001': '深证成指',
  '399006': '创业板指',
  '000300': '沪深300',
  '000905': '中证500',
};

const MARKET_CODES = Object.keys(MARKET_NAMES);

const darkCardStyle: React.CSSProperties = {
  background: '#020617',
  border: '1px solid #1E293B',
  borderRadius: 8,
  cursor: 'pointer',
  userSelect: 'none',
};

const MarketOverview: React.FC<MarketOverviewProps> = ({ onAddIndex }) => {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: MarketIndex[] = await getMarket();
      const filtered = data.filter((idx) => MARKET_CODES.includes(idx.code));
      const sorted = MARKET_CODES.map((c) => filtered.find((idx) => idx.code === c))
        .filter(Boolean) as MarketIndex[];
      setIndices(sorted);
    } catch (err) {
      console.error('Failed to fetch market indices:', err);
      setError('市场指数加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatPrice = (price: number | undefined | null): string => {
    if (price === undefined || price === null) return '--';
    return price.toFixed(2);
  };

  const formatChange = (pct: number | undefined | null): string => {
    if (pct === undefined || pct === null) return '--';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  };

  if (loading && indices.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
          backgroundColor: '#0F172A',
          borderRadius: 8,
          border: '1px solid #1E293B',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (error && indices.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px',
          color: '#94A3B8',
          backgroundColor: '#0F172A',
          borderRadius: 8,
          border: '1px solid #1E293B',
        }}
      >
        {error}
        <div
          onClick={fetchData}
          style={{
            marginTop: 12,
            color: '#3B82F6',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          点击重试
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#0F172A',
        borderRadius: 8,
        border: '1px solid #1E293B',
        padding: '12px',
      }}
    >
      {/* Title row */}
      <div
        style={{
          color: '#94A3B8',
          fontSize: 12,
          marginBottom: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>市场指数 (点击添加对比)</span>
        <span
          onClick={fetchData}
          style={{
            cursor: 'pointer',
            color: '#3B82F6',
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <ReloadOutlined spin={loading} /> 刷新
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <List
          grid={{ gutter: 6, column: 2 }}
          dataSource={indices}
          renderItem={(idx) => {
            const changePct = idx.change_pct ?? 0;
            const isPositive = changePct >= 0;
            const changeColor = isPositive ? '#EF5350' : '#22C55E';
            return (
              <List.Item>
                <Card
                  size="small"
                  style={{
                    background: '#020617',
                    border: '1px solid #1E293B',
                    borderRadius: 8,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  styles={{ body: { padding: '6px 10px' } }}
                  onClick={() => onAddIndex(idx.code)}
                  hoverable={false}
                  bordered={false}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        color: '#F8FAFC',
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {idx.name}
                    </span>
                    <span
                      style={{
                        color: '#F8FAFC',
                        fontSize: 15,
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        flex: 1,
                        textAlign: 'center',
                      }}
                    >
                      {formatPrice(idx.price)}
                    </span>
                    <span
                      style={{
                        color: changeColor,
                        fontSize: 12,
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                        flex: 1,
                        textAlign: 'right',
                      }}
                    >
                      {formatChange(idx.change_pct)}
                    </span>
                    <PlusOutlined
                      style={{
                        color: '#94A3B8',
                        fontSize: 10,
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    />
                  </div>
                </Card>
              </List.Item>
            );
          }}
        />
      </div>
    </div>
  );
};

export default MarketOverview;
