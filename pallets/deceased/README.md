# Pallet Deceased

## 模块概述

逝者档案管理系统，提供完整的逝者数据生命周期管理功能，是Stardust纪念平台的核心数据模块。该模块支持逝者档案创建、关系管理、内容管理、分类申请、权限控制等功能，并与墓位系统深度集成。整合了text和media两个子模块，统一管理逝者相关的文本和媒体内容。

## 核心功能

### 1. 逝者档案管理

#### 1.1 档案创建
- **UTF-8全编码**: 支持全球各种语言的姓名编写
- **墓位绑定**: 逝者创建时必须指定所属墓位
- **唯一令牌**: 自动生成`deceased_token`用于索引和引用
- **版本控制**: 每次修改自动增加版本号便于审计

```rust
pub fn create_deceased(
    origin: OriginFor<T>,
    grave_id: T::GraveId,
    name: BoundedVec<u8, T::StringLimit>,
    gender: Gender,
    birth_ts: Option<BoundedVec<u8, T::StringLimit>>,
    death_ts: Option<BoundedVec<u8, T::StringLimit>>,
    name_full_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    main_image_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    links: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>,
) -> DispatchResult
```

#### 1.2 令牌生成机制（Phase 2.0：全UTF-8编码）
逝者令牌采用确定性算法生成，确保全球唯一性：

**格式**: `{性别}{出生日期}{死亡日期}{姓名明文}`

**示例**:
- `M1981122420250901刘晓东` (男，1981-12-24生，2025-09-01逝，姓名：刘晓东)
- `F1980010120250115王芳` (女，1980-01-01生，2025-01-15逝，姓名：王芳)
- `F0000000000000000张三` (女，无日期信息，姓名：张三)

**设计变更（Phase 2.0）**:
- ✅ **改用明文**: 姓名直接使用UTF-8明文，不再使用blake2哈希
- ✅ **前端友好**: 整个token可直接UTF-8解码，无二进制数据
- ✅ **可读性强**: 便于调试、日志查看、用户理解
- ✅ **唯一性保证**: 性别+出生+逝世+姓名的组合仍保证全局唯一
- ✅ **二元性别**: 简化为M/F（男/女），移除B（保密）

#### 1.3 档案更新
- **权限控制**: 仅档案所有者可更新基础信息
- **版本追踪**: 每次更新自动增加版本号
- **IPFS集成**: 自动固定新的CID内容

### 2. 逝者迁移系统（Phase 1.5新增）

#### 2.1 迁移功能
- **自由迁移**: 逝者所有者可以将逝者迁移到不同墓位
- **准入控制**: 目标墓位必须满足准入策略要求
- **同步机制**: 自动同步grave pallet的Interments记录

```rust
pub fn transfer_deceased(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    new_grave_id: T::GraveId,
    slot: Option<u16>,
    note_cid: Option<BoundedVec<u8, T::TokenLimit>>,
) -> DispatchResult
```

#### 2.2 准入策略检查
与`pallet-stardust-grave`集成，支持三种准入策略：
- **OwnerOnly**: 仅墓主可以接收迁入
- **Public**: 任何人可以迁入
- **Whitelist**: 仅白名单用户可以迁入

解决P0问题：防止逝者强行挤入私人墓位

### 3. 逝者关系管理

#### 3.1 关系类型
支持多种逝者间关系：
- **父子关系**: 0-父子，1-子父
- **夫妻关系**: 2-配偶
- **其他关系**: 可扩展的关系类型系统

#### 3.2 关系建立流程
- **提议阶段**: 任意方可发起关系绑定提议
- **审批机制**: 目标逝者所有者确认关系
- **撤销机制**: 双方均可撤销已建立的关系

```rust
pub fn propose_relation(
    origin: OriginFor<T>,
    from_id: T::DeceasedId,
    to_id: T::DeceasedId,
    relation_kind: u8,
    note_cid: Option<BoundedVec<u8, T::TokenLimit>>,
) -> DispatchResult
```

### 4. 分类申请系统

#### 4.1 分类体系
- **Ordinary**: 普通民众（默认分类）
- **HistoricalFigure**: 历史人物
- **Martyr**: 革命烈士
- **Hero**: 英雄模范
- **PublicFigure**: 公众人物
- **ReligiousFigure**: 宗教人物
- **EventHall**: 事件纪念馆

#### 4.2 申请流程
- **押金制度**: 提交申请需冻结押金（10 DUST）
- **委员会审核**: 通过治理机制进行投票审核
- **自动执行**: 审核通过后自动修改分类
- **押金处理**: 通过退全额，拒绝退50%

```rust
pub fn submit_category_change_request(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    target_category: DeceasedCategory,
    reason_cid: BoundedVec<u8, ConstU32<64>>,
    evidence_cids: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<10>>,
) -> DispatchResult
```

### 5. 关注系统

#### 5.1 关注机制
- **关注逝者**: 用户可以关注感兴趣的逝者档案
- **容量限制**: 每个逝者最多`MaxFollowers`个关注者
- **押金保护**: 防止恶意刷关注

