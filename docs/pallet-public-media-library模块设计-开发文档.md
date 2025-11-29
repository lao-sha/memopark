# pallet-public-media-library 模块设计 - 开发文档

## 文档信息

- **创建时间**: 2025年11月26日
- **版本**: v2.0 (低耦合优化版)
- **作者**: Claude Code 助手
- **文档性质**: 技术架构设计与实现方案
- **目标**: 构建低耦合、高内聚的公共音视频媒体存储与管理系统

---

## 1. 项目背景与需求分析

### 1.1 当前音视频存储现状

```
当前音视频存储分布（未优化）：
┌─────────────────────┬─────────────────────┬─────────────────────┐
│  pallet-deceased    │ smart-group-chat    │ pallet-evidence     │
│  (逝者媒体)         │  (聊天音视频)       │   (证据音视频)      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ - Video/Audio作品   │ - Video/Audio消息   │ - Audio/Video证据   │
│ - 存储策略分散      │ - 量子加密          │ - 完整性保护        │
│ - 重复开发          │ - 文件分享          │ - 证据链管理        │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

### 1.2 核心问题

- ❌ **存储策略不统一**: 每个模块独立处理音视频上传和存储
- ❌ **功能重复开发**: 编码转换、缩略图生成在多处实现
- ❌ **资源浪费严重**: 相同内容多次存储，缺乏智能去重
- ❌ **扩展性受限**: 新增格式需要修改多个模块

### 1.3 公共媒体库目标

构建一个**统一的公共音视频媒体库**，提供：
1. **统一存储接口**: 所有模块通过统一接口存储媒体
2. **智能去重**: 基于内容哈希的去重机制
3. **多分辨率支持**: 自动生成多种分辨率版本
4. **访问控制**: 灵活的权限管理
5. **跨模块共享**: 媒体可在不同业务模块间共享

---

## 2. 架构设计方案

### 2.1 整体架构

```
v2.0 低耦合架构：

┌─────────────────────────────────────────────────────────────────┐
│                   pallet-public-media-library                   │
│                     (音视频媒体库核心)                            │
└─────────────────────────────────────────────────────────────────┘
                               ▲
                               │ 依赖抽象，不依赖具体实现
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│          stardust-media-traits (独立抽象层 crate)                │
├─────────────────────┬─────────────────────┬─────────────────────┤
│ MediaStorageBackend │  DomainRegistry     │ MediaDataProvider   │
│ (存储抽象)           │  (域注册表)          │ (数据访问抽象)       │
└─────────────────────┴─────────────────────┴─────────────────────┘
                               ▲
                               │ 实现抽象接口
                               ▼
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ IpfsStorageAdapter  │ DeceasedDataAdapter │ GroupChatAdapter    │
│ (IPFS存储实现)       │ (逝者数据访问)       │ (群聊数据访问)       │
└─────────────────────┴─────────────────────┴─────────────────────┘
                               ▲
                               │ 使用适配器
                               ▼
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ pallet-stardust-ipfs│  pallet-deceased    │ smart-group-chat    │
│ (具体存储实现)       │  (业务pallet)       │  (业务pallet)       │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

### 2.2 设计原则

1. **依赖倒置原则 (DIP)**: 高层模块不依赖低层模块，均依赖抽象
2. **单一职责原则 (SRP)**: 每个组件只负责一个职责
3. **开闭原则 (OCP)**: 对扩展开放，对修改关闭
4. **接口隔离原则 (ISP)**: 客户端不应依赖不需要的接口

---

## 3. 核心类型定义

### 3.1 媒体ID和域ID

```rust
/// 公共媒体ID - 全局唯一标识符
pub type PublicMediaId = u64;

/// 域ID - 业务域标识（逝者、群聊、证据等）
pub type DomainId = u16;

/// 预定义域ID常量
pub mod well_known_domains {
    use super::DomainId;

    /// 逝者档案域
    pub const DECEASED: DomainId = 1;
    /// 墓位域
    pub const GRAVE: DomainId = 2;
    /// 供奉品域
    pub const OFFERINGS: DomainId = 3;
    /// 证据域
    pub const EVIDENCE: DomainId = 4;
    /// 群组聊天域
    pub const GROUP_CHAT: DomainId = 5;
    /// OTC订单域
    pub const OTC_ORDER: DomainId = 6;

    /// 自定义域起始ID（治理可动态分配）
    pub const CUSTOM_DOMAIN_START: DomainId = 100;
}
```

### 3.2 媒体类型

```rust
/// 媒体类型枚举
#[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum MediaType {
    /// 图片
    Image,
    /// 视频
    Video,
    /// 音频
    Audio,
    /// 文档
    Document,
}

/// 媒体格式
#[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum MediaFormat {
    // 图片格式
    JPEG,
    PNG,
    GIF,
    WebP,
    AVIF,

    // 视频格式
    MP4,
    WebM,
    MOV,

    // 音频格式
    MP3,
    AAC,
    OGG,
    WAV,
    FLAC,

    // 文档格式
    PDF,

    /// 未知格式
    Unknown,
}

impl MediaFormat {
    /// 获取对应的媒体类型
    pub fn media_type(&self) -> MediaType {
        match self {
            Self::JPEG | Self::PNG | Self::GIF | Self::WebP | Self::AVIF => MediaType::Image,
            Self::MP4 | Self::WebM | Self::MOV => MediaType::Video,
            Self::MP3 | Self::AAC | Self::OGG | Self::WAV | Self::FLAC => MediaType::Audio,
            Self::PDF => MediaType::Document,
            Self::Unknown => MediaType::Document,
        }
    }

    /// 获取MIME类型
    pub fn mime_type(&self) -> &'static str {
        match self {
            Self::JPEG => "image/jpeg",
            Self::PNG => "image/png",
            Self::GIF => "image/gif",
            Self::WebP => "image/webp",
            Self::AVIF => "image/avif",
            Self::MP4 => "video/mp4",
            Self::WebM => "video/webm",
            Self::MOV => "video/quicktime",
            Self::MP3 => "audio/mpeg",
            Self::AAC => "audio/aac",
            Self::OGG => "audio/ogg",
            Self::WAV => "audio/wav",
            Self::FLAC => "audio/flac",
            Self::PDF => "application/pdf",
            Self::Unknown => "application/octet-stream",
        }
    }
}
```

