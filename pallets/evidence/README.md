# Pallet Evidence - 证据管理系统

## 📋 模块概述

`pallet-evidence` 是Stardust生态的**证据基础设施模块**，提供跨域证据管理功能，支持图片、视频、文档等多媒体证据的链上元数据存储、IPFS内容存储、私有内容加密、访问控制和自动Pin功能。为仲裁、争议、审计等场景提供可信证据支持。

### 设计理念

- **跨域复用**：同一证据可被多个业务域引用
- **公私混合**：支持公开证据和私有加密证据
- **链上+链下**：元数据上链，内容存IPFS
- **访问控制**：细粒度的证据访问权限管理
- **自动Pin**：所有证据CID自动固定到IPFS

## 🏗️ 架构设计

```text
┌───────────────────────────────────────┐
│        用户/业务系统                   │
│  - OTC争议证据                        │
│  - Bridge转账凭证                     │
│  - 审核材料                           │
└────────────┬──────────────────────────┘
             ↓
┌───────────────────────────────────────┐
│     Evidence Pallet (证据层)          │
│  - commit()          提交公开证据      │
│  - commit_private()  提交私有证据      │
│  - authorize_access()  授权访问        │
│  - rotate_key()      密钥轮换         │
└────────────┬──────────────────────────┘
             ↓
┌───────────────────────────────────────┐
│     IPFS Storage (内容存储)           │
│  - 公开内容：直接存储                  │
│  - 私有内容：端到端加密后存储          │
│  - 自动Pin所有CID                     │
└───────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 公开证据提交

#### commit - 提交公开证据
```rust
pub fn commit(
    origin: OriginFor<T>,
    domain: [u8; 8],
    target_id: u64,
    imgs: Vec<Vec<u8>>,
    vids: Vec<Vec<u8>>,
    docs: Vec<Vec<u8>>,
    memo: Vec<u8>,
) -> DispatchResult
```

**参数说明**：
- `domain`: 业务域标识（命名空间，例如`b"otc_order"`）
- `target_id`: 业务对象ID（订单ID、桥接ID等）
- `imgs`: 图片CID列表
- `vids`: 视频CID列表
- `docs`: 文档CID列表
- `memo`: 备注信息

**功能**：
- 生成唯一的`evidence_id`
- 存储证据元数据到链上
- 自动Pin所有CID到IPFS（imgs + vids + docs）
- 建立索引：按域、按目标、按owner

**使用场景**：
- OTC争议：买家/卖家提交转账截图
- Bridge争议：做市商提交链上交易hash
- 审核材料：用户提交身份证明

### 2. 私有证据提交

#### commit_private - 提交私有加密证据
```rust
pub fn commit_private(
    origin: OriginFor<T>,
    ns: [u8; 8],
    subject_id: u64,
    cid_encrypted: Vec<u8>,
    commit_hash: H256,
    key_bundles: Vec<EncryptedKeyBundle>,
) -> DispatchResult
```

**参数说明**：
- `ns`: 命名空间（业务域）
- `subject_id`: 主体ID（业务对象ID）
- `cid_encrypted`: 加密后的内容CID
- `commit_hash`: 承诺哈希（防止篡改）
- `key_bundles`: 加密的密钥束（为不同用户加密）

**承诺哈希计算**：
```rust
commit_hash = H256(
    ns || subject_id || cid_encrypted || salt || version
)
```

**加密流程**：
```text
1. 前端生成对称密钥 AES_KEY
2. 使用 AES_KEY 加密证据内容
3. 上传加密内容到IPFS → 获得 cid_encrypted
4. 为每个授权用户用其公钥加密 AES_KEY
   → EncryptedKeyBundle = RSA_Encrypt(user_pubkey, AES_KEY)
