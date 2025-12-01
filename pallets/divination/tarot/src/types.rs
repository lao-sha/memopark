//! 塔罗牌 - 基础数据类型定义
//!
//! 本模块定义了塔罗牌排盘系统所需的所有核心数据结构，包括：
//! - 牌组类型 (CardType) - 大阿卡纳/小阿卡纳
//! - 花色 (Suit) - 权杖/圣杯/宝剑/星币
//! - 塔罗牌 (TarotCard) - 单张牌的完整信息
//! - 牌阵类型 (SpreadType) - 支持的牌阵布局
//! - 占卜记录 (TarotReading) - 完整的占卜结果

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_std::prelude::*;

/// 塔罗牌类型 - 大阿卡纳 vs 小阿卡纳
///
/// 大阿卡纳（Major Arcana）: 22张，代表人生重大主题和精神旅程
/// 小阿卡纳（Minor Arcana）: 56张，分四种花色，代表日常生活事务
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum CardType {
    /// 大阿卡纳 - 22张主牌（0-21号）
    #[default]
    MajorArcana = 0,
    /// 小阿卡纳 - 56张副牌（分四种花色）
    MinorArcana = 1,
}

/// 小阿卡纳花色枚举
///
/// 四种花色对应四大元素：
/// - 权杖(Wands) - 火元素，代表激情、创造力、行动
/// - 圣杯(Cups) - 水元素，代表情感、关系、直觉
/// - 宝剑(Swords) - 风元素，代表思想、沟通、冲突
/// - 星币(Pentacles) - 土元素，代表物质、金钱、工作
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum Suit {
    /// 无花色（大阿卡纳专用）
    #[default]
    None = 0,
    /// 权杖 - 火元素
    Wands = 1,
    /// 圣杯 - 水元素
    Cups = 2,
    /// 宝剑 - 风元素
    Swords = 3,
    /// 星币 - 土元素
    Pentacles = 4,
}

impl Suit {
    /// 获取花色对应的元素名称
    pub fn element(&self) -> &'static str {
        match self {
            Suit::None => "无",
            Suit::Wands => "火",
            Suit::Cups => "水",
            Suit::Swords => "风",
            Suit::Pentacles => "土",
        }
    }
}

/// 宫廷牌等级
///
/// 小阿卡纳中的宫廷牌（11-14号）
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum CourtRank {
    /// 非宫廷牌
    #[default]
    None = 0,
    /// 侍从 - 学习者、信使
    Page = 11,
    /// 骑士 - 行动者、追求者
    Knight = 12,
    /// 王后 - 滋养者、直觉
    Queen = 13,
    /// 国王 - 掌控者、权威
    King = 14,
}

/// 牌的正逆位状态
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum CardPosition {
    /// 正位 - 牌意的正面表达
    #[default]
    Upright = 0,
    /// 逆位 - 牌意的负面/内化表达
    Reversed = 1,
}

impl CardPosition {
    /// 从布尔值创建（true=逆位）
    pub fn from_bool(reversed: bool) -> Self {
        if reversed {
            CardPosition::Reversed
        } else {
            CardPosition::Upright
        }
    }

    /// 是否为逆位
    pub fn is_reversed(&self) -> bool {
        matches!(self, CardPosition::Reversed)
    }
}

/// 塔罗牌结构 - 单张牌的完整信息
///
/// 编号规则：
/// - 0-21: 大阿卡纳（愚者=0, 魔术师=1, ... 世界=21）
/// - 22-35: 权杖（Ace=22, 2=23, ... 10=31, Page=32, Knight=33, Queen=34, King=35）
/// - 36-49: 圣杯
/// - 50-63: 宝剑
/// - 64-77: 星币
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub struct TarotCard {
    /// 牌的唯一编号 (0-77)
    pub id: u8,
    /// 牌的类型（大/小阿卡纳）
    pub card_type: CardType,
    /// 花色（仅小阿卡纳有效）
    pub suit: Suit,
    /// 牌面数值（大阿卡纳0-21，小阿卡纳1-14）
    pub number: u8,
}

