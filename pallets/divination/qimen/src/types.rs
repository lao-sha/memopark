//! # 奇门遁甲数据类型定义
//!
//! 本模块定义了奇门遁甲排盘系统所需的所有数据类型，包括：
//! - 天干地支
//! - 九宫方位
//! - 九星、八门、八神
//! - 三奇六仪
//! - 排盘结果结构

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::BoundedVec;
use scale_info::TypeInfo;
use sp_std::prelude::*;

// ==================== 天干地支 ====================

/// 十天干
///
/// 甲乙丙丁戊己庚辛壬癸，用于纪年、纪月、纪日、纪时
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum TianGan {
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
    /// 从数字获取天干（0-9）
    pub fn from_index(index: u8) -> Option<Self> {
        match index {
            0 => Some(Self::Jia),
            1 => Some(Self::Yi),
            2 => Some(Self::Bing),
            3 => Some(Self::Ding),
            4 => Some(Self::Wu),
            5 => Some(Self::Ji),
            6 => Some(Self::Geng),
            7 => Some(Self::Xin),
            8 => Some(Self::Ren),
            9 => Some(Self::Gui),
            _ => None,
        }
    }

    /// 获取天干索引
    pub fn index(&self) -> u8 {
        *self as u8
    }

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

    /// 判断是否为三奇（乙丙丁）
    pub fn is_san_qi(&self) -> bool {
        matches!(self, Self::Yi | Self::Bing | Self::Ding)
    }

    /// 判断是否为六仪（戊己庚辛壬癸）
    pub fn is_liu_yi(&self) -> bool {
        matches!(self, Self::Wu | Self::Ji | Self::Geng | Self::Xin | Self::Ren | Self::Gui)
    }

    /// 获取天干五行属性
    pub fn wu_xing(&self) -> WuXing {
        match self {
            Self::Jia | Self::Yi => WuXing::Mu,
            Self::Bing | Self::Ding => WuXing::Huo,
            Self::Wu | Self::Ji => WuXing::Tu,
            Self::Geng | Self::Xin => WuXing::Jin,
            Self::Ren | Self::Gui => WuXing::Shui,
        }
    }
}

/// 十二地支
///
/// 子丑寅卯辰巳午未申酉戌亥
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum DiZhi {
    Zi = 0,    // 子（23:00-01:00）
    Chou = 1,  // 丑（01:00-03:00）
    Yin = 2,   // 寅（03:00-05:00）
    Mao = 3,   // 卯（05:00-07:00）
    Chen = 4,  // 辰（07:00-09:00）
    Si = 5,    // 巳（09:00-11:00）
    Wu = 6,    // 午（11:00-13:00）
    Wei = 7,   // 未（13:00-15:00）
    Shen = 8,  // 申（15:00-17:00）
    You = 9,   // 酉（17:00-19:00）
    Xu = 10,   // 戌（19:00-21:00）
    Hai = 11,  // 亥（21:00-23:00）
}

impl DiZhi {
    /// 从数字获取地支（0-11）
    pub fn from_index(index: u8) -> Option<Self> {
        match index {
            0 => Some(Self::Zi),
            1 => Some(Self::Chou),
            2 => Some(Self::Yin),
            3 => Some(Self::Mao),
            4 => Some(Self::Chen),
            5 => Some(Self::Si),
            6 => Some(Self::Wu),
            7 => Some(Self::Wei),
            8 => Some(Self::Shen),
            9 => Some(Self::You),
            10 => Some(Self::Xu),
            11 => Some(Self::Hai),
            _ => None,
        }
    }

    /// 从小时获取地支（0-23小时）
    pub fn from_hour(hour: u8) -> Option<Self> {
        match hour {
            23 | 0 => Some(Self::Zi),
            1 | 2 => Some(Self::Chou),
            3 | 4 => Some(Self::Yin),
            5 | 6 => Some(Self::Mao),
            7 | 8 => Some(Self::Chen),
            9 | 10 => Some(Self::Si),
            11 | 12 => Some(Self::Wu),
            13 | 14 => Some(Self::Wei),
            15 | 16 => Some(Self::Shen),
            17 | 18 => Some(Self::You),
            19 | 20 => Some(Self::Xu),
            21 | 22 => Some(Self::Hai),
            _ => None,
        }
    }

