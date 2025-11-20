# Pallet辅助解密用户加密信息 - 实施方案

## 一、核心原理

### ❌ 错误理解：Pallet直接解密
```rust
// ⚠️ 这是不可能的！链上存储的所有数据都是公开的
#[pallet::storage]
pub type PrivateKey = StorageValue<_, Vec<u8>, ValueQuery>;

pub fn decrypt_data(encrypted: Vec<u8>) -> Vec<u8> {
    let key = PrivateKey::get(); // ❌ 任何人都能读取！
    aes_decrypt(encrypted, key)  // ❌ 加密失去意义
}
```

### ✅ 正确方案：Pallet辅助解密流程

```
┌─────────────────────────────────────────────────────┐
│                  用户A（数据拥有者）                    │
│                                                      │
│  1. 生成随机AES密钥                                   │
│  2. 用AES密钥加密数据                                 │
│  3. 用用户B的公钥加密AES密钥                          │
│  4. 上传加密数据到IPFS → CID                         │
│  5. 调用链上接口记录元数据                            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│               Pallet（链上记录层）                     │
│                                                      │
│  ✅ 记录：CID、授权用户列表                           │
│  ✅ 记录：每个授权用户的加密密钥包                     │
│  ✅ 验证：检查用户是否有权限访问                      │
│  ✅ 审计：记录谁在何时访问了数据                      │
│  ❌ 不做：不存储任何私钥，不执行解密操作               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│               用户B（授权访问者）                      │
│                                                      │
│  1. 调用链上接口检查权限                              │
│  2. 获取自己的加密密钥包                              │
│  3. 用自己的私钥解密得到AES密钥                       │
│  4. 从IPFS下载加密数据                               │
│  5. 用AES密钥解密数据                                │
└─────────────────────────────────────────────────────┘
```

**关键点：**
- ✅ **加密/解密操作：在链下完成（前端/客户端）**
- ✅ **Pallet职责：权限管理 + 元数据存储 + 审计日志**
- ✅ **私钥管理：用户本地保管（钱包/浏览器）**

---

## 二、基于 Evidence Pallet 的实现

您的项目中已经实现了这个方案！位置：`pallets/evidence/src/`

### 2.1 核心数据结构

#### ① 私密内容存储（PrivateContent）

```rust
/// 位置：pallets/evidence/src/private_content.rs
pub struct PrivateContent<T: Config> {
    /// 内容ID
    pub id: u64,
    
    /// IPFS CID（加密数据的位置）
    pub cid: BoundedVec<u8, T::MaxCidLen>,
    
    /// 原始内容的哈希（用于验证完整性）
    pub content_hash: H256,
    
    /// 加密方法标识（1=AES-256-GCM, 2=ChaCha20-Poly1305）
    pub encryption_method: u8,
    
    /// 创建者
    pub creator: AccountId,
    
    /// 访问控制策略
    pub access_policy: AccessPolicy<T>,
    
    /// 🔑 关键：每个授权用户的加密密钥包
    /// - 存储的是"用户B公钥加密的AES密钥"
    /// - 用户B用自己的私钥解密后，才能得到AES密钥
    pub encrypted_keys: BoundedVec<(AccountId, Vec<u8>), MaxUsers>,
    
    /// 创建和更新时间
    pub created_at: BlockNumber,
    pub updated_at: BlockNumber,
}
```

#### ② 访问控制策略（AccessPolicy）

```rust
pub enum AccessPolicy<T: Config> {
    /// 仅创建者可访问
    OwnerOnly,
    
    /// 指定用户列表（做市商申请资料 → 委员会成员）
    SharedWith(BoundedVec<AccountId, MaxUsers>),
    
    /// 家庭成员（关联逝者ID）
    FamilyMembers(u64),
    
    /// 定时访问（到期后自动撤销）
    TimeboxedAccess {
        users: BoundedVec<AccountId, MaxUsers>,
        expires_at: BlockNumber,
    },
    
    /// 治理控制（仲裁委员会查看OTC争议证据）
    GovernanceControlled,
    
    /// 基于角色的访问
    RoleBased(BoundedVec<u8, ConstU32<32>>),
}
```

#### ③ 用户公钥注册（UserPublicKey）

