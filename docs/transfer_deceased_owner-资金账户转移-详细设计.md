# transfer_deceased_owner - 资金账户转移 - 详细设计

## 问题背景

### 当前实现的缺陷 ⚠️ P1

**当前代码**（`pallets/deceased/src/lib.rs:1539`）：
```rust
pub fn transfer_deceased_owner(
    origin: OriginFor<T>,
    id: T::DeceasedId,
    new_owner: T::AccountId,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
        let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
        ensure!(d.owner == who, Error::<T>::NotDeceasedOwner);
        ensure!(d.owner != new_owner, Error::<T>::BadInput);
        
        let old_owner = d.owner.clone();
        
        // ⚠️ 只修改了owner字段
        d.owner = new_owner.clone();
        d.updated = <frame_system::Pallet<T>>::block_number();
        d.version = d.version.saturating_add(1);
        
        // 记录变更日志
        OwnerChangeLogOf::<T>::insert(...);
        
        Ok(())
    })
}
```

**问题**：
- ❌ 只修改了 `deceased.owner` 字段
- ❌ 没有处理 `SubjectFunding` 账户
- ❌ 导致资金"丢失"在旧账户中

---

## 资金账户机制

### SubjectFunding 账户派生逻辑

**位置**：`pallets/stardust-ipfs/src/lib.rs:760`

```rust
/// 派生主题资金账户（SubjectFunding）
pub fn derive_subject_funding_account(deceased_id: u64) -> T::AccountId {
    use codec::Encode;
    use sp_runtime::traits::AccountIdConversion;
    
    // 从 pallet-deceased 获取 owner
    let creator = match T::OwnerProvider::owner_of(deceased_id) {
        Some(owner) => owner,
        None => {
            return T::SubjectPalletId::get().into_account_truncating();
        }
    };
    
    let domain = T::DeceasedDomain::get();
    
    // ⭐ 关键：资金账户基于 (domain, creator, deceased_id) 派生
    let seed = (domain, creator, deceased_id).encode();
    
    T::SubjectPalletId::get().into_sub_account_truncating(seed)
}
```

**关键发现**：
1. 资金账户地址 = `SubjectPalletId.into_sub_account_truncating((domain, owner, deceased_id))`
2. `owner` 是通过 `OwnerProvider::owner_of(deceased_id)` 获取的
3. 也就是从 `DeceasedOf[id].owner` 读取

**派生参数**：
- `domain`: 逝者域编码（常量，如 `0x01`）
- `owner`: 逝者的当前owner
- `deceased_id`: 逝者ID

---

### Triple-Charge 扣费机制

**位置**：`pallets/deceased/src/lib.rs:919`

**扣费优先级**：
```
1. IpfsPoolAccount（公共池账户，有月度配额限制）
   ↓ 失败
2. SubjectFunding(deceased_id)（逝者专属资金账户）← 问题出在这里！
   ↓ 失败
3. Caller（调用者账户，兜底）
```

**使用场景**：
- 自动pin `name_full_cid`（全名CID）
- 自动pin `main_image`（主图CID）
- 后续可能的媒体pin

**触发时机**：
- `create_deceased`: 创建时pin name_full_cid
- `update_deceased`: 更新name_full_cid时pin
- `set_main_image`: 设置主图时pin

---

## 问题场景分析

### 场景1：Owner转让后的资金丢失

**操作流程**：
```rust
// 1. Alice创建逝者（deceased_id = 100）
deceased::create_deceased(Alice, ...)
// → owner = Alice
// → SubjectFunding账户 = derive((domain, Alice, 100))
// → 假设地址为 "5Sub1..."

// 2. Alice给资金账户充值
// transfer(Alice → "5Sub1...", 10 DUST)
// → SubjectFunding["5Sub1..."].balance = 10 DUST

// 3. Alice转让owner给Bob
deceased::transfer_deceased_owner(Alice, id: 100, new_owner: Bob)
// → owner = Bob ✅
// → ⚠️ 但是SubjectFunding账户没有转移！

// 4. Bob更新逝者信息（触发pin）
deceased::update_deceased(Bob, id: 100, name_full_cid: Some(...))
// → 触发 auto_pin_cid
// → 调用 IpfsPinner::pin_for_deceased(Bob, 100, cid)
// → derive_subject_funding_account(100):
//    - owner_of(100) = Bob ← 新owner！
//    - seed = (domain, Bob, 100)
//    - 返回新地址 "5Sub2..." ← 不同于旧地址！
// → 尝试从 "5Sub2..." 扣款
// → ⚠️ "5Sub2..." 余额为 0（从未充值）
// → 扣款失败！
// → 降级到从 Bob 账户扣款

// 5. 结果
// ✅ Pin成功（从Bob账户扣款）
// ❌ 旧资金账户 "5Sub1..." 的 10 DUST 无法使用
// ❌ 资金"丢失"
```

