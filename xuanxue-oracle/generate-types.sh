#!/bin/bash
# Subxt元数据获取和代码生成脚本

set -e

echo "🔍 Subxt Metadata Generator"
echo "================================"
echo ""

# 检查subxt-cli是否安装
if ! command -v subxt &> /dev/null; then
    echo "📦 Installing subxt-cli..."
    cargo install subxt-cli
    echo "✅ subxt-cli installed"
fi

# 配置
CHAIN_ENDPOINT="${CHAIN_WS_ENDPOINT:-ws://127.0.0.1:9944}"
METADATA_FILE="metadata.scale"
OUTPUT_FILE="src/blockchain/runtime.rs"

echo "🌐 Connecting to: $CHAIN_ENDPOINT"

# 1. 获取metadata
echo "📥 Fetching metadata..."
if subxt metadata --url "$CHAIN_ENDPOINT" > "$METADATA_FILE" 2>/dev/null; then
    echo "✅ Metadata downloaded: $METADATA_FILE"
    ls -lh "$METADATA_FILE"
else
    echo "❌ Failed to fetch metadata"
    echo "   Make sure the chain is running at $CHAIN_ENDPOINT"
    exit 1
fi

# 2. 生成Rust代码
echo "🔨 Generating Rust code..."
if subxt codegen --file "$METADATA_FILE" > "$OUTPUT_FILE" 2>/dev/null; then
    echo "✅ Code generated: $OUTPUT_FILE"

    # 统计生成的代码行数
    LINES=$(wc -l < "$OUTPUT_FILE")
    echo "   Generated $LINES lines of code"

    # 添加模块声明到mod.rs
    if ! grep -q "pub mod runtime;" src/blockchain/mod.rs 2>/dev/null; then
        echo ""
        echo "📝 Adding module declaration to mod.rs..."
        # 在第一行后插入
        sed -i '1a pub mod runtime;' src/blockchain/mod.rs || \
        echo "pub mod runtime;" | cat - src/blockchain/mod.rs > temp && mv temp src/blockchain/mod.rs
        echo "✅ Module declaration added"
    fi
else
    echo "❌ Failed to generate code"
    exit 1
fi

echo ""
echo "🎉 Success! Generated files:"
echo "   - $METADATA_FILE (metadata)"
echo "   - $OUTPUT_FILE (Rust types)"
echo ""
echo "Next steps:"
echo "   1. Review the generated code"
echo "   2. Update your code to use the new types"
echo "   3. Run: cargo check"
