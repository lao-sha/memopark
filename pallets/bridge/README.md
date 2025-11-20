# Pallet Bridge - DUST ↔ USDT 桥接模块

## 模块概述

`pallet-bridge` 是 Stardust 区块链的核心桥接模块，提供 DUST 代币与 USDT (TRC20) 之间的双向兑换服务。本模块支持两种桥接模式：

1. **官方桥接（Official Bridge）**: 由治理账户管理的中心化桥接服务
2. **做市商桥接（Maker Bridge）**: 由市场化做市商提供的去中心化兑换服务

### 版本历史

- **v0.1.0** (2025-11-03): 从 `pallet-trading` 拆分而来，独立为桥接模块

### 核心特性

- **双模式桥接**: 官方桥接与做市商桥接并存，满足不同用户需求
- **TRON 集成**: 支持 TRON 链上的 TRC20-USDT 转账
- **托管安全**: 基于 `pallet-escrow` 的资金托管机制
- **OCW 自动化**: Off-Chain Worker 自动检测超时订单并退款
- **仲裁支持**: 集成 `pallet-arbitration` 处理争议订单
- **信用记录**: 自动记录做市商的信用分数（通过 `pallet-credit`）
- **防重放攻击**: 通过 TRON 交易哈希去重防止重复使用

---

## 核心功能

### 1. 官方桥接（Official Bridge）

官方桥接是由治理账户管理的中心化桥接服务，适合需要官方信用背书的用户。

#### 工作流程

```
用户 → 锁定 DUST → 创建兑换请求 → 治理账户处理 → 转账 USDT → 销毁 DUST
```

#### 关键步骤

1. **创建兑换** (`swap`):
   - 用户调用 `swap()` 并提供 DUST 数量和 TRON 接收地址
   - 系统验证最小兑换金额（`MinSwapAmount`）
   - 系统验证 TRON 地址格式（34 字节）
   - 锁定用户的 DUST 到托管账户（通过 `pallet-escrow`）
   - 获取当前 DUST/USD 汇率（通过 `PricingProvider`）
   - 创建 `SwapRequest` 记录并设置超时时间

2. **完成兑换** (`complete_swap`):
   - 治理账户在链外完成 USDT 转账后调用 `complete_swap()`
   - 系统释放托管的 DUST 到桥接账户（模拟销毁）
   - 标记兑换为已完成
   - 发出 `SwapCompleted` 事件

#### 超时机制

- 默认超时时间: `SwapTimeout` 区块数
- 超时后用户可请求治理账户退款
- 未来版本将支持自动退款

### 2. 做市商桥接（Maker Bridge）

做市商桥接是由市场化做市商提供的去中心化兑换服务，提供更快速、灵活的兑换体验。

#### 工作流程

```
用户 → 选择做市商 → 锁定 DUST → 做市商转账 USDT → 做市商提交证明 → 释放 DUST
```

#### 关键步骤

1. **创建做市商兑换** (`maker_swap`):
   - 用户调用 `maker_swap()` 并指定做市商 ID、DUST 数量、USDT 接收地址
   - 系统验证做市商存在且激活（通过 `MakerInterface`）
   - 系统验证最小兑换金额
   - 锁定用户的 DUST 到托管账户
   - 获取实时汇率并计算 USDT 金额
   - 创建 `MakerSwapRecord` 记录并设置超时时间
   - 状态设为 `Pending`

2. **做市商完成兑换** (`mark_swap_complete`):
   - 做市商在链外完成 USDT 转账后调用 `mark_swap_complete()`
   - 提交 TRC20 交易哈希作为证明
   - 系统验证交易哈希未被使用（防重放攻击）
   - 释放 DUST 到做市商账户
   - 更新状态为 `Completed`
   - 记录信用分（成功订单，通过 `CreditInterface`）
   - 发出 `MakerSwapCompleted` 事件

3. **用户举报** (`report_swap`):
   - 用户发现问题可调用 `report_swap()` 举报
   - 仅限兑换的用户本人举报
   - 仅支持 `Pending` 或 `Completed` 状态的订单
   - 更新状态为 `UserReported`
   - 发出 `SwapReported` 事件
   - 进入仲裁流程（通过 `pallet-arbitration`）

#### 超时自动退款（OCW）

- Off-Chain Worker 每个区块检测超时订单
- 检测范围: 最近 100 个做市商兑换
- 超时条件: `current_block >= timeout_at` 且状态为 `Pending`
- 自动操作:
  - 退款 DUST 到用户账户
  - 更新状态为 `Refunded`
  - 记录做市商超时（降低信用分）

