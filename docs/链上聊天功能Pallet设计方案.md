# 链上聊天功能 Pallet 设计方案

**设计日期**: 2025-10-21  
**版本**: v1.0.0  
**设计目标**: 为 Stardust 项目提供去中心化的聊天功能  

---

## 📋 需求分析

### 业务场景

在 Stardust 项目中，聊天功能可能用于：

1. **OTC 交易沟通**：买家与做市商的订单沟通
2. **纪念馆留言**：访客在纪念馆留言板沟通
3. **家族群聊**：家族成员之间的私密沟通
4. **做市商客服**：做市商与用户的客服对话
5. **社区讨论**：用户之间的公开讨论

---

## 🎯 可行性分析

### ✅ 技术可行性：⭐⭐⭐⭐

| 技术维度 | 评分 | 说明 |
|---------|------|------|
| **Substrate 支持** | ⭐⭐⭐⭐⭐ | 完全支持，可以实现 |
| **存储成本** | ⭐⭐ | 链上存储成本高，需要优化方案 |
| **查询效率** | ⭐⭐⭐ | 需要配合 Subsquid 或链下索引 |
| **隐私性** | ⭐⭐⭐⭐ | 可以使用加密方案 |
| **扩展性** | ⭐⭐⭐ | 需要设计好数据结构 |

### ⚠️ 主要挑战

#### 1. 存储成本问题

**问题**：区块链存储成本极高

```rust
// 一条简单聊天消息
pub struct Message {
    sender: AccountId,      // 32 bytes
    receiver: AccountId,    // 32 bytes
    content: Vec<u8>,       // 假设 200 bytes（约67个中文字）
    timestamp: u64,         // 8 bytes
    // 总计约 272 bytes
}

// 如果每天 1000 条消息，一年就是：
// 1000 * 365 * 272 bytes = 99.28 MB
// 这在链上存储是不可接受的！
```

#### 2. 隐私性问题

**问题**：链上数据默认公开，所有人都能看到

```rust
// 链上存储的消息，任何人都能读取
Messages::<T>::get(msg_id) // 公开可见！
```

#### 3. 查询效率问题

**问题**：链上查询效率低，不适合实时聊天

```rust
// 查询某个用户的所有消息需要遍历
for msg_id in 0..total_messages {
    let msg = Messages::<T>::get(msg_id);
    if msg.sender == user || msg.receiver == user {
        // 找到相关消息
    }
}
// 时间复杂度 O(n)，非常慢！
```

---

## 💡 合理性分析

### ❌ 完全链上方案（不推荐）

**方案**：所有消息内容直接存储在链上

**优点**：
- ✅ 去中心化
- ✅ 不可篡改
- ✅ 永久存储

**缺点**：
- ❌ 存储成本极高（用户负担不起）
- ❌ 隐私性差（所有消息公开）
- ❌ 查询效率低（不适合实时聊天）
- ❌ 链膨胀严重（影响节点同步）

**结论**：❌ **不合理，不推荐**

---

### ✅ 混合方案（推荐）⭐⭐⭐⭐⭐

**方案**：链上存储元数据 + IPFS/链下存储消息内容

#### 架构设计

```
┌─────────────────────────────────────────────────────┐
│                    用户 A                            │
└────────┬────────────────────────────────────────────┘
         │ 1. 发送消息
         ↓
┌─────────────────────────────────────────────────────┐
│                  前端（加密）                         │
│  - 使用接收方公钥加密消息内容                           │
│  - 上传加密内容到 IPFS                                │
│  - 获取 CID                                          │
└────────┬────────────────────────────────────────────┘
         │ 2. 提交 CID 到链上
         ↓
┌─────────────────────────────────────────────────────┐
│              链上 (pallet-chat)                      │
│  存储内容：                                           │
│  - 消息 ID                                           │
│  - 发送方地址                                         │
│  - 接收方地址                                         │
│  - IPFS CID（加密内容）                               │
│  - 时间戳                                            │
│  - 会话 ID                                           │
│  不存储：实际消息内容                                  │
└────────┬────────────────────────────────────────────┘
         │ 3. 触发事件
         ↓
┌─────────────────────────────────────────────────────┐
│                  用户 B                              │
│  - 监听链上事件                                       │
│  - 获取 CID                                          │
│  - 从 IPFS 下载加密内容                               │
│  - 使用私钥解密                                       │
│  - 显示消息                                          │
└─────────────────────────────────────────────────────┘
```

