# Phase 2 开发方案 - 核心治理层集成

> **基于**: 押金与申诉治理系统-完整设计方案.md  
> **前置**: Phase 1已完成（pallet-deposits + 动态定价）  
> **目标**: 集成pallet-deposits到申诉治理流程

---

## 📋 Phase 2 总览

### 核心目标

1. ✅ **模块重命名**: `pallet-memo-content-governance` → `pallet-stardust-appeals`
2. ✅ **押金集成**: appeals模块使用deposits模块管理押金
3. ✅ **代码清理**: 移除appeals中的旧押金逻辑
4. ✅ **测试验证**: 端到端测试流程

### 时间规划

```
Week 1 (Day 1-5): 模块重命名
Week 2 (Day 6-10): 集成pallet-deposits
Week 3 (Day 11-15): 测试与优化

总计: 15个工作日（3周）
```

### 人员配置

| 角色 | 人数 | 投入 | 总人天 |
|------|------|------|--------|
| 后端开发 | 1人 | 100% | 15人天 |
| 测试工程师 | 1人 | 50% | 7.5人天 |
| 技术文档 | 1人 | 30% | 4.5人天 |
| **总计** | - | - | **27人天** |

---

## 🎯 Week 1: 模块重命名

### Day 1-2: 链端重命名

#### 任务清单

| 序号 | 任务 | 详细说明 | 工作量 | 优先级 |
|------|------|---------|--------|--------|
| 1 | 重命名pallet目录 | `pallets/memo-content-governance` → `pallets/stardust-appeals` | 0.5h | P0 |
| 2 | 修改Cargo.toml | 更新package name和dependencies | 1h | P0 |
| 3 | 更新workspace | 修改根目录Cargo.toml的members | 0.5h | P0 |
| 4 | 修改Runtime配置 | runtime/src/lib.rs 和 configs/mod.rs | 2h | P0 |
| 5 | 更新所有导入 | 全局搜索替换import路径 | 2h | P0 |
| 6 | 更新注释文档 | 模块内部的中文注释和文档字符串 | 2h | P0 |

#### 详细步骤

**步骤1: 重命名pallet目录**
```bash
cd /home/xiaodong/文档/stardust/pallets
mv memo-content-governance stardust-appeals
```

**步骤2: 修改pallets/stardust-appeals/Cargo.toml**
```toml
[package]
name = "pallet-stardust-appeals"  # 修改
version = "0.2.0"  # 升级版本
description = "Appeal governance pallet for MemoMart"  # 修改描述
```

**步骤3: 修改根Cargo.toml**
```toml
[workspace]
members = [
    # ... 其他pallets ...
    "pallets/stardust-appeals",  # 修改
    # ... 其他pallets ...
]
```

**步骤4: 修改runtime/Cargo.toml**
```toml
[dependencies]
pallet-stardust-appeals = { path = "../pallets/stardust-appeals", default-features = false }  # 修改

[features]
std = [
    # ...
    "pallet-stardust-appeals/std",  # 修改
    # ...
]
```

**步骤5: 修改runtime/src/lib.rs**
```rust
// 导入修改
use pallet_memo_appeals as pallet_appeals;  // 可选简化

// construct_runtime修改
#[runtime::pallet_index(41)]
pub type Appeals = pallet_memo_appeals;  // 修改别名（可选）
// 或保持 ContentGovernance 别名以保持兼容性
```

**步骤6: 修改runtime/src/configs/mod.rs**
```rust
// 配置修改
impl pallet_memo_appeals::Config for Runtime {  // 修改trait路径
    type RuntimeEvent = RuntimeEvent;
    // ... 其他配置 ...
    type AppealDepositPolicy = ContentAppealDepositPolicy;  // 保持
}

// Router修改
pub struct ContentGovernanceRouter;  // 可保持名称
impl pallet_memo_appeals::AppealRouter for ContentGovernanceRouter {  // 修改trait
    // ... 实现 ...
}
```

#### 验证检查点

```bash
# 1. 编译检查
cargo check -p pallet-stardust-appeals
cargo check -p stardust-runtime

# 2. 单元测试
cargo test -p pallet-stardust-appeals

# 3. 集成测试
cargo test --workspace

# 预期: 全部通过 ✅
```

---

### Day 3-4: README和文档更新

#### 任务清单

