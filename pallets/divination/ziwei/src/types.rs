//! # 紫微斗数类型定义
//!
//! 本模块定义紫微斗数排盘系统的所有核心类型。

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::BoundedVec;
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

// ============================================================================
// 天干地支基础类型
// ============================================================================

/// 十天干
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum TianGan {
    #[default]
    Jia = 0,   // 甲
    Yi = 1,    // 乙
    Bing = 2,  // 丙
    Ding = 3,  // 丁
    Wu = 4,    // 戊
    Ji = 5,    // 己
    Geng = 6,  // 庚
    Xin = 7,   // 辛
    Ren = 8,   // 壬
    Gui = 9,   // 癸
}

impl TianGan {
    /// 获取天干名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Jia => "甲",
            Self::Yi => "乙",
            Self::Bing => "丙",
            Self::Ding => "丁",
            Self::Wu => "戊",
            Self::Ji => "己",
            Self::Geng => "庚",
            Self::Xin => "辛",
            Self::Ren => "壬",
            Self::Gui => "癸",
        }
    }

    /// 从数字获取天干
    pub fn from_index(index: u8) -> Self {
        match index % 10 {
            0 => Self::Jia,
            1 => Self::Yi,
            2 => Self::Bing,
            3 => Self::Ding,
            4 => Self::Wu,
            5 => Self::Ji,
            6 => Self::Geng,
            7 => Self::Xin,
            8 => Self::Ren,
            _ => Self::Gui,
        }
    }

    /// 获取天干索引
    pub fn index(&self) -> u8 {
        *self as u8
    }

    /// 获取天干阴阳属性
    pub fn yin_yang(&self) -> YinYang {
        match self {
            Self::Jia | Self::Bing | Self::Wu | Self::Geng | Self::Ren => YinYang::Yang,
            _ => YinYang::Yin,
        }
    }

    /// 获取天干五行属性
    pub fn wu_xing(&self) -> WuXing {
        match self {
            Self::Jia | Self::Yi => WuXing::Wood,
            Self::Bing | Self::Ding => WuXing::Fire,
            Self::Wu | Self::Ji => WuXing::Earth,
            Self::Geng | Self::Xin => WuXing::Metal,
            Self::Ren | Self::Gui => WuXing::Water,
        }
    }
}

/// 十二地支
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum DiZhi {
    #[default]
    Zi = 0,   // 子
    Chou = 1, // 丑
    Yin = 2,  // 寅
    Mao = 3,  // 卯
    Chen = 4, // 辰
    Si = 5,   // 巳
    Wu = 6,   // 午
    Wei = 7,  // 未
    Shen = 8, // 申
    You = 9,  // 酉
    Xu = 10,  // 戌
    Hai = 11, // 亥
}

impl DiZhi {
    /// 获取地支名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Zi => "子",
            Self::Chou => "丑",
            Self::Yin => "寅",
            Self::Mao => "卯",
            Self::Chen => "辰",
            Self::Si => "巳",
            Self::Wu => "午",
            Self::Wei => "未",
            Self::Shen => "申",
            Self::You => "酉",
            Self::Xu => "戌",
            Self::Hai => "亥",
        }
    }

    /// 从数字获取地支
    pub fn from_index(index: u8) -> Self {
        match index % 12 {
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

    /// 获取地支索引
    pub fn index(&self) -> u8 {
        *self as u8
    }

    /// 获取生肖
    pub fn sheng_xiao(&self) -> &'static str {
        match self {
            Self::Zi => "鼠",
            Self::Chou => "牛",
            Self::Yin => "虎",
            Self::Mao => "兔",
            Self::Chen => "龙",
            Self::Si => "蛇",
            Self::Wu => "马",
            Self::Wei => "羊",
            Self::Shen => "猴",
            Self::You => "鸡",
            Self::Xu => "狗",
            Self::Hai => "猪",
        }
    }
}

