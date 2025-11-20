# offer_by_sacrifice() 具体应用场景分析

**日期**: 2025-10-22  
**分析人**: AI助手  
**接口**: `pallet-memo-offerings::offer_by_sacrifice()`  
**相关Pallet**: `pallet-memo-sacrifice`, `pallet-stardust-pet`

---

## 一、接口设计初衷

### 1.1 为什么需要两种购买方式？

| 维度 | `offer()` | `offer_by_sacrifice()` |
|-----|----------|----------------------|
| **定位** | 标准供奉购买 | 商品目录购买 |
| **资金流向** | 多路分账（推荐/销毁/国库） | 直接转账（单一账户） |
| **商品管理** | 链端模板管理 | 目录化管理（UGC） |
| **适用场景** | 传统供奉（鲜花、蜡烛） | 商品化消费（宠物道具、VIP商品） |
| **复杂度** | 高（多次转账） | 低（单次转账） |
| **Gas费用** | 较高 | 较低 ✅ |

### 1.2 核心差异

**`offer_by_sacrifice()` 的独特优势**：

```rust
// 第1122行：接口定义
pub fn offer_by_sacrifice(
    origin: OriginFor<T>,
    target: (u8, u64),        // 目标（墓地/宠物）
    sacrifice_id: u64,        // 祭祀品ID（从目录选择）
    media: Vec<...>,          // 可选媒体
    duration_weeks: Option<u32>, // 可选时长
    is_vip: bool,             // 是否VIP会员 ✅
) -> DispatchResult
```

**关键特性**：
1. ✅ **VIP专属商品**（`is_vip_exclusive`）
2. ✅ **专属目标限制**（`exclusive_subjects`）
3. ✅ **消费效果回调**（`EffectConsumer`）
4. ✅ **目录化管理**（pallet-memo-sacrifice）
5. ✅ **更低Gas费用**（单次转账）

---

## 二、典型应用场景

### 场景1：宠物道具商店 🐾

**业务需求**：
- 用户为虚拟宠物购买食物、玩具、药品等道具
- 道具购买后**立即生效**（增加宠物属性）
- 追求**低Gas费用**（频繁购买）
- 不需要复杂分账（资金直接给宠物主人/平台）

**实施方案**：

```rust
// 祭祀品目录配置（memo-sacrifice）
SacrificeItem {
    id: 1001,
    name: "高级狗粮",
    fixed_price: Some(5_000_000_000_000), // 0.005 DUST
    is_vip_exclusive: false,
    exclusive_subjects: [],  // 所有宠物可用
    // 消费效果：增加宠物饱食度
    effect: Some(EffectSpec {
        consumable: true,      // 一次性消费品
        target_domain: 3,      // domain=3 (Pet)
        effect_kind: 1,        // 效果类型：饱食度
        effect_value: 20,      // +20 饱食度
        cooldown_secs: 0,      // 无冷却
        inventory_mint: false, // 不入库存，立即生效
    })
}
```

**购买流程**：
```
1. 用户调用：offer_by_sacrifice(origin, (3, pet_id), 1001, [], None, false)
2. 支付：0.005 DUST（会员3折 = 0.0015 DUST）
3. 转账：资金直接转入宠物主人账户
4. 效果触发：EffectConsumer::apply() → 宠物饱食度 +20
5. 完成：Gas费用最低 ✅
```

**优势**：
- ✅ 即买即用，用户体验好
- ✅ Gas费用低，适合频繁购买
- ✅ 效果立即生效，无需等待
- ✅ 前端可直接从目录展示商品

---

### 场景2：VIP专属商品 👑

**业务需求**：
- 平台提供VIP专属商品（高级鲜花、特殊装饰）
- 仅年费会员可购买
- 资金直接进入平台账户
- 无需推荐奖励分账

**实施方案**：

```rust
// VIP专属鲜花
SacrificeItem {
    id: 2001,
    name: "金色玫瑰（VIP专属）",
    fixed_price: Some(100_000_000_000_000), // 0.1 DUST
    is_vip_exclusive: true,  // ✅ 仅VIP可购买
    exclusive_subjects: [],
    effect: None, // 无特殊效果，仅展示
}
```

