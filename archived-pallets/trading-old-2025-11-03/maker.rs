//! # Maker Module (做市商模块)
//! 
//! ## 函数级详细中文注释：提供做市商管理功能
//! 
//! ### 功能
//! 
//! 1. **做市商申请流程**
//!    - lock_deposit: 锁定押金
//!    - submit_info: 提交资料（真实姓名、身份证、TRON地址等）
//!    - update_info: 更新资料
//! 
//! 2. **做市商审核流程**
//!    - approve: 审批通过
//!    - reject: 驳回申请
//!    - expire: 超时自动过期
//! 
//! 3. **做市商押金管理**
//!    - request_withdrawal: 申请提现
//!    - execute_withdrawal: 执行提现
//!    - cancel_withdrawal: 取消提现
//!    - emergency_withdrawal: 紧急提现（治理）
//! 
//! 4. **做市商配置**
//!    - set_premium: 设置溢价率
//!    - pause_service: 暂停服务
//!    - resume_service: 恢复服务

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, ReservableCurrency, Get, ExistenceRequirement},
    BoundedVec,
};
use sp_runtime::{
    traits::{Saturating, SaturatedConversion},
};
use sp_std::vec::Vec;

use crate::{Config, BalanceOf, Cid, TronAddress};
use crate::common::{mask_name, mask_id_card, mask_birthday, is_valid_tron_address, is_valid_epay_config};

// ===== 数据结构 =====

/// 函数级详细中文注释：做市商申请状态
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ApplicationStatus {
    /// 押金已锁定，等待提交资料
    DepositLocked,
    /// 资料已提交，等待审核
    PendingReview,
    /// 审核通过，做市商已激活
    Active,
    /// 审核驳回
    Rejected,
    /// 申请已取消
    Cancelled,
    /// 申请已超时
    Expired,
}

/// 函数级详细中文注释：做市商业务方向
#[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum Direction {
    /// 仅买入（仅Bridge）- 做市商购买DUST，支付USDT
    Buy = 0,
    /// 仅卖出（仅OTC）- 做市商出售DUST，收取USDT
    Sell = 1,
    /// 双向（OTC + Bridge）- 既可以买入也可以卖出
    BuyAndSell = 2,
}

impl Direction {
    /// 从 u8 转换为 Direction
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Direction::Buy),
            1 => Some(Direction::Sell),
            2 => Some(Direction::BuyAndSell),
            _ => None,
        }
    }
}

impl Default for Direction {
    fn default() -> Self {
        Self::BuyAndSell
    }
}

/// 函数级详细中文注释：提现请求状态
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum WithdrawalStatus {
    /// 待执行（冷却期中）
    Pending,
    /// 已执行
    Executed,
    /// 已取消
    Cancelled,
}

/// 函数级详细中文注释：做市商申请记录
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct MakerApplication<T: Config + frame_system::Config> {
    /// 所有者账户
    pub owner: T::AccountId,
    /// 押金金额
    pub deposit: BalanceOf<T>,
    /// 申请状态
    pub status: ApplicationStatus,
    /// 业务方向
    pub direction: Direction,
    /// TRON地址（统一用于OTC收款和Bridge发款）
    pub tron_address: TronAddress,
    /// 公开资料CID（IPFS，加密）
    pub public_cid: Cid,
    /// 私密资料CID（IPFS，加密）
    pub private_cid: Cid,
    /// Buy溢价（基点，-500 ~ 500）
    pub buy_premium_bps: i16,
    /// Sell溢价（基点，-500 ~ 500）
    pub sell_premium_bps: i16,
    /// 最小交易金额
    pub min_amount: BalanceOf<T>,
    /// 创建时间（Unix时间戳，秒）
    pub created_at: u32,
    /// 资料提交截止时间（Unix时间戳，秒）
    pub info_deadline: u32,
    /// 审核截止时间（Unix时间戳，秒）
    pub review_deadline: u32,
    /// 服务暂停状态
    pub service_paused: bool,
    /// 已服务用户数量
    pub users_served: u32,
    /// 脱敏姓名（显示给用户）
    pub masked_full_name: BoundedVec<u8, ConstU32<64>>,
    /// 脱敏身份证号
    pub masked_id_card: BoundedVec<u8, ConstU32<32>>,
    /// 脱敏生日
    pub masked_birthday: BoundedVec<u8, ConstU32<16>>,
    /// 脱敏收款方式信息（JSON格式）
    pub masked_payment_info: BoundedVec<u8, ConstU32<512>>,
    /// 微信号（显示给用户）
    pub wechat_id: BoundedVec<u8, ConstU32<64>>,
    /// EPAY商户号（可选）
    pub epay_no: Option<BoundedVec<u8, ConstU32<32>>>,
    /// EPAY密钥（可选，加密存储）
    pub epay_key_cid: Option<Cid>,
}

