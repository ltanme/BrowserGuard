#!/bin/bash

# BrowserGuard 版本管理脚本
# 用法: ./scripts/version.sh [版本号]
# 例如: ./scripts/version.sh 1.0.7

set -e

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

# 检查是否在正确的目录
check_directory() {
    if [ ! -f "package.json" ]; then
        print_error "请在项目根目录运行此脚本"
        exit 1
    fi
}

# 获取当前版本号
get_current_version() {
    node -p "require('./package.json').version"
}

# 验证版本号格式
validate_version() {
    local version=$1
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "版本号格式错误，请使用 x.y.z 格式 (例如: 1.0.7)"
        exit 1
    fi
}

# 更新版本号
update_version() {
    local new_version=$1
    local current_version=$(get_current_version)
    
    print_info "当前版本: $current_version"
    print_info "新版本: $new_version"
    
    # 更新 package.json
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" package.json
    else
        # Linux
        sed -i "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" package.json
    fi
    
    print_success "版本号已更新为 $new_version"
}

# 验证版本号更新
verify_version_update() {
    local expected_version=$1
    local actual_version=$(get_current_version)
    
    if [ "$expected_version" != "$actual_version" ]; then
        print_error "版本号更新失败！期望: $expected_version, 实际: $actual_version"
        exit 1
    fi
    
    print_success "版本号验证通过: $actual_version"
}

# 检查Git状态
check_git_status() {
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "检测到未提交的更改，请先提交或暂存更改"
        git status --short
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 创建Git标签
create_git_tag() {
    local version=$1
    local tag_name="v$version"
    
    print_info "创建Git标签: $tag_name"
    
    # 删除本地标签（如果存在）
    if git tag -l | grep -q "^$tag_name$"; then
        print_warning "标签 $tag_name 已存在，正在删除..."
        git tag -d "$tag_name"
    fi
    
    # 删除远程标签（如果存在）
    if git ls-remote --tags origin | grep -q "refs/tags/$tag_name"; then
        print_warning "远程标签 $tag_name 已存在，正在删除..."
        git push origin ":refs/tags/$tag_name" 2>/dev/null || true
    fi
    
    # 创建新标签
    git tag "$tag_name"
    print_success "Git标签已创建: $tag_name"
}

# 推送更改到远程仓库
push_changes() {
    local version=$1
    local tag_name="v$version"
    
    print_info "推送更改到远程仓库..."
    
    # 提交版本号更改
    git add package.json
    git commit -m "chore: 更新版本号到 $version"
    
    # 推送代码
    print_info "推送代码到 master 分支..."
    if ! git push origin master; then
        print_error "推送代码失败！"
        exit 1
    fi
    
    # 重新创建标签（确保指向最新提交）
    print_info "重新创建标签 $tag_name（指向最新提交）..."
    if git tag -l | grep -q "^$tag_name$"; then
        git tag -d "$tag_name"
    fi
    git tag "$tag_name"
    
    # 推送标签
    print_info "推送标签 $tag_name..."
    if ! git push origin "$tag_name"; then
        print_error "推送标签失败！"
        exit 1
    fi
    
    print_success "更改已推送到远程仓库"
}

# 验证远程标签版本
verify_remote_tag() {
    local version=$1
    local tag_name="v$version"
    
    print_info "验证远程标签版本..."
    
    # 等待一下让远程同步
    sleep 3
    
    # 先获取最新的远程信息
    git fetch origin --tags
    
    # 检查远程标签是否存在
    if ! git ls-remote --tags origin | grep -q "refs/tags/$tag_name"; then
        print_error "远程标签 $tag_name 不存在！"
        exit 1
    fi
    
    # 获取远程标签的版本号
    local remote_version=""
    if git show "origin/$tag_name:package.json" 2>/dev/null | grep -q '"version"'; then
        remote_version=$(git show "origin/$tag_name:package.json" 2>/dev/null | grep '"version"' | sed 's/.*"version": "\([^"]*\)".*/\1/')
    else
        # 如果无法直接访问，尝试从本地标签获取
        if git tag -l | grep -q "^$tag_name$"; then
            remote_version=$(git show "$tag_name:package.json" 2>/dev/null | grep '"version"' | sed 's/.*"version": "\([^"]*\)".*/\1/')
        fi
    fi
    
    if [ -z "$remote_version" ]; then
        print_warning "无法获取远程标签版本号，跳过验证"
        return 0
    fi
    
    if [ "$version" != "$remote_version" ]; then
        print_error "远程标签版本不匹配！期望: $version, 实际: $remote_version"
        exit 1
    fi
    
    print_success "远程标签版本验证通过: $remote_version"
}

# 显示帮助信息
show_help() {
    echo "BrowserGuard 版本管理脚本"
    echo
    echo "用法:"
    echo "  $0 [版本号]"
    echo "  $0 --help"
    echo
    echo "参数:"
    echo "  版本号    新版本号 (格式: x.y.z，例如: 1.0.7)"
    echo "  --help    显示此帮助信息"
    echo
    echo "示例:"
    echo "  $0 1.0.7"
    echo "  $0 2.1.0"
    echo
    echo "注意事项:"
    echo "  - 脚本会自动更新 package.json 中的版本号"
    echo "  - 创建 Git 标签 v[版本号]"
    echo "  - 推送更改到远程仓库"
    echo "  - 验证版本号在所有地方都正确同步"
    echo "  - 触发 GitHub Actions 构建"
}

# 主函数
main() {
    local version=$1
    
    # 显示帮助
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_help
        exit 0
    fi
    
    # 检查参数
    if [ -z "$version" ]; then
        print_error "请提供版本号"
        echo
        show_help
        exit 1
    fi
    
    # 验证版本号
    validate_version "$version"
    
    # 检查目录
    check_directory
    
    # 检查Git状态
    check_git_status
    
    # 更新版本号
    update_version "$version"
    
    # 验证版本号更新
    verify_version_update "$version"
    
    # 推送更改
    push_changes "$version"
    
    # 验证远程标签版本
    verify_remote_tag "$version"
    
    print_success "版本管理完成！"
    print_info "版本 $version 已正确同步到所有位置"
    print_info "GitHub Actions 构建将使用正确的版本号"
    
    echo
    print_info "后续步骤："
    echo "1. 访问 GitHub Actions: https://github.com/ltanme/BrowserGuard/actions"
    echo "2. 查看 v$version 的构建进度"
    echo "3. 构建完成后访问 Releases: https://github.com/ltanme/BrowserGuard/releases"
    echo "4. 下载对应平台的二进制文件"
    echo
    print_success "🎉 版本 $version 发布流程已启动！"
}

# 运行主函数
main "$@" 