| 序号 | 任务 | 详细说明 | 工作量 | 优先级 |
|------|------|---------|--------|--------|
| 1 | 更新pallet README | `pallets/stardust-appeals/README.md` | 2h | P0 |
| 2 | 更新项目文档 | 所有提及旧名称的文档 | 3h | P0 |
| 3 | 添加迁移说明 | 创建MIGRATION.md | 1h | P1 |
| 4 | 更新pallets接口文档 | `pallets接口文档.md` | 1h | P0 |

#### 文档模板

**pallets/stardust-appeals/README.md**
```markdown
# Pallet Memo Appeals

> **重要**: 本模块由 `pallet-memo-content-governance` 重命名而来  
> **版本**: v0.2.0  
> **更新日期**: 2025-10-25

## 概述

Memo Appeals是一个通用的申诉治理模块，支持多域（墓地、逝者、供奉品等）的申诉流程管理。

### 主要变更（v0.2.0）

1. ✅ 模块重命名：更准确反映功能范围
2. ✅ 集成pallet-deposits：统一押金管理
3. ✅ 动态定价：USD锚定MEMO押金
4. ✅ 代码优化：清理冗余逻辑

### 核心功能

- 申诉提交与管理
- 委员会审批流程
- 公示期保护机制
- 自动执行与重试
- 限频控制
- 应答自动否决

... (详细内容)
```

**docs/MIGRATION-ContentGovernance-to-Appeals.md**
```markdown
# 迁移指南: ContentGovernance → Appeals

## 背景

`pallet-memo-content-governance` 重命名为 `pallet-stardust-appeals`，以更准确地反映其功能范围。

## 链端变更

### 导入路径
```rust
// 旧
use pallet_memo_content_governance::...;

// 新
use pallet_memo_appeals::...;
```

### Runtime配置
```rust
// Runtime别名可保持不变（向后兼容）
pub type ContentGovernance = pallet_memo_appeals;

// 或使用新名称
pub type Appeals = pallet_memo_appeals;
```

## 前端变更

### API调用
```typescript
// 旧
api.tx.contentGovernance.submitAppeal(...)

// 新（如果Runtime别名改变）
api.tx.appeals.submitAppeal(...)
// 或保持不变（如果Runtime别名未改变）
```

## 兼容性

- ✅ 存储布局：**完全兼容**（无需迁移）
- ✅ API接口：**完全兼容**（如果Runtime别名不变）
- ✅ 事件Event：**完全兼容**
- ✅ 错误Error：**完全兼容**

## 注意事项

1. 如果Runtime别名保持 `ContentGovernance`，前端无需修改
2. 如果修改为 `Appeals`，需要更新前端所有调用
3. 建议：保持 `ContentGovernance` 别名一个版本周期，再逐步迁移
```

---

### Day 5: 编译测试与验证

#### 任务清单

| 序号 | 任务 | 验证项 | 预期结果 |
|------|------|--------|---------|
| 1 | 编译验证 | `cargo check --all` | ✅ 无错误 |
| 2 | 单元测试 | `cargo test -p pallet-stardust-appeals` | ✅ 全部通过 |
| 3 | 集成测试 | `cargo test --workspace` | ✅ 全部通过 |
| 4 | 启动测试链 | `./target/release/node-template --dev` | ✅ 正常启动 |
| 5 | Polkadot.js验证 | 检查metadata | ✅ 显示正确 |

#### 测试脚本

```bash
#!/bin/bash
# test-rename.sh

echo "=== Phase 2 Week 1 验证脚本 ==="

echo "1. 编译检查..."
cargo check -p pallet-stardust-appeals
cargo check -p stardust-runtime

echo "2. 单元测试..."
cargo test -p pallet-stardust-appeals

echo "3. 集成测试..."
cargo test --workspace --lib

echo "4. 构建release..."
cargo build --release

echo "5. 启动测试链..."
./target/release/node-template --dev &
NODE_PID=$!
sleep 10

echo "6. 检查节点状态..."
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
     http://localhost:9933/

kill $NODE_PID

echo "=== 验证完成 ==="
```

#### Week 1 交付物

- ✅ pallet重命名完成
- ✅ 所有配置文件更新
- ✅ 文档全部更新
- ✅ 编译测试通过
- ✅ 测试链启动正常

---

## 🔗 Week 2: 集成pallet-deposits

### Day 6-7: 定义依赖和接口

#### 任务清单

