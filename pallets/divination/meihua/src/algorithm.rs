//! 梅花易数核心算法模块
//!
//! 本模块实现梅花易数排盘的核心计算逻辑，包括：
//! - 卦数计算（上卦、下卦、动爻）
//! - 变卦计算
//! - 互卦计算
//! - 错卦、综卦计算
//! - 体用判断
//! - 吉凶判断

use crate::lunar::LunarDate;
use crate::types::*;

/// 计算卦数（处理余数为0的情况）
///
/// 梅花易数规则：除8取余，余数为0时按8计
///
/// # 参数
/// - `n`: 待计算的数值
///
/// # 返回
/// - 卦数（1-8）
#[inline]
pub fn calc_gua_num(n: u32) -> u8 {
    let r = (n % 8) as u8;
    if r == 0 {
        8
    } else {
        r
    }
}

/// 计算动爻数（处理余数为0的情况）
///
/// 梅花易数规则：除6取余，余数为0时按6计
///
/// # 参数
/// - `n`: 待计算的数值
///
/// # 返回
/// - 动爻数（1-6）
#[inline]
pub fn calc_dong_yao(n: u32) -> u8 {
    let r = (n % 6) as u8;
    if r == 0 {
        6
    } else {
        r
    }
}

/// 时间起卦算法
///
/// 使用农历年月日时计算上卦、下卦、动爻
///
/// # 算法
/// - 上卦数 = (年支数 + 月数 + 日数) % 8
/// - 下卦数 = (年支数 + 月数 + 日数 + 时支数) % 8
/// - 动爻数 = (年支数 + 月数 + 日数 + 时支数) % 6
///
/// # 参数
/// - `lunar`: 农历日期
///
/// # 返回
/// - (上卦数, 下卦数, 动爻数)
pub fn divine_by_datetime(lunar: &LunarDate) -> (u8, u8, u8) {
    let year_num = lunar.year_num() as u32;
    let month_num = lunar.month_num() as u32;
    let day_num = lunar.day_num() as u32;
    let hour_num = lunar.hour_num() as u32;

    // 上卦数：(年数+月数+日数) % 8
    let shang_gua_num = calc_gua_num(year_num + month_num + day_num);

    // 下卦数：(年数+月数+日数+时数) % 8
    let xia_gua_num = calc_gua_num(year_num + month_num + day_num + hour_num);

    // 动爻数：(年数+月数+日数+时数) % 6
    let dong_yao = calc_dong_yao(year_num + month_num + day_num + hour_num);

    (shang_gua_num, xia_gua_num, dong_yao)
}

/// 双数起卦算法
///
/// 使用两个数字计算上卦、下卦，配合时辰计算动爻
///
/// # 算法
/// - 上卦数 = num1 % 8
/// - 下卦数 = num2 % 8
/// - 动爻数 = (num1 + num2 + 时支数) % 6
///
/// # 参数
/// - `num1`: 第一个数字（用于上卦）
/// - `num2`: 第二个数字（用于下卦）
/// - `hour_zhi_num`: 时辰地支数（1-12）
///
/// # 返回
/// - (上卦数, 下卦数, 动爻数)
pub fn divine_by_numbers(num1: u16, num2: u16, hour_zhi_num: u8) -> (u8, u8, u8) {
    // 上卦数
    let shang_gua_num = calc_gua_num(num1 as u32);

    // 下卦数
    let xia_gua_num = calc_gua_num(num2 as u32);

    // 动爻数：(两数之和 + 时辰数) % 6
    let dong_yao = calc_dong_yao(num1 as u32 + num2 as u32 + hour_zhi_num as u32);

    (shang_gua_num, xia_gua_num, dong_yao)
}

