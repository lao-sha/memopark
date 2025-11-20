# Pallet Memorial

## 模块概述

**pallet-memorial** 是一个统一纪念服务系统（精简版 + 增强版），整合了原有纪念服务的核心功能，提供祭祀品管理和供奉业务的完整解决方案。该pallet现在同时支持原有的简化系统和新增的增强系统，满足不同复杂度的业务需求。

### 设计理念

- **精简**：移除60%冗余功能，保留所有核心业务
- **高效**：降低70%使用复杂度，优化存储和计算
- **易用**：简化的API设计，减少用户操作步骤
- **可扩展**：增强系统支持复杂的定价策略和分类体系
- **双模式**：通过 `UseEnhancedSystem` 开关控制使用简化版还是增强版

## 核心功能

### 0. 双模式系统

该pallet支持两种运行模式，通过 `UseEnhancedSystem` 存储项控制：

- **简化模式（UseEnhancedSystem = false）**：使用原有的简单分类和定价系统
- **增强模式（UseEnhancedSystem = true）**：启用增强的分类体系、定价策略和纪念馆主页功能

#### 系统切换

| 函数 | 权限 | 描述 |
|-----|------|-----|
| `set_enhanced_mode` | AdminOrigin | 设置是否使用增强系统 |

### 1. 祭祀品目录管理（4个函数）

祭祀品目录是预定义的虚拟商品，用户可通过目录快速下单供奉。

#### 1.1 祭祀品属性

- **基础信息**：名称、资源URL、描述
- **定价策略**：
  - `fixed_price`：一次性商品（如：一束花）
  - `unit_price_per_week`：计时商品（如：每周香火费）
- **场景分类**：
  - `0` = Grave（墓碑）
  - `1` = Pet（宠物）
  - `2` = Park（陵园）
  - `3` = Memorial（纪念馆）
- **类目分类**：
  - `0` = Flower（鲜花）
  - `1` = Candle（蜡烛）
  - `2` = Food（食物）
  - `3` = Toy（玩具）
  - `4` = Other（其他）
- **VIP专属**：`is_vip_exclusive` 标识是否仅会员可购买
- **状态控制**：
  - `Enabled`（启用）
  - `Disabled`（禁用）
  - `Hidden`（隐藏）

#### 1.2 管理接口

| 函数 | 权限 | 描述 |
|-----|------|-----|
| `create_sacrifice` | AdminOrigin | 创建祭祀品 |
| `update_sacrifice` | AdminOrigin | 更新祭祀品信息 |
| `set_sacrifice_status` | AdminOrigin | 设置祭祀品状态 |

### 2. 供奉业务管理（9个函数）

供奉是用户向目标（逝者、宠物等）献上虚拟物品的核心业务。

#### 2.1 供奉品规格（OfferingSpec）

供奉品规格定义了供奉类型的元数据：

- **kind_code**：供奉品类型代码（u8）
- **name**：供奉品名称
- **media_schema_cid**：媒体schema的IPFS CID（用于前端渲染）
- **enabled**：是否启用
- **kind**：供奉品类型
  - `Instant`：即时型（一次性，如：点蜡烛）
  - `Timed`：计时型（按周计费，如：供奉鲜花）
    - `min`：最小周数
    - `max`：最大周数（Option）
    - `can_renew`：是否可续费

#### 2.2 供奉记录（OfferingRecord）

每次供奉都会生成一条链上记录：

```rust
{
  who: AccountId,              // 供奉者
  target: (u8, u64),           // 目标（domain, id）
  kind_code: u8,               // 供奉品类型
  amount: u128,                // 实际支付金额（含会员折扣）
  media: Vec<MediaItem>,       // 媒体列表（IPFS CID）
  duration: Option<u32>,       // 时长（周数，仅Timed类型）
  time: BlockNumber,           // 供奉时间
}
```

#### 2.3 供奉流程

##### 2.3.1 通过供奉品规格下单（`offer`）

```
1. 验证暂停状态（全局 + 按域）
2. 检查供奉品规格（是否存在、是否启用）
3. 验证目标存在性和权限
4. 校验时长策略（Instant 不允许时长，Timed 必须提供时长）
5. 限频控制（账户级 + 目标级）
6. 计算价格（含会员折扣）
7. 简化分账转账
8. 创建供奉记录并索引
9. 调用回调（OnOfferingCommitted）
10. 发出事件（OfferingCommitted）
```

##### 2.3.2 通过祭祀品目录下单（`offer_by_sacrifice`）

