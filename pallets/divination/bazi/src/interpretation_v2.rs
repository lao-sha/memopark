//! # 八字解盘 V2 - 轻量化实现
//!
//! 改进点：
//! - 移除冗余性格分析数据
//! - 移除文本枚举，改用前端映射
//! - 减少存储空间 85%（70+ bytes → 10 bytes）
//! - 支持 RPC 实时计算
//! - 新增可信度评估系统

use codec::{Decode, Encode};
use scale_info::TypeInfo;
use frame_support::pallet_prelude::*;
use crate::types::*;
use crate::interpretation::{GeJuType, MingJuQiangRuo, YongShenType};

// ================================
// 数据结构定义
// ================================

/// 精简版解盘结果（仅关键指标）
///
/// 总大小：13 bytes（vs 旧版 70+ bytes）
/// 节省：81%
///
/// 设计原则：
/// 1. 最小化存储空间
/// 2. 包含核心命理指标
/// 3. 支持 SCALE 编解码
/// 4. 便于前端解析和展示
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct SimplifiedInterpretation {
    /// 格局类型 (1 byte)
    /// 枚举：正格、从强格、从弱格、从财格、从官格、从儿格、化气格、特殊格
    pub ge_ju: GeJuType,

    /// 命局强弱 (1 byte)
    /// 枚举：身旺、身弱、中和、太旺、太弱
    pub qiang_ruo: MingJuQiangRuo,

    /// 用神 (1 byte)
    /// 枚举：金、木、水、火、土
    pub yong_shen: WuXing,

    /// 用神类型 (1 byte)
    /// 枚举：扶抑、调候、通关、专旺
    pub yong_shen_type: YongShenType,

    /// 喜神 - 辅助用神 (1 byte)
    /// 推导：生用神者
    pub xi_shen: WuXing,

    /// 忌神 - 主要忌神 (1 byte)
    /// 推导：根据强弱判断
    pub ji_shen: WuXing,

    /// 综合评分 0-100 (1 byte)
    /// 计算：格局分(20) + 强弱分(20) + 平衡分(10) + 基础分(50)
    pub score: u8,

    /// 可信度评分 0-100 (1 byte)
    /// 影响因素：时辰精确度、格局稀有度、五行失衡、子时模式
    pub confidence: u8,

    /// 解盘时间戳 - 区块号 (4 bytes)
    /// 用途：标记计算时间，支持算法版本追溯
    pub timestamp: u32,

    /// 算法版本 (1 byte)
    /// 当前版本：2（v1 = 旧版完整解盘）
    pub algorithm_version: u8,
}

// 总计：13 bytes（SCALE 编码后）
// 对比：旧版 JiePanResult 约 70+ bytes
// 节省：81%

// ================================
// V2 版本解盘算法
// ================================

/// V2 版本解盘算法（算法版本 = 2）
///
/// 改进点：
/// - 优化格局判断逻辑
/// - 增加可信度评估
/// - 支持批量计算
///
/// # 参数
/// - chart: 八字命盘
/// - current_block: 当前区块号
///
/// # 返回
/// SimplifiedInterpretation - 精简版解盘结果
pub fn calculate_interpretation_v2<T: crate::pallet::Config>(
    chart: &BaziChart<T>,
    current_block: u32,
) -> SimplifiedInterpretation {
    // 1. 分析格局
    let ge_ju = analyze_ge_ju(&chart.sizhu, &chart.wuxing_strength);

    // 2. 分析强弱
    let qiang_ruo = analyze_qiang_ruo(&chart.wuxing_strength, chart.sizhu.rizhu);

    // 3. 分析用神
    let (yong_shen, yong_shen_type) = analyze_yong_shen(
        ge_ju,
        qiang_ruo,
        &chart.sizhu,
        &chart.wuxing_strength,
    );

    // 4. 推导喜神（辅助用神）
    let xi_shen = derive_xi_shen(yong_shen);

    // 5. 推导忌神（主要）
    let ji_shen = derive_ji_shen(yong_shen, qiang_ruo, chart.sizhu.rizhu);

    // 6. 计算综合评分
    let score = calculate_comprehensive_score(
        ge_ju,
        qiang_ruo,
        &chart.wuxing_strength,
    );

    // 7. 计算可信度
    let confidence = calculate_confidence_score(
        chart,
        ge_ju,
        &chart.wuxing_strength,
    );

    SimplifiedInterpretation {
        ge_ju,
        qiang_ruo,
        yong_shen,
        yong_shen_type,
        xi_shen,
        ji_shen,
        score,
        confidence,
        timestamp: current_block,
        algorithm_version: 2,
    }
}