// ============================================================================
// 五行与阴阳
// ============================================================================

/// 五行
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum WuXing {
    #[default]
    Water = 0, // 水
    Wood = 1,  // 木
    Metal = 2, // 金
    Earth = 3, // 土
    Fire = 4,  // 火
}

impl WuXing {
    /// 获取五行名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Water => "水",
            Self::Wood => "木",
            Self::Metal => "金",
            Self::Earth => "土",
            Self::Fire => "火",
        }
    }

    /// 获取五行局数
    pub fn ju_shu(&self) -> u8 {
        match self {
            Self::Water => 2,
            Self::Wood => 3,
            Self::Metal => 4,
            Self::Earth => 5,
            Self::Fire => 6,
        }
    }
}

/// 阴阳
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum YinYang {
    #[default]
    Yang = 0, // 阳
    Yin = 1,  // 阴
}

impl YinYang {
    /// 获取阴阳名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Yang => "阳",
            Self::Yin => "阴",
        }
    }
}

// ============================================================================
// 十二宫位
// ============================================================================

/// 十二宫位
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum GongWei {
    #[default]
    MingGong = 0,    // 命宫
    FuMu = 1,        // 父母宫
    FuDe = 2,        // 福德宫
    TianZhai = 3,    // 田宅宫
    GuanLu = 4,      // 官禄宫
    JiaoYou = 5,     // 交友宫（仆役宫）
    QianYi = 6,      // 迁移宫
    JiE = 7,         // 疾厄宫
    CaiBo = 8,       // 财帛宫
    ZiNv = 9,        // 子女宫
    FuQi = 10,       // 夫妻宫
    XiongDi = 11,    // 兄弟宫
}

impl GongWei {
    /// 获取宫位名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::MingGong => "命宫",
            Self::FuMu => "父母宫",
            Self::FuDe => "福德宫",
            Self::TianZhai => "田宅宫",
            Self::GuanLu => "官禄宫",
            Self::JiaoYou => "交友宫",
            Self::QianYi => "迁移宫",
            Self::JiE => "疾厄宫",
            Self::CaiBo => "财帛宫",
            Self::ZiNv => "子女宫",
            Self::FuQi => "夫妻宫",
            Self::XiongDi => "兄弟宫",
        }
    }

    /// 从索引获取宫位
    pub fn from_index(index: u8) -> Self {
        match index % 12 {
            0 => Self::MingGong,
            1 => Self::FuMu,
            2 => Self::FuDe,
            3 => Self::TianZhai,
            4 => Self::GuanLu,
            5 => Self::JiaoYou,
            6 => Self::QianYi,
            7 => Self::JiE,
            8 => Self::CaiBo,
            9 => Self::ZiNv,
            10 => Self::FuQi,
            _ => Self::XiongDi,
        }
    }

    /// 获取宫位索引
    pub fn index(&self) -> u8 {
        *self as u8
    }
}

// ============================================================================
// 十四主星
// ============================================================================

/// 十四主星
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum ZhuXing {
    // 紫微星系（6颗）
    #[default]
    ZiWei = 0,    // 紫微星 - 帝王星
    TianJi = 1,   // 天机星 - 智谋星
    TaiYang = 2,  // 太阳星 - 官禄主
    WuQu = 3,     // 武曲星 - 财星
    TianTong = 4, // 天同星 - 福德主
    LianZhen = 5, // 廉贞星 - 次桃花星

    // 天府星系（8颗）
    TianFu = 6,   // 天府星 - 库星
    TaiYin = 7,   // 太阴星 - 桃花星
    TanLang = 8,  // 贪狼星 - 第一大桃花星
    JuMen = 9,    // 巨门星 - 口舌星
    TianXiang = 10, // 天相星 - 印星
    TianLiang = 11, // 天梁星 - 宗教星
    QiSha = 12,   // 七杀星 - 将星
    PoJun = 13,   // 破军星 - 先锋星
}