**购买流程**：
```
1. 检查会员状态：
   - is_vip = false → Error::NotAllowed ❌
   - is_vip = true → 继续 ✅

2. 支付：0.1 DUST × 30% (VIP折扣) = 0.03 DUST

3. 转账：资金直接进入目标账户（墓地管理者/平台）

4. 完成：无分账，流程简单
```

**优势**：
- ✅ 会员权益清晰
- ✅ 平台收益直接
- ✅ 无需复杂分账逻辑
- ✅ 前端展示"VIP专属"标签

---

### 场景3：限定墓地专属商品 🏛️

**业务需求**：
- 某些商品仅限特定墓地使用（如名人墓地专属鲜花）
- 其他墓地用户看不到该商品
- 资金直接给墓地管理者
- 体现墓地独特性

**实施方案**：

```rust
// 故宫名人墓地专属商品
SacrificeItem {
    id: 3001,
    name: "故宫御赐鲜花",
    fixed_price: Some(500_000_000_000_000), // 0.5 DUST
    is_vip_exclusive: false,
    exclusive_subjects: vec![
        (1, 10001), // domain=1 (Grave), id=10001（故宫墓地）
        (1, 10002), // domain=1 (Grave), id=10002（颐和园墓地）
    ],  // ✅ 仅限指定墓地
    effect: None,
}
```

**购买流程**：
```
1. 检查目标墓地：
   - target = (1, 10003) → Error::NotAllowed ❌（不在专属列表）
   - target = (1, 10001) → 继续 ✅（故宫墓地）

2. 支付：0.5 DUST

3. 转账：资金直接给墓地管理者

4. 完成：体现墓地独特性
```

**优势**：
- ✅ 墓地运营差异化
- ✅ 增加高端墓地吸引力
- ✅ 资金直接给墓地管理者，激励运营
- ✅ 前端可按墓地筛选商品

---

### 场景4：宠物养成道具（库存化） 📦

**业务需求**：
- 用户购买宠物道具后，道具进入宠物库存
- 用户可选择使用时机（非即时生效）
- 道具有冷却时间
- 追求低Gas费用

**实施方案**：

```rust
// 宠物治疗药水（库存化道具）
SacrificeItem {
    id: 4001,
    name: "生命药水",
    fixed_price: Some(10_000_000_000_000), // 0.01 DUST
    is_vip_exclusive: false,
    exclusive_subjects: [],
    effect: Some(EffectSpec {
        consumable: false,        // ❌ 非一次性（可入库存）
        target_domain: 3,         // domain=3 (Pet)
        effect_kind: 10,          // 效果类型：治疗
        effect_value: 50,         // +50 HP
        cooldown_secs: 3600,      // 冷却1小时
        inventory_mint: true,     // ✅ 入库存
    })
}
```

**购买流程**：
```
1. 用户调用：offer_by_sacrifice(origin, (3, pet_id), 4001, [], None, false)

2. 支付：0.01 DUST

3. 转账：资金给宠物主人/平台

4. 效果触发：EffectConsumer::apply()
   ├─ 检查：inventory_mint = true
   ├─ 行为：将道具存入宠物库存
   └─ 结果：用户可随时使用

5. 未来使用：
   - 用户调用 pallet_memo_pet::use_item(pet_id, item_id)
   - 检查冷却时间
   - 应用效果：Pet HP +50
```

**优势**：
- ✅ 玩法丰富，增加策略性
- ✅ 道具可交易（未来扩展）
- ✅ 冷却机制防止滥用
- ✅ 库存系统支持游戏化

---

### 场景5：快速消费品（免分账） 🚀

**业务需求**：
- 用户购买低价商品（如小额鲜花）
- 追求**极致低成本**（Gas费用最低）
- 平台不收取手续费
- 资金100%给墓地管理者

**实施方案**：

```rust
// 低价快速鲜花
SacrificeItem {
    id: 5001,
    name: "小雏菊（免手续费）",
    fixed_price: Some(1_000_000_000_000), // 0.001 DUST
    is_vip_exclusive: false,
    exclusive_subjects: [],
    effect: None,
}
```

**资金流向对比**：

| 方式 | Gas费用 | 资金流向 | 手续费 |
|-----|---------|---------|--------|
| `offer()` | ~5次转账 | 0.0002 → 墓地<br>0.0004 → 推荐<br>0.00002 → 存储<br>0.00008 → 国库<br>0.0003 → 销毁 | 80% 扣除 |
| `offer_by_sacrifice()` | ~1次转账 | **0.001 → 墓地** | 0% 扣除 ✅ |

