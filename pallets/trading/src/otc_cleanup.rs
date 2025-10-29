//! 函数级详细中文注释：OTC订单清理模块
//! 
//! 本模块负责自动清理（归档）过期的OTC订单，释放链上存储空间。

use super::*;
use frame_support::pallet_prelude::*;
use frame_support::weights::Weight;
use frame_system::pallet_prelude::BlockNumberFor;
use sp_runtime::SaturatedConversion;

/// 函数级详细中文注释：清理过期的订单（自动归档）
/// 
/// **触发条件**：
/// - 订单已完成（Released/Refunded/Canceled/Closed）且超过归档阈值天数
/// 
/// **清理操作**：
/// 1. 从 Orders 存储中移除
/// 2. 从 BuyerOrders 索引中移除
/// 3. 从 MakerOrders 索引中移除
/// 4. 发射 OrderArchived 事件
/// 
/// **注意**：
/// - 每次最多清理 MaxOrderCleanupPerBlock 个订单
/// - 通过 on_initialize hook 自动调用
/// - 使用时间戳判断，而非区块高度
pub fn clean_expired_orders<T: Config>(_current_block: BlockNumberFor<T>) -> Weight {
    use crate::pallet::{Orders, BuyerOrders, MakerOrders, Pallet, Event};
    use pallet_timestamp::Pallet as Timestamp;
    use crate::otc::OrderState;
    
    let threshold_days = T::OrderArchiveThresholdDays::get();
    let max_cleanup = T::MaxOrderCleanupPerBlock::get();
    
    // 计算阈值（使用毫秒）
    let threshold_ms: u64 = threshold_days as u64 * 24 * 60 * 60 * 1000;
    
    let current_timestamp: u64 = Timestamp::<T>::get().saturated_into();
    let mut archived = 0u32;
    let mut weight = Weight::zero();
    
    // 遍历所有订单
    for (order_id, order) in Orders::<T>::iter() {
        if archived >= max_cleanup {
            break;
        }
        
        // 检查是否可归档（已完成且超过阈值）
        let should_archive = match order.state {
            OrderState::Released | OrderState::Refunded | OrderState::Canceled | OrderState::Closed => {
                if let Some(completed_at) = order.completed_at {
                    let completed_at_ms: u64 = completed_at.saturated_into();
                    let age_ms = current_timestamp.saturating_sub(completed_at_ms);
                    age_ms >= threshold_ms
                } else {
                    false
                }
            }
            _ => false,
        };
        
        if !should_archive {
            weight = weight.saturating_add(Weight::from_parts(5_000, 0)); // 读取权重
            continue;
        }
        
        // 从主存储中移除
        Orders::<T>::remove(order_id);
        weight = weight.saturating_add(Weight::from_parts(25_000, 0)); // 删除权重
        
        // 🆕 从买家索引中移除
        BuyerOrders::<T>::mutate(&order.taker, |orders| {
            if let Some(pos) = orders.iter().position(|&id| id == order_id) {
                orders.swap_remove(pos);
            }
        });
        weight = weight.saturating_add(Weight::from_parts(10_000, 0));
        
        // 🆕 从做市商索引中移除
        MakerOrders::<T>::mutate(order.maker_id, |orders| {
            if let Some(pos) = orders.iter().position(|&id| id == order_id) {
                orders.swap_remove(pos);
            }
        });
        weight = weight.saturating_add(Weight::from_parts(10_000, 0));
        
        // 发射事件
        Pallet::<T>::deposit_event(Event::OrderArchived { order_id });
        
        archived += 1;
    }
    
    weight
}

