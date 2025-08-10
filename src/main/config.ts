import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface LogConfig {
  maxFileSize: number; // 单个日志文件最大大小（字节）
  retentionDays: number; // 日志保留天数
  enableRotation: boolean; // 是否启用日志轮转
  cleanupOnStartup: boolean; // 启动时是否清理过期日志
}


export interface AppConfig {
  adminPassword: string;
  blocklistUrl: string;
  autoReloadInterval: number; // 自动重载间隔（秒）
  lastReloadTime?: string;
  isFirstRun: boolean;
  debug: boolean; // 调试模式，控制日志输出
  logConfig: LogConfig; // 日志配置
}

const DEFAULT_LOG_CONFIG: LogConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  retentionDays: 7, // 保留7天
  enableRotation: true, // 启用日志轮转
  cleanupOnStartup: true // 启动时清理过期日志
};


const DEFAULT_CONFIG: AppConfig = {
  adminPassword: '123456',
  blocklistUrl: 'http://192.168.100.193/blocklist.json',
  autoReloadInterval: 30, // 30秒
  isFirstRun: true,
  debug: false, // 默认关闭调试模式
  logConfig: DEFAULT_LOG_CONFIG
};

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    // 根据平台设置配置文件路径
    if (process.platform === 'darwin') {
      this.configPath = path.join(app.getPath('home'), 'Library/Application Support/BrowserGuard/config.json');
    } else {
      this.configPath = path.join(app.getPath('appData'), 'BrowserGuard', 'config.json');
    }
    
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // 合并默认配置和已保存的配置
        return {
          ...DEFAULT_CONFIG,
          ...loadedConfig,
          isFirstRun: false // 如果配置文件存在，说明不是首次运行
        };
      }
    } catch (error) {
      console.error('加载配置文件失败:', error);
    }
    
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      // 确保目录存在
      const configDir = path.dirname(this.configPath);
      fs.mkdirSync(configDir, { recursive: true });
      
      // 保存配置
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      console.error('保存配置文件失败:', error);
    }
  }

  // 获取配置
  getConfig(): AppConfig {
    return { ...this.config };
  }

  // 更新管理员密码
  updateAdminPassword(newPassword: string): void {
    this.config.adminPassword = newPassword;
    this.saveConfig();
  }

  // 更新规则接口URL
  updateBlocklistUrl(newUrl: string): void {
    this.config.blocklistUrl = newUrl;
    this.saveConfig();
  }

  // 更新自动重载间隔
  updateAutoReloadInterval(interval: number): void {
    this.config.autoReloadInterval = interval;
    this.saveConfig();
  }

  // 验证管理员密码
  validateAdminPassword(password: string): boolean {
    return this.config.adminPassword === password;
  }

  // 检查是否首次运行
  isFirstRun(): boolean {
    return this.config.isFirstRun;
  }

  // 标记非首次运行
  markAsNotFirstRun(): void {
    this.config.isFirstRun = false;
    this.saveConfig();
  }

  // 获取规则接口URL
  getBlocklistUrl(): string {
    return this.config.blocklistUrl;
  }

  // 获取自动重载间隔
  getAutoReloadInterval(): number {
    return this.config.autoReloadInterval;
  }

  // 更新最后重载时间
  updateLastReloadTime(): void {
    this.config.lastReloadTime = new Date().toISOString();
    this.saveConfig();
  }

  // 获取最后重载时间
  getLastReloadTime(): string | undefined {
    return this.config.lastReloadTime;
  }

  // 重置为默认配置
  resetToDefault(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig();
  }

  // 获取debug状态
  getDebug(): boolean {
    return this.config.debug;
  }

  // 更新debug状态
  updateDebug(debug: boolean): void {
    this.config.debug = debug;
    this.saveConfig();
  }

  // 获取日志配置
  getLogConfig(): LogConfig {
    return { ...this.config.logConfig };
  }

  // 更新日志文件最大大小
  updateLogMaxFileSize(size: number): void {
    this.config.logConfig.maxFileSize = size;
    this.saveConfig();
  }

  // 更新日志保留天数
  updateLogRetentionDays(days: number): void {
    this.config.logConfig.retentionDays = days;
    this.saveConfig();
  }

  // 更新日志轮转开关
  updateLogRotationEnabled(enabled: boolean): void {
    this.config.logConfig.enableRotation = enabled;
    this.saveConfig();
  }

  // 更新启动时清理开关
  updateLogCleanupOnStartup(enabled: boolean): void {
    this.config.logConfig.cleanupOnStartup = enabled;
    this.saveConfig();
  }

  // 更新整个日志配置
  updateLogConfig(logConfig: Partial<LogConfig>): void {
    this.config.logConfig = {
      ...this.config.logConfig,
      ...logConfig
    };
    this.saveConfig();
  }

  // 重置日志配置为默认值
  resetLogConfigToDefault(): void {
    this.config.logConfig = { ...DEFAULT_LOG_CONFIG };
    this.saveConfig();
  }
} 