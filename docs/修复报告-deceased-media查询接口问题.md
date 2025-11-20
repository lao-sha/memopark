# 修复报告：deceased-media 查询接口问题

## 📋 问题描述

**报告日期**: 2025-11-08  
**问题页面**: http://127.0.0.1:5173/#/grave/detail  
**错误提示**: "未找到 deceased-media 查询接口"

---

## 🔍 根本原因分析

### 架构变更历史

**2025-10-28**: deceased-media 和 deceased-text 被整合到 deceased pallet

```
旧架构：
- pallet-deceased（核心）
- pallet-deceased-media（独立）❌ 已废弃
- pallet-deceased-text（独立）❌ 已废弃

新架构：
- pallet-deceased
  ├── 核心功能（逝者档案）✅ 已实现
  ├── media 模块（media.rs）⚠️  结构已定义，存储项未实现
  └── text 模块（text.rs）⚠️  结构已定义，存储项未实现
```

### 问题根源

1. **前端代码**仍在查找独立的 `deceasedMedia` / `deceased_media` pallet
2. **链端代码**已将功能整合到 `deceased` pallet
3. **存储项缺失**: media.rs 和 text.rs 仅定义了数据结构，未在 lib.rs 中添加 StorageMap

### 诊断结果（来自自动化检查工具）

```bash
node scripts/检查deceased-pallet接口.mjs
```

**结果**:
```
🔍 deceased pallet: ✅ 存在

❌ 媒体查询（Media 模块）: 未找到
   预期接口:
   - albumsByDeceased
   - albumOf
   - mediaByAlbum
   - mediaOf
   - videoCollectionsByDeceased
   - videoCollectionOf

❌ 文本查询（Text 模块）: 未找到
   预期接口:
   - lifeOf
   - messagesByDeceased
   - textOf
   - articlesByDeceased
```

**实际可用的查询接口**（16个）:
- deceasedByGrave
- deceasedOf
- nextDeceasedId
- deceasedIdByToken
- visibilityOf
- lastActiveOf
- friendPolicyOf
- friendsOf
- friendCount
- friendJoinRequests
- pendingRelationRequests
- relations
- relationsByDeceased
- ownerChangeLogOf
- deceasedHistory
- palletVersion

---

## ✅ 修复方案

### 方案一：前端容错处理（已实施）

**修改文件**: `stardust-dapp/src/features/grave/GraveDetailPage.tsx`

#### 修复内容

1. **修改 pallet 查询对象**
   - 从 `deceasedMedia` / `deceased_media` → `deceased`
   - 从 `deceasedText` / `deceased_text` → `deceased`

2. **添加接口存在性检查**
   - 检查 `albumsByDeceased`、`mediaByAlbum`、`mediaOf` 是否存在
   - 检查 `lifeOf`、`messagesByDeceased`、`textOf` 是否存在
   - 不存在则跳过，不中断页面加载

3. **添加友好的警告日志**
   ```typescript
   console.warn('⚠️  Media 模块存储项未在链上实现，跳过媒体加载');
   console.warn('⚠️  Text 模块的 lifeOf 接口未在链上实现，跳过生平加载');
   console.warn('⚠️  Text 模块的留言接口未在链上实现，跳过留言加载');
   ```

#### 修复效果

- ✅ 页面不再崩溃
- ✅ 基础功能正常（逝者信息、家族关系）
- ✅ 暂时禁用未实现的功能（相册、视频、生平、留言）
- ✅ 清晰的调试信息

---

## 🎯 长期解决方案（需链端实现）

### 方案二：在链端添加存储项（推荐）

**需要修改**: `pallets/deceased/src/lib.rs`

#### 需要添加的 Media 模块存储项

