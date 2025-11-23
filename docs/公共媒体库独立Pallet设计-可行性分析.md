# 公共媒体库独立 Pallet 设计 - 可行性与合理性分析

## 一、背景与问题

### 1.1 当前需求

公共媒体库（音频+视频）将被多个业务场景使用：

#### 音频使用场景
1. **逝者纪念馆**（Deceased Memorial）- 背景音乐
2. **墓地详情页**（Grave）- 氛围音乐
3. **陵园主页**（Park）- 入口音乐
4. **纪念空间**（Memorial Space）- 冥想音乐
5. **宠物纪念**（Pet Memorial）- 纪念音乐
6. **事件馆**（Event Hall）- 主题音乐

#### 视频使用场景
1. **逝者纪念馆**（Deceased Memorial）- 生平视频、纪录片
2. **事件馆**（Event Hall）- 历史影像、纪实视频
3. **陵园主页**（Park）- 陵园宣传片、导览视频
4. **教育场景**（Education）- 生命教育、文化传承视频
5. **直播追悼会**（Live Memorial）- 录播回放
6. **虚拟祭祀**（Virtual Ritual）- 仪式引导视频

### 1.2 设计选择

**方案A**: 集成到 `pallet-deceased`
**方案B**: 独立创建 `pallet-public-media`（推荐）- 统一管理音频+视频

---

## 二、使用场景分析

### 2.1 跨 Pallet 使用场景

#### 音频使用场景

| Pallet | 使用场景 | 音频需求 | 优先级 |
|--------|---------|---------|--------|
| **pallet-deceased** | 逝者纪念馆背景音乐 | 哀乐、佛乐、轻音乐 | ⭐⭐⭐⭐⭐ |
| **pallet-stardust-grave** | 墓地详情页氛围音乐 | 哀乐、环境音乐 | ⭐⭐⭐⭐ |
| **pallet-stardust-park** | 陵园入口背景音乐 | 轻音乐、自然音 | ⭐⭐⭐⭐ |
| **pallet-memorial-space** | 纪念空间氛围营造 | 古典音乐、冥想音乐 | ⭐⭐⭐ |
| **pallet-memorial** | 供奉仪式音乐 | 宗教音乐、仪式音乐 | ⭐⭐⭐ |
| **未来扩展** | 直播追悼会、虚拟祭祀 | 多样化音乐 | ⭐⭐ |

#### 视频使用场景

| Pallet | 使用场景 | 视频需求 | 优先级 |
|--------|---------|---------|--------|
| **pallet-deceased** | 逝者生平视频、纪录片 | 生平回顾、家族视频 | ⭐⭐⭐⭐⭐ |
| **pallet-stardust-park** | 陵园宣传片、导览视频 | 环境介绍、服务展示 | ⭐⭐⭐⭐ |
| **pallet-memorial-space** | 仪式引导视频 | 祭祀流程、文化教育 | ⭐⭐⭐⭐ |
| **pallet-memorial** | 供奉仪式视频、追悼视频 | 仪式记录、追思影像 | ⭐⭐⭐⭐ |
| **pallet-deceased** | 教育视频、文化传承 | 生命教育、历史文化 | ⭐⭐⭐ |
| **未来扩展** | 直播追悼会录播、AR/VR虚拟祭祀 | 高清视频、360°全景 | ⭐⭐ |

**结论**: 公共媒体库是**跨领域的基础设施**，不应绑定到特定业务 Pallet。

---

### 2.2 媒体库功能需求

#### 核心功能
1. **媒体管理**: 增删改查公共音频/视频
2. **分类管理**: 按媒体类型、情绪、场景、文化分类
3. **权限控制**: Root/治理委员会管理
4. **状态控制**: 启用/禁用媒体
5. **查询接口**:
   - 按媒体类型查询（音频/视频）
   - 按分类查询
   - 随机推荐
   - 批量查询

#### 音频特定功能
6. **音频时长**: 记录音频时长（秒）
7. **音频分类**: 哀乐、佛乐、轻音乐、古典、环境音、民族、宗教、冥想

#### 视频特定功能
8. **视频分辨率**: 记录视频分辨率（720p, 1080p, 4K等）
9. **视频时长**: 记录视频时长（秒）
10. **视频分类**: 生平纪录、历史影像、教育视频、仪式引导、宣传片、全景视频