/// 函数级详细中文注释：提现请求记录
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct WithdrawalRequest<Balance> {
    /// 提现金额
    pub amount: Balance,
    /// 申请时间（Unix时间戳，秒）
    pub requested_at: u32,
    /// 可执行时间（Unix时间戳，秒）
    pub executable_at: u32,
    /// 请求状态
    pub status: WithdrawalStatus,
}

// ===== 核心函数实现 =====

/// 函数级详细中文注释：锁定做市商押金
/// 
/// # 参数
/// - who: 申请人账户
/// 
/// # 返回
/// - DispatchResult
pub fn do_lock_deposit<T: Config + frame_system::Config>(who: &T::AccountId) -> DispatchResult {
    use crate::{NextMakerId, MakerApplications, AccountToMaker, Pallet, Event, Error};
    
    // 检查是否已申请
    ensure!(
        !AccountToMaker::<T>::contains_key(who),
        Error::<T>::MakerAlreadyExists
    );
    
    let deposit = T::MakerDepositAmount::get();
    
    // 锁定押金
    <T as Config>::Currency::reserve(who, deposit)
        .map_err(|_| Error::<T>::InsufficientBalance)?;
    
    // 获取新的做市商ID
    let maker_id = NextMakerId::<T>::get();
    NextMakerId::<T>::put(maker_id.saturating_add(1));
    
    // 获取当前时间
    let now = pallet_timestamp::Pallet::<T>::get().saturated_into::<u32>() / 1000;
    
    // 创建申请记录
    let application = MakerApplication::<T> {
        owner: who.clone(),
        deposit,
        status: ApplicationStatus::DepositLocked,
        direction: Direction::default(),
        tron_address: BoundedVec::default(),
        public_cid: BoundedVec::default(),
        private_cid: BoundedVec::default(),
        buy_premium_bps: 0,
        sell_premium_bps: 0,
        min_amount: BalanceOf::<T>::default(),
        created_at: now,
        info_deadline: now + 3600, // 1小时提交资料窗口（临时值，应从Config获取）
        review_deadline: now + 86400, // 24小时审核窗口
        service_paused: false,
        users_served: 0,
        masked_full_name: BoundedVec::default(),
        masked_id_card: BoundedVec::default(),
        masked_birthday: BoundedVec::default(),
        masked_payment_info: BoundedVec::default(),
        wechat_id: BoundedVec::default(),
        epay_no: None,
        epay_key_cid: None,
    };
    
    // 存储申请记录
    MakerApplications::<T>::insert(maker_id, application);
    AccountToMaker::<T>::insert(who, maker_id);
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::MakerDepositLocked {
        maker_id,
        who: who.clone(),
        amount: deposit,
    });
    
    Ok(())
}

