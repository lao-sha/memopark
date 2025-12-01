//! # 小六壬类型定义
//!
//! 本模块定义小六壬排盘系统的所有核心类型。
//!
//! ## 小六壬概述
//!
//! 小六壬是中国古代术数之一，又称"诸葛亮马前课"或"掐指速算"。
//! 通过六宫（大安、留连、速喜、赤口、小吉、空亡）来预测吉凶。
//!
//! ## 六宫含义
//!
//! - **大安**：属木，临青龙，吉祥安康
//! - **留连**：属水，临玄武，延迟纠缠
//! - **速喜**：属火，临朱雀，快速喜庆
//! - **赤口**：属金，临白虎，口舌是非
//! - **小吉**：属木，临六合，和合吉利
//! - **空亡**：属土，临勾陈，无果忧虑

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::{pallet_prelude::*, BoundedVec};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

// ============================================================================
// 六宫（六神）定义
// ============================================================================

/// 六宫枚举
///
/// 小六壬的核心六神，按顺序排列为：大安、留连、速喜、赤口、小吉、空亡
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum LiuGong {
    /// 大安 - 身不动时，属木，临青龙，吉祥安康
    #[default]
    DaAn = 0,
    /// 留连 - 人未归时，属水，临玄武，延迟纠缠
    LiuLian = 1,
    /// 速喜 - 人即至时，属火，临朱雀，快速喜庆
    SuXi = 2,
    /// 赤口 - 官事凶时，属金，临白虎，口舌是非
    ChiKou = 3,
    /// 小吉 - 人来喜时，属木，临六合，和合吉利
    XiaoJi = 4,
    /// 空亡 - 音信稀时，属土，临勾陈，无果忧虑
    KongWang = 5,
}

impl LiuGong {
    /// 从索引创建六宫（0-5循环）
    pub fn from_index(index: u8) -> Self {
        match index % 6 {
            0 => Self::DaAn,
            1 => Self::LiuLian,
            2 => Self::SuXi,
            3 => Self::ChiKou,
            4 => Self::XiaoJi,
            _ => Self::KongWang,
        }
    }

    /// 获取六宫索引
    pub fn index(&self) -> u8 {
        *self as u8
    }

