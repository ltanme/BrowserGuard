import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../shared/i18n';

declare global {
  interface Window {
    electronAPI: {
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

  useEffect(() => {
    window.electronAPI.onShowWarning((url) => {
      setUrl(url);
      setShow(true);
      setCount(5);
    });
    window.electronAPI.onShowAdminExit(() => {
      setShowAdmin(true);
      setAdminPwd('');
      setAdminMsg('');
    });
  }, []);

  useEffect(() => {
    if (show && count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [show, count]);

  const handleAdminExit = async () => {
    const ok = await window.electronAPI.adminExit(adminPwd);
    if (ok) {
      setShowAdmin(false);
    } else {
      setAdminMsg(t('wrong_pwd'));
    }
  };

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