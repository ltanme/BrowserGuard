import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../shared/i18n';

// 调试模式检测
const isDebug = typeof window !== 'undefined' && window.location && window.location.search.includes('debug=1');

// mock electronAPI for debug
if (isDebug && !window.electronAPI) {
  window.electronAPI = {
    onShowWarning: (cb) => {},
    onShowAdminExit: (cb) => {},
    adminExit: async (pwd) => pwd === 'Admin1234',
    getBlocklist: async () => defaultBlocklist,
  };
}

declare global {
  interface Window {
    electronAPI?: {
      onShowWarning: (cb: (url: string) => void) => void;
      onShowAdminExit: (cb: () => void) => void;
      adminExit: (pwd: string) => Promise<boolean>;
      getBlocklist?: () => Promise<any>;
    };
  }
}

// 默认 blocklist 数据
const defaultBlocklist = {
  periods: [
    {
      start: '08:00',
      end: '12:00',
      domains: ['facebook.com', 'youtube.com']
    },
    {
      start: '13:30',
      end: '15:30',
      domains: ['tiktok.com']
    },
    {
      start: '19:00',
      end: '23:00',
      domains: ['baidu.com', 'instagram.com']
    }
  ]
};

const App: React.FC = () => {
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [blocklistError, setBlocklistError] = useState<string | null>(null);

  // 调试模式下拉取 blocklist
  useEffect(() => {
    if (isDebug) {
      let timeout = false;
      const timer = setTimeout(() => {
        timeout = true;
        setDashboardData(defaultBlocklist);
        setBlocklistError('请求超时，已使用默认数据');
      }, 2000); // 2秒超时
      fetch('https://api.example.com/blocklist')
        .then(res => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(data => {
          clearTimeout(timer);
          setDashboardData(data);
        })
        .catch(e => {
          if (!timeout) {
            clearTimeout(timer);
            setDashboardData(defaultBlocklist);
            setBlocklistError((e.message || String(e)) + '，已使用默认数据');
          }
        });
    } else {
      setLoading(true);
      (window.electronAPI?.getBlocklist?.() ?? Promise.resolve(defaultBlocklist))
        .then(data => setDashboardData(data))
        .finally(() => setLoading(false));
    }
  }, []);

  // 调试模式下显示 blocklist 拉取状态和错误
  if (isDebug) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>调试模式 Debug Mode</h2>
        <div style={{ margin: 16 }}>
          <b>Blocklist 拉取结果：</b>
          {dashboardData && <pre style={{ textAlign: 'left', background: '#eee', padding: 8 }}>{JSON.stringify(dashboardData, null, 2)}</pre>}
          {blocklistError && <div style={{ color: 'red' }}>Blocklist 拉取失败: {blocklistError}</div>}
        </div>
      </div>
    );
  }

  // Dashboard 只读展示blocklist
  if (loading) return <div style={{ padding: 32 }}>加载中...</div>;
  if (!dashboardData) return <div style={{ padding: 32 }}>暂无规则数据</div>;

  // 计算当前时间命中的period
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const cur = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const activePeriod = dashboardData.periods.find((p: any) => cur >= p.start && cur <= p.end);

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
      <h2>规则 Dashboard</h2>
      <div style={{ margin: '16px 0' }}>
        <b>当前时间：</b>{cur}
      </div>
      <div style={{ margin: '16px 0' }}>
        <b>当前不可访问时间段：</b>
        {activePeriod ? (
          <span style={{ color: 'red', marginLeft: 8 }}>{activePeriod.start} ~ {activePeriod.end} ({activePeriod.domains.join(', ')})</span>
        ) : (
          <span style={{ color: 'green', marginLeft: 8 }}>当前无拦截</span>
        )}
      </div>
      <div style={{ margin: '16px 0' }}>
        <b>全部规则：</b>
        <ul style={{ textAlign: 'left', background: '#f7f7f7', padding: 16, borderRadius: 8 }}>
          {dashboardData.periods.map((p: any, i: number) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <b>{p.start} ~ {p.end}</b> ：{p.domains.join(', ')}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default App; 