#!/bin/bash
# 系统文件监听器限制修复脚本
# 请在终端中执行此脚本

echo "=========================================="
echo "  系统文件监听器限制修复"
echo "=========================================="
echo ""
echo "当前限制: $(cat /proc/sys/fs/inotify/max_user_watches)"
echo "目标限制: 524288"
echo ""
echo "=========================================="
echo "  步骤1: 添加配置到系统文件"
echo "=========================================="
echo ""
echo "执行以下命令（会提示输入sudo密码）:"
echo ""

# 添加配置
echo "$ echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf"
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 配置已添加到 /etc/sysctl.conf"
    echo ""
    echo "=========================================="
    echo "  步骤2: 应用配置"
    echo "=========================================="
    echo ""
    echo "$ sudo sysctl -p"
    sudo sysctl -p
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 配置已应用"
        echo ""
        echo "=========================================="
        echo "  步骤3: 验证修复"
        echo "=========================================="
        echo ""
        NEW_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
        echo "新的限制值: $NEW_LIMIT"
        
        if [ "$NEW_LIMIT" = "524288" ]; then
            echo ""
            echo "🎉 修复成功！"
            echo ""
            echo "=========================================="
            echo "  下一步: 启动开发服务器"
            echo "=========================================="
            echo ""
            echo "请在项目目录执行:"
            echo "$ cd /home/xiaodong/文档/memopark/stardust-dapp"
            echo "$ npm run dev"
            echo ""
        else
            echo ""
            echo "⚠️  限制值未正确更新，请手动检查"
        fi
    else
        echo ""
        echo "❌ 应用配置失败"
    fi
else
    echo ""
    echo "❌ 添加配置失败"
fi