### 3.3 公共媒体信息结构

```rust
/// 公共媒体信息 - 存储在链上的媒体元数据
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
#[scale_info(skip_type_params(T))]
pub struct PublicMediaInfo<T: Config> {
    /// 媒体ID
    pub id: PublicMediaId,
    /// 上传者
    pub uploader: T::AccountId,
    /// 媒体类型
    pub media_type: MediaType,
    /// 媒体格式
    pub format: MediaFormat,
    /// 文件大小（字节）
    pub file_size: u64,
    /// 内容哈希（Blake2-256，用于去重）
    pub content_hash: [u8; 32],
    /// 存储CID（IPFS CID）
    pub storage_cid: BoundedVec<u8, ConstU32<128>>,
    /// 缩略图CID（可选）
    pub thumbnail_cid: Option<BoundedVec<u8, ConstU32<128>>>,
    /// 图片/视频宽度
    pub width: Option<u32>,
    /// 图片/视频高度
    pub height: Option<u32>,
    /// 视频/音频时长（秒）
    pub duration_secs: Option<u32>,
    /// 比特率（kbps）
    pub bitrate: Option<u32>,
    /// 帧率（fps，仅视频）
    pub fps: Option<u8>,
    /// 访问策略
    pub access_policy: AccessPolicy,
    /// 存储配置
    pub storage_config: StorageConfiguration,
    /// 引用计数（被多少实体关联）
    pub reference_count: u32,
    /// 创建时间（区块号）
    pub created_at: BlockNumberFor<T>,
    /// 最后更新时间
    pub updated_at: BlockNumberFor<T>,
    /// 状态
    pub status: MediaStatus,
}

/// 媒体状态
#[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug, Default)]
pub enum MediaStatus {
    /// 处理中（上传完成，等待转码等）
    Processing,
    /// 正常可用
    #[default]
    Active,
    /// 已归档（不再活跃但保留）
    Archived,
    /// 已删除（软删除）
    Deleted,
    /// 被举报/待审核
    Flagged,
}
```

### 3.4 访问策略

```rust
/// 访问策略
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug, Default)]
pub enum AccessPolicy {
    /// 公开 - 任何人可访问
    #[default]
    Public,
    /// 不公开 - 有链接可访问，但不出现在搜索中
    Unlisted,
    /// 私有 - 仅所有者和授权用户可访问
    Private,
    /// 域限制 - 仅特定域的用户可访问
    DomainRestricted {
        allowed_domains: BoundedVec<DomainId, ConstU32<16>>,
    },
    /// 白名单 - 仅白名单用户可访问
    Whitelist {
        allowed_accounts: BoundedVec<[u8; 32], ConstU32<64>>,  // AccountId hash
    },
}
```

### 3.5 存储配置

```rust
/// 存储配置 - 定义媒体的存储策略
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub struct StorageConfiguration {
    /// 冗余级别（1-10，对应副本数）
    pub redundancy_level: u8,
    /// 持久性要求（期望保存时长，小时数）
    pub durability_hours: u32,
    /// 可用性要求（千分比：999 = 99.9%）
    pub availability_permille: u16,
    /// 健康检查频率（秒）
    pub health_check_interval_secs: u32,
    /// 优先级（0-255，越高越重要）
    pub priority: u8,
}

impl Default for StorageConfiguration {
    fn default() -> Self {
        Self {
            redundancy_level: 3,           // 3副本
            durability_hours: 87600,       // 10年
            availability_permille: 999,    // 99.9%
            health_check_interval_secs: 86400, // 24小时
            priority: 128,                 // 中等优先级
        }
    }
}

/// 预设存储配置
impl StorageConfiguration {
    /// 关键数据 - 高冗余高可用
    pub fn critical() -> Self {
        Self {
            redundancy_level: 5,
            durability_hours: 876000,  // 100年
            availability_permille: 9999, // 99.99%
            health_check_interval_secs: 3600, // 1小时
            priority: 255,
        }
    }

    /// 标准数据
    pub fn standard() -> Self {
        Self::default()
    }

    /// 临时数据 - 低冗余
    pub fn temporary() -> Self {
        Self {
            redundancy_level: 1,
            durability_hours: 720,  // 30天
            availability_permille: 990, // 99%
            health_check_interval_secs: 86400,
            priority: 64,
        }
    }
}
```

### 3.6 媒体关联关系

```rust
/// 媒体关联关系类型
#[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum MediaRelationshipType {
    /// 主要媒体（如逝者的主照片）
    Primary,
    /// 封面图
    Cover,
    /// 缩略图
    Thumbnail,
    /// 附件
    Attachment,
    /// 画廊/相册项
    GalleryItem,
    /// 视频集项
    VideoCollectionItem,
    /// 作品（音乐/视频作品）
    Work,
    /// 证据
    Evidence,
    /// 聊天消息媒体
    ChatMessage,
    /// 其他
    Other,
}

/// 实体媒体关联记录
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub struct EntityMediaAssociation {
    /// 媒体ID
    pub media_id: PublicMediaId,
    /// 关联类型
    pub relationship: MediaRelationshipType,
    /// 排序索引
    pub order_index: u32,
    /// 关联时间
    pub associated_at: u64,  // 时间戳
    /// 关联元数据（如标题、描述等）
    pub metadata: Option<BoundedVec<u8, ConstU32<512>>>,
}
```

---

## 4. 存储设计

### 4.1 主要存储项

