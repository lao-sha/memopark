# Simple Bridge Pallet (极简桥接模块)

## 概述

提供 MEMO ↔ USDT (TRC20) 极简桥接功能，支持两种模式：

### 1. 官方桥接（SimpleBridge）
- ✅ **中心化服务**: 使用 `simple-bridge-service` 监听链上事件并发送 USDT
- ✅ **动态汇率**: 基于 `pallet-pricing` 的市场加权均价
- ✅ **适用场景**: 官方运营的桥接服务，追求简单可靠

### 2. 做市商桥接（OCW + MakerBridge）🆕
- ✅ **去中心化**: 使用 OCW（链下工作机制）自动验证 TRON 交易
- ✅ **零成本运维**: 无需运行中心化服务，OCW 节点自动验证
- ✅ **多做市商**: 支持多个做市商竞争提供桥接服务
- ✅ **安全机制**: 超时退款、举报仲裁、防重放攻击
- ✅ **适用场景**: 去中心化的做市商桥接服务

## MVP 设计原则（已升级到动态定价）

- ✅ **单向兑换**: 只支持 MEMO → USDT（先验证需求）
- ⭐ **动态汇率**: 基于 `pallet-pricing` 的市场加权均价（OTC + Bridge）
- ✅ **统一价格**: 直接使用 pallet-pricing 返回的价格，无需额外备用汇率
- ✅ **最小金额**: 100 MEMO（可配置）
- ✅ **极简状态**: SimpleBridge 只有 `completed` 布尔值，OCW 支持完整状态机
- ✅ **托管模式**: MEMO 锁定在托管账户（SimpleBridge 用桥接账户，OCW 用做市商托管账户）

## 定价机制（2025-10-19 更新）

### 价格来源
**统一价格源**: 从 `pallet-pricing::get_memo_market_price_weighted()` 获取价格

`pallet-pricing` 的价格逻辑：
1. **冷启动阶段**（交易量 < 1亿 MEMO）：返回 `DefaultPrice`（当前为 0.000001 USDT/MEMO）
2. **正常运行**：返回 OTC + Bridge 加权平均价格
3. **无交易数据**：返回 `DefaultPrice`

**注意**: `pallet-pricing` 在所有情况下都会返回有效价格（> 0），因此 SimpleBridge 不需要额外的备用汇率。

### 优势
- ✅ 自动跟踪市场价格，无需人工维护
- ✅ 消除套利空间（与 OTC 市场价格一致）
- ✅ 统一价格源（SimpleBridge 和 OTC 使用相同价格）
- ✅ 价格透明（事件中输出实际使用的汇率）
- ✅ 代码简化（移除冗余的 FallbackExchangeRate）

## 存储项

### SimpleBridge 存储项

#### NextId
- **类型**: `u64`
- **说明**: 下一个官方兑换ID计数器

#### Swaps
- **类型**: `StorageMap<u64, SwapRequest>`
- **说明**: 官方兑换请求映射（ID => 兑换详情）
- **字段**: `id`, `user`, `memo_amount`, `tron_address`, `completed`, `price_usdt`, `created_at`

#### BridgeAccount
- **类型**: `AccountId`
- **说明**: 桥接托管账户地址

#### MinAmount
- **类型**: `Balance`
- **说明**: 最小兑换金额（默认 100 MEMO）

### MaxPriceDeviation ⭐新增
- **类型**: `u32`
- **说明**: 最大价格偏离（单位：万分比，默认 2000 = 20%）
- **用途**: 预留用于 Phase 2 价格浮动检查（当前未启用）

### ~~FallbackExchangeRate~~ ❌已删除（2025-10-19）
- **删除原因**: pallet-pricing 永远不会返回 0，此存储项永远不会被使用
- **替代方案**: 直接使用 pallet-pricing 的 DefaultPrice

### OCW 做市商桥接存储项 🆕（2025-10-19）

#### OcwMakerSwaps
- **类型**: `StorageMap<u64, OcwMakerSwapRecord>`
- **说明**: OCW 做市商兑换订单映射
- **字段**: `id`, `maker_id`, `maker_tron_address`, `maker_memo_account`, `buyer`, `buyer_tron_address`, `memo_amount`, `usdt_amount`, `status`, `tron_tx_hash`, `created_at`, `timeout_at`
- **状态**: Pending, TronTxSubmitted, Completed, Timeout, UserReported, Arbitrating, ArbitrationApproved, ArbitrationRejected, Refunded

#### NextOcwMakerSwapId
- **类型**: `u64`
- **说明**: 下一个 OCW 订单 ID 计数器

#### PendingOcwVerification
- **类型**: `StorageMap<u64, ()>`
- **说明**: 待 OCW 验证的订单队列（做市商提交哈希后加入）

#### UsedTronTxHashes
- **类型**: `StorageMap<BoundedVec<u8, 128>, u64>`
- **说明**: 已使用的 TRON 交易哈希（防重放攻击）
- **键**: TRON 交易哈希
- **值**: 已绑定的订单 ID

