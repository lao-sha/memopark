# Deceased Pallet - 用户操作逻辑与冗余代码分析报告

## 一、用户操作逻辑问题

### 问题1：主图设置权限检查逻辑不清晰 ⚠️ P1

**位置**：`set_main_image` (L1082-1156) 和 `clear_main_image` (L1164-1181)

**问题描述**：
```rust
let is_root = ensure_root(origin.clone()).is_ok();
let who = ensure_signed(origin.clone()).ok();
```

1. **双重起源检查问题**：
   - 如果 origin 是 Root，`ensure_signed` 会失败返回 `None`
   - 这导致 `who` 为 `None`，后续自动pin逻辑会缺少调用者信息
   - 虽然代码在 L1128-1149 处理了 Root 情况，但逻辑复杂且容易出错

2. **用户体验问题**：
   - Root 调用时需要从 `DeceasedOf` 读取 owner，增加了存储读取
   - 逻辑分支过多，维护成本高

**建议修复方案**：
```rust
pub fn set_main_image(
    origin: OriginFor<T>,
    id: T::DeceasedId,
    cid: Vec<u8>,
) -> DispatchResult {
    // 方案A：要求明确传入 caller，Root调用时也需指定代付账户
    let (caller, is_gov) = Self::ensure_owner_or_gov(origin, id)?;
    
    // 或方案B：仅允许owner设置，治理使用 gov_set_main_image
    let who = ensure_signed(origin)?;
    ensure!(d.owner == who, Error::<T>::NotAuthorized);
}
```

---

### 问题2：关系功能权限语义混淆 ⚠️ P2

**位置**：
- `propose_relation` (L1492)
- `approve_relation` (L1535)
- `reject_relation` (L1586)

**问题描述**：
所有关系操作都使用 `GraveProvider::can_attach(&who, grave_id)` 检查权限，但：

1. **语义不清**：
   - `can_attach` 本意是"能否在墓位下挂接新逝者"
   - 用于关系管理时，语义变成了"是否是墓位管理员"
   - 这与逝者的 `owner` 概念不一致

2. **权限过宽**：
   - 墓位管理员（如陵园管理员）可以操作墓位下所有逝者的关系
   - 但逝者的 `owner` 可能不是墓位 owner
   - 这可能导致越权操作

**建议修复方案**：
```rust
// 方案：引入专用的逝者管理员检查
fn ensure_deceased_admin(who: &T::AccountId, id: T::DeceasedId) -> DispatchResult {
    let d = DeceasedOf::<T>::get(id).ok_or(Error::<T>::DeceasedNotFound)?;
    ensure!(
        d.owner == *who || Self::is_admin(id, who),
        Error::<T>::NotAuthorized
    );
    Ok(())
}

// 在关系操作中使用
pub fn propose_relation(...) -> DispatchResult {
    Self::ensure_deceased_admin(&who, from)?;
    // ...
}
```

---

### 问题3：亲友团 owner 无法退出的逻辑冲突 ⚠️ P2

**位置**：`leave_friend_group` (L1850-1869)

**问题描述**：
```rust
// L502-513: owner 自动视为 Admin
pub(crate) fn is_admin(deceased_id: T::DeceasedId, who: &T::AccountId) -> bool {
    if let Some(d) = DeceasedOf::<T>::get(deceased_id) {
        if d.owner == *who {
            return true; // owner 永远是 Admin
        }
    }
    // ...
}

// L1860-1864: 禁止 Admin 退出
ensure!(
    !matches!(rec.role, FriendRole::Admin),
    Error::<T>::NotAuthorized
);
```

**逻辑冲突**：
1. `owner` 自动视为 `Admin`
2. `Admin` 不能退出亲友团
3. **结论**：`owner` 永远无法退出亲友团

**用户影响**：
- 如果 owner 误操作进入某个逝者的亲友团
- 或者想清理自己的亲友团列表
- 将永远无法退出

