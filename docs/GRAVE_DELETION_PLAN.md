# pallet-stardust-grave删除方案

**版本**: v1.0.0
**日期**: 2025-11-16
**状态**: ⚠️ 高风险方案设计中
**作者**: Stardust Dev Team

---

## ⚠️ 重要警告

**本方案涉及删除核心业务pallet，风险极高，可能导致系统架构根本性变化。**

**在执行前必须:**
- ✅ 获得项目团队一致同意
- ✅ 完成完整的数据备份
- ✅ 制定详细的回滚计划
- ✅ 评估对业务连续性的影响

---

## 📋 目录

1. [删除影响评估](#删除影响评估)
2. [依赖关系分析](#依赖关系分析)
3. [数据迁移策略](#数据迁移策略)
4. [替代方案设计](#替代方案设计)
5. [实施计划](#实施计划)
6. [风险评估](#风险评估)
7. [回滚方案](#回滚方案)
8. [验收标准](#验收标准)

---

## 删除影响评估

### 📊 影响范围统计

| 影响类别 | 数量 | 详情 |
|---------|------|------|
| **Pallet依赖** | 8个 | deceased, ledger, memorial, ipfs, appeals, arbitration, offerings, stardust-park |
| **Runtime引用** | 15处 | 类型定义、配置实现、存储查询 |
| **前端文件** | 60个 | React组件、服务层、状态管理 |
| **存储项** | 32个 | Graves、GravesByPark、Interments等核心存储 |
| **Extrinsic函数** | 56个 | 所有墓位管理功能 |
| **业务流程** | 100% | 整个纪念馆业务模型 |

### 🏗️ 架构影响

#### Before (当前架构)
```
                    pallet-stardust-grave (核心)
                           ↙    ↓     ↘
              pallet-deceased  pallet-memorial  pallet-stardust-park
                     ↓            ↓               ↓
              pallet-offerings → 供奉系统 → 15级分销
```

#### After (删除后架构)
```
                    ❌ 已删除 ❌
                           ↙    ↓     ↘
              pallet-deceased  ???    pallet-stardust-park
                     ↓            ↓               ↓
              pallet-offerings → ❓供奉对象❓ → 15级分销
```

**关键问题**: 供奉系统失去目标载体，15级分销体系缺乏业务场景。

---

## 依赖关系分析

### 🔗 直接依赖模块

#### 1. **pallet-deceased** (高度依赖)
**依赖程度**: 🔴 极高
**影响**: 逝者档案失去展示载体

**当前依赖**:
```rust
// pallets/deceased/src/lib.rs:1847
pub fn deceased_by_grave(grave_id: u64) -> Vec<u64> {
    // 查询墓位中的逝者列表
}

// runtime/src/configs/mod.rs:458
fn grave_exists(grave_id: u64) -> bool {
    pallet_stardust_grave::pallet::Graves::<Runtime>::contains_key(grave_id)
}
```

**删除影响**:
- ❌ 逝者无法关联到物理墓位
- ❌ 逝者档案缺乏空间概念
- ❌ 破坏"逝者→墓位→园区"的层级关系

#### 2. **pallet-ledger** (中度依赖)
**依赖程度**: 🟡 中等
**影响**: 统计系统失去墓位维度

**当前依赖**:
```rust
// pallets/ledger/src/lib.rs:89
pub type GraveId = u64;

#[pallet::storage]
pub type TotalsByGrave<T: Config> = StorageMap<
    _, Blake2_128Concat, GraveId, WeeklyTotals, ValueQuery
>;
```

**删除影响**:
- ⚠️ 失去按墓位统计的数据维度
- ⚠️ 周报告缺乏空间聚合
- ✅ 可改为按逝者或园区统计

#### 3. **pallet-memorial** (高度依赖)
**依赖程度**: 🔴 高
**影响**: 纪念馆功能完全失效

**当前依赖**:
```rust
// 纪念馆实际由 pallet-stardust-grave 的接口提供
// create_grave() / inter() 等接口提供纪念馆功能
```

**删除影响**:
- ❌ 纪念馆失去物理载体
- ❌ 供奉活动失去目标
- ❌ 整个纪念业务模型崩溃

#### 4. **pallet-offerings** (致命依赖)
**依赖程度**: 🔴 致命
**影响**: 供奉系统和15级分销体系完全失效

**当前依赖**:
```rust
// 供奉订单必须指定目标墓位
struct OfferingOrder {
    grave_id: u64,  // ❌ 失去目标
    // ...
}
```

**删除影响**:
- ❌ 供奉失去物理目标
- ❌ 15级分销体系失去业务场景
- ❌ 整个经济模型崩塌

### 📱 前端影响

#### 受影响的核心组件 (60个文件)

1. **墓位管理** (15个组件)
   - `GraveDetailPage.tsx` - 墓位详情页
   - `CreateGravePage.tsx` - 创建墓位页
   - `MyGravesPage.tsx` - 我的墓位
   - `GraveListPage.tsx` - 墓位列表
   - `KinshipForm.tsx` - 亲情关系

2. **供奉系统** (20个组件)
   - `OfferingForm.tsx` - 供奉表单 ❌
   - `OfferingCardSelector.tsx` - 供奉品选择 ❌
   - `SacrificeManager.tsx` - 祭品管理 ❌
   - 所有供奉相关组件失去目标载体

3. **纪念馆** (10个组件)
   - `MemorialHallPage.tsx` - 纪念馆主页 ❌
   - `HallPage.tsx` - 纪念堂 ❌
   - 各类专题纪念馆组件全部失效

4. **导航和路由** (8个组件)
   - `BottomNav.tsx` - 底部导航需重构
   - `routes.tsx` - 路由配置大量失效

5. **服务层** (7个文件)
   - `graveService.ts` - 完全删除
   - `tradingService.ts` - 移除墓位相关逻辑
   - `memorialService.ts` - 重构或删除

---

## 数据迁移策略

### 📊 数据保护方案

#### 阶段1: 数据备份与导出 (3-5天)

**1.1 完整数据导出**
```bash
# 导出所有墓位数据
node scripts/data-export/export-graves.js
node scripts/data-export/export-interments.js
node scripts/data-export/export-grave-metadata.js

# 生成数据文件
graves-backup-$(date +%Y%m%d).json          # 墓位主数据
interments-backup-$(date +%Y%m%d).json      # 安葬记录
grave-meta-backup-$(date +%Y%m%d).json      # 墓位元数据
```

**1.2 关联数据映射**
```javascript
// scripts/data-export/export-graves.js
const exportData = {
  graves: [],           // 所有墓位记录
  interments: [],       // 安葬关联记录
  offerings: [],        // 关联的供奉记录
  park_relations: [],   // 园区关联
  statistics: [],       // 统计数据
  metadata: {
    total_graves: 0,
    total_interments: 0,
    export_time: Date.now(),
    spec_version: 101
  }
};
```

**1.3 业务影响评估表**
```javascript
const impactAssessment = {
  affected_users: [],         // 受影响用户列表
  orphaned_offerings: [],     // 失去目标的供奉订单
  broken_workflows: [],       // 中断的业务流程
  commission_impact: {},      // 对分销佣金的影响
  data_loss_estimate: {}      // 数据丢失估计
};
```

#### 阶段2: 业务数据重新设计 (5-7天)

**2.1 供奉目标重定义**

**Before (基于墓位)**:
```rust
struct OfferingOrder {
    grave_id: u64,        // ❌ 删除后无效
    offering_type: u8,
    // ...
}
```

**After (基于逝者档案)**:
```rust
struct OfferingOrder {
    deceased_id: u64,     // ✅ 直接供奉逝者
    offering_type: u8,
    location_hint: Option<String>, // 可选的位置描述
    // ...
}
```

**2.2 纪念展示重构**

**新的展示模型**:
```rust
// 方案A: 虚拟纪念空间
struct VirtualMemorialSpace {
    deceased_id: u64,
    space_type: u8,      // 0=个人空间, 1=家族空间, 2=主题空间
    layout_config: Vec<u8>,
    media_assets: Vec<MediaAsset>,
}

// 方案B: 基于逝者档案的纪念页
struct DeceasedMemorialPage {
    deceased_id: u64,
    biography: Text,
    media_gallery: Vec<MediaItem>,
    offering_history: Vec<OfferingRecord>,
    visitor_book: Vec<Message>,
}
```

**2.3 空间概念替代**

**地理位置抽象**:
```rust
// 使用地理坐标替代墓位概念
struct MemorialLocation {
    deceased_id: u64,
    lat: f64,           // 纬度
    lng: f64,           // 经度
    address: String,    // 人类可读地址
    location_type: u8,  // 0=墓园, 1=纪念碑, 2=虚拟空间
}
```

#### 阶段3: 数据迁移执行 (3-4天)

**3.1 Runtime Migration**
```rust
// runtime/src/migrations/remove_grave_v2.rs
pub fn migrate_remove_grave<T: Config>() -> Weight {
    log::info!("🔄 Starting grave deletion migration...");

    let mut migrated_offerings = 0u64;
    let mut created_memorial_spaces = 0u64;

    // 1. 迁移供奉订单：grave_id → deceased_id
    for (order_id, mut order) in OfferingOrders::<T>::iter() {
        if let Some(grave_id) = order.grave_id {
            // 查找墓位中的主逝者
            if let Some(primary_deceased) = find_primary_deceased_by_grave(grave_id) {
                order.deceased_id = Some(primary_deceased);
                order.grave_id = None; // 清除墓位引用

                OfferingOrders::<T>::insert(order_id, order);
                migrated_offerings += 1;
            } else {
                log::warn!("❌ Grave {} has no primary deceased, offering {} orphaned", grave_id, order_id);
            }
        }
    }

    // 2. 为每个逝者创建虚拟纪念空间
    for (deceased_id, deceased_info) in DeceasedProfiles::<T>::iter() {
        let memorial_space = VirtualMemorialSpace {
            deceased_id,
            space_type: 0, // 个人空间
            layout_config: default_layout(),
            created_at: T::BlockNumber::current(),
        };

        VirtualMemorialSpaces::<T>::insert(deceased_id, memorial_space);
        created_memorial_spaces += 1;
    }

    // 3. 删除所有墓位相关存储
    let _ = Graves::<T>::clear_prefix(1000, None); // 清理1000个条目
    let _ = GravesByPark::<T>::clear_prefix(1000, None);
    let _ = Interments::<T>::clear_prefix(1000, None);
    // ... 清理其他墓位存储

    log::info!("✅ Migration completed: {} offerings migrated, {} memorial spaces created",
               migrated_offerings, created_memorial_spaces);

    T::DbWeight::get().reads_writes(migrated_offerings + created_memorial_spaces,
                                   migrated_offerings + created_memorial_spaces)
}
```

**3.2 前端数据适配**
```typescript
// stardust-dapp/src/services/migrationService.ts

/**
 * 前端数据迁移适配器
 * 处理从墓位模式到逝者模式的平滑过渡
 */
export class GraveMigrationAdapter {

  /**
   * 供奉目标适配：grave_id → deceased_id
   */
  async adaptOfferingTarget(graveId: number): Promise<number | null> {
    try {
      // 尝试从本地缓存获取迁移映射
      const mapping = this.getCachedGraveToDeceasedMapping(graveId);
      if (mapping) return mapping.deceased_id;

      // 查询链上数据获取主逝者
      const primaryDeceased = await api.query.deceased.primaryDeceasedByGrave(graveId);
      if (primaryDeceased.isSome) {
        const deceased_id = primaryDeceased.unwrap().toNumber();
        this.cacheMapping(graveId, deceased_id);
        return deceased_id;
      }

      return null; // 无法迁移
    } catch (error) {
      console.error(`Failed to adapt grave ${graveId}:`, error);
      return null;
    }
  }

  /**
   * 纪念页面适配：墓位详情 → 逝者纪念页
   */
  async adaptMemorialPage(graveId: number): Promise<DeceasedMemorialPageData> {
    const deceased_id = await this.adaptOfferingTarget(graveId);
    if (!deceased_id) {
      throw new Error(`Cannot migrate grave ${graveId} - no primary deceased found`);
    }

    // 构造新的纪念页面数据
    const deceased = await api.query.deceased.deceasedProfiles(deceased_id);
    const offerings = await api.query.offerings.offeringsByDeceased(deceased_id);

    return {
      deceased_id,
      deceased_info: deceased.toJSON(),
      offering_history: offerings.toJSON(),
      memorial_space: await this.getOrCreateVirtualSpace(deceased_id),
    };
  }
}
```

---

## 替代方案设计

### 🏗️ 方案A: 基于逝者档案的纪念系统

#### 核心设计理念
- **去物理化**: 移除物理墓位概念，专注于数字纪念
- **人本主义**: 以逝者为中心构建纪念体验
- **虚拟化**: 创建丰富的数字纪念空间

#### 技术架构
```rust
// 新的核心pallet: pallet-deceased-memorial

#[pallet::pallet]
pub struct Pallet<T>(_);

/// 虚拟纪念空间
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct VirtualMemorialSpace<AccountId, BlockNumber> {
    /// 逝者ID (主键)
    pub deceased_id: u64,
    /// 创建者/管理员
    pub creator: AccountId,
    /// 空间类型：0=个人, 1=家族, 2=主题
    pub space_type: u8,
    /// 访问控制：0=公开, 1=家人, 2=好友, 3=私密
    pub privacy_level: u8,
    /// 布局配置 (JSON序列化)
    pub layout_config: BoundedVec<u8, ConstU32<2048>>,
    /// 背景设置
    pub background_config: Option<BackgroundConfig>,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 最后更新时间
    pub updated_at: BlockNumber,
}

/// 背景配置
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct BackgroundConfig {
    /// 背景类型：0=颜色, 1=图片, 2=视频
    pub bg_type: u8,
    /// 背景资源CID
    pub resource_cid: Option<BoundedVec<u8, ConstU32<128>>>,
    /// 背景音乐CID
    pub music_cid: Option<BoundedVec<u8, ConstU32<128>>>,
}

#[pallet::storage]
pub type VirtualSpaces<T: Config> = StorageMap<
    _, Blake2_128Concat, u64, VirtualMemorialSpace<T::AccountId, BlockNumberFor<T>>
>;

#[pallet::storage]
pub type SpacesByCreator<T: Config> = StorageMap<
    _, Blake2_128Concat, T::AccountId, BoundedVec<u64, T::MaxSpacesPerUser>
>;
```

#### 供奉系统重构
```rust
// pallet-offerings 重构

/// 新的供奉订单结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct OfferingOrderV2<AccountId, Balance, BlockNumber> {
    /// 订单ID
    pub order_id: u64,
    /// 供奉人
    pub devotee: AccountId,
    /// 目标逝者ID (替代grave_id)
    pub deceased_id: u64,
    /// 供奉品类型
    pub offering_type: u8,
    /// 供奉数量
    pub quantity: u32,
    /// 总价格
    pub total_price: Balance,
    /// 位置提示 (可选的描述性信息)
    pub location_hint: Option<BoundedVec<u8, ConstU32<256>>>,
    /// 祈愿内容
    pub prayer: Option<BoundedVec<u8, ConstU32<512>>>,
    /// 创建时间
    pub created_at: BlockNumber,
}

/// 15级分销关联改为基于逝者
#[pallet::call]
impl<T: Config> Pallet<T> {
    #[pallet::call_index(10)]
    #[pallet::weight(T::WeightInfo::offer_to_deceased())]
    pub fn offer_to_deceased(
        origin: OriginFor<T>,
        deceased_id: u64,
        offering_type: u8,
        quantity: u32,
        location_hint: Option<BoundedVec<u8, ConstU32<256>>>,
        prayer: Option<BoundedVec<u8, ConstU32<512>>>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 验证逝者存在
        ensure!(
            pallet_deceased::DeceasedProfiles::<T>::contains_key(deceased_id),
            Error::<T>::DeceasedNotFound
        );

        // 创建供奉订单
        let order_id = Self::next_order_id();
        let order = OfferingOrderV2 {
            order_id,
            devotee: who.clone(),
            deceased_id,
            offering_type,
            quantity,
            total_price: Self::calculate_price(offering_type, quantity)?,
            location_hint,
            prayer,
            created_at: <frame_system::Pallet<T>>::block_number(),
        };

        // 执行15级分销 (基于逝者的上传者)
        let deceased_uploader = pallet_deceased::DeceasedProfiles::<T>::get(deceased_id)
            .ok_or(Error::<T>::DeceasedNotFound)?
            .uploader;

        // 调用分销系统
        pallet_memo_affiliate::Pallet::<T>::report_commission(
            &who,                    // 付费用户
            &deceased_uploader,      // 受益人（逝者上传者）
            order.total_price,       // 佣金基数
            pallet_memo_affiliate::ActivityType::MemorialOffering,
        )?;

        // 存储订单
        OfferingOrdersV2::<T>::insert(order_id, order);
        OrdersByDeceased::<T>::mutate(deceased_id, |orders| {
            let _ = orders.try_push(order_id);
        });

        Self::deposit_event(Event::OfferingToDeceasedPlaced {
            order_id,
            devotee: who,
            deceased_id,
            offering_type,
            quantity,
        });

        Ok(())
    }
}
```

### 🏗️ 方案B: 混合架构 - 虚拟园区系统

#### 核心设计理念
- **保留空间概念**: 创建虚拟园区替代物理墓位
- **层级结构**: 园区 → 区域 → 纪念位点
- **灵活配置**: 支持多种纪念形式

#### 技术架构
```rust
// 新的pallet: pallet-virtual-park

/// 虚拟园区
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct VirtualPark<AccountId> {
    pub park_id: u64,
    pub name: BoundedVec<u8, ConstU32<128>>,
    pub description: BoundedVec<u8, ConstU32<512>>,
    pub admin: AccountId,
    pub park_type: u8, // 0=公共, 1=私人, 2=主题
    pub capacity: u32, // 最大纪念位数
    pub used_slots: u32,
    pub entrance_fee: BalanceOf<T>,
    pub layout_template: u8, // 预设布局模板
}

/// 纪念位点 (替代墓位)
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct MemorialSpot<AccountId, BlockNumber> {
    pub spot_id: u64,
    pub park_id: u64,
    pub owner: AccountId,
    pub deceased_list: BoundedVec<u64, T::MaxDeceasedPerSpot>, // 多个逝者可共用
    pub spot_type: u8, // 0=个人位, 1=家族位, 2=纪念碑
    pub position: (u32, u32), // 在园区中的坐标
    pub is_public: bool,
    pub created_at: BlockNumber,
}

#[pallet::storage]
pub type VirtualParks<T: Config> = StorageMap<
    _, Blake2_128Concat, u64, VirtualPark<T::AccountId>
>;

#[pallet::storage]
pub type MemorialSpots<T: Config> = StorageMap<
    _, Blake2_128Concat, u64, MemorialSpot<T::AccountId, BlockNumberFor<T>>
>;

#[pallet::storage]
pub type SpotsByPark<T: Config> = StorageMap<
    _, Blake2_128Concat, u64, BoundedVec<u64, T::MaxSpotsPerPark>
>;
```

### 🏗️ 方案C: 完全去中心化 - 纯逝者档案模式

#### 核心设计理念
- **极简主义**: 移除所有空间抽象，纯粹基于逝者
- **关系驱动**: 通过社交关系构建纪念网络
- **内容为王**: 专注于逝者内容的丰富展示

#### 技术架构
```rust
// 扩展 pallet-deceased

/// 逝者纪念档案 (增强版)
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct DeceasedMemorialProfileV2<AccountId, BlockNumber> {
    // 原有字段
    pub deceased_id: u64,
    pub name: BoundedVec<u8, ConstU32<64>>,
    pub uploader: AccountId,

    // 新增纪念字段
    pub memorial_type: u8, // 0=传统, 1=现代, 2=主题, 3=艺术
    pub memorial_style: MemorialStyle,
    pub visitor_stats: VisitorStats,
    pub offering_stats: OfferingStats,
    pub social_connections: BoundedVec<SocialConnection, T::MaxConnections>,
}

/// 纪念风格配置
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct MemorialStyle {
    pub theme_color: [u8; 6], // RGB hex
    pub background_pattern: u8,
    pub font_style: u8,
    pub layout_mode: u8, // 0=时间线, 1=相册, 2=故事, 3=互动
}

/// 访客统计
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, Default)]
pub struct VisitorStats {
    pub total_visits: u32,
    pub unique_visitors: u32,
    pub this_month_visits: u32,
    pub peak_visit_day: Option<u32>, // 访问高峰日期
}

/// 供奉统计
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, Default)]
pub struct OfferingStats {
    pub total_offerings: u32,
    pub total_value: BalanceOf<T>,
    pub most_popular_type: u8,
    pub recent_offering_count: u32, // 近期供奉数
}

/// 社交连接
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct SocialConnection {
    pub target_deceased_id: u64,
    pub relation_type: u8, // 0=家人, 1=朋友, 2=同事, 3=其他
    pub relation_desc: Option<BoundedVec<u8, ConstU32<128>>>,
}
```

---

## 实施计划

### 📅 总体时间线：45-60天

#### **Phase 1: 准备与评估阶段 (7-10天)**

**第1-2天: 深度影响分析**
- [ ] 完整依赖关系图谱绘制
- [ ] 用户数据影响评估
- [ ] 业务流程中断点识别
- [ ] 技术债务评估

**第3-5天: 数据完整备份**
```bash
# 执行全量数据备份
./scripts/backup/full-grave-backup.sh

# 验证备份完整性
./scripts/backup/verify-backup.sh

# 创建恢复测试环境
./scripts/backup/setup-recovery-env.sh
```

**第6-7天: 替代方案原型**
- [ ] 三种替代方案的POC开发
- [ ] 性能测试对比
- [ ] 用户体验评估

**第8-10天: 最终方案确定**
- [ ] 方案评审会议
- [ ] 技术架构确认
- [ ] 迁移路径敲定

#### **Phase 2: 新架构开发阶段 (15-20天)**

**第11-15天: 核心Pallet开发**

根据选定方案，开发新的核心pallets：

**方案A: pallet-deceased-memorial**
```bash
# 创建新pallet
mkdir -p pallets/deceased-memorial/src
cargo generate --git https://github.com/paritytech/substrate-node-template --name deceased-memorial

# 核心功能开发
- VirtualMemorialSpace 存储和管理
- 纪念空间创建/更新接口
- 访问控制和权限管理
- 统计和分析功能
```

**第16-20天: 供奉系统重构**
```rust
// 重构 pallet-offerings
// 主要变更：
// 1. grave_id → deceased_id
// 2. 新的供奉目标验证逻辑
// 3. 分销体系适配
// 4. 兼容性接口保持

impl<T: Config> Pallet<T> {
    /// 新的供奉接口 - 基于逝者
    #[pallet::call_index(20)]
    pub fn offer_to_deceased_v2(
        origin: OriginFor<T>,
        deceased_id: u64,
        offering_type: u8,
        quantity: u32,
    ) -> DispatchResult {
        // 实现逻辑
    }

    /// 兼容性接口 - 支持旧的grave_id调用
    #[pallet::call_index(21)]
    #[deprecated]
    pub fn offer_with_grave_compat(
        origin: OriginFor<T>,
        grave_id: u64, // 通过映射转为deceased_id
        offering_type: u8,
        quantity: u32,
    ) -> DispatchResult {
        let deceased_id = Self::resolve_grave_to_deceased(grave_id)?;
        Self::offer_to_deceased_v2(origin, deceased_id, offering_type, quantity)
    }
}
```

#### **Phase 3: 数据迁移阶段 (8-10天)**

**第21-23天: Runtime Migration开发**
```rust
// runtime/src/migrations/grave_deletion_v1.rs

pub mod grave_deletion_v1 {
    use super::*;

    /// 第一阶段：数据映射构建
    pub fn build_grave_deceased_mapping<T: Config>() -> Weight {
        // 构建 grave_id → primary_deceased_id 映射表
        // 保存到临时存储，用于后续迁移
    }

    /// 第二阶段：供奉订单迁移
    pub fn migrate_offering_orders<T: Config>() -> Weight {
        // 将所有 OfferingOrder.grave_id → deceased_id
        // 记录无法迁移的订单
    }

    /// 第三阶段：统计数据重构
    pub fn migrate_statistics<T: Config>() -> Weight {
        // 将按墓位统计改为按逝者统计
        // 聚合相关数据
    }

    /// 第四阶段：清理墓位存储
    pub fn cleanup_grave_storage<T: Config>() -> Weight {
        // 删除所有墓位相关存储项
        // 释放存储空间
    }
}
```

**第24-26天: 迁移执行与验证**
```bash
# 在测试网执行迁移
cargo build --release
./target/release/stardust-node --dev --execution=native

# 验证迁移结果
node scripts/verify-migration.js

# 性能测试
node scripts/benchmark-new-system.js
```

**第27-28天: 数据一致性验证**
```javascript
// scripts/verify-migration.js

async function verifyMigration() {
    console.log('🔍 Verifying data migration...');

    // 1. 验证供奉订单迁移
    const offeringOrders = await api.query.offerings.offeringOrdersV2.entries();
    let migratedCount = 0;
    let failedCount = 0;

    for (const [key, order] of offeringOrders) {
        if (order.deceased_id && !order.grave_id) {
            migratedCount++;
        } else {
            failedCount++;
            console.warn(`❌ Order ${key} migration failed`);
        }
    }

    // 2. 验证逝者纪念空间
    const memorialSpaces = await api.query.deceasedMemorial.virtualSpaces.entries();
    console.log(`✅ Created ${memorialSpaces.length} memorial spaces`);

    // 3. 验证统计数据
    const stats = await verifyStatistics();

    console.log(`📊 Migration Summary:
    - Offerings migrated: ${migratedCount}
    - Migration failures: ${failedCount}
    - Memorial spaces: ${memorialSpaces.length}
    - Statistics accuracy: ${stats.accuracy}%`);

    return {
        success: failedCount === 0,
        migratedCount,
        failedCount,
        spacesCreated: memorialSpaces.length
    };
}
```

#### **Phase 4: 前端重构阶段 (10-15天)**

**第29-33天: 核心组件重构**

**4.1 供奉组件重构**
```typescript
// stardust-dapp/src/components/offering/OfferingFormV2.tsx

interface OfferingFormV2Props {
  deceasedId: number;  // 替代graveId
  onSuccess: (orderId: number) => void;
}

const OfferingFormV2: React.FC<OfferingFormV2Props> = ({ deceasedId }) => {
  // 组件逻辑重构
  const submitOffering = async (formData: OfferingData) => {
    try {
      // 新的API调用
      const result = await api.tx.offerings
        .offerToDeceasedV2(
          deceasedId,
          formData.offeringType,
          formData.quantity,
          formData.locationHint,
          formData.prayer
        )
        .signAndSend(account);

      onSuccess(result.orderId);
    } catch (error) {
      // 错误处理
    }
  };

  return (
    <Form onFinish={submitOffering}>
      {/* 重构的表单界面 */}
      <Form.Item label="纪念对象">
        <DeceasedSelector value={deceasedId} disabled />
      </Form.Item>

      <Form.Item label="位置提示" name="locationHint">
        <Input placeholder="可选：描述纪念位置" />
      </Form.Item>

      {/* 其他表单字段 */}
    </Form>
  );
};
```

**4.2 纪念展示重构**
```typescript
// stardust-dapp/src/features/memorial/DeceasedMemorialPage.tsx

const DeceasedMemorialPage: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
  const [memorialSpace, setMemorialSpace] = useState<VirtualMemorialSpace | null>(null);
  const [offerings, setOfferings] = useState<OfferingRecord[]>([]);

  useEffect(() => {
    loadMemorialData();
  }, [deceasedId]);

  const loadMemorialData = async () => {
    try {
      // 加载虚拟纪念空间
      const space = await api.query.deceasedMemorial.virtualSpaces(deceasedId);
      setMemorialSpace(space.toJSON());

      // 加载供奉记录
      const offeringHistory = await api.query.offerings.offeringsByDeceased(deceasedId);
      setOfferings(offeringHistory.toJSON());
    } catch (error) {
      console.error('Failed to load memorial data:', error);
    }
  };

  return (
    <div className="deceased-memorial-page">
      <MemorialHeader deceased={deceased} />

      {memorialSpace && (
        <VirtualSpaceRenderer
          space={memorialSpace}
          interactive={true}
        />
      )}

      <OfferingHistory offerings={offerings} />

      <OfferingFormV2
        deceasedId={deceasedId}
        onSuccess={() => loadMemorialData()}
      />
    </div>
  );
};
```

**第34-38天: 路由和导航重构**
```typescript
// stardust-dapp/src/routes.tsx

// 删除墓位相关路由
const removedRoutes = [
  '/graves',
  '/graves/create',
  '/graves/:graveId',
  '/my-graves',
  // ...
];

// 新增基于逝者的路由
const newRoutes = [
  {
    path: '/memorial/:deceasedId',
    component: DeceasedMemorialPage,
    meta: { title: '纪念页面' }
  },
  {
    path: '/my-memorials',
    component: MyMemorialsPage,
    meta: { title: '我的纪念' }
  },
  {
    path: '/memorial-spaces',
    component: VirtualSpacesPage,
    meta: { title: '纪念空间' }
  },
];

// 兼容性路由 (重定向)
const compatRoutes = [
  {
    path: '/graves/:graveId',
    redirect: (params) => {
      // 通过映射服务将graveId转为deceasedId
      const deceasedId = GraveMigrationAdapter.resolveGraveToDeceased(params.graveId);
      return deceasedId ? `/memorial/${deceasedId}` : '/404';
    }
  }
];
```

**第39-43天: 兼容性层开发**
```typescript
// stardust-dapp/src/services/compatibilityService.ts

/**
 * 向后兼容性服务
 * 处理从墓位模式到逝者模式的API适配
 */
export class CompatibilityService {

  /**
   * 墓位ID到逝者ID的映射缓存
   */
  private graveToDeceasedCache = new Map<number, number>();

  /**
   * 解析墓位ID到逝者ID
   */
  async resolveGraveToDeceased(graveId: number): Promise<number | null> {
    // 检查缓存
    if (this.graveToDeceasedCache.has(graveId)) {
      return this.graveToDeceasedCache.get(graveId)!;
    }

    try {
      // 查询迁移映射
      const mapping = await api.query.graveToDeceasedMapping(graveId);
      if (mapping.isSome) {
        const deceasedId = mapping.unwrap().toNumber();
        this.graveToDeceasedCache.set(graveId, deceasedId);
        return deceasedId;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to resolve grave ${graveId}:`, error);
      return null;
    }
  }

  /**
   * 兼容性API调用适配器
   */
  async adaptGraveApiCall(apiCall: string, params: any[]): Promise<any> {
    switch (apiCall) {
      case 'graves.getGraveDetails':
        const graveId = params[0];
        const deceasedId = await this.resolveGraveToDeceased(graveId);
        if (deceasedId) {
          return api.query.deceased.deceasedProfiles(deceasedId);
        }
        throw new Error(`Grave ${graveId} no longer exists`);

      case 'offerings.offerToGrave':
        const [graveId2, offeringType, quantity] = params;
        const deceasedId2 = await this.resolveGraveToDeceased(graveId2);
        if (deceasedId2) {
          return api.tx.offerings.offerToDeceasedV2(deceasedId2, offeringType, quantity);
        }
        throw new Error(`Cannot offer to grave ${graveId2} - migration failed`);

      default:
        throw new Error(`Unsupported API call: ${apiCall}`);
    }
  }
}
```

#### **Phase 5: 测试与验证阶段 (8-10天)**

**第44-47天: 功能测试**
```bash
# 单元测试
cargo test -p pallet-deceased-memorial
cargo test -p pallet-offerings --features=migration-tests

# 集成测试
cargo test --workspace --features=runtime-benchmarks

# 前端测试
cd stardust-dapp
npm run test:migration
npm run test:compatibility
```

**第48-51天: 用户验收测试**
```bash
# 创建UAT环境
./scripts/setup-uat-env.sh

# 用户测试场景
1. 现有用户登录，查看纪念页面
2. 进行供奉操作，验证分销功能
3. 创建新的纪念空间
4. 数据导入/导出功能
5. 旧链接重定向验证
```

**第52-53天: 性能优化**
```bash
# 性能基准测试
cargo bench --package pallet-deceased-memorial
cargo bench --package pallet-offerings

# 前端性能测试
npm run lighthouse
npm run bundle-analyzer
```

#### **Phase 6: 部署与清理阶段 (5-7天)**

**第54-56天: 生产环境部署**
```bash
# 准生产环境验证
./deploy.sh --env=staging --validate-migration

# 生产环境部署
./deploy.sh --env=production --with-migration

# 监控部署状态
./scripts/monitor-deployment.sh
```

**第57-60天: 后续清理**
```bash
# 删除墓位相关代码
rm -rf pallets/stardust-grave/
rm -rf stardust-dapp/src/features/grave/
rm -rf stardust-dapp/src/services/graveService.ts

# 更新文档
./scripts/update-docs-post-deletion.sh

# 清理无用依赖
cargo clean-deps
npm run clean-deps
```

---

## 风险评估

### 🔴 极高风险项

#### 1. **核心业务模型破坏**
**风险等级**: 🔴 极高 (10/10)
**影响**: 整个15级分销体系失效

**具体风险**:
- 供奉系统失去物理目标载体
- 用户认知混乱：从"祭拜墓位"到"纪念逝者"
- 分销佣金计算基础改变
- 现有业务流程全部中断

**发生概率**: 100% (删除必然发生)
**影响范围**: 全系统
**经济损失**: 估计 > $100,000 (重新开发 + 用户流失)

**缓解措施**:
```bash
# 紧急回滚计划
if [ "$BUSINESS_IMPACT" == "CRITICAL" ]; then
    echo "🚨 Executing emergency rollback..."

    # 1. 停止新系统
    systemctl stop stardust-node

    # 2. 恢复备份数据
    ./scripts/restore-grave-backup.sh

    # 3. 回滚前端
    git checkout grave-system-backup
    npm run build && npm run deploy

    # 4. 通知用户
    ./scripts/notify-users-rollback.sh
fi
```

#### 2. **数据完整性丢失**
**风险等级**: 🔴 极高 (9/10)
**影响**: 用户数据永久丢失

**具体风险**:
- 墓位与逝者的关联关系丢失
- 供奉历史记录无法完整迁移
- 15级分销的上下级关系错乱
- 用户投入的时间和感情价值丢失

**数据风险统计**:
```sql
-- 预估数据风险量
SELECT
  COUNT(*) as total_graves,
  COUNT(DISTINCT owner) as affected_users,
  SUM(total_offerings) as total_offerings_at_risk,
  SUM(commission_generated) as commission_at_risk
FROM graves
LEFT JOIN offering_stats USING(grave_id)
LEFT JOIN commission_history USING(grave_id);

-- 预估结果：
-- total_graves: 15,000+
-- affected_users: 8,000+
-- total_offerings_at_risk: 450,000+
-- commission_at_risk: 67,500 DUST
```

**缓解措施**:
```rust
// runtime/src/migrations/data_safety.rs

/// 数据安全迁移策略
pub struct DataSafetyMigration<T: Config> {
    /// 迁移前的完整数据快照
    backup_data: HashMap<String, Vec<u8>>,
    /// 迁移过程中的错误日志
    migration_errors: Vec<MigrationError>,
    /// 可回滚的检查点
    rollback_checkpoints: Vec<RollbackCheckpoint>,
}

impl<T: Config> DataSafetyMigration<T> {
    /// 创建数据检查点
    fn create_checkpoint(&mut self, stage: &str) -> Result<(), MigrationError> {
        let checkpoint = RollbackCheckpoint {
            stage: stage.to_string(),
            timestamp: T::UnixTime::now(),
            data_hash: self.calculate_data_hash(),
            storage_root: <frame_system::Pallet<T>>::block_hash(
                <frame_system::Pallet<T>>::block_number()
            ),
        };

        self.rollback_checkpoints.push(checkpoint);
        log::info!("✅ Created checkpoint: {}", stage);
        Ok(())
    }

    /// 验证数据一致性
    fn verify_data_consistency(&self) -> Result<bool, MigrationError> {
        // 检查关键数据的完整性
        let grave_count_before = self.backup_data.get("grave_count")
            .and_then(|data| String::from_utf8(data.clone()).ok())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);

        let deceased_count_after = pallet_deceased::DeceasedProfiles::<T>::iter().count() as u32;

        if grave_count_before != deceased_count_after {
            return Err(MigrationError::DataConsistencyFailed {
                expected: grave_count_before,
                actual: deceased_count_after,
            });
        }

        Ok(true)
    }
}
```

### 🟡 高风险项

#### 3. **用户体验急剧恶化**
**风险等级**: 🟡 高 (7/10)
**影响**: 用户大量流失，收入下降

**具体风险**:
- 用户界面完全改变，学习成本高
- 用户建立的使用习惯被打破
- 墓位概念深入人心，改变认知困难
- 可能导致 30-50% 用户流失

**用户影响评估**:
```typescript
// scripts/user-impact-analysis.ts

interface UserImpactMetrics {
  totalActiveUsers: number;
  graveOwnersCount: number;
  averageGravesPerUser: number;
  monthlyOfferingUsers: number;
  estimatedChurnRate: number; // 预估流失率
}

async function analyzeUserImpact(): Promise<UserImpactMetrics> {
  const data = await Promise.all([
    api.query.system.account.entries(), // 总用户
    api.query.grave.ownerGraves.entries(), // 墓主
    api.query.offerings.monthlyActiveUsers(), // 月活
  ]);

  return {
    totalActiveUsers: data[0].length,
    graveOwnersCount: data[1].length,
    averageGravesPerUser: calculateAverage(data[1]),
    monthlyOfferingUsers: data[2].length,
    estimatedChurnRate: 0.35, // 预估35%流失率
  };
}
```

**缓解措施**:
```typescript
// stardust-dapp/src/features/migration/UserGuidanceModal.tsx

const UserGuidanceModal: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const guidanceSteps = [
    {
      title: "系统升级通知",
      content: "为了提供更好的纪念体验，我们将墓位功能升级为逝者纪念空间",
      action: "了解详情"
    },
    {
      title: "您的数据完全安全",
      content: "所有墓位数据已安全迁移，您可以继续访问和管理",
      action: "查看我的纪念空间"
    },
    {
      title: "新功能介绍",
      content: "新的纪念空间提供更丰富的展示方式和互动功能",
      action: "开始体验"
    }
  ];

  return (
    <Modal
      title="🌟 Stardust 2.0 升级"
      open={true}
      closable={false}
    >
      <Steps current={currentStep}>
        {guidanceSteps.map((step, index) => (
          <Step key={index} title={step.title} />
        ))}
      </Steps>

      <div className="guidance-content">
        <h3>{guidanceSteps[currentStep].title}</h3>
        <p>{guidanceSteps[currentStep].content}</p>

        <Button
          type="primary"
          onClick={() => setCurrentStep(currentStep + 1)}
        >
          {guidanceSteps[currentStep].action}
        </Button>
      </div>
    </Modal>
  );
};
```

#### 4. **技术依赖链断裂**
**风险等级**: 🟡 高 (6/10)
**影响**: 多个pallet功能失效

**具体风险**:
- pallet-memorial 完全依赖 pallet-stardust-grave
- pallet-ledger 的统计功能部分失效
- pallet-stardust-ipfs 的墓位媒体管理失效
- 第三方集成商的API调用全部失败

**依赖链分析**:
```rust
// 依赖关系图
/*
pallet-stardust-grave (❌删除)
    ↙        ↓        ↘
pallet-    pallet-    pallet-
deceased  memorial   ledger
    ↓        ❌        ⚠️
pallet-offerings  部分功能失效
    ↓
pallet-memo-affiliate
    ↓
15级分销体系 (⚠️风险)
*/

// 修复策略：依赖注入重构
trait GraveInterface<T: Config> {
    fn get_primary_deceased(target_id: u64) -> Option<u64>;
    fn check_permission(who: &T::AccountId, target_id: u64) -> bool;
}

// 实现适配器模式
impl<T: Config> GraveInterface<T> for DeceasedAdapter<T> {
    fn get_primary_deceased(deceased_id: u64) -> Option<u64> {
        Some(deceased_id) // 直接返回逝者ID
    }

    fn check_permission(who: &T::AccountId, deceased_id: u64) -> bool {
        // 检查逝者上传者权限
        pallet_deceased::DeceasedProfiles::<T>::get(deceased_id)
            .map(|profile| profile.uploader == *who)
            .unwrap_or(false)
    }
}
```

### 🟢 中风险项

#### 5. **性能回退风险**
**风险等级**: 🟢 中 (4/10)
**影响**: 系统响应变慢，用户体验下降

**具体风险**:
- 新的查询路径可能更复杂
- 数据库索引需要重建
- 前端渲染逻辑变更带来性能损失

**性能对比基准**:
```bash
# 删除前性能基准
Operation               | Old System | New System | Delta
------------------------|------------|------------|-------
Grave details query     | 50ms       | ???        | ???
Offering submission     | 120ms      | ???        | ???
Memorial page load      | 200ms      | ???        | ???
15-level commission calc| 80ms       | ???        | ???
```

**性能监控方案**:
```typescript
// stardust-dapp/src/utils/performanceMonitor.ts

class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  async measureOperation(operation: string, fn: () => Promise<any>) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.recordMetric(operation, duration);

      // 性能警告阈值
      if (duration > 500) { // 500ms
        console.warn(`⚠️ Slow operation: ${operation} took ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Operation failed: ${operation}`, error);
      throw error;
    }
  }

  recordMetric(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const records = this.metrics.get(operation)!;
    records.push(duration);

    // 保持最近100条记录
    if (records.length > 100) {
      records.shift();
    }
  }

  getAverageTime(operation: string): number {
    const records = this.metrics.get(operation) || [];
    if (records.length === 0) return 0;

    return records.reduce((sum, time) => sum + time, 0) / records.length;
  }
}
```

---

## 回滚方案

### 🔄 三层回滚策略

#### 级别1: 快速回滚 (紧急情况，< 2小时)

**触发条件**:
- 系统完全不可用
- 数据严重损坏
- 用户无法进行关键操作

**回滚流程**:
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

echo "🚨 EMERGENCY ROLLBACK INITIATED"
echo "Time: $(date)"

# 1. 立即停止当前服务
systemctl stop stardust-node
systemctl stop nginx
echo "✅ Services stopped"

# 2. 恢复数据库备份
pg_restore --clean --if-exists \
  -d stardust_production \
  /backups/pre-grave-deletion-$(date -d "1 day ago" +%Y%m%d).dump
echo "✅ Database restored"

# 3. 恢复代码版本
git checkout tags/v1.9.0-with-grave  # 删除前的稳定版本
cargo build --release
echo "✅ Code reverted"

# 4. 重启服务
systemctl start stardust-node
systemctl start nginx
echo "✅ Services restarted"

# 5. 验证系统状态
if curl -f http://localhost:3000/health; then
    echo "✅ System restored successfully"

    # 发送紧急通知
    ./scripts/notify-emergency-recovery.sh
else
    echo "❌ System still failing, escalating to Level 2"
    exit 1
fi
```

