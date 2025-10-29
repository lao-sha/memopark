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

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_runtime::traits::Hash;

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
	/// 是否已删除（软删除）
	pub is_deleted: bool,
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

		/// IPFS CID最大长度（通常为46-59字节）
		#[pallet::constant]
		type MaxCidLen: Get<u32>;

		/// 每个用户最多会话数
		#[pallet::constant]
		type MaxSessionsPerUser: Get<u32>;

		/// 每个会话最多消息数（链上索引）
		#[pallet::constant]
		type MaxMessagesPerSession: Get<u32>;
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
	/// - Key: 账户地址
	/// - Value: 会话ID列表
	#[pallet::storage]
	#[pallet::getter(fn user_sessions)]
	pub type UserSessions<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<T::Hash, <T as Config>::MaxSessionsPerUser>,
		ValueQuery,
	>;

	/// 函数级详细中文注释：会话消息索引
	/// - Key: 会话ID
	/// - Value: 消息ID列表（最多保留最近N条）
	#[pallet::storage]
	#[pallet::getter(fn session_messages)]
	pub type SessionMessages<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::Hash,
		BoundedVec<u64, <T as Config>::MaxMessagesPerSession>,
		ValueQuery,
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
	}

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
		#[pallet::weight(10_000)]
		pub fn send_message(
			origin: OriginFor<T>,
			receiver: T::AccountId,
			content_cid: Vec<u8>,
			msg_type_code: u8,
			session_id: Option<T::Hash>,
		) -> DispatchResult {
			let sender = ensure_signed(origin)?;

			// 验证CID长度
			ensure!(content_cid.len() <= T::MaxCidLen::get() as usize, Error::<T>::CidTooLong);
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
		/// 
		/// # 参数
		/// - `msg_id`: 消息ID
		/// 
		/// # 流程
		/// 1. 验证消息存在
		/// 2. 验证调用者是发送方或接收方
		/// 3. 软删除标记
		/// 4. 触发事件
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
		#[pallet::call_index(3)]
		#[pallet::weight(10_000)]
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

	impl<T: Config> Pallet<T> {
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

			// 添加到用户会话列表
			for user in participants.iter() {
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
}

