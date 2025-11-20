# SubjectFunding - 基于Creator派生方案

## 设计原则

### 核心理念

**SubjectFunding账户地址 = f(creator, deceased_id)**

**理由**：
1. ✅ `creator`是不可变的（创建时设置，永不改变）
2. ✅ `deceased_id`是唯一的
3. ✅ 地址永久稳定，不受owner转让影响
4. ✅ 不同creator创建的deceased有不同的资金账户（合理隔离）
5. ✅ 符合设计注释的原意

---

## 派生公式

### 标准派生（推荐）⭐

```rust
SubjectFunding = SubjectPalletId.into_sub_account_truncating(
    (DeceasedDomain, creator, deceased_id).encode()
)
```

**组成部分**：
- `DeceasedDomain`: u8常量（如0x01），用于区分不同业务域
- `creator`: AccountId（不可变的创建者）
- `deceased_id`: u64（逝者唯一ID）

**特性**：
- 完全确定性（相同输入→相同输出）
- creator不可变→地址永久稳定
- 不同creator→不同地址（资金隔离）

---

## 实施方案

### Step 1: 修改OwnerProvider为CreatorProvider

**文件**: `pallets/stardust-ipfs/src/lib.rs`

```rust
// 修改前（line 24-29）
pub trait OwnerProvider<AccountId> {
    /// 返回 subject(owner)；None 表示 subject 不存在。
    fn owner_of(subject_id: u64) -> Option<AccountId>;
}

// 修改后
/// 函数级详细中文注释：逝者创建者只读提供者（低耦合）
/// 
/// 功能：
/// - 从pallet-deceased读取creator字段（不可变的创建者）
/// - 用于SubjectFunding账户派生
/// 
/// 设计理念：
/// - creator不可变，确保资金账户地址永久稳定
/// - 与owner解耦，owner转让不影响资金账户
/// - 低耦合设计，通过trait解耦pallet
pub trait CreatorProvider<AccountId> {
    /// 返回逝者的creator（创建者）
    /// 
    /// 参数：
    /// - deceased_id: 逝者ID
    /// 
    /// 返回：
    /// - Some(creator): 逝者存在，返回创建者账户
    /// - None: 逝者不存在
    fn creator_of(deceased_id: u64) -> Option<AccountId>;
}
```

### Step 2: 更新Config中的trait约束

**文件**: `pallets/stardust-ipfs/src/lib.rs`

```rust
// 修改前（line 185-187）
/// 函数级中文注释：逝者所有者只读提供者（低耦合）。
/// - 返回 `Some(owner)` 则视为 subject 存在；None 表示不存在。
type OwnerProvider: OwnerProvider<Self::AccountId>;

// 修改后
/// 函数级详细中文注释：逝者创建者只读提供者（低耦合）
/// 
/// 功能：
/// - 从pallet-deceased读取creator字段
/// - 用于SubjectFunding账户派生
/// 
/// 设计理念：
/// - creator不可变，确保资金账户地址稳定
/// - 与owner解耦，支持owner转让
type CreatorProvider: CreatorProvider<Self::AccountId>;
```

### Step 3: 修改派生函数（统一逻辑）

**文件**: `pallets/stardust-ipfs/src/lib.rs`