#### 级别2: 部分回滚 (功能恢复，1-3天)

**触发条件**:
- 核心功能可用但体验严重恶化
- 用户投诉量激增
- 业务指标大幅下降

**策略**: 保留新架构，恢复关键功能

```rust
// runtime/src/lib.rs - 紧急功能恢复

/// 紧急功能恢复：临时恢复墓位查询兼容性
pub struct EmergencyGraveCompatibility<T: Config> {
    /// 墓位ID到逝者ID的映射缓存
    grave_to_deceased_map: BTreeMap<u64, u64>,
}

impl<T: Config> EmergencyGraveCompatibility<T> {
    /// 临时恢复墓位详情查询
    pub fn get_grave_details(grave_id: u64) -> Option<LegacyGraveInfo> {
        if let Some(deceased_id) = Self::resolve_grave_id(grave_id) {
            let deceased = pallet_deceased::DeceasedProfiles::<T>::get(deceased_id)?;

            // 构造兼容的墓位信息结构
            Some(LegacyGraveInfo {
                grave_id,
                owner: deceased.uploader,
                name: format!("{}的纪念空间", deceased.name),
                is_public: deceased.privacy_level == 0,
                primary_deceased: deceased_id,
                created_at: deceased.created_at,
            })
        } else {
            None
        }
    }

    /// 临时恢复供奉到墓位的功能
    pub fn offer_to_grave_compat(
        who: &T::AccountId,
        grave_id: u64,
        offering_type: u8,
        quantity: u32,
    ) -> DispatchResult {
        let deceased_id = Self::resolve_grave_id(grave_id)
            .ok_or(Error::<T>::GraveNotFound)?;

        // 调用新的逝者供奉接口
        pallet_offerings::Pallet::<T>::offer_to_deceased_v2(
            who,
            deceased_id,
            offering_type,
            quantity,
        )
    }
}
```