#### 5.2 推送功能
- **更新通知**: 逝者档案更新时通知关注者
- **关系变化**: 关系建立/撤销时通知相关用户

### 6. 内容管理系统

#### 6.1 文本内容 (text模块)
- **传记文章**: 支持长篇传记内容
- **留言板**: 用户可留言缅怀
- **悼词集**: 专业悼词文集
- **投诉机制**: 内容审核和投诉处理

#### 6.2 媒体内容 (media模块)
- **相册管理**: 多相册系统管理照片
- **视频集管理**: 纪念视频组织和播放
- **音频管理**: 音频文件管理系统
- **IPFS集成**: 自动固定媒体CID

### 7. IPFS自动固定

#### 7.1 自动Pin机制
- **主图CID**: 逝者头像自动固定
- **全名CID**: 完整姓名信息自动固定
- **媒体CID**: 相关媒体内容自动固定

#### 7.2 费用处理
- **自动计费**: 根据`DefaultStoragePrice`自动计算费用
- **失败容错**: Pin失败时记录日志但不阻断操作
- **余额检查**: 确保账户余额充足

### 8. 查询接口系统 (Phase 2.2新增)

#### 8.1 核心查询接口
支持多种查询方式，满足前端不同使用场景：

**1. 单个逝者查询**
```rust
pub fn get_deceased_by_id(deceased_id: T::DeceasedId) -> Option<Deceased<T>>
```
- **功能**: 根据逝者ID查询完整的逝者信息
- **权限**: 自动处理可见性验证
- **用途**: 逝者详情页展示，单个逝者信息验证

**2. 分页查询**
```rust
pub fn get_deceased_paginated(
    start_id: Option<T::DeceasedId>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)>
```
- **功能**: 按ID升序返回所有可见逝者
- **限制**: 单次查询最多100个结果
- **过滤**: 自动跳过不可见的逝者
- **用途**: 逝者列表页分页展示，数据导出同步

**3. Token查询**
```rust
pub fn get_deceased_by_token(token: &[u8]) -> Option<(T::DeceasedId, Deceased<T>)>
```
- **功能**: 根据唯一token标识查询逝者
- **索引**: 复用现有的 DeceasedIdByToken 存储
- **用途**: 外部系统集成，API接口调用

#### 8.2 查询特性
- **可见性控制**: 所有查询都经过权限检查和可见性验证
- **性能优化**: 设置合理的查询限制，避免单次查询过大
- **权限安全**: 默认公开可见策略，支持隐私控制
- **错误处理**: 优雅处理不存在或无权限访问的情况

#### 8.3 使用示例

**前端TypeScript集成**:
```typescript
// 查询单个逝者
const deceased = await api.query.deceased.deceasedOf(deceasedId);

// 分页查询逝者列表
const deceasedList = await api.call.deceased.getDeceasedPaginated(startId, 20);

// 按分类查询逝者列表（Phase 2.3新增）
const heroList = await api.call.deceased.getDeceasedByCategory(DeceasedCategory.Hero, null, 10);

// 通过token查询
const result = await api.call.deceased.getDeceasedByToken(token);
```

**Rust代码调用**:
```rust
// 获取单个逝者信息
let deceased = Pallet::<T>::get_deceased_by_id(deceased_id);

// 分页获取逝者列表
let deceased_list = Pallet::<T>::get_deceased_paginated(None, 50);

// 按分类查询逝者列表（Phase 2.3新增）
let hero_list = Pallet::<T>::get_deceased_by_category(DeceasedCategory::Hero, None, 10);

// 通过token获取逝者
let (id, deceased) = Pallet::<T>::get_deceased_by_token(&token)?;

// 按创建时间查询逝者列表（Phase 2.4新增）
let recent_list = Pallet::<T>::get_deceased_by_creation_time(None, 10);

// 按生日月份查询逝者列表（Phase 2.4新增）
let birthday_list = Pallet::<T>::get_deceased_by_birthday_month(12, 5);
```

### 9. 分类查询系统 (Phase 2.3新增)

#### 9.1 核心查询接口
支持按逝者分类筛选查询，满足纪念馆分类浏览需求：

**分类查询接口**
```rust
pub fn get_deceased_by_category(
    category: DeceasedCategory,
    start_index: Option<usize>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)>
```
- **功能**: 根据逝者分类筛选并分页返回
- **参数**:
  - `category`: 逝者分类枚举
  - `start_index`: 起始索引位置（可选）
  - `limit`: 每页数量限制（最大50）
- **返回**: 符合分类的逝者列表
- **用途**: 纪念馆分类浏览功能

#### 9.2 分类索引优化
为提高分类查询性能，新增专用存储索引：

```rust
/// 按分类索引逝者（优化分类查询性能）
pub type DeceasedByCategory<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    DeceasedCategory,
    BoundedVec<u64, ConstU32<1000>>, // 单个分类最多1000个逝者
    ValueQuery,
>;
```