```
1. 验证暂停状态（全局 + 按域）
2. 验证目标存在性和权限
3. 检查祭祀品（是否存在、是否启用）
4. VIP检查（如果是VIP专属，用户必须是会员）
5. 限频控制（账户级 + 目标级）
6. 计算价格（fixed_price 或 unit_price_per_week * duration）
7. 应用会员折扣
8. 简化分账转账
9. 创建供奉记录（kind_code=0）
10. 调用回调（OnOfferingCommitted）
11. 发出事件（OfferingCommittedBySacrifice）
```

#### 2.4 会员折扣

- **折扣来源**：通过 `MembershipProvider` trait 获取
- **默认折扣**：20%（即2折）
- **应用时机**：在计算价格后，转账前应用

#### 2.5 限频控制

为防止供奉滥用，实现了双层限频机制：

- **账户级限频**：单个账户在时间窗口内的供奉次数限制
- **目标级限频**：单个目标在时间窗口内接收供奉次数限制
- **配置参数**：
  - `OfferWindow`：时间窗口大小（块数）
  - `OfferMaxInWindow`：窗口内最多供奉次数
  - `MinOfferAmount`：最小供奉金额

#### 2.6 简化的分账路由

供奉金额分配到两个账户：

- **subject_percent**：目标账户分成（默认80%）
- **platform_percent**：平台账户分成（默认20%）

#### 2.7 用户接口

| 函数 | 权限 | 描述 |
|-----|------|-----|
| `offer` | Signed | 通过供奉品规格下单 |
| `offer_by_sacrifice` | Signed | 通过祭祀品目录下单 |

#### 2.8 管理接口

| 函数 | 权限 | 描述 |
|-----|------|-----|
| `create_offering` | AdminOrigin | 创建供奉品规格 |
| `update_offering` | AdminOrigin | 更新供奉品规格 |
| `set_offering_enabled` | AdminOrigin | 启用/禁用供奉品 |
| `set_offering_price` | AdminOrigin | 设置供奉品定价 |
| `set_offer_params` | AdminOrigin | 设置风控参数 |
| `set_pause_global` | AdminOrigin | 设置全局暂停 |
| `set_pause_domain` | AdminOrigin | 设置按域暂停 |
| `set_route_config` | AdminOrigin | 设置分账配置 |

### 3. 增强系统功能（纪念馆主页系统）

当 `UseEnhancedSystem = true` 时，启用以下增强功能：

#### 3.1 增强的分类体系

##### 主要分类（一级分类）

增强系统支持更精细的商品分类：

| 分类 | 代码 | 描述 | 适用场景 |
|-----|------|-----|---------|
| Flowers | 0 | 鲜花类 | 白花、黄花、花束、花圈 |
| Incense | 1 | 香烛类 | 白蜡烛、红蜡烛、香、香炉 |
| Foods | 2 | 食品供品 | 水果、点心、酒类、茶类 |
| PaperMoney | 3 | 纸钱冥币 | 纸钱、金银元宝、冥币 |
| PersonalItems | 4 | 个人用品 | 衣物、饰品、生活用品 |
| TraditionalOfferings | 5 | 传统祭品 | 三牲、供桌用品 |
| ModernMemorials | 6 | 现代纪念品 | 照片、音响、电子产品 |
| DigitalMemorials | 7 | 数字纪念品 | NFT、数字相册 |
| Services | 8 | 服务类 | 清洁、维护、代祭服务 |

##### 细分分类（二级分类）

每个主要分类下包含更精细的子分类，例如：

**鲜花类**：
- WhiteFlowers（白花）
- YellowFlowers（黄花）
- FlowerBouquets（花束组合）
- Wreaths（花圈）

**香烛类**：
- WhiteCandles（白蜡烛）
- RedCandles（红蜡烛）
- Incense（香）
- IncenseBurners（香炉）

#### 3.2 场景标签系统

支持按使用场景分类商品：

| 场景标签 | 描述 | 适用情况 |
|---------|------|---------|
| Memorial | 纪念馆场景 | 公共纪念场所 |
| Grave | 墓地场景 | 个人墓地祭扫 |
| Home | 家庭场景 | 家中供奉 |
| Festival | 节日场景 | 清明、中元节等 |
| Anniversary | 纪念日 | 忌日、生日纪念 |

#### 3.3 文化标签系统

支持不同文化背景的祭祀习俗：