    /// 获取六宫名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::DaAn => "大安",
            Self::LiuLian => "留连",
            Self::SuXi => "速喜",
            Self::ChiKou => "赤口",
            Self::XiaoJi => "小吉",
            Self::KongWang => "空亡",
        }
    }

    /// 获取五行属性
    pub fn wu_xing(&self) -> WuXing {
        match self {
            Self::DaAn => WuXing::Wood,
            Self::LiuLian => WuXing::Water,
            Self::SuXi => WuXing::Fire,
            Self::ChiKou => WuXing::Metal,
            Self::XiaoJi => WuXing::Wood,
            Self::KongWang => WuXing::Earth,
        }
    }

    /// 获取对应天将
    pub fn tian_jiang(&self) -> &'static str {
        match self {
            Self::DaAn => "青龙",
            Self::LiuLian => "玄武",
            Self::SuXi => "朱雀",
            Self::ChiKou => "白虎",
            Self::XiaoJi => "六合",
            Self::KongWang => "勾陈",
        }
    }

    /// 获取方位
    pub fn direction(&self) -> &'static str {
        match self {
            Self::DaAn => "东方",
            Self::LiuLian => "北方",
            Self::SuXi => "南方",
            Self::ChiKou => "西方",
            Self::XiaoJi => "东南",
            Self::KongWang => "中央",
        }
    }

    /// 获取颜色
    pub fn color(&self) -> &'static str {
        match self {
            Self::DaAn => "青色",
            Self::LiuLian => "黑色",
            Self::SuXi => "红色",
            Self::ChiKou => "白色",
            Self::XiaoJi => "绿色",
            Self::KongWang => "黄色",
        }
    }

    /// 获取吉凶等级（1-5，5最吉）
    pub fn fortune_level(&self) -> u8 {
        match self {
            Self::DaAn => 5,    // 大吉
            Self::SuXi => 4,    // 吉
            Self::XiaoJi => 4,  // 吉
            Self::LiuLian => 2, // 平
            Self::ChiKou => 1,  // 凶
            Self::KongWang => 1, // 凶
        }
    }

    /// 是否吉利
    pub fn is_auspicious(&self) -> bool {
        matches!(self, Self::DaAn | Self::SuXi | Self::XiaoJi)
    }

    /// 获取谋事数
    pub fn mou_shi_numbers(&self) -> [u8; 3] {
        match self {
            Self::DaAn => [1, 5, 7],
            Self::LiuLian => [2, 8, 10],
            Self::SuXi => [3, 6, 9],
            Self::ChiKou => [4, 7, 10],
            Self::XiaoJi => [1, 5, 7],
            Self::KongWang => [3, 6, 9],
        }
    }

    /// 获取卦辞
    pub fn gua_ci(&self) -> &'static str {
        match self {
            Self::DaAn => "大安事事昌，求谋在东方，失物去不远。宅舍保平安，行人身未动，病者主无妨，将军回田野，仔细更推详。",
            Self::LiuLian => "留连事难成，求谋日未明，官事只宜缓。去者来回程，失物南方见，急讨方遂心。更需防口舌，人事且平平。",
            Self::SuXi => "速喜喜来临，求财向南行，失物申未午。逢人路上寻，官事有福德，病者无祸侵，田宅六畜吉，行人有音信。",
            Self::ChiKou => "赤口主口舌，官非切要防，失物急去寻，行人有惊慌。鸡犬多作怪，病者出西方，更须防咀咒，恐怕染瘟殃。",
            Self::XiaoJi => "小吉最吉昌，路上好商量，阴人来报喜。失物在坤方，行人立便至，交易甚是强，凡事皆和合，病者祈上苍。",
            Self::KongWang => "空亡事不祥，阴人多乖张，求财无利益。行人有灾殃，失物寻不见，官事有刑伤。病人逢暗鬼，祈解可安康。",
        }
    }

    /// 获取简要描述
    pub fn brief(&self) -> &'static str {
        match self {
            Self::DaAn => "身不动时，五行属木，颜色青色，方位东方。临青龙。有静止、心安、吉祥之含义。",
            Self::LiuLian => "人未归时，五行属水，颜色黑色，方位北方。临玄武。有暗味不明、延迟、纠缠、拖延之含义。",
            Self::SuXi => "人即至时，五行属火，颜色红色，方位南方。临朱雀。有快速、喜庆、吉利之含义。指时机已到。",
            Self::ChiKou => "官事凶时，五行属金，颜色白色，方位西方。临白虎。有不吉、惊恐、凶险、口舌是非之含义。",
            Self::XiaoJi => "人来喜时，五行属木，临六合。有和合、吉利之含义。",
            Self::KongWang => "音信稀时，五行属土，颜色黄色，方位中央。临勾陈。有不吉、无结果、忧虑之含义。",
        }
    }
}

// ============================================================================
// 五行定义
// ============================================================================

/// 五行枚举
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum WuXing {
    /// 木
    #[default]
    Wood = 0,
    /// 火
    Fire = 1,
    /// 土
    Earth = 2,
    /// 金
    Metal = 3,
    /// 水
    Water = 4,
}

impl WuXing {
    /// 获取五行名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Wood => "木",
            Self::Fire => "火",
            Self::Earth => "土",
            Self::Metal => "金",
            Self::Water => "水",
        }
    }

    /// 我生（子）
    pub fn generates(&self) -> Self {
        match self {
            Self::Wood => Self::Fire,
            Self::Fire => Self::Earth,
            Self::Earth => Self::Metal,
            Self::Metal => Self::Water,
            Self::Water => Self::Wood,
        }
    }

    /// 我克
    pub fn restrains(&self) -> Self {
        match self {
            Self::Wood => Self::Earth,
            Self::Fire => Self::Metal,
            Self::Earth => Self::Water,
            Self::Metal => Self::Wood,
            Self::Water => Self::Fire,
        }
    }

    /// 生我（母）
    pub fn generated_by(&self) -> Self {
        match self {
            Self::Wood => Self::Water,
            Self::Fire => Self::Wood,
            Self::Earth => Self::Fire,
            Self::Metal => Self::Earth,
            Self::Water => Self::Metal,
        }
    }

    /// 克我
    pub fn restrained_by(&self) -> Self {
        match self {
            Self::Wood => Self::Metal,
            Self::Fire => Self::Water,
            Self::Earth => Self::Wood,
            Self::Metal => Self::Fire,
            Self::Water => Self::Earth,
        }
    }
}