**索引维护策略**:
- **自动维护**: 创建逝者时自动添加到 Ordinary 分类索引
- **分类变更**: 治理批准分类修改时自动更新索引
- **容量限制**: 单个分类最多1000个逝者，超出时静默忽略
- **降级策略**: 索引满载不影响现有功能，仍可通过全量扫描查询

#### 9.3 索引维护函数
提供内部索引维护工具：

```rust
// 添加逝者到分类索引
pub fn add_to_category_index(category: DeceasedCategory, deceased_id_u64: u64)

// 从分类索引中移除逝者
pub fn remove_from_category_index(category: DeceasedCategory, deceased_id_u64: u64)

// 分类变更时更新索引
pub fn update_category_index(
    old_category: DeceasedCategory,
    new_category: DeceasedCategory,
    deceased_id_u64: u64
)
```

#### 9.4 查询特性
- **可见性控制**: 自动过滤不可见的逝者
- **性能优化**: 基于索引查询，避免全表扫描
- **分页支持**: 支持索引位置分页，便于大量数据浏览
- **错误处理**: 优雅处理索引不存在或空分类的情况

#### 9.5 使用示例

**前端分类浏览组件**:
```typescript
// 获取英雄分类的逝者
const loadHeroes = async (startIndex?: number) => {
  const heroList = await api.call.deceased.getDeceasedByCategory(
    DeceasedCategory.Hero,
    startIndex,
    20
  );
  return heroList;
};

// 获取烈士分类的逝者
const loadMartyrs = async () => {
  return await api.call.deceased.getDeceasedByCategory(
    DeceasedCategory.Martyr,
    null,
    10
  );
};
```

**Rust业务逻辑**:
```rust
// 查询某分类下的逝者数量
let hero_count = Pallet::<T>::get_deceased_by_category(
    DeceasedCategory::Hero, None, 1000
).len();

// 分页获取历史人物
let historical_figures = Pallet::<T>::get_deceased_by_category(
    DeceasedCategory::HistoricalFigure,
    Some(20), // 从索引20开始
    10
);
```

**性能对比**:
- **索引查询**: O(分类内逝者数量) - 快速
- **全量扫描**: O(总逝者数量) - 较慢
- **内存开销**: 每个分类约4KB存储(1000个ID * 8字节)

### 10. 时间查询系统 (Phase 2.4新增)

#### 10.1 核心查询接口
支持按创建时间和生日排序查询，满足时间维度浏览需求：

**创建时间查询接口**
```rust
pub fn get_deceased_by_creation_time(
    start_block: Option<BlockNumberFor<T>>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>, BlockNumberFor<T>)>
```
- **功能**: 按创建时间倒序返回逝者（最新的在前）
- **参数**:
  - `start_block`: 起始区块号（可选，默认当前块）
  - `limit`: 返回数量限制（最大20）
- **返回**: 逝者信息及创建时间元组
- **用途**: "最新逝者"、"近期纪念"等时序功能

**生日查询接口**
```rust
pub fn get_deceased_by_birthday_month(
    month: u8,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)>
```
- **功能**: 根据生日月份查询逝者
- **参数**:
  - `month`: 目标月份（1-12）
  - `limit`: 返回数量限制（最大10）
- **返回**: 符合月份的逝者列表
- **用途**: 生日纪念、节日缅怀等功能

#### 10.2 时间索引优化
为提高时间查询性能，新增专用存储索引：

```rust
/// 按创建时间索引逝者（支持时间排序查询）
pub type DeceasedByCreationTime<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BlockNumberFor<T>,
    BoundedVec<u64, ConstU32<100>>, // 单个区块最多100个逝者
    ValueQuery,
>;
```

**索引维护策略**:
- **自动维护**: 创建逝者时自动添加到时间索引
- **区块粒度**: 使用区块号作为时间粒度标识
- **容量限制**: 单个区块最多100个逝者，超出时静默忽略
- **倒序查询**: 从最新区块向历史区块查找

#### 10.3 索引维护函数
提供内部时间索引维护工具：

```rust
// 添加逝者到时间索引
pub fn add_to_creation_time_index(block_number: BlockNumberFor<T>, deceased_id_u64: u64)
```

#### 10.4 日期解析能力
生日查询支持多种日期格式解析：

- **YYYYMMDD 格式**: `19901225` (1990年12月25日)
- **YYYY-MM-DD 格式**: `1985-01-15` (1985年1月15日)
- **YYYY/MM/DD 格式**: `1992/06/30` (1992年6月30日)
- **MM-DD 格式**: `03-20` (3月20日)
- **MM/DD 格式**: `11/05` (11月5日)

#### 10.5 查询特性
- **可见性控制**: 自动过滤不可见的逝者
- **性能优化**: 基于区块索引查询，避免全表扫描
- **分页支持**: 支持时间范围和数量限制分页
- **错误处理**: 优雅处理无效参数和空结果

#### 10.6 使用示例

**前端时间浏览组件**:
```typescript
// 获取最新的逝者
const loadRecentDeceased = async () => {
  const recentList = await api.call.deceased.getDeceasedByCreationTime(
    null, // 从最新区块开始
    10
  );
  return recentList;
};

// 获取12月生日的逝者
const loadDecemberBirthdays = async () => {
  return await api.call.deceased.getDeceasedByBirthdayMonth(12, 5);
};
```

