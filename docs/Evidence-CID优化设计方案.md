# Evidence存储优化：CID化设计方案

**时间**: 2025-10-27  
**目标**: 存储成本降低60%，Gas费用降低40-50%  
**状态**: 🚀 实施中

---

## 📊 当前问题分析

### 当前Evidence结构
```rust
pub struct Evidence<AccountId, MaxCidLen, MaxImg, MaxVid, MaxDoc, MaxMemoLen> {
    pub id: u64,
    pub domain: u8,
    pub target_id: u64,
    pub owner: AccountId,
    pub imgs: BoundedVec<BoundedVec<u8, MaxCidLen>, MaxImg>,  // 最多10个，每个128字节
    pub vids: BoundedVec<BoundedVec<u8, MaxCidLen>, MaxVid>,  // 最多5个，每个128字节
    pub docs: BoundedVec<BoundedVec<u8, MaxCidLen>, MaxDoc>,  // 最多5个，每个128字节
    pub memo: Option<BoundedVec<u8, MaxMemoLen>>,             // 最多256字节
    pub commit: Option<H256>,
    pub ns: Option<[u8; 8]>,
}
```

### 存储成本分析

**最坏情况（存满）**：
- imgs: 10 × 128 = 1,280字节
- vids: 5 × 128 = 640字节
- docs: 5 × 128 = 640字节
- memo: 256字节
- 其他字段: ~100字节
- **总计**: ~2,916字节/条

**典型情况（3图+1视频+1文档）**：
- imgs: 3 × 128 = 384字节
- vids: 1 × 128 = 128字节
- docs: 1 × 128 = 128字节
- memo: 100字节
- 其他字段: ~100字节
- **总计**: ~840字节/条

---

## 🎯 优化方案

### 新Evidence结构

```rust
/// Phase 1优化：Evidence存储CID化
/// - 链上只存content_cid（单个IPFS CID）
/// - 实际内容（imgs/vids/docs数组）存储在IPFS的JSON文件中
/// - 存储成本降低60%，Gas费用降低40-50%
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub struct Evidence<AccountId, BlockNumber> {
    /// 证据ID（自增）
    pub id: u64,
    
    /// 域标识（1=Grave, 2=Deceased, 3=DeceasedText等）
    pub domain: u8,
    
    /// 目标ID（grave_id, deceased_id等）
    pub target_id: u64,
    
    /// 证据所有者
    pub owner: AccountId,
    
    /// Phase 1优化：内容CID（指向IPFS JSON文件）
    /// - JSON文件包含imgs/vids/docs数组
    /// - 格式: {"imgs":["QmXxx"],"vids":["QmYyy"],"docs":["QmZzz"],"memo":"optional"}
    pub content_cid: BoundedVec<u8, ConstU32<64>>,
    
    /// 内容类型标记
    pub content_type: ContentType,
    
    /// 创建时间（块号）
    pub created_at: BlockNumber,
    
    /// 可选：加密标记
    pub is_encrypted: bool,
    
    /// 可选：加密方案标识
    pub encryption_scheme: Option<BoundedVec<u8, ConstU32<32>>>,
    
    /// 可选：命名空间
    pub ns: Option<[u8; 8]>,
    
    /// 可选：证据承诺
    pub commit: Option<H256>,
}

/// 内容类型枚举
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum ContentType {
    /// 仅图片
    Image,
    /// 仅视频
    Video,
    /// 仅文档
    Document,
    /// 混合类型（包含多种）
    Mixed,
    /// 纯文本（仅memo）
    Text,
}
```

### IPFS JSON格式

```json
{
  "version": "1.0",
  "imgs": [
    "QmXxx...",  // IPFS CID of image 1
    "QmYyy..."   // IPFS CID of image 2
  ],
  "vids": [
    "QmZzz..."   // IPFS CID of video 1
  ],
  "docs": [
    "QmAaa..."   // IPFS CID of document 1
  ],
  "memo": "optional text description",
  "metadata": {
    "created_at_unix": 1700000000,
    "uploader": "5GrwvaEF...",
    "tags": ["tag1", "tag2"]
  }
}
```

---

## 💰 成本对比

### 优化前（典型情况）

**链上存储**：
- imgs (3个): 384字节
- vids (1个): 128字节
- docs (1个): 128字节
- memo: 100字节
- 其他: 100字节
- **总计**: 840字节

**估算Gas成本**：
- 创建Evidence: ~0.01 DUST
- 存储维护成本: 840字节 × 存储单价

---

### 优化后（典型情况）

**链上存储**：
- content_cid: 64字节（一个IPFS CID）
- 元数据: ~150字节
- **总计**: ~214字节

**IPFS存储**：
- JSON文件: ~500字节（包含所有CID数组）
- 不占用链上空间