// ============================================================================
// 起课方式
// ============================================================================

/// 起课方式枚举
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum DivinationMethod {
    /// 时间起课 - 以农历月日时起课（传统方法）
    #[default]
    TimeMethod = 0,
    /// 数字起课 - 以三个数字起课（活数起课法）
    NumberMethod = 1,
    /// 随机起课 - 使用链上随机数起课
    RandomMethod = 2,
    /// 手动指定 - 直接指定三宫结果
    ManualMethod = 3,
}

impl DivinationMethod {
    /// 获取起课方式名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::TimeMethod => "时间起课",
            Self::NumberMethod => "数字起课",
            Self::RandomMethod => "随机起课",
            Self::ManualMethod => "手动指定",
        }
    }
}

// ============================================================================
// 十二时辰
// ============================================================================

/// 十二时辰枚举
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum ShiChen {
    /// 子时 (23:00-01:00)
    #[default]
    Zi = 0,
    /// 丑时 (01:00-03:00)
    Chou = 1,
    /// 寅时 (03:00-05:00)
    Yin = 2,
    /// 卯时 (05:00-07:00)
    Mao = 3,
    /// 辰时 (07:00-09:00)
    Chen = 4,
    /// 巳时 (09:00-11:00)
    Si = 5,
    /// 午时 (11:00-13:00)
    Wu = 6,
    /// 未时 (13:00-15:00)
    Wei = 7,
    /// 申时 (15:00-17:00)
    Shen = 8,
    /// 酉时 (17:00-19:00)
    You = 9,
    /// 戌时 (19:00-21:00)
    Xu = 10,
    /// 亥时 (21:00-23:00)
    Hai = 11,
}

impl ShiChen {
    /// 从小时数计算时辰（0-23）
    pub fn from_hour(hour: u8) -> Self {
        // 子时从23点开始
        let adjusted = if hour == 23 { 0 } else { (hour + 1) / 2 };
        match adjusted % 12 {
            0 => Self::Zi,
            1 => Self::Chou,
            2 => Self::Yin,
            3 => Self::Mao,
            4 => Self::Chen,
            5 => Self::Si,
            6 => Self::Wu,
            7 => Self::Wei,
            8 => Self::Shen,
            9 => Self::You,
            10 => Self::Xu,
            _ => Self::Hai,
        }
    }

    /// 获取时辰索引（1-12，用于计算）
    pub fn index(&self) -> u8 {
        (*self as u8) + 1
    }

    /// 获取时辰名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Zi => "子时",
            Self::Chou => "丑时",
            Self::Yin => "寅时",
            Self::Mao => "卯时",
            Self::Chen => "辰时",
            Self::Si => "巳时",
            Self::Wu => "午时",
            Self::Wei => "未时",
            Self::Shen => "申时",
            Self::You => "酉时",
            Self::Xu => "戌时",
            Self::Hai => "亥时",
        }
    }
}

// ============================================================================
// 三宫结果
// ============================================================================

/// 三宫结果
///
/// 小六壬的核心输出：月宫、日宫、时宫
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct SanGong {
    /// 月宫（第一宫）- 代表事情的起因或背景
    pub yue_gong: LiuGong,
    /// 日宫（第二宫）- 代表事情的经过或现状
    pub ri_gong: LiuGong,
    /// 时宫（第三宫）- 代表事情的结果或未来
    pub shi_gong: LiuGong,
}

impl SanGong {
    /// 创建三宫
    pub fn new(yue: LiuGong, ri: LiuGong, shi: LiuGong) -> Self {
        Self {
            yue_gong: yue,
            ri_gong: ri,
            shi_gong: shi,
        }
    }