#### 优点

| 优点 | 说明 |
|------|------|
| ✅ **低成本** | 链上只存储元数据（约100 bytes/消息） |
| ✅ **隐私保护** | 消息内容端到端加密 |
| ✅ **可扩展** | IPFS 存储无限扩展 |
| ✅ **不可篡改** | 链上记录保证消息真实性 |
| ✅ **可审计** | 链上有完整的消息记录 |
| ✅ **查询高效** | 配合 Subsquid 索引 |

#### 缺点

| 缺点 | 说明 | 解决方案 |
|------|------|---------|
| ⚠️ **IPFS 依赖** | 需要 IPFS 节点 | 使用 Pinata/Filebase 托管 |
| ⚠️ **消息可能丢失** | IPFS 内容可能被清理 | 自动 Pin 重要消息 |
| ⚠️ **不是真正的实时** | 需要轮询或监听事件 | 使用 WebSocket 推送 |

---

## 🏗️ Pallet 设计

### 数据结构

```rust
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::Hash;

/// 函数级详细中文注释：消息元数据结构
/// - 只存储元数据，不存储实际内容
/// - 内容加密后存储在 IPFS，链上只保存 CID
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct MessageMeta<AccountId, BlockNumber> {
    /// 发送方
    pub sender: AccountId,
    /// 接收方
    pub receiver: AccountId,
    /// IPFS CID（加密的消息内容）
    pub content_cid: BoundedVec<u8, ConstU32<128>>,
    /// 会话 ID（用于分组消息）
    pub session_id: H256,
    /// 消息类型（文本/图片/文件等）
    pub msg_type: MessageType,
    /// 发送时间（区块高度）
    pub sent_at: BlockNumber,
    /// 是否已读
    pub is_read: bool,
    /// 是否已删除（软删除）
    pub is_deleted: bool,
}

/// 函数级详细中文注释：消息类型
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum MessageType {
    /// 文本消息
    Text,
    /// 图片消息
    Image,
    /// 文件消息
    File,
    /// 语音消息
    Voice,
    /// 系统消息
    System,
}

/// 函数级详细中文注释：会话信息
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct Session<AccountId, BlockNumber> {
    /// 会话 ID
    pub id: H256,
    /// 参与者列表（最多2人，私聊）
    pub participants: BoundedVec<AccountId, ConstU32<2>>,
    /// 最后一条消息 ID
    pub last_message_id: u64,
    /// 最后活跃时间
    pub last_active: BlockNumber,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 是否归档
    pub is_archived: bool,
}
```

### 存储项

```rust
#[pallet::storage]
#[pallet::getter(fn messages)]
/// 函数级详细中文注释：消息元数据存储
/// - Key: 消息 ID
/// - Value: 消息元数据
pub type Messages<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,
    MessageMeta<T::AccountId, BlockNumberFor<T>>,
>;

#[pallet::storage]
#[pallet::getter(fn next_message_id)]
/// 函数级详细中文注释：下一个消息 ID
pub type NextMessageId<T: Config> = StorageValue<_, u64, ValueQuery>;

#[pallet::storage]
#[pallet::getter(fn sessions)]
/// 函数级详细中文注释：会话存储
/// - Key: 会话 ID
/// - Value: 会话信息
pub type Sessions<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    H256,
    Session<T::AccountId, BlockNumberFor<T>>,
>;

#[pallet::storage]
#[pallet::getter(fn user_sessions)]
/// 函数级详细中文注释：用户会话索引
/// - Key: 账户地址
/// - Value: 会话 ID 列表
pub type UserSessions<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<H256, ConstU32<100>>,  // 每个用户最多100个会话
    ValueQuery,
>;

#[pallet::storage]
#[pallet::getter(fn session_messages)]
/// 函数级详细中文注释：会话消息索引
/// - Key: 会话 ID
/// - Value: 消息 ID 列表（最多保留最近1000条）
pub type SessionMessages<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    H256,
    BoundedVec<u64, ConstU32<1000>>,
    ValueQuery,
>;

#[pallet::storage]
#[pallet::getter(fn unread_count)]
/// 函数级详细中文注释：未读消息计数
/// - Key: (接收方, 会话 ID)
/// - Value: 未读数量
pub type UnreadCount<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    (T::AccountId, H256),
    u32,
    ValueQuery,
>;
```