```rust
#[pallet::storage]
/// 函数级中文注释：每个逝者的相册ID列表
pub type AlbumsByDeceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<T::AlbumId, T::MaxAlbumsPerDeceased>,
    ValueQuery,
>;

#[pallet::storage]
/// 函数级中文注释：相册详情
pub type AlbumOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AlbumId,
    Album<T>,
    OptionQuery,
>;

#[pallet::storage]
/// 函数级中文注释：每个相册的媒体ID列表
pub type MediaByAlbum<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AlbumId,
    BoundedVec<T::MediaId, T::MaxPhotoPerAlbum>,
    ValueQuery,
>;

#[pallet::storage]
/// 函数级中文注释：媒体详情
pub type MediaOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::MediaId,
    Media<T>,
    OptionQuery,
>;

#[pallet::storage]
/// 函数级中文注释：每个逝者的视频集ID列表
pub type VideoCollectionsByDeceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<T::VideoCollectionId, T::MaxVideoCollectionsPerDeceased>,
    ValueQuery,
>;

#[pallet::storage]
/// 函数级中文注释：视频集详情
pub type VideoCollectionOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::VideoCollectionId,
    VideoCollection<T>,
    OptionQuery,
>;
```

#### 需要添加的 Text 模块存储项

```rust
#[pallet::storage]
/// 函数级中文注释：逝者生平CID
pub type LifeOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<u8, T::MaxCidLen>,
    OptionQuery,
>;

#[pallet::storage]
/// 函数级中文注释：每个逝者的留言ID列表
pub type MessagesByDeceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<T::TextId, T::MaxMessagesPerDeceased>,
    ValueQuery,
>;

#[pallet::storage]
/// 函数级中文注释：文本内容详情（留言、悼词、文章）
pub type TextOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::TextId,
    TextData<T>,
    OptionQuery,
>;

#[pallet::storage]
/// 函数级中文注释：每个逝者的文章ID列表
pub type ArticlesByDeceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<T::TextId, T::MaxArticlesPerDeceased>,
    ValueQuery,
>;
```

#### 需要添加的交易接口（extrinsics）

**Media 模块**:
- `createAlbum(deceased_id, title, desc, visibility, tags)`
- `addMedia(kind, album_id, uri, thumbnail, ...)`
- `createVideoCollection(deceased_id, title, desc, tags)`
- `removeMedia(media_id)`

**Text 模块**:
- `createLife(deceased_id, cid)` 或 `updateLife(deceased_id, cid)`
- `addMessage(deceased_id, cid, thumbnail_cid)`
- `setArticle(deceased_id, cid, title, summary)`

---

## 📊 修复对比

### 修复前

```
用户访问 #/grave/detail?gid=1
  ↓
加载墓地信息 ✅
  ↓
加载逝者列表 ✅
  ↓
查询 deceasedMedia pallet ❌ 未找到
  ↓
抛出错误："未找到 deceased-media 查询接口"
  ↓
页面崩溃，显示红色错误提示
```

### 修复后

```
用户访问 #/grave/detail?gid=1
  ↓
加载墓地信息 ✅
  ↓
加载逝者列表 ✅
  ↓
查询 deceased.albumsByDeceased
  ↓
检测到接口不存在 ⚠️
  ↓
输出警告日志，跳过媒体加载 ✅
  ↓
继续加载其他数据 ✅
  ↓
页面正常显示，无崩溃
```

---

## 🛠️ 修改详情

### 文件：GraveDetailPage.tsx

#### 修改 1：查询 Media 接口（第 248-274 行）

**修改前**:
```typescript
let dmq: any = qr2.deceasedMedia || qr2.deceased_media
if (!dmq) { 
  const key = Object.keys(qr2).find(k => /deceased[_-]?media/i.test(k)); 
  if (key) dmq = qr2[key] 
}
if (!dmq) throw new Error('未找到 deceased-media 查询接口')
const albumIdLists = await dmq.albumsByDeceased.multi(ids)
```

**修改后**:
```typescript
let dmq: any = qr2.deceased
if (!dmq) {
  console.error('未找到 deceased pallet');
  throw new Error('未找到 deceased 查询接口');
}

// 检查 media 相关查询接口是否可用
const mediaKeys = Object.keys(dmq).filter(k => /album|media|video/i.test(k));
console.log('📊 deceased pallet 可用的 media 查询接口:', mediaKeys);

// 临时处理：Media 模块存储项未实现
if (!dmq.albumsByDeceased || !dmq.mediaByAlbum || !dmq.mediaOf) {
  console.warn('⚠️  Media 模块存储项未在链上实现，跳过媒体加载');
  console.warn('缺失的接口:', {
    albumsByDeceased: !dmq.albumsByDeceased,
    albumOf: !dmq.albumOf,
    mediaByAlbum: !dmq.mediaByAlbum,
    mediaOf: !dmq.mediaOf
  });
  setAlbums([]);
  setVideos([]);
  setArticles([]);
  // 继续加载其他数据，不中断流程
} else {
  // 原有的媒体查询逻辑
  const albumIdLists = await dmq.albumsByDeceased.multi(ids)
  // ...
}
```

