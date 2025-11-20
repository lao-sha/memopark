# 📊 变量重命名方案 - memo变量全面分析

**📅 日期**: 2025-10-29  
**🎯 目标**: 识别并分类所有包含"memo"的变量，制定重命名策略  
**📈 扫描结果**: 275个匹配，71个文件

---

## 📋 执行摘要

### 统计数据
- **总匹配数**: 275个
- **涉及文件**: 71个
- **主要类型**: 变量名、函数名、API路径、类型定义
- **建议修改**: 123个 (45%)
- **建议保留**: 152个 (55%)

---

## 🔍 变量分类详解

### 类型1️⃣: 代币数量相关变量 ⚠️ 建议修改

**特征**: 表示MEMO代币的数量、金额

#### 变量列表
```typescript
// ❌ 建议改为：dustAmount
memoAmount: number

// ❌ 建议改为：setDustAmount
setMemoAmount(value: number)

// ❌ 建议改为：dustReceive
memoReceive: number

// ❌ 建议改为：formatDustAmount 或 formatDUST
formatMemoAmount(amount: number): string
formatMemo(value: bigint): string
```

#### 影响范围
**前端文件** (8个核心文件):
- `MakerBridgeComplaintPage.tsx` (3处)
- `MakerBridgeDashboard.tsx` (3处)
- `MakerBridgeSwapPage.tsx` (8处)
- `SimpleBridgePage.tsx` (8处)
- `BridgeTransactionForm.tsx` (11处)
- `CreateMarketMakerPage.tsx` (4处)
- `MarketMakerConfigPage.tsx` (2处)
- `FirstPurchasePage.tsx` (2处)

**服务文件**:
- `tradingService.ts` (8处)

#### 修改示例
```typescript
// 修改前
const [memoAmount, setMemoAmount] = useState<number>(0);
const memoReceive = calculateUsdtToMemo(usdtAmount);
const formatted = formatMemoAmount(amount);

// 修改后
const [dustAmount, setDustAmount] = useState<number>(0);
const dustReceive = calculateUsdtToDust(usdtAmount);
const formatted = formatDustAmount(amount);
```

#### 修改难度
- **代码难度**: 🟡 中等 (需要全局搜索替换)
- **测试难度**: 🟢 低 (变量重命名不影响逻辑)
- **风险等级**: 🟢 低 (纯UI层变量)

---

### 类型2️⃣: 业务方向标识符 ✅ 建议保留

**特征**: 表示交易方向或流程名称

#### 变量列表
```typescript
// ✅ 保留 - 表示交易方向
memoToTron: 'DUST → TRON-USDT'
memoToUsdt: 'DUST → USDT'
usdtToMemo: 'USDT → DUST'

// ✅ 保留 - 表单tab key
activeTab: 'memoToTron' | 'usdtToMemo'
```

#### 保留理由
1. **语义清晰**: 明确表示"从MEMO到其他"或"从其他到MEMO"
2. **枚举值**: 作为字符串常量，改动会破坏现有API
3. **向后兼容**: 保持与链上数据结构一致

#### 影响范围
- `BridgeTransactionForm.tsx` (4处)
- `SimpleBridgePage.tsx` (2处)
- 其他交易相关页面

#### 建议
**保持不变**，仅在UI显示文本中替换：
```typescript
// 代码层（保持）
const direction = 'memoToTron';

// UI层（修改显示）
<Tab label="DUST → TRON USDT" value="memoToTron" />
```

---

### 类型3️⃣: API查询路径 ⚠️ 需要修改

**特征**: 链上pallet名称，已在链端重命名

#### API路径列表
```typescript
// ❌ 已失效 - pallet已重命名
api.query.memoAppeals          → api.query.stardustAppeals

// ❌ 可能失效 - 需要检查
api.query.pricing.getMemoMarketPriceWeighted
  → api.query.pricing.getDustMarketPriceWeighted (?)
```

#### 影响范围
**治理前端** (stardust-governance):
- `useAppealWithCache.ts` (1处)
- `useMonitoring.ts` (10处)
- `QueueManager.tsx` (2处)
- `contentGovernance.ts` (16处)