#### OcwVerificationFailures
- **类型**: `StorageMap<u64, u32>`
- **说明**: OCW 验证失败计数器（超过阈值后移出队列）

#### TronApiEndpoint
- **类型**: `BoundedVec<u8, 256>`
- **说明**: TRON API 端点（默认: https://api.trongrid.io）
- **可配置**: 治理可修改

#### UsdtContractAddress
- **类型**: `BoundedVec<u8, 64>`
- **说明**: TRON USDT 合约地址（默认: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t）
- **可配置**: 治理可修改

## 可调用接口

### SimpleBridge 接口

### swap ⭐已升级

**权限**: 任何用户（签名交易）

**参数**:
- `memo_amount`: MEMO 数量（12位小数）
- `tron_address`: TRON 地址（Base58 格式，如 "TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"）

**功能**: 创建 MEMO → USDT 兑换请求（动态汇率）

**定价逻辑**（2025-10-19 更新）:
```rust
// 直接获取市场价格（pallet-pricing 保证返回 > 0）
let price_usdt = pallet_pricing::get_memo_market_price_weighted();

// 防御性检查（理论上永远不会失败）
ensure!(price_usdt > 0, Error::<T>::MarketPriceNotAvailable);
```

**流程**:
1. 验证 MEMO 数量 >= MinAmount
2. 验证 TRON 地址有效
3. ⭐ 从 `pallet-pricing` 获取市场加权均价（冷启动时自动返回 DefaultPrice）
4. 锁定用户的 MEMO 到桥接账户
5. 创建兑换请求记录（包含实际使用的 `price_usdt`）
6. 触发 `SwapCreated` 事件

**事件**: `SwapCreated { id, user, amount, tron_address, price_usdt }`
- ⭐ 新增 `price_usdt` 字段，记录实际使用的汇率

### complete_swap

**权限**: Root

**参数**:
- `swap_id`: 兑换ID

**功能**: 标记兑换完成

**说明**: 由桥接服务在确认 USDT 已发送到用户 TRON 地址后调用

**事件**: `SwapCompleted { id }`

### set_bridge_account

**权限**: Root

**参数**:
- `account`: 桥接账户地址

**功能**: 设置桥接托管账户

### set_min_amount

**权限**: Root

**参数**:
- `amount`: 最小金额

**功能**: 设置最小兑换金额

---

### OCW 做市商桥接接口 🆕（2025-10-19）

#### create_maker_swap

**权限**: 任何用户（签名交易）

**参数**:
- `maker_id`: 做市商 ID（u64）
- `memo_amount`: MEMO 数量（Balance，12位小数）
- `buyer_tron_address`: 买家 TRON 地址（BoundedVec<u8, 64>）

**功能**: 买家创建 OCW 做市商兑换订单（🆕 简化版：无需手动输入做市商账户和 TRON 地址）

**流程**:
1. 验证 MEMO 数量 >= OcwMinSwapAmount
2. 验证买家 TRON 地址格式
3. 🆕 **自动查询做市商信息**：从 `pallet-market-maker::BridgeServices` 查询做市商账户和 TRON 地址
4. 验证做市商桥接服务已启用
5. 从 `pallet-pricing` 获取市场价格并计算 USDT 金额
6. 🆕 验证兑换金额不超过做市商最大额度（max_swap_amount）
7. 锁定买家的 MEMO 到做市商托管账户
8. 创建 OCW 订单记录（状态: Pending）
9. 触发 `OcwMakerSwapCreated` 事件

**🆕 2025-10-19 优化**:
- ❌ **删除参数**: `maker_account`（做市商账户）、`maker_tron_address`（做市商 TRON 地址）
- ✅ **自动查询**: 系统自动从 `pallet-market-maker::BridgeServices` 查询做市商信息
- ✅ **用户体验**: 买家只需选择做市商 ID，无需手动输入敏感信息
- ✅ **安全性**: 防止买家输入错误的做市商信息

**示例（优化前 - 5个参数）**:
```javascript
// ❌ 旧版本：买家需要手动输入做市商账户和 TRON 地址
await api.tx.simpleBridge.createMakerSwap(
  1,                              // maker_id
  "5GrwvaEF...",                 // maker_account（手动输入）
  "TYASr5UV6...",                // maker_tron_address（手动输入）
  BigInt(100 * 1e12),            // memo_amount
  "TXYZabc123..."                // buyer_tron_address
).signAndSend(buyerAccount);
```

**示例（优化后 - 3个参数）**:
```javascript
// ✅ 新版本：系统自动查询做市商信息
await api.tx.simpleBridge.createMakerSwap(
  1,                              // maker_id（从列表选择）
  BigInt(100 * 1e12),            // memo_amount
  "TXYZabc123..."                // buyer_tron_address
).signAndSend(buyerAccount);

// 系统自动从 pallet-market-maker::BridgeServices 查询：
// - maker_account（做市商账户）
// - tron_address（做市商 TRON 地址）
// - max_swap_amount（最大兑换额度）
// - enabled（服务启用状态）
```

**事件**: `OcwMakerSwapCreated { swap_id, maker_id, user, memo_amount, usdt_amount, tron_address, timeout_at }`

