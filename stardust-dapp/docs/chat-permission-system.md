# 聊天权限系统设计文档 v4.0

## 目录

- [1. 概述](#1-概述)
- [2. 架构设计](#2-架构设计)
- [3. 链端设计](#3-链端设计)
- [4. 前端设计](#4-前端设计)
- [5. 场景扩展指南](#5-场景扩展指南)
- [6. 权限规则](#6-权限规则)
- [7. 实现计划](#7-实现计划)
- [8. 接口定义](#8-接口定义)

---

## 1. 概述

### 1.1 目标

实现基于场景的聊天权限控制系统，支持**同一聊天会话应用于多个业务场景**。

### 1.2 核心原则

| 原则 | 说明 |
|------|------|
| 业务优先 | 做市商、订单场景无摩擦沟通 |
| 隐私保护 | 普通用户默认好友模式 |
| 低耦合 | 权限系统不依赖具体业务 pallet |
| 可扩展 | 新场景无需修改权限 pallet |
| **多场景共存** | 同一聊天可同时关联多个业务场景 |

### 1.3 核心概念

#### 聊天会话 vs 场景授权

```
┌─────────────────────────────────────────────────────────────┐
│                    聊天会话 (Alice ↔ Bob)                    │
│                                                              │
│   场景授权列表：                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │ Order #123  │  │ Order #456  │  │ Memorial #1 │        │
│   │ 有效期: 30天 │  │ 有效期: 30天 │  │ 有效期: 永久 │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
│   聊天消息流：                                                │
│   [订单#123相关] Alice: 我已付款                              │
│   [订单#123相关] Bob: 收到，确认中                            │
│   [纪念馆#1相关] Alice: 想咨询一下祭品价格                     │
│   [普通聊天]    Bob: 好的，我来介绍一下                        │
└─────────────────────────────────────────────────────────────┘
```

**关键理解**：
- **聊天会话**：两个用户之间的通信通道，唯一
- **场景授权**：为什么这两个用户可以聊天的原因，可以有多个
- **消息上下文**：每条消息可以关联到特定场景（可选）

### 1.4 设计演进

| 版本 | 核心变化 |
|------|---------|
| v1.0 | 基础权限检查 |
| v2.0 | 精简链端存储 |
| v3.0 | 授权凭证机制，解耦业务 |
| **v4.0** | **多场景共存，场景上下文，授权聚合** |

### 1.5 适用场景

| 场景 | 说明 | 示例 |
|------|------|------|
| OTC 交易 | 买家联系做市商 | 用户 A 向做市商 B 咨询 |
| 订单沟通 | 订单双方沟通 | 订单 #123 的买卖双方 |
| 纪念馆咨询 | 访客联系管理员 | 用户 A 咨询纪念馆 #1 管理员 B |
| 群聊 | 群成员互相聊天 | 群聊 #1 的成员 |
| **混合场景** | 同时存在多种关系 | A 和 B 既有订单关系，又是纪念馆访客/管理员关系 |

---

## 2. 架构设计

### 2.1 核心模型

```
┌─────────────────────────────────────────────────────────────────┐
│                          数据模型                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   ChatSession（聊天会话）                  │   │
│  │  - session_id: Hash                                      │   │
│  │  - participants: (AccountId, AccountId)                  │   │
│  │  - created_at: BlockNumber                               │   │
│  │  - status: Active | Archived                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              │ 1:N                               │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               SceneAuthorization（场景授权）               │   │
│  │  - scene_type: SceneType                                 │   │
│  │  - scene_id: SceneId (订单ID/纪念馆ID/群聊ID等)           │   │
│  │  - source_pallet: [u8; 8]                                │   │
│  │  - granted_at: BlockNumber                               │   │
│  │  - expires_at: Option<BlockNumber>                       │   │
│  │  - metadata: BoundedVec<u8>                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  关系：一个聊天会话可以有多个场景授权                             │
│  权限：只要有一个有效的场景授权，就允许聊天                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端应用层                                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    聊天页面                              │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ 场景标签栏: [订单#123] [订单#456] [纪念馆#1] [全部] │  │    │
│  │  ├──────────────────────────────────────────────────┤  │    │
│  │  │ 消息列表（可按场景过滤）                           │  │    │
│  │  │ - [订单#123] Alice: 我已付款                      │  │    │
│  │  │ - [订单#123] Bob: 收到                            │  │    │
│  │  │ - [纪念馆#1] Alice: 咨询祭品                      │  │    │
│  │  ├──────────────────────────────────────────────────┤  │    │
│  │  │ 输入框 [选择场景 ▼] [________________] [发送]     │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────▼─────────────────────────┐             │
│  │       聊天权限服务 (chatPermissionService)     │             │
│  └─────────────────────┬─────────────────────────┘             │
└────────────────────────┼────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    区块链层 (Substrate)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              pallet-chat-permission（核心）               │   │
│  │                                                          │   │
│  │  存储：                                                   │   │
│  │  - PrivacySettingsOf<AccountId>        用户隐私设置       │   │
│  │  - Friendships<AccountId, AccountId>   好友关系          │   │
│  │  - SceneAuthorizations<(A, B), Vec<SceneAuth>> 场景授权   │   │
│  │                                                          │   │
│  │  接口：                                                   │   │
│  │  - check_permission()           基础权限检查              │   │
│  │  - get_active_scenes()          获取有效场景列表          │   │
│  │  - grant_scene_authorization()  授予场景授权              │   │
│  │  - revoke_scene_authorization() 撤销场景授权              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          ▲                                       │
│          ┌───────────────┼───────────────┐                      │
│          │               │               │                      │
│  ┌───────┴──────┐ ┌──────┴───────┐ ┌─────┴────────┐            │
│  │ pallet-maker │ │pallet-otc-   │ │pallet-       │            │
│  │              │ │order         │ │stardust-park │            │
│  │ 注册做市商   │ │ 创建订单     │ │ 创建纪念馆   │            │
│  │ ↓           │ │ ↓            │ │ ↓            │            │
│  │ 授予场景    │ │ 授予场景     │ │ 授予场景     │            │
│  │ MarketMaker │ │ Order(id)    │ │ Memorial(id) │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 场景授权 vs 聊天权限

| 概念 | 说明 | 存储位置 |
|------|------|---------|
| **聊天权限** | 用户 A 是否可以给用户 B 发消息 | 链端计算 |
| **场景授权** | 用户 A 和 B 因为什么原因可以聊天 | 链端存储 |
| **消息场景** | 这条消息属于哪个业务场景 | 消息元数据（链端或IPFS） |

**权限判断规则**：
```
canChat(A, B) =
    !isBlocked(A, B) && (
        isFriend(A, B) ||
        hasAnyValidSceneAuth(A, B) ||
        privacySettings(B).level == Open
    )
```

### 2.4 模块结构

```
pallets/
├── chat-permission/
│   ├── src/
│   │   ├── lib.rs              # 主逻辑
│   │   ├── types.rs            # 类型定义
│   │   ├── traits.rs           # Trait 定义
│   │   └── scene.rs            # 场景相关逻辑
│   └── Cargo.toml

src/                            # 前端
├── types/
│   └── chatPermission.ts       # 类型定义
├── services/
│   ├── chatPermissionService.ts
│   ├── sceneService.ts         # 场景服务
│   └── localPreferenceService.ts
├── hooks/
│   ├── useChatPermission.ts
│   └── useChatScenes.ts        # 场景 Hook
├── stores/
│   └── chatStore.ts
└── features/
    └── chat/
        ├── ChatPage.tsx
        ├── SceneTabBar.tsx     # 场景标签栏
        └── MessageWithScene.tsx # 带场景的消息
```

---

## 3. 链端设计

### 3.1 类型定义

```rust
// pallets/chat-permission/src/types.rs

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;

/// 场景类型
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum SceneType {
    /// 做市商场景：用户可咨询做市商
    MarketMaker,
    /// 订单场景：订单买卖双方
    Order,
    /// 纪念馆场景：访客可联系管理员
    Memorial,
    /// 群聊场景：群成员
    Group,
    /// 自定义场景
    Custom(BoundedVec<u8, ConstU32<32>>),
}

/// 场景标识符
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum SceneId {
    /// 无特定 ID（如 MarketMaker 场景）
    None,
    /// 数字 ID（订单号、纪念馆ID、群聊ID）
    Numeric(u64),
    /// Hash ID
    Hash([u8; 32]),
}

/// 场景授权
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct SceneAuthorization<BlockNumber> {
    /// 场景类型
    pub scene_type: SceneType,
    /// 场景标识（如订单ID、纪念馆ID）
    pub scene_id: SceneId,
    /// 授权来源 pallet
    pub source_pallet: [u8; 8],
    /// 授权时间
    pub granted_at: BlockNumber,
    /// 过期时间（None 表示永不过期）
    pub expires_at: Option<BlockNumber>,
    /// 额外元数据（如订单金额、纪念馆名称等，用于前端显示）
    pub metadata: BoundedVec<u8, ConstU32<128>>,
}

/// 聊天权限级别
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen, Default)]
pub enum ChatPermissionLevel {
    /// 开放：任何人可发起
    Open,
    /// 仅好友：需要互加好友（默认）
    #[default]
    FriendsOnly,
    /// 白名单：仅白名单用户可发起
    Whitelist,
    /// 关闭：不接受任何消息
    Closed,
}

/// 用户隐私设置
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct PrivacySettings<T: crate::Config> {
    /// 聊天权限级别
    pub permission_level: ChatPermissionLevel,
    /// 黑名单
    pub block_list: BoundedVec<T::AccountId, T::MaxBlockListSize>,
    /// 白名单
    pub whitelist: BoundedVec<T::AccountId, T::MaxWhitelistSize>,
    /// 拒绝的场景类型（空表示接受所有）
    pub rejected_scene_types: BoundedVec<SceneType, ConstU32<10>>,
    /// 最后更新区块
    pub updated_at: BlockNumberFor<T>,
}

/// 权限检查结果
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum PermissionResult {
    /// 允许（开放模式）
    Allowed,
    /// 允许（好友关系）
    AllowedByFriendship,
    /// 允许（有场景授权）
    AllowedByScene(Vec<SceneType>),
    /// 拒绝：已被屏蔽
    DeniedBlocked,
    /// 拒绝：需要好友关系
    DeniedRequiresFriend,
    /// 拒绝：不在白名单
    DeniedNotInWhitelist,
    /// 拒绝：对方已关闭聊天
    DeniedClosed,
}

/// 场景授权详情（用于 API 返回）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct SceneAuthorizationInfo {
    pub scene_type: SceneType,
    pub scene_id: SceneId,
    pub is_expired: bool,
    pub expires_at: Option<u64>,
    pub metadata: Vec<u8>,
}
```

### 3.2 Trait 定义

```rust
// pallets/chat-permission/src/traits.rs

use crate::types::{SceneType, SceneId, SceneAuthorization};
use frame_support::dispatch::DispatchResult;

/// 场景授权接口
/// 业务 pallet 通过此 trait 管理场景授权
pub trait SceneAuthorizationManager<AccountId, BlockNumber> {
    /// 授予场景授权（单向）
    ///
    /// # 参数
    /// - `source`: 授权来源 PalletId
    /// - `from`: 可以发起聊天的用户
    /// - `to`: 可以被联系的用户
    /// - `scene_type`: 场景类型
    /// - `scene_id`: 场景标识
    /// - `duration`: 有效期（区块数）
    /// - `metadata`: 元数据（用于前端显示）
    fn grant_scene_authorization(
        source: [u8; 8],
        from: &AccountId,
        to: &AccountId,
        scene_type: SceneType,
        scene_id: SceneId,
        duration: Option<BlockNumber>,
        metadata: Vec<u8>,
    ) -> DispatchResult;

    /// 授予双向场景授权
    fn grant_bidirectional_scene_authorization(
        source: [u8; 8],
        user1: &AccountId,
        user2: &AccountId,
        scene_type: SceneType,
        scene_id: SceneId,
        duration: Option<BlockNumber>,
        metadata: Vec<u8>,
    ) -> DispatchResult;

    /// 撤销特定场景授权
    fn revoke_scene_authorization(
        source: [u8; 8],
        from: &AccountId,
        to: &AccountId,
        scene_type: SceneType,
        scene_id: SceneId,
    ) -> DispatchResult;

    /// 撤销某来源的所有场景授权
    fn revoke_all_by_source(
        source: [u8; 8],
        user1: &AccountId,
        user2: &AccountId,
    ) -> DispatchResult;

    /// 延长场景授权有效期
    fn extend_scene_authorization(
        source: [u8; 8],
        from: &AccountId,
        to: &AccountId,
        scene_type: SceneType,
        scene_id: SceneId,
        additional_duration: BlockNumber,
    ) -> DispatchResult;

    /// 检查是否有任何有效的场景授权
    fn has_any_valid_scene_authorization(
        from: &AccountId,
        to: &AccountId,
    ) -> bool;

    /// 获取所有有效的场景授权
    fn get_valid_scene_authorizations(
        user1: &AccountId,
        user2: &AccountId,
    ) -> Vec<SceneAuthorization<BlockNumber>>;
}
```

### 3.3 Pallet 实现

```rust
// pallets/chat-permission/src/lib.rs

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

mod types;
mod traits;

pub use types::*;
pub use traits::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 黑名单最大数量
        #[pallet::constant]
        type MaxBlockListSize: Get<u32>;

        /// 白名单最大数量
        #[pallet::constant]
        type MaxWhitelistSize: Get<u32>;

        /// 单对用户最大场景授权数量
        #[pallet::constant]
        type MaxScenesPerPair: Get<u32>;
    }

    // ==================== 存储 ====================

    /// 用户隐私设置
    #[pallet::storage]
    #[pallet::getter(fn privacy_settings)]
    pub type PrivacySettingsOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        PrivacySettings<T>,
        ValueQuery,
    >;

    /// 好友关系
    #[pallet::storage]
    #[pallet::getter(fn friendships)]
    pub type Friendships<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        T::AccountId,
        BlockNumberFor<T>,
        OptionQuery,
    >;

    /// 场景授权存储
    /// Key: (user1, user2) 按字典序排列 -> 场景授权列表
    /// 注意：存储时 user1 < user2（字典序），保证双向查询一致
    #[pallet::storage]
    #[pallet::getter(fn scene_authorizations)]
    pub type SceneAuthorizations<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<SceneAuthorization<BlockNumberFor<T>>, T::MaxScenesPerPair>,
        ValueQuery,
    >;

    // ==================== 事件 ====================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 隐私设置已更新
        PrivacySettingsUpdated { who: T::AccountId },
        /// 用户已被屏蔽
        UserBlocked { blocker: T::AccountId, blocked: T::AccountId },
        /// 用户已被解除屏蔽
        UserUnblocked { unblocker: T::AccountId, unblocked: T::AccountId },
        /// 好友关系已建立
        FriendshipCreated { user1: T::AccountId, user2: T::AccountId },
        /// 好友关系已解除
        FriendshipRemoved { user1: T::AccountId, user2: T::AccountId },
        /// 场景授权已授予
        SceneAuthorizationGranted {
            source: [u8; 8],
            user1: T::AccountId,
            user2: T::AccountId,
            scene_type: SceneType,
            scene_id: SceneId,
        },
        /// 场景授权已撤销
        SceneAuthorizationRevoked {
            source: [u8; 8],
            user1: T::AccountId,
            user2: T::AccountId,
            scene_type: SceneType,
            scene_id: SceneId,
        },
        /// 场景授权已延期
        SceneAuthorizationExtended {
            user1: T::AccountId,
            user2: T::AccountId,
            scene_type: SceneType,
            scene_id: SceneId,
            new_expires_at: Option<BlockNumberFor<T>>,
        },
    }

    // ==================== 错误 ====================

    #[pallet::error]
    pub enum Error<T> {
        /// 黑名单已满
        BlockListFull,
        /// 白名单已满
        WhitelistFull,
        /// 用户已在黑名单中
        AlreadyBlocked,
        /// 用户不在黑名单中
        NotInBlockList,
        /// 不能添加自己
        CannotAddSelf,
        /// 好友关系已存在
        FriendshipAlreadyExists,
        /// 好友关系不存在
        FriendshipNotFound,
        /// 场景授权数量已达上限
        TooManyScenes,
        /// 场景授权不存在
        SceneAuthorizationNotFound,
        /// 场景授权已存在
        SceneAuthorizationAlreadyExists,
    }

    // ==================== 用户调用 ====================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 设置聊天权限级别
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn set_permission_level(
            origin: OriginFor<T>,
            level: ChatPermissionLevel,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            PrivacySettingsOf::<T>::mutate(&who, |settings| {
                settings.permission_level = level;
                settings.updated_at = frame_system::Pallet::<T>::block_number();
            });

            Self::deposit_event(Event::PrivacySettingsUpdated { who });
            Ok(())
        }

        /// 设置拒绝的场景类型
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn set_rejected_scene_types(
            origin: OriginFor<T>,
            scene_types: BoundedVec<SceneType, ConstU32<10>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            PrivacySettingsOf::<T>::mutate(&who, |settings| {
                settings.rejected_scene_types = scene_types;
                settings.updated_at = frame_system::Pallet::<T>::block_number();
            });

            Self::deposit_event(Event::PrivacySettingsUpdated { who });
            Ok(())
        }

        /// 添加到黑名单
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn block_user(
            origin: OriginFor<T>,
            user: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(who != user, Error::<T>::CannotAddSelf);

            PrivacySettingsOf::<T>::try_mutate(&who, |settings| {
                ensure!(!settings.block_list.contains(&user), Error::<T>::AlreadyBlocked);
                settings.block_list.try_push(user.clone())
                    .map_err(|_| Error::<T>::BlockListFull)?;
                settings.updated_at = frame_system::Pallet::<T>::block_number();
                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::UserBlocked { blocker: who, blocked: user });
            Ok(())
        }

        /// 从黑名单移除
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn unblock_user(
            origin: OriginFor<T>,
            user: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            PrivacySettingsOf::<T>::try_mutate(&who, |settings| {
                let pos = settings.block_list.iter().position(|x| x == &user)
                    .ok_or(Error::<T>::NotInBlockList)?;
                settings.block_list.remove(pos);
                settings.updated_at = frame_system::Pallet::<T>::block_number();
                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::UserUnblocked { unblocker: who, unblocked: user });
            Ok(())
        }

        /// 添加好友
        #[pallet::call_index(4)]
        #[pallet::weight(15_000)]
        pub fn add_friend(
            origin: OriginFor<T>,
            friend: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(who != friend, Error::<T>::CannotAddSelf);
            ensure!(
                Friendships::<T>::get(&who, &friend).is_none(),
                Error::<T>::FriendshipAlreadyExists
            );

            let current_block = frame_system::Pallet::<T>::block_number();

            Friendships::<T>::insert(&who, &friend, current_block);
            Friendships::<T>::insert(&friend, &who, current_block);

            Self::deposit_event(Event::FriendshipCreated { user1: who, user2: friend });
            Ok(())
        }

        /// 删除好友
        #[pallet::call_index(5)]
        #[pallet::weight(15_000)]
        pub fn remove_friend(
            origin: OriginFor<T>,
            friend: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                Friendships::<T>::get(&who, &friend).is_some(),
                Error::<T>::FriendshipNotFound
            );

            Friendships::<T>::remove(&who, &friend);
            Friendships::<T>::remove(&friend, &who);

            Self::deposit_event(Event::FriendshipRemoved { user1: who, user2: friend });
            Ok(())
        }
    }

    // ==================== 内部方法 ====================

    impl<T: Config> Pallet<T> {
        /// 获取排序后的用户对（保证存储一致性）
        fn sorted_pair(
            user1: &T::AccountId,
            user2: &T::AccountId,
        ) -> (T::AccountId, T::AccountId) {
            if user1 < user2 {
                (user1.clone(), user2.clone())
            } else {
                (user2.clone(), user1.clone())
            }
        }

        /// 检查聊天权限
        pub fn check_permission(
            sender: &T::AccountId,
            receiver: &T::AccountId,
        ) -> PermissionResult {
            let current_block = frame_system::Pallet::<T>::block_number();

            // 1. 检查是否被屏蔽
            let receiver_settings = PrivacySettingsOf::<T>::get(receiver);
            if receiver_settings.block_list.contains(sender) {
                return PermissionResult::DeniedBlocked;
            }

            // 2. 检查好友关系
            if Friendships::<T>::get(sender, receiver).is_some() {
                return PermissionResult::AllowedByFriendship;
            }

            // 3. 检查场景授权
            let (user1, user2) = Self::sorted_pair(sender, receiver);
            let authorizations = SceneAuthorizations::<T>::get(&user1, &user2);

            let valid_scenes: Vec<SceneType> = authorizations
                .iter()
                .filter(|auth| {
                    // 检查是否过期
                    if let Some(expires_at) = auth.expires_at {
                        if current_block > expires_at {
                            return false;
                        }
                    }
                    // 检查是否被接收方拒绝
                    !receiver_settings.rejected_scene_types.contains(&auth.scene_type)
                })
                .map(|auth| auth.scene_type.clone())
                .collect();

            if !valid_scenes.is_empty() {
                return PermissionResult::AllowedByScene(valid_scenes);
            }

            // 4. 根据隐私设置判断
            match receiver_settings.permission_level {
                ChatPermissionLevel::Open => PermissionResult::Allowed,
                ChatPermissionLevel::FriendsOnly => PermissionResult::DeniedRequiresFriend,
                ChatPermissionLevel::Whitelist => {
                    if receiver_settings.whitelist.contains(sender) {
                        PermissionResult::Allowed
                    } else {
                        PermissionResult::DeniedNotInWhitelist
                    }
                }
                ChatPermissionLevel::Closed => PermissionResult::DeniedClosed,
            }
        }

        /// 获取两用户间所有有效的场景授权
        pub fn get_active_scenes(
            user1: &T::AccountId,
            user2: &T::AccountId,
        ) -> Vec<SceneAuthorizationInfo> {
            let current_block = frame_system::Pallet::<T>::block_number();
            let (u1, u2) = Self::sorted_pair(user1, user2);
            let authorizations = SceneAuthorizations::<T>::get(&u1, &u2);

            authorizations
                .iter()
                .map(|auth| {
                    let is_expired = auth.expires_at
                        .map(|e| current_block > e)
                        .unwrap_or(false);

                    SceneAuthorizationInfo {
                        scene_type: auth.scene_type.clone(),
                        scene_id: auth.scene_id.clone(),
                        is_expired,
                        expires_at: auth.expires_at.map(|b| b.saturated_into::<u64>()),
                        metadata: auth.metadata.to_vec(),
                    }
                })
                .collect()
        }

        /// 清理过期的场景授权
        pub fn cleanup_expired_scenes(user1: &T::AccountId, user2: &T::AccountId) {
            let current_block = frame_system::Pallet::<T>::block_number();
            let (u1, u2) = Self::sorted_pair(user1, user2);

            SceneAuthorizations::<T>::mutate(&u1, &u2, |auths| {
                auths.retain(|auth| {
                    auth.expires_at.map(|e| current_block <= e).unwrap_or(true)
                });
            });
        }
    }

    // ==================== 实现 SceneAuthorizationManager Trait ====================

    impl<T: Config> SceneAuthorizationManager<T::AccountId, BlockNumberFor<T>> for Pallet<T> {
        fn grant_scene_authorization(
            source: [u8; 8],
            from: &T::AccountId,
            to: &T::AccountId,
            scene_type: SceneType,
            scene_id: SceneId,
            duration: Option<BlockNumberFor<T>>,
            metadata: Vec<u8>,
        ) -> DispatchResult {
            let current_block = frame_system::Pallet::<T>::block_number();
            let expires_at = duration.map(|d| current_block + d);
            let (user1, user2) = Self::sorted_pair(from, to);

            let authorization = SceneAuthorization {
                scene_type: scene_type.clone(),
                scene_id: scene_id.clone(),
                source_pallet: source,
                granted_at: current_block,
                expires_at,
                metadata: BoundedVec::try_from(metadata)
                    .map_err(|_| Error::<T>::TooManyScenes)?,
            };

            SceneAuthorizations::<T>::try_mutate(&user1, &user2, |auths| {
                // 检查是否已存在相同场景
                let exists = auths.iter().any(|a|
                    a.scene_type == scene_type && a.scene_id == scene_id
                );

                if exists {
                    // 更新现有授权
                    for auth in auths.iter_mut() {
                        if auth.scene_type == scene_type && auth.scene_id == scene_id {
                            *auth = authorization.clone();
                            break;
                        }
                    }
                } else {
                    // 添加新授权
                    auths.try_push(authorization)
                        .map_err(|_| Error::<T>::TooManyScenes)?;
                }
                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::SceneAuthorizationGranted {
                source,
                user1,
                user2,
                scene_type,
                scene_id,
            });

            Ok(())
        }

        fn grant_bidirectional_scene_authorization(
            source: [u8; 8],
            user1: &T::AccountId,
            user2: &T::AccountId,
            scene_type: SceneType,
            scene_id: SceneId,
            duration: Option<BlockNumberFor<T>>,
            metadata: Vec<u8>,
        ) -> DispatchResult {
            // 由于存储已经是双向的（使用排序后的 key），只需调用一次
            Self::grant_scene_authorization(
                source, user1, user2, scene_type, scene_id, duration, metadata
            )
        }

        fn revoke_scene_authorization(
            source: [u8; 8],
            from: &T::AccountId,
            to: &T::AccountId,
            scene_type: SceneType,
            scene_id: SceneId,
        ) -> DispatchResult {
            let (user1, user2) = Self::sorted_pair(from, to);

            SceneAuthorizations::<T>::try_mutate(&user1, &user2, |auths| {
                let pos = auths.iter().position(|a|
                    a.source_pallet == source &&
                    a.scene_type == scene_type &&
                    a.scene_id == scene_id
                ).ok_or(Error::<T>::SceneAuthorizationNotFound)?;

                auths.remove(pos);
                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::SceneAuthorizationRevoked {
                source,
                user1,
                user2,
                scene_type,
                scene_id,
            });

            Ok(())
        }

        fn revoke_all_by_source(
            source: [u8; 8],
            user1: &T::AccountId,
            user2: &T::AccountId,
        ) -> DispatchResult {
            let (u1, u2) = Self::sorted_pair(user1, user2);

            SceneAuthorizations::<T>::mutate(&u1, &u2, |auths| {
                auths.retain(|a| a.source_pallet != source);
            });

            Ok(())
        }

        fn extend_scene_authorization(
            source: [u8; 8],
            from: &T::AccountId,
            to: &T::AccountId,
            scene_type: SceneType,
            scene_id: SceneId,
            additional_duration: BlockNumberFor<T>,
        ) -> DispatchResult {
            let current_block = frame_system::Pallet::<T>::block_number();
            let (user1, user2) = Self::sorted_pair(from, to);

            let mut new_expires_at = None;

            SceneAuthorizations::<T>::try_mutate(&user1, &user2, |auths| {
                let auth = auths.iter_mut().find(|a|
                    a.source_pallet == source &&
                    a.scene_type == scene_type &&
                    a.scene_id == scene_id
                ).ok_or(Error::<T>::SceneAuthorizationNotFound)?;

                // 从当前时间或原过期时间延长
                let base = auth.expires_at.unwrap_or(current_block);
                let new_time = base.max(current_block) + additional_duration;
                auth.expires_at = Some(new_time);
                new_expires_at = Some(new_time);

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::SceneAuthorizationExtended {
                user1,
                user2,
                scene_type,
                scene_id,
                new_expires_at,
            });

            Ok(())
        }

        fn has_any_valid_scene_authorization(
            from: &T::AccountId,
            to: &T::AccountId,
        ) -> bool {
            let current_block = frame_system::Pallet::<T>::block_number();
            let (user1, user2) = Self::sorted_pair(from, to);
            let authorizations = SceneAuthorizations::<T>::get(&user1, &user2);

            authorizations.iter().any(|auth| {
                auth.expires_at.map(|e| current_block <= e).unwrap_or(true)
            })
        }

        fn get_valid_scene_authorizations(
            user1: &T::AccountId,
            user2: &T::AccountId,
        ) -> Vec<SceneAuthorization<BlockNumberFor<T>>> {
            let current_block = frame_system::Pallet::<T>::block_number();
            let (u1, u2) = Self::sorted_pair(user1, user2);
            let authorizations = SceneAuthorizations::<T>::get(&u1, &u2);

            authorizations
                .into_iter()
                .filter(|auth| {
                    auth.expires_at.map(|e| current_block <= e).unwrap_or(true)
                })
                .collect()
        }
    }
}
```

### 3.4 业务 Pallet 集成示例

```rust
// pallets/otc-order/src/lib.rs

use pallet_chat_permission::{SceneAuthorizationManager, SceneType, SceneId};

#[pallet::config]
pub trait Config: frame_system::Config {
    type ChatPermission: SceneAuthorizationManager<Self::AccountId, BlockNumberFor<Self>>;
}

impl<T: Config> Pallet<T> {
    /// 创建订单时授予场景授权
    fn on_order_created(
        order_id: u64,
        buyer: &T::AccountId,
        seller: &T::AccountId,
        order_info: &str,
    ) -> DispatchResult {
        // 30 天有效期
        let duration = Some((30u32 * 24 * 60 * 10).into());

        T::ChatPermission::grant_bidirectional_scene_authorization(
            *b"otc_ordr",
            buyer,
            seller,
            SceneType::Order,
            SceneId::Numeric(order_id),
            duration,
            order_info.as_bytes().to_vec(),  // 元数据：订单信息
        )
    }

    /// 订单完成后延长授权（用于售后沟通）
    fn on_order_completed(
        order_id: u64,
        buyer: &T::AccountId,
        seller: &T::AccountId,
    ) -> DispatchResult {
        // 额外延长 7 天用于售后
        let additional = (7u32 * 24 * 60 * 10).into();

        T::ChatPermission::extend_scene_authorization(
            *b"otc_ordr",
            buyer,
            seller,
            SceneType::Order,
            SceneId::Numeric(order_id),
            additional,
        )
    }

    /// 订单取消时撤销授权
    fn on_order_cancelled(
        order_id: u64,
        buyer: &T::AccountId,
        seller: &T::AccountId,
    ) -> DispatchResult {
        T::ChatPermission::revoke_scene_authorization(
            *b"otc_ordr",
            buyer,
            seller,
            SceneType::Order,
            SceneId::Numeric(order_id),
        )
    }
}
```

```rust
// pallets/stardust-park/src/lib.rs

use pallet_chat_permission::{SceneAuthorizationManager, SceneType, SceneId};

impl<T: Config> Pallet<T> {
    /// 创建纪念馆时，授权访客联系管理员
    fn on_memorial_created(
        memorial_id: u64,
        admin: &T::AccountId,
        memorial_name: &str,
    ) {
        // 纪念馆场景：管理员可以被任何人联系
        // 这里不需要指定 visitor，而是在用户访问时动态授权
        // 或者管理员设置为 Open 模式
    }

    /// 用户访问纪念馆时，授予临时场景授权
    fn on_visitor_interaction(
        memorial_id: u64,
        visitor: &T::AccountId,
        admin: &T::AccountId,
        memorial_name: &str,
    ) -> DispatchResult {
        // 7 天有效期
        let duration = Some((7u32 * 24 * 60 * 10).into());

        T::ChatPermission::grant_scene_authorization(
            *b"memorial",
            visitor,
            admin,
            SceneType::Memorial,
            SceneId::Numeric(memorial_id),
            duration,
            memorial_name.as_bytes().to_vec(),
        )
    }
}
```

### 3.5 Runtime API

```rust
// runtime/src/lib.rs

sp_api::decl_runtime_apis! {
    pub trait ChatPermissionApi<AccountId> {
        /// 检查聊天权限
        fn check_chat_permission(
            sender: AccountId,
            receiver: AccountId,
        ) -> PermissionResult;

        /// 获取两用户间所有有效场景
        fn get_active_scenes(
            user1: AccountId,
            user2: AccountId,
        ) -> Vec<SceneAuthorizationInfo>;

        /// 检查是否是好友
        fn is_friend(user1: AccountId, user2: AccountId) -> bool;

        /// 获取隐私设置摘要
        fn get_privacy_settings_summary(user: AccountId) -> PrivacySettingsSummary;
    }
}

#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub struct PrivacySettingsSummary {
    pub permission_level: ChatPermissionLevel,
    pub block_list_count: u32,
    pub whitelist_count: u32,
    pub rejected_scene_types: Vec<SceneType>,
}
```

### 3.6 配置常量

```rust
parameter_types! {
    pub const MaxBlockListSize: u32 = 500;
    pub const MaxWhitelistSize: u32 = 200;
    /// 单对用户最大场景授权数量：20
    /// 考虑场景：多个订单 + 多个纪念馆 + 群聊等
    pub const MaxScenesPerPair: u32 = 20;
}

impl pallet_chat_permission::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxBlockListSize = MaxBlockListSize;
    type MaxWhitelistSize = MaxWhitelistSize;
    type MaxScenesPerPair = MaxScenesPerPair;
}
```

---

## 4. 前端设计

### 4.1 类型定义

```typescript
// src/types/chatPermission.ts

/**
 * 场景类型
 */
export enum SceneType {
  MarketMaker = 'MarketMaker',
  Order = 'Order',
  Memorial = 'Memorial',
  Group = 'Group',
  Custom = 'Custom',
}

/**
 * 场景标识
 */
export type SceneId =
  | { type: 'None' }
  | { type: 'Numeric'; value: number }
  | { type: 'Hash'; value: string }

/**
 * 场景授权信息
 */
export interface SceneAuthorizationInfo {
  sceneType: SceneType
  sceneId: SceneId
  isExpired: boolean
  expiresAt?: number
  metadata: string  // 解码后的元数据，如订单信息、纪念馆名称
}

/**
 * 权限检查结果
 */
export type PermissionResult =
  | { type: 'Allowed' }
  | { type: 'AllowedByFriendship' }
  | { type: 'AllowedByScene'; scenes: SceneType[] }
  | { type: 'DeniedBlocked' }
  | { type: 'DeniedRequiresFriend' }
  | { type: 'DeniedNotInWhitelist' }
  | { type: 'DeniedClosed' }

/**
 * 聊天会话
 */
export interface ChatSession {
  sessionId: string
  participants: [string, string]
  activeScenes: SceneAuthorizationInfo[]
  lastMessageAt?: number
}

/**
 * 带场景的消息
 */
export interface ChatMessage {
  id: string
  sessionId: string
  sender: string
  content: string
  timestamp: number
  /** 消息关联的场景（可选） */
  scene?: {
    type: SceneType
    id: SceneId
  }
}

/**
 * 聊天权限检查结果（前端使用）
 */
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  activeScenes?: SceneAuthorizationInfo[]
  suggestedAction?: 'send_friend_request' | 'none'
}
```

### 4.2 场景服务

```typescript
// src/services/sceneService.ts

import { getApi } from '../lib/polkadot'
import type { SceneAuthorizationInfo, SceneType, SceneId } from '../types/chatPermission'

/**
 * 场景服务
 * 管理聊天场景相关功能
 */
export class SceneService {
  /**
   * 获取两用户间的所有有效场景
   */
  static async getActiveScenes(
    user1: string,
    user2: string,
  ): Promise<SceneAuthorizationInfo[]> {
    try {
      const api = await getApi()
      const result = await (api.call as any).chatPermissionApi.getActiveScenes(user1, user2)

      return result.map((scene: any) => ({
        sceneType: scene.scene_type.toString() as SceneType,
        sceneId: this.parseSceneId(scene.scene_id),
        isExpired: scene.is_expired,
        expiresAt: scene.expires_at?.toNumber(),
        metadata: this.decodeMetadata(scene.metadata),
      }))
    } catch (error) {
      console.error('获取场景失败:', error)
      return []
    }
  }

  /**
   * 解析场景 ID
   */
  private static parseSceneId(raw: any): SceneId {
    if (raw.isNone) return { type: 'None' }
    if (raw.isNumeric) return { type: 'Numeric', value: raw.asNumeric.toNumber() }
    if (raw.isHash) return { type: 'Hash', value: raw.asHash.toHex() }
    return { type: 'None' }
  }

  /**
   * 解码元数据
   */
  private static decodeMetadata(raw: Uint8Array): string {
    try {
      return new TextDecoder().decode(raw)
    } catch {
      return ''
    }
  }

  /**
   * 格式化场景显示名称
   */
  static formatSceneName(scene: SceneAuthorizationInfo): string {
    switch (scene.sceneType) {
      case SceneType.Order:
        const orderId = scene.sceneId.type === 'Numeric' ? scene.sceneId.value : '?'
        return `订单 #${orderId}`
      case SceneType.Memorial:
        return scene.metadata || `纪念馆 #${scene.sceneId.type === 'Numeric' ? scene.sceneId.value : '?'}`
      case SceneType.MarketMaker:
        return '做市商咨询'
      case SceneType.Group:
        return scene.metadata || '群聊'
      default:
        return '其他'
    }
  }

  /**
   * 获取场景图标
   */
  static getSceneIcon(sceneType: SceneType): string {
    switch (sceneType) {
      case SceneType.Order: return '📦'
      case SceneType.Memorial: return '🕯️'
      case SceneType.MarketMaker: return '💱'
      case SceneType.Group: return '👥'
      default: return '💬'
    }
  }
}
```

### 4.3 权限检查服务

```typescript
// src/services/chatPermissionService.ts

import { getApi } from '../lib/polkadot'
import { SceneService } from './sceneService'
import type { PermissionResult, PermissionCheckResult } from '../types/chatPermission'

export class ChatPermissionService {
  /**
   * 检查聊天权限
   */
  static async checkPermission(
    sender: string,
    receiver: string,
  ): Promise<PermissionCheckResult> {
    try {
      const api = await getApi()

      // 1. 检查基础权限
      const result = await (api.call as any).chatPermissionApi.checkChatPermission(
        sender,
        receiver,
      )

      // 2. 解析结果
      return this.parsePermissionResult(result, sender, receiver)
    } catch (error) {
      console.error('权限检查失败:', error)
      return {
        allowed: false,
        reason: '权限检查失败，请稍后重试',
      }
    }
  }

  private static async parsePermissionResult(
    result: any,
    sender: string,
    receiver: string,
  ): Promise<PermissionCheckResult> {
    // 允许的情况
    if (result.isAllowed) {
      return { allowed: true }
    }

    if (result.isAllowedByFriendship) {
      return { allowed: true, reason: '好友' }
    }

    if (result.isAllowedByScene) {
      // 获取详细的场景信息
      const activeScenes = await SceneService.getActiveScenes(sender, receiver)
      return {
        allowed: true,
        activeScenes,
      }
    }

    // 拒绝的情况
    if (result.isDeniedBlocked) {
      return { allowed: false, reason: '您已被对方屏蔽' }
    }

    if (result.isDeniedRequiresFriend) {
      return {
        allowed: false,
        reason: '对方仅接受好友消息',
        suggestedAction: 'send_friend_request',
      }
    }

    if (result.isDeniedNotInWhitelist) {
      return { allowed: false, reason: '对方未将您加入白名单' }
    }

    if (result.isDeniedClosed) {
      return { allowed: false, reason: '对方已关闭聊天功能' }
    }

    return { allowed: false, reason: '无法发起聊天' }
  }
}
```

### 4.4 React Hooks

```typescript
// src/hooks/useChatScenes.ts

import { useState, useEffect, useCallback } from 'react'
import { SceneService } from '../services/sceneService'
import type { SceneAuthorizationInfo } from '../types/chatPermission'

/**
 * 聊天场景 Hook
 */
export function useChatScenes(user1: string, user2: string) {
  const [scenes, setScenes] = useState<SceneAuthorizationInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScene, setSelectedScene] = useState<SceneAuthorizationInfo | null>(null)

  const fetchScenes = useCallback(async () => {
    if (!user1 || !user2) return

    setLoading(true)
    try {
      const activeScenes = await SceneService.getActiveScenes(user1, user2)
      setScenes(activeScenes.filter(s => !s.isExpired))
    } catch (error) {
      console.error('获取场景失败:', error)
    } finally {
      setLoading(false)
    }
  }, [user1, user2])

  useEffect(() => {
    fetchScenes()
  }, [fetchScenes])

  return {
    scenes,
    loading,
    selectedScene,
    setSelectedScene,
    refreshScenes: fetchScenes,
  }
}
```

```typescript
// src/hooks/useChatPermission.ts

import { useState, useCallback } from 'react'
import { ChatPermissionService } from '../services/chatPermissionService'
import type { PermissionCheckResult } from '../types/chatPermission'

export function useChatPermission() {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<PermissionCheckResult | null>(null)

  const checkPermission = useCallback(async (
    sender: string,
    receiver: string,
  ): Promise<PermissionCheckResult> => {
    setChecking(true)
    try {
      const permissionResult = await ChatPermissionService.checkPermission(sender, receiver)
      setResult(permissionResult)
      return permissionResult
    } finally {
      setChecking(false)
    }
  }, [])

  return { checking, result, checkPermission }
}
```

### 4.5 UI 组件

```typescript
// src/features/chat/SceneTabBar.tsx

import React from 'react'
import { Tabs, Tag, Badge } from 'antd'
import { SceneService } from '../../services/sceneService'
import type { SceneAuthorizationInfo } from '../../types/chatPermission'

interface SceneTabBarProps {
  scenes: SceneAuthorizationInfo[]
  selectedScene: SceneAuthorizationInfo | null
  onSelectScene: (scene: SceneAuthorizationInfo | null) => void
}

export const SceneTabBar: React.FC<SceneTabBarProps> = ({
  scenes,
  selectedScene,
  onSelectScene,
}) => {
  if (scenes.length === 0) {
    return null
  }

  return (
    <div className="scene-tab-bar">
      <Tabs
        activeKey={selectedScene ? `${selectedScene.sceneType}-${JSON.stringify(selectedScene.sceneId)}` : 'all'}
        onChange={(key) => {
          if (key === 'all') {
            onSelectScene(null)
          } else {
            const scene = scenes.find(s =>
              `${s.sceneType}-${JSON.stringify(s.sceneId)}` === key
            )
            onSelectScene(scene || null)
          }
        }}
        items={[
          {
            key: 'all',
            label: (
              <span>
                💬 全部
                <Badge count={scenes.length} style={{ marginLeft: 8 }} />
              </span>
            ),
          },
          ...scenes.map(scene => ({
            key: `${scene.sceneType}-${JSON.stringify(scene.sceneId)}`,
            label: (
              <span>
                {SceneService.getSceneIcon(scene.sceneType)}
                {' '}
                {SceneService.formatSceneName(scene)}
                {scene.expiresAt && (
                  <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>
                    {formatExpiry(scene.expiresAt)}
                  </Tag>
                )}
              </span>
            ),
          })),
        ]}
      />
    </div>
  )
}

function formatExpiry(expiresAt: number): string {
  const now = Date.now()
  const diff = expiresAt - now
  if (diff < 0) return '已过期'
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  if (days > 0) return `${days}天后过期`
  const hours = Math.floor(diff / (60 * 60 * 1000))
  return `${hours}小时后过期`
}
```

```typescript
// src/features/chat/ChatPage.tsx

import React, { useState } from 'react'
import { SceneTabBar } from './SceneTabBar'
import { useChatScenes } from '../../hooks/useChatScenes'
import { useChatPermission } from '../../hooks/useChatPermission'
import type { SceneAuthorizationInfo, ChatMessage } from '../../types/chatPermission'

interface ChatPageProps {
  myAddress: string
  otherAddress: string
}

export const ChatPage: React.FC<ChatPageProps> = ({ myAddress, otherAddress }) => {
  const { scenes, selectedScene, setSelectedScene } = useChatScenes(myAddress, otherAddress)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // 过滤消息
  const filteredMessages = selectedScene
    ? messages.filter(m =>
        m.scene?.type === selectedScene.sceneType &&
        JSON.stringify(m.scene.id) === JSON.stringify(selectedScene.sceneId)
      )
    : messages

  return (
    <div className="chat-page">
      {/* 场景标签栏 */}
      <SceneTabBar
        scenes={scenes}
        selectedScene={selectedScene}
        onSelectScene={setSelectedScene}
      />

      {/* 消息列表 */}
      <div className="message-list">
        {filteredMessages.map(msg => (
          <MessageItem key={msg.id} message={msg} scenes={scenes} />
        ))}
      </div>

      {/* 输入区域 */}
      <MessageInput
        scenes={scenes}
        selectedScene={selectedScene}
        onSend={(content, scene) => {
          // 发送消息，附带场景信息
        }}
      />
    </div>
  )
}
```

---

## 5. 场景扩展指南

### 5.1 新增场景的步骤

#### 步骤 1：选择或定义场景类型

```rust
// 使用现有类型
SceneType::Order
SceneType::Memorial

// 或使用自定义类型
SceneType::Custom(b"auction".to_vec().try_into().unwrap())
```

#### 步骤 2：在业务 Pallet 中集成

```rust
// 在业务事件发生时授予场景授权
fn on_business_event(user1: &AccountId, user2: &AccountId, event_id: u64) {
    T::ChatPermission::grant_bidirectional_scene_authorization(
        *b"your_pal",
        user1,
        user2,
        SceneType::Custom(b"your_type".to_vec().try_into().unwrap()),
        SceneId::Numeric(event_id),
        Some(duration),
        "业务描述".as_bytes().to_vec(),
    );
}
```

#### 步骤 3：前端适配

```typescript
// 在 SceneService 中添加格式化逻辑
static formatSceneName(scene: SceneAuthorizationInfo): string {
  if (scene.sceneType === SceneType.Custom) {
    // 根据 metadata 或自定义逻辑格式化
    return scene.metadata || '自定义场景'
  }
  // ...
}
```

### 5.2 场景示例

#### 拍卖系统

```rust
fn on_bid_placed(auction_id: u64, bidder: &AccountId, seller: &AccountId) {
    T::ChatPermission::grant_scene_authorization(
        *b"auction_",
        bidder,
        seller,
        SceneType::Custom(b"auction".to_vec().try_into().unwrap()),
        SceneId::Numeric(auction_id),
        Some(7 * 24 * 60 * 10),  // 7 天
        format!("拍卖 #{}", auction_id).into_bytes(),
    );
}
```

#### 客服系统

```rust
fn on_ticket_created(ticket_id: u64, user: &AccountId, agent: &AccountId) {
    T::ChatPermission::grant_bidirectional_scene_authorization(
        *b"support_",
        user,
        agent,
        SceneType::Custom(b"support".to_vec().try_into().unwrap()),
        SceneId::Numeric(ticket_id),
        Some(30 * 24 * 60 * 10),  // 30 天
        format!("工单 #{}", ticket_id).into_bytes(),
    );
}
```

---

## 6. 权限规则

### 6.1 权限判定流程

```
发起聊天请求 (sender -> receiver)
    │
    ▼
┌─────────────────────────────────────┐
│ 1. 检查黑名单                        │
│    receiver.block_list.contains(sender)?│
│    └─ Yes ──> DeniedBlocked          │
└─────────────────┬───────────────────┘
                  │ No
                  ▼
┌─────────────────────────────────────┐
│ 2. 检查好友关系                      │
│    Friendships(sender, receiver)?    │
│    └─ Yes ──> AllowedByFriendship    │
└─────────────────┬───────────────────┘
                  │ No
                  ▼
┌─────────────────────────────────────┐
│ 3. 检查场景授权                      │
│    SceneAuthorizations(sender, receiver)│
│    过滤：未过期 + 未被拒绝的场景类型   │
│    └─ 有有效场景 ──> AllowedByScene   │
└─────────────────┬───────────────────┘
                  │ 无有效场景
                  ▼
┌─────────────────────────────────────┐
│ 4. 检查隐私设置                      │
│    receiver.permission_level         │
│    ├─ Open ──> Allowed               │
│    ├─ FriendsOnly ──> DeniedRequiresFriend│
│    ├─ Whitelist ──> 检查白名单       │
│    └─ Closed ──> DeniedClosed        │
└─────────────────────────────────────┘
```

### 6.2 多场景共存示例

```
用户 Alice 和 Bob 之间的关系：

场景授权列表：
┌────────────────┬──────────────┬────────────┬────────────┐
│ 场景类型       │ 场景ID       │ 有效期     │ 元数据     │
├────────────────┼──────────────┼────────────┼────────────┤
│ Order          │ Numeric(123) │ 2024-02-15 │ "订单#123" │
│ Order          │ Numeric(456) │ 2024-03-01 │ "订单#456" │
│ Memorial       │ Numeric(1)   │ 永久       │ "张三纪念馆"│
└────────────────┴──────────────┴────────────┴────────────┘

聊天界面：
┌─────────────────────────────────────────────────┐
│ [全部] [📦订单#123] [📦订单#456] [🕯️张三纪念馆]  │
├─────────────────────────────────────────────────┤
│ [订单#123] Alice: 订单什么时候发货？              │
│ [订单#123] Bob: 明天发                           │
│ [订单#456] Alice: 这个订单地址写错了              │
│ [纪念馆]   Alice: 想预约祭扫                      │
│ [纪念馆]   Bob: 好的，周末有空位                  │
└─────────────────────────────────────────────────┘
```

---

## 7. 实现计划

### Phase 1: 链端核心

| 任务 | 说明 |
|------|------|
| 类型定义 | SceneType, SceneId, SceneAuthorization |
| 存储设计 | SceneAuthorizations 双向存储 |
| Trait 定义 | SceneAuthorizationManager |
| 核心实现 | grant/revoke/extend 场景授权 |
| 权限检查 | check_permission, get_active_scenes |
| Runtime API | 暴露查询接口 |
| 单元测试 | 覆盖多场景共存情况 |

### Phase 2: 业务集成

| 任务 | 说明 |
|------|------|
| pallet-otc-order | 订单创建/完成/取消时管理场景 |
| pallet-stardust-park | 纪念馆访问时授权 |
| pallet-maker | 做市商咨询场景 |

### Phase 3: 前端实现

| 任务 | 说明 |
|------|------|
| 类型定义 | TypeScript 类型 |
| 场景服务 | SceneService |
| React Hooks | useChatScenes, useChatPermission |
| UI 组件 | SceneTabBar, MessageWithScene |

---

## 8. 接口定义

### 8.1 链端 Extrinsics

| 方法 | 参数 | 说明 |
|------|------|------|
| `set_permission_level` | `level` | 设置权限级别 |
| `set_rejected_scene_types` | `types` | 设置拒绝的场景类型 |
| `block_user` | `user` | 屏蔽用户 |
| `unblock_user` | `user` | 取消屏蔽 |
| `add_friend` | `friend` | 添加好友 |
| `remove_friend` | `friend` | 删除好友 |

### 8.2 SceneAuthorizationManager Trait

| 方法 | 说明 |
|------|------|
| `grant_scene_authorization` | 授予单向场景授权 |
| `grant_bidirectional_scene_authorization` | 授予双向场景授权 |
| `revoke_scene_authorization` | 撤销特定场景授权 |
| `revoke_all_by_source` | 撤销某来源的所有授权 |
| `extend_scene_authorization` | 延长授权有效期 |
| `has_any_valid_scene_authorization` | 检查是否有有效授权 |
| `get_valid_scene_authorizations` | 获取所有有效授权 |

### 8.3 Runtime API

| 方法 | 返回 | 说明 |
|------|------|------|
| `check_chat_permission` | `PermissionResult` | 检查权限 |
| `get_active_scenes` | `Vec<SceneAuthorizationInfo>` | 获取有效场景 |
| `is_friend` | `bool` | 检查好友关系 |
| `get_privacy_settings_summary` | `PrivacySettingsSummary` | 获取隐私设置 |

---

## 附录

### A. 存储成本估算

| 存储项 | 单条大小 | 说明 |
|-------|---------|------|
| PrivacySettings | ~3.5 KB | 每用户 1 条 |
| Friendship | ~8 B | 每对好友 2 条 |
| SceneAuthorization | ~200 B | 每对用户最多 20 条 |

### B. 版本对比

| 版本 | 核心特性 |
|------|---------|
| v3.0 | 授权凭证机制，解耦业务 |
| v4.0 | 多场景共存，场景上下文，消息场景关联 |

### C. 安全考虑

1. **场景数量限制**：`MaxScenesPerPair` 防止存储滥用
2. **授权来源追踪**：`source_pallet` 用于审计和撤销
3. **过期自动失效**：权限检查时自动过滤过期授权
4. **用户可控**：用户可拒绝特定场景类型

---

**文档版本**: v4.0
**最后更新**: 2025-11-28
**维护者**: Stardust Team
