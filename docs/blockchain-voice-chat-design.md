# Stardust 区块链语音聊天系统设计文档

> 版本：v1.0.0
> 日期：2025-11-29
> 状态：设计阶段

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [技术栈选型](#3-技术栈选型)
4. [核心模块设计](#4-核心模块设计)
5. [Pallet设计](#5-pallet设计)
6. [信令协议](#6-信令协议)
7. [数据结构](#7-数据结构)
8. [安全设计](#8-安全设计)
9. [前端实现](#9-前端实现)
10. [部署架构](#10-部署架构)
11. [开发计划](#11-开发计划)
12. [API参考](#12-api参考)

---

## 1. 项目概述

### 1.1 背景

基于 Stardust 区块链现有的聊天系统（pallet-chat、pallet-smart-group-chat、pallet-contacts），结合语音聊天项目（go-chat、starrtc-server、ARChatRoom）的技术经验，设计一套去中心化的区块链语音聊天系统。

### 1.2 目标

- **去中心化身份**：基于区块链账户的用户身份验证
- **端到端加密**：语音数据全程加密传输
- **实时通话**：支持 P2P 和多人语音房间
- **链上记录**：通话记录、计费信息上链
- **激励机制**：通话挖矿、礼物打赏、VIP会员

### 1.3 核心功能

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 语音消息 | 录制、发送、播放离线语音 | P0 |
| 一对一通话 | P2P 实时语音通话 | P0 |
| 语音房间 | 多人语音聊天室（最多50人） | P1 |
| 语音直播 | 一对多语音直播 | P2 |
| AI 语音 | 语音转文字、翻译、降噪 | P2 |

### 1.4 现有基础设施

Stardust 项目已具备：
- ✅ `pallet-chat` - 一对一聊天（支持 Voice 消息类型）
- ✅ `pallet-smart-group-chat` - 群聊系统
- ✅ `pallet-contacts` - 通讯录管理
- ✅ `stardust-media-common` - 音频验证库（MP3, AAC, OGG, WAV, FLAC）
- ✅ IPFS 存储支持
- ✅ OCW 链下工作机框架

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           客户端层 (Client Layer)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Web Client  │  │ iOS Client   │  │Android Client│  │ Desktop App │ │
│  │  (React)     │  │ (Swift)      │  │ (Kotlin)     │  │ (Electron)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │        │
│         └─────────────────┴────────┬────────┴─────────────────┘        │
│                                    │                                    │
│                          ┌─────────▼─────────┐                         │
│                          │   WebRTC / P2P    │                         │
│                          │   (音视频流)       │                         │
│                          └─────────┬─────────┘                         │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────┐
│                           服务层 (Service Layer)                         │
├────────────────────────────────────┼────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────▼──────────┐    ┌─────────────────┐ │
│  │  信令服务器      │    │   媒体服务器         │    │   TURN/STUN    │ │
│  │  (WebSocket)    │◄──►│   (SFU/MCU)         │◄──►│   (NAT穿透)    │ │
│  │  go-chat架构    │    │   starrtc架构        │    │                │ │
│  └────────┬────────┘    └──────────┬──────────┘    └─────────────────┘ │
│           │                        │                                    │
│  ┌────────▼────────┐    ┌──────────▼──────────┐                        │
│  │   消息队列       │    │     IPFS 网关        │                        │
│  │   (Kafka)       │    │   (语音文件存储)      │                        │
│  └────────┬────────┘    └──────────┬──────────┘                        │
└───────────┼─────────────────────────┼───────────────────────────────────┘
            │                         │
┌───────────┼─────────────────────────┼───────────────────────────────────┐
│           │     区块链层 (Blockchain Layer)                              │
├───────────┼─────────────────────────┼───────────────────────────────────┤
│  ┌────────▼─────────────────────────▼────────┐                          │
│  │              Stardust Runtime              │                          │
│  ├───────────────────────────────────────────┤                          │
│  │  ┌─────────────┐  ┌─────────────────────┐ │                          │
│  │  │pallet-voice │  │ pallet-voice-room   │ │  ◄── 新增模块            │
│  │  │ -call       │  │ (多人语音房间)       │ │                          │
│  │  └─────────────┘  └─────────────────────┘ │                          │
│  │  ┌─────────────┐  ┌─────────────────────┐ │                          │
│  │  │pallet-chat  │  │pallet-smart-group   │ │  ◄── 现有模块            │
│  │  │(语音消息)   │  │-chat                │ │                          │
│  │  └─────────────┘  └─────────────────────┘ │                          │
│  │  ┌─────────────┐  ┌─────────────────────┐ │                          │
│  │  │pallet-      │  │ pallet-voice-mining │ │  ◄── 激励模块            │
│  │  │contacts     │  │ (通话挖矿)          │ │                          │
│  │  └─────────────┘  └─────────────────────┘ │                          │
│  └───────────────────────────────────────────┘                          │
│                          │                                               │
│  ┌───────────────────────▼───────────────────┐                          │
│  │           共识层 (AURA + GRANDPA)          │                          │
│  └───────────────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 通话流程

```
┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
│ 发起方  │          │ 信令服务 │          │  链上   │          │ 接收方  │
│ Alice   │          │ Server  │          │ Runtime │          │  Bob    │
└────┬────┘          └────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │                    │
     │  1. 发起通话请求    │                    │                    │
     │ ──────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │  2. 记录通话发起    │                    │
     │                    │ ──────────────────>│                    │
     │                    │                    │                    │
     │                    │  3. 推送通话邀请    │                    │
     │                    │ ──────────────────────────────────────>│
     │                    │                    │                    │
     │                    │                    │    4. 接受/拒绝    │
     │                    │<────────────────────────────────────────
     │                    │                    │                    │
     │                    │  5. 更新通话状态    │                    │
     │                    │ ──────────────────>│                    │
     │                    │                    │                    │
     │  6. SDP Offer      │                    │                    │
     │ ──────────────────────────────────────────────────────────>│
     │                    │                    │                    │
     │                    │                    │    7. SDP Answer   │
     │<────────────────────────────────────────────────────────────
     │                    │                    │                    │
     │  ════════════════ P2P WebRTC 音频流 ═══════════════════════│
     │<═══════════════════════════════════════════════════════════>│
     │                    │                    │                    │
     │  8. 挂断           │                    │                    │
     │ ──────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │  9. 结算通话费用    │                    │
     │                    │ ──────────────────>│                    │
     │                    │                    │                    │
```

---

## 3. 技术栈选型

### 3.1 后端技术栈

| 组件 | 选型 | 来源 | 理由 |
|------|------|------|------|
| 信令服务 | Go + WebSocket | go-chat | 开源、高并发、Protocol Buffer |
| 媒体服务 | C + UDP | starrtc-server | 低延迟、企业级性能 |
| 消息队列 | Kafka | go-chat | 分布式、高吞吐 |
| 数据库 | MySQL + Redis | go-chat | 成熟稳定 |
| TURN/STUN | coturn | 开源 | NAT穿透标准方案 |
| IPFS | go-ipfs | 标准 | 去中心化存储 |

### 3.2 区块链技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| Runtime | Substrate | 现有架构 |
| 共识 | AURA + GRANDPA | 现有配置 |
| 存储 | StorageMap/StorageValue | Substrate标准 |
| 加密 | NaCl + Sr25519 | 现有加密库 |

### 3.3 前端技术栈

| 平台 | 选型 | 来源 |
|------|------|------|
| Web | React 19 + WebRTC | stardust-dapp |
| iOS | Swift + anyRTC SDK | ARChatRoom |
| Android | Kotlin + JuggleIM | imsdka |
| Desktop | Electron | 新增 |

### 3.4 音频编解码

| 场景 | 编码 | 码率 | 延迟 |
|------|------|------|------|
| 语音消息 | Opus | 24kbps | 非实时 |
| 实时通话 | Opus | 32kbps | <100ms |
| 高清通话 | Opus | 64kbps | <150ms |

---

## 4. 核心模块设计

### 4.1 语音消息模块

**利用现有 `pallet-chat` 的 MessageType::Voice**

```rust
// 现有消息类型已支持
pub enum MessageType {
    Text,
    Image,
    File,
    Voice,  // ← 已预留
    System,
}

// 语音消息元数据
pub struct VoiceMetadata {
    pub cid: BoundedVec<u8, MaxCidLength>,      // IPFS CID
    pub duration: u32,                           // 时长(秒)
    pub waveform: BoundedVec<u8, MaxWaveform>,  // 波形数据(可选)
    pub transcription: Option<BoundedVec<u8, MaxTranscription>>, // AI转文字
}
```

**流程：**
1. 客户端录制 → Opus编码 → IPFS上传
2. 获取CID → 调用 `pallet_chat::send_message(Voice, cid)`
3. 接收方从IPFS下载 → Opus解码 → 播放

### 4.2 实时通话模块

**新增 `pallet-voice-call`**

```rust
// 通话状态
pub enum CallState {
    Idle,           // 空闲
    Ringing,        // 响铃中
    Connecting,     // 连接中
    Connected,      // 通话中
    Ended,          // 已结束
}

// 通话记录
pub struct CallRecord<AccountId, BlockNumber> {
    pub call_id: CallId,
    pub caller: AccountId,
    pub callee: AccountId,
    pub state: CallState,
    pub started_at: Option<BlockNumber>,
    pub ended_at: Option<BlockNumber>,
    pub duration: u32,           // 通话时长(秒)
    pub call_type: CallType,     // Audio/Video
    pub quality: CallQuality,    // 通话质量统计
}

// 通话类型
pub enum CallType {
    Audio,
    Video,
}
```

### 4.3 语音房间模块

**新增 `pallet-voice-room`**

```rust
// 房间配置
pub struct RoomConfig {
    pub max_members: u32,        // 最大成员数(默认50)
    pub is_public: bool,         // 是否公开
    pub entry_fee: Balance,      // 入场费(可选)
    pub speaking_mode: SpeakingMode,
}

// 发言模式
pub enum SpeakingMode {
    FreeSpeak,      // 自由发言
    HostOnly,       // 仅主持人
    RaiseHand,      // 举手发言
    Sequential,     // 轮流发言
}

// 房间成员
pub struct RoomMember<AccountId> {
    pub account: AccountId,
    pub role: MemberRole,
    pub is_muted: bool,
    pub joined_at: BlockNumber,
}

// 成员角色
pub enum MemberRole {
    Host,           // 房主
    CoHost,         // 联合主持
    Speaker,        // 发言者
    Listener,       // 听众
}
```

### 4.4 通话激励模块

**新增 `pallet-voice-mining`**

```rust
// 通话挖矿配置
pub struct MiningConfig {
    pub reward_per_minute: Balance,     // 每分钟奖励
    pub daily_cap: Balance,             // 每日上限
    pub min_call_duration: u32,         // 最小有效时长(秒)
    pub anti_cheat_threshold: u32,      // 反作弊阈值
}

// 用户通话统计
pub struct UserCallStats<AccountId> {
    pub account: AccountId,
    pub total_duration: u64,            // 总通话时长
    pub total_calls: u32,               // 总通话次数
    pub earned_rewards: Balance,        // 已获得奖励
    pub daily_duration: u32,            // 当日通话时长
}
```

---

## 5. Pallet设计

### 5.1 pallet-voice-call

```rust
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use sp_std::vec::Vec;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 最大通话时长(秒)
        #[pallet::constant]
        type MaxCallDuration: Get<u32>;

        /// 通话超时时间(块)
        #[pallet::constant]
        type CallTimeout: Get<BlockNumberFor<Self>>;

        /// 每分钟通话费用
        #[pallet::constant]
        type CallFeePerMinute: Get<BalanceOf<Self>>;
    }

    /// 活跃通话
    #[pallet::storage]
    pub type ActiveCalls<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        CallId,
        CallRecord<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 用户当前通话
    #[pallet::storage]
    pub type UserCurrentCall<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        CallId,
        OptionQuery,
    >;

    /// 通话历史
    #[pallet::storage]
    pub type CallHistory<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        CallId,
        CallRecord<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 发起通话
        CallInitiated { call_id: CallId, caller: T::AccountId, callee: T::AccountId },
        /// 通话被接受
        CallAccepted { call_id: CallId },
        /// 通话被拒绝
        CallRejected { call_id: CallId, reason: RejectReason },
        /// 通话已连接
        CallConnected { call_id: CallId },
        /// 通话结束
        CallEnded { call_id: CallId, duration: u32, fee: BalanceOf<T> },
        /// 通话超时
        CallTimeout { call_id: CallId },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 用户正在通话中
        UserBusy,
        /// 通话不存在
        CallNotFound,
        /// 无权操作
        Unauthorized,
        /// 通话已结束
        CallAlreadyEnded,
        /// 用户被屏蔽
        UserBlocked,
        /// 余额不足
        InsufficientBalance,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 发起通话
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn initiate_call(
            origin: OriginFor<T>,
            callee: T::AccountId,
            call_type: CallType,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;

            // 检查双方是否空闲
            ensure!(!UserCurrentCall::<T>::contains_key(&caller), Error::<T>::UserBusy);
            ensure!(!UserCurrentCall::<T>::contains_key(&callee), Error::<T>::UserBusy);

            // 检查是否被屏蔽(调用pallet-contacts)
            // ...

            // 生成通话ID
            let call_id = Self::generate_call_id(&caller, &callee);

            // 创建通话记录
            let call_record = CallRecord {
                call_id,
                caller: caller.clone(),
                callee: callee.clone(),
                state: CallState::Ringing,
                started_at: None,
                ended_at: None,
                duration: 0,
                call_type,
                quality: Default::default(),
            };

            ActiveCalls::<T>::insert(call_id, call_record);
            UserCurrentCall::<T>::insert(&caller, call_id);
            UserCurrentCall::<T>::insert(&callee, call_id);

            Self::deposit_event(Event::CallInitiated { call_id, caller, callee });

            Ok(())
        }

        /// 接受通话
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn accept_call(
            origin: OriginFor<T>,
            call_id: CallId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ActiveCalls::<T>::try_mutate(call_id, |maybe_call| -> DispatchResult {
                let call = maybe_call.as_mut().ok_or(Error::<T>::CallNotFound)?;
                ensure!(call.callee == who, Error::<T>::Unauthorized);
                ensure!(call.state == CallState::Ringing, Error::<T>::CallAlreadyEnded);

                call.state = CallState::Connecting;

                Self::deposit_event(Event::CallAccepted { call_id });
                Ok(())
            })
        }

        /// 拒绝通话
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn reject_call(
            origin: OriginFor<T>,
            call_id: CallId,
            reason: RejectReason,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let call = ActiveCalls::<T>::get(call_id).ok_or(Error::<T>::CallNotFound)?;
            ensure!(call.callee == who, Error::<T>::Unauthorized);

            Self::end_call_internal(call_id, CallEndReason::Rejected(reason))?;

            Self::deposit_event(Event::CallRejected { call_id, reason });

            Ok(())
        }

        /// 结束通话
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn end_call(
            origin: OriginFor<T>,
            call_id: CallId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let call = ActiveCalls::<T>::get(call_id).ok_or(Error::<T>::CallNotFound)?;
            ensure!(call.caller == who || call.callee == who, Error::<T>::Unauthorized);

            Self::end_call_internal(call_id, CallEndReason::Normal)?;

            Ok(())
        }

        /// 更新通话质量(由OCW调用)
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn update_call_quality(
            origin: OriginFor<T>,
            call_id: CallId,
            quality: CallQuality,
        ) -> DispatchResult {
            // 仅允许OCW或特权账户调用
            ensure_root(origin)?;

            ActiveCalls::<T>::try_mutate(call_id, |maybe_call| -> DispatchResult {
                let call = maybe_call.as_mut().ok_or(Error::<T>::CallNotFound)?;
                call.quality = quality;
                Ok(())
            })
        }
    }

    impl<T: Config> Pallet<T> {
        /// 生成通话ID
        fn generate_call_id(caller: &T::AccountId, callee: &T::AccountId) -> CallId {
            // 使用时间戳 + 账户哈希生成唯一ID
            let now = frame_system::Pallet::<T>::block_number();
            let mut data = caller.encode();
            data.extend(callee.encode());
            data.extend(now.encode());
            sp_io::hashing::blake2_128(&data)
        }

        /// 内部结束通话逻辑
        fn end_call_internal(call_id: CallId, reason: CallEndReason) -> DispatchResult {
            let mut call = ActiveCalls::<T>::take(call_id).ok_or(Error::<T>::CallNotFound)?;

            let now = frame_system::Pallet::<T>::block_number();
            call.ended_at = Some(now);
            call.state = CallState::Ended;

            // 计算通话时长
            if let Some(started) = call.started_at {
                let blocks = now.saturating_sub(started);
                // 假设每块6秒
                call.duration = (blocks * 6u32.into()).saturated_into();
            }

            // 计算并扣除费用
            let fee = Self::calculate_call_fee(call.duration);
            // ... 扣费逻辑

            // 清除用户当前通话
            UserCurrentCall::<T>::remove(&call.caller);
            UserCurrentCall::<T>::remove(&call.callee);

            // 保存到历史记录
            CallHistory::<T>::insert(&call.caller, call_id, call.clone());
            CallHistory::<T>::insert(&call.callee, call_id, call.clone());

            Self::deposit_event(Event::CallEnded {
                call_id,
                duration: call.duration,
                fee
            });

            Ok(())
        }

        /// 计算通话费用
        fn calculate_call_fee(duration: u32) -> BalanceOf<T> {
            let minutes = duration / 60 + if duration % 60 > 0 { 1 } else { 0 };
            T::CallFeePerMinute::get() * minutes.into()
        }
    }
}
```

### 5.2 pallet-voice-room

```rust
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 房间最大成员数
        #[pallet::constant]
        type MaxRoomMembers: Get<u32>;

        /// 用户最多可创建的房间数
        #[pallet::constant]
        type MaxRoomsPerUser: Get<u32>;

        /// 创建房间押金
        #[pallet::constant]
        type RoomCreationDeposit: Get<BalanceOf<Self>>;
    }

    /// 房间信息
    #[pallet::storage]
    pub type Rooms<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        RoomId,
        Room<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 房间成员
    #[pallet::storage]
    pub type RoomMembers<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        RoomId,
        Blake2_128Concat,
        T::AccountId,
        RoomMember<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 用户当前所在房间
    #[pallet::storage]
    pub type UserCurrentRoom<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        RoomId,
        OptionQuery,
    >;

    /// 用户创建的房间列表
    #[pallet::storage]
    pub type UserOwnedRooms<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<RoomId, T::MaxRoomsPerUser>,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 房间已创建
        RoomCreated { room_id: RoomId, host: T::AccountId },
        /// 用户加入房间
        UserJoined { room_id: RoomId, user: T::AccountId },
        /// 用户离开房间
        UserLeft { room_id: RoomId, user: T::AccountId },
        /// 房间已关闭
        RoomClosed { room_id: RoomId },
        /// 用户被踢出
        UserKicked { room_id: RoomId, user: T::AccountId, by: T::AccountId },
        /// 用户被禁言
        UserMuted { room_id: RoomId, user: T::AccountId, muted: bool },
        /// 角色变更
        RoleChanged { room_id: RoomId, user: T::AccountId, new_role: MemberRole },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 房间不存在
        RoomNotFound,
        /// 房间已满
        RoomFull,
        /// 无权操作
        Unauthorized,
        /// 用户已在房间中
        AlreadyInRoom,
        /// 用户不在房间中
        NotInRoom,
        /// 超过创建房间数量限制
        TooManyRooms,
        /// 入场费不足
        InsufficientEntryFee,
        /// 房间已关闭
        RoomClosed,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 创建语音房间
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_room(
            origin: OriginFor<T>,
            name: BoundedVec<u8, ConstU32<64>>,
            config: RoomConfig<BalanceOf<T>>,
        ) -> DispatchResult {
            let host = ensure_signed(origin)?;

            // 检查用户创建的房间数量
            let owned_rooms = UserOwnedRooms::<T>::get(&host);
            ensure!(
                (owned_rooms.len() as u32) < T::MaxRoomsPerUser::get(),
                Error::<T>::TooManyRooms
            );

            // 扣除押金
            // ...

            let room_id = Self::generate_room_id(&host);
            let now = frame_system::Pallet::<T>::block_number();

            let room = Room {
                id: room_id,
                name,
                host: host.clone(),
                config,
                created_at: now,
                member_count: 1,
                is_active: true,
            };

            Rooms::<T>::insert(room_id, room);

            // 房主自动加入
            let member = RoomMember {
                account: host.clone(),
                role: MemberRole::Host,
                is_muted: false,
                joined_at: now,
            };
            RoomMembers::<T>::insert(room_id, &host, member);
            UserCurrentRoom::<T>::insert(&host, room_id);

            // 更新用户拥有的房间列表
            UserOwnedRooms::<T>::try_mutate(&host, |rooms| {
                rooms.try_push(room_id).map_err(|_| Error::<T>::TooManyRooms)
            })?;

            Self::deposit_event(Event::RoomCreated { room_id, host });

            Ok(())
        }

        /// 加入房间
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn join_room(
            origin: OriginFor<T>,
            room_id: RoomId,
        ) -> DispatchResult {
            let user = ensure_signed(origin)?;

            // 检查用户是否已在其他房间
            ensure!(!UserCurrentRoom::<T>::contains_key(&user), Error::<T>::AlreadyInRoom);

            Rooms::<T>::try_mutate(room_id, |maybe_room| -> DispatchResult {
                let room = maybe_room.as_mut().ok_or(Error::<T>::RoomNotFound)?;
                ensure!(room.is_active, Error::<T>::RoomClosed);
                ensure!(room.member_count < room.config.max_members, Error::<T>::RoomFull);

                // 检查并扣除入场费
                if room.config.entry_fee > 0u32.into() {
                    // ... 扣费逻辑
                }

                room.member_count += 1;

                let now = frame_system::Pallet::<T>::block_number();
                let member = RoomMember {
                    account: user.clone(),
                    role: MemberRole::Listener,
                    is_muted: false,
                    joined_at: now,
                };

                RoomMembers::<T>::insert(room_id, &user, member);
                UserCurrentRoom::<T>::insert(&user, room_id);

                Self::deposit_event(Event::UserJoined { room_id, user });

                Ok(())
            })
        }

        /// 离开房间
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn leave_room(
            origin: OriginFor<T>,
        ) -> DispatchResult {
            let user = ensure_signed(origin)?;

            let room_id = UserCurrentRoom::<T>::get(&user).ok_or(Error::<T>::NotInRoom)?;

            Self::remove_member_from_room(room_id, &user)?;

            Self::deposit_event(Event::UserLeft { room_id, user });

            Ok(())
        }

        /// 踢出用户
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn kick_user(
            origin: OriginFor<T>,
            room_id: RoomId,
            target: T::AccountId,
        ) -> DispatchResult {
            let operator = ensure_signed(origin)?;

            // 检查操作者权限
            let operator_member = RoomMembers::<T>::get(room_id, &operator)
                .ok_or(Error::<T>::NotInRoom)?;
            ensure!(
                operator_member.role == MemberRole::Host ||
                operator_member.role == MemberRole::CoHost,
                Error::<T>::Unauthorized
            );

            Self::remove_member_from_room(room_id, &target)?;

            Self::deposit_event(Event::UserKicked { room_id, user: target, by: operator });

            Ok(())
        }

        /// 设置静音
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn set_mute(
            origin: OriginFor<T>,
            room_id: RoomId,
            target: T::AccountId,
            muted: bool,
        ) -> DispatchResult {
            let operator = ensure_signed(origin)?;

            // 用户可以自己静音，或者主持人可以静音他人
            let is_self = operator == target;
            if !is_self {
                let operator_member = RoomMembers::<T>::get(room_id, &operator)
                    .ok_or(Error::<T>::NotInRoom)?;
                ensure!(
                    operator_member.role == MemberRole::Host ||
                    operator_member.role == MemberRole::CoHost,
                    Error::<T>::Unauthorized
                );
            }

            RoomMembers::<T>::try_mutate(room_id, &target, |maybe_member| -> DispatchResult {
                let member = maybe_member.as_mut().ok_or(Error::<T>::NotInRoom)?;
                member.is_muted = muted;
                Ok(())
            })?;

            Self::deposit_event(Event::UserMuted { room_id, user: target, muted });

            Ok(())
        }

        /// 设置用户角色
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn set_role(
            origin: OriginFor<T>,
            room_id: RoomId,
            target: T::AccountId,
            new_role: MemberRole,
        ) -> DispatchResult {
            let operator = ensure_signed(origin)?;

            // 只有房主可以设置角色
            let room = Rooms::<T>::get(room_id).ok_or(Error::<T>::RoomNotFound)?;
            ensure!(room.host == operator, Error::<T>::Unauthorized);

            // 不能改变自己的角色
            ensure!(operator != target, Error::<T>::Unauthorized);

            RoomMembers::<T>::try_mutate(room_id, &target, |maybe_member| -> DispatchResult {
                let member = maybe_member.as_mut().ok_or(Error::<T>::NotInRoom)?;
                member.role = new_role.clone();
                Ok(())
            })?;

            Self::deposit_event(Event::RoleChanged { room_id, user: target, new_role });

            Ok(())
        }

        /// 关闭房间
        #[pallet::call_index(6)]
        #[pallet::weight(10_000)]
        pub fn close_room(
            origin: OriginFor<T>,
            room_id: RoomId,
        ) -> DispatchResult {
            let operator = ensure_signed(origin)?;

            let room = Rooms::<T>::get(room_id).ok_or(Error::<T>::RoomNotFound)?;
            ensure!(room.host == operator, Error::<T>::Unauthorized);

            // 移除所有成员
            // ... 遍历并移除

            // 标记房间为非活跃
            Rooms::<T>::try_mutate(room_id, |maybe_room| -> DispatchResult {
                let room = maybe_room.as_mut().ok_or(Error::<T>::RoomNotFound)?;
                room.is_active = false;
                Ok(())
            })?;

            // 退还押金
            // ...

            Self::deposit_event(Event::RoomClosed { room_id });

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        fn generate_room_id(host: &T::AccountId) -> RoomId {
            let now = frame_system::Pallet::<T>::block_number();
            let mut data = host.encode();
            data.extend(now.encode());
            sp_io::hashing::blake2_128(&data)
        }

        fn remove_member_from_room(room_id: RoomId, user: &T::AccountId) -> DispatchResult {
            RoomMembers::<T>::remove(room_id, user);
            UserCurrentRoom::<T>::remove(user);

            Rooms::<T>::try_mutate(room_id, |maybe_room| -> DispatchResult {
                let room = maybe_room.as_mut().ok_or(Error::<T>::RoomNotFound)?;
                room.member_count = room.member_count.saturating_sub(1);

                // 如果房主离开，关闭房间或转移权限
                if room.host == *user {
                    room.is_active = false;
                }

                Ok(())
            })
        }
    }
}
```

---

## 6. 信令协议

### 6.1 WebSocket 信令消息格式

基于 go-chat 的 Protocol Buffer 设计：

```protobuf
syntax = "proto3";
package voice;

// 信令消息类型
enum SignalType {
    // 通话信令
    CALL_INVITE = 0;        // 通话邀请
    CALL_ACCEPT = 1;        // 接受通话
    CALL_REJECT = 2;        // 拒绝通话
    CALL_CANCEL = 3;        // 取消通话
    CALL_HANGUP = 4;        // 挂断
    CALL_BUSY = 5;          // 忙线

    // WebRTC信令
    SDP_OFFER = 10;         // SDP Offer
    SDP_ANSWER = 11;        // SDP Answer
    ICE_CANDIDATE = 12;     // ICE候选

    // 房间信令
    ROOM_JOIN = 20;         // 加入房间
    ROOM_LEAVE = 21;        // 离开房间
    ROOM_MUTE = 22;         // 静音状态
    ROOM_ROLE = 23;         // 角色变更
    ROOM_KICK = 24;         // 踢出房间

    // 心跳
    HEARTBEAT = 30;         // 心跳
    HEARTBEAT_ACK = 31;     // 心跳响应
}

// 通用信令消息
message SignalMessage {
    SignalType type = 1;
    string from = 2;            // 发送者账户地址
    string to = 3;              // 接收者账户地址(或房间ID)
    string call_id = 4;         // 通话ID
    string room_id = 5;         // 房间ID
    bytes payload = 6;          // 具体数据
    int64 timestamp = 7;        // 时间戳
    bytes signature = 8;        // 签名
}

// 通话邀请
message CallInvite {
    string caller_name = 1;
    string caller_avatar = 2;
    CallType call_type = 3;
}

// SDP消息
message SdpMessage {
    string sdp = 1;
    string type = 2;            // offer/answer
}

// ICE候选
message IceCandidate {
    string candidate = 1;
    string sdp_mid = 2;
    int32 sdp_mline_index = 3;
}

// 房间状态更新
message RoomStateUpdate {
    repeated RoomMemberState members = 1;
}

message RoomMemberState {
    string account = 1;
    string nickname = 2;
    string avatar = 3;
    MemberRole role = 4;
    bool is_muted = 5;
    bool is_speaking = 6;       // 正在说话
}

enum CallType {
    AUDIO = 0;
    VIDEO = 1;
}

enum MemberRole {
    HOST = 0;
    CO_HOST = 1;
    SPEAKER = 2;
    LISTENER = 3;
}
```

### 6.2 信令服务器实现（基于go-chat）

```go
// internal/voice/signal_server.go
package voice

import (
    "github.com/gorilla/websocket"
    "google.golang.org/protobuf/proto"
)

type SignalServer struct {
    clients    map[string]*VoiceClient  // accountId -> client
    rooms      map[string]*VoiceRoom    // roomId -> room
    register   chan *VoiceClient
    unregister chan *VoiceClient
    signal     chan *SignalMessage
}

type VoiceClient struct {
    accountId string
    conn      *websocket.Conn
    server    *SignalServer
    send      chan []byte
    currentCall   string
    currentRoom   string
}

type VoiceRoom struct {
    roomId  string
    members map[string]*VoiceClient
}

func NewSignalServer() *SignalServer {
    return &SignalServer{
        clients:    make(map[string]*VoiceClient),
        rooms:      make(map[string]*VoiceRoom),
        register:   make(chan *VoiceClient),
        unregister: make(chan *VoiceClient),
        signal:     make(chan *SignalMessage, 256),
    }
}

func (s *SignalServer) Run() {
    for {
        select {
        case client := <-s.register:
            s.clients[client.accountId] = client

        case client := <-s.unregister:
            if _, ok := s.clients[client.accountId]; ok {
                delete(s.clients, client.accountId)
                close(client.send)
            }

        case msg := <-s.signal:
            s.handleSignal(msg)
        }
    }
}

func (s *SignalServer) handleSignal(msg *SignalMessage) {
    switch msg.Type {
    case SignalType_CALL_INVITE:
        s.handleCallInvite(msg)
    case SignalType_SDP_OFFER, SignalType_SDP_ANSWER:
        s.handleSdp(msg)
    case SignalType_ICE_CANDIDATE:
        s.handleIceCandidate(msg)
    case SignalType_ROOM_JOIN:
        s.handleRoomJoin(msg)
    case SignalType_ROOM_LEAVE:
        s.handleRoomLeave(msg)
    // ...
    }
}

func (s *SignalServer) handleCallInvite(msg *SignalMessage) {
    // 验证签名
    if !s.verifySignature(msg) {
        return
    }

    // 检查被叫方是否在线
    callee, ok := s.clients[msg.To]
    if !ok {
        // 发送离线通知给主叫方
        s.sendToClient(msg.From, &SignalMessage{
            Type: SignalType_CALL_BUSY,
            CallId: msg.CallId,
        })
        return
    }

    // 检查被叫方是否忙
    if callee.currentCall != "" {
        s.sendToClient(msg.From, &SignalMessage{
            Type: SignalType_CALL_BUSY,
            CallId: msg.CallId,
        })
        return
    }

    // 转发邀请
    s.sendToClient(msg.To, msg)
}

func (s *SignalServer) handleSdp(msg *SignalMessage) {
    // 直接转发SDP到目标
    s.sendToClient(msg.To, msg)
}

func (s *SignalServer) handleIceCandidate(msg *SignalMessage) {
    // 直接转发ICE候选到目标
    s.sendToClient(msg.To, msg)
}

func (s *SignalServer) handleRoomJoin(msg *SignalMessage) {
    client, ok := s.clients[msg.From]
    if !ok {
        return
    }

    room, ok := s.rooms[msg.RoomId]
    if !ok {
        room = &VoiceRoom{
            roomId:  msg.RoomId,
            members: make(map[string]*VoiceClient),
        }
        s.rooms[msg.RoomId] = room
    }

    room.members[client.accountId] = client
    client.currentRoom = msg.RoomId

    // 广播成员列表更新
    s.broadcastRoomState(msg.RoomId)
}

func (s *SignalServer) broadcastRoomState(roomId string) {
    room, ok := s.rooms[roomId]
    if !ok {
        return
    }

    state := &RoomStateUpdate{
        Members: make([]*RoomMemberState, 0, len(room.members)),
    }

    for accountId, _ := range room.members {
        state.Members = append(state.Members, &RoomMemberState{
            Account: accountId,
            // ... 其他状态
        })
    }

    payload, _ := proto.Marshal(state)
    msg := &SignalMessage{
        Type:    SignalType_ROOM_JOIN,
        RoomId:  roomId,
        Payload: payload,
    }

    for _, client := range room.members {
        s.sendToClient(client.accountId, msg)
    }
}

func (s *SignalServer) sendToClient(accountId string, msg *SignalMessage) {
    client, ok := s.clients[accountId]
    if !ok {
        return
    }

    data, err := proto.Marshal(msg)
    if err != nil {
        return
    }

    select {
    case client.send <- data:
    default:
        // 发送缓冲满，关闭连接
        close(client.send)
        delete(s.clients, accountId)
    }
}

func (s *SignalServer) verifySignature(msg *SignalMessage) bool {
    // 使用sr25519验证签名
    // ...
    return true
}
```

---

## 7. 数据结构

### 7.1 链上数据结构

```rust
// 通话ID类型
pub type CallId = [u8; 16];

// 房间ID类型
pub type RoomId = [u8; 16];

// 通话状态
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum CallState {
    Ringing,
    Connecting,
    Connected,
    Ended,
}

// 通话类型
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum CallType {
    Audio,
    Video,
}

// 通话质量统计
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen, Default)]
pub struct CallQuality {
    pub avg_bitrate: u32,       // 平均码率
    pub packet_loss: u8,        // 丢包率(0-100)
    pub jitter: u16,            // 抖动(ms)
    pub latency: u16,           // 延迟(ms)
}

// 通话记录
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct CallRecord<AccountId, BlockNumber, Balance> {
    pub call_id: CallId,
    pub caller: AccountId,
    pub callee: AccountId,
    pub state: CallState,
    pub call_type: CallType,
    pub started_at: Option<BlockNumber>,
    pub ended_at: Option<BlockNumber>,
    pub duration: u32,
    pub quality: CallQuality,
    pub fee_paid: Balance,
}

// 拒绝原因
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum RejectReason {
    Busy,
    Decline,
    Timeout,
    Offline,
}

// 结束原因
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum CallEndReason {
    Normal,
    Rejected(RejectReason),
    NetworkError,
    Timeout,
}

// 房间配置
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct RoomConfig<Balance> {
    pub max_members: u32,
    pub is_public: bool,
    pub entry_fee: Balance,
    pub speaking_mode: SpeakingMode,
}

// 发言模式
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum SpeakingMode {
    FreeSpeak,
    HostOnly,
    RaiseHand,
    Sequential,
}

// 房间信息
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct Room<AccountId, Balance, BlockNumber> {
    pub id: RoomId,
    pub name: BoundedVec<u8, ConstU32<64>>,
    pub host: AccountId,
    pub config: RoomConfig<Balance>,
    pub created_at: BlockNumber,
    pub member_count: u32,
    pub is_active: bool,
}

// 房间成员
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct RoomMember<AccountId, BlockNumber> {
    pub account: AccountId,
    pub role: MemberRole,
    pub is_muted: bool,
    pub joined_at: BlockNumber,
}

// 成员角色
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum MemberRole {
    Host,
    CoHost,
    Speaker,
    Listener,
}
```

### 7.2 链下数据结构（MySQL）

```sql
-- 通话详细记录（扩展链上数据）
CREATE TABLE voice_call_details (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    call_id VARCHAR(64) NOT NULL UNIQUE,
    caller_address VARCHAR(128) NOT NULL,
    callee_address VARCHAR(128) NOT NULL,
    call_type ENUM('audio', 'video') NOT NULL,
    state ENUM('ringing', 'connecting', 'connected', 'ended') NOT NULL,
    started_at DATETIME,
    ended_at DATETIME,
    duration_seconds INT DEFAULT 0,
    -- 质量统计
    avg_bitrate INT,
    packet_loss DECIMAL(5,2),
    jitter_ms INT,
    latency_ms INT,
    -- 费用信息
    fee_amount DECIMAL(20,10),
    fee_currency VARCHAR(10) DEFAULT 'DUST',
    -- 索引
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_caller (caller_address),
    INDEX idx_callee (callee_address),
    INDEX idx_created (created_at)
);

-- 房间详细信息
CREATE TABLE voice_rooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(256) NOT NULL,
    host_address VARCHAR(128) NOT NULL,
    max_members INT DEFAULT 50,
    is_public BOOLEAN DEFAULT TRUE,
    entry_fee DECIMAL(20,10) DEFAULT 0,
    speaking_mode ENUM('free', 'host_only', 'raise_hand', 'sequential') DEFAULT 'free',
    member_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    INDEX idx_host (host_address),
    INDEX idx_active (is_active)
);

-- 房间成员记录
CREATE TABLE voice_room_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id VARCHAR(64) NOT NULL,
    member_address VARCHAR(128) NOT NULL,
    role ENUM('host', 'co_host', 'speaker', 'listener') NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    UNIQUE KEY uk_room_member (room_id, member_address),
    INDEX idx_room (room_id),
    INDEX idx_member (member_address)
);

-- 语音消息记录
CREATE TABLE voice_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    message_id VARCHAR(64) NOT NULL UNIQUE,
    sender_address VARCHAR(128) NOT NULL,
    receiver_address VARCHAR(128),  -- NULL表示群消息
    group_id VARCHAR(64),           -- 群ID
    ipfs_cid VARCHAR(256) NOT NULL,
    duration_seconds INT NOT NULL,
    file_size INT,
    transcription TEXT,             -- AI转文字
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sender (sender_address),
    INDEX idx_receiver (receiver_address),
    INDEX idx_group (group_id)
);

-- 用户通话统计
CREATE TABLE user_voice_stats (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_address VARCHAR(128) NOT NULL UNIQUE,
    total_calls INT DEFAULT 0,
    total_duration_seconds BIGINT DEFAULT 0,
    total_fee_paid DECIMAL(20,10) DEFAULT 0,
    total_earned DECIMAL(20,10) DEFAULT 0,
    daily_duration_seconds INT DEFAULT 0,
    last_call_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_address)
);
```

---

## 8. 安全设计

### 8.1 端到端加密

```
┌──────────────┐                              ┌──────────────┐
│   Alice      │                              │    Bob       │
├──────────────┤                              ├──────────────┤
│ 私钥: sk_a   │                              │ 私钥: sk_b   │
│ 公钥: pk_a   │                              │ 公钥: pk_b   │
└──────┬───────┘                              └──────┬───────┘
       │                                             │
       │  1. 获取Bob的公钥(从链上)                    │
       │ ─────────────────────────────────────────>  │
       │                                             │
       │  2. 生成共享密钥                             │
       │  shared_key = ECDH(sk_a, pk_b)             │
       │                                             │
       │  3. 加密音频帧                              │
       │  encrypted = AES-GCM(shared_key, audio)    │
       │                                             │
       │  4. 发送加密音频                            │
       │ ─────────────────────────────────────────>  │
       │                                             │
       │                      5. 生成相同共享密钥     │
       │                      shared_key = ECDH(sk_b, pk_a)
       │                                             │
       │                      6. 解密音频帧          │
       │                      audio = AES-GCM-Decrypt(shared_key, encrypted)
```

### 8.2 签名验证

所有信令消息必须携带签名：

```typescript
// 前端签名示例
import { signMessage } from '@polkadot/util-crypto';

async function signSignalMessage(message: SignalMessage, keyPair: KeyringPair): Promise<SignalMessage> {
    const payload = encodeSignalPayload(message);
    const signature = keyPair.sign(payload);

    return {
        ...message,
        signature: u8aToHex(signature),
    };
}

function encodeSignalPayload(message: SignalMessage): Uint8Array {
    // 按固定顺序编码字段
    const encoder = new TextEncoder();
    return encoder.encode(
        `${message.type}|${message.from}|${message.to}|${message.callId}|${message.timestamp}`
    );
}
```

### 8.3 防攻击措施

| 攻击类型 | 防护措施 |
|---------|---------|
| 重放攻击 | 消息包含时间戳，服务器检查时效性 |
| 中间人攻击 | 端到端加密 + 签名验证 |
| DDoS | 频率限制 + 链上押金机制 |
| 身份伪造 | 区块链账户签名验证 |
| 窃听 | DTLS-SRTP 加密 |

### 8.4 隐私保护

- 通话记录哈希上链，原始数据链下存储
- 语音消息加密存储在IPFS
- 用户可删除自己的通话记录
- 支持阅后即焚模式

---

## 9. 前端实现

### 9.1 React Web端

```typescript
// src/features/voice/VoiceCallManager.ts
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';

export class VoiceCallManager {
    private api: ApiPromise;
    private keyPair: KeyringPair;
    private signalSocket: WebSocket;
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;

    // 回调
    public onCallStateChange?: (state: CallState) => void;
    public onRemoteStream?: (stream: MediaStream) => void;
    public onError?: (error: Error) => void;

    constructor(api: ApiPromise, keyPair: KeyringPair, signalServerUrl: string) {
        this.api = api;
        this.keyPair = keyPair;
        this.signalSocket = new WebSocket(signalServerUrl);
        this.setupSignalHandlers();
    }

    private setupSignalHandlers() {
        this.signalSocket.onmessage = async (event) => {
            const message = SignalMessage.decode(new Uint8Array(await event.data.arrayBuffer()));
            await this.handleSignalMessage(message);
        };
    }

    private async handleSignalMessage(message: SignalMessage) {
        switch (message.type) {
            case SignalType.CALL_INVITE:
                this.handleIncomingCall(message);
                break;
            case SignalType.CALL_ACCEPT:
                await this.handleCallAccepted(message);
                break;
            case SignalType.SDP_OFFER:
                await this.handleSdpOffer(message);
                break;
            case SignalType.SDP_ANSWER:
                await this.handleSdpAnswer(message);
                break;
            case SignalType.ICE_CANDIDATE:
                await this.handleIceCandidate(message);
                break;
            case SignalType.CALL_HANGUP:
                this.handleHangup(message);
                break;
        }
    }

    // 发起通话
    async initiateCall(calleeAddress: string, callType: CallType = CallType.AUDIO): Promise<string> {
        // 1. 链上发起通话
        const tx = this.api.tx.voiceCall.initiateCall(calleeAddress, callType);
        await tx.signAndSend(this.keyPair);

        // 2. 获取本地媒体流
        this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === CallType.VIDEO,
        });

        // 3. 创建PeerConnection
        this.peerConnection = this.createPeerConnection();

        // 4. 添加本地流
        this.localStream.getTracks().forEach(track => {
            this.peerConnection!.addTrack(track, this.localStream!);
        });

        // 5. 生成callId
        const callId = this.generateCallId(calleeAddress);

        // 6. 发送信令邀请
        await this.sendSignal({
            type: SignalType.CALL_INVITE,
            from: this.keyPair.address,
            to: calleeAddress,
            callId,
            payload: CallInvite.encode({
                callerName: 'User',
                callType,
            }).finish(),
            timestamp: Date.now(),
        });

        this.onCallStateChange?.(CallState.Ringing);
        return callId;
    }

    // 接受通话
    async acceptCall(callId: string): Promise<void> {
        // 1. 链上接受
        const tx = this.api.tx.voiceCall.acceptCall(callId);
        await tx.signAndSend(this.keyPair);

        // 2. 获取本地流
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 3. 创建PeerConnection
        this.peerConnection = this.createPeerConnection();

        this.localStream.getTracks().forEach(track => {
            this.peerConnection!.addTrack(track, this.localStream!);
        });

        this.onCallStateChange?.(CallState.Connecting);
    }

    // 挂断
    async hangup(callId: string): Promise<void> {
        // 1. 链上结束
        const tx = this.api.tx.voiceCall.endCall(callId);
        await tx.signAndSend(this.keyPair);

        // 2. 发送信令
        await this.sendSignal({
            type: SignalType.CALL_HANGUP,
            callId,
        });

        // 3. 清理资源
        this.cleanup();
    }

    private createPeerConnection(): RTCPeerConnection {
        const config: RTCConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                {
                    urls: 'turn:your-turn-server.com:3478',
                    username: 'user',
                    credential: 'pass',
                },
            ],
        };

        const pc = new RTCPeerConnection(config);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: SignalType.ICE_CANDIDATE,
                    payload: IceCandidate.encode({
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                    }).finish(),
                });
            }
        };

        pc.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.onRemoteStream?.(this.remoteStream);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                this.onCallStateChange?.(CallState.Connected);
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.onCallStateChange?.(CallState.Ended);
            }
        };

        return pc;
    }

    private async handleCallAccepted(message: SignalMessage): Promise<void> {
        if (!this.peerConnection) return;

        // 创建并发送Offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        await this.sendSignal({
            type: SignalType.SDP_OFFER,
            to: message.from,
            callId: message.callId,
            payload: SdpMessage.encode({
                sdp: offer.sdp!,
                type: 'offer',
            }).finish(),
        });

        this.onCallStateChange?.(CallState.Connecting);
    }

    private async handleSdpOffer(message: SignalMessage): Promise<void> {
        if (!this.peerConnection) return;

        const sdpMsg = SdpMessage.decode(message.payload);
        await this.peerConnection.setRemoteDescription({
            type: 'offer',
            sdp: sdpMsg.sdp,
        });

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        await this.sendSignal({
            type: SignalType.SDP_ANSWER,
            to: message.from,
            callId: message.callId,
            payload: SdpMessage.encode({
                sdp: answer.sdp!,
                type: 'answer',
            }).finish(),
        });
    }

    private async handleSdpAnswer(message: SignalMessage): Promise<void> {
        if (!this.peerConnection) return;

        const sdpMsg = SdpMessage.decode(message.payload);
        await this.peerConnection.setRemoteDescription({
            type: 'answer',
            sdp: sdpMsg.sdp,
        });
    }

    private async handleIceCandidate(message: SignalMessage): Promise<void> {
        if (!this.peerConnection) return;

        const iceMsg = IceCandidate.decode(message.payload);
        await this.peerConnection.addIceCandidate({
            candidate: iceMsg.candidate,
            sdpMid: iceMsg.sdpMid,
            sdpMLineIndex: iceMsg.sdpMLineIndex,
        });
    }

    private cleanup(): void {
        this.localStream?.getTracks().forEach(track => track.stop());
        this.peerConnection?.close();
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.onCallStateChange?.(CallState.Ended);
    }

    private async sendSignal(message: Partial<SignalMessage>): Promise<void> {
        const fullMessage: SignalMessage = {
            type: message.type!,
            from: this.keyPair.address,
            to: message.to || '',
            callId: message.callId || '',
            roomId: message.roomId || '',
            payload: message.payload || new Uint8Array(),
            timestamp: Date.now(),
            signature: new Uint8Array(),
        };

        // 签名
        const payload = this.encodeForSignature(fullMessage);
        fullMessage.signature = this.keyPair.sign(payload);

        const encoded = SignalMessage.encode(fullMessage).finish();
        this.signalSocket.send(encoded);
    }

    private encodeForSignature(message: SignalMessage): Uint8Array {
        const encoder = new TextEncoder();
        return encoder.encode(
            `${message.type}|${message.from}|${message.to}|${message.callId}|${message.timestamp}`
        );
    }

    private generateCallId(callee: string): string {
        const data = `${this.keyPair.address}${callee}${Date.now()}`;
        // 使用blake2哈希
        return blake2AsHex(data, 128);
    }
}
```

### 9.2 语音消息组件

```typescript
// src/features/voice/VoiceMessageRecorder.tsx
import React, { useState, useRef } from 'react';
import { Button, Progress, message } from 'antd';
import { AudioOutlined, SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApi } from '@/hooks/useApi';
import { uploadToIPFS } from '@/lib/chat-ipfs';

interface VoiceMessageRecorderProps {
    onSend: (cid: string, duration: number) => Promise<void>;
    maxDuration?: number; // 最大录制时长(秒)
}

export const VoiceMessageRecorder: React.FC<VoiceMessageRecorderProps> = ({
    onSend,
    maxDuration = 60,
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [uploading, setUploading] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
            });

            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
            };

            mediaRecorder.start(100); // 每100ms收集一次数据
            setIsRecording(true);
            setDuration(0);

            // 开始计时
            timerRef.current = setInterval(() => {
                setDuration(prev => {
                    if (prev >= maxDuration) {
                        stopRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);

        } catch (error) {
            message.error('无法访问麦克风');
            console.error(error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            streamRef.current?.getTracks().forEach(track => track.stop());
            setIsRecording(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    };

    const cancelRecording = () => {
        stopRecording();
        setAudioBlob(null);
        setDuration(0);
    };

    const sendVoiceMessage = async () => {
        if (!audioBlob) return;

        try {
            setUploading(true);

            // 转换为ArrayBuffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 上传到IPFS
            const cid = await uploadToIPFS(uint8Array);

            // 调用发送回调
            await onSend(cid, duration);

            // 清理
            setAudioBlob(null);
            setDuration(0);

            message.success('语音消息已发送');
        } catch (error) {
            message.error('发送失败');
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="voice-recorder">
            {!audioBlob ? (
                <Button
                    type={isRecording ? 'primary' : 'default'}
                    icon={<AudioOutlined />}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    danger={isRecording}
                >
                    {isRecording ? `录制中 ${duration}s` : '按住录音'}
                </Button>
            ) : (
                <div className="voice-preview">
                    <audio src={URL.createObjectURL(audioBlob)} controls />
                    <span>{duration}s</span>
                    <Button
                        icon={<DeleteOutlined />}
                        onClick={cancelRecording}
                        danger
                    />
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={sendVoiceMessage}
                        loading={uploading}
                    >
                        发送
                    </Button>
                </div>
            )}

            {isRecording && (
                <Progress
                    percent={(duration / maxDuration) * 100}
                    showInfo={false}
                    status="active"
                />
            )}
        </div>
    );
};
```

### 9.3 通话界面组件

```typescript
// src/features/voice/VoiceCallUI.tsx
import React, { useEffect, useState } from 'react';
import { Modal, Button, Avatar, Typography } from 'antd';
import {
    PhoneOutlined,
    AudioMutedOutlined,
    AudioOutlined,
    SwapOutlined,
} from '@ant-design/icons';
import { VoiceCallManager, CallState } from './VoiceCallManager';
import { formatDuration } from '@/utils/time';

interface VoiceCallUIProps {
    callManager: VoiceCallManager;
    visible: boolean;
    calleeInfo?: {
        address: string;
        name: string;
        avatar: string;
    };
    isIncoming?: boolean;
    onClose: () => void;
}

export const VoiceCallUI: React.FC<VoiceCallUIProps> = ({
    callManager,
    visible,
    calleeInfo,
    isIncoming,
    onClose,
}) => {
    const [callState, setCallState] = useState<CallState>(CallState.Idle);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);

    const audioRef = React.useRef<HTMLAudioElement>(null);

    useEffect(() => {
        callManager.onCallStateChange = setCallState;
        callManager.onRemoteStream = (stream) => {
            if (audioRef.current) {
                audioRef.current.srcObject = stream;
            }
        };

        return () => {
            callManager.onCallStateChange = undefined;
            callManager.onRemoteStream = undefined;
        };
    }, [callManager]);

    // 通话计时
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (callState === CallState.Connected) {
            timer = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [callState]);

    const handleAccept = async () => {
        await callManager.acceptCall(callManager.currentCallId!);
    };

    const handleReject = async () => {
        await callManager.rejectCall(callManager.currentCallId!);
        onClose();
    };

    const handleHangup = async () => {
        await callManager.hangup(callManager.currentCallId!);
        onClose();
    };

    const toggleMute = () => {
        callManager.toggleMute();
        setIsMuted(!isMuted);
    };

    const getStatusText = () => {
        switch (callState) {
            case CallState.Ringing:
                return isIncoming ? '来电...' : '呼叫中...';
            case CallState.Connecting:
                return '连接中...';
            case CallState.Connected:
                return formatDuration(duration);
            default:
                return '';
        }
    };

    return (
        <Modal
            open={visible}
            closable={false}
            footer={null}
            centered
            className="voice-call-modal"
        >
            <div className="call-content">
                <Avatar size={80} src={calleeInfo?.avatar}>
                    {calleeInfo?.name?.[0]}
                </Avatar>

                <Typography.Title level={4}>
                    {calleeInfo?.name || calleeInfo?.address}
                </Typography.Title>

                <Typography.Text type="secondary">
                    {getStatusText()}
                </Typography.Text>

                <audio ref={audioRef} autoPlay />

                <div className="call-actions">
                    {isIncoming && callState === CallState.Ringing ? (
                        <>
                            <Button
                                shape="circle"
                                size="large"
                                danger
                                icon={<PhoneOutlined rotate={135} />}
                                onClick={handleReject}
                            />
                            <Button
                                shape="circle"
                                size="large"
                                type="primary"
                                icon={<PhoneOutlined />}
                                onClick={handleAccept}
                                style={{ backgroundColor: '#52c41a' }}
                            />
                        </>
                    ) : (
                        <>
                            <Button
                                shape="circle"
                                size="large"
                                icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                                onClick={toggleMute}
                                type={isMuted ? 'primary' : 'default'}
                            />
                            <Button
                                shape="circle"
                                size="large"
                                danger
                                icon={<PhoneOutlined rotate={135} />}
                                onClick={handleHangup}
                            />
                            <Button
                                shape="circle"
                                size="large"
                                icon={<SwapOutlined />}
                                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                                type={isSpeakerOn ? 'primary' : 'default'}
                            />
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};
```

---

## 10. 部署架构

### 10.1 Docker Compose 部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 信令服务器
  signal-server:
    build:
      context: ./signal-server
      dockerfile: Dockerfile
    ports:
      - "8888:8888"
    environment:
      - MYSQL_HOST=mysql
      - KAFKA_HOST=kafka:9092
      - REDIS_HOST=redis:6379
    depends_on:
      - mysql
      - kafka
      - redis
    restart: unless-stopped

  # TURN/STUN服务器
  coturn:
    image: coturn/coturn:latest
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
      - "5349:5349/udp"
      - "5349:5349/tcp"
      - "49152-65535:49152-65535/udp"
    volumes:
      - ./coturn/turnserver.conf:/etc/coturn/turnserver.conf
    restart: unless-stopped

  # 媒体服务器 (可选，用于多人房间SFU)
  media-server:
    build:
      context: ./starrtc-server
      dockerfile: Dockerfile
    ports:
      - "19903:19903/tcp"  # msgServer
      - "10086:10086/udp"  # voipServer
      - "19906:19906/tcp"  # chatRoomServer
    restart: unless-stopped

  # MySQL
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_DATABASE: voice_chat
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  # Redis (用于缓存和会话)
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # Kafka (消息队列)
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    restart: unless-stopped

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    restart: unless-stopped

  # IPFS节点
  ipfs:
    image: ipfs/kubo:latest
    ports:
      - "4001:4001"
      - "5001:5001"
      - "8080:8080"
    volumes:
      - ipfs_data:/data/ipfs
    restart: unless-stopped

  # Stardust节点
  stardust-node:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "9944:9944"  # WS RPC
      - "9933:9933"  # HTTP RPC
      - "30333:30333" # P2P
    volumes:
      - chain_data:/data
    command: >
      --base-path /data
      --chain local
      --ws-external
      --rpc-external
      --rpc-cors all
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
  ipfs_data:
  chain_data:
```

### 10.2 TURN服务器配置

```conf
# coturn/turnserver.conf
listening-port=3478
tls-listening-port=5349

# 外部IP（需要替换为实际IP）
external-ip=YOUR_PUBLIC_IP

# 认证
lt-cred-mech
user=voiceuser:voicepass

# 日志
log-file=/var/log/turnserver.log
verbose

# 安全
fingerprint
no-multicast-peers

# 端口范围
min-port=49152
max-port=65535

# 域名
realm=voice.stardust.network

# TLS证书
cert=/etc/coturn/cert.pem
pkey=/etc/coturn/key.pem
```

### 10.3 Nginx配置

```nginx
# nginx.conf
upstream signal_server {
    server signal-server:8888;
}

upstream stardust_node {
    server stardust-node:9944;
}

server {
    listen 443 ssl http2;
    server_name voice.stardust.network;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # 信令服务WebSocket
    location /signal {
        proxy_pass http://signal_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # 区块链节点WebSocket
    location /ws {
        proxy_pass http://stardust_node;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # 前端静态文件
    location / {
        root /var/www/stardust-dapp/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 11. 开发计划

### 11.1 阶段划分

```
Phase 1: 语音消息 (2周)
├── Week 1: 后端实现
│   ├── 扩展pallet-chat支持语音元数据
│   ├── 实现stardust-media-common音频验证
│   └── IPFS集成测试
└── Week 2: 前端实现
    ├── 语音录制组件
    ├── 语音播放组件
    └── 集成测试

Phase 2: 一对一通话 (3周)
├── Week 3: 区块链层
│   ├── 实现pallet-voice-call
│   ├── 通话状态管理
│   └── 计费逻辑
├── Week 4: 服务层
│   ├── 信令服务器开发
│   ├── TURN服务器部署
│   └── 签名验证
└── Week 5: 客户端层
    ├── WebRTC集成
    ├── 通话UI开发
    └── 端到端测试

Phase 3: 语音房间 (3周)
├── Week 6: 区块链层
│   ├── 实现pallet-voice-room
│   ├── 成员管理
│   └── 权限控制
├── Week 7: 服务层
│   ├── 房间信令处理
│   ├── SFU媒体服务器
│   └── 房间状态同步
└── Week 8: 客户端层
    ├── 房间列表UI
    ├── 房间内交互
    └── 多人音频混音

Phase 4: 激励与优化 (2周)
├── Week 9: 激励机制
│   ├── 通话挖矿pallet
│   ├── 礼物打赏系统
│   └── VIP会员功能
└── Week 10: 优化与测试
    ├── 性能优化
    ├── 安全审计
    └── 上线准备
```

### 11.2 里程碑

| 里程碑 | 目标 | 交付物 |
|--------|------|--------|
| M1 | 语音消息MVP | 可发送和播放语音消息 |
| M2 | 一对一通话 | 完整的P2P语音通话 |
| M3 | 语音房间 | 多人语音房间功能 |
| M4 | 正式上线 | 完整的语音聊天系统 |

---

## 12. API参考

### 12.1 Pallet Extrinsics

#### pallet-voice-call

| 方法 | 参数 | 描述 |
|------|------|------|
| `initiate_call` | `callee: AccountId, call_type: CallType` | 发起通话 |
| `accept_call` | `call_id: CallId` | 接受通话 |
| `reject_call` | `call_id: CallId, reason: RejectReason` | 拒绝通话 |
| `end_call` | `call_id: CallId` | 结束通话 |

#### pallet-voice-room

| 方法 | 参数 | 描述 |
|------|------|------|
| `create_room` | `name: Vec<u8>, config: RoomConfig` | 创建房间 |
| `join_room` | `room_id: RoomId` | 加入房间 |
| `leave_room` | - | 离开房间 |
| `kick_user` | `room_id: RoomId, target: AccountId` | 踢出用户 |
| `set_mute` | `room_id: RoomId, target: AccountId, muted: bool` | 设置静音 |
| `set_role` | `room_id: RoomId, target: AccountId, role: MemberRole` | 设置角色 |
| `close_room` | `room_id: RoomId` | 关闭房间 |

### 12.2 RPC查询

```typescript
// 查询用户当前通话
api.query.voiceCall.userCurrentCall(accountId)

// 查询通话记录
api.query.voiceCall.callHistory(accountId, callId)

// 查询活跃通话
api.query.voiceCall.activeCalls(callId)

// 查询房间信息
api.query.voiceRoom.rooms(roomId)

// 查询房间成员
api.query.voiceRoom.roomMembers(roomId, accountId)

// 查询用户当前房间
api.query.voiceRoom.userCurrentRoom(accountId)
```

### 12.3 事件监听

```typescript
// 监听通话事件
api.query.system.events((events) => {
    events.forEach((record) => {
        const { event } = record;

        if (api.events.voiceCall.CallInitiated.is(event)) {
            const [callId, caller, callee] = event.data;
            console.log(`New call: ${callId} from ${caller} to ${callee}`);
        }

        if (api.events.voiceCall.CallEnded.is(event)) {
            const [callId, duration, fee] = event.data;
            console.log(`Call ended: ${callId}, duration: ${duration}s, fee: ${fee}`);
        }

        if (api.events.voiceRoom.UserJoined.is(event)) {
            const [roomId, user] = event.data;
            console.log(`User ${user} joined room ${roomId}`);
        }
    });
});
```

---

## 附录

### A. 参考项目

| 项目 | 用途 | 链接 |
|------|------|------|
| go-chat | 信令服务器架构 | 本地: `/home/xiaodong/文档/xuanxue/yuyin/go-chat` |
| starrtc-server | 媒体服务器参考 | 本地: `/home/xiaodong/文档/xuanxue/yuyin/starrtc-server` |
| ARChatRoom | 客户端SDK参考 | 本地: `/home/xiaodong/文档/xuanxue/yuyin/ARChatRoom` |
| imsdka | IM SDK架构 | 本地: `/home/xiaodong/文档/xuanxue/yuyin/imsdka` |
| stardust | 区块链基础 | 本地: `/home/xiaodong/文档/stardust` |

### B. 技术文档

- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Substrate Pallet开发](https://docs.substrate.io/tutorials/build-application-logic/)
- [Protocol Buffers](https://developers.google.com/protocol-buffers)
- [TURN/STUN协议](https://tools.ietf.org/html/rfc5766)

### C. 术语表

| 术语 | 解释 |
|------|------|
| SDP | Session Description Protocol，会话描述协议 |
| ICE | Interactive Connectivity Establishment，交互式连接建立 |
| STUN | Session Traversal Utilities for NAT，NAT穿透 |
| TURN | Traversal Using Relays around NAT，NAT中继 |
| SFU | Selective Forwarding Unit，选择性转发单元 |
| MCU | Multipoint Control Unit，多点控制单元 |
| OCW | Off-chain Worker，链下工作机 |
| CID | Content Identifier，IPFS内容标识符 |

---

*文档版本: v1.0.0*
*最后更新: 2025-11-29*
*作者: Stardust Team*
