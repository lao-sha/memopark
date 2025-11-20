# 合葬功能设计方案

## 一、需求分析

### 1.1 核心需求
- **一对一合葬**：每个逝者只能与一位其他逝者合葬
- **双向同意**：需要双方逝者拥有者的明确同意
- **发起-确认机制**：一方发起，另一方确认后生效
- **关系记录**：在deceased记录中保存合葬对象的deceased_id

### 1.2 用户场景
```
场景1：夫妻合葬
- 用户A（丈夫owner）发起与deceased_B（妻子）的合葬请求
- 用户B（妻子owner）收到通知，确认同意
- 系统建立双向合葬关系

场景2：父子合葬
- 用户C（父亲owner）希望与deceased_D（儿子）合葬
- 用户D（儿子owner）确认同意
- 完成合葬配置
```

---

## 二、可行性分析

### 2.1 技术可行性：✅ 高度可行

#### 存储结构扩展
```rust
pub struct Deceased<T: Config> {
    // ... 现有字段 ...
    
    /// 合葬关系
    /// - Some(deceased_id)：已与该逝者合葬
    /// - None：未合葬
    pub joint_burial_with: Option<T::DeceasedId>,
}
```

**优势**：
- ✅ 结构简单，仅增加一个Option字段
- ✅ 符合MaxEncodedLen约束（Option<DeceasedId>可编码）
- ✅ 存储成本低（仅8字节 + 1字节标识）

#### 请求管理
```rust
/// 合葬请求记录
pub struct JointBurialRequest<T: Config> {
    /// 发起者deceased_id
    pub initiator_deceased_id: T::DeceasedId,
    /// 目标deceased_id  
    pub target_deceased_id: T::DeceasedId,
    /// 发起者账户
    pub initiator: T::AccountId,
    /// 请求时间
    pub requested_at: BlockNumberFor<T>,
    /// 过期时间（30天）
    pub expires_at: BlockNumberFor<T>,
}
```

**实现方案**：
- ✅ 使用双键存储映射管理请求
- ✅ 自动过期机制防止请求堆积

---

### 2.2 业务合理性：⚠️ 需要约束

#### ✅ 合理的方面

1. **文化认同度高**
   - 符合东方传统：夫妻、父子、兄弟合葬习俗
   - 数字纪念的物理空间映射

2. **功能需求明确**
   - 家族树构建的基础
   - 纪念馆联动展示
   - 关系网络可视化

3. **权限设计合理**
   - 双向确认保护双方权益
   - 拥有者授权机制完善

#### ⚠️ 需要约束的风险

1. **重复合葬风险**
   ```
   问题：如果A已与B合葬，能否再与C合葬？
   方案：✅ 必须先解除原合葬关系
   ```

2. **单向操作风险**
   ```
   问题：一方想解除合葬，另一方不同意怎么办？
   方案：✅ 允许单方解除，但需冷静期（7天）
   ```

3. **逝者转让后的关系**
   ```
   问题：owner转让后，合葬关系是否保留？
   方案：✅ 保留，但新owner有权解除
   ```

4. **经济激励失衡**
   ```
   问题：合葬是否需要额外成本？
   方案：✅ 小额手续费（0.1 DUST）防止滥用
   ```

---

## 三、技术设计方案

### 3.1 数据结构

#### 主结构扩展
```rust
// pallets/deceased/src/lib.rs

pub struct Deceased<T: Config> {
    // ... 现有字段保持不变 ...
    
    /// 合葬伴侣的deceased_id（一对一）
    pub joint_burial_with: Option<T::DeceasedId>,
    
    /// 合葬建立时间（用于审计）
    pub joint_burial_since: Option<BlockNumberFor<T>>,
}
```

