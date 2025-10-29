//! # OTC Module (场外交易订单模块)
//! 
//! ## 函数级详细中文注释：提供 OTC 订单管理功能
//! 
//! ### 功能
//! 
//! 1. **订单创建**
//!    - create_order: 创建OTC订单
//!    - create_first_purchase: 创建首购订单
//! 
//! 2. **订单流程**
//!    - mark_paid: 买家标记已付款
//!    - release_memo: 做市商释放MEMO
//!    - cancel_order: 取消订单
//!    - dispute_order: 发起争议
//! 
//! 3. **订单管理**
//!    - 自动清理过期订单
//!    - 限频保护

use frame_support::pallet_prelude::*;
use sp_core::H256;
use sp_runtime::traits::Saturating;
use sp_std::vec::Vec;

use crate::pallet::{Config, BalanceOf, MomentOf, TronAddress};

// ===== 数据结构 =====

/// 函数级详细中文注释：订单状态枚举
#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum OrderState {
    /// 已创建，等待买家付款
    Created,
    /// 买家已标记付款或做市商已确认
    PaidOrCommitted,
    /// MEMO已释放
    Released,
    /// 已退款
    Refunded,
    /// 已取消
    Canceled,
    /// 争议中
    Disputed,
    /// 已关闭
    Closed,
}

/// 函数级详细中文注释：OTC订单结构
#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Order<T: Config> {
    /// 做市商ID
    pub maker_id: u64,
    /// 做市商账户
    pub maker: T::AccountId,
    /// 买家账户
    pub taker: T::AccountId,
    /// 单价（USDT/DUST，精度10^6）
    pub price: BalanceOf<T>,
    /// 数量（DUST数量）
    pub qty: BalanceOf<T>,
    /// 总金额（USDT金额）
    pub amount: BalanceOf<T>,
    /// 创建时间（Unix时间戳，毫秒）
    pub created_at: MomentOf<T>,
    /// 超时时间（Unix时间戳，毫秒）
    pub expire_at: MomentOf<T>,
    /// 证据窗口截止时间（Unix时间戳，毫秒）
    pub evidence_until: MomentOf<T>,
    /// 做市商TRON收款地址
    pub maker_tron_address: TronAddress,
    /// 支付承诺哈希（买家提供）
    pub payment_commit: H256,
    /// 联系方式承诺哈希（买家提供）
    pub contact_commit: H256,
    /// 订单状态
    pub state: OrderState,
    /// EPAY交易号（可选）
    pub epay_trade_no: Option<BoundedVec<u8, ConstU32<64>>>,
    /// 订单完成时间（Unix时间戳，毫秒）
    pub completed_at: Option<MomentOf<T>>,
}

// ===== 核心函数实现 =====

/// 函数级详细中文注释：创建OTC订单（核心逻辑占位）
/// 
/// # 参数
/// - buyer: 买家账户
/// - maker_id: 做市商ID
/// - memo_amount: DUST数量
/// - payment_commit: 支付承诺哈希
/// - contact_commit: 联系方式承诺哈希
/// 
/// # 返回
/// - Result<u64, DispatchError>: 成功返回订单ID
pub fn do_create_order<T: Config>(
    buyer: &T::AccountId,
    maker_id: u64,
    memo_amount: BalanceOf<T>,
    payment_commit: H256,
    contact_commit: H256,
) -> Result<u64, DispatchError> {
    use crate::pallet::{NextOrderId, Orders, BuyerOrders, MakerOrders, MakerApplications, Pallet, Event, Error};
    use crate::maker::ApplicationStatus;
    
    // 获取做市商信息
    let maker_app = MakerApplications::<T>::get(maker_id)
        .ok_or(Error::<T>::MakerNotFound)?;
    
    // 检查做市商状态
    ensure!(
        maker_app.status == ApplicationStatus::Active,
        Error::<T>::MakerNotActive
    );
    
    // 检查服务是否暂停
    ensure!(
        !maker_app.service_paused,
        Error::<T>::MakerNotActive
    );
    
    // 获取订单ID
    let order_id = NextOrderId::<T>::get();
    NextOrderId::<T>::put(order_id.saturating_add(1));
    
    // TODO: 从 pallet-pricing 获取价格
    // TODO: 应用做市商溢价
    // TODO: 检查买家信用
    // TODO: 锁定做市商的DUST到托管
    // TODO: 检查限频
    
    let now = pallet_timestamp::Pallet::<T>::get();
    let expire_at = now.saturating_add(3600000u32.into()); // 1小时
    let evidence_until = expire_at.saturating_add(86400000u32.into()); // +24小时
    
    // 创建订单
    let order = Order::<T> {
        maker_id,
        maker: maker_app.owner.clone(),
        taker: buyer.clone(),
        price: BalanceOf::<T>::default(), // TODO: 从pricing获取
        qty: memo_amount,
        amount: BalanceOf::<T>::default(), // TODO: 计算
        created_at: now,
        expire_at,
        evidence_until,
        maker_tron_address: maker_app.tron_address.clone(),
        payment_commit,
        contact_commit,
        state: OrderState::Created,
        epay_trade_no: None,
        completed_at: None,
    };
    
    // 存储订单
    Orders::<T>::insert(order_id, order);
    
    // 添加到买家订单列表
    BuyerOrders::<T>::try_mutate(buyer, |orders| -> DispatchResult {
        orders.try_push(order_id)
            .map_err(|_| Error::<T>::StorageLimitReached)?;
        Ok(())
    })?;
    
    // 添加到做市商订单列表
    MakerOrders::<T>::try_mutate(maker_id, |orders| -> DispatchResult {
        orders.try_push(order_id)
            .map_err(|_| Error::<T>::StorageLimitReached)?;
        Ok(())
    })?;
    
    // 🆕 发射优化后的订单创建事件（包含首购标志）
    Pallet::<T>::deposit_event(Event::OrderCreated {
        order_id,
        maker_id,
        buyer: buyer.clone(),
        memo_amount,
        is_first_purchase: false,  // TODO: 实现首购检测逻辑
    });
    
    Ok(order_id)
}

