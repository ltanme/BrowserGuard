# GitHub Actions 自动构建和发布

本项目使用 GitHub Actions 实现自动构建和发布功能。

## 触发方式

### 1. 标签触发（推荐）
推送一个版本标签来触发构建：
```bash
git tag v1.0.0
git push origin v1.0.0
```

### 2. 手动触发
在 GitHub 仓库页面：
1. 点击 "Actions" 标签
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow"
4. 输入版本号（如：1.0.0）
5. 点击 "Run workflow"

## 构建流程

1. **并行构建**：同时在 macOS 和 Windows 环境中构建
2. **依赖安装**：自动安装 Node.js 和项目依赖
3. **应用构建**：编译 TypeScript 和打包应用
4. **平台打包**：生成 macOS DMG 和 Windows EXE
5. **发布 Release**：创建 GitHub Release 并上传安装包

## 输出文件

- **macOS**: `BrowserGuard-{version}-arm64.dmg`
- **Windows**: `BrowserGuard-Setup-{version}-ia32.exe`

## 注意事项

- 确保 `package.json` 中的版本号正确
- macOS 构建需要禁用代码签名（`CSC_IDENTITY_AUTO_DISCOVERY: false`）
- Windows 构建使用 NSIS 安装程序
- 构建产物保留 7 天

## 故障排除

如果构建失败，请检查：
1. `package.json` 中的构建脚本是否正确
2. 依赖是否完整安装
3. 构建配置文件是否正确
4. GitHub Actions 日志中的具体错误信息 