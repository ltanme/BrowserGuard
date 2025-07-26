# BrowserGuard-M4

## 安装与运行

1. `git clone` 本仓库，`cd BrowserGuard-M4`
2. `npm install`
3. 开发模式：`npm run dev`
4. 打包：使用 `./build.sh` 脚本

## 打包脚本使用

### 快速打包
```bash
# 打包所有平台 (macOS + Windows)
./build.sh

# 只打包 macOS
./build.sh --mac

# 只打包 Windows
./build.sh --win

# 只清理缓存
./build.sh --clean-only

# 查看帮助
./build.sh --help
```

### 手动打包 (旧方式)
```bash
# macOS (Apple Silicon)
npm run build:mac

# Windows 10 x86
npm run build:win
```

## 首次运行 & 权限授予

- macOS 首次启动会自动弹出"辅助功能"设置面板，请勾选 BrowserGuard。
- Windows 需以管理员身份运行以便自动关闭浏览器进程。

## 功能说明

- 开机自启（macOS LaunchAgent/Windows 注册表）
- 轮询 blocklist 接口，实时拦截受限域名
- 支持 Chrome/Safari/Edge/Firefox
- 多语言弹窗（中/英）
- 日志写入 `~/Library/Logs/BrowserGuard/renderer.log` 或 `%APPDATA%\BrowserGuard\logs\renderer.log`
- 仅管理员密码可退出

## 目录结构

详见项目内 `readme.md` 结构图。

## 打包产物

- macOS: `dist/BrowserGuard-1.0.0-arm64.dmg`
- Windows: `dist/BrowserGuard Setup 1.0.0-ia32.exe`

## CI 自动化

- `.github/workflows/build.yml` 自动打包 DMG/EXE

## 开发说明

- 主进程代码：`src/main/`
- 渲染进程（React）：`src/renderer/`
- 类型定义：`src/shared/types.ts`
- 权限引导、托盘、kill 进程、日志等见主进程代码
- 跨平台浏览器 URL 获取见 `src/main/getUrlMac.ts`、`src/main/getUrlWin.ts`、`scripts/`

---

如需自定义图标，请替换 `build/icon.png`。

## 开发调试

每次修改主进程、preload 或前端代码后，建议依次执行：
```bash



