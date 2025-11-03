#!/bin/bash
# 归档 pallet-deposits 脚本
# 用途：将 pallet-deposits 从 Runtime 移除并归档
# 日期：2025-11-03

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  归档 pallet-deposits 脚本${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 第一步：确认操作
echo -e "${YELLOW}⚠️  此脚本将执行以下操作：${NC}"
echo "  1. 从 Runtime 移除 pallet-deposits 配置"
echo "  2. 将模块移至 archived-pallets/ 文件夹"
echo "  3. 更新 Cargo.toml 依赖"
echo "  4. 清理编译缓存"
echo ""
read -p "$(echo -e ${YELLOW}是否继续？[y/N]: ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ 操作已取消${NC}"
    exit 1
fi

# 第二步：检查 archived-pallets 目录
echo ""
echo -e "${GREEN}[1/6] 检查归档目录...${NC}"
if [ ! -d "$PROJECT_ROOT/archived-pallets" ]; then
    echo -e "${YELLOW}  - 创建 archived-pallets/ 目录${NC}"
    mkdir -p "$PROJECT_ROOT/archived-pallets"
fi

# 第三步：移动 pallet-deposits
echo ""
echo -e "${GREEN}[2/6] 移动 pallet-deposits 到归档目录...${NC}"
if [ -d "$PROJECT_ROOT/pallets/deposits" ]; then
    if [ -d "$PROJECT_ROOT/archived-pallets/deposits" ]; then
        echo -e "${YELLOW}  - 归档目录已存在，跳过移动${NC}"
    else
        echo -e "${YELLOW}  - 移动 pallets/deposits -> archived-pallets/deposits${NC}"
        mv "$PROJECT_ROOT/pallets/deposits" "$PROJECT_ROOT/archived-pallets/deposits"
        echo -e "${GREEN}  ✓ 移动成功${NC}"
    fi
else
    echo -e "${YELLOW}  - pallets/deposits 不存在，可能已归档${NC}"
fi

# 第四步：更新 Runtime 配置
echo ""
echo -e "${GREEN}[3/6] 更新 Runtime 配置...${NC}"

# 注释掉 runtime/src/lib.rs 中的 pallet_deposits
RUNTIME_LIB="$PROJECT_ROOT/runtime/src/lib.rs"
if [ -f "$RUNTIME_LIB" ]; then
    echo -e "${YELLOW}  - 注释 runtime/src/lib.rs 中的 Deposits pallet${NC}"
    sed -i.bak '/pub type Deposits = pallet_deposits/s/^/\/\/ [ARCHIVED] /' "$RUNTIME_LIB"
    echo -e "${GREEN}  ✓ 已注释 Deposits 声明${NC}"
fi

# 注释掉 runtime/src/configs/mod.rs 中的配置
RUNTIME_CONFIG="$PROJECT_ROOT/runtime/src/configs/mod.rs"
if [ -f "$RUNTIME_CONFIG" ]; then
    echo -e "${YELLOW}  - 注释 runtime/src/configs/mod.rs 中的配置${NC}"
    
    # 使用 awk 注释整个 impl pallet_deposits::Config for Runtime 块
    awk '
        /^impl pallet_deposits::Config for Runtime/ { in_block=1; print "// [ARCHIVED] " $0; next }
        in_block && /^}/ { print "// [ARCHIVED] " $0; in_block=0; next }
        in_block { print "// [ARCHIVED] " $0; next }
        { print }
    ' "$RUNTIME_CONFIG" > "$RUNTIME_CONFIG.tmp"
    
    mv "$RUNTIME_CONFIG.tmp" "$RUNTIME_CONFIG"
    echo -e "${GREEN}  ✓ 已注释 pallet_deposits 配置${NC}"
fi

# 第五步：更新 Cargo.toml
echo ""
echo -e "${GREEN}[4/6] 更新 Cargo.toml 依赖...${NC}"

# 注释掉 runtime/Cargo.toml 中的依赖
RUNTIME_CARGO="$PROJECT_ROOT/runtime/Cargo.toml"
if [ -f "$RUNTIME_CARGO" ]; then
    echo -e "${YELLOW}  - 注释 runtime/Cargo.toml 中的依赖${NC}"
    sed -i.bak '/^pallet-deposits/s/^/# [ARCHIVED] /' "$RUNTIME_CARGO"
    echo -e "${GREEN}  ✓ 已注释依赖${NC}"
fi

# 注释掉根 Cargo.toml 中的成员
ROOT_CARGO="$PROJECT_ROOT/Cargo.toml"
if [ -f "$ROOT_CARGO" ]; then
    echo -e "${YELLOW}  - 注释根 Cargo.toml 中的成员${NC}"
    sed -i.bak '/pallets\/deposits/s/^/# [ARCHIVED] /' "$ROOT_CARGO"
    echo -e "${GREEN}  ✓ 已注释成员${NC}"
fi

# 第六步：清理编译缓存
echo ""
echo -e "${GREEN}[5/6] 清理编译缓存...${NC}"
if [ -d "$PROJECT_ROOT/target" ]; then
    echo -e "${YELLOW}  - 清理 target/ 目录（可能需要一些时间）${NC}"
    cargo clean
    echo -e "${GREEN}  ✓ 清理完成${NC}"
else
    echo -e "${YELLOW}  - target/ 目录不存在，跳过清理${NC}"
fi

# 第七步：验证归档
echo ""
echo -e "${GREEN}[6/6] 验证归档结果...${NC}"

# 检查归档目录
if [ -d "$PROJECT_ROOT/archived-pallets/deposits" ]; then
    echo -e "${GREEN}  ✓ archived-pallets/deposits/ 存在${NC}"
else
    echo -e "${RED}  ✗ archived-pallets/deposits/ 不存在${NC}"
    exit 1
fi

# 检查 ARCHIVED.md
if [ -f "$PROJECT_ROOT/archived-pallets/deposits/ARCHIVED.md" ]; then
    echo -e "${GREEN}  ✓ ARCHIVED.md 文档存在${NC}"
else
    echo -e "${YELLOW}  ⚠ ARCHIVED.md 不存在，需要手动创建${NC}"
fi

# 检查 pallets/deposits 已移除
if [ ! -d "$PROJECT_ROOT/pallets/deposits" ]; then
    echo -e "${GREEN}  ✓ pallets/deposits/ 已移除${NC}"
else
    echo -e "${YELLOW}  ⚠ pallets/deposits/ 仍然存在${NC}"
fi

# 完成
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  ✅ 归档完成！${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}后续步骤：${NC}"
echo "  1. 编译测试：cargo build --release"
echo "  2. 运行测试：cargo test"
echo "  3. 提交代码：git add . && git commit -m 'chore: 归档 pallet-deposits'"
echo ""
echo -e "${YELLOW}备份文件：${NC}"
echo "  - runtime/src/lib.rs.bak"
echo "  - runtime/src/configs/mod.rs.bak"
echo "  - runtime/Cargo.toml.bak"
echo "  - Cargo.toml.bak"
echo ""
echo -e "${YELLOW}如需回滚，可以使用备份文件恢复${NC}"
echo ""