#### 扩展功能（Phase 2）
11. **播放统计**: 记录播放次数
12. **用户评分**: 媒体质量反馈
13. **AI推荐**: 根据场景智能推荐
14. **版权管理**: 记录媒体来源和授权
15. **字幕支持**: 视频字幕CID存储（多语言）

---

## 三、方案对比分析

### 3.1 方案A：集成到 pallet-deceased

#### 优点
- ✅ 无需新建 Pallet，开发快
- ✅ 逝者纪念馆直接调用，无跨 Pallet 依赖

#### 缺点
- ❌ **职责不清**: Deceased 管理逝者档案，不应管音乐库
- ❌ **耦合度高**: 其他 Pallet 需要依赖 Deceased
- ❌ **可维护性差**: 音乐功能与逝者业务混合
- ❌ **扩展性差**: 音乐库更新需要修改 Deceased
- ❌ **语义不符**: 墓地、陵园调用 Deceased 接口不合理

#### 依赖关系图
```
pallet-stardust-grave ──┐
pallet-stardust-park ───┼──> pallet-deceased (❌ 不合理依赖)
pallet-memorial-space ──┘       └─> 公共音乐库
```

---

### 3.2 方案B:独立 pallet-public-media（推荐）

#### 优点
- ✅ **职责单一**: 专注媒体管理（音频+视频），符合单一职责原则
- ✅ **低耦合**: 各 Pallet 独立依赖媒体库
- ✅ **易维护**: 媒体功能独立演进
- ✅ **易扩展**: 支持未来更多场景和媒体类型
- ✅ **语义清晰**: 名称明确表达功能
- ✅ **可复用**: 其他项目可直接复用
- ✅ **统一管理**: 音频和视频使用统一接口和数据结构

#### 缺点
- ⚠️ 需要新建 Pallet（开发成本+2天）
- ⚠️ 需要在 Runtime 中集成（配置成本+30分钟）

#### 依赖关系图
```
pallet-deceased ────────┐
pallet-stardust-grave ──┤
pallet-stardust-park ───┼──> pallet-public-media (✅ 清晰依赖)
pallet-memorial-space ──┤      └─> 音频库 + 视频库
pallet-memorial ────────┘
```

---

## 四、技术架构设计

### 4.1 Pallet 结构

```
stardust/pallets/public-media/
├── Cargo.toml
├── README.md
└── src/
    ├── lib.rs          # 主逻辑
    ├── types.rs        # 类型定义（音频+视频）
    ├── tests.rs        # 单元测试
    └── benchmarking.rs # 性能测试（可选）
```

---

### 4.2 核心数据结构