| 序号 | 任务 | 详细说明 | 工作量 | 优先级 |
|------|------|---------|--------|--------|
| 1 | 添加Cargo依赖 | pallets/stardust-appeals/Cargo.toml | 0.5h | P0 |
| 2 | Config添加DepositManager | 修改Config trait | 1h | P0 |
| 3 | 修改Appeal数据结构 | 添加deposit_id字段 | 1h | P0 |
| 4 | Runtime配置 | 配置DepositManager实现 | 1.5h | P0 |
| 5 | 编写适配器 | deposits→appeals的适配代码 | 2h | P0 |

#### 详细实现

**步骤1: 修改pallets/stardust-appeals/Cargo.toml**
```toml
[dependencies]
# ... 现有依赖 ...

# 新增
pallet-deposits = { path = "../deposits", default-features = false }

[features]
std = [
    # ... 现有 ...
    "pallet-deposits/std",
]
```

**步骤2: 修改pallets/stardust-appeals/src/lib.rs - Config**
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 现有配置 ...
    
    /// 函数级中文注释：押金管理器（使用pallet-deposits）
    /// 
    /// 用于管理申诉押金的冻结、释放和罚没。
    type DepositManager: pallet_deposits::DepositManager<
        Self::AccountId,
        BalanceOf<Self>,
    >;
    
    /// 函数级中文注释：押金受益人（罚没押金接收账户）
    /// 
    /// 通常设置为国库账户，用于接收被罚没的押金。
    type DepositBeneficiary: Get<Self::AccountId>;
    
    // 移除旧的押金相关配置
    // type AppealDeposit: Get<BalanceOf<Self>>;  // 移除：改用动态定价
    // type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;  // 保留用于其他目的
}
```

**步骤3: 修改Appeal数据结构**
```rust
/// 函数级中文注释：申诉记录
/// 
/// 存储单个申诉的完整信息。
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Appeal<AccountId, BlockNumber> {  // 移除Balance泛型
    /// 申诉人
    pub who: AccountId,
    /// 申诉域（1=墓地, 2=逝者, 3=文本, 4=媒体等）
    pub domain: u8,
    /// 目标对象ID
    pub target: u64,
    /// 操作类型
    pub action: u8,
    /// 理由CID
    pub reason_cid: BoundedVec<u8, ConstU32<128>>,
    /// 证据CID
    pub evidence_cid: BoundedVec<u8, ConstU32<128>>,
    
    /// 函数级中文注释：押金ID（指向pallet-deposits的记录）
    /// 
    /// 通过此ID可以查询押金状态、金额等详细信息。
    pub deposit_id: u64,  // 新增：替代deposit字段
    
    /// 申诉状态
    pub status: u8,
    /// 公示到期执行块号
    pub execute_at: Option<BlockNumber>,
    /// 批准时间
    pub approved_at: Option<BlockNumber>,
    /// 转移所有权目标账户
    pub new_owner: Option<AccountId>,
}
```

**步骤4: 修改runtime/src/configs/mod.rs**
```rust
impl pallet_memo_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;  // 保留用于其他操作
    
    /// 函数级中文注释：押金管理器实现（使用pallet-deposits）
    type DepositManager = pallet_deposits::Pallet<Runtime>;
    
    /// 函数级中文注释：押金受益人（国库账户）
    type DepositBeneficiary = TreasuryAccount;
    
    // 移除旧配置
    // type AppealDeposit = ...;  // 删除
    // type RejectedSlashBps = ...;  // 移至逻辑内部
    // type WithdrawSlashBps = ...;  // 移至逻辑内部
    
    // 保留其他配置
    type WindowBlocks = frame_support::traits::ConstU32<600>;
    type MaxPerWindow = frame_support::traits::ConstU32<5>;
    type NoticeDefaultBlocks = frame_support::traits::ConstU32<{ 30 * DAYS as u32 }>;
    type Router = ContentGovernanceRouter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type MaxExecPerBlock = frame_support::traits::ConstU32<50>;
    type MaxListLen = frame_support::traits::ConstU32<512>;
    type MaxRetries = frame_support::traits::ConstU8<3>;
    type RetryBackoffBlocks = frame_support::traits::ConstU32<600>;
    type AppealDepositPolicy = ContentAppealDepositPolicy;
    type WeightInfo = pallet_memo_appeals::weights::SubstrateWeight<Runtime>;
    type LastActiveProvider = ContentLastActiveProvider;
    type MinEvidenceCidLen = frame_support::traits::ConstU32<10>;
    type MinReasonCidLen = frame_support::traits::ConstU32<8>;
}
```

---

### Day 8-9: 迁移押金逻辑

#### 任务清单

| 序号 | 函数 | 修改内容 | 工作量 | 优先级 |
|------|------|---------|--------|--------|
| 1 | submit_appeal | 调用deposits.reserve() | 2h | P0 |
| 2 | approve_appeal | 调用deposits.release() | 1.5h | P0 |
| 3 | reject_appeal | 调用deposits.slash() | 1.5h | P0 |
| 4 | withdraw_appeal | 调用deposits.slash() | 1.5h | P0 |
| 5 | 清理旧代码 | 删除旧押金管理逻辑 | 2h | P0 |

#### 详细实现

**submit_appeal修改**
```rust
/// 函数级中文注释：提交申诉
#[pallet::weight(Weight::from_parts(10_000, 0))]
pub fn submit_appeal(
    origin: OriginFor<T>,
    domain: u8,
    target: u64,
    action: u8,
    reason_cid: BoundedVec<u8, ConstU32<128>>,
    evidence_cid: BoundedVec<u8, ConstU32<128>>,
    new_owner: Option<T::AccountId>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 1. 限频检查（保持不变）
    Self::check_rate_limit(&who)?;
    
    // 2. 计算押金金额（使用动态定价）
    let deposit_amount = T::AppealDepositPolicy::calc_deposit(&who, domain, target, action)
        .unwrap_or_else(|| {
            // 回退：使用固定基础押金（例如100 DUST）
            100u128.saturating_mul(1_000_000_000_000u128)  // 100 DUST
        });
    
    // 3. 构造押金用途
    let purpose = pallet_deposits::DepositPurpose::Appeal {
        appeal_id: 0,  // 临时值，后面会更新
        domain,
        target,
        action,
    };
    
    // 4. 冻结押金（使用pallet-deposits）
    let deposit_id = T::DepositManager::reserve(
        &who,
        deposit_amount,
        purpose.clone(),
    )?;
    
    // 5. 生成申诉ID
    let appeal_id = NextAppealId::<T>::get();
    NextAppealId::<T>::put(appeal_id.saturating_add(1));
    
    // 6. 创建申诉记录
    let appeal = Appeal {
        who: who.clone(),
        domain,
        target,
        action,
        reason_cid: reason_cid.clone(),
        evidence_cid: evidence_cid.clone(),
        deposit_id,  // 新增：存储deposit_id
        status: 0,  // Submitted
        execute_at: None,
        approved_at: None,
        new_owner,
    };
    
    Appeals::<T>::insert(appeal_id, appeal);
    
    // 7. 更新索引
    Self::update_indices(&who, domain, target, appeal_id)?;
    
    // 8. 发送事件
    Self::deposit_event(Event::AppealSubmitted {
        appeal_id,
        who,
        domain,
        target,
        action,
        deposit_id,  // 新增：事件中包含deposit_id
    });
    
    Ok(())
}
```

**approve_appeal修改**
```rust
/// 函数级中文注释：批准申诉
#[pallet::weight(Weight::from_parts(10_000, 0))]
pub fn approve_appeal(
    origin: OriginFor<T>,
    appeal_id: u64,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    
    Appeals::<T>::try_mutate(appeal_id, |maybe_appeal| -> DispatchResult {
        let appeal = maybe_appeal.as_mut().ok_or(Error::<T>::AppealNotFound)?;
        
        ensure!(appeal.status == 0, Error::<T>::InvalidStatus);  // Submitted
        
        // 1. 更新状态
        appeal.status = 1;  // Approved
        appeal.approved_at = Some(<frame_system::Pallet<T>>::block_number());
        
        // 2. 计算执行时间
        let notice_blocks = T::NoticeDefaultBlocks::get();
        let execute_at = <frame_system::Pallet<T>>::block_number() + notice_blocks.into();
        appeal.execute_at = Some(execute_at);
        
        // 3. 加入执行队列
        ExecutionQueue::<T>::try_mutate(execute_at, |queue| -> DispatchResult {
            queue.try_push(appeal_id).map_err(|_| Error::<T>::QueueFull)?;
            Ok(())
        })?;
        
        // 4. 发送事件（注意：押金在执行成功后释放）
        Self::deposit_event(Event::AppealApproved {
            appeal_id,
            execute_at,
        });
        
        Ok(())
    })
}
```

**reject_appeal修改**
```rust
/// 函数级中文注释：驳回申诉
#[pallet::weight(Weight::from_parts(10_000, 0))]
pub fn reject_appeal(
    origin: OriginFor<T>,
    appeal_id: u64,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    
    Appeals::<T>::try_mutate(appeal_id, |maybe_appeal| -> DispatchResult {
        let appeal = maybe_appeal.as_mut().ok_or(Error::<T>::AppealNotFound)?;
        
        ensure!(appeal.status == 0, Error::<T>::InvalidStatus);  // Submitted
        
        // 1. 罚没押金（30%罚没，70%退回）
        let slash_ratio = sp_runtime::Perbill::from_percent(30);
        let beneficiary = T::DepositBeneficiary::get();
        
        T::DepositManager::slash(
            appeal.deposit_id,
            slash_ratio,
            beneficiary.clone(),
        )?;
        
        // 2. 更新状态
        appeal.status = 2;  // Rejected
        
        // 3. 发送事件
        Self::deposit_event(Event::AppealRejected {
            appeal_id,
            slash_ratio,
        });
        
        Ok(())
    })
}
```

**withdraw_appeal修改**
```rust
/// 函数级中文注释：撤回申诉
#[pallet::weight(Weight::from_parts(10_000, 0))]
pub fn withdraw_appeal(
    origin: OriginFor<T>,
    appeal_id: u64,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    Appeals::<T>::try_mutate(appeal_id, |maybe_appeal| -> DispatchResult {
        let appeal = maybe_appeal.as_mut().ok_or(Error::<T>::AppealNotFound)?;
        
        ensure!(appeal.who == who, Error::<T>::NotAppealOwner);
        ensure!(appeal.status == 0, Error::<T>::InvalidStatus);  // Submitted
        
        // 1. 罚没押金（10%罚没，90%退回）
        let slash_ratio = sp_runtime::Perbill::from_percent(10);
        let beneficiary = T::DepositBeneficiary::get();
        
        T::DepositManager::slash(
            appeal.deposit_id,
            slash_ratio,
            beneficiary.clone(),
        )?;
        
        // 2. 更新状态
        appeal.status = 3;  // Withdrawn
        
        // 3. 发送事件
        Self::deposit_event(Event::AppealWithdrawn {
            appeal_id,
            slash_ratio,
        });
        
        Ok(())
    })
}
```

**执行成功后释放押金**
```rust
/// 函数级中文注释：执行申诉（on_initialize中调用）
fn execute_appeal(appeal_id: u64) -> DispatchResult {
    Appeals::<T>::try_mutate(appeal_id, |maybe_appeal| -> DispatchResult {
        let appeal = maybe_appeal.as_mut().ok_or(Error::<T>::AppealNotFound)?;
        
        // 1. 调用Router执行
        let result = T::Router::route_and_execute(
            appeal.domain,
            appeal.target,
            appeal.action,
            appeal.new_owner.clone(),
        );
        
        match result {
            Ok(()) => {
                // 2. 执行成功，释放押金
                T::DepositManager::release(appeal.deposit_id)?;
                
                // 3. 更新状态
                appeal.status = 4;  // Executed
                
                // 4. 发送事件
                Self::deposit_event(Event::AppealExecuted {
                    appeal_id,
                    success: true,
                });
                
                Ok(())
            },
            Err(e) => {
                // 执行失败，处理重试逻辑（保持不变）
                // ...
                Err(e)
            }
        }
    })
}
```

---

### Day 10: 清理与优化

#### 任务清单

| 序号 | 任务 | 详细说明 | 工作量 | 优先级 |
|------|------|---------|--------|--------|
| 1 | 移除旧押金代码 | 删除Currency操作 | 1h | P0 |
| 2 | 更新Event定义 | 添加deposit_id字段 | 1h | P0 |
| 3 | 更新Error定义 | 清理不需要的错误 | 0.5h | P1 |
| 4 | 代码审查 | 确保无遗留旧逻辑 | 2h | P0 |
| 5 | 更新注释 | 更新所有相关注释 | 1.5h | P1 |

#### 清理清单

**移除内容**:
```rust
// 删除：旧的押金字段
// pub deposit: Balance,  // ❌ 删除

