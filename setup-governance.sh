#!/bin/bash
# Memopark Governance Platform - 项目初始化脚本

set -e

echo "🚀 开始创建 Memopark Governance Platform..."

PROJECT_DIR="memopark-governance"

# 1. 创建项目目录
if [ -d "$PROJECT_DIR" ]; then
    echo "⚠️  目录 $PROJECT_DIR 已存在，是否删除并重新创建? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        rm -rf "$PROJECT_DIR"
    else
        echo "❌ 取消操作"
        exit 1
    fi
fi

mkdir "$PROJECT_DIR"
cd "$PROJECT_DIR"

# 2. 使用 Vite 初始化
echo "📦 初始化 Vite + React + TypeScript 项目..."
pnpm create vite . --template react-ts

# 3. 安装核心依赖
echo "📦 安装核心依赖..."
pnpm add react@^18.3.0 react-dom@^18.3.0 react-router-dom@^6.20.0

# UI 框架
pnpm add antd@^5.12.0 @ant-design/icons@^5.2.0 @ant-design/charts@^2.0.0 @ant-design/pro-components@^2.6.0

# Polkadot 生态
pnpm add @polkadot/api@^10.11.0 @polkadot/extension-dapp@^0.46.0 @polkadot/util@^12.6.0 @polkadot/util-crypto@^12.6.0

# 状态管理和数据获取
pnpm add zustand@^4.4.0 @tanstack/react-query@^5.0.0

# 工具库
pnpm add axios@^1.6.0 dayjs@^1.11.0 lodash-es@^4.17.0 copy-to-clipboard@^3.3.0

# 4. 安装开发依赖
echo "📦 安装开发依赖..."
pnpm add -D typescript@^5.3.0 vite@^5.0.0 @vitejs/plugin-react@^4.2.0
pnpm add -D @types/node@^20.10.0 @types/react@^18.2.0 @types/react-dom@^18.2.0 @types/lodash-es@^4.17.0
pnpm add -D eslint@^8.54.0 prettier@^3.1.0 @typescript-eslint/eslint-plugin@^6.13.0 @typescript-eslint/parser@^6.13.0
pnpm add -D less@^4.2.0 vitest@^1.0.0 @testing-library/react@^14.1.0

# 5. 创建目录结构
echo "📁 创建目录结构..."
mkdir -p src/{contexts/{Api,Wallet},services/{blockchain,wallet},pages/{Dashboard,Proposals/{List,Detail,Create},Voting,Applications,Analytics,Members,Settings},components/{WalletConnect,ProposalCard,VotingProgress,AccountSelector,ChainStatus},hooks,utils,types,config,layouts/{BasicLayout,BlankLayout},assets/{images,styles}}

echo "✅ 项目初始化完成！"
echo ""
echo "📚 接下来的步骤："
echo "   1. cd $PROJECT_DIR"
echo "   2. 查看生成的代码文件"
echo "   3. pnpm dev 启动开发服务器"
echo ""
echo "🔗 参考资料："
echo "   - 查看 README.md 了解项目结构"
echo "   - 查看 docs/ 目录了解使用说明"

