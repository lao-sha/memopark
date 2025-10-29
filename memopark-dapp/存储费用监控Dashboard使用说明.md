# 存储费用监控 Dashboard 使用说明

## 📋 功能概述

存储费用监控 Dashboard 提供实时监控三个存储池账户的资金状况：
- **IPFS 运营者池**（50% 分配）
- **Arweave 运营者池**（30% 分配）
- **节点运维激励池**（20% 分配）

---

## 🔗 访问地址

```
http://localhost:5173/#/storage-treasury
```

**提示**：需要先启动前端开发服务器

```bash
cd /home/xiaodong/文档/stardust/stardust-dapp
npm run dev
```

---

## 📊 页面布局

### 1. 顶部统计卡片（4个）

| 卡片 | 说明 | 数据来源 |
|------|------|---------|
| **累计收集** | 从供奉路由等渠道累计收集的存储费用 | `storageTreasury.totalCollected()` |
| **累计分配** | 自动路由分配给三个池的总金额 | `storageTreasury.totalDistributed()` |
| **分配率** | 累计分配 / 累计收集 × 100% | 计算值 |
| **下次分配** | 距离下次自动分配的时间 | 计算值（基于区块） |

---

### 2. 存储池卡片（3个）

每个存储池显示：
- 池名称和图标
- 分配比例（50% / 30% / 20%）
- 描述信息
- **当前余额**（实时查询）
- PalletId（如 `py/ipfs+`）
- 池账户地址（可复制）

#### IPFS 运营者池

```
PalletId:    py/ipfs+
地址:        5Fm7k7ujcY5ZJbsESbEnKGrzWjNCHbjaV2mxqadxqhxrr53g
分配比例:    50%
用途:        去中心化存储主力服务
```

#### Arweave 运营者池

```
PalletId:    py/arwve
地址:        5Fb3ZBybyX51w78S7gsjQPe87kaEuFR1zNGPR5e9vGQHD4Cp
分配比例:    30%
用途:        永久存储备份服务
```

#### 节点运维激励池

```
PalletId:    py/nodes
地址:        5EbnYT9ywWTYqRmm3SjUfNHKcT7hKARDpR2pfjzKHuGLXoRh
分配比例:    20%
用途:        基础设施维护激励
```

---

### 3. 路由表配置

显示当前的路由表配置：

| 类型 | 目标账户 | 分配比例 |
|------|---------|---------|
| IPFS 池 | 5Fm7k7uj... | 50% |
| Arweave 池 | 5Fb3ZByb... | 30% |
| 节点池 | 5EbnYT9y... | 20% |

**数据来源**：`storageTreasury.storageRouteTable()`

---

### 4. 分配历史

显示最近 5 次自动分配记录：

| 区块号 | 分配金额 | 路由数量 |
|--------|---------|---------|
| #1,234,567 | 1,000.0000 MEMO | 3 个路由 |
| #1,134,767 | 950.0000 MEMO | 3 个路由 |
| ... | ... | ... |

**数据来源**：`storageTreasury.distributionHistory(block)`

---

## 🔄 数据刷新

### 自动刷新

- **刷新频率**：每 12 秒（约 2 个区块）
- **刷新内容**：
  - 所有池账户余额
  - 累计收集/分配统计
  - 路由表配置
  - 当前区块号
  - 下次分配时间

### 手动刷新

- 刷新页面（F5 或 Ctrl+R）

---

## 📈 关键指标说明

### 1. 累计收集（Total Collected）

**含义**：从供奉路由和 IPFS pin 请求等渠道累计收集的所有存储费用

**计算方式**：
```
累计收集 = 供奉路由 2% + IPFS pin 费用
```

**查询接口**：
```javascript
const collected = await api.query.storageTreasury.totalCollected();
```

---

### 2. 累计分配（Total Distributed）

**含义**：通过路由自动分配给三个池的总金额

**计算方式**：
```
累计分配 = Σ(每周自动分配金额)
```

**查询接口**：
```javascript
const distributed = await api.query.storageTreasury.totalDistributed();
```

---

### 3. 分配率（Distribution Rate）

**含义**：已分配金额占累计收集的百分比

**计算方式**：
```
分配率 = (累计分配 / 累计收集) × 100%
```

**健康指标**：
- ✅ **>90%**：分配及时，资金利用率高
- ⚠️ **70-90%**：正常范围，有一定积压
- 🔴 **<70%**：分配滞后，可能需要调整周期

---

### 4. 下次分配（Next Distribution）

**含义**：距离下次自动分配的剩余时间

**计算方式**：
```
分配周期 = 100,800 区块（约 7 天）
剩余区块 = 100,800 - ((当前区块 - 最后分配区块) % 100,800)
剩余时间 = 剩余区块 × 6 秒
```

**示例**：
```
剩余区块: 50,400 区块
剩余时间: 84 小时 0 分钟（约 3.5 天）
```

---

## 🎯 使用场景

### 场景1：日常监控

**操作**：
1. 访问 `#/storage-treasury`
2. 查看三个池的余额
3. 检查分配率是否健康（>90%）
4. 查看下次分配时间

**频率**：每周 1-2 次

---

### 场景2：分配验证

**操作**：
1. 等待自动分配触发（每 7 天）
2. 查看"分配历史"表格
3. 验证新增的分配记录
4. 对比三个池余额的变化