5. 调用 commit_private(ns, subject_id, cid_encrypted, commit_hash, key_bundles)
```

**解密流程**：
```text
1. 查询 PrivateContent[content_id]
2. 检查调用者是否在 authorized_users
3. 找到对应的 key_bundle
4. 使用私钥解密 AES_KEY = RSA_Decrypt(my_privkey, key_bundle)
5. 下载 cid_encrypted 内容
6. 使用 AES_KEY 解密内容
```

**使用场景**：
- 敏感身份信息（身份证、护照）
- 财务记录（银行流水）
- 内部审计材料

### 3. 访问控制

#### authorize_access - 授权访问私有证据
```rust
pub fn authorize_access(
    origin: OriginFor<T>,
    content_id: u64,
    user: T::AccountId,
    key_bundle: EncryptedKeyBundle,
) -> DispatchResult
```

**功能**：
- 证据创建者可授权新用户访问
- 为新用户添加加密的密钥束
- 新用户可解密并查看证据

#### revoke_access - 撤销访问权限
```rust
pub fn revoke_access(
    origin: OriginFor<T>,
    content_id: u64,
    user: T::AccountId,
) -> DispatchResult
```

**功能**：
- 证据创建者可撤销用户访问权限
- 移除用户的密钥束
- 用户无法再解密证据

### 4. 密钥轮换

#### rotate_key - 密钥轮换
```rust
pub fn rotate_key(
    origin: OriginFor<T>,
    content_id: u64,
    new_cid_encrypted: Vec<u8>,
    new_key_bundles: Vec<(T::AccountId, EncryptedKeyBundle)>,
) -> DispatchResult
```

**功能**：
- 更换加密密钥（提升安全性）
- 重新加密内容并上传新CID
- 为所有授权用户生成新密钥束
- 递增轮换轮次

**使用场景**：
- 定期安全轮换
- 密钥泄露后应急更换
- 撤销大量用户后重新加密

### 5. 用户公钥管理

#### register_public_key - 注册公钥
```rust
pub fn register_public_key(
    origin: OriginFor<T>,
    public_key: Vec<u8>,
) -> DispatchResult
```

**功能**：
- 用户注册自己的RSA公钥
- 用于接收加密的密钥束
- 每个用户只能注册一次（可更新）

### 6. 限频保护

**限频机制**：
- 每个用户在窗口内（例如100块）最多提交N次证据
- 防止滥用和垃圾数据
- 可配置窗口大小和次数上限

## 📦 存储结构

### 公开证据
```rust
pub type Evidences<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // evidence_id
    Evidence<T>,
    OptionQuery,
>;
```

**Evidence结构**：
```rust
pub struct Evidence<T: Config> {
    pub id: u64,
    pub domain: u8,                          // 业务域
    pub target_id: u64,                      // 业务对象ID
    pub owner: T::AccountId,                 // 证据提交者
    pub imgs: BoundedVec<Vec<u8>, T::MaxImg>, // 图片CID列表
    pub vids: BoundedVec<Vec<u8>, T::MaxVid>, // 视频CID列表
    pub docs: BoundedVec<Vec<u8>, T::MaxDoc>, // 文档CID列表
    pub memo: Option<BoundedVec<u8, T::MaxMemoLen>>, // 备注
    pub commit: Option<H256>,                // 承诺哈希（私有证据）
    pub ns: Option<[u8; 8]>,                 // 命名空间
}
```

### 私有内容
```rust
pub type PrivateContents<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // content_id
    PrivateContent<T>,
    OptionQuery,
>;
```

**PrivateContent结构**：
```rust
pub struct PrivateContent<T: Config> {
    pub content_id: u64,
    pub ns: [u8; 8],                         // 命名空间
    pub subject_id: u64,                     // 主体ID
    pub cid_encrypted: Vec<u8>,              // 加密内容CID
    pub creator: T::AccountId,               // 创建者
    pub authorized_users: BoundedVec<T::AccountId, T::MaxAuthorizedUsers>, // 授权用户列表
    pub key_bundles: BTreeMap<T::AccountId, EncryptedKeyBundle>, // 加密密钥束
    pub current_rotation_round: u32,         // 轮换轮次
}
```

### 索引存储

#### 按目标索引
```rust
pub type EvidenceByTarget<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    (u8, u64),  // (domain, target_id)
    Blake2_128Concat,
    u64,        // evidence_id
    (),
    OptionQuery,
>;
```

#### 按命名空间索引
```rust
pub type EvidenceByNs<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    ([u8; 8], u64),  // (ns, subject_id)
    Blake2_128Concat,
    u64,             // evidence_id
    (),
    OptionQuery,
>;
```

#### 按Owner索引
```rust
pub type EvidenceByOwner<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    Blake2_128Concat,
    u64,  // evidence_id
    (),
    OptionQuery,
>;
```

### 用户公钥
```rust
pub type UserPublicKeys<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    UserPublicKey,
    OptionQuery,
>;
```

### 限频控制
```rust
pub type SubmissionRate<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    (BlockNumberFor<T>, u32),  // (window_start, count)
    ValueQuery,