| 文化标签 | 描述 | 特色商品 |
|---------|------|---------|
| Chinese | 中华文化 | 纸钱、香烛、三牲 |
| Western | 西方文化 | 鲜花、蜡烛 |
| Buddhist | 佛教文化 | 莲花、香、供果 |
| Christian | 基督教文化 | 十字架、百合花 |
| Modern | 现代文化 | 数字纪念品、环保商品 |

#### 3.4 高级定价策略

##### 定价模式

```rust
pub enum PricingModel {
    Fixed(u128),                    // 固定价格
    Tiered(Vec<(u32, u128)>),      // 阶梯定价
    Dynamic(u128, u128),           // 动态定价（基础价格，浮动范围）
    Subscription(u128, u32),        // 订阅定价（按周价格，订阅周数）
    Bundle(Vec<(u64, u32)>),       // 套餐定价
}
```

##### 用户类型差别定价

支持根据用户类型设置不同价格：

| 用户类型 | 描述 | 折扣 |
|---------|------|------|
| Regular | 普通用户 | 无折扣 |
| VIP | VIP会员 | 8折 |
| Family | 家属认证 | 9折 |
| Bulk | 批量购买 | 7折 |

#### 3.5 库存管理

增强系统支持商品库存控制：

```rust
// 库存相关存储
SacrificeStock<T>: StorageMap<u64, i32>  // 商品ID -> 库存数量
```

**库存功能**：
- 支持有限库存商品（限量商品）
- 支持无限库存商品（虚拟商品）
- 自动库存扣减
- 库存预警功能

#### 3.6 用户购买限制

防止用户过度购买或刷单：

```rust
UserPurchaseCount<T>: StorageDoubleMap<AccountId, u64, u32>
```

**限制类型**：
- 每用户每商品购买数量限制
- 时间窗口内购买频率限制
- VIP专属商品访问控制

#### 3.7 增强商品索引

为了支持纪念馆主页的高效查询，增强系统提供多维度索引：

```rust
SacrificesByPrimaryCategory<T>   // 按主分类索引
SacrificesBySubCategory<T>       // 按子分类索引
SacrificesBySceneTag<T>          // 按场景标签索引
```

#### 3.8 增强商品管理接口

| 函数 | 权限 | 描述 |
|-----|------|-----|
| `create_enhanced_sacrifice` | AdminOrigin | 创建增强祭祀品 |
| `update_enhanced_sacrifice` | AdminOrigin | 更新增强祭祀品 |
| `set_enhanced_sacrifice_stock` | AdminOrigin | 设置商品库存 |
| `set_enhanced_sacrifice_pricing` | AdminOrigin | 设置复杂定价策略 |
| `add_sacrifice_to_category` | AdminOrigin | 将商品添加到分类索引 |
| `remove_sacrifice_from_category` | AdminOrigin | 从分类索引移除商品 |

### 4. 批量供奉功能（已临时禁用）

> 🚧 2025-10-28 `batch_offer` 功能已临时禁用（DecodeWithMemTracking trait bound 问题）
> 
> 用户可以通过多次调用 `offer` 或 `offer_by_sacrifice` 达到相同效果。

**批量供奉优化目标**：

- 单次交易提交多个供奉，节省Gas成本30-50%
- 减少用户操作次数，提升用户体验

**Gas优化点**：

- 权限验证：1次（vs. N次）
- 目标检查：1次（vs. N次）
- 转账：1次大额（vs. N次小额）
- 存储写入：批量（vs. N次单独写入）
- 事件发射：1次（vs. N次）

## 外部依赖 Traits

### 1. TargetControl

用于验证供奉目标的存在性和权限。

```rust
pub trait TargetControl<Origin, AccountId> {
    fn exists(target: (u8, u64)) -> bool;
    fn ensure_allowed(origin: Origin, target: (u8, u64)) -> DispatchResult;
}
```

### 2. OnOfferingCommitted

供奉完成后的回调接口，供其他模块（如 `pallet-ledger`）记录供奉统计。

```rust
pub trait OnOfferingCommitted<AccountId> {
    fn on_offering(
        target: (u8, u64),
        kind_code: u8,
        who: &AccountId,
        amount: u128,
        duration_weeks: Option<u32>,
    );
}
```

### 3. MembershipProvider

会员信息提供者，用于检查会员状态和获取折扣。

```rust
pub trait MembershipProvider<AccountId> {
    fn is_valid_member(who: &AccountId) -> bool;
    fn get_discount() -> u8;
}
```

## 数据结构

### 存储项