**验证点**：
- ✅ 分配金额 = 上次余额 × 路由表比例
- ✅ 三个池余额都有增加
- ✅ 分配历史有新记录

---

### 场景3：异常排查

**症状**：分配率过低（<70%）

**排查步骤**：
1. 检查路由表是否配置正确
2. 检查最后分配区块号
3. 计算距离下次分配的时间
4. 查看链端日志是否有错误

**可能原因**：
- ❌ 路由表未配置
- ❌ 自动分配逻辑异常
- ❌ 托管账户余额不足

---

## 🔧 高级功能

### 1. 复制池账户地址

**操作**：
- 点击池卡片中的地址旁边的"复制"图标
- 地址已复制到剪贴板

**用途**：
- 手动查询池余额
- 创建治理提案转账
- 验证路由表配置

---

### 2. 查看完整地址

**操作**：
- 在池卡片中，地址显示为缩略形式
- 完整地址可通过复制功能获取

---

### 3. 监听实时事件

**前端代码示例**：
```javascript
// 监听路由分配事件
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (api.events.storageTreasury.RouteDistributed.is(event)) {
      const { kind, to, amount } = event.data;
      console.log(`路由分配: kind=${kind}, to=${to}, amount=${amount}`);
      // 刷新页面数据
      loadPoolBalances();
    }
  });
});
```

---

## 📱 移动端适配

Dashboard 采用响应式设计，支持移动端访问：

### 桌面端（>= 1200px）
- 4 个统计卡片一行显示
- 3 个池卡片一行显示
- 表格完整显示

### 平板端（768px - 1199px）
- 2 个统计卡片一行显示
- 2 个池卡片一行显示
- 表格可横向滚动

### 手机端（< 768px）
- 1 个统计卡片一行显示
- 1 个池卡片一行显示
- 表格可横向滚动

---

## 🐛 常见问题

### Q1: 页面显示"连接到区块链..."

**原因**：前端未连接到区块链节点

**解决方案**：
1. 检查节点是否启动
```bash
ps aux | grep stardust-node
```

2. 启动节点（如未启动）
```bash
cd /home/xiaodong/文档/stardust
./target/release/stardust-node --dev --tmp --rpc-cors all --rpc-methods unsafe
```

3. 检查 WebSocket 连接
```bash
# 默认端口：9944
curl -X POST http://localhost:9944 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}'
```

---

### Q2: 池余额显示为 0

**原因**：
- 尚未执行过路由分配
- 路由表未配置

**解决方案**：
1. 检查路由表配置
```javascript
const routes = await api.query.storageTreasury.storageRouteTable();
console.log(routes.toJSON());
```

2. 配置路由表（如未配置）
```bash
node scripts/setup-storage-routes.js
```

3. 等待自动分配（每 100,800 区块）

---

### Q3: 路由表显示"路由表未配置"

**原因**：未调用 `initialize_storage_routes()` 或 `set_storage_route_table()`

**解决方案**：
```bash
# 方法1：通过脚本配置（推荐）
node scripts/setup-storage-routes.js

# 方法2：通过 Sudo 手动配置
# 前端提交 Sudo 提案调用 storageTreasury.setStorageRouteTable
```

---

### Q4: 下次分配时间不准确

**原因**：
- 区块时间波动
- 网络拥堵

**说明**：
- 区块时间理论值：6 秒/块
- 实际可能波动：5-7 秒/块
- 下次分配时间为**估算值**，实际可能有 ±10% 误差

---

## 📊 数据 API 参考

### 链端查询接口

```javascript
// 1. 累计收集
const collected = await api.query.storageTreasury.totalCollected();

// 2. 累计分配
const distributed = await api.query.storageTreasury.totalDistributed();

// 3. 路由表
const routes = await api.query.storageTreasury.storageRouteTable();

// 4. 分配历史
const history = await api.query.storageTreasury.distributionHistory(blockNumber);

// 5. 最后分配区块
const lastBlock = await api.query.storageTreasury.lastDistributionBlock();

// 6. 池账户余额
const account = await api.query.system.account(poolAddress);
const balance = account.data.free;
```

---

## 🚀 未来扩展

### 计划功能

1. **导出数据**
   - 导出分配历史为 CSV
   - 导出池余额变化趋势

2. **图表可视化**
   - 余额变化折线图
   - 分配比例饼图
   - 累计收集/分配趋势图

3. **告警功能**
   - 分配率低于阈值告警
   - 池余额异常告警
   - 自动分配失败告警

4. **治理集成**
   - 直接在页面提交修改路由表的提案
   - 查看相关治理提案状态

---

## ✅ 检查清单

### 首次使用

- [ ] 节点已启动
- [ ] 前端已连接到节点
- [ ] 路由表已配置
- [ ] 页面可正常访问

### 日常监控

- [ ] 三个池余额正常增长
- [ ] 分配率 >90%
- [ ] 无异常告警
- [ ] 分配历史记录完整

---

## 📞 技术支持

**遇到问题？**

1. 查看浏览器控制台日志
2. 查看链端日志
3. 检查 WebSocket 连接状态
4. 参考本文档的"常见问题"部分

---

**更新时间**：2025-10-10  
**版本**：v1.0.0  