>;
```

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// IPFS CID最大长度
    type MaxCidLen: Get<u32>;

    /// 单个证据最多图片数
    type MaxImg: Get<u32>;

    /// 单个证据最多视频数
    type MaxVid: Get<u32>;

    /// 单个证据最多文档数
    type MaxDoc: Get<u32>;

    /// 备注最大长度
    type MaxMemoLen: Get<u32>;

    /// 私有证据最多授权用户数
    type MaxAuthorizedUsers: Get<u32>;

    /// 密钥束最大长度
    type MaxKeyLen: Get<u32>;

    /// 证据命名空间（8字节）
    type EvidenceNsBytes: Get<[u8; 8]>;

    /// 授权检查接口
    type Authorizer: EvidenceAuthorizer<Self::AccountId>;

    /// 每个(domain, target_id)最多证据数
    type MaxPerSubjectTarget: Get<u32>;

    /// 每个(ns, subject_id)最多证据数
    type MaxPerSubjectNs: Get<u32>;

    /// 限频窗口（区块数）
    type WindowBlocks: Get<BlockNumberFor<Self>>;

    /// 窗口内最多提交次数
    type MaxPerWindow: Get<u32>;

    /// 是否启用全局CID去重
    type EnableGlobalCidDedup: Get<bool>;

    /// 查询列表最大长度
    type MaxListLen: Get<u32>;

    /// 权重信息
    type WeightInfo: WeightInfo;

    /// 家庭关系验证器（用于特定授权场景）
    type FamilyVerifier: FamilyRelationVerifier<Self::AccountId>;

    /// IPFS自动Pin提供者
    type IpfsPinner: IpfsPinner<Self::AccountId, Self::Balance>;

    /// 余额类型（用于IPFS存储费用）
    type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

    /// 默认IPFS存储单价
    type DefaultStoragePrice: Get<Self::Balance>;
}
```

## 📡 可调用接口

### 公开证据接口

#### 1. commit - 提交公开证据
```rust
#[pallet::call_index(0)]
pub fn commit(...) -> DispatchResult
```

**权限**：任意签名账户

#### 2. list_by_target - 按目标查询证据
```rust
pub fn list_by_target(
    domain: u8,
    target_id: u64,
) -> Vec<u64>
```

**功能**：查询指定业务对象关联的所有证据ID

### 私有证据接口

#### 3. commit_private - 提交私有证据
```rust
#[pallet::call_index(1)]
pub fn commit_private(...) -> DispatchResult
```

**权限**：任意签名账户

#### 4. authorize_access - 授权访问
```rust
#[pallet::call_index(2)]
pub fn authorize_access(...) -> DispatchResult
```

**权限**：证据创建者

#### 5. revoke_access - 撤销访问
```rust
#[pallet::call_index(3)]
pub fn revoke_access(...) -> DispatchResult
```

**权限**：证据创建者

#### 6. rotate_key - 密钥轮换
```rust
#[pallet::call_index(4)]
pub fn rotate_key(...) -> DispatchResult
```

**权限**：证据创建者

### 用户管理接口

#### 7. register_public_key - 注册公钥
```rust
#[pallet::call_index(5)]
pub fn register_public_key(...) -> DispatchResult
```

**权限**：任意签名账户

## 🎉 事件

### EvidenceCommitted - 公开证据提交事件
```rust
EvidenceCommitted {
    evidence_id: u64,
    owner: T::AccountId,
    domain: u8,
    target_id: u64,
}
```

### PrivateContentCreated - 私有证据创建事件
```rust
PrivateContentCreated {
    content_id: u64,
    ns: [u8; 8],
    subject_id: u64,
    creator: T::AccountId,
}
```

### AccessAuthorized - 访问授权事件
```rust
AccessAuthorized {
    content_id: u64,
    user: T::AccountId,
}
```

### AccessRevoked - 访问撤销事件
```rust
AccessRevoked {
    content_id: u64,
    user: T::AccountId,
}
```

### KeyRotated - 密钥轮换事件
```rust
KeyRotated {
    content_id: u64,
    new_round: u32,
}
```

### PublicKeyRegistered - 公钥注册事件
```rust
PublicKeyRegistered {
    user: T::AccountId,
}
```

## ❌ 错误处理

### EvidenceNotFound
- **说明**：证据不存在
- **触发**：操作不存在的evidence_id

### NoPermission
- **说明**：无权限操作
- **触发**：非创建者尝试授权/撤销/轮换

### AlreadyAuthorized
- **说明**：用户已授权
- **触发**：重复授权同一用户

### NotAuthorized
- **说明**：用户未授权
- **触发**：撤销未授权用户

### RateLimited
- **说明**：超过限频限制
- **触发**：短时间内多次提交

