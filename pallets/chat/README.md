# Pallet Chat - 去中心化聊天系统

## 📋 模块概述

`pallet-chat` 是Stardust生态的**通讯基础设施模块**，提供去中心化的聊天功能。采用混合架构：链上存储消息元数据（发送方、接收方、IPFS CID、时间戳等），IPFS存储加密的消息内容，前端实现端到端加密。支持私聊、会话管理、已读未读状态、消息软删除等功能。

### 设计理念

- **混合存储**：链上元数据 + IPFS内容
- **端到端加密**：前端加密，链上仅存CID
- **去中心化**：无中心化服务器
- **可审计**：链上事件可追溯

## 🏗️ 架构设计

```text
┌──────────────────────────────────────┐
│         用户A (发送方)               │
│  1. 编写消息                          │
│  2. 用接收方公钥加密                  │
│  3. 上传到IPFS → 获得CID             │
│  4. 调用send_message                 │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│     Chat Pallet (链上元数据)         │
│  - 存储 MessageMeta                  │
│    - sender, receiver, content_cid   │
│    - session_id, sent_at, is_read    │
│  - 触发 MessageSent 事件             │
└──────────────┬───────────────────────┘
               ↓ 事件监听
┌──────────────────────────────────────┐
│         用户B (接收方)               │
│  1. 监听MessageSent事件               │
│  2. 查询消息元数据                    │
│  3. 从IPFS下载加密内容               │
│  4. 用自己私钥解密                    │
│  5. 显示消息                          │
│  6. 调用mark_as_read                 │
└──────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 发送消息

#### send_message - 发送消息
```rust
pub fn send_message(
    origin: OriginFor<T>,
    receiver: T::AccountId,
    content_cid: Vec<u8>,
    msg_type: MessageType,
) -> DispatchResult
```

**参数说明**：
- `receiver`: 接收方账户
- `content_cid`: 加密消息内容的IPFS CID
- `msg_type`: 消息类型（Text/Image/File/Voice/System）

**前端加密流程**：
```text
1. 获取接收方公钥（链上查询或本地缓存）
2. 用接收方公钥加密消息内容
   encrypted_content = RSA_Encrypt(receiver_pubkey, message)
3. 上传加密内容到IPFS
   content_cid = upload_to_ipfs(encrypted_content)
4. 调用send_message(receiver, content_cid, Text)
```

**工作流程**：
1. 生成或获取会话ID（session_id）
2. 生成消息ID（message_id）
3. 创建消息元数据
4. 更新会话信息（last_message_id, last_active）
5. 更新未读计数
6. 触发MessageSent事件

**会话ID生成**：
```rust
let session_id = if let Some(sid) = existing_session {
    sid
} else {
    // 首次聊天，生成新会话ID
    // session_id = hash(sorted(sender, receiver))
    let participants = [sender.clone(), receiver.clone()];
    participants.sort();
    T::Hashing::hash_of(&participants)
};
```

### 2. 消息查询

#### get_message - 查询单条消息
```rust
pub fn get_message(message_id: u64) -> Option<MessageMeta<T>>
```

#### list_messages_by_session - 查询会话消息
```rust
pub fn list_messages_by_session(
    session_id: T::Hash,
    offset: u32,
    limit: u32,
) -> Vec<u64>  // 返回消息ID列表
```

**分页查询**：
- 支持offset + limit分页
- 按时间倒序（最新消息优先）
- 前端批量查询消息详情

### 3. 已读未读管理

#### mark_as_read - 标记消息已读
```rust
pub fn mark_as_read(
    origin: OriginFor<T>,
    message_id: u64,
) -> DispatchResult
```

**功能**：
- 接收方标记消息为已读
- 更新 `is_read` 字段
- 触发 MessageRead 事件

#### mark_batch_as_read - 批量标记已读
```rust
pub fn mark_batch_as_read(
    origin: OriginFor<T>,
    message_ids: Vec<u64>,
) -> DispatchResult
```

**功能**：
- 批量标记多条消息已读
- 减少交易次数
- 提升用户体验

#### get_unread_count - 查询未读计数
```rust
pub fn get_unread_count(user: T::AccountId) -> u32
```

**用途**：显示未读消息提示

### 4. 消息删除

#### delete_message - 软删除消息
```rust
pub fn delete_message(
    origin: OriginFor<T>,
    message_id: u64,
) -> DispatchResult
```

**功能**：
- 仅软删除（标记 `is_deleted = true`）
- 不删除链上数据（可审计）
- 前端不显示已删除消息

**权限**：
- 发送方可删除自己发送的消息
- 接收方可删除收到的消息（仅对自己隐藏）

### 5. 会话管理

#### get_session - 查询会话信息
```rust
pub fn get_session(session_id: T::Hash) -> Option<Session<T>>
```

#### list_sessions - 查询用户会话列表
```rust
pub fn list_sessions(user: T::AccountId) -> Vec<T::Hash>
```

#### archive_session - 归档会话
```rust
pub fn archive_session(
    origin: OriginFor<T>,
    session_id: T::Hash,
) -> DispatchResult
```

**功能**：
- 标记会话为归档状态
- 归档会话不显示在主列表
- 可通过"归档"入口查看

## 📦 存储结构

### 消息元数据
```rust
pub type Messages<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // message_id
    MessageMeta<T>,
    OptionQuery,
