import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Row, Col, Card, Descriptions, Spin, Tag } from 'antd';
import { getStockDetail, StockDetail } from '../api/stock';

interface StockDetailModalProps {
  code: string | null;
  onClose: () => void;
}

const formatValue = (val: number | undefined | null, decimals: number = 2): string => {
  if (val === undefined || val === null || isNaN(val)) return '--';
  return val.toFixed(decimals);
};

const formatLargeCap = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '--';
  const absVal = Math.abs(val);
  if (absVal >= 1_0000_0000_0000) {
    return (val / 1_0000_0000_0000).toFixed(2) + '万亿';
  }
  if (absVal >= 1_0000_0000) {
    return (val / 1_0000_0000).toFixed(2) + '亿';
  }
  return val.toLocaleString();
};

const StockDetailModal: React.FC<StockDetailModalProps> = ({ code, onClose }) => {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getStockDetail(code);
      setDetail(data);
    } catch (err) {
      console.error('Failed to fetch stock detail:', err);
      setError('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (code) {
      fetchDetail();
    } else {
      setDetail(null);
      setError(null);
    }
  }, [code, fetchDetail]);

  const isPositive = (val: number | undefined | null): boolean => {
    if (val === undefined || val === null) return true;
    return val >= 0;
  };

  const renderPriceCard = (
    title: string,
    value: string,
    color?: string
  ) => (
    <Card
      style={{
        backgroundColor: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '6px',
        height: '100%',
      }}
      styles={{ body: { padding: '10px 14px' } }}
    >
      <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '4px' }}>
        {title}
      </div>
      <div
        style={{
          color: color || '#F8FAFC',
          fontSize: '18px',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </Card>
  );

  return (
    <Modal
      open={!!code}
      onCancel={onClose}
      footer={null}
      width={620}
      destroyOnHidden
      centered
      title={
        detail ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#F8FAFC',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 600 }}>
              {detail.name || detail.code}
            </span>
            <span style={{ color: '#94A3B8', fontSize: '13px' }}>
              {detail.code}
            </span>
            {detail.market && (
              <Tag
                style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  color: '#94A3B8',
                  borderRadius: '4px',
                  fontSize: '11px',
                  lineHeight: '18px',
                  padding: '0 6px',
                }}
              >
                {detail.market.toUpperCase()}
              </Tag>
            )}
          </div>
        ) : (
          <span style={{ color: '#F8FAFC' }}>股票详情</span>
        )
      }
      styles={{
        mask: { backgroundColor: 'rgba(2, 6, 23, 0.8)' },
        content: {
          backgroundColor: '#020617',
          border: '1px solid #1E293B',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        },
        header: {
          backgroundColor: '#020617',
          borderBottom: '1px solid #1E293B',
          borderRadius: '8px 8px 0 0',
        },
      }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      )}

      {error && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            color: '#94A3B8',
          }}
        >
          {error}
        </div>
      )}

      {detail && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Price & Change */}
          <Row gutter={[8, 8]}>
            <Col span={8}>
              {renderPriceCard(
                '最新价',
                formatValue(detail.price),
                isPositive(detail.change_pct) ? '#EF5350' : '#22C55E'
              )}
            </Col>
            <Col span={8}>
              {renderPriceCard(
                '涨跌幅',
                `${isPositive(detail.change_pct) ? '+' : ''}${formatValue(detail.change_pct)}%`,
                isPositive(detail.change_pct) ? '#EF5350' : '#22C55E'
              )}
            </Col>
            <Col span={8}>
              {renderPriceCard(
                '涨跌额',
                `${isPositive(detail.change_amt) ? '+' : ''}${formatValue(detail.change_amt)}`,
                isPositive(detail.change_amt) ? '#EF5350' : '#22C55E'
              )}
            </Col>
          </Row>

          {/* OHLC */}
          <Row gutter={[8, 8]}>
            <Col span={6}>{renderPriceCard('开盘', formatValue(detail.open))}</Col>
            <Col span={6}>{renderPriceCard('最高', formatValue(detail.high), '#EF5350')}</Col>
            <Col span={6}>{renderPriceCard('最低', formatValue(detail.low), '#22C55E')}</Col>
            <Col span={6}>{renderPriceCard('昨收', formatValue(detail.yclose))}</Col>
          </Row>

          {/* 52-week high/low (from ths) */}
          {detail.ths && (
            <Row gutter={[8, 8]}>
              <Col span={6}>
                {renderPriceCard('52周最高', formatValue(detail.ths.highest_52w))}
              </Col>
              <Col span={6}>
                {renderPriceCard('52周最低', formatValue(detail.ths.lowest_52w))}
              </Col>
              <Col span={6}>
                {renderPriceCard('静态PE', formatValue(detail.ths.pe_static))}
              </Col>
              <Col span={6}>
                {renderPriceCard('动态PE', formatValue(detail.ths.pe_dynamic))}
              </Col>
            </Row>
          )}

          {/* Extra info */}
          <Card
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '6px',
            }}
            styles={{ body: { padding: '12px 14px' } }}
          >
            <Row gutter={[16, 8]}>
              <Col span={8}>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '2px' }}>
                  市盈率 (PE)
                </div>
                <div style={{ color: '#F8FAFC', fontSize: '14px', fontWeight: 500 }}>
                  {formatValue(detail.pe)}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '2px' }}>
                  流通市值
                </div>
                <div style={{ color: '#F8FAFC', fontSize: '14px', fontWeight: 500 }}>
                  {detail.ths ? formatLargeCap(detail.ths.free_cap) : '--'}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '2px' }}>
                  总市值
                </div>
                <div style={{ color: '#F8FAFC', fontSize: '14px', fontWeight: 500 }}>
                  {formatLargeCap(detail.market_cap)}
                </div>
              </Col>
            </Row>
          </Card>

          {/* Additional stats */}
          <Card
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '6px',
            }}
            styles={{ body: { padding: '12px 14px' } }}
          >
            <Row gutter={[16, 8]}>
              <Col span={6}>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '2px' }}>
                  成交量
                </div>
                <div style={{ color: '#F8FAFC', fontSize: '13px', fontWeight: 500 }}>
                  {formatLargeCap(detail.volume)}
                </div>
              </Col>
              <Col span={6}>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '2px' }}>
                  成交额
                </div>
                <div style={{ color: '#F8FAFC', fontSize: '13px', fontWeight: 500 }}>
                  {formatLargeCap(detail.amount)}
                </div>
              </Col>
              <Col span={6}>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '2px' }}>
                  换手率
                </div>
                <div style={{ color: '#F8FAFC', fontSize: '13px', fontWeight: 500 }}>
                  {formatValue(detail.turnover)}%
                </div>
              </Col>
              <Col span={6}>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '2px' }}>
                  振幅
                </div>
                <div style={{ color: '#F8FAFC', fontSize: '13px', fontWeight: 500 }}>
                  {formatValue(detail.amplitude)}%
                </div>
              </Col>
            </Row>
          </Card>
        </div>
      )}
    </Modal>
  );
};

export default StockDetailModal;
