# 做市商委员会治理机制实施报告

## 实施时间
2025-09-30

## 问题描述
委员会成员批准做市商审核无效（BadOrigin 错误）

## 根本原因
原实现使用 `ensure_root(origin)?`，仅允许 Sudo/Root 账户批准/驳回做市商申请。委员会成员直接调用 `approve/reject` 会被拒绝。

## 实施方案
**Root 或 委员会 2/3 多数**治理机制

### 设计目标
1. ✅ 去中心化治理，避免单点信任
2. ✅ Root 保留紧急通道
3. ✅ 委员会集体决策，2/3 多数通过
4. ✅ 前端友好提示和引导

## 修改清单

### 1. Pallet 层 (pallets/market-maker/src/lib.rs)

**增加 GovernanceOrigin 类型**：
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 其他配置
    
    /// 函数级中文注释：治理起源（用于批准/驳回做市商申请）
    /// - 推荐配置为 Root 或 委员会 2/3 多数
    type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
}
```

**修改 approve 函数**：
```rust
pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
    // 修改前：ensure_root(origin)?;
    // 修改后：
    T::GovernanceOrigin::ensure_origin(origin)?;
    // ...
}
```

**修改 reject 函数**：
```rust
pub fn reject(origin: OriginFor<T>, mm_id: u64, slash_bps: u16) -> DispatchResult {
    // 修改前：ensure_root(origin)?;
    // 修改后：
    T::GovernanceOrigin::ensure_origin(origin)?;
    // ...
}
```

### 2. Runtime 配置 (runtime/src/configs/mod.rs)

```rust
impl pallet_market_maker::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = ();
    type MinDeposit = MarketMakerMinDeposit;
    type InfoWindow = MarketMakerInfoWindow;
    type ReviewWindow = MarketMakerReviewWindow;
    type RejectSlashBpsMax = MarketMakerRejectSlashBpsMax;
    type MaxPairs = MarketMakerMaxPairs;
    
    /// 函数级中文注释：治理起源绑定为 Root 或 委员会(Instance1) 2/3 多数
    /// - Root：紧急通道，可单独批准/驳回
    /// - 委员会 2/3：正常治理流程，需通过提案投票
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
}
```

### 3. 文档更新 (pallets/market-maker/README.md)

**新增"治理机制"章节**，包括：
- 委员会审批流程（propose → vote → close）
- Root 直接批准（紧急通道）
- 代码示例和操作指南

**更新"可调用接口"章节**：
- approve/reject 的权限说明
- 委员会提案流程说明

**新增"优化记录"**：
- 记录本次治理机制实现

### 4. 前端优化 (memopark-dapp/src/features/otc/GovMarketMakerReviewPage.tsx)

**页面顶部添加治理说明**：
```tsx
<Alert 
  type="info" 
  showIcon 
  icon={<InfoCircleOutlined />}
  message="治理说明" 
  description={
    <div style={{ fontSize: 12 }}>
      <p>批准/驳回需要通过<strong>委员会 2/3 多数投票</strong>或 <strong>Root 直接调用</strong>。</p>
      <p>委员会成员请通过提案流程（propose → vote → close）执行操作。</p>
    </div>
  }
/>
```

**BadOrigin 错误友好提示**：
- 检测 BadOrigin 错误
- 弹出详细的治理流程说明
- 引导用户查看文档

## 使用方式

### 方式 1：Root 直接批准（紧急通道）

```typescript
// 使用 Sudo 账户
await api.tx.sudo.sudo(
  api.tx.marketMaker.approve(mmId)
).signAndSend(sudoAccount)
```

### 方式 2：委员会提案流程（推荐）

**步骤 1：提交提案**（任一委员会成员）
```typescript
const approveCall = api.tx.marketMaker.approve(mmId)
await api.tx.council.propose(
  3,  // 阈值（最少需要几票）
  approveCall,
  approveCall.length
).signAndSend(councilMember)
```

**步骤 2：其他成员投票**
```typescript
const proposalHash = approveCall.method.hash
await api.tx.council.vote(
  proposalHash,
  0,  // 提案索引
  true  // 赞成
).signAndSend(otherMember)
```

**步骤 3：达到阈值后执行**
```typescript
await api.tx.council.close(
  proposalHash,
  0,
  1_000_000_000,  // weight bound
  1000  // length bound
).signAndSend(anyMember)
```

## 测试验证

### 1. 编译验证 ✅
```bash
cargo build --release
# 输出：Finished `release` profile [optimized] target(s) in 1m 50s
```

### 2. Lint 检查 ✅
```bash
# 无 linter 错误
```

### 3. 功能测试建议

**场景 1：Root 直接批准**
1. 使用 Sudo 账户访问审核页面
2. 点击"批准申请"
3. **预期**：成功批准，状态变为 Active

**场景 2：委员会成员直接调用**
1. 使用委员会成员账户访问审核页面
2. 点击"批准申请"
3. **预期**：显示 BadOrigin 错误，弹出友好提示

**场景 3：委员会提案流程**
1. 委员会成员 A 提交批准提案
2. 委员会成员 B、C 投票赞成
3. 达到 2/3 阈值后执行
4. **预期**：成功批准，状态变为 Active

## 影响范围

### 链端
- ✅ pallet-market-maker：增加 GovernanceOrigin 配置
- ✅ runtime：绑定治理起源为 Root | Council 2/3
- ✅ 编译通过，无破坏性变更

### 前端
- ✅ 审核页面添加治理说明
- ✅ BadOrigin 错误友好提示
- ✅ 引导用户查看文档

### 文档
- ✅ README 新增"治理机制"章节
- ✅ 更新接口权限说明
- ✅ 提供代码示例

## 安全性

1. **去中心化**：委员会集体决策，2/3 多数通过
2. **紧急通道**：Root 保留直接批准权限
3. **权限分离**：提案、投票、执行分离
4. **透明性**：所有操作链上可查，事件完整

## 后续建议

### 短期
1. ✅ 配置委员会成员（至少 3 人）
2. ✅ 测试委员会提案流程
3. ✅ 培训委员会成员使用流程

### 中期
1. 🔄 前端开发委员会提案 UI
   - 一键提交提案
   - 提案列表和投票界面
   - 提案执行按钮
2. 🔄 集成 Subsquid 索引提案数据
3. 🔄 提案历史和统计看板

### 长期
1. 🔄 移除 Root 通道（完全去中心化）
2. 🔄 引入多级委员会（技术委员会、安全委员会等）
3. 🔄 实现链上治理参数调整

## 开发者备注

- 修改时间：2025-09-30
- 影响版本：runtime spec_version: 101
- 兼容性：向后兼容，无破坏性变更
- 测试状态：编译通过 ✅，需要功能测试

## 总结

本次实施成功将做市商审批权限从单点 Root 改为**Root 或 委员会 2/3 多数**的治理机制：

✅ **技术实现**：
- Pallet 增加 GovernanceOrigin 类型
- Runtime 绑定为 EitherOfDiverse<Root, Council 2/3>
- 编译通过，无错误

✅ **用户体验**：
- 前端添加治理说明
- BadOrigin 错误友好提示
- 完整文档和代码示例

✅ **安全性**：
- 去中心化治理
- Root 保留紧急通道
- 权限分离和透明性

🎯 **下一步**：
- 配置委员会成员
- 测试委员会提案流程
- 开发委员会提案 UI（可选）