#### 基础存储项

| 存储 | 类型 | 描述 |
|-----|------|-----|
| `NextSacrificeId` | `u64` | 下一个祭祀品ID |
| `SacrificeOf` | `StorageMap<u64, SacrificeItem>` | 祭祀品信息 |
| `NextOfferingId` | `u64` | 下一个供奉ID |
| `Specs` | `StorageMap<u8, OfferingSpec>` | 供奉品规格 |
| `FixedPriceOf` | `StorageMap<u8, u128>` | 供奉品固定定价 |
| `UnitPricePerWeekOf` | `StorageMap<u8, u128>` | 供奉品按周单价 |
| `OfferingRecords` | `StorageMap<u64, OfferingRecord>` | 供奉记录 |
| `OfferingsByTarget` | `StorageMap<(u8, u64), BoundedVec<u64>>` | 按目标索引的供奉记录 |
| `OfferWindowParam` | `BlockNumber` | 供奉限频窗口大小 |
| `OfferMaxInWindowParam` | `u32` | 窗口内最多供奉次数 |
| `MinOfferAmountParam` | `u128` | 最小供奉金额 |
| `OfferRate` | `StorageMap<AccountId, (BlockNumber, u32)>` | 账户级限频计数 |
| `OfferRateByTarget` | `StorageMap<(u8, u64), (BlockNumber, u32)>` | 目标级限频计数 |
| `PausedGlobal` | `bool` | 全局暂停开关 |
| `PausedByDomain` | `StorageMap<u8, bool>` | 按域暂停 |
| `RouteConfig` | `SimpleRoute` | 简化的分账配置 |

#### 增强系统存储项

| 存储 | 类型 | 描述 |
|-----|------|-----|
| `UseEnhancedSystem` | `bool` | 系统模式开关 |
| `NextEnhancedSacrificeId` | `u64` | 下一个增强祭祀品ID |
| `EnhancedSacrificeOf` | `StorageMap<u64, EnhancedSacrificeItem>` | 增强祭祀品信息 |
| `SacrificesByPrimaryCategory` | `StorageMap<PrimaryCategory, BoundedVec<u64>>` | 按主分类索引 |
| `SacrificesBySubCategory` | `StorageMap<SubCategory, BoundedVec<u64>>` | 按子分类索引 |
| `SacrificesBySceneTag` | `StorageMap<SceneTag, BoundedVec<u64>>` | 按场景标签索引 |
| `UserPurchaseCount` | `StorageDoubleMap<AccountId, u64, u32>` | 用户购买计数 |
| `SacrificeStock` | `StorageMap<u64, i32>` | 商品库存 |

### 关键事件

| 事件 | 描述 |
|-----|-----|
| `SacrificeCreated(id)` | 祭祀品已创建 |
| `SacrificeUpdated(id)` | 祭祀品已更新 |
| `SacrificeStatusSet(id, status_code)` | 祭祀品状态已设置 |
| `OfferingCreated { kind_code }` | 供奉品规格已创建 |
| `OfferingUpdated { kind_code }` | 供奉品规格已更新 |
| `OfferingEnabled { kind_code, enabled }` | 供奉品已启用/禁用 |
| `OfferingPriceUpdated { kind_code, fixed_price, unit_price_per_week }` | 定价已更新 |
| `OfferingCommitted { id, target, kind_code, who, amount, duration_weeks, block }` | 供奉已提交 |
| `OfferingCommittedBySacrifice { id, target, sacrifice_id, who, amount, duration_weeks, block }` | 通过祭祀品目录下单完成 |
| `OfferParamsUpdated` | 风控参数已更新 |
| `PausedGlobalSet { paused }` | 全局暂停已设置 |
| `PausedDomainSet { domain, paused }` | 域暂停已设置 |
| `RouteConfigUpdated { subject_percent, platform_percent }` | 分账配置已更新 |

## 使用示例

### 创建祭祀品（管理员）

```rust
// 创建一束鲜花（固定价格）
memorial.create_sacrifice(
    origin,
    b"玫瑰花束".to_vec(),
    b"ipfs://...".to_vec(),
    b"一束红玫瑰".to_vec(),
    false,                       // 非VIP专属
    Some(100_000_000_000_000),   // 100 DUST
    None,                        // 无按周定价
    0,                           // Grave场景
    0,                           // Flower类目
)?;

// 创建香火供奉（按周定价）
memorial.create_sacrifice(
    origin,
    b"长明香火".to_vec(),
    b"ipfs://...".to_vec(),
    b"永续香火供奉".to_vec(),
    true,                        // VIP专属
    None,                        // 无固定价格
    Some(20_000_000_000_000),    // 20 DUST/周
    0,                           // Grave场景
    1,                           // Candle类目
)?;
```