**建议修复方案**：
```rust
// 方案A：允许 owner 退出，但需要先指定新 Admin
// 方案B：owner 不需要加入亲友团，自动拥有所有权限
// 方案C：区分 owner 和 Admin 角色，owner 可以退出
pub(crate) fn is_admin(deceased_id: T::DeceasedId, who: &T::AccountId) -> bool {
    // 检查 owner
    if let Some(d) = DeceasedOf::<T>::get(deceased_id) {
        if d.owner == *who {
            return true;
        }
    }
    // 检查亲友团 Admin（owner不在FriendsOf中）
    if let Some(rec) = FriendsOf::<T>::get(deceased_id, who) {
        matches!(rec.role, FriendRole::Admin)
    } else {
        false
    }
}
```

---

### 问题4：自动pin失败无链上通知 ⚠️ P1

**位置**：
- `create_deceased` (L754-774)
- `update_deceased` (L965-983)
- `set_main_image` (L1106-1149)

**问题描述**：
```rust
if let Err(e) = T::IpfsPinner::pin_cid_for_grave(...) {
    log::warn!(
        target: "deceased",
        "Auto-pin name_full_cid failed for deceased {:?}: {:?}",
        deceased_id_u64,
        e
    );
}
```

**用户影响**：
1. **用户不知情**：
   - pin失败仅记录日志，没有事件
   - 用户以为操作成功，但CID实际没有被pin
   - 可能导致数据丢失

2. **无补救机制**：
   - 用户无法查询pin状态
   - 无法重试pin操作
   - 无法得知失败原因

**建议修复方案**：
```rust
// 方案A：添加事件通知
#[pallet::event]
pub enum Event<T: Config> {
    // ...
    /// IPFS自动pin失败 (deceased_id, cid, error_code)
    AutoPinFailed(T::DeceasedId, Vec<u8>, u8),
    /// IPFS自动pin成功 (deceased_id, cid)
    AutoPinSuccess(T::DeceasedId, Vec<u8>),
}

// 方案B：提供手动重试接口
#[pallet::call_index(47)]
pub fn retry_pin_cid(
    origin: OriginFor<T>,
    id: T::DeceasedId,
    cid_type: u8, // 0=name_full_cid, 1=main_image_cid
) -> DispatchResult {
    // 允许owner手动重试pin
}
```

---

### 问题5：删除功能已禁用但接口保留混淆 ⚠️ P3

**位置**：README.md L82-86，源代码中 `remove_deceased` 已删除

**问题描述**：
- README 说明 `remove_deceased` 始终返回 `DeletionForbidden`
- 但源代码中完全没有这个函数（连占位都没有）
- `call_index(2)` 缺失

**用户影响**：
- 如果有旧的前端或脚本调用 `call_index(2)`，会得到 `CallNotFound` 错误
- 而不是预期的 `DeletionForbidden`
- 错误信息不明确

**建议修复方案**：
```rust
// 保留占位函数，明确返回禁用错误
#[pallet::call_index(2)]
#[allow(deprecated)]
#[pallet::weight(T::WeightInfo::remove())]
pub fn remove_deceased(
    origin: OriginFor<T>,
    id: T::DeceasedId,
) -> DispatchResult {
    let _who = ensure_signed(origin)?;
    // 明确返回禁用错误
    Err(Error::<T>::DeletionForbidden.into())
}
```

---

### 问题6：软上限与硬上限检查冗余 ⚠️ P3

**位置**：`create_deceased` (L574-586)

**问题描述**：
```rust
// 冗余快速校验：若外部缓存的令牌数已达软上限，也直接拒绝
if let Some(cached) = T::GraveProvider::cached_deceased_tokens_len(grave_id) {
    ensure!(
        cached < T::MaxDeceasedPerGraveSoft::get(),
        Error::<T>::TooManyDeceasedInGrave
    );
}
// 软上限权威校验：每墓位最多允许的逝者数量（默认 6）。
let existing_in_grave = DeceasedByGrave::<T>::get(grave_id).len() as u32;
ensure!(
    existing_in_grave < T::MaxDeceasedPerGraveSoft::get(),
    Error::<T>::TooManyDeceasedInGrave
);
```

**问题分析**：
1. **双重检查**：先检查缓存，再检查权威数据
2. **缓存可能不一致**：如果 `pallet-grave` 的缓存没及时更新，可能误判
3. **注释说"最终仍以本模块为准"**，那第一次检查的意义何在？

