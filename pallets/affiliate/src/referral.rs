//! 函数级中文注释：推荐关系管理子模块
//!
//! 功能：
//! - 推荐人绑定（bind_sponsor）
//! - 推荐码管理（claim_code）
//! - 推荐链查询（get_referral_chain）
//!
//! 整合自：pallet-memo-referrals

use super::*;
use frame_support::{pallet_prelude::*, BoundedVec};
use sp_std::vec::Vec;

extern crate alloc;

/// 函数级中文注释：推荐关系存储和查询
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：获取推荐链（最多15层）
    ///
    /// 参数：
    /// - who: 起始账户
    ///
    /// 返回：推荐链（Vec<AccountId>），从直接推荐人开始
    pub fn get_referral_chain(who: &T::AccountId) -> Vec<T::AccountId> {
        let mut chain = Vec::new();
        let mut current = who.clone();

        for _ in 0..crate::types::MAX_REFERRAL_CHAIN {
            if let Some(sponsor) = Sponsors::<T>::get(&current) {
                chain.push(sponsor.clone());
                current = sponsor;
            } else {
                break;
            }
        }

        chain
    }

    /// 函数级中文注释：检查循环绑定
    ///
    /// 防止 A→B→C→A 这种循环
    ///
    /// 参数：
    /// - who: 发起绑定的账户
    /// - sponsor: 要绑定的推荐人
    ///
    /// 返回：是否会形成循环
    pub fn would_create_cycle(who: &T::AccountId, sponsor: &T::AccountId) -> bool {
        let mut current = sponsor.clone();
        let max_hops = T::MaxSearchHops::get();

        for _ in 0..max_hops {
            if let Some(next_sponsor) = Sponsors::<T>::get(&current) {
                if &next_sponsor == who {
                    // 检测到循环
                    return true;
                }
                current = next_sponsor;
            } else {
                break;
            }
        }

        false
    }

    /// 函数级中文注释：通过推荐码查找账户
    ///
    /// 参数：
    /// - code: 推荐码（Vec<u8>）
    ///
    /// 返回：对应的账户（Option<AccountId>）
    pub fn find_account_by_code(
        code: &BoundedVec<u8, T::MaxCodeLen>,
    ) -> Option<T::AccountId> {
        AccountByCode::<T>::get(code)
    }

    /// 函数级中文注释：自动认领推荐码（默认推荐码）
    ///
    /// 规则：
    /// - 有效会员可自动认领默认推荐码
    /// - 默认推荐码格式：账户ID十六进制前8位
    ///
    /// 参数：
    /// - who: 要认领推荐码的账户
    ///
    /// 返回：是否认领成功
    pub fn try_auto_claim_code(who: &T::AccountId) -> bool {
        // 检查是否已认领
        if CodeByAccount::<T>::contains_key(who) {
            return false;
        }

        // 检查会员有效性
        if !T::MembershipProvider::is_valid_member(who) {
            return false;
        }

        // 生成默认推荐码（账户ID前8位十六进制）
        let account_bytes = who.encode();
        let hex_str: sp_std::vec::Vec<u8> = account_bytes
            .iter()
            .take(4)
            .flat_map(|b| {
                let hex = alloc::format!("{:02x}", b);
                hex.into_bytes()
            })
            .collect();
        
        if let Ok(default_code) = BoundedVec::<u8, T::MaxCodeLen>::try_from(hex_str) {
            // 检查推荐码是否已被占用
            if AccountByCode::<T>::contains_key(&default_code) {
                return false;
            }

            // 认领推荐码
            AccountByCode::<T>::insert(&default_code, who);
            CodeByAccount::<T>::insert(who, &default_code);

            // 发射事件
            Self::deposit_event(Event::CodeClaimed {
                who: who.clone(),
                code: default_code,
            });

            true
        } else {
            false
        }
    }
}

/// 函数级中文注释：推荐关系可调用函数
impl<T: Config> Pallet<T> {
    /// 函数级中文注释：绑定推荐人
    ///
    /// 参数：
    /// - origin: 发起者
    /// - sponsor_code: 推荐码（Vec<u8>）
    ///
    /// 验证：
    /// - 用户未绑定过推荐人
    /// - 推荐码对应的账户存在
    /// - 不能绑定自己
    /// - 不能形成循环
    pub(crate) fn do_bind_sponsor(
        who: T::AccountId,
        sponsor_code: Vec<u8>,
    ) -> DispatchResult {
        // 验证：用户未绑定过
        ensure!(
            !Sponsors::<T>::contains_key(&who),
            Error::<T>::AlreadyBound
        );

        // 转换为 BoundedVec
        let code: BoundedVec<u8, T::MaxCodeLen> = sponsor_code
            .try_into()
            .map_err(|_| Error::<T>::CodeTooLong)?;

        // 验证：推荐码长度
        ensure!(
            code.len() >= crate::types::MIN_CODE_LEN as usize,
            Error::<T>::CodeTooShort
        );

        // 查找推荐人
        let sponsor = Self::find_account_by_code(&code)
            .ok_or(Error::<T>::CodeNotFound)?;

        // 验证：不能绑定自己
        ensure!(sponsor != who, Error::<T>::CannotBindSelf);

        // 验证：不能形成循环
        ensure!(
            !Self::would_create_cycle(&who, &sponsor),
            Error::<T>::WouldCreateCycle
        );

        // 绑定推荐人
        Sponsors::<T>::insert(&who, &sponsor);

        // 发射事件
        Self::deposit_event(Event::SponsorBound {
            who: who.clone(),
            sponsor: sponsor.clone(),
        });

        Ok(())
    }

    /// 函数级中文注释：认领推荐码
    ///
    /// 参数：
    /// - origin: 发起者
    /// - code: 推荐码（Vec<u8>）
    ///
    /// 验证：
    /// - 调用者是有效会员
    /// - 推荐码未被占用
    /// - 推荐码长度限制（4-16字符）
    pub(crate) fn do_claim_code(
        who: T::AccountId,
        code_vec: Vec<u8>,
    ) -> DispatchResult {
        // 验证：调用者是有效会员
        ensure!(
            T::MembershipProvider::is_valid_member(&who),
            Error::<T>::NotMember
        );

        // 转换为 BoundedVec
        let code: BoundedVec<u8, T::MaxCodeLen> = code_vec
            .try_into()
            .map_err(|_| Error::<T>::CodeTooLong)?;

        // 验证：推荐码长度
        ensure!(
            code.len() >= crate::types::MIN_CODE_LEN as usize,
            Error::<T>::CodeTooShort
        );

        // 验证：推荐码未被占用
        ensure!(
            !AccountByCode::<T>::contains_key(&code),
            Error::<T>::CodeAlreadyTaken
        );

        // 验证：用户未认领其他推荐码
        ensure!(
            !CodeByAccount::<T>::contains_key(&who),
            Error::<T>::AlreadyHasCode
        );

        // 认领推荐码
        AccountByCode::<T>::insert(&code, &who);
        CodeByAccount::<T>::insert(&who, &code);

        // 发射事件
        Self::deposit_event(Event::CodeClaimed {
            who: who.clone(),
            code,
        });

        Ok(())
    }
}

