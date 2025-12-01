//! 塔罗牌排盘算法模块
//!
//! 本模块实现塔罗牌占卜的核心算法，包括：
//! - 随机洗牌与抽牌
//! - 基于时间的起卦
//! - 基于数字的起卦
//! - 正逆位判定

use crate::types::*;
use sp_std::prelude::*;

/// 塔罗牌总数（78张）
pub const TOTAL_CARDS: u8 = 78;

/// 大阿卡纳数量（22张）
pub const MAJOR_ARCANA_COUNT: u8 = 22;

/// 小阿卡纳数量（56张）
pub const MINOR_ARCANA_COUNT: u8 = 56;

/// 每种花色的牌数（14张）
pub const CARDS_PER_SUIT: u8 = 14;

/// 使用随机种子生成抽牌序列
///
/// # 算法说明
/// 使用 Fisher-Yates 洗牌算法的变体，基于随机种子生成伪随机序列
///
/// # 参数
/// - `random_seed`: 32字节随机种子（来自链上随机源）
/// - `count`: 需要抽取的牌数
///
/// # 返回
/// - 抽取的牌ID列表和对应的正逆位
pub fn draw_cards_random(random_seed: &[u8; 32], count: u8) -> Vec<(u8, bool)> {
    let count = count.min(TOTAL_CARDS) as usize;
    let mut result = Vec::with_capacity(count);

    // 初始化牌组（0-77）
    let mut deck: Vec<u8> = (0..TOTAL_CARDS).collect();

    // 使用种子进行洗牌
    for i in 0..count {
        // 从种子中提取随机字节
        let seed_index = i % 32;
        let random_byte = random_seed[seed_index];

        // 计算交换位置
        let remaining = TOTAL_CARDS as usize - i;
        let swap_offset = (random_byte as usize) % remaining;
        let swap_index = i + swap_offset;

        // 交换牌
        deck.swap(i, swap_index);

        // 判断正逆位（使用种子的另一部分）
        let position_seed_index = (i + 16) % 32;
        let is_reversed = random_seed[position_seed_index] & 1 == 1;

        result.push((deck[i], is_reversed));
    }

    result
}

/// 基于时间戳生成抽牌序列
///
/// # 算法说明
/// 将时间戳分解为多个部分，结合区块哈希生成确定性但难以预测的牌序
///
/// # 参数
/// - `timestamp`: Unix时间戳（秒）
/// - `block_hash`: 当前区块哈希
/// - `count`: 需要抽取的牌数
///
/// # 返回
/// - 抽取的牌ID列表和对应的正逆位
pub fn draw_cards_by_time(timestamp: u64, block_hash: &[u8; 32], count: u8) -> Vec<(u8, bool)> {
    // 将时间戳分解
    let seconds = (timestamp % 60) as u8;
    let minutes = ((timestamp / 60) % 60) as u8;
    let hours = ((timestamp / 3600) % 24) as u8;
    let days = ((timestamp / 86400) % 365) as u16;

    // 组合生成种子
    let mut seed = [0u8; 32];
    seed[0] = seconds;
    seed[1] = minutes;
    seed[2] = hours;
    seed[3] = (days & 0xFF) as u8;
    seed[4] = ((days >> 8) & 0xFF) as u8;

    // 混入区块哈希
    for i in 5..32 {
        seed[i] = block_hash[i] ^ seed[i % 5];
    }

    draw_cards_random(&seed, count)
}

/// 基于用户数字生成抽牌序列
///
/// # 算法说明
/// 将用户提供的数字作为随机种子的一部分，结合区块哈希生成牌序
/// 这种方式让用户参与到随机过程中，增加仪式感
///
/// # 参数
/// - `numbers`: 用户提供的数字列表
/// - `block_hash`: 当前区块哈希
/// - `count`: 需要抽取的牌数
///
/// # 返回
/// - 抽取的牌ID列表和对应的正逆位
pub fn draw_cards_by_numbers(numbers: &[u16], block_hash: &[u8; 32], count: u8) -> Vec<(u8, bool)> {
    let mut seed = [0u8; 32];

    // 将用户数字编码到种子中
    for (i, num) in numbers.iter().take(16).enumerate() {
        seed[i * 2] = (*num & 0xFF) as u8;
        seed[i * 2 + 1] = ((*num >> 8) & 0xFF) as u8;
    }

    // 混入区块哈希
    for i in 0..32 {
        seed[i] ^= block_hash[i];
    }

    draw_cards_random(&seed, count)
}

/// 计算牌组能量分布
///
/// 分析抽取的牌中大阿卡纳和各花色的分布
///
/// # 参数
/// - `cards`: 抽取的牌ID列表
///
/// # 返回
/// - (大阿卡纳数, 权杖数, 圣杯数, 宝剑数, 星币数)
pub fn analyze_element_distribution(cards: &[u8]) -> (u8, u8, u8, u8, u8) {
    let mut major = 0u8;
    let mut wands = 0u8;
    let mut cups = 0u8;
    let mut swords = 0u8;
    let mut pentacles = 0u8;

    for &card_id in cards {
        let card = TarotCard::from_id(card_id);
        match card.card_type {
            CardType::MajorArcana => major += 1,
            CardType::MinorArcana => match card.suit {
                Suit::Wands => wands += 1,
                Suit::Cups => cups += 1,
                Suit::Swords => swords += 1,
                Suit::Pentacles => pentacles += 1,
                Suit::None => {}
            },
        }
    }

    (major, wands, cups, swords, pentacles)
}