```rust
pub struct UserPublicKey<T: Config> {
    /// 公钥数据（DER格式）
    /// - 用户在链上注册自己的公钥
    /// - 其他用户用此公钥加密密钥包
    pub key_data: BoundedVec<u8, MaxKeyLen>,
    
    /// 密钥类型（1=RSA-2048, 2=Ed25519, 3=ECDSA-P256）
    pub key_type: u8,
    
    /// 注册时间
    pub registered_at: BlockNumber,
}
```

---

### 2.2 核心交易接口

#### ① 注册公钥（所有用户必须先注册）

```rust
/// 位置：pallets/evidence/src/lib.rs:676
#[pallet::call_index(6)]
pub fn register_public_key(
    origin: OriginFor<T>,
    key_data: BoundedVec<u8, T::MaxKeyLen>,  // 用户的公钥
    key_type: u8,                             // 密钥类型
) -> DispatchResult
```

**前端调用示例：**
```typescript
// 1. 用户生成密钥对（或从钱包导出）
const keyPair = await generateRSAKeyPair();

// 2. 注册公钥到链上
await api.tx.evidence.registerPublicKey(
  keyPair.publicKey,  // DER格式
  1                   // RSA-2048
).signAndSend(account);

console.log('✅ 公钥已注册，其他用户可以加密内容给我');
```

---

#### ② 存储私密内容（加密数据拥有者调用）

```rust
/// 位置：pallets/evidence/src/lib.rs:724
#[pallet::call_index(7)]
pub fn store_private_content(
    origin: OriginFor<T>,
    ns: [u8; 8],                              // 命名空间（如 "mm_apply"）
    subject_id: u64,                          // 业务ID（如做市商ID）
    cid: BoundedVec<u8, T::MaxCidLen>,        // IPFS CID
    content_hash: H256,                       // 原始内容哈希
    encryption_method: u8,                    // 加密方法
    access_policy: AccessPolicy<T>,           // 访问策略
    encrypted_keys: Vec<(AccountId, Vec<u8>)>, // 🔑 每个授权用户的加密密钥包
) -> DispatchResult
```

**前端调用示例（做市商提交敏感资料）：**
```typescript
// 1. 获取所有委员会成员
const committeeMembers = await api.query.collective.members(3); // Instance3

// 2. 获取每个成员的公钥
const publicKeys = new Map();
for (const member of committeeMembers) {
  const pubKey = await api.query.evidence.userPublicKeys(member);
  if (pubKey.isSome) {
    publicKeys.set(member.toString(), pubKey.unwrap().keyData);
  }
}

// 3. 准备敏感数据
const privateData = {
  full_name: '张三',
  id_card: '110101199001011234',
  bank_account: '6214850123456789',
  // ...
};

// 4. 生成随机AES密钥
const aesKey = crypto.randomBytes(32);

// 5. 用AES密钥加密数据
const encryptedData = aesEncrypt(JSON.stringify(privateData), aesKey);

// 6. 计算哈希
const contentHash = sha256(JSON.stringify(privateData));

// 7. 为每个委员会成员加密AES密钥
const encryptedKeys = [];
for (const [accountId, publicKey] of publicKeys) {
  const encryptedAesKey = rsaEncrypt(aesKey, publicKey);
  encryptedKeys.push([accountId, encryptedAesKey]);
}

// 8. 上传加密数据到IPFS
const ipfsResult = await ipfs.add(encryptedData);
const cid = ipfsResult.path;

// 9. 调用链上接口存储元数据
await api.tx.evidence.storePrivateContent(
  stringToU8a('mm_apply'), // 命名空间
  mmId,                    // 做市商ID
  cid,                     // IPFS CID
  contentHash,             // 哈希
  1,                       // AES-256-GCM
  {
    SharedWith: committeeMembers // 访问策略：仅委员会可见
  },
  encryptedKeys            // 加密的密钥包
).signAndSend(account);

console.log('✅ 敏感资料已加密存储，只有委员会成员可以解密');
```

---

#### ③ 授予访问权限（动态添加授权用户）

```rust
/// 位置：pallets/evidence/src/lib.rs:811
#[pallet::call_index(8)]
pub fn grant_access(
    origin: OriginFor<T>,
    content_id: u64,                          // 内容ID
    user: T::AccountId,                       // 新授权用户
    encrypted_key: BoundedVec<u8, MaxKeyLen>, // 用新用户公钥加密的AES密钥
) -> DispatchResult
```

