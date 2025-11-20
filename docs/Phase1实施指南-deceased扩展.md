# Phase 1实施指南 - 扩展pallet-deceased添加作品记录功能

## ✅ 已完成工作

### 1. works.rs模块创建（已完成）
- ✅ 定义了WorkType枚举（支持15种作品类型）
- ✅ 定义了DeceasedWork结构体
- ✅ 定义了PrivacyLevel枚举
- ✅ 定义了LiteratureGenre枚举
- ✅ 定义了WorkUploadInfo辅助结构
- ✅ 实现了辅助方法（is_text_based, is_ai_training_valuable等）

### 2. lib.rs模块导出（已完成）
- ✅ 添加了`pub mod works;`
- ✅ 添加了`pub use works::*;`

---

## 🔧 待完成工作

### Step 1: 添加存储项（在lib.rs的#[pallet::pallet]块之后）

在现有存储项后添加以下存储定义：

```rust
// ===== 作品记录存储 (Phase 1: AI训练数据基础) =====

/// 函数级详细中文注释：下一个作品ID
#[pallet::storage]
#[pallet::getter(fn next_work_id)]
pub type NextWorkId<T: Config> = StorageValue<_, u64, ValueQuery>;

/// 函数级详细中文注释：作品记录映射
///
/// ## 键值
/// - Key: work_id (u64)
/// - Value: DeceasedWork结构
///
/// ## 用途
/// - 存储所有作品的完整元数据
/// - 用于查询、更新、删除作品
#[pallet::storage]
#[pallet::getter(fn deceased_works)]
pub type DeceasedWorks<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // work_id
    DeceasedWork<T::AccountId, BlockNumberFor<T>>,
>;

/// 函数级详细中文注释：逝者作品列表索引
///
/// ## 键值
/// - Key: deceased_id (T::DeceasedId)
/// - Value: BoundedVec<u64> (work_ids，最多10000个)
///
/// ## 用途
/// - 快速查询某个逝者的所有作品
/// - 用于AI训练数据导出
#[pallet::storage]
#[pallet::getter(fn works_by_deceased)]
pub type WorksByDeceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<u64, ConstU32<10000>>,  // 每个逝者最多10000个作品
    ValueQuery,
>;

/// 函数级详细中文注释：作品类型索引
///
/// ## 键值
/// - Key1: deceased_id (T::DeceasedId)
/// - Key2: work_type_str (作品类型字符串)
/// - Value: BoundedVec<u64> (work_ids，最多1000个)
///
/// ## 用途
/// - 按类型筛选作品
/// - AI训练时优先获取文本类作品
///
/// ## 注意
/// - work_type_str使用WorkType::as_str()的返回值
#[pallet::storage]
#[pallet::getter(fn works_by_type)]
pub type WorksByType<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat, T::DeceasedId,
    Blake2_128Concat, BoundedVec<u8, ConstU32<50>>,  // work_type_str
    BoundedVec<u64, ConstU32<1000>>,
    ValueQuery,
>;

/// 函数级详细中文注释：AI训练授权作品索引
///
/// ## 键值
/// - Key: deceased_id (T::DeceasedId)
/// - Value: BoundedVec<u64> (work_ids，最多5000个)
///
/// ## 用途
/// - 快速查询可用于AI训练的作品列表
/// - 导出训练数据集
#[pallet::storage]
#[pallet::getter(fn ai_training_works)]
pub type AITrainingWorks<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<u64, ConstU32<5000>>,
    ValueQuery,
>;

/// 函数级详细中文注释：作品统计信息
///
/// ## 结构
/// - total_count: 总作品数
/// - text_count: 文本类作品数
/// - audio_count: 音频类作品数
/// - video_count: 视频类作品数
/// - image_count: 图像类作品数
/// - ai_training_count: 授权AI训练的作品数
/// - total_size: 总文件大小（字节）
///
/// ## 用途
/// - 前端展示统计信息
/// - 评估AI训练数据量
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub struct WorkStats {
    pub total_count: u32,
    pub text_count: u32,
    pub audio_count: u32,
    pub video_count: u32,
    pub image_count: u32,
    pub ai_training_count: u32,
    pub total_size: u64,
}

#[pallet::storage]
#[pallet::getter(fn work_stats)]
pub type WorkStatsByDeceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    WorkStats,
    ValueQuery,
>;
```

