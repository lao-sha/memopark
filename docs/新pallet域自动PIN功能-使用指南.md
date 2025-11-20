# 新Pallet域自动PIN功能 - 使用指南

## 📖 概述

**新pallet域自动PIN机制**是stardust-ipfs的革命性功能，让新业务pallet可以**一行代码**实现内容自动固定到IPFS，无需了解IPFS内部细节。

## 🎯 设计目标

### 问题：旧方案的局限性
- ❌ 仅支持Deceased和Grave两个域
- ❌ 新业务pallet需要修改stardust-ipfs源代码
- ❌ 需要了解SubjectType、SubjectFunding等内部概念
- ❌ 扩展性差，维护成本高

### 解决方案：ContentRegistry统一接口
- ✅ 支持任意自定义域
- ✅ 自动创建域配置
- ✅ 自动派生SubjectFunding账户
- ✅ 自动执行三层扣费
- ✅ 零IPFS知识要求

## 🚀 快速开始（5分钟）

### 步骤1：在业务pallet添加依赖

**Cargo.toml**:
```toml
[dependencies]
pallet-stardust-ipfs = { path = "../stardust-ipfs", default-features = false }

[features]
std = [
    # ...
    "pallet-stardust-ipfs/std",
]
```

### 步骤2：配置Config trait

**lib.rs**:
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    
    /// ⭐ 添加ContentRegistry接口 ⭐
    type ContentRegistry: pallet_memo_ipfs::ContentRegistry;
}
```

### 步骤3：在extrinsic中使用

```rust
use pallet_memo_ipfs::PinTier;