>;
```

**MessageMeta结构**：
```rust
pub struct MessageMeta<T: Config> {
    pub sender: T::AccountId,                          // 发送方
    pub receiver: T::AccountId,                        // 接收方
    pub content_cid: BoundedVec<u8, T::MaxCidLen>,     // IPFS CID
    pub session_id: T::Hash,                           // 会话ID
    pub msg_type: MessageType,                         // 消息类型
    pub sent_at: BlockNumberFor<T>,                    // 发送时间
    pub is_read: bool,                                 // 是否已读
    pub is_deleted: bool,                              // 是否删除
}
```

**MessageType枚举**：
```rust
pub enum MessageType {
    Text,     // 文本消息
    Image,    // 图片消息
    File,     // 文件消息
    Voice,    // 语音消息
    System,   // 系统消息
}
```

### 会话信息
```rust
pub type Sessions<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,  // session_id
    Session<T>,
    OptionQuery,
>;
```

**Session结构**：
```rust
pub struct Session<T: Config> {
    pub id: T::Hash,                                   // 会话ID
    pub participants: BoundedVec<T::AccountId, ConstU32<2>>, // 参与者（2人）
    pub last_message_id: u64,                          // 最后一条消息ID
    pub last_active: BlockNumberFor<T>,                // 最后活跃时间
    pub created_at: BlockNumberFor<T>,                 // 创建时间
    pub is_archived: bool,                             // 是否归档
}
```

### 索引存储

#### 会话消息索引
```rust
pub type MessagesBySession<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::Hash,  // session_id
    Blake2_128Concat,
    u64,      // message_id
    (),
    OptionQuery,
>;
```

#### 用户会话索引
```rust
pub type SessionsByUser<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    Blake2_128Concat,
    T::Hash,  // session_id
    (),
    OptionQuery,
>;
```

#### 未读计数
```rust
pub type UnreadCount<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    u32,
    ValueQuery,
>;
```

### 自增ID
```rust
pub type NextMessageId<T: Config> = StorageValue<_, u64, ValueQuery>;
```

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// IPFS CID最大长度（通常为46-59字节）
    type MaxCidLen: Get<u32>;

    /// 每个用户最多会话数
    type MaxSessionsPerUser: Get<u32>;

    /// 每个会话最多消息数（链上索引）
    type MaxMessagesPerSession: Get<u32>;
}
```

## 📡 可调用接口

### 用户接口

#### 1. send_message - 发送消息
```rust
#[pallet::call_index(0)]
pub fn send_message(
    origin: OriginFor<T>,
    receiver: T::AccountId,
    content_cid: Vec<u8>,
    msg_type: MessageType,
) -> DispatchResult
```

#### 2. mark_as_read - 标记已读
```rust
#[pallet::call_index(1)]
pub fn mark_as_read(
    origin: OriginFor<T>,
    message_id: u64,
) -> DispatchResult
```

#### 3. mark_batch_as_read - 批量标记已读
```rust
#[pallet::call_index(2)]
pub fn mark_batch_as_read(
    origin: OriginFor<T>,
    message_ids: Vec<u64>,
) -> DispatchResult
```

#### 4. delete_message - 删除消息
```rust
#[pallet::call_index(3)]
pub fn delete_message(
    origin: OriginFor<T>,
    message_id: u64,
) -> DispatchResult
```

#### 5. archive_session - 归档会话
```rust
#[pallet::call_index(4)]
pub fn archive_session(
    origin: OriginFor<T>,
    session_id: T::Hash,
) -> DispatchResult
```

## 🎉 事件

### MessageSent - 消息发送事件
```rust
MessageSent {
    message_id: u64,
    sender: T::AccountId,
    receiver: T::AccountId,
    session_id: T::Hash,
}
```

**前端监听**：
```javascript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'chat' && event.method === 'MessageSent') {
      const { message_id, sender, receiver, session_id } = event.data;
      if (receiver === currentUser) {
        // 收到新消息，查询并显示
        loadMessage(message_id);
      }
    }
  });
});
```

### MessageRead - 消息已读事件
```rust
MessageRead {
    message_id: u64,
    reader: T::AccountId,
}
```

### MessageDeleted - 消息删除事件
```rust
MessageDeleted {
    message_id: u64,
    operator: T::AccountId,
}
```

### SessionArchived - 会话归档事件
```rust
SessionArchived {
    session_id: T::Hash,
    operator: T::AccountId,
}
```

## ❌ 错误处理

### MessageNotFound
- **说明**：消息不存在
- **触发**：操作不存在的message_id

