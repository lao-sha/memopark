# Stardust-Media-Common 集成指南

## 快速总结

### 当前状态
- `pallet-deceased` 在 `media.rs` 中定义了 `MediaKind`（Photo/Video/Audio）
- `stardust-media-common` 库提供了完整的媒体工具链（验证、哈希、IPFS）
- **缺少集成**：没有将媒体工具库的功能集成到 pallet 中

### 集成目标
1. 统一媒体类型定义（使用 stardust-media-common::MediaKind）
2. 添加媒体内容验证
3. 增强元数据存储
4. 改进IPFS CID处理
5. 提升安全性检查

---

## 依赖关系

### 当前依赖链
```
pallet-deceased
├── frame-support (workspace)
├── frame-system (workspace)
├── pallet-stardust-ipfs (path)
├── pallet-social (path)
└── [缺少] stardust-media-common ❌

stardust-media-common
├── codec (3.0.0)
├── scale-info (2.0.0)
├── sp-core (git: master)
├── sp-runtime (git: master)
├── sp-std (git: master)
└── frame-support (git: master)
```

### 版本不一致问题
**问题**：stardust-media-common 使用的是 git 上游依赖，不是 workspace
```toml
# stardust-media-common/Cargo.toml
sp-core = { git = "https://github.com/paritytech/polkadot-sdk.git", branch = "master", ... }
sp-runtime = { git = "https://github.com/paritytech/polkadot-sdk.git", branch = "master", ... }
```

**推荐解决**：
```toml
# 改为使用 workspace 版本，确保一致性
sp-core = { workspace = true, default-features = false }
sp-runtime = { workspace = true, default-features = false }
```

---

## 集成计划（分阶段）

### Phase 1：基础集成（依赖和类型）

**Step 1.1: 更新 pallet-deceased/Cargo.toml**
```toml
[dependencies]
# ... 现有依赖 ...

# 添加媒体工具库
stardust-media-common = { path = "../stardust-media-common", default-features = false }
```

**Step 1.2: 更新 pallet-deceased/src/lib.rs**
```rust
// 顶部添加导入
use stardust_media_common::{
    MediaKind, MediaMetadata, ContentType,
    ImageValidator, VideoValidator, AudioValidator,
    HashHelper, IpfsHelper,
    MediaError, ImageFormat, VideoFormat, AudioFormat, DocumentFormat,
};
```

**Step 1.3: 替换 media.rs 中的 MediaKind 定义**
```rust
// 删除当前定义（行24-30）：
// pub enum MediaKind {
//     Photo,
//     Video,
//     Audio,
// }

// 改为导入（在 media.rs 顶部）：
use stardust_media_common::MediaKind;
```

**Step 1.4: 更新 lib.rs 的 Config trait**
```rust
pub trait Config: frame_system::Config {
    // ... 现有配置 ...
    
    // ===== 媒体验证配置 (Phase 1) =====
    /// 最大媒体文件大小（字节）
    type MaxMediaFileSize: Get<u32>;
    
    /// 最大图片分辨率（宽, 高）
    type MaxImageResolution: Get<(u32, u32)>;
    
    /// 最大视频时长（秒）
    type MaxVideoDuration: Get<u32>;
}
```

---

### Phase 2：验证集成

**Step 2.1: 增强 Media 结构体**

在 `media.rs` 中扩展 `Media<T>` 结构体（大约行75-97）：

```rust
pub struct Media<T: Config> {
    // === 现有字段 ===
    pub id: T::MediaId,
    pub album_id: Option<T::AlbumId>,
    pub video_collection_id: Option<T::VideoCollectionId>,
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::TokenLimit>,
    pub owner: T::AccountId,
    pub kind: MediaKind,
    pub uri: BoundedVec<u8, T::StringLimit>,
    pub thumbnail_uri: Option<BoundedVec<u8, T::StringLimit>>,
    pub content_hash: Option<[u8; 32]>,
    pub duration_secs: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub order_index: u32,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
    pub version: u32,
    
    // === 新增字段（Phase 2）===
    /// MIME类型（如 "image/jpeg"）
    pub mime_type: Option<BoundedVec<u8, ConstU32<128>>>,
    
    /// 具体格式（0=Unknown, 1=JPEG, 2=PNG, 3=GIF等）
    pub format_code: u8,
    
    /// 比特率（单位：kbps）
    pub bitrate: Option<u32>,
    
    /// 帧率（仅视频，单位：fps）
    pub fps: Option<u32>,
    
    /// 是否已通过安全检查
    pub security_verified: bool,
    
    /// 文件大小（字节）
    pub file_size: Option<u64>,
}
```

**Step 2.2: 添加验证帮助函数**

在 lib.rs 或 media.rs 中添加：