**Rust业务逻辑**:
```rust
// 查询最近一周的逝者（假设168个区块约1周）
let week_ago_block = current_block.saturating_sub(168u32.into());
let recent_deceased = Pallet::<T>::get_deceased_by_creation_time(
    Some(week_ago_block),
    20
);

// 查询当前月份生日的逝者
let current_month = 12u8; // 假设当前是12月
let birthday_list = Pallet::<T>::get_deceased_by_birthday_month(
    current_month,
    10
);
```

**性能特点**:
- **时间查询**: O(查询区块数 * 区块内逝者数量) - 高效
- **生日查询**: O(总逝者数量) - 计算密集，建议缓存
- **内存开销**: 每个区块约800字节存储(100个ID * 8字节)

## 数据结构

### 核心结构

```rust
// 逝者档案
pub struct Deceased<T: Config> {
    pub grave_id: T::GraveId,                    // 所属墓位ID
    pub owner: T::AccountId,                     // 档案拥有者
    pub creator: T::AccountId,                   // 创建者（不可变）
    pub name: BoundedVec<u8, T::StringLimit>,    // 姓名
    pub gender: Gender,                          // 性别（M/F）
    pub name_full_cid: Option<BoundedVec<u8, T::TokenLimit>>, // 全名CID
    pub birth_ts: Option<BoundedVec<u8, T::StringLimit>>,     // 出生日期
    pub death_ts: Option<BoundedVec<u8, T::StringLimit>>,     // 死亡日期
    pub main_image_cid: Option<BoundedVec<u8, T::TokenLimit>>, // 主图CID
    pub deceased_token: BoundedVec<u8, T::TokenLimit>,        // 唯一令牌
    pub links: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>, // 外部链接
    pub created: BlockNumberFor<T>,              // 创建时间
    pub updated: BlockNumberFor<T>,              // 更新时间
    pub version: u32,                            // 版本号
}

// 性别枚举
pub enum Gender {
    M,  // 男性
    F,  // 女性
}

// 逝者分类
pub enum DeceasedCategory {
    Ordinary = 0,         // 普通民众
    HistoricalFigure = 1, // 历史人物
    Martyr = 2,           // 革命烈士
    Hero = 3,             // 英雄模范
    PublicFigure = 4,     // 公众人物
    ReligiousFigure = 5,  // 宗教人物
    EventHall = 6,        // 事件纪念馆
}

// 分类修改申请
pub struct CategoryChangeRequest<T: Config> {
    pub applicant: T::AccountId,                 // 申请人
    pub deceased_id: u64,                        // 逝者ID
    pub current_category: DeceasedCategory,      // 当前分类
    pub target_category: DeceasedCategory,       // 目标分类
    pub reason_cid: BoundedVec<u8, ConstU32<64>>, // 申请理由CID
    pub evidence_cids: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<10>>, // 证据CID列表
    pub submitted_at: BlockNumberFor<T>,         // 申请时间
    pub deadline: BlockNumberFor<T>,             // 截止时间
    pub status: RequestStatus,                   // 申请状态
}

// 逝者关系
pub struct DeceasedRelation<T: Config> {
    pub from_id: T::DeceasedId,                  // 关系发起方
    pub to_id: T::DeceasedId,                    // 关系接收方
    pub relation_kind: u8,                       // 关系类型
    pub note_cid: Option<BoundedVec<u8, T::TokenLimit>>, // 关系备注CID
    pub confirmed: bool,                         // 是否已确认
    pub created_at: BlockNumberFor<T>,           // 建立时间
}
```

### 存储项

