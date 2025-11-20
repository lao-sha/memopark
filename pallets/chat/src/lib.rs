#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

//! # Pallet Chat - 去中心化聊天功能
//! 
//! ## 概述
//! 
//! 本模块提供去中心化的聊天功能，采用混合方案：
//! - **链上存储**：消息元数据（发送方、接收方、IPFS CID、时间戳等）
//! - **IPFS存储**：加密的消息内容
//! - **端到端加密**：前端实现消息内容加密
//! 
//! ## 核心特性
//! 
//! - ✅ 私聊功能（1对1）
//! - ✅ 会话管理
//! - ✅ 已读/未读状态
//! - ✅ 消息软删除
//! - ✅ 未读计数
//! - ✅ 批量标记已读
//! 
//! ## 架构设计
//! 
//! ```text
//! 用户A → 加密消息 → 上传IPFS → 获取CID → 调用send_message → 链上存储元数据
//!                                                    ↓
//!                                               触发事件
//!                                                    ↓
//! 用户B ← 解密显示 ← 下载IPFS ← 获取CID ← 监听事件 ← 链上查询元数据
//! ```

extern crate alloc;
use alloc::vec::Vec;

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_runtime::traits::{Hash, Saturating};

/// 函数级详细中文注释：权重信息 trait
/// - 定义所有可调用函数的权重计算
/// - 实际项目中应通过 benchmark 生成精确权重
/// - 这里提供保守的默认估算
pub trait WeightInfo {
	fn send_message() -> Weight;
	fn mark_as_read() -> Weight;
	fn delete_message() -> Weight;
	fn mark_batch_as_read(n: u32) -> Weight;
	fn mark_session_as_read(n: u32) -> Weight;
	fn archive_session() -> Weight;
	fn block_user() -> Weight;
	fn unblock_user() -> Weight;
	fn cleanup_old_messages(n: u32) -> Weight;
}

/// 函数级详细中文注释：默认权重实现
/// - 基于 Substrate 标准权重单位估算
/// - DbRead = 25_000_000 weight (25微秒)
/// - DbWrite = 100_000_000 weight (100微秒)
pub struct SubstrateWeight<T>(core::marker::PhantomData<T>);
impl<T: frame_system::Config> WeightInfo for SubstrateWeight<T> {
	/// 发送消息权重：5次读 + 4次写
	/// - 读：Blacklist, RateLimit, Sessions, NextMessageId, SessionMessages
	/// - 写：Messages, Sessions, SessionMessages, UnreadCount
	fn send_message() -> Weight {
		Weight::from_parts(
			5 * 25_000_000 + 4 * 100_000_000, // 计算权重
			0 // 存储权重（暂不考虑）
		)
	}

	/// 标记已读权重：2次读 + 2次写
	/// - 读：Messages, UnreadCount
	/// - 写：Messages, UnreadCount
	fn mark_as_read() -> Weight {
		Weight::from_parts(
			2 * 25_000_000 + 2 * 100_000_000,
			0
		)
	}

	/// 删除消息权重：1次读 + 1次写
	fn delete_message() -> Weight {
		Weight::from_parts(
			1 * 25_000_000 + 1 * 100_000_000,
			0
		)
	}

	/// 批量标记已读权重：取决于消息数量
	/// 每条消息：1次读 + 1次写
	fn mark_batch_as_read(n: u32) -> Weight {
		Weight::from_parts(
			(n as u64) * (25_000_000 + 100_000_000),
			0
		)
	}

	/// 会话标记已读权重：取决于消息数量
	/// 基础：2次读(Sessions + SessionMessages迭代)
	/// 每条消息：1次读 + 1次写
	fn mark_session_as_read(n: u32) -> Weight {
		Weight::from_parts(
			2 * 25_000_000 + (n as u64) * (25_000_000 + 100_000_000),
			0
		)
	}

	/// 归档会话权重：1次读 + 1次写
	fn archive_session() -> Weight {
		Weight::from_parts(
			1 * 25_000_000 + 1 * 100_000_000,
			0
		)
	}

	/// 拉黑用户权重：1次写
	fn block_user() -> Weight {
		Weight::from_parts(
			1 * 100_000_000,
			0
		)
	}