impl TarotCard {
    /// 从编号创建塔罗牌
    ///
    /// # 参数
    /// - `id`: 牌的编号 (0-77)
    ///
    /// # 编号映射
    /// - 0-21: 大阿卡纳
    /// - 22-35: 权杖 (Ace-King)
    /// - 36-49: 圣杯
    /// - 50-63: 宝剑
    /// - 64-77: 星币
    pub fn from_id(id: u8) -> Self {
        let id = id % 78; // 确保在有效范围内

        if id < 22 {
            // 大阿卡纳
            TarotCard {
                id,
                card_type: CardType::MajorArcana,
                suit: Suit::None,
                number: id,
            }
        } else {
            // 小阿卡纳
            let minor_id = id - 22; // 0-55
            let suit_index = minor_id / 14; // 0-3
            let card_number = (minor_id % 14) + 1; // 1-14

            let suit = match suit_index {
                0 => Suit::Wands,
                1 => Suit::Cups,
                2 => Suit::Swords,
                _ => Suit::Pentacles,
            };

            TarotCard {
                id,
                card_type: CardType::MinorArcana,
                suit,
                number: card_number,
            }
        }
    }

    /// 判断是否为大阿卡纳
    pub fn is_major(&self) -> bool {
        matches!(self.card_type, CardType::MajorArcana)
    }

    /// 判断是否为宫廷牌
    pub fn is_court_card(&self) -> bool {
        matches!(self.card_type, CardType::MinorArcana) && self.number >= 11
    }

    /// 获取宫廷牌等级
    pub fn court_rank(&self) -> CourtRank {
        if !self.is_court_card() {
            return CourtRank::None;
        }
        match self.number {
            11 => CourtRank::Page,
            12 => CourtRank::Knight,
            13 => CourtRank::Queen,
            14 => CourtRank::King,
            _ => CourtRank::None,
        }
    }
}

/// 牌阵类型枚举
///
/// 定义了多种常用的塔罗牌牌阵
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum SpreadType {
    /// 单张牌 - 快速指引
    #[default]
    SingleCard = 1,
    /// 三张牌（时间线）- 过去/现在/未来
    ThreeCardTime = 3,
    /// 三张牌（情况）- 情况/行动/结果
    ThreeCardSituation = 4,
    /// 五张牌 - 爱情关系牌阵
    LoveRelationship = 5,
    /// 六张牌 - 事业指导牌阵
    CareerGuidance = 6,
    /// 七张牌 - 决策分析牌阵
    DecisionMaking = 7,
    /// 十张牌 - 凯尔特十字（最经典的牌阵）
    CelticCross = 10,
    /// 十二张牌 - 年度运势
    YearForecast = 12,
}

impl SpreadType {
    /// 获取牌阵所需的牌数
    pub fn card_count(&self) -> u8 {
        match self {
            SpreadType::SingleCard => 1,
            SpreadType::ThreeCardTime | SpreadType::ThreeCardSituation => 3,
            SpreadType::LoveRelationship => 5,
            SpreadType::CareerGuidance => 6,
            SpreadType::DecisionMaking => 7,
            SpreadType::CelticCross => 10,
            SpreadType::YearForecast => 12,
        }
    }

    /// 从牌数推断牌阵类型（默认）
    pub fn from_count(count: u8) -> Self {
        match count {
            1 => SpreadType::SingleCard,
            3 => SpreadType::ThreeCardTime,
            5 => SpreadType::LoveRelationship,
            6 => SpreadType::CareerGuidance,
            7 => SpreadType::DecisionMaking,
            10 => SpreadType::CelticCross,
            12 => SpreadType::YearForecast,
            _ => SpreadType::SingleCard,
        }
    }
}

/// 抽取的牌（含位置信息）
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub struct DrawnCard {
    /// 塔罗牌
    pub card: TarotCard,
    /// 正逆位
    pub position: CardPosition,
    /// 在牌阵中的位置索引 (0-based)
    pub spread_position: u8,
}

impl DrawnCard {
    /// 创建新的抽取牌
    pub fn new(card_id: u8, reversed: bool, spread_position: u8) -> Self {
        Self {
            card: TarotCard::from_id(card_id),
            position: CardPosition::from_bool(reversed),
            spread_position,
        }
    }
}