```rust
// 核心存储
NextDeceasedId<T>: T::DeceasedId                // 下一个逝者ID
DeceasedRecords<T>: T::DeceasedId => Option<Deceased<T>> // 逝者档案映射
DeceasedByGrave<T>: T::GraveId => Vec<T::DeceasedId>     // 墓位逝者索引
DeceasedOwner<T>: T::DeceasedId => Option<T::AccountId>  // 逝者所有者映射

// 分类系统
DeceasedCategories<T>: T::DeceasedId => DeceasedCategory // 逝者分类
CategoryChangeRequests<T>: u64 => Option<CategoryChangeRequest<T>> // 分类申请
NextRequestId<T>: u64                           // 下一个申请ID
RequestsByDeceased<T>: T::DeceasedId => Vec<u64> // 逝者申请索引

// Phase 2.3新增：分类查询优化
DeceasedByCategory<T>: DeceasedCategory => BoundedVec<u64, ConstU32<1000>> // 分类索引（最多1000个/分类）

// Phase 2.4新增：时间查询优化
DeceasedByCreationTime<T>: BlockNumberFor<T> => BoundedVec<u64, ConstU32<100>> // 时间索引（最多100个/区块）

// 关系系统
DeceasedRelations<T>: (T::DeceasedId, T::DeceasedId) => Option<DeceasedRelation<T>>
RelationProposals<T>: (T::DeceasedId, T::DeceasedId) => Option<DeceasedRelation<T>>
RelationsByDeceased<T>: T::DeceasedId => Vec<T::DeceasedId>

// 关注系统
DeceasedFollowers<T>: T::DeceasedId => BoundedVec<T::AccountId, T::MaxFollowers>
FollowedDeceased<T>: T::AccountId => Vec<T::DeceasedId>

// 可见性控制
PublicDeceased<T>: T::DeceasedId => bool        // 是否公开可见

// Text模块存储
NextTextId<T>: T::TextId                        // 下一个文本ID
Articles<T>: T::TextId => Option<Article<T>>    // 传记文章
Messages<T>: T::TextId => Option<Message<T>>    // 留言
Eulogies<T>: T::TextId => Option<Eulogy<T>>     // 悼词
MessagesByDeceased<T>: T::DeceasedId => BoundedVec<T::TextId, T::MaxMessagesPerDeceased>
EulogiesByDeceased<T>: T::DeceasedId => BoundedVec<T::TextId, T::MaxEulogiesPerDeceased>

// Media模块存储
NextAlbumId<T>: T::AlbumId                      // 下一个相册ID
NextVideoCollectionId<T>: T::VideoCollectionId // 下一个视频集ID
NextMediaId<T>: T::MediaId                      // 下一个媒体ID
Albums<T>: T::AlbumId => Option<Album<T>>       // 相册信息
VideoCollections<T>: T::VideoCollectionId => Option<VideoCollection<T>>
Photos<T>: T::MediaId => Option<Photo<T>>       // 照片
Videos<T>: T::MediaId => Option<Video<T>>       // 视频
Audios<T>: T::MediaId => Option<Audio<T>>       // 音频
AlbumsByDeceased<T>: T::DeceasedId => BoundedVec<T::AlbumId, T::MaxAlbumsPerDeceased>
VideoCollectionsByDeceased<T>: T::DeceasedId => BoundedVec<T::VideoCollectionId, T::MaxVideoCollectionsPerDeceased>
```

## 主要调用方法

### 档案管理类

```rust
// 创建逝者档案
create_deceased(
    grave_id: T::GraveId,
    name: BoundedVec<u8, T::StringLimit>,
    gender: Gender,
    birth_ts: Option<BoundedVec<u8, T::StringLimit>>,
    death_ts: Option<BoundedVec<u8, T::StringLimit>>,
    name_full_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    main_image_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    links: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>
)

// 更新逝者档案
update_deceased(
    deceased_id: T::DeceasedId,
    name: Option<BoundedVec<u8, T::StringLimit>>,
    birth_ts: Option<BoundedVec<u8, T::StringLimit>>,
    death_ts: Option<BoundedVec<u8, T::StringLimit>>,
    name_full_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    links: Option<BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>>
)

// 迁移逝者到新墓位
transfer_deceased(
    deceased_id: T::DeceasedId,
    new_grave_id: T::GraveId,
    slot: Option<u16>,
    note_cid: Option<BoundedVec<u8, T::TokenLimit>>
)

// 设置主图
set_main_image(
    deceased_id: T::DeceasedId,
    main_image_cid: Option<BoundedVec<u8, T::TokenLimit>>
)

// 设置可见性
set_visibility(
    deceased_id: T::DeceasedId,
    is_public: bool
)
```

### 关系管理类

```rust
// 提议建立关系
propose_relation(
    from_id: T::DeceasedId,
    to_id: T::DeceasedId,
    relation_kind: u8,
    note_cid: Option<BoundedVec<u8, T::TokenLimit>>
)

// 批准关系提议
approve_relation(
    from_id: T::DeceasedId,
    to_id: T::DeceasedId
)

// 拒绝关系提议
reject_relation(
    from_id: T::DeceasedId,
    to_id: T::DeceasedId
)

// 撤销关系
revoke_relation(
    from_id: T::DeceasedId,
    to_id: T::DeceasedId
)

// 取消关系提议
cancel_relation_proposal(
    from_id: T::DeceasedId,
    to_id: T::DeceasedId
)

// 更新关系备注
update_relation_note(
    from_id: T::DeceasedId,
    to_id: T::DeceasedId,
    note_cid: Option<BoundedVec<u8, T::TokenLimit>>
)
```

### 分类申请类

```rust
// 提交分类修改申请
submit_category_change_request(
    deceased_id: T::DeceasedId,
    target_category: DeceasedCategory,
    reason_cid: BoundedVec<u8, ConstU32<64>>,
    evidence_cids: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<10>>
)

// 处理分类申请（治理）
process_category_change_request(
    request_id: u64,
    approved: bool
)

// 撤销分类申请
cancel_category_change_request(
    request_id: u64
)
```

### 关注系统类

```rust
// 关注逝者
follow_deceased(
    deceased_id: T::DeceasedId
)

// 取消关注逝者
unfollow_deceased(
    deceased_id: T::DeceasedId
)
```

### 文本内容类