```rust
// src/types.rs

/// 媒体类型
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum MediaType {
    /// 音频
    Audio = 0,
    /// 视频
    Video = 1,
}

impl Default for MediaType {
    fn default() -> Self {
        Self::Audio
    }
}

/// 音频分类
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum AudioCategory {
    /// 哀乐（追思、悼念）
    Requiem = 0,
    /// 佛乐（佛教音乐、经文）
    Buddhist = 1,
    /// 轻音乐（抒情、平和）
    Light = 2,
    /// 古典音乐（庄重、肃穆）
    Classical = 3,
    /// 环境音乐（自然音、白噪音）
    Ambient = 4,
    /// 民族音乐（传统、地方特色）
    Ethnic = 5,
    /// 宗教音乐（多宗教通用）
    Religious = 6,
    /// 冥想音乐（禅修、静心）
    Meditation = 7,
}

impl Default for AudioCategory {
    fn default() -> Self {
        Self::Requiem
    }
}

/// 视频分类
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum VideoCategory {
    /// 生平纪录（个人生平、回忆录）
    Biography = 0,
    /// 历史影像（历史事件、档案）
    Historical = 1,
    /// 教育视频（生命教育、文化传承）
    Educational = 2,
    /// 仪式引导（祭祀流程、操作指南）
    Ritual = 3,
    /// 宣传片（陵园介绍、服务展示）
    Promotional = 4,
    /// 纪录片（深度记录、专题片）
    Documentary = 5,
    /// 全景视频（360°、VR/AR）
    Panoramic = 6,
    /// 追悼视频（追思会、悼念仪式）
    Memorial = 7,
}

impl Default for VideoCategory {
    fn default() -> Self {
        Self::Biography
    }
}

/// 媒体分类（音频或视频）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum MediaCategory {
    /// 音频分类
    Audio(AudioCategory),
    /// 视频分类
    Video(VideoCategory),
}

impl Default for MediaCategory {
    fn default() -> Self {
        Self::Audio(AudioCategory::default())
    }
}

/// 视频质量/分辨率
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum VideoQuality {
    /// 标清 480p
    SD = 480,
    /// 高清 720p
    HD = 720,
    /// 全高清 1080p
    FullHD = 1080,
    /// 2K
    TwoK = 1440,
    /// 4K Ultra HD
    FourK = 2160,
}

/// 媒体条目
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct MediaEntry<T: Config> {
    /// 媒体ID
    pub id: u32,
    /// 媒体类型（音频/视频）
    pub media_type: MediaType,
    /// 媒体名称
    pub name: BoundedVec<u8, T::StringLimit>,
    /// 媒体CID（IPFS）
    pub media_cid: BoundedVec<u8, T::CidLimit>,
    /// 封面图CID（可选）
    pub cover_cid: Option<BoundedVec<u8, T::CidLimit>>,
    /// 时长（秒）
    pub duration: u32,
    /// 分类
    pub category: MediaCategory,
    /// 视频专属：分辨率（音频为None）
    pub quality: Option<VideoQuality>,
    /// 视频专属：字幕CID（可选，多语言）
    pub subtitle_cid: Option<BoundedVec<u8, T::CidLimit>>,
    /// 是否启用
    pub enabled: bool,
    /// 创建者（Root/治理委员会）
    pub creator: T::AccountId,
    /// 创建时间
    pub created_at: BlockNumberFor<T>,
    /// 更新时间
    pub updated_at: BlockNumberFor<T>,
}

/// 媒体统计（可选，Phase 2）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
pub struct MediaStats {
    /// 总播放次数
    pub play_count: u64,
    /// 总点赞数
    pub like_count: u32,
    /// 最后播放时间
    pub last_played_at: Option<u32>,  // BlockNumber
}
```

---

### 4.3 存储设计

```rust
#[pallet::storage]
#[pallet::getter(fn media_library)]
pub type MediaLibrary<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u32,  // media_id
    MediaEntry<T>,
>;

#[pallet::storage]
#[pallet::getter(fn next_media_id)]
pub type NextMediaId<T: Config> = StorageValue<_, u32, ValueQuery>;

#[pallet::storage]
#[pallet::getter(fn media_by_category)]
pub type MediaByCategory<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    MediaCategory,
    BoundedVec<u32, ConstU32<100>>,  // 每分类最多100个媒体
    ValueQuery,
>;

// 按媒体类型索引（便于快速查询所有音频或所有视频）
#[pallet::storage]
#[pallet::getter(fn media_by_type)]
pub type MediaByType<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    MediaType,
    BoundedVec<u32, ConstU32<500>>,  // 每类型最多500个
    ValueQuery,
>;

// 可选：启用的媒体索引
#[pallet::storage]
pub type EnabledMediaIds<T: Config> = StorageValue<
    _,
    BoundedVec<u32, ConstU32<1000>>,  // 最多1000个启用媒体
    ValueQuery,
>;

// 可选：媒体统计（Phase 2）
#[pallet::storage]
pub type MediaStatsOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u32,  // media_id
    MediaStats,
    ValueQuery,
>;
```

---