    /// 获取地支索引
    pub fn index(&self) -> u8 {
        *self as u8
    }

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

    /// 获取地支五行属性
    pub fn wu_xing(&self) -> WuXing {
        match self {
            Self::Yin | Self::Mao => WuXing::Mu,
            Self::Si | Self::Wu => WuXing::Huo,
            Self::Shen | Self::You => WuXing::Jin,
            Self::Hai | Self::Zi => WuXing::Shui,
            Self::Chen | Self::Xu | Self::Chou | Self::Wei => WuXing::Tu,
        }
    }
}

/// 干支组合
///
/// 用于表示年柱、月柱、日柱、时柱
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct GanZhi {
    pub gan: TianGan,
    pub zhi: DiZhi,
}

impl GanZhi {
    /// 创建新的干支组合
    pub fn new(gan: TianGan, zhi: DiZhi) -> Self {
        Self { gan, zhi }
    }

    /// 从六十甲子序号（0-59）创建干支
    pub fn from_sexagenary(index: u8) -> Option<Self> {
        if index >= 60 {
            return None;
        }
        let gan = TianGan::from_index(index % 10)?;
        let zhi = DiZhi::from_index(index % 12)?;
        Some(Self::new(gan, zhi))
    }

    /// 获取六十甲子序号（0-59）
    pub fn sexagenary_index(&self) -> u8 {
        // 使用通用公式计算六十甲子序号
        let g = self.gan.index() as u16;
        let z = self.zhi.index() as u16;
        // (天干 - 地支) mod 10 配合地支位置
        ((g * 6 + z * 5) % 60) as u8
    }
}

// ==================== 五行 ====================

/// 五行
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum WuXing {
    Jin = 0,   // 金
    Mu = 1,    // 木
    Shui = 2,  // 水
    Huo = 3,   // 火
    Tu = 4,    // 土
}

impl WuXing {
    /// 获取五行名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Jin => "金",
            Self::Mu => "木",
            Self::Shui => "水",
            Self::Huo => "火",
            Self::Tu => "土",
        }
    }

    /// 判断本五行是否生另一五行
    ///
    /// 相生顺序：金生水、水生木、木生火、火生土、土生金
    pub fn generates(&self, other: &WuXing) -> bool {
        matches!(
            (self, other),
            (Self::Jin, Self::Shui)
                | (Self::Shui, Self::Mu)
                | (Self::Mu, Self::Huo)
                | (Self::Huo, Self::Tu)
                | (Self::Tu, Self::Jin)
        )
    }

    /// 判断本五行是否克另一五行
    ///
    /// 相克顺序：金克木、木克土、土克水、水克火、火克金
    pub fn conquers(&self, other: &WuXing) -> bool {
        matches!(
            (self, other),
            (Self::Jin, Self::Mu)
                | (Self::Mu, Self::Tu)
                | (Self::Tu, Self::Shui)
                | (Self::Shui, Self::Huo)
                | (Self::Huo, Self::Jin)
        )
    }
}

// ==================== 九宫 ====================

/// 九宫方位
///
/// 基于洛书九宫，中宫为五，周围八宫按方位分布
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum JiuGong {
    Kan = 1,     // 坎一宫（北方，水）
    Kun = 2,     // 坤二宫（西南，土）
    Zhen = 3,    // 震三宫（东方，木）
    Xun = 4,     // 巽四宫（东南，木）
    Zhong = 5,   // 中五宫（中央，土）
    Qian = 6,    // 乾六宫（西北，金）
    Dui = 7,     // 兑七宫（西方，金）
    Gen = 8,     // 艮八宫（东北，土）
    Li = 9,      // 离九宫（南方，火）
}