impl ZhuXing {
    /// 获取主星名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::ZiWei => "紫微",
            Self::TianJi => "天机",
            Self::TaiYang => "太阳",
            Self::WuQu => "武曲",
            Self::TianTong => "天同",
            Self::LianZhen => "廉贞",
            Self::TianFu => "天府",
            Self::TaiYin => "太阴",
            Self::TanLang => "贪狼",
            Self::JuMen => "巨门",
            Self::TianXiang => "天相",
            Self::TianLiang => "天梁",
            Self::QiSha => "七杀",
            Self::PoJun => "破军",
        }
    }

    /// 判断是否为紫微星系
    pub fn is_ziwei_series(&self) -> bool {
        matches!(
            self,
            Self::ZiWei | Self::TianJi | Self::TaiYang | Self::WuQu | Self::TianTong | Self::LianZhen
        )
    }

    /// 判断是否为天府星系
    pub fn is_tianfu_series(&self) -> bool {
        !self.is_ziwei_series()
    }
}

// ============================================================================
// 辅星与杂曜
// ============================================================================

/// 六吉星
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum LiuJiXing {
    WenChang = 0,  // 文昌
    WenQu = 1,     // 文曲
    ZuoFu = 2,     // 左辅
    YouBi = 3,     // 右弼
    TianKui = 4,   // 天魁
    TianYue = 5,   // 天钺
}

impl LiuJiXing {
    /// 获取六吉星名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::WenChang => "文昌",
            Self::WenQu => "文曲",
            Self::ZuoFu => "左辅",
            Self::YouBi => "右弼",
            Self::TianKui => "天魁",
            Self::TianYue => "天钺",
        }
    }
}

/// 六煞星
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum LiuShaXing {
    QingYang = 0,  // 擎羊
    TuoLuo = 1,    // 陀罗
    HuoXing = 2,   // 火星
    LingXing = 3,  // 铃星
    DiKong = 4,    // 地空
    DiJie = 5,     // 地劫
}

impl LiuShaXing {
    /// 获取六煞星名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::QingYang => "擎羊",
            Self::TuoLuo => "陀罗",
            Self::HuoXing => "火星",
            Self::LingXing => "铃星",
            Self::DiKong => "地空",
            Self::DiJie => "地劫",
        }
    }
}

/// 四化星
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum SiHua {
    HuaLu = 0,    // 化禄
    HuaQuan = 1,  // 化权
    HuaKe = 2,    // 化科
    HuaJi = 3,    // 化忌
}

impl SiHua {
    /// 获取四化名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::HuaLu => "化禄",
            Self::HuaQuan => "化权",
            Self::HuaKe => "化科",
            Self::HuaJi => "化忌",
        }
    }
}

// ============================================================================
// 星曜亮度
// ============================================================================

/// 星曜亮度（庙旺利陷）
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum StarBrightness {
    Miao = 0,     // 庙 - 最旺
    Wang = 1,     // 旺 - 次旺
    De = 2,       // 得 - 得地
    #[default]
    Ping = 3,     // 平 - 平常
    BuDe = 4,     // 不得 - 不得地
    Xian = 5,     // 陷 - 落陷
}

impl StarBrightness {
    /// 获取亮度名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Miao => "庙",
            Self::Wang => "旺",
            Self::De => "得",
            Self::Ping => "平",
            Self::BuDe => "不",
            Self::Xian => "陷",
        }
    }

    /// 获取亮度权重（用于评分）
    pub fn weight(&self) -> u8 {
        match self {
            Self::Miao => 100,
            Self::Wang => 80,
            Self::De => 60,
            Self::Ping => 40,
            Self::BuDe => 20,
            Self::Xian => 10,
        }
    }
}

// ============================================================================
// 性别
// ============================================================================

/// 性别
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum Gender {
    #[default]
    Male = 0,   // 男
    Female = 1, // 女
}