// ================================
// 核心算法实现
// ================================

/// 分析八字格局
///
/// 判断标准：
/// - 0-15%：极弱 → 检查生扶 → 正格 or 从弱格
/// - 16-50%：正常 → 正格
/// - 51-70%：偏旺 → 检查克制 → 正格 or 从强格
/// - 71-100%：极旺 → 从强格
///
/// # 参数
/// - sizhu: 四柱信息
/// - wuxing_strength: 五行强度
///
/// # 返回
/// GeJuType - 格局类型
fn analyze_ge_ju<T: crate::pallet::Config>(
    sizhu: &SiZhu<T>,
    wuxing_strength: &WuXingStrength,
) -> GeJuType {
    // 1. 计算日主五行强度
    let rizhu_wuxing = sizhu.rizhu.to_wuxing();
    let rizhu_strength = get_wuxing_strength(wuxing_strength, rizhu_wuxing);

    // 2. 计算总强度
    let total_strength: u32 =
        wuxing_strength.jin +
        wuxing_strength.mu +
        wuxing_strength.shui +
        wuxing_strength.huo +
        wuxing_strength.tu;

    if total_strength == 0 {
        return GeJuType::ZhengGe;
    }

    // 3. 计算强度比例（百分比）
    let strength_ratio = (rizhu_strength * 100) / total_strength;

    // 4. 格局判断
    match strength_ratio {
        0..=15 => {
            // 极弱：检查是否有生扶
            if has_sheng_fu(sizhu, rizhu_wuxing) {
                GeJuType::ZhengGe  // 有生扶，正格
            } else {
                GeJuType::CongRuoGe  // 无生扶，从弱格
            }
        },
        16..=50 => {
            // 正常强度，正格
            GeJuType::ZhengGe
        },
        51..=70 => {
            // 偏旺：检查是否有克制
            if has_ke_zhi(sizhu, rizhu_wuxing) {
                GeJuType::ZhengGe  // 有克制，正格
            } else {
                GeJuType::CongQiangGe  // 无克制，从强格
            }
        },
        _ => {
            // 极旺，从强格
            GeJuType::CongQiangGe
        }
    }
}

/// 分析命局强弱
///
/// 强度比例判断标准：
/// - 0-15%：太弱
/// - 16-23%：身弱
/// - 24-36%：中和
/// - 37-50%：身旺
/// - 51-100%：太旺
///
/// # 参数
/// - wuxing_strength: 五行强度
/// - rizhu: 日主天干
///
/// # 返回
/// MingJuQiangRuo - 命局强弱
fn analyze_qiang_ruo(
    wuxing_strength: &WuXingStrength,
    rizhu: TianGan,
) -> MingJuQiangRuo {
    let rizhu_wuxing = rizhu.to_wuxing();
    let rizhu_strength = get_wuxing_strength(wuxing_strength, rizhu_wuxing);

    let total_strength: u32 =
        wuxing_strength.jin +
        wuxing_strength.mu +
        wuxing_strength.shui +
        wuxing_strength.huo +
        wuxing_strength.tu;

    if total_strength == 0 {
        return MingJuQiangRuo::ZhongHe;
    }

    let strength_ratio = (rizhu_strength * 100) / total_strength;

    match strength_ratio {
        0..=15 => MingJuQiangRuo::TaiRuo,
        16..=23 => MingJuQiangRuo::ShenRuo,
        24..=36 => MingJuQiangRuo::ZhongHe,
        37..=50 => MingJuQiangRuo::ShenWang,
        _ => MingJuQiangRuo::TaiWang,
    }
}