**影响**：
- 用户资金无法使用（虽然没有真正丢失，但无法访问）
- 增加用户负担（需要重新充值）
- 用户体验极差

---

### 场景2：频繁转让导致资金碎片化

```rust
// 1. Alice → Bob
transfer_deceased_owner(Alice, 100, Bob)
// SubjectFunding账户从 "5Sub1..." 变为 "5Sub2..."
// "5Sub1..." 中的余额无法使用

// 2. Bob → Charlie
transfer_deceased_owner(Bob, 100, Charlie)
// SubjectFunding账户从 "5Sub2..." 变为 "5Sub3..."
// "5Sub2..." 中的余额也无法使用

// 结果：多个资金账户碎片，余额分散
```

---

## 解决方案设计

### 方案A：自动转移余额（推荐）⭐

**核心思路**：
在 `transfer_deceased_owner` 中自动将旧资金账户的余额转移到新资金账户。

**实施步骤**：

#### 1. 在deceased pallet添加辅助trait（Config）
```rust
/// 函数级详细中文注释：资金账户派生接口
/// 
/// 功能：
/// - 从IPFS pallet获取资金账户派生能力
/// - 允许deceased pallet在owner转移时处理资金
/// 
/// 设计：
/// - 低耦合：通过trait解耦pallet
/// - 灵活性：未来可替换实现
pub trait SubjectFundingProvider<AccountId> {
    /// 派生主题资金账户
    /// - owner: 逝者owner
    /// - deceased_id: 逝者ID
    /// - 返回：派生的资金账户地址
    fn derive_subject_funding(owner: &AccountId, deceased_id: u64) -> AccountId;
}
```

#### 2. 实现trait（runtime）
```rust
// runtime/src/configs/mod.rs

pub struct IpfsFundingAdapter;

impl pallet_deceased::SubjectFundingProvider<AccountId> for IpfsFundingAdapter {
    fn derive_subject_funding(owner: &AccountId, deceased_id: u64) -> AccountId {
        use codec::Encode;
        use sp_runtime::traits::AccountIdConversion;
        
        // 使用与pallet_memo_ipfs相同的派生逻辑
        let domain: u8 = 1; // DeceasedDomain常量
        let pallet_id = PalletId(*b"memoipfs"); // SubjectPalletId
        let seed = (domain, owner, deceased_id).encode();
        
        pallet_id.into_sub_account_truncating(seed)
    }
}

impl pallet_deceased::Config for Runtime {
    // ... 其他配置 ...
    type SubjectFundingProvider = IpfsFundingAdapter;
    type Currency = Balances; // 添加Currency trait
}
```

#### 3. 修改transfer_deceased_owner（deceased）
```rust
pub fn transfer_deceased_owner(
    origin: OriginFor<T>,
    id: T::DeceasedId,
    new_owner: T::AccountId,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
        let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
        
        ensure!(d.owner == who, Error::<T>::NotDeceasedOwner);
        ensure!(d.owner != new_owner, Error::<T>::BadInput);
        
        let old_owner = d.owner.clone();
        
        // ⭐ Step 1: 派生旧资金账户
        use sp_runtime::traits::UniqueSaturatedInto;
        let deceased_id_u64: u64 = id.unique_saturated_into();
        let old_funding = T::SubjectFundingProvider::derive_subject_funding(
            &old_owner, 
            deceased_id_u64
        );
        
        // ⭐ Step 2: 派生新资金账户
        let new_funding = T::SubjectFundingProvider::derive_subject_funding(
            &new_owner, 
            deceased_id_u64
        );
        
        // ⭐ Step 3: 转移余额（保留ED）
        let old_balance = T::Currency::free_balance(&old_funding);
        let ed = T::Currency::minimum_balance();
        
        // 如果旧账户有可转移余额
        if old_balance > ed {
            let transfer_amount = old_balance.saturating_sub(ed);
            
            // 转移余额（使用transfer确保不会导致账户被销毁）
            T::Currency::transfer(
                &old_funding,
                &new_funding,
                transfer_amount,
                ExistenceRequirement::KeepAlive, // 保留旧账户
            )?;
            
            // 记录转移事件
            Self::deposit_event(Event::FundingAccountTransferred(
                id,
                old_funding.clone(),
                new_funding.clone(),
                transfer_amount,
            ));
        }
        
        // ⭐ Step 4: 更新owner
        d.owner = new_owner.clone();
        d.updated = <frame_system::Pallet<T>>::block_number();
        d.version = d.version.saturating_add(1);
        
        // 记录变更日志
        let now = d.updated;
        let empty_cid = BoundedVec::default();
        OwnerChangeLogOf::<T>::insert(
            id,
            (old_owner.clone(), new_owner.clone(), now, empty_cid)
        );
        
        // 发送事件
        Self::deposit_event(Event::OwnerTransferred(id, old_owner, new_owner));
        Self::touch_last_active(id);
        
        Ok(())
    })
}
```