**使用场景：新增委员会成员**
```typescript
// 委员会新增成员后，重新授权历史资料访问权限

// 1. 现有委员会成员解密AES密钥
const myEncryptedKey = await getMyEncryptedKey(contentId);
const aesKey = rsaDecrypt(myEncryptedKey, myPrivateKey);

// 2. 获取新成员的公钥
const newMemberPubKey = await api.query.evidence.userPublicKeys(newMember);

// 3. 用新成员公钥加密AES密钥
const newEncryptedKey = rsaEncrypt(aesKey, newMemberPubKey.keyData);

// 4. 调用链上接口授权
await api.tx.evidence.grantAccess(
  contentId,
  newMember,
  newEncryptedKey
).signAndSend(account);

console.log('✅ 新委员会成员已获得访问权限');
```

---

#### ④ 撤销访问权限

```rust
/// 位置：pallets/evidence/src/lib.rs:868
#[pallet::call_index(9)]
pub fn revoke_access(
    origin: OriginFor<T>,
    content_id: u64,
    user: T::AccountId,
) -> DispatchResult
```

---

#### ⑤ 密钥轮换（定期更换AES密钥）

```rust
/// 位置：pallets/evidence/src/lib.rs:903
#[pallet::call_index(10)]
pub fn rotate_content_keys(
    origin: OriginFor<T>,
    content_id: u64,
    new_cid: BoundedVec<u8, T::MaxCidLen>,
    new_content_hash: H256,
    new_encrypted_keys: Vec<(AccountId, Vec<u8>)>,
) -> DispatchResult
```

---

### 2.3 完整解密流程（委员会成员查看敏感资料）

```typescript
/**
 * 委员会成员查看做市商敏感资料
 */
async function viewMarketMakerPrivateInfo(mmId: number) {
  // ===== 第1步：权限检查（链上） =====
  const content = await api.query.evidence.privateContentBySubject(
    stringToU8a('mm_apply'),
    mmId
  );
  
  if (content.isNone) {
    throw new Error('未找到私密内容');
  }
  
  const contentId = content.unwrap();
  const privateContent = await api.query.evidence.privateContents(contentId);
  
  // 检查当前用户是否有权限
  const myAccount = currentAccount.address;
  const hasAccess = await checkAccess(privateContent.accessPolicy, myAccount);
  
  if (!hasAccess) {
    throw new Error('您无权查看此内容');
  }
  
  // ===== 第2步：获取加密密钥包（链上） =====
  const myEncryptedKey = privateContent.encryptedKeys.find(
    ([user, _]) => user.toString() === myAccount
  );
  
  if (!myEncryptedKey) {
    throw new Error('未找到您的密钥包');
  }
  
  // ===== 第3步：解密AES密钥（链下） =====
  // 从钱包获取私钥（需要用户授权）
  const myPrivateKey = await getPrivateKeyFromWallet(myAccount);
  
  // 用私钥解密AES密钥
  const encryptedAesKey = myEncryptedKey[1];
  const aesKey = rsaDecrypt(encryptedAesKey, myPrivateKey);
  
  console.log('✅ AES密钥解密成功');
  
  // ===== 第4步：下载加密数据（IPFS） =====
  const cid = privateContent.cid.toString();
  const encryptedData = await downloadFromIPFS(cid);
  
  // ===== 第5步：解密数据（链下） =====
  const decryptedData = aesDecrypt(encryptedData, aesKey);
  const privateInfo = JSON.parse(decryptedData);
  
  console.log('✅ 解密成功：', privateInfo);
  /*
  {
    full_name: '张三',
    id_card: '110101199001011234',
    bank_account: '6214850123456789',
    phone: '13800138000',
    address: '北京市朝阳区...'
  }
  */
  
  // ===== 第6步（可选）：记录访问日志（链上） =====
  await api.tx.evidence.logAccess(
    contentId,
    'review_application'  // 访问目的
  ).signAndSend(currentAccount);
  
  return privateInfo;
}
```

---

## 三、应用场景

### 场景1：做市商申请资料审核 ✅

```rust
// 命名空间：mm_apply
// 业务ID：做市商ID
// 授权用户：ContentCommittee (Instance3)

访问策略：SharedWith(committee_members)
```

**流程：**
1. 做市商提交申请时加密敏感信息
2. 委员会成员审核时解密查看
3. 批准后资料继续保密存储
4. 如有争议可追溯访问日志

---

### 场景2：OTC订单争议仲裁 ✅

```rust
// 命名空间：otc_disp
// 业务ID：订单ID
// 授权用户：ArbitrationCommittee (Instance4)

访问策略：GovernanceControlled
```

