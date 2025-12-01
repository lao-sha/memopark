//! # 小六壬排盘算法
//!
//! 本模块实现小六壬排盘的核心算法。
//!
//! ## 起课方法
//!
//! ### 1. 时间起课（传统方法）
//!
//! 按农历月日时起课：
//! - 月宫：从大安起正月，顺数至所求月份
//! - 日宫：从月宫起初一，顺数至所求日期
//! - 时宫：从日宫起子时，顺数至所求时辰
//!
//! ### 2. 数字起课（活数起课法）
//!
//! 取三个数字 x、y、z：
//! - 月宫 = (x - 1) % 6
//! - 日宫 = (x + y - 2) % 6
//! - 时宫 = (x + y + z - 3) % 6
//!
//! ### 3. 随机起课
//!
//! 使用链上随机数生成三个数字，然后按数字起课法计算。

extern crate alloc;
use alloc::vec::Vec;
use alloc::string::ToString;

use crate::types::*;

// ============================================================================
// 时间起课算法
// ============================================================================

/// 时间起课
///
/// 按农历月日时起课，这是最传统的小六壬起课方法。
///
/// # 参数
/// - `lunar_month`: 农历月份（1-12）
/// - `lunar_day`: 农历日期（1-30）
/// - `shi_chen`: 时辰
///
/// # 算法
/// 1. 月宫：从大安起正月，顺数至所求月份
/// 2. 日宫：从月宫起初一，顺数至所求日期
/// 3. 时宫：从日宫起子时，顺数至所求时辰
pub fn divine_by_time(lunar_month: u8, lunar_day: u8, shi_chen: ShiChen) -> SanGong {
    // 月宫：从大安(0)起正月，顺数至所求月份
    // 正月为1，所以 (month - 1) % 6
    let yue_index = (lunar_month.saturating_sub(1)) % 6;
    let yue_gong = LiuGong::from_index(yue_index);

    // 日宫：从月宫起初一，顺数至所求日期
    // 初一对应0，所以 (yue_index + day - 1) % 6
    let ri_index = (yue_index + lunar_day.saturating_sub(1)) % 6;
    let ri_gong = LiuGong::from_index(ri_index);

    // 时宫：从日宫起子时(1)，顺数至所求时辰
    // 子时序号为1，所以 (ri_index + shi_chen_index - 1) % 6
    let shi_index = (ri_index + shi_chen.index().saturating_sub(1)) % 6;
    let shi_gong = LiuGong::from_index(shi_index);

    SanGong::new(yue_gong, ri_gong, shi_gong)
}

/// 从小时数计算时间起课
pub fn divine_by_time_with_hour(lunar_month: u8, lunar_day: u8, hour: u8) -> SanGong {
    let shi_chen = ShiChen::from_hour(hour);
    divine_by_time(lunar_month, lunar_day, shi_chen)
}

// ============================================================================
// 数字起课算法
// ============================================================================

/// 数字起课
///
/// 活数起课法：取三个数字计算三宫。
///
/// # 参数
/// - `x`: 第一个数字（≥1）
/// - `y`: 第二个数字（≥1）
/// - `z`: 第三个数字（≥1）
///
/// # 算法
/// - 月宫 = (x - 1) % 6
/// - 日宫 = (x + y - 2) % 6
/// - 时宫 = (x + y + z - 3) % 6
pub fn divine_by_number(x: u8, y: u8, z: u8) -> SanGong {
    // 确保输入至少为1
    let x = x.max(1);
    let y = y.max(1);
    let z = z.max(1);

    // 月宫
    let yue_index = (x - 1) % 6;
    let yue_gong = LiuGong::from_index(yue_index);

    // 日宫
    let ri_index = (x.saturating_add(y).saturating_sub(2)) % 6;
    let ri_gong = LiuGong::from_index(ri_index);

    // 时宫
    let shi_index = (x.saturating_add(y).saturating_add(z).saturating_sub(3)) % 6;
    let shi_gong = LiuGong::from_index(shi_index);

    SanGong::new(yue_gong, ri_gong, shi_gong)
}

/// 从多位数字起课（活数起课法变体）
///
/// 输入一个数字（如1436），按以下规则计算：
/// 1. 各位数字相加
/// 2. 减去（位数 - 1）
/// 3. 除以6取余数
///
/// # 参数
/// - `number`: 输入数字
///
/// # 返回
/// 返回一个六宫结果（简化版，只返回最终结果）
pub fn divine_by_multi_digit(number: u32) -> LiuGong {
    let digits: Vec<u32> = number
        .to_string()
        .chars()
        .filter_map(|c| c.to_digit(10))
        .collect();

    let digit_count = digits.len() as u32;
    let digit_sum: u32 = digits.iter().sum();

    // 位数为1时不减，否则减去（位数-1）
    let adjustment = if digit_count <= 1 { 0 } else { digit_count - 1 };
    let result = digit_sum.saturating_sub(adjustment);

    // 取模得到六宫索引（1-6对应0-5）
    let index = if result % 6 == 0 { 5 } else { (result % 6) as u8 - 1 };

    LiuGong::from_index(index)
}

