//! 函数级详细中文注释：Bridge兑换清理模块
//! 
//! 本模块负责自动清理（归档）过期的兑换记录，释放链上存储空间。

use super::*;
use frame_support::pallet_prelude::*;
use frame_support::weights::Weight;
use frame_system::pallet_prelude::BlockNumberFor;
use sp_runtime::SaturatedConversion;

/// 函数级详细中文注释：清理过期的兑换记录（自动归档）
/// 
/// **触发条件**：
/// - 兑换已完成（Completed/Refunded）且超过归档阈值天数
/// 
/// **清理操作**：
/// 1. 从 SwapRequests 存储中移除（官方兑换）
/// 2. 从 MakerSwaps 存储中移除（做市商兑换）
/// 3. 从 UserSwaps 索引中移除
/// 4. 从 MakerSwapList 索引中移除（如果是做市商兑换）
/// 5. 发射 SwapArchived 事件
/// 
/// **注意**：
/// - 每次最多清理 MaxSwapCleanupPerBlock 个兑换
/// - 通过 on_idle hook 自动调用
pub fn clean_expired_swaps<T: Config>(_current_block: BlockNumberFor<T>) -> Weight {
    use crate::pallet::{SwapRequests, MakerSwaps, UserSwaps, MakerSwapList, Pallet, Event};
    use pallet_timestamp::Pallet as Timestamp;
    use crate::bridge::SwapStatus;
    
    let threshold_days = T::SwapArchiveThresholdDays::get();
    let max_cleanup = T::MaxSwapCleanupPerBlock::get();
    
    // 计算阈值（使用毫秒）
    let threshold_ms: u64 = threshold_days as u64 * 24 * 60 * 60 * 1000;
    
    let current_timestamp: u64 = Timestamp::<T>::get().saturated_into();
    let mut archived = 0u32;
    let mut weight = Weight::zero();
    
    // 1. 清理官方桥接兑换
    for (swap_id, swap) in SwapRequests::<T>::iter() {
        if archived >= max_cleanup {
            break;
        }
        
        // 检查是否可归档（已完成且超过阈值）
        if swap.completed {
            let created_at_ms: u64 = swap.created_at.saturated_into();
            let age_ms = current_timestamp.saturating_sub(created_at_ms);
            if age_ms >= threshold_ms {
                // 从主存储中移除
                SwapRequests::<T>::remove(swap_id);
                weight = weight.saturating_add(Weight::from_parts(25_000, 0));
                
                // 🆕 从用户索引中移除
                UserSwaps::<T>::mutate(&swap.user, |swaps| {
                    if let Some(pos) = swaps.iter().position(|&id| id == swap_id) {
                        swaps.swap_remove(pos);
                    }
                });
                weight = weight.saturating_add(Weight::from_parts(10_000, 0));
                
                // 发射事件
                Pallet::<T>::deposit_event(Event::SwapArchived { swap_id });
                
                archived += 1;
            } else {
                weight = weight.saturating_add(Weight::from_parts(5_000, 0));
            }
        } else {
            weight = weight.saturating_add(Weight::from_parts(5_000, 0));
        }
    }
    
    // 2. 清理做市商兑换
    for (swap_id, swap) in MakerSwaps::<T>::iter() {
        if archived >= max_cleanup {
            break;
        }
        
        // 检查是否可归档
        let should_archive = match swap.status {
            SwapStatus::Completed | SwapStatus::Refunded => {
                let created_at_ms: u64 = swap.created_at.saturated_into();
                let age_ms = current_timestamp.saturating_sub(created_at_ms);
                age_ms >= threshold_ms
            }
            _ => false,
        };
        
        if should_archive {
            // 从主存储中移除
            MakerSwaps::<T>::remove(swap_id);
            weight = weight.saturating_add(Weight::from_parts(25_000, 0));
            
            // 🆕 从用户索引中移除
            UserSwaps::<T>::mutate(&swap.user, |swaps| {
                if let Some(pos) = swaps.iter().position(|&id| id == swap_id) {
                    swaps.swap_remove(pos);
                }
            });
            weight = weight.saturating_add(Weight::from_parts(10_000, 0));
            
            // 🆕 从做市商索引中移除
            MakerSwapList::<T>::mutate(swap.maker_id, |swaps| {
                if let Some(pos) = swaps.iter().position(|&id| id == swap_id) {
                    swaps.swap_remove(pos);
                }
            });
            weight = weight.saturating_add(Weight::from_parts(10_000, 0));
            
            // 发射事件
            Pallet::<T>::deposit_event(Event::SwapArchived { swap_id });
            
            archived += 1;
        } else {
            weight = weight.saturating_add(Weight::from_parts(5_000, 0));
        }
    }
    
    weight
}