**优势**：
- ✅ Gas费用降低80%
- ✅ 用户体验更好（快速确认）
- ✅ 墓地管理者收益最大化
- ✅ 适合高频小额场景

---

### 场景6：赛季限定商品 🎁

**业务需求**：
- 节假日推出限定商品（如春节特供鲜花）
- 限定时间内可购买
- 资金直接给平台（用于运营活动）
- 快速上架/下架

**实施方案**：

```rust
// 春节限定商品
SacrificeItem {
    id: 6001,
    name: "春节红包花束",
    fixed_price: Some(88_000_000_000_000), // 0.088 DUST（吉利数字）
    is_vip_exclusive: false,
    exclusive_subjects: [],
    status: SacrificeStatus::Enabled,  // ← 可快速切换为 Disabled
    effect: None,
}
```

**运营流程**：
```
1. 上架：pallet_memo_sacrifice::set_status(6001, Enabled)
   └─ 春节期间开放购买

2. 下架：pallet_memo_sacrifice::set_status(6001, Disabled)
   └─ 节日结束后关闭

3. 优势：
   - 无需修改代码
   - 链上治理快速调整
   - 前端自动响应状态变化
```

**优势**：
- ✅ 运营灵活（链上治理）
- ✅ 快速响应市场
- ✅ 前端无需更新
- ✅ 用户感知强（限时抢购）

---

## 三、技术实现细节

### 3.1 核心代码流程

```rust
// 第1122-1256行：offer_by_sacrifice() 完整流程

pub fn offer_by_sacrifice(
    origin: OriginFor<T>,
    target: (u8, u64),
    sacrifice_id: u64,
    media: Vec<(BoundedVec<u8, T::MaxCidLen>, Option<sp_core::H256>)>,
    duration_weeks: Option<u32>,
    is_vip: bool,
) -> DispatchResult {
    let who = ensure_signed(origin.clone())?;
    
    // 1️⃣ 暂停检查
    ensure!(!PausedGlobal::<T>::get(), Error::<T>::NotAllowed);
    if PausedByDomain::<T>::get(target.0) {
        return Err(Error::<T>::NotAllowed.into());
    }
    
    // 2️⃣ 目标存在性与权限校验
    ensure!(T::TargetCtl::exists(target), Error::<T>::TargetNotFound);
    T::TargetCtl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;
    
    // 3️⃣ 从目录读取商品信息
    let (fixed, unit, enabled, _vip_only, exclusive) =
        T::Catalog::spec_of(sacrifice_id).ok_or(Error::<T>::NotFound)?;
    ensure!(enabled, Error::<T>::NotFound);
    
    // 4️⃣ VIP权限校验
    ensure!(
        T::Catalog::can_purchase(&who, sacrifice_id, is_vip),
        Error::<T>::NotAllowed
    );
    
    // 5️⃣ 专属目标校验
    if !exclusive.is_empty() {
        ensure!(
            exclusive.iter().any(|pair| pair.0 == target.0 && pair.1 == target.1),
            Error::<T>::NotAllowed
        );
    }
    
    // 6️⃣ 限频检查（防刷）
    // ... 滑动窗口逻辑 ...
    
    // 7️⃣ 价格计算（含会员折扣）
    let original_price: u128 = if let Some(p) = fixed {
        p  // 固定价格
    } else {
        let u = unit.ok_or(Error::<T>::AmountRequired)?;
        let d = duration_weeks.ok_or(Error::<T>::DurationRequired)? as u128;
        u.saturating_mul(d)  // 单价 × 时长
    };
    
    // 会员折扣：30%（3折）
    let final_price = if T::MembershipProvider::is_valid_member(&who) {
        let discount_percent = T::MembershipProvider::get_discount() as u128;
        original_price.saturating_mul(discount_percent) / 100
    } else {
        original_price
    };
    
    // 8️⃣ 直接转账（单次，低Gas）
    let dest = T::DonationResolver::account_for(target);
    if final_price > 0 {
        let amt_balance: BalanceOf<T> = final_price.saturated_into();
        T::Currency::transfer(&who, &dest, amt_balance, ExistenceRequirement::KeepAlive)?;
    }
    
    // 9️⃣ 记录供奉
    let id = NextOfferingId::<T>::mutate(|n| {
        let id = *n;
        *n = n.saturating_add(1);
        id
    });
    let rec = OfferingRecord::<T> { /* ... */ };
    OfferingRecords::<T>::insert(id, &rec);
    
    // 🔟 触发Hook（推荐奖励等）
    let routed_simple = if final_price > 0 {
        alloc::vec![(dest.clone(), final_price)]
    } else {
        alloc::vec![]
    };
    T::OnOffering::on_offering(target, 0, &who, Some(final_price), duration_weeks, routed_simple);
    
    // ⓫ 消费效果回调（宠物道具生效）
    if let Some(effect) = T::Catalog::effect_of(sacrifice_id) {
        if effect.target_domain == target.0 {
            let _ = T::Consumer::apply(
                target,
                &OfferingRecords::<T>::get(id).unwrap().who,
                &effect,
            );
        }
    }
    
    Ok(())
}
```