```rust
/// 公共媒体注册表 - 存储所有媒体的元数据
/// Key: PublicMediaId
/// Value: PublicMediaInfo
#[pallet::storage]
pub type PublicMediaRegistry<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    PublicMediaId,
    PublicMediaInfo<T>,
    OptionQuery,
>;

/// 内容哈希索引 - 用于去重
/// Key: [u8; 32] (content_hash)
/// Value: PublicMediaId
#[pallet::storage]
pub type ContentHashIndex<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    [u8; 32],
    PublicMediaId,
    OptionQuery,
>;

/// 实体-媒体关联存储
/// Key: (DomainId, EntityId)
/// Value: Vec<EntityMediaAssociation>
#[pallet::storage]
pub type EntityMediaMap<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    (DomainId, u64),
    BoundedVec<EntityMediaAssociation, ConstU32<256>>,
    ValueQuery,
>;

/// 媒体-实体反向索引
/// Key: PublicMediaId
/// Value: Vec<(DomainId, EntityId)>
#[pallet::storage]
pub type MediaEntityMap<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    PublicMediaId,
    BoundedVec<(DomainId, u64), ConstU32<64>>,
    ValueQuery,
>;

/// 用户媒体索引 - 按上传者查询
/// Key: AccountId
/// Value: Vec<PublicMediaId>
#[pallet::storage]
pub type UploaderMediaIndex<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<PublicMediaId, ConstU32<1000>>,
    ValueQuery,
>;

/// 域媒体统计
/// Key: DomainId
/// Value: DomainMediaStats
#[pallet::storage]
pub type DomainMediaStats<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    DomainId,
    DomainMediaStats,
    ValueQuery,
>;

/// 下一个媒体ID
#[pallet::storage]
pub type NextMediaId<T: Config> = StorageValue<_, PublicMediaId, ValueQuery>;
```

### 4.2 统计存储

```rust
/// 域媒体统计
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug, Default)]
pub struct DomainMediaStats {
    /// 媒体总数
    pub total_count: u64,
    /// 图片数量
    pub image_count: u64,
    /// 视频数量
    pub video_count: u64,
    /// 音频数量
    pub audio_count: u64,
    /// 文档数量
    pub document_count: u64,
    /// 总存储大小（字节）
    pub total_size_bytes: u128,
    /// 最后更新时间
    pub last_updated: u64,
}

/// 全局媒体统计
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug, Default)]
pub struct GlobalMediaStats {
    /// 媒体总数
    pub total_count: u64,
    /// 活跃媒体数
    pub active_count: u64,
    /// 总存储大小
    pub total_size_bytes: u128,
    /// 去重节省的存储大小
    pub dedup_saved_bytes: u128,
    /// 最后更新时间
    pub last_updated: u64,
}

#[pallet::storage]
pub type GlobalStats<T: Config> = StorageValue<_, GlobalMediaStats, ValueQuery>;
```

---

## 5. Config 配置设计

### 5.1 简化的Config

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 货币类型
    type Currency: ReservableCurrency<Self::AccountId>;

    /// 权重信息
    type WeightInfo: WeightInfo;

    /// 服务提供者 - 聚合所有外部依赖
    type ServiceProvider: MediaLibraryServices<Self>;

    /// 基础押金
    #[pallet::constant]
    type DepositBase: Get<BalanceOf<Self>>;

    /// 每字节押金
    #[pallet::constant]
    type DepositPerByte: Get<BalanceOf<Self>>;

    /// 最大媒体文件大小（字节）
    #[pallet::constant]
    type MaxMediaSize: Get<u32>;

    /// 单个实体最大关联媒体数
    #[pallet::constant]
    type MaxMediaPerEntity: Get<u32>;

    /// 最大缩略图大小
    #[pallet::constant]
    type MaxThumbnailSize: Get<u32>;
}
```

### 5.2 服务提供者Trait

```rust
/// 媒体库服务提供者 - 聚合所有外部服务
pub trait MediaLibraryServices<T: frame_system::Config> {
    /// 存储后端类型
    type StorageBackend: MediaStorageBackend<T::AccountId, BlockNumberFor<T>>;

    /// 域注册表类型
    type DomainRegistry: DomainRegistry;

    /// 治理起源类型
    type GovernanceOrigin: EnsureOrigin<T::RuntimeOrigin>;

    /// 获取存储后端实例
    fn storage_backend() -> Self::StorageBackend;

    /// 获取域注册表实例
    fn domain_registry() -> Self::DomainRegistry;
}
```

---

## 6. 抽象层设计

### 6.1 存储后端抽象

```rust
/// 存储后端抽象 - 定义在 stardust-media-traits crate
pub trait MediaStorageBackend<AccountId, BlockNumber> {
    /// 存储ID类型（如IPFS CID）
    type StorageId: Encode + Decode + Clone + MaxEncodedLen;

    /// 错误类型
    type Error: Into<DispatchError>;

    /// 存储数据并返回存储ID
    fn store_data(
        uploader: &AccountId,
        data: &[u8],
        config: &StorageConfiguration,
    ) -> Result<Self::StorageId, Self::Error>;

    /// 获取存储数据（用于验证）
    fn retrieve_data(
        storage_id: &Self::StorageId,
    ) -> Result<Vec<u8>, Self::Error>;

    /// 删除存储数据
    fn remove_data(
        storage_id: &Self::StorageId,
    ) -> Result<(), Self::Error>;

    /// 检查存储健康状态
    fn check_health(
        storage_id: &Self::StorageId,
    ) -> Result<StorageHealthStatus, Self::Error>;

    /// 更新存储配置
    fn update_config(
        storage_id: &Self::StorageId,
        new_config: &StorageConfiguration,
    ) -> Result<(), Self::Error>;
}

/// 存储健康状态
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum StorageHealthStatus {
    /// 健康
    Healthy { replicas: u8 },
    /// 降级
    Degraded { current: u8, target: u8 },
    /// 危险
    Critical { current: u8, minimum: u8 },
    /// 未知
    Unknown,
}
```

### 6.2 域注册表抽象

```rust
/// 域注册表抽象
pub trait DomainRegistry {
    /// 检查域是否存在
    fn domain_exists(domain_id: DomainId) -> bool;

    /// 获取域信息
    fn get_domain_info(domain_id: DomainId) -> Option<DomainInfo>;

    /// 注册新域（需要治理权限）
    fn register_domain(
        domain_id: DomainId,
        info: DomainInfo,
    ) -> DispatchResult;

    /// 更新域信息
    fn update_domain(
        domain_id: DomainId,
        info: DomainInfo,
    ) -> DispatchResult;
}

/// 域信息
#[derive(Clone, Encode, Decode, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub struct DomainInfo {
    /// 域名称
    pub name: BoundedVec<u8, ConstU32<32>>,
    /// 域描述
    pub description: Option<BoundedVec<u8, ConstU32<256>>>,
    /// 所属pallet名称
    pub owner_pallet: BoundedVec<u8, ConstU32<32>>,
    /// 注册时间
    pub registered_at: u64,
    /// 是否启用
    pub enabled: bool,
}
```

### 6.3 IPFS存储适配器实现

```rust
/// IPFS存储后端适配器
pub struct IpfsStorageAdapter<T: pallet_stardust_ipfs::Config>(PhantomData<T>);