	/// 解除拉黑权重：1次写（删除）
	fn unblock_user() -> Weight {
		Weight::from_parts(
			1 * 100_000_000,
			0
		)
	}

	/// 清理旧消息权重：取决于消息数量
	/// 每条消息：1次读 + 2次写（Messages + SessionMessages）
	fn cleanup_old_messages(n: u32) -> Weight {
		Weight::from_parts(
			(n as u64) * (25_000_000 + 2 * 100_000_000),
			0
		)
	}
}

/// 函数级详细中文注释：消息元数据结构
/// - 链上只存储元数据，不存储实际内容
/// - 消息内容加密后存储在IPFS，链上只保存CID
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct MessageMeta<T: Config> {
	/// 发送方账户
	pub sender: T::AccountId,
	/// 接收方账户
	pub receiver: T::AccountId,
	/// IPFS CID（加密的消息内容）
	pub content_cid: BoundedVec<u8, <T as Config>::MaxCidLen>,
	/// 会话ID（用于分组消息）
	pub session_id: T::Hash,
	/// 消息类型
	pub msg_type: MessageType,
	/// 发送时间（区块高度）
	pub sent_at: BlockNumberFor<T>,
	/// 是否已读
	pub is_read: bool,
	/// 发送方是否已删除（软删除）
	pub is_deleted_by_sender: bool,
	/// 接收方是否已删除（软删除）
	pub is_deleted_by_receiver: bool,
}

/// 函数级详细中文注释：会话信息结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Session<T: Config> {
	/// 会话ID
	pub id: T::Hash,
	/// 参与者列表（最多2人，私聊）
	pub participants: BoundedVec<T::AccountId, ConstU32<2>>,
	/// 最后一条消息ID
	pub last_message_id: u64,
	/// 最后活跃时间
	pub last_active: BlockNumberFor<T>,
	/// 创建时间
	pub created_at: BlockNumberFor<T>,
	/// 是否归档
	pub is_archived: bool,
}

#[frame_support::pallet]
pub mod pallet {
	use super::*;

	/// 函数级详细中文注释：消息类型枚举
	#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
	pub enum MessageType {
		/// 文本消息
		Text,
		/// 图片消息
		Image,
		/// 文件消息
		File,
		/// 语音消息
		Voice,
		/// 系统消息（如订单状态变更）
		System,
	}

	impl Default for MessageType {
		fn default() -> Self {
			Self::Text
		}
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// 事件类型
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// 权重信息
		type WeightInfo: WeightInfo;

		/// IPFS CID最大长度（通常为46-59字节）
		#[pallet::constant]
		type MaxCidLen: Get<u32>;

		/// 每个用户最多会话数（已废弃，但保留以兼容）
		#[pallet::constant]
		type MaxSessionsPerUser: Get<u32>;

		/// 每个会话最多消息数（已废弃，但保留以兼容）
		#[pallet::constant]
		type MaxMessagesPerSession: Get<u32>;

		/// 频率限制：时间窗口（区块数）
		/// 例如：100个区块 ≈ 10分钟（假设6秒一个块）
		#[pallet::constant]
		type RateLimitWindow: Get<BlockNumberFor<Self>>;

		/// 频率限制：时间窗口内最大消息数
		/// 例如：10条消息/10分钟
		#[pallet::constant]
		type MaxMessagesPerWindow: Get<u32>;

		/// 消息过期时间（区块数）
		/// 例如：2_592_000个区块 ≈ 180天（假设6秒一个块）
		/// 过期后可被清理
		#[pallet::constant]
		type MessageExpirationTime: Get<BlockNumberFor<Self>>;
	}

	/// 函数级详细中文注释：消息元数据存储
	/// - Key: 消息ID
	/// - Value: 消息元数据
	#[pallet::storage]
	#[pallet::getter(fn messages)]
	pub type Messages<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64,
		MessageMeta<T>,
	>;

	/// 函数级详细中文注释：下一个消息ID
	#[pallet::storage]
	#[pallet::getter(fn next_message_id)]
	pub type NextMessageId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// 函数级详细中文注释：会话存储
	/// - Key: 会话ID
	/// - Value: 会话信息
	#[pallet::storage]
	#[pallet::getter(fn sessions)]
	pub type Sessions<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::Hash,
		Session<T>,
	>;