#### 请求管理
```rust
/// 合葬请求（待确认状态）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct JointBurialRequest<T: Config> {
    pub initiator_deceased_id: T::DeceasedId,
    pub target_deceased_id: T::DeceasedId,
    pub initiator_owner: T::AccountId,
    pub requested_at: BlockNumberFor<T>,
    pub expires_at: BlockNumberFor<T>,
}

/// 存储映射
#[pallet::storage]
pub type JointBurialRequests<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat, T::DeceasedId,  // 发起者deceased_id
    Blake2_128Concat, T::DeceasedId,  // 目标deceased_id
    JointBurialRequest<T>,
>;

/// 解除请求（单方发起，需冷静期）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct DissolveRequest<T: Config> {
    pub requester_deceased_id: T::DeceasedId,
    pub partner_deceased_id: T::DeceasedId,
    pub requested_at: BlockNumberFor<T>,
    pub effective_at: BlockNumberFor<T>,  // 7天冷静期
}

#[pallet::storage]
pub type DissolveRequests<T: Config> = StorageMap<
    _,
    Blake2_128Concat, T::DeceasedId,
    DissolveRequest<T>,
>;
```

---

### 3.2 核心Extrinsics

#### 1. 发起合葬请求
```rust
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::request_joint_burial())]
pub fn request_joint_burial(
    origin: OriginFor<T>,
    initiator_deceased_id: T::DeceasedId,
    target_deceased_id: T::DeceasedId,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 1. 权限检查
    let initiator = DeceasedRecords::<T>::get(initiator_deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    ensure!(initiator.owner == who, Error::<T>::NotAuthorized);
    
    let target = DeceasedRecords::<T>::get(target_deceased_id)
        .ok_or(Error::<T>::TargetDeceasedNotFound)?;
    
    // 2. 业务规则检查
    ensure!(
        initiator.joint_burial_with.is_none(),
        Error::<T>::AlreadyInJointBurial
    );
    ensure!(
        target.joint_burial_with.is_none(),
        Error::<T>::TargetAlreadyInJointBurial
    );
    ensure!(
        initiator_deceased_id != target_deceased_id,
        Error::<T>::CannotBurySelf
    );
    
    // 3. 检查是否已有待处理请求
    ensure!(
        !JointBurialRequests::<T>::contains_key(
            initiator_deceased_id, 
            target_deceased_id
        ),
        Error::<T>::RequestAlreadyExists
    );
    
    // 4. 创建请求（30天过期）
    let current_block = frame_system::Pallet::<T>::block_number();
    let request = JointBurialRequest {
        initiator_deceased_id,
        target_deceased_id,
        initiator_owner: who.clone(),
        requested_at: current_block,
        expires_at: current_block + T::RequestExpiryBlocks::get(),
    };
    
    JointBurialRequests::<T>::insert(
        initiator_deceased_id,
        target_deceased_id,
        request
    );
    
    Self::deposit_event(Event::JointBurialRequested {
        initiator_deceased_id,
        target_deceased_id,
        requester: who,
    });
    
    Ok(())
}
```

#### 2. 确认合葬请求
```rust
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::confirm_joint_burial())]
pub fn confirm_joint_burial(
    origin: OriginFor<T>,
    initiator_deceased_id: T::DeceasedId,
    target_deceased_id: T::DeceasedId,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 1. 获取请求
    let request = JointBurialRequests::<T>::get(
        initiator_deceased_id,
        target_deceased_id
    ).ok_or(Error::<T>::RequestNotFound)?;
    
    // 2. 权限检查（必须是目标deceased的owner）
    let target = DeceasedRecords::<T>::get(target_deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    ensure!(target.owner == who, Error::<T>::NotAuthorized);
    
    // 3. 检查过期
    let current_block = frame_system::Pallet::<T>::block_number();
    ensure!(
        current_block <= request.expires_at,
        Error::<T>::RequestExpired
    );
    
    // 4. 再次检查双方状态（防止竞态）
    let initiator = DeceasedRecords::<T>::get(initiator_deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    ensure!(
        initiator.joint_burial_with.is_none(),
        Error::<T>::AlreadyInJointBurial
    );
    ensure!(
        target.joint_burial_with.is_none(),
        Error::<T>::AlreadyInJointBurial
    );
    
    // 5. 建立双向合葬关系
    DeceasedRecords::<T>::mutate(initiator_deceased_id, |maybe_dec| {
        if let Some(dec) = maybe_dec {
            dec.joint_burial_with = Some(target_deceased_id);
            dec.joint_burial_since = Some(current_block);
        }
    });
    
    DeceasedRecords::<T>::mutate(target_deceased_id, |maybe_dec| {
        if let Some(dec) = maybe_dec {
            dec.joint_burial_with = Some(initiator_deceased_id);
            dec.joint_burial_since = Some(current_block);
        }
    });
    
    // 6. 删除请求
    JointBurialRequests::<T>::remove(initiator_deceased_id, target_deceased_id);
    
    // 7. 触发事件
    Self::deposit_event(Event::JointBurialEstablished {
        deceased_id_a: initiator_deceased_id,
        deceased_id_b: target_deceased_id,
        confirmer: who,
    });
    
    Ok(())
}
```