**流程：**
1. 买家提交聊天记录作为证据
2. 原始聊天是端到端加密的
3. 买家解密后重新加密给仲裁委员会
4. 仲裁委员会查看证据做出裁决

---

### 场景3：家族遗产管理 ✅

```rust
// 命名空间：memorial
// 业务ID：逝者ID
// 授权用户：家族成员列表

访问策略：FamilyMembers(deceased_id)
```

**流程：**
1. 逝者生前加密遗产信息
2. 指定家族成员可访问
3. 家族成员验证身份后解密
4. 支持定时解锁（如去世1年后）

---

### 场景4：委员会机密文档 ✅

```rust
// 命名空间：gov_doc
// 业务ID：文档ID
// 授权用户：Root + 委员会主席

访问策略：TimeboxedAccess
```

**流程：**
1. Root上传机密文档
2. 设置访问期限（如7天）
3. 授权委员会主席查看
4. 7天后自动撤销权限

---

## 四、安全性分析

### ✅ 优势

#### 1. **端到端加密**
- 数据在客户端加密
- 链上只存储元数据和加密密钥包
- IPFS只存储加密数据
- 只有授权用户的私钥可以解密

#### 2. **零信任架构**
- Pallet不持有任何私钥
- 节点无法解密任何数据
- 即使链被攻击，数据仍然安全

#### 3. **灵活的访问控制**
- 支持多种访问策略
- 动态授权/撤销
- 定时过期
- 基于角色的访问

#### 4. **完整的审计日志**
- 记录谁在何时访问
- 记录访问目的
- 密钥轮换历史
- 权限变更历史

---

### ⚠️ 潜在风险与解决方案

#### 风险1：用户丢失私钥

**问题：**用户丢失私钥后无法解密数据

**解决方案：**
```rust
// 实现密钥恢复机制
pub enum KeyRecoveryPolicy {
    /// 社交恢复：N个朋友中K个同意可恢复
    SocialRecovery {
        guardians: Vec<AccountId>,
        threshold: u32,
    },
    
    /// 助记词恢复
    MnemonicRecovery,
    
    /// 硬件密钥恢复
    HardwareKeyBackup,
}
```

---

#### 风险2：授权用户作恶泄露数据

**问题：**委员会成员解密后可以复制数据

**解决方案：**
```rust
// 1. 链上审计日志（威慑）
pub fn log_access(content_id: u64, purpose: Vec<u8>)

// 2. 水印技术（追踪）
// 每个用户解密的数据嵌入隐形水印
fn add_watermark(data: Vec<u8>, user: AccountId) -> Vec<u8>

// 3. 时限访问（减少风险窗口）
AccessPolicy::TimeboxedAccess {
    users: vec![committee_member],
    expires_at: now + 7_days,
}

// 4. 经济惩罚（ slashing）
// 如发现泄露，扣除抵押金
```

---

#### 风险3：委员会成员变更

**问题：**新成员无法访问历史资料，离职成员仍可访问

**解决方案：**
```typescript
// 方案A：重新授权历史资料（推荐）
async function reauthorizeHistoricalContent(
  namespace: string,
  newMembers: AccountId[]
) {
  // 1. 获取该命名空间的所有内容
  const contents = await api.query.evidence.privateContentBySubject.entries(
    namespace
  );
  
  // 2. 对每个内容，授权给新成员
  for (const [_, contentId] of contents) {
    // 现有成员解密AES密钥
    const aesKey = await decryptAesKey(contentId);
    
    // 为新成员加密
    for (const newMember of newMembers) {
      const pubKey = await api.query.evidence.userPublicKeys(newMember);
      const encryptedKey = rsaEncrypt(aesKey, pubKey.keyData);
      
      await api.tx.evidence.grantAccess(
        contentId,
        newMember,
        encryptedKey
      ).signAndSend(currentAccount);
    }
  }
}

// 方案B：门限加密（未来扩展）
// 5个委员会成员，任意3个可以恢复密钥
// 即使有2个成员离职，仍可正常解密
```

---

## 五、与其他方案对比

### 对比表