### 3. 费率与定价

#### 官方桥接费率

- 当前版本未实现手续费（未来版本支持）
- 汇率从 `PricingProvider` 实时获取
- 精度: 10^6（例如 0.5 USD = 500000）

#### 做市商定价

- 做市商可设置自定义溢价（在 `pallet-maker` 中配置）
- 系统获取实时市场汇率作为基准
- USDT 金额计算公式:
  ```
  usdt_amount = (dust_amount * price_usdt) / 10^12
  ```

### 4. OCW（Off-Chain Worker）机制

#### OCW 职责

本模块的 OCW 主要负责自动检测和处理超时订单：

1. **监听超时**: 每个区块扫描最近 100 个做市商兑换
2. **自动退款**: 超时订单自动退款给用户
3. **信用记录**: 记录做市商超时事件到信用系统

#### OCW 实现细节

```rust
fn offchain_worker(block_number: BlockNumberFor<T>) {
    // 1. 扫描最近 100 个做市商兑换
    // 2. 检查状态为 Pending 且已超时的订单
    // 3. 调用 Escrow::refund_all() 退款
    // 4. 调用 Credit::record_maker_order_timeout() 记录超时
    // 5. 更新状态为 Refunded
}
```

#### 配置参数

- `OcwSwapTimeoutBlocks`: 做市商兑换超时区块数（例如 600 区块 = 1 小时）
- 扫描窗口: 最近 100 个兑换（避免遍历所有历史记录）

---

## 数据结构

### 兑换状态枚举（SwapStatus）

```rust
pub enum SwapStatus {
    /// 待处理（做市商尚未完成转账）
    Pending,
    /// 已完成（做市商已完成转账）
    Completed,
    /// 用户举报（用户发起争议）
    UserReported,
    /// 仲裁中（正在仲裁处理）
    Arbitrating,
    /// 仲裁通过（做市商胜诉）
    ArbitrationApproved,
    /// 仲裁拒绝（用户胜诉）
    ArbitrationRejected,
    /// 超时退款（OCW 自动退款）
    Refunded,
}
```

### 官方桥接兑换请求（SwapRequest）

```rust
pub struct SwapRequest<T: Config> {
    /// 兑换 ID
    pub id: u64,
    /// 用户账户
    pub user: T::AccountId,
    /// DUST 数量
    pub dust_amount: BalanceOf<T>,
    /// TRON 接收地址（34 字节）
    pub tron_address: TronAddress,
    /// 是否已完成
    pub completed: bool,
    /// 兑换时的 USDT 单价（精度 10^6）
    pub price_usdt: u64,
    /// 创建时间戳（区块号）
    pub created_at: BlockNumberFor<T>,
    /// 超时时间（区块号）
    pub expire_at: BlockNumberFor<T>,
}
```

### 做市商兑换记录（MakerSwapRecord）

```rust
pub struct MakerSwapRecord<T: Config> {
    /// 兑换 ID
    pub swap_id: u64,
    /// 做市商 ID
    pub maker_id: u64,
    /// 做市商账户
    pub maker: T::AccountId,
    /// 用户账户
    pub user: T::AccountId,
    /// DUST 数量
    pub dust_amount: BalanceOf<T>,
    /// USDT 金额（精度 10^6，例如 100 USDT = 100000000）
    pub usdt_amount: u64,
    /// USDT 接收地址（TRC20）
    pub usdt_address: TronAddress,
    /// 创建时间（区块号）
    pub created_at: BlockNumberFor<T>,
    /// 超时时间（区块号）
    pub timeout_at: BlockNumberFor<T>,
    /// TRC20 交易哈希（做市商提交的证明）
    pub trc20_tx_hash: Option<BoundedVec<u8, ConstU32<128>>>,
    /// 完成时间（区块号）
    pub completed_at: Option<BlockNumberFor<T>>,
    /// 证据 CID（IPFS 内容 ID，预留字段）
    pub evidence_cid: Option<BoundedVec<u8, ConstU32<256>>>,
    /// 兑换状态
    pub status: SwapStatus,
    /// 兑换价格（精度 10^6）
    pub price_usdt: u64,
}
```

---

## 存储项

### 1. NextSwapId

- **类型**: `StorageValue<u64>`
- **说明**: 下一个可用的兑换 ID（自增计数器）
- **默认值**: 0

### 2. BridgeAccount