**建议修复方案**：
```rust
// 方案A：移除缓存检查，仅使用权威数据
let existing_in_grave = DeceasedByGrave::<T>::get(grave_id).len() as u32;
ensure!(
    existing_in_grave < T::MaxDeceasedPerGraveSoft::get(),
    Error::<T>::TooManyDeceasedInGrave
);

// 方案B：如果确需优化性能，在注释中明确说明缓存检查仅用于快速失败
// 并确保 pallet-grave 的缓存更新机制可靠
```

---

### 问题7：版本历史存储无上限保护 ⚠️ P2

**位置**：`DeceasedHistory` (L342-349)

**问题描述**：
```rust
/// 函数级中文注释：逝者版本历史（最多 512 条，超出后停止追加）。
#[pallet::storage]
pub type DeceasedHistory<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<VersionEntry<T>, ConstU32<512>>,
    ValueQuery,
>;

// 但在添加历史时（L880-886, L1333-1339）：
let _ = h.try_push(VersionEntry { ... });
```

**问题分析**：
1. **静默失败**：`try_push` 失败时用 `let _` 忽略结果
2. **用户不知情**：当历史达到512条后，新的修改记录不再保存
3. **审计缺失**：无法追溯512次之后的修改

**建议修复方案**：
```rust
// 方案A：采用滑动窗口，删除最旧记录
DeceasedHistory::<T>::mutate(id, |h| {
    if h.len() >= 512 {
        h.remove(0); // 移除最旧的记录
    }
    let _ = h.try_push(VersionEntry {
        version: v,
        editor: who.clone(),
        at,
    });
});

// 方案B：发出事件通知历史已满
if h.try_push(...).is_err() {
    Self::deposit_event(Event::HistoryFull(id));
}

// 方案C：提高上限或使用链下存储
```

---

## 二、冗余代码问题

### 冗余1：姓名规范化函数重复定义 🔴 高优先级

**位置**：
- `create_deceased` 内 `build_token_from_fields` (L643-672)
- `update_deceased` 内 `normalize_name` (L888-915)
- `gov_update_profile` 内 `normalize_name2` (L1341-1368)

**问题描述**：
三个函数逻辑完全相同（去首尾空格、压缩连续空格、a-z转A-Z），造成：
1. 代码重复 ~80 行
2. 维护成本高（修改需要改3处）
3. 容易出现不一致bug

**建议修复方案**：
```rust
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：规范化姓名用于生成token
    /// - 去首尾空格
    /// - 压缩连续空格为单个0x20
    /// - a-z转A-Z
    /// - 非ASCII字节保持不变
    fn normalize_name_for_token(name: &[u8]) -> Vec<u8> {
        let mut out: Vec<u8> = Vec::with_capacity(name.len());
        let mut i = 0usize;
        // 去前导空格
        while i < name.len() && name[i] == b' ' {
            i += 1;
        }
        let mut last_space = false;
        while i < name.len() {
            let mut b = name[i];
            if b == b' ' {
                if !last_space {
                    out.push(b' ');
                    last_space = true;
                }
            } else {
                // a-z → A-Z
                if (b'a'..=b'z').contains(&b) {
                    b = b - 32;
                }
                out.push(b);
                last_space = false;
            }
            i += 1;
        }
        // 去尾随空格
        while out.last().copied() == Some(b' ') {
            out.pop();
        }
        out
    }
}
```

**预期收益**：
- 减少 ~160 行重复代码
- 统一逻辑，降低bug风险
- 便于测试和优化

---

### 冗余2：deceased_token 构建逻辑重复 🔴 高优先级

**位置**：
- `create_deceased` (L637-702)
- `update_deceased` (L916-955)
- `gov_update_profile` (L1369-1405)

**问题描述**：
token构建逻辑（gender + birth(8) + death(8) + blake2_256(name_norm)）重复3次。