impl<T> MediaStorageBackend<T::AccountId, BlockNumberFor<T>> for IpfsStorageAdapter<T>
where
    T: pallet_stardust_ipfs::Config + frame_system::Config,
{
    type StorageId = BoundedVec<u8, ConstU32<128>>;  // IPFS CID
    type Error = pallet_stardust_ipfs::Error<T>;

    fn store_data(
        uploader: &T::AccountId,
        data: &[u8],
        config: &StorageConfiguration,
    ) -> Result<Self::StorageId, Self::Error> {
        // 将StorageConfiguration转换为IPFS的PinTier
        let pin_tier = Self::config_to_pin_tier(config);

        // 调用stardust-ipfs的pin功能
        pallet_stardust_ipfs::Pallet::<T>::request_pin(
            uploader.clone(),
            data.to_vec(),
            pin_tier,
        )
    }

    fn retrieve_data(
        storage_id: &Self::StorageId,
    ) -> Result<Vec<u8>, Self::Error> {
        // 从IPFS获取数据
        pallet_stardust_ipfs::Pallet::<T>::get_content(storage_id)
    }

    fn remove_data(
        storage_id: &Self::StorageId,
    ) -> Result<(), Self::Error> {
        // 请求unpin
        pallet_stardust_ipfs::Pallet::<T>::request_unpin(storage_id)
    }

    fn check_health(
        storage_id: &Self::StorageId,
    ) -> Result<StorageHealthStatus, Self::Error> {
        // 检查pin状态
        match pallet_stardust_ipfs::Pallet::<T>::get_pin_status(storage_id) {
            Some(status) => Ok(Self::convert_status(status)),
            None => Ok(StorageHealthStatus::Unknown),
        }
    }

    fn update_config(
        storage_id: &Self::StorageId,
        new_config: &StorageConfiguration,
    ) -> Result<(), Self::Error> {
        let new_tier = Self::config_to_pin_tier(new_config);
        pallet_stardust_ipfs::Pallet::<T>::update_pin_tier(storage_id, new_tier)
    }
}

impl<T: pallet_stardust_ipfs::Config> IpfsStorageAdapter<T> {
    /// 转换存储配置到IPFS Pin层级
    fn config_to_pin_tier(config: &StorageConfiguration) -> pallet_stardust_ipfs::PinTier {
        match config.redundancy_level {
            5..=10 => pallet_stardust_ipfs::PinTier::Critical,
            3..=4 => pallet_stardust_ipfs::PinTier::Standard,
            _ => pallet_stardust_ipfs::PinTier::Temporary,
        }
    }

    /// 转换IPFS状态到通用状态
    fn convert_status(status: pallet_stardust_ipfs::PinStatus) -> StorageHealthStatus {
        // 具体转换逻辑
        StorageHealthStatus::Healthy { replicas: 3 }
    }
}
```

---

## 7. Pallet 核心实现

### 7.1 Pallet 结构

```rust
#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // Config, Storage, Event, Error 等定义...
}
```

### 7.2 Events

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    /// 媒体上传成功
    MediaUploaded {
        media_id: PublicMediaId,
        uploader: T::AccountId,
        media_type: MediaType,
        file_size: u64,
        content_hash: [u8; 32],
    },

    /// 媒体关联到实体
    MediaAssociated {
        media_id: PublicMediaId,
        domain_id: DomainId,
        entity_id: u64,
        relationship: MediaRelationshipType,
    },

    /// 媒体取消关联
    MediaDisassociated {
        media_id: PublicMediaId,
        domain_id: DomainId,
        entity_id: u64,
    },

    /// 媒体访问策略更新
    AccessPolicyUpdated {
        media_id: PublicMediaId,
        old_policy: AccessPolicy,
        new_policy: AccessPolicy,
    },

    /// 媒体删除
    MediaDeleted {
        media_id: PublicMediaId,
        deleted_by: T::AccountId,
    },

    /// 内容去重 - 复用已有媒体
    ContentDeduplicated {
        new_media_id: PublicMediaId,
        existing_media_id: PublicMediaId,
        content_hash: [u8; 32],
    },

    /// 存储健康检查完成
    StorageHealthChecked {
        media_id: PublicMediaId,
        status: StorageHealthStatus,
    },
}
```

### 7.3 Errors

```rust
#[pallet::error]
pub enum Error<T> {
    /// 媒体不存在
    MediaNotFound,
    /// 无权限操作
    Unauthorized,
    /// 文件过大
    FileTooLarge,
    /// 文件过小
    FileTooSmall,
    /// 不支持的格式
    UnsupportedFormat,
    /// 无效的文件头
    InvalidHeader,
    /// 域不存在
    DomainNotFound,
    /// 域未启用
    DomainDisabled,
    /// 实体媒体数量超限
    TooManyMediaForEntity,
    /// 媒体已关联到该实体
    MediaAlreadyAssociated,
    /// 媒体未关联到该实体
    MediaNotAssociated,
    /// 存储错误
    StorageError,
    /// 余额不足
    InsufficientBalance,
    /// 媒体状态不允许操作
    InvalidMediaStatus,
    /// 内容哈希冲突
    ContentHashConflict,
    /// 缩略图生成失败
    ThumbnailGenerationFailed,
    /// 图片炸弹检测
    ImageBombDetected,
    /// 可疑内容
    SuspiciousContent,
}
```