| 方案 | 链上存储 | 解密位置 | 私钥管理 | 安全性 | 可行性 |
|------|---------|---------|---------|-------|-------|
| **Pallet直接解密** | ❌ 私钥上链 | ❌ 链上解密 | ❌ 公开 | 🔴 极差 | ❌ 不可行 |
| **Pallet辅助解密（当前方案）** | ✅ 元数据 + 加密密钥包 | ✅ 客户端 | ✅ 用户本地 | 🟢 优秀 | ✅ 已实现 |
| **门限加密** | ✅ 密钥分片 | ✅ 客户端（需K个分片） | ✅ 分布式 | 🟢 极优 | ⚠️ 实现复杂 |
| **零知识证明** | ✅ 证明 + 密文 | ✅ 客户端 | ✅ 用户本地 | 🟢 优秀 | ⚠️ 性能差 |

---

## 六、前端集成指南

### 6.1 安装依赖

```bash
npm install @polkadot/api @polkadot/util-crypto tweetnacl ipfs-http-client
```

---

### 6.2 工具类封装

```typescript
// src/utils/privateContentManager.ts

import { ApiPromise } from '@polkadot/api';
import { stringToU8a, u8aToHex } from '@polkadot/util';
import nacl from 'tweetnacl';
import { create as ipfsHttpClient } from 'ipfs-http-client';

export class PrivateContentManager {
  constructor(
    private api: ApiPromise,
    private ipfs: any
  ) {}
  
  /**
   * 加密并存储私密内容
   */
  async storePrivateContent(
    namespace: string,
    subjectId: number,
    data: any,
    authorizedUsers: string[]
  ): Promise<number> {
    // 1. 生成AES密钥
    const aesKey = nacl.randomBytes(32);
    
    // 2. 加密数据
    const nonce = nacl.randomBytes(24);
    const dataStr = JSON.stringify(data);
    const dataBytes = new TextEncoder().encode(dataStr);
    const encryptedData = nacl.secretbox(dataBytes, nonce, aesKey);
    
    // 3. 计算哈希
    const hash = await this.api.rpc.system.blake2256(dataBytes);
    
    // 4. 上传到IPFS
    const ipfsData = {
      version: '1.0',
      nonce: u8aToHex(nonce),
      encrypted_content: u8aToHex(encryptedData),
    };
    const result = await this.ipfs.add(JSON.stringify(ipfsData));
    const cid = result.path;
    
    // 5. 为每个授权用户加密AES密钥
    const encryptedKeys = [];
    for (const user of authorizedUsers) {
      const pubKey = await this.api.query.evidence.userPublicKeys(user);
      if (pubKey.isSome) {
        const userPubKey = pubKey.unwrap().keyData;
        const encryptedAesKey = this.encryptWithPublicKey(aesKey, userPubKey);
        encryptedKeys.push([user, encryptedAesKey]);
      }
    }
    
    // 6. 调用链上接口
    const tx = await this.api.tx.evidence.storePrivateContent(
      stringToU8a(namespace).slice(0, 8),
      subjectId,
      cid,
      hash,
      1, // AES-256-GCM
      { SharedWith: authorizedUsers },
      encryptedKeys
    ).signAndSend(this.currentAccount);
    
    return tx.contentId; // 返回内容ID
  }
  
  /**
   * 解密私密内容
   */
  async decryptPrivateContent(
    namespace: string,
    subjectId: number,
    myPrivateKey: Uint8Array
  ): Promise<any> {
    // 1. 查询链上元数据
    const content = await this.api.query.evidence.privateContentBySubject(
      stringToU8a(namespace).slice(0, 8),
      subjectId
    );
    
    if (content.isNone) {
      throw new Error('内容不存在');
    }
    
    const contentId = content.unwrap();
    const privateContent = await this.api.query.evidence.privateContents(contentId);
    
    // 2. 获取我的加密密钥包
    const myAccount = this.currentAccount.address;
    const myEncryptedKey = privateContent.encryptedKeys.find(
      ([user, _]) => user.toString() === myAccount
    );
    
    if (!myEncryptedKey) {
      throw new Error('无访问权限');
    }
    
    // 3. 解密AES密钥
    const aesKey = this.decryptWithPrivateKey(
      myEncryptedKey[1],
      myPrivateKey
    );
    
    // 4. 从IPFS下载加密数据
    const cid = privateContent.cid.toString();
    const chunks = [];
    for await (const chunk of this.ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    const ipfsData = JSON.parse(Buffer.concat(chunks).toString());
    
    // 5. 解密数据
    const nonce = hexToU8a(ipfsData.nonce);
    const encryptedContent = hexToU8a(ipfsData.encrypted_content);
    const decryptedBytes = nacl.secretbox.open(encryptedContent, nonce, aesKey);
    
    if (!decryptedBytes) {
      throw new Error('解密失败');
    }
    
    const decryptedStr = new TextDecoder().decode(decryptedBytes);
    return JSON.parse(decryptedStr);
  }
  
  // 辅助方法
  private encryptWithPublicKey(data: Uint8Array, publicKey: Uint8Array): Uint8Array {
    const ephemeralKeyPair = nacl.box.keyPair();
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box(data, nonce, publicKey, ephemeralKeyPair.secretKey);
    // 返回：nonce + ephemeralPublicKey + encrypted
    return this.combineArrays([nonce, ephemeralKeyPair.publicKey, encrypted]);
  }
  
  private decryptWithPrivateKey(encrypted: Uint8Array, privateKey: Uint8Array): Uint8Array {
    // 解析：nonce + ephemeralPublicKey + encrypted
    const nonce = encrypted.slice(0, 24);
    const ephemeralPublicKey = encrypted.slice(24, 56);
    const ciphertext = encrypted.slice(56);
    
    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPublicKey, privateKey);
    if (!decrypted) {
      throw new Error('解密失败');
    }
    return decrypted;
  }
  
  private combineArrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}
```