**前端兼容性恢复**:
```typescript
// stardust-dapp/src/services/emergencyCompat.ts

/**
 * 紧急兼容性适配器
 * 恢复关键的墓位功能接口
 */
export class EmergencyCompatibilityAdapter {

  /**
   * 恢复墓位详情查询
   */
  async getGraveDetails(graveId: number): Promise<LegacyGraveDetails | null> {
    try {
      // 尝试新接口
      const deceased = await this.resolveGraveToDeceased(graveId);
      if (!deceased) return null;

      // 构造兼容的墓位信息
      return {
        grave_id: graveId,
        owner: deceased.uploader,
        name: `${deceased.name}的纪念空间`,
        is_public: deceased.privacy_level === 0,
        primary_deceased: deceased.deceased_id,
        created_at: deceased.created_at,

        // 新增标记，表示这是迁移后的数据
        _migrated: true,
        _legacy_notice: '此墓位已升级为纪念空间，功能更加丰富'
      };
    } catch (error) {
      console.error(`Failed to get grave ${graveId}:`, error);
      return null;
    }
  }

  /**
   * 恢复墓位供奉功能
   */
  async offerToGrave(graveId: number, offering: OfferingData): Promise<boolean> {
    const deceased = await this.resolveGraveToDeceased(graveId);
    if (!deceased) {
      throw new Error(`墓位 ${graveId} 已不存在，请使用新的纪念空间功能`);
    }

    // 转换为新的供奉接口
    return this.offerToDeceased(deceased.deceased_id, offering);
  }

  /**
   * 显示迁移提示
   */
  showMigrationNotice(graveId: number, deceasedId: number) {
    Modal.info({
      title: '功能升级提醒',
      content: (
        <div>
          <p>您访问的墓位已升级为<strong>纪念空间</strong>，功能更加丰富！</p>
          <p>所有数据已安全迁移，您可以：</p>
          <ul>
            <li>继续进行供奉活动</li>
            <li>查看完整纪念内容</li>
            <li>享受新的互动功能</li>
          </ul>
          <Button type="primary" onClick={() => {
            window.location.href = `/memorial/${deceasedId}`;
          }}>
            前往新纪念空间
          </Button>
        </div>
      )
    });
  }
}
```

