import React, { useState, useCallback, useRef } from 'react';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { searchStock } from '../api/stock';

interface StockSuggestion {
  code: string;
  name: string;
  market: string;
}

interface SearchBarProps {
  codes: string[];
  onCodesChange: React.Dispatch<React.SetStateAction<string[]>>;
  onSearch: (codes: string[]) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ codes, onCodesChange, onSearch }) => {
  const [options, setOptions] = useState<{ value: string; label: React.ReactNode }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    setInputValue(query);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.trim().length < 1) {
      setOptions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results: StockSuggestion[] = await searchStock(query.trim());
        setOptions(
          results.map((item) => ({
            value: item.code,
            label: (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#F8FAFC',
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  {item.code} {item.name}
                </span>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>
                  {item.market?.toUpperCase() || 'A股'}
                </span>
              </div>
            ),
          }))
        );
      } catch {
        setOptions([]);
      }
    }, 200);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      if (!codes.includes(value)) {
        const newCodes = [...codes, value];
        onCodesChange(newCodes);
        onSearch(newCodes);
      }
      setInputValue('');
      setOptions([]);
    },
    [codes, onCodesChange, onSearch]
  );

  const handleRemoveCode = useCallback(
    (code: string) => {
      const newCodes = codes.filter((c) => c !== code);
      onCodesChange(newCodes);
      if (newCodes.length > 0) {
        onSearch(newCodes);
      }
    },
    [codes, onCodesChange, onSearch]
  );

  const handleClearAll = useCallback(() => {
    onCodesChange([]);
    setInputValue('');
    setOptions([]);
  }, [onCodesChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        const code = inputValue.trim();
        if (!codes.includes(code)) {
          const newCodes = [...codes, code];
          onCodesChange(newCodes);
          onSearch(newCodes);
        }
        setInputValue('');
        setOptions([]);
      }
    },
    [inputValue, codes, onCodesChange, onSearch]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <AutoComplete
        value={inputValue}
        options={options}
        onSearch={handleSearch}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        style={{ width: '100%' }}
        notFoundContent={
          inputValue ? (
            <div style={{ color: '#94A3B8', padding: '8px', textAlign: 'center' }}>
              未找到匹配的股票
            </div>
          ) : null
        }
      >
        <Input
          placeholder="输入股票代码或名称搜索 (例如: 600519)"
          prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
          suffix={
            <PlusOutlined
              style={{ color: '#94A3B8', cursor: 'pointer' }}
              onClick={() => {
                if (inputValue.trim() && !codes.includes(inputValue.trim())) {
                  const code = inputValue.trim();
                  const newCodes = [...codes, code];
                  onCodesChange(newCodes);
                  onSearch(newCodes);
                  setInputValue('');
                  setOptions([]);
                }
              }}
            />
          }
          variant="filled"
          style={{
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#F8FAFC',
            height: '40px',
          }}
        />
      </AutoComplete>
    </div>
  );
};

export default SearchBar;