/// 分析用神
///
/// 判断逻辑：
/// 1. 正格身旺 → 克泄耗（官杀、食伤、财星）
/// 2. 正格身弱 → 生扶（印星、比劫）
/// 3. 正格中和 → 调候（根据季节）
/// 4. 从强格 → 顺势（比劫、印星）
/// 5. 从弱格 → 克泄耗（官杀、食伤、财星）
///
/// # 参数
/// - ge_ju: 格局类型
/// - qiang_ruo: 命局强弱
/// - sizhu: 四柱信息
/// - wuxing_strength: 五行强度
///
/// # 返回
/// (WuXing, YongShenType) - 用神和用神类型
fn analyze_yong_shen<T: crate::pallet::Config>(
    ge_ju: GeJuType,
    qiang_ruo: MingJuQiangRuo,
    sizhu: &SiZhu<T>,
    _wuxing_strength: &WuXingStrength,
) -> (WuXing, YongShenType) {
    let rizhu_wuxing = sizhu.rizhu.to_wuxing();

    match (ge_ju, qiang_ruo) {
        // 正格身旺：用克泄耗
        (GeJuType::ZhengGe, MingJuQiangRuo::ShenWang | MingJuQiangRuo::TaiWang) => {
            (get_ke_wo(rizhu_wuxing), YongShenType::FuYi)
        },

        // 正格身弱：用生扶
        (GeJuType::ZhengGe, MingJuQiangRuo::ShenRuo | MingJuQiangRuo::TaiRuo) => {
            (get_sheng_wo(rizhu_wuxing), YongShenType::FuYi)
        },

        // 正格中和：调候用神
        (GeJuType::ZhengGe, MingJuQiangRuo::ZhongHe) => {
            let season_wuxing = get_season_wuxing(sizhu.month_zhu.ganzhi.zhi);
            (season_wuxing, YongShenType::DiaoHou)
        },

        // 从强格：顺势而为
        (GeJuType::CongQiangGe, _) => {
            (rizhu_wuxing, YongShenType::ZhuanWang)
        },

        // 从弱格：用克泄耗
        (GeJuType::CongRuoGe, _) => {
            (get_ke_wo(rizhu_wuxing), YongShenType::ZhuanWang)
        },

        // 其他格局：默认扶抑
        _ => {
            if matches!(qiang_ruo, MingJuQiangRuo::ShenWang | MingJuQiangRuo::TaiWang) {
                (get_ke_wo(rizhu_wuxing), YongShenType::FuYi)
            } else {
                (get_sheng_wo(rizhu_wuxing), YongShenType::FuYi)
            }
        }
    }
}

/// 推导喜神（辅助用神）
///
/// 喜神 = 生用神者
///
/// # 参数
/// - yong_shen: 用神五行
///
/// # 返回
/// WuXing - 喜神五行
fn derive_xi_shen(yong_shen: WuXing) -> WuXing {
    get_sheng_wo(yong_shen)
}

/// 推导忌神（主要忌神）
///
/// 根据命局强弱推导：
/// - 身旺/太旺：忌生扶（比劫印星）
/// - 身弱/太弱：忌克泄耗（官杀食伤财星）
/// - 中和：忌克用神者
///
/// # 参数
/// - yong_shen: 用神五行
/// - qiang_ruo: 命局强弱
/// - rizhu: 日主天干
///
/// # 返回
/// WuXing - 忌神五行
fn derive_ji_shen(yong_shen: WuXing, qiang_ruo: MingJuQiangRuo, rizhu: TianGan) -> WuXing {
    match qiang_ruo {
        MingJuQiangRuo::ShenWang | MingJuQiangRuo::TaiWang => {
            // 身旺忌生扶
            get_sheng_wo(rizhu.to_wuxing())
        },
        MingJuQiangRuo::ShenRuo | MingJuQiangRuo::TaiRuo => {
            // 身弱忌克泄耗
            get_ke_wo(rizhu.to_wuxing())
        },
        MingJuQiangRuo::ZhongHe => {
            // 中和忌克用神
            get_ke_wo(yong_shen)
        },
    }
}

