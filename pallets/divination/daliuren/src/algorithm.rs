//! # 大六壬排盘算法
//!
//! 本模块实现大六壬排盘的核心算法，包括：
//! - 天盘布局
//! - 四课起法
//! - 三传取法（九种课式）
//! - 天将排布
//! - 空亡计算
//!
//! ## 大六壬起课口诀
//!
//! 月将加时辰，天盘顺时转。
//! 干支起四课，克贼定三传。
//!
//! ## 九种取三传方法
//!
//! 1. 贼克法：下贼上为贼，上克下为克
//! 2. 比用法：俱多先取与日干阴阳相同者
//! 3. 涉害法：涉害深者为用
//! 4. 遥克法：四课无克，二三四课克日干
//! 5. 昂星法：四课俱全无克，阳干取酉上神，阴干取酉所临
//! 6. 别责法：三课不备，阳干取干合地，阴干取支前四位
//! 7. 八专法：八专日（甲寅、庚申、丁未、己未）
//! 8. 伏吟法：天盘地盘相同
//! 9. 返吟法：天盘地盘六冲

extern crate alloc;
use alloc::vec::Vec;

use crate::types::*;

// ============================================================================
// 天盘计算
// ============================================================================

/// 根据月将和占时计算天盘
///
/// 月将加占时，天盘顺时针旋转
/// 例如：月将为午，占时为子，则午加子位，天盘顺转
pub fn calculate_tian_pan(yue_jiang: DiZhi, zhan_shi: DiZhi) -> TianPan {
    let mut positions = [DiZhi::Zi; 12];

    // 月将加占时：月将临占时的地盘位置
    // 天盘 = 月将 - (占时 - 子)
    let offset = zhan_shi.sub(DiZhi::Zi);
    let tian_yin = yue_jiang.add(-offset);

    // 填充天盘十二宫
    for i in 0..12 {
        positions[i] = tian_yin.add(i as i8);
    }

    TianPan { positions }
}

// ============================================================================
// 天将盘计算
// ============================================================================

/// 根据日干和昼夜计算天将盘
///
/// 贵人起法：
/// - 昼占用昼贵人
/// - 夜占用夜贵人
/// - 贵人临巳至戌逆布，否则顺布
pub fn calculate_tian_jiang_pan(
    tian_pan: &TianPan,
    day_gan: TianGan,
    is_day: bool,
) -> TianJiangPan {
    let mut positions = [TianJiang::GuiRen; 12];

    // 获取贵人所临天盘地支
    let gui_ren_zhi = get_gui_ren(day_gan, is_day);

    // 计算贵人所临地盘地支
    let gui_ren_di = tian_pan.lin(gui_ren_zhi);

    // 判断顺逆：贵人地盘临巳至戌为逆布
    let is_reverse = matches!(
        gui_ren_di,
        DiZhi::Si | DiZhi::Wu | DiZhi::Wei | DiZhi::Shen | DiZhi::You | DiZhi::Xu
    );

    // 布天将
    for i in 0..12 {
        let zhi = DiZhi::from_index(i as u8);
        let tian_zhi = tian_pan.get(zhi);

        // 计算该位置的天将
        let delta = if is_reverse {
            gui_ren_zhi.sub(tian_zhi)
        } else {
            tian_zhi.sub(gui_ren_zhi)
        };

        positions[i] = TianJiang::from_index(((delta + 12) % 12) as u8);
    }

    TianJiangPan { positions, is_reverse }
}

// ============================================================================
// 四课计算
// ============================================================================

/// 计算四课
///
/// 四课起法：
/// - 第一课：日干寄宫上神为干阳神
/// - 第二课：干阳神上神为干阴神
/// - 第三课：日支上神为支阳神
/// - 第四课：支阳神上神为支阴神
pub fn calculate_si_ke(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    day_gan: TianGan,
    day_zhi: DiZhi,
) -> SiKe {
    let day_wx = day_gan.wu_xing();

    // 日干寄宫
    let gan_ji_gong = get_ji_gong(day_gan);

    // 第一课：干阳神
    let gan_yang = tian_pan.get(gan_ji_gong);
    let ke1 = KeInfo {
        shang: gan_yang,
        xia: gan_ji_gong,
        tian_jiang: tian_jiang_pan.get(gan_yang),
        liu_qin: LiuQin::from_wu_xing(day_wx, gan_yang.wu_xing()),
    };

    // 第二课：干阴神
    let gan_yin = tian_pan.get(gan_yang);
    let ke2 = KeInfo {
        shang: gan_yin,
        xia: gan_yang,
        tian_jiang: tian_jiang_pan.get(gan_yin),
        liu_qin: LiuQin::from_wu_xing(day_wx, gan_yin.wu_xing()),
    };

    // 第三课：支阳神
    let zhi_yang = tian_pan.get(day_zhi);
    let ke3 = KeInfo {
        shang: zhi_yang,
        xia: day_zhi,
        tian_jiang: tian_jiang_pan.get(zhi_yang),
        liu_qin: LiuQin::from_wu_xing(day_wx, zhi_yang.wu_xing()),
    };

    // 第四课：支阴神
    let zhi_yin = tian_pan.get(zhi_yang);
    let ke4 = KeInfo {
        shang: zhi_yin,
        xia: zhi_yang,
        tian_jiang: tian_jiang_pan.get(zhi_yin),
        liu_qin: LiuQin::from_wu_xing(day_wx, zhi_yin.wu_xing()),
    };

    SiKe { ke1, ke2, ke3, ke4 }
}

