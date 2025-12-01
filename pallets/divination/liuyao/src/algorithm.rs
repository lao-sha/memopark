//! # 六爻排盘算法
//!
//! 本模块实现六爻排盘的核心算法，包括：
//! - 纳甲装卦
//! - 世应安装
//! - 六亲配置
//! - 六神排布
//! - 旬空计算
//! - 伏神查找
//!
//! ## 纳甲口诀
//!
//! 乾纳甲壬，坤纳乙癸，震纳庚，巽纳辛，
//! 坎纳戊，离纳己，艮纳丙，兑纳丁。
//!
//! ## 纳支口诀
//!
//! 乾金甲子外壬午，坎水戊寅外戊申，
//! 艮土丙辰外丙戌，震木庚子外庚午，
//! 巽木辛丑外辛未，离火己卯外己酉，
//! 坤土乙未外癸丑，兑金丁巳外丁亥。

use crate::types::*;

// ============================================================================
// 纳甲表
// ============================================================================

/// 内卦天干（根据八卦）
/// 乾纳甲，坤纳乙，震纳庚，巽纳辛，坎纳戊，离纳己，艮纳丙，兑纳丁
pub const INNER_GAN: [TianGan; 8] = [
    TianGan::Jia,  // 乾
    TianGan::Ding, // 兑
    TianGan::Ji,   // 离
    TianGan::Geng, // 震
    TianGan::Xin,  // 巽
    TianGan::Wu,   // 坎
    TianGan::Bing, // 艮
    TianGan::Yi,   // 坤
];

/// 外卦天干
/// 乾纳壬，坤纳癸，其他同内卦
pub const OUTER_GAN: [TianGan; 8] = [
    TianGan::Ren,  // 乾
    TianGan::Ding, // 兑
    TianGan::Ji,   // 离
    TianGan::Geng, // 震
    TianGan::Xin,  // 巽
    TianGan::Wu,   // 坎
    TianGan::Bing, // 艮
    TianGan::Gui,  // 坤
];

/// 八卦纳支起点和方向
/// 格式: (起始地支索引, 是否顺行)
/// 乾：子寅辰午申戌（顺行偶数）
/// 兑：巳卯丑亥酉未（逆行奇数）
/// 离：卯丑亥酉未巳（逆行奇数）
/// 震：子寅辰午申戌（顺行偶数）
/// 巽：丑亥酉未巳卯（逆行奇数）
/// 坎：寅辰午申戌子（顺行偶数）
/// 艮：辰午申戌子寅（顺行偶数）
/// 坤：未巳卯丑亥酉（逆行奇数）
pub const ZHI_START: [(u8, bool); 8] = [
    (0, true),   // 乾：子起，顺行+2
    (5, false),  // 兑：巳起，逆行-2
    (3, false),  // 离：卯起，逆行-2
    (0, true),   // 震：子起，顺行+2
    (1, false),  // 巽：丑起，逆行-2
    (2, true),   // 坎：寅起，顺行+2
    (4, true),   // 艮：辰起，顺行+2
    (7, false),  // 坤：未起，逆行-2
];

// ============================================================================
// 纳甲计算
// ============================================================================

/// 获取内卦某一爻的纳甲
/// trigram: 经卦
/// pos: 爻位（0=初爻, 1=二爻, 2=三爻）
pub fn get_inner_najia(trigram: Trigram, pos: u8) -> (TianGan, DiZhi) {
    let idx = trigram.index() as usize;
    let gan = INNER_GAN[idx];
    let (start, forward) = ZHI_START[idx];

    let zhi_idx = if forward {
        (start + pos * 2) % 12
    } else {
        (start + 12 - pos * 2) % 12
    };

    (gan, DiZhi::from_index(zhi_idx))
}