### 创建供奉品规格（管理员）

```rust
// 创建即时型供奉品（点蜡烛）
memorial.create_offering(
    origin,
    1,                                  // kind_code
    b"点蜡烛".try_into().unwrap(),
    b"bafyxxx".try_into().unwrap(),    // media_schema_cid
    0,                                  // Instant类型
    None, None,                         // 无时长限制
    false,                              // 不可续费
    true,                               // 启用
)?;

// 设置定价
memorial.set_offering_price(
    origin,
    1,                          // kind_code
    Some(Some(50_000_000_000_000)), // 50 DUST
    None,                       // 无按周定价
)?;
```

### 用户供奉

```rust
// 通过供奉品规格下单
memorial.offer(
    origin,
    (0, 123),                   // target: (domain, id)
    1,                          // kind_code: 点蜡烛
    vec![],                     // 无媒体
    None,                       // 无时长
)?;

// 通过祭祀品目录下单（长期供奉）
memorial.offer_by_sacrifice(
    origin,
    (0, 123),                   // target: (domain, id)
    2,                          // sacrifice_id: 长明香火
    vec![],                     // 无媒体
    Some(52),                   // 52周（1年）
)?;
```

## 与其他模块的集成

### 1. pallet-grave / pallet-pet / pallet-park

提供 `TargetControl` 实现，验证供奉目标的存在性和权限。

### 2. pallet-ledger

实现 `OnOfferingCommitted` trait，记录供奉统计（累计次数、累计金额、周活跃）。

### 3. pallet-membership

提供 `MembershipProvider` 实现，检查会员状态和提供会员折扣。

### 4. pallet-ipfs

用于固定（pin）祭祀品的资源URL和供奉的媒体CID。

## 架构优势

1. **精简高效**：移除60%冗余功能，保留所有核心业务
2. **低耦合**：通过 trait 解耦目标验证、回调、会员系统
3. **双路径下单**：
   - 直接供奉（`offer`）：灵活定价，适合特殊场景
   - 目录下单（`offer_by_sacrifice`）：标准化商品，适合批量管理
4. **VIP专属机制**：支持会员专属祭祀品，增强会员体系
5. **限频防滥用**：双层限频（账户 + 目标），保护系统稳定性
6. **简化分账**：二元分账（subject 80% + platform 20%），降低复杂度

## 前端集成要点

### 1. 基础系统集成

#### 祭祀品目录
- 按场景（Grave/Pet/Park/Memorial）和类目（Flower/Candle/Food/Toy/Other）分类展示
- VIP专属祭祀品需要检查用户会员状态
- 支持定价方式：一次性（fixed_price）或按周（unit_price_per_week）

#### 供奉流程
- 检查目标权限（是否可供奉）
- 检查会员状态（计算折扣）
- 选择供奉方式：
  - 通过规格下单（需要提供 kind_code）
  - 通过目录下单（需要提供 sacrifice_id）
- 支持媒体上传（IPFS CID）

#### 供奉记录查询
- 通过 `OfferingsByTarget` 查询特定目标的供奉记录
- 通过 `OfferingRecords` 获取详细记录

#### 会员折扣显示
- 显示原价和折后价
- 提示会员优惠百分比

### 2. 纪念馆主页系统集成

当启用增强系统时，前端需要支持以下功能：

#### 2.1 商品分类浏览

```typescript
// 查询主分类商品
const flowerProducts = await api.query.memorial.sacrificesByPrimaryCategory('Flowers');

// 查询子分类商品
const whiteFlowers = await api.query.memorial.sacrificesBySubCategory('WhiteFlowers');

// 查询场景分类商品
const memorialProducts = await api.query.memorial.sacrificesBySceneTag('Memorial');
```

#### 2.2 商品详情展示

```typescript
// 获取增强商品详情
const productDetail = await api.query.memorial.enhancedSacrificeOf(productId);

// 商品信息结构
interface EnhancedProduct {
  name: string;
  description: string;
  primary_category: PrimaryCategory;
  sub_categories: SubCategory[];
  scene_tags: SceneTag[];
  cultural_tags: CulturalTag[];
  quality_level: QualityLevel;
  pricing: PricingConfig;
  stock: number;
  purchase_limits: PurchaseLimit;
}
```