/// 函数级详细中文注释：提交做市商资料
/// 
/// # 参数
/// - who: 申请人账户
/// - real_name: 真实姓名
/// - id_card_number: 身份证号
/// - birthday: 生日（格式：YYYY-MM-DD）
/// - tron_address: TRON地址
/// - wechat_id: 微信号
/// - epay_no: EPAY商户号（可选）
/// - epay_key: EPAY密钥（可选）
/// 
/// # 返回
/// - DispatchResult
pub fn do_submit_info<T: Config + frame_system::Config>(
    who: &T::AccountId,
    real_name: Vec<u8>,
    id_card_number: Vec<u8>,
    birthday: Vec<u8>,
    tron_address: Vec<u8>,
    wechat_id: Vec<u8>,
    epay_no: Option<Vec<u8>>,
    epay_key: Option<Vec<u8>>,
) -> DispatchResult {
    use crate::{AccountToMaker, MakerApplications, Pallet, Event, Error};
    
    // 获取做市商ID
    let maker_id = AccountToMaker::<T>::get(who)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    // 获取申请记录
    MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> DispatchResult {
        let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;
        
        // 检查状态
        ensure!(
            app.status == ApplicationStatus::DepositLocked,
            Error::<T>::InvalidMakerStatus
        );
        
        // 验证 TRON 地址
        ensure!(
            is_valid_tron_address(&tron_address),
            Error::<T>::InvalidTronAddress
        );
        
        // 验证 EPAY 配置
        ensure!(
            is_valid_epay_config(&epay_no, &epay_key),
            Error::<T>::InvalidEpayConfig
        );
        
        // 脱敏处理
        let real_name_str = core::str::from_utf8(&real_name)
            .map_err(|_| Error::<T>::EncodingError)?;
        let id_card_str = core::str::from_utf8(&id_card_number)
            .map_err(|_| Error::<T>::EncodingError)?;
        let birthday_str = core::str::from_utf8(&birthday)
            .map_err(|_| Error::<T>::EncodingError)?;
        
        let masked_name = mask_name(real_name_str);
        let masked_id = mask_id_card(id_card_str);
        let masked_birth = mask_birthday(birthday_str);
        
        // 更新申请记录
        app.status = ApplicationStatus::PendingReview;
        app.tron_address = TronAddress::try_from(tron_address)
            .map_err(|_| Error::<T>::EncodingError)?;
        app.masked_full_name = BoundedVec::try_from(masked_name)
            .map_err(|_| Error::<T>::EncodingError)?;
        app.masked_id_card = BoundedVec::try_from(masked_id)
            .map_err(|_| Error::<T>::EncodingError)?;
        app.masked_birthday = BoundedVec::try_from(masked_birth)
            .map_err(|_| Error::<T>::EncodingError)?;
        app.wechat_id = BoundedVec::try_from(wechat_id)
            .map_err(|_| Error::<T>::EncodingError)?;
        
        // 处理 EPAY 配置
        if let Some(no) = epay_no {
            app.epay_no = Some(BoundedVec::try_from(no)
                .map_err(|_| Error::<T>::EncodingError)?);
        }
        
        // TODO: 将完整资料（含 real_name, id_card_number, birthday, epay_key）上传到 IPFS
        // 并将返回的 CID 存储到 private_cid
        // 这里暂时留空，需要集成 pallet-stardust-ipfs
        
        Ok(())
    })?;
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::MakerInfoSubmitted {
        maker_id,
        who: who.clone(),
    });
    
    Ok(())
}

/// 函数级详细中文注释：审批做市商申请
/// 
/// # 参数
/// - maker_id: 做市商ID
/// - approved_by: 审批人账户
/// 
/// # 返回
/// - DispatchResult
pub fn do_approve_maker<T: Config + frame_system::Config>(maker_id: u64, approved_by: &T::AccountId) -> DispatchResult {
    use crate::{MakerApplications, Pallet, Event, Error};
    
    MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> DispatchResult {
        let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;
        
        // 检查状态
        ensure!(
            app.status == ApplicationStatus::PendingReview,
            Error::<T>::InvalidMakerStatus
        );
        
        // 更新状态
        app.status = ApplicationStatus::Active;
        
        Ok(())
    })?;
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::MakerApproved {
        maker_id,
        approved_by: approved_by.clone(),
    });
    
    Ok(())
}