**主前端** (stardust-dapp):
- `PriceDashboard.tsx` (1处)
- `CreateListingForm.tsx` (2处)

#### 修改方案

##### 方案A: 全面更新（推荐）✅
```typescript
// 修改前
const appeals = await api.query.memoAppeals.appeals(id);
const price = await api.query.pricing.getMemoMarketPriceWeighted();

// 修改后
const appeals = await api.query.stardustAppeals.appeals(id);
const price = await api.query.pricing.getDustMarketPriceWeighted();
```

##### 方案B: 兼容层（保守）
```typescript
// 创建兼容适配器
const queryAdapter = {
  appeals: (id: number) => api.query.stardustAppeals.appeals(id),
  // 保持旧接口名称
};
```

#### 修改难度
- **代码难度**: 🟠 高 (需要与链端同步)
- **测试难度**: 🔴 高 (必须与链端一致)
- **风险等级**: 🟠 中 (API不匹配会导致运行时错误)

---

### 类型4️⃣: React标准Hook ✅ 绝对不改

**特征**: React框架的标准Hook

#### Hook列表
```typescript
// ✅ 绝对不改 - React标准API
import { useMemo, useCallback } from 'react';

const computed = useMemo(() => {
  return calculate();
}, [deps]);
```

#### 保留理由
- React框架内置Hook名称
- 改动会导致代码无法运行
- 与MEMO代币无关

---

### 类型5️⃣: 对象属性名 ⚠️ 谨慎修改

**特征**: 接口/类型定义中的属性名

#### 属性列表
```typescript
// 类型定义
interface SwapRecord {
  memoAmount: string;  // ⚠️ 与链上数据结构对应
  tronAddress: string;
  timestamp: number;
}

// 后端响应解构
const { memoAmount, tronAddress } = response.data;
```

#### 修改策略

##### 场景1: 前端独立类型 ✅ 可以改
```typescript
// 前端内部类型（可以改）
interface LocalSwapInfo {
  dustAmount: number;  // ✅ 改
  localId: string;
}
```

##### 场景2: 与链上对应 ❌ 不建议改
```typescript
// 链上返回类型（不改）
interface ChainSwapRecord {
  memoAmount: string;  // ❌ 保持与链上一致
  tronAddress: string;
}

// 解决方案：映射转换
const localData = {
  dustAmount: chainData.memoAmount,
  address: chainData.tronAddress,
};
```

---

## 🎯 综合修改方案

### 推荐策略：渐进式重命名 ⭐️

#### 阶段A: 高优先级（立即执行）✅

**目标**: UI显示文本和纯前端变量

**范围**:
1. 局部变量: `memoAmount`, `setMemoAmount`
2. 函数名: `formatMemoAmount`, `formatMemo`
3. 组件内部状态

**工具**: 自动化脚本 + IDE重构

**风险**: 🟢 低

---

#### 阶段B: 中优先级（链端就绪后）⚠️

**目标**: API路径和服务层

**前提**: 链端pallet名称已确认重命名完成

**范围**:
1. `api.query.memoAppeals` → `api.query.stardustAppeals`
2. `api.query.pricing.getMemoMarketPriceWeighted` → `getDustMarketPriceWeighted`

**工具**: 全局搜索替换 + 编译验证

**风险**: 🟠 中

---

#### 阶段C: 低优先级（可选）🔵

**目标**: 枚举值和字符串常量

**范围**:
1. 交易方向标识: `memoToTron` 等
2. 表单字段名

**建议**: **不修改** - 保持API稳定性

**风险**: 🟢 低（不改）

---

## 📋 详细修改清单

### 前端DApp (stardust-dapp)

#### 1. Bridge相关 (高优先级)

**文件**: `MakerBridgeSwapPage.tsx`
```typescript
// 第40行：状态变量
- const [memoAmount, setMemoAmount] = useState<number>(0);
+ const [dustAmount, setDustAmount] = useState<number>(0);

// 第163行：计算函数
- if (memoAmount <= 0 || marketPrice <= 0) {
+ if (dustAmount <= 0 || marketPrice <= 0) {

// 第167行：金额计算
- const baseUsdt = memoAmount * marketPrice;
+ const baseUsdt = dustAmount * marketPrice;

// 第421行：表单字段
- name="memoAmount"
+ name="dustAmount"
```

