#!/bin/bash

# BrowserGuard 打包脚本
# 支持 macOS 和 Windows 平台打包

set -e  # 遇到错误时退出

echo "🚀 开始 BrowserGuard 打包流程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 清理函数
cleanup() {
    print_info "🧹 清理缓存和构建文件..."
    
    # 删除 dist 目录
    if [ -d "dist" ]; then
        rm -rf dist
        print_success "已删除 dist 目录"
    fi
    
    # 删除 node_modules (可选，取消注释以完全重新安装依赖)
    # if [ -d "node_modules" ]; then
    #     rm -rf node_modules
    #     print_success "已删除 node_modules 目录"
    # fi
    
    # 清理 npm 缓存
    npm cache clean --force
    print_success "已清理 npm 缓存"
    
    # 清理 electron-builder 缓存
    rm -rf ~/.cache/electron-builder
    print_success "已清理 electron-builder 缓存"
    
    # 删除之前的构建产物，但保留图标文件
    if [ -d "build" ]; then
        # 只删除 build 目录中的其他文件，保留图标文件
        find build -type f ! -name 'icon.png' ! -name 'icon.ico' -delete
        print_success "已清理 build 目录（保留图标文件）"
    fi
}

# 安装依赖
install_deps() {
    print_info "📦 安装/更新依赖..."
    
    # 检查是否需要重新安装依赖
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "已安装依赖"
    else
        print_info "依赖已存在，跳过安装"
    fi
}

# 构建函数
build() {
    print_info "🔨 开始构建..."
    
    # 构建主进程
    print_info "构建主进程..."
    npm run build:main
    
    # 构建渲染进程
    print_info "构建渲染进程..."
    npm run build:renderer
    
    print_success "构建完成"
}

# 打包 macOS
package_mac() {
    print_info "🍎 开始打包 macOS..."
    
    # 检查是否在 macOS 上
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_warning "当前不在 macOS 系统上，跳过 macOS 打包"
        return
    fi
    
    npm run build:mac
    
    if [ $? -eq 0 ]; then
        print_success "macOS 打包完成"
        print_info "macOS 安装包位置: dist/BrowserGuard-*.dmg"
    else
        print_error "macOS 打包失败"
        exit 1
    fi
}

# 打包 Windows
package_win() {
    print_info "🪟 开始打包 Windows..."
    
    npm run build:win
    
    if [ $? -eq 0 ]; then
        print_success "Windows 打包完成"
        print_info "Windows 安装包位置: dist/BrowserGuard Setup *.exe"
    else
        print_error "Windows 打包失败"
        exit 1
    fi
}

# 显示构建信息
show_build_info() {
    print_info "📋 构建信息:"
    echo "  - 项目名称: BrowserGuard"
    echo "  - 主进程: dist/main/main.js"
    echo "  - 渲染进程: dist/renderer/renderer.js"
    echo "  - 预加载脚本: dist/preload/preload.js"
    echo "  - PowerShell 脚本: scripts/*.ps1"
    echo ""
}

# 验证构建结果
verify_build() {
    print_info "🔍 验证构建结果..."
    
    # 检查关键文件是否存在
    local missing_files=()
    
    if [ ! -f "dist/main/main.js" ]; then
        missing_files+=("dist/main/main.js")
    fi
    
    if [ ! -f "dist/renderer/renderer.js" ]; then
        missing_files+=("dist/renderer/renderer.js")
    fi
    
    if [ ! -f "dist/preload/preload.js" ]; then
        missing_files+=("dist/preload/preload.js")
    fi
    
    if [ ! -f "dist/renderer/index.html" ]; then
        missing_files+=("dist/renderer/index.html")
    fi
    
    # 检查 PowerShell 脚本
    if [ ! -f "scripts/getChromeUrl.ps1" ]; then
        missing_files+=("scripts/getChromeUrl.ps1")
    fi
    
    if [ ! -f "scripts/getEdgeUrl.ps1" ]; then
        missing_files+=("scripts/getEdgeUrl.ps1")
    fi
    
    if [ ! -f "scripts/getFirefoxUrl.ps1" ]; then
        missing_files+=("scripts/getFirefoxUrl.ps1")
    fi
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        print_success "所有构建文件验证通过"
    else
        print_error "缺少以下文件:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        exit 1
    fi
}

# 自动生成时间型版本号
new_version="1.$(date +"%y%m%d.%H%M")"
print_info "自动设置版本号为 $new_version"
jq ".version = \"$new_version\"" package.json > package.json.tmp && mv package.json.tmp package.json
print_success "package.json 版本号已更新为 $new_version"

# 主函数
main() {
    echo "=========================================="
    echo "    BrowserGuard 跨平台打包脚本"
    echo "=========================================="
    echo ""
    
    # 检查参数
    local build_mac=false
    local build_win=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mac)
                build_mac=true
                shift
                ;;
            --win)
                build_win=true
                shift
                ;;
            --all)
                build_mac=true
                build_win=true
                shift
                ;;
            --clean-only)
                cleanup
                exit 0
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --mac        只打包 macOS"
                echo "  --win        只打包 Windows"
                echo "  --all        打包所有平台 (默认)"
                echo "  --clean-only 只清理缓存"
                echo "  --help, -h   显示帮助信息"
                echo ""
                echo "示例:"
                echo "  $0 --all      # 打包所有平台"
                echo "  $0 --mac      # 只打包 macOS"
                echo "  $0 --win      # 只打包 Windows"
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                echo "使用 --help 查看帮助信息"
                exit 1
                ;;
        esac
    done
    
    # 如果没有指定平台，默认打包所有平台
    if [ "$build_mac" = false ] && [ "$build_win" = false ]; then
        build_mac=true
        build_win=true
    fi
    
    # 执行打包流程
    cleanup
    install_deps
    build
    show_build_info
    verify_build
    
    # 根据参数打包相应平台
    if [ "$build_mac" = true ]; then
        package_mac
    fi
    
    if [ "$build_win" = true ]; then
        package_win
    fi
    
    echo ""
    echo "=========================================="
    print_success "打包流程完成！"
    echo "=========================================="
    
    # 显示构建产物
    if [ "$build_mac" = true ]; then
        echo "🍎 macOS 安装包:"
        ls -la dist/*.dmg 2>/dev/null || echo "  未找到 macOS 安装包"
    fi
    
    if [ "$build_win" = true ]; then
        echo "🪟 Windows 安装包:"
        ls -la "dist/BrowserGuard Setup"*.exe 2>/dev/null || echo "  未找到 Windows 安装包"
    fi
    
    echo ""
}

# 执行主函数
main "$@" 