### 7.4 核心 Calls

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 上传媒体
    ///
    /// # 参数
    /// - `origin`: 上传者
    /// - `data`: 媒体二进制数据
    /// - `access_policy`: 访问策略
    /// - `storage_config`: 存储配置（可选，默认为Standard）
    ///
    /// # 权重
    /// 基于文件大小计算
    #[pallet::call_index(0)]
    #[pallet::weight(T::WeightInfo::upload_media(data.len() as u32))]
    pub fn upload_media(
        origin: OriginFor<T>,
        data: Vec<u8>,
        access_policy: AccessPolicy,
        storage_config: Option<StorageConfiguration>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 1. 验证文件大小
        ensure!(data.len() >= 100, Error::<T>::FileTooSmall);
        ensure!(data.len() as u32 <= T::MaxMediaSize::get(), Error::<T>::FileTooLarge);

        // 2. 检测格式并验证
        let format = Self::detect_format(&data)?;
        let metadata = Self::extract_metadata(&data, format)?;

        // 3. 计算内容哈希
        let content_hash = sp_core::blake2_256(&data);

        // 4. 检查去重
        if let Some(existing_id) = ContentHashIndex::<T>::get(&content_hash) {
            // 内容已存在，复用
            Self::deposit_event(Event::ContentDeduplicated {
                new_media_id: existing_id,
                existing_media_id: existing_id,
                content_hash,
            });
            return Ok(());
        }

        // 5. 计算并预留押金
        let deposit = Self::calculate_deposit(data.len() as u32);
        T::Currency::reserve(&who, deposit)?;

        // 6. 存储到后端
        let config = storage_config.unwrap_or_default();
        let storage_cid = T::ServiceProvider::storage_backend()
            .store_data(&who, &data, &config)
            .map_err(|_| Error::<T>::StorageError)?;

        // 7. 生成缩略图（如果是视觉媒体）
        let thumbnail_cid = if format.media_type() == MediaType::Image ||
                              format.media_type() == MediaType::Video {
            Self::generate_and_store_thumbnail(&who, &data, format).ok()
        } else {
            None
        };

        // 8. 分配媒体ID并存储
        let media_id = NextMediaId::<T>::mutate(|id| {
            let current = *id;
            *id = id.saturating_add(1);
            current
        });

        let now = <frame_system::Pallet<T>>::block_number();

        let media_info = PublicMediaInfo {
            id: media_id,
            uploader: who.clone(),
            media_type: format.media_type(),
            format,
            file_size: data.len() as u64,
            content_hash,
            storage_cid,
            thumbnail_cid,
            width: metadata.width,
            height: metadata.height,
            duration_secs: metadata.duration_secs,
            bitrate: metadata.bitrate,
            fps: metadata.fps,
            access_policy,
            storage_config: config,
            reference_count: 0,
            created_at: now,
            updated_at: now,
            status: MediaStatus::Active,
        };

        // 9. 存储到注册表
        PublicMediaRegistry::<T>::insert(media_id, media_info);
        ContentHashIndex::<T>::insert(content_hash, media_id);

        // 10. 更新用户索引
        UploaderMediaIndex::<T>::mutate(&who, |ids| {
            ids.try_push(media_id).ok();
        });

        // 11. 更新全局统计
        Self::update_global_stats(format.media_type(), data.len() as u64, true);

        // 12. 发送事件
        Self::deposit_event(Event::MediaUploaded {
            media_id,
            uploader: who,
            media_type: format.media_type(),
            file_size: data.len() as u64,
            content_hash,
        });

        Ok(())
    }

    /// 关联媒体到业务实体
    ///
    /// # 参数
    /// - `origin`: 操作者
    /// - `media_id`: 媒体ID
    /// - `domain_id`: 域ID
    /// - `entity_id`: 实体ID
    /// - `relationship`: 关联类型
    /// - `order_index`: 排序索引
    /// - `metadata`: 关联元数据（如标题、描述）
    #[pallet::call_index(1)]
    #[pallet::weight(T::WeightInfo::associate_media())]
    pub fn associate_media(
        origin: OriginFor<T>,
        media_id: PublicMediaId,
        domain_id: DomainId,
        entity_id: u64,
        relationship: MediaRelationshipType,
        order_index: u32,
        metadata: Option<BoundedVec<u8, ConstU32<512>>>,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 1. 检查媒体存在
        let mut media_info = PublicMediaRegistry::<T>::get(media_id)
            .ok_or(Error::<T>::MediaNotFound)?;

        // 2. 检查权限（只有上传者可以关联）
        ensure!(media_info.uploader == who, Error::<T>::Unauthorized);

        // 3. 检查媒体状态
        ensure!(media_info.status == MediaStatus::Active, Error::<T>::InvalidMediaStatus);

        // 4. 检查域存在
        ensure!(
            T::ServiceProvider::domain_registry().domain_exists(domain_id),
            Error::<T>::DomainNotFound
        );

        // 5. 检查实体媒体数量限制
        let current_count = EntityMediaMap::<T>::get((domain_id, entity_id)).len() as u32;
        ensure!(current_count < T::MaxMediaPerEntity::get(), Error::<T>::TooManyMediaForEntity);

        // 6. 检查是否已关联
        let associations = EntityMediaMap::<T>::get((domain_id, entity_id));
        ensure!(
            !associations.iter().any(|a| a.media_id == media_id),
            Error::<T>::MediaAlreadyAssociated
        );

        // 7. 创建关联记录
        let association = EntityMediaAssociation {
            media_id,
            relationship,
            order_index,
            associated_at: Self::current_timestamp(),
            metadata,
        };

        // 8. 更新存储
        EntityMediaMap::<T>::mutate((domain_id, entity_id), |associations| {
            associations.try_push(association).ok();
        });

        MediaEntityMap::<T>::mutate(media_id, |entities| {
            entities.try_push((domain_id, entity_id)).ok();
        });

        // 9. 更新引用计数
        media_info.reference_count = media_info.reference_count.saturating_add(1);
        media_info.updated_at = <frame_system::Pallet<T>>::block_number();
        PublicMediaRegistry::<T>::insert(media_id, media_info);

        // 10. 更新域统计
        Self::update_domain_stats(domain_id, MediaType::Image, 0, true);

        // 11. 发送事件
        Self::deposit_event(Event::MediaAssociated {
            media_id,
            domain_id,
            entity_id,
            relationship,
        });

        Ok(())
    }

    /// 取消媒体关联
    #[pallet::call_index(2)]
    #[pallet::weight(T::WeightInfo::disassociate_media())]
    pub fn disassociate_media(
        origin: OriginFor<T>,
        media_id: PublicMediaId,
        domain_id: DomainId,
        entity_id: u64,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        // 1. 检查媒体存在
        let mut media_info = PublicMediaRegistry::<T>::get(media_id)
            .ok_or(Error::<T>::MediaNotFound)?;

        // 2. 检查权限
        ensure!(media_info.uploader == who, Error::<T>::Unauthorized);

        // 3. 检查关联存在
        let mut associations = EntityMediaMap::<T>::get((domain_id, entity_id));
        let pos = associations.iter()
            .position(|a| a.media_id == media_id)
            .ok_or(Error::<T>::MediaNotAssociated)?;

        // 4. 移除关联
        associations.remove(pos);
        EntityMediaMap::<T>::insert((domain_id, entity_id), associations);

        MediaEntityMap::<T>::mutate(media_id, |entities| {
            entities.retain(|e| *e != (domain_id, entity_id));
        });

        // 5. 更新引用计数
        media_info.reference_count = media_info.reference_count.saturating_sub(1);
        media_info.updated_at = <frame_system::Pallet<T>>::block_number();
        PublicMediaRegistry::<T>::insert(media_id, media_info);

        // 6. 发送事件
        Self::deposit_event(Event::MediaDisassociated {
            media_id,
            domain_id,
            entity_id,
        });

        Ok(())
    }

    /// 更新媒体访问策略
    #[pallet::call_index(3)]
    #[pallet::weight(T::WeightInfo::update_access_policy())]
    pub fn update_access_policy(
        origin: OriginFor<T>,
        media_id: PublicMediaId,
        new_policy: AccessPolicy,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        let mut media_info = PublicMediaRegistry::<T>::get(media_id)
            .ok_or(Error::<T>::MediaNotFound)?;

        ensure!(media_info.uploader == who, Error::<T>::Unauthorized);

        let old_policy = media_info.access_policy.clone();
        media_info.access_policy = new_policy.clone();
        media_info.updated_at = <frame_system::Pallet<T>>::block_number();

        PublicMediaRegistry::<T>::insert(media_id, media_info);

        Self::deposit_event(Event::AccessPolicyUpdated {
            media_id,
            old_policy,
            new_policy,
        });

        Ok(())
    }

    /// 删除媒体（软删除）
    #[pallet::call_index(4)]
    #[pallet::weight(T::WeightInfo::delete_media())]
    pub fn delete_media(
        origin: OriginFor<T>,
        media_id: PublicMediaId,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;

        let mut media_info = PublicMediaRegistry::<T>::get(media_id)
            .ok_or(Error::<T>::MediaNotFound)?;

        ensure!(media_info.uploader == who, Error::<T>::Unauthorized);

        // 只有无引用的媒体才能删除
        ensure!(media_info.reference_count == 0, Error::<T>::MediaAlreadyAssociated);

        // 软删除
        media_info.status = MediaStatus::Deleted;
        media_info.updated_at = <frame_system::Pallet<T>>::block_number();

        PublicMediaRegistry::<T>::insert(media_id, media_info.clone());

        // 移除内容哈希索引
        ContentHashIndex::<T>::remove(&media_info.content_hash);

        // 退还押金
        let deposit = Self::calculate_deposit(media_info.file_size as u32);
        T::Currency::unreserve(&who, deposit);

        // 更新统计
        Self::update_global_stats(media_info.media_type, media_info.file_size, false);

        Self::deposit_event(Event::MediaDeleted {
            media_id,
            deleted_by: who,
        });

        Ok(())
    }
}
```

---

## 8. 辅助函数实现

### 8.1 格式检测

```rust
impl<T: Config> Pallet<T> {
    /// 检测媒体格式
    pub fn detect_format(data: &[u8]) -> Result<MediaFormat, Error<T>> {
        if data.len() < 12 {
            return Err(Error::<T>::InvalidHeader);
        }

        // 检查图片格式
        match &data[0..4] {
            [0xFF, 0xD8, 0xFF, _] => return Ok(MediaFormat::JPEG),
            [0x89, 0x50, 0x4E, 0x47] => return Ok(MediaFormat::PNG),
            [0x47, 0x49, 0x46, 0x38] => return Ok(MediaFormat::GIF),
            [0x52, 0x49, 0x46, 0x46] => {
                if data.len() > 12 && &data[8..12] == b"WEBP" {
                    return Ok(MediaFormat::WebP);
                }
                if data.len() > 12 && &data[8..12] == b"WAVE" {
                    return Ok(MediaFormat::WAV);
                }
            },
            _ => {},
        }

        // 检查AVIF
        if data.len() > 12 && &data[4..8] == b"ftyp" {
            let brand = &data[8..12];
            if brand == b"avif" || brand == b"avis" {
                return Ok(MediaFormat::AVIF);
            }
            if brand == b"isom" || brand == b"mp41" || brand == b"mp42" {
                return Ok(MediaFormat::MP4);
            }
            if brand == b"qt  " {
                return Ok(MediaFormat::MOV);
            }
        }

        // 检查WebM
        if data.starts_with(&[0x1A, 0x45, 0xDF, 0xA3]) {
            return Ok(MediaFormat::WebM);
        }

        // 检查音频格式
        if data[0] == 0xFF && (data[1] & 0xE0) == 0xE0 {
            return Ok(MediaFormat::MP3);
        }

        if data[0] == 0xFF && (data[1] == 0xF1 || data[1] == 0xF9) {
            return Ok(MediaFormat::AAC);
        }

        if &data[0..4] == b"OggS" {
            return Ok(MediaFormat::OGG);
        }

        if &data[0..4] == b"fLaC" {
            return Ok(MediaFormat::FLAC);
        }

        // PDF
        if &data[0..4] == b"%PDF" {
            return Ok(MediaFormat::PDF);
        }

        Err(Error::<T>::UnsupportedFormat)
    }
}
```

### 8.2 元数据提取

```rust
/// 媒体元数据（内部使用）
pub struct ExtractedMetadata {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_secs: Option<u32>,
    pub bitrate: Option<u32>,
    pub fps: Option<u8>,
}

