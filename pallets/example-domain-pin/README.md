# 示例Pallet：新pallet域自动PIN机制

## 📖 概述

本pallet是**新pallet域自动PIN机制**的完整使用示例，展示如何用**一行代码**实现内容自动PIN到IPFS。

## ✨ 核心特性

### 1. 极简API
```rust
// ⭐ 只需一行代码！⭐
T::ContentRegistry::register_content(
    b"deceased-video".to_vec(),  // 域名
    video_id,                    // 主体ID
    cid,                         // IPFS CID
    PinTier::Standard,           // Pin等级
)?;
```

### 2. 自动化处理
- ✅ 自动创建域（首次使用时）
- ✅ 自动派生SubjectFunding账户
- ✅ 自动执行三层扣费（IpfsPool → SubjectFunding → GracePeriod）
- ✅ 自动分配副本到运营者
- ✅ 自动健康巡检和修复

### 3. 零IPFS知识要求
业务pallet开发者**无需了解**：
- SubjectType如何派生
- SubjectFunding账户如何计算
- 扣费机制如何工作
- 副本如何分配
- 健康检查如何运行

## 🚀 快速开始

### 步骤1：在业务pallet的Config中添加ContentRegistry

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    
    // ⭐ 添加这一行 ⭐
    type ContentRegistry: ContentRegistry;
}
```

### 步骤2：在extrinsic中使用

```rust
#[pallet::call_index(0)]
#[pallet::weight(100_000)]
pub fn upload_video(
    origin: OriginFor<T>,
    cid: Vec<u8>,
    tier: PinTier,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // ⭐ 一行代码完成内容注册和PIN ⭐
    T::ContentRegistry::register_content(
        b"my-pallet-domain".to_vec(),  // 你的域名
        subject_id,                    // 主体ID
        cid,                           // IPFS CID
        tier,                          // Pin等级
    )?;
    
    // 继续你的业务逻辑...
    Ok(())
}
```

### 步骤3：在runtime中配置

```rust
impl pallet_example_domain_pin::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    // ⭐ 绑定到PalletMemoIpfs ⭐
    type ContentRegistry = PalletMemoIpfs;
}
```

## 📊 完整示例：视频上传Pallet

见 `src/lib.rs`，包含：
- ✅ 视频信息存储
- ✅ 上传视频（自动PIN）
- ✅ 删除视频
- ✅ 完整的事件和错误处理

## 🎯 使用场景

### 1. 逝者视频pallet
```rust
T::ContentRegistry::register_content(
    b"deceased-video".to_vec(),
    deceased_id,
    video_cid,
    PinTier::Critical,  // 重要内容，5副本
)?;
```

### 2. NFT元数据pallet
```rust
T::ContentRegistry::register_content(
    b"nft-metadata".to_vec(),
    nft_id,
    metadata_cid,
    PinTier::Standard,  // 标准，3副本
)?;
```

### 3. 临时文件pallet
```rust
T::ContentRegistry::register_content(
    b"temp-file".to_vec(),
    file_id,
    file_cid,
    PinTier::Temporary,  // 临时，1副本
)?;
```

### 4. 证据存证pallet
```rust
T::ContentRegistry::register_content(
    b"legal-evidence".to_vec(),
    evidence_id,
    evidence_cid,
    PinTier::Critical,  // 证据，最高级别
)?;
```

## 🔧 Pin等级说明

| 等级 | 副本数 | 巡检间隔 | 费率系数 | 适用场景 |
|------|--------|----------|----------|----------|
| **Critical** | 5 | 6小时 | 1.5x | 逝者档案、法律证据 |
| **Standard** | 3 | 24小时 | 1.0x | 常规内容、NFT |
| **Temporary** | 1 | 7天 | 0.5x | 临时文件、缓存 |

## 📝 域命名建议

建议域名格式：`{pallet-name}-{content-type}`

示例：
- ✅ `deceased-video` - 逝者视频
- ✅ `deceased-photo` - 逝者照片
- ✅ `grave-cover` - 墓位封面
- ✅ `offerings-media` - 供奉品媒体
- ✅ `nft-metadata` - NFT元数据
- ✅ `doc-archive` - 文档归档

## 🎨 与旧方案对比

### 旧方案（IpfsPinner trait）
```rust
// 需要了解deceased_id、tier等概念
T::IpfsPinner::pin_cid_for_deceased(
    caller,
    deceased_id,
    cid,
    Some(PinTier::Standard),
)?;
```

- ❌ 仅支持Deceased和Grave两个域
- ❌ 需要了解deceased_id的含义
- ❌ 扩展新域需要修改memo-ipfs

### 新方案（ContentRegistry trait）
```rust
// 任意域名，自动创建，一行搞定
T::ContentRegistry::register_content(
    b"my-domain".to_vec(),
    subject_id,
    cid,
    tier,
)?;
```

- ✅ 支持任意自定义域
- ✅ 自动化处理，无需了解内部细节
- ✅ 新业务pallet无需修改memo-ipfs

## 🔍 域管理（治理）

### 预注册域（可选）
```rust
// 治理可以预先注册域，设置默认配置
api.tx.memoIpfs.registerDomain(
    "my-pallet-domain",
    99,  // 自定义SubjectType ID
    { Standard: null },  // 默认Pin等级
    true,  // 启用自动PIN
);
```

### 更新域配置
```rust
// 治理可以修改域配置
api.tx.memoIpfs.updateDomainConfig(
    "my-pallet-domain",
    false,  // 禁用自动PIN
    { Critical: null },  // 修改默认等级
    null,  // SubjectType ID不变
);
```

### 查询域信息
```rust
// 检查域是否已注册
let is_registered = pallet_memo_ipfs::ContentRegistry::is_domain_registered(b"my-domain");

// 获取域的SubjectType
let subject_type = pallet_memo_ipfs::ContentRegistry::get_domain_subject_type(b"my-domain");
```

## 🧪 测试示例

```rust
#[test]
fn upload_video_works() {
    new_test_ext().execute_with(|| {
        // 上传视频
        assert_ok!(ExampleDomainPin::upload_video(
            RuntimeOrigin::signed(ALICE),
            b"My Video".to_vec(),
            b"QmXxx...".to_vec(),
            PinTier::Standard,
        ));
        
        // 检查事件
        System::assert_has_event(
            Event::VideoUploadedAndPinned {
                video_id: 0,
                owner: ALICE,
                cid: bounded_vec![b"QmXxx..."],
                tier: PinTier::Standard,
            }.into()
        );
    });
}
```

## 📚 更多信息

- 详细设计文档：`/docs/memo-ipfs三需求分析报告.md`
- memo-ipfs README：`/pallets/memo-ipfs/README.md`
- ContentRegistry trait定义：`/pallets/memo-ipfs/src/lib.rs` (line 180-241)

## 🤝 技术支持

如有疑问，请查看：
1. 本示例pallet源代码
2. memo-ipfs pallet文档
3. 需求分析报告

---

**一行代码，自动PIN，专注业务逻辑！** 🚀