### 3.2 关键差异对比

| 步骤 | `offer()` | `offer_by_sacrifice()` |
|-----|----------|----------------------|
| **商品来源** | 链端模板（OfferingSpec） | 目录化管理（SacrificeItem） |
| **VIP校验** | ❌ 无 | ✅ `is_vip_exclusive` + `can_purchase` |
| **专属目标** | ❌ 无 | ✅ `exclusive_subjects` |
| **转账次数** | 1-5次（多路分账） | 1次（直接转账） |
| **消费效果** | ❌ 无 | ✅ `EffectConsumer::apply()` |
| **Gas费用** | 高 | 低 ✅ |

---

## 四、前端集成建议

### 4.1 商品目录展示

```tsx
// 前端组件：祭祀品商店
<SacrificeShop>
  {/* 筛选器 */}
  <Filters>
    <CategoryFilter /> {/* 按类目筛选 */}
    <PriceFilter />    {/* 按价格筛选 */}
    <VipFilter />      {/* 仅VIP商品 */}
    <TargetFilter />   {/* 按目标筛选（宠物/墓地） */}
  </Filters>

  {/* 商品列表 */}
  <ProductList>
    {sacrifices.map(item => (
      <ProductCard key={item.id}>
        <Image src={item.resource_url} />
        <Title>{item.name}</Title>
        <Price>
          {item.fixed_price 
            ? `${formatMEMO(item.fixed_price)}`
            : `${formatMEMO(item.unit_price_per_week)}/周`
          }
        </Price>
        
        {/* VIP标签 */}
        {item.is_vip_exclusive && <Badge>VIP专属</Badge>}
        
        {/* 专属目标标签 */}
        {item.exclusive_subjects.length > 0 && (
          <Badge>限定墓地专属</Badge>
        )}
        
        {/* 效果预览 */}
        {item.effect && (
          <EffectPreview effect={item.effect} />
        )}
        
        {/* 购买按钮 */}
        <BuyButton onClick={() => buyWithSacrifice(item)} />
      </ProductCard>
    ))}
  </ProductList>
</SacrificeShop>
```

### 4.2 购买流程

```typescript
// 前端购买函数
async function buyWithSacrifice(
  targetType: number,    // 1=Grave, 3=Pet
  targetId: number,
  sacrificeId: number,
  isVip: boolean
) {
  try {
    const api = await getApi();
    
    // 1. 读取商品信息
    const item = await api.query.memoSacrifice.sacrificeOf(sacrificeId);
    if (!item) {
      throw new Error('商品不存在');
    }
    
    // 2. VIP校验（前端预检）
    if (item.is_vip_exclusive && !isVip) {
      Modal.error({ content: '该商品仅限VIP会员购买' });
      return;
    }
    
    // 3. 专属目标校验（前端预检）
    if (item.exclusive_subjects.length > 0) {
      const allowed = item.exclusive_subjects.some(
        ([d, id]) => d === targetType && id === targetId
      );
      if (!allowed) {
        Modal.error({ content: '该商品不适用于当前目标' });
        return;
      }
    }
    
    // 4. 计算价格（含会员折扣）
    let price = item.fixed_price;
    if (!price) {
      const weeks = prompt('请输入购买周数:');
      price = item.unit_price_per_week * parseInt(weeks);
    }
    
    if (isVip) {
      price = price * 0.3; // VIP 3折
    }
    
    // 5. 调用链上接口
    const tx = api.tx.memoOfferings.offerBySacrifice(
      [targetType, targetId],
      sacrificeId,
      [],           // media（可选）
      null,         // duration_weeks（可选）
      isVip
    );
    
    // 6. 签名并发送
    await tx.signAndSend(account, (result) => {
      if (result.status.isInBlock) {
        Message.success('购买成功！');
        
        // 7. 刷新宠物状态（如果是宠物道具）
        if (targetType === 3 && item.effect) {
          refreshPetStatus(targetId);
        }
      }
    });
  } catch (error) {
    console.error('购买失败:', error);
    Message.error(`购买失败: ${error.message}`);
  }
}
```

