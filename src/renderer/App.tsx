import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../shared/i18n';

// 调试模式检测
const isDebug = typeof window !== 'undefined' && window.location && window.location.search.includes('debug=1');

// mock electronAPI for debug
if (isDebug && !window.electronAPI) {
  window.electronAPI = {
    onShowWarning: (cb: (url: string) => void) => {
      // 模拟 2 秒后触发拦截
      setTimeout(() => cb('https://facebook.com'), 2000);
    },
    onShowAdminExit: (cb: () => void) => {},
    adminExit: async (pwd: string) => pwd === 'Admin1234',
  };
}

declare global {
  interface Window {
    electronAPI?: {
      onShowWarning: (cb: (url: string) => void) => void;
      onShowAdminExit: (cb: () => void) => void;
      adminExit: (pwd: string) => Promise<boolean>;
    };
  }
}

const App: React.FC = () => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState('');
  const [count, setCount] = useState(5);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  // 调试用状态
  const [blocklist, setBlocklist] = useState<any>(null);
  const [blocklistError, setBlocklistError] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI?.onShowWarning((url) => {
      setUrl(url);
      setShow(true);
      setCount(5);
    });
    window.electronAPI?.onShowAdminExit(() => {
      setShowAdmin(true);
      setAdminPwd('');
      setAdminMsg('');
    });
    // 调试模式下拉取 blocklist
    if (isDebug) {
      fetch('https://api.example.com/blocklist')
        .then(res => res.json())
        .then(data => setBlocklist(data))
        .catch(e => setBlocklistError(e.message || String(e)));
    }
  }, []);

  useEffect(() => {
    if (show && count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [show, count]);

  const handleAdminExit = async () => {
    const ok = await window.electronAPI?.adminExit(adminPwd);
    if (ok) {
      setShowAdmin(false);
    } else {
      setAdminMsg(t('wrong_pwd'));
    }
  };

  // 调试模式下显示 blocklist 拉取状态和错误
  if (isDebug) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h2>调试模式 Debug Mode</h2>
        <div style={{ margin: 16 }}>
          <b>Blocklist 拉取结果：</b>
          {blocklist && <pre style={{ textAlign: 'left', background: '#eee', padding: 8 }}>{JSON.stringify(blocklist, null, 2)}</pre>}
          {blocklistError && <div style={{ color: 'red' }}>Blocklist 拉取失败: {blocklistError}</div>}
        </div>
        <div style={{ margin: 16 }}>
          <b>Console 测试：</b>
          <button onClick={() => { console.log('测试日志'); alert('看控制台有无报错'); }}>打印日志</button>
        </div>
        <div style={{ margin: 16 }}>
          <b>弹窗模拟：</b>
          <button onClick={() => setShow(true)}>模拟拦截弹窗</button>
        </div>
        {show && (
          <div style={{ border: '1px solid #ccc', margin: 16, padding: 16 }}>
            <h2>{t('warning', { domain: url || 'https://facebook.com' })}</h2>
            <div style={{ fontSize: 32, margin: 16 }}>{count}</div>
            <button onClick={() => setShow(false)} style={{ fontSize: 18 }}>{t('confirm')}</button>
          </div>
        )}
      </div>
    );
  }

  if (showAdmin) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <h3>{t('admin_exit')}</h3>
        <input
          type="password"
          value={adminPwd}
          onChange={e => setAdminPwd(e.target.value)}
          style={{ fontSize: 18, margin: 8 }}
        />
        <button onClick={handleAdminExit} style={{ fontSize: 18 }}>{t('confirm')}</button>
        <div style={{ color: 'red', marginTop: 8 }}>{adminMsg}</div>
      </div>
    );
  }

  if (!show) return null;
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h2>{t('warning', { domain: url })}</h2>
      <div style={{ fontSize: 32, margin: 16 }}>{count}</div>
      <button onClick={() => setShow(false)} style={{ fontSize: 18 }}>{t('confirm')}</button>
    </div>
  );
};

export default App; 