	/// 函数级详细中文注释：用户会话索引
	/// - Key1: 账户地址
	/// - Key2: 会话ID
	/// - Value: () 标记（只用于索引）
	/// - 改用DoubleMap，支持无限会话
	#[pallet::storage]
	pub type UserSessions<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		Blake2_128Concat,
		T::Hash,
		(),
		OptionQuery,
	>;

	/// 函数级详细中文注释：会话消息索引
	/// - Key1: 会话ID
	/// - Key2: 消息ID
	/// - Value: () 标记（只用于索引）
	/// - 改用DoubleMap，支持无限消息存储
	#[pallet::storage]
	pub type SessionMessages<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		T::Hash,              // session_id
		Blake2_128Concat,
		u64,                  // message_id
		(),
		OptionQuery,
	>;

	/// 函数级详细中文注释：未读消息计数
	/// - Key: (接收方, 会话ID)
	/// - Value: 未读数量
	#[pallet::storage]
	#[pallet::getter(fn unread_count)]
	pub type UnreadCount<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		(T::AccountId, T::Hash),
		u32,
		ValueQuery,
	>;

	/// 函数级详细中文注释：黑名单
	/// - Key: (用户, 被拉黑的用户)
	/// - Value: () 标记
	/// - 用户可以拉黑其他用户，拉黑后对方无法发送消息
	#[pallet::storage]
	pub type Blacklist<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		T::AccountId,         // 用户
		Blake2_128Concat,
		T::AccountId,         // 被拉黑的用户
		(),
		OptionQuery,
	>;

	/// 函数级详细中文注释：消息发送频率限制
	/// - Key: 用户账户
	/// - Value: (最后发送时间, 时间窗口内发送次数)
	/// - 用于防止垃圾消息
	#[pallet::storage]
	pub type MessageRateLimit<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		(BlockNumberFor<T>, u32),  // (last_time, count)
		ValueQuery,
	>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 函数级详细中文注释：消息已发送
		/// [msg_id, session_id, sender, receiver]
		MessageSent {
			msg_id: u64,
			session_id: T::Hash,
			sender: T::AccountId,
			receiver: T::AccountId,
		},

		/// 函数级详细中文注释：消息已读
		/// [msg_id, reader]
		MessageRead {
			msg_id: u64,
			reader: T::AccountId,
		},

		/// 函数级详细中文注释：消息已删除
		/// [msg_id, deleter]
		MessageDeleted {
			msg_id: u64,
			deleter: T::AccountId,
		},

		/// 函数级详细中文注释：会话已创建
		/// [session_id, participants]
		SessionCreated {
			session_id: T::Hash,
			participants: BoundedVec<T::AccountId, ConstU32<2>>,
		},

		/// 函数级详细中文注释：会话已标记为已读
		/// [session_id, user]
		SessionMarkedAsRead {
			session_id: T::Hash,
			user: T::AccountId,
		},

		/// 函数级详细中文注释：会话已归档
		/// [session_id, operator]
		SessionArchived {
			session_id: T::Hash,
			operator: T::AccountId,
		},

		/// 函数级详细中文注释：用户已被拉黑
		/// [blocker, blocked]
		UserBlocked {
			blocker: T::AccountId,
			blocked: T::AccountId,
		},

		/// 函数级详细中文注释：用户已被解除拉黑
		/// [unblocker, unblocked]
		UserUnblocked {
			unblocker: T::AccountId,
			unblocked: T::AccountId,
		},