/// 计算综合评分
///
/// 评分组成：
/// - 基础分：50 分
/// - 格局分：0-20 分（正格 20 分，从格 15 分，其他 10 分）
/// - 强弱分：0-20 分（中和 20 分，偏旺/偏弱 15 分，极端 10 分）
/// - 平衡分：0-10 分（五行平衡度）
///
/// # 参数
/// - ge_ju: 格局类型
/// - qiang_ruo: 命局强弱
/// - wuxing_strength: 五行强度
///
/// # 返回
/// u8 - 综合评分 (0-100)
fn calculate_comprehensive_score(
    ge_ju: GeJuType,
    qiang_ruo: MingJuQiangRuo,
    wuxing_strength: &WuXingStrength,
) -> u8 {
    let mut score = 50u8; // 基础分

    // 格局分 (0-20)
    score += match ge_ju {
        GeJuType::ZhengGe => 20,
        GeJuType::CongQiangGe | GeJuType::CongRuoGe => 15,
        _ => 10,
    };

    // 强弱分 (0-20)
    score += match qiang_ruo {
        MingJuQiangRuo::ZhongHe => 20,
        MingJuQiangRuo::ShenWang | MingJuQiangRuo::ShenRuo => 15,
        MingJuQiangRuo::TaiWang | MingJuQiangRuo::TaiRuo => 10,
    };

    // 平衡分 (0-10)
    let balance_score = calculate_balance_score(wuxing_strength);
    score = score.saturating_add(balance_score);

    score.min(100)
}

/// 计算五行平衡分
///
/// 基于五行强度的方差计算：
/// - 方差越小，平衡分越高
/// - 方差越大，平衡分越低
///
/// # 参数
/// - wuxing_strength: 五行强度
///
/// # 返回
/// u8 - 平衡分 (0-10)
fn calculate_balance_score(wuxing_strength: &WuXingStrength) -> u8 {
    let strengths = [
        wuxing_strength.jin,
        wuxing_strength.mu,
        wuxing_strength.shui,
        wuxing_strength.huo,
        wuxing_strength.tu,
    ];

    let total: u32 = strengths.iter().sum();
    if total == 0 {
        return 0;
    }

    let avg = total / 5;
    let variance: u32 = strengths.iter()
        .map(|&s| {
            let diff = if s > avg { s - avg } else { avg - s };
            diff * diff
        })
        .sum();

    // 方差越小，平衡分越高
    let variance_ratio = (variance * 100) / (avg * avg).max(1);
    match variance_ratio {
        0..=20 => 10,
        21..=50 => 8,
        51..=100 => 5,
        101..=200 => 3,
        _ => 0,
    }
}

/// 计算解盘可信度
///
/// 影响因素（满分 100）：
/// 1. 时辰精确度 (-0 ~ -15)
/// 2. 格局稀有度 (-0 ~ -15)
/// 3. 五行失衡度 (-0 ~ -20)
/// 4. 子时模式 (-0 ~ -5)
///
/// # 参数
/// - chart: 八字命盘
/// - ge_ju: 格局类型
/// - wuxing_strength: 五行强度
///
/// # 返回
/// u8 - 可信度评分 (0-100)
fn calculate_confidence_score<T: crate::pallet::Config>(
    chart: &BaziChart<T>,
    ge_ju: GeJuType,
    wuxing_strength: &WuXingStrength,
) -> u8 {
    let mut confidence = 100u8;

    // 1. 时辰精确度（-0 ~ -15）
    if chart.birth_time.minute == 0 {
        confidence = confidence.saturating_sub(15);
        // 整点出生，时辰可能不准确
    }

    // 2. 格局稀有度（-0 ~ -15）
    if matches!(ge_ju, GeJuType::TeShuge | GeJuType::HuaQiGe) {
        confidence = confidence.saturating_sub(15);
        // 特殊格局需人工确认
    }

    // 3. 五行极度失衡（-0 ~ -20）
    let max_strength = *[
        wuxing_strength.jin,
        wuxing_strength.mu,
        wuxing_strength.shui,
        wuxing_strength.huo,
        wuxing_strength.tu,
    ].iter().max().unwrap_or(&0);

    let total_strength: u32 =
        wuxing_strength.jin +
        wuxing_strength.mu +
        wuxing_strength.shui +
        wuxing_strength.huo +
        wuxing_strength.tu;

    if total_strength > 0 {
        let max_ratio = (max_strength * 100) / total_strength;
        if max_ratio > 70 {
            confidence = confidence.saturating_sub(20);
        } else if max_ratio > 60 {
            confidence = confidence.saturating_sub(10);
        }
    }

    // 4. 子时模式（-0 ~ -5）
    if matches!(chart.zishi_mode, ZiShiMode::Traditional) {
        confidence = confidence.saturating_sub(5);
        // 传统派子时有争议
    }

    confidence
}