- **类型**: `StorageValue<T::AccountId>`
- **说明**: 官方桥接账户（用于接收官方兑换的 DUST）
- **用途**: 治理账户设置，作为官方桥接的资金池

### 3. SwapRequests

- **类型**: `StorageMap<u64, SwapRequest<T>>`
- **键**: 兑换 ID
- **值**: 官方桥接兑换请求
- **说明**: 存储所有官方桥接的兑换记录

### 4. MakerSwaps

- **类型**: `StorageMap<u64, MakerSwapRecord<T>>`
- **键**: 兑换 ID
- **值**: 做市商兑换记录
- **说明**: 存储所有做市商桥接的兑换记录

### 5. UserSwaps

- **类型**: `StorageMap<T::AccountId, BoundedVec<u64, ConstU32<100>>>`
- **键**: 用户账户
- **值**: 兑换 ID 列表（最多 100 个）
- **说明**: 用户的兑换历史索引

### 6. MakerSwapList

- **类型**: `StorageMap<u64, BoundedVec<u64, ConstU32<1000>>>`
- **键**: 做市商 ID
- **值**: 兑换 ID 列表（最多 1000 个）
- **说明**: 做市商的兑换历史索引

### 7. UsedTronTxHashes

- **类型**: `StorageMap<BoundedVec<u8, ConstU32<128>>, ()>`
- **键**: TRON 交易哈希（最多 128 字节）
- **值**: 空值（仅用于标记存在）
- **说明**: 已使用的 TRON 交易哈希，防止重放攻击

---

## 主要调用方法（Extrinsics）

### 1. `swap` - 创建官方桥接兑换

**函数签名**:
```rust
pub fn swap(
    origin: OriginFor<T>,
    dust_amount: BalanceOf<T>,
    tron_address: Vec<u8>,
) -> DispatchResult
```

**参数**:
- `origin`: 调用者（必须是签名账户）
- `dust_amount`: DUST 数量（精度 10^12）
- `tron_address`: TRON 接收地址（34 字节）

**权限**: 任何签名账户

**前置条件**:
- `dust_amount >= MinSwapAmount`
- `tron_address` 长度为 34 字节
- 用户 DUST 余额充足

**效果**:
- 锁定 DUST 到托管账户
- 创建 `SwapRequest` 记录
- 发出 `SwapCreated` 事件

**示例**:
```rust
// Rust
let tron_address = b"TXYZPFg...".to_vec(); // 34 字节
api.tx.bridge.swap(1000_000_000_000_000u128, tron_address)?;
```

```typescript
// TypeScript
const tronAddress = new Uint8Array(34); // 34 字节 TRON 地址
await api.tx.bridge.swap(
  '1000000000000000', // 1000 DUST
  tronAddress
).signAndSend(account);
```

### 2. `complete_swap` - 完成官方桥接兑换