### 可调用接口

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：发送消息
    /// 
    /// # 参数
    /// - `receiver`: 接收方地址
    /// - `content_cid`: IPFS CID（加密的消息内容）
    /// - `msg_type`: 消息类型
    /// - `session_id`: 会话 ID（可选，如果为 None 则自动创建新会话）
    #[pallet::call_index(0)]
    #[pallet::weight(10_000)]
    pub fn send_message(
        origin: OriginFor<T>,
        receiver: T::AccountId,
        content_cid: Vec<u8>,
        msg_type: MessageType,
        session_id: Option<H256>,
    ) -> DispatchResult {
        let sender = ensure_signed(origin)?;
        
        // 验证 CID 长度
        ensure!(content_cid.len() <= 128, Error::<T>::CidTooLong);
        let cid_bounded: BoundedVec<u8, ConstU32<128>> = content_cid
            .try_into()
            .map_err(|_| Error::<T>::CidTooLong)?;
        
        // 获取或创建会话
        let session_id = if let Some(id) = session_id {
            id
        } else {
            Self::create_session(&sender, &receiver)?
        };
        
        // 生成消息 ID
        let msg_id = NextMessageId::<T>::get();
        NextMessageId::<T>::put(msg_id + 1);
        
        // 创建消息
        let now = <frame_system::Pallet<T>>::block_number();
        let message = MessageMeta {
            sender: sender.clone(),
            receiver: receiver.clone(),
            content_cid: cid_bounded,
            session_id,
            msg_type,
            sent_at: now,
            is_read: false,
            is_deleted: false,
        };
        
        // 存储消息
        Messages::<T>::insert(msg_id, message);
        
        // 更新会话
        Sessions::<T>::try_mutate(session_id, |maybe_session| -> DispatchResult {
            let session = maybe_session.as_mut().ok_or(Error::<T>::SessionNotFound)?;
            session.last_message_id = msg_id;
            session.last_active = now;
            Ok(())
        })?;
        
        // 添加到会话消息列表
        SessionMessages::<T>::try_mutate(session_id, |messages| -> DispatchResult {
            messages.try_push(msg_id).map_err(|_| Error::<T>::TooManyMessages)?;
            Ok(())
        })?;
        
        // 增加未读计数
        UnreadCount::<T>::mutate((receiver.clone(), session_id), |count| {
            *count = count.saturating_add(1);
        });
        
        // 触发事件
        Self::deposit_event(Event::MessageSent {
            msg_id,
            session_id,
            sender,
            receiver,
        });
        
        Ok(())
    }
    
    /// 函数级详细中文注释：标记消息已读
    #[pallet::call_index(1)]
    #[pallet::weight(10_000)]
    pub fn mark_as_read(
        origin: OriginFor<T>,
        msg_id: u64,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;
        
        Messages::<T>::try_mutate(msg_id, |maybe_msg| -> DispatchResult {
            let msg = maybe_msg.as_mut().ok_or(Error::<T>::MessageNotFound)?;
            
            // 验证是接收方
            ensure!(msg.receiver == who, Error::<T>::NotReceiver);
            
            // 如果已经是已读，直接返回
            if msg.is_read {
                return Ok(());
            }
            
            // 标记已读
            msg.is_read = true;
            
            // 减少未读计数
            UnreadCount::<T>::mutate((who.clone(), msg.session_id), |count| {
                *count = count.saturating_sub(1);
            });
            
            Ok(())
        })?;
        
        Self::deposit_event(Event::MessageRead { msg_id, reader: who });
        
        Ok(())
    }
    
    /// 函数级详细中文注释：删除消息（软删除）
    #[pallet::call_index(2)]
    #[pallet::weight(10_000)]
    pub fn delete_message(
        origin: OriginFor<T>,
        msg_id: u64,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;
        
        Messages::<T>::try_mutate(msg_id, |maybe_msg| -> DispatchResult {
            let msg = maybe_msg.as_mut().ok_or(Error::<T>::MessageNotFound)?;
            
            // 验证是发送方或接收方
            ensure!(
                msg.sender == who || msg.receiver == who,
                Error::<T>::NotAuthorized
            );
            
            // 软删除
            msg.is_deleted = true;
            
            Ok(())
        })?;
        
        Self::deposit_event(Event::MessageDeleted { msg_id, deleter: who });
        
        Ok(())
    }
    
    /// 函数级详细中文注释：批量标记已读（按会话）
    #[pallet::call_index(3)]
    #[pallet::weight(10_000)]
    pub fn mark_session_as_read(
        origin: OriginFor<T>,
        session_id: H256,
    ) -> DispatchResult {
        let who = ensure_signed(origin)?;
        
        // 验证会话存在且用户是参与者
        let session = Sessions::<T>::get(session_id)
            .ok_or(Error::<T>::SessionNotFound)?;
        ensure!(
            session.participants.contains(&who),
            Error::<T>::NotSessionParticipant
        );
        
        // 获取会话的所有消息
        let messages = SessionMessages::<T>::get(session_id);
        
        // 批量标记已读
        for msg_id in messages.iter() {
            if let Some(mut msg) = Messages::<T>::get(msg_id) {
                if msg.receiver == who && !msg.is_read {
                    msg.is_read = true;
                    Messages::<T>::insert(msg_id, msg);
                }
            }
        }
        
        // 清空未读计数
        UnreadCount::<T>::insert((who.clone(), session_id), 0);
        
        Self::deposit_event(Event::SessionMarkedAsRead {
            session_id,
            user: who,
        });
        
        Ok(())
    }
}
```

### 辅助函数

```rust
impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：创建会话
    fn create_session(
        user1: &T::AccountId,
        user2: &T::AccountId,
    ) -> Result<H256, DispatchError> {
        // 生成会话 ID（基于两个用户地址的哈希）
        let mut participants = vec![user1.clone(), user2.clone()];
        participants.sort();
        let session_id = T::Hashing::hash_of(&participants);
        
        // 检查会话是否已存在
        if Sessions::<T>::contains_key(session_id) {
            return Ok(session_id);
        }
        
        // 创建新会话
        let now = <frame_system::Pallet<T>>::block_number();
        let participants_bounded: BoundedVec<T::AccountId, ConstU32<2>> = 
            participants.try_into().map_err(|_| Error::<T>::TooManyParticipants)?;
        
        let session = Session {
            id: session_id,
            participants: participants_bounded.clone(),
            last_message_id: 0,
            last_active: now,
            created_at: now,
            is_archived: false,
        };
        
        Sessions::<T>::insert(session_id, session);
        
        // 添加到用户会话列表
        for user in participants_bounded.iter() {
            UserSessions::<T>::try_mutate(user, |sessions| -> DispatchResult {
                sessions.try_push(session_id).map_err(|_| Error::<T>::TooManySessions)?;
                Ok(())
            })?;
        }
        
        Self::deposit_event(Event::SessionCreated {
            session_id,
            participants: participants_bounded,
        });
        
        Ok(session_id)
    }
}
```

### 事件

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    /// 函数级详细中文注释：消息已发送
    MessageSent {
        msg_id: u64,
        session_id: H256,
        sender: T::AccountId,
        receiver: T::AccountId,
    },
    
    /// 函数级详细中文注释：消息已读
    MessageRead {
        msg_id: u64,
        reader: T::AccountId,
    },
    
    /// 函数级详细中文注释：消息已删除
    MessageDeleted {
        msg_id: u64,
        deleter: T::AccountId,
    },
    
    /// 函数级详细中文注释：会话已创建
    SessionCreated {
        session_id: H256,
        participants: BoundedVec<T::AccountId, ConstU32<2>>,
    },
    
    /// 函数级详细中文注释：会话已标记为已读
    SessionMarkedAsRead {
        session_id: H256,
        user: T::AccountId,
    },
}
```