/// 函数级详细中文注释：买家标记已付款（核心逻辑占位）
/// 
/// # 参数
/// - buyer: 买家账户
/// - order_id: 订单ID
/// - tron_tx_hash: TRON交易哈希（可选）
/// 
/// # 返回
/// - DispatchResult
pub fn do_mark_paid<T: Config>(
    buyer: &T::AccountId,
    order_id: u64,
    tron_tx_hash: Option<Vec<u8>>,
) -> DispatchResult {
    use crate::pallet::{Orders, Pallet, Event, Error};
    use crate::common::record_tron_tx_hash;
    
    Orders::<T>::try_mutate(order_id, |maybe_order| -> DispatchResult {
        let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
        
        // 检查权限
        ensure!(
            order.taker == *buyer,
            Error::<T>::NotAuthorized
        );
        
        // 检查状态
        ensure!(
            order.state == OrderState::Created,
            Error::<T>::InvalidOrderStatus
        );
        
        // 如果提供了TRON交易哈希，记录它
        if let Some(tx_hash_bytes) = tron_tx_hash {
            ensure!(
                tx_hash_bytes.len() == 32,
                Error::<T>::EncodingError
            );
            let tx_hash = H256::from_slice(&tx_hash_bytes);
            record_tron_tx_hash::<T>(tx_hash)?;
        }
        
        // 函数级详细中文注释：更新状态（用于事件优化）
        order.state = OrderState::PaidOrCommitted;
        
        // 🆕 发射优化后的状态变更事件
        // 状态码：0=Created, 1=PaidOrCommitted
        Pallet::<T>::deposit_event(Event::OrderStateChanged {
            order_id,
            old_state: 0,  // Created
            new_state: 1,  // PaidOrCommitted
            actor: Some(buyer.clone()),
        });
        
        Ok(())
    })?;
    
    Ok(())
}

/// 函数级详细中文注释：做市商释放DUST（核心逻辑占位）
/// 
/// # 参数
/// - maker: 做市商账户
/// - order_id: 订单ID
/// 
/// # 返回
/// - DispatchResult
pub fn do_release_memo<T: Config>(
    maker: &T::AccountId,
    order_id: u64,
) -> DispatchResult {
    use crate::pallet::{Orders, Pallet, Event, Error};
    
    Orders::<T>::try_mutate(order_id, |maybe_order| -> DispatchResult {
        let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
        
        // 检查权限
        ensure!(
            order.maker == *maker,
            Error::<T>::NotAuthorized
        );
        
        // 检查状态
        ensure!(
            order.state == OrderState::PaidOrCommitted,
            Error::<T>::InvalidOrderStatus
        );
        
        // TODO: 从托管释放DUST给买家
        // TODO: 更新做市商信用（完成订单）
        // TODO: 触发联盟营销分配
        
        // 函数级详细中文注释：更新状态（用于事件优化）
        order.state = OrderState::Released;
        order.completed_at = Some(pallet_timestamp::Pallet::<T>::get());
        
        // 🆕 发射优化后的状态变更事件
        // 状态码：1=PaidOrCommitted, 2=Released
        Pallet::<T>::deposit_event(Event::OrderStateChanged {
            order_id,
            old_state: 1,  // PaidOrCommitted
            new_state: 2,  // Released
            actor: Some(maker.clone()),
        });
        
        Ok(())
    })?;
    
    Ok(())
}