**插入位置**：在`DeceasedHistory`存储项之后，`Relation`结构定义之前（约916行附近）

---

### Step 2: 添加事件定义（在现有Event枚举中）

在现有事件后添加：

```rust
// ===== 作品相关事件 (Phase 1) =====

/// 作品已上传
WorkUploaded {
    work_id: u64,
    deceased_id: T::DeceasedId,
    work_type: &'static str,  // 使用WorkType::as_str()
    uploader: T::AccountId,
    file_size: u64,
    ai_training_enabled: bool,
},

/// 批量作品已上传
WorksBatchUploaded {
    deceased_id: T::DeceasedId,
    count: u32,
    uploader: T::AccountId,
},

/// 作品元数据已更新
WorkUpdated {
    work_id: u64,
    updater: T::AccountId,
},

/// 作品已删除
WorkDeleted {
    work_id: u64,
    deceased_id: T::DeceasedId,
    deleter: T::AccountId,
},

/// 作品已验证
WorkVerified {
    work_id: u64,
    verifier: T::AccountId,
},

/// AI训练授权已更新
AITrainingAuthUpdated {
    work_id: u64,
    enabled: bool,
},
```

**插入位置**：在现有Event枚举的末尾，最后一个事件之后

---

### Step 3: 添加错误定义（在现有Error枚举中）

在现有错误后添加：

```rust
// ===== 作品相关错误 (Phase 1) =====

/// 作品不存在
WorkNotFound,

/// 作品列表已满（单个逝者作品数超过限制）
TooManyWorks,

/// 标题过长
TitleTooLong,

/// 描述过长
DescriptionTooLong,

/// IPFS CID无效
InvalidIpfsCid,

/// 文件大小无效
InvalidFileSize,

/// 标签过多
TooManyTags,

/// 无权限操作该作品
WorkNotAuthorized,

/// 作品已验证，无法修改
WorkAlreadyVerified,

/// 创作时间无效（未来时间）
InvalidCreatedTime,
```

**插入位置**：在现有Error枚举的末尾

---

### Step 4: 实现作品上传功能（在#[pallet::call]块中）

添加以下extrinsics：