## 事件

### SwapCreated ⭐已升级
- **参数**: `{ id, user, amount, tron_address, price_usdt }`
- **说明**: 新兑换请求创建
- ⭐ 新增 `price_usdt` 字段：记录实际使用的汇率（USDT/MEMO，精度 10^6）
- **监听**: 桥接服务监听此事件，触发 USDT 发送流程

**示例**:
```javascript
{
  id: 123,
  user: "5GrwvaEF...",
  amount: 1000000000000000, // 1000 MEMO (10^12)
  tron_address: "TYASr5UV6...",
  price_usdt: 520000 // 0.52 USDT/MEMO (10^6)
}
// 桥接服务应发送: 1000 * 0.52 = 520 USDT（扣除手续费）
```

### SwapCompleted
- **参数**: `{ id }`
- **说明**: 兑换完成

### BridgeAccountSet
- **参数**: `{ account }`
- **说明**: 桥接账户已更新

### MinAmountSet
- **参数**: `{ amount }`
- **说明**: 最小金额已更新

### MaxPriceDeviationSet ⭐新增
- **参数**: `{ deviation_bps }`
- **说明**: 最大价格偏离已更新

### OCW 做市商桥接事件 🆕

#### OcwMakerSwapCreated
- **参数**: `{ swap_id, maker_id, user, memo_amount, usdt_amount, tron_address, timeout_at }`
- **说明**: OCW 做市商兑换订单已创建
- **触发**: 买家调用 `create_maker_swap`

#### OcwTronTxHashSubmitted
- **参数**: `{ swap_id, maker_id, tron_tx_hash }`
- **说明**: 做市商已提交 TRON 交易哈希
- **触发**: 做市商调用 `submit_tron_tx_hash`

#### OcwMemoReleased
- **参数**: `{ swap_id, maker, memo_amount, tron_tx_hash }`
- **说明**: OCW 验证成功，MEMO 已释放给做市商
- **触发**: OCW 验证通过或治理调用 `release_memo`

#### OcwSwapRefunded
- **参数**: `{ swap_id, user, memo_amount }`
- **说明**: OCW 订单超时已退款
- **触发**: 买家调用 `refund_timeout_swap`

#### OcwUserReported
- **参数**: `{ swap_id, user, evidence }`
- **说明**: 用户举报做市商
- **触发**: 买家调用 `report_ocw_maker`

#### TronApiEndpointUpdated
- **参数**: `{ endpoint }`
- **说明**: TRON API 端点已更新

#### UsdtContractAddressUpdated
- **参数**: `{ address }`
- **说明**: USDT 合约地址已更新

## 错误码

### SimpleBridge 错误

- `AmountTooSmall`: 金额低于最小限制
- `SwapNotFound`: 兑换请求不存在
- `BridgeAccountNotSet`: 桥接账户未设置
- `AlreadyCompleted`: 兑换已完成
- `InvalidTronAddress`: TRON 地址格式无效
- ⭐ `MarketPriceNotAvailable`: 市场价格不可用（理论上不会发生，pallet-pricing 永远返回 > 0）
- ⭐ `PriceDeviationTooHigh`: 价格偏离超出允许范围（预留用于 Phase 2）
- ⭐ `InvalidDeviationRange`: 价格偏离参数无效（必须在 5%-50% 范围内）

### OCW 做市商桥接错误 🆕

- `OcwMakerSwapNotFound`: OCW 做市商兑换订单不存在
- `OcwMakerSwapInvalidStatus`: OCW 做市商兑换状态无效
- `MakerNotActiveOrNotFound`: 做市商不存在或未启用
- `TronTxHashAlreadyUsed`: TRON 交易哈希已被使用（防重放攻击）
- `InvalidTronTxHash`: TRON 交易哈希格式无效
- `OcwSwapNotTimeout`: OCW 订单尚未超时，无法退款
- `NotOcwSwapUser`: 不是订单的买家，无法操作
- `OcwSwapNotReported`: OCW 订单未被举报，无法仲裁
- `InvalidTronApiEndpoint`: TRON API 端点格式无效
- `InvalidUsdtContractAddress`: USDT 合约地址格式无效

## 使用流程

### SimpleBridge 使用流程（官方桥接）

### 1. 初始化（链上配置）⭐已升级

```javascript
// 设置桥接账户
await api.tx.sudo.sudo(
    api.tx.simpleBridge.setBridgeAccount(bridgeAccountAddress)
).signAndSend(sudoAccount);

// 设置最小金额（可选，默认 100 MEMO）
await api.tx.sudo.sudo(
    api.tx.simpleBridge.setMinAmount(BigInt(100 * 1e12))
).signAndSend(sudoAccount);

// ⭐ 设置最大价格偏离（可选，默认 2000 = 20%）
await api.tx.sudo.sudo(
    api.tx.simpleBridge.setMaxPriceDeviation(2000)
).signAndSend(sudoAccount);

// ⭐ 查询当前市场价格（用于监控）
const marketPrice = await api.query.pricing.getMemoMarketPriceWeighted();
console.log(`当前市场价格: ${marketPrice / 1e6} USDT/MEMO`);
```