#### 4. 添加新事件
```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 现有事件 ...
    
    /// 资金账户已转移（Phase 2新增）
    /// - deceased_id: 逝者ID
    /// - old_funding: 旧资金账户地址
    /// - new_funding: 新资金账户地址
    /// - amount: 转移金额
    FundingAccountTransferred(
        T::DeceasedId,
        T::AccountId,
        T::AccountId,
        T::Balance,
    ),
}
```

---

### 方案B：手动迁移工具（备选）

**核心思路**：
提供独立的extrinsic让用户手动转移资金。

**优势**：
- 给用户选择权
- 实施简单

**劣势**：
- 用户体验差（需要额外操作）
- 容易忘记迁移
- 不推荐

---

## 技术细节

### 1. 余额转移逻辑

```rust
let old_balance = T::Currency::free_balance(&old_funding);
let ed = T::Currency::minimum_balance(); // Existential Deposit

if old_balance > ed {
    let transfer_amount = old_balance.saturating_sub(ed);
    
    T::Currency::transfer(
        &old_funding,
        &new_funding,
        transfer_amount,
        ExistenceRequirement::KeepAlive, // 保留旧账户（避免被销毁）
    )?;
}
```

**为什么保留ED？**
- Substrate账户余额低于ED会被销毁
- 保留ED确保旧账户不会被销毁
- 避免重新创建账户的开销
- 用户后续仍可手动清空

### 2. 资金账户派生算法

```rust
// 派生公式
SubjectFunding = SubjectPalletId.into_sub_account_truncating(
    (domain, owner, deceased_id).encode()
)

// 示例
domain = 0x01 (DeceasedDomain常量)
owner = Alice (5GrwvaEF5zXb...)
deceased_id = 100

seed = encode((0x01, Alice, 100))
     = [0x01, 0x..., 0x64, ...]

SubjectFunding = PalletId("memoipfs").into_sub_account_truncating(seed)
               = 5Sub... (32字节地址)
```

**特性**：
- 确定性派生（相同输入→相同输出）
- owner变化→地址变化
- 不同deceased_id→不同地址

### 3. 资金碎片化问题

**问题**：
如果用户频繁转让owner，会产生多个资金账户碎片。

**解决**：
- 每次转移时自动清空旧账户
- 保留ED以维持账户存在
- 用户可手动清空旧账户（withdraw_all）

### 4. 兼容性检查

**需要检查的依赖**：
```rust
// deceased pallet需要添加
type Currency: Currency<Self::AccountId> + ...; // 添加Currency trait
type SubjectFundingProvider: SubjectFundingProvider<Self::AccountId>; // 新增
```

---

## 实施步骤

### Step 1: 定义trait（0.5h）
- 在`pallets/deceased/src/lib.rs`添加`SubjectFundingProvider` trait
- 更新`Config` trait添加关联类型

### Step 2: Runtime实现（1h）
- 在`runtime/src/configs/mod.rs`实现`IpfsFundingAdapter`
- 配置`pallet_deceased::Config`

### Step 3: 修改extrinsic（1h）
- 修改`transfer_deceased_owner`实现余额转移
- 添加新事件`FundingAccountTransferred`

### Step 4: 测试（1h）
- 单元测试：验证余额转移逻辑
- 集成测试：验证完整流程