---

## 五、与 offer() 的选择建议

### 5.1 决策树

```
购买供奉商品？
    ├─ 需要推荐奖励分成？
    │   ├─ 是 → 使用 offer() ✅
    │   └─ 否 → 继续判断
    │
    ├─ 需要销毁MEMO（通缩）？
    │   ├─ 是 → 使用 offer() ✅
    │   └─ 否 → 继续判断
    │
    ├─ 追求极致低成本？
    │   ├─ 是 → 使用 offer_by_sacrifice() ✅
    │   └─ 否 → 继续判断
    │
    ├─ 需要VIP专属/专属目标？
    │   ├─ 是 → 使用 offer_by_sacrifice() ✅
    │   └─ 否 → 继续判断
    │
    ├─ 需要消费效果（宠物道具）？
    │   ├─ 是 → 使用 offer_by_sacrifice() ✅
    │   └─ 否 → 继续判断
    │
    └─ 需要目录化管理（UGC商品）？
        ├─ 是 → 使用 offer_by_sacrifice() ✅
        └─ 否 → 使用 offer() ✅（标准流程）
```

### 5.2 典型场景总结

| 场景 | 推荐方式 | 原因 |
|-----|---------|------|
| **标准鲜花供奉** | `offer()` | 需要推荐奖励、销毁机制 |
| **宠物道具购买** | `offer_by_sacrifice()` | 需要消费效果、低成本 |
| **VIP专属商品** | `offer_by_sacrifice()` | VIP权限校验 |
| **限定墓地商品** | `offer_by_sacrifice()` | 专属目标限制 |
| **小额快速消费** | `offer_by_sacrifice()` | 追求低Gas费用 |
| **赛季限定商品** | `offer_by_sacrifice()` | 灵活上下架 |
| **UGC商品（未来）** | `offer_by_sacrifice()` | 目录化管理 |

---

## 六、未来扩展方向

### 6.1 当前限制

目前 `EffectConsumer` 是占位实现（`NoopConsumer`），消费效果功能**尚未完全激活**：

```rust
// runtime/src/configs/mod.rs 第1000-1009行
pub struct NoopConsumer;
impl pallet_memo_offerings::pallet::EffectConsumer<AccountId> for NoopConsumer {
    fn apply(
        _target: (u8, u64),
        _who: &AccountId,
        _effect: &pallet_memo_offerings::pallet::EffectSpec,
    ) -> DispatchResult {
        Ok(())  // ← 占位实现，不做任何事
    }
}
```

### 6.2 完整宠物系统实施

**步骤1：扩展 pallet-stardust-pet**