### 错误

```rust
#[pallet::error]
pub enum Error<T> {
    /// CID 太长
    CidTooLong,
    /// 消息未找到
    MessageNotFound,
    /// 会话未找到
    SessionNotFound,
    /// 不是接收方
    NotReceiver,
    /// 未授权
    NotAuthorized,
    /// 不是会话参与者
    NotSessionParticipant,
    /// 会话消息太多
    TooManyMessages,
    /// 用户会话太多
    TooManySessions,
    /// 参与者太多
    TooManyParticipants,
}
```

---

## 🔐 隐私和加密方案

### 端到端加密流程

```typescript
// 前端发送消息
async function sendMessage(receiver: string, content: string) {
  // 1. 获取接收方的公钥
  const receiverPubKey = await getPublicKey(receiver);
  
  // 2. 加密消息内容
  const encrypted = await encryptMessage(content, receiverPubKey);
  
  // 3. 上传加密内容到 IPFS
  const cid = await uploadToIPFS(encrypted);
  
  // 4. 调用链上接口
  await api.tx.chat.sendMessage(
    receiver,
    cid,
    'Text',  // MessageType
    null     // session_id (自动创建)
  ).signAndSend(account);
}

// 前端接收消息
async function receiveMessage(msgId: number) {
  // 1. 从链上获取消息元数据
  const meta = await api.query.chat.messages(msgId);
  
  // 2. 从 IPFS 下载加密内容
  const encrypted = await downloadFromIPFS(meta.content_cid);
  
  // 3. 使用私钥解密
  const content = await decryptMessage(encrypted, myPrivateKey);
  
  // 4. 显示消息
  return content;
}
```