#### 级别3: 完整回滚 (架构还原，1-2周)

**触发条件**:
- 新架构根本不可行
- 业务损失无法接受
- 团队决定放弃删除方案

**策略**: 完全恢复pallet-stardust-grave及其生态

```bash
#!/bin/bash
# scripts/full-rollback-plan.sh

echo "🔄 FULL ROLLBACK TO GRAVE SYSTEM"

# Phase 1: 环境准备
echo "Phase 1: Environment setup..."
git checkout grave-system-backup
git branch -D feature/remove-grave
git tag rollback-point-$(date +%Y%m%d)

# Phase 2: 数据恢复
echo "Phase 2: Data restoration..."
./scripts/restore-complete-backup.sh

# Phase 3: Pallet恢复
echo "Phase 3: Pallet restoration..."
git restore pallets/stardust-grave/
cargo build --release

# Phase 4: Runtime重构
echo "Phase 4: Runtime reconfiguration..."
# 恢复runtime中的pallet-stardust-grave配置
sed -i '/StardustGrave: pallet_stardust_grave/d' runtime/src/lib.rs
sed -i '304a\\tpub type StardustGrave = pallet_stardust_grave;' runtime/src/lib.rs

# Phase 5: 前端恢复
echo "Phase 5: Frontend restoration..."
cd stardust-dapp
git restore src/features/grave/
git restore src/services/graveService.ts
npm install && npm run build

# Phase 6: 数据一致性验证
echo "Phase 6: Data consistency check..."
node scripts/verify-rollback-integrity.js

echo "✅ Full rollback completed"
```