```rust
// ===== 作品管理功能 (Phase 1: AI训练数据基础) =====

/// 函数级详细中文注释：上传逝者作品
///
/// ## 参数
/// - `origin`: 调用者（必须是墓地所有者或授权账户）
/// - `deceased_id`: 逝者ID
/// - `work_type`: 作品类型
/// - `title`: 作品标题
/// - `description`: 作品描述
/// - `ipfs_cid`: IPFS存储地址
/// - `file_size`: 文件大小（字节）
/// - `created_at`: 创作时间（可选，Unix时间戳）
/// - `tags`: 主题标签
/// - `privacy_level`: 隐私级别
/// - `ai_training_enabled`: 是否授权AI训练
///
/// ## 权限检查
/// - 调用者必须是墓地所有者或被授权的管理员
///
/// ## 返回
/// - `DispatchResult`: 成功或错误
#[pallet::call_index(20)]  // 使用未占用的call_index
#[pallet::weight(T::WeightInfo::upload_work())]
pub fn upload_work(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    work_type: WorkType,
    title: Vec<u8>,
    description: Vec<u8>,
    ipfs_cid: Vec<u8>,
    file_size: u64,
    created_at: Option<u64>,
    tags: Vec<Vec<u8>>,
    privacy_level: PrivacyLevel,
    ai_training_enabled: bool,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 权限检查（需要是墓地所有者或授权账户）
    Self::ensure_can_manage_deceased(&who, deceased_id)?;

    Self::do_upload_work(
        who,
        deceased_id,
        work_type,
        title,
        description,
        ipfs_cid,
        file_size,
        created_at,
        tags,
        privacy_level,
        ai_training_enabled,
    )
}

/// 函数级详细中文注释：批量上传作品
///
/// ## 用途
/// - 减少交易次数和手续费
/// - 提高大量作品上传效率
///
/// ## 参数
/// - `origin`: 调用者
/// - `deceased_id`: 逝者ID
/// - `works`: 作品信息列表（最多50个）
///
/// ## 返回
/// - `DispatchResult`: 成功或错误
#[pallet::call_index(21)]
#[pallet::weight(T::WeightInfo::batch_upload_works(works.len() as u32))]
pub fn batch_upload_works(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    works: Vec<WorkUploadInfo>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 权限检查
    Self::ensure_can_manage_deceased(&who, deceased_id)?;

    // 批量限制
    ensure!(works.len() <= 50, Error::<T>::TooManyWorks);

    Self::do_batch_upload_works(who, deceased_id, works)
}

/// 函数级详细中文注释：更新作品元数据
///
/// ## 可更新字段
/// - 标题、描述
/// - 标签
/// - 隐私级别
/// - AI训练授权
///
/// ## 限制
/// - 已验证的作品无法修改
/// - IPFS CID和文件大小无法修改
///
/// ## 参数
/// - `origin`: 调用者
/// - `work_id`: 作品ID
/// - 其他字段为Optional
///
/// ## 返回
/// - `DispatchResult`: 成功或错误
#[pallet::call_index(22)]
#[pallet::weight(T::WeightInfo::update_work())]
pub fn update_work(
    origin: OriginFor<T>,
    work_id: u64,
    title: Option<Vec<u8>>,
    description: Option<Vec<u8>>,
    tags: Option<Vec<Vec<u8>>>,
    privacy_level: Option<PrivacyLevel>,
    ai_training_enabled: Option<bool>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    Self::do_update_work(who, work_id, title, description, tags, privacy_level, ai_training_enabled)
}

/// 函数级详细中文注释：删除作品
///
/// ## 功能
/// - 从存储中移除作品记录
/// - 更新所有相关索引
/// - 不删除IPFS文件（需手动unpinning）
///
/// ## 权限
/// - 仅墓地所有者可删除
///
/// ## 参数
/// - `origin`: 调用者
/// - `work_id`: 作品ID
///
/// ## 返回
/// - `DispatchResult`: 成功或错误
#[pallet::call_index(23)]
#[pallet::weight(T::WeightInfo::delete_work())]
pub fn delete_work(
    origin: OriginFor<T>,
    work_id: u64,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    Self::do_delete_work(who, work_id)
}

/// 函数级详细中文注释：验证作品真实性
///
/// ## 功能
/// - 标记作品为"已验证"状态
/// - 验证后的作品无法修改（保护数据完整性）
///
/// ## 权限
/// - 墓地所有者
/// - 委员会成员（可选）
///
/// ## 参数
/// - `origin`: 调用者
/// - `work_id`: 作品ID
///
/// ## 返回
/// - `DispatchResult`: 成功或错误
#[pallet::call_index(24)]
#[pallet::weight(T::WeightInfo::verify_work())]
pub fn verify_work(
    origin: OriginFor<T>,
    work_id: u64,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    Self::do_verify_work(who, work_id)
}
```

**插入位置**：在现有extrinsics的末尾，在impl块结束之前

---

### Step 5: 实现内部逻辑函数（在impl<T: Config> Pallet<T>块中）

添加以下内部实现：

