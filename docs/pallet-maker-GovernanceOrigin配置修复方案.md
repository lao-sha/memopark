# pallet-maker GovernanceOrigin 配置修复方案

## 问题描述

### 现象
通过委员会提案流程（`council.propose()` → 投票 → `council.close()`）执行 `maker.approveMaker(makerId)` 时，提案显示执行成功，但做市商状态实际未从 `PendingReview` 变为 `Active`。

### 根本原因
`pallet-maker` 的 `GovernanceOrigin` 配置与委员会集体 origin 不兼容：

```rust
// runtime/src/configs/mod.rs 第 2251 行
impl pallet_maker::Config for Runtime {
    // ...
    type GovernanceOrigin = frame_system::EnsureSigned<AccountId>;  // ❌ 问题所在
    // ...
}
```

**技术细节：**

1. `EnsureSigned<AccountId>` 期望一个**普通签名账户的 origin**
2. 委员会通过 `council.close()` 执行提案时，使用的是 **Collective Origin**（集体 origin）
3. 这两种 origin 类型不兼容
4. 当 `approve_maker` 函数调用 `T::GovernanceOrigin::ensure_origin(origin)` 时，由于 origin 类型不匹配，实际上会静默失败

**相关代码（pallets/maker/src/lib.rs 第 567-570 行）：**

```rust
pub fn approve_maker(origin: OriginFor<T>, maker_id: u64) -> DispatchResult {
    let approved_by = T::GovernanceOrigin::ensure_origin(origin)?;  // 这里失败
    Self::do_approve_maker(maker_id, &approved_by)
}
```

## 当前临时解决方案

由于 `EnsureSigned<AccountId>` 允许任何签名账户调用，可以直接用签名账户调用：

```bash
# 使用 direct-approve-maker.js 脚本
node direct-approve-maker.js <maker_id> [signer_seed]

# 示例
node direct-approve-maker.js 0 //Alice
```

**缺点**：这种方式绕过了委员会治理流程，任何人都可以批准做市商，存在安全风险。

## 推荐修复方案

### 方案一：委员会 2/3 多数批准（推荐）

修改 `runtime/src/configs/mod.rs` 中的配置：

```rust
impl pallet_maker::Config for Runtime {
    type Currency = Balances;
    type MakerCredit = pallet_credit::Pallet<Runtime>;

    // ✅ 修改为：Root 或 委员会 2/3 多数
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, CouncilCollective, 2, 3>,
    >;

    type Timestamp = pallet_timestamp::Pallet<Runtime>;
    // ... 其他配置保持不变
}
```

**说明：**
- `EnsureRoot<AccountId>`：允许 sudo 账户直接批准（用于紧急情况）
- `EnsureProportionAtLeast<..., 2, 3>`：需要委员会 2/3 成员投票通过
- `EitherOfDiverse`：满足任一条件即可

### 方案二：委员会简单多数批准

如果希望降低批准门槛：

```rust
type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
    frame_system::EnsureRoot<AccountId>,
    pallet_collective::EnsureProportionMoreThan<AccountId, CouncilCollective, 1, 2>,
>;
```

**说明：** 需要超过 1/2（即简单多数）委员会成员投票通过。

### 方案三：使用专用 Maker 审核委员会

如果希望设立专门的做市商审核委员会（与主委员会分离）：

```rust
// 1. 在 construct_runtime! 中添加新的 collective 实例
MakerReviewCouncil: pallet_collective::<Instance4>,

// 2. 配置新实例
impl pallet_collective::Config<pallet_collective::Instance4> for Runtime {
    type RuntimeOrigin = RuntimeOrigin;
    type Proposal = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    type MotionDuration = ConstU32<{ 7 * DAYS }>;
    type MaxProposals = ConstU32<100>;
    type MaxMembers = ConstU32<10>;
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    type SetMembersOrigin = EnsureRoot<AccountId>;
    type MaxProposalWeight = MaxCollectivesProposalWeight;
}

// 3. 在 pallet-maker 配置中使用
type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
    frame_system::EnsureRoot<AccountId>,
    pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance4, 2, 3>,
>;
```

## 修复步骤

### 步骤 1：确认 CouncilCollective 类型别名

检查 runtime 中是否已定义 `CouncilCollective`：

```rust
// 通常在 runtime/src/lib.rs 或 runtime/src/configs/mod.rs 中
type CouncilCollective = pallet_collective::Instance1;  // 或其他实例号
```

如果没有定义，需要添加或直接使用实例名：

```rust
// 直接使用实例
type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
    frame_system::EnsureRoot<AccountId>,
    pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
>;
```

### 步骤 2：修改配置文件

编辑 `runtime/src/configs/mod.rs`：

```rust
// 找到 pallet_maker::Config 实现（约第 2248 行）
impl pallet_maker::Config for Runtime {
    type Currency = Balances;
    type MakerCredit = pallet_credit::Pallet<Runtime>;

    // 修改这一行
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;

    type Timestamp = pallet_timestamp::Pallet<Runtime>;
    type MakerDepositAmount = MakerDepositAmount;
    type TargetDepositUsd = TargetDepositUsd;
    type DepositReplenishThreshold = DepositReplenishThreshold;
    type DepositReplenishTarget = DepositReplenishTarget;
    type PriceCheckInterval = PriceCheckInterval;
    type AppealDeadline = AppealDeadline;
    type Pricing = PricingImpl;
    type MakerApplicationTimeout = MakerApplicationTimeout;
    type WithdrawalCooldown = WithdrawalCooldown;
    type WeightInfo = ();
}
```

### 步骤 3：重新编译 Runtime

```bash
cargo build --release
```

### 步骤 4：验证修复

修复后，委员会提案流程应该正常工作：

```bash
# 使用 committee-proposal-cli.js 脚本
# 1. 发起提案
node committee-proposal-cli.js propose approveMaker 0

# 2. 投票（需要 2/3 成员）
node committee-proposal-cli.js vote <proposal_hash> <proposal_index> yes

# 3. 执行提案
node committee-proposal-cli.js close <proposal_hash> <proposal_index>
```

## 参考：其他 Pallet 的 GovernanceOrigin 配置

项目中其他 pallet 使用了正确的配置模式，可作为参考：

```rust
// pallet-stardust-appeals（第 86-89 行）
type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
    frame_system::EnsureRoot<AccountId>,
    pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
>;
```

## 安全建议

1. **不要使用 `EnsureSigned`**：这允许任何人批准做市商，存在严重安全风险
2. **建议使用委员会投票**：确保做市商审批经过多人审核
3. **考虑设置合适的门槛**：2/3 多数是常见选择，平衡安全性和效率
4. **保留 Root 权限**：用于紧急情况下的快速处理

## 相关文件

- `runtime/src/configs/mod.rs`：Runtime 配置文件（需要修改）
- `pallets/maker/src/lib.rs`：Maker pallet 源码
- `stardust-gov-scripts/committee-proposal-cli.js`：委员会提案管理脚本
- `stardust-gov-scripts/direct-approve-maker.js`：直接批准脚本（临时方案）
- `stardust-gov-scripts/check-maker-status.js`：做市商状态检查脚本

## 变更日志

| 日期 | 版本 | 描述 |
|------|------|------|
| 2025-11-27 | 1.0 | 初始文档，记录问题分析和修复方案 |