### 4.4 Config Trait

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 字符串长度限制
    #[pallet::constant]
    type StringLimit: Get<u32>;

    /// CID长度限制
    #[pallet::constant]
    type CidLimit: Get<u32>;

    /// 管理员权限（Root或治理委员会）
    type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

    /// 权重信息
    type WeightInfo: WeightInfo;
}
```

---

### 4.5 核心接口

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 添加公共媒体（音频或视频）
    #[pallet::weight(T::WeightInfo::add_media())]
    pub fn add_media(
        origin: OriginFor<T>,
        media_type: MediaType,
        name: Vec<u8>,
        media_cid: Vec<u8>,
        cover_cid: Option<Vec<u8>>,
        duration: u32,
        category: MediaCategory,
        // 视频专属参数
        quality: Option<VideoQuality>,
        subtitle_cid: Option<Vec<u8>>,
    ) -> DispatchResult {
        T::AdminOrigin::ensure_origin(origin.clone())?;
        let creator = ensure_signed(origin)?;

        // 验证参数
        ensure!(duration > 0, Error::<T>::InvalidDuration);
        ensure!(!name.is_empty(), Error::<T>::EmptyName);

        // 验证分类与媒体类型的一致性
        match (&media_type, &category) {
            (MediaType::Audio, MediaCategory::Audio(_)) => {},
            (MediaType::Video, MediaCategory::Video(_)) => {},
            _ => return Err(Error::<T>::MediaTypeMismatch.into()),
        }

        // 转换为 BoundedVec
        let name_bounded: BoundedVec<u8, T::StringLimit> = name
            .try_into()
            .map_err(|_| Error::<T>::NameTooLong)?;
        let media_cid_bounded: BoundedVec<u8, T::CidLimit> = media_cid
            .try_into()
            .map_err(|_| Error::<T>::CidTooLong)?;
        let cover_cid_bounded = cover_cid
            .map(|cid| cid.try_into())
            .transpose()
            .map_err(|_| Error::<T>::CidTooLong)?;
        let subtitle_cid_bounded = subtitle_cid
            .map(|cid| cid.try_into())
            .transpose()
            .map_err(|_| Error::<T>::CidTooLong)?;

        // 创建媒体条目
        let media_id = Self::next_media_id();
        let now = <frame_system::Pallet<T>>::block_number();

        let entry = MediaEntry {
            id: media_id,
            media_type,
            name: name_bounded,
            media_cid: media_cid_bounded,
            cover_cid: cover_cid_bounded,
            duration,
            category,
            quality,
            subtitle_cid: subtitle_cid_bounded,
            enabled: true,
            creator,
            created_at: now,
            updated_at: now,
        };

        // 存储
        MediaLibrary::<T>::insert(media_id, entry);
        NextMediaId::<T>::put(media_id + 1);

        // 添加到分类索引
        MediaByCategory::<T>::try_mutate(category, |ids| {
            ids.try_push(media_id)
        })?;

        // 添加到类型索引
        MediaByType::<T>::try_mutate(media_type, |ids| {
            ids.try_push(media_id)
        })?;

        // 添加到启用索引
        EnabledMediaIds::<T>::try_mutate(|ids| {
            ids.try_push(media_id)
        })?;

        // 触发事件
        Self::deposit_event(Event::MediaAdded {
            media_id,
            media_type,
            category,
        });

        Ok(())
    }

    /// 更新媒体信息
    #[pallet::weight(T::WeightInfo::update_media())]
    pub fn update_media(
        origin: OriginFor<T>,
        media_id: u32,
        name: Option<Vec<u8>>,
        cover_cid: Option<Vec<u8>>,
        duration: Option<u32>,
        subtitle_cid: Option<Vec<u8>>,  // 仅视频使用
    ) -> DispatchResult {
        T::AdminOrigin::ensure_origin(origin)?;

        MediaLibrary::<T>::try_mutate(media_id, |entry| {
            let e = entry.as_mut().ok_or(Error::<T>::MediaNotFound)?;

            if let Some(n) = name {
                e.name = n.try_into().map_err(|_| Error::<T>::NameTooLong)?;
            }
            if let Some(cid) = cover_cid {
                e.cover_cid = Some(cid.try_into().map_err(|_| Error::<T>::CidTooLong)?);
            }
            if let Some(d) = duration {
                ensure!(d > 0, Error::<T>::InvalidDuration);
                e.duration = d;
            }
            if let Some(sub_cid) = subtitle_cid {
                e.subtitle_cid = Some(sub_cid.try_into().map_err(|_| Error::<T>::CidTooLong)?);
            }

            e.updated_at = <frame_system::Pallet<T>>::block_number();

            Self::deposit_event(Event::MediaUpdated { media_id });
            Ok(())
        })
    }

    /// 设置媒体状态（启用/禁用）
    #[pallet::weight(T::WeightInfo::set_media_status())]
    pub fn set_media_status(
        origin: OriginFor<T>,
        media_id: u32,
        enabled: bool,
    ) -> DispatchResult {
        T::AdminOrigin::ensure_origin(origin)?;

        MediaLibrary::<T>::try_mutate(media_id, |entry| {
            let e = entry.as_mut().ok_or(Error::<T>::MediaNotFound)?;
            e.enabled = enabled;
            e.updated_at = <frame_system::Pallet<T>>::block_number();

            // 更新启用索引
            if enabled {
                EnabledMediaIds::<T>::try_mutate(|ids| {
                    if !ids.contains(&media_id) {
                        ids.try_push(media_id)
                    } else {
                        Ok(())
                    }
                })?;
            } else {
                EnabledMediaIds::<T>::mutate(|ids| {
                    ids.retain(|&id| id != media_id);
                });
            }

            Self::deposit_event(Event::MediaStatusChanged { media_id, enabled });
            Ok(())
        })
    }

    /// 删除媒体（软删除：仅禁用）
    #[pallet::weight(T::WeightInfo::remove_media())]
    pub fn remove_media(
        origin: OriginFor<T>,
        media_id: u32,
    ) -> DispatchResult {
        T::AdminOrigin::ensure_origin(origin)?;

        // 软删除：仅禁用，保留记录
        Self::set_media_status(origin, media_id, false)?;

        Self::deposit_event(Event::MediaRemoved { media_id });
        Ok(())
    }

    /// 记录播放次数（可选，Phase 2）
    #[pallet::weight(T::WeightInfo::record_play())]
    pub fn record_play(
        origin: OriginFor<T>,
        media_id: u32,
    ) -> DispatchResult {
        ensure_signed(origin)?;

        ensure!(
            MediaLibrary::<T>::contains_key(media_id),
            Error::<T>::MediaNotFound
        );

        MediaStatsOf::<T>::mutate(media_id, |stats| {
            stats.play_count = stats.play_count.saturating_add(1);
            stats.last_played_at = Some(<frame_system::Pallet<T>>::block_number().saturated_into());
        });

        Self::deposit_event(Event::MediaPlayed { media_id });
        Ok(())
    }
}
```