impl Gender {
    /// 获取性别名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Male => "男",
            Self::Female => "女",
        }
    }
}

// ============================================================================
// 宫位数据结构
// ============================================================================

/// 宫位信息
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub struct Palace {
    /// 宫位类型
    pub gong_wei: GongWei,
    /// 宫位所在地支
    pub di_zhi: DiZhi,
    /// 宫干
    pub tian_gan: TianGan,
    /// 主星列表（最多3颗）
    pub zhu_xing: [Option<ZhuXing>; 3],
    /// 主星亮度
    pub zhu_xing_brightness: [StarBrightness; 3],
    /// 六吉星
    pub liu_ji: [bool; 6],
    /// 六煞星
    pub liu_sha: [bool; 6],
    /// 四化（生年四化在此宫的星）
    pub si_hua: [Option<SiHua>; 4],
    /// 禄存所在
    pub lu_cun: bool,
    /// 天马所在
    pub tian_ma: bool,
}

// ============================================================================
// 命盘主结构
// ============================================================================

/// 紫微斗数命盘
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct ZiweiChart<AccountId, BlockNumber, Moment, MaxCidLen: frame_support::traits::Get<u32>> {
    /// 命盘ID
    pub id: u64,
    /// 创建者账户
    pub creator: AccountId,
    /// 创建区块
    pub created_at: BlockNumber,
    /// 时间戳（毫秒）
    pub timestamp: Moment,

    // ===== 出生信息 =====
    /// 农历年
    pub lunar_year: u16,
    /// 农历月
    pub lunar_month: u8,
    /// 农历日
    pub lunar_day: u8,
    /// 出生时辰
    pub birth_hour: DiZhi,
    /// 性别
    pub gender: Gender,
    /// 是否闰月
    pub is_leap_month: bool,

    // ===== 四柱信息 =====
    /// 年干
    pub year_gan: TianGan,
    /// 年支
    pub year_zhi: DiZhi,

    // ===== 命盘核心 =====
    /// 五行局
    pub wu_xing_ju: WuXing,
    /// 局数
    pub ju_shu: u8,
    /// 命宫位置（地支索引 0-11）
    pub ming_gong_pos: u8,
    /// 身宫位置
    pub shen_gong_pos: u8,
    /// 紫微星位置
    pub ziwei_pos: u8,
    /// 天府星位置
    pub tianfu_pos: u8,

    // ===== 十二宫排布 =====
    /// 十二宫数据
    pub palaces: [Palace; 12],

    // ===== 四化信息 =====
    /// 生年四化星
    pub si_hua_stars: [ZhuXing; 4],

    // ===== 大运信息 =====
    /// 起运年龄
    pub qi_yun_age: u8,
    /// 大运顺逆（true=顺行，false=逆行）
    pub da_yun_shun: bool,

    // ===== 状态 =====
    /// 是否公开
    pub is_public: bool,
    /// AI 解读 CID
    pub ai_interpretation_cid: Option<BoundedVec<u8, MaxCidLen>>,
}

// ============================================================================
// 起盘方式
// ============================================================================

/// 起盘方式
#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub enum DivinationMethod {
    /// 时间起盘（根据出生时间自动计算）
    #[default]
    ByTime = 0,
    /// 手动指定（直接输入四柱信息）
    Manual = 1,
    /// 随机起盘（测试/娱乐用途）
    Random = 2,
}

impl DivinationMethod {
    /// 获取起盘方式名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::ByTime => "时间起盘",
            Self::Manual => "手动指定",
            Self::Random => "随机起盘",
        }
    }
}

// ============================================================================
// 用户统计
// ============================================================================

/// 用户统计数据
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
pub struct UserStats {
    /// 总排盘次数
    pub total_charts: u32,
    /// AI 解读次数
    pub ai_interpretations: u32,
    /// 首次排盘区块
    pub first_chart_block: u32,
}