#### 修改 2：查询 Text 接口（第 340-366 行）

**修改前**:
```typescript
let dtq: any = qr2.deceasedText || qr2.deceased_text
if (!dtq) { ... }
if (!dtq) throw new Error('未找到 deceased-text 查询接口')
const lifeOpts = await dtq.lifeOf.multi(ids)
```

**修改后**:
```typescript
let dtq: any = qr2.deceased
if (!dtq) throw new Error('未找到 deceased 查询接口')

// 检查 lifeOf 接口是否可用
if (!dtq.lifeOf) {
  console.warn('⚠️  Text 模块的 lifeOf 接口未在链上实现，跳过生平加载');
} else {
  const lifeOpts = await dtq.lifeOf.multi(ids)
  // ...
}
```

#### 修改 3：查询留言接口（第 368-413 行）

类似的容错处理。

#### 修改 4：解析 Section 名称（第 397-412 行）

**修改前**:
```typescript
const c = ['deceasedMedia','deceased_media', ...]
const c2 = ['deceasedText','deceased_text', ...]
```

**修改后**:
```typescript
const c = ['deceased', ...]
const c2 = ['deceased', ...]
```

---

## 📊 测试验证

### 自动化诊断

**工具**: `scripts/检查deceased-pallet接口.mjs`

**结果**:
```
🔍 deceased pallet: ✅ 存在
📊 总计: 16 个查询接口，26 个交易接口

❌ 媒体查询: 未找到（0个）
❌ 文本查询: 未找到（0个）
```

### 浏览器测试

1. ✅ 访问 #/grave/detail?gid=1
2. ✅ 墓地信息加载成功
3. ✅ 逝者列表显示正常（#0 王五、#9 杨国）
4. ✅ 无页面崩溃
5. ⚠️  相册/视频/生平/留言功能暂时不可用

### 控制台日志

```javascript
📊 deceased pallet 可用的 media 查询接口: []
⚠️  Media 模块存储项未在链上实现，跳过媒体加载
⚠️  Text 模块的 lifeOf 接口未在链上实现，跳过生平加载
⚠️  Text 模块的留言接口未在链上实现，跳过留言加载
```

---

## 🎯 待办事项

### 链端开发（优先级：高）

**任务**: 在 `pallets/deceased/src/lib.rs` 中添加 Media 和 Text 模块的存储项

**文件清单**:
- [ ] 添加 AlbumsByDeceased
- [ ] 添加 AlbumOf
- [ ] 添加 MediaByAlbum
- [ ] 添加 MediaOf
- [ ] 添加 VideoCollectionsByDeceased
- [ ] 添加 VideoCollectionOf
- [ ] 添加 LifeOf
- [ ] 添加 MessagesByDeceased
- [ ] 添加 TextOf
- [ ] 添加 ArticlesByDeceased

**预计工作量**: 1-2 天

**参考**:
- `pallets/deceased/src/media.rs` - 数据结构定义
- `pallets/deceased/src/text.rs` - 数据结构定义
- `pallets/deceased/README.md` - 功能说明

### 前端优化（优先级：中）

**任务**: 添加用户友好的提示信息

- [ ] 在相册tab显示："相册功能开发中..."
- [ ] 在视频tab显示："视频功能开发中..."
- [ ] 在生平tab显示："生平功能开发中..."
- [ ] 在留言区显示："留言功能开发中..."

**实现方式**:
```typescript
{activeTab === 'album' && (
  albums.length > 0 ? (
    <List dataSource={albums} ... />
  ) : (
    <Alert
      type="info"
      showIcon
      message="相册功能开发中"
      description="Media 模块的存储项正在链端实现，敬请期待！"
    />
  )
)}
```

---

## 📁 修改文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/features/grave/GraveDetailPage.tsx` | 🔄 修复 | 修改pallet查询，添加容错 |
| `scripts/检查deceased-pallet接口.mjs` | ✨ 新建 | 自动化诊断工具 |
| `docs/修复报告-deceased-media查询接口问题.md` | 📄 文档 | 本文档 |