---

### 4.6 辅助查询函数

```rust
impl<T: Config> Pallet<T> {
    /// 获取指定分类的所有启用媒体
    pub fn get_media_by_category(category: MediaCategory) -> Vec<u32> {
        let all_ids = MediaByCategory::<T>::get(category);
        all_ids.into_iter()
            .filter(|&id| {
                MediaLibrary::<T>::get(id)
                    .map(|e| e.enabled)
                    .unwrap_or(false)
            })
            .collect()
    }

    /// 获取指定类型的所有启用媒体（音频或视频）
    pub fn get_media_by_type(media_type: MediaType) -> Vec<u32> {
        let all_ids = MediaByType::<T>::get(media_type);
        all_ids.into_iter()
            .filter(|&id| {
                MediaLibrary::<T>::get(id)
                    .map(|e| e.enabled)
                    .unwrap_or(false)
            })
            .collect()
    }

    /// 随机获取指定分类的媒体
    pub fn get_random_media(category: MediaCategory) -> Option<u32> {
        let media_ids = Self::get_media_by_category(category);
        if media_ids.is_empty() {
            return None;
        }

        // 使用区块哈希作为随机数种子
        let block_hash = <frame_system::Pallet<T>>::block_hash(
            <frame_system::Pallet<T>>::block_number()
        );
        let seed = block_hash.as_ref()[0] as usize;
        let index = seed % media_ids.len();

        media_ids.get(index).copied()
    }

    /// 随机获取指定类型的媒体（用于快速查询所有音频或所有视频）
    pub fn get_random_media_by_type(media_type: MediaType) -> Option<u32> {
        let media_ids = Self::get_media_by_type(media_type);
        if media_ids.is_empty() {
            return None;
        }

        let block_hash = <frame_system::Pallet<T>>::block_hash(
            <frame_system::Pallet<T>>::block_number()
        );
        let seed = block_hash.as_ref()[0] as usize;
        let index = seed % media_ids.len();

        media_ids.get(index).copied()
    }

    /// 获取所有启用的媒体ID
    pub fn get_all_enabled_media() -> Vec<u32> {
        EnabledMediaIds::<T>::get().into_inner()
    }

    /// 检查媒体是否存在且启用
    pub fn is_media_available(media_id: u32) -> bool {
        MediaLibrary::<T>::get(media_id)
            .map(|e| e.enabled)
            .unwrap_or(false)
    }

    /// 获取媒体详细信息
    pub fn get_media_info(media_id: u32) -> Option<MediaEntry<T>> {
        MediaLibrary::<T>::get(media_id)
    }
}
```