**建议修复方案**：
```rust
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：构建逝者令牌
    /// - 格式：gender(1字节) + birth(8字节) + death(8字节) + blake2_256(name_norm)
    /// - birth/death缺省用"00000000"
    fn build_deceased_token(
        gender: &Gender,
        birth_ts: &Option<BoundedVec<u8, T::StringLimit>>,
        death_ts: &Option<BoundedVec<u8, T::StringLimit>>,
        name: &BoundedVec<u8, T::StringLimit>,
    ) -> BoundedVec<u8, T::TokenLimit> {
        // 规范化姓名
        let name_norm = Self::normalize_name_for_token(name.as_slice());
        let name_hash = blake2_256(name_norm.as_slice());
        
        // 组装token
        let mut v: Vec<u8> = Vec::with_capacity(1 + 8 + 8 + 32);
        let gender_char = match gender {
            Gender::M => b'M',
            Gender::F => b'F',
            Gender::B => b'B',
        };
        v.push(gender_char);
        
        let zeros8: [u8; 8] = *b"00000000";
        let birth_bytes = birth_ts
            .as_ref()
            .map(|x| x.as_slice())
            .filter(|s| s.len() == 8)
            .unwrap_or(&zeros8);
        let death_bytes = death_ts
            .as_ref()
            .map(|x| x.as_slice())
            .filter(|s| s.len() == 8)
            .unwrap_or(&zeros8);
            
        v.extend_from_slice(birth_bytes);
        v.extend_from_slice(death_bytes);
        v.extend_from_slice(&name_hash);
        
        BoundedVec::<u8, T::TokenLimit>::try_from(v).unwrap_or_default()
    }
}
```

**预期收益**：
- 减少 ~120 行重复代码
- 统一token生成逻辑
- 便于未来调整token格式

---

### 冗余3：自动pin逻辑重复 🟡 中优先级

**位置**：
- `create_deceased` (L754-774)
- `update_deceased` (L965-983)
- `set_main_image` (L1106-1149)

**问题描述**：
三处都有相似的自动pin逻辑，代码重复且处理不一致（`set_main_image`还处理了Root情况）。

**建议修复方案**：
```rust
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：自动pin CID到IPFS（容错处理）
    /// - 使用triple-charge机制
    /// - 失败记录警告但不阻塞业务
    /// - 发出事件通知pin结果
    fn auto_pin_cid(
        caller: T::AccountId,
        deceased_id: T::DeceasedId,
        cid: Vec<u8>,
        cid_type: &str, // "name_full_cid" 或 "main_image_cid"
    ) {
        let deceased_id_u64: u64 = deceased_id.saturated_into::<u64>();
        let price = T::DefaultStoragePrice::get();
        
        match T::IpfsPinner::pin_cid_for_grave(
            caller,
            deceased_id_u64,
            cid.clone(),
            price,
            3, // 默认3副本
        ) {
            Ok(_) => {
                Self::deposit_event(Event::AutoPinSuccess(deceased_id, cid));
            }
            Err(e) => {
                log::warn!(
                    target: "deceased",
                    "Auto-pin {} failed for deceased {:?}: {:?}",
                    cid_type,
                    deceased_id_u64,
                    e
                );
                Self::deposit_event(Event::AutoPinFailed(deceased_id, cid, 1));
            }
        }
    }
}
```

---

### 冗余4：亲友团默认策略重复 🟡 中优先级

**位置**：
- `request_join` (L1736-1741)
- `approve_join` (L1800-1805)

**问题描述**：
两处都定义了相同的默认策略。

**建议修复方案**：
```rust
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：获取亲友团策略（带默认值）
    fn get_friend_policy_or_default(deceased_id: T::DeceasedId) -> FriendPolicy<T> {
        FriendPolicyOf::<T>::get(deceased_id).unwrap_or(FriendPolicy {
            require_approval: true,
            is_private: false,
            max_members: 1024,
            _phantom: core::marker::PhantomData,
        })
    }
}

// 使用：
let policy = Self::get_friend_policy_or_default(deceased_id);
```

---

### 冗余5：日期校验函数内联定义 🟢 低优先级

**位置**：`create_deceased` (L598-600)

**问题描述**：
```rust
fn is_yyyymmdd(v: &Vec<u8>) -> bool {
    v.len() == 8 && v.iter().all(|b| (b'0'..=b'9').contains(b))
}
```