/// 完整的多位数字起课（返回三宫）
///
/// 适用于连续输入三个数字的场景
pub fn divine_by_three_numbers(num1: u32, num2: u32, num3: u32) -> SanGong {
    let x = process_multi_digit(num1);
    let y = process_multi_digit(num2);
    let z = process_multi_digit(num3);

    divine_by_number(x, y, z)
}

/// 处理多位数字为单个数字（1-60范围）
fn process_multi_digit(number: u32) -> u8 {
    let digits: Vec<u32> = number
        .to_string()
        .chars()
        .filter_map(|c| c.to_digit(10))
        .collect();

    let digit_sum: u32 = digits.iter().sum();

    // 转换为1-60范围内的数字
    let result = if digit_sum == 0 { 1 } else { ((digit_sum - 1) % 60) + 1 };

    result as u8
}

// ============================================================================
// 随机起课算法
// ============================================================================

/// 从随机字节生成起课参数
///
/// # 参数
/// - `random_bytes`: 随机字节数组
///
/// # 返回
/// 返回 (x, y, z) 三个数字（1-60范围）
pub fn random_to_params(random_bytes: &[u8; 32]) -> (u8, u8, u8) {
    // 使用前三个字节生成1-60范围的数字
    let x = (random_bytes[0] % 60) + 1;
    let y = (random_bytes[1] % 60) + 1;
    let z = (random_bytes[2] % 60) + 1;

    (x, y, z)
}

/// 随机起课
pub fn divine_random(random_bytes: &[u8; 32]) -> SanGong {
    let (x, y, z) = random_to_params(random_bytes);
    divine_by_number(x, y, z)
}

// ============================================================================
// 手动指定
// ============================================================================