// 删除：旧的Currency操作
// T::Currency::reserve(&who, deposit)?;  // ❌ 删除
// T::Currency::unreserve(&who, deposit);  // ❌ 删除
// T::Currency::transfer(...)?;  // ❌ 删除

// 删除：旧的押金配置
// type AppealDeposit: Get<Balance>;  // ❌ 删除（已在Config中移除）
```

**更新Event**:
```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    /// 申诉已提交
    AppealSubmitted {
        appeal_id: u64,
        who: T::AccountId,
        domain: u8,
        target: u64,
        action: u8,
        deposit_id: u64,  // 新增：押金ID
    },
    
    /// 申诉已批准
    AppealApproved {
        appeal_id: u64,
        execute_at: BlockNumberFor<T>,
    },
    
    /// 申诉已驳回
    AppealRejected {
        appeal_id: u64,
        slash_ratio: Perbill,  // 新增：罚没比例
    },
    
    // ... 其他事件 ...
}
```

#### Week 2 交付物

- ✅ pallet-deposits集成完成
- ✅ 所有押金操作使用deposits模块
- ✅ 旧押金代码全部清理
- ✅ Event/Error更新
- ✅ 代码审查通过

---

## 🧪 Week 3: 测试与优化

### Day 11-12: 单元测试

#### 测试用例清单

| 测试分类 | 测试用例 | 验证点 | 工作量 |
|---------|---------|--------|--------|
| **申诉提交** | | | 3h |
| - | test_submit_appeal_success | 押金正确冻结 | |
| - | test_submit_appeal_insufficient_balance | 余额不足失败 | |
| - | test_submit_appeal_rate_limit | 限频正确 | |
| - | test_submit_appeal_dynamic_pricing | 动态定价正确 | |
| **申诉审批** | | | 3h |
| - | test_approve_appeal_success | 进入公示期 | |
| - | test_reject_appeal_success | 罚没30%押金 | |
| - | test_approve_then_execute | 执行后释放押金 | |
| **申诉撤回** | | | 2h |
| - | test_withdraw_appeal_success | 罚没10%押金 | |
| - | test_withdraw_appeal_unauthorized | 非所有者失败 | |
| **执行逻辑** | | | 4h |
| - | test_execute_appeal_success | 押金正确释放 | |
| - | test_execute_appeal_failure_retry | 失败重试逻辑 | |
| - | test_execute_appeal_max_retries | 达到最大重试次数 | |
| **押金集成** | | | 4h |
| - | test_deposit_lifecycle | 完整生命周期 | |
| - | test_deposit_query | 查询押金状态 | |
| - | test_multiple_appeals_deposits | 多个申诉的押金管理 | |

#### 测试代码示例

```rust
#[test]
fn test_submit_appeal_with_dynamic_pricing() {
    new_test_ext().execute_with(|| {
        // 1. 设置MEMO价格为0.0005 USDT
        pallet_pricing::OtcPriceAggregate::<Test>::put(/* ... */);
        
        // 2. 提交申诉（预期押金：$10 / 0.0005 = 20,000 DUST）
        assert_ok!(Appeals::submit_appeal(
            Origin::signed(ALICE),
            1, // domain: grave
            1, // target
            1, // action: clear_cover
            bounded_vec![],
            bounded_vec![],
            None,
        ));
        
        // 3. 验证押金金额
        let appeal = Appeals::appeals(0).unwrap();
        let deposit = Deposits::deposits(appeal.deposit_id).unwrap();
        assert_eq!(deposit.amount, 20_000 * UNIT);  // 20,000 DUST
        assert_eq!(deposit.status, DepositStatus::Reserved);
    });
}