/// 获取外卦某一爻的纳甲
/// trigram: 经卦
/// pos: 爻位（0=四爻, 1=五爻, 2=上爻，对应内部位置0,1,2）
pub fn get_outer_najia(trigram: Trigram, pos: u8) -> (TianGan, DiZhi) {
    let idx = trigram.index() as usize;
    let gan = OUTER_GAN[idx];
    let (start, forward) = ZHI_START[idx];

    // 外卦地支从第四位开始
    let zhi_idx = if forward {
        (start + (pos + 3) * 2) % 12
    } else {
        (start + 12 - (pos + 3) * 2) % 12
    };

    (gan, DiZhi::from_index(zhi_idx))
}

// ============================================================================
// 卦宫与世应计算
// ============================================================================

/// 计算卦的世应和卦宫
///
/// 寻世诀：
/// 天同二世天变五，地同四世地变初。
/// 本宫六世三世异，人同游魂人变归。
///
/// 认宫诀：
/// 一二三六外卦宫，四五游魂内变更。
/// 若问归魂何所取，归魂内卦是本宫。
pub fn calculate_shi_ying_gong(inner: Trigram, outer: Trigram) -> (GuaXu, Trigram) {
    let inner_bin = inner.binary();
    let outer_bin = outer.binary();

    // 比较内外卦各爻
    let di_tong = (inner_bin & 0b001) == (outer_bin & 0b001);  // 初爻（地）
    let ren_tong = (inner_bin & 0b010) == (outer_bin & 0b010); // 二爻（人）
    let tian_tong = (inner_bin & 0b100) == (outer_bin & 0b100); // 三爻（天）

    let gua_xu;
    let gong;

    if inner_bin == outer_bin {
        // 本宫六世（纯卦）
        gua_xu = GuaXu::BenGong;
        gong = inner;
    } else if tian_tong && !ren_tong && !di_tong {
        // 天同二世
        gua_xu = GuaXu::ErShi;
        gong = outer;
    } else if !tian_tong && ren_tong && di_tong {
        // 天变五
        gua_xu = GuaXu::WuShi;
        gong = outer;
    } else if di_tong && !ren_tong && !tian_tong {
        // 地同四世
        gua_xu = GuaXu::SiShi;
        gong = Trigram::from_binary(inner_bin ^ 0b111);
    } else if !di_tong && ren_tong && tian_tong {
        // 地变初
        gua_xu = GuaXu::YiShi;
        gong = outer;
    } else if ren_tong && !tian_tong && !di_tong {
        // 人同游魂
        gua_xu = GuaXu::YouHun;
        gong = Trigram::from_binary(inner_bin ^ 0b111);
    } else if !ren_tong && tian_tong && di_tong {
        // 人变归魂
        gua_xu = GuaXu::GuiHun;
        gong = inner;
    } else {
        // 三世异
        gua_xu = GuaXu::SanShi;
        gong = outer;
    }

    (gua_xu, gong)
}

// ============================================================================
// 六神排布
// ============================================================================

/// 根据日干排六神
///
/// 六神配日干口诀：
/// 甲乙日起青龙，丙丁日起朱雀，
/// 戊日起勾陈，己日起螣蛇，
/// 庚辛日起白虎，壬癸日起玄武。
pub fn calculate_liu_shen(day_gan: TianGan) -> [LiuShen; 6] {
    let start = match day_gan {
        TianGan::Jia | TianGan::Yi => 0,       // 青龙
        TianGan::Bing | TianGan::Ding => 1,    // 朱雀
        TianGan::Wu => 2,                       // 勾陈
        TianGan::Ji => 3,                       // 螣蛇
        TianGan::Geng | TianGan::Xin => 4,     // 白虎
        TianGan::Ren | TianGan::Gui => 5,      // 玄武
    };

    let mut result = [LiuShen::QingLong; 6];
    for i in 0..6 {
        result[i] = LiuShen::from_index((start + i as u8) % 6);
    }
    result
}

// ============================================================================
// 旬空计算
// ============================================================================

