//! 梅花易数 - 基础数据类型定义
//!
//! 本模块定义了梅花易数排盘系统所需的所有核心数据结构，包括：
//! - 八卦枚举 (Bagua)
//! - 五行枚举 (WuXing)
//! - 体用关系 (TiYongRelation)
//! - 起卦方式 (DivinationMethod)
//! - 单卦结构 (SingleGua)
//! - 六十四卦结构 (Hexagram)
//! - 完整卦象 (FullDivination)

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_std::prelude::*;

/// 八卦枚举 - 先天八卦数序
///
/// 先天八卦数：乾一、兑二、离三、震四、巽五、坎六、艮七、坤八
/// 二进制表示：乾(111)、兑(011)、离(101)、震(001)、巽(110)、坎(010)、艮(100)、坤(000)
#[derive(Clone, Copy, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum Bagua {
    /// 乾卦 ☰ - 先天数1，二进制111，五行金，象天
    Qian = 1,
    /// 兑卦 ☱ - 先天数2，二进制011，五行金，象泽
    Dui = 2,
    /// 离卦 ☲ - 先天数3，二进制101，五行火，象火
    Li = 3,
    /// 震卦 ☳ - 先天数4，二进制001，五行木，象雷
    Zhen = 4,
    /// 巽卦 ☴ - 先天数5，二进制110，五行木，象风
    Xun = 5,
    /// 坎卦 ☵ - 先天数6，二进制010，五行水，象水
    Kan = 6,
    /// 艮卦 ☶ - 先天数7，二进制100，五行土，象山
    Gen = 7,
    /// 坤卦 ☷ - 先天数8(或0)，二进制000，五行土，象地
    #[default]
    Kun = 8,
}

impl Bagua {
    /// 从先天八卦数创建八卦（1-8，0和8都对应坤卦）
    ///
    /// # 参数
    /// - `num`: 先天八卦数 (1-8)
    ///
    /// # 返回
    /// - 对应的八卦枚举值
    pub fn from_num(num: u8) -> Self {
        match num % 8 {
            1 => Bagua::Qian,
            2 => Bagua::Dui,
            3 => Bagua::Li,
            4 => Bagua::Zhen,
            5 => Bagua::Xun,
            6 => Bagua::Kan,
            7 => Bagua::Gen,
            _ => Bagua::Kun, // 0 或 8
        }
    }

    /// 获取二进制表示 (3 bits)
    ///
    /// 从下到上：初爻、二爻、三爻
    pub fn binary(&self) -> u8 {
        match self {
            Bagua::Qian => 0b111, // 乾 ☰ 三阳爻
            Bagua::Dui => 0b011,  // 兑 ☱ 上阴下阳
            Bagua::Li => 0b101,   // 离 ☲ 中阴上下阳
            Bagua::Zhen => 0b001, // 震 ☳ 下阳上阴
            Bagua::Xun => 0b110,  // 巽 ☴ 下阴上阳
            Bagua::Kan => 0b010,  // 坎 ☵ 中阳上下阴
            Bagua::Gen => 0b100,  // 艮 ☶ 上阳下阴
            Bagua::Kun => 0b000,  // 坤 ☷ 三阴爻
        }
    }

    /// 从二进制创建八卦
    ///
    /// # 参数
    /// - `binary`: 3位二进制数
    pub fn from_binary(binary: u8) -> Self {
        match binary & 0b111 {
            0b111 => Bagua::Qian,
            0b011 => Bagua::Dui,
            0b101 => Bagua::Li,
            0b001 => Bagua::Zhen,
            0b110 => Bagua::Xun,
            0b010 => Bagua::Kan,
            0b100 => Bagua::Gen,
            _ => Bagua::Kun,
        }
    }

    /// 获取五行属性
    pub fn wuxing(&self) -> WuXing {
        match self {
            Bagua::Qian | Bagua::Dui => WuXing::Jin,  // 乾兑属金
            Bagua::Zhen | Bagua::Xun => WuXing::Mu,   // 震巽属木
            Bagua::Kan => WuXing::Shui,               // 坎属水
            Bagua::Li => WuXing::Huo,                 // 离属火
            Bagua::Gen | Bagua::Kun => WuXing::Tu,    // 艮坤属土
        }
    }