```rust
/// 验证图片内容并提取元数据
pub fn validate_image_media(
    data: &[u8],
) -> Result<MediaMetadata, DispatchError> {
    ImageValidator::validate(data)
        .map_err(|_| Error::<T>::InvalidMedia.into())
}

/// 验证视频内容并提取元数据
pub fn validate_video_media(
    data: &[u8],
) -> Result<MediaMetadata, DispatchError> {
    VideoValidator::validate(data)
        .map_err(|_| Error::<T>::InvalidMedia.into())
}

/// 验证音频内容并提取元数据
pub fn validate_audio_media(
    data: &[u8],
) -> Result<MediaMetadata, DispatchError> {
    AudioValidator::validate(data)
        .map_err(|_| Error::<T>::InvalidMedia.into())
}

/// 验证CID格式
pub fn validate_cid_format(cid: &[u8]) -> DispatchResult {
    let cid_str = core::str::from_utf8(cid)
        .map_err(|_| Error::<T>::InvalidCid)?;
    
    IpfsHelper::validate_cid(cid_str)
        .map_err(|_| Error::<T>::InvalidCid)?;
    
    Ok(())
}
```

**Step 2.3: 更新 Error 枚举**

在 lib.rs 的 Error 枚举中添加：

```rust
pub enum Error<T> {
    // ... 现有错误 ...
    
    // ===== 媒体验证错误 (Phase 2) =====
    /// 媒体文件太大
    MediaFileTooLarge,
    
    /// 媒体文件太小
    MediaFileTooSmall,
    
    /// 不支持的媒体格式
    UnsupportedMediaFormat,
    
    /// 无效的CID
    InvalidCid,
    
    /// 媒体验证失败
    InvalidMedia,
    
    /// 图片分辨率过高（炸弹检测）
    ImageResolutionTooHigh,
    
    /// 视频时长超限
    VideoDurationExceeded,
    
    /// 可疑的媒体内容
    SuspiciousMediaContent,
}
```

---

### Phase 3：使用场景集成

**Step 3.1: 照片上传验证**

找到 `add_photo` 或类似函数（约在 lib.rs 8700-8800行），更新为：

```rust
pub fn add_photo(
    origin: OriginFor<T>,
    album_id: T::AlbumId,
    image_cid: BoundedVec<u8, T::StringLimit>,
    // 可选：前端直接传递图片数据进行验证
    image_data: Option<BoundedVec<u8, T::MaxMediaFileSize>>,
    caption: Option<BoundedVec<u8, T::StringLimit>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 验证CID格式
    Self::validate_cid_format(&image_cid)?;
    
    // 如果提供了原始数据，进行验证
    let metadata = if let Some(data) = image_data {
        let meta = Self::validate_image_media(&data)?;
        
        // 验证文件大小
        ensure!(
            data.len() as u32 <= T::MaxMediaFileSize::get(),
            Error::<T>::MediaFileTooLarge
        );
        
        Some(meta)
    } else {
        None
    };
    
    let media_id = NextMediaId::<T>::get();
    NextMediaId::<T>::put(media_id + T::MediaId::one());
    
    let media = Media::<T> {
        id: media_id,
        album_id: Some(album_id),
        video_collection_id: None,
        deceased_id: album.deceased_id,
        deceased_token: album.deceased_token.clone(),
        owner: who.clone(),
        kind: MediaKind::Photo,
        uri: image_cid,
        thumbnail_uri: None,
        content_hash: metadata.as_ref().map(|m| m.content_hash),
        duration_secs: None,
        width: metadata.as_ref().and_then(|m| m.width),
        height: metadata.as_ref().and_then(|m| m.height),
        order_index: order_index,
        created: frame_system::Pallet::<T>::block_number(),
        updated: frame_system::Pallet::<T>::block_number(),
        version: 1,
        
        // Phase 2 新字段
        mime_type: metadata.as_ref().map(|m| {
            BoundedVec::try_from(m.mime_type.clone()).unwrap_or_default()
        }),
        format_code: 0, // 需要从 metadata 提取
        bitrate: None,
        fps: None,
        security_verified: metadata.is_some(),
        file_size: metadata.as_ref().map(|m| m.file_size),
    };
    
    Photos::<T>::insert(media_id, media);
    
    Self::deposit_event(Event::<T>::PhotoAdded {
        photo_id: media_id,
        album_id,
    });
    
    Ok(())
}
```

**Step 3.2: 视频上传验证**

类似处理 `add_video`：

```rust
pub fn add_video(
    origin: OriginFor<T>,
    collection_id: T::VideoCollectionId,
    video_cid: BoundedVec<u8, T::StringLimit>,
    video_data: Option<BoundedVec<u8, T::MaxMediaFileSize>>,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    description_cid: Option<BoundedVec<u8, ConstU32<64>>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 验证CID
    Self::validate_cid_format(&video_cid)?;
    
    // 验证视频数据
    let metadata = if let Some(data) = video_data {
        let meta = Self::validate_video_media(&data)?;
        
        // 检查视频时长
        if let Some(duration) = meta.duration_secs {
            ensure!(
                duration <= T::MaxVideoDuration::get(),
                Error::<T>::VideoDurationExceeded
            );
        }
        
        Some(meta)
    } else {
        None
    };
    
    // ... 创建媒体记录，填充元数据 ...
    
    Ok(())
}
```