/// 计算日旬空
///
/// 六十甲子分六旬，每旬十天，缺两个地支为空亡
pub fn calculate_xun_kong(day_gan: TianGan, day_zhi: DiZhi) -> (DiZhi, DiZhi) {
    let gan_idx = day_gan.index() as i8;
    let zhi_idx = day_zhi.index() as i8;

    // 计算旬首的地支索引
    // 旬首是甲X，从当前日期反推甲日的地支
    let mut xun_zhi = (zhi_idx - gan_idx + 12) % 12;
    if xun_zhi < 0 {
        xun_zhi += 12;
    }

    // 空亡是该旬缺失的两个地支
    // 每旬10天，地支12个，所以缺2个
    // 空亡地支 = 旬首地支 + 10 和 + 11
    let kong1 = DiZhi::from_index(((xun_zhi + 10) % 12) as u8);
    let kong2 = DiZhi::from_index(((xun_zhi + 11) % 12) as u8);

    (kong1, kong2)
}

// ============================================================================
// 伏神计算
// ============================================================================

/// 查找伏神
///
/// 当本卦六亲不全时，缺失的六亲从本宫纯卦中寻找伏神
pub fn find_fu_shen(
    gong: Trigram,
    original_liu_qin: &[LiuQin; 6],
) -> [Option<FuShenInfo>; 6] {
    let mut result: [Option<FuShenInfo>; 6] = [None, None, None, None, None, None];

    // 统计本卦已有的六亲
    let mut has_liu_qin = [false; 5];
    for qin in original_liu_qin.iter() {
        has_liu_qin[*qin as usize] = true;
    }

    // 如果五个六亲都有，则无伏神
    if has_liu_qin.iter().all(|&x| x) {
        return result;
    }

    // 获取本宫纯卦的纳甲
    let gong_wx = gong.wu_xing();

    for i in 0..6 {
        let (gan, zhi) = if i < 3 {
            get_inner_najia(gong, i as u8)
        } else {
            get_outer_najia(gong, (i - 3) as u8)
        };

        let yao_wx = zhi.wu_xing();
        let qin = LiuQin::from_wu_xing(gong_wx, yao_wx);

        // 如果这个六亲在本卦中缺失，则记录为伏神
        if !has_liu_qin[qin as usize] {
            result[i] = Some(FuShenInfo {
                position: i as u8,
                liu_qin: qin,
                tian_gan: gan,
                di_zhi: zhi,
                wu_xing: yao_wx,
            });
            has_liu_qin[qin as usize] = true; // 标记为已找到
        }
    }

    result
}

// ============================================================================
// 变卦计算
// ============================================================================

/// 计算变卦
/// 将动爻变化后得到变卦
pub fn calculate_bian_gua(original_yaos: &[Yao; 6]) -> (Trigram, Trigram, bool) {
    let mut has_bian = false;
    let mut inner_bin: u8 = 0;
    let mut outer_bin: u8 = 0;

    for i in 0..6 {
        let changed_val = original_yaos[i].changed_value();
        if original_yaos[i].is_moving() {
            has_bian = true;
        }

        if i < 3 {
            inner_bin |= changed_val << i;
        } else {
            outer_bin |= changed_val << (i - 3);
        }
    }

    (Trigram::from_binary(inner_bin), Trigram::from_binary(outer_bin), has_bian)
}

// ============================================================================
// 六十四卦索引计算
// ============================================================================

/// 从六爻计算内外卦
pub fn yaos_to_trigrams(yaos: &[Yao; 6]) -> (Trigram, Trigram) {
    let mut inner_bin: u8 = 0;
    let mut outer_bin: u8 = 0;

    for i in 0..3 {
        inner_bin |= yaos[i].original_value() << i;
    }
    for i in 3..6 {
        outer_bin |= yaos[i].original_value() << (i - 3);
    }

    (Trigram::from_binary(inner_bin), Trigram::from_binary(outer_bin))
}

/// 计算六十四卦索引
pub fn calculate_gua_index(inner: Trigram, outer: Trigram) -> u8 {
    // 使用内外卦的二进制值组合
    // 外卦在高3位，内卦在低3位
    let inner_idx = inner.binary();
    let outer_idx = outer.binary();
    (outer_idx << 3) | inner_idx
}

// ============================================================================
// 起卦方法
// ============================================================================