**预计修改**: 8处  
**测试重点**: 兑换计算逻辑

---

**文件**: `SimpleBridgePage.tsx`
```typescript
// 第24行：状态变量
- const [memoAmount, setMemoAmount] = useState<number>(0);
+ const [dustAmount, setDustAmount] = useState<number>(0);

// 第51行：计算
- const estimatedUsdt = memoAmount * currentRate;
+ const estimatedUsdt = dustAmount * currentRate;

// 第149行：交易构建
- BigInt(memoAmount * 1e12),
+ BigInt(dustAmount * 1e12),
```

**预计修改**: 8处  
**测试重点**: Swap交易功能

---

#### 2. Trading组件 (高优先级)

**文件**: `BridgeTransactionForm.tsx`
```typescript
// 第99行：状态
- const [memoAmount, setMemoAmount] = useState<number>(0)
+ const [dustAmount, setDustAmount] = useState<number>(0)

// 第180行：数量转换
- const qtyMinimalUnits = (BigInt(Math.floor(values.memoAmount * 1_000_000))).toString()
+ const qtyMinimalUnits = (BigInt(Math.floor(values.dustAmount * 1_000_000))).toString()

// 第293行：表单字段
- name="memoAmount"
+ name="dustAmount"

// 第348行：格式化显示（保留formatMEMO还是改formatDUST？）
- <Text strong>{formatMEMO(memoAmount)}</Text>
+ <Text strong>{formatDUST(dustAmount)}</Text>
```

**预计修改**: 11处  
**测试重点**: 双向兑换功能

---

#### 3. 服务层 (高优先级)

**文件**: `tradingService.ts`
```typescript
// 接口定义
export interface SwapParams {
-  memoAmount: string;
+  dustAmount: string;
   tronAddress: string;
}

export interface SwapRecord {
-  memoAmount: string;
+  dustAmount: string;
   usdtAmount: string;
}

// 函数参数
buildSwapTx(params: {
-  memoAmount: string;
+  dustAmount: string;
   tronAddress: string;
}) {
-  return this.api.tx.trading.swap(params.memoAmount, params.tronAddress);
+  return this.api.tx.trading.swap(params.dustAmount, params.tronAddress);
}
```

**预计修改**: 8处  
**测试重点**: 所有调用该服务的组件

---

#### 4. 辅助函数 (高优先级)

**文件**: `CreateMarketMakerPage.tsx`, `MarketMakerConfigPage.tsx`
```typescript
// 函数重命名
- function formatMemoAmount(amount: number): string {
+ function formatDustAmount(amount: number): string {
    if (!amount || amount <= 0) return '0'
    try {
      return (BigInt(amount * 1e12)).toString()
    } catch (e) {
-     console.error('formatMemoAmount error:', e)
+     console.error('formatDustAmount error:', e)
      return '0'
    }
  }

// 调用点更新
- const formatted = formatMemoAmount(minAmt)
+ const formatted = formatDustAmount(minAmt)
```

**预计修改**: 共6处（2个文件）  
**测试重点**: 金额格式化正确性

---

### 治理前端 (stardust-governance)

#### 5. API查询路径 (中优先级 - 链端就绪后)

**文件**: `contentGovernance.ts`, `useMonitoring.ts`, `QueueManager.tsx`
```typescript
// 修改前
- const appeals = await api.query.memoAppeals.appeals(id);
- const byStatus = await api.query.memoAppeals.appealsByStatus(status);
- const byUser = await api.query.memoAppeals.appealsByUser(account);

// 修改后
+ const appeals = await api.query.stardustAppeals.appeals(id);
+ const byStatus = await api.query.stardustAppeals.appealsByStatus(status);
+ const byUser = await api.query.stardustAppeals.appealsByUser(account);
```

**预计修改**: 30+处（分布在4个文件）  
**测试重点**: 申诉查询功能