### TooManyEvidence
- **说明**：证据数量超限
- **触发**：同一对象关联证据过多

## 🔌 使用示例

### 场景1：OTC争议证据

```rust
// 买家提交转账截图作为公开证据
let imgs = vec![b"QmXXX...".to_vec()];  // 转账截图CID
let vids = vec![];
let docs = vec![];
let memo = b"I already transferred to seller's account".to_vec();

let evidence_id = pallet_evidence::Pallet::<T>::commit(
    origin.clone(),
    *b"otc_order",  // domain
    order_id,       // target_id
    imgs,
    vids,
    docs,
    memo,
)?;

// 发起仲裁时引用evidence_id
pallet_arbitration::Pallet::<T>::dispute_with_evidence_id(
    origin,
    *b"stardust/otc_order",
    order_id,
    evidence_id,
)?;
```

### 场景2：私有身份证明

```rust
// 1. 用户注册公钥
let pubkey = /* RSA公钥 */;
pallet_evidence::Pallet::<T>::register_public_key(
    origin.clone(),
    pubkey,
)?;

// 2. 前端加密身份证照片
let aes_key = generate_random_key();
let encrypted_content = aes_encrypt(id_card_image, aes_key);
let cid_encrypted = upload_to_ipfs(encrypted_content);

// 3. 为自己和审核员加密密钥束
let my_pubkey = get_user_pubkey(my_account);
let reviewer_pubkey = get_user_pubkey(reviewer_account);

let key_bundles = vec![
    (my_account, rsa_encrypt(my_pubkey, aes_key)),
    (reviewer_account, rsa_encrypt(reviewer_pubkey, aes_key)),
];

// 4. 计算承诺哈希
let commit_hash = blake2_256(ns || subject_id || cid_encrypted || salt || version);

// 5. 提交私有证据
let content_id = pallet_evidence::Pallet::<T>::commit_private(
    origin,
    *b"maker_review",  // ns
    maker_id,           // subject_id
    cid_encrypted,
    H256(commit_hash),
    key_bundles,
)?;

// 6. 审核员解密查看
let private_content = pallet_evidence::PrivateContents::<T>::get(content_id)?;
ensure!(private_content.authorized_users.contains(&reviewer_account));
let my_key_bundle = private_content.key_bundles.get(&reviewer_account)?;
let aes_key = rsa_decrypt(my_privkey, my_key_bundle);
let decrypted_content = aes_decrypt(cid_encrypted_content, aes_key);
```

## 🛡️ 安全机制

### 1. 访问控制

- 公开证据：所有人可查看
- 私有证据：仅授权用户可解密
- 授权/撤销：仅创建者可操作

### 2. 防篡改

- 承诺哈希锁定私有证据
- 链上存储元数据不可篡改
- IPFS内容地址可验证

### 3. 限频保护

- 窗口内提交次数限制
- 防止垃圾证据泛滥
- 可配置窗口和次数

### 4. 密钥安全

- 端到端加密（链上不存在明文密钥）
- 密钥轮换机制
- RSA+AES混合加密

### 5. IPFS持久化

- 所有证据CID自动Pin
- 确保内容长期可访问
- Pin失败仅记录日志，不阻塞

## 📝 最佳实践

### 1. 公开vs私有

- **公开证据**：转账截图、链上交易hash、公开声明
- **私有证据**：身份证、护照、银行流水、内部审计

### 2. 密钥管理

- 前端生成强随机AES密钥
- RSA密钥长度≥2048位
- 定期轮换密钥（建议每季度）

### 3. 授权策略

- 最小权限原则（仅授权必要人员）
- 及时撤销离职/无关人员
- 审计授权记录

### 4. 证据组织

- 使用命名空间分域管理
- subject_id对应业务对象
- 合理组织相关证据

### 5. 监控指标

- 证据提交率
- 限频触发频率
- 密钥轮换频率
- IPFS Pin成功率

## 🔗 相关模块

- **pallet-arbitration**: 仲裁系统（引用证据）
- **pallet-otc-order**: OTC订单（争议证据）
- **pallet-simple-bridge**: 桥接服务（转账凭证）
- **pallet-market-maker**: 做市商管理（审核材料）
- **pallet-stardust-ipfs**: IPFS管理（自动Pin）

## 📚 参考资源

- [证据管理系统设计文档](../../docs/evidence-management-design.md)
- [私有证据加密方案](../../docs/private-evidence-encryption.md)
- [访问控制策略](../../docs/evidence-access-control.md)
- [IPFS集成指南](../../docs/ipfs-integration-guide.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Stardust 开发团队
