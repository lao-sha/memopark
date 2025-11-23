# Pallet Public Media

## 概述

**pallet-public-media** 是 Stardust 区块链的公共媒体库管理 Pallet，实现了统一的音频和视频资源管理系统。

## 核心功能

### 1. 媒体管理
- ✅ 添加公共音频/视频
- ✅ 更新媒体信息
- ✅ 启用/禁用媒体
- ✅ 软删除媒体

### 2. 分类系统
- **音频分类** (8种)：哀乐、佛乐、轻音乐、古典音乐、环境音乐、民族音乐、宗教音乐、冥想音乐
- **视频分类** (8种)：生平纪录、历史影像、教育视频、仪式引导、宣传片、纪录片、全景视频、追悼视频

### 3. 应用域系统
每个媒体分类关联适用的纪念场景（应用域）：

**10个核心应用域**:
1. 逝者纪念馆 (DeceasedMemorial)
2. 墓地详情页 (GraveDetail)
3. 陵园主页 (CemeteryPark)
4. 纪念空间 (MemorialSpace)
5. 供奉仪式 (OfferingRitual)
6. 事件馆 (EventHall)
7. 宠物纪念 (PetMemorial)
8. 教育场景 (Education)
9. 直播追悼会 (LiveMemorial)
10. 虚拟祭祀 (VirtualRitual)

### 4. 智能推荐
根据应用域自动推荐合适的媒体：
```rust
// 纪念馆场景 → 自动推荐：哀乐/佛乐/轻音乐
let audio_id = PublicMedia::get_random_audio_for_domain(MediaDomain::DeceasedMemorial);

// 陵园场景 → 自动推荐：轻音乐/环境音乐
let audio_id = PublicMedia::get_random_audio_for_domain(MediaDomain::CemeteryPark);
```

## 数据结构

### MediaEntry（媒体条目）
```rust
pub struct MediaEntry<T: Config> {
    pub id: u32,
    pub media_type: MediaType,          // 音频/视频
    pub name: BoundedVec<u8, T::StringLimit>,
    pub media_cid: BoundedVec<u8, T::CidLimit>,  // IPFS CID
    pub cover_cid: Option<BoundedVec<u8, T::CidLimit>>,
    pub duration: u32,                  // 时长（秒）
    pub category: MediaCategory,
    pub quality: Option<VideoQuality>,  // 视频分辨率
    pub subtitle_cid: Option<BoundedVec<u8, T::CidLimit>>,  // 字幕
    pub enabled: bool,
    pub creator: T::AccountId,
    pub created_at: T::BlockNumber,
    pub updated_at: T::BlockNumber,
}
```

### CategoryConfig（分类配置）
```rust
pub struct AudioCategoryConfig<T: Config> {
    pub category: AudioCategory,
    pub applicable_domains: BoundedVec<MediaDomain, ConstU32<10>>,
    pub name: BoundedVec<u8, T::StringLimit>,
    pub description: BoundedVec<u8, T::StringLimit>,
}
```

## 存储映射

| 存储 | Key | Value | 说明 |
|------|-----|-------|------|
| MediaLibrary | u32 | MediaEntry | 媒体主存储 |
| MediaByCategory | MediaCategory | Vec<u32> | 按分类索引 |
| MediaByType | MediaType | Vec<u32> | 按类型索引（音频/视频） |
| EnabledMediaIds | - | Vec<u32> | 已启用媒体索引 |
| AudioCategoryConfigs | AudioCategory | Config | 音频分类配置 |
| VideoCategoryConfigs | VideoCategory | Config | 视频分类配置 |
| AudioCategoriesByDomain | MediaDomain | Vec<AudioCategory> | 应用域→音频分类 |
| VideoCategoriesByDomain | MediaDomain | Vec<VideoCategory> | 应用域→视频分类 |

## 核心接口

### Extrinsics（可调用函数）

#### 1. add_media
添加公共媒体（音频或视频）

**权限**: Root或治理委员会

**参数**:
- `media_type`: 媒体类型（Audio/Video）
- `name`: 媒体名称
- `media_cid`: IPFS CID
- `cover_cid`: 封面图CID（可选）
- `duration`: 时长（秒）
- `category`: 分类
- `quality`: 视频分辨率（仅视频）
- `subtitle_cid`: 字幕CID（仅视频可选）

#### 2. update_media
更新媒体信息

**权限**: Root或治理委员会

#### 3. set_media_status
启用或禁用媒体

**权限**: Root或治理委员会

#### 4. remove_media
软删除媒体（仅禁用，保留记录）

**权限**: Root或治理委员会

#### 5. record_play
记录播放次数（Phase 2）

**权限**: 任何人

#### 6. update_audio_category_config
更新音频分类配置（治理功能）

**权限**: Root或治理委员会

#### 7. update_video_category_config
更新视频分类配置（治理功能）

**权限**: Root或治理委员会

### Helper Functions（辅助查询函数）