// ================================
// 五行计算辅助函数
// ================================

/// 获取五行强度值
///
/// # 参数
/// - strength: 五行强度结构
/// - wuxing: 五行类型
///
/// # 返回
/// u32 - 该五行的强度值
fn get_wuxing_strength(strength: &WuXingStrength, wuxing: WuXing) -> u32 {
    match wuxing {
        WuXing::Jin => strength.jin,
        WuXing::Mu => strength.mu,
        WuXing::Shui => strength.shui,
        WuXing::Huo => strength.huo,
        WuXing::Tu => strength.tu,
    }
}

/// 获取生我者（印星）
///
/// 五行相生关系：
/// - 金 ← 土
/// - 木 ← 水
/// - 水 ← 金
/// - 火 ← 木
/// - 土 ← 火
///
/// # 参数
/// - wuxing: 五行类型
///
/// # 返回
/// WuXing - 生我者五行
fn get_sheng_wo(wuxing: WuXing) -> WuXing {
    match wuxing {
        WuXing::Jin => WuXing::Tu,
        WuXing::Mu => WuXing::Shui,
        WuXing::Shui => WuXing::Jin,
        WuXing::Huo => WuXing::Mu,
        WuXing::Tu => WuXing::Huo,
    }
}

/// 获取克我者（官杀）
///
/// 五行相克关系：
/// - 金 ← 火
/// - 木 ← 金
/// - 水 ← 土
/// - 火 ← 水
/// - 土 ← 木
///
/// # 参数
/// - wuxing: 五行类型
///
/// # 返回
/// WuXing - 克我者五行
fn get_ke_wo(wuxing: WuXing) -> WuXing {
    match wuxing {
        WuXing::Jin => WuXing::Huo,
        WuXing::Mu => WuXing::Jin,
        WuXing::Shui => WuXing::Tu,
        WuXing::Huo => WuXing::Shui,
        WuXing::Tu => WuXing::Mu,
    }
}

/// 获取季节对应的五行
///
/// 十二地支对应的季节五行：
/// - 子丑亥（冬季）：水旺
/// - 寅卯辰（春季）：木旺
/// - 巳午未（夏季）：火旺
/// - 申酉戌（秋季）：金旺
///
/// # 参数
/// - dizhi: 月支地支
///
/// # 返回
/// WuXing - 季节对应的五行
fn get_season_wuxing(dizhi: DiZhi) -> WuXing {
    match dizhi.0 {
        0 | 1 | 11 => WuXing::Shui,  // 子丑亥 冬季水旺
        2 | 3 | 4 => WuXing::Mu,     // 寅卯辰 春季木旺
        5 | 6 | 7 => WuXing::Huo,    // 巳午未 夏季火旺
        8 | 9 | 10 => WuXing::Jin,   // 申酉戌 秋季金旺
        _ => WuXing::Tu,
    }
}

/// 检查四柱中是否有生扶
///
/// 检查年月时三柱天干中是否存在：
/// - 生我者（印星）
/// - 同我者（比劫）
///
/// # 参数
/// - sizhu: 四柱信息
/// - rizhu_wuxing: 日主五行
///
/// # 返回
/// bool - true=有生扶，false=无生扶
fn has_sheng_fu<T: crate::pallet::Config>(
    sizhu: &SiZhu<T>,
    rizhu_wuxing: WuXing,
) -> bool {
    let sheng_wo = get_sheng_wo(rizhu_wuxing);  // 生我者

    // 检查年月时三个天干
    [
        sizhu.year_zhu.ganzhi.gan.to_wuxing(),
        sizhu.month_zhu.ganzhi.gan.to_wuxing(),
        sizhu.hour_zhu.ganzhi.gan.to_wuxing(),
    ]
    .iter()
    .any(|&wx| wx == sheng_wo || wx == rizhu_wuxing)
}

