//! # 奇门遁甲排盘算法模块
//!
//! 本模块实现奇门遁甲的核心排盘算法，包括：
//! - 阴阳遁和局数确定
//! - 地盘三奇六仪排布
//! - 天盘九星排布
//! - 人盘八门排布
//! - 神盘八神排布
//! - 值符值使计算
//!
//! ## 排盘流程
//!
//! 1. 根据节气确定阴阳遁
//! 2. 根据三元确定局数
//! 3. 排布地盘三奇六仪（固定）
//! 4. 找出旬首，确定值符和值使
//! 5. 根据时辰排布天盘九星
//! 6. 根据时辰排布人盘八门
//! 7. 根据值符排布神盘八神

use crate::types::*;

// ==================== 常量定义 ====================

/// 阳遁局数表（节气 × 三元）
///
/// 按节气顺序：冬至、小寒、大寒、立春、雨水、惊蛰、春分、清明、谷雨、立夏、小满、芒种
/// 每个节气对应上中下三元的局数
pub const YANG_DUN_JU: [[u8; 3]; 12] = [
    [1, 7, 4], // 冬至
    [2, 8, 5], // 小寒
    [3, 9, 6], // 大寒
    [8, 5, 2], // 立春
    [9, 6, 3], // 雨水
    [1, 7, 4], // 惊蛰
    [3, 9, 6], // 春分
    [4, 1, 7], // 清明
    [5, 2, 8], // 谷雨
    [4, 1, 7], // 立夏
    [5, 2, 8], // 小满
    [6, 3, 9], // 芒种
];

/// 阴遁局数表（节气 × 三元）
///
/// 按节气顺序：夏至、小暑、大暑、立秋、处暑、白露、秋分、寒露、霜降、立冬、小雪、大雪
/// 每个节气对应上中下三元的局数
pub const YIN_DUN_JU: [[u8; 3]; 12] = [
    [9, 3, 6], // 夏至
    [8, 2, 5], // 小暑
    [7, 1, 4], // 大暑
    [2, 5, 8], // 立秋
    [1, 4, 7], // 处暑
    [9, 3, 6], // 白露
    [7, 1, 4], // 秋分
    [6, 9, 3], // 寒露
    [5, 8, 2], // 霜降
    [6, 9, 3], // 立冬
    [5, 8, 2], // 小雪
    [4, 7, 1], // 大雪
];

/// 地盘三奇六仪排布（阳遁，从坎一宫开始顺排）
///
/// 戊己庚辛壬癸丁丙乙（六仪在前，三奇在后）
pub const DI_PAN_YANG: [TianGan; 9] = [
    TianGan::Wu,   // 坎一宫：戊
    TianGan::Ji,   // 坤二宫：己
    TianGan::Geng, // 震三宫：庚
    TianGan::Xin,  // 巽四宫：辛
    TianGan::Ren,  // 中五宫：壬（寄坤二宫/艮八宫）
    TianGan::Gui,  // 乾六宫：癸
    TianGan::Ding, // 兑七宫：丁
    TianGan::Bing, // 艮八宫：丙
    TianGan::Yi,   // 离九宫：乙
];

/// 六十甲子旬首表
///
/// 每旬的旬首天干地支和对应的遁甲（六仪）
pub const XUN_SHOU: [(TianGan, DiZhi, TianGan); 6] = [
    (TianGan::Jia, DiZhi::Zi, TianGan::Wu),   // 甲子旬，遁甲于戊
    (TianGan::Jia, DiZhi::Xu, TianGan::Ji),   // 甲戌旬，遁甲于己
    (TianGan::Jia, DiZhi::Shen, TianGan::Geng), // 甲申旬，遁甲于庚
    (TianGan::Jia, DiZhi::Wu, TianGan::Xin),  // 甲午旬，遁甲于辛
    (TianGan::Jia, DiZhi::Chen, TianGan::Ren), // 甲辰旬，遁甲于壬
    (TianGan::Jia, DiZhi::Yin, TianGan::Gui), // 甲寅旬，遁甲于癸
];