```rust
// 删除旧的两个函数：subject_account_for、subject_account_for_deceased
// 删除旧的derive_subject_funding_account

// 新增统一的派生函数
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：派生SubjectFunding账户地址（统一方法）
    /// 
    /// ### 派生公式
    /// ```
    /// SubjectFunding = SubjectPalletId.into_sub_account_truncating(
    ///     (DeceasedDomain, creator, deceased_id).encode()
    /// )
    /// ```
    /// 
    /// ### 设计理念
    /// - **creator不可变**：创建时设置，永不改变
    /// - **地址稳定**：不受owner转让影响
    /// - **资金隔离**：不同creator的deceased有不同的资金账户
    /// - **确定性派生**：相同输入总是产生相同输出
    /// 
    /// ### 参数
    /// - `deceased_id`: 逝者ID
    /// 
    /// ### 返回
    /// - 派生的SubjectFunding账户地址
    /// - 如果deceased不存在，返回默认账户（扣款会失败）
    /// 
    /// ### 使用场景
    /// - 充值：`fund_subject_account`
    /// - 扣费：`dual_charge_storage_fee`、`triple_charge_storage_fee`
    /// - 查询：前端显示资金账户余额
    /// 
    /// ### 注意事项
    /// - 本函数不检查deceased是否存在
    /// - 调用方需要确保deceased_id有效
    /// - 如果deceased不存在，返回默认账户（后续操作会失败）
    #[inline]
    pub fn derive_subject_funding(deceased_id: u64) -> T::AccountId {
        use codec::Encode;
        use sp_runtime::traits::AccountIdConversion;
        
        // 从pallet-deceased获取creator
        let creator = match T::CreatorProvider::creator_of(deceased_id) {
            Some(c) => c,
            None => {
                // deceased不存在，返回默认账户
                // 后续扣款/充值会失败（正确的fail-safe行为）
                return T::SubjectPalletId::get().into_account_truncating();
            }
        };
        
        // 派生公式：(domain, creator, deceased_id)
        let domain = T::DeceasedDomain::get();
        let seed = (domain, creator, deceased_id).encode();
        
        T::SubjectPalletId::get().into_sub_account_truncating(seed)
    }
    
    /// 函数级中文注释：向后兼容的别名函数
    /// 
    /// 说明：
    /// - 为了向后兼容，保留旧的函数名
    /// - 内部调用新的统一函数
    /// - 逐步迁移代码后可以删除此别名
    #[inline]
    #[deprecated(note = "请使用derive_subject_funding替代")]
    pub fn derive_subject_funding_account(deceased_id: u64) -> T::AccountId {
        Self::derive_subject_funding(deceased_id)
    }
    
    /// 函数级中文注释：向后兼容的别名函数
    #[inline]
    #[deprecated(note = "请使用derive_subject_funding替代")]
    pub fn subject_account_for_deceased(subject_id: u64) -> T::AccountId {
        Self::derive_subject_funding(subject_id)
    }
}
```

### Step 4: 更新所有使用处

**文件**: `pallets/stardust-ipfs/src/lib.rs`

```rust
// 1. dual_charge_storage_fee (line 880)
// 修改前：
let subject_account = Self::derive_subject_funding_account(deceased_id);

// 修改后：
let subject_account = Self::derive_subject_funding(deceased_id);

// 2. triple_charge_storage_fee (line 1016)
// 修改前：
let subject_account = Self::derive_subject_funding_account(deceased_id);

// 修改后：
let subject_account = Self::derive_subject_funding(deceased_id);

// 3. fund_subject_account (line 1090)
// 修改前：
let to = Self::subject_account_for_deceased(subject_id);

// 修改后：
let to = Self::derive_subject_funding(subject_id);
```

### Step 5: 修改权限检查逻辑

**文件**: `pallets/stardust-ipfs/src/lib.rs`

```rust
// fund_subject_account函数（line 1075-1099）
// 修改前：
pub fn fund_subject_account(
    origin: OriginFor<T>,
    subject_id: u64,
    amount: BalanceOf<T>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    ensure!(amount != BalanceOf::<T>::default(), Error::<T>::BadParams);
    
    // ⚠️ 检查的是owner，不合理
    let owner = T::OwnerProvider::owner_of(subject_id).ok_or(Error::<T>::BadParams)?;
    ensure!(owner == who, Error::<T>::BadStatus);
    
    let to = Self::subject_account_for_deceased(subject_id);
    <T as Config>::Currency::transfer(&who, &to, amount, ...)?;
    Ok(())
}

// 修改后：
/// 函数级详细中文注释：用户给逝者资金账户充值
/// 
/// ### 权限
/// - **仅owner可充值**（原因：避免恶意充值污染资金账户）
/// - owner可以是当前owner，不要求是creator
/// - owner转让后，新owner可以继续充值
/// 
/// ### 资金流向
/// - caller → SubjectFunding(deceased_id)
/// - SubjectFunding地址基于creator派生（稳定地址）
/// 
/// ### 使用场景
/// - owner为deceased预存IPFS pin费用
/// - 避免每次pin都从个人账户扣费
/// 
/// ### 注意事项
/// - 充值后资金属于deceased专用
/// - 无法提现，只能用于IPFS pin
/// - owner转让不影响资金账户地址
#[pallet::call_index(8)]
#[pallet::weight(10_000)]
pub fn fund_subject_account(
    origin: OriginFor<T>,
    subject_id: u64,
    amount: BalanceOf<T>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    ensure!(amount != BalanceOf::<T>::default(), Error::<T>::BadParams);
    
    // 检查deceased是否存在（通过creator_of）
    let _creator = T::CreatorProvider::creator_of(subject_id)
        .ok_or(Error::<T>::BadParams)?;
    
    // 检查调用者是否是当前owner（权限控制）
    // 注意：这里需要新增OwnerProvider trait（与CreatorProvider并存）
    // 或者在deceased pallet添加owner查询方法
    let owner = T::OwnerProvider::owner_of(subject_id)
        .ok_or(Error::<T>::BadParams)?;
    ensure!(owner == who, Error::<T>::BadStatus);
    
    // 派生SubjectFunding地址（基于creator，稳定地址）
    let to = Self::derive_subject_funding(subject_id);
    
    <T as Config>::Currency::transfer(
        &who,
        &to,
        amount,
        frame_support::traits::ExistenceRequirement::KeepAlive,
    )?;
    
    Self::deposit_event(Event::SubjectFunded(subject_id, who, to, amount));
    Ok(())
}
```

**重要说明**：
- 充值权限检查仍需要`owner_of`（检查当前owner）
- 但资金账户派生使用`creator_of`（基于creator）
- 因此需要**同时保留两个trait**：
  - `CreatorProvider` - 用于资金账户派生
  - `OwnerProvider` - 用于权限检查

### Step 6: Runtime实现

**文件**: `runtime/src/configs/mod.rs`

```rust
// 1. 新增CreatorProvider实现
/// 函数级详细中文注释：逝者创建者适配器
pub struct DeceasedCreatorAdapter;

