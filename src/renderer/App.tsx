import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../shared/i18n';

// 调试模式检测
const isDebug = typeof window !== 'undefined' && window.location && window.location.search.includes('debug=1');

// mock electronAPI for debug
const debugDefaultBlocklist = {
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
if (isDebug && !window.electronAPI) {
  window.electronAPI = {
    onShowWarning: (cb) => {},
    onShowAdminExit: (cb) => {},
    adminExit: async (pwd) => pwd === 'Admin1234',
    getBlocklist: async () => debugDefaultBlocklist,
  };
}

declare global {
  interface Window {
    electronAPI?: {
      onShowWarning: (cb: (url: string) => void) => void;
      onShowAdminExit: (cb: () => void) => void;
      adminExit: (pwd: string) => Promise<boolean>;
      getBlocklist?: () => Promise<any>;
      checkAdminPwd?: (pwd: string) => Promise<boolean>;
    };
  }
}

const App: React.FC = () => {
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [blocklistError, setBlocklistError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(true); // 启动时先显示密码输入
  const [adminPwd, setAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [pendingExit, setPendingExit] = useState(false); // 是否是退出流程
  const [showWarning, setShowWarning] = useState(false);
  const [warningUrl, setWarningUrl] = useState('');

  // 退出时主进程发事件，前端再次显示密码输入框
  useEffect(() => {
    window.electronAPI?.onShowAdminExit(() => {
      setShowAdmin(true);
      setAdminPwd('');
      setAdminMsg('');
      setPendingExit(true); // 标记为退出流程
    });
  }, []);

  // 密码校验通过后获取blocklist
  useEffect(() => {
    if (!showAdmin) {
      setLoading(true);
      (window.electronAPI?.getBlocklist?.() ?? Promise.reject())
        .then(data => setDashboardData(data))
        .catch(() => setDashboardData(null))
        .finally(() => setLoading(false));
    }
  }, [showAdmin]);

  // 弹窗优先显示
  useEffect(() => {
    window.electronAPI?.onShowWarning((url) => {
      setWarningUrl(url);
      setShowWarning(true);
    });
  }, []);

  const handleAdminLogin = async () => {
    if (pendingExit) {
      // 退出流程，密码校验通过后退出
      const ok = await window.electronAPI?.adminExit(adminPwd);
      if (!ok) {
        setAdminMsg('密码错误');
        return;
      }
      // adminExit 会直接退出应用
    } else {
      // 启动流程，只校验密码
      const ok = await window.electronAPI?.checkAdminPwd?.(adminPwd);
      if (ok) {
        setShowAdmin(false);
        setPendingExit(false);
      } else {
        setAdminMsg('密码错误');
      }
    }
  };

  // 密码输入界面
  if (showAdmin) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h3>请输入管理员密码</h3>
        <input
          type="password"
          value={adminPwd}
          onChange={e => setAdminPwd(e.target.value)}
          style={{ fontSize: 18, margin: 8 }}
        />
        <button onClick={handleAdminLogin} style={{ fontSize: 18, marginLeft: 8 }}>确认</button>
        <div style={{ color: 'red', marginTop: 8 }}>{adminMsg}</div>
      </div>
    );
  }

  // 弹窗优先显示
  if (showWarning) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>警告：你正在访问被拦截的网站</h2>
        <div style={{ margin: 16 }}>{warningUrl}</div>
        <button onClick={() => setShowWarning(false)} style={{ fontSize: 18 }}>确认</button>
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