**函数签名**:
```rust
pub fn complete_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

**参数**:
- `origin`: 调用者（必须是治理权限）
- `swap_id`: 兑换 ID

**权限**: `GovernanceOrigin`（治理账户）

**前置条件**:
- 兑换存在且未完成
- 桥接账户已设置

**效果**:
- 释放 DUST 到桥接账户（模拟销毁）
- 标记兑换为已完成
- 发出 `SwapCompleted` 事件

**示例**:
```rust
// Rust（需要 sudo 或治理权限）
api.tx.sudo.sudo(
    api.tx.bridge.complete_swap(1)
)?;
```

### 3. `maker_swap` - 创建做市商兑换

**函数签名**:
```rust
pub fn maker_swap(
    origin: OriginFor<T>,
    maker_id: u64,
    dust_amount: BalanceOf<T>,
    usdt_address: Vec<u8>,
) -> DispatchResult
```

**参数**:
- `origin`: 调用者（必须是签名账户）
- `maker_id`: 做市商 ID
- `dust_amount`: DUST 数量
- `usdt_address`: USDT 接收地址（TRC20，34 字节）

**权限**: 任何签名账户

**前置条件**:
- `dust_amount >= MinSwapAmount`
- 做市商存在且激活
- `usdt_address` 长度为 34 字节
- 用户 DUST 余额充足
- 计算的 USDT 金额 >= 1 USDT（1000000）

**效果**:
- 锁定 DUST 到托管账户
- 创建 `MakerSwapRecord` 记录
- 发出 `MakerSwapCreated` 事件

**示例**:
```rust
// Rust
let usdt_address = b"TXYZPFg...".to_vec(); // 34 字节
api.tx.bridge.maker_swap(1, 1000_000_000_000_000u128, usdt_address)?;
```

```typescript
// TypeScript
const usdtAddress = new Uint8Array(34); // 34 字节 TRON 地址
await api.tx.bridge.makerSwap(
  1, // maker_id
  '1000000000000000', // 1000 DUST
  usdtAddress
).signAndSend(account);
```

### 4. `mark_swap_complete` - 做市商标记兑换完成

**函数签名**:
```rust
pub fn mark_swap_complete(
    origin: OriginFor<T>,
    swap_id: u64,
    trc20_tx_hash: Vec<u8>,
) -> DispatchResult
```

**参数**:
- `origin`: 调用者（必须是做市商账户）
- `swap_id`: 兑换 ID
- `trc20_tx_hash`: TRC20 交易哈希（最多 128 字节）

**权限**: 兑换的做市商

**前置条件**:
- 兑换存在且状态为 `Pending`
- 调用者是兑换的做市商
- 交易哈希长度 <= 128 字节
- 交易哈希未被使用

**效果**:
- 记录交易哈希到 `UsedTronTxHashes`
- 释放 DUST 到做市商账户
- 更新状态为 `Completed`
- 记录信用分（成功订单）
- 发出 `MakerSwapCompleted` 事件

**示例**:
```rust
// Rust
let tx_hash = hex::decode("abcd1234...")?;
api.tx.bridge.mark_swap_complete(1, tx_hash)?;
```

```typescript
// TypeScript
const txHash = '0xabcd1234...'; // TRON 交易哈希
await api.tx.bridge.markSwapComplete(
  1, // swap_id
  txHash
).signAndSend(makerAccount);
```

### 5. `report_swap` - 用户举报做市商兑换

**函数签名**:
```rust
pub fn report_swap(
    origin: OriginFor<T>,
    swap_id: u64,
) -> DispatchResult
```

**参数**:
- `origin`: 调用者（必须是用户账户）
- `swap_id`: 兑换 ID

**权限**: 兑换的用户

**前置条件**:
- 兑换存在
- 调用者是兑换的用户
- 状态为 `Pending` 或 `Completed`

**效果**:
- 更新状态为 `UserReported`
- 发出 `SwapReported` 事件
- 触发仲裁流程

**示例**:
```rust
// Rust
api.tx.bridge.report_swap(1)?;
```

```typescript
// TypeScript
await api.tx.bridge.reportSwap(1).signAndSend(userAccount);
```

### 6. `set_bridge_account` - 设置桥接账户

**函数签名**:
```rust
pub fn set_bridge_account(
    origin: OriginFor<T>,
    account: T::AccountId,
) -> DispatchResult
```

**参数**:
- `origin`: 调用者（必须是治理权限）
- `account`: 桥接账户地址

**权限**: `GovernanceOrigin`（治理账户）

**效果**:
- 设置 `BridgeAccount` 存储项
- 发出 `BridgeAccountSet` 事件

**示例**:
```rust
// Rust（需要 sudo 或治理权限）
api.tx.sudo.sudo(
    api.tx.bridge.set_bridge_account(account_id)
)?;
```

---

## 事件定义

### 1. `SwapCreated`

**字段**:
- `swap_id`: 兑换 ID
- `user`: 用户账户
- `dust_amount`: DUST 数量

**触发条件**: 官方桥接兑换创建成功

### 2. `SwapCompleted`

**字段**:
- `swap_id`: 兑换 ID
- `user`: 用户账户

**触发条件**: 官方桥接兑换完成

### 3. `SwapStateChanged`

**字段**:
- `swap_id`: 兑换 ID
- `old_state`: 旧状态（u8 编码）
- `new_state`: 新状态（u8 编码）

**触发条件**: 兑换状态变更

### 4. `MakerSwapCreated`

**字段**:
- `swap_id`: 兑换 ID
- `maker_id`: 做市商 ID
- `user`: 用户账户
- `dust_amount`: DUST 数量

**触发条件**: 做市商兑换创建成功

### 5. `MakerSwapCompleted`

**字段**:
- `swap_id`: 兑换 ID
- `maker`: 做市商账户

**触发条件**: 做市商兑换完成

### 6. `MakerSwapMarkedComplete`

**字段**:
- `swap_id`: 兑换 ID
- `maker_id`: 做市商 ID
- `trc20_tx_hash`: TRC20 交易哈希

**触发条件**: 做市商标记兑换完成

### 7. `SwapReported`

**字段**:
- `swap_id`: 兑换 ID
- `user`: 用户账户

**触发条件**: 用户举报兑换

### 8. `BridgeAccountSet`

**字段**:
- `account`: 桥接账户地址

**触发条件**: 治理账户设置桥接账户

---

## 错误定义

| 错误名称 | 说明 |
|---------|------|
| `SwapNotFound` | 兑换不存在 |
| `MakerNotFound` | 做市商不存在 |
| `MakerNotActive` | 做市商未激活 |
| `InvalidSwapStatus` | 兑换状态不正确 |
| `NotAuthorized` | 未授权 |
| `EncodingError` | 编码错误 |
| `StorageLimitReached` | 存储限制已达到 |
| `SwapAmountTooLow` | 兑换金额太低 |
| `InvalidTronAddress` | 无效的 TRON 地址 |
| `BridgeAccountNotSet` | 桥接账户未设置 |
| `AlreadyCompleted` | 兑换已完成 |
| `NotMaker` | 不是做市商 |
| `InvalidStatus` | 状态无效 |
| `InvalidTxHash` | 交易哈希无效 |
| `TooManySwaps` | 兑换太多（超过存储限制） |
| `BelowMinimumAmount` | 低于最小金额 |
| `InvalidAddress` | 地址无效 |
| `NotSwapUser` | 不是兑换的用户 |
| `CannotReport` | 无法举报（状态不符） |
| `PriceNotAvailable` | 价格不可用 |
| `AmountOverflow` | 金额溢出 |
| `UsdtAmountTooSmall` | USDT 金额太小（< 1 USDT） |
| `TronTxHashAlreadyUsed` | TRON 交易哈希已被使用（防重放攻击） |

---

## 配置参数

### 1. `Currency`

- **类型**: `Currency<Self::AccountId>`
- **说明**: 货币类型（DUST 代币）

### 2. `Escrow`

- **类型**: `pallet_escrow::Escrow<Self::AccountId, BalanceOf<Self>>`
- **说明**: 托管服务接口

### 3. `Pricing`

- **类型**: `PricingProvider<BalanceOf<Self>>`
- **说明**: 价格提供者接口（获取 DUST/USD 汇率）

### 4. `MakerPallet`

- **类型**: `MakerInterface<Self::AccountId, BalanceOf<Self>>`
- **说明**: Maker Pallet 接口（验证做市商）

### 5. `Credit`

- **类型**: `CreditInterface`
- **说明**: Credit Pallet 接口（记录信用分）

### 6. `GovernanceOrigin`

- **类型**: `EnsureOrigin<Self::RuntimeOrigin>`
- **说明**: 治理权限（用于官方桥接管理）

### 7. `SwapTimeout`

- **类型**: `Get<BlockNumberFor<Self>>`
- **说明**: 官方兑换超时时间（区块数）
- **推荐值**: 600 区块（约 1 小时，假设 6 秒/区块）

### 8. `OcwSwapTimeoutBlocks`

- **类型**: `Get<BlockNumberFor<Self>>`
- **说明**: 做市商兑换超时时间（区块数，由 OCW 验证）
- **推荐值**: 600 区块（约 1 小时）

### 9. `MinSwapAmount`

- **类型**: `Get<BalanceOf<Self>>`
- **说明**: 最小兑换金额
- **推荐值**: 100_000_000_000_000（100 DUST）

### 10. `WeightInfo`

- **类型**: `WeightInfo`
- **说明**: 权重信息

---

## 使用示例

### 场景 1: 用户通过官方桥接兑换 DUST → USDT

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';

async function officialBridgeSwap() {
  // 1. 连接到节点
  const api = await ApiPromise.create({
    provider: new WsProvider('ws://localhost:9944')
  });

  // 2. 准备参数
  const dustAmount = '1000000000000000'; // 1000 DUST
  const tronAddress = new Uint8Array([
    // 34 字节 TRON 地址（Base58 解码后）
    0x41, 0x..., // TXYZPFg...
  ]);

  // 3. 创建兑换
  const hash = await api.tx.bridge
    .swap(dustAmount, tronAddress)
    .signAndSend(userAccount);

  console.log('兑换创建成功，交易哈希:', hash.toHex());

  // 4. 监听兑换完成事件
  api.query.system.events((events) => {
    events.forEach(({ event }) => {
      if (api.events.bridge.SwapCompleted.is(event)) {
        const [swapId, user] = event.data;
        console.log(`兑换 ${swapId} 完成，用户: ${user}`);
      }
    });
  });
}
```

