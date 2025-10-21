# pallet-first-purchase（首购领取）

**原名称**: pallet-otc-claim  
**更名日期**: 2025-10-20  
**更名原因**: 更准确反映主要使用场景（新用户首次购买MEMO）

---

## 概述

基于 `pallet-balances` 的"命名预留（reserve_named）+ 预留再归属（repatriate_reserved_named）"机制，实现首购领取功能。

### 核心功能
- 做市商（发行方）在链下确认法币支付后签发领取授权
- 用户链上调用 `claim` 原子领取 MEMO（原生代币）
- 服务器不持有链上转账权限，资金仅受链上规则控制

---

## 使用场景

### 主要场景（~80%）
**新用户首次购买MEMO**
```
用户没有MEMO → 使用法币（微信/支付宝）支付给做市商
→ 做市商签发授权 → 用户调用 claim() 领取MEMO
```

### 次要场景（~20%）
**老用户法币入金**
```
用户持有MEMO，想增加持仓 → 使用法币支付
→ 做市商签发授权 → 用户调用 claim() 领取MEMO
```

---

## 接口

### 治理接口
- `upsert_issuer(issuer, pubkey, status, single_max, daily_max)` - 注册/更新发行方（Root/治理）
- `revoke_issuer(issuer)` - 吊销发行方（Root/治理）

### 用户接口
- `claim(issuer, order_id, beneficiary, amount, deadline_block, nonce, signature)` - 领取MEMO

---

## 签名规范（sr25519）

```rust
payload = "MEMOPARK_OTC_V1" 
        | genesis_hash 
        | issuer_account 
        | order_id 
        | beneficiary 
        | amount 
        | deadline_block 
        | nonce

sig = sr25519_sign(issuer_pubkey, blake2_256(payload))
```

---

## 事件

- `IssuerUpserted { issuer }` - 发行方注册/更新
- `IssuerRevoked { issuer }` - 发行方吊销
- `ClaimSucceeded { issuer, order_id, beneficiary, amount }` - 领取成功
- `ClaimRejected { issuer, order_id, reason }` - 领取失败

---

## 错误

- `IssuerNotFound` - 发行方不存在
- `IssuerRevoked` - 发行方已吊销
- `OrderConsumed` - 订单已消费
- `SignatureInvalid` - 签名无效
- `DeadlineExceeded` - 超过截止时间
- `InvalidChain` - 链标识不匹配
- `InsufficientFreeBalance` - 余额不足
- `DailyLimitExceeded` - 超过日限额
- `BeneficiaryInvalid` - 受益人无效

---

## 安全机制

1. **原子操作**: 领取交易内原子执行 `reserve_named -> repatriate_reserved_named(...Free)`，避免余额竞态
2. **一次性消费**: `(issuer, order_id)` 只能使用一次
3. **防重放**: `deadline_block` + `genesis_hash` 防重放与跨链重放
4. **限额控制**: 单笔限额 + 日累计限额
5. **授权签发**: 服务器不持有转账权限，仅签发授权

---

## 与其他 Pallet 的关系

### **pallet-first-purchase vs pallet-otc-order**

| 方面 | pallet-first-purchase | pallet-otc-order |
|------|----------------------|------------------|
| **交易方向** | 买入MEMO | 卖出MEMO |
| **资金流向** | 做市商 → 买家 | 买家 → 做市商 |
| **适用场景** | 首购、法币入金 | 换汇、出金 |
| **支付方式** | 法币（链下） | USDT（链下/链上） |
| **新用户** | ✅ 可用 | ❌ 需要先有MEMO |

**结论**: 两者功能互补，共同支持完整的 **入金 → 交易 → 出金** 闭环

---

## 使用流程

### 做市商准备
1. 做市商向治理申请注册为发行方
2. 治理调用 `upsert_issuer()` 注册做市商
3. 做市商准备MEMO库存

### 用户购买流程
1. 用户在链下支付法币给做市商
2. 做市商确认收款，签发领取授权（sr25519签名）
3. 用户（或代理）调用 `claim()` 提交授权
4. 链上验证签名和限额
5. 原子执行 reserve → repatriate
6. 用户获得MEMO

---

## 前端集成

前端显示名称: **"首购领取"** 或 **"首次购买"**

路由配置示例:
```typescript
{
  path: '/first-purchase',
  name: '首购领取',
  component: FirstPurchaseForm
}
```

API调用示例:
```typescript
await signAndSendLocalWithPassword(
  'FirstPurchase',  // pallet名称
  'claim',          // 接口名称
  [issuer, order_id, beneficiary, amount, deadline, nonce, signature],
  password
)
```

---

## 配置示例

```rust
// runtime/src/configs/mod.rs
parameter_types! {
    pub const FirstPurchaseBlocksPerDay: BlockNumber = DAYS;
}

impl pallet_first_purchase::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type BlocksPerDay = FirstPurchaseBlocksPerDay;
}

// runtime/src/lib.rs
#[runtime::pallet_index(44)]
pub type FirstPurchase = pallet_first_purchase;
```

---

## 开发说明

### 编译
```bash
cargo build --release -p pallet-first-purchase
```

### 测试
```bash
cargo test -p pallet-first-purchase
```

---

## 更名历史

- **2025-10-20**: 从 `pallet-otc-claim` 更名为 `pallet-first-purchase`
  - 原因: 更准确反映主要使用场景（新用户首购）
  - 与 `first-purchase-service` 命名一致
  - 提升用户体验和业务语义清晰度

---

## 相关资源

- [首购资金池服务](../../first-purchase-service/)
- [做市商管理](../market-maker/)
- [OTC订单管理](../otc-order/)
- [价格管理](../pricing/)

---

## 许可证

MIT-0