```rust
// 创建传记文章
create_article(
    deceased_id: T::DeceasedId,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    content_cid: BoundedVec<u8, ConstU32<64>>,
    category: u8
)

// 发布留言
post_message(
    deceased_id: T::DeceasedId,
    content_cid: BoundedVec<u8, ConstU32<64>>,
    reply_to: Option<T::TextId>
)

// 发布悼词
post_eulogy(
    deceased_id: T::DeceasedId,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    content_cid: BoundedVec<u8, ConstU32<64>>,
    author_info_cid: BoundedVec<u8, ConstU32<64>>
)
```

### 媒体管理类

```rust
// 创建相册
create_album(
    deceased_id: T::DeceasedId,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    description_cid: Option<BoundedVec<u8, ConstU32<64>>>,
    cover_cid: Option<BoundedVec<u8, ConstU32<64>>>
)

// 添加照片
add_photo(
    album_id: T::AlbumId,
    image_cid: BoundedVec<u8, ConstU32<64>>,
    caption_cid: Option<BoundedVec<u8, ConstU32<64>>>
)

// 创建视频集
create_video_collection(
    deceased_id: T::DeceasedId,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    description_cid: Option<BoundedVec<u8, ConstU32<64>>>
)

// 添加视频
add_video(
    collection_id: T::VideoCollectionId,
    video_cid: BoundedVec<u8, ConstU32<64>>,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    description_cid: Option<BoundedVec<u8, ConstU32<64>>>
)

// 添加音频
add_audio(
    deceased_id: T::DeceasedId,
    audio_cid: BoundedVec<u8, ConstU32<64>>,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    description_cid: Option<BoundedVec<u8, ConstU32<64>>>
)
```

### 查询接口类 (Phase 2.3新增)

```rust
// 查询单个逝者
get_deceased_by_id(
    deceased_id: T::DeceasedId
) -> Option<Deceased<T>>

// 分页查询所有逝者
get_deceased_paginated(
    start_id: Option<T::DeceasedId>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)>

// 按分类分页查询逝者
get_deceased_by_category(
    category: DeceasedCategory,
    start_index: Option<usize>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)>

// 通过token查询逝者
get_deceased_by_token(
    token: &[u8]
) -> Option<(T::DeceasedId, Deceased<T>)>

// 按创建时间分页查询逝者 (Phase 2.4新增)
get_deceased_by_creation_time(
    start_block: Option<BlockNumberFor<T>>,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>, BlockNumberFor<T>)>

// 按生日月份查询逝者 (Phase 2.4新增)
get_deceased_by_birthday_month(
    month: u8,
    limit: u32
) -> Vec<(T::DeceasedId, Deceased<T>)>
```

### 治理调用类

```rust
// 治理转移所有权
gov_transfer_ownership(
    deceased_id: T::DeceasedId,
    new_owner: T::AccountId,
    evidence_cid: BoundedVec<u8, T::TokenLimit>
)

// 治理设置主图
gov_set_main_image(
    deceased_id: T::DeceasedId,
    main_image_cid: Option<BoundedVec<u8, T::TokenLimit>>,
    evidence_cid: BoundedVec<u8, T::TokenLimit>
)

// 治理记录证据
gov_note_evidence(
    deceased_id: T::DeceasedId,
    evidence_cid: BoundedVec<u8, T::TokenLimit>
)
```

## 事件定义

```rust
pub enum Event<T: Config> {
    // 档案生命周期事件
    DeceasedCreated(T::DeceasedId, T::GraveId, T::AccountId),
    DeceasedUpdated(T::DeceasedId),
    VisibilityChanged(T::DeceasedId, bool),
    DeceasedTransferred(T::DeceasedId, T::GraveId, T::GraveId),

    // 关系管理事件
    RelationProposed(T::DeceasedId, T::DeceasedId, u8),
    RelationApproved(T::DeceasedId, T::DeceasedId, u8),
    RelationRejected(T::DeceasedId, T::DeceasedId),
    RelationProposalCancelled(T::DeceasedId, T::DeceasedId, u8),
    RelationRevoked(T::DeceasedId, T::DeceasedId),
    RelationUpdated(T::DeceasedId, T::DeceasedId),

    // 内容管理事件
    MainImageUpdated(T::DeceasedId, T::AccountId, bool),
    AutoPinSuccess(T::DeceasedId, BoundedVec<u8, T::TokenLimit>, u8),
    AutoPinFailed(T::DeceasedId, BoundedVec<u8, T::TokenLimit>, u8, u8),

    // 关注系统事件
    DeceasedFollowed { deceased_id: T::DeceasedId, who: T::AccountId },
    DeceasedUnfollowed { deceased_id: T::DeceasedId, who: T::AccountId },

    // 分类申请事件
    CategoryChangeRequested {
        request_id: u64,
        deceased_id: T::DeceasedId,
        applicant: T::AccountId,
        target_category: DeceasedCategory,
    },
    CategoryChangeProcessed {
        request_id: u64,
        deceased_id: T::DeceasedId,
        approved: bool,
        new_category: Option<DeceasedCategory>,
    },
    CategoryChangeCancelled { request_id: u64, deceased_id: T::DeceasedId },

    // 治理事件
    GovEvidenceNoted(T::DeceasedId, BoundedVec<u8, T::TokenLimit>),
    GovMainImageSet(T::DeceasedId, bool),
    OwnerTransferred(T::DeceasedId, T::AccountId, T::AccountId),

    // Text模块事件
    ArticleCreated { article_id: T::TextId, deceased_id: T::DeceasedId, author: T::AccountId },
    MessagePosted { message_id: T::TextId, deceased_id: T::DeceasedId, author: T::AccountId },
    EulogyPosted { eulogy_id: T::TextId, deceased_id: T::DeceasedId, author: T::AccountId },
    TextComplaintSubmitted { text_id: T::TextId, complainant: T::AccountId },

    // Media模块事件
    AlbumCreated { album_id: T::AlbumId, deceased_id: T::DeceasedId, owner: T::AccountId },
    PhotoAdded { photo_id: T::MediaId, album_id: T::AlbumId },
    VideoCollectionCreated { collection_id: T::VideoCollectionId, deceased_id: T::DeceasedId },
    VideoAdded { video_id: T::MediaId, collection_id: T::VideoCollectionId },
    AudioAdded { audio_id: T::MediaId, deceased_id: T::DeceasedId },
}
```