---

### 6.3 React组件示例

```typescript
// src/components/ViewPrivateInfo.tsx

import React, { useState } from 'react';
import { Button, Spin, Descriptions } from 'antd';
import { PrivateContentManager } from '@/utils/privateContentManager';

export const ViewPrivateInfo: React.FC<{ mmId: number }> = ({ mmId }) => {
  const [loading, setLoading] = useState(false);
  const [privateInfo, setPrivateInfo] = useState<any>(null);
  
  const handleViewInfo = async () => {
    setLoading(true);
    try {
      const manager = new PrivateContentManager(api, ipfs);
      
      // 从钱包获取私钥（需要用户授权）
      const privateKey = await getPrivateKeyFromWallet();
      
      // 解密
      const info = await manager.decryptPrivateContent(
        'mm_apply',
        mmId,
        privateKey
      );
      
      setPrivateInfo(info);
      
      // 记录访问日志
      await api.tx.evidence.logAccess(
        contentId,
        'review_application'
      ).signAndSend(currentAccount);
      
    } catch (error) {
      console.error('解密失败：', error);
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <Button 
        type="primary" 
        onClick={handleViewInfo}
        loading={loading}
      >
        查看敏感资料（需授权）
      </Button>
      
      {privateInfo && (
        <Descriptions title="做市商敏感信息" bordered column={1}>
          <Descriptions.Item label="姓名">
            {privateInfo.full_name}
          </Descriptions.Item>
          <Descriptions.Item label="身份证号">
            {privateInfo.id_card}
          </Descriptions.Item>
          <Descriptions.Item label="银行账号">
            {privateInfo.bank_account}
          </Descriptions.Item>
          <Descriptions.Item label="联系电话">
            {privateInfo.phone}
          </Descriptions.Item>
          <Descriptions.Item label="地址">
            {privateInfo.address}
          </Descriptions.Item>
        </Descriptions>
      )}
    </div>
  );
};
```

---

## 七、总结

### ✅ 可行性结论

**问题：是否可以实现，用pallet解密用户加密信息？**

**答案：✅ 可以，但不是"Pallet直接解密"，而是"Pallet辅助解密流程"**

### 核心原则

1. ✅ **加密/解密在链下（客户端）完成**
2. ✅ **Pallet负责权限管理和审计**
3. ✅ **私钥由用户本地保管**
4. ✅ **链上只存储元数据和加密密钥包**

### 您的项目现状

- ✅ **Evidence Pallet已完整实现此方案**
- ✅ **支持多种访问控制策略**
- ✅ **支持动态授权/撤销**
- ✅ **支持密钥轮换**
- ✅ **支持访问审计日志**

### 建议下一步

1. **在市场做市商模块中集成**：做市商申请资料使用 Evidence Pallet 存储
2. **在仲裁模块中集成**：OTC争议证据使用 Evidence Pallet 管理
3. **开发前端组件**：封装加密/解密工具类，提供用户友好的界面
4. **编写使用文档**：为委员会成员提供操作指南

---

**编写日期**：2025-10-23  
**版本**：v1.0  
**状态**：实施方案  
**基于**：pallets/evidence/src/lib.rs (已实现)