```rust
// 基础查询
pub fn get_media_by_category(category: MediaCategory) -> Vec<u32>;
pub fn get_media_by_type(media_type: MediaType) -> Vec<u32>;
pub fn get_random_media(category: MediaCategory) -> Option<u32>;
pub fn is_media_available(media_id: u32) -> bool;
pub fn get_media_info(media_id: u32) -> Option<MediaEntry<T>>;

// 应用域查询
pub fn get_audio_categories_for_domain(domain: MediaDomain) -> Vec<AudioCategory>;
pub fn get_video_categories_for_domain(domain: MediaDomain) -> Vec<VideoCategory>;
pub fn is_audio_category_applicable(category: AudioCategory, domain: MediaDomain) -> bool;
pub fn is_video_category_applicable(category: VideoCategory, domain: MediaDomain) -> bool;

// 智能推荐
pub fn get_random_audio_for_domain(domain: MediaDomain) -> Option<u32>;
pub fn get_random_video_for_domain(domain: MediaDomain) -> Option<u32>;
pub fn get_all_audio_for_domain(domain: MediaDomain) -> Vec<u32>;
pub fn get_all_video_for_domain(domain: MediaDomain) -> Vec<u32>;
```

## 使用示例

### 1. 添加音频
```rust
// Root调用
let _ = PublicMedia::add_media(
    RuntimeOrigin::root(),
    MediaType::Audio,
    b"哀乐 - 追思".to_vec(),
    b"QmXXX...".to_vec(),  // IPFS CID
    Some(b"QmYYY...".to_vec()),  // 封面图
    180,  // 3分钟
    MediaCategory::Audio(AudioCategory::Requiem),
    None,  // 音频无分辨率
    None,  // 音频无字幕
);
```

### 2. 添加视频
```rust
let _ = PublicMedia::add_media(
    RuntimeOrigin::root(),
    MediaType::Video,
    b"生平纪录 - 张三".to_vec(),
    b"QmAAA...".to_vec(),  // 视频CID
    Some(b"QmBBB...".to_vec()),  // 封面图
    600,  // 10分钟
    MediaCategory::Video(VideoCategory::Biography),
    Some(VideoQuality::FullHD),  // 1080p
    Some(b"QmCCC...".to_vec()),  // 字幕CID
);
```

### 3. 智能推荐（纪念馆场景）
```rust
// 获取纪念馆背景音乐（自动从哀乐/佛乐/轻音乐中推荐）
let audio_id = PublicMedia::get_random_audio_for_domain(
    MediaDomain::DeceasedMemorial
);

// 获取纪念馆生平视频（自动推荐生平纪录）
let video_id = PublicMedia::get_random_video_for_domain(
    MediaDomain::DeceasedMemorial
);
```

### 4. 查询可用分类
```rust
// 查询陵园场景可用的音频分类
let categories = PublicMedia::get_audio_categories_for_domain(
    MediaDomain::CemeteryPark
);
// 返回：[Light, Ambient]
```

## Genesis 配置

在 `chain_spec.rs` 中配置初始数据：

```rust
pallet_public_media: PublicMediaConfig {
    audio_configs: vec![
        // (分类, 应用域列表, 名称, 描述)
        (
            AudioCategory::Requiem,
            vec![
                MediaDomain::DeceasedMemorial,
                MediaDomain::GraveDetail,
                MediaDomain::OfferingRitual,
                MediaDomain::EventHall,
            ],
            b"哀乐".to_vec(),
            b"适用于追思、悼念场景的肃穆音乐".to_vec(),
        ),
        (
            AudioCategory::Buddhist,
            vec![
                MediaDomain::DeceasedMemorial,
                MediaDomain::OfferingRitual,
                MediaDomain::MemorialSpace,
            ],
            b"佛乐".to_vec(),
            b"佛教音乐、经文".to_vec(),
        ),
        // ... 其他音频分类
    ],
    video_configs: vec![
        (
            VideoCategory::Biography,
            vec![
                MediaDomain::DeceasedMemorial,
                MediaDomain::EventHall,
            ],
            b"生平纪录".to_vec(),
            b"个人生平、回忆录视频".to_vec(),
        ),
        // ... 其他视频分类
    ],
    _phantom: Default::default(),
},
```

## Runtime 集成

在 `runtime/src/lib.rs` 中集成：

```rust
// 1. 配置
impl pallet_public_media::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StringLimit = ConstU32<128>;
    type CidLimit = ConstU32<64>;
    type AdminOrigin = EnsureRootOrHalfCouncil;
    type WeightInfo = ();
}

// 2. 添加到 construct_runtime!
construct_runtime!(
    pub struct Runtime {
        // ... 其他 pallets
        PublicMedia: pallet_public_media,
    }
);
```

## 其他 Pallet 集成

### pallet-deceased 集成示例

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 其他配置
    type PublicMedia: PublicMediaProvider;
}

// 使用
impl<T: Config> Pallet<T> {
    pub fn get_memorial_audio(deceased_id: u64) -> Option<u32> {
        // 智能推荐纪念馆背景音乐
        T::PublicMedia::get_random_audio_for_domain(
            MediaDomain::DeceasedMemorial
        )
    }
}
```

## 性能特征

- **存储成本**: ~10KB（分类配置） + 每媒体~500字节
- **查询性能**: O(1) 索引查询
- **推荐性能**: O(n) 其中n为分类数量（通常<10）

## 扩展功能（Phase 2）

- [ ] 播放统计
- [ ] 用户评分
- [ ] AI推荐算法
- [ ] 版权信息管理
- [ ] 多语言字幕支持
- [ ] 多分辨率自适应

## 许可证

MIT-0

## 作者

Stardust Team