impl pallet_memo_ipfs::CreatorProvider<AccountId> for DeceasedCreatorAdapter {
    fn creator_of(deceased_id: u64) -> Option<AccountId> {
        use pallet_deceased::pallet::DeceasedOf as DMap;
        DMap::<Runtime>::get(deceased_id).map(|d| d.creator)  // ← 返回creator！
    }
}

// 2. 保留OwnerProvider实现（用于权限检查）
/// 函数级详细中文注释：逝者owner适配器
pub struct DeceasedOwnerAdapter;

impl pallet_memo_ipfs::OwnerProvider<AccountId> for DeceasedOwnerAdapter {
    fn owner_of(deceased_id: u64) -> Option<AccountId> {
        use pallet_deceased::pallet::DeceasedOf as DMap;
        DMap::<Runtime>::get(deceased_id).map(|d| d.owner)  // ← 返回owner
    }
}

// 3. 更新Config配置
impl pallet_memo_ipfs::Config for Runtime {
    // ... 其他配置 ...
    
    type CreatorProvider = DeceasedCreatorAdapter;  // ← 新增
    type OwnerProvider = DeceasedOwnerAdapter;      // ← 保留（用于权限检查）
    
    type SubjectPalletId = IpfsSubjectPalletId;
    type DeceasedDomain = ConstU8<1>;
    
    // ... 其他配置 ...
}
```

---

## 完整的数据流

### 场景1：Alice创建并充值

```rust
// 1. Alice创建deceased
deceased::create_deceased(Alice, ...)
// → deceased_id = 100
// → creator = Alice（不可变）
// → owner = Alice（可变）

// 2. 派生SubjectFunding地址
// derive_subject_funding(100)
// → creator_of(100) = Alice
// → seed = (domain:1, Alice, 100)
// → SubjectFunding = "5Sub1..." ← 基于creator派生

// 3. Alice充值
ipfs::fund_subject_account(Alice, 100, 10 DUST)
// → 权限检查：owner_of(100) = Alice ✅
// → 充值地址：derive_subject_funding(100) = "5Sub1..."
// → "5Sub1...".balance = 10 DUST ✅

// 4. Alice更新逝者（触发pin）
deceased::update_deceased(Alice, 100, ...)
// → 触发pin
// → 扣费地址：derive_subject_funding(100) = "5Sub1..."
// → 从"5Sub1..."扣费 ✅
// → 充值和扣费使用同一个地址！
```

### 场景2：Owner转让

```rust
// 承接场景1，owner转让给Bob

// 5. Alice转让给Bob
deceased::transfer_deceased_owner(Alice, 100, Bob)
// → creator = Alice（不变）
// → owner = Bob（变化）

// 6. SubjectFunding地址保持不变
// derive_subject_funding(100)
// → creator_of(100) = Alice ← 仍然是Alice（creator不可变）
// → seed = (domain:1, Alice, 100)
// → SubjectFunding = "5Sub1..." ← 地址不变！

// 7. Bob可以继续充值
ipfs::fund_subject_account(Bob, 100, 10 DUST)
// → 权限检查：owner_of(100) = Bob ✅
// → 充值地址：derive_subject_funding(100) = "5Sub1..." ← 同一个地址
// → "5Sub1...".balance = 20 DUST ✅