---

## 📊 成本分析

### 存储成本对比

| 方案 | 每条消息 | 1000条消息 | 10万条消息 |
|------|---------|-----------|-----------|
| **完全链上** | ~270 bytes | ~263 KB | ~25.7 MB |
| **混合方案（推荐）** | ~100 bytes | ~97 KB | ~9.5 MB |
| **节省比例** | 63% | 63% | 63% |

### Gas 费估算

| 操作 | 预估 Gas | 说明 |
|------|---------|------|
| 发送消息 | ~0.01 DUST | 链上只记录元数据 |
| 标记已读 | ~0.005 DUST | 更新状态 |
| 删除消息 | ~0.005 DUST | 软删除 |
| 批量已读 | ~0.05 DUST | 100条消息 |

---

## 🚀 前端集成

### React 组件示例

```typescript
// ChatWindow.tsx
import React, { useEffect, useState } from 'react';
import { List, Input, Button, Avatar } from 'antd';
import { getApi } from '../lib/polkadot';

interface Message {
  id: number;
  sender: string;
  receiver: string;
  content: string;  // 解密后的内容
  timestamp: number;
  isRead: boolean;
}

export default function ChatWindow({ 
  sessionId, 
  otherUser 
}: { 
  sessionId: string;
  otherUser: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 加载历史消息
  useEffect(() => {
    loadMessages();
    subscribeToNewMessages();
  }, [sessionId]);
  
  async function loadMessages() {
    const api = await getApi();
    const msgIds = await api.query.chat.sessionMessages(sessionId);
    
    const messages = await Promise.all(
      msgIds.map(async (id) => {
        const meta = await api.query.chat.messages(id);
        const encrypted = await downloadFromIPFS(meta.content_cid);
        const content = await decryptMessage(encrypted);
        
        return {
          id: id.toNumber(),
          sender: meta.sender.toString(),
          receiver: meta.receiver.toString(),
          content,
          timestamp: meta.sent_at.toNumber(),
          isRead: meta.is_read,
        };
      })
    );
    
    setMessages(messages);
  }
  
  async function sendMessage() {
    if (!input.trim()) return;
    
    setLoading(true);
    try {
      // 加密并上传
      const encrypted = await encryptMessage(input, otherUser);
      const cid = await uploadToIPFS(encrypted);
      
      // 发送到链上
      const api = await getApi();
      await api.tx.chat.sendMessage(
        otherUser,
        cid,
        'Text',
        sessionId
      ).signAndSend(currentAccount);
      
      setInput('');
      await loadMessages();
    } catch (error) {
      console.error('发送失败:', error);
    } finally {
      setLoading(false);
    }
  }
  
  function subscribeToNewMessages() {
    // 监听链上事件
    const api = await getApi();
    api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (api.events.chat.MessageSent.is(event)) {
          const [msgId, sessId, sender, receiver] = event.data;
          if (sessId.toString() === sessionId) {
            loadMessages();  // 重新加载消息
          }
        }
      });
    });
  }
  
  return (
    <div className="chat-window">
      <List
        dataSource={messages}
        renderItem={(msg) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar>{msg.sender.slice(0, 2)}</Avatar>}
              title={msg.sender === currentAccount ? '我' : '对方'}
              description={msg.content}
            />
          </List.Item>
        )}
      />
      
      <div className="input-area">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={sendMessage}
          placeholder="输入消息..."
        />
        <Button 
          type="primary" 
          onClick={sendMessage}
          loading={loading}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
```

