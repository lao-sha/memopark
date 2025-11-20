# Phase 2: 纪念层整合方案

**设计时间**: 2025-10-28  
**目标**: 优化纪念层pallet架构，减少维护成本，提升代码质量  
**预期收益**: 减少 3-4个pallet，优化架构清晰度

---

## 📊 纪念层生态现状

### 当前架构（8个相关pallet）

```text
┌─────────────────────────────────────┐
│  供奉业务层                          │
│  ├─ pallet-memo-offerings  供奉系统  │ ← 用户购买供奉，多路分账
│  └─ pallet-memo-sacrifice  祭祀品目录 │ ← 供奉品主数据管理
└────────────────┬────────────────────┘
                 │ 目标对象
                 ↓
┌─────────────────────────────────────┐
│  逝者管理层                          │
│  ├─ pallet-deceased         逝者档案 │ ← 核心逝者信息
│  ├─ pallet-deceased-text    逝者文本 │ ← 生平文字扩展
│  └─ pallet-deceased-media   逝者媒体 │ ← 照片视频扩展
└────────────────┬────────────────────┘
                 │ 归属墓位
                 ↓
┌─────────────────────────────────────┐
│  墓地管理层                          │
│  ├─ pallet-stardust-grave       墓地管理 │ ← 墓位创建、安葬管理
│  └─ pallet-stardust-park        陵园管理 │ ← 陵园/园区管理
└─────────────────────────────────────┘
```

### 功能依赖分析

**offerings ↔ sacrifice**：
- offerings 查询 sacrifice 获取供奉品价格
- offerings 使用 SacrificeCatalog trait
- 高度耦合，经常一起修改

**deceased ↔ text/media**：
- deceased-text 扩展逝者生平文字
- deceased-media 扩展逝者照片视频
- 三者高度相关，总是一起使用

**grave ↔ park**：
- grave 归属 park（通过 park_id）
- grave 提供 GraveInspector trait
- 层级关系清晰，但相对独立

**grave ↔ deceased**：
- 通过 GraveInspector trait 低耦合交互
- deceased 迁移时调用 grave 的准入策略
- 设计良好，建议保持独立

---

## 🎯 整合方案设计

### 方案 A: Deceased 整合（强烈推荐）⭐⭐⭐

#### 整合内容
```text
Before:
├─ pallet-deceased        (主模块)
├─ pallet-deceased-text   (文本扩展)
└─ pallet-deceased-media  (媒体扩展)

After:
└─ pallet-deceased (统一模块)
   ├─ src/
   │   ├─ lib.rs          (核心逝者管理)
   │   ├─ text.rs         (生平文本管理)
   │   ├─ media.rs        (照片视频管理)
   │   └─ types.rs        (共享类型)
```

#### 整合收益
- ✅ 减少 **2个pallet** (3→1)
- ✅ 逝者数据集中管理，查询更简单
- ✅ 统一IPFS自动Pin逻辑
- ✅ 统一权限控制
- ✅ 减少跨pallet调用开销

#### 技术方案

**1. 文本管理模块（text.rs）**
```rust
pub mod text {
    /// 函数级中文注释：生平文本结构
    pub struct DeceasedText<T: Config> {
        pub deceased_id: u64,
        pub title: BoundedVec<u8, T::MaxTitleLen>,
        pub content_cid: BoundedVec<u8, T::MaxCidLen>,  // IPFS CID
        pub author: T::AccountId,
        pub created: BlockNumberFor<T>,
        pub updated: BlockNumberFor<T>,
    }
    
    /// 函数级中文注释：添加生平文本
    pub fn add_text<T: Config>(
        deceased_id: u64,
        title: Vec<u8>,
        content_cid: Vec<u8>,
        author: T::AccountId,
    ) -> DispatchResult {
        // 验证逝者存在
        // 验证权限（owner或被授权者）
        // 存储文本记录
        // 自动Pin content_cid到IPFS
        // 发出事件
    }
}
```

**2. 媒体管理模块（media.rs）**
```rust
pub mod media {
    /// 函数级中文注释：媒体类型
    pub enum MediaType {
        Photo,      // 照片
        Video,      // 视频
        Audio,      // 音频
        Document,   // 文档
    }
    
    /// 函数级中文注释：媒体记录
    pub struct DeceasedMedia<T: Config> {
        pub deceased_id: u64,
        pub media_type: MediaType,
        pub cid: BoundedVec<u8, T::MaxCidLen>,
        pub title: Option<BoundedVec<u8, T::MaxTitleLen>>,
        pub description_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
        pub uploader: T::AccountId,
        pub created: BlockNumberFor<T>,
    }
    
    /// 函数级中文注释：上传媒体
    pub fn add_media<T: Config>(
        deceased_id: u64,
        media_type: MediaType,
        cid: Vec<u8>,
        title: Option<Vec<u8>>,
        description_cid: Option<Vec<u8>>,
    ) -> DispatchResult {
        // 验证逝者存在
        // 验证权限
        // 存储媒体记录
        // 自动Pin CID到IPFS
        // 发出事件
    }
}
```