impl<T: Config> Pallet<T> {
    /// 提取媒体元数据
    pub fn extract_metadata(
        data: &[u8],
        format: MediaFormat,
    ) -> Result<ExtractedMetadata, Error<T>> {
        let mut metadata = ExtractedMetadata {
            width: None,
            height: None,
            duration_secs: None,
            bitrate: None,
            fps: None,
        };

        match format {
            MediaFormat::JPEG => {
                if let Ok((w, h)) = Self::extract_jpeg_dimensions(data) {
                    Self::check_image_bomb(w, h)?;
                    metadata.width = Some(w);
                    metadata.height = Some(h);
                }
            },
            MediaFormat::PNG => {
                if let Ok((w, h)) = Self::extract_png_dimensions(data) {
                    Self::check_image_bomb(w, h)?;
                    metadata.width = Some(w);
                    metadata.height = Some(h);
                }
            },
            MediaFormat::GIF => {
                if data.len() >= 10 {
                    let w = u16::from_le_bytes([data[6], data[7]]) as u32;
                    let h = u16::from_le_bytes([data[8], data[9]]) as u32;
                    Self::check_image_bomb(w, h)?;
                    metadata.width = Some(w);
                    metadata.height = Some(h);
                }
            },
            // 其他格式...
            _ => {},
        }

        Ok(metadata)
    }