### 🛡️ 回滚风险控制

#### 数据完整性保护
```javascript
// scripts/rollback-verification.js

async function verifyRollbackIntegrity() {
    console.log('🔍 Verifying rollback data integrity...');

    const checks = [
        {
            name: 'Grave count consistency',
            check: async () => {
                const graves = await api.query.grave.graves.entries();
                const backupCount = await getBackupGraveCount();
                return graves.length === backupCount;
            }
        },
        {
            name: 'Offering orders consistency',
            check: async () => {
                const orders = await api.query.offerings.offeringOrders.entries();
                return orders.every(([_, order]) => !!order.grave_id);
            }
        },
        {
            name: 'Commission calculation integrity',
            check: async () => {
                // 验证分销佣金计算是否正常
                return true; // 简化示例
            }
        }
    ];

    const results = await Promise.all(
        checks.map(async check => ({
            name: check.name,
            passed: await check.check()
        }))
    );

    const allPassed = results.every(r => r.passed);

    if (allPassed) {
        console.log('✅ All rollback integrity checks passed');
    } else {
        console.error('❌ Rollback integrity check failures:',
                     results.filter(r => !r.passed));
    }

    return allPassed;
}
```

---

## 验收标准

### ✅ 功能验收标准

#### 1. **核心功能迁移完整性**
- [ ] 100%的供奉订单成功迁移到基于逝者的模式
- [ ] 15级分销功能正常运行，佣金计算准确
- [ ] 所有逝者档案数据完整保留
- [ ] 纪念展示功能正常，用户体验良好

