#!/bin/bash
# 函数级中文注释：一键启用 pallet-memo-ipfs 到 Runtime
# 
# 功能：
# 1. 取消注释 MemoIpfs pallet（47号索引）
# 2. 恢复 MemoIpfs 的导入
# 3. 替换所有 NoOpIpfsPinner 为 MemoIpfs
# 4. 编译验证
#
# 使用方法：
# chmod +x scripts/enable-memo-ipfs.sh
# ./scripts/enable-memo-ipfs.sh

set -e  # 遇到错误立即退出

echo "🚀 启用 pallet-memo-ipfs 到 Runtime..."
echo ""

# 检查是否在项目根目录
if [ ! -f "Cargo.toml" ] || [ ! -d "runtime" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 备份文件
echo "📦 备份原文件..."
cp runtime/src/lib.rs runtime/src/lib.rs.bak
cp runtime/src/configs/mod.rs runtime/src/configs/mod.rs.bak
echo "   ✓ 备份已保存到 .bak 文件"
echo ""

# 1. 取消注释 MemoIpfs pallet
echo "🔧 步骤1/4: 启用 MemoIpfs pallet (索引47)..."
sed -i 's|^    // 函数级中文注释：IPFS自动pin服务，提供IpfsPinner trait实现供其他pallet使用|    // 函数级中文注释：IPFS自动pin服务，提供IpfsPinner trait实现供其他pallet使用|' runtime/src/lib.rs
sed -i 's|^    // ⚠️ 临时注释以测试runtime编译|    // ✅ 已启用：pallet-memo-ipfs正式集成|' runtime/src/lib.rs
sed -i 's|^    //\(#\[runtime::pallet_index(47)\]\)|    \1|' runtime/src/lib.rs
sed -i 's|^    //\(pub type MemoIpfs = pallet_memo_ipfs;\)|    \1|' runtime/src/lib.rs
echo "   ✓ MemoIpfs pallet 已启用"
echo ""

# 2. 恢复 MemoIpfs 导入
echo "🔧 步骤2/4: 恢复 MemoIpfs 导入..."
sed -i 's|AccountId, Aura, Balance, Balances, Block, BlockNumber, Hash, /\*MemoIpfs,\*/ Nonce|AccountId, Aura, Balance, Balances, Block, BlockNumber, Hash, MemoIpfs, Nonce|' runtime/src/configs/mod.rs
echo "   ✓ MemoIpfs 已添加到导入列表"
echo ""

# 3. 替换所有 NoOpIpfsPinner 为 MemoIpfs
echo "🔧 步骤3/4: 替换 NoOpIpfsPinner 为 MemoIpfs..."

# 更新注释
sed -i 's|// ⚠️ 使用占位实现，待pallet_memo_ipfs正式集成后替换为MemoIpfs|// ✅ 使用 MemoIpfs 实现，执行实际IPFS pin操作|g' runtime/src/configs/mod.rs

# 替换类型
sed -i 's|type IpfsPinner = NoOpIpfsPinner;|type IpfsPinner = MemoIpfs;|g' runtime/src/configs/mod.rs

# 统计替换次数
COUNT=$(grep -c "type IpfsPinner = MemoIpfs;" runtime/src/configs/mod.rs || true)
echo "   ✓ 已替换 $COUNT 处 Config"
echo ""

# 4. 编译验证
echo "🔧 步骤4/4: 编译验证..."
echo "   (这可能需要40-60秒...)"
echo ""

if cargo check --package memopark-runtime 2>&1 | tee /tmp/enable-memo-ipfs-build.log | tail -20; then
    echo ""
    echo "✅ 编译成功！"
    echo ""
    echo "═══════════════════════════════════════════"
    echo "🎉 pallet-memo-ipfs 已成功启用到 Runtime"
    echo "═══════════════════════════════════════════"
    echo ""
    echo "📋 已完成的修改："
    echo "   1. runtime/src/lib.rs:"
    echo "      - 启用 #[runtime::pallet_index(47)] MemoIpfs"
    echo ""
    echo "   2. runtime/src/configs/mod.rs:"
    echo "      - 恢复 MemoIpfs 导入"
    echo "      - 替换 $COUNT 处 NoOpIpfsPinner → MemoIpfs"
    echo ""
    echo "🔍 下一步操作："
    echo "   1. 启动节点测试自动pin功能："
    echo "      ./target/release/memopark-node --dev --offchain-worker=Always"
    echo ""
    echo "   2. 查看pin状态（需要节点运行）："
    echo "      使用 Polkadot.js Apps 连接本地节点"
    echo "      查看 Developer > Chain State > memoIpfs"
    echo ""
    echo "   3. 充值 IpfsPoolAccount（建议≥100 MEMO）："
    echo "      地址: 5EYCAe5jLbHcAAMKvLFSXgCTbPrLgBJusvPwfKcaKzuf5X5e"
    echo ""
    echo "   4. 注册 IPFS operator（至少1个）："
    echo "      调用 memoIpfs.registerOperator(...)"
    echo ""
    echo "📁 备份文件位置："
    echo "   - runtime/src/lib.rs.bak"
    echo "   - runtime/src/configs/mod.rs.bak"
    echo ""
    
    # 删除备份（可选）
    # rm runtime/src/lib.rs.bak runtime/src/configs/mod.rs.bak
    
    exit 0
else
    echo ""
    echo "❌ 编译失败！"
    echo ""
    echo "正在恢复备份文件..."
    mv runtime/src/lib.rs.bak runtime/src/lib.rs
    mv runtime/src/configs/mod.rs.bak runtime/src/configs/mod.rs
    echo "   ✓ 已恢复原文件"
    echo ""
    echo "📋 错误日志已保存到: /tmp/enable-memo-ipfs-build.log"
    echo "   请查看错误详情并修复后重试"
    echo ""
    exit 1
fi