### 2. 用户发起兑换（前端）⭐已升级

```javascript
// ⭐ 步骤1：查询当前市场价格（显示给用户）
const marketPrice = await api.query.pricing.getMemoMarketPriceWeighted();
const priceUsdt = marketPrice.toNumber() / 1e6; // 转换为 USDT

console.log(`当前市场价格: ${priceUsdt} USDT/MEMO`);
console.log(`您兑换 500 MEMO 预计到账: ${500 * priceUsdt * 0.997} USDT`);

// 用户输入
const memoAmount = 500; // 500 MEMO
const tronAddress = "TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS";

// 调用链上接口
const tx = api.tx.simpleBridge.swap(
    BigInt(memoAmount * 1e12), // MEMO 12位小数
    tronAddress
);

await tx.signAndSend(userAccount, ({ status, events }) => {
    if (status.isInBlock) {
        // 从事件中提取 swap_id 和实际汇率
        events.forEach(({ event }) => {
            if (event.section === 'simpleBridge' && event.method === 'SwapCreated') {
                const { id, user, amount, tron_address, price_usdt } = event.data; // ⭐ 新增 price_usdt
                const actualPrice = price_usdt.toNumber() / 1e6;
                const expectedUsdt = memoAmount * actualPrice * 0.997; // 扣除 0.3% 手续费
                
                console.log(`兑换 ID: ${id.toNumber()}`);
                console.log(`实际汇率: ${actualPrice} USDT/MEMO`); // ⭐ 显示实际使用的汇率
                console.log(`预计到账: ${expectedUsdt} USDT`);
            }
        });
    }
});
```

### 3. 桥接服务处理（后端）⭐已升级

```javascript
// 监听 SwapCreated 事件
api.query.system.events((events) => {
    events.forEach(({ event }) => {
        if (event.section === 'simpleBridge' && event.method === 'SwapCreated') {
            const { id, user, amount, tronAddress, price_usdt } = event.data; // ⭐ 新增 price_usdt
            
            // ⭐ 1. 使用事件中的实际汇率计算 USDT 金额（而非固定 0.5）
            const memoAmount = parseFloat(amount.toString()) / 1e12;
            const actualPrice = price_usdt.toNumber() / 1e6; // 转换为 USDT/MEMO
            const usdtAmount = memoAmount * actualPrice; // 使用动态汇率
            const fee = usdtAmount * 0.003; // 0.3% 手续费
            const netUsdt = usdtAmount - fee;
            
            console.log(`兑换 ${id}: ${memoAmount} MEMO @ ${actualPrice} USDT/MEMO = ${netUsdt} USDT（净额）`);
            
            // 2. 发送 USDT 到用户 TRON 地址
            const tronTx = await sendUSDT(
                Buffer.from(tronAddress).toString('utf-8'),
                netUsdt
            );
            
            // 3. 标记完成
            await api.tx.sudo.sudo(
                api.tx.simpleBridge.completeSwap(id.toNumber())
            ).signAndSend(sudoAccount);
        }
    });
});
```

**⭐ 关键变化**：
1. 从事件中提取 `price_usdt` 字段（实际使用的汇率）
2. 不再使用固定的 0.5 USDT/MEMO 汇率
3. 根据 `price_usdt` 计算实际应发送的 USDT 金额

## 配置示例

### runtime/src/lib.rs

```rust
impl pallet_simple_bridge::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
}

// 添加到 construct_runtime!
SimpleBridge: pallet_simple_bridge,
```

### node/src/chain_spec.rs ⭐已升级

```rust
simple_bridge: SimpleBridgeConfig {
    bridge_account: Some(get_account_id_from_seed::<sr25519::Public>("Bridge")),
    min_amount: 100 * UNITS, // 100 MEMO
    // ❌ fallback_exchange_rate 已删除（2025-10-19）- 不再需要
    // ❌ max_price_deviation 已删除（2025-10-20）- 由 pallet-pricing 统一管理
},
```

## 安全考虑

1. **桥接账户安全**: 
   - 桥接账户仅持有用户锁定的 MEMO
   - 不应存放额外资金
   - 定期审计余额

2. **Root 权限**: 
   - 只有 Root 可调用 `complete_swap`
   - Root 密钥应由桥接服务安全保管
   - 考虑使用 Multisig 账户作为 Root

3. **最小金额限制**:
   - 防止过小金额导致手续费倒挂
   - 默认 100 MEMO，可根据实际情况调整

4. **TRON 地址验证**:
   - 链上只做基本长度检查
   - 桥接服务应做完整 Base58 格式验证

5. ⭐ **价格安全（2025-10-19 更新）**:
   - 统一依赖 `pallet-pricing` 的价格源（与 OTC 保持一致）
   - pallet-pricing 自动处理冷启动（返回 DefaultPrice）
   - 价格偏离检查（预留用于 Phase 2）
   - 桥接服务应监控价格异常波动（建议设置告警）

## 监控建议