/// 函数级详细中文注释：取消订单（核心逻辑占位）
/// 
/// # 参数
/// - who: 操作者账户
/// - order_id: 订单ID
/// 
/// # 返回
/// - DispatchResult
pub fn do_cancel_order<T: Config>(
    who: &T::AccountId,
    order_id: u64,
) -> DispatchResult {
    use crate::pallet::{Orders, Pallet, Event, Error};
    
    Orders::<T>::try_mutate(order_id, |maybe_order| -> DispatchResult {
        let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
        
        // 检查权限（买家或做市商都可以取消）
        ensure!(
            order.taker == *who || order.maker == *who,
            Error::<T>::NotAuthorized
        );
        
        // 检查状态（只能取消Created状态的订单）
        ensure!(
            order.state == OrderState::Created,
            Error::<T>::InvalidOrderStatus
        );
        
        // TODO: 退款托管的DUST给做市商
        
        // 函数级详细中文注释：更新状态（用于事件优化）
        order.state = OrderState::Canceled;
        order.completed_at = Some(pallet_timestamp::Pallet::<T>::get());
        
        // 🆕 发射优化后的状态变更事件
        // 状态码：0=Created, 3=Canceled
        Pallet::<T>::deposit_event(Event::OrderStateChanged {
            order_id,
            old_state: 0,  // Created
            new_state: 3,  // Canceled
            actor: Some(who.clone()),
        });
        
        Ok(())
    })?;
    
    Ok(())
}

/// 函数级详细中文注释：发起订单争议（核心逻辑占位）
/// 
/// # 参数
/// - who: 发起者账户
/// - order_id: 订单ID
/// 
/// # 返回
/// - DispatchResult
pub fn do_dispute_order<T: Config>(
    who: &T::AccountId,
    order_id: u64,
) -> DispatchResult {
    use crate::pallet::{Orders, Pallet, Event, Error};
    
    Orders::<T>::try_mutate(order_id, |maybe_order| -> DispatchResult {
        let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
        
        // 检查权限
        ensure!(
            order.taker == *who || order.maker == *who,
            Error::<T>::NotAuthorized
        );
        
        // TODO: 检查是否在证据窗口内
        // TODO: 创建仲裁案件
        
        // 函数级详细中文注释：更新状态（用于事件优化）
        order.state = OrderState::Disputed;
        
        // 🆕 发射优化后的状态变更事件
        // 状态码：1=PaidOrCommitted, 4=Disputed
        Pallet::<T>::deposit_event(Event::OrderStateChanged {
            order_id,
            old_state: 1,  // PaidOrCommitted
            new_state: 4,  // Disputed
            actor: Some(who.clone()),
        });
        
        Ok(())
    })?;
    
    Ok(())
}

// ===== 🆕 2025-10-29：仲裁路由钩子（供 runtime 调用） =====

use super::{Orders, Error, Pallet};
use frame_support::ensure;
use sp_runtime::{DispatchError, DispatchResult};
use sp_runtime::traits::{SaturatedConversion, Zero};
use pallet_escrow::Escrow as EscrowTrait;

/// 函数级详细中文注释：仲裁路由钩子 Trait
/// 
/// 由 runtime 的 ArbitrationRouter 调用，用于：
/// - 验证用户是否有权发起争议
/// - 执行仲裁裁决（放行/退款/部分放行）
/// 
/// 注意：本 Pallet 内仅更新状态，不直接涉及资金划转
pub trait ArbitrationHook<T: crate::Config> {
    /// 函数级中文注释：校验发起人是否可对该订单发起争议（maker/taker + 状态/时窗判断）
    fn can_dispute(who: &T::AccountId, id: u64) -> bool;
    
    /// 函数级中文注释：仲裁裁决 - 全额放款给做市商（卖家胜诉）
    fn arbitrate_release(id: u64) -> DispatchResult;
    
    /// 函数级中文注释：仲裁裁决 - 全额退款给买家（买家胜诉）
    fn arbitrate_refund(id: u64) -> DispatchResult;
    
    /// 函数级中文注释：仲裁裁决 - 按比例分账（双方都有责任）
    fn arbitrate_partial(id: u64, _bps: u16) -> DispatchResult;
}

impl<T: crate::Config> ArbitrationHook<T> for Pallet<T> {
    fn can_dispute(who: &T::AccountId, id: u64) -> bool {
        if let Some(ord) = Orders::<T>::get(id) {
            // 函数级中文注释：获取当前时间戳（毫秒），用于超时判断
            let now = <pallet_timestamp::Pallet<T>>::get();
            let is_party = ord.maker == *who || ord.taker == *who;
            let cond_paid_unreleased = matches!(ord.state, OrderState::PaidOrCommitted);
            let cond_expired = now >= ord.expire_at;
            let cond_evidence_window = now <= ord.evidence_until;
            return is_party && (cond_paid_unreleased || cond_expired || cond_evidence_window);
        }
        false
    }
    