impl JiuGong {
    /// 从数字获取九宫（1-9）
    pub fn from_num(num: u8) -> Option<Self> {
        match num {
            1 => Some(Self::Kan),
            2 => Some(Self::Kun),
            3 => Some(Self::Zhen),
            4 => Some(Self::Xun),
            5 => Some(Self::Zhong),
            6 => Some(Self::Qian),
            7 => Some(Self::Dui),
            8 => Some(Self::Gen),
            9 => Some(Self::Li),
            _ => None,
        }
    }

    /// 获取宫位数字
    pub fn num(&self) -> u8 {
        *self as u8
    }

    /// 获取宫位名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Kan => "坎一宫",
            Self::Kun => "坤二宫",
            Self::Zhen => "震三宫",
            Self::Xun => "巽四宫",
            Self::Zhong => "中五宫",
            Self::Qian => "乾六宫",
            Self::Dui => "兑七宫",
            Self::Gen => "艮八宫",
            Self::Li => "离九宫",
        }
    }

    /// 获取宫位五行
    pub fn wu_xing(&self) -> WuXing {
        match self {
            Self::Kan => WuXing::Shui,
            Self::Kun | Self::Zhong | Self::Gen => WuXing::Tu,
            Self::Zhen | Self::Xun => WuXing::Mu,
            Self::Qian | Self::Dui => WuXing::Jin,
            Self::Li => WuXing::Huo,
        }
    }

    /// 获取宫位方向
    pub fn direction(&self) -> &'static str {
        match self {
            Self::Kan => "北",
            Self::Kun => "西南",
            Self::Zhen => "东",
            Self::Xun => "东南",
            Self::Zhong => "中",
            Self::Qian => "西北",
            Self::Dui => "西",
            Self::Gen => "东北",
            Self::Li => "南",
        }
    }

    /// 阳遁顺序下一宫（顺时针）
    ///
    /// 顺序：1→8→3→4→9→2→7→6→1（跳过中宫5）
    pub fn next_yang(&self) -> Self {
        match self {
            Self::Kan => Self::Gen,   // 1→8
            Self::Gen => Self::Zhen,  // 8→3
            Self::Zhen => Self::Xun,  // 3→4
            Self::Xun => Self::Li,    // 4→9
            Self::Li => Self::Kun,    // 9→2
            Self::Kun => Self::Dui,   // 2→7
            Self::Dui => Self::Qian,  // 7→6
            Self::Qian => Self::Kan,  // 6→1
            Self::Zhong => Self::Kun, // 中宫寄坤二宫
        }
    }

    /// 阴遁顺序下一宫（逆时针）
    ///
    /// 顺序：1→6→7→2→9→4→3→8→1（跳过中宫5）
    pub fn next_yin(&self) -> Self {
        match self {
            Self::Kan => Self::Qian,  // 1→6
            Self::Qian => Self::Dui,  // 6→7
            Self::Dui => Self::Kun,   // 7→2
            Self::Kun => Self::Li,    // 2→9
            Self::Li => Self::Xun,    // 9→4
            Self::Xun => Self::Zhen,  // 4→3
            Self::Zhen => Self::Gen,  // 3→8
            Self::Gen => Self::Kan,   // 8→1
            Self::Zhong => Self::Gen, // 中宫寄艮八宫
        }
    }
}

// ==================== 九星 ====================

/// 九星
///
/// 奇门遁甲中的九星，代表天盘
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum JiuXing {
    TianPeng = 1,   // 天蓬星（坎一宫，凶星，水）
    TianRui = 2,    // 天芮星（坤二宫，凶星，土）
    TianChong = 3,  // 天冲星（震三宫，吉星，木）
    TianFu = 4,     // 天辅星（巽四宫，吉星，木）
    TianQin = 5,    // 天禽星（中五宫，吉星，土）
    TianXin = 6,    // 天心星（乾六宫，吉星，金）
    TianZhu = 7,    // 天柱星（兑七宫，凶星，金）
    TianRen = 8,    // 天任星（艮八宫，吉星，土）
    TianYing = 9,   // 天英星（离九宫，凶星，火）
}