**估算Gas成本**：
- 创建Evidence: ~0.004 DUST（↓60%）
- 存储维护成本: 214字节 × 存储单价（↓75%）

---

### 成本降低对比

| 指标 | 优化前 | 优化后 | 降低幅度 |
|------|--------|--------|----------|
| 链上存储 | 840字节 | 214字节 | **74.5%** ↓ |
| Gas成本 | 0.01 DUST | 0.004 DUST | **60%** ↓ |
| 存储灵活性 | 固定上限 | 无限扩展 | ✅ |
| 查询速度 | 快 | 稍慢（需IPFS查询） | ⚠️ |

---

## 🔄 迁移策略

### 方案：新旧结构并存（推荐）

#### 1. 数据结构兼容性

```rust
pub struct Evidence<AccountId, BlockNumber> {
    // ... 新字段 ...
    pub content_cid: BoundedVec<u8, ConstU32<64>>,
    pub content_type: ContentType,
    
    // 旧字段（标记deprecated，Phase 2移除）
    #[deprecated(note = "Use content_cid instead")]
    pub imgs: Option<BoundedVec<BoundedVec<u8, ConstU32<128>>, ConstU32<10>>>,
    #[deprecated(note = "Use content_cid instead")]
    pub vids: Option<BoundedVec<BoundedVec<u8, ConstU32<128>>, ConstU32<5>>>,
    #[deprecated(note = "Use content_cid instead")]
    pub docs: Option<BoundedVec<BoundedVec<u8, ConstU32<128>>, ConstU32<5>>>,
    #[deprecated(note = "Use content_cid instead")]
    pub memo: Option<BoundedVec<u8, ConstU32<256>>>,
}
```

#### 2. 提交方式双轨并行

```rust
// 方式1：旧方式（保留兼容）
submit_evidence(imgs, vids, docs, memo)

// 方式2：新方式（推荐）
submit_evidence_v2(content_cid, content_type, is_encrypted)
```

#### 3. 读取逻辑统一

```rust
pub fn get_evidence(id: u64) -> Evidence {
    let e = Evidences::<T>::get(id)?;
    
    // 优先使用新格式
    if !e.content_cid.is_empty() {
        return e;  // 使用content_cid
    }
    
    // 降级到旧格式
    if e.imgs.is_some() || e.vids.is_some() {
        return e;  // 使用旧字段
    }
}
```

---

## 🛠️ 实施步骤

### Phase 1.0: 数据结构改造 ⏱️ 1小时

#### Step 1: 修改Evidence结构
```rust
// pallets/evidence/src/lib.rs

// 删除泛型参数
// pub struct Evidence<AccountId, MaxCidLen, MaxImg, MaxVid, MaxDoc, MaxMemoLen>

// 简化为
pub struct Evidence<AccountId, BlockNumber> {
    pub id: u64,
    pub domain: u8,
    pub target_id: u64,
    pub owner: AccountId,
    pub content_cid: BoundedVec<u8, ConstU32<64>>,
    pub content_type: ContentType,
    pub created_at: BlockNumber,
    pub is_encrypted: bool,
    pub encryption_scheme: Option<BoundedVec<u8, ConstU32<32>>>,
    pub ns: Option<[u8; 8]>,
    pub commit: Option<H256>,
}
```

#### Step 2: 添加ContentType枚举
```rust
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum ContentType {
    Image,
    Video,
    Document,
    Mixed,
    Text,
}
```

#### Step 3: 更新Config
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: ...;
    
    // 移除：
    // type MaxCidLen: Get<u32>;
    // type MaxImg: Get<u32>;
    // type MaxVid: Get<u32>;
    // type MaxDoc: Get<u32>;
    // type MaxMemoLen: Get<u32>;
    
    // 保留必要的：
    type MaxAuthorizedUsers: Get<u32>;
    type MaxKeyLen: Get<u32>;
    // ...
}
```

---

### Phase 1.1: 新增submit_evidence_v2 ⏱️ 30分钟

```rust
/// 函数级中文注释：提交证据（v2版本，CID化）
/// 
/// 参数：
/// - content_cid: IPFS CID（指向包含所有内容的JSON文件）
/// - content_type: 内容类型（Image/Video/Document/Mixed/Text）
/// - is_encrypted: 是否加密
/// - encryption_scheme: 可选的加密方案标识
#[pallet::call_index(10)]
#[pallet::weight(T::WeightInfo::submit_evidence())]
pub fn submit_evidence_v2(
    origin: OriginFor<T>,
    domain: u8,
    target_id: u64,
    content_cid: BoundedVec<u8, ConstU32<64>>,
    content_type: ContentType,
    is_encrypted: bool,
    encryption_scheme: Option<BoundedVec<u8, ConstU32<32>>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // CID验证
    ensure!(!content_cid.is_empty(), Error::<T>::EmptyContentCid);
    ensure!(
        content_cid.len() >= 32 && content_cid.len() <= 64,
        Error::<T>::InvalidCidLength
    );
    
    // L-4修复：CID加密验证
    if is_encrypted {
        crate::cid_validator::validate_encrypted_cid(&content_cid)?;
    }
    
    let id = Self::next_evidence_id();
    let now = <frame_system::Pallet<T>>::block_number();
    
    let evidence = Evidence {
        id,
        domain,
        target_id,
        owner: who.clone(),
        content_cid: content_cid.clone(),
        content_type: content_type.clone(),
        created_at: now,
        is_encrypted,
        encryption_scheme,
        ns: None,
        commit: None,
    };
    
    Evidences::<T>::insert(id, evidence);
    Self::deposit_event(Event::EvidenceSubmittedV2 {
        id,
        who,
        domain,
        target_id,
        content_cid,
        content_type,
    });
    
    Ok(())
}
```

---

### Phase 1.2: Runtime配置更新 ⏱️ 15分钟

```rust
// runtime/src/configs/mod.rs