#### 2.3 高级搜索和过滤

```typescript
// 多维度过滤
const searchParams = {
  primaryCategory: 'Flowers',
  sceneTag: 'Memorial',
  culturalTag: 'Chinese',
  priceRange: [10000, 50000],
  userType: 'VIP'
};

// 前端需要实现的过滤逻辑
function filterProducts(products: Product[], filters: SearchFilters): Product[] {
  return products.filter(product => {
    return matchesCategory(product, filters.primaryCategory) &&
           matchesScene(product, filters.sceneTag) &&
           matchesCulture(product, filters.culturalTag) &&
           inPriceRange(product, filters.priceRange) &&
           availableForUser(product, filters.userType);
  });
}
```

#### 2.4 购物车和批量操作

```typescript
// 检查购买限制
const canPurchase = await checkPurchaseLimit(userId, productId, quantity);

// 批量添加到购物车
const cartItems = products.map(product => ({
  productId: product.id,
  quantity: product.selectedQuantity,
  pricing: calculatePrice(product, userType)
}));

// 库存实时检查
const stockAvailable = await api.query.memorial.sacrificeStock(productId);
```

#### 2.5 个性化推荐

```typescript
// 根据用户历史购买记录推荐
const userHistory = await api.query.memorial.userPurchaseCount.entries(userId);
const recommendations = generateRecommendations(userHistory, availableProducts);

// 根据文化背景推荐
const culturalRecommendations = filterByCulturalTags(products, userCulturalPreference);

// 根据场景推荐
const sceneRecommendations = filterBySceneTag(products, currentScene);
```

#### 2.6 定价展示

```typescript
// 处理复杂定价策略
function displayPrice(product: EnhancedProduct, userType: UserType, quantity: number): PriceDisplay {
  const pricing = product.pricing;

  switch (pricing.model) {
    case 'Fixed':
      return { price: pricing.amount, type: '固定价格' };

    case 'Tiered':
      return calculateTieredPrice(pricing.tiers, quantity);

    case 'Dynamic':
      return calculateDynamicPrice(pricing.base, pricing.range, marketFactors);

    case 'Subscription':
      return { price: pricing.amount, type: `订阅价格（${pricing.period}周）` };

    case 'Bundle':
      return calculateBundlePrice(pricing.items, selectedItems);
  }
}
```

### 3. 移动端适配

#### 3.1 分类导航设计

- 横向滑动的主分类导航
- 下拉或展开的子分类选择
- 场景标签的快速切换

#### 3.2 商品列表优化

- 瀑布流布局适配不同商品图片比例
- 懒加载和虚拟滚动优化大量商品展示
- 商品卡片显示关键信息：名称、价格、库存状态

#### 3.3 购买流程简化

- 一键购买功能
- 快速数量选择器
- 简化的支付确认流程

### 4. 系统模式切换

```typescript
// 检查当前使用的系统模式
const useEnhancedSystem = await api.query.memorial.useEnhancedSystem();

// 根据模式加载不同的组件和功能
if (useEnhancedSystem) {
  // 加载增强系统的纪念馆主页
  loadEnhancedMemorialHomePage();
} else {
  // 加载简化系统的基础功能
  loadBasicMemorialFunctions();
}
```

## 未来扩展

### 简化系统扩展

1. **批量供奉功能**：待 DecodeWithMemTracking 问题解决后重新启用
2. **供奉续费**：支持计时型供奉的自动续费
3. **供奉记录NFT化**：将特殊供奉记录铸造为NFT纪念品
4. **动态定价**：根据供需关系调整祭祀品价格
5. **供奉排行榜**：统计供奉金额排行，激励用户参与

### 增强系统扩展

1. **AI推荐系统**：基于用户行为和偏好的智能商品推荐
2. **社交功能**：用户可以分享供奉记录，形成纪念社区
3. **时间胶囊**：定时发布的纪念内容功能
4. **虚拟现实集成**：VR/AR 纪念馆体验
5. **跨链互操作**：支持其他区块链的纪念品和资产

### 技术优化

1. **查询性能优化**：为大量商品和分类建立更高效的索引
2. **缓存机制**：实现链下缓存减少重复查询
3. **数据压缩**：优化存储结构减少链上数据量
4. **事件聚合**：批量处理事件减少存储开销

---

**维护者**: Stardust Team
**最后更新**: 2025-11-12
**版本**: v2.0.0 (增强版)