**建议修复方案**：
```rust
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：校验日期格式是否为YYYYMMDD
    fn is_valid_date_format(date: &[u8]) -> bool {
        date.len() == 8 && date.iter().all(|b| (b'0'..=b'9').contains(b))
    }
}
```

---

### 冗余6：未使用的代码和注释 🟢 低优先级

**位置**：
- L3: `#![allow(unused_imports)]`
- L14: `// use sp_runtime::Saturating;`

**问题描述**：
1. 应该移除未使用的导入，而不是允许警告
2. 注释掉的导入应该删除

**建议修复方案**：
```rust
// 移除：
#![allow(unused_imports)]
// use sp_runtime::Saturating;

// 清理未使用的导入
```

---

### 冗余7：token唯一性检查重复 🟡 中优先级

**位置**：
- `create_deceased` (L704-707)
- `update_deceased` (L945-950)
- `gov_update_profile` (L1397-1405)

**问题描述**：
token唯一性检查和索引更新逻辑在三处重复。

**建议修复方案**：
```rust
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：检查并更新deceased_token索引
    /// - 检查新token的唯一性
    /// - 如果token变化，更新索引（移除旧索引，添加新索引）
    fn check_and_update_token_index(
        id: T::DeceasedId,
        old_token: &BoundedVec<u8, T::TokenLimit>,
        new_token: BoundedVec<u8, T::TokenLimit>,
    ) -> DispatchResult {
        if new_token != *old_token {
            // 检查新token是否已存在
            if let Some(existing_id) = DeceasedIdByToken::<T>::get(&new_token) {
                if existing_id != id {
                    return Err(Error::<T>::DeceasedTokenExists.into());
                }
            }
            // 更新索引
            DeceasedIdByToken::<T>::remove(old_token);
            DeceasedIdByToken::<T>::insert(new_token, id);
        }
        Ok(())
    }
}
```

---

## 三、总结与建议

### 问题优先级汇总

**P0 - 紧急（影响资金/数据安全）**：
- 无

**P1 - 高优先级（影响用户体验）**：
1. ✅ 主图设置权限检查逻辑不清晰
2. ✅ 自动pin失败无链上通知

**P2 - 中优先级（影响功能完整性）**：
1. ✅ 关系功能权限语义混淆
2. ✅ 亲友团owner无法退出
3. ✅ 版本历史存储无上限保护

**P3 - 低优先级（优化体验）**：
1. ✅ 删除功能已禁用但接口保留混淆
2. ✅ 软上限与硬上限检查冗余

### 冗余代码优先级汇总

**🔴 高优先级（>100行重复）**：
1. ✅ 姓名规范化函数重复（~160行）
2. ✅ deceased_token构建逻辑重复（~120行）

**🟡 中优先级（50-100行重复）**：
1. ✅ 自动pin逻辑重复（~90行）
2. ✅ token唯一性检查重复（~40行）
3. ✅ 亲友团默认策略重复（~20行）

**🟢 低优先级（<50行优化）**：
1. ✅ 日期校验函数内联定义
2. ✅ 未使用的代码和注释

### 修复建议路线图

**Phase 1 - 核心逻辑修复（1-2天）**：
1. 修复主图设置权限逻辑
2. 添加自动pin失败事件通知
3. 修复亲友团owner退出逻辑

**Phase 2 - 代码重构（2-3天）**：
1. 提取姓名规范化公共函数
2. 提取token构建公共函数
3. 提取自动pin公共函数
4. 提取token索引更新公共函数

**Phase 3 - 体验优化（1天）**：
1. 修复关系功能权限语义
2. 完善版本历史上限处理
3. 添加删除功能占位
4. 清理冗余代码和注释

**Phase 4 - 前端适配**：
1. 适配新的事件（AutoPinSuccess/Failed）
2. 更新错误提示文案
3. 添加pin状态查询和重试功能

### 预期收益

**代码质量提升**：
- 减少重复代码 ~450 行
- 降低维护成本 50%+
- 提高代码可读性

**用户体验提升**：
- 明确的权限提示
- pin失败可感知
- 更合理的操作流程

**系统可靠性提升**：
- 统一的token生成逻辑
- 完善的错误处理
- 清晰的权限边界