### Step 5: 文档（0.5h）
- 更新README说明资金账户机制
- 添加使用示例

**总计**：约4小时

---

## 使用示例

### 场景1：Owner转让（自动转移余额）

```rust
// 1. Alice创建逝者
deceased::create_deceased(Alice, ...)
// deceased_id = 100
// owner = Alice
// SubjectFunding = "5SubA..." (基于Alice派生)

// 2. Alice给资金账户充值
transfer(Alice → "5SubA...", 10 DUST)
// "5SubA...".balance = 10 DUST

// 3. Alice转让给Bob
deceased::transfer_deceased_owner(Alice, 100, Bob)
// → 派生旧账户: "5SubA..." (基于Alice)
// → 派生新账户: "5SubB..." (基于Bob)
// → 转移余额: "5SubA..." → "5SubB..." (10 DUST - ED)
// → 更新owner: Alice → Bob
// → Event: FundingAccountTransferred(100, "5SubA...", "5SubB...", 9.99 DUST)
// → Event: OwnerTransferred(100, Alice, Bob)

// 4. Bob更新逝者（触发pin）
deceased::update_deceased(Bob, 100, ...)
// → derive_subject_funding(100)
//    - owner_of(100) = Bob
//    - 返回 "5SubB..."
// → 从 "5SubB..." 扣款（有余额！）
// ✅ Pin成功
```

### 场景2：查询资金账户

```rust
// 前端JavaScript示例
const deceasedId = 100;
const owner = api.query.deceased.deceasedOf(deceasedId).owner;

// 派生资金账户地址
const domain = 1; // DeceasedDomain
const palletId = "memoipfs";
const seed = api.createType('(u8, AccountId, u64)', [domain, owner, deceasedId]);
const fundingAccount = api.registry
    .createType('PalletId', palletId)
    .into_sub_account_truncating(seed);

// 查询余额
const balance = await api.query.system.account(fundingAccount);
console.log("Funding account:", fundingAccount.toHuman());
console.log("Balance:", balance.data.free.toHuman());
```

---

## 风险评估

### 风险1：资金丢失 ⚠️ 中等

**场景**：
- 转移过程中链暂停
- 余额已从旧账户扣除
- 但未到达新账户

**缓解**：
- 使用原子操作（try_mutate确保事务性）
- Currency::transfer本身是原子的
- 失败会自动回滚

### 风险2：资金不足导致转让失败 ⚠️ 低

**场景**：
- 旧资金账户余额 < ED
- 无法转移
- 但不应阻止owner转让

**缓解**：
```rust
if old_balance > ed {
    // 转移余额
} else {
    // 跳过转移，仍允许owner转让
}
```

### 风险3：Gas费消耗增加 ⚠️ 低

**场景**：
- 添加余额转移操作
- 增加Gas消耗

**缓解**：
- 仅在有余额时执行转移
- 大部分情况下不转移（余额为0）
- 增加的Gas可接受

---

## 替代方案对比

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| **A. 自动转移** | ✅ 用户无感知<br>✅ 资金不丢失<br>✅ UX最佳 | ⚠️ 增加Gas<br>⚠️ 实施复杂度中等 | ⭐⭐⭐⭐⭐ |
| B. 手动迁移 | ✅ 实施简单<br>✅ 用户可控 | ❌ UX差<br>❌ 容易忘记<br>❌ 资金碎片化 | ⭐⭐ |
| C. 不处理 | ✅ 无开发成本 | ❌ 资金丢失<br>❌ UX极差<br>❌ 用户投诉 | ❌ 不推荐 |

---

## 总结

### P1优先级理由

1. **资金安全**：用户充值的MEMO无法使用
2. **用户体验**：转让owner后需要重新充值
3. **业务逻辑**：IPFS pin功能受影响
4. **项目形象**：资金"丢失"会损害用户信任

### 实施建议

✅ **强烈推荐方案A（自动转移余额）**

**理由**：
1. 用户无感知（最佳UX）
2. 资金安全（自动转移）
3. 实施可行（约4小时）
4. 风险可控（原子操作）

### 后续优化

**Phase 3（可选）**：
1. 提供余额查询接口
2. 前端显示资金账户余额
3. 支持手动清空旧账户
4. 统计资金碎片化情况

---

**文档版本**: v1.0
**创建时间**: 2025-10-24
**作者**: Claude (Cursor AI)
**状态**: ✅ 设计完成，待实施