impl JiuXing {
    /// 从数字获取九星（1-9）
    pub fn from_num(num: u8) -> Option<Self> {
        match num {
            1 => Some(Self::TianPeng),
            2 => Some(Self::TianRui),
            3 => Some(Self::TianChong),
            4 => Some(Self::TianFu),
            5 => Some(Self::TianQin),
            6 => Some(Self::TianXin),
            7 => Some(Self::TianZhu),
            8 => Some(Self::TianRen),
            9 => Some(Self::TianYing),
            _ => None,
        }
    }

    /// 获取星序号
    pub fn num(&self) -> u8 {
        *self as u8
    }

    /// 获取星名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::TianPeng => "天蓬",
            Self::TianRui => "天芮",
            Self::TianChong => "天冲",
            Self::TianFu => "天辅",
            Self::TianQin => "天禽",
            Self::TianXin => "天心",
            Self::TianZhu => "天柱",
            Self::TianRen => "天任",
            Self::TianYing => "天英",
        }
    }

    /// 判断是否为吉星
    pub fn is_auspicious(&self) -> bool {
        matches!(
            self,
            Self::TianChong | Self::TianFu | Self::TianQin | Self::TianXin | Self::TianRen
        )
    }

    /// 获取星的五行
    pub fn wu_xing(&self) -> WuXing {
        match self {
            Self::TianPeng => WuXing::Shui,
            Self::TianRui | Self::TianQin | Self::TianRen => WuXing::Tu,
            Self::TianChong | Self::TianFu => WuXing::Mu,
            Self::TianXin | Self::TianZhu => WuXing::Jin,
            Self::TianYing => WuXing::Huo,
        }
    }

    /// 获取星的原始宫位
    pub fn original_palace(&self) -> JiuGong {
        match self {
            Self::TianPeng => JiuGong::Kan,
            Self::TianRui => JiuGong::Kun,
            Self::TianChong => JiuGong::Zhen,
            Self::TianFu => JiuGong::Xun,
            Self::TianQin => JiuGong::Zhong,
            Self::TianXin => JiuGong::Qian,
            Self::TianZhu => JiuGong::Dui,
            Self::TianRen => JiuGong::Gen,
            Self::TianYing => JiuGong::Li,
        }
    }
}

// ==================== 八门 ====================

/// 八门
///
/// 奇门遁甲中的八门，代表人盘（人事活动方面）
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum BaMen {
    Xiu = 1,    // 休门（坎一宫，吉门，水）
    Si = 2,     // 死门（坤二宫，凶门，土）
    Shang = 3,  // 伤门（震三宫，凶门，木）
    Du = 4,     // 杜门（巽四宫，凶门，木）
    Jing = 5,   // 景门（离九宫，中平，火）
    Kai = 6,    // 开门（乾六宫，大吉，金）
    Jing2 = 7,  // 惊门（兑七宫，凶门，金）
    Sheng = 8,  // 生门（艮八宫，大吉，土）
}

impl BaMen {
    /// 从数字获取八门（1-8）
    pub fn from_num(num: u8) -> Option<Self> {
        match num {
            1 => Some(Self::Xiu),
            2 => Some(Self::Si),
            3 => Some(Self::Shang),
            4 => Some(Self::Du),
            5 => Some(Self::Jing),
            6 => Some(Self::Kai),
            7 => Some(Self::Jing2),
            8 => Some(Self::Sheng),
            _ => None,
        }
    }

    /// 获取门序号
    pub fn num(&self) -> u8 {
        *self as u8
    }

