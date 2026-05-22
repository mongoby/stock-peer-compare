import React, { useMemo } from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { StockQuote } from '../api/stock';

interface KpiCardsProps {
  quotes: StockQuote[];
}

const formatValue = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '--';
  const absVal = Math.abs(val);
  if (absVal >= 1_0000_0000_0000) {
    return (val / 1_0000_0000_0000).toFixed(2) + '万亿';
  }
  if (absVal >= 1_0000_0000) {
    return (val / 1_0000_0000).toFixed(2) + '亿';
  }
  if (absVal >= 1_0000) {
    return (val / 1_0000).toFixed(2) + '万';
  }
  return val.toLocaleString();
};

const KpiCards: React.FC<KpiCardsProps> = ({ quotes }) => {
  const kpiData = useMemo(() => {
    if (!quotes || quotes.length === 0) {
      return {
        count: 0,
        totalMarketCap: '--',
        best: { name: '--', value: '--', isPositive: true },
        worst: { name: '--', value: '--', isPositive: true },
      };
    }

    // A股 convention: red = up (positive change), green = down (negative change)
    // So we use the raw change_pct: positive is up (red), negative is down (green)

    const totalMarketCap = quotes.reduce(
      (sum, q) => sum + (q.market_cap !== undefined && q.market_cap !== null ? q.market_cap : 0),
      0
    );

    const sortedByChange = [...quotes]
      .filter((q) => q.change_pct !== undefined && q.change_pct !== null)
      .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));

    const best = sortedByChange[0];
    const worst = sortedByChange[sortedByChange.length - 1];

    return {
      count: quotes.length,
      totalMarketCap: formatValue(totalMarketCap),
      best: {
        name: best ? best.name || best.code : '--',
        value: best ? `${best.change_pct!.toFixed(2)}%` : '--',
        isPositive: best ? (best.change_pct ?? 0) >= 0 : true,
      },
      worst: {
        name: worst ? worst.name || worst.code : '--',
        value: worst ? `${worst.change_pct!.toFixed(2)}%` : '--',
        isPositive: worst ? (worst.change_pct ?? 0) >= 0 : true,
      },
    };
  }, [quotes]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#0F172A',
    border: '1px solid #1E293B',
    borderRadius: '8px',
    height: '100%',
  };

  const statStyle: React.CSSProperties = {
    color: '#F8FAFC',
  };

  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={12} md={6}>
        <Card style={cardStyle} styles={{ body: { padding: '16px 20px' } }}>
          <Statistic
            title={
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>对比标的</span>
            }
            value={kpiData.count}
            valueStyle={{ ...statStyle, fontSize: '24px', fontWeight: 600 }}
            suffix={
              <span style={{ color: '#94A3B8', fontSize: '13px', marginLeft: '4px' }}>
                只
              </span>
            }
          />
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6}>
        <Card style={cardStyle} styles={{ body: { padding: '16px 20px' } }}>
          <Statistic
            title={
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>总市值</span>
            }
            value={kpiData.totalMarketCap}
            valueStyle={{ ...statStyle, fontSize: '24px', fontWeight: 600 }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6}>
        <Card style={cardStyle} styles={{ body: { padding: '16px 20px' } }}>
          <Statistic
            title={
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>涨幅最高</span>
            }
            value={kpiData.best.name}
            valueStyle={{ ...statStyle, fontSize: '16px', fontWeight: 500 }}
            suffix={
              <span
                style={{
                  color: kpiData.best.isPositive ? '#EF5350' : '#22C55E',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginLeft: '4px',
                }}
              >
                {kpiData.best.value}
              </span>
            }
          />
        </Card>
      </Col>
      <Col xs={12} sm={12} md={6}>
        <Card style={cardStyle} styles={{ body: { padding: '16px 20px' } }}>
          <Statistic
            title={
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>涨幅最低</span>
            }
            value={kpiData.worst.name}
            valueStyle={{ ...statStyle, fontSize: '16px', fontWeight: 500 }}
            suffix={
              <span
                style={{
                  color: kpiData.worst.isPositive ? '#EF5350' : '#22C55E',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginLeft: '4px',
                }}
              >
                {kpiData.worst.value}
              </span>
            }
          />
        </Card>
      </Col>
    </Row>
  );
};

export default KpiCards;