/// 从铜钱结果创建六爻
/// counts: 六次摇卦结果，每个值为阳面个数(0-3)
pub fn coins_to_yaos(counts: &[u8; 6]) -> [Yao; 6] {
    let mut yaos = [Yao::ShaoYin; 6];
    for i in 0..6 {
        yaos[i] = Yao::from_coin_count(counts[i]);
    }
    yaos
}

/// 从两个数字起卦（报数法）
/// num1: 上卦数
/// num2: 下卦数
/// dong: 动爻位置（1-6）
pub fn numbers_to_yaos(num1: u16, num2: u16, dong: u8) -> [Yao; 6] {
    let inner_idx = ((num2 - 1) % 8) as u8;
    let outer_idx = ((num1 - 1) % 8) as u8;

    let inner = Trigram::from_index(inner_idx);
    let outer = Trigram::from_index(outer_idx);

    let inner_bin = inner.binary();
    let outer_bin = outer.binary();

    let dong_pos = ((dong - 1) % 6) as usize;

    let mut yaos = [Yao::ShaoYin; 6];
    for i in 0..6 {
        let is_yang = if i < 3 {
            (inner_bin >> i) & 1 == 1
        } else {
            (outer_bin >> (i - 3)) & 1 == 1
        };

        if i == dong_pos {
            // 动爻
            yaos[i] = if is_yang { Yao::LaoYang } else { Yao::LaoYin };
        } else {
            // 静爻
            yaos[i] = if is_yang { Yao::ShaoYang } else { Yao::ShaoYin };
        }
    }

    yaos
}

/// 从随机数创建六爻
pub fn random_to_yaos(random_bytes: &[u8; 32]) -> [Yao; 6] {
    let mut yaos = [Yao::ShaoYin; 6];
    for i in 0..6 {
        // 每4个字节生成一个铜钱结果
        let coin_sum = (random_bytes[i * 4] as u16
            + random_bytes[i * 4 + 1] as u16
            + random_bytes[i * 4 + 2] as u16) % 4;
        yaos[i] = Yao::from_coin_count(coin_sum as u8);
    }
    yaos
}

/// 从时间起卦
/// year_zhi, month_zhi, day_zhi, hour_zhi: 年月日时地支索引
pub fn time_to_yaos(year_zhi: u8, month_zhi: u8, day_zhi: u8, hour_zhi: u8) -> [Yao; 6] {
    // 年月日时之和定上卦
    let sum1 = (year_zhi as u16 + month_zhi as u16 + day_zhi as u16) % 8;
    // 年月日时加时辰定下卦
    let sum2 = (year_zhi as u16 + month_zhi as u16 + day_zhi as u16 + hour_zhi as u16) % 8;
    // 总和定动爻
    let dong = ((year_zhi as u16 + month_zhi as u16 + day_zhi as u16 + hour_zhi as u16) % 6) as u8 + 1;

    numbers_to_yaos(sum1 + 1, sum2 + 1, dong)
}

// ============================================================================
// 动爻位图
// ============================================================================

/// 计算动爻位图
pub fn calculate_moving_bitmap(yaos: &[Yao; 6]) -> u8 {
    let mut bitmap: u8 = 0;
    for i in 0..6 {
        if yaos[i].is_moving() {
            bitmap |= 1 << i;
        }
    }
    bitmap
}

// ============================================================================
// 卦类型判断
// ============================================================================

/// 判断是否为六冲卦
/// 内外卦相同或特定组合为六冲
pub fn is_liu_chong(inner: Trigram, outer: Trigram) -> bool {
    // 纯卦为六冲
    if inner == outer {
        return true;
    }

    // 天雷无妄(乾震)和雷天大壮(震乾)也是六冲
    if (inner == Trigram::Qian && outer == Trigram::Zhen)
        || (inner == Trigram::Zhen && outer == Trigram::Qian)
    {
        return true;
    }

    false
}

/// 判断是否为六合卦
/// 特定卦名为六合
pub fn is_liu_he(gua_index: u8) -> bool {
    // 六合卦：否、困、旅、豫、节、贲、复、泰
    // 对应索引需要根据实际卦序确定
    matches!(gua_index, 59 | 49 | 41 | 33 | 17 | 9 | 1 | 3)
}
