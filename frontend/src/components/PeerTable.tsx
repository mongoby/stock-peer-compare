import { useState } from 'react';
import { Table, Tag, Dropdown, Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { StockQuote } from '../api/stock';
import type { ColumnsType } from 'antd/es/table';

const ALL_COLUMNS = [
  { key: 'code', title: '代码', defaultVisible: true },
  { key: 'name', title: '名称', defaultVisible: true },
  { key: 'price', title: '最新价', defaultVisible: true },
  { key: 'change_pct', title: '涨跌幅', defaultVisible: true },
  { key: 'change_amt', title: '涨跌额', defaultVisible: true },
  { key: 'open', title: '开盘价', defaultVisible: false },
  { key: 'high', title: '最高价', defaultVisible: false },
  { key: 'low', title: '最低价', defaultVisible: false },
  { key: 'yclose', title: '昨收', defaultVisible: false },
  { key: 'pe', title: '市盈率', defaultVisible: true },
  { key: 'market_cap', title: '总市值', defaultVisible: true },
  { key: 'turnover', title: '换手率', defaultVisible: true },
  { key: 'amplitude', title: '振幅', defaultVisible: true },
  { key: 'amount', title: '成交额', defaultVisible: true },
  { key: 'volume', title: '成交量', defaultVisible: false },
];

interface Props {
  quotes: StockQuote[];
  onSelect: (code: string) => void;
  selectedCode: string | null;
}

export default function PeerTable({ quotes, onSelect, selectedCode }: Props) {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  );

  const toggleColumn = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatPct = (v: number) => {
    const color = v >= 0 ? '#EF5350' : '#22C55E';
    const sign = v >= 0 ? '+' : '';
    return <span style={{ color, fontWeight: 600 }}>{sign}{v.toFixed(2)}%</span>;
  };

  const formatCap = (v: number) => {
    const cap = v / 1e8;
    return cap >= 10000 ? `${(cap / 10000).toFixed(2)}万亿` : `${cap.toFixed(1)}亿`;
  };

  const formatPe = (v: number) => {
    if (v <= 0) return <Tag color='orange'>亏损</Tag>;
    if (v > 100) return <span style={{ color: '#F59E0B' }}>{v.toFixed(1)}</span>;
    return v.toFixed(1);
  };

  const colRenderers: Record<string, (v: any) => any> = {
    code: (v: string) => <a onClick={() => onSelect(v)} style={{ color: '#3B82F6' }}>{v}</a>,
    name: (v: string) => v,
    price: (v: number) => v.toFixed(2),
    change_pct: (v: number) => formatPct(v),
    change_amt: (v: number) => {
      const color = v >= 0 ? '#EF5350' : '#22C55E';
      return <span style={{ color }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>;
    },
    open: (v: number) => v.toFixed(2),
    high: (v: number) => v.toFixed(2),
    low: (v: number) => v.toFixed(2),
    yclose: (v: number) => v.toFixed(2),
    pe: (v: number) => formatPe(v),
    market_cap: (v: number) => formatCap(v),
    turnover: (v: number) => `${v.toFixed(2)}%`,
    amplitude: (v: number) => `${v.toFixed(2)}%`,
    amount: (v: number) => `${(v / 1e8).toFixed(2)}亿`,
    volume: (v: number) => `${(v / 1e4).toFixed(0)}万手`,
  };

  const columns: ColumnsType<StockQuote> = ALL_COLUMNS
    .filter(col => visibleKeys.has(col.key))
    .map(col => ({
      title: col.title,
      dataIndex: col.key,
      key: col.key,
      width: col.key === 'name' ? 100 : 90,
      sorter: ['price', 'change_pct', 'pe', 'market_cap'].includes(col.key)
        ? (a: any, b: any) => (a[col.key] || 0) - (b[col.key] || 0)
        : undefined,
      render: colRenderers[col.key] || ((v: any) => String(v ?? '--')),
    } as any));

  const colMenuItems = ALL_COLUMNS.map(col => ({
    key: col.key,
    label: (
      <span style={{ color: visibleKeys.has(col.key) ? '#F8FAFC' : '#64748B' }}>
        {visibleKeys.has(col.key) ? '✓ ' : '  '}{col.title}
      </span>
    ),
    onClick: () => toggleColumn(col.key),
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Dropdown menu={{ items: colMenuItems }} trigger={['click']}>
          <Button size='small'
            icon={<SettingOutlined />}
            style={{ color: '#94A3B8', border: '1px solid #334155', background: '#1E293B' }}>
            列设置
          </Button>
        </Dropdown>
      </div>
      <Table
        dataSource={quotes}
        columns={columns}
        rowKey='code'
        pagination={false}
        size='small'
        onRow={(record) => ({
          onClick: () => onSelect(record.code),
          style: {
            cursor: 'pointer',
            background: record.code === selectedCode ? '#1E293B' : undefined,
          },
        })}
        style={{ color: '#F8FAFC' }}
        locale={{ emptyText: <span style={{ color: '#64748B' }}>暂无数据</span> }}
      />
    </div>
  );
}
