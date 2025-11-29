// 函数级详细中文注释：逝者文本管理模块（整合自 pallet-deceased-text）
// 
// ### 功能概述
// - 管理逝者相关的文本内容（Article/Message/Life/Eulogy）
// - 提供内容投诉与治理功能
// - 自动IPFS Pin集成
// 
// ### 设计理念
// - 与核心deceased模块解耦，通过trait接口交互
// - 统一的押金与成熟期机制
// - 治理起源统一校验

#![allow(unused_imports)]

use super::*;
// 函数级中文注释：从pallet模块导入Config trait和BalanceOf类型别名
use crate::pallet::{Config, BalanceOf};
use alloc::vec::Vec;
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use pallet_stardust_ipfs::IpfsPinner;

/// 函数级中文注释：文本类型（Article/Message）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum TextKind {
    Article,
    Message,
}

/// 函数级中文注释：文本记录（仅存放 CID、标题/摘要等元数据）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct TextRecord<T: Config> {
    pub id: T::TextId,
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::TokenLimit>,
    pub author: T::AccountId,
    pub kind: TextKind,
    pub cid: BoundedVec<u8, T::StringLimit>,
    pub title: Option<BoundedVec<u8, T::StringLimit>>,
    pub summary: Option<BoundedVec<u8, T::StringLimit>>,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：生平（Life）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Life<T: Config> {
    pub owner: T::AccountId,
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::TokenLimit>,
    pub cid: BoundedVec<u8, T::StringLimit>,
    pub updated: BlockNumberFor<T>,
    pub version: u32,
    pub last_editor: Option<T::AccountId>,
}

/// 函数级中文注释：投诉状态。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum ComplaintStatus {
    Pending,
    Resolved,
}

/// 函数级中文注释：投诉案件：记录投诉人、押金与创建块。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
#[scale_info(skip_type_params(T))]
pub struct ComplaintCase<T: Config> {
    pub complainant: T::AccountId,
    pub deposit: BalanceOf<T>,
    pub created: BlockNumberFor<T>,
    pub status: ComplaintStatus,
}

/// 🆕 2025-11-26: Article押金记录（非拥有者创建文章的保证金）
///
/// ### 功能说明
/// - 记录非拥有者创建Article时缴纳的押金信息
/// - 押金到期后自动退还
/// - 使用Fungible::hold机制锁定资金
///
/// ### 字段说明
/// - `depositor`: 押金缴纳人（文章作者）
/// - `amount`: 押金金额（DUST单位）
/// - `locked_at`: 锁定时的区块号
/// - `expiry_block`: 到期区块号（锁定后365天）
/// - `deceased_id`: 关联的逝者ID
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct ArticleDepositRecord<T: Config> {
    /// 押金缴纳人（文章作者）
    pub depositor: T::AccountId,
    /// 押金金额（DUST）
    pub amount: BalanceOf<T>,
    /// 锁定区块
    pub locked_at: BlockNumberFor<T>,
    /// 到期区块（自动退还）
    pub expiry_block: BlockNumberFor<T>,
    /// 关联逝者ID
    pub deceased_id: T::DeceasedId,
}