/// 九宫飞布顺序（阳遁，顺时针）
///
/// 从坎一宫开始的顺时针顺序：1→8→3→4→9→2→7→6
pub const GONG_ORDER_YANG: [u8; 8] = [1, 8, 3, 4, 9, 2, 7, 6];

/// 九宫飞布顺序（阴遁，逆时针）
///
/// 从坎一宫开始的逆时针顺序：1→6→7→2→9→4→3→8
pub const GONG_ORDER_YIN: [u8; 8] = [1, 6, 7, 2, 9, 4, 3, 8];

/// 八神顺序（固定）
///
/// 值符、腾蛇、太阴、六合、白虎、玄武、九地、九天
pub const BA_SHEN_ORDER: [BaShen; 8] = [
    BaShen::ZhiFu,
    BaShen::TengShe,
    BaShen::TaiYin,
    BaShen::LiuHe,
    BaShen::BaiHu,
    BaShen::XuanWu,
    BaShen::JiuDi,
    BaShen::JiuTian,
];

// ==================== 核心算法 ====================

/// 计算阴阳遁类型
///
/// 根据节气判断：冬至到夏至前为阳遁，夏至到冬至前为阴遁
pub fn calc_dun_type(jie_qi: JieQi) -> DunType {
    if jie_qi.is_yang_dun() {
        DunType::Yang
    } else {
        DunType::Yin
    }
}

/// 计算三元
///
/// 根据节气内的天数（1-15天），判断上中下三元
/// - 上元：第1-5天
/// - 中元：第6-10天
/// - 下元：第11-15天
pub fn calc_san_yuan(day_in_jieqi: u8) -> SanYuan {
    if day_in_jieqi <= 5 {
        SanYuan::Shang
    } else if day_in_jieqi <= 10 {
        SanYuan::Zhong
    } else {
        SanYuan::Xia
    }
}

/// 计算局数
///
/// 根据节气、三元和阴阳遁查表获取局数
pub fn calc_ju_number(jie_qi: JieQi, san_yuan: SanYuan, dun_type: DunType) -> u8 {
    let jieqi_index = (jie_qi as u8) % 12;
    let yuan_index = match san_yuan {
        SanYuan::Shang => 0,
        SanYuan::Zhong => 1,
        SanYuan::Xia => 2,
    };

    match dun_type {
        DunType::Yang => YANG_DUN_JU[jieqi_index as usize][yuan_index],
        DunType::Yin => YIN_DUN_JU[jieqi_index as usize][yuan_index],
    }
}

/// 获取地盘三奇六仪排布
///
/// 根据局数确定地盘排布起点，然后按顺序排布
pub fn get_di_pan(ju_number: u8, dun_type: DunType) -> [TianGan; 9] {
    let mut di_pan = [TianGan::Jia; 9];

    // 地盘起始位置（局数决定戊落宫）
    // 阳遁：局数即为戊所在宫
    // 阴遁：局数即为戊所在宫
    let start_gong = ju_number;

    // 三奇六仪顺序：戊己庚辛壬癸丁丙乙
    let san_qi_liu_yi = [
        TianGan::Wu, TianGan::Ji, TianGan::Geng, TianGan::Xin,
        TianGan::Ren, TianGan::Gui, TianGan::Ding, TianGan::Bing, TianGan::Yi,
    ];

    let gong_order = match dun_type {
        DunType::Yang => &GONG_ORDER_YANG,
        DunType::Yin => &GONG_ORDER_YIN,
    };

    // 找到起始宫在顺序中的位置
    let start_pos = gong_order.iter().position(|&g| g == start_gong).unwrap_or(0);

    // 按顺序排布（跳过中宫）
    for (i, &gan) in san_qi_liu_yi.iter().enumerate() {
        let gong_index = (start_pos + i) % 8;
        let gong_num = gong_order[gong_index];

        // 宫数转数组索引（1-9 转 0-8）
        let array_index = gong_num.saturating_sub(1) as usize;
        if array_index < 9 {
            di_pan[array_index] = gan;
        }
    }

    // 中宫寄宫处理（中宫的地盘干取决于局数）
    // 阳遁寄坤二宫，阴遁寄艮八宫
    let zhong_gan = match dun_type {
        DunType::Yang => di_pan[1], // 坤二宫
        DunType::Yin => di_pan[7],  // 艮八宫
    };
    di_pan[4] = zhong_gan;

    di_pan
}