    /// 获取先天八卦数 (1-8)
    pub fn number(&self) -> u8 {
        match self {
            Bagua::Qian => 1,
            Bagua::Dui => 2,
            Bagua::Li => 3,
            Bagua::Zhen => 4,
            Bagua::Xun => 5,
            Bagua::Kan => 6,
            Bagua::Gen => 7,
            Bagua::Kun => 8,
        }
    }
}

/// 五行枚举
///
/// 五行相生：金生水、水生木、木生火、火生土、土生金
/// 五行相克：金克木、木克土、土克水、水克火、火克金
#[derive(Clone, Copy, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum WuXing {
    /// 金 - 西方，秋季，白色
    Jin = 0,
    /// 木 - 东方，春季，青色
    Mu = 1,
    /// 水 - 北方，冬季，黑色
    Shui = 2,
    /// 火 - 南方，夏季，红色
    Huo = 3,
    /// 土 - 中央，四季末，黄色
    #[default]
    Tu = 4,
}

impl WuXing {
    /// 判断此五行是否生另一五行
    ///
    /// 相生关系：金→水→木→火→土→金
    pub fn generates(&self, other: &WuXing) -> bool {
        matches!(
            (self, other),
            (WuXing::Jin, WuXing::Shui) |
            (WuXing::Shui, WuXing::Mu) |
            (WuXing::Mu, WuXing::Huo) |
            (WuXing::Huo, WuXing::Tu) |
            (WuXing::Tu, WuXing::Jin)
        )
    }

    /// 判断此五行是否克另一五行
    ///
    /// 相克关系：金→木→土→水→火→金
    pub fn conquers(&self, other: &WuXing) -> bool {
        matches!(
            (self, other),
            (WuXing::Jin, WuXing::Mu) |
            (WuXing::Mu, WuXing::Tu) |
            (WuXing::Tu, WuXing::Shui) |
            (WuXing::Shui, WuXing::Huo) |
            (WuXing::Huo, WuXing::Jin)
        )
    }
}

/// 体用关系枚举
///
/// 梅花易数核心概念：体卦代表自身，用卦代表所占之事
/// 吉凶判断：用生体大吉、比和次吉、体克用中平、体生用小凶、用克体大凶
#[derive(Clone, Copy, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum TiYongRelation {
    /// 比和 - 体用五行相同，次吉
    #[default]
    BiHe = 0,
    /// 用生体 - 用卦五行生体卦五行，大吉
    YongShengTi = 1,
    /// 体生用 - 体卦五行生用卦五行，小凶（泄气）
    TiShengYong = 2,
    /// 用克体 - 用卦五行克体卦五行，大凶
    YongKeTi = 3,
    /// 体克用 - 体卦五行克用卦五行，中平（需耗力）
    TiKeYong = 4,
}

impl TiYongRelation {
    /// 计算体用关系
    ///
    /// # 参数
    /// - `ti`: 体卦五行
    /// - `yong`: 用卦五行
    pub fn calculate(ti: &WuXing, yong: &WuXing) -> Self {
        if ti == yong {
            TiYongRelation::BiHe
        } else if yong.generates(ti) {
            TiYongRelation::YongShengTi
        } else if ti.generates(yong) {
            TiYongRelation::TiShengYong
        } else if yong.conquers(ti) {
            TiYongRelation::YongKeTi
        } else if ti.conquers(yong) {
            TiYongRelation::TiKeYong
        } else {
            TiYongRelation::BiHe // fallback
        }
    }

    /// 获取吉凶等级 (0-4, 4最吉)
    pub fn fortune_level(&self) -> u8 {
        match self {
            TiYongRelation::YongShengTi => 4, // 大吉
            TiYongRelation::BiHe => 3,        // 次吉
            TiYongRelation::TiKeYong => 2,    // 中平
            TiYongRelation::TiShengYong => 1, // 小凶
            TiYongRelation::YongKeTi => 0,    // 大凶
        }
    }
}

/// 起卦方式枚举
///
/// 梅花易数支持多种起卦方式，每种方式都有其独特的计算规则
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum DivinationMethod {
    /// 时间起卦 - 使用农历年月日时起卦
    /// 上卦：(年支数+月数+日数) % 8
    /// 下卦：(年支数+月数+日数+时支数) % 8
    /// 动爻：(年支数+月数+日数+时支数) % 6
    #[default]
    DateTime = 0,
    /// 双数起卦 - 使用两个数字起卦
    /// 上卦：第一个数 % 8
    /// 下卦：第二个数 % 8
    /// 动爻：(两数之和+时支数) % 6
    TwoNumbers = 1,
    /// 随机起卦 - 使用链上随机数
    Random = 2,
    /// 手动指定 - 直接指定上卦、下卦、动爻
    Manual = 3,
}