// ============================================================================
// 三传计算（核心算法）
// ============================================================================

/// 计算三传和格局
///
/// 九种取三传方法：
/// 1. 先判断伏吟、返吟
/// 2. 贼克法
/// 3. 比用法
/// 4. 涉害法
/// 5. 遥克法
/// 6. 昂星法
/// 7. 别责法
/// 8. 八专法
pub fn calculate_san_chuan(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
) -> (SanChuan, KeShiType, GeJuType) {
    let day_wx = day_gan.wu_xing();

    // 判断伏吟（支阳神等于日支）
    if si_ke.ke3.shang == day_zhi {
        return calculate_fu_yin(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx);
    }

    // 判断返吟（支阳神冲日支）
    if si_ke.ke3.shang.is_chong(day_zhi) {
        return calculate_fan_yin(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx);
    }

    // 尝试贼克法
    if let Some(result) = try_zei_ke(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx) {
        return result;
    }

    // 尝试遥克法
    if let Some(result) = try_yao_ke(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx) {
        return result;
    }

    // 尝试昂星法
    if let Some(result) = try_ang_xing(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx) {
        return result;
    }

    // 尝试别责法
    if let Some(result) = try_bie_ze(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx) {
        return result;
    }

    // 尝试八专法
    if let Some(result) = try_ba_zhuan(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx) {
        return result;
    }

    // 默认返回（不应该到达这里）
    let chu = si_ke.ke1.shang;
    let zhong = tian_pan.get(chu);
    let mo = tian_pan.get(zhong);

    (
        build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
        KeShiType::ZeiKe,
        GeJuType::YuanShou,
    )
}