### 场景 2: 用户通过做市商兑换 DUST → USDT

```typescript
async function makerBridgeSwap() {
  const api = await ApiPromise.create({
    provider: new WsProvider('ws://localhost:9944')
  });

  // 1. 查询活跃做市商
  const makerApplications = await api.query.maker.makerApplications.entries();
  const activeMakers = makerApplications
    .filter(([_, app]) => app.isActive)
    .map(([key, app]) => ({
      id: key.args[0].toNumber(),
      account: app.account.toString(),
      tronAddress: app.tronAddress,
    }));

  console.log('活跃做市商:', activeMakers);

  // 2. 选择做市商并创建兑换
  const makerId = activeMakers[0].id;
  const dustAmount = '1000000000000000'; // 1000 DUST
  const usdtAddress = new Uint8Array(34); // 用户的 TRON 地址

  const hash = await api.tx.bridge
    .makerSwap(makerId, dustAmount, usdtAddress)
    .signAndSend(userAccount);

  console.log('做市商兑换创建成功:', hash.toHex());

  // 3. 用户在链外转账 USDT 到做市商的 TRON 地址
  // (用户手动操作，使用 TronLink 或其他钱包)

  // 4. 做市商完成兑换并提交证明
  const trc20TxHash = '0xabcd1234...'; // TRON 交易哈希
  await api.tx.bridge
    .markSwapComplete(swapId, trc20TxHash)
    .signAndSend(makerAccount);
}
```