/// 吉凶判断结果
#[derive(Clone, Copy, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum Fortune {
    /// 大吉 - 用生体
    DaJi = 4,
    /// 小吉 - 比和
    XiaoJi = 3,
    /// 平 - 体克用
    #[default]
    Ping = 2,
    /// 小凶 - 体生用
    XiaoXiong = 1,
    /// 大凶 - 用克体
    DaXiong = 0,
}

impl Fortune {
    /// 从体用关系综合评分计算吉凶
    ///
    /// # 参数
    /// - `ben_relation`: 本卦体用关系
    /// - `bian_relation`: 变卦体用关系（可选）
    pub fn from_relations(
        ben_relation: &TiYongRelation,
        bian_relation: Option<&TiYongRelation>,
    ) -> Self {
        let ben_score = ben_relation.fortune_level();
        let bian_score = bian_relation.map(|r| r.fortune_level()).unwrap_or(2);

        // 综合评分 = 本卦评分 * 0.6 + 变卦评分 * 0.4
        // 简化为整数运算：(本卦 * 3 + 变卦 * 2) / 5
        let total = (ben_score as u16 * 3 + bian_score as u16 * 2) / 5;

        match total {
            4 => Fortune::DaJi,
            3 => Fortune::XiaoJi,
            2 => Fortune::Ping,
            1 => Fortune::XiaoXiong,
            _ => Fortune::DaXiong,
        }
    }
}

/// 单卦结构（优化版）
///
/// 存储优化说明：
/// - 仅存储 Bagua 枚举值（1 byte）
/// - 所有其他属性（五行、二进制、名称等）均可从 Bagua 推导
/// - 一次完整排盘可节省约 200+ bytes
#[derive(Clone, Copy, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub struct SingleGua {
    /// 八卦类型
    pub bagua: Bagua,
}

impl SingleGua {
    /// 从八卦枚举创建单卦
    pub fn new(bagua: Bagua) -> Self {
        Self { bagua }
    }

    /// 从先天八卦数创建单卦（1-8，0和8都对应坤卦）
    pub fn from_num(num: u8) -> Self {
        Self {
            bagua: Bagua::from_num(num),
        }
    }

    /// 从二进制创建单卦
    pub fn from_binary(binary: u8) -> Self {
        Self {
            bagua: Bagua::from_binary(binary),
        }
    }

    /// 获取二进制表示
    pub fn binary(&self) -> u8 {
        self.bagua.binary()
    }

    /// 获取五行属性
    pub fn wuxing(&self) -> WuXing {
        self.bagua.wuxing()
    }

    /// 获取先天八卦数
    pub fn number(&self) -> u8 {
        self.bagua.number()
    }
}

/// 六十四卦结构
///
/// 表示一个完整的六爻卦象，包含上卦、下卦、动爻等核心信息
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(T))]
pub struct Hexagram<AccountId, BlockNumber> {
    /// 卦象唯一ID
    pub id: u64,
    /// 占卜者账户
    pub diviner: AccountId,
    /// 上卦（外卦）
    pub shang_gua: SingleGua,
    /// 下卦（内卦）
    pub xia_gua: SingleGua,
    /// 动爻位置 (1-6)，1为初爻，6为上爻
    pub dong_yao: u8,
    /// 体卦位置：true=上卦为体，false=下卦为体
    /// 规则：动爻在哪卦，哪卦为用，另一卦为体
    pub ti_is_shang: bool,
    /// 占卜问题的哈希值（隐私保护，不存储原文）
    pub question_hash: [u8; 32],
    /// 起卦方式
    pub method: DivinationMethod,
    /// 起卦时的区块号
    pub block_number: BlockNumber,
    /// 起卦时间戳（Unix时间戳，秒）
    pub timestamp: u64,
    /// AI 解读结果的 IPFS CID（可选）
    pub interpretation_cid: Option<BoundedVec<u8, ConstU32<64>>>,
    /// 是否公开（公开的卦象可被其他人查看）
    pub is_public: bool,
}