/// 获取时干所在旬首
///
/// 返回旬首的六仪（戊己庚辛壬癸之一）
pub fn get_xun_shou(shi_gan: TianGan, shi_zhi: DiZhi) -> TianGan {
    // 计算六十甲子序号
    let gan_idx = shi_gan.index() as u16;
    let zhi_idx = shi_zhi.index() as u16;

    // 干支组合的六十甲子序号
    let sexagenary = ((gan_idx * 6 + zhi_idx * 5) % 60) as u8;

    // 每旬10个干支，确定在第几旬
    let xun_index = (sexagenary / 10) as usize;

    if xun_index < XUN_SHOU.len() {
        XUN_SHOU[xun_index].2 // 返回遁甲所用的六仪
    } else {
        TianGan::Wu // 默认戊
    }
}

/// 获取旬空地支
///
/// 返回当前时辰所在旬的两个旬空地支
pub fn get_xun_kong(shi_gan: TianGan, shi_zhi: DiZhi) -> (DiZhi, DiZhi) {
    let gan_idx = shi_gan.index();
    let zhi_idx = shi_zhi.index();

    // 计算旬首的地支
    let xun_shou_zhi = (zhi_idx + 12 - gan_idx) % 12;

    // 旬空是旬首后第10、11个地支
    let kong1 = DiZhi::from_index((xun_shou_zhi + 10) % 12).unwrap_or(DiZhi::Zi);
    let kong2 = DiZhi::from_index((xun_shou_zhi + 11) % 12).unwrap_or(DiZhi::Chou);

    (kong1, kong2)
}

/// 查找天干在地盘的落宫
///
/// 返回该天干在地盘中的宫位（1-9）
pub fn find_gan_in_di_pan(gan: TianGan, di_pan: &[TianGan; 9]) -> Option<u8> {
    for (i, &g) in di_pan.iter().enumerate() {
        if g == gan {
            return Some((i + 1) as u8);
        }
    }
    None
}

/// 计算值符星
///
/// 值符星 = 旬首六仪所在宫的原始九星
pub fn calc_zhi_fu_xing(xun_shou_yi: TianGan, di_pan: &[TianGan; 9]) -> JiuXing {
    // 找到旬首六仪在地盘的落宫
    let gong = find_gan_in_di_pan(xun_shou_yi, di_pan).unwrap_or(1);

    // 返回该宫的原始九星
    JiuXing::from_num(gong).unwrap_or(JiuXing::TianPeng)
}

/// 计算值使门
///
/// 值使门 = 旬首六仪所在宫的原始八门
pub fn calc_zhi_shi_men(xun_shou_yi: TianGan, di_pan: &[TianGan; 9]) -> BaMen {
    // 找到旬首六仪在地盘的落宫
    let gong = find_gan_in_di_pan(xun_shou_yi, di_pan).unwrap_or(1);

    // 中宫（5）没有门，寄到二宫或八宫
    let door_gong = if gong == 5 { 2 } else { gong };

    // 返回该宫的原始八门
    BaMen::from_num(door_gong).unwrap_or(BaMen::Xiu)
}