---

### 4.7 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    /// 媒体已添加
    MediaAdded {
        media_id: u32,
        media_type: MediaType,
        category: MediaCategory,
    },
    /// 媒体已更新
    MediaUpdated {
        media_id: u32,
    },
    /// 媒体状态已变更
    MediaStatusChanged {
        media_id: u32,
        enabled: bool,
    },
    /// 媒体已删除
    MediaRemoved {
        media_id: u32,
    },
    /// 媒体已播放（可选，Phase 2）
    MediaPlayed {
        media_id: u32,
    },
}
```

---

### 4.8 错误定义

```rust
#[pallet::error]
pub enum Error<T> {
    /// 媒体不存在
    MediaNotFound,
    /// 媒体名称为空
    EmptyName,
    /// 媒体名称过长
    NameTooLong,
    /// CID过长
    CidTooLong,
    /// 时长无效
    InvalidDuration,
    /// 分类已满
    CategoryFull,
    /// 媒体库已满
    MediaLibraryFull,
    /// 媒体类型与分类不匹配
    MediaTypeMismatch,
}
```

---

## 五、其他 Pallet 集成示例

### 5.1 pallet-deceased 集成（音频+视频）

```rust
// pallets/deceased/src/lib.rs

#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 现有配置

    /// 公共媒体库接口
    type PublicMedia: PublicMediaProvider;
}

// 使用示例
impl<T: Config> Pallet<T> {
    /// 获取逝者纪念馆推荐背景音乐
    pub fn get_memorial_audio(deceased_id: u64) -> Option<u32> {
        // 1. 检查是否有背景音乐设置
        if let Some(deceased) = DeceasedOf::<T>::get(deceased_id) {
            if deceased.background_music_id.is_some() {
                return deceased.background_music_id;
            }
        }

        // 2. 使用公共媒体库的默认音乐
        T::PublicMedia::get_random_media(MediaCategory::Audio(AudioCategory::Requiem))
    }

    /// 获取逝者纪念馆生平视频
    pub fn get_memorial_video(deceased_id: u64) -> Option<u32> {
        // 1. 检查是否有生平视频设置
        if let Some(deceased) = DeceasedOf::<T>::get(deceased_id) {
            if deceased.biography_video_id.is_some() {
                return deceased.biography_video_id;
            }
        }

        // 2. 使用公共媒体库的默认视频
        T::PublicMedia::get_random_media(MediaCategory::Video(VideoCategory::Biography))
    }
}
```

---

### 5.2 pallet-stardust-park 集成（陵园宣传视频+环境音乐）

```rust
// pallets/stardust-park/src/lib.rs

#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 现有配置

    /// 公共媒体库接口
    type PublicMedia: PublicMediaProvider;
}

impl<T: Config> Pallet<T> {
    /// 获取陵园入口背景音乐
    pub fn get_park_entrance_audio(park_id: u64) -> Option<u32> {
        // 陵园使用轻音乐或环境音乐
        T::PublicMedia::get_random_media(MediaCategory::Audio(AudioCategory::Ambient))
    }

    /// 获取陵园宣传视频
    pub fn get_park_promotional_video(park_id: u64) -> Option<u32> {
        // 陵园使用宣传片
        T::PublicMedia::get_random_media(MediaCategory::Video(VideoCategory::Promotional))
    }
}
```

---

### 5.3 Trait 定义（在 primitives 中）

```rust
// primitives/src/traits.rs

/// 公共媒体库接口（音频+视频）
pub trait PublicMediaProvider {
    /// 获取指定分类的随机媒体
    fn get_random_media(category: MediaCategory) -> Option<u32>;