impl<AccountId, BlockNumber> Hexagram<AccountId, BlockNumber> {
    /// 获取六爻的完整二进制表示 (6 bits)
    ///
    /// 从下到上依次为：初爻、二爻、三爻、四爻、五爻、上爻
    /// 上卦占高3位，下卦占低3位
    pub fn full_binary(&self) -> u8 {
        (self.shang_gua.binary() << 3) | self.xia_gua.binary()
    }

    /// 获取六十四卦索引 (0-63)
    ///
    /// 用于查表获取卦名、卦辞等
    /// 索引计算：(上卦先天数-1) * 8 + (下卦先天数-1)
    pub fn hexagram_index(&self) -> u8 {
        let shang_num = self.shang_gua.number();
        let xia_num = self.xia_gua.number();
        // 转换为0-7范围
        let shang_idx = if shang_num == 8 { 0 } else { shang_num };
        let xia_idx = if xia_num == 8 { 0 } else { xia_num };
        shang_idx * 8 + xia_idx - 9 // 调整为0-63范围
    }

    /// 获取体卦
    pub fn ti_gua(&self) -> &SingleGua {
        if self.ti_is_shang {
            &self.shang_gua
        } else {
            &self.xia_gua
        }
    }

    /// 获取用卦
    pub fn yong_gua(&self) -> &SingleGua {
        if self.ti_is_shang {
            &self.xia_gua
        } else {
            &self.shang_gua
        }
    }

    /// 计算本卦的体用关系
    pub fn calc_relation(&self) -> TiYongRelation {
        TiYongRelation::calculate(&self.ti_gua().wuxing(), &self.yong_gua().wuxing())
    }
}

/// 完整卦象结构（含本卦、变卦、互卦）
///
/// 包含梅花易数排盘的完整信息
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(T))]
pub struct FullDivination<AccountId, BlockNumber> {
    /// 本卦 - 原始起卦结果
    pub ben_gua: Hexagram<AccountId, BlockNumber>,
    /// 变卦 - 动爻变化后的卦象 (上卦, 下卦)
    pub bian_gua: (SingleGua, SingleGua),
    /// 互卦 - 本卦234爻为下卦、345爻为上卦 (上卦, 下卦)
    pub hu_gua: (SingleGua, SingleGua),
    /// 本卦体用关系
    pub ben_gua_relation: TiYongRelation,
    /// 变卦体用关系
    pub bian_gua_relation: TiYongRelation,
    /// 综合吉凶判断
    pub fortune: Fortune,
}

impl<AccountId: Clone, BlockNumber: Clone> FullDivination<AccountId, BlockNumber> {
    /// 从本卦创建完整卦象
    ///
    /// 自动计算变卦、互卦、体用关系和吉凶
    pub fn from_hexagram(ben_gua: Hexagram<AccountId, BlockNumber>) -> Self {
        // 计算变卦
        let bian_gua = Self::calc_bian_gua(&ben_gua.shang_gua, &ben_gua.xia_gua, ben_gua.dong_yao);

        // 计算互卦
        let hu_gua = Self::calc_hu_gua(&ben_gua.shang_gua, &ben_gua.xia_gua);

        // 计算体用关系
        let ben_gua_relation = ben_gua.calc_relation();

        // 变卦的体用关系（体卦位置不变）
        let bian_ti_wuxing = if ben_gua.ti_is_shang {
            bian_gua.0.wuxing()
        } else {
            bian_gua.1.wuxing()
        };
        let bian_yong_wuxing = if ben_gua.ti_is_shang {
            bian_gua.1.wuxing()
        } else {
            bian_gua.0.wuxing()
        };
        let bian_gua_relation = TiYongRelation::calculate(&bian_ti_wuxing, &bian_yong_wuxing);

        // 综合吉凶判断
        let fortune = Fortune::from_relations(&ben_gua_relation, Some(&bian_gua_relation));

        Self {
            ben_gua,
            bian_gua,
            hu_gua,
            ben_gua_relation,
            bian_gua_relation,
            fortune,
        }
    }

    /// 计算变卦
    ///
    /// 变卦规则：动爻阴阳互变
    /// - 动爻1-3在下卦，下卦对应爻变
    /// - 动爻4-6在上卦，上卦对应爻变
    fn calc_bian_gua(
        shang_gua: &SingleGua,
        xia_gua: &SingleGua,
        dong_yao: u8,
    ) -> (SingleGua, SingleGua) {
        // 组合6爻二进制：上卦占高3位，下卦占低3位
        let full_binary = (shang_gua.binary() << 3) | xia_gua.binary();

        // 翻转动爻位（dong_yao: 1-6 对应 bit 0-5）
        let bit_position = dong_yao - 1;
        let flipped = full_binary ^ (1 << bit_position);

        // 分离上下卦
        let new_shang_binary = (flipped >> 3) & 0b111;
        let new_xia_binary = flipped & 0b111;

        (
            SingleGua::from_binary(new_shang_binary),
            SingleGua::from_binary(new_xia_binary),
        )
    }