/// 计算逆位比例
///
/// # 参数
/// - `positions`: 正逆位列表
///
/// # 返回
/// - 逆位比例（0-100）
pub fn calculate_reversed_ratio(positions: &[bool]) -> u8 {
    if positions.is_empty() {
        return 0;
    }

    let reversed_count = positions.iter().filter(|&&r| r).count();
    ((reversed_count * 100) / positions.len()) as u8
}

/// 判断是否包含特殊牌组合
///
/// 检测一些有特殊意义的牌组合
///
/// # 参数
/// - `cards`: 抽取的牌ID列表
///
/// # 返回
/// - 是否包含特殊组合
pub fn has_special_combination(cards: &[u8]) -> bool {
    // 检查是否同时出现愚者(0)和世界(21)
    let has_fool = cards.contains(&0);
    let has_world = cards.contains(&21);

    if has_fool && has_world {
        return true;
    }

    // 检查是否有三张或以上的大阿卡纳
    let major_count = cards.iter().filter(|&&c| c < 22).count();
    if major_count >= 3 {
        return true;
    }

    // 检查是否有同花色的三连号
    for suit_start in [22u8, 36, 50, 64] {
        let suit_cards: Vec<u8> = cards
            .iter()
            .filter(|&&c| c >= suit_start && c < suit_start + 14)
            .map(|&c| c - suit_start)
            .collect();

        if suit_cards.len() >= 3 {
            // 检查连续性
            let mut sorted = suit_cards.clone();
            sorted.sort();
            for i in 0..sorted.len() - 2 {
                if sorted[i] + 1 == sorted[i + 1] && sorted[i + 1] + 1 == sorted[i + 2] {
                    return true;
                }
            }
        }
    }

    false
}

/// 验证抽牌结果的有效性
///
/// # 参数
/// - `cards`: 抽取的牌ID列表
///
/// # 返回
/// - 是否有效（无重复、ID在范围内）
pub fn validate_drawn_cards(cards: &[u8]) -> bool {
    // 检查范围
    if cards.iter().any(|&c| c >= TOTAL_CARDS) {
        return false;
    }

    // 检查重复
    let mut seen = [false; 78];
    for &card_id in cards {
        if seen[card_id as usize] {
            return false;
        }
        seen[card_id as usize] = true;
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_draw_cards_random() {
        let seed = [1u8; 32];
        let cards = draw_cards_random(&seed, 3);

        assert_eq!(cards.len(), 3);

        // 检查没有重复
        let ids: Vec<u8> = cards.iter().map(|(id, _)| *id).collect();
        assert!(validate_drawn_cards(&ids));
    }

    #[test]
    fn test_draw_cards_by_time() {
        let timestamp = 1700000000u64;
        let block_hash = [2u8; 32];
        let cards = draw_cards_by_time(timestamp, &block_hash, 5);

        assert_eq!(cards.len(), 5);
    }

    #[test]
    fn test_draw_cards_by_numbers() {
        let numbers = vec![7u16, 13, 42];
        let block_hash = [3u8; 32];
        let cards = draw_cards_by_numbers(&numbers, &block_hash, 3);

        assert_eq!(cards.len(), 3);
    }

    #[test]
    fn test_analyze_element_distribution() {
        // 测试牌：愚者(0), 权杖Ace(22), 圣杯2(37), 宝剑3(52)
        let cards = vec![0, 22, 37, 52];
        let (major, wands, cups, swords, pentacles) = analyze_element_distribution(&cards);

        assert_eq!(major, 1);
        assert_eq!(wands, 1);
        assert_eq!(cups, 1);
        assert_eq!(swords, 1);
        assert_eq!(pentacles, 0);
    }

    #[test]
    fn test_calculate_reversed_ratio() {
        let positions = vec![true, false, true, false, false];
        let ratio = calculate_reversed_ratio(&positions);
        assert_eq!(ratio, 40);
    }

    #[test]
    fn test_validate_drawn_cards() {
        // 有效
        assert!(validate_drawn_cards(&[0, 21, 45]));

        // 无效：超出范围
        assert!(!validate_drawn_cards(&[0, 78, 45]));

        // 无效：有重复
        assert!(!validate_drawn_cards(&[0, 21, 21]));
    }

    #[test]
    fn test_has_special_combination() {
        // 愚者 + 世界
        assert!(has_special_combination(&[0, 21, 45]));

        // 三张大阿卡纳
        assert!(has_special_combination(&[1, 5, 10]));

        // 普通组合
        assert!(!has_special_combination(&[22, 36, 50]));
    }
}
