import http from 'http';
import { systemPreferences } from 'electron';
import { WebSocketServer, WebSocket } from 'ws';
import { DebugServerConfig, DebugState, DebugEvent, LogEntry, DebugClient } from '../shared/debugTypes';

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, DebugClient> = new Map();
  private writeLog: (msg: string) => void;

  constructor(writeLog: (msg: string) => void) {
    this.writeLog = writeLog;
  }

  initialize(server: http.Server): void {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (socket: WebSocket) => {
      const clientId = this.generateClientId();
      const client: DebugClient = {
        id: clientId,
        socket,
        connectedAt: new Date()
      };
      
      this.clients.set(clientId, client);
      this.writeLog(`Debug client connected: ${clientId}`);
      
      // Send initial connection confirmation
      this.sendToClient(clientId, {
        type: 'system-status',
        timestamp: new Date(),
        data: { clientId, status: 'connected' }
      });

      socket.on('close', () => {
        this.clients.delete(clientId);
        this.writeLog(`Debug client disconnected: ${clientId}`);
      });

      socket.on('error', (error) => {
        this.writeLog(`WebSocket error for client ${clientId}: ${error.message}`);
        this.clients.delete(clientId);
      });

      socket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          this.writeLog(`Invalid message from client ${clientId}: ${error}`);
        }
      });
    });
  }

  broadcast(event: DebugEvent): void {
    const message = JSON.stringify(event);
    const deadClients: string[] = [];

    this.clients.forEach((client, clientId) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(message);
        } catch (error) {
          this.writeLog(`Failed to send to client ${clientId}: ${error}`);
          deadClients.push(clientId);
        }
      } else {
        deadClients.push(clientId);
      }
    });

    // Clean up dead connections
    deadClients.forEach(clientId => {
      this.clients.delete(clientId);
    });
  }

  sendToClient(clientId: string, event: DebugEvent): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(event));
      } catch (error) {
        this.writeLog(`Failed to send to client ${clientId}: ${error}`);
        this.clients.delete(clientId);
      }
    }
  }

  getConnectedClients(): DebugClient[] {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      socket: null, // Don't serialize the socket
      connectedAt: client.connectedAt
    }));
  }

  close(): void {
    if (this.wss) {
      this.clients.forEach((client) => {
        client.socket.close();
      });
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleClientMessage(clientId: string, message: any): void {
    // Handle client messages (ping, requests, etc.)
    if (message.type === 'ping') {
      this.sendToClient(clientId, {
        type: 'system-status',
        timestamp: new Date(),
        data: { type: 'pong' }
      });
    }
  }
}

export class DebugServer {
  private server: http.Server | null = null;
  private wsManager: WebSocketManager;
  private config: DebugServerConfig;
  private state: DebugState;
  private writeLog: (msg: string) => void;

  constructor(config: DebugServerConfig, writeLog: (msg: string) => void) {
    this.config = config;
    this.writeLog = writeLog;
    this.wsManager = new WebSocketManager(writeLog);
    this.state = this.initializeState();
  }

  private initializeState(): DebugState {
    return {
      systemInfo: {
        platform: process.platform,
        version: require('../../package.json').version,
        accessibilityEnabled: process.platform === 'darwin' ? 
          systemPreferences.isTrustedAccessibilityClient(false) : true,
        logPath: ''
      },
      blocklist: {
        data: { periods: [] },
        status: {
          lastUpdated: new Date(),
          nextUpdate: new Date(),
          updateInterval: 30000,
          isActive: false,
          currentPeriod: null
        },
        error: null
      },
      browsers: {
        chrome: {
          browser: 'chrome',
          isRunning: false,
          currentUrl: null,
          lastChecked: new Date()
        },
        edge: {
          browser: 'edge',
          isRunning: false,
          currentUrl: null,
          lastChecked: new Date()
        },
        safari: {
          browser: 'safari',
          isRunning: false,
          currentUrl: null,
          lastChecked: new Date()
        }
      },
      recentEvents: [],
      recentLogs: [],
      clients: []
    };
  }

  async start(): Promise<number> {
    if (!this.config.enabled) {
      this.writeLog('Debug server disabled');
      return 0;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      const tryPort = (port: number) => {
        this.server!.listen(port, this.config.host, () => {
          // Initialize WebSocket server
          this.wsManager.initialize(this.server!);
          this.writeLog(`Debug server started on http://${this.config.host}:${port}`);
          resolve(port);
        });

        this.server!.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE' && port < this.config.port + 10) {
            this.server!.removeAllListeners();
            tryPort(port + 1);
          } else {
            this.writeLog(`Debug server failed to start: ${err.message}`);
            reject(err);
          }
        });
      };

      tryPort(this.config.port);
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '/';
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (url === '/' || url === '/index.html') {
      this.serveDebugDashboard(res);
    } else if (url.startsWith('/api/')) {
      this.handleApiRequest(req, res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  private serveDebugDashboard(res: http.ServerResponse) {
    // Enhanced HTML page with WebSocket connection
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BrowserGuard Debug Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
          .connected { background-color: #d4edda; color: #155724; }
          .disconnected { background-color: #f8d7da; color: #721c24; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
          pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
          #events { max-height: 300px; overflow-y: auto; }
        </style>
      </head>
      <body>
        <h1>BrowserGuard Debug Dashboard</h1>
        
        <div id="connection-status" class="status disconnected">
          Connecting to WebSocket...
        </div>
        
        <div class="section">
          <h3>System Status</h3>
          <div id="system-status">Loading...</div>
        </div>
        
        <div class="section">
          <h3>Real-time Events</h3>
          <div id="events">No events yet...</div>
        </div>
        
        <script>
          let ws = null;
          let reconnectAttempts = 0;
          const maxReconnectAttempts = 5;
          
          function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + window.location.host);
            
            ws.onopen = function() {
              document.getElementById('connection-status').textContent = 'Connected to debug server';
              document.getElementById('connection-status').className = 'status connected';
              reconnectAttempts = 0;
              
              // Send ping to test connection
              ws.send(JSON.stringify({ type: 'ping' }));
            };
            
            ws.onclose = function() {
              document.getElementById('connection-status').textContent = 'Disconnected from debug server';
              document.getElementById('connection-status').className = 'status disconnected';
              
              // Attempt to reconnect
              if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                setTimeout(connectWebSocket, 2000 * reconnectAttempts);
              }
            };
            
            ws.onerror = function(error) {
              document.getElementById('connection-status').textContent = 'WebSocket connection error';
              document.getElementById('connection-status').className = 'status disconnected';
            };
            
            ws.onmessage = function(event) {
              try {
                const data = JSON.parse(event.data);
                addEvent(data);
              } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
              }
            };
          }
          
          function addEvent(event) {
            const eventsDiv = document.getElementById('events');
            const eventElement = document.createElement('div');
            eventElement.style.marginBottom = '10px';
            eventElement.style.padding = '8px';
            eventElement.style.backgroundColor = '#f8f9fa';
            eventElement.style.borderRadius = '4px';
            eventElement.innerHTML = 
              '<strong>' + event.type + '</strong> - ' + 
              new Date(event.timestamp).toLocaleTimeString() + 
              '<br><pre style="margin: 5px 0 0 0; font-size: 12px;">' + 
              JSON.stringify(event.data, null, 2) + '</pre>';
            
            eventsDiv.insertBefore(eventElement, eventsDiv.firstChild);
            
            // Keep only last 20 events in display
            while (eventsDiv.children.length > 20) {
              eventsDiv.removeChild(eventsDiv.lastChild);
            }
          }
          
          // Load initial system status
          fetch('/api/status')
            .then(r => r.json())
            .then(data => {
              document.getElementById('system-status').innerHTML = 
                '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            })
            .catch(e => {
              document.getElementById('system-status').innerHTML = 'Error: ' + e.message;
            });
          
          // Connect WebSocket
          connectWebSocket();
        </script>
      </body>
      </html>
    `;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  private handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '';
    const method = req.method || 'GET';

    if (url === '/api/status' && method === 'GET') {
      this.serveStatus(res);
    } else if (url === '/api/state' && method === 'GET') {
      this.serveState(res);
    } else if (url === '/api/test-url' && method === 'POST') {
      this.handleUrlTest(req, res);
    } else if (url === '/api/simulate-block' && method === 'POST') {
      this.handleBlockSimulation(req, res);
    } else if (url === '/api/clients' && method === 'GET') {
      this.serveConnectedClients(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }
  }

  private serveStatus(res: http.ServerResponse) {
    const status = {
      server: 'running',
      timestamp: new Date().toISOString(),
      systemInfo: this.state.systemInfo,
      connectedClients: this.getConnectedClients().length
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  private serveState(res: http.ServerResponse) {
    // Update clients info before serving state
    this.state.clients = this.getConnectedClients();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.state, null, 2));
  }

  private serveConnectedClients(res: http.ServerResponse) {
    const clients = this.getConnectedClients();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ clients, count: clients.length }, null, 2));
  }

  private handleUrlTest(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { url } = JSON.parse(body);
        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'URL is required' }));
          return;
        }

        const testResult = this.testUrlBlocking(url);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(testResult, null, 2));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
  }

  private handleBlockSimulation(req: http.IncomingMessage, res: http.ServerResponse) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { url, browser } = JSON.parse(body);
        if (!url || !browser) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'URL and browser are required' }));
          return;
        }

        const simulationResult = this.simulateBlocking(url, browser);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(simulationResult, null, 2));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
  }

  private testUrlBlocking(url: string): any {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    const result: {
      url: string;
      currentTime: string;
      isBlocked: boolean;
      matchedRule: { period: any; domain: string } | null;
      activePeriod: any | null;
      reason: string;
    } = {
      url,
      currentTime,
      isBlocked: false,
      matchedRule: null,
      activePeriod: null,
      reason: 'No matching rules found'
    };

    // Check against current blocklist
    for (const period of this.state.blocklist.data.periods || []) {
      if (currentTime >= period.start && currentTime <= period.end) {
        result.activePeriod = period;
        
        for (const domain of period.domains) {
          if (url.includes(domain)) {
            result.isBlocked = true;
            result.matchedRule = { period, domain };
            result.reason = `URL contains blocked domain '${domain}' during active period ${period.start}-${period.end}`;
            break;
          }
        }
        
        if (result.isBlocked) break;
      }
    }

    // Broadcast test event
    this.broadcastEvent({
      type: 'url-check',
      timestamp: new Date(),
      data: { ...result, source: 'manual-test' }
    });

    return result;
  }

  private simulateBlocking(url: string, browser: string): any {
    const testResult = this.testUrlBlocking(url);
    
    const simulationResult = {
      ...testResult,
      simulation: {
        browser,
        action: testResult.isBlocked ? 'would-block' : 'would-allow',
        warningShown: testResult.isBlocked,
        processKilled: false // We don't actually kill processes in simulation
      }
    };

    // Broadcast simulation event
    this.broadcastEvent({
      type: 'domain-blocked',
      timestamp: new Date(),
      data: { ...simulationResult, source: 'simulation' }
    });

    return simulationResult;
  }

  updateState(updates: Partial<DebugState>) {
    this.state = { ...this.state, ...updates };
  }

  // Method to broadcast events to all connected clients
  broadcastEvent(event: DebugEvent): void {
    this.wsManager.broadcast(event);
    this.addEvent(event);
  }

  // Method to get connected clients info
  getConnectedClients(): DebugClient[] {
    return this.wsManager.getConnectedClients();
  }

  // Method to get current state (for external access)
  getState(): DebugState {
    return this.state;
  }

  addEvent(event: DebugEvent) {
    this.state.recentEvents.unshift(event);
    // Keep only last 100 events
    if (this.state.recentEvents.length > 100) {
      this.state.recentEvents = this.state.recentEvents.slice(0, 100);
    }
  }

  addLog(entry: LogEntry) {
    this.state.recentLogs.unshift(entry);
    // Keep only last 200 logs
    if (this.state.recentLogs.length > 200) {
      this.state.recentLogs = this.state.recentLogs.slice(0, 200);
    }
    
    // Broadcast log entry to connected clients
    this.wsManager.broadcast({
      type: 'log-entry',
      timestamp: new Date(),
      data: entry
    });
  }

  stop() {
    if (this.server) {
      this.wsManager.close();
      this.server.close();
      this.writeLog('Debug server stopped');
    }
  }
}