/// 函数级详细中文注释：驳回做市商申请
/// 
/// # 参数
/// - maker_id: 做市商ID
/// - rejected_by: 驳回人账户
/// 
/// # 返回
/// - DispatchResult
pub fn do_reject_maker<T: Config + frame_system::Config>(maker_id: u64, rejected_by: &T::AccountId) -> DispatchResult {
    use crate::{MakerApplications, Pallet, Event, Error};
    
    MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> DispatchResult {
        let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;
        
        // 检查状态
        ensure!(
            app.status == ApplicationStatus::PendingReview,
            Error::<T>::InvalidMakerStatus
        );
        
        // 更新状态
        app.status = ApplicationStatus::Rejected;
        
        // 解锁押金
        <T as Config>::Currency::unreserve(&app.owner, app.deposit);
        
        Ok(())
    })?;
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::MakerRejected {
        maker_id,
        rejected_by: rejected_by.clone(),
    });
    
    Ok(())
}

/// 函数级详细中文注释：取消做市商申请
/// 
/// # 参数
/// - who: 申请人账户
/// 
/// # 返回
/// - DispatchResult
pub fn do_cancel_maker<T: Config + frame_system::Config>(who: &T::AccountId) -> DispatchResult {
    use crate::{AccountToMaker, MakerApplications, Pallet, Event, Error};
    
    // 获取做市商ID
    let maker_id = AccountToMaker::<T>::get(who)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> DispatchResult {
        let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;
        
        // 检查状态（只能在 DepositLocked 或 PendingReview 状态下取消）
        ensure!(
            app.status == ApplicationStatus::DepositLocked 
            || app.status == ApplicationStatus::PendingReview,
            Error::<T>::InvalidMakerStatus
        );
        
        // 更新状态
        app.status = ApplicationStatus::Cancelled;
        
        // 解锁押金
        <T as Config>::Currency::unreserve(&app.owner, app.deposit);
        
        Ok(())
    })?;
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::MakerCancelled {
        maker_id,
        who: who.clone(),
    });
    
    Ok(())
}

/// 函数级详细中文注释：申请提现押金
/// 
/// # 参数
/// - who: 做市商账户
/// - amount: 提现金额
/// 
/// # 返回
/// - DispatchResult
pub fn do_request_withdrawal<T: Config + frame_system::Config>(who: &T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
    use crate::{AccountToMaker, MakerApplications, WithdrawalRequests, Pallet, Event, Error};
    
    // 获取做市商ID
    let maker_id = AccountToMaker::<T>::get(who)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    // 检查做市商状态
    let app = MakerApplications::<T>::get(maker_id)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    ensure!(
        app.status == ApplicationStatus::Active,
        Error::<T>::MakerNotActive
    );
    
    // 检查押金是否足够
    ensure!(
        app.deposit >= amount,
        Error::<T>::InsufficientDeposit
    );
    
    // 检查是否已有待处理的提现请求
    ensure!(
        !WithdrawalRequests::<T>::contains_key(maker_id),
        Error::<T>::NotAuthorized // 使用临时错误，应该添加 WithdrawalAlreadyPending
    );
    
    // 获取当前时间
    let now = pallet_timestamp::Pallet::<T>::get().saturated_into::<u32>() / 1000;
    let cooldown = T::WithdrawalCooldown::get().saturated_into::<u32>();
    
    // 创建提现请求
    let request = WithdrawalRequest {
        amount,
        requested_at: now,
        executable_at: now.saturating_add(cooldown),
        status: WithdrawalStatus::Pending,
    };
    
    WithdrawalRequests::<T>::insert(maker_id, request);
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::WithdrawalRequested {
        maker_id,
        amount,
    });
    
    Ok(())
}