---

## 💡 技术要点

### Substrate Pallet 架构

#### 模块化设计

```rust
// pallets/deceased/src/lib.rs
pub mod text;  // 子模块
pub mod media; // 子模块

#[frame_support::pallet]
pub mod pallet {
    // 这里定义存储项
    #[pallet::storage]
    pub type DeceasedOf<T> = StorageMap<...>;
    
    // ⚠️  需要添加：
    // #[pallet::storage]
    // pub type AlbumsByDeceased<T> = StorageMap<...>;
}
```

#### Runtime 配置

```rust
// runtime/src/lib.rs
construct_runtime! {
    pub struct Runtime {
        // ...
        Deceased: pallet_deceased = 19,  // 单一pallet
        // DeceasedMedia: ... ❌ 已移除
        // DeceasedText: ... ❌ 已移除
    }
}
```

### 前端查询方式

```typescript
// 正确方式
const api = await getApi();
const deceased = api.query.deceased;  // ✅
const albums = await deceased.albumsByDeceased(deceasedId);

// 错误方式
const deceasedMedia = api.query.deceasedMedia;  // ❌ 不存在
const albums = await deceasedMedia.albumsByDeceased(deceasedId);
```

---

## 🚀 推荐实施步骤

### 第一阶段：链端实现（1-2天）

1. **Day 1**: 添加 Media 模块存储项
   - AlbumsByDeceased, AlbumOf
   - MediaByAlbum, MediaOf
   - VideoCollectionsByDeceased, VideoCollectionOf
   - 对应的交易接口

2. **Day 2**: 添加 Text 模块存储项
   - LifeOf
   - MessagesByDeceased, TextOf
   - ArticlesByDeceased
   - 对应的交易接口

### 第二阶段：测试验证（0.5天）

1. **编译测试**
   ```bash
   cd /home/xiaodong/文档/stardust
   cargo build --release
   ```

2. **运行节点**
   ```bash
   ./target/release/node-template --dev --tmp
   ```

3. **前端验证**
   ```bash
   cd stardust-dapp
   node scripts/检查deceased-pallet接口.mjs
   ```

### 第三阶段：前端集成（0.5天）

1. **移除临时容错代码**
2. **添加UI友好提示**
3. **完整功能测试**

---

## 📚 相关资源

### 代码文件

- `pallets/deceased/src/lib.rs` - 主pallet文件（需修改）
- `pallets/deceased/src/media.rs` - Media模块结构定义
- `pallets/deceased/src/text.rs` - Text模块结构定义
- `pallets/deceased/README.md` - 功能说明文档

### 工具脚本

- `stardust-dapp/scripts/检查deceased-pallet接口.mjs` - 诊断工具
- 使用方式：`node scripts/检查deceased-pallet接口.mjs`

### 参考文档

- [Substrate Storage](https://docs.substrate.io/build/runtime-storage/)
- [Pallet宏说明](https://docs.substrate.io/reference/frame-macros/)
- [项目开发规范](.cursorrules)

---

## 📞 总结

### 当前状态

| 功能 | 状态 | 说明 |
|------|------|------|
| 墓地信息 | ✅ 正常 | 可查看墓地详情 |
| 逝者列表 | ✅ 正常 | 可查看逝者基础信息 |
| 家族关系 | ✅ 正常 | 关系查询正常 |
| 相册功能 | ⚠️  待实现 | 链端存储项缺失 |
| 视频功能 | ⚠️  待实现 | 链端存储项缺失 |
| 生平功能 | ⚠️  待实现 | 链端存储项缺失 |
| 留言功能 | ⚠️  待实现 | 链端存储项缺失 |

### 下一步行动

**短期（立即）**:
- ✅ 前端容错已完成
- ✅ 诊断工具已创建
- ✅ 修复报告已完成

**中期（1-2周）**:
- ⏳ 链端实现 Media 存储项
- ⏳ 链端实现 Text 存储项
- ⏳ 添加对应的交易接口

**长期（1个月）**:
- ⏳ 完整的媒体管理功能
- ⏳ 完整的文本管理功能
- ⏳ 前后端完全对接

---

**修复人**: AI Assistant  
**修复日期**: 2025-11-08  
**验证状态**: ✅ 前端已修复  
**链端状态**: ⏳ 待实现