/// 排布天盘九星
///
/// 根据值符星的当前落宫，按阴阳遁方向排布其他八星
pub fn distribute_jiu_xing(
    zhi_fu_xing: JiuXing,
    shi_gan: TianGan,
    di_pan: &[TianGan; 9],
    dun_type: DunType,
) -> [JiuXing; 9] {
    let mut tian_pan = [JiuXing::TianQin; 9];

    // 时干寄宫：找到时干在地盘的位置，就是值符星的天盘落宫
    let shi_gan_gong = find_gan_in_di_pan(shi_gan, di_pan).unwrap_or(1);

    let gong_order = match dun_type {
        DunType::Yang => &GONG_ORDER_YANG,
        DunType::Yin => &GONG_ORDER_YIN,
    };

    // 找到值符星落宫在顺序中的位置
    let start_pos = gong_order.iter().position(|&g| g == shi_gan_gong).unwrap_or(0);

    // 九星排列顺序（从值符星开始）
    let xing_start = zhi_fu_xing.num() as usize;

    // 按顺序排布九星
    for i in 0..8 {
        let xing_num = ((xing_start - 1 + i) % 8) + 1;
        let xing = JiuXing::from_num(xing_num as u8).unwrap_or(JiuXing::TianPeng);

        let gong_index = (start_pos + i) % 8;
        let gong_num = gong_order[gong_index];
        let array_index = gong_num.saturating_sub(1) as usize;

        if array_index < 9 {
            tian_pan[array_index] = xing;
        }
    }

    // 中宫放天禽星
    tian_pan[4] = JiuXing::TianQin;

    tian_pan
}

/// 排布人盘八门
///
/// 根据值使门的当前落宫，按阴阳遁方向排布其他七门
pub fn distribute_ba_men(
    zhi_shi_men: BaMen,
    shi_gan: TianGan,
    di_pan: &[TianGan; 9],
    dun_type: DunType,
) -> [Option<BaMen>; 9] {
    let mut ren_pan: [Option<BaMen>; 9] = [None; 9];

    // 时干寄宫
    let shi_gan_gong = find_gan_in_di_pan(shi_gan, di_pan).unwrap_or(1);

    let gong_order = match dun_type {
        DunType::Yang => &GONG_ORDER_YANG,
        DunType::Yin => &GONG_ORDER_YIN,
    };

    // 找到值使门落宫在顺序中的位置
    let start_pos = gong_order.iter().position(|&g| g == shi_gan_gong).unwrap_or(0);

    // 八门排列顺序（从值使门开始）
    let men_start = zhi_shi_men.num() as usize;

    // 按顺序排布八门
    for i in 0..8 {
        let men_num = ((men_start - 1 + i) % 8) + 1;
        let men = BaMen::from_num(men_num as u8).unwrap_or(BaMen::Xiu);

        let gong_index = (start_pos + i) % 8;
        let gong_num = gong_order[gong_index];
        let array_index = gong_num.saturating_sub(1) as usize;

        if array_index < 9 && array_index != 4 {
            ren_pan[array_index] = Some(men);
        }
    }

    // 中宫无门
    ren_pan[4] = None;

    ren_pan
}

/// 排布神盘八神
///
/// 八神从值符落宫开始，按固定顺序排布
pub fn distribute_ba_shen(
    zhi_fu_gong: u8,
    dun_type: DunType,
) -> [Option<BaShen>; 9] {
    let mut shen_pan: [Option<BaShen>; 9] = [None; 9];

    let gong_order = match dun_type {
        DunType::Yang => &GONG_ORDER_YANG,
        DunType::Yin => &GONG_ORDER_YIN,
    };

    // 找到值符落宫在顺序中的位置
    let start_pos = gong_order.iter().position(|&g| g == zhi_fu_gong).unwrap_or(0);

    // 按固定顺序排布八神
    for (i, &shen) in BA_SHEN_ORDER.iter().enumerate() {
        let gong_index = (start_pos + i) % 8;
        let gong_num = gong_order[gong_index];
        let array_index = gong_num.saturating_sub(1) as usize;

        if array_index < 9 && array_index != 4 {
            shen_pan[array_index] = Some(shen);
        }
    }

    // 中宫无神
    shen_pan[4] = None;

    shen_pan
}

/// 获取天盘干
///
/// 天盘干随九星移动，根据九星在天盘的位置确定
pub fn get_tian_pan_gan(
    xing: JiuXing,
    di_pan: &[TianGan; 9],
) -> TianGan {
    // 九星原始宫位的地盘干就是该星携带的天盘干
    let original_gong = xing.original_palace().num();
    let array_index = original_gong.saturating_sub(1) as usize;

    if array_index < 9 {
        di_pan[array_index]
    } else {
        TianGan::Jia
    }
}