#[pallet::call_index(0)]
#[pallet::weight(100_000)]
pub fn upload_content(
    origin: OriginFor<T>,
    cid: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // ⭐ 一行代码完成内容注册和PIN ⭐
    T::ContentRegistry::register_content(
        b"my-pallet-domain".to_vec(),  // 域名
        subject_id,                    // 主体ID（如user_id, item_id）
        cid,                           // IPFS CID
        PinTier::Standard,             // Pin等级
    )?;
    
    // 继续你的业务逻辑...
    Ok(())
}
```

### 步骤4：在runtime中配置

**runtime/src/lib.rs**:
```rust
impl pallet_my_business::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    // ⭐ 绑定到PalletMemoIpfs ⭐
    type ContentRegistry = PalletMemoIpfs;
}
```

## ✨ 核心API

### 1. register_content - 注册内容到IPFS

```rust
fn register_content(
    domain: Vec<u8>,      // 域名（如 b"nft-metadata"）
    subject_id: u64,      // 主体ID
    cid: Vec<u8>,         // IPFS CID
    tier: PinTier,        // Pin等级
) -> DispatchResult;
```

**自动化处理：**
1. ✅ 检查域是否已注册，未注册则自动创建
2. ✅ 根据域配置派生SubjectType
3. ✅ 调用三层扣费机制（IpfsPool → SubjectFunding → GracePeriod）
4. ✅ 分配副本到运营者
5. ✅ 发送事件通知

### 2. is_domain_registered - 检查域是否已注册

```rust
fn is_domain_registered(domain: &[u8]) -> bool;
```

**示例：**
```rust
if !T::ContentRegistry::is_domain_registered(b"my-domain") {
    log::info!("域将在首次使用时自动创建");
}
```

### 3. get_domain_subject_type - 获取域的SubjectType

```rust
fn get_domain_subject_type(domain: &[u8]) -> Option<SubjectType>;
```

**示例：**
```rust
if let Some(subject_type) = T::ContentRegistry::get_domain_subject_type(b"my-domain") {
    log::info!("域的SubjectType: {:?}", subject_type);
}
```

## 🎨 Pin等级详解

| 等级 | 副本数 | 巡检间隔 | 费率系数 | 适用场景 |
|------|--------|----------|----------|----------|
| **Critical** | 5 | 6小时 | 1.5x | 🔴 逝者档案、法律证据、关键数据 |
| **Standard** | 3 | 24小时 | 1.0x | 🟡 常规内容、NFT元数据、用户文件 |
| **Temporary** | 1 | 7天 | 0.5x | 🟢 临时文件、缓存、草稿 |

**选择建议：**
- **Critical**: 不可丢失的重要数据（如遗嘱、证据）
- **Standard**: 需要持久保存的常规内容（如照片、视频）
- **Temporary**: 短期使用的临时内容（如预览图、草稿）

## 📊 使用场景示例

### 场景1：NFT Pallet

```rust
/// NFT铸造，自动PIN元数据和图片
#[pallet::call_index(0)]
#[pallet::weight(150_000)]
pub fn mint_nft(
    origin: OriginFor<T>,
    metadata_cid: Vec<u8>,
    image_cid: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let nft_id = Self::next_nft_id();
    
    // PIN元数据（Standard等级）
    T::ContentRegistry::register_content(
        b"nft-metadata".to_vec(),
        nft_id,
        metadata_cid,
        PinTier::Standard,
    )?;
    
    // PIN图片（Standard等级）
    T::ContentRegistry::register_content(
        b"nft-image".to_vec(),
        nft_id,
        image_cid,
        PinTier::Standard,
    )?;
    
    // 继续NFT铸造逻辑...
    Ok(())
}
```

### 场景2：文档归档Pallet

```rust
/// 上传重要文档，自动PIN
#[pallet::call_index(0)]
#[pallet::weight(100_000)]
pub fn upload_document(
    origin: OriginFor<T>,
    doc_type: DocumentType,
    cid: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let doc_id = Self::next_doc_id();
    
    // 根据文档类型选择Pin等级
    let tier = match doc_type {
        DocumentType::Legal => PinTier::Critical,     // 法律文件，5副本
        DocumentType::Important => PinTier::Standard, // 重要文件，3副本
        DocumentType::Draft => PinTier::Temporary,    // 草稿，1副本
    };
    
    T::ContentRegistry::register_content(
        b"document-archive".to_vec(),
        doc_id,
        cid,
        tier,
    )?;
    
    Ok(())
}
```

### 场景3：社交媒体Pallet

```rust
/// 发布帖子，自动PIN图片/视频
#[pallet::call_index(0)]
#[pallet::weight(120_000)]
pub fn create_post(
    origin: OriginFor<T>,
    content: Vec<u8>,
    media_cids: Vec<Vec<u8>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let post_id = Self::next_post_id();
    
    // PIN所有媒体文件
    for (index, cid) in media_cids.iter().enumerate() {
        T::ContentRegistry::register_content(
            b"social-media".to_vec(),
            post_id * 1000 + index as u64,  // 唯一ID
            cid.clone(),
            PinTier::Standard,
        )?;
    }
    
    // 继续帖子创建逻辑...
    Ok(())
}
```

### 场景4：游戏资产Pallet

```rust
/// 创建游戏资产，自动PIN模型和纹理
#[pallet::call_index(0)]
#[pallet::weight(200_000)]
pub fn create_game_asset(
    origin: OriginFor<T>,
    model_cid: Vec<u8>,
    texture_cids: Vec<Vec<u8>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let asset_id = Self::next_asset_id();
    
    // PIN 3D模型
    T::ContentRegistry::register_content(
        b"game-asset-model".to_vec(),
        asset_id,
        model_cid,
        PinTier::Standard,
    )?;
    
    // PIN纹理文件
    for (i, texture_cid) in texture_cids.iter().enumerate() {
        T::ContentRegistry::register_content(
            b"game-asset-texture".to_vec(),
            asset_id * 100 + i as u64,
            texture_cid.clone(),
            PinTier::Standard,
        )?;
    }
    
    Ok(())
}
```

## 🔧 域命名建议

### 命名规范
格式：`{pallet-name}-{content-type}`

### 推荐域名
| Pallet类型 | 域名示例 | 说明 |
|-----------|---------|------|
| NFT | `nft-metadata`, `nft-image` | NFT元数据和图片 |
| 文档 | `doc-archive`, `doc-legal` | 文档归档和法律文件 |
| 社交 | `social-post`, `social-avatar` | 社交帖子和头像 |
| 游戏 | `game-asset`, `game-save` | 游戏资产和存档 |
| 视频 | `video-stream`, `video-thumbnail` | 视频流和缩略图 |
| 音乐 | `music-track`, `music-album` | 音乐曲目和专辑 |

### 注意事项
- ✅ 域名长度：1-32字节
- ✅ 建议使用小写字母和连字符
- ✅ 避免使用已存在的内置域名（deceased, grave, offerings, evidence）
- ✅ 每个pallet可以有多个域（如nft-metadata和nft-image）

## 🎛️ 域管理（治理功能）

### 1. 预注册域（可选）

**为什么需要预注册？**
- 避免首次使用时的自动创建不确定性
- 设置自定义的SubjectType ID
- 配置默认的Pin等级
- 控制域的启用/禁用

**治理调用：**
```rust
// JavaScript/TypeScript
api.tx.memoIpfs.registerDomain(
    "my-pallet-domain",          // 域名
    99,                          // SubjectType ID（10-255自定义）
    { Standard: null },          // 默认Pin等级
    true,                        // 启用自动PIN
);
```

### 2. 更新域配置

```rust
// 禁用域的自动PIN
api.tx.memoIpfs.updateDomainConfig(
    "my-pallet-domain",
    false,                       // 禁用自动PIN
    null,                        // 默认等级不变
    null,                        // SubjectType不变
);