    /// 计算互卦
    ///
    /// 互卦规则：
    /// - 互卦上卦：本卦第3、4、5爻
    /// - 互卦下卦：本卦第2、3、4爻
    fn calc_hu_gua(shang_gua: &SingleGua, xia_gua: &SingleGua) -> (SingleGua, SingleGua) {
        // 组合6爻：bits 5-3 为上卦，bits 2-0 为下卦
        let full_binary = (shang_gua.binary() << 3) | xia_gua.binary();

        // 互卦上卦：取本卦第5、4、3爻 (bits 4, 3, 2)
        let hu_shang = (full_binary >> 2) & 0b111;

        // 互卦下卦：取本卦第4、3、2爻 (bits 3, 2, 1)
        let hu_xia = (full_binary >> 1) & 0b111;

        (
            SingleGua::from_binary(hu_shang),
            SingleGua::from_binary(hu_xia),
        )
    }
}

/// 起卦参数结构
///
/// 用于传递起卦所需的参数
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct DivinationParams {
    /// 起卦方式
    pub method: DivinationMethod,
    /// 第一个数字（用于双数起卦）
    pub num1: Option<u16>,
    /// 第二个数字（用于双数起卦）
    pub num2: Option<u16>,
    /// 手动指定的上卦数（1-8）
    pub manual_shang: Option<u8>,
    /// 手动指定的下卦数（1-8）
    pub manual_xia: Option<u8>,
    /// 手动指定的动爻（1-6）
    pub manual_dong_yao: Option<u8>,
    /// 问题哈希
    pub question_hash: [u8; 32],
    /// 是否公开
    pub is_public: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bagua_from_num() {
        assert_eq!(Bagua::from_num(1), Bagua::Qian);
        assert_eq!(Bagua::from_num(2), Bagua::Dui);
        assert_eq!(Bagua::from_num(8), Bagua::Kun);
        assert_eq!(Bagua::from_num(0), Bagua::Kun);
        assert_eq!(Bagua::from_num(9), Bagua::Qian); // 9 % 8 = 1
    }

    #[test]
    fn test_bagua_binary() {
        assert_eq!(Bagua::Qian.binary(), 0b111);
        assert_eq!(Bagua::Kun.binary(), 0b000);
        assert_eq!(Bagua::Kan.binary(), 0b010);
        assert_eq!(Bagua::Li.binary(), 0b101);
    }

    #[test]
    fn test_bagua_wuxing() {
        assert_eq!(Bagua::Qian.wuxing(), WuXing::Jin);
        assert_eq!(Bagua::Dui.wuxing(), WuXing::Jin);
        assert_eq!(Bagua::Zhen.wuxing(), WuXing::Mu);
        assert_eq!(Bagua::Kan.wuxing(), WuXing::Shui);
        assert_eq!(Bagua::Li.wuxing(), WuXing::Huo);
        assert_eq!(Bagua::Kun.wuxing(), WuXing::Tu);
    }

    #[test]
    fn test_wuxing_relations() {
        // 金生水
        assert!(WuXing::Jin.generates(&WuXing::Shui));
        // 金克木
        assert!(WuXing::Jin.conquers(&WuXing::Mu));
        // 水生木
        assert!(WuXing::Shui.generates(&WuXing::Mu));
    }

    #[test]
    fn test_tiyong_relation() {
        // 用生体 - 大吉
        assert_eq!(
            TiYongRelation::calculate(&WuXing::Shui, &WuXing::Jin),
            TiYongRelation::YongShengTi
        );
        // 比和 - 次吉
        assert_eq!(
            TiYongRelation::calculate(&WuXing::Jin, &WuXing::Jin),
            TiYongRelation::BiHe
        );
        // 用克体 - 大凶
        assert_eq!(
            TiYongRelation::calculate(&WuXing::Mu, &WuXing::Jin),
            TiYongRelation::YongKeTi
        );
    }
}