    /// 获取门名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Xiu => "休门",
            Self::Si => "死门",
            Self::Shang => "伤门",
            Self::Du => "杜门",
            Self::Jing => "景门",
            Self::Kai => "开门",
            Self::Jing2 => "惊门",
            Self::Sheng => "生门",
        }
    }

    /// 判断是否为吉门
    pub fn is_auspicious(&self) -> bool {
        matches!(self, Self::Xiu | Self::Kai | Self::Sheng | Self::Jing)
    }

    /// 获取门的五行
    pub fn wu_xing(&self) -> WuXing {
        match self {
            Self::Xiu => WuXing::Shui,
            Self::Si | Self::Sheng => WuXing::Tu,
            Self::Shang | Self::Du => WuXing::Mu,
            Self::Kai | Self::Jing2 => WuXing::Jin,
            Self::Jing => WuXing::Huo,
        }
    }

    /// 获取门的原始宫位
    pub fn original_palace(&self) -> JiuGong {
        match self {
            Self::Xiu => JiuGong::Kan,
            Self::Si => JiuGong::Kun,
            Self::Shang => JiuGong::Zhen,
            Self::Du => JiuGong::Xun,
            Self::Jing => JiuGong::Li,
            Self::Kai => JiuGong::Qian,
            Self::Jing2 => JiuGong::Dui,
            Self::Sheng => JiuGong::Gen,
        }
    }
}

// ==================== 八神 ====================

/// 八神
///
/// 奇门遁甲中的八神，代表神盘（天时神煞）
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum BaShen {
    ZhiFu = 1,    // 值符（吉神，统领诸神）
    TengShe = 2,  // 腾蛇（凶神，惊恐怪异）
    TaiYin = 3,   // 太阴（吉神，阴私暗昧）
    LiuHe = 4,    // 六合（吉神，婚姻交易）
    BaiHu = 5,    // 白虎（凶神，凶丧血光）
    XuanWu = 6,   // 玄武（凶神，盗贼小人）
    JiuDi = 7,    // 九地（吉神，安静隐伏）
    JiuTian = 8,  // 九天（吉神，远行高举）
}

impl BaShen {
    /// 从数字获取八神（1-8）
    pub fn from_num(num: u8) -> Option<Self> {
        match num {
            1 => Some(Self::ZhiFu),
            2 => Some(Self::TengShe),
            3 => Some(Self::TaiYin),
            4 => Some(Self::LiuHe),
            5 => Some(Self::BaiHu),
            6 => Some(Self::XuanWu),
            7 => Some(Self::JiuDi),
            8 => Some(Self::JiuTian),
            _ => None,
        }
    }

    /// 获取神序号
    pub fn num(&self) -> u8 {
        *self as u8
    }

    /// 获取神名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::ZhiFu => "值符",
            Self::TengShe => "腾蛇",
            Self::TaiYin => "太阴",
            Self::LiuHe => "六合",
            Self::BaiHu => "白虎",
            Self::XuanWu => "玄武",
            Self::JiuDi => "九地",
            Self::JiuTian => "九天",
        }
    }

    /// 判断是否为吉神
    pub fn is_auspicious(&self) -> bool {
        matches!(
            self,
            Self::ZhiFu | Self::TaiYin | Self::LiuHe | Self::JiuDi | Self::JiuTian
        )
    }
}

// ==================== 节气与阴阳遁 ====================

/// 二十四节气
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[repr(u8)]
pub enum JieQi {
    DongZhi = 0,    // 冬至（阳遁一局起）
    XiaoHan = 1,    // 小寒
    DaHan = 2,      // 大寒
    LiChun = 3,     // 立春
    YuShui = 4,     // 雨水
    JingZhe = 5,    // 惊蛰
    ChunFen = 6,    // 春分
    QingMing = 7,   // 清明
    GuYu = 8,       // 谷雨
    LiXia = 9,      // 立夏
    XiaoMan = 10,   // 小满
    MangZhong = 11, // 芒种
    XiaZhi = 12,    // 夏至（阴遁九局起）
    XiaoShu = 13,   // 小暑
    DaShu = 14,     // 大暑
    LiQiu = 15,     // 立秋
    ChuShu = 16,    // 处暑
    BaiLu = 17,     // 白露
    QiuFen = 18,    // 秋分
    HanLu = 19,     // 寒露
    ShuangJiang = 20, // 霜降
    LiDong = 21,    // 立冬
    XiaoXue = 22,   // 小雪
    DaXue = 23,     // 大雪
}