#### 3. 解除合葬关系
```rust
#[pallet::call_index(XX)]
#[pallet::weight(T::WeightInfo::dissolve_joint_burial())]
pub fn dissolve_joint_burial(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 1. 权限检查
    let deceased = DeceasedRecords::<T>::get(deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    ensure!(deceased.owner == who, Error::<T>::NotAuthorized);
    
    // 2. 检查合葬关系
    let partner_id = deceased.joint_burial_with
        .ok_or(Error::<T>::NotInJointBurial)?;
    
    // 3. 检查是否已有解除请求
    if let Some(existing) = DissolveRequests::<T>::get(deceased_id) {
        let current_block = frame_system::Pallet::<T>::block_number();
        
        // 冷静期已过，执行解除
        if current_block >= existing.effective_at {
            Self::execute_dissolution(deceased_id, partner_id)?;
            DissolveRequests::<T>::remove(deceased_id);
        } else {
            return Err(Error::<T>::DissolutionPending.into());
        }
    } else {
        // 创建解除请求（7天冷静期）
        let current_block = frame_system::Pallet::<T>::block_number();
        let request = DissolveRequest {
            requester_deceased_id: deceased_id,
            partner_deceased_id: partner_id,
            requested_at: current_block,
            effective_at: current_block + T::CoolingPeriodBlocks::get(),
        };
        
        DissolveRequests::<T>::insert(deceased_id, request);
        
        Self::deposit_event(Event::DissolutionRequested {
            requester_deceased_id: deceased_id,
            partner_deceased_id: partner_id,
            effective_at: current_block + T::CoolingPeriodBlocks::get(),
        });
    }
    
    Ok(())
}
```

---

### 3.3 配置参数

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 现有配置 ...
    
    /// 合葬请求过期时间（30天 = 432000区块，6秒/块）
    #[pallet::constant]
    type RequestExpiryBlocks: Get<BlockNumberFor<Self>>;
    
    /// 解除合葬冷静期（7天 = 100800区块）
    #[pallet::constant]
    type CoolingPeriodBlocks: Get<BlockNumberFor<Self>>;
}
```

---

### 3.4 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    // ... 现有事件 ...
    
    /// 合葬请求已发起
    JointBurialRequested {
        initiator_deceased_id: T::DeceasedId,
        target_deceased_id: T::DeceasedId,
        requester: T::AccountId,
    },
    
    /// 合葬关系已建立
    JointBurialEstablished {
        deceased_id_a: T::DeceasedId,
        deceased_id_b: T::DeceasedId,
        confirmer: T::AccountId,
    },
    
    /// 解除请求已发起（冷静期开始）
    DissolutionRequested {
        requester_deceased_id: T::DeceasedId,
        partner_deceased_id: T::DeceasedId,
        effective_at: BlockNumberFor<T>,
    },
    
    /// 合葬关系已解除
    JointBurialDissolved {
        deceased_id_a: T::DeceasedId,
        deceased_id_b: T::DeceasedId,
    },
    
    /// 合葬请求已过期
    JointBurialRequestExpired {
        initiator_deceased_id: T::DeceasedId,
        target_deceased_id: T::DeceasedId,
    },
}
```

---

### 3.5 错误定义