### 场景 3: 用户举报做市商兑换

```typescript
async function reportSwap(swapId: number) {
  const api = await ApiPromise.create({
    provider: new WsProvider('ws://localhost:9944')
  });

  // 1. 获取兑换详情
  const swap = await api.query.bridge.makerSwaps(swapId);
  console.log('兑换状态:', swap.status.toString());

  // 2. 用户举报
  const hash = await api.tx.bridge
    .reportSwap(swapId)
    .signAndSend(userAccount);

  console.log('举报成功，交易哈希:', hash.toHex());

  // 3. 进入仲裁流程（通过 pallet-arbitration）
  // 仲裁员处理后，结果会自动应用到兑换
}
```

### 场景 4: 治理账户管理桥接

```typescript
async function governanceTasks() {
  const api = await ApiPromise.create({
    provider: new WsProvider('ws://localhost:9944')
  });

  // 1. 设置桥接账户
  const bridgeAccount = '5GrwvaEF...'; // 桥接账户地址
  await api.tx.sudo.sudo(
    api.tx.bridge.setBridgeAccount(bridgeAccount)
  ).signAndSend(sudoAccount);

  // 2. 完成官方桥接兑换
  const swapId = 1;
  await api.tx.sudo.sudo(
    api.tx.bridge.completeSwap(swapId)
  ).signAndSend(sudoAccount);

  console.log('治理任务完成');
}
```

### 场景 5: 查询用户兑换历史

```typescript
async function getUserSwapHistory(userAccount: string) {
  const api = await ApiPromise.create({
    provider: new WsProvider('ws://localhost:9944')
  });

  // 1. 获取用户兑换 ID 列表
  const swapIds = await api.query.bridge.userSwaps(userAccount);
  console.log('用户兑换 ID:', swapIds.toJSON());

  // 2. 查询每个兑换的详情
  const swaps = await Promise.all(
    swapIds.map(async (id) => {
      const officialSwap = await api.query.bridge.swapRequests(id);
      const makerSwap = await api.query.bridge.makerSwaps(id);
      return officialSwap.isSome ? officialSwap.unwrap() : makerSwap.unwrap();
    })
  );

  console.log('兑换详情:', swaps);
}
```

---

## 集成说明

### 1. TRON 链集成

#### TRON 地址格式

- **标准格式**: Base58 编码，以 'T' 开头，例如 `TXYZPFg9H7z5YAqB6Q3kPZKMJLNvQg2fK1`
- **存储格式**: 34 字节原始字节数组（Base58 解码后）
- **验证规则**: 长度必须为 34 字节

#### TRC20-USDT 合约

- **合约地址**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
- **精度**: 6 位小数（1 USDT = 1000000）
- **网络**: TRON 主网

#### 链外转账流程

1. 做市商在链外使用 TronWeb 或 TronLink 转账 USDT
2. 获取交易哈希（txid）
3. 调用 `mark_swap_complete()` 提交交易哈希作为证明
4. 系统记录交易哈希到 `UsedTronTxHashes`，防止重复使用