    /// 获取指定类型的随机媒体（音频或视频）
    fn get_random_media_by_type(media_type: MediaType) -> Option<u32>;

    /// 获取指定分类的所有媒体
    fn get_media_by_category(category: MediaCategory) -> Vec<u32>;

    /// 获取指定类型的所有媒体
    fn get_media_by_type(media_type: MediaType) -> Vec<u32>;

    /// 检查媒体是否可用
    fn is_media_available(media_id: u32) -> bool;

    /// 获取媒体信息
    fn get_media_info(media_id: u32) -> Option<MediaInfo>;
}

/// 媒体信息（简化版，用于跨 Pallet 传递）
pub struct MediaInfo {
    pub id: u32,
    pub media_type: MediaType,
    pub name: Vec<u8>,
    pub media_cid: Vec<u8>,
    pub duration: u32,
    pub category: MediaCategory,
    pub quality: Option<VideoQuality>,  // 仅视频有值
}
```

---

## 六、Runtime 集成

```rust
// runtime/src/lib.rs

// 1. 添加 Pallet
pub use pallet_public_media;

// 2. 配置
impl pallet_public_media::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StringLimit = ConstU32<128>;
    type CidLimit = ConstU32<64>;
    type AdminOrigin = EnsureRootOrHalfCouncil;
    type WeightInfo = pallet_public_media::weights::SubstrateWeight<Runtime>;
}

// 3. 集成到 Runtime
construct_runtime!(
    pub struct Runtime {
        // ... 现有 Pallets
        PublicMedia: pallet_public_media,
    }
);

// 4. 为 Deceased 配置媒体库接口
impl pallet_deceased::Config for Runtime {
    // ... 现有配置
    type PublicMedia = PublicMedia;
}