    /// 提取JPEG尺寸
    fn extract_jpeg_dimensions(data: &[u8]) -> Result<(u32, u32), Error<T>> {
        for i in 0..data.len().saturating_sub(10) {
            if data[i] == 0xFF && matches!(data[i + 1], 0xC0..=0xCF) && data[i + 1] != 0xC4 {
                if i + 9 < data.len() {
                    let h = u16::from_be_bytes([data[i + 5], data[i + 6]]) as u32;
                    let w = u16::from_be_bytes([data[i + 7], data[i + 8]]) as u32;
                    return Ok((w, h));
                }
            }
        }
        Err(Error::<T>::InvalidHeader)
    }

    /// 提取PNG尺寸
    fn extract_png_dimensions(data: &[u8]) -> Result<(u32, u32), Error<T>> {
        if data.len() < 24 {
            return Err(Error::<T>::InvalidHeader);
        }

        if &data[12..16] == b"IHDR" {
            let w = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
            let h = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
            return Ok((w, h));
        }

        Err(Error::<T>::InvalidHeader)
    }

    /// 检查图片炸弹
    fn check_image_bomb(width: u32, height: u32) -> Result<(), Error<T>> {
        const MAX_PIXELS: u64 = 100_000_000; // 1亿像素

        let pixels = width as u64 * height as u64;
        if pixels > MAX_PIXELS {
            return Err(Error::<T>::ImageBombDetected);
        }

        Ok(())
    }
}
```

### 8.3 押金计算和统计更新

```rust
impl<T: Config> Pallet<T> {
    /// 计算媒体押金
    pub fn calculate_deposit(file_size: u32) -> BalanceOf<T> {
        let base = T::DepositBase::get();
        let per_byte = T::DepositPerByte::get();
        base.saturating_add(per_byte.saturating_mul(file_size.into()))
    }

    /// 获取当前时间戳
    pub fn current_timestamp() -> u64 {
        // 使用区块号作为时间戳
        <frame_system::Pallet<T>>::block_number().saturated_into::<u64>()
    }

    /// 更新全局统计
    fn update_global_stats(media_type: MediaType, size: u64, is_add: bool) {
        GlobalStats::<T>::mutate(|stats| {
            if is_add {
                stats.total_count = stats.total_count.saturating_add(1);
                stats.active_count = stats.active_count.saturating_add(1);
                stats.total_size_bytes = stats.total_size_bytes.saturating_add(size as u128);
            } else {
                stats.total_count = stats.total_count.saturating_sub(1);
                stats.active_count = stats.active_count.saturating_sub(1);
                stats.total_size_bytes = stats.total_size_bytes.saturating_sub(size as u128);
            }
            stats.last_updated = Self::current_timestamp();
        });
    }

    /// 更新域统计
    fn update_domain_stats(
        domain_id: DomainId,
        media_type: MediaType,
        size: u64,
        is_add: bool,
    ) {
        DomainMediaStats::<T>::mutate(domain_id, |stats| {
            if is_add {
                stats.total_count = stats.total_count.saturating_add(1);
                match media_type {
                    MediaType::Image => stats.image_count = stats.image_count.saturating_add(1),
                    MediaType::Video => stats.video_count = stats.video_count.saturating_add(1),
                    MediaType::Audio => stats.audio_count = stats.audio_count.saturating_add(1),
                    MediaType::Document => stats.document_count = stats.document_count.saturating_add(1),
                }
                stats.total_size_bytes = stats.total_size_bytes.saturating_add(size as u128);
            } else {
                stats.total_count = stats.total_count.saturating_sub(1);
                match media_type {
                    MediaType::Image => stats.image_count = stats.image_count.saturating_sub(1),
                    MediaType::Video => stats.video_count = stats.video_count.saturating_sub(1),
                    MediaType::Audio => stats.audio_count = stats.audio_count.saturating_sub(1),
                    MediaType::Document => stats.document_count = stats.document_count.saturating_sub(1),
                }
                stats.total_size_bytes = stats.total_size_bytes.saturating_sub(size as u128);
            }
            stats.last_updated = Self::current_timestamp();
        });
    }
}
```

---

## 9. 查询接口

### 9.1 RPC 查询方法

```rust
impl<T: Config> Pallet<T> {
    /// 获取媒体信息
    pub fn get_media(media_id: PublicMediaId) -> Option<PublicMediaInfo<T>> {
        PublicMediaRegistry::<T>::get(media_id)
    }

    /// 获取实体关联的媒体列表
    pub fn get_entity_media(
        domain_id: DomainId,
        entity_id: u64,
    ) -> Vec<EntityMediaAssociation> {
        EntityMediaMap::<T>::get((domain_id, entity_id)).into_inner()
    }

    /// 获取媒体关联的实体列表
    pub fn get_media_entities(
        media_id: PublicMediaId,
    ) -> Vec<(DomainId, u64)> {
        MediaEntityMap::<T>::get(media_id).into_inner()
    }

    /// 获取用户上传的媒体列表
    pub fn get_uploader_media(
        uploader: T::AccountId,
    ) -> Vec<PublicMediaId> {
        UploaderMediaIndex::<T>::get(&uploader).into_inner()
    }

    /// 通过内容哈希查找媒体
    pub fn find_by_content_hash(
        content_hash: [u8; 32],
    ) -> Option<PublicMediaId> {
        ContentHashIndex::<T>::get(&content_hash)
    }