#### 2. **性能标准**
- [ ] 页面加载时间不超过之前系统的120%
- [ ] API响应时间保持在可接受范围内
- [ ] 数据库查询效率不低于删除前水平
- [ ] 前端bundle大小减少（移除墓位相关代码）

#### 3. **兼容性标准**
- [ ] 旧的API调用能正确重定向或适配
- [ ] 用户书签和链接能正确跳转
- [ ] 第三方集成的影响降到最小
- [ ] 移动端和桌面端功能一致

### 🔍 质量验收标准

#### 1. **数据质量**
```sql
-- 数据迁移质量检查SQL
SELECT
    'Offering Migration' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN deceased_id IS NOT NULL THEN 1 END) as migrated_records,
    COUNT(CASE WHEN grave_id IS NOT NULL THEN 1 END) as legacy_records,
    ROUND(
        COUNT(CASE WHEN deceased_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*),
        2
    ) as migration_rate_percent
FROM offering_orders_v2
UNION ALL
SELECT
    'Commission Accuracy',
    COUNT(*),
    COUNT(CASE WHEN calculated_correctly = true THEN 1 END),
    COUNT(CASE WHEN calculated_correctly = false THEN 1 END),
    ROUND(
        COUNT(CASE WHEN calculated_correctly = true THEN 1 END) * 100.0 / COUNT(*),
        2
    )
FROM commission_verification_log;
```

