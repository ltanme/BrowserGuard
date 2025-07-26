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
    getConfig: async () => ({ adminPassword: '123456', blocklistUrl: 'https://api.example.com/blocklist', autoReloadInterval: 30, isFirstRun: false }),
    updateAdminPassword: async () => true,
    updateBlocklistUrl: async () => true,
    updateAutoReloadInterval: async () => true,
    isFirstRun: async () => false,
    markNotFirstRun: async () => true,
    resetConfig: async () => true,
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
      getConfig?: () => Promise<any>;
      updateAdminPassword?: (newPassword: string) => Promise<boolean>;
      updateBlocklistUrl?: (newUrl: string) => Promise<boolean>;
      updateAutoReloadInterval?: (interval: number) => Promise<boolean>;
      isFirstRun?: () => Promise<boolean>;
      markNotFirstRun?: () => Promise<boolean>;
      resetConfig?: () => Promise<boolean>;
      onBlocklistUpdated?: (callback: (newBlocklist: any) => void) => void;
    };
  }
}

interface AppConfig {
  adminPassword: string;
  blocklistUrl: string;
  autoReloadInterval: number;
  lastReloadTime?: string;
  isFirstRun: boolean;
}

const App: React.FC = () => {
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [blocklistError, setBlocklistError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(true);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [pendingExit, setPendingExit] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningUrl, setWarningUrl] = useState('');
  
  // 新增状态
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newBlocklistUrl, setNewBlocklistUrl] = useState('');
  const [newReloadInterval, setNewReloadInterval] = useState(30);

  // 检查是否首次运行
  useEffect(() => {
    const checkFirstRun = async () => {
      try {
        const firstRun = await window.electronAPI?.isFirstRun?.();
        setIsFirstRun(firstRun || false);
        if (firstRun) {
          setShowFirstRunSetup(true);
          setShowAdmin(false);
        }
      } catch (error) {
        console.error('检查首次运行失败:', error);
      }
    };
    checkFirstRun();
  }, []);

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const appConfig = await window.electronAPI?.getConfig?.();
        setConfig(appConfig);
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    };
    loadConfig();
  }, []);

  // 退出时主进程发事件，前端再次显示密码输入框
  useEffect(() => {
    window.electronAPI?.onShowAdminExit(() => {
      setShowAdmin(true);
      setAdminPwd('');
      setAdminMsg('');
      setPendingExit(true);
    });
  }, []);

  // 密码校验通过后获取blocklist
  useEffect(() => {
    if (!showAdmin && !showFirstRunSetup) {
      setLoading(true);
      (window.electronAPI?.getBlocklist?.() ?? Promise.reject())
        .then(data => setDashboardData(data))
        .catch(() => setDashboardData(null))
        .finally(() => setLoading(false));
    }
  }, [showAdmin, showFirstRunSetup]);

  // 监听主进程推送的blocklist更新
  useEffect(() => {
    if (window.electronAPI?.onBlocklistUpdated) {
      window.electronAPI.onBlocklistUpdated((newBlocklist) => {
        setDashboardData(newBlocklist);
      });
    }
  }, []);

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
      if (!ok) {
        setAdminMsg('密码错误');
        return;
      }
      setShowAdmin(false);
      setAdminMsg('');
    }
  };

  const handleFirstRunSetup = async () => {
    try {
      // 更新管理员密码
      await window.electronAPI?.updateAdminPassword?.(newPassword);
      
      // 更新规则接口URL
      if (newBlocklistUrl) {
        await window.electronAPI?.updateBlocklistUrl?.(newBlocklistUrl);
      }
      
      // 更新自动重载间隔
      await window.electronAPI?.updateAutoReloadInterval?.(newReloadInterval);
      
      // 标记非首次运行
      await window.electronAPI?.markNotFirstRun?.();
      
      setShowFirstRunSetup(false);
      setShowAdmin(true);
      setIsFirstRun(false);
    } catch (error) {
      console.error('首次运行设置失败:', error);
    }
  };

  const handleConfigUpdate = async () => {
    try {
      if (newPassword) {
        await window.electronAPI?.updateAdminPassword?.(newPassword);
      }
      
      if (newBlocklistUrl) {
        await window.electronAPI?.updateBlocklistUrl?.(newBlocklistUrl);
      }
      
      await window.electronAPI?.updateAutoReloadInterval?.(newReloadInterval);
      
      // 重新加载配置
      const appConfig = await window.electronAPI?.getConfig?.();
      setConfig(appConfig);
      
      setShowConfig(false);
      setNewPassword('');
      setNewBlocklistUrl('');
    } catch (error) {
      console.error('配置更新失败:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showFirstRunSetup) {
        handleFirstRunSetup();
      } else if (showAdmin) {
        handleAdminLogin();
      }
    }
  };

  // 首次运行设置界面
  if (showFirstRunSetup) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h2>首次运行设置</h2>
        <p>欢迎使用 BrowserGuard！请完成初始设置：</p>
        
        <div style={{ marginBottom: '15px' }}>
          <label>管理员密码：</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="默认密码：123456"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>规则接口URL：</label>
          <input
            type="text"
            value={newBlocklistUrl}
            onChange={(e) => setNewBlocklistUrl(e.target.value)}
            placeholder="https://api.example.com/blocklist"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>自动重载间隔（秒）：</label>
          <input
            type="number"
            value={newReloadInterval}
            onChange={(e) => setNewReloadInterval(Number(e.target.value))}
            min="10"
            max="300"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <button
          onClick={handleFirstRunSetup}
          onKeyDown={handleKeyDown}
          style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          完成设置
        </button>
      </div>
    );
  }

  // 管理员密码输入界面
  if (showAdmin) {
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h2>{pendingExit ? '退出确认' : '管理员登录'}</h2>
        <p>{pendingExit ? '请输入管理员密码以退出应用' : '请输入管理员密码'}</p>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            type="password"
            value={adminPwd}
            onChange={(e) => setAdminPwd(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入密码"
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
            autoFocus
          />
        </div>
        
        {adminMsg && <p style={{ color: 'red' }}>{adminMsg}</p>}
        
        <button
          onClick={handleAdminLogin}
          style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {pendingExit ? '退出' : '登录'}
        </button>
        
        {!pendingExit && (
          <button
            onClick={() => setShowConfig(true)}
            style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginLeft: '10px' }}
          >
            配置设置
          </button>
        )}
      </div>
    );
  }

  // 配置管理界面
  if (showConfig) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h2>配置设置</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label>管理员密码：</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="留空则不修改"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>规则接口URL：</label>
          <input
            type="text"
            value={newBlocklistUrl}
            onChange={(e) => setNewBlocklistUrl(e.target.value)}
            placeholder={config?.blocklistUrl || 'https://api.example.com/blocklist'}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>自动重载间隔（秒）：</label>
          <input
            type="number"
            value={newReloadInterval}
            onChange={(e) => setNewReloadInterval(Number(e.target.value))}
            min="10"
            max="300"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <p><strong>当前配置：</strong></p>
          <p>规则接口：{config?.blocklistUrl}</p>
          <p>自动重载间隔：{config?.autoReloadInterval}秒</p>
          <p>最后重载时间：{config?.lastReloadTime ? new Date(config.lastReloadTime).toLocaleString() : '未记录'}</p>
        </div>
        
        <button
          onClick={handleConfigUpdate}
          style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', marginRight: '10px' }}
        >
          保存配置
        </button>
        
        <button
          onClick={() => setShowConfig(false)}
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          返回
        </button>
      </div>
    );
  }

  // 警告弹窗
  if (showWarning) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '8px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#dc3545' }}>⚠️ 访问被阻止</h2>
          <p>检测到您正在访问被阻止的网站：</p>
          <p style={{ fontWeight: 'bold', color: '#dc3545' }}>{warningUrl}</p>
          <p>该网站将在5秒后自动关闭。</p>
          <button
            onClick={() => setShowWarning(false)}
            style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            知道了
          </button>
        </div>
      </div>
    );
  }

  // Dashboard界面
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>BrowserGuard Dashboard</h1>
        <div>
          <button
            onClick={() => setShowConfig(true)}
            style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', marginRight: '10px' }}
          >
            配置设置
          </button>
          <button
            onClick={() => setShowAdmin(true)}
            style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            退出
          </button>
        </div>
      </div>

      {loading && <p>加载中...</p>}
      
      {blocklistError && <p style={{ color: 'red' }}>错误：{blocklistError}</p>}
      
      {dashboardData && (
        <div>
          <h2>当前规则</h2>
          <div style={{ marginBottom: '20px' }}>
            <p><strong>配置信息：</strong></p>
            <p>规则接口：{config?.blocklistUrl}</p>
            <p>自动重载间隔：{config?.autoReloadInterval}秒</p>
            <p>最后重载时间：{config?.lastReloadTime ? new Date(config.lastReloadTime).toLocaleString() : '未记录'}</p>
          </div>
          
          <h3>时间段规则：</h3>
          {dashboardData.periods && dashboardData.periods.length > 0 ? (
            <div style={{ display: 'grid', gap: '15px' }}>
              {dashboardData.periods.map((period: any, index: number) => (
                <div key={index} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                  <h4>时间段 {index + 1}</h4>
                  <p><strong>时间：</strong>{period.start} - {period.end}</p>
                  <p><strong>阻止域名：</strong></p>
                  <ul>
                    {period.domains.map((domain: string, domainIndex: number) => (
                      <li key={domainIndex}>{domain}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p>暂无规则数据</p>
          )}
        </div>
      )}
    </div>
  );
};

export default App; 