/// 检查四柱中是否有克制
///
/// 检查年月时三柱天干中是否存在克我者（官杀）
///
/// # 参数
/// - sizhu: 四柱信息
/// - rizhu_wuxing: 日主五行
///
/// # 返回
/// bool - true=有克制，false=无克制
fn has_ke_zhi<T: crate::pallet::Config>(
    sizhu: &SiZhu<T>,
    rizhu_wuxing: WuXing,
) -> bool {
    let ke_wo = get_ke_wo(rizhu_wuxing);  // 克我者

    [
        sizhu.year_zhu.ganzhi.gan.to_wuxing(),
        sizhu.month_zhu.ganzhi.gan.to_wuxing(),
        sizhu.hour_zhu.ganzhi.gan.to_wuxing(),
    ]
    .iter()
    .any(|&wx| wx == ke_wo)
}

// ================================
// 单元测试
// ================================

#[cfg(test)]
mod tests {
    use super::*;
    use codec::Encode;

    #[test]
    fn test_simplified_interpretation_size() {
        // 验证 SimplifiedInterpretation 编码后大小 ≤ 13 bytes
        let interp = SimplifiedInterpretation {
            ge_ju: GeJuType::ZhengGe,
            qiang_ruo: MingJuQiangRuo::ZhongHe,
            yong_shen: WuXing::Huo,
            yong_shen_type: YongShenType::FuYi,
            xi_shen: WuXing::Mu,
            ji_shen: WuXing::Shui,
            score: 75,
            confidence: 85,
            timestamp: 1000000,
            algorithm_version: 2,
        };

        let encoded = interp.encode();

        // 编码后大小应该 ≤ 13 bytes（实际测试为 13 bytes）
        assert!(encoded.len() <= 13, "编码大小: {} bytes，预期 ≤ 13 bytes", encoded.len());

        // 相比旧版 70+ bytes，节省 81%
        println!("✅ SimplifiedInterpretation 编码大小: {} bytes（旧版 70+ bytes，节省 81%）", encoded.len());
    }

    #[test]
    fn test_wuxing_strength() {
        let strength = WuXingStrength {
            jin: 100,
            mu: 200,
            shui: 300,
            huo: 150,
            tu: 250,
        };

        assert_eq!(get_wuxing_strength(&strength, WuXing::Jin), 100);
        assert_eq!(get_wuxing_strength(&strength, WuXing::Mu), 200);
        assert_eq!(get_wuxing_strength(&strength, WuXing::Shui), 300);
        assert_eq!(get_wuxing_strength(&strength, WuXing::Huo), 150);
        assert_eq!(get_wuxing_strength(&strength, WuXing::Tu), 250);
    }

    #[test]
    fn test_wuxing_relations() {
        // 测试五行相生关系
        assert_eq!(get_sheng_wo(WuXing::Jin), WuXing::Tu);  // 土生金
        assert_eq!(get_sheng_wo(WuXing::Mu), WuXing::Shui);  // 水生木
        assert_eq!(get_sheng_wo(WuXing::Shui), WuXing::Jin);  // 金生水
        assert_eq!(get_sheng_wo(WuXing::Huo), WuXing::Mu);  // 木生火
        assert_eq!(get_sheng_wo(WuXing::Tu), WuXing::Huo);  // 火生土

        // 测试五行相克关系
        assert_eq!(get_ke_wo(WuXing::Jin), WuXing::Huo);  // 火克金
        assert_eq!(get_ke_wo(WuXing::Mu), WuXing::Jin);  // 金克木
        assert_eq!(get_ke_wo(WuXing::Shui), WuXing::Tu);  // 土克水
        assert_eq!(get_ke_wo(WuXing::Huo), WuXing::Shui);  // 水克火
        assert_eq!(get_ke_wo(WuXing::Tu), WuXing::Mu);  // 木克土
    }

    #[test]
    fn test_season_wuxing() {
        // 冬季：子(0), 丑(1), 亥(11) → 水旺
        assert_eq!(get_season_wuxing(DiZhi(0)), WuXing::Shui);
        assert_eq!(get_season_wuxing(DiZhi(1)), WuXing::Shui);
        assert_eq!(get_season_wuxing(DiZhi(11)), WuXing::Shui);

        // 春季：寅(2), 卯(3), 辰(4) → 木旺
        assert_eq!(get_season_wuxing(DiZhi(2)), WuXing::Mu);
        assert_eq!(get_season_wuxing(DiZhi(3)), WuXing::Mu);
        assert_eq!(get_season_wuxing(DiZhi(4)), WuXing::Mu);

        // 夏季：巳(5), 午(6), 未(7) → 火旺
        assert_eq!(get_season_wuxing(DiZhi(5)), WuXing::Huo);
        assert_eq!(get_season_wuxing(DiZhi(6)), WuXing::Huo);
        assert_eq!(get_season_wuxing(DiZhi(7)), WuXing::Huo);

        // 秋季：申(8), 酉(9), 戌(10) → 金旺
        assert_eq!(get_season_wuxing(DiZhi(8)), WuXing::Jin);
        assert_eq!(get_season_wuxing(DiZhi(9)), WuXing::Jin);
        assert_eq!(get_season_wuxing(DiZhi(10)), WuXing::Jin);
    }