### 2. OCW 机制说明

#### OCW 工作原理

本模块的 OCW（Off-Chain Worker）每个区块自动执行，主要职责是检测超时订单并自动退款：

1. **触发时机**: 每个区块的 `offchain_worker()` 钩子
2. **扫描范围**: 最近 100 个做市商兑换（`NextSwapId - 100` 到 `NextSwapId`）
3. **检测条件**: 状态为 `Pending` 且 `current_block >= timeout_at`
4. **自动操作**:
   - 调用 `Escrow::refund_all()` 退款给用户
   - 调用 `Credit::record_maker_order_timeout()` 记录做市商超时
   - 更新状态为 `Refunded`

#### OCW 实现代码

```rust
fn offchain_worker(block_number: BlockNumberFor<T>) {
    sp_runtime::print("🌉 Bridge OCW 开始执行");

    let next_id = NextSwapId::<T>::get();
    let start_id = if next_id > 100 { next_id - 100 } else { 0 };

    for swap_id in start_id..next_id {
        if let Some(mut record) = MakerSwaps::<T>::get(swap_id) {
            if record.status == SwapStatus::Pending
                && block_number >= record.timeout_at {
                // 退款给用户
                T::Escrow::refund_all(swap_id, &record.user)?;

                // 记录超时到信用分
                T::Credit::record_maker_order_timeout(record.maker_id, swap_id);

                // 更新状态
                record.status = SwapStatus::Refunded;
                MakerSwaps::<T>::insert(swap_id, record);
            }
        }
    }
}
```

#### 性能考虑

- **扫描窗口限制**: 仅扫描最近 100 个兑换，避免遍历所有历史记录
- **状态过滤**: 仅检查 `Pending` 状态，跳过已完成或已退款的订单
- **链上执行**: OCW 直接修改链上状态（不使用无签名交易）

### 3. 仲裁集成

#### 仲裁流程

1. **用户举报**: 调用 `report_swap()` 举报做市商
2. **状态变更**: 兑换状态变为 `UserReported`
3. **仲裁处理**: `pallet-arbitration` 介入处理争议
4. **裁决应用**: 调用 `apply_arbitration_decision()` 应用裁决结果

#### 裁决类型

```rust
pub enum Decision {
    /// 全额放款给做市商（用户败诉）
    Release,
    /// 全额退款给用户（做市商败诉）
    Refund,
    /// 按比例分账（双方都有责任）
    Partial(u16), // 基点（0-10000）
}
```

#### 裁决效果

| 裁决 | 状态变更 | 资金流向 | 信用分记录 |
|------|---------|---------|-----------|
| `Release` | `ArbitrationApproved` | DUST → 做市商 | 做市商胜诉 +1 |
| `Refund` | `ArbitrationRejected` | DUST → 用户 | 做市商败诉 -1 |
| `Partial(bps)` | `ArbitrationRejected` | 按比例分配 | 做市商败诉 -1 |

#### 仲裁接口

```rust
impl<T: Config> Pallet<T> {
    /// 检查用户是否有权对兑换发起争议
    pub fn can_dispute_swap(who: &T::AccountId, swap_id: u64) -> bool {
        // 用户或做市商都可以发起争议
        if let Some(record) = MakerSwaps::<T>::get(swap_id) {
            &record.user == who || &record.maker == who
        } else {
            false
        }
    }

    /// 应用仲裁裁决到兑换
    pub fn apply_arbitration_decision(
        swap_id: u64,
        decision: pallet_arbitration::pallet::Decision,
    ) -> DispatchResult {
        // 获取兑换记录并应用裁决
        // ...
    }
}
```

### 4. 信用分集成

本模块自动记录做市商的信用分数，通过 `CreditInterface` 与 `pallet-credit` 集成：

#### 信用分事件

| 事件 | 触发条件 | 信用分变化 |
|------|---------|-----------|
| `record_maker_order_completed` | 做市商成功完成兑换 | +1（响应时间越短，加分越多） |
| `record_maker_order_timeout` | OCW 检测到超时 | -1 |
| `record_maker_dispute_result` | 仲裁裁决 | 胜诉 +1 / 败诉 -1 |

#### 信用分接口

