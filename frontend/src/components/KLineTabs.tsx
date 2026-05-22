import React, { useState, useCallback } from 'react';
import { Button, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { StockQuote } from '../api/stock';

interface KLineTabsProps {
  quotes: StockQuote[];
  activeCode: string | null;
  onTabChange: (code: string) => void;
  onClose: (code: string) => void;
  onAddIndex?: () => void;
  onPeriodChange: (days: number) => void;
  currentDays: number;
}

const PERIOD_OPTIONS = [
  { label: '7日', value: 7 },
  { label: '30日', value: 30 },
  { label: '60日', value: 60 },
  { label: '120日', value: 120 },
];

const KLineTabs: React.FC<KLineTabsProps> = ({
  quotes,
  activeCode,
  onTabChange,
  onClose,
  onAddIndex,
  onPeriodChange,
  currentDays,
}) => {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const handleClose = useCallback(
    (e: React.MouseEvent, code: string) => {
      e.stopPropagation();
      onClose(code);
    },
    [onClose]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'nowrap',
      }}
    >
      {/* Period selector - dropdown style */}
      <Select
        value={currentDays}
        onChange={(val) => onPeriodChange(val as number)}
        options={PERIOD_OPTIONS}
        size="small"
        style={{ width: 80, flexShrink: 0 }}
        dropdownStyle={{ background: '#0F172A', border: '1px solid #1E293B' }}
      />

      {/* Stock tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '2px',
        }}
      >
        {quotes.map((q) => {
          const isActive = q.code === activeCode;
          return (
            <div
              key={q.code}
              onClick={() => onTabChange(q.code)}
              onMouseEnter={() => setHoveredCode(q.code)}
              onMouseLeave={() => setHoveredCode(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: isActive ? '#1E293B' : 'transparent',
                border: `1px solid ${isActive ? '#334155' : 'transparent'}`,
                color: isActive ? '#F8FAFC' : '#94A3B8',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{q.name || q.code}</span>
              {quotes.length > 1 && (
                <span
                  onClick={(e) => handleClose(e, q.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    fontSize: '10px',
                    lineHeight: '1',
                    color:
                      hoveredCode === q.code
                        ? '#F8FAFC'
                        : isActive
                          ? '#94A3B8'
                          : 'transparent',
                    backgroundColor:
                      hoveredCode === q.code ? '#334155' : 'transparent',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                  }}
                >
                  ✕
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Add index button */}
      {onAddIndex && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={onAddIndex}
          style={{
            backgroundColor: 'transparent',
            border: '1px dashed #334155',
            color: '#94A3B8',
            borderRadius: '6px',
            fontSize: '12px',
            height: '30px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          指数对比
        </Button>
      )}
    </div>
  );
};

export default KLineTabs;