    #[test]
    fn test_analyze_qiang_ruo() {
        let rizhu = TianGan(0);  // 甲木

        // 太弱：0-15%
        let strength_tai_ruo = WuXingStrength {
            mu: 10,   // 日主木 10
            jin: 20,
            shui: 20,
            huo: 20,
            tu: 30,
        };
        assert_eq!(analyze_qiang_ruo(&strength_tai_ruo, rizhu), MingJuQiangRuo::TaiRuo);

        // 身弱：16-23%
        let strength_shen_ruo = WuXingStrength {
            mu: 20,   // 日主木 20
            jin: 20,
            shui: 20,
            huo: 20,
            tu: 20,
        };
        assert_eq!(analyze_qiang_ruo(&strength_shen_ruo, rizhu), MingJuQiangRuo::ShenRuo);

        // 中和：24-36%
        let strength_zhong_he = WuXingStrength {
            mu: 30,   // 日主木 30
            jin: 20,
            shui: 20,
            huo: 20,
            tu: 10,
        };
        assert_eq!(analyze_qiang_ruo(&strength_zhong_he, rizhu), MingJuQiangRuo::ZhongHe);

        // 身旺：37-50%
        let strength_shen_wang = WuXingStrength {
            mu: 40,   // 日主木 40
            jin: 20,
            shui: 20,
            huo: 10,
            tu: 10,
        };
        assert_eq!(analyze_qiang_ruo(&strength_shen_wang, rizhu), MingJuQiangRuo::ShenWang);

        // 太旺：51-100%
        let strength_tai_wang = WuXingStrength {
            mu: 60,   // 日主木 60
            jin: 10,
            shui: 10,
            huo: 10,
            tu: 10,
        };
        assert_eq!(analyze_qiang_ruo(&strength_tai_wang, rizhu), MingJuQiangRuo::TaiWang);
    }

    #[test]
    fn test_balance_score() {
        // 完美平衡（每个五行 20）
        let balanced = WuXingStrength {
            jin: 20,
            mu: 20,
            shui: 20,
            huo: 20,
            tu: 20,
        };
        let score_balanced = calculate_balance_score(&balanced);
        assert_eq!(score_balanced, 10);  // 完美平衡应得满分

        // 极度失衡（一个五行占主导）
        let imbalanced = WuXingStrength {
            jin: 80,  // 极度偏重
            mu: 5,
            shui: 5,
            huo: 5,
            tu: 5,
        };
        let score_imbalanced = calculate_balance_score(&imbalanced);
        assert!(score_imbalanced < 5);  // 极度失衡得分应该很低
    }

    #[test]
    fn test_comprehensive_score() {
        // 正格中和，五行平衡 - 应该得高分
        let strength_good = WuXingStrength {
            jin: 20,
            mu: 20,
            shui: 20,
            huo: 20,
            tu: 20,
        };
        let score = calculate_comprehensive_score(
            GeJuType::ZhengGe,
            MingJuQiangRuo::ZhongHe,
            &strength_good,
        );
        assert!(score >= 80, "高质量八字评分应该 ≥ 80，实际: {}", score);

        // 特殊格局，极端强弱，五行失衡 - 应该得低分
        let strength_bad = WuXingStrength {
            jin: 90,
            mu: 2,
            shui: 3,
            huo: 3,
            tu: 2,
        };
        let score = calculate_comprehensive_score(
            GeJuType::TeShuge,
            MingJuQiangRuo::TaiWang,
            &strength_bad,
        );
        assert!(score <= 70, "低质量八字评分应该 ≤ 70，实际: {}", score);
    }
}