1. **兑换量监控**: 统计每日兑换笔数和 MEMO 总量
2. **完成率监控**: 监控 `SwapCreated` vs `SwapCompleted` 比例
3. **桥接账户余额**: 定期检查桥接账户 MEMO 余额是否匹配未完成订单
4. **异常检测**: 监控单笔大额兑换（> 10000 MEMO）
5. ⭐ **价格监控（2025-10-19 更新）**:
   - 监控市场均价波动（建议设置 ±10% 告警阈值）
   - 监控冷启动状态（是否使用 DefaultPrice）
   - 监控 pallet-pricing 的价格返回值
   - 对比实际汇率与历史均价（识别异常兑换）

## 升级路径

### Phase 1: 动态定价（已完成 ✅ 并简化）
- [x] ⭐ 集成 `pallet-pricing` 市场均价
- [x] ⭐ 统一价格源（删除冗余的 FallbackExchangeRate）
- [x] ⭐ 事件中输出实际汇率（`price_usdt`）
- [x] ⭐ 价格偏离检查（由 `pallet-pricing` 统一管理）

### Phase 2: 增强功能（规划中）
- [ ] 启用 ±20% 价格浮动检查（可选，当前直接使用市场均价）
- [ ] 添加 USDT → MEMO 反向兑换
- [ ] 用户取消功能（超时自动退款）
- [ ] 详细历史记录查询
- [ ] 前端价格 Dashboard

### Phase 3: 去中心化（长期）
- [ ] 多签桥接账户
- [ ] 验证人网络
- [ ] TRON 轻客户端验证

---

## 🆕 做市商模式（2025-10-19）

Simple Bridge 现在支持**做市商模式**，允许多个做市商提供 MEMO → USDT 兑换服务，实现去中心化的桥接网络。

### 功能概述

**核心价值**：
- ✅ 去中心化：多做市商竞争，无单点故障
- ✅ 市场化定价：费率竞争（0.05%-5%）
- ✅ 押金保障：用户资金安全有保障
- ✅ 24/7 自动化：做市商自动监听和处理
- ✅ 透明仲裁：委员会介入争议处理

### 数据结构

#### SwapStatus（兑换状态）
```rust
pub enum SwapStatus {
    Pending,              // 待处理（30分钟内做市商需转账）
    Completed,            // 已完成
    UserReported,         // 用户举报
    Arbitrating,          // 仲裁中
    ArbitrationApproved,  // 仲裁通过（做市商履约）
    ArbitrationRejected,  // 仲裁拒绝（做市商违约）
    Refunded,             // 超时退款
}
```

#### MakerSwapRecord（做市商兑换记录）
```rust
pub struct MakerSwapRecord<T: Config> {
    pub swap_id: u64,
    pub maker_id: u64,
    pub maker: T::AccountId,
    pub user: T::AccountId,
    pub memo_amount: BalanceOf<T>,
    pub usdt_amount: u64,
    pub usdt_address: BoundedVec<u8, ConstU32<64>>,
    pub created_at: BlockNumberFor<T>,
    pub timeout_at: BlockNumberFor<T>,
    pub trc20_tx_hash: Option<BoundedVec<u8, ConstU32<128>>>,
    pub completed_at: Option<BlockNumberFor<T>>,
    pub evidence_cid: Option<BoundedVec<u8, ConstU32<256>>>,
    pub status: SwapStatus,
    pub price_usdt: u64,
}
```

### 存储项

#### MakerSwaps
`StorageMap<u64, MakerSwapRecord>`

存储做市商兑换记录：
- Key: 兑换 ID
- Value: 兑换记录详情

#### NextMakerSwapId
`StorageValue<u64>`

下一个做市商兑换 ID

### 可调用方法

#### swap_with_maker（用户通过做市商兑换）
```rust
pub fn swap_with_maker(
    origin: OriginFor<T>,
    maker_id: u64,
    memo_amount: BalanceOf<T>,
    usdt_address: Vec<u8>,
) -> DispatchResult
```

**功能**：用户选择做市商进行 MEMO → USDT 兑换

**流程**：
1. 验证做市商服务状态
2. 获取市场价格（基于 pallet-pricing）
3. 计算 USDT 金额（扣除做市商手续费）
4. 验证金额范围（不超过做市商最大兑换额）
5. 质押 MEMO 到做市商托管账户
6. 创建兑换记录
7. 发出 `MakerSwapInitiated` 事件

**示例**：
```javascript
// 用户选择做市商 ID = 1 进行兑换
await api.tx.simpleBridge.swapWithMaker(
  1,                            // maker_id
  100n * 1_000_000_000_000n,   // 100 MEMO
  'TRC20_ADDRESS_HERE'          // USDT 接收地址
).signAndSend(userAccount);
```

**手续费计算**：
```
基础 USDT = MEMO 数量 × 市场价格
手续费 = 基础 USDT × 做市商费率 / 10000
实际 USDT = 基础 USDT - 手续费

示例：
- 兑换 100 MEMO
- 市场价格 0.5 USDT/MEMO
- 做市商费率 0.1%（10 bps）
- 基础 USDT = 100 × 0.5 = 50 USDT
- 手续费 = 50 × 0.1% = 0.05 USDT
- 实际 USDT = 50 - 0.05 = 49.95 USDT
```