```rust
// pallets/stardust-pet/src/lib.rs

#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub struct PetStats {
    pub hunger: u8,       // 饱食度（0-100）
    pub happiness: u8,    // 快乐度（0-100）
    pub health: u8,       // 健康值（0-100）
    pub level: u8,        // 等级
    pub exp: u32,         // 经验值
}

#[pallet::storage]
pub type PetStatsOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, PetStats, OptionQuery>;

// 道具库存
#[pallet::storage]
pub type PetInventory<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat, u64,      // pet_id
    Blake2_128Concat, u64,      // item_id
    u32,                        // quantity
    ValueQuery
>;

// 使用道具接口
#[pallet::call_index(3)]
pub fn use_item(
    origin: OriginFor<T>,
    pet_id: u64,
    item_id: u64,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let pet = PetOf::<T>::get(pet_id).ok_or(Error::<T>::NotFound)?;
    ensure!(pet.owner == who, Error::<T>::NotOwner);
    
    // 检查库存
    let qty = PetInventory::<T>::get(pet_id, item_id);
    ensure!(qty > 0, Error::<T>::NoItem);
    
    // 读取道具效果
    let effect = EffectOf::<T>::get(item_id).ok_or(Error::<T>::NotFound)?;
    
    // 应用效果
    PetStatsOf::<T>::try_mutate(pet_id, |maybe_stats| -> DispatchResult {
        let stats = maybe_stats.as_mut().ok_or(Error::<T>::NotFound)?;
        
        match effect.effect_kind {
            1 => stats.hunger = (stats.hunger + effect.effect_value as u8).min(100), // 饱食度
            2 => stats.happiness = (stats.happiness + effect.effect_value as u8).min(100), // 快乐度
            10 => stats.health = (stats.health + effect.effect_value as u8).min(100), // 治疗
            _ => {}
        }
        
        Ok(())
    })?;
    
    // 扣除库存
    PetInventory::<T>::mutate(pet_id, item_id, |qty| *qty = qty.saturating_sub(1));
    
    Self::deposit_event(Event::ItemUsed(pet_id, item_id));
    Ok(())
}
```

**步骤2：实现 EffectConsumer**

```rust
// runtime/src/configs/mod.rs

pub struct PetEffectConsumer;
impl pallet_memo_offerings::pallet::EffectConsumer<AccountId> for PetEffectConsumer {
    fn apply(
        target: (u8, u64),
        who: &AccountId,
        effect: &pallet_memo_offerings::pallet::EffectSpec,
    ) -> frame_support::dispatch::DispatchResult {
        // 仅处理宠物域（domain=3）
        if target.0 != 3 {
            return Ok(());
        }
        
        let pet_id = target.1;
        
        // 检查宠物所有权
        let pet = pallet_memo_pet::PetOf::<Runtime>::get(pet_id)
            .ok_or(frame_support::dispatch::DispatchError::Other("PetNotFound"))?;
        ensure!(pet.owner == *who, frame_support::dispatch::DispatchError::Other("NotOwner"));
        
        // 根据 consumable 决定行为
        if effect.consumable {
            // 一次性消费品：立即生效
            pallet_memo_pet::PetStatsOf::<Runtime>::try_mutate(pet_id, |maybe_stats| -> DispatchResult {
                let stats = maybe_stats.as_mut()
                    .ok_or(frame_support::dispatch::DispatchError::Other("StatsNotFound"))?;
                
                match effect.effect_kind {
                    1 => stats.hunger = (stats.hunger as i32 + effect.effect_value).clamp(0, 100) as u8,
                    2 => stats.happiness = (stats.happiness as i32 + effect.effect_value).clamp(0, 100) as u8,
                    10 => stats.health = (stats.health as i32 + effect.effect_value).clamp(0, 100) as u8,
                    _ => {}
                }
                
                Ok(())
            })?;
        } else {
            // 库存道具：添加到库存
            if effect.inventory_mint {
                pallet_memo_pet::PetInventory::<Runtime>::mutate(pet_id, effect.effect_kind as u64, |qty| {
                    *qty = qty.saturating_add(1);
                });
            }
        }
        
        Ok(())
    }
}

// 在 pallet-memo-offerings 配置中替换
impl pallet_memo_offerings::Config for Runtime {
    // ... 其他配置 ...
    type Consumer = PetEffectConsumer;  // ← 替换为真实实现
}
```

### 6.3 UGC商品上架（用户生成内容）

**未来方向**：允许用户自主创建和上架商品

```rust
// 用户创建祭祀品
pallet_memo_sacrifice::request_listing(
    origin,
    name: "我的手工鲜花".into(),
    resource_url: "ipfs://...".into(),
    description: "手工制作的纪念花束".into(),
    fixed_price: Some(50_000_000_000_000), // 0.05 DUST
    is_vip_exclusive: false,
    exclusive_subjects: vec![], // 所有人可购买
)

// 押金：0.01 DUST（ListingDeposit）
// 状态：Pending（待审批）

// 内容委员会审批
pallet_memo_sacrifice::approve_listing(origin, sacrifice_id)
// 状态：Approved
// 押金退回
```

