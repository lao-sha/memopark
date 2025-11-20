#!/bin/bash
# Frontier 集成检查清单脚本
# 用途：自动检查 Frontier 集成的各项配置是否完成

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

echo "================================================"
echo "     Stardust Frontier 集成检查清单"
echo "================================================"
echo ""

# 函数：检查项通过
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

# 函数：检查项失败
check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

# 函数：检查项警告
check_warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((WARNINGS++))
}

# ============================================
# Phase 1: 依赖检查
# ============================================
echo "【Phase 1: 依赖检查】"
echo ""

# 1.1 检查工作区 Cargo.toml
if grep -q "pallet-evm.*frontier" Cargo.toml; then
    check_pass "工作区 Cargo.toml 已添加 Frontier 依赖"
else
    check_fail "工作区 Cargo.toml 缺少 Frontier 依赖"
fi

# 1.2 检查 Runtime Cargo.toml
if grep -q "pallet-evm" runtime/Cargo.toml; then
    check_pass "Runtime Cargo.toml 已添加 pallet-evm"
else
    check_fail "Runtime Cargo.toml 缺少 pallet-evm"
fi

# 1.3 检查 Node Cargo.toml
if grep -q "fc-rpc" node/Cargo.toml 2>/dev/null; then
    check_pass "Node Cargo.toml 已添加 Frontier RPC"
else
    check_warn "Node Cargo.toml 未添加 Frontier RPC（Phase 2 需要）"
fi

# 1.4 检查 Cargo.lock
if [ -f "Cargo.lock" ]; then
    if grep -q "pallet-evm" Cargo.lock; then
        check_pass "Cargo.lock 已更新（包含 Frontier）"
    else
        check_fail "Cargo.lock 未更新，请运行 'cargo update'"
    fi
else
    check_fail "Cargo.lock 不存在"
fi

echo ""

# ============================================
# Phase 2: Runtime 配置检查
# ============================================
echo "【Phase 2: Runtime 配置检查】"
echo ""

# 2.1 检查 EVM 配置文件
if [ -f "runtime/src/configs/evm.rs" ]; then
    check_pass "EVM 配置文件存在"
    
    # 检查关键配置
    if grep -q "impl pallet_evm::Config for Runtime" runtime/src/configs/evm.rs; then
        check_pass "EVM Pallet 配置完整"
    else
        check_fail "EVM Pallet 配置不完整"
    fi
    
    if grep -q "impl pallet_ethereum::Config for Runtime" runtime/src/configs/evm.rs; then
        check_pass "Ethereum Pallet 配置完整"
    else
        check_fail "Ethereum Pallet 配置不完整"
    fi
else
    check_fail "EVM 配置文件不存在：runtime/src/configs/evm.rs"
fi

# 2.2 检查 Runtime lib.rs
if grep -q "pub mod evm" runtime/src/lib.rs || grep -q "pub use configs::evm" runtime/src/lib.rs; then
    check_pass "Runtime lib.rs 已引入 EVM 配置"
else
    check_fail "Runtime lib.rs 未引入 EVM 配置"
fi

# 2.3 检查 construct_runtime 宏
if grep -q "pub type EVM = pallet_evm" runtime/src/lib.rs; then
    check_pass "EVM Pallet 已添加到 construct_runtime"
else
    check_fail "EVM Pallet 未添加到 construct_runtime"
fi

if grep -q "pub type Ethereum = pallet_ethereum" runtime/src/lib.rs; then
    check_pass "Ethereum Pallet 已添加到 construct_runtime"
else
    check_fail "Ethereum Pallet 未添加到 construct_runtime"
fi

# 2.4 检查 std feature
if grep -q "\"pallet-evm/std\"" runtime/Cargo.toml; then
    check_pass "pallet-evm/std feature 已配置"
else
    check_fail "pallet-evm/std feature 未配置"
fi

echo ""

# ============================================
# Phase 3: 编译检查
# ============================================
echo "【Phase 3: 编译检查】"
echo ""

# 3.1 检查 Runtime WASM
if [ -f "target/release/wbuild/stardust-runtime/stardust_runtime.compact.compressed.wasm" ]; then
    WASM_SIZE=$(stat -f%z "target/release/wbuild/stardust-runtime/stardust_runtime.compact.compressed.wasm" 2>/dev/null || stat -c%s "target/release/wbuild/stardust-runtime/stardust_runtime.compact.compressed.wasm" 2>/dev/null)
    check_pass "Runtime WASM 已构建 (大小: $((WASM_SIZE / 1024)) KB)"
    
    if [ $WASM_SIZE -gt 2097152 ]; then  # 2 MB
        check_warn "WASM 大小超过 2 MB，可能需要优化"
    fi
else
    check_warn "Runtime WASM 未构建，请运行 'cargo build --release -p stardust-runtime'"
fi

# 3.2 检查 Node 二进制
if [ -f "target/release/stardust-node" ]; then
    check_pass "Node 二进制已构建"
else
    check_warn "Node 二进制未构建，请运行 'cargo build --release -p stardust-node'"
fi