**Step 3.3: 音频上传验证**

```rust
pub fn add_audio(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    audio_cid: BoundedVec<u8, T::StringLimit>,
    audio_data: Option<BoundedVec<u8, T::MaxMediaFileSize>>,
    title_cid: BoundedVec<u8, ConstU32<64>>,
    description_cid: Option<BoundedVec<u8, ConstU32<64>>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 验证CID
    Self::validate_cid_format(&audio_cid)?;
    
    // 验证音频数据
    let metadata = if let Some(data) = audio_data {
        let meta = Self::validate_audio_media(&data)?;
        Some(meta)
    } else {
        None
    };
    
    // ... 创建媒体记录 ...
    
    Ok(())
}
```

---

## 具体文件修改清单

### 文件 1: `pallets/deceased/Cargo.toml`

**修改内容**：
- 行 19：添加 `stardust-media-common` 依赖

```diff
[dependencies]
# ... 现有依赖 ...
+ stardust-media-common = { path = "../../stardust-media-common", default-features = false }
```

### 文件 2: `pallets/deceased/src/lib.rs`

**修改内容**：
- 顶部导入：添加 stardust-media-common 的导入
- Config trait：添加媒体配置参数
- Error 枚举：添加媒体相关错误
- 新增帮助函数：验证函数
- 事件定义：可选添加验证相关事件

### 文件 3: `pallets/deceased/src/media.rs`

**修改内容**：
- 删除 MediaKind 定义（行 24-30）
- 添加导入：`use stardust_media_common::MediaKind;`
- 扩展 Media<T> 结构体：添加新的元数据字段
- 扩展 Album<T> 和 VideoCollection<T>：可选添加验证状态

### 文件 4: `stardust-media-common/Cargo.toml`（可选）

**修改内容**：
- 统一依赖版本为 workspace 版本（如果需要）

---

## 测试计划

### 单元测试

```rust
#[cfg(test)]
mod media_validation_tests {
    use super::*;
    
    #[test]
    fn test_add_photo_with_validation() {
        // 测试带有元数据验证的照片上传
    }
    
    #[test]
    fn test_image_bomb_detection() {
        // 测试超大图片检测
    }
    
    #[test]
    fn test_cid_validation() {
        // 测试CID格式验证
    }
    
    #[test]
    fn test_invalid_media_format() {
        // 测试无效媒体格式检测
    }
}
```

### 集成测试

```rust
#[test]
fn test_complete_photo_upload_workflow() {
    // 1. 创建相册
    // 2. 上传带验证的照片
    // 3. 验证元数据被正确存储
    // 4. 验证IPFS Pin调用
}

#[test]
fn test_security_check_on_upload() {
    // 1. 上传可疑媒体
    // 2. 验证被拒绝
    // 3. 验证事件记录
}
```

---

## 迁移策略

### 向后兼容性

**问题**：现有的 `MediaKind` 定义（Photo/Video/Audio）与新的定义（Photo/Video/Audio/Document）不完全兼容。

**解决方案**：
1. 在代码迁移时，保留原有的 Photo/Video/Audio 处理逻辑
2. 在新的 Document 类型上线时，发布运行时升级
3. 使用 feature flags 分离新旧代码路径（可选）

### 数据迁移

**现有数据处理**：
- 现有媒体记录中的 `kind` 字段值不需要改变
- 新增的元数据字段使用 `Option` 类型，已有媒体记录为 `None`
- 逐步扫描并填充历史数据（可选）

---

## 性能考虑

### 区块生成延迟

**问题**：媒体验证（尤其是大文件）可能增加区块生成时间

**解决方案**：
1. **链外验证**：前端在上传前进行初步验证
2. **异步验证**：考虑在链下进行完整验证，仅在链上存储结果
3. **缓存优化**：缓存验证结果，避免重复计算

### 存储空间

**新增字段的存储成本**：
- `mime_type`: ~128字节
- `format_code`: 1字节
- `bitrate`: 4字节
- `fps`: 4字节
- `file_size`: 8字节
- `security_verified`: 1字节

**总计**：每个Media记录增加约150字节

---

## 常见问题

**Q: 为什么要导入而不是重新定义？**
A: 避免代码重复和维护成本增加，统一的类型定义便于跨pallet共享。

**Q: 现有的媒体记录怎么处理？**
A: 使用 Option 类型，新增字段对现有记录为 None，逐步填充。

**Q: 如何处理验证失败的情况？**
A: 操作直接返回错误，不创建媒体记录，用户需要修复后重新上传。

**Q: CID验证会增加gas费用吗？**
A: 是的，但增加量很小（字符串验证的开销）。