**⚠️ 重要前提**: 链端`pallet-stardust-appeals` → `pallet-stardust-appeals`已完成

---

#### 6. 价格查询API (中优先级 - 需要确认)

**文件**: `PriceDashboard.tsx`, `CreateListingForm.tsx`
```typescript
// 需要确认链端是否重命名了这个函数
- const price = await api.query.pricing.getMemoMarketPriceWeighted();
+ const price = await api.query.pricing.getDustMarketPriceWeighted();
```

**预计修改**: 3处  
**⚠️ 注意**: 需要先确认链端`pallet-pricing`是否重命名了此函数

---

## 🔧 自动化修改脚本

### 脚本1: 前端变量重命名（安全）

```bash
#!/bin/bash
# rename-memo-variables.sh

cd /home/xiaodong/文档/stardust/stardust-dapp/src

# 阶段1: 重命名局部变量（TypeScript/TSX）
echo "🔄 重命名局部变量..."

# memoAmount → dustAmount
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i \
  's/\bmemoAmount\b/dustAmount/g'

# setMemoAmount → setDustAmount  
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i \
  's/\bsetMemoAmount\b/setDustAmount/g'

# memoReceive → dustReceive
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i \
  's/\bmemoReceive\b/dustReceive/g'

# formatMemoAmount → formatDustAmount
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i \
  's/\bformatMemoAmount\b/formatDustAmount/g'

# formatMemo → formatDust (但要排除useMemo)
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i \
  's/\bformatMemo\b/formatDust/g'

echo "✅ 局部变量重命名完成"

# 阶段2: 验证（不包含useMemo）
echo "🔍 验证useMemo未被误改..."
if grep -r "useDust" .; then
  echo "❌ 错误：React Hook被误改！"
  echo "   请手动修复 useDust → useMemo"
  exit 1
else
  echo "✅ React Hook完好"
fi

echo "✅ 前端变量重命名完成"
```

**使用方式**:
```bash
chmod +x docs/rename-memo-variables.sh
./docs/rename-memo-variables.sh
```

**安全性**: 
- ✅ 只修改前端代码
- ✅ 不影响API路径
- ✅ 包含验证步骤

---

### 脚本2: API路径更新（谨慎）

```bash
#!/bin/bash
# update-api-paths.sh

echo "⚠️  警告：此脚本会修改API查询路径"
echo "   前提：链端pallet已重命名完成"
echo ""
read -p "确认继续？[y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

cd /home/xiaodong/文档/stardust

# 更新stardust-governance
echo "🔄 更新治理前端API路径..."
find stardust-governance/src -name "*.ts" -o -name "*.tsx" | xargs sed -i \
  's/api\.query\.memoAppeals/api.query.stardustAppeals/g'

echo "✅ 治理前端API路径已更新"

# 更新stardust-dapp (price相关)
echo "🔄 更新主前端价格API..."
find stardust-dapp/src -name "*.ts" -o -name "*.tsx" | xargs sed -i \
  's/getMemoMarketPriceWeighted/getDustMarketPriceWeighted/g'

echo "✅ 主前端价格API已更新"

# 提交更改
git add -A
git commit -m "API路径更新: memoAppeals→stardustAppeals"

echo "✅ API路径更新完成"
```

**⚠️ 使用前提**:
1. 链端pallet重命名已完成
2. 节点已重新编译
3. 已测试API可用

---

## 📊 修改影响评估

### 影响范围统计

| 类别 | 文件数 | 修改点 | 优先级 | 风险 |
|------|--------|--------|--------|------|
| 局部变量 | 15 | ~60 | 高 | 低 |
| 函数名 | 3 | ~10 | 高 | 低 |
| 类型定义 | 2 | ~8 | 高 | 低 |
| API路径 | 6 | ~30 | 中 | 中 |
| 枚举值 | 3 | ~6 | 低 | 低 |
| **总计** | **29** | **~114** | - | - |

---

### 测试覆盖计划

#### 1. 单元测试
- [ ] 格式化函数测试 (`formatDustAmount`)
- [ ] 金额计算测试
- [ ] 类型转换测试