### NoPermission
- **说明**：无权限操作
- **触发**：非发送方/接收方尝试操作消息

### SessionNotFound
- **说明**：会话不存在
- **触发**：操作不存在的session_id

### TooManySessions
- **说明**：会话数量超限
- **触发**：用户会话数超过MaxSessionsPerUser

### TooManyMessages
- **说明**：消息数量超限
- **触发**：会话消息数超过MaxMessagesPerSession

## 🔌 使用示例

### 场景1：OTC订单聊天

```rust
// 1. 买家发送消息给卖家
let seller = otc_order.seller;
let message = "Can you confirm the payment?";

// 前端加密
let seller_pubkey = get_user_pubkey(seller);
let encrypted_content = rsa_encrypt(seller_pubkey, message);
let content_cid = upload_to_ipfs(encrypted_content);

// 发送消息
pallet_chat::Pallet::<T>::send_message(
    buyer_origin,
    seller,
    content_cid.into_bytes(),
    MessageType::Text,
)?;

// 2. 卖家监听事件，收到消息
// 前端解密
let message_meta = pallet_chat::Messages::<T>::get(message_id)?;
let encrypted_content = download_from_ipfs(message_meta.content_cid);
let decrypted_message = rsa_decrypt(my_privkey, encrypted_content);
// 显示: "Can you confirm the payment?"

// 3. 卖家回复
let reply = "Yes, I received the payment.";
let encrypted_reply = rsa_encrypt(buyer_pubkey, reply);
let reply_cid = upload_to_ipfs(encrypted_reply);

pallet_chat::Pallet::<T>::send_message(
    seller_origin,
    buyer,
    reply_cid.into_bytes(),
    MessageType::Text,
)?;

// 4. 买家标记已读
pallet_chat::Pallet::<T>::mark_as_read(
    buyer_origin,
    message_id,
)?;
```

### 场景2：发送图片消息

```rust
// 1. 上传图片到IPFS（公开）
let image_file = /* 图片二进制 */;
let image_cid = upload_to_ipfs(image_file);

// 2. 加密CID（或加密整个图片）
let receiver_pubkey = get_user_pubkey(receiver);
let encrypted_cid = rsa_encrypt(receiver_pubkey, image_cid);
let content_cid = upload_to_ipfs(encrypted_cid);

// 3. 发送图片消息
pallet_chat::Pallet::<T>::send_message(
    origin,
    receiver,
    content_cid.into_bytes(),
    MessageType::Image,
)?;

// 4. 接收方解密
let encrypted_cid = download_from_ipfs(message_meta.content_cid);
let image_cid = rsa_decrypt(my_privkey, encrypted_cid);
let image = download_from_ipfs(image_cid);
// 显示图片
```

### 场景3：批量标记已读

```rust
// 查询会话所有未读消息
let unread_messages = list_unread_messages(session_id);
let message_ids: Vec<u64> = unread_messages.iter().map(|m| m.id).collect();

// 批量标记已读
pallet_chat::Pallet::<T>::mark_batch_as_read(
    origin,
    message_ids,
)?;
```

## 🛡️ 安全机制

### 1. 端到端加密

- 前端用接收方公钥加密
- 链上仅存储加密内容CID
- 只有接收方私钥可解密

### 2. 权限控制

- 仅发送方/接收方可查看消息
- 仅相关方可标记已读/删除
- 防止未授权访问

### 3. 软删除

- 消息不真正删除（可审计）
- 前端过滤已删除消息
- 支持争议举证

### 4. 防止垃圾消息

- 可配置会话数上限
- 可配置消息数上限
- 可实现黑名单机制（扩展）

## 📝 最佳实践

### 1. 密钥管理

- 用户注册时生成RSA密钥对
- 公钥上链（可查询）
- 私钥安全存储（本地/硬件钱包）

### 2. 消息加密

- 敏感内容必须加密
- 使用RSA或混合加密（RSA+AES）
- CID本身也可加密（双重保护）

### 3. 消息同步

- 监听MessageSent事件
- 定期轮询未读消息
- 使用WebSocket实时推送

### 4. 用户体验

- 批量查询消息（减少RPC调用）
- 本地缓存已读消息
- 分页加载历史消息

### 5. 监控指标

- 消息发送率
- 未读消息数
- 会话活跃度
- 加密/解密性能

## 🔗 相关模块

- **pallet-otc-order**: OTC订单（买卖双方聊天）
- **pallet-simple-bridge**: 桥接服务（用户与做市商聊天）
- **pallet-evidence**: 证据管理（聊天记录作为证据）
- **pallet-stardust-ipfs**: IPFS管理（消息内容存储）

## 📚 参考资源

- [去中心化聊天设计文档](../../docs/chat-design.md)
- [端到端加密方案](../../docs/e2e-encryption.md)
- [消息同步机制](../../docs/message-sync.md)
- [前端集成指南](../../../stardust-dapp/OTC聊天集成-完成报告.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Stardust 开发团队