/// 函数级详细中文注释：执行提现
/// 
/// # 参数
/// - who: 做市商账户
/// 
/// # 返回
/// - DispatchResult
pub fn do_execute_withdrawal<T: Config + frame_system::Config>(who: &T::AccountId) -> DispatchResult {
    use crate::{AccountToMaker, MakerApplications, WithdrawalRequests, Pallet, Event, Error};
    
    // 获取做市商ID
    let maker_id = AccountToMaker::<T>::get(who)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    // 获取提现请求
    let request = WithdrawalRequests::<T>::get(maker_id)
        .ok_or(Error::<T>::WithdrawalRequestNotFound)?;
    
    // 检查状态
    ensure!(
        request.status == WithdrawalStatus::Pending,
        Error::<T>::InvalidMakerStatus
    );
    
    // 检查冷却期
    let now = pallet_timestamp::Pallet::<T>::get().saturated_into::<u32>() / 1000;
    ensure!(
        now >= request.executable_at,
        Error::<T>::WithdrawalCooldownNotMet
    );
    
    // 解锁押金
    <T as Config>::Currency::unreserve(who, request.amount);
    
    // 更新申请记录中的押金金额
    MakerApplications::<T>::try_mutate(maker_id, |maybe_app| -> DispatchResult {
        let app = maybe_app.as_mut().ok_or(Error::<T>::MakerNotFound)?;
        app.deposit = app.deposit.saturating_sub(request.amount);
        Ok(())
    })?;
    
    // 更新提现请求状态
    WithdrawalRequests::<T>::mutate(maker_id, |maybe_req| {
        if let Some(req) = maybe_req {
            req.status = WithdrawalStatus::Executed;
        }
    });
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::WithdrawalExecuted {
        maker_id,
        amount: request.amount,
    });
    
    Ok(())
}

/// 函数级详细中文注释：取消提现请求
/// 
/// # 参数
/// - who: 做市商账户
/// 
/// # 返回
/// - DispatchResult
pub fn do_cancel_withdrawal<T: Config + frame_system::Config>(who: &T::AccountId) -> DispatchResult {
    use crate::{AccountToMaker, WithdrawalRequests, Pallet, Event, Error};
    
    // 获取做市商ID
    let maker_id = AccountToMaker::<T>::get(who)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    // 获取提现请求
    let request = WithdrawalRequests::<T>::get(maker_id)
        .ok_or(Error::<T>::WithdrawalRequestNotFound)?;
    
    // 检查状态
    ensure!(
        request.status == WithdrawalStatus::Pending,
        Error::<T>::InvalidMakerStatus
    );
    
    // 更新提现请求状态
    WithdrawalRequests::<T>::mutate(maker_id, |maybe_req| {
        if let Some(req) = maybe_req {
            req.status = WithdrawalStatus::Cancelled;
        }
    });
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::WithdrawalCancelled {
        maker_id,
    });
    
    Ok(())
}

/// 函数级详细中文注释：紧急提现（治理功能）
/// 
/// # 参数
/// - maker_id: 做市商ID
/// - to: 接收账户
/// 
/// # 返回
/// - DispatchResult
pub fn do_emergency_withdrawal<T: Config + frame_system::Config>(maker_id: u64, to: &T::AccountId) -> DispatchResult {
    use crate::{MakerApplications, Pallet, Event, Error};
    
    // 获取申请记录
    let app = MakerApplications::<T>::get(maker_id)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    // 解锁全部押金并转给指定账户
    <T as Config>::Currency::unreserve(&app.owner, app.deposit);
    <T as Config>::Currency::transfer(
        &app.owner,
        to,
        app.deposit,
        ExistenceRequirement::AllowDeath
    )?;
    
    // 更新申请记录中的押金金额
    MakerApplications::<T>::mutate(maker_id, |maybe_app| {
        if let Some(app) = maybe_app {
            app.deposit = BalanceOf::<T>::default();
        }
    });
    
    // 触发事件
    Pallet::<T>::deposit_event(Event::EmergencyWithdrawalExecuted {
        maker_id,
        to: to.clone(),
        amount: app.deposit,
    });
    
    Ok(())
}

