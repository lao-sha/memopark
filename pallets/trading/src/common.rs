//! # Common Module (公共模块)
//! 
//! ## 函数级详细中文注释：提供 Trading Pallet 的公共功能
//! 
//! ### 功能
//! 
//! 1. **TRON 交易哈希管理**
//!    - 记录已使用的 TRON 交易哈希
//!    - 防止重放攻击
//!    - 定期清理过期记录
//! 
//! 2. **脱敏函数**
//!    - 姓名脱敏
//!    - 身份证脱敏
//!    - 生日脱敏
//! 
//! 3. **验证函数**
//!    - TRON 地址验证
//!    - EPAY 配置验证

use frame_support::{
    pallet_prelude::*,
    traits::{Get},
    weights::Weight,
};
use frame_system::pallet_prelude::*;
use sp_core::H256;
use sp_std::vec::Vec;
use sp_runtime::traits::Saturating;

use crate::pallet::{Config, TronTxUsed, TronTxQueue};

// ===== TRON 交易哈希管理 =====

/// 函数级详细中文注释：记录 TRON 交易哈希
/// 
/// # 参数
/// - tx_hash: TRON 交易哈希
/// 
/// # 返回
/// - Result: 成功返回 Ok(())，失败返回错误
pub fn record_tron_tx_hash<T: Config>(tx_hash: H256) -> DispatchResult {
    let current_block = frame_system::Pallet::<T>::block_number();
    
    // 检查是否已使用
    ensure!(
        !TronTxUsed::<T>::contains_key(&tx_hash),
        crate::pallet::Error::<T>::TronTxHashAlreadyUsed
    );
    
    // 记录到存储
    TronTxUsed::<T>::insert(&tx_hash, current_block);
    
    // 添加到队列（用于按时间清理）
    TronTxQueue::<T>::try_mutate(|queue| -> DispatchResult {
        queue.try_push((tx_hash, current_block))
            .map_err(|_| crate::pallet::Error::<T>::StorageLimitReached)?;
        Ok(())
    })?;
    
    // 触发事件
    crate::pallet::Pallet::<T>::deposit_event(
        crate::pallet::Event::TronTxHashRecorded { tx_hash }
    );
    
    Ok(())
}

/// 函数级详细中文注释：清理过期的 TRON 交易哈希
/// 
/// # 参数
/// - current_block: 当前区块号
/// 
/// # 返回
/// - Weight: 消耗的权重
pub fn clean_tron_tx_hashes<T: Config>(current_block: BlockNumberFor<T>) -> Weight {
    let retention_period = T::TronTxHashRetentionPeriod::get();
    let mut cleaned = 0u32;
    
    TronTxQueue::<T>::mutate(|queue| {
        // 移除过期的记录
        queue.retain(|(tx_hash, recorded_at)| {
            let age = current_block.saturating_sub(*recorded_at);
            if age >= retention_period {
                TronTxUsed::<T>::remove(tx_hash);
                cleaned += 1;
                false
            } else {
                true
            }
        });
    });
    
    if cleaned > 0 {
        crate::pallet::Pallet::<T>::deposit_event(
            crate::pallet::Event::TronTxHashCleaned { count: cleaned }
        );
    }
    
    // 估算权重：每个清理操作 1 次读 + 1 次删除
    Weight::from_parts(cleaned as u64 * 20_000, 0)
}

// ===== 脱敏函数 =====

/// 函数级详细中文注释：姓名脱敏
/// 
/// # 规则
/// - 0字：返回空
/// - 1字：返回 "×"
/// - 2字：前×，保留后，示例："张三" -> "×三"
/// - 3字：前后保留，中间×，示例："李四五" -> "李×五"
/// - 4字及以上：前1后1，中间×，示例:"王二麻子" -> "王×子"
/// 
/// # 参数
/// - full_name: 完整姓名（UTF-8字符串切片）
/// 
/// # 返回
/// - 脱敏后的姓名字节数组
pub fn mask_name(full_name: &str) -> Vec<u8> {
    extern crate alloc;
    use alloc::string::String;
    
    let chars: Vec<char> = full_name.chars().collect();
    let len = chars.len();
    
    let mut masked = String::new();
    match len {
        0 => {},
        1 => masked.push('×'),
        2 => {
            masked.push('×');
            masked.push(chars[1]);
        },
        3 => {
            masked.push(chars[0]);
            masked.push('×');
            masked.push(chars[2]);
        },
        _ => {
            masked.push(chars[0]);
            masked.push('×');
            masked.push(chars[len - 1]);
        },
    }
    
    masked.as_bytes().to_vec()
}