impl JieQi {
    /// 从数字获取节气（0-23）
    pub fn from_index(index: u8) -> Option<Self> {
        match index {
            0 => Some(Self::DongZhi),
            1 => Some(Self::XiaoHan),
            2 => Some(Self::DaHan),
            3 => Some(Self::LiChun),
            4 => Some(Self::YuShui),
            5 => Some(Self::JingZhe),
            6 => Some(Self::ChunFen),
            7 => Some(Self::QingMing),
            8 => Some(Self::GuYu),
            9 => Some(Self::LiXia),
            10 => Some(Self::XiaoMan),
            11 => Some(Self::MangZhong),
            12 => Some(Self::XiaZhi),
            13 => Some(Self::XiaoShu),
            14 => Some(Self::DaShu),
            15 => Some(Self::LiQiu),
            16 => Some(Self::ChuShu),
            17 => Some(Self::BaiLu),
            18 => Some(Self::QiuFen),
            19 => Some(Self::HanLu),
            20 => Some(Self::ShuangJiang),
            21 => Some(Self::LiDong),
            22 => Some(Self::XiaoXue),
            23 => Some(Self::DaXue),
            _ => None,
        }
    }

    /// 获取节气名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::DongZhi => "冬至",
            Self::XiaoHan => "小寒",
            Self::DaHan => "大寒",
            Self::LiChun => "立春",
            Self::YuShui => "雨水",
            Self::JingZhe => "惊蛰",
            Self::ChunFen => "春分",
            Self::QingMing => "清明",
            Self::GuYu => "谷雨",
            Self::LiXia => "立夏",
            Self::XiaoMan => "小满",
            Self::MangZhong => "芒种",
            Self::XiaZhi => "夏至",
            Self::XiaoShu => "小暑",
            Self::DaShu => "大暑",
            Self::LiQiu => "立秋",
            Self::ChuShu => "处暑",
            Self::BaiLu => "白露",
            Self::QiuFen => "秋分",
            Self::HanLu => "寒露",
            Self::ShuangJiang => "霜降",
            Self::LiDong => "立冬",
            Self::XiaoXue => "小雪",
            Self::DaXue => "大雪",
        }
    }

    /// 判断是否为阳遁（冬至到夏至前）
    pub fn is_yang_dun(&self) -> bool {
        let index = *self as u8;
        index < 12 // 0-11是阳遁
    }
}

/// 阴阳遁类型
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen)]
pub enum DunType {
    #[default]
    Yang, // 阳遁（冬至后，顺行）
    Yin,  // 阴遁（夏至后，逆行）
}

impl DunType {
    /// 获取遁名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Yang => "阳遁",
            Self::Yin => "阴遁",
        }
    }
}

/// 三元（上元、中元、下元）
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum SanYuan {
    Shang, // 上元（每节气第1-5天）
    Zhong, // 中元（每节气第6-10天）
    Xia,   // 下元（每节气第11-15天）
}

impl SanYuan {
    /// 获取元名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Shang => "上元",
            Self::Zhong => "中元",
            Self::Xia => "下元",
        }
    }
}

// ==================== 起卦方式 ====================

/// 起卦方式
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum DivinationMethod {
    /// 时间起局：根据排盘时间自动计算
    ByTime,
    /// 数字起局：根据用户输入数字
    ByNumbers,
    /// 随机起局：使用链上随机数
    Random,
    /// 手动指定：直接指定局数
    Manual,
}

impl DivinationMethod {
    /// 获取方式名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::ByTime => "时间起局",
            Self::ByNumbers => "数字起局",
            Self::Random => "随机起局",
            Self::Manual => "手动指定",
        }
    }
}

// ==================== 单宫信息 ====================

/// 单宫完整信息
///
/// 包含天盘、地盘、人盘、神盘的所有信息
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct Palace {
    /// 宫位
    pub gong: JiuGong,
    /// 天盘干（奇仪）
    pub tian_pan_gan: TianGan,
    /// 地盘干（奇仪）
    pub di_pan_gan: TianGan,
    /// 九星
    pub xing: JiuXing,
    /// 八门
    pub men: Option<BaMen>,  // 中宫无门
    /// 八神
    pub shen: Option<BaShen>, // 中宫无神
    /// 是否为旬空
    pub is_xun_kong: bool,
    /// 是否为马星
    pub is_ma_xing: bool,
}