**优势**：
- ✅ 去中心化内容生态
- ✅ 创作者经济（UGC收益）
- ✅ 丰富商品种类
- ✅ 降低运营成本

---

## 七、总结

### 7.1 核心价值

`offer_by_sacrifice()` 是 Stardust 供奉系统的**轻量级补充**，专注于：

1. **商品化消费**：从"供奉"到"商店"的语义转变
2. **游戏化体验**：宠物道具、效果系统
3. **运营灵活性**：VIP专属、限定商品、目录管理
4. **成本优化**：单次转账，Gas费用最低
5. **未来扩展**：UGC内容、创作者经济

### 7.2 适用场景总结

| 场景 | 是否适用 | 原因 |
|-----|---------|------|
| 🐾 **宠物道具购买** | ✅✅✅ | 消费效果 + 低成本 + 游戏化 |
| 👑 **VIP专属商品** | ✅✅✅ | 会员权益 + 权限校验 |
| 🏛️ **限定墓地商品** | ✅✅✅ | 专属目标 + 运营差异化 |
| 📦 **道具库存系统** | ✅✅✅ | 消费效果 + 库存管理 |
| 🚀 **快速小额消费** | ✅✅✅ | 低Gas + 100%收益 |
| 🎁 **赛季限定商品** | ✅✅✅ | 灵活上下架 + 目录管理 |
| 🌸 **标准鲜花供奉** | ⚠️ | 建议用 `offer()`（需推荐奖励） |
| 💎 **高价值供奉** | ⚠️ | 建议用 `offer()`（需审计分账） |

### 7.3 与 offer() 的互补关系

```
┌──────────────────────────────────────────┐
│         Stardust 供奉生态系统            │
└──────────────────────────────────────────┘
            │
            ├─ offer()
            │   ├─ 标准供奉（鲜花、蜡烛）
            │   ├─ 多路分账（推荐/销毁/国库）
            │   ├─ 联盟计酬集成
            │   └─ 平台生态价值流转
            │
            └─ offer_by_sacrifice()
                ├─ 商品化消费（宠物道具、VIP商品）
                ├─ 直接转账（低成本）
                ├─ 消费效果系统
                └─ 游戏化/运营化场景
```

**两者不是竞争关系，而是互补关系**：
- `offer()`：生态基础设施（价值流转、经济模型）
- `offer_by_sacrifice()`：业务场景扩展（游戏化、运营化）

---

## 八、常见问题（FAQ）

### Q1：为什么不统一使用 offer()？

**A**：`offer()` 的多路分账虽然强大，但并非所有场景都需要。`offer_by_sacrifice()` 提供了：
- ✅ 更低的Gas费用（适合高频小额）
- ✅ VIP专属/专属目标（运营差异化）
- ✅ 消费效果系统（游戏化）
- ✅ 目录化管理（UGC扩展）

### Q2：消费效果功能何时上线？

**A**：目前 `EffectConsumer` 是占位实现（NoopConsumer）。完整宠物系统上线后，消费效果功能将激活。
预计时间：宠物养成功能Phase 2（待规划）

### Q3：用户能自主上架商品吗？

**A**：可以！通过 `pallet-memo-sacrifice::request_listing()` 提交商品，内容委员会审批后即可上架。
- 押金：0.01 DUST
- 审批通过：押金退回
- 审批拒绝：10%划转国库，其余退回

### Q4：专属目标如何设置？

**A**：在创建祭祀品时，配置 `exclusive_subjects` 字段：
```rust
exclusive_subjects: vec![
    (1, 10001), // 仅限墓地ID=10001
    (3, 20001), // 仅限宠物ID=20001
]
```

空列表表示所有目标可用。

### Q5：会员折扣如何应用？

**A**：两种方式都支持会员折扣（30%）：
- `offer()`：自动检查会员状态，应用折扣
- `offer_by_sacrifice()`：同上

会员折扣在价格计算阶段应用，与分账逻辑解耦。

---

**分析完成！** 🎉

`offer_by_sacrifice()` 是 Stardust 生态的重要补充，专注于**游戏化、商品化、运营化**场景，与标准 `offer()` 形成互补，共同构建丰富的供奉生态系统！