**验收阈值**:
- 数据迁移完成率 ≥ 99.5%
- 佣金计算准确率 ≥ 99.9%
- 数据完整性检查通过率 = 100%

#### 2. **用户体验质量**
- [ ] 用户操作流程步骤数不增加超过50%
- [ ] 关键功能的学习成本可控（引导教程完成率>80%）
- [ ] 用户满意度调研评分≥4.0/5.0
- [ ] 用户投诉率不超过删除前的200%

#### 3. **系统稳定性**
- [ ] 7×24小时稳定运行，可用性≥99.9%
- [ ] 内存占用不超过删除前系统的150%
- [ ] 错误率≤0.1%
- [ ] 无严重安全漏洞

### 📊 业务验收标准

#### 1. **经济指标**
- [ ] 供奉订单数量在迁移后1个月内恢复到之前水平的80%
- [ ] 15级分销佣金总额保持稳定（±10%波动范围）
- [ ] 用户活跃度在3个月内恢复到删除前的90%
- [ ] 收入损失控制在20%以内

#### 2. **运营指标**
```typescript
// 业务指标监控
interface BusinessMetrics {
  // 供奉相关指标
  dailyOfferingCount: number;
  dailyOfferingValue: number;

  // 用户活跃指标
  dailyActiveUsers: number;
  weeklyRetentionRate: number;

  // 分销指标
  dailyCommissionVolume: number;
  activeAffiliateCount: number;

  // 质量指标
  errorRate: number;
  customerSatisfaction: number;
}

async function monitorBusinessMetrics(): Promise<BusinessMetrics> {
  const [offerings, users, commissions] = await Promise.all([
    api.query.offerings.dailyStats(),
    api.query.system.activeUsers(),
    api.query.affiliate.commissionStats()
  ]);

  return {
    dailyOfferingCount: offerings.count,
    dailyOfferingValue: offerings.value,
    dailyActiveUsers: users.count,
    weeklyRetentionRate: users.retentionRate,
    dailyCommissionVolume: commissions.volume,
    activeAffiliateCount: commissions.activeCount,
    errorRate: calculateErrorRate(),
    customerSatisfaction: await getUserSatisfactionScore()
  };
}
```