# 3.3 运行编译检查
echo ""
echo "正在运行编译检查..."
if cargo check --release -p stardust-runtime 2>&1 | grep -q "Finished"; then
    check_pass "Runtime 编译检查通过"
else
    check_fail "Runtime 编译检查失败"
fi

echo ""

# ============================================
# Phase 4: 配置参数检查
# ============================================
echo "【Phase 4: 配置参数检查】"
echo ""

# 4.1 检查 Chain ID
if grep -q "ChainId.*8888" runtime/src/configs/evm.rs 2>/dev/null; then
    check_warn "Chain ID 使用默认值 8888（主网上线前需修改）"
else
    check_pass "Chain ID 已自定义"
fi

# 4.2 检查 Gas 限制
if grep -q "BlockGasLimit.*15_000_000" runtime/src/configs/evm.rs 2>/dev/null; then
    check_pass "Block Gas Limit 已设置为 15M"
else
    check_warn "Block Gas Limit 未按推荐值设置"
fi

# 4.3 检查预编译合约
if grep -q "Precompiles" runtime/src/configs/evm.rs 2>/dev/null; then
    check_pass "预编译合约已配置"
    
    # 检查标准预编译
    if grep -q "ECRecover" runtime/src/configs/evm.rs 2>/dev/null; then
        check_pass "标准预编译（ECRecover等）已启用"
    else
        check_warn "标准预编译可能未完整配置"
    fi
else
    check_fail "预编译合约未配置"
fi

echo ""

# ============================================
# Phase 5: Node 配置检查
# ============================================
echo "【Phase 5: Node 配置检查（可选）】"
echo ""

# 5.1 检查 RPC 文件
if [ -f "node/src/rpc.rs" ]; then
    check_pass "RPC 扩展文件存在"
    
    if grep -q "fc_rpc::EthApi" node/src/rpc.rs; then
        check_pass "Ethereum RPC 已集成"
    else
        check_warn "Ethereum RPC 未集成（Phase 2 需要）"
    fi
else
    check_warn "RPC 扩展文件不存在（Phase 2 需要创建）"
fi

# 5.2 检查 Service 文件
if grep -q "fc_db::Backend" node/src/service.rs 2>/dev/null; then
    check_pass "Frontier 后端已集成到 Service"
else
    check_warn "Frontier 后端未集成（Phase 2 需要）"
fi

echo ""

# ============================================
# Phase 6: 安全检查
# ============================================
echo "【Phase 6: 安全检查】"
echo ""

# 6.1 检查是否使用独立货币
if grep -q "type Currency = Balances" runtime/src/configs/evm.rs 2>/dev/null; then
    check_warn "EVM 直接使用主 Balances（规则7：注意 MEMO 资金安全）"
else
    check_pass "EVM 使用独立货币系统"
fi

# 6.2 检查 WithdrawOrigin
if grep -q "WithdrawOrigin = EnsureAddressNever" runtime/src/configs/evm.rs 2>/dev/null; then
    check_pass "WithdrawOrigin 已禁用（安全）"
else
    check_warn "WithdrawOrigin 未禁用，可能存在安全风险"
fi

# 6.3 检查 SuicideQuickClearLimit
if grep -q "SuicideQuickClearLimit" runtime/src/configs/evm.rs 2>/dev/null; then
    check_pass "SuicideQuickClearLimit 已配置"
else
    check_warn "SuicideQuickClearLimit 未配置"
fi

echo ""

# ============================================
# Phase 7: 文档检查
# ============================================
echo "【Phase 7: 文档检查】"
echo ""

# 7.1 检查集成方案文档
if [ -f "docs/Frontier集成方案.md" ]; then
    check_pass "集成方案文档存在"
else
    check_warn "集成方案文档不存在"
fi

# 7.2 检查快速开始文档
if [ -f "docs/Frontier集成-快速开始.md" ]; then
    check_pass "快速开始文档存在"
else
    check_warn "快速开始文档不存在"
fi

# 7.3 检查 README 更新
if grep -q "Frontier" README.md 2>/dev/null; then
    check_pass "README.md 已更新 Frontier 信息"
else
    check_warn "README.md 未更新 Frontier 信息"
fi

echo ""

# ============================================
# 总结报告
# ============================================
echo "================================================"
echo "                  检查总结"
echo "================================================"
echo ""
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${YELLOW}警告: $WARNINGS${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

# 计算完成度
TOTAL=$((PASSED + FAILED + WARNINGS))
if [ $TOTAL -eq 0 ]; then
    COMPLETION=0
else
    COMPLETION=$((PASSED * 100 / TOTAL))
fi

echo "完成度: $COMPLETION%"
echo ""

# 判断状态
if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 恭喜！Frontier 集成检查全部通过！${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠️  集成基本完成，但有 $WARNINGS 个警告项需要注意${NC}"
    exit 0
else
    echo -e "${RED}❌ 集成未完成，有 $FAILED 个失败项需要修复${NC}"
    echo ""
    echo "建议："
    echo "1. 查看上方失败项详情"
    echo "2. 参考 docs/Frontier集成-快速开始.md"
    echo "3. 修复后重新运行本脚本"
    exit 1
fi