impl Palace {
    /// 创建空宫位（用于初始化）
    pub fn empty(gong: JiuGong) -> Self {
        Self {
            gong,
            tian_pan_gan: TianGan::Jia,
            di_pan_gan: TianGan::Jia,
            xing: JiuXing::TianQin,
            men: None,
            shen: None,
            is_xun_kong: false,
            is_ma_xing: false,
        }
    }

    /// 判断是否伏吟（天盘干等于地盘干）
    pub fn is_fu_yin(&self) -> bool {
        self.tian_pan_gan == self.di_pan_gan
    }

    /// 判断是否反吟（天盘干与地盘干对冲）
    pub fn is_fan_yin(&self) -> bool {
        // 天干没有直接对冲，此处简化为相克
        self.tian_pan_gan.wu_xing().conquers(&self.di_pan_gan.wu_xing())
    }
}

// ==================== 完整排盘结果 ====================

/// 奇门遁甲完整排盘结果
#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct QimenChart<AccountId, BlockNumber, MaxCidLen: frame_support::traits::Get<u32>> {
    /// 排盘 ID
    pub id: u64,
    /// 排盘者账户
    pub diviner: AccountId,
    /// 起局方式
    pub method: DivinationMethod,
    /// 年柱
    pub year_ganzhi: GanZhi,
    /// 月柱
    pub month_ganzhi: GanZhi,
    /// 日柱
    pub day_ganzhi: GanZhi,
    /// 时柱
    pub hour_ganzhi: GanZhi,
    /// 节气
    pub jie_qi: JieQi,
    /// 阴阳遁
    pub dun_type: DunType,
    /// 三元
    pub san_yuan: SanYuan,
    /// 局数（1-9）
    pub ju_number: u8,
    /// 值符星
    pub zhi_fu_xing: JiuXing,
    /// 值使门
    pub zhi_shi_men: BaMen,
    /// 九宫排盘结果
    pub palaces: [Palace; 9],
    /// 排盘时间戳（秒）
    pub timestamp: u64,
    /// 创建区块号
    pub block_number: BlockNumber,
    /// AI 解读 IPFS CID（可选）
    pub interpretation_cid: Option<BoundedVec<u8, MaxCidLen>>,
    /// 是否公开
    pub is_public: bool,
    /// 问题哈希（隐私保护）
    pub question_hash: [u8; 32],
}

/// 用户统计信息
#[derive(Clone, Debug, Default, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct UserStats {
    /// 总排盘次数
    pub total_charts: u64,
    /// 阳遁次数
    pub yang_dun_count: u64,
    /// 阴遁次数
    pub yin_dun_count: u64,
    /// 获得吉门次数
    pub lucky_door_count: u64,
    /// 获得吉星次数
    pub lucky_star_count: u64,
}

impl UserStats {
    /// 更新统计数据
    ///
    /// # 参数
    /// - `dun_type`: 阴阳遁类型
    /// - `zhi_fu_xing`: 值符星
    /// - `zhi_shi_men`: 值使门
    pub fn update_from_chart(
        &mut self,
        dun_type: DunType,
        zhi_fu_xing: JiuXing,
        zhi_shi_men: BaMen,
    ) {
        self.total_charts = self.total_charts.saturating_add(1);

        match dun_type {
            DunType::Yang => self.yang_dun_count = self.yang_dun_count.saturating_add(1),
            DunType::Yin => self.yin_dun_count = self.yin_dun_count.saturating_add(1),
        }

        if zhi_shi_men.is_auspicious() {
            self.lucky_door_count = self.lucky_door_count.saturating_add(1);
        }

        if zhi_fu_xing.is_auspicious() {
            self.lucky_star_count = self.lucky_star_count.saturating_add(1);
        }
    }
}
