# Memopark - 区块链纪念平台

基于 Substrate 的去中心化纪念与传承平台。

## 🚀 快速启动

### 前置要求
- Rust 工具链（nightly）
- Node.js 18+
- 至少 8GB 内存

### 一键启动（推荐）

#### 终端 1：启动链节点
```bash
cd /home/xiaodong/文档/memopark
./完全重置并启动.sh
```

等待看到：
```
✓ Running JSON-RPC server: addr=0.0.0.0:9944
✓ 🏆 Imported #1
```

#### 终端 2：启动前端（等节点启动30秒后）
```bash
cd /home/xiaodong/文档/memopark
./一键修复并启动.sh
```

等待看到：
```
➜  Local:   http://127.0.0.1:5173/
```

#### 浏览器访问
- 前端：http://127.0.0.1:5173
- Polkadot.js Apps：https://polkadot.js.org/apps（连接到 ws://127.0.0.1:9944）

---

## 📚 文档导航

### 启动与配置
- [快速启动指南](./快速启动指南.md) - 完整的启动流程
- [快速启动节点](./快速启动节点.md) - 节点启动详解
- [前端修复指南](./docs/FRONTEND_FIX_COMPLETE.md) - 连接问题排查
- [前端连接诊断](./docs/诊断前端连接.md) - 详细诊断步骤

### 功能文档
- [委员会提案 UI](./docs/council-proposal-ui.md) - 提案提交/投票/执行
- [做市商申请指南](./memopark-dapp/docs/MARKET_MAKER_APPLICATION_GUIDE.md)
- [治理设计](./memopark-dapp/design/governance-design.md)
- [墓地详情 UI](./memopark-dapp/design/grave_detail_ui_spec.md)

### 技术文档
- [Pallet 接口文档](./pallets接口文档.md)
- [前端文档](./前端文档.md)
- [签名错误排查](./docs/签名错误排查指南.md)
- [WebSocket 连接优化](./docs/防止WebSocket连接超限.md)
- [链节点启动说明](./docs/链节点启动说明.md)

---

## 🏗️ 项目结构

```
memopark/
├── node/                    # 节点实现
├── runtime/                 # Runtime 配置
├── pallets/                 # 自定义 Pallets
│   ├── market-maker/       # 做市商管理
│   ├── memo-grave/         # 墓地管理
│   ├── memo-offerings/     # 供奉系统
│   ├── collective/         # 委员会
│   └── ...                 # 其他 pallets
├── memopark-dapp/          # React 前端 DApp
│   ├── src/
│   │   ├── features/       # 功能模块
│   │   ├── components/     # 组件
│   │   └── lib/           # 工具库
│   └── docs/              # 前端文档
├── docs/                   # 项目文档
└── scripts/               # 工具脚本
```

---

## 🎯 核心功能

### 墓地管理
- ✅ 创建虚拟墓地（公开/私密）
- ✅ 逝者信息管理
- ✅ 媒体内容（相册/视频/文章）
- ✅ 背景音乐与播放列表

### 供奉系统
- ✅ 虚拟供品（鲜花/香烛等）
- ✅ MEMO 代币供奉
- ✅ 供奉记录与统计
- ✅ 台账系统

### OTC 交易
- ✅ 做市商申请与审核
- ✅ 挂单交易
- ✅ 托管与仲裁

### 治理机制
- ✅ 委员会提案
- ✅ 投票与执行
- ✅ Root 或 2/3 多数决策

### 身份与推荐
- ✅ 链上身份（昵称）
- ✅ 推荐码系统
- ✅ 推荐关系链

---

## 🛠️ 开发说明

### 编译 Runtime
```bash
cargo build --release -p memopark-node
```

### 运行测试
```bash
cargo test -p pallet-market-maker
```

### 前端开发
```bash
cd memopark-dapp
npm install
npm run dev
```

### 生成类型定义
```bash
cd memopark-dapp
npm run generate-types
```

---

## 🔒 安全注意事项

### 开发模式
- ✅ 使用 `--dev --tmp` 启动节点（每次重启清空数据）
- ✅ 前端本地签名仅用于开发/测试
- ✅ 助记词加密存储在浏览器 localStorage

### 生产环境
- ⚠️ 使用硬件钱包或浏览器扩展签名
- ⚠️ 启用 Subsquid 索引器分担查询压力
- ⚠️ 配置 Nginx 反向代理限制连接数
- ⚠️ 使用专业的 RPC 服务提供商

详见：[防止WebSocket连接超限](./docs/防止WebSocket连接超限.md)

---

## 📊 当前模式

⚡ **全局链上直连模式**

所有数据直接从链节点查询，暂时不使用 Subsquid 索引器。

**影响的功能**（暂时禁用）：
- ❌ Dashboard 历史趋势图
- ❌ 墓位排行榜
- ❌ 供奉时间线
- ❌ 按地址查询供奉历史

**正常工作的功能**：
- ✅ 委员会提案和投票
- ✅ 做市商申请和审批
- ✅ 创建墓地/逝者
- ✅ 供奉操作
- ✅ OTC 交易
- ✅ 所有链上写入和实时查询

---

## 🤝 贡献指南

### 编码规范
- ✅ 所有 Rust 代码使用详细的中文注释
- ✅ Pallet 之间保持低耦合
- ✅ 修改 pallet 后同步更新 README
- ✅ 前端使用组件化设计

### 提交流程
1. Fork 项目
2. 创建特性分支
3. 提交更改（清晰的中文注释）
4. 推送到分支
5. 提交 Pull Request

---

## 📝 许可证

详见 [LICENSE](./LICENSE) 文件。

---

## 🙏 致谢

- [Substrate](https://substrate.io/) - 区块链开发框架
- [Polkadot.js](https://polkadot.js.org/) - JavaScript API
- [Ant Design](https://ant.design/) - UI 组件库
- [React](https://react.dev/) - 前端框架

---

## 📞 支持

- **文档**：查看 `docs/` 文件夹
- **问题排查**：`docs/FRONTEND_FIX_COMPLETE.md`
- **快速启动**：`快速启动指南.md`

---

**最后更新**：2025-10-01
**版本**：0.1.0
**状态**：开发中（主网零迁移，允许破坏式调整）