#[test]
fn test_approve_and_execute_releases_deposit() {
    new_test_ext().execute_with(|| {
        // 1. 提交申诉
        assert_ok!(Appeals::submit_appeal(/* ... */));
        let appeal_id = 0;
        let appeal = Appeals::appeals(appeal_id).unwrap();
        let deposit_id = appeal.deposit_id;
        
        // 2. 批准申诉
        assert_ok!(Appeals::approve_appeal(
            Origin::root(),
            appeal_id,
        ));
        
        // 3. 快进到执行时间
        let execute_at = Appeals::appeals(appeal_id).unwrap().execute_at.unwrap();
        run_to_block(execute_at);
        
        // 4. 验证押金已释放
        let deposit = Deposits::deposits(deposit_id).unwrap();
        assert_eq!(deposit.status, DepositStatus::Released);
        
        // 5. 验证申诉状态
        let appeal = Appeals::appeals(appeal_id).unwrap();
        assert_eq!(appeal.status, 4);  // Executed
    });
}

#[test]
fn test_reject_appeal_slashes_deposit() {
    new_test_ext().execute_with(|| {
        // 1. 提交申诉
        assert_ok!(Appeals::submit_appeal(/* ... */));
        let appeal_id = 0;
        let appeal = Appeals::appeals(appeal_id).unwrap();
        let deposit_id = appeal.deposit_id;
        let original_balance = Balances::free_balance(&ALICE);
        
        // 2. 驳回申诉
        assert_ok!(Appeals::reject_appeal(
            Origin::root(),
            appeal_id,
        ));
        
        // 3. 验证押金状态
        let deposit = Deposits::deposits(deposit_id).unwrap();
        assert_eq!(deposit.status, DepositStatus::PartiallySlashed { amount: /* 30% */ });
        
        // 4. 验证余额变化（应退回70%）
        let new_balance = Balances::free_balance(&ALICE);
        let expected_refund = deposit.amount * 70 / 100;
        assert_eq!(new_balance, original_balance + expected_refund);
    });
}
```

---

### Day 13-14: 集成测试

#### 端到端测试场景

| 场景 | 步骤 | 验证点 | 工作量 |
|------|------|--------|--------|
| **完整申诉流程** | | | 4h |
| 1 | 用户提交申诉 | 押金冻结、限频检查 | |
| 2 | 委员会批准 | 进入公示期 | |
| 3 | 公示期到期 | 自动执行 | |
| 4 | 执行成功 | 押金释放、状态更新 | |
| **多用户并发** | | | 3h |
| 1 | 10个用户同时提交申诉 | 所有押金正确冻结 | |
| 2 | 批量审批 | 并发审批正确 | |
| 3 | 批量执行 | 按队列顺序执行 | |
| **异常场景** | | | 4h |
| 1 | 余额不足 | 提交失败，无押金冻结 | |
| 2 | 执行失败 | 重试逻辑触发 | |
| 3 | 达到最大重试 | 标记为失败，不释放押金 | |
| 4 | 价格为0 | 使用回退价格 | |

#### 集成测试脚本

```rust
#[test]
fn integration_test_full_appeal_lifecycle() {
    new_test_ext().execute_with(|| {
        // === 场景设置 ===
        let alice = account("Alice", 0, 0);
        let initial_balance = 1_000_000 * UNIT;  // 100万MEMO
        Balances::make_free_balance_be(&alice, initial_balance);
        
        // 设置MEMO价格
        setup_pricing(500);  // 0.0005 USDT/DUST
        
        // === Step 1: 提交申诉 ===
        assert_ok!(Appeals::submit_appeal(
            Origin::signed(alice.clone()),
            2,  // domain: deceased
            1,  // target
            4,  // action: transfer_owner
            bounded_vec![/* reason_cid */],
            bounded_vec![/* evidence_cid */],
            Some(account("Bob", 1, 0)),
        ));
        
        let appeal_id = 0;
        let appeal = Appeals::appeals(appeal_id).unwrap();
        let deposit_id = appeal.deposit_id;
        
        // 验证：押金已冻结
        let deposit = Deposits::deposits(deposit_id).unwrap();
        assert_eq!(deposit.status, DepositStatus::Reserved);
        assert_eq!(deposit.amount, 25_000 * UNIT);  // $10 / 0.0005 × 1.5
        
        // 验证：余额减少
        let balance_after_submit = Balances::free_balance(&alice);
        assert_eq!(balance_after_submit, initial_balance - 25_000 * UNIT);
        
        // === Step 2: 委员会批准 ===
        assert_ok!(Appeals::approve_appeal(
            Origin::root(),
            appeal_id,
        ));
        
        let appeal = Appeals::appeals(appeal_id).unwrap();
        assert_eq!(appeal.status, 1);  // Approved
        assert!(appeal.execute_at.is_some());
        
        // === Step 3: 公示期（快进到执行时间）===
        let execute_at = appeal.execute_at.unwrap();
        run_to_block(execute_at);
        
        // === Step 4: 自动执行 ===
        // on_initialize应该已触发执行
        
        // 验证：申诉已执行
        let appeal = Appeals::appeals(appeal_id).unwrap();
        assert_eq!(appeal.status, 4);  // Executed
        
        // 验证：押金已释放
        let deposit = Deposits::deposits(deposit_id).unwrap();
        assert_eq!(deposit.status, DepositStatus::Released);
        
        // 验证：余额恢复
        let final_balance = Balances::free_balance(&alice);
        assert_eq!(final_balance, initial_balance);  // 全额退回
        
        // 验证：链上状态已更新（通过Router）
        // 这里需要mock Router的实现来验证
    });
}
```

---

### Day 15: 性能优化与文档

#### 性能优化任务

| 优化项 | 目标 | 实现方案 | 工作量 |
|--------|------|---------|--------|
| 存储读取 | 减少50% | 批量查询接口 | 2h |
| Weight计算 | 准确性>95% | 实际测量调整 | 2h |
| 事件大小 | <2KB | 移除冗余字段 | 1h |
| 代码复杂度 | <15 | 函数拆分 | 1h |

#### 文档更新

| 文档 | 更新内容 | 工作量 |
|------|---------|--------|
| pallets/stardust-appeals/README.md | 完整功能说明 | 1h |
| docs/pallet-stardust-appeals-API.md | API文档 | 1.5h |
| docs/Phase2-实施完成报告.md | 完成报告 | 1h |

#### Week 3 交付物

- ✅ 单元测试全部通过（覆盖率>90%）
- ✅ 集成测试全部通过
- ✅ 性能优化完成
- ✅ 文档更新完成
- ✅ 代码审查通过

---

## 📊 Phase 2 完成标准

### 功能验收

| 功能点 | 验证方式 | 状态 |
|--------|---------|------|
| 模块重命名 | 编译成功 | ⏳ |
| deposits集成 | submit_appeal使用deposits | ⏳ |
| 动态定价 | 价格随市场变化 | ⏳ |
| 押金释放 | 执行成功后释放 | ⏳ |
| 押金罚没 | 驳回/撤回罚没正确 | ⏳ |
| 旧代码清理 | 无Currency操作 | ⏳ |
| 事件更新 | 包含deposit_id | ⏳ |

### 质量验收

| 指标 | 目标 | 验证方式 |
|------|------|---------|
| 单元测试覆盖率 | >90% | `cargo tarpaulin` |
| 集成测试通过率 | 100% | `cargo test --workspace` |
| 编译警告 | 0 | `cargo check` |
| Linter错误 | 0 | `cargo clippy` |
| 文档完整性 | 100% | 人工审查 |

### 性能验收

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| submit_appeal | <50k Weight | benchmarking |
| approve_appeal | <30k Weight | benchmarking |
| 存储读取 | <5次/操作 | 代码审查 |

---

## ⚠️ 风险与缓解

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| deposits集成失败 | 低 | 高 | 详细设计+充分测试 |
| 旧押金逻辑遗漏 | 中 | 中 | 代码审查+搜索验证 |
| 性能回归 | 低 | 中 | 性能测试对比 |
| 数据迁移问题 | 无 | - | 无需迁移（新增字段） |

### 时间风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 测试时间不足 | 中 | 高 | 并行测试+自动化 |
| 重构超预期 | 低 | 中 | 按计划推进+每日复盘 |

---

## 🎯 里程碑检查点

### Week 1 结束
- [ ] pallet重命名完成
- [ ] 所有编译通过
- [ ] 文档更新完成

### Week 2 结束
- [ ] deposits集成完成
- [ ] 旧代码清理完成
- [ ] 单元测试更新

### Week 3 结束
- [ ] 所有测试通过
- [ ] 性能达标
- [ ] 文档完整
- [ ] **Phase 2 完成** ✅

---

## 📚 相关文档

- [Phase 1 完成报告](./Phase1-编译验证完成报告.md)
- [押金与申诉治理系统-完整设计方案](./押金与申诉治理系统-完整设计方案.md)
- [押金与申诉治理系统-实施路线图](./押金与申诉治理系统-实施路线图.md)
- [动态定价策略-实施完成报告](./动态定价策略-实施完成报告.md)

---

**规划完成时间**: 2025-10-25  
**预计开始时间**: Phase 1完成后立即开始  
**预计完成时间**: 3周（15个工作日）  
**状态**: 📋 待启动