impl pallet_evidence::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    
    // 移除旧的泛型参数配置
    // type MaxCidLen = ConstU32<128>;
    // type MaxImg = ConstU32<10>;
    // type MaxVid = ConstU32<5>;
    // type MaxDoc = ConstU32<5>;
    // type MaxMemoLen = ConstU32<256>;
    
    // 保留必要的
    type MaxAuthorizedUsers = ConstU32<100>;
    type MaxKeyLen = ConstU32<256>;
    type EvidenceNsBytes = [u8; 8];
    type Authorizer = ();
    type MaxPerSubjectTarget = ConstU32<1000>;
    type MaxPerSubjectNs = ConstU32<100>;
    type WindowBlocks = ConstU64<100>;
    type MaxPerWindow = ConstU32<10>;
    type EnableGlobalCidDedup = ConstBool<false>;
    type MaxListLen = ConstU32<100>;
    type WeightInfo = ();
    type FamilyVerifier = ();
}
```

---

### Phase 1.3: 前端适配 ⏱️ 1小时

#### 旧前端代码
```typescript
// 读取Evidence
const evidence = await api.query.evidence.evidences(id);
const imgs = evidence.imgs.toArray();
const vids = evidence.vids.toArray();
```

#### 新前端代码
```typescript
// 读取Evidence
const evidence = await api.query.evidence.evidences(id);
const contentCid = evidence.contentCid.toString();

// 从IPFS获取内容
const content = await ipfs.cat(contentCid);
const parsed = JSON.parse(content);
const imgs = parsed.imgs;  // 数组of CID
const vids = parsed.vids;

// 显示图片
for (const imgCid of imgs) {
  const imgUrl = `https://ipfs.io/ipfs/${imgCid}`;
  // 渲染图片
}
```

#### 提交Evidence（新方式）
```typescript
// 1. 构建JSON内容
const content = {
  version: "1.0",
  imgs: ["QmXxx...", "QmYyy..."],
  vids: ["QmZzz..."],
  docs: ["QmAaa..."],
  memo: "description",
  metadata: {
    created_at_unix: Date.now() / 1000,
    uploader: account.address,
  }
};

// 2. 上传到IPFS
const contentCid = await ipfs.add(JSON.stringify(content));

// 3. 提交到链上
await api.tx.evidence.submitEvidenceV2(
  domain,
  targetId,
  contentCid,
  'Mixed',  // ContentType
  false,    // is_encrypted
  null      // encryption_scheme
).signAndSend(account);
```

---

## 📊 预期效果

### 存储成本
- **链上存储**: ↓ 74.5% (840字节 → 214字节)
- **Gas成本**: ↓ 60% (0.01 DUST → 0.004 DUST)

### 灵活性
- ✅ 无内容数量限制（IPFS支持大文件）
- ✅ 支持任意类型扩展
- ✅ 支持视频、大文档

### 兼容性
- ✅ 新旧方式并存
- ✅ 渐进式迁移
- ✅ 前端统一接口

---

## ⚠️ 注意事项

### IPFS可用性
- **问题**: IPFS节点可能不稳定
- **解决**: 
  - 使用Pin服务（Pinata, Infura）
  - 运行自己的IPFS节点
  - 多节点备份

### 查询性能
- **问题**: 需要额外的IPFS查询
- **解决**:
  - Subsquid缓存常用Evidence
  - 前端本地缓存
  - CDN加速IPFS网关

### 加密内容
- **问题**: JSON明文存储在IPFS
- **解决**:
  - content_cid指向加密后的JSON
  - 加密密钥通过encryption_scheme管理
  - L-4修复：CID加密验证

---

**设计完成时间**: 2025-10-27  
**预计实施时间**: 2-3小时  
**负责人**: StarDust技术团队

