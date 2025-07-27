# BrowserGuard 自动发布脚本 (Windows PowerShell)
# 用法: .\scripts\release.ps1 [版本号]
# 例如: .\scripts\release.ps1 1.0.5

param(
    [Parameter(Position=0)]
    [string]$Version,
    
    [Parameter()]
    [switch]$Help
)

# 颜色定义
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$White = "White"

# 打印带颜色的消息
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

# 检查是否在正确的目录
function Test-Directory {
    if (-not (Test-Path "package.json")) {
        Write-Error "请在项目根目录运行此脚本"
        exit 1
    }
}

# 获取当前版本号
function Get-CurrentVersion {
    node -p "require('./package.json').version"
}

# 验证版本号格式
function Test-VersionFormat {
    param([string]$Version)
    if ($Version -notmatch '^\d+\.\d+\.\d+$') {
        Write-Error "版本号格式错误，请使用 x.y.z 格式 (例如: 1.0.5)"
        exit 1
    }
}

# 检查Git状态
function Test-GitStatus {
    $status = git status --porcelain
    if ($status) {
        Write-Warning "检测到未提交的更改，请先提交或暂存更改"
        git status --short
        $response = Read-Host "是否继续？(y/N)"
        if ($response -notmatch '^[Yy]$') {
            exit 1
        }
    }
}

# 更新版本号
function Update-Version {
    param([string]$NewVersion)
    $currentVersion = Get-CurrentVersion
    
    Write-Info "当前版本: $currentVersion"
    Write-Info "新版本: $NewVersion"
    
    # 更新 package.json
    $content = Get-Content "package.json" -Raw
    $content = $content -replace "`"version`": `"$currentVersion`"", "`"version`": `"$NewVersion`""
    Set-Content "package.json" $content
    
    Write-Success "版本号已更新为 $NewVersion"
}

# 创建Git标签
function New-GitTag {
    param([string]$Version)
    $tagName = "v$Version"
    
    Write-Info "创建Git标签: $tagName"
    
    # 删除本地标签（如果存在）
    $existingTags = git tag -l
    if ($existingTags -contains $tagName) {
        Write-Warning "标签 $tagName 已存在，正在删除..."
        git tag -d $tagName
    }
    
    # 删除远程标签（如果存在）
    $remoteTags = git ls-remote --tags origin
    if ($remoteTags -match "refs/tags/$tagName") {
        Write-Warning "远程标签 $tagName 已存在，正在删除..."
        git push origin ":refs/tags/$tagName" 2>$null
    }
    
    # 创建新标签
    git tag $tagName
    Write-Success "Git标签已创建: $tagName"
}

# 推送更改到远程仓库
function Push-Changes {
    param([string]$Version)
    $tagName = "v$Version"
    
    Write-Info "推送更改到远程仓库..."
    
    # 提交版本号更改
    git add package.json
    git commit -m "chore: 更新版本号到 $Version"
    
    # 推送代码
    git push origin master
    
    # 推送标签
    git push origin $tagName
    
    Write-Success "更改已推送到远程仓库"
}

# 等待构建完成
function Wait-Build {
    param([string]$Version)
    $tagName = "v$Version"
    
    Write-Info "等待GitHub Actions构建完成..."
    Write-Info "构建URL: https://github.com/ltanme/BrowserGuard/actions"
    Write-Info "Release URL: https://github.com/ltanme/BrowserGuard/releases"
    
    Write-Host ""
    Write-Warning "请手动检查以下链接:"
    Write-Host "1. GitHub Actions: https://github.com/ltanme/BrowserGuard/actions"
    Write-Host "2. Releases: https://github.com/ltanme/BrowserGuard/releases"
    Write-Host "3. 等待构建完成后下载二进制文件"
    Write-Host ""
}

# 显示帮助信息
function Show-Help {
    Write-Host "BrowserGuard 自动发布脚本 (Windows PowerShell)"
    Write-Host ""
    Write-Host "用法:"
    Write-Host "  .\scripts\release.ps1 [版本号]"
    Write-Host "  .\scripts\release.ps1 -Help"
    Write-Host ""
    Write-Host "参数:"
    Write-Host "  版本号    新版本号 (格式: x.y.z，例如: 1.0.5)"
    Write-Host "  -Help     显示此帮助信息"
    Write-Host ""
    Write-Host "示例:"
    Write-Host "  .\scripts\release.ps1 1.0.5"
    Write-Host "  .\scripts\release.ps1 2.1.0"
    Write-Host ""
    Write-Host "注意事项:"
    Write-Host "  - 脚本会自动更新 package.json 中的版本号"
    Write-Host "  - 创建 Git 标签 v[版本号]"
    Write-Host "  - 推送更改到远程仓库"
    Write-Host "  - 触发 GitHub Actions 构建"
    Write-Host "  - 自动创建 GitHub Release"
}

# 主函数
function Main {
    param([string]$Version)
    
    # 显示帮助
    if ($Help) {
        Show-Help
        return
    }
    
    # 检查参数
    if (-not $Version) {
        Write-Error "请提供版本号"
        Write-Host ""
        Show-Help
        exit 1
    }
    
    # 验证版本号
    Test-VersionFormat $Version
    
    # 检查目录
    Test-Directory
    
    # 检查Git状态
    Test-GitStatus
    
    # 更新版本号
    Update-Version $Version
    
    # 创建Git标签
    New-GitTag $Version
    
    # 推送更改
    Push-Changes $Version
    
    # 等待构建
    Wait-Build $Version
    
    Write-Success "发布流程完成！"
    Write-Info "版本 $Version 已触发构建，请检查 GitHub Actions 和 Releases 页面"
}

# 运行主函数
Main $Version 