---

#### complete_swap_by_maker（做市商完成兑换）
```rust
pub fn complete_swap_by_maker(
    origin: OriginFor<T>,
    swap_id: u64,
    trc20_tx_hash: Vec<u8>,
) -> DispatchResult
```

**功能**：做市商在链下转账 USDT 后，调用此方法完成链上流程

**流程**：
1. 验证做市商身份
2. 验证状态（Pending）和超时（未超时）
3. 记录 TRC20 交易哈希
4. 将 MEMO 从托管账户转给做市商
5. 更新统计数据（pallet-market-maker）
6. 上报价格数据（pallet-pricing）
7. 发出 `MakerSwapCompleted` 事件

**示例**：
```javascript
// 做市商完成兑换
await api.tx.simpleBridge.completeSwapByMaker(
  swapId,
  '0x1234567890abcdef...'  // TRC20 交易哈希
).signAndSend(makerAccount);
```

---

#### confirm_receipt（用户确认收款）
```rust
pub fn confirm_receipt(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

**功能**：用户确认收到 USDT

**说明**：
- 用户确认后可加速流程
- 如不确认，24 小时后自动视为完成
- 非必须操作

**示例**：
```javascript
// 用户确认收到 USDT
await api.tx.simpleBridge.confirmReceipt(
  swapId
).signAndSend(userAccount);
```

---

#### report_maker（用户举报做市商）
```rust
pub fn report_maker(
    origin: OriginFor<T>,
    swap_id: u64,
    evidence_cid: Vec<u8>,
) -> DispatchResult
```

**功能**：用户举报做市商未转账

**流程**：
1. 验证用户身份
2. 检查是否超时（必须超过 30 分钟）
3. 记录证据 CID（IPFS）
4. 更新状态为 UserReported
5. 发出 `MakerReported` 事件
6. 等待委员会仲裁

**示例**：
```javascript
// 超时后用户举报做市商
await api.tx.simpleBridge.reportMaker(
  swapId,
  'QmXxx...'  // 证据 CID（IPFS）
).signAndSend(userAccount);
```

---

#### arbitrate_swap（委员会仲裁）
```rust
pub fn arbitrate_swap(
    origin: OriginFor<T>,
    swap_id: u64,
    approve: bool,
) -> DispatchResult
```

**功能**：委员会仲裁举报的兑换

**流程**：
- **Approve（做市商履约）**：
  1. 释放 MEMO 给做市商
  2. 更新统计数据（成功）
  3. 发出事件

- **Reject（做市商违约）**：
  1. 退还 MEMO 给用户
  2. 从做市商押金扣除 20% 补偿给用户
  3. 更新统计数据（失败）
  4. 发出事件

**示例**：
```javascript
// 委员会仲裁（通过治理）
await api.tx.sudo.sudo(
  api.tx.simpleBridge.arbitrateSwap(
    swapId,
    false  // reject = 做市商违约
  )
).signAndSend(sudoAccount);
```

### 事件

#### MakerSwapInitiated
```rust
MakerSwapInitiated {
    swap_id: u64,
    maker_id: u64,
    maker: T::AccountId,
    user: T::AccountId,
    memo_amount: BalanceOf<T>,
    usdt_amount: u64,
    usdt_address: BoundedVec<u8, ConstU32<64>>,
    timeout_at: BlockNumberFor<T>,
}
```

#### MakerSwapCompleted
```rust
MakerSwapCompleted {
    swap_id: u64,
    maker_id: u64,
    trc20_tx_hash: BoundedVec<u8, ConstU32<128>>,
}
```

#### MakerSwapConfirmed
```rust
MakerSwapConfirmed {
    swap_id: u64,
    user: T::AccountId,
}
```

#### MakerReported
```rust
MakerReported {
    swap_id: u64,
    maker_id: u64,
    user: T::AccountId,
    evidence_cid: BoundedVec<u8, ConstU32<256>>,
}
```

#### MakerSwapArbitrated
```rust
MakerSwapArbitrated {
    swap_id: u64,
    approved: bool,
    penalty: Option<BalanceOf<T>>,
}
```

### 错误类型

```rust
MakerSwapNotFound,            // 兑换记录不存在
MakerSwapInvalidStatus,       // 兑换状态无效
MakerBridgeServiceNotFound,   // 做市商服务不存在
MakerBridgeServiceDisabled,   // 做市商服务未启用
ExceedsMaxSwapAmount,         // 超过最大兑换额
NotSwapUser,                  // 不是兑换的用户
NotSwapMaker,                 // 不是兑换的做市商
SwapNotTimeout,               // 兑换尚未超时
SwapNotReported,              // 兑换未被举报
InvalidTrc20TxHash,           // TRC20 交易哈希无效
```

### 前端查询

#### 查询做市商兑换记录
```javascript
// 查询特定兑换记录
const swap = await api.query.simpleBridge.makerSwaps(swapId);

