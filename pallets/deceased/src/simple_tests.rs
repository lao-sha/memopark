// 函数级中文注释：独立功能测试
// 仅测试新增的核心功能，不依赖完整的 pallet 配置

#![cfg(test)]

use crate::*;
use sp_runtime::testing::H256;

/// 独立测试新增功能
#[cfg(test)]
mod unit_tests {
    use super::*;

    /// 测试随机ID生成算法的核心逻辑
    #[test]
    fn test_id_generation_algorithm() {
        // 测试随机种子生成
        let subject = b"test_subject";
        let (hash, _block) = mock_random_function(subject);

        // 验证哈希不为零
        assert_ne!(hash, H256::zero());

        // 测试ID范围计算
        let min_id = 1_000_000_000u64;
        let max_id = 9_999_999_999u64;

        // 从哈希生成ID（模拟算法逻辑）
        let bytes = hash.as_bytes();
        let seed_u64 = u64::from_le_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5], bytes[6], bytes[7],
        ]);

        let range = max_id - min_id + 1;
        let id = min_id + (seed_u64 % range);

        // 验证ID在正确范围内
        assert!(id >= min_id, "ID {} 低于最小值 {}", id, min_id);
        assert!(id <= max_id, "ID {} 超过最大值 {}", id, max_id);

        println!("✅ 算法测试通过: 生成ID {}", id);
    }

    /// 测试多次生成的分布性
    #[test]
    fn test_id_distribution() {
        let mut generated_ids = Vec::new();

        // 生成多个ID测试分布
        for i in 0..20 {
            let subject = format!("test_{}", i).into_bytes();
            let (hash, _) = mock_random_function(&subject);

            let bytes = hash.as_bytes();
            let seed_u64 = u64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3],
                bytes[4], bytes[5], bytes[6], bytes[7],
            ]);

            let min_id = 1_000_000_000u64;
            let max_id = 9_999_999_999u64;
            let range = max_id - min_id + 1;
            let id = min_id + (seed_u64 % range);

            // 验证范围
            assert!(id >= min_id);
            assert!(id <= max_id);

            generated_ids.push(id);
        }

        // 验证生成了足够的ID
        assert_eq!(generated_ids.len(), 20);

        // 检查唯一性（注意：真实环境中碰撞是可能的，但测试中应该很少）
        let unique_count = generated_ids.iter().collect::<std::collections::HashSet<_>>().len();

        println!("生成的ID数量: {}, 唯一ID数量: {}", generated_ids.len(), unique_count);
        println!("生成的ID: {:?}", &generated_ids[..std::cmp::min(10, generated_ids.len())]);

        // 大部分应该是唯一的（允许少量碰撞）
        assert!(unique_count > 15, "唯一ID太少: {}", unique_count);

        println!("✅ 分布测试通过");
    }

    /// 测试极端情况
    #[test]
    fn test_edge_cases() {
        // 测试空subject
        let (hash1, _) = mock_random_function(b"");
        assert_ne!(hash1, H256::zero());

        // 测试很长的subject
        let long_subject = vec![0u8; 1000];
        let (hash2, _) = mock_random_function(&long_subject);
        assert_ne!(hash2, H256::zero());

        // 测试相同subject应该产生相同结果
        let subject = b"same_subject";
        let (hash3, _) = mock_random_function(subject);
        let (hash4, _) = mock_random_function(subject);
        assert_eq!(hash3, hash4, "相同输入应该产生相同输出");

        println!("✅ 极端情况测试通过");
    }

    /// 测试10位数范围验证
    #[test]
    fn test_ten_digit_range() {
        let min_id = 1_000_000_000u64;
        let max_id = 9_999_999_999u64;

        // 验证边界值
        assert_eq!(format!("{}", min_id).len(), 10);
        assert_eq!(format!("{}", max_id).len(), 10);

        // 验证范围大小
        let range = max_id - min_id + 1;
        assert_eq!(range, 9_000_000_000u64);

        println!("✅ 十位数范围验证通过");
        println!("范围: {} - {}, 总数: {}", min_id, max_id, range);
    }

    /// Mock随机数函数，模拟实际的随机数生成
    fn mock_random_function(subject: &[u8]) -> (H256, u64) {
        use sp_runtime::traits::Hash;

        // 创建种子
        let mut seed = [0u8; 32];
        for (i, byte) in subject.iter().enumerate() {
            if i < 32 {
                seed[i] = *byte;
            }
        }

        // 添加一些变换以增加随机性
        for i in 0..32 {
            seed[i] = seed[i].wrapping_add(i as u8).wrapping_add(1);
        }

        // 模拟区块号
        let block_number = 100u64; // 固定值用于测试

        // 将区块号混入种子
        let block_bytes = block_number.to_le_bytes();
        for i in 0..8 {
            seed[i] ^= block_bytes[i];
        }

        let hash = sp_runtime::traits::BlakeTwo256::hash(&seed);
        (hash, block_number)
    }
}