/// 手动指定三宫
pub fn divine_manual(yue: u8, ri: u8, shi: u8) -> SanGong {
    SanGong::new(
        LiuGong::from_index(yue % 6),
        LiuGong::from_index(ri % 6),
        LiuGong::from_index(shi % 6),
    )
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 获取六宫的详细解读信息
pub fn get_gong_detail(gong: LiuGong) -> GongDetail {
    GongDetail {
        name: gong.name(),
        wu_xing: gong.wu_xing().name(),
        tian_jiang: gong.tian_jiang(),
        direction: gong.direction(),
        color: gong.color(),
        fortune_level: gong.fortune_level(),
        is_auspicious: gong.is_auspicious(),
        mou_shi: gong.mou_shi_numbers(),
        brief: gong.brief(),
        gua_ci: gong.gua_ci(),
    }
}

/// 六宫详细信息
#[derive(Clone, Debug)]
pub struct GongDetail {
    pub name: &'static str,
    pub wu_xing: &'static str,
    pub tian_jiang: &'static str,
    pub direction: &'static str,
    pub color: &'static str,
    pub fortune_level: u8,
    pub is_auspicious: bool,
    pub mou_shi: [u8; 3],
    pub brief: &'static str,
    pub gua_ci: &'static str,
}

/// 分析三宫综合信息
pub fn analyze_san_gong(san_gong: &SanGong) -> SanGongAnalysis {
    SanGongAnalysis {
        fortune_level: san_gong.fortune_level(),
        is_all_auspicious: san_gong.is_all_auspicious(),
        is_all_inauspicious: san_gong.is_all_inauspicious(),
        is_pure: san_gong.is_pure(),
        wu_xing_relation: san_gong.wu_xing_analysis(),
        yue_detail: get_gong_detail(san_gong.yue_gong),
        ri_detail: get_gong_detail(san_gong.ri_gong),
        shi_detail: get_gong_detail(san_gong.shi_gong),
    }
}

/// 三宫综合分析结果
#[derive(Clone, Debug)]
pub struct SanGongAnalysis {
    pub fortune_level: u8,
    pub is_all_auspicious: bool,
    pub is_all_inauspicious: bool,
    pub is_pure: bool,
    pub wu_xing_relation: WuXingRelation,
    pub yue_detail: GongDetail,
    pub ri_detail: GongDetail,
    pub shi_detail: GongDetail,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_divine_by_time() {
        // 测试时间起课
        // 六月初五辰时
        let result = divine_by_time(6, 5, ShiChen::Chen);

        // 月宫：从大安起正月，6月 = (6-1) % 6 = 5 → 空亡
        assert_eq!(result.yue_gong, LiuGong::KongWang);

        // 日宫：从空亡起初一，初五 = (5 + 5 - 1) % 6 = 3 → 赤口
        assert_eq!(result.ri_gong, LiuGong::ChiKou);

        // 时宫：从赤口起子时，辰时(5) = (3 + 5 - 1) % 6 = 1 → 留连
        assert_eq!(result.shi_gong, LiuGong::LiuLian);
    }

    #[test]
    fn test_divine_by_number() {
        // 测试数字起课
        let result = divine_by_number(1, 2, 3);

        // 月宫 = (1-1) % 6 = 0 → 大安
        assert_eq!(result.yue_gong, LiuGong::DaAn);

        // 日宫 = (1+2-2) % 6 = 1 → 留连
        assert_eq!(result.ri_gong, LiuGong::LiuLian);

        // 时宫 = (1+2+3-3) % 6 = 3 → 赤口
        assert_eq!(result.shi_gong, LiuGong::ChiKou);
    }

    #[test]
    fn test_divine_by_number_wrap() {
        // 测试取模边界
        let result = divine_by_number(6, 6, 6);

        // 月宫 = (6-1) % 6 = 5 → 空亡
        assert_eq!(result.yue_gong, LiuGong::KongWang);

        // 日宫 = (6+6-2) % 6 = 10 % 6 = 4 → 小吉
        assert_eq!(result.ri_gong, LiuGong::XiaoJi);

        // 时宫 = (6+6+6-3) % 6 = 15 % 6 = 3 → 赤口
        assert_eq!(result.shi_gong, LiuGong::ChiKou);
    }

    #[test]
    fn test_divine_by_multi_digit() {
        // 测试1436
        let result = divine_by_multi_digit(1436);
        // 1+4+3+6 = 14, 14-3 = 11, 11 % 6 = 5
        // 5不为0，所以 index = 5 - 1 = 4 → 小吉(索引4)
        assert_eq!(result, LiuGong::XiaoJi);

        // 测试18
        let result = divine_by_multi_digit(18);
        // 1+8 = 9, 9-1 = 8, 8 % 6 = 2
        // 2不为0，所以 index = 2 - 1 = 1 → 留连(索引1)
        assert_eq!(result, LiuGong::LiuLian);
    }

    #[test]
    fn test_shi_chen_from_hour() {
        assert_eq!(ShiChen::from_hour(0), ShiChen::Zi);
        assert_eq!(ShiChen::from_hour(1), ShiChen::Chou);
        assert_eq!(ShiChen::from_hour(3), ShiChen::Yin);
        assert_eq!(ShiChen::from_hour(7), ShiChen::Chen);
        assert_eq!(ShiChen::from_hour(11), ShiChen::Wu);
        assert_eq!(ShiChen::from_hour(23), ShiChen::Zi);
    }

    #[test]
    fn test_liu_gong_properties() {
        let da_an = LiuGong::DaAn;
        assert_eq!(da_an.name(), "大安");
        assert_eq!(da_an.wu_xing(), WuXing::Wood);
        assert_eq!(da_an.tian_jiang(), "青龙");
        assert!(da_an.is_auspicious());
        assert_eq!(da_an.fortune_level(), 5);

        let kong_wang = LiuGong::KongWang;
        assert_eq!(kong_wang.name(), "空亡");
        assert_eq!(kong_wang.wu_xing(), WuXing::Earth);
        assert!(!kong_wang.is_auspicious());
    }

    #[test]
    fn test_san_gong_analysis() {
        // 全吉
        let all_good = SanGong::new(LiuGong::DaAn, LiuGong::SuXi, LiuGong::XiaoJi);
        assert!(all_good.is_all_auspicious());
        assert!(!all_good.is_all_inauspicious());

        // 全凶
        let all_bad = SanGong::new(LiuGong::LiuLian, LiuGong::ChiKou, LiuGong::KongWang);
        assert!(!all_bad.is_all_auspicious());
        assert!(all_bad.is_all_inauspicious());

        // 纯宫
        let pure = SanGong::new(LiuGong::DaAn, LiuGong::DaAn, LiuGong::DaAn);
        assert!(pure.is_pure());
    }

    #[test]
    fn test_random_to_params() {
        let bytes = [10u8; 32];
        let (x, y, z) = random_to_params(&bytes);

        // 10 % 60 + 1 = 11
        assert_eq!(x, 11);
        assert_eq!(y, 11);
        assert_eq!(z, 11);
    }

    #[test]
    fn test_divine_manual() {
        let result = divine_manual(0, 1, 2);
        assert_eq!(result.yue_gong, LiuGong::DaAn);
        assert_eq!(result.ri_gong, LiuGong::LiuLian);
        assert_eq!(result.shi_gong, LiuGong::SuXi);
    }
}