---

## 🎯 总结与建议

### 可行性结论：⭐⭐⭐⭐ （推荐混合方案）

| 维度 | 评分 | 说明 |
|------|------|------|
| **技术可行性** | ⭐⭐⭐⭐⭐ | 完全可行 |
| **成本合理性** | ⭐⭐⭐⭐ | 混合方案成本可控 |
| **用户体验** | ⭐⭐⭐⭐ | 需要优化查询速度 |
| **安全性** | ⭐⭐⭐⭐⭐ | 端到端加密 |
| **扩展性** | ⭐⭐⭐⭐ | 可扩展到群聊 |

### 推荐方案

✅ **混合方案（链上元数据 + IPFS 内容）**

**理由**：
1. ✅ 成本低廉（链上只存储约100 bytes/消息）
2. ✅ 隐私安全（端到端加密）
3. ✅ 可扩展（支持各种消息类型）
4. ✅ 可审计（链上有完整记录）
5. ✅ 去中心化（IPFS 存储）

### 实施建议

#### Phase 1: MVP（最小可行产品）
- ✅ 实现基本的文本消息
- ✅ 私聊功能（1对1）
- ✅ 已读/未读状态
- ✅ 消息删除

#### Phase 2: 增强功能
- 📝 图片/文件消息
- 📝 消息搜索
- 📝 消息引用/回复
- 📝 消息撤回（时间窗口内）

#### Phase 3: 高级功能
- 📝 群聊功能（1对多）
- 📝 语音/视频通话（链下）
- 📝 消息转发
- 📝 聊天记录导出

### 适用场景

✅ **推荐使用场景：**
1. OTC 交易沟通（买家与做市商）
2. 做市商客服（一对一支持）
3. 家族私密沟通（继承纪念馆管理权）

❌ **不推荐场景：**
1. 大规模公开聊天室（成本太高）
2. 实时群聊（> 10人，查询效率低）
3. 高频消息场景（每秒多条，链性能瓶颈）

---

## 📚 参考资料

- [Substrate Storage Best Practices](https://docs.substrate.io/build/runtime-storage/)
- [IPFS Best Practices](https://docs.ipfs.tech/concepts/persistence/)
- [End-to-End Encryption](https://en.wikipedia.org/wiki/End-to-end_encryption)

---

**文档完成**