// 8. Bob更新逝者（触发pin）
deceased::update_deceased(Bob, 100, ...)
// → 扣费地址：derive_subject_funding(100) = "5Sub1..." ← 同一个地址
// → 从"5Sub1..."扣费 ✅
// → 使用的是同一个资金账户！
```

---

## 优势分析

### 1. 地址稳定性 ✅

- creator不可变 → 地址永久稳定
- owner转让不影响资金账户
- 无需实施资金迁移功能

### 2. 资金隔离 ✅

- 不同creator创建的deceased有不同的资金账户
- 合理的资金隔离
- 避免资金混淆

### 3. 充值与扣费统一 ✅

- 充值和扣费使用同一个地址
- 解决了当前P0问题
- 用户体验流畅

### 4. 权限合理 ✅

- 充值权限：当前owner（合理，避免恶意充值）
- 资金账户：基于creator（稳定，不受owner转让影响）
- 权限与稳定性兼得

### 5. 向后兼容 ✅

- 提供deprecated别名函数
- 逐步迁移代码
- 降低修改风险

---

## 实施步骤

### Phase 1: 基础修改（2h）

1. **修改trait定义**（0.5h）
   - 添加`CreatorProvider` trait
   - 保留`OwnerProvider` trait
   - 更新Config约束

2. **修改派生函数**（0.5h）
   - 实现`derive_subject_funding`
   - 添加deprecated别名
   - 更新所有使用处

3. **Runtime实现**（0.5h）
   - 实现`DeceasedCreatorAdapter`
   - 保留`DeceasedOwnerAdapter`
   - 更新Config

4. **编译测试**（0.5h）
   - 编译ipfs pallet
   - 编译runtime
   - 修复编译错误

### Phase 2: 测试验证（1h）

1. **单元测试**（0.5h）
   - 测试派生逻辑
   - 测试充值和扣费
   - 测试owner转让场景

2. **集成测试**（0.5h）
   - 端到端测试
   - 验证资金流向
   - 验证地址稳定性

### Phase 3: 文档更新（0.5h）

1. 更新README说明
2. 更新前端文档
3. 更新API文档

**总工作量**：约3.5小时

---

## 前端适配

### 派生SubjectFunding地址

```javascript
// JavaScript/TypeScript示例
async function deriveSubjectFunding(api, deceasedId) {
    // 1. 获取deceased信息
    const deceased = await api.query.deceased.deceasedOf(deceasedId);
    if (!deceased.isSome) {
        throw new Error('Deceased not found');
    }
    
    // 2. 获取creator
    const creator = deceased.unwrap().creator;
    
    // 3. 派生地址
    const domain = 1; // DeceasedDomain常量
    const palletId = api.consts.memoIpfs.subjectPalletId;
    
    const seed = api.createType('(u8, AccountId, u64)', [
        domain,
        creator,
        deceasedId
    ]);
    
    const fundingAccount = api.registry
        .createType('PalletId', palletId)
        .toAccountId()
        .derive(seed);
    
    return fundingAccount;
}

// 使用示例
const deceasedId = 100;
const fundingAccount = await deriveSubjectFunding(api, deceasedId);
const balance = await api.query.system.account(fundingAccount);
console.log('Funding account:', fundingAccount.toHuman());
console.log('Balance:', balance.data.free.toHuman());
```

---

## 迁移策略

### 对于已存在的deceased

**问题**：旧的deceased可能资金在旧地址

**方案**：
1. 提供资金迁移工具（可选）
2. 文档说明迁移步骤
3. 用户可以手动提取旧地址余额

**迁移脚本示例**：
```rust
// 治理提案：批量迁移资金
// 从旧地址(domain, subject_id)迁移到新地址(domain, creator, subject_id)
pub fn migrate_subject_funding(deceased_id: u64) -> DispatchResult {
    // 获取creator
    let creator = ...;
    
    // 旧地址
    let old_addr = (domain, deceased_id);
    // 新地址
    let new_addr = (domain, creator, deceased_id);
    
    // 转移余额
    let balance = Currency::free_balance(&old_addr);
    Currency::transfer(&old_addr, &new_addr, balance, ...)?;
    
    Ok(())
}
```

---

## 总结

### 方案优势

✅ **地址稳定**：基于不可变的creator，永久稳定  
✅ **充值扣费统一**：使用同一个地址，解决P0问题  
✅ **资金隔离**：不同creator有不同的资金账户  
✅ **权限合理**：owner可充值，creator决定地址  
✅ **向后兼容**：提供deprecated别名，逐步迁移  

### 工作量

- **Phase 1**（基础修改）：2小时
- **Phase 2**（测试验证）：1小时
- **Phase 3**（文档更新）：0.5小时
- **总计**：约3.5小时

### 优先级

🔴 **P0紧急**：解决充值与扣费地址不一致问题

---

**方案版本**: v2.0（基于creator派生）  
**创建时间**: 2025-10-24  
**作者**: Claude (Cursor AI)  
**状态**: ✅ 设计完成，建议立即实施

