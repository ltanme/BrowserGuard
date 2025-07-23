export interface DebugServerConfig {
  port: number;
  host: string;
  enabled: boolean;
}

export interface DebugClient {
  id: string;
  socket: any; // WebSocket type - using any to avoid import issues
  connectedAt: Date;
}

export interface DebugEvent {
  type: 'blocklist-update' | 'url-check' | 'domain-blocked' | 'browser-killed' | 'log-entry' | 'system-status';
  timestamp: Date;
  data: any;
}

export interface BrowserStatus {
  browser: 'chrome' | 'edge' | 'safari';
  isRunning: boolean;
  currentUrl: string | null;
  lastChecked: Date;
}

export interface BlocklistStatus {
  lastUpdated: Date;
  nextUpdate: Date;
  updateInterval: number;
  isActive: boolean;
  currentPeriod: any; // BlockPeriod type from existing types
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

export interface BlockingEvent {
  timestamp: Date;
  url: string;
  domain: string;
  matchedRule: any; // BlockPeriod type
  browser: string;
  action: 'warned' | 'killed';
}

export interface DebugState {
  systemInfo: {
    platform: string;
    version: string;
    accessibilityEnabled: boolean;
    logPath: string;
  };
  blocklist: {
    data: any; // BlockListResponse type
    status: BlocklistStatus;
    error: string | null;
  };
  browsers: {
    [key in 'chrome' | 'edge' | 'safari']: BrowserStatus;
  };
  recentEvents: DebugEvent[];
  recentLogs: LogEntry[];
  clients: DebugClient[];
}