```rust
pub trait CreditInterface {
    /// 记录做市商订单完成（提升信用分）
    fn record_maker_order_completed(
        maker_id: u64,
        order_id: u64,
        response_time_seconds: u32,
    ) -> DispatchResult;

    /// 记录做市商订单超时（降低信用分）
    fn record_maker_order_timeout(
        maker_id: u64,
        order_id: u64,
    ) -> DispatchResult;

    /// 记录做市商争议结果（根据结果调整信用分）
    fn record_maker_dispute_result(
        maker_id: u64,
        order_id: u64,
        maker_win: bool,
    ) -> DispatchResult;
}
```

---

## 最佳实践

### 1. 官方桥接 vs 做市商桥接选择

| 场景 | 推荐模式 | 原因 |
|------|---------|------|
| 大额兑换（> 10000 USDT） | 官方桥接 | 官方信用背书，更安全 |
| 小额兑换（< 1000 USDT） | 做市商桥接 | 更快速，成本更低 |
| 需要快速到账 | 做市商桥接 | 做市商响应通常更快 |
| 对安全要求极高 | 官方桥接 | 治理账户管理，风险更低 |

### 2. 做市商服务最佳实践

#### 对于做市商

1. **及时响应**: 在超时时间内完成转账（建议 30 分钟内）
2. **准确提交证明**: 提交正确的 TRC20 交易哈希
3. **维护信用分**: 避免超时和争议，保持高信用分
4. **充足流动性**: 确保 USDT 余额充足，能够及时完成转账

#### 对于用户

1. **选择高信用做市商**: 优先选择信用分高、历史记录良好的做市商
2. **核对接收地址**: 确保提供的 TRON 地址正确无误
3. **保留转账记录**: 保存 TRON 转账截图作为证据
4. **及时举报**: 发现问题及时调用 `report_swap()` 举报

### 3. 安全建议

#### 防重放攻击

- 系统自动记录已使用的 TRON 交易哈希到 `UsedTronTxHashes`
- 每个交易哈希只能使用一次
- 做市商不能重复提交相同的交易哈希

#### 超时保护

- 官方桥接超时时间: `SwapTimeout` 区块数
- 做市商桥接超时时间: `OcwSwapTimeoutBlocks` 区块数
- OCW 自动检测超时订单并退款

#### 最小金额限制

- 设置 `MinSwapAmount` 防止垃圾订单
- 计算的 USDT 金额必须 >= 1 USDT（1000000）

### 4. 监控与维护

#### 关键指标

- **官方桥接成功率**: `SwapCompleted` / `SwapCreated`
- **做市商桥接成功率**: `MakerSwapCompleted` / `MakerSwapCreated`
- **平均完成时间**: `completed_at - created_at`
- **超时率**: `Refunded` / `MakerSwapCreated`
- **争议率**: `UserReported` / `MakerSwapCreated`

#### 日志监控

```rust
// OCW 日志
sp_runtime::print("🌉 Bridge OCW 开始执行");
sp_runtime::print("⚠️ Bridge OCW: 检测到超时兑换");
sp_runtime::print("✅ Bridge OCW: 处理了超时兑换");
```

#### 链上查询

```typescript
// 查询兑换详情
const swap = await api.query.bridge.makerSwaps(swapId);

// 查询用户兑换历史
const userSwaps = await api.query.bridge.userSwaps(userAccount);

// 查询做市商兑换历史
const makerSwaps = await api.query.bridge.makerSwapList(makerId);

// 查询桥接账户
const bridgeAccount = await api.query.bridge.bridgeAccount();
```

---

## Runtime 配置示例

```rust
impl pallet_bridge::Config for Runtime {
    type Currency = Balances;
    type Escrow = Escrow;
    type Pricing = Pricing;
    type MakerPallet = Maker;
    type Credit = Credit;
    type GovernanceOrigin = EnsureRoot<AccountId>;

    type SwapTimeout = ConstU32<600>; // 600 区块 = 1 小时
    type OcwSwapTimeoutBlocks = ConstU32<600>; // 600 区块 = 1 小时
    type MinSwapAmount = ConstU128<100_000_000_000_000>; // 100 DUST

    type WeightInfo = pallet_bridge::weights::SubstrateWeight<Runtime>;
}
```

---

## 测试

```bash
# 运行所有测试
cargo test -p pallet-bridge

# 运行特定测试
cargo test -p pallet-bridge --test test_swap

# 运行基准测试
cargo test -p pallet-bridge --features runtime-benchmarks
```

---

## 贡献者

- StarDust Team
- 版本: v0.1.0
- 最后更新: 2025-11-03

---

## 许可证

Unlicense
