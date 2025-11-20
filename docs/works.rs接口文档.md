# works.rs 接口文档

> **文件路径**: `pallets/deceased/src/works.rs`  
> **模块用途**: 逝者作品记录模块（Phase 1: AI训练数据基础）  
> **更新日期**: 2025-11-13

---

## 📋 目录

1. [模块概述](#模块概述)
2. [类型定义](#类型定义)
3. [枚举类型](#枚举类型)
4. [结构体类型](#结构体类型)
5. [方法接口](#方法接口)
6. [使用示例](#使用示例)

---

## 1. 模块概述

### 1.1 功能定位

`works.rs` 是 `pallet-deceased` 的子模块，负责定义逝者作品相关的**类型定义和辅助函数**。

**注意**：实际的 extrinsic 接口（`upload_work`、`update_work` 等）在 `pallets/deceased/src/lib.rs` 中实现。

### 1.2 核心功能

- ✅ 定义作品类型枚举（13种类型）
- ✅ 定义隐私级别枚举（4级）
- ✅ 定义作品记录结构
- ✅ 提供类型判断和转换方法
- ✅ 提供AI训练价值评估方法

---

## 2. 类型定义

### 2.1 枚举类型

#### 2.1.1 LiteratureGenre（文学体裁）

**位置**: `works.rs:29`

```rust
pub enum LiteratureGenre {
    Novel,    // 小说
    Prose,    // 散文
    Poetry,   // 诗歌
    Drama,    // 戏剧
    Essay,    // 杂文/评论
}
```

**用途**：用于 `WorkType::Literature` 的体裁字段

---

#### 2.1.2 PrivacyLevel（隐私级别）

**位置**: `works.rs:55`

```rust
pub enum PrivacyLevel {
    Public,      // 0 - 完全公开
    Family,      // 1 - 仅家人可见（默认）
    Descendants, // 2 - 仅后代可见
    Private,     // 3 - 私密（仅AI训练）
}
```

**默认值**：`Family`（仅家人可见）

**转换方法**：
- `from_u8(code: u8) -> PrivacyLevel` - 从u8代码转换
- `to_u8(&self) -> u8` - 转换为u8代码

**映射关系**：
- `0` => `Public`
- `1` => `Family`（默认）
- `2` => `Descendants`
- `3` => `Private`
- 其他 => `Family`（默认）

---

#### 2.1.3 WorkType（作品类型）

**位置**: `works.rs:126`

**13种作品类型**：

##### 文字类（6种）

```rust
// 1. 文学作品
Literature {
    genre: LiteratureGenre,  // 文学体裁
    word_count: u32,          // 字数
}

// 2. 学术论文
AcademicPaper {
    field: BoundedVec<u8, 50>,                    // 研究领域
    publication: Option<BoundedVec<u8, 100>>,     // 发表期刊（可选）
}

// 3. 日记/随笔
Diary

// 4. 书信
Letter {
    recipient: Option<BoundedVec<u8, 100>>,  // 收信人（可选）
}

// 5. 社交媒体内容
SocialMedia {
    platform: BoundedVec<u8, 50>,      // 平台名称
    post_type: BoundedVec<u8, 50>,     // 帖子类型
}

// 6. 代码/技术作品
Code {
    language: BoundedVec<u8, 50>,       // 编程语言
    project_desc: BoundedVec<u8, 200>, // 项目描述
}
```

##### 音频类（3种）

```rust
// 7. 语音日记
VoiceDiary {
    duration: u32,        // 时长（秒）
    has_transcript: bool,  // 是否有转录文本
}

// 8. 音乐作品
Music {
    genre: BoundedVec<u8, 50>,  // 音乐类型
    has_lyrics: bool,           // 是否有歌词
}

// 9. 播客/演讲
Podcast {
    topic: BoundedVec<u8, 100>, // 主题
    has_transcript: bool,       // 是否有转录文本
}
```

##### 视频类（3种）

```rust
// 10. 视频日记/Vlog
VideoLog {
    duration: u32,        // 时长（秒）
    has_subtitles: bool,  // 是否有字幕
}

// 11. 讲座/课程
Lecture {
    subject: BoundedVec<u8, 100>, // 学科/主题
    has_subtitles: bool,          // 是否有字幕
}

// 12. 生活片段
LifeClip {
    occasion: BoundedVec<u8, 100>,  // 场合描述
}
```

##### 图像类（2种）

```rust
// 13. 艺术作品
Artwork {
    medium: BoundedVec<u8, 50>,  // 媒介（油画/水彩/摄影等）
    style: BoundedVec<u8, 50>,    // 风格
}

// 14. 设计作品
Design {
    category: BoundedVec<u8, 50>,  // 设计类别（平面/产品/建筑等）
}
```

##### 专业技能类（1种）

```rust
// 15. 专业技能展示
SkillDemo {
    skill_name: BoundedVec<u8, 100>,    // 技能名称
    description: BoundedVec<u8, 200>,   // 描述
}
```

---

### 2.2 结构体类型

#### 2.2.1 DeceasedWork（作品记录）

**位置**: `works.rs:273`

```rust
pub struct DeceasedWork<AccountId, BlockNumber> {
    // === 基础信息 ===
    pub work_id: u64,                    // 作品唯一ID
    pub deceased_id: u64,                // 所属逝者ID
    pub work_type: WorkType,             // 作品类型
    pub title: BoundedVec<u8, 200>,      // 作品标题（最多200字符）
    pub description: BoundedVec<u8, 1000>, // 作品描述（最多1000字符）
    
    // === 存储信息 ===
    pub ipfs_cid: BoundedVec<u8, 64>,    // IPFS存储地址（CID）
    pub file_size: u64,                  // 文件大小（字节）
    
    // === 时间信息 ===
    pub created_at: Option<u64>,         // 创作时间（Unix时间戳，可选）
    pub uploaded_at: BlockNumber,        // 上传时间（区块号）
    pub uploader: AccountId,             // 上传者账户
    
    // === AI相关标签 ===
    pub tags: BoundedVec<BoundedVec<u8, 50>, 20>,  // 主题标签（最多20个）
    pub sentiment: Option<i8>,           // 情感倾向（-100到100）
    pub style_tags: BoundedVec<BoundedVec<u8, 50>, 10>,  // 语言风格标签
    pub expertise_fields: BoundedVec<BoundedVec<u8, 50>, 10>,  // 专业领域标签
    
    // === 权限控制 ===
    pub privacy_level: PrivacyLevel,      // 隐私级别
    pub ai_training_enabled: bool,        // 是否授权AI训练
    pub public_display: bool,             // 是否可公开展示
    
    // === 验证信息 ===
    pub verified: bool,                   // 是否已验证
    pub verifier: Option<AccountId>,      // 验证者账户（可选）
}
```

**字段说明**：

| 字段 | 类型 | 限制 | 说明 |
|------|------|------|------|
| `work_id` | `u64` | - | 作品唯一ID（全局递增） |
| `deceased_id` | `u64` | - | 所属逝者ID |
| `work_type` | `WorkType` | - | 作品类型（含元数据） |
| `title` | `BoundedVec<u8, 200>` | 最多200字符 | 作品标题 |
| `description` | `BoundedVec<u8, 1000>` | 最多1000字符 | 作品描述 |
| `ipfs_cid` | `BoundedVec<u8, 64>` | 最多64字符 | IPFS存储地址 |
| `file_size` | `u64` | - | 文件大小（字节） |
| `created_at` | `Option<u64>` | - | 创作时间（可选） |
| `uploaded_at` | `BlockNumber` | - | 上传时间 |
| `uploader` | `AccountId` | - | 上传者账户 |
| `tags` | `BoundedVec<..., 20>` | 最多20个，每个50字符 | 主题标签 |
| `sentiment` | `Option<i8>` | -100到100 | 情感倾向 |
| `style_tags` | `BoundedVec<..., 10>` | 最多10个，每个50字符 | 语言风格标签 |
| `expertise_fields` | `BoundedVec<..., 10>` | 最多10个，每个50字符 | 专业领域标签 |
| `privacy_level` | `PrivacyLevel` | - | 隐私级别 |
| `ai_training_enabled` | `bool` | - | 是否授权AI训练 |
| `public_display` | `bool` | - | 是否可公开展示 |
| `verified` | `bool` | - | 是否已验证 |
| `verifier` | `Option<AccountId>` | - | 验证者账户 |

---

#### 2.2.2 WorkUploadInfo（作品上传信息）

**位置**: `works.rs:346`

```rust
pub struct WorkUploadInfo {
    pub work_type: WorkType,
    pub title: BoundedVec<u8, 200>,
    pub description: BoundedVec<u8, 1000>,
    pub ipfs_cid: BoundedVec<u8, 64>,
    pub file_size: u64,
    pub created_at: Option<u64>,
    pub tags: BoundedVec<BoundedVec<u8, 50>, 20>,
    pub privacy_level: PrivacyLevel,
    pub ai_training_enabled: bool,
}
```

**用途**：用于批量上传作品，简化参数传递

**注意**：系统自动填充 `work_id`、`uploaded_at`、`uploader` 等字段

---

## 3. 方法接口

### 3.1 PrivacyLevel 方法

#### 3.1.1 from_u8

**位置**: `works.rs:85`

```rust
pub fn from_u8(code: u8) -> Self
```

**功能**：从u8代码转换为PrivacyLevel枚举

**映射**：
- `0` => `Public`
- `1` => `Family`（默认）
- `2` => `Descendants`
- `3` => `Private`
- 其他 => `Family`（默认）

**用途**：extrinsic参数使用u8传递，在函数内部转换为枚举

---

#### 3.1.2 to_u8

**位置**: `works.rs:100`

```rust
pub fn to_u8(&self) -> u8
```

**功能**：转换为u8代码

**映射**：
- `Public` => `0`
- `Family` => `1`
- `Descendants` => `2`
- `Private` => `3`

**用途**：事件发射时的编码

---

### 3.2 WorkType 方法

#### 3.2.1 is_text_based

**位置**: `works.rs:387`

```rust
pub fn is_text_based(&self) -> bool
```

**功能**：判断是否为文本类型作品

**返回**：
- `true`：文本类型（Literature, AcademicPaper, Diary, Letter, SocialMedia, Code）
- `false`：其他类型

**用途**：
- AI训练时优先使用文本类型作品
- 前端展示时区分处理方式

---

#### 3.2.2 is_audio_based

**位置**: `works.rs:400`

```rust
pub fn is_audio_based(&self) -> bool
```

**功能**：判断是否为音频类型作品

**返回**：
- `true`：音频类型（VoiceDiary, Music, Podcast）
- `false`：其他类型

---

#### 3.2.3 is_video_based

**位置**: `works.rs:408`

```rust
pub fn is_video_based(&self) -> bool
```

**功能**：判断是否为视频类型作品

**返回**：
- `true`：视频类型（VideoLog, Lecture, LifeClip）
- `false`：其他类型

---

#### 3.2.4 has_transcript

**位置**: `works.rs:423`

```rust
pub fn has_transcript(&self) -> bool
```

**功能**：判断是否有转录文本

**返回**：
- `true`：作品有转录文本或字幕
- `false`：没有转录文本

**支持的类型**：
- `VoiceDiary { has_transcript }` - 语音日记转录
- `Podcast { has_transcript }` - 播客转录
- `VideoLog { has_subtitles }` - 视频字幕
- `Lecture { has_subtitles }` - 讲座字幕

**用途**：AI训练时，有转录文本的音频/视频作品可以当作文本处理

---

#### 3.2.5 as_str

**位置**: `works.rs:439`

```rust
pub fn as_str(&self) -> &'static str
```

**功能**：获取作品类型的字符串表示

**返回**：作品类型名称（如 "Literature", "Music", "VideoLog" 等）

**用途**：
- 日志记录
- 前端展示
- 统计分析

**类型映射**：
- `Literature` => `"Literature"`
- `AcademicPaper` => `"AcademicPaper"`
- `Diary` => `"Diary"`
- `Letter` => `"Letter"`
- `VoiceDiary` => `"VoiceDiary"`
- `Music` => `"Music"`
- `Podcast` => `"Podcast"`
- `VideoLog` => `"VideoLog"`
- `Lecture` => `"Lecture"`
- `LifeClip` => `"LifeClip"`
- `Artwork` => `"Artwork"`
- `Design` => `"Design"`
- `SocialMedia` => `"SocialMedia"`
- `Code` => `"Code"`
- `SkillDemo` => `"SkillDemo"`

---

### 3.3 DeceasedWork 方法

#### 3.3.1 is_ai_training_valuable

**位置**: `works.rs:470`

```rust
pub fn is_ai_training_valuable(&self) -> bool
```

**功能**：检查作品是否对AI训练有价值

**标准**：
- 授权了AI训练（`ai_training_enabled = true`）
- 是文本类型或有转录文本

**返回**：
- `true`：可用于AI训练
- `false`：不适合AI训练

**实现逻辑**：
```rust
self.ai_training_enabled
    && (self.work_type.is_text_based() || self.work_type.has_transcript())
```

---

#### 3.3.2 ai_training_weight

**位置**: `works.rs:484`

```rust
pub fn ai_training_weight(&self) -> u8
```

**功能**：获取作品的AI训练权重

**权重规则**：
- **文本类型**：100（最高价值）
- **有转录的音频/视频**：80（高价值）
- **其他类型**：20（辅助价值）
- **未授权**：0（无价值）

**返回**：权重值（0-100）

**实现逻辑**：
```rust
if !self.ai_training_enabled {
    return 0;
}

if self.work_type.is_text_based() {
    100
} else if self.work_type.has_transcript() {
    80
} else {
    20
}
```

**用途**：
- AI训练数据排序
- 训练数据质量评估
- 训练数据集构建

---

## 4. 使用示例

### 4.1 创建作品类型

```rust
// 创建文学作品
let work_type = WorkType::Literature {
    genre: LiteratureGenre::Novel,
    word_count: 50000,
};

// 创建音乐作品
let work_type = WorkType::Music {
    genre: b"Jazz".to_vec().try_into().unwrap(),
    has_lyrics: true,
};

// 创建视频作品
let work_type = WorkType::VideoLog {
    duration: 3600,  // 1小时
    has_subtitles: true,
};
```

### 4.2 类型判断

```rust
// 判断是否为文本类型
if work_type.is_text_based() {
    println!("这是文本类型作品");
}

// 判断是否有转录文本
if work_type.has_transcript() {
    println!("有转录文本，可用于AI训练");
}

// 获取类型字符串
let type_str = work_type.as_str();  // "Literature", "Music" 等
```

### 4.3 隐私级别转换

```rust
// 从u8转换为枚举
let privacy = PrivacyLevel::from_u8(1);  // Family

// 转换为u8
let code = privacy.to_u8();  // 1
```

### 4.4 AI训练评估

```rust
// 检查作品是否对AI训练有价值
if work.is_ai_training_valuable() {
    println!("可用于AI训练");
}

// 获取AI训练权重
let weight = work.ai_training_weight();
println!("训练权重: {}", weight);
```

---

## 5. 实际接口位置

**重要提示**：`works.rs` 仅定义类型和辅助函数，实际的 extrinsic 接口在 `pallets/deceased/src/lib.rs` 中：

### 5.1 作品管理接口（lib.rs）

| 接口 | 位置 | 功能 |
|------|------|------|
| `upload_work` | `lib.rs:4397` | 上传单个作品 |
| `batch_upload_works` | `lib.rs:4463` | 批量上传作品（最多50个） |
| `update_work` | `lib.rs:4540` | 更新作品元数据 |
| `delete_work` | `lib.rs:4602` | 删除作品 |
| `verify_work` | `lib.rs:4646` | 验证作品真实性 |

### 5.2 查询接口（lib.rs）

| 接口 | 位置 | 功能 |
|------|------|------|
| `deceased_works` | 存储getter | 查询单个作品 |
| `works_by_deceased` | 存储getter | 查询逝者的所有作品 |
| `works_by_type` | 存储getter | 按类型查询作品 |
| `ai_training_works` | 存储getter | 查询AI训练授权作品 |
| `work_stats` | 存储getter | 查询作品统计信息 |

---

## 6. 总结

### 6.1 works.rs 职责

`works.rs` 模块主要负责：

1. ✅ **类型定义**：定义作品相关的枚举和结构体
2. ✅ **辅助函数**：提供类型判断和转换方法
3. ✅ **AI训练支持**：提供AI训练价值评估方法

### 6.2 核心类型

- **WorkType**：13种作品类型枚举
- **PrivacyLevel**：4级隐私控制枚举
- **DeceasedWork**：作品完整记录结构
- **WorkUploadInfo**：批量上传简化结构

### 6.3 核心方法

- **类型判断**：`is_text_based()`, `is_audio_based()`, `is_video_based()`, `has_transcript()`
- **类型转换**：`as_str()`, `from_u8()`, `to_u8()`
- **AI评估**：`is_ai_training_valuable()`, `ai_training_weight()`

### 6.4 实际接口位置

**注意**：实际的 extrinsic 接口（`upload_work`、`update_work` 等）在 `pallets/deceased/src/lib.rs` 中实现，不在 `works.rs` 中。

---

**文档维护**: Stardust 开发团队  
**最后更新**: 2025-11-13  
**版本**: v1.0.0