if (swap.isSome) {
  const record = swap.unwrap();
  console.log('兑换ID:', record.swap_id.toNumber());
  console.log('做市商ID:', record.maker_id.toNumber());
  console.log('用户:', record.user.toHuman());
  console.log('MEMO数量:', record.memo_amount.toNumber() / 1e12);
  console.log('USDT金额:', record.usdt_amount.toNumber() / 1_000_000);
  console.log('状态:', record.status.toHuman());
  console.log('超时时间:', record.timeout_at.toNumber());
  
  if (record.trc20_tx_hash.isSome) {
    console.log('TRC20交易:', record.trc20_tx_hash.unwrap().toHuman());
  }
}
```

#### 查询用户的兑换历史
```javascript
// 获取所有兑换记录（需要遍历）
const allSwaps = await api.query.simpleBridge.makerSwaps.entries();

// 过滤特定用户的兑换
const userSwaps = allSwaps
  .map(([key, record]) => ({
    swapId: key.args[0].toNumber(),
    ...record.toJSON()
  }))
  .filter(swap => swap.user === userAddress);

console.log('用户兑换历史:', userSwaps);
```

### 使用流程

#### 完整流程图

```
用户                做市商              链上合约              委员会
  |                   |                    |                    |
  |--swap_with_maker->|                    |                    |
  |                   |                    |                    |
  |                   |<-MakerSwapInitiated|                    |
  |                   |                    |                    |
  |                   |--监听事件-->       |                    |
  |                   |--链下转USDT-->用户 |                    |
  |                   |                    |                    |
  |                   |--complete_swap_by_maker->               |
  |                   |                    |                    |
  |<-收到USDT---------|                    |                    |
  |                   |                    |                    |
  |--confirm_receipt->|                    |                    |
  |（可选）           |                    |                    |
  |                   |                    |                    |
  
超时情况：
  |                   |                    |                    |
  |--等待30分钟------>|                    |                    |
  |                   |（未转账）          |                    |
  |                   |                    |                    |
  |--report_maker---->|                    |                    |
  |                   |                    |                    |
  |                   |                    |<--arbitrate_swap---|
  |                   |                    |（委员会仲裁）      |
  |                   |                    |                    |
  |<-退款+补偿--------|                    |                    |
```

#### 1. 用户选择做市商

```javascript
// 1. 查询所有提供桥接服务的做市商
const bridgeMakers = [];
const allMakers = await api.query.marketMaker.activeMarketMakers.entries();

for (const [key, maker] of allMakers) {
  const mmId = key.args[0].toNumber();
  const service = await api.query.marketMaker.bridgeServices(mmId);
  
  if (service.isSome && service.unwrap().enabled.toHuman()) {
    const config = service.unwrap();
    bridgeMakers.push({
      mmId,
      name: maker.public_cid.toHuman(),  // 做市商名称
      feeRate: config.fee_rate_bps.toNumber() / 100,
      maxAmount: config.max_swap_amount.toNumber() / 1_000_000,
      avgTime: config.avg_time_seconds.toNumber(),
      successRate: (config.success_count.toNumber() / config.total_swaps.toNumber() * 100).toFixed(2),
    });
  }
}

// 2. 用户选择做市商（例如选择费率最低的）
const selectedMaker = bridgeMakers.sort((a, b) => a.feeRate - b.feeRate)[0];
console.log('选择做市商:', selected Maker);

// 3. 发起兑换
await api.tx.simpleBridge.swapWithMaker(
  selectedMaker.mmId,
  100n * 1_000_000_000_000n,  // 100 MEMO
  'TRC20_ADDRESS'
).signAndSend(userAccount);
```

#### 2. 做市商处理兑换（simple-bridge-service）

```javascript
// simple-bridge-service 自动监听和处理
// 参考：simple-bridge-service README

// 伪代码示例：
async function handleSwapEvent(event) {
  const { swap_id, user, memo_amount, usdt_amount, usdt_address } = event.data;
  
  // 1. 链下转账 USDT（TRC20）
  const txHash = await transferUSDT(usdt_address, usdt_amount);
  
  // 2. 链上完成
  await api.tx.simpleBridge.completeSwapByMaker(
    swap_id,
    txHash
  ).signAndSend(makerAccount);
}
```

#### 3. 用户确认或举报

```javascript
// 正常情况：用户确认收款
await api.tx.simpleBridge.confirmReceipt(swapId).signAndSend(userAccount);

