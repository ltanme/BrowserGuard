# BrowserGuard 自动发布脚本

这个目录包含了用于自动发布 BrowserGuard 的脚本，可以自动更新版本号、创建 Git 标签并触发 GitHub Actions 构建。

## 脚本文件

- `version.sh` - macOS/Linux 版本 (Bash)

## 使用方法

### macOS/Linux

```bash
# 发布新版本
./scripts/version.sh 1.0.5

# 显示帮助
./scripts/version.sh --help
```

### Windows

```powershell
# 发布新版本
.\scripts\release.ps1 1.0.5

# 显示帮助
.\scripts\release.ps1 -Help
```

## 脚本功能

### 1. 版本号验证
- 检查版本号格式 (x.y.z)
- 验证版本号有效性

### 2. 环境检查
- 检查是否在项目根目录
- 检查 Git 状态（未提交的更改）
- 验证 Node.js 环境

### 3. 自动更新
- 更新 `package.json` 中的版本号
- 创建 Git 标签 `v[版本号]`
- 提交版本号更改
- 推送代码和标签到远程仓库

### 4. 触发构建
- 自动触发 GitHub Actions 构建
- 显示构建和 Release 链接
- 提供手动检查指导

## 工作流程

1. **验证输入** - 检查版本号格式和项目环境
2. **更新版本** - 修改 package.json 中的版本号
3. **Git 操作** - 创建标签、提交更改、推送到远程
4. **触发构建** - 推送标签触发 GitHub Actions
5. **等待完成** - 显示相关链接供手动检查

## 注意事项

### 前置条件
- 确保在项目根目录运行脚本
- 确保 Git 已配置远程仓库
- 确保有推送权限到远程仓库
- 确保 Node.js 已安装

### 版本号格式
- 必须使用 `x.y.z` 格式
- 例如：`1.0.5`、`2.1.0`、`1.0.0`

### Git 状态
- 如果有未提交的更改，脚本会提示确认
- 建议在运行脚本前先提交所有更改

## 示例输出

```bash
$ ./scripts/version.sh 1.0.5

[INFO] 当前版本: 1.0.4
[INFO] 新版本: 1.0.5
[SUCCESS] 版本号已更新为 1.0.5
[INFO] 创建Git标签: v1.0.5
[SUCCESS] Git标签已创建: v1.0.5
[INFO] 推送更改到远程仓库...
[SUCCESS] 更改已推送到远程仓库
[INFO] 等待GitHub Actions构建完成...
[INFO] 构建URL: https://github.com/ltanme/BrowserGuard/actions
[INFO] Release URL: https://github.com/ltanme/BrowserGuard/releases

[WARNING] 请手动检查以下链接:
1. GitHub Actions: https://github.com/ltanme/BrowserGuard/actions
2. Releases: https://github.com/ltanme/BrowserGuard/releases
3. 等待构建完成后下载二进制文件

[SUCCESS] 发布流程完成！
[INFO] 版本 1.0.5 已触发构建，请检查 GitHub Actions 和 Releases 页面
```

## 故障排除

### 常见问题

1. **权限错误**
   ```bash
   chmod +x scripts/version.sh
   ```

2. **版本号格式错误**
   - 确保使用 `x.y.z` 格式
   - 例如：`1.0.5` 而不是 `1.0.5.0`

3. **Git 标签已存在**
   - 脚本会自动删除已存在的标签
   - 如果删除失败，手动删除后重试

4. **推送失败**
   - 检查网络连接
   - 确认有推送权限
   - 检查远程仓库配置

### 手动操作

如果脚本失败，可以手动执行以下步骤：

```bash
# 1. 更新版本号
sed -i '' 's/"version": "1.0.4"/"version": "1.0.5"/' package.json

# 2. 提交更改
git add package.json
git commit -m "chore: 更新版本号到 1.0.5"

# 3. 创建标签
git tag v1.0.5

# 4. 推送
git push origin master
git push origin v1.0.5
```

## 相关链接

- [GitHub Actions](https://github.com/ltanme/BrowserGuard/actions)
- [Releases](https://github.com/ltanme/BrowserGuard/releases)
- [项目主页](https://github.com/ltanme/BrowserGuard) 