```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...
    
    /// 该逝者已在合葬关系中
    AlreadyInJointBurial,
    
    /// 目标逝者已在合葬关系中
    TargetAlreadyInJointBurial,
    
    /// 目标逝者不存在
    TargetDeceasedNotFound,
    
    /// 不能与自己合葬
    CannotBurySelf,
    
    /// 合葬请求已存在
    RequestAlreadyExists,
    
    /// 合葬请求不存在
    RequestNotFound,
    
    /// 合葬请求已过期
    RequestExpired,
    
    /// 该逝者未在合葬关系中
    NotInJointBurial,
    
    /// 解除请求处理中（冷静期）
    DissolutionPending,
}
```

---

## 四、风险控制与约束

### 4.1 业务规则约束

| 约束项 | 规则 | 实现方式 |
|-------|------|---------|
| **一对一关系** | 一个逝者只能与一位其他逝者合葬 | `joint_burial_with: Option<DeceasedId>` |
| **双向确认** | 双方owner必须都同意 | 请求-确认两阶段 |
| **请求过期** | 30天内未确认自动过期 | `expires_at`字段 + 清理机制 |
| **解除冷静期** | 单方解除需等待7天 | `DissolveRequest`存储 |
| **重复请求保护** | 同一对象不能重复发起 | `contains_key`检查 |
| **状态一致性** | 双向关系必须同步 | 原子性mutate操作 |

### 4.2 经济激励设计

```rust
// 可选：合葬手续费
pub fn request_joint_burial(
    origin: OriginFor<T>,
    // ...
) -> DispatchResult {
    // ...
    
    // 收取小额手续费（0.1 DUST）
    let fee = T::JointBurialFee::get();
    T::Currency::transfer(
        &who,
        &T::Treasury::get(),
        fee,
        ExistenceRequirement::KeepAlive
    )?;
    
    // ...
}
```

---

## 五、前端展示与交互

### 5.1 UI展示方案

```
逝者详情页：
┌─────────────────────────────────┐
│ 张三（1950-2020）               │
│ ⚭ 已与 李四 合葬                │
│   [查看伴侣纪念馆]              │
└─────────────────────────────────┘

合葬管理按钮：
- 未合葬：[发起合葬请求]
- 已发起：[取消请求]
- 待确认：[确认合葬] [拒绝]
- 已合葬：[申请解除]（7天冷静期）
```

### 5.2 通知机制

```javascript
// 事件监听示例
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    
    if (event.section === 'deceased') {
      if (event.method === 'JointBurialRequested') {
        const [initiator, target] = event.data;
        notifyUser(target, `收到来自 ${initiator} 的合葬请求`);
      }
      
      if (event.method === 'JointBurialEstablished') {
        const [idA, idB] = event.data;
        notifyBoth(idA, idB, '合葬关系已建立');
      }
    }
  });
});
```

---

## 六、实施路线图

### Phase 1: 核心功能（2周）
- ✅ Deceased结构扩展
- ✅ 请求-确认流程
- ✅ 基础事件和错误

### Phase 2: 风险控制（1周）
- ✅ 过期清理机制
- ✅ 冷静期实现
- ✅ 经济激励

### Phase 3: 前端集成（1周）
- ✅ UI组件开发
- ✅ 通知系统
- ✅ 关系可视化

### Phase 4: 测试与优化（1周）
- ✅ 单元测试
- ✅ 集成测试
- ✅ 压力测试

---

## 七、总结与建议

### ✅ 可行性结论
**技术上完全可行，业务上合理且有价值**

### 推荐实施
1. **优先级**：⭐⭐⭐⭐ (高)
   - 用户需求强烈
   - 实现成本适中
   - 风险可控

2. **关键成功因素**
   - ✅ 完善的权限校验
   - ✅ 清晰的状态管理
   - ✅ 友好的用户交互
   - ✅ 可靠的通知机制

3. **后续扩展方向**
   - 家族树可视化（基于合葬关系）
   - 合葬统计和推荐
   - 虚拟墓园布局（基于合葬关系排列）

### 需要注意的风险
1. ⚠️ 社会伦理：确保符合各地文化习俗
2. ⚠️ 隐私保护：合葬关系是否公开可见需要配置
3. ⚠️ 冲突处理：解除合葬的纠纷处理机制

---

**文档版本**: v1.0  
**创建日期**: 2025-11-18  
**作者**: Stardust Team  
**状态**: 待评审