## 错误定义

```rust
pub enum Error<T> {
    // 基础错误
    DeceasedNotFound,            // 逝者不存在
    NotOwner,                    // 非档案所有者
    GraveNotFound,               // 墓位不存在
    NoPermission,                // 权限不足

    // 容量限制错误
    MaxLinksExceeded,            // 超出最大链接数
    MaxFollowersReached,         // 关注者已满
    TooManyMessages,             // 留言数量超限
    TooManyEulogies,             // 悼词数量超限

    // 关系管理错误
    RelationNotFound,            // 关系不存在
    RelationProposalNotFound,    // 关系提议不存在
    RelationAlreadyExists,       // 关系已存在
    SelfRelationNotAllowed,      // 不能与自己建立关系
    InvalidRelationKind,         // 无效的关系类型

    // 分类申请错误
    InvalidCategory,             // 无效分类
    CategoryChangeNotAllowed,    // 不允许分类变更
    RequestNotFound,             // 申请不存在
    RequestAlreadyProcessed,     // 申请已处理
    RequestExpired,              // 申请已过期

    // 关注系统错误
    AlreadyFollowing,            // 已关注
    NotFollowing,                // 未关注
    CannotFollowOwnDeceased,     // 不能关注自己的逝者

    // 内容相关错误
    InvalidCid,                  // 无效CID
    CidTooLong,                  // CID过长
    TextNotFound,                // 文本不存在
    MediaNotFound,               // 媒体不存在

    // 系统错误
    TokenGenerationFailed,       // 令牌生成失败
    InsufficientDeposit,         // 押金不足
    BalanceReserveFailure,       // 余额冻结失败
    AutoPinFailure,              // 自动Pin失败

    // 业务逻辑错误
    GraveAdmissionDenied,        // 墓位准入被拒绝
    TransferToSameGrave,         // 迁移到相同墓位
    SyncFailed,                  // 同步失败
    InvalidTimestamp,            // 无效时间戳
}
```

## 配置参数

```rust
pub trait Config: frame_system::Config {
    // 基础配置
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
    type GraveId: Parameter + Member + Copy + MaxEncodedLen;
    type WeightInfo: WeightInfo;

    // 容量限制
    type StringLimit: Get<u32>;                  // 单字段字符串长度上限
    type TokenLimit: Get<u32>;                   // 令牌最大长度
    type MaxLinks: Get<u32>;                     // 最大外部链接数
    type MaxFollowers: Get<u32>;                 // 最大关注者数

    // Text模块配置
    type TextId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
    type MaxMessagesPerDeceased: Get<u32>;       // 每个逝者最大留言数
    type MaxEulogiesPerDeceased: Get<u32>;       // 每个逝者最大悼词数
    type TextDeposit: Get<BalanceOf<Self>>;      // 文本押金
    type ComplaintDeposit: Get<BalanceOf<Self>>; // 投诉押金
    type ComplaintPeriod: Get<BlockNumberFor<Self>>; // 投诉成熟期
    type ArbitrationAccount: Get<Self::AccountId>; // 仲裁费用接收账户

    // Media模块配置
    type AlbumId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
    type VideoCollectionId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
    type MediaId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
    type MaxAlbumsPerDeceased: Get<u32>;         // 最大相册数
    type MaxVideoCollectionsPerDeceased: Get<u32>; // 最大视频集数
    type MaxPhotosPerAlbum: Get<u32>;            // 每相册最大照片数
    type MaxVideosPerCollection: Get<u32>;       // 每视频集最大视频数
    type MaxAudiosPerDeceased: Get<u32>;         // 最大音频数
    type MediaDeposit: Get<BalanceOf<Self>>;     // 媒体押金

    // 集成接口
    type GraveProvider: GraveInspector<Self::AccountId, Self::GraveId>;
    type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

    // IPFS集成
    type IpfsPinner: pallet_stardust_ipfs::IpfsPinner<Self::AccountId, Self::Balance>;
    type Balance: Parameter + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
    type DefaultStoragePrice: Get<Self::Balance>; // 默认存储单价

    // 货币系统
    type Currency: ReservableCurrency<Self::AccountId>;
}
```

