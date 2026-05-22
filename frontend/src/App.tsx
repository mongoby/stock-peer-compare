import { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Typography, Divider, Button, Dropdown, Modal, Input, message, Skeleton, Select, ConfigProvider, theme, Tabs } from 'antd';
import { SaveOutlined, DownloadOutlined, PlusOutlined, CloseOutlined, FolderOpenOutlined, DeleteOutlined } from '@ant-design/icons';
import SearchBar from './components/SearchBar';
import PeerTable from './components/PeerTable';
import KpiCards from './components/KpiCards';
import KLineChart from './components/KLineChart';
import KLineMAChart from './components/KLineMAChart';
import MarketOverview from './components/MarketOverview';
import StockDetailModal from './components/StockDetailModal';
import RadarChart from './components/RadarChart';
import { StockQuote, getPeers, getFinancialData, getHistory, FinData, Kline } from './api/stock';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const SAVE_KEY = 'finance-analytics-groups';

interface SavedGroup {
  codes: string[];
  timestamp: number;
}

interface IndexQuote {
  code: string;
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

const LABEL_MAP: Record<string, string> = {
  '000001': '上证指数',
  '399001': '深证成指',
  '399006': '创业板指',
  '000688': '科创50',
  '000016': '上证50',
  '000300': '沪深300',
  '000905': '中证500',
};

export default function App() {
  const [codes, setCodes] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [indexCodes, setIndexCodes] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [modalCode, setModalCode] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [financeData, setFinanceData] = useState<Record<string, FinData>>({});

  // K-line state
  const [klineActiveCode, setKlineActiveCode] = useState<string | null>(null);
  const [klineDays, setKlineDays] = useState(60);
  const [klineTimeRange, setKlineTimeRange] = useState<{ from: number; to: number } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibleRef = useRef(true);

  const isTradingTime = (): boolean => {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const h = now.getHours();
    const m = now.getMinutes();
    const time = h * 100 + m;
    // 9:30-11:30, 13:00-15:00
    return (time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500);
  };

  const fetchPeersAndFinance = useCallback(async (codeList: string[]) => {
    if (codeList.length === 0) return;
    try {
      const [peerData, finData] = await Promise.all([
        getPeers(codeList),
        getFinancialData(codeList),
      ]);
      if (peerData.length > 0) {
        setQuotes(peerData);
      }
      setFinanceData(finData);
    } catch {
      // silently fail on poll
    }
  }, []);

  const handleSearch = useCallback(async (newCodes: string[]) => {
    setLoading(true);
    setQuotes([]);
    setFinanceData({});
    setSelectedCode(null);
    setKlineActiveCode(null);
    try {
      await fetchPeersAndFinance(newCodes);
      // 自动选中第一个股票的K线
      if (newCodes.length > 0 && !klineActiveCode) {
        setKlineActiveCode(newCodes[0]);
      }
    } catch {
      // handled inside
    } finally {
      setLoading(false);
    }
  }, [fetchPeersAndFinance]);

  const handleAddIndex = useCallback((code: string) => {
    if (!indexCodes.includes(code)) {
      setIndexCodes(prev => [...prev, code]);
      if (!klineActiveCode) {
        setKlineActiveCode(code);
      }
    }
  }, [indexCodes, klineActiveCode]);

  const handleRowClick = useCallback((code: string) => {
    setModalCode(code);
  }, []);

  // K-line handlers
  const handleTabChange = useCallback((code: string) => {
    setKlineActiveCode(code);
  }, []);

  const handleKlineClose = useCallback((code: string) => {
    const isIndex = indexCodes.includes(code);
    if (isIndex) {
      setIndexCodes(prev => prev.filter(c => c !== code));
    } else {
      setCodes(prev => prev.filter(c => c !== code));
      setQuotes(prev => prev.filter(q => q.code !== code));
    }
    if (klineActiveCode === code) {
      setKlineActiveCode(null);
    }
  }, [indexCodes, klineActiveCode]);

  const handlePeriodChange = useCallback((days: number) => {
    setKlineDays(days);
  }, []);

  // Save/Load groups
  const getSavedGroups = (): Record<string, SavedGroup> => {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const handleSave = () => {
    const name = groupName.trim();
    if (!name) {
      message.warning('请输入对比组名称');
      return;
    }
    if (codes.length === 0) {
      message.warning('请至少添加一个股票代码');
      return;
    }
    const groups = getSavedGroups();
    groups[name] = { codes: [...codes], timestamp: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(groups));
    message.success(`对比组「${name}」已保存`);
    setSaveModalOpen(false);
    setGroupName('');
  };

  const handleLoad = (savedCodes: string[]) => {
    setCodes(savedCodes);
    handleSearch(savedCodes);
    message.info('已加载对比组');
  };

  const handleDeleteGroup = (name: string) => {
    const groups = getSavedGroups();
    delete groups[name];
    localStorage.setItem(SAVE_KEY, JSON.stringify(groups));
    message.success(`已删除「${name}」`);
  };

  // Export CSV
  const exportCSV = () => {
    if (quotes.length === 0) {
      message.warning('没有数据可导出');
      return;
    }
    const headers = [
      '代码', '名称', '最新价', '涨跌幅', '涨跌额',
      '开盘', '最高', '最低', '昨收', '成交量',
      '成交额', '市盈率', '总市值', '换手率', '振幅',
    ];
    const rows = quotes.map(q => [
      q.code, q.name, q.price, q.change_pct, q.change_amt,
      q.open, q.high, q.low, q.yclose, q.volume,
      q.amount, q.pe, q.market_cap, q.turnover, q.amplitude,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-polling
  useEffect(() => {
    if (codes.length === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLoading(false);
      return;
    }

    const onVisibility = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const poll = async () => {
      if (!visibleRef.current) return;
      if (!isTradingTime()) return;
      try {
        const data = await getPeers(codes);
        if (data.length > 0) {
          setQuotes(data);
        }
      } catch {
        // silent
      }
    };

    // Initial fetch
    poll();
    timerRef.current = setInterval(poll, 30000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [codes]);

  // Build index quotes
  const indexQuotes: StockQuote[] = indexCodes.map(code => {
    const match = quotes.find(q => q.code === code);
    if (match) return match;
    return {
      code,
      name: LABEL_MAP[code] || code,
      market: 'index',
      price: 0,
      change_pct: 0,
      change_amt: 0,
      high: 0,
      low: 0,
      open: 0,
      yclose: 0,
      volume: 0,
      amount: 0,
      pe: 0,
      market_cap: 0,
      turnover: 0,
      amplitude: 0,
    };
  });

  const allKlineQuotes = [...quotes, ...indexQuotes];
  const savedGroups = getSavedGroups();
  const savedGroupNames = Object.keys(savedGroups);

  const loadMenuItems = savedGroupNames.map(name => ({
    key: name,
    label: (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}>
        <span
          style={{ color: '#F8FAFC', cursor: 'pointer', flex: 1 }}
          onClick={() => handleLoad(savedGroups[name]?.codes ?? [])}
        >
          {name}
          <span style={{ color: '#64748B', fontSize: 11, marginLeft: 8 }}>
            ({savedGroups[name]?.codes?.length ?? 0}只)
          </span>
        </span>
        <DeleteOutlined
          style={{ color: '#EF5350', fontSize: 12, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteGroup(name);
          }}
        />
      </div>
    ),
  }));

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgContainer: '#0F172A',
          colorBgElevated: '#0F172A',
          colorBorder: '#334155',
          colorText: '#F8FAFC',
          colorTextSecondary: '#94A3B8',
          colorPrimary: '#3B82F6',
          colorSuccess: '#22C55E',
          colorError: '#EF5350',
          borderRadius: 6,
        },
        components: {
          Table: {
            colorBgContainer: 'transparent',
            headerBg: '#0F172A',
            headerColor: '#94A3B8',
            borderColor: '#1E293B',
            rowHoverBg: '#1E293B',
          },
          Button: {
            defaultBg: '#1E293B',
            defaultBorderColor: '#334155',
            defaultColor: '#94A3B8',
            defaultHoverBg: '#334155',
            defaultHoverBorderColor: '#475569',
            defaultHoverColor: '#F8FAFC',
          },
          Modal: {
            contentBg: '#0F172A',
            headerBg: '#0F172A',
          },
          Input: {
            colorBgContainer: '#1E293B',
            colorBorder: '#334155',
            colorText: '#F8FAFC',
          },
          Select: {
            colorBgContainer: '#1E293B',
            colorBorder: '#334155',
            colorText: '#F8FAFC',
            selectorBg: '#1E293B',
          },
          Segmented: {
            colorBgContainer: '#0F172A',
            itemColor: '#94A3B8',
            itemSelectedBg: '#1E293B',
            itemSelectedColor: '#F8FAFC',
          },
        },
      }}
    >
    <Layout style={{ minHeight: '100vh', background: '#020617' }}>
      <Header style={{
        background: '#0F172A',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        height: 64,
      }}>
        <Title level={4} style={{ color: '#F8FAFC', margin: 0, whiteSpace: 'nowrap' }}>
          📊 同行对比工具
        </Title>
        {codes.length > 0 && (
          <span style={{
            color: '#22C55E',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
          }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#22C55E',
              animation: 'pulse 2s infinite',
            }} />
            实时
          </span>
        )}
        <div style={{ flex: 1, minWidth: 200, maxWidth: 400 }}>
          <SearchBar
            codes={codes}
            onCodesChange={setCodes}
            onSearch={handleSearch}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <Button
            icon={<SaveOutlined />}
            size="small"
            disabled={codes.length === 0}
            onClick={() => setSaveModalOpen(true)}
            style={{
                color: '#94A3B8',
                border: '1px solid #334155',
                background: '#1E293B',
              }}
            >
              保存
            </Button>
            <Dropdown
              menu={{ items: loadMenuItems }}
              trigger={['click']}
              disabled={savedGroupNames.length === 0}
            >
              <Button
                icon={<FolderOpenOutlined />}
                size="small"
                style={{
                  color: '#94A3B8',
                  border: '1px solid #334155',
                  background: '#1E293B',
                }}
              >
                加载
              </Button>
            </Dropdown>
            <Button
              icon={<DownloadOutlined />}
              size="small"
              disabled={quotes.length === 0}
              onClick={exportCSV}
              style={{
                color: '#94A3B8',
                border: '1px solid #334155',
                background: '#1E293B',
              }}
            >
              导出CSV
            </Button>
          </div>
      </Header>

      {/* 股票标签 - 标题下方，分割线上下隔开 */}
      {codes.length > 0 && (
        <div style={{
          background: '#0F172A',
          borderBottom: '1px solid #1E293B',
          padding: '6px 24px',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {codes.map(code => (
            <span key={code} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#1E293B', border: '1px solid #334155',
              borderRadius: 4, padding: '2px 8px', fontSize: 12, color: '#F8FAFC',
              flexShrink: 0,
            }}>
              {code}
              <span onClick={() => {
                const newCodes = codes.filter(c => c !== code);
                setCodes(newCodes);
                setQuotes(prev => prev.filter(q => q.code !== code));
                if (newCodes.length > 0) handleSearch(newCodes);
                else { setQuotes([]); setFinanceData({}); }
              }} style={{ color: '#64748B', cursor: 'pointer', fontSize: 10, marginLeft: 2 }}>✕</span>
            </span>
          ))}
        </div>
      )}

      <Content style={{ padding: 24 }}>
        <MarketOverview onAddIndex={handleAddIndex} />

        {loading && codes.length > 0 && quotes.length === 0 && (
          <div style={{ marginTop: 24 }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        )}

        {quotes.length > 0 && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <KpiCards quotes={quotes} />
            <RadarChart quotes={quotes} visible={quotes.length >= 2} />
            <Divider />
            <PeerTable
              quotes={quotes}
              onSelect={handleRowClick}
              selectedCode={selectedCode}
            />
          </div>
        )}

        {(quotes.length > 0 || indexCodes.length > 0) && allKlineQuotes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Divider />
            <div style={{
              background: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: 8,
              padding: 16,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>
                  K线对比
                </span>
                <Select
                  value={klineDays}
                  onChange={(val) => setKlineDays(val)}
                  options={[
                    { label: '7日', value: 7 },
                    { label: '30日', value: 30 },
                    { label: '60日', value: 60 },
                    { label: '120日', value: 120 },
                  ]}
                  size="small"
                  style={{ width: 80 }}
                  dropdownStyle={{ background: '#0F172A', border: '1px solid #1E293B' }}
                />
              </div>
              <Tabs
                activeKey={klineActiveCode || undefined}
                onChange={(key) => setKlineActiveCode(key)}
                type="card"
                size="small"
                items={allKlineQuotes.map(q => ({
                  key: q.code,
                  label: (
                    <span>
                      {q.name || q.code}
                      <CloseOutlined
                        style={{ fontSize: 10, marginLeft: 6, color: '#64748B' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleKlineClose(q.code);
                        }}
                      />
                    </span>
                  ),
                  children: klineActiveCode === q.code ? (
                    <div>
                      <div style={{ height: 400 }}>
                        <KLineChart
                          code={q.code}
                          days={klineDays}
                          onTimeRangeChange={setKlineTimeRange}
                        />
                      </div>
                      <div style={{ height: 250, marginTop: 8 }}>
                        <KLineMAChart
                          code={q.code}
                          days={klineDays}
                          timeRange={klineTimeRange}
                          onTimeRangeChange={setKlineTimeRange}
                        />
                      </div>
                    </div>
                  ) : null,
                }))}
                style={{ color: '#F8FAFC' }}
              />
            </div>
          </div>
        )}

        {quotes.length === 0 && indexCodes.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            color: '#64748B',
            textAlign: 'center',
            gap: 16,
          }}>
            <div style={{ fontSize: 48 }}>📈</div>
            <Text style={{ color: '#94A3B8', fontSize: 16 }}>
              输入股票代码或名称，开始同行对比
            </Text>
            <Text style={{ color: '#64748B', fontSize: 13, maxWidth: 400 }}>
              支持 A 股代码（如 600519、000858）或名称搜索，自动获取实时行情、财务数据和K线走势
            </Text>
          </div>
        )}
      </Content>

      {/* Save modal */}
      <Modal
        title={<span style={{ color: '#F8FAFC' }}>保存对比组</span>}
        open={saveModalOpen}
        onOk={handleSave}
        onCancel={() => {
          setSaveModalOpen(false);
          setGroupName('');
        }}
        styles={{
          mask: { backgroundColor: 'rgba(2, 6, 23, 0.8)' },
          content: {
            backgroundColor: '#0F172A',
            border: '1px solid #1E293B',
          },
          header: {
            backgroundColor: '#0F172A',
            borderBottom: '1px solid #1E293B',
          },
        }}
      >
        <Input
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder="输入对比组名称"
          onPressEnter={handleSave}
          style={{
            background: '#1E293B',
            borderColor: '#334155',
            color: '#F8FAFC',
          }}
        />
      </Modal>

      {/* Stock detail modal */}
      <StockDetailModal code={modalCode} onClose={() => setModalCode(null)} />
    </Layout>
    </ConfigProvider>
  );
}