    fn arbitrate_release(id: u64) -> DispatchResult {
        // 函数级中文注释：提取订单信息用于价格聚合更新
        let (price_usdt, memo_qty, timestamp, maker_id) = {
            let ord = Orders::<T>::get(id).ok_or(Error::<T>::OrderNotFound)?;
            (ord.price.saturated_into::<u64>(), ord.qty.saturated_into::<u128>(), ord.created_at.saturated_into::<u64>(), ord.maker_id)
        };
        
        Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
            let ord = maybe.as_mut().ok_or(Error::<T>::OrderNotFound)?;
            ensure!(
                matches!(
                    ord.state,
                    OrderState::PaidOrCommitted | OrderState::Disputed
                ),
                Error::<T>::InvalidOrderStatus
            );
            
            // 统一托管流程：从托管账户转账
            // 函数级详细中文注释：仲裁释放时转账数量（qty）而不是金额（amount）
            <T as crate::Config>::Escrow::transfer_from_escrow(
                ord.maker_id,
                &ord.taker,
                ord.qty,
            )?;
            
            ord.state = OrderState::Released;
            Ok(())
        })?;
        
        // 函数级中文注释：仲裁完成后，同样添加到价格聚合统计
        let _ = pallet_pricing::Pallet::<T>::add_otc_order(timestamp, price_usdt, memo_qty);
        
        // 🆕 2025-10-22：仲裁释放（做市商胜诉） → 不记录违约，信用分保持不变
        // 函数级详细中文注释：Release 表示做市商胜诉，买家败诉
        // 做市商信用分不变，无需调用任何接口
        // 未使用的变量 maker_id 用于提醒：这里可以扩展胜诉奖励逻辑
        let _ = maker_id;
        
        Ok(())
    }
    
    fn arbitrate_refund(id: u64) -> DispatchResult {
        // 🆕 2025-10-22：提取 maker_id 用于信用更新
        let maker_id = {
            let ord = Orders::<T>::get(id).ok_or(Error::<T>::OrderNotFound)?;
            ord.maker_id
        };
        
        Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
            let ord = maybe.as_mut().ok_or(Error::<T>::OrderNotFound)?;
            ensure!(
                matches!(
                    ord.state,
                    OrderState::PaidOrCommitted | OrderState::Disputed
                ),
                Error::<T>::InvalidOrderStatus
            );
            // 🆕 2025-10-20：移除库存恢复逻辑（不再管理挂单库存）
            ord.state = OrderState::Refunded;
            Ok(())
        })?;
        
        // 🆕 2025-10-22：仲裁退款（做市商败诉） → 记录争议违约，扣信用分
        // 函数级详细中文注释：完全退款意味着做市商完全败诉，记录争议违约
        // TODO: 迁移到新的信用接口
        let _ = maker_id;
        
        Ok(())
    }
    
    fn arbitrate_partial(id: u64, bps: u16) -> DispatchResult {
        // 🆕 2025-10-22：提取 maker_id 用于信用更新
        let maker_id = {
            let ord = Orders::<T>::get(id).ok_or(Error::<T>::OrderNotFound)?;
            ord.maker_id
        };
        
        Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
            let ord = maybe.as_mut().ok_or(Error::<T>::OrderNotFound)?;
            ensure!(
                matches!(
                    ord.state,
                    OrderState::PaidOrCommitted | OrderState::Disputed
                ),
                Error::<T>::InvalidOrderStatus
            );
            
            // 函数级中文注释：按 bps 分账：bps 给买家，其余退回卖家
            // 函数级详细中文注释：分账基于数量（qty）而不是金额（amount）
            let total = ord.qty;
            let buyer_share = (total / 10_000u32.into()) * (bps.into());
            let seller_share = total.saturating_sub(buyer_share);
            
            // 统一托管流程：从托管账户转账
            if !buyer_share.is_zero() {
                <T as crate::Config>::Escrow::transfer_from_escrow(
                    ord.maker_id,
                    &ord.taker,
                    buyer_share,
                )?;
            }
            if !seller_share.is_zero() {
                <T as crate::Config>::Escrow::transfer_from_escrow(
                    ord.maker_id,
                    &ord.maker,
                    seller_share,
                )?;
            }
            
            // 部分成交视为订单关闭，库存不回增（已占用份额按金额完成分配）
            ord.state = OrderState::Released;
            Ok(())
        })?;
        
        // 🆕 2025-10-22：仲裁部分放行（做市商部分败诉） → 记录争议违约，扣信用分
        // TODO: 迁移到新的信用接口
        let _ = maker_id;
        
        Ok(())
    }
}