/// 完整排盘算法
///
/// 输入四柱和节气信息，输出完整的奇门遁甲盘
pub fn generate_qimen_chart(
    _year_gz: GanZhi,
    _month_gz: GanZhi,
    _day_gz: GanZhi,
    hour_gz: GanZhi,
    jie_qi: JieQi,
    day_in_jieqi: u8,
) -> (DunType, SanYuan, u8, JiuXing, BaMen, [Palace; 9]) {
    // 1. 确定阴阳遁
    let dun_type = calc_dun_type(jie_qi);

    // 2. 确定三元
    let san_yuan = calc_san_yuan(day_in_jieqi);

    // 3. 确定局数
    let ju_number = calc_ju_number(jie_qi, san_yuan, dun_type);

    // 4. 排布地盘
    let di_pan = get_di_pan(ju_number, dun_type);

    // 5. 确定旬首六仪
    let xun_shou_yi = get_xun_shou(hour_gz.gan, hour_gz.zhi);

    // 6. 计算值符星和值使门
    let zhi_fu_xing = calc_zhi_fu_xing(xun_shou_yi, &di_pan);
    let zhi_shi_men = calc_zhi_shi_men(xun_shou_yi, &di_pan);

    // 7. 排布天盘九星
    let tian_pan_xing = distribute_jiu_xing(zhi_fu_xing, hour_gz.gan, &di_pan, dun_type);

    // 8. 排布人盘八门
    let ren_pan_men = distribute_ba_men(zhi_shi_men, hour_gz.gan, &di_pan, dun_type);

    // 9. 找到值符落宫，排布神盘八神
    let zhi_fu_gong = find_gan_in_di_pan(hour_gz.gan, &di_pan).unwrap_or(1);
    let shen_pan_shen = distribute_ba_shen(zhi_fu_gong, dun_type);

    // 10. 获取旬空
    let (kong1, kong2) = get_xun_kong(hour_gz.gan, hour_gz.zhi);

    // 11. 组装九宫
    let mut palaces = [Palace::empty(JiuGong::Kan); 9];

    for i in 0..9 {
        let gong = JiuGong::from_num((i + 1) as u8).unwrap_or(JiuGong::Kan);
        let xing = tian_pan_xing[i];
        let tian_pan_gan = get_tian_pan_gan(xing, &di_pan);

        // 检查是否旬空（根据地盘干对应的地支）
        let di_pan_zhi = match di_pan[i] {
            TianGan::Wu => DiZhi::Zi,   // 戊遁甲子
            TianGan::Ji => DiZhi::Xu,   // 己遁甲戌
            TianGan::Geng => DiZhi::Shen, // 庚遁甲申
            TianGan::Xin => DiZhi::Wu,  // 辛遁甲午
            TianGan::Ren => DiZhi::Chen, // 壬遁甲辰
            TianGan::Gui => DiZhi::Yin, // 癸遁甲寅
            _ => DiZhi::Zi,
        };
        let is_xun_kong = di_pan_zhi == kong1 || di_pan_zhi == kong2;

        palaces[i] = Palace {
            gong,
            tian_pan_gan,
            di_pan_gan: di_pan[i],
            xing,
            men: ren_pan_men[i],
            shen: shen_pan_shen[i],
            is_xun_kong,
            is_ma_xing: false, // 马星计算较复杂，暂时忽略
        };
    }

    (dun_type, san_yuan, ju_number, zhi_fu_xing, zhi_shi_men, palaces)
}

/// 从数字生成排盘
///
/// 使用两个数字和区块哈希生成局数
pub fn generate_from_numbers(
    numbers: &[u16],
    block_hash: &[u8; 32],
) -> u8 {
    if numbers.is_empty() {
        return 1;
    }

    // 累加数字
    let sum: u32 = numbers.iter().map(|&n| n as u32).sum();

    // 混合区块哈希
    let hash_sum: u32 = block_hash.iter().take(4).fold(0u32, |acc, &b| acc.wrapping_add(b as u32));

    // 计算局数（1-9）
    let combined = sum.wrapping_add(hash_sum);
    ((combined % 9) + 1) as u8
}