// 5. 为 Park 配置媒体库接口
impl pallet_stardust_park::Config for Runtime {
    // ... 现有配置
    type PublicMedia = PublicMedia;
}
```

---

## 七、可行性评估

### 7.1 技术可行性

| 维度 | 评分 | 说明 |
|------|------|------|
| **开发难度** | ⭐⭐ | 简单，标准 Pallet 结构 |
| **测试难度** | ⭐⭐ | 单元测试简单 |
| **集成难度** | ⭐⭐ | Runtime 配置简单 |
| **维护成本** | ⭐ | 独立维护，成本低 |

**结论**: ✅ 技术可行性极高

---

### 7.2 合理性评估

#### 架构合理性 ⭐⭐⭐⭐⭐

**优点**:
1. **符合单一职责原则**: 专注媒体管理（音频+视频）
2. **低耦合高内聚**: 与业务 Pallet 解耦
3. **易于扩展**: 支持未来更多场景和媒体类型
4. **可复用性强**: 其他项目可直接使用
5. **统一接口**: 音频和视频使用相同的管理模式

#### 业务合理性 ⭐⭐⭐⭐⭐

**优点**:
1. **跨领域基础设施**: 多个 Pallet 共享（音频+视频）
2. **语义清晰**: 名称明确表达功能
3. **易于治理**: 统一管理媒体资源
4. **版权管理**: 集中处理版权问题
5. **功能完整**: 同时支持音频氛围和视频展示需求

#### 成本效益分析 ⭐⭐⭐⭐⭐

| 成本 | 收益 |
|------|------|
| 开发成本: 2-3天 | 架构清晰，易维护 |
| 集成成本: 0.5天 | 多 Pallet 复用（音频+视频） |
| 维护成本: 极低 | 独立演进，统一接口 |
| 初始媒体准备: 1天 | 丰富的媒体资源库 |

**ROI**: 极高（投入3-4天，长期收益显著）

---

## 八、与方案A的对比

| 维度 | 方案A（集成到 Deceased） | 方案B（独立 Pallet） | 胜者 |
|------|------------------------|---------------------|------|
| **开发成本** | 1天 | 3天 | A |
| **支持媒体类型** | 仅音频 | 音频+视频 | B |
| **架构清晰度** | ⭐⭐ | ⭐⭐⭐⭐⭐ | B |
| **可维护性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | B |
| **可扩展性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | B |
| **依赖合理性** | ⭐ | ⭐⭐⭐⭐⭐ | B |
| **复用性** | ⭐ | ⭐⭐⭐⭐⭐ | B |
| **长期成本** | 高 | 低 | B |

**综合评分**:
- 方案A: ⭐⭐ (仅适合快速原型，功能受限)
- 方案B: ⭐⭐⭐⭐⭐ (生产级设计，功能完整)

---

## 九、实施计划

### Phase 1: 核心功能（3天）

**Day 1**:
- ✅ 创建 `pallet-public-media` 结构
- ✅ 实现数据结构（MediaType, AudioCategory, VideoCategory）
- ✅ 实现存储设计（MediaLibrary, MediaByType, MediaByCategory）
- ✅ 编写类型系统单元测试

**Day 2**:
- ✅ 实现核心接口（add_media/update_media/set_media_status）
- ✅ 实现辅助查询函数（按类型、按分类查询）
- ✅ 编写功能单元测试（音频和视频分别测试）

**Day 3**:
- ✅ 定义 `PublicMediaProvider` Trait
- ✅ Runtime 集成
- ✅ 编写集成测试（跨 Pallet 调用测试）
- ✅ 准备初始媒体资源（5个音频 + 5个视频）

---

### Phase 2: 扩展功能（1周，可选）

**Day 4-5**:
- 播放统计功能（音频和视频）
- 用户评分功能
- 媒体推荐算法（基于场景和用户偏好）

**Day 6-8**:
- 版权信息管理（音频和视频版权追踪）
- 媒体审核流程（治理委员会审核）
- 字幕管理（视频多语言字幕）
- 多分辨率支持（视频质量自适应）

---

## 十、风险与应对

### 10.1 技术风险

| 风险 | 等级 | 应对措施 |
|------|------|---------|
| **存储膨胀** | 🟡 中 | 限制媒体数量（音频500个+视频500个），仅存CID |
| **查询性能** | 🟢 低 | 使用索引优化，分类和类型查询O(1) |
| **并发冲突** | 🟢 低 | 使用 `try_mutate` 保证原子性 |
| **视频大小** | 🟡 中 | 建议视频时长≤5分钟，分辨率≤1080p |

### 10.2 业务风险

| 风险 | 等级 | 应对措施 |
|------|------|---------|
| **版权纠纷** | 🔴 高 | 使用CC0/CC-BY媒体，记录来源和授权信息 |
| **内容审核** | 🟡 中 | 治理委员会审核，用户举报机制 |
| **滥用风险** | 🟢 低 | Root/治理委员会权限控制 |
| **带宽成本** | 🟡 中 | IPFS公共网关，视频采用流媒体协议 |

---

## 十一、总结与建议

### 11.1 核心结论

✅ **强烈推荐独立创建 `pallet-public-media`（音频+视频统一管理）**

**理由**:
1. **架构优雅**: 低耦合、高内聚、符合设计原则
2. **功能完整**: 同时支持音频氛围营造和视频内容展示
3. **长期收益**: 可维护性、可扩展性、复用性极高
4. **成本可控**: 开发3天，但长期维护成本低
5. **业务合理**: 跨领域基础设施，独立管理最合理
6. **统一接口**: 音频和视频使用相同管理模式，降低学习成本

### 11.2 实施建议

**立即行动**:
1. ✅ 创建 `pallet-public-media`（统一音频+视频）
2. ✅ 实现核心功能（3天）
3. ✅ Runtime 集成
4. ✅ 准备初始媒体库（5个音频 + 5个视频）

**后续迭代**:
5. 添加播放统计（Phase 2）
6. 实现媒体推荐（Phase 3）
7. 版权管理系统（Phase 4）
8. 视频字幕和多分辨率支持（Phase 5）

---

### 11.3 成功案例参考

类似的独立基础设施 Pallet:
- `pallet-balances`: 货币管理，被所有 Pallet 使用
- `pallet-assets`: 资产管理，跨领域复用
- `pallet-nfts`: NFT管理，多场景使用
- **`pallet-public-media`**: 媒体管理（音频+视频），跨业务复用 ✨

---

**分析完成时间**: 2025-11-23
**分析人**: Claude Code
**推荐方案**: ⭐⭐⭐⭐⭐ 方案B - 独立 Pallet（统一音频+视频）
**优先级**: 高（建议立即实施）