```rust
// ===== 作品管理内部实现 =====

/// 函数级详细中文注释：内部实现-上传作品
pub fn do_upload_work(
    uploader: T::AccountId,
    deceased_id: T::DeceasedId,
    work_type: WorkType,
    title: Vec<u8>,
    description: Vec<u8>,
    ipfs_cid: Vec<u8>,
    file_size: u64,
    created_at: Option<u64>,
    tags: Vec<Vec<u8>>,
    privacy_level: PrivacyLevel,
    ai_training_enabled: bool,
) -> DispatchResult {
    // 1. 验证输入参数
    let title_bounded: BoundedVec<u8, ConstU32<200>> = title
        .try_into()
        .map_err(|_| Error::<T>::TitleTooLong)?;

    let description_bounded: BoundedVec<u8, ConstU32<1000>> = description
        .try_into()
        .map_err(|_| Error::<T>::DescriptionTooLong)?;

    let ipfs_cid_bounded: BoundedVec<u8, ConstU32<64>> = ipfs_cid
        .try_into()
        .map_err(|_| Error::<T>::InvalidIpfsCid)?;

    // 验证创作时间（不能是未来时间）
    if let Some(created_time) = created_at {
        let now = T::Timestamp::now().as_secs();
        ensure!(created_time <= now, Error::<T>::InvalidCreatedTime);
    }

    // 转换标签
    let mut tags_bounded = BoundedVec::<BoundedVec<u8, ConstU32<50>>, ConstU32<20>>::default();
    for tag in tags {
        let tag_bounded: BoundedVec<u8, ConstU32<50>> = tag
            .try_into()
            .map_err(|_| Error::<T>::TooManyTags)?;
        tags_bounded
            .try_push(tag_bounded)
            .map_err(|_| Error::<T>::TooManyTags)?;
    }

    // 2. 获取work_id
    let work_id = NextWorkId::<T>::get();
    let current_block = frame_system::Pallet::<T>::block_number();

    // 3. 创建作品记录
    let work = DeceasedWork {
        work_id,
        deceased_id,
        work_type: work_type.clone(),
        title: title_bounded,
        description: description_bounded,
        ipfs_cid: ipfs_cid_bounded,
        file_size,
        created_at,
        uploaded_at: current_block,
        uploader: uploader.clone(),
        tags: tags_bounded,
        sentiment: None,
        style_tags: BoundedVec::default(),
        expertise_fields: BoundedVec::default(),
        privacy_level,
        ai_training_enabled,
        public_display: privacy_level == PrivacyLevel::Public,
        verified: false,
        verifier: None,
    };

    // 4. 存储作品
    DeceasedWorks::<T>::insert(work_id, work.clone());
    NextWorkId::<T>::put(work_id + 1);

    // 5. 更新索引
    WorksByDeceased::<T>::try_mutate(deceased_id, |works| {
        works.try_push(work_id).map_err(|_| Error::<T>::TooManyWorks)
    })?;

    // 按类型索引
    let work_type_str: BoundedVec<u8, ConstU32<50>> = work_type.as_str()
        .as_bytes()
        .to_vec()
        .try_into()
        .unwrap();  // as_str()返回的字符串肯定<50字符

    WorksByType::<T>::try_mutate(deceased_id, work_type_str, |works| {
        works.try_push(work_id).map_err(|_| Error::<T>::TooManyWorks)
    })?;

    // AI训练索引
    if ai_training_enabled && work.is_ai_training_valuable() {
        AITrainingWorks::<T>::try_mutate(deceased_id, |works| {
            works.try_push(work_id).map_err(|_| Error::<T>::TooManyWorks)
        })?;
    }

    // 6. 更新统计信息
    WorkStatsByDeceased::<T>::mutate(deceased_id, |stats| {
        stats.total_count += 1;
        stats.total_size += file_size;

        if work_type.is_text_based() {
            stats.text_count += 1;
        } else if work_type.is_audio_based() {
            stats.audio_count += 1;
        } else if work_type.is_video_based() {
            stats.video_count += 1;
        }

        if ai_training_enabled {
            stats.ai_training_count += 1;
        }
    });

    // 7. 发出事件
    Self::deposit_event(Event::WorkUploaded {
        work_id,
        deceased_id,
        work_type: work_type.as_str(),
        uploader,
        file_size,
        ai_training_enabled,
    });

    Ok(())
}

/// 函数级详细中文注释：检查用户是否有权管理逝者数据
///
/// ## 权限规则
/// - 墓地所有者
/// - 被授权的管理员（如果实现了权限系统）
///
/// ## 参数
/// - `who`: 调用者账户
/// - `deceased_id`: 逝者ID
///
/// ## 返回
/// - `Ok(())`: 有权限
/// - `Err`: 无权限
fn ensure_can_manage_deceased(
    who: &T::AccountId,
    deceased_id: T::DeceasedId,
) -> DispatchResult {
    // 检查是否是逝者的owner
    let deceased = Deceased::<T>::get(deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;

    ensure!(deceased.owner == *who, Error::<T>::NotOwner);

    Ok(())
}

// TODO: 实现其他内部函数
// - do_batch_upload_works
// - do_update_work
// - do_delete_work
// - do_verify_work
```