/// 从随机数生成排盘
///
/// 使用随机种子生成局数和阴阳遁
pub fn generate_from_random(random_seed: &[u8; 32]) -> (DunType, u8) {
    // 使用前几个字节决定阴阳遁
    let dun_type = if random_seed[0] % 2 == 0 {
        DunType::Yang
    } else {
        DunType::Yin
    };

    // 使用后几个字节决定局数
    let ju_number = (random_seed[1] % 9) + 1;

    (dun_type, ju_number)
}

/// 验证局数有效性
pub fn validate_ju_number(ju_number: u8) -> bool {
    (1..=9).contains(&ju_number)
}

/// 计算排盘稀有度分数
///
/// 根据排盘结果计算稀有度，用于 NFT 铸造
pub fn calc_rarity_score(
    zhi_fu_xing: JiuXing,
    zhi_shi_men: BaMen,
    palaces: &[Palace; 9],
) -> u8 {
    let mut score: u16 = 30; // 基础分

    // 值符为吉星加分
    if zhi_fu_xing.is_auspicious() {
        score = score.saturating_add(15);
    }

    // 值使为吉门加分
    if zhi_shi_men.is_auspicious() {
        score = score.saturating_add(15);
    }

    // 统计吉门吉星数量
    let mut lucky_doors = 0u16;
    let mut lucky_stars = 0u16;

    for palace in palaces.iter() {
        if palace.xing.is_auspicious() {
            lucky_stars = lucky_stars.saturating_add(1);
        }
        if let Some(men) = &palace.men {
            if men.is_auspicious() {
                lucky_doors = lucky_doors.saturating_add(1);
            }
        }
    }

    // 吉门吉星越多越稀有
    score = score.saturating_add(lucky_doors * 3);
    score = score.saturating_add(lucky_stars * 3);

    // 特殊格局加分（简化版）
    // 检查开门、休门、生门是否落在好位置
    for palace in palaces.iter() {
        if let Some(men) = &palace.men {
            // 开门落乾宫（归位）
            if *men == BaMen::Kai && palace.gong == JiuGong::Qian {
                score = score.saturating_add(10);
            }
            // 休门落坎宫（归位）
            if *men == BaMen::Xiu && palace.gong == JiuGong::Kan {
                score = score.saturating_add(10);
            }
            // 生门落艮宫（归位）
            if *men == BaMen::Sheng && palace.gong == JiuGong::Gen {
                score = score.saturating_add(10);
            }
        }
    }

    score.min(100) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_dun_type() {
        assert_eq!(calc_dun_type(JieQi::DongZhi), DunType::Yang);
        assert_eq!(calc_dun_type(JieQi::XiaZhi), DunType::Yin);
        assert_eq!(calc_dun_type(JieQi::ChunFen), DunType::Yang);
        assert_eq!(calc_dun_type(JieQi::QiuFen), DunType::Yin);
    }

    #[test]
    fn test_calc_san_yuan() {
        assert_eq!(calc_san_yuan(1), SanYuan::Shang);
        assert_eq!(calc_san_yuan(5), SanYuan::Shang);
        assert_eq!(calc_san_yuan(6), SanYuan::Zhong);
        assert_eq!(calc_san_yuan(10), SanYuan::Zhong);
        assert_eq!(calc_san_yuan(11), SanYuan::Xia);
        assert_eq!(calc_san_yuan(15), SanYuan::Xia);
    }

    #[test]
    fn test_calc_ju_number() {
        // 冬至上元阳遁一局
        assert_eq!(calc_ju_number(JieQi::DongZhi, SanYuan::Shang, DunType::Yang), 1);
        // 夏至上元阴遁九局
        assert_eq!(calc_ju_number(JieQi::XiaZhi, SanYuan::Shang, DunType::Yin), 9);
    }

    #[test]
    fn test_validate_ju_number() {
        assert!(validate_ju_number(1));
        assert!(validate_ju_number(9));
        assert!(!validate_ju_number(0));
        assert!(!validate_ju_number(10));
    }
}