    /// 获取域统计信息
    pub fn get_domain_stats(domain_id: DomainId) -> DomainMediaStats {
        DomainMediaStats::<T>::get(domain_id)
    }

    /// 获取全局统计信息
    pub fn get_global_stats() -> GlobalMediaStats {
        GlobalStats::<T>::get()
    }

    /// 检查用户是否有媒体访问权限
    pub fn check_access(
        media_id: PublicMediaId,
        requester: Option<T::AccountId>,
    ) -> bool {
        let Some(media) = PublicMediaRegistry::<T>::get(media_id) else {
            return false;
        };

        match &media.access_policy {
            AccessPolicy::Public => true,
            AccessPolicy::Unlisted => true,  // 有ID即可访问
            AccessPolicy::Private => {
                requester.map_or(false, |r| r == media.uploader)
            },
            AccessPolicy::DomainRestricted { allowed_domains: _ } => {
                // 需要检查请求者所属域
                true  // 简化处理
            },
            AccessPolicy::Whitelist { allowed_accounts } => {
                requester.map_or(false, |r| {
                    let hash = sp_core::blake2_256(&r.encode());
                    allowed_accounts.iter().any(|h| h == &hash)
                })
            },
        }
    }
}
```

---

## 10. Runtime 集成

### 10.1 Runtime 配置

```rust
// runtime/src/lib.rs

parameter_types! {
    pub const MediaDepositBase: Balance = 10 * DOLLARS;
    pub const MediaDepositPerByte: Balance = CENTS;
    pub const MaxMediaSize: u32 = 500 * 1024 * 1024;  // 500MB
    pub const MaxMediaPerEntity: u32 = 256;
    pub const MaxThumbnailSize: u32 = 1024 * 1024;  // 1MB
}

/// 默认媒体库服务提供者
pub struct DefaultMediaLibraryServices;

impl pallet_public_media_library::MediaLibraryServices<Runtime> for DefaultMediaLibraryServices {
    type StorageBackend = IpfsStorageAdapter<Runtime>;
    type DomainRegistry = pallet_domain_registry::Pallet<Runtime>;
    type GovernanceOrigin = EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, CouncilCollective, 2, 3>,
    >;

    fn storage_backend() -> Self::StorageBackend {
        IpfsStorageAdapter(PhantomData)
    }

    fn domain_registry() -> Self::DomainRegistry {
        pallet_domain_registry::Pallet::<Runtime>
    }
}

impl pallet_public_media_library::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = pallet_public_media_library::weights::SubstrateWeight<Runtime>;
    type ServiceProvider = DefaultMediaLibraryServices;
    type DepositBase = MediaDepositBase;
    type DepositPerByte = MediaDepositPerByte;
    type MaxMediaSize = MaxMediaSize;
    type MaxMediaPerEntity = MaxMediaPerEntity;
    type MaxThumbnailSize = MaxThumbnailSize;
}
```

### 10.2 construct_runtime!

```rust
construct_runtime!(
    pub enum Runtime {
        System: frame_system,
        Balances: pallet_balances,
        // ... 其他pallet

        // 媒体库相关
        DomainRegistry: pallet_domain_registry,
        PublicMediaLibrary: pallet_public_media_library,
        StardustIpfs: pallet_stardust_ipfs,
    }
);
```

---

## 11. 目录结构

```
pallets/public-media-library/
├── Cargo.toml
├── README.md
├── src/
│   ├── lib.rs                 # Pallet主模块
│   ├── types.rs               # 类型定义
│   ├── traits.rs              # 抽象Trait定义
│   ├── storage.rs             # 存储定义
│   ├── impls.rs               # 核心实现
│   ├── weights.rs             # 权重定义
│   ├── benchmarking.rs        # 基准测试
│   └── tests/
│       ├── mod.rs             # 测试模块
│       ├── mock.rs            # Mock运行时
│       └── tests.rs           # 单元测试
└── runtime-api/
    └── src/
        └── lib.rs             # RPC API定义
```

---

## 12. 实施计划

### 12.1 阶段划分

```
总周期：10-12周

阶段1: 基础架构（Week 1-3）
├── Week 1: 类型定义和抽象Trait
├── Week 2: 存储设计和基础结构
└── Week 3: IPFS存储适配器

阶段2: 核心功能（Week 4-7）
├── Week 4: 上传和去重功能
├── Week 5: 关联和查询功能
├── Week 6: 访问控制和权限
└── Week 7: 统计和监控

阶段3: 集成测试（Week 8-10）
├── Week 8: 单元测试
├── Week 9: 集成测试
└── Week 10: 性能测试和优化

阶段4: 文档和部署（Week 11-12）
├── Week 11: API文档和使用指南
└── Week 12: 部署和监控
```

### 12.2 关键里程碑

| 里程碑 | 时间 | 交付物 |
|-------|------|--------|
| M1: 基础架构完成 | Week 3 | 类型定义、Trait、存储结构 |
| M2: 核心功能完成 | Week 7 | 上传、关联、查询、权限 |
| M3: 测试完成 | Week 10 | 单元测试、集成测试、性能报告 |
| M4: 正式发布 | Week 12 | 文档、部署、监控 |

---

## 13. 总结

### 13.1 核心特性

1. **统一存储接口**: 所有业务模块通过统一接口存储和访问媒体
2. **智能去重**: 基于Blake2-256内容哈希的去重机制
3. **灵活的访问控制**: Public/Unlisted/Private/DomainRestricted/Whitelist
4. **域关联系统**: 支持将媒体关联到不同业务域的实体
5. **存储后端抽象**: 支持多种存储后端（IPFS、Filecoin等）
6. **完善的统计**: 全局和域级别的媒体统计

### 13.2 架构优势

| 特性 | 说明 |
|-----|------|
| **低耦合** | 通过抽象层隔离具体实现 |
| **高内聚** | 媒体管理职责集中 |
| **可扩展** | 新增存储后端或域无需改核心代码 |
| **可测试** | Mock抽象层即可单元测试 |
| **高性能** | 内容去重减少存储开销 |

---

*本文档定义了 pallet-public-media-library 的完整设计方案，包括类型定义、存储结构、核心接口、抽象层设计和实施计划。*