**插入位置**：在现有impl<T: Config> Pallet<T>块的末尾

---

### Step 6: 更新WeightInfo trait（在lib.rs开头附近）

```rust
pub trait WeightInfo {
    fn create() -> Weight;
    fn update() -> Weight;
    fn remove() -> Weight;
    fn transfer() -> Weight;

    // === 作品相关权重 (Phase 1) ===
    fn upload_work() -> Weight;
    fn batch_upload_works(count: u32) -> Weight;
    fn update_work() -> Weight;
    fn delete_work() -> Weight;
    fn verify_work() -> Weight;
}

impl WeightInfo for () {
    // 现有权重...

    // === 作品相关权重实现 ===
    fn upload_work() -> Weight {
        Weight::from_parts(50_000, 0)
    }

    fn batch_upload_works(count: u32) -> Weight {
        Weight::from_parts(30_000 * count as u64, 0)
    }

    fn update_work() -> Weight {
        Weight::from_parts(30_000, 0)
    }

    fn delete_work() -> Weight {
        Weight::from_parts(40_000, 0)
    }

    fn verify_work() -> Weight {
        Weight::from_parts(20_000, 0)
    }
}
```

---

## 📝 实施建议

### 推荐实施顺序

1. **Step 1-2-3**（存储、事件、错误）：基础数据结构
2. **Step 4**（upload_work单个）：核心功能
3. **Step 5**（do_upload_work）：内部逻辑
4. **Step 6**（权重）：完善配置
5. **测试**：编写单元测试
6. **Step 4-5补充**（batch、update、delete、verify）：扩展功能

### 注意事项

1. **Call Index分配**
   - 检查现有extrinsics使用的call_index
   - 选择未占用的索引号（建议从20开始）

2. **权限检查**
   - 确认`ensure_can_manage_deceased`函数的实现
   - 可能需要查询Grave pallet获取墓地所有者

3. **Timestamp依赖**
   - 确保Config trait包含`type Timestamp: UnixTime;`

4. **编译检查**
   - 每添加一部分代码后立即编译检查
   - 逐步迭代，避免大量错误堆积

5. **测试覆盖**
   - 测试所有作品类型的创建
   - 测试权限控制
   - 测试索引更新
   - 测试统计信息准确性

---

## 🧪 测试用例设计

### 基础功能测试

```rust
#[test]
fn upload_work_should_work() {
    ExtBuilder::default().build_and_execute(|| {
        // 1. 创建逝者
        // 2. 上传文学作品
        // 3. 验证存储正确
        // 4. 验证索引正确
        // 5. 验证统计信息正确
        // 6. 验证事件发出
    });
}

#[test]
fn upload_work_requires_permission() {
    // 测试非owner无法上传
}

#[test]
fn batch_upload_works() {
    // 测试批量上传
}

#[test]
fn update_work_metadata() {
    // 测试元数据更新
}

#[test]
fn delete_work() {
    // 测试删除作品
}

#[test]
fn verify_work_locks_modification() {
    // 测试验证后无法修改
}
```

---

## 📋 完成检查清单

- [ ] Step 1: 存储项添加完成
- [ ] Step 2: 事件定义添加完成
- [ ] Step 3: 错误定义添加完成
- [ ] Step 4: upload_work extrinsic实现
- [ ] Step 5: do_upload_work内部逻辑实现
- [ ] Step 6: WeightInfo更新完成
- [ ] 编译通过无错误
- [ ] 单元测试编写完成
- [ ] 单元测试全部通过
- [ ] batch_upload_works实现
- [ ] update_work实现
- [ ] delete_work实现
- [ ] verify_work实现
- [ ] 文档更新

---

**下一步**：开始实施Step 1，添加存储项定义