/// 占卜方式枚举
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum DivinationMethod {
    /// 随机抽牌 - 使用链上随机数
    #[default]
    Random = 0,
    /// 时间起卦 - 基于时间戳生成
    ByTime = 1,
    /// 数字起卦 - 基于用户提供的数字
    ByNumbers = 2,
    /// 手动指定 - 直接指定牌面
    Manual = 3,
}

/// 完整的塔罗牌占卜记录
///
/// 存储一次完整占卜的所有信息
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxCards))]
pub struct TarotReading<AccountId, BlockNumber, MaxCards: Get<u32>> {
    /// 占卜记录唯一ID
    pub id: u64,
    /// 占卜者账户
    pub diviner: AccountId,
    /// 牌阵类型
    pub spread_type: SpreadType,
    /// 占卜方式
    pub method: DivinationMethod,
    /// 抽取的牌列表
    pub cards: BoundedVec<DrawnCard, MaxCards>,
    /// 占卜问题的哈希值（隐私保护）
    pub question_hash: [u8; 32],
    /// 占卜时的区块号
    pub block_number: BlockNumber,
    /// 占卜时间戳（Unix秒）
    pub timestamp: u64,
    /// AI 解读的 IPFS CID（可选）
    pub interpretation_cid: Option<BoundedVec<u8, ConstU32<64>>>,
    /// 是否公开
    pub is_public: bool,
}

/// 牌阵位置含义（用于前端展示）
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxLen))]
pub struct SpreadPosition<MaxLen: Get<u32>> {
    /// 位置索引
    pub index: u8,
    /// 位置名称（如"过去"、"现在"、"未来"）
    pub name: BoundedVec<u8, MaxLen>,
}

/// 占卜统计信息
#[derive(Clone, Copy, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub struct DivinationStats {
    /// 总占卜次数
    pub total_readings: u64,
    /// 大阿卡纳出现次数
    pub major_arcana_count: u64,
    /// 逆位出现次数
    pub reversed_count: u64,
    /// 最常出现的牌ID
    pub most_frequent_card: u8,
    /// 最常出现的牌次数
    pub most_frequent_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tarot_card_from_id() {
        // 测试大阿卡纳
        let fool = TarotCard::from_id(0);
        assert!(fool.is_major());
        assert_eq!(fool.number, 0);
        assert_eq!(fool.suit, Suit::None);

        let world = TarotCard::from_id(21);
        assert!(world.is_major());
        assert_eq!(world.number, 21);

        // 测试小阿卡纳 - 权杖Ace
        let wands_ace = TarotCard::from_id(22);
        assert!(!wands_ace.is_major());
        assert_eq!(wands_ace.suit, Suit::Wands);
        assert_eq!(wands_ace.number, 1);

        // 测试小阿卡纳 - 权杖国王
        let wands_king = TarotCard::from_id(35);
        assert!(wands_king.is_court_card());
        assert_eq!(wands_king.court_rank(), CourtRank::King);

        // 测试小阿卡纳 - 圣杯Ace
        let cups_ace = TarotCard::from_id(36);
        assert_eq!(cups_ace.suit, Suit::Cups);
        assert_eq!(cups_ace.number, 1);

        // 测试小阿卡纳 - 星币国王（最后一张）
        let pentacles_king = TarotCard::from_id(77);
        assert_eq!(pentacles_king.suit, Suit::Pentacles);
        assert_eq!(pentacles_king.number, 14);
    }

    #[test]
    fn test_spread_type_card_count() {
        assert_eq!(SpreadType::SingleCard.card_count(), 1);
        assert_eq!(SpreadType::ThreeCardTime.card_count(), 3);
        assert_eq!(SpreadType::CelticCross.card_count(), 10);
        assert_eq!(SpreadType::YearForecast.card_count(), 12);
    }

    #[test]
    fn test_card_position() {
        assert!(!CardPosition::Upright.is_reversed());
        assert!(CardPosition::Reversed.is_reversed());
        assert_eq!(CardPosition::from_bool(true), CardPosition::Reversed);
        assert_eq!(CardPosition::from_bool(false), CardPosition::Upright);
    }
}
