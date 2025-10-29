#!/bin/bash
# 修复系统文件监听器限制问题
# 用于解决 ENOSPC: System limit for number of file watchers reached

echo "======================================"
echo "修复系统文件监听器限制"
echo "======================================"
echo ""

# 检查当前限制
echo "1. 检查当前限制..."
CURRENT_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
echo "   当前限制: $CURRENT_LIMIT"
echo ""

# 建议的限制
RECOMMENDED_LIMIT=524288
echo "2. 建议的限制: $RECOMMENDED_LIMIT"
echo ""

if [ "$CURRENT_LIMIT" -ge "$RECOMMENDED_LIMIT" ]; then
    echo "✅ 当前限制已经足够，无需修改"
    exit 0
fi

echo "3. 需要增加限制"
echo ""
echo "请选择修复方式："
echo ""
echo "方式1 - 临时修复（重启后失效）"
echo "----------------------------------------"
echo "sudo sysctl fs.inotify.max_user_watches=$RECOMMENDED_LIMIT"
echo ""
echo "方式2 - 永久修复（推荐）"
echo "----------------------------------------"
echo "echo fs.inotify.max_user_watches=$RECOMMENDED_LIMIT | sudo tee -a /etc/sysctl.conf"
echo "sudo sysctl -p"
echo ""
echo "方式3 - 手动配置文件（永久）"
echo "----------------------------------------"
echo "1) 编辑配置文件:"
echo "   sudo nano /etc/sysctl.conf"
echo ""
echo "2) 在文件末尾添加:"
echo "   fs.inotify.max_user_watches=$RECOMMENDED_LIMIT"
echo ""
echo "3) 保存并应用:"
echo "   sudo sysctl -p"
echo ""
echo "======================================"
echo "请执行以上命令之一来修复问题"
echo "======================================"
echo ""
echo "执行后，运行以下命令验证："
echo "cat /proc/sys/fs/inotify/max_user_watches"
echo ""