/// 函数级详细中文注释：身份证号脱敏
/// 
/// # 规则
/// - 18位：前4位 + 10个星号 + 后4位
/// - 15位：前4位 + 7个星号 + 后4位
/// - 少于8位：全部用星号替换
/// 
/// # 参数
/// - id_card: 完整身份证号（ASCII字符串切片）
/// 
/// # 返回
/// - 脱敏后的身份证号字节数组
pub fn mask_id_card(id_card: &str) -> Vec<u8> {
    extern crate alloc;
    use alloc::string::String;
    
    let len = id_card.len();
    
    if len < 8 {
        let masked: String = (0..len).map(|_| '*').collect();
        return masked.as_bytes().to_vec();
    }
    
    let front = &id_card[0..4];
    let back = &id_card[len - 4..];
    let middle_count = len - 8;
    
    let mut masked = String::new();
    masked.push_str(front);
    for _ in 0..middle_count {
        masked.push('*');
    }
    masked.push_str(back);
    
    masked.as_bytes().to_vec()
}

/// 函数级详细中文注释：生日脱敏
/// 
/// # 规则
/// - 标准格式（YYYY-MM-DD）：保留年份，月日用xx替换
/// - 示例："1990-01-01" -> "1990-xx-xx"
/// - 少于4字符：全部用****-xx-xx替换
/// 
/// # 参数
/// - birthday: 完整生日（ASCII字符串切片，格式 YYYY-MM-DD）
/// 
/// # 返回
/// - 脱敏后的生日字节数组
pub fn mask_birthday(birthday: &str) -> Vec<u8> {
    extern crate alloc;
    
    if birthday.len() >= 4 {
        let year = &birthday[0..4];
        let masked = alloc::format!("{}-xx-xx", year);
        masked.as_bytes().to_vec()
    } else {
        b"****-xx-xx".to_vec()
    }
}

// ===== 验证函数 =====

/// 函数级详细中文注释：验证 TRON 地址格式
/// 
/// # 规则
/// - 长度：34 字符
/// - 开头：'T'
/// - 编码：Base58（字符集：1-9, A-H, J-N, P-Z, a-k, m-z）
/// 
/// # 参数
/// - address: TRON 地址字节数组
/// 
/// # 返回
/// - bool: 有效返回 true，无效返回 false
pub fn is_valid_tron_address(address: &[u8]) -> bool {
    // 长度检查
    if address.len() != 34 {
        return false;
    }
    
    // 开头检查
    if address[0] != b'T' {
        return false;
    }
    
    // Base58 字符集检查
    const BASE58_CHARS: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    
    for &byte in address {
        if !BASE58_CHARS.contains(&byte) {
            return false;
        }
    }
    
    true
}

/// 函数级详细中文注释：验证 EPAY 配置
/// 
/// # 规则
/// - epay_no: 10-32 字符
/// - epay_key: 16-64 字符
/// - 两者要么都有，要么都没有
/// 
/// # 参数
/// - epay_no: EPAY 商户号（可选）
/// - epay_key: EPAY 密钥（可选）
/// 
/// # 返回
/// - bool: 有效返回 true，无效返回 false
pub fn is_valid_epay_config(epay_no: &Option<Vec<u8>>, epay_key: &Option<Vec<u8>>) -> bool {
    match (epay_no, epay_key) {
        (Some(no), Some(key)) => {
            // 都有：检查长度
            no.len() >= 10 && no.len() <= 32 && key.len() >= 16 && key.len() <= 64
        },
        (None, None) => {
            // 都没有：有效
            true
        },
        _ => {
            // 只有一个：无效
            false
        }
    }
}

// ===== 单元测试 =====

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_mask_name() {
        assert_eq!(mask_name(""), b"");
        assert_eq!(mask_name("李"), "×".as_bytes());
        assert_eq!(mask_name("张三"), "×三".as_bytes());
        assert_eq!(mask_name("李四五"), "李×五".as_bytes());
        assert_eq!(mask_name("王二麻子"), "王×子".as_bytes());
    }
    
    #[test]
    fn test_mask_id_card() {
        assert_eq!(mask_id_card("110101199001011234"), b"1101**********1234");
        assert_eq!(mask_id_card("110101900101123"), b"1101*******0123");
        assert_eq!(mask_id_card("1234567"), b"*******");
    }
    
    #[test]
    fn test_mask_birthday() {
        assert_eq!(mask_birthday("1990-01-01"), b"1990-xx-xx");
        assert_eq!(mask_birthday("123"), b"****-xx-xx");
    }
    
    #[test]
    fn test_is_valid_tron_address() {
        assert!(is_valid_tron_address(b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"));
        assert!(!is_valid_tron_address(b"TYASR5UV6HEcXatwdFQfmLVUqQQQMUxHLS")); // 长度不对
        assert!(!is_valid_tron_address(b"AYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS")); // 不是T开头
        assert!(!is_valid_tron_address(b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHL0")); // 包含0（非Base58）
    }
    
    #[test]
    fn test_is_valid_epay_config() {
        assert!(is_valid_epay_config(&None, &None));
        assert!(is_valid_epay_config(
            &Some(b"1234567890".to_vec()), 
            &Some(b"1234567890123456".to_vec())
        ));
        assert!(!is_valid_epay_config(&Some(b"123".to_vec()), &None));
        assert!(!is_valid_epay_config(&None, &Some(b"123".to_vec())));
        assert!(!is_valid_epay_config(&Some(b"123".to_vec()), &Some(b"123".to_vec())));
    }
}