/// 随机起卦算法
///
/// 从随机种子生成上卦、下卦、动爻
///
/// # 参数
/// - `random_seed`: 32字节的随机种子
///
/// # 返回
/// - (上卦数, 下卦数, 动爻数)
pub fn divine_by_random(random_seed: &[u8; 32]) -> (u8, u8, u8) {
    // 使用种子的前几个字节
    let shang_gua_num = calc_gua_num(random_seed[0] as u32);
    let xia_gua_num = calc_gua_num(random_seed[1] as u32);
    let dong_yao = calc_dong_yao(random_seed[2] as u32);

    (shang_gua_num, xia_gua_num, dong_yao)
}

/// 判断体用卦
///
/// 梅花易数规则：动爻在哪卦，哪卦为用，另一卦为体
/// - 动爻1-3在下卦，下卦为用，上卦为体
/// - 动爻4-6在上卦，上卦为用，下卦为体
///
/// # 参数
/// - `dong_yao`: 动爻位置（1-6）
///
/// # 返回
/// - true: 上卦为体
/// - false: 下卦为体
#[inline]
pub fn determine_ti_is_shang(dong_yao: u8) -> bool {
    // 动爻4-6在上卦，上卦为用，下卦为体
    dong_yao <= 3
}

/// 计算变卦
///
/// 变卦规则：动爻阴阳互变
///
/// # 参数
/// - `shang_gua`: 上卦
/// - `xia_gua`: 下卦
/// - `dong_yao`: 动爻位置（1-6）
///
/// # 返回
/// - (变卦上卦, 变卦下卦)
pub fn calc_bian_gua(shang_gua: &SingleGua, xia_gua: &SingleGua, dong_yao: u8) -> (SingleGua, SingleGua) {
    // 组合6爻二进制：上卦占高3位（爻4-6），下卦占低3位（爻1-3）
    let full_binary = (shang_gua.binary() << 3) | xia_gua.binary();

    // 翻转动爻位
    // dong_yao: 1-6 对应 bit 0-5
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
/// - 互卦上卦：取本卦第3、4、5爻
/// - 互卦下卦：取本卦第2、3、4爻
///
/// # 参数
/// - `shang_gua`: 上卦
/// - `xia_gua`: 下卦
///
/// # 返回
/// - (互卦上卦, 互卦下卦)
pub fn calc_hu_gua(shang_gua: &SingleGua, xia_gua: &SingleGua) -> (SingleGua, SingleGua) {
    // 组合6爻：bits 5-3 为上卦（爻6、5、4），bits 2-0 为下卦（爻3、2、1）
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

/// 计算错卦
///
/// 错卦规则：本卦所有爻阴阳互变（取反）
///
/// # 参数
/// - `shang_gua`: 上卦
/// - `xia_gua`: 下卦
///
/// # 返回
/// - (错卦上卦, 错卦下卦)
pub fn calc_cuo_gua(shang_gua: &SingleGua, xia_gua: &SingleGua) -> (SingleGua, SingleGua) {
    // 上下卦各自取反
    let cuo_shang = (!shang_gua.binary()) & 0b111;
    let cuo_xia = (!xia_gua.binary()) & 0b111;

    (
        SingleGua::from_binary(cuo_shang),
        SingleGua::from_binary(cuo_xia),
    )
}

/// 计算综卦
///
/// 综卦规则：本卦上下颠倒（180°旋转）
///
/// # 参数
/// - `shang_gua`: 上卦
/// - `xia_gua`: 下卦
///
/// # 返回
/// - (综卦上卦, 综卦下卦)
pub fn calc_zong_gua(shang_gua: &SingleGua, xia_gua: &SingleGua) -> (SingleGua, SingleGua) {
    // 组合6爻
    let full_binary = (shang_gua.binary() << 3) | xia_gua.binary();

    // 逆序6个bit
    let mut reversed = 0u8;
    for i in 0..6 {
        if (full_binary >> i) & 1 == 1 {
            reversed |= 1 << (5 - i);
        }
    }

    // 分离上下卦
    let zong_shang = (reversed >> 3) & 0b111;
    let zong_xia = reversed & 0b111;

    (
        SingleGua::from_binary(zong_shang),
        SingleGua::from_binary(zong_xia),
    )
}

/// 计算体用关系
///
/// # 参数
/// - `ti_gua`: 体卦
/// - `yong_gua`: 用卦
///
/// # 返回
/// - 体用关系枚举
pub fn calc_tiyong_relation(ti_gua: &SingleGua, yong_gua: &SingleGua) -> TiYongRelation {
    TiYongRelation::calculate(&ti_gua.wuxing(), &yong_gua.wuxing())
}

/// 综合吉凶判断
///
/// 根据本卦和变卦的体用关系综合判断吉凶
///
/// # 参数
/// - `ben_relation`: 本卦体用关系
/// - `bian_relation`: 变卦体用关系（可选）
///
/// # 返回
/// - 吉凶判断结果
pub fn calc_fortune(
    ben_relation: &TiYongRelation,
    bian_relation: Option<&TiYongRelation>,
) -> Fortune {
    Fortune::from_relations(ben_relation, bian_relation)
}

/// 完整排盘计算
///
/// 根据上卦数、下卦数、动爻数，计算完整的卦象信息
///
/// # 参数
/// - `shang_num`: 上卦数（1-8）
/// - `xia_num`: 下卦数（1-8）
/// - `dong_yao`: 动爻（1-6）
///
/// # 返回
/// - (本卦上卦, 本卦下卦, 变卦上卦, 变卦下卦, 互卦上卦, 互卦下卦, 体用关系, 吉凶)
pub fn full_divination(
    shang_num: u8,
    xia_num: u8,
    dong_yao: u8,
) -> (
    SingleGua,
    SingleGua,
    SingleGua,
    SingleGua,
    SingleGua,
    SingleGua,
    bool,
    TiYongRelation,
    TiYongRelation,
    Fortune,
) {
    // 创建本卦
    let shang_gua = SingleGua::from_num(shang_num);
    let xia_gua = SingleGua::from_num(xia_num);

    // 计算变卦
    let (bian_shang, bian_xia) = calc_bian_gua(&shang_gua, &xia_gua, dong_yao);

    // 计算互卦
    let (hu_shang, hu_xia) = calc_hu_gua(&shang_gua, &xia_gua);

    // 判断体用
    let ti_is_shang = determine_ti_is_shang(dong_yao);

    // 获取体卦和用卦
    let (ti_gua, yong_gua) = if ti_is_shang {
        (&shang_gua, &xia_gua)
    } else {
        (&xia_gua, &shang_gua)
    };

    // 计算本卦体用关系
    let ben_relation = calc_tiyong_relation(ti_gua, yong_gua);

    // 计算变卦体用关系（体卦位置不变）
    let (bian_ti, bian_yong) = if ti_is_shang {
        (&bian_shang, &bian_xia)
    } else {
        (&bian_xia, &bian_shang)
    };
    let bian_relation = calc_tiyong_relation(bian_ti, bian_yong);

    // 综合吉凶判断
    let fortune = calc_fortune(&ben_relation, Some(&bian_relation));

    (
        shang_gua,
        xia_gua,
        bian_shang,
        bian_xia,
        hu_shang,
        hu_xia,
        ti_is_shang,
        ben_relation,
        bian_relation,
        fortune,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_gua_num() {
        assert_eq!(calc_gua_num(1), 1);
        assert_eq!(calc_gua_num(8), 8);
        assert_eq!(calc_gua_num(9), 1);
        assert_eq!(calc_gua_num(16), 8);
        assert_eq!(calc_gua_num(0), 8);
    }

    #[test]
    fn test_calc_dong_yao() {
        assert_eq!(calc_dong_yao(1), 1);
        assert_eq!(calc_dong_yao(6), 6);
        assert_eq!(calc_dong_yao(7), 1);
        assert_eq!(calc_dong_yao(12), 6);
        assert_eq!(calc_dong_yao(0), 6);
    }

    #[test]
    fn test_determine_ti_is_shang() {
        // 动爻1-3，上卦为体
        assert!(determine_ti_is_shang(1));
        assert!(determine_ti_is_shang(2));
        assert!(determine_ti_is_shang(3));
        // 动爻4-6，下卦为体
        assert!(!determine_ti_is_shang(4));
        assert!(!determine_ti_is_shang(5));
        assert!(!determine_ti_is_shang(6));
    }

    #[test]
    fn test_calc_bian_gua() {
        // 乾卦（111）动爻1，翻转初爻(bit0)：111 -> 110 = 巽
        let shang = SingleGua::from_num(1); // 乾 (111)
        let xia = SingleGua::from_num(1);   // 乾 (111)
        let (bian_shang, bian_xia) = calc_bian_gua(&shang, &xia, 1);

        // 六爻为 111_111，翻转bit0变为 111_110
        // 上卦 111 = 乾，下卦 110 = 巽
        assert_eq!(bian_shang.bagua, Bagua::Qian); // 上卦不变
        assert_eq!(bian_xia.bagua, Bagua::Xun);    // 下卦变为巽
    }

    #[test]
    fn test_calc_hu_gua() {
        // 乾为天（䷀）：111 111
        // 互卦上卦取345爻：111
        // 互卦下卦取234爻：111
        // 所以乾为天的互卦还是乾为天
        let shang = SingleGua::from_num(1); // 乾
        let xia = SingleGua::from_num(1);   // 乾
        let (hu_shang, hu_xia) = calc_hu_gua(&shang, &xia);

        assert_eq!(hu_shang.bagua, Bagua::Qian);
        assert_eq!(hu_xia.bagua, Bagua::Qian);
    }

    #[test]
    fn test_calc_cuo_gua() {
        // 乾卦（111）的错卦是坤卦（000）
        let shang = SingleGua::from_num(1); // 乾
        let xia = SingleGua::from_num(1);   // 乾
        let (cuo_shang, cuo_xia) = calc_cuo_gua(&shang, &xia);

        assert_eq!(cuo_shang.bagua, Bagua::Kun);
        assert_eq!(cuo_xia.bagua, Bagua::Kun);
    }

    #[test]
    fn test_divine_by_datetime() {
        // 模拟农历日期：甲辰年冬月二十子时
        // 年支数=5（辰），月数=11，日数=20，时支数=1（子）
        let lunar = LunarDate {
            year: 2024,
            year_zhi_num: 5, // 辰
            month: 11,
            day: 20,
            hour_zhi_num: 1, // 子
            is_leap_month: false,
        };

        let (shang, xia, dong) = divine_by_datetime(&lunar);

        // 上卦：(5+11+20) % 8 = 36 % 8 = 4 → 震
        assert_eq!(shang, 4);
        // 下卦：(5+11+20+1) % 8 = 37 % 8 = 5 → 巽
        assert_eq!(xia, 5);
        // 动爻：(5+11+20+1) % 6 = 37 % 6 = 1
        assert_eq!(dong, 1);
    }

    #[test]
    fn test_full_divination() {
        // 测试完整排盘：上卦3（离），下卦4（震），动爻6
        let result = full_divination(3, 4, 6);

        // 本卦：火雷噬嗑
        assert_eq!(result.0.bagua, Bagua::Li);   // 上卦离
        assert_eq!(result.1.bagua, Bagua::Zhen); // 下卦震

        // 动爻6在上卦，上卦为用，下卦为体
        assert!(!result.6); // ti_is_shang = false

        // 验证变卦计算
        // 离（101）上卦动第6爻变为震（001）
        assert_eq!(result.2.bagua, Bagua::Zhen); // 变卦上卦
        assert_eq!(result.3.bagua, Bagua::Zhen); // 变卦下卦不变
    }
}