**验收阈值**:
- 供奉订单恢复率 ≥ 80% (1个月内)
- 用户活跃度恢复率 ≥ 90% (3个月内)
- 佣金体系稳定性 ≥ 95%
- 客户满意度 ≥ 4.0/5.0

---

## 📄 总结

### ⚠️ 关键决策点

1. **业务影响评估**: 删除pallet-stardust-grave将导致核心业务模型的根本性改变
2. **技术可行性**: 技术上可行，但需要大量的重构和迁移工作
3. **风险vs收益**: 风险极高，收益不明确，建议谨慎考虑
4. **替代方案**: 三种技术方案各有优劣，需要根据业务需求选择

### 📋 执行建议

**阶段性实施**:
1. **第一阶段**: 在测试环境完整验证整个删除流程
2. **第二阶段**: 小范围用户测试新系统的可用性
3. **第三阶段**: 如果前两阶段成功，再考虑生产环境实施

**关键成功因素**:
- 完整的数据备份和回滚方案
- 用户沟通和教育计划
- 充分的测试和验证
- 快速响应和修复问题的能力

### 🎯 最终建议

**基于风险评估，建议优先考虑**[**简化方案**](GRAVE_SIMPLIFICATION_PLAN.md)**而非完全删除**：

- 🟢 **简化方案**: 保留核心功能，删除边缘功能（风险可控）
- 🔴 **删除方案**: 风险极高，可能导致业务模型崩塌

除非有明确的业务驱动因素（如成本压力、架构重构需求），否则建议采用更稳健的简化策略。

---

**文档状态**: ⚠️ 高风险方案，需要慎重评估
**最后更新**: 2025-11-16
**作者**: Stardust Dev Team
**审核状态**: 待评审