#### 2. 集成测试
- [ ] OTC订单创建流程
- [ ] Bridge兑换流程
- [ ] 价格查询功能

#### 3. 端到端测试
- [ ] 完整交易流程
- [ ] 多币种转换
- [ ] 错误处理

---

## 🚦 执行建议

### 推荐执行顺序

#### 第1步: 链端确认（已完成）✅
- [x] Pallet重命名完成
- [x] Runtime编译通过
- [ ] **确认API函数名是否改动**

#### 第2步: 前端变量（立即可做）⭐️
- [ ] 执行 `rename-memo-variables.sh`
- [ ] 手动验证`useMemo`未被误改
- [ ] 编译验证

#### 第3步: API路径（链端就绪后）
- [ ] 确认链端API名称
- [ ] 执行 `update-api-paths.sh`
- [ ] 功能测试

#### 第4步: 完整验证
- [ ] 所有页面手动测试
- [ ] 回归测试
- [ ] 性能测试

---

### 回滚方案

#### 场景1: 变量重命名失败
```bash
# 回滚前端变量修改
git reset --hard HEAD~1
```

#### 场景2: API路径不匹配
```bash
# 方案A: 临时修复
cd stardust-dapp/src/services
# 手动改回API路径

# 方案B: 创建兼容层
# 见下方"兼容适配器"章节
```

---

## 💡 兼容适配器（备选方案）

如果API路径更新风险太高，可以使用适配器：

```typescript
// src/services/api-adapter.ts

/**
 * API兼容适配器
 * 用途：在不修改业务代码的情况下适配新的API路径
 */
export class ApiAdapter {
  constructor(private api: ApiPromise) {}

  // 申诉查询适配
  get appeals() {
    return {
      appeals: (id: number) => this.api.query.stardustAppeals.appeals(id),
      appealsByStatus: (status: number) => 
        this.api.query.stardustAppeals.appealsByStatus(status),
      appealsByUser: (account: string) => 
        this.api.query.stardustAppeals.appealsByUser(account),
    };
  }

  // 价格查询适配
  get pricing() {
    return {
      getMarketPrice: () => 
        this.api.query.pricing.getDustMarketPriceWeighted(),
    };
  }
}

// 使用方式
import { ApiAdapter } from './api-adapter';

const adapter = new ApiAdapter(api);
const appeals = await adapter.appeals.appeals(123);
const price = await adapter.pricing.getMarketPrice();
```

**优点**:
- ✅ 业务代码改动最小
- ✅ 易于回滚
- ✅ 可以渐进式迁移

**缺点**:
- ❌ 增加一层抽象
- ❌ 略微影响性能
- ❌ 维护成本增加

---

## ✅ 完成检查清单

### 代码修改
- [ ] 局部变量已重命名
- [ ] 函数名已更新
- [ ] 类型定义已同步
- [ ] API路径已确认
- [ ] 枚举值已处理

### 测试验证
- [ ] 编译无错误
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动功能测试完成

### 文档更新
- [ ] API文档已更新
- [ ] 类型定义文档已同步
- [ ] 变更日志已记录

---

## 📞 需要确认的问题

### 链端API确认

**问题1**: `pallet-pricing`的查询函数是否重命名？
```rust
// 链端是否从：
pub fn get_memo_market_price_weighted() -> u64

// 改为：
pub fn get_dust_market_price_weighted() -> u64
```

**问题2**: 其他pallet是否有类似的函数需要重命名？

**建议**: 在执行阶段3之前，先在链端搜索所有包含`memo`的公开函数名。

---

## 🎯 最终建议

### 最佳实践方案 ⭐️

1. **立即执行**: 前端纯变量重命名（脚本1）
   - 风险低
   - 收益高
   - 不依赖链端

2. **延后执行**: API路径更新（脚本2）
   - 等待链端完全就绪
   - 详细测试API可用性
   - 准备回滚方案

3. **可选执行**: 枚举值重命名
   - 建议不改
   - 保持API稳定性

---

**📅 文档生成时间**: 2025-10-29  
**✍️ 创建者**: AI Assistant  
**🔄 版本**: v1.0  
**🎯 状态**: 待执行