// 异常情况：用户举报（超时后）
await api.tx.simpleBridge.reportMaker(
  swapId,
  evidenceCid  // 上传到 IPFS 的证据
).signAndSend(userAccount);
```

### 安全机制

#### 1. 押金保障
- 做市商需要质押押金：`最大兑换额 × 100`
- 例如：最大 1,000 USDT → 押金 100,000 MEMO
- 违约罚没：用户获得原金额 + 20% 补偿

#### 2. 超时保护
- 30 分钟未转账 → 用户可举报
- 24 小时未确认 → 自动视为完成

#### 3. 仲裁机制
- 委员会投票（2/3 多数）
- 链上透明记录
- 证据可查（IPFS）

#### 4. 托管账户隔离
- 每个做市商独立托管账户
- 资金隔离，便于审计

### 监控指标

#### Dashboard 示例
```javascript
// 做市商桥接服务监控
async function monitorMakerBridge(makerId) {
  const service = await api.query.marketMaker.bridgeServices(makerId);
  const swaps = await api.query.simpleBridge.makerSwaps.entries();
  
  // 过滤该做市商的兑换
  const makerSwaps = swaps
    .map(([key, record]) => record.toJSON())
    .filter(swap => swap.maker_id === makerId);
  
  // 统计
  const pending = makerSwaps.filter(s => s.status === 'Pending').length;
  const completed = makerSwaps.filter(s => s.status === 'Completed').length;
  const reported = makerSwaps.filter(s => s.status === 'UserReported').length;
  
  return {
    enabled: service.unwrap().enabled.toHuman(),
    totalSwaps: service.unwrap().total_swaps.toNumber(),
    successRate: (service.unwrap().success_count.toNumber() / service.unwrap().total_swaps.toNumber()),
    avgTime: service.unwrap().avg_time_seconds.toNumber(),
    pending,
    completed,
    reported,
  };
}
```

### 相关文档

- [pallet-market-maker README](../market-maker/README.md)
- [做市商参与SimpleBridge兑换方案分析](../../docs/做市商参与SimpleBridge兑换方案分析.md)
- [做市商SimpleBridge-Phase1完成报告](../../docs/做市商SimpleBridge-Phase1完成报告.md)

---

## 版本变更

### v3.0.0 (2025-10-19) - 做市商模式 🚀 NEW

**破坏性变更**：
- 新增 `pallet_market_maker::Config` 依赖
- 新增做市商专用托管账户体系

**新增功能**：
- 做市商模式：多做市商提供兑换服务
- 新增存储项：`MakerSwaps`, `NextMakerSwapId`
- 新增结构体：`SwapStatus`, `MakerSwapRecord`
- 新增可调用方法：
  - `swap_with_maker()`：用户通过做市商兑换
  - `complete_swap_by_maker()`：做市商完成兑换
  - `confirm_receipt()`：用户确认收款
  - `report_maker()`：用户举报做市商
  - `arbitrate_swap()`：委员会仲裁
- 新增事件：`MakerSwapInitiated`, `MakerSwapCompleted`, `MakerSwapConfirmed`, `MakerReported`, `MakerSwapArbitrated`
- 新增错误类型：`MakerSwapNotFound`, `MakerBridgeServiceNotFound`, `ExceedsMaxSwapAmount`, 等

**安全机制**：
- 押金保障（最大兑换额 × 100）
- 超时保护（30 分钟转账超时）
- 仲裁机制（委员会投票）
- 托管账户隔离

**迁移指南**：
1. 添加 `pallet_market_maker::Config` 依赖
2. 更新 `Config` trait（新增 `SwapTimeout`, `GovernanceOrigin`, `PalletId`）
3. 做市商部署 `simple-bridge-service`
4. 前端适配做市商列表和兑换流程

---

### v2.1.0 (2025-10-19) - 简化价格逻辑 ⭐

**破坏性变更**：
- ❌ 删除 `FallbackExchangeRate` 存储项（永远不会被使用）
- 简化定价逻辑：直接使用 pallet-pricing 返回值
- `GenesisConfig` 删除 `fallback_exchange_rate` 字段

**改进**：
- 代码简化：删除约 50 行冗余代码
- 统一价格源：SimpleBridge 和 OTC 使用相同价格
- 防御性编程：保留 `price_usdt > 0` 检查

### v2.0.0 (2025-10-19) - 动态定价升级 ⭐

**破坏性变更**：
- 移除固定汇率 `ExchangeRate`，添加 `FallbackExchangeRate`（后在 v2.1.0 删除）
- `SwapCreated` 事件新增 `price_usdt` 字段
- `max_price_deviation` 移至 `pallet-pricing` 统一管理（v2.2.0+）

**新增功能**：
- 动态汇率：基于 `pallet-pricing` 的市场加权均价
- 冷启动保护机制（后来发现不需要，在 v2.1.0 删除）
- 价格偏离检查由 `pallet-pricing` 统一管理（v2.2.0+）
- 新增错误类型：`MarketPriceNotAvailable`, `PriceDeviationTooHigh`

**优化**：
- 事件中输出实际使用的汇率，提高透明度
- 桥接服务可根据 `price_usdt` 准确计算应发送的 USDT 金额

**迁移指南**：
1. 更新 `GenesisConfig` 配置（添加新字段）
2. 更新桥接服务代码（处理 `price_usdt` 字段）
3. 更新前端代码（显示实时市场价格）

---

## 相关文档

- [定价基准价格±20%方案分析](../../docs/定价基准价格±20%方案分析.md) ⭐新增
- [pallet-pricing README](../pricing/README.md)
- [托管式桥接最优MVP方案](../../docs/托管式桥接最优MVP方案.md)
- [MEMO-USDT-TRC20跨链桥接设计方案](../../docs/MEMO-USDT-TRC20跨链桥接设计方案.md)