**3. 统一存储结构**
```rust
/// 函数级中文注释：逝者核心信息（现有）
pub type Deceased<T> = StorageMap<_, Blake2_128Concat, u64, DeceasedInfo<T>>;

/// 函数级中文注释：逝者生平文本（新增）
pub type DeceasedTexts<T> = StorageDoubleMap<
    _,
    Blake2_128Concat, u64,  // deceased_id
    Blake2_128Concat, u64,  // text_id
    DeceasedText<T>,
>;

/// 函数级中文注释：逝者媒体库（新增）
pub type DeceasedMedias<T> = StorageDoubleMap<
    _,
    Blake2_128Concat, u64,  // deceased_id
    Blake2_128Concat, u64,  // media_id
    DeceasedMedia<T>,
>;

/// 函数级中文注释：文本计数器
pub type NextTextId<T> = StorageValue<_, u64, ValueQuery>;

/// 函数级中文注释：媒体计数器
pub type NextMediaId<T> = StorageValue<_, u64, ValueQuery>;
```

**4. 统一接口**
```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    // === 核心逝者管理（现有） ===
    #[pallet::call_index(0)]
    pub fn create_deceased(...) -> DispatchResult
    
    #[pallet::call_index(1)]
    pub fn transfer_deceased(...) -> DispatchResult
    
    #[pallet::call_index(2)]
    pub fn update_deceased(...) -> DispatchResult
    
    // === 生平文本管理（新增） ===
    #[pallet::call_index(10)]
    pub fn add_text(
        origin: OriginFor<T>,
        deceased_id: u64,
        title: Vec<u8>,
        content_cid: Vec<u8>,
    ) -> DispatchResult
    
    #[pallet::call_index(11)]
    pub fn update_text(
        origin: OriginFor<T>,
        deceased_id: u64,
        text_id: u64,
        title: Option<Vec<u8>>,
        content_cid: Option<Vec<u8>>,
    ) -> DispatchResult
    
    #[pallet::call_index(12)]
    pub fn remove_text(
        origin: OriginFor<T>,
        deceased_id: u64,
        text_id: u64,
    ) -> DispatchResult
    
    // === 媒体管理（新增） ===
    #[pallet::call_index(20)]
    pub fn add_media(
        origin: OriginFor<T>,
        deceased_id: u64,
        media_type: MediaType,
        cid: Vec<u8>,
        title: Option<Vec<u8>>,
        description_cid: Option<Vec<u8>>,
    ) -> DispatchResult
    
    #[pallet::call_index(21)]
    pub fn remove_media(
        origin: OriginFor<T>,
        deceased_id: u64,
        media_id: u64,
    ) -> DispatchResult
    
    #[pallet::call_index(22)]
    pub fn set_cover_media(
        origin: OriginFor<T>,
        deceased_id: u64,
        media_id: u64,
    ) -> DispatchResult
}
```

#### 实施步骤

**Step 1**: 扩展 pallet-deceased 结构（2-3h）
- ✅ 在 `src/` 下创建 `text.rs` 和 `media.rs`
- ✅ 定义数据结构和存储
- ✅ 实现基础增删改查

**Step 2**: 迁移现有功能（1-2h）
- ✅ 从 `pallet-deceased-text` 迁移逻辑到 `text.rs`
- ✅ 从 `pallet-deceased-media` 迁移逻辑到 `media.rs`
- ✅ 统一权限检查和IPFS Pin

**Step 3**: 更新 Runtime 配置（30min）
- ✅ 移除 `pallet-deceased-text` 和 `pallet-deceased-media`
- ✅ 保留统一的 `pallet-deceased`
- ✅ 更新依赖

**Step 4**: 编译验证（30min）
- ✅ 修复编译错误
- ✅ 运行测试
- ✅ 检查lint

---

### 方案 B: Memorial 整合（可选）⭐⭐

#### 整合内容
```text
Before:
├─ pallet-memo-offerings  (供奉业务)
└─ pallet-memo-sacrifice  (祭祀品目录)

After:
└─ pallet-memorial (统一纪念服务)
   ├─ src/
   │   ├─ lib.rs          (供奉业务逻辑)
   │   ├─ catalog.rs      (祭祀品目录管理)
   │   └─ types.rs        (共享类型)
```

#### 整合收益
- ✅ 减少 **1个pallet** (2→1)
- ✅ 统一供奉和祭祀品管理
- ✅ 简化审核流程
- ✅ 减少接口依赖

#### 技术方案