    /// 获取综合吉凶等级（1-5）
    pub fn fortune_level(&self) -> u8 {
        // 以时宫（结果）为主，综合三宫
        let base = self.shi_gong.fortune_level();
        let avg = (self.yue_gong.fortune_level() + self.ri_gong.fortune_level() + self.shi_gong.fortune_level()) / 3;

        // 结果占60%，过程占40%
        (base * 6 + avg * 4) / 10
    }

    /// 检查是否全吉（三宫皆吉）
    pub fn is_all_auspicious(&self) -> bool {
        self.yue_gong.is_auspicious() && self.ri_gong.is_auspicious() && self.shi_gong.is_auspicious()
    }

    /// 检查是否全凶（三宫皆凶）
    pub fn is_all_inauspicious(&self) -> bool {
        !self.yue_gong.is_auspicious() && !self.ri_gong.is_auspicious() && !self.shi_gong.is_auspicious()
    }

    /// 检查是否为纯宫（三宫相同）
    pub fn is_pure(&self) -> bool {
        self.yue_gong == self.ri_gong && self.ri_gong == self.shi_gong
    }

    /// 获取五行关系分析
    pub fn wu_xing_analysis(&self) -> WuXingRelation {
        let _wx1 = self.yue_gong.wu_xing();
        let wx2 = self.ri_gong.wu_xing();
        let wx3 = self.shi_gong.wu_xing();

        // 分析日宫到时宫的关系（主要看结果）
        if wx2.generates() == wx3 {
            WuXingRelation::Sheng // 生
        } else if wx2.restrains() == wx3 {
            WuXingRelation::Ke // 克
        } else if wx2 == wx3 {
            WuXingRelation::BiHe // 比和
        } else if wx2.generated_by() == wx3 {
            WuXingRelation::XieSheng // 泄
        } else {
            WuXingRelation::BeiKe // 被克
        }
    }
}

/// 五行关系
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum WuXingRelation {
    /// 相生
    #[default]
    Sheng = 0,
    /// 相克
    Ke = 1,
    /// 比和
    BiHe = 2,
    /// 泄气
    XieSheng = 3,
    /// 被克
    BeiKe = 4,
}

impl WuXingRelation {
    /// 获取关系名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Sheng => "相生",
            Self::Ke => "相克",
            Self::BiHe => "比和",
            Self::XieSheng => "泄气",
            Self::BeiKe => "被克",
        }
    }

    /// 获取关系对吉凶的影响（正负值）
    pub fn fortune_modifier(&self) -> i8 {
        match self {
            Self::Sheng => 1,   // 生助为吉
            Self::BiHe => 1,   // 比和为吉
            Self::Ke => -1,    // 克制为凶
            Self::BeiKe => -1, // 被克为凶
            Self::XieSheng => 0, // 泄气为平
        }
    }
}

// ============================================================================
// 小六壬课盘
// ============================================================================

/// 小六壬课盘
///
/// 存储完整的小六壬排盘结果
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct XiaoLiuRenPan<AccountId, BlockNumber, MaxCidLen: Get<u32>> {
    /// 课盘ID
    pub id: u64,
    /// 创建者
    pub creator: AccountId,
    /// 创建区块
    pub created_at: BlockNumber,
    /// 起课方式
    pub method: DivinationMethod,
    /// 占问事项CID（IPFS）
    pub question_cid: Option<BoundedVec<u8, MaxCidLen>>,

    /// 起课参数
    /// 对于时间起课：月、日、时
    /// 对于数字起课：三个数字
    pub param1: u8,
    pub param2: u8,
    pub param3: u8,

    /// 农历信息（可选，时间起课时使用）
    pub lunar_month: Option<u8>,
    pub lunar_day: Option<u8>,
    pub shi_chen: Option<ShiChen>,

    /// 三宫结果
    pub san_gong: SanGong,

    /// 是否公开
    pub is_public: bool,

    /// AI 解读 CID
    pub ai_interpretation_cid: Option<BoundedVec<u8, MaxCidLen>>,
}

// ============================================================================
// 用户统计
// ============================================================================

/// 用户统计数据
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub struct UserStats {
    /// 总起课次数
    pub total_pans: u32,
    /// AI 解读次数
    pub ai_interpretations: u32,
    /// 首次起课区块
    pub first_pan_block: u32,
}