// 修改默认Pin等级
api.tx.memoIpfs.updateDomainConfig(
    "my-pallet-domain",
    null,                        // 启用状态不变
    { Critical: null },          // 修改为Critical
    null,                        // SubjectType不变
);
```

### 3. 查询域信息

```rust
// 查询域配置
const domainConfig = await api.query.memoIpfs.registeredDomains("my-domain");
if (domainConfig.isSome) {
    const config = domainConfig.unwrap();
    console.log("自动PIN:", config.autoPinEnabled);
    console.log("默认等级:", config.defaultTier);
    console.log("SubjectType ID:", config.subjectTypeId);
}

// 查询域下的所有CID
const cids = await api.query.memoIpfs.domainPins.entries("my-domain");
console.log("域下CID数量:", cids.length);
```

## 📡 事件监听

### DomainRegistered - 域已注册
```typescript
api.query.system.events((events) => {
    events.forEach((record) => {
        const { event } = record;
        if (event.section === 'memoIpfs' && event.method === 'DomainRegistered') {
            const [domain, subjectTypeId] = event.data;
            console.log(`域已注册: ${domain}, SubjectType ID: ${subjectTypeId}`);
        }
    });
});
```

### ContentRegisteredViaDomain - 内容已通过域注册
```typescript
api.query.system.events((events) => {
    events.forEach((record) => {
        const { event } = record;
        if (event.section === 'memoIpfs' && event.method === 'ContentRegisteredViaDomain') {
            const [domain, subjectId, cidHash, tier] = event.data;
            console.log(`内容已PIN: 域=${domain}, ID=${subjectId}, 等级=${tier}`);
        }
    });
});
```

### DomainConfigUpdated - 域配置已更新
```typescript
api.query.system.events((events) => {
    events.forEach((record) => {
        const { event } = record;
        if (event.section === 'memoIpfs' && event.method === 'DomainConfigUpdated') {
            const [domain, autoPinEnabled] = event.data;
            console.log(`域配置已更新: ${domain}, 自动PIN=${autoPinEnabled}`);
        }
    });
});
```

## 🔍 常见问题

### Q1: 域会自动创建吗？
**A:** 是的！首次调用`register_content`时，如果域不存在会自动创建，使用默认配置：
- SubjectType ID: 99（自定义类型）
- 默认Pin等级：Standard
- 自动PIN：启用

### Q2: 需要提前充值SubjectFunding账户吗？
**A:** 不需要！三层扣费机制会按顺序尝试：
1. IpfsPoolAccount（系统公共池）
2. SubjectFunding账户（用户充值）
3. GracePeriod（宽限期，不扣费）

### Q3: 如何计算SubjectFunding账户地址？
**A:** 无需手动计算！系统自动根据`(domain, subject_id)`派生：
```rust
let funding_account = PalletId(*b"memo/ipf")
    .into_sub_account_truncating((domain, subject_id));
```

### Q4: 可以为同一个CID注册多个域吗？
**A:** 可以！同一个CID可以属于多个域，系统会正确处理费用分摊。

### Q5: 域名可以修改吗？
**A:** 域名一旦创建不可修改，但可以修改域的配置（启用/禁用、默认等级等）。

### Q6: 删除域会怎样？
**A:** 当前版本不支持删除域，只能禁用域的自动PIN功能。

### Q7: 与IpfsPinner trait的区别？
**A:** 
- **IpfsPinner**: 仅支持Deceased和Grave两个固定域
- **ContentRegistry**: 支持任意自定义域，更灵活、更易用

## 🎓 完整示例Pallet

详见 `/pallets/example-domain-pin/`，包含：
- ✅ 完整的视频上传pallet实现
- ✅ 使用ContentRegistry的最佳实践
- ✅ 完整的测试用例
- ✅ 详细的代码注释

## 📚 相关文档

- **需求分析报告**: `/docs/stardust-ipfs三需求分析报告.md`
- **stardust-ipfs README**: `/pallets/stardust-ipfs/README.md`
- **示例pallet**: `/pallets/example-domain-pin/README.md`

## 🤝 技术支持

遇到问题？
1. 查看示例pallet源代码
2. 阅读需求分析报告
3. 检查stardust-ipfs事件日志
4. 联系技术团队

---

**一行代码，自动PIN，专注业务逻辑！** 🚀