/// 伏吟课
fn calculate_fu_yin(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> (SanChuan, KeShiType, GeJuType) {
    // 伏吟：六乙、六癸日或阳干，取干阳神
    // 阴日非六乙、六癸，取支阳神
    let chu = if day_gan == TianGan::Yi || day_gan == TianGan::Gui || day_gan.is_yang() {
        si_ke.ke1.shang
    } else {
        si_ke.ke3.shang
    };

    // 中传取初传所刑
    let mut zhong = chu.xing();

    // 自刑处理
    if chu == zhong {
        zhong = if day_gan == TianGan::Yi || day_gan == TianGan::Gui || day_gan.is_yang() {
            si_ke.ke3.shang
        } else {
            si_ke.ke1.shang
        };
    }

    // 末传取中传所刑
    let mut mo = zhong.xing();

    // 中传自刑或初中互刑，取中冲
    if zhong == mo || zhong.xing() == chu {
        mo = zhong.liu_chong();
    }

    let ge_ju = if day_gan.is_yang() {
        GeJuType::ZiRen
    } else {
        GeJuType::ZiXin
    };

    (
        build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
        KeShiType::FuYin,
        ge_ju,
    )
}

/// 返吟课
fn calculate_fan_yin(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> (SanChuan, KeShiType, GeJuType) {
    // 先尝试贼克
    if let Some(result) = try_zei_ke(tian_pan, tian_jiang_pan, si_ke, day_gan, day_zhi, day_wx) {
        let (san_chuan, _, ge_ju) = result;
        return (san_chuan, KeShiType::FanYin, ge_ju);
    }

    // 无贼克，取驿马
    let yi_ma = day_zhi.yi_ma();
    let chu = yi_ma;
    let zhong = si_ke.ke3.shang;
    let mo = si_ke.ke1.shang;

    (
        build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
        KeShiType::FanYin,
        GeJuType::WuYi,
    )
}

/// 尝试贼克法
fn try_zei_ke(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> Option<(SanChuan, KeShiType, GeJuType)> {
    let ke_list = [&si_ke.ke1, &si_ke.ke2, &si_ke.ke3, &si_ke.ke4];

    // 收集所有贼（下克上）
    let mut zei_list: Vec<(usize, &KeInfo)> = Vec::new();
    for (i, ke) in ke_list.iter().enumerate() {
        if ke.xia.wu_xing().ke(ke.shang.wu_xing()) {
            zei_list.push((i, ke));
        }
    }

    // 收集所有克（上克下）
    let mut ke_list_clone: Vec<(usize, &KeInfo)> = Vec::new();
    for (i, ke) in ke_list.iter().enumerate() {
        if ke.shang.wu_xing().ke(ke.xia.wu_xing()) {
            ke_list_clone.push((i, ke));
        }
    }

    // 先看贼
    if !zei_list.is_empty() {
        // 去重
        let mut unique_zei: Vec<(usize, &KeInfo)> = Vec::new();
        for item in zei_list.iter() {
            if !unique_zei.iter().any(|(_, k)| k.shang == item.1.shang) {
                unique_zei.push(*item);
            }
        }

        if unique_zei.len() == 1 {
            let chu = unique_zei[0].1.shang;
            let zhong = tian_pan.get(chu);
            let mo = tian_pan.get(zhong);
            return Some((
                build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
                KeShiType::ZeiKe,
                GeJuType::ChongShen,
            ));
        } else if unique_zei.len() > 1 {
            return try_bi_yong(tian_pan, tian_jiang_pan, &unique_zei, day_gan, day_zhi, day_wx, true);
        }
    }

    // 再看克
    if !ke_list_clone.is_empty() {
        // 去重
        let mut unique_ke: Vec<(usize, &KeInfo)> = Vec::new();
        for item in ke_list_clone.iter() {
            if !unique_ke.iter().any(|(_, k)| k.shang == item.1.shang) {
                unique_ke.push(*item);
            }
        }

        if unique_ke.len() == 1 {
            let chu = unique_ke[0].1.shang;
            let zhong = tian_pan.get(chu);
            let mo = tian_pan.get(zhong);
            return Some((
                build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
                KeShiType::ZeiKe,
                GeJuType::YuanShou,
            ));
        } else if unique_ke.len() > 1 {
            return try_bi_yong(tian_pan, tian_jiang_pan, &unique_ke, day_gan, day_zhi, day_wx, false);
        }
    }

    None
}

/// 比用法
fn try_bi_yong(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    ke_candidates: &[(usize, &KeInfo)],
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
    is_zei: bool,
) -> Option<(SanChuan, KeShiType, GeJuType)> {
    let gan_ji_gong = get_ji_gong(day_gan);
    let gan_is_yang = (gan_ji_gong.index() % 2) == 0;

    // 筛选阴阳相同者
    let mut bi_list: Vec<(usize, &KeInfo)> = Vec::new();
    for item in ke_candidates.iter() {
        let shang_is_yang = (item.1.shang.index() % 2) == 0;
        if shang_is_yang == gan_is_yang {
            bi_list.push(*item);
        }
    }

    if bi_list.len() == 1 {
        let chu = bi_list[0].1.shang;
        let zhong = tian_pan.get(chu);
        let mo = tian_pan.get(zhong);
        return Some((
            build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
            KeShiType::BiYong,
            GeJuType::ZhiYi,
        ));
    } else if bi_list.is_empty() {
        // 俱不比，用涉害
        return try_she_hai(tian_pan, tian_jiang_pan, ke_candidates, day_gan, day_zhi, day_wx, is_zei);
    } else {
        // 多个俱比，用涉害
        return try_she_hai(tian_pan, tian_jiang_pan, &bi_list, day_gan, day_zhi, day_wx, is_zei);
    }
}

/// 涉害法
fn try_she_hai(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    ke_candidates: &[(usize, &KeInfo)],
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
    is_zei: bool,
) -> Option<(SanChuan, KeShiType, GeJuType)> {
    // 计算各课涉害深度
    let mut depth_list: Vec<(usize, &KeInfo, u8)> = Vec::new();

    for item in ke_candidates.iter() {
        let shang = item.1.shang;
        let lin_di = tian_pan.lin(shang);
        let mut count: u8 = 0;

        // 从所临地盘支遍历到天盘支
        for i in 0..12 {
            let d = lin_di.add(i as i8);
            if d == shang {
                break;
            }

            if is_zei {
                // 贼：数下克上
                if d.wu_xing().ke(shang.wu_xing()) {
                    count += 1;
                }
            } else {
                // 克：数上克下
                if shang.wu_xing().ke(d.wu_xing()) {
                    count += 1;
                }
            }
        }

        depth_list.push((item.0, item.1, count));
    }

    // 找最大涉害深度
    let max_depth = depth_list.iter().map(|(_, _, d)| *d).max().unwrap_or(0);
    let max_list: Vec<_> = depth_list.iter().filter(|(_, _, d)| *d == max_depth).collect();

    if max_list.len() == 1 {
        let chu = max_list[0].1.shang;
        let zhong = tian_pan.get(chu);
        let mo = tian_pan.get(zhong);
        return Some((
            build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
            KeShiType::SheHai,
            GeJuType::SheHaiGe,
        ));
    }

    // 涉害同，从孟发用
    for item in max_list.iter() {
        let lin_di = tian_pan.lin(item.1.shang);
        if lin_di.is_meng() {
            let chu = item.1.shang;
            let zhong = tian_pan.get(chu);
            let mo = tian_pan.get(zhong);
            return Some((
                build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
                KeShiType::SheHai,
                GeJuType::JianJi,
            ));
        }
    }

    // 从仲发用
    for item in max_list.iter() {
        let lin_di = tian_pan.lin(item.1.shang);
        if lin_di.is_zhong() {
            let chu = item.1.shang;
            let zhong = tian_pan.get(chu);
            let mo = tian_pan.get(zhong);
            return Some((
                build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
                KeShiType::SheHai,
                GeJuType::ChaWei,
            ));
        }
    }

    // 复等：阳干取干阳神，阴干取支阳神
    let gan_ji_gong = get_ji_gong(day_gan);
    let chu = if day_gan.is_yang() {
        tian_pan.get(gan_ji_gong)
    } else {
        tian_pan.get(day_zhi)
    };
    let zhong = tian_pan.get(chu);
    let mo = tian_pan.get(zhong);

    Some((
        build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
        KeShiType::SheHai,
        GeJuType::FuDeng,
    ))
}

/// 遥克法
fn try_yao_ke(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> Option<(SanChuan, KeShiType, GeJuType)> {
    // 八专日不用遥克
    if is_ba_zhuan_day(day_gan, day_zhi) {
        return None;
    }

    let ke_list = [&si_ke.ke2, &si_ke.ke3, &si_ke.ke4];

    // 二三四课克日干
    let mut ko_list: Vec<&KeInfo> = Vec::new();
    for ke in ke_list.iter() {
        if ke.shang.wu_xing().ke(day_wx) {
            ko_list.push(ke);
        }
    }

    // 如果没有克日干的，看日干克的
    if ko_list.is_empty() {
        for ke in ke_list.iter() {
            if day_wx.ke(ke.shang.wu_xing()) {
                ko_list.push(ke);
            }
        }
    }

    if ko_list.is_empty() {
        return None;
    }

    // 去重
    let mut unique_ko: Vec<&KeInfo> = Vec::new();
    for ke in ko_list.iter() {
        if !unique_ko.iter().any(|k| k.shang == ke.shang) {
            unique_ko.push(ke);
        }
    }

    if unique_ko.len() == 1 {
        let chu = unique_ko[0].shang;
        let zhong = tian_pan.get(chu);
        let mo = tian_pan.get(zhong);
        return Some((
            build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
            KeShiType::YaoKe,
            GeJuType::YaoKeGe,
        ));
    }

    // 多个遥克，用比用
    let candidates: Vec<(usize, &KeInfo)> = unique_ko.iter().enumerate().map(|(i, k)| (i, *k)).collect();
    try_bi_yong(tian_pan, tian_jiang_pan, &candidates, day_gan, day_zhi, day_wx, false)
}

/// 昂星法
fn try_ang_xing(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> Option<(SanChuan, KeShiType, GeJuType)> {
    // 检查四课是否俱全（无重复）
    let ke_shangs = [
        si_ke.ke1.shang,
        si_ke.ke2.shang,
        si_ke.ke3.shang,
        si_ke.ke4.shang,
    ];

    let mut unique_count = 0;
    let mut seen = [false; 12];
    for shang in ke_shangs.iter() {
        if !seen[shang.index() as usize] {
            seen[shang.index() as usize] = true;
            unique_count += 1;
        }
    }

    if unique_count != 4 {
        return None;
    }

    // 阳干：酉上神为初传
    // 阴干：酉所临地盘支为初传
    let chu;
    let ge_ju;

    if day_gan.is_yang() {
        chu = tian_pan.get(DiZhi::You);
        ge_ju = GeJuType::HuShi;
    } else {
        chu = tian_pan.lin(DiZhi::You);
        ge_ju = GeJuType::DongSheYanMu;
    }

    let zhong = si_ke.ke3.shang;
    let mo = si_ke.ke1.shang;

    Some((
        build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
        KeShiType::AngXing,
        ge_ju,
    ))
}

/// 别责法
fn try_bie_ze(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> Option<(SanChuan, KeShiType, GeJuType)> {
    // 检查是否三课不备
    let ke_shangs = [
        si_ke.ke1.shang,
        si_ke.ke2.shang,
        si_ke.ke3.shang,
        si_ke.ke4.shang,
    ];

    let mut unique_count = 0;
    let mut seen = [false; 12];
    for shang in ke_shangs.iter() {
        if !seen[shang.index() as usize] {
            seen[shang.index() as usize] = true;
            unique_count += 1;
        }
    }

    if unique_count != 3 {
        return None;
    }

    // 阳干：干合神上神
    // 阴干：支前四位
    let chu;

    if day_gan.is_yang() {
        // 干合：甲己合、乙庚合、丙辛合、丁壬合、戊癸合
        let he_gan = day_gan.add(5);
        let he_ji_gong = get_ji_gong(he_gan);
        chu = tian_pan.get(he_ji_gong);
    } else {
        chu = day_zhi.add(4);
    }

    let zhong = si_ke.ke1.shang;
    let mo = zhong;

    Some((
        build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
        KeShiType::BieZe,
        GeJuType::BieZeGe,
    ))
}

/// 八专法
fn try_ba_zhuan(
    tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    si_ke: &SiKe,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> Option<(SanChuan, KeShiType, GeJuType)> {
    if !is_ba_zhuan_day(day_gan, day_zhi) {
        return None;
    }

    // 阳干：干阳神前二位
    // 阴干：支阴神后二位
    let chu;

    if day_gan.is_yang() {
        chu = si_ke.ke1.shang.add(2);
    } else {
        chu = si_ke.ke4.shang.add(-2);
    }

    let zhong = si_ke.ke1.shang;
    let mo = zhong;

    Some((
        build_san_chuan(tian_pan, tian_jiang_pan, chu, zhong, mo, day_gan, day_zhi, day_wx),
        KeShiType::BaZhuan,
        GeJuType::BaZhuanGe,
    ))
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 构建三传结构
fn build_san_chuan(
    _tian_pan: &TianPan,
    tian_jiang_pan: &TianJiangPan,
    chu: DiZhi,
    zhong: DiZhi,
    mo: DiZhi,
    day_gan: TianGan,
    day_zhi: DiZhi,
    day_wx: WuXing,
) -> SanChuan {
    SanChuan {
        chu,
        zhong,
        mo,
        chu_jiang: tian_jiang_pan.get(chu),
        zhong_jiang: tian_jiang_pan.get(zhong),
        mo_jiang: tian_jiang_pan.get(mo),
        chu_qin: LiuQin::from_wu_xing(day_wx, chu.wu_xing()),
        zhong_qin: LiuQin::from_wu_xing(day_wx, zhong.wu_xing()),
        mo_qin: LiuQin::from_wu_xing(day_wx, mo.wu_xing()),
        chu_dun: calculate_dun_gan(chu, day_gan, day_zhi),
        zhong_dun: calculate_dun_gan(zhong, day_gan, day_zhi),
        mo_dun: calculate_dun_gan(mo, day_gan, day_zhi),
    }
}

/// 计算遁干
pub fn calculate_dun_gan(zhi: DiZhi, day_gan: TianGan, day_zhi: DiZhi) -> Option<TianGan> {
    // 计算旬首
    let delta = day_gan.index() as i8;
    let xun_shou = day_zhi.add(-delta);

    // 计算地支在旬中的位置
    let pos = zhi.sub(xun_shou);

    // 空亡（位置10、11）无遁干
    if pos >= 10 {
        return None;
    }

    Some(TianGan::from_index(pos as u8))
}

/// 计算空亡
pub fn calculate_xun_kong(day_gan: TianGan, day_zhi: DiZhi) -> (DiZhi, DiZhi) {
    let delta = day_gan.index() as i8;
    let xun_shou = day_zhi.add(-delta);

    let kong1 = xun_shou.add(10);
    let kong2 = xun_shou.add(11);

    (kong1, kong2)
}

/// 从随机数生成式盘参数
pub fn random_to_params(random_bytes: &[u8; 32]) -> (DiZhi, DiZhi, bool) {
    let yue_jiang = DiZhi::from_index(random_bytes[0] % 12);
    let zhan_shi = DiZhi::from_index(random_bytes[1] % 12);
    let is_day = random_bytes[2] % 2 == 0;

    (yue_jiang, zhan_shi, is_day)
}