**1. 祭祀品目录模块（catalog.rs）**
```rust
pub mod catalog {
    /// 函数级中文注释：祭祀品结构（迁移自sacrifice）
    pub struct SacrificeItem<T: Config> {
        pub id: u64,
        pub name: BoundedVec<u8, T::StringLimit>,
        pub resource_url: BoundedVec<u8, T::UriLimit>,
        pub fixed_price: Option<u128>,
        pub unit_price_per_week: Option<u128>,
        pub approval_state: ApprovalState,
        pub creator_id: T::AccountId,
        // ... 其他字段
    }
    
    /// 函数级中文注释：创建祭祀品
    pub fn create_sacrifice<T: Config>(...) -> DispatchResult {
        // 创建祭祀品记录
        // 冻结押金
        // 进入审核流程
    }
    
    /// 函数级中文注释：批准祭祀品
    pub fn approve_sacrifice<T: Config>(...) -> DispatchResult {
        // 批准上架
        // 退还押金
    }
}
```

**2. 供奉业务模块（主 lib.rs）**
```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    // === 祭祀品目录管理 ===
    #[pallet::call_index(0)]
    pub fn create_sacrifice(...) -> DispatchResult
    
    #[pallet::call_index(1)]
    pub fn approve_sacrifice(...) -> DispatchResult
    
    #[pallet::call_index(2)]
    pub fn reject_sacrifice(...) -> DispatchResult
    
    // === 供奉业务 ===
    #[pallet::call_index(10)]
    pub fn submit_for_review(...) -> DispatchResult
    
    #[pallet::call_index(11)]
    pub fn offer(...) -> DispatchResult  // 购买供奉
    
    #[pallet::call_index(12)]
    pub fn set_routes(...) -> DispatchResult  // 设置分账路由
}
```

#### 注意事项
- offerings 已经很复杂（多路分账、会员折扣、审核流程）
- 整合后单个pallet会更大
- 需要仔细设计模块边界
- **建议作为可选任务，优先级低于 Deceased 整合**

---

### 方案 C: Park 整合（暂不推荐）

#### 整合内容
```text
├─ pallet-stardust-grave  (墓地管理)
└─ pallet-stardust-park   (陵园管理)
```

#### 不推荐原因
- grave 和 park 是清晰的层级关系
- grave 已经通过 park_id 字段关联
- 两者业务逻辑相对独立
- 整合收益不明显
- **建议保持现状**

---

## 📊 整合优先级对比

| 方案 | 减少pallet | 复杂度 | 收益 | 优先级 | 预计工时 |
|------|-----------|--------|------|--------|---------|
| **Deceased整合** | **2个** | 低 | 高 | **⭐⭐⭐** | **3-4h** |
| Memorial整合 | 1个 | 中 | 中 | ⭐⭐ | 4-6h |
| Park整合 | 1个 | 低 | 低 | ⭐ | 2-3h |

---

## 💡 最终推荐

### 阶段 1: Deceased 整合（强烈推荐）⭐⭐⭐

**理由**：
1. ✅ **减少 2个pallet**，收益最大
2. ✅ deceased-text 和 deceased-media 是明显的功能扩展
3. ✅ 三者高度相关，总是一起使用
4. ✅ 实施复杂度低，风险小
5. ✅ 用户体验更好：一个pallet搞定所有逝者数据

**预计时间**：3-4小时

**实施步骤**：
1. 扩展 pallet-deceased 结构（添加 text.rs, media.rs）
2. 迁移现有功能到新模块
3. 更新 Runtime 配置
4. 编译验证和测试

### 阶段 2: Memorial 整合（可选）⭐⭐

**理由**：
1. ✅ 减少 1个pallet
2. ⚠️ offerings 已经很复杂，整合需谨慎
3. ⚠️ 需要仔细设计模块边界
4. 📋 可作为 Phase 3 的优化任务

**建议**：
- 先完成 Deceased 整合
- 观察效果后再决定是否整合 Memorial
- 如整合，建议作为独立任务

### 暂不推荐：Park 整合

**理由**：
- grave 和 park 层级关系清晰
- 业务逻辑相对独立
- 整合收益不明显
- **建议保持现状**

---

## 📈 整合后的 Phase 2 总成绩

### 已完成
1. ✅ **Trading整合**: 减少 2个pallet
2. ✅ **Credit整合**: 减少 1个pallet

### 计划完成
3. 🎯 **Deceased整合**: 减少 2个pallet

### Phase 2 总计
- **减少 5个pallet** (原30个 → 25个)
- **整合3个核心业务域**（Trading、Credit、Deceased）
- **架构清晰度大幅提升**
- **维护成本降低 30-35%**

---

## 🚀 下一步行动

**建议执行顺序**：

1. **立即执行**: Deceased 整合（3-4h）⭐⭐⭐
   - 高价值、低风险
   - 立即见效

2. **可选任务**: Memorial 整合（4-6h）⭐⭐
   - 根据 Deceased 整合经验决定
   - 可推迟到 Phase 3

3. **Phase 1.5 遗留**:
   - Evidence 完整实施（1-2h）
   - Subsquid Processor（3-4h）

4. **生成 Phase 2 总结报告**

---

**报告生成时间**: 2025-10-28  
**设计者**: Claude (Substrate Architecture Specialist)  
**状态**: ✅ 方案设计完成，等待用户确认