## 使用示例

### 创建逝者档案

```rust
// 创建逝者档案
let name = b"张三".to_vec().try_into().unwrap();
let birth_ts = b"19801010".to_vec().try_into().unwrap();
let death_ts = b"20250101".to_vec().try_into().unwrap();
let name_full_cid = b"QmExampleNameFullCid".to_vec().try_into().unwrap();
let main_image_cid = b"QmExampleImageCid".to_vec().try_into().unwrap();

Pallet::<T>::create_deceased(
    RuntimeOrigin::signed(alice),
    1,                          // grave_id
    name,
    Gender::M,
    Some(birth_ts),
    Some(death_ts),
    Some(name_full_cid),
    Some(main_image_cid),
    Default::default(),         // links
)?;
```

### 建立逝者关系

```rust
// 提议父子关系
Pallet::<T>::propose_relation(
    RuntimeOrigin::signed(alice),
    1,        // from_id (父)
    2,        // to_id (子)
    0,        // relation_kind (父子关系)
    None,     // note_cid
)?;

// 批准关系提议
Pallet::<T>::approve_relation(
    RuntimeOrigin::signed(bob),  // 子的所有者
    1,        // from_id
    2,        // to_id
)?;
```

### 申请分类修改

```rust
// 申请修改为历史人物分类
let reason_cid = b"QmReasonCid".to_vec().try_into().unwrap();
let evidence_cids = vec![
    b"QmEvidence1".to_vec().try_into().unwrap(),
    b"QmEvidence2".to_vec().try_into().unwrap(),
].try_into().unwrap();

Pallet::<T>::submit_category_change_request(
    RuntimeOrigin::signed(alice),
    1,                                    // deceased_id
    DeceasedCategory::HistoricalFigure,   // target_category
    reason_cid,
    evidence_cids,
)?;
```

### 逝者迁移

```rust
// 将逝者迁移到新墓位
let note_cid = b"QmMigrationNote".to_vec().try_into().unwrap();

Pallet::<T>::transfer_deceased(
    RuntimeOrigin::signed(alice),
    1,              // deceased_id
    2,              // new_grave_id
    Some(0),        // slot
    Some(note_cid), // note_cid
)?;
```

## 集成说明

### 1. 与 pallet-stardust-grave 集成
- 通过`GraveInspector` trait实现低耦合集成
- 支持准入策略检查和安葬记录同步
- 维护墓位-逝者双向索引

### 2. 与 pallet-stardust-ipfs 集成
- 自动固定逝者相关CID内容
- 自动计算和支付存储费用
- 支持失败容错和重试机制

### 3. Text和Media模块集成
- 统一的内容管理接口
- 共享押金和权限机制
- 统一的投诉和审核流程

## 最佳实践

### 1. 档案管理
- 确保姓名UTF-8编码正确
- 合理使用CID减少链上存储
- 及时更新档案版本信息

### 2. 关系管理
- 明确关系类型的语义
- 及时处理关系提议
- 维护关系备注信息

### 3. 分类申请
- 提供充分的申请理由
- 上传必要的证据材料
- 关注申请审核进度

### 4. 内容管理
- 合理组织相册和视频集
- 控制媒体内容数量
- 及时处理投诉和争议

## 注意事项

1. **令牌唯一性**: 逝者令牌必须全球唯一，避免冲突
2. **权限控制**: 严格控制档案修改权限
3. **数据同步**: 确保与墓位系统数据同步
4. **费用管理**: 合理设置押金和存储费用
5. **内容审核**: 建立有效的内容投诉机制
6. **性能优化**: 大型墓位需要分页加载

## 路线图

### Phase 1.5 已完成
- ✅ 逝者迁移功能
- ✅ 准入策略集成
- ✅ 数据同步机制
- ✅ 分类申请系统

### Phase 2.0 已完成
- ✅ UTF-8全编码支持
- ✅ 二元性别简化
- ✅ 令牌明文化
- ✅ Text和Media模块整合

### Phase 2.2 已完成
- ✅ 核心查询接口系统
- ✅ 分页查询功能
- ✅ Token查询接口
- ✅ 可见性权限控制

### Phase 2.3 已完成
- ✅ 分类查询功能
- ✅ 分类索引优化
- ✅ 索引自动维护
- ✅ 分类查询文档完善

### Phase 2.4 已完成
- ✅ 时间查询功能
- ✅ 创建时间索引优化
- ✅ 生日查询功能
- ✅ 时间索引维护逻辑
- ✅ 时间查询文档完善

### 未来规划
- 🔄 AI辅助内容审核
- 🔄 多语言国际化
- 🔄 区块链证书系统
- 🔄 跨链数据同步
- 🔄 高级搜索功能
- 🔄 批量操作支持