		/// 函数级详细中文注释：旧消息已清理
		/// [operator, count]
		OldMessagesCleanedUp {
			operator: T::AccountId,
			count: u32,
		},
	}

	#[pallet::error]
	pub enum Error<T> {
		/// CID 太长，超过了最大长度限制
		CidTooLong,
		/// 消息未找到，请检查消息ID是否正确
		MessageNotFound,
		/// 会话未找到，请检查会话ID是否正确
		SessionNotFound,
		/// 不是接收方，只有消息接收方才能执行此操作
		NotReceiver,
		/// 未授权，您没有权限执行此操作
		NotAuthorized,
		/// 不是会话参与者，只有会话参与者才能执行此操作
		NotSessionParticipant,
		/// 会话消息太多，已达到单个会话的消息数量上限（已废弃）
		TooManyMessages,
		/// 用户会话太多，已达到单个用户的会话数量上限（已废弃）
		TooManySessions,
		/// 参与者太多，会话只支持2个参与者
		TooManyParticipants,
		/// CID未加密，根据系统规则，聊天消息必须加密后上传到IPFS
		CidNotEncrypted,
		/// 消息ID列表为空
		EmptyMessageList,
		/// 分页参数无效，offset或limit超出合理范围
		InvalidPagination,
		/// 接收方已将您拉黑，无法发送消息
		ReceiverBlockedSender,
		/// 发送消息过于频繁，请稍后再试
		RateLimitExceeded,
		/// 不能拉黑自己
		CannotBlockSelf,
		/// 清理数量参数无效（必须大于0且小于等于1000）
		InvalidCleanupLimit,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 函数级详细中文注释：发送消息
		/// 
		/// # 参数
		/// - `receiver`: 接收方地址
		/// - `content_cid`: IPFS CID（加密的消息内容）
		/// - `msg_type_code`: 消息类型代码 (0=Text, 1=Image, 2=File, 3=Voice, 4=System)
		/// - `session_id`: 会话ID（可选，如果为None则自动创建新会话）
		/// 
		/// # 流程
		/// 1. 验证CID长度
		/// 2. 获取或创建会话
		/// 3. 生成消息ID并存储
		/// 4. 更新会话信息
		/// 5. 添加到会话消息列表
		/// 6. 增加未读计数
		/// 7. 触发事件
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::send_message())]
		pub fn send_message(
			origin: OriginFor<T>,
			receiver: T::AccountId,
			content_cid: Vec<u8>,
			msg_type_code: u8,
			session_id: Option<T::Hash>,
		) -> DispatchResult {
			let sender = ensure_signed(origin)?;

			// 【安全检查1】检查接收方是否拉黑了发送方
			ensure!(
				!Blacklist::<T>::contains_key(&receiver, &sender),
				Error::<T>::ReceiverBlockedSender
			);

			// 【安全检查2】频率限制检查
			Self::check_rate_limit(&sender)?;

			// 验证CID长度
			ensure!(content_cid.len() <= T::MaxCidLen::get() as usize, Error::<T>::CidTooLong);
			
			// 【重要】验证CID是否加密（规则6）
			// 根据项目规则，除证据类数据外，其他数据CID必须加密
			// 聊天消息必须加密
			ensure!(Self::is_cid_encrypted(&content_cid), Error::<T>::CidNotEncrypted);
			
			let cid_bounded: BoundedVec<u8, T::MaxCidLen> = content_cid
				.try_into()
				.map_err(|_| Error::<T>::CidTooLong)?;

			// 获取或创建会话
			let session_id = if let Some(id) = session_id {
				id
			} else {
				Self::create_session(&sender, &receiver)?
			};

			// 生成消息ID
			let msg_id = NextMessageId::<T>::get();
			NextMessageId::<T>::put(msg_id.saturating_add(1));

			// 转换消息类型代码为枚举
			let msg_type = match msg_type_code {
				0 => MessageType::Text,
				1 => MessageType::Image,
				2 => MessageType::File,
				3 => MessageType::Voice,
				4 => MessageType::System,
				_ => MessageType::Text, // 默认为文本
			};

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
				is_deleted_by_sender: false,
				is_deleted_by_receiver: false,
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

			// 添加到会话消息索引
			SessionMessages::<T>::insert(session_id, msg_id, ());

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
		/// 
		/// # 参数
		/// - `msg_id`: 消息ID
		/// 
		/// # 流程
		/// 1. 验证消息存在
		/// 2. 验证调用者是接收方
		/// 3. 标记已读
		/// 4. 减少未读计数
		/// 5. 触发事件
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::mark_as_read())]
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
		/// 
		/// # 参数
		/// - `msg_id`: 消息ID
		/// 
		/// # 流程
		/// 1. 验证消息存在
		/// 2. 验证调用者是发送方或接收方
		/// 3. 分别标记删除（发送方删除不影响接收方，反之亦然）
		/// 4. 触发事件
		/// 
		/// # 说明
		/// - 发送方删除：只对发送方隐藏，接收方仍可见
		/// - 接收方删除：只对接收方隐藏，发送方仍可见
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::delete_message())]
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

				// 分别标记删除
				if msg.sender == who {
					msg.is_deleted_by_sender = true;
				} else {
					msg.is_deleted_by_receiver = true;
				}

				Ok(())
			})?;

			Self::deposit_event(Event::MessageDeleted { msg_id, deleter: who });

			Ok(())
		}

		/// 函数级详细中文注释：批量标记已读（指定消息列表）
		/// 
		/// # 参数
		/// - `message_ids`: 消息ID列表
		/// 
		/// # 流程
		/// 1. 验证消息列表非空
		/// 2. 批量标记已读
		/// 3. 更新未读计数
		/// 4. 触发事件
		#[pallet::call_index(3)]
		#[pallet::weight(T::WeightInfo::mark_batch_as_read(message_ids.len() as u32))]
		pub fn mark_batch_as_read(
			origin: OriginFor<T>,
			message_ids: Vec<u64>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 验证列表非空
			ensure!(!message_ids.is_empty(), Error::<T>::EmptyMessageList);

			let mut marked_count = 0u32;

			// 批量标记已读
			for msg_id in message_ids.iter() {
				if let Some(mut msg) = Messages::<T>::get(msg_id) {
					// 验证是接收方
					if msg.receiver == who && !msg.is_read {
						msg.is_read = true;
						Messages::<T>::insert(msg_id, msg.clone());
						marked_count = marked_count.saturating_add(1);

						// 减少未读计数
						UnreadCount::<T>::mutate((who.clone(), msg.session_id), |count| {
							*count = count.saturating_sub(1);
						});

						// 触发事件
						Self::deposit_event(Event::MessageRead {
							msg_id: *msg_id,
							reader: who.clone(),
						});
					}
				}
			}

			Ok(())
		}

		/// 函数级详细中文注释：批量标记已读（按会话）
		/// 
		/// # 参数
		/// - `session_id`: 会话ID
		/// 
		/// # 流程
		/// 1. 验证会话存在且用户是参与者
		/// 2. 获取会话的所有消息
		/// 3. 批量标记已读
		/// 4. 清空未读计数
		/// 5. 触发事件
		#[pallet::call_index(4)]
		#[pallet::weight(T::WeightInfo::mark_session_as_read(100))]
		pub fn mark_session_as_read(
			origin: OriginFor<T>,
			session_id: T::Hash,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 验证会话存在且用户是参与者
			let session = Sessions::<T>::get(session_id)
				.ok_or(Error::<T>::SessionNotFound)?;
			ensure!(
				session.participants.contains(&who),
				Error::<T>::NotSessionParticipant
			);

			// 获取会话的所有消息ID
			let message_ids: Vec<u64> = SessionMessages::<T>::iter_prefix(session_id)
				.map(|(msg_id, _)| msg_id)
				.collect();

			// 批量标记已读
			for msg_id in message_ids.iter() {
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

		/// 函数级详细中文注释：归档会话
		/// 
		/// # 参数
		/// - `session_id`: 会话ID
		/// 
		/// # 流程
		/// 1. 验证会话存在
		/// 2. 验证用户是参与者
		/// 3. 标记会话为归档状态
		/// 4. 触发事件
		#[pallet::call_index(5)]
		#[pallet::weight(T::WeightInfo::archive_session())]
		pub fn archive_session(
			origin: OriginFor<T>,
			session_id: T::Hash,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 验证会话存在并更新归档状态
			Sessions::<T>::try_mutate(session_id, |maybe_session| -> DispatchResult {
				let session = maybe_session.as_mut().ok_or(Error::<T>::SessionNotFound)?;
				
				// 验证是参与者
				ensure!(
					session.participants.contains(&who),
					Error::<T>::NotSessionParticipant
				);

				// 标记为归档
				session.is_archived = true;

				Ok(())
			})?;

			Self::deposit_event(Event::SessionArchived {
				session_id,
				operator: who,
			});

			Ok(())
		}

		/// 函数级详细中文注释：拉黑用户
		/// 
		/// # 参数
		/// - `blocked_user`: 要拉黑的用户
		/// 
		/// # 流程
		/// 1. 验证不能拉黑自己
		/// 2. 添加到黑名单
		/// 3. 触发事件
		/// 
		/// # 说明
		/// 拉黑后，被拉黑的用户无法向您发送消息
		#[pallet::call_index(6)]
		#[pallet::weight(T::WeightInfo::block_user())]
		pub fn block_user(
			origin: OriginFor<T>,
			blocked_user: T::AccountId,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 不能拉黑自己
			ensure!(who != blocked_user, Error::<T>::CannotBlockSelf);

			// 添加到黑名单
			Blacklist::<T>::insert(&who, &blocked_user, ());

			Self::deposit_event(Event::UserBlocked {
				blocker: who,
				blocked: blocked_user,
			});

			Ok(())
		}

		/// 函数级详细中文注释：解除拉黑
		/// 
		/// # 参数
		/// - `unblocked_user`: 要解除拉黑的用户
		/// 
		/// # 流程
		/// 1. 从黑名单移除
		/// 2. 触发事件
		#[pallet::call_index(7)]
		#[pallet::weight(T::WeightInfo::unblock_user())]
		pub fn unblock_user(
			origin: OriginFor<T>,
			unblocked_user: T::AccountId,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 从黑名单移除
			Blacklist::<T>::remove(&who, &unblocked_user);

			Self::deposit_event(Event::UserUnblocked {
				unblocker: who,
				unblocked: unblocked_user,
			});

			Ok(())
		}

		/// 函数级详细中文注释：清理过期消息
		/// 
		/// # 参数
		/// - `limit`: 每次清理的最大消息数（1-1000）
		/// 
		/// # 流程
		/// 1. 验证limit参数
		/// 2. 遍历消息，找出过期且被双方都删除的消息
		/// 3. 从存储中移除这些消息
		/// 4. 触发事件
		/// 
		/// # 说明
		/// - 消息必须满足以下条件才会被清理：
		///   1. 发送时间超过MessageExpirationTime
		///   2. 被发送方和接收方都标记为删除
		/// - 该操作需要权限控制，建议由治理或定期任务调用
		/// - 一次最多清理1000条，避免区块过载
		#[pallet::call_index(8)]
		#[pallet::weight(T::WeightInfo::cleanup_old_messages(*limit))]
		pub fn cleanup_old_messages(
			origin: OriginFor<T>,
			limit: u32,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 验证limit参数（1-1000）
			ensure!(limit > 0 && limit <= 1000, Error::<T>::InvalidCleanupLimit);

			let now = <frame_system::Pallet<T>>::block_number();
			let expiration_time = T::MessageExpirationTime::get();
			
			let mut cleaned_count = 0u32;
			let mut messages_to_remove: Vec<(u64, T::Hash)> = Vec::new();

			// 遍历所有消息，找出需要清理的
			for (msg_id, msg) in Messages::<T>::iter() {
				if cleaned_count >= limit {
					break;
				}

				// 检查是否过期
				let age = now.saturating_sub(msg.sent_at);
				if age >= expiration_time {
					// 检查是否被双方都删除
					if msg.is_deleted_by_sender && msg.is_deleted_by_receiver {
						messages_to_remove.push((msg_id, msg.session_id));
						cleaned_count = cleaned_count.saturating_add(1);
					}
				}
			}

			// 移除消息
			for (msg_id, session_id) in messages_to_remove.iter() {
				Messages::<T>::remove(msg_id);
				SessionMessages::<T>::remove(session_id, msg_id);
			}

			Self::deposit_event(Event::OldMessagesCleanedUp {
				operator: who,
				count: cleaned_count,
			});

			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// 函数级详细中文注释：检查消息发送频率限制
		/// 
		/// # 参数
		/// - `sender`: 发送方账户
		/// 
		/// # 返回
		/// - Ok(()): 通过频率限制
		/// - Err(Error): 超过频率限制
		/// 
		/// # 说明
		/// 防止用户在短时间内发送大量消息（防垃圾消息）
		/// 限制：在RateLimitWindow个区块内最多发送MaxMessagesPerWindow条消息
		fn check_rate_limit(sender: &T::AccountId) -> DispatchResult {
			let now = <frame_system::Pallet<T>>::block_number();
			let window = T::RateLimitWindow::get();
			let max_messages = T::MaxMessagesPerWindow::get();

			MessageRateLimit::<T>::try_mutate(sender, |(last_time, count)| -> DispatchResult {
				// 检查是否在同一个时间窗口内
				let elapsed = now.saturating_sub(*last_time);
				if elapsed <= window {
					// 在窗口内，检查计数
					ensure!(*count < max_messages, Error::<T>::RateLimitExceeded);
					*count = count.saturating_add(1);
				} else {
					// 超出窗口，重置计数
					*last_time = now;
					*count = 1;
				}
				Ok(())
			})
		}

		/// 函数级详细中文注释：检查CID是否加密
		/// 
		/// # 参数
		/// - `cid`: IPFS CID字节数组
		/// 
		/// # 返回
		/// - true: CID已加密
		/// - false: CID未加密
		/// 
		/// # 说明
		/// 根据项目规则6，除证据类数据外，其他数据CID必须加密
		/// 加密的CID通常以特定前缀开头或具有特定长度特征
		/// 这里简化实现：检查CID长度是否符合加密后的特征（>46字节）
		pub fn is_cid_encrypted(cid: &[u8]) -> bool {
			// 普通IPFS CIDv0通常是46字节（以Qm开头）
			// CIDv1可能更长（以b开头，base32编码）
			// 加密后的CID通常会更长
			// 这里做简单检查：如果CID长度>50字节，认为是加密的
			// 实际项目中可以根据具体加密方案调整判断逻辑
			if cid.len() < 46 {
				// 太短，不是有效的CID
				return false;
			}
			
			// 检查是否是未加密的标准CID
			// CIDv0以"Qm"开头（base58编码）
			if cid.len() == 46 && cid.starts_with(b"Qm") {
				return false; // 标准CIDv0，未加密
			}
			
			// 其他情况认为是加密的（包括长度>50的CID）
			true
		}

		/// 函数级详细中文注释：创建会话
		/// 
		/// # 参数
		/// - `user1`: 第一个用户
		/// - `user2`: 第二个用户
		/// 
		/// # 返回
		/// - 会话ID
		/// 
		/// # 流程
		/// 1. 生成会话ID（基于两个用户地址的哈希）
		/// 2. 检查会话是否已存在
		/// 3. 创建新会话
		/// 4. 添加到用户会话列表
		/// 5. 触发事件
		pub fn create_session(
			user1: &T::AccountId,
			user2: &T::AccountId,
		) -> Result<T::Hash, DispatchError> {
			// 生成会话ID（基于两个用户地址的哈希，需要排序保证一致性）
			let mut participants = alloc::vec![user1.clone(), user2.clone()];
			participants.sort();
			let session_id = T::Hashing::hash_of(&participants);

			// 检查会话是否已存在
			if Sessions::<T>::contains_key(session_id) {
				return Ok(session_id);
			}

			// 创建新会话
			let now = <frame_system::Pallet<T>>::block_number();
			let participants_bounded: BoundedVec<T::AccountId, ConstU32<2>> =
				participants.clone().try_into().map_err(|_| Error::<T>::TooManyParticipants)?;

			let session = Session {
				id: session_id,
				participants: participants_bounded.clone(),
				last_message_id: 0,
				last_active: now,
				created_at: now,
				is_archived: false,
			};

			Sessions::<T>::insert(session_id, session);

			// 添加到用户会话索引
			for user in participants.iter() {
				UserSessions::<T>::insert(user, session_id, ());
			}

			Self::deposit_event(Event::SessionCreated {
				session_id,
				participants: participants_bounded,
			});

			Ok(session_id)
		}

		/// 函数级详细中文注释：查询单条消息
		/// 
		/// # 参数
		/// - `message_id`: 消息ID
		/// 
		/// # 返回
		/// - Some(MessageMeta): 消息元数据
		/// - None: 消息不存在
		pub fn get_message(message_id: u64) -> Option<MessageMeta<T>> {
			Messages::<T>::get(message_id)
		}

		/// 函数级详细中文注释：分页查询会话消息
		/// 
		/// # 参数
		/// - `session_id`: 会话ID
		/// - `offset`: 偏移量（从0开始）
		/// - `limit`: 每页数量（最多100条）
		/// 
		/// # 返回
		/// - Vec<u64>: 消息ID列表（按时间倒序）
		/// 
		/// # 说明
		/// 返回最新的消息优先（倒序），前端需要再次查询消息详情
		pub fn list_messages_by_session(
			session_id: T::Hash,
			offset: u32,
			limit: u32,
		) -> Vec<u64> {
			// 从StorageDoubleMap收集所有消息ID
			let mut messages: Vec<u64> = SessionMessages::<T>::iter_prefix(session_id)
				.map(|(msg_id, _)| msg_id)
				.collect();
			
			// 按消息ID排序（消息ID是递增的，所以倒序就是最新的在前）
			messages.sort_by(|a, b| b.cmp(a));
			
			let total = messages.len();
			
			// 限制每页最多100条
			let limit = limit.min(100) as usize;
			let offset = offset as usize;
			
			if offset >= total {
				return Vec::new();
			}
			
			// 分页返回
			messages
				.into_iter()
				.skip(offset)
				.take(limit)
				.collect()
		}

		/// 函数级详细中文注释：查询会话信息
		/// 
		/// # 参数
		/// - `session_id`: 会话ID
		/// 
		/// # 返回
		/// - Some(Session): 会话信息
		/// - None: 会话不存在
		pub fn get_session(session_id: T::Hash) -> Option<Session<T>> {
			Sessions::<T>::get(session_id)
		}

		/// 函数级详细中文注释：查询用户的所有会话
		/// 
		/// # 参数
		/// - `user`: 用户账户
		/// 
		/// # 返回
		/// - Vec<T::Hash>: 会话ID列表（按最后活跃时间倒序）
		pub fn list_sessions(user: T::AccountId) -> Vec<T::Hash> {
			// 从StorageDoubleMap收集所有会话ID
			let session_ids: Vec<T::Hash> = UserSessions::<T>::iter_prefix(&user)
				.map(|(sid, _)| sid)
				.collect();
			
			// 按最后活跃时间排序（最新的在前）
			let mut sessions: Vec<(T::Hash, BlockNumberFor<T>)> = session_ids
				.iter()
				.filter_map(|&sid| {
					Sessions::<T>::get(sid).map(|s| (sid, s.last_active))
				})
				.collect();
			
			sessions.sort_by(|a, b| b.1.cmp(&a.1)); // 倒序
			sessions.into_iter().map(|(sid, _)| sid).collect()
		}

		/// 函数级详细中文注释：查询未读消息数
		/// 
		/// # 参数
		/// - `user`: 用户账户
		/// - `session_id`: 会话ID（可选）
		/// 
		/// # 返回
		/// - u32: 未读消息数
		/// 
		/// # 说明
		/// - 如果提供session_id，返回该会话的未读数
		/// - 如果不提供session_id，返回用户所有会话的未读总数
		pub fn get_unread_count(user: T::AccountId, session_id: Option<T::Hash>) -> u32 {
			if let Some(sid) = session_id {
				// 查询指定会话的未读数
				UnreadCount::<T>::get((user, sid))
			} else {
				// 查询所有会话的未读总数
				let session_ids: Vec<T::Hash> = UserSessions::<T>::iter_prefix(&user)
					.map(|(sid, _)| sid)
					.collect();
				session_ids
					.iter()
					.map(|&sid| UnreadCount::<T>::get((user.clone(), sid)))
					.sum()
			}
		}

		/// 函数级详细中文注释：检查用户是否被拉黑
		/// 
		/// # 参数
		/// - `blocker`: 可能拉黑的用户
		/// - `potential_blocked`: 可能被拉黑的用户
		/// 
		/// # 返回
		/// - true: 已被拉黑
		/// - false: 未被拉黑
		pub fn is_blocked(blocker: T::AccountId, potential_blocked: T::AccountId) -> bool {
			Blacklist::<T>::contains_key(&blocker, &potential_blocked)
		}

		/// 函数级详细中文注释：查询用户的黑名单列表
		/// 
		/// # 参数
		/// - `user`: 用户账户
		/// 
		/// # 返回
		/// - Vec<T::AccountId>: 被该用户拉黑的账户列表
		pub fn list_blocked_users(user: T::AccountId) -> Vec<T::AccountId> {
			Blacklist::<T>::iter_prefix(&user)
				.map(|(blocked, _)| blocked)
				.collect()
		}
	}
}

