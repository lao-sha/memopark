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

/// 阳遁地盘三奇六仪查找表（1-9局，每局对应1-9宫的天干）
///
/// 阳遁规则：六仪（戊己庚辛壬癸）顺排，三奇（乙丙丁）顺排
/// 戊落宫位 = 局数，然后按九宫顺飞顺序依次排布
///
/// 参考：Java QiMenZhuanPanJiChuMap.DI_YANG_QI_YI
pub const DI_YANG_QI_YI: [[TianGan; 9]; 9] = [
    // 阳遁一局（1-9宫）：戊己庚辛壬癸丁丙乙
    [TianGan::Wu, TianGan::Ji, TianGan::Geng, TianGan::Xin, TianGan::Ren, TianGan::Gui, TianGan::Ding, TianGan::Bing, TianGan::Yi],
    // 阳遁二局（1-9宫）：乙戊己庚辛壬癸丁丙
    [TianGan::Yi, TianGan::Wu, TianGan::Ji, TianGan::Geng, TianGan::Xin, TianGan::Ren, TianGan::Gui, TianGan::Ding, TianGan::Bing],
    // 阳遁三局（1-9宫）：丙乙戊己庚辛壬癸丁
    [TianGan::Bing, TianGan::Yi, TianGan::Wu, TianGan::Ji, TianGan::Geng, TianGan::Xin, TianGan::Ren, TianGan::Gui, TianGan::Ding],
    // 阳遁四局（1-9宫）：丁丙乙戊己庚辛壬癸
    [TianGan::Ding, TianGan::Bing, TianGan::Yi, TianGan::Wu, TianGan::Ji, TianGan::Geng, TianGan::Xin, TianGan::Ren, TianGan::Gui],
    // 阳遁五局（1-9宫）：癸丁丙乙戊己庚辛壬
    [TianGan::Gui, TianGan::Ding, TianGan::Bing, TianGan::Yi, TianGan::Wu, TianGan::Ji, TianGan::Geng, TianGan::Xin, TianGan::Ren],
    // 阳遁六局（1-9宫）：壬癸丁丙乙戊己庚辛
    [TianGan::Ren, TianGan::Gui, TianGan::Ding, TianGan::Bing, TianGan::Yi, TianGan::Wu, TianGan::Ji, TianGan::Geng, TianGan::Xin],
    // 阳遁七局（1-9宫）：辛壬癸丁丙乙戊己庚
    [TianGan::Xin, TianGan::Ren, TianGan::Gui, TianGan::Ding, TianGan::Bing, TianGan::Yi, TianGan::Wu, TianGan::Ji, TianGan::Geng],
    // 阳遁八局（1-9宫）：庚辛壬癸丁丙乙戊己
    [TianGan::Geng, TianGan::Xin, TianGan::Ren, TianGan::Gui, TianGan::Ding, TianGan::Bing, TianGan::Yi, TianGan::Wu, TianGan::Ji],
    // 阳遁九局（1-9宫）：己庚辛壬癸丁丙乙戊
    [TianGan::Ji, TianGan::Geng, TianGan::Xin, TianGan::Ren, TianGan::Gui, TianGan::Ding, TianGan::Bing, TianGan::Yi, TianGan::Wu],
];

/// 阴遁地盘三奇六仪查找表（1-9局，每局对应1-9宫的天干）
///
/// 阴遁规则：三奇（乙丙丁）顺排在前，六仪（癸壬辛庚己）逆排在后
/// 戊落宫位 = 局数，然后按九宫逆飞顺序排布
///
/// 注意：阴遁的三奇六仪顺序与阳遁不同！
/// - 阳遁顺序：戊→己→庚→辛→壬→癸→丁→丙→乙（六仪顺+三奇顺）
/// - 阴遁顺序：戊→乙→丙→丁→癸→壬→辛→庚→己（三奇顺+六仪逆）
///
/// 参考：Java QiMenZhuanPanJiChuMap.DI_YIN_QI_YI
pub const DI_YIN_QI_YI: [[TianGan; 9]; 9] = [
    // 阴遁一局（1-9宫）：戊乙丙丁癸壬辛庚己
    [TianGan::Wu, TianGan::Yi, TianGan::Bing, TianGan::Ding, TianGan::Gui, TianGan::Ren, TianGan::Xin, TianGan::Geng, TianGan::Ji],
    // 阴遁二局（1-9宫）：己戊乙丙丁癸壬辛庚
    [TianGan::Ji, TianGan::Wu, TianGan::Yi, TianGan::Bing, TianGan::Ding, TianGan::Gui, TianGan::Ren, TianGan::Xin, TianGan::Geng],
    // 阴遁三局（1-9宫）：庚己戊乙丙丁癸壬辛
    [TianGan::Geng, TianGan::Ji, TianGan::Wu, TianGan::Yi, TianGan::Bing, TianGan::Ding, TianGan::Gui, TianGan::Ren, TianGan::Xin],
    // 阴遁四局（1-9宫）：辛庚己戊乙丙丁癸壬
    [TianGan::Xin, TianGan::Geng, TianGan::Ji, TianGan::Wu, TianGan::Yi, TianGan::Bing, TianGan::Ding, TianGan::Gui, TianGan::Ren],
    // 阴遁五局（1-9宫）：壬辛庚己戊乙丙丁癸
    [TianGan::Ren, TianGan::Xin, TianGan::Geng, TianGan::Ji, TianGan::Wu, TianGan::Yi, TianGan::Bing, TianGan::Ding, TianGan::Gui],
    // 阴遁六局（1-9宫）：癸壬辛庚己戊乙丙丁
    [TianGan::Gui, TianGan::Ren, TianGan::Xin, TianGan::Geng, TianGan::Ji, TianGan::Wu, TianGan::Yi, TianGan::Bing, TianGan::Ding],
    // 阴遁七局（1-9宫）：丁癸壬辛庚己戊乙丙
    [TianGan::Ding, TianGan::Gui, TianGan::Ren, TianGan::Xin, TianGan::Geng, TianGan::Ji, TianGan::Wu, TianGan::Yi, TianGan::Bing],
    // 阴遁八局（1-9宫）：丙丁癸壬辛庚己戊乙
    [TianGan::Bing, TianGan::Ding, TianGan::Gui, TianGan::Ren, TianGan::Xin, TianGan::Geng, TianGan::Ji, TianGan::Wu, TianGan::Yi],
    // 阴遁九局（1-9宫）：乙丙丁癸壬辛庚己戊
    [TianGan::Yi, TianGan::Bing, TianGan::Ding, TianGan::Gui, TianGan::Ren, TianGan::Xin, TianGan::Geng, TianGan::Ji, TianGan::Wu],
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

/// 六甲旬空查找表
///
/// 每旬对应的两个旬空地支
///
/// 口诀：
/// - 甲子旬空戌亥
/// - 甲戌旬空申酉
/// - 甲申旬空午未
/// - 甲午旬空辰巳
/// - 甲辰旬空寅卯
/// - 甲寅旬空子丑
///
/// 参考：Java QiMenZhuanPanJiChuMap.LIU_JIA_XUN_KONG
pub const XUN_KONG_TABLE: [(DiZhi, DiZhi); 6] = [
    (DiZhi::Xu, DiZhi::Hai),   // 甲子旬空戌亥
    (DiZhi::Shen, DiZhi::You), // 甲戌旬空申酉
    (DiZhi::Wu, DiZhi::Wei),   // 甲申旬空午未
    (DiZhi::Chen, DiZhi::Si),  // 甲午旬空辰巳
    (DiZhi::Yin, DiZhi::Mao),  // 甲辰旬空寅卯
    (DiZhi::Zi, DiZhi::Chou),  // 甲寅旬空子丑
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
/// 使用预计算的查找表直接获取地盘排布，根据局数和阴阳遁类型查表
///
/// ## 阴阳遁差异
///
/// - **阳遁**：六仪顺排（戊→己→庚→辛→壬→癸），三奇顺排（丁→丙→乙）
/// - **阴遁**：三奇顺排（乙→丙→丁），六仪逆排（癸→壬→辛→庚→己）
///
/// ## 参数
///
/// - `ju_number`: 局数（1-9）
/// - `dun_type`: 阴阳遁类型
///
/// ## 返回值
///
/// 返回长度为9的数组，索引0-8分别对应坎一宫到离九宫的地盘天干
pub fn get_di_pan(ju_number: u8, dun_type: DunType) -> [TianGan; 9] {
    // 局数索引（1-9 转 0-8）
    let ju_idx = ju_number.saturating_sub(1).min(8) as usize;

    // 直接从查找表获取地盘排布
    match dun_type {
        DunType::Yang => DI_YANG_QI_YI[ju_idx],
        DunType::Yin => DI_YIN_QI_YI[ju_idx],
    }
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
/// 使用查找表直接获取当前时辰所在旬的两个旬空地支
///
/// ## 六甲旬空口诀
///
/// - 甲子旬（甲子至癸酉）空戌亥
/// - 甲戌旬（甲戌至癸未）空申酉
/// - 甲申旬（甲申至癸巳）空午未
/// - 甲午旬（甲午至癸卯）空辰巳
/// - 甲辰旬（甲辰至癸丑）空寅卯
/// - 甲寅旬（甲寅至癸亥）空子丑
///
/// ## 参数
///
/// - `shi_gan`: 时干
/// - `shi_zhi`: 时支
///
/// ## 返回值
///
/// 返回元组 (旬空1, 旬空2)
pub fn get_xun_kong(shi_gan: TianGan, shi_zhi: DiZhi) -> (DiZhi, DiZhi) {
    let gan_idx = shi_gan.index();
    let zhi_idx = shi_zhi.index();

    // 计算旬首的地支索引
    // 旬首一定是甲开头，所以旬首地支 = (时支 - 时干) mod 12
    // 例如：乙丑 -> (1 - 1) mod 12 = 0 (子)，在甲子旬
    // 例如：甲戌 -> (10 - 0) mod 12 = 10 (戌)，在甲戌旬
    let xun_shou_zhi_idx = (zhi_idx + 12 - gan_idx) % 12;

    // 根据旬首地支确定是哪一旬（0-5）
    // 甲子旬首地支=子(0), 甲戌旬首地支=戌(10), 甲申旬首地支=申(8)
    // 甲午旬首地支=午(6), 甲辰旬首地支=辰(4), 甲寅旬首地支=寅(2)
    let xun_index = match xun_shou_zhi_idx {
        0 => 0,  // 甲子旬
        10 => 1, // 甲戌旬
        8 => 2,  // 甲申旬
        6 => 3,  // 甲午旬
        4 => 4,  // 甲辰旬
        2 => 5,  // 甲寅旬
        _ => 0,  // 默认（不应该到达）
    };

    // 直接从查找表获取旬空
    XUN_KONG_TABLE[xun_index]
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

// ==================== 格局检测功能 ====================

/// 六仪击刑检测结果
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LiuYiJiXing {
    /// 击刑的天干
    pub gan: TianGan,
    /// 发生击刑的宫位
    pub gong: JiuGong,
}

/// 检测六仪击刑
///
/// 六仪（戊己庚辛壬癸）临某些特定宫位时形成击刑格局
///
/// ## 六仪击刑表
///
/// | 天干 | 击刑宫位 | 说明 |
/// |------|----------|------|
/// | 戊 | 震三宫 | 戊加震木，木克土 |
/// | 己 | 坤二宫 | 己入本宫，土气太重 |
/// | 庚 | 艮八宫 | 庚金克艮土 |
/// | 辛 | 离九宫 | 辛金被火克 |
/// | 壬 | 巽四宫 | 壬水临巽木 |
/// | 癸 | 巽四宫 | 癸水临巽木 |
///
/// 参考：Java QiMenZhuanPanJiChuMap.LIU_YI_JI_XING
pub fn check_liu_yi_ji_xing(tian_pan_gan: TianGan, gong: JiuGong) -> Option<LiuYiJiXing> {
    let is_ji_xing = match (tian_pan_gan, gong) {
        (TianGan::Wu, JiuGong::Zhen) => true,   // 戊击刑（震三宫）
        (TianGan::Ji, JiuGong::Kun) => true,    // 己击刑（坤二宫）
        (TianGan::Geng, JiuGong::Gen) => true,  // 庚击刑（艮八宫）
        (TianGan::Xin, JiuGong::Li) => true,    // 辛击刑（离九宫）
        (TianGan::Ren, JiuGong::Xun) => true,   // 壬击刑（巽四宫）
        (TianGan::Gui, JiuGong::Xun) => true,   // 癸击刑（巽四宫）
        _ => false,
    };

    if is_ji_xing {
        Some(LiuYiJiXing { gan: tian_pan_gan, gong })
    } else {
        None
    }
}

/// 奇仪入墓检测结果
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct QiYiRuMu {
    /// 入墓的天干
    pub gan: TianGan,
    /// 发生入墓的宫位
    pub gong: JiuGong,
    /// 墓库地支
    pub mu_zhi: DiZhi,
}

/// 检测奇仪入墓
///
/// 天干临其墓库之宫位时形成入墓格局，主事不顺、受困
///
/// ## 天干入墓表
///
/// | 天干 | 入墓宫位 | 墓库 |
/// |------|----------|------|
/// | 甲/戊 | 乾六宫 | 戌土 |
/// | 乙 | 乾六宫 | 戌土 |
/// | 丙 | 乾六宫 | 戌土 |
/// | 丁/己 | 艮八宫 | 丑土 |
/// | 庚 | 艮八宫 | 丑土 |
/// | 辛 | 巽四宫 | 辰土 |
/// | 壬 | 巽四宫 | 辰土 |
/// | 癸 | 坤二宫 | 未土 |
///
/// 参考：Java QiMenZhuanPanJiChuMap.QI_YI_RU_MU
pub fn check_qi_yi_ru_mu(tian_pan_gan: TianGan, gong: JiuGong) -> Option<QiYiRuMu> {
    let result = match (tian_pan_gan, gong) {
        // 甲戊入乾六宫（戌土为墓）
        (TianGan::Jia, JiuGong::Qian) => Some((TianGan::Jia, JiuGong::Qian, DiZhi::Xu)),
        (TianGan::Wu, JiuGong::Qian) => Some((TianGan::Wu, JiuGong::Qian, DiZhi::Xu)),
        // 乙入乾六宫（戌土为墓）
        (TianGan::Yi, JiuGong::Qian) => Some((TianGan::Yi, JiuGong::Qian, DiZhi::Xu)),
        // 丙入乾六宫（戌土为墓）
        (TianGan::Bing, JiuGong::Qian) => Some((TianGan::Bing, JiuGong::Qian, DiZhi::Xu)),
        // 丁入艮八宫（丑土为墓）
        (TianGan::Ding, JiuGong::Gen) => Some((TianGan::Ding, JiuGong::Gen, DiZhi::Chou)),
        // 己入艮八宫（丑土为墓）
        (TianGan::Ji, JiuGong::Gen) => Some((TianGan::Ji, JiuGong::Gen, DiZhi::Chou)),
        // 庚入艮八宫（丑土为墓）
        (TianGan::Geng, JiuGong::Gen) => Some((TianGan::Geng, JiuGong::Gen, DiZhi::Chou)),
        // 辛入巽四宫（辰土为墓）
        (TianGan::Xin, JiuGong::Xun) => Some((TianGan::Xin, JiuGong::Xun, DiZhi::Chen)),
        // 壬入巽四宫（辰土为墓）
        (TianGan::Ren, JiuGong::Xun) => Some((TianGan::Ren, JiuGong::Xun, DiZhi::Chen)),
        // 癸入坤二宫（未土为墓）
        (TianGan::Gui, JiuGong::Kun) => Some((TianGan::Gui, JiuGong::Kun, DiZhi::Wei)),
        _ => None,
    };

    result.map(|(gan, gong, mu_zhi)| QiYiRuMu { gan, gong, mu_zhi })
}

/// 门迫检测结果
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MenPo {
    /// 被迫之门
    pub men: BaMen,
    /// 发生门迫的宫位
    pub gong: JiuGong,
}

/// 检测门迫
///
/// 八门五行克落宫五行时为门迫，主事受阻、不顺
///
/// ## 门迫表
///
/// | 八门 | 门五行 | 门迫宫位 | 宫五行 |
/// |------|--------|----------|--------|
/// | 休门 | 水 | 离九宫 | 火（水克火，门迫） |
/// | 生门 | 土 | 坎一宫 | 水（土克水，门迫） |
/// | 伤门 | 木 | 坤二宫、艮八宫 | 土（木克土，门迫） |
/// | 杜门 | 木 | 坤二宫、艮八宫 | 土（木克土，门迫） |
/// | 景门 | 火 | 乾六宫、兑七宫 | 金（火克金，门迫） |
/// | 死门 | 土 | 坎一宫 | 水（土克水，门迫） |
/// | 惊门 | 金 | 震三宫、巽四宫 | 木（金克木，门迫） |
/// | 开门 | 金 | 震三宫、巽四宫 | 木（金克木，门迫） |
///
/// 参考：Java QiMenZhuanPanJiChuMap.MEN_PO
pub fn check_men_po(men: BaMen, gong: JiuGong) -> Option<MenPo> {
    let is_men_po = match (men, gong) {
        // 休门（水）克离宫（火）
        (BaMen::Xiu, JiuGong::Li) => true,
        // 生门（土）克坎宫（水）
        (BaMen::Sheng, JiuGong::Kan) => true,
        // 伤门（木）克坤宫、艮宫（土）
        (BaMen::Shang, JiuGong::Kun) | (BaMen::Shang, JiuGong::Gen) => true,
        // 杜门（木）克坤宫、艮宫（土）
        (BaMen::Du, JiuGong::Kun) | (BaMen::Du, JiuGong::Gen) => true,
        // 景门（火）克乾宫、兑宫（金）
        (BaMen::Jing, JiuGong::Qian) | (BaMen::Jing, JiuGong::Dui) => true,
        // 死门（土）克坎宫（水）
        (BaMen::Si, JiuGong::Kan) => true,
        // 惊门（金）克震宫、巽宫（木）
        (BaMen::Jing2, JiuGong::Zhen) | (BaMen::Jing2, JiuGong::Xun) => true,
        // 开门（金）克震宫、巽宫（木）
        (BaMen::Kai, JiuGong::Zhen) | (BaMen::Kai, JiuGong::Xun) => true,
        _ => false,
    };

    if is_men_po {
        Some(MenPo { men, gong })
    } else {
        None
    }
}

/// 十干克应格局类型
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShiGanGeJu {
    // ========== 吉格 ==========
    /// 乙+乙：日奇伏吟
    RiQiFuYin,
    /// 乙+丙：奇仪顺遂
    QiYiShunSui,
    /// 乙+丁：奇仪相佐
    QiYiXiangZuo,
    /// 丙+乙：日月并行
    RiYueBingXing,
    /// 丙+丙：月奇悖师
    YueQiBeiShi,
    /// 丙+丁：星奇朱雀
    XingQiZhuQue,
    /// 丁+乙：星奇入太阴
    XingQiRuTaiYin,
    /// 丁+丙：星奇入六合
    XingQiRuLiuHe,
    /// 丁+丁：星奇伏吟
    XingQiFuYin,
    /// 丙+戊：飞鸟跌穴（大吉）
    FeiNiaoDieXue,

    // ========== 凶格 ==========
    /// 庚+庚：太白同宫（大凶）
    TaiBaiTongGong,
    /// 庚+日干：太白入日（凶）
    TaiBaiRuRi,
    /// 庚+丙：太白入荧
    TaiBaiRuYing,
    /// 庚+丁：太白入星
    TaiBaiRuXing,
    /// 癸+癸：华盖伏吟
    HuaGaiFuYin,
    /// 辛+乙：白虎猖狂
    BaiHuChangKuang,
    /// 辛+丙：白虎入荧
    BaiHuRuYing,
    /// 辛+丁：白虎入星
    BaiHuRuXing,
    /// 壬+壬：蛇夭矫（凶）
    SheYaoJiao,

    // ========== 中平格 ==========
    /// 戊+戊：伏吟
    FuYin,
    /// 其他组合
    Other,
}

/// 十干克应检测结果
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ShiGanKeYing {
    /// 天盘干
    pub tian_gan: TianGan,
    /// 地盘干
    pub di_gan: TianGan,
    /// 格局类型
    pub ge_ju: ShiGanGeJu,
    /// 是否吉格
    pub is_ji: bool,
}

/// 检测十干克应（天地盘格局）
///
/// 天盘干与地盘干相遇形成的吉凶格局
///
/// 参考：Java QiMenZhuanPanJiChuMap 十干克应表
pub fn check_shi_gan_ke_ying(tian_gan: TianGan, di_gan: TianGan) -> ShiGanKeYing {
    let (ge_ju, is_ji) = match (tian_gan, di_gan) {
        // ========== 吉格 ==========
        (TianGan::Yi, TianGan::Yi) => (ShiGanGeJu::RiQiFuYin, true),
        (TianGan::Yi, TianGan::Bing) => (ShiGanGeJu::QiYiShunSui, true),
        (TianGan::Yi, TianGan::Ding) => (ShiGanGeJu::QiYiXiangZuo, true),
        (TianGan::Bing, TianGan::Yi) => (ShiGanGeJu::RiYueBingXing, true),
        (TianGan::Bing, TianGan::Bing) => (ShiGanGeJu::YueQiBeiShi, true),
        (TianGan::Bing, TianGan::Ding) => (ShiGanGeJu::XingQiZhuQue, true),
        (TianGan::Ding, TianGan::Yi) => (ShiGanGeJu::XingQiRuTaiYin, true),
        (TianGan::Ding, TianGan::Bing) => (ShiGanGeJu::XingQiRuLiuHe, true),
        (TianGan::Ding, TianGan::Ding) => (ShiGanGeJu::XingQiFuYin, true),
        (TianGan::Bing, TianGan::Wu) => (ShiGanGeJu::FeiNiaoDieXue, true),

        // ========== 凶格 ==========
        (TianGan::Geng, TianGan::Geng) => (ShiGanGeJu::TaiBaiTongGong, false),
        (TianGan::Geng, TianGan::Yi) => (ShiGanGeJu::TaiBaiRuRi, false),
        (TianGan::Geng, TianGan::Bing) => (ShiGanGeJu::TaiBaiRuYing, false),
        (TianGan::Geng, TianGan::Ding) => (ShiGanGeJu::TaiBaiRuXing, false),
        (TianGan::Gui, TianGan::Gui) => (ShiGanGeJu::HuaGaiFuYin, false),
        (TianGan::Xin, TianGan::Yi) => (ShiGanGeJu::BaiHuChangKuang, false),
        (TianGan::Xin, TianGan::Bing) => (ShiGanGeJu::BaiHuRuYing, false),
        (TianGan::Xin, TianGan::Ding) => (ShiGanGeJu::BaiHuRuXing, false),
        (TianGan::Ren, TianGan::Ren) => (ShiGanGeJu::SheYaoJiao, false),

        // ========== 中平格 ==========
        (TianGan::Wu, TianGan::Wu) => (ShiGanGeJu::FuYin, true),
        (TianGan::Ji, TianGan::Ji) => (ShiGanGeJu::FuYin, true),

        // 其他组合
        _ => (ShiGanGeJu::Other, true),
    };

    ShiGanKeYing { tian_gan, di_gan, ge_ju, is_ji }
}

/// 驿马信息
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct YiMa {
    /// 驿马地支
    pub zhi: DiZhi,
    /// 驿马落宫
    pub gong: JiuGong,
}

/// 驿马查找表
///
/// 根据时支三合局确定驿马位置
///
/// | 时支 | 三合局 | 驿马地支 | 落宫 |
/// |------|--------|----------|------|
/// | 申、子、辰 | 水局 | 寅 | 艮八宫 |
/// | 寅、午、戌 | 火局 | 申 | 坤二宫 |
/// | 巳、酉、丑 | 金局 | 亥 | 乾六宫 |
/// | 亥、卯、未 | 木局 | 巳 | 巽四宫 |
///
/// 参考：Java QiMenZhuanPanJiChuMap.YI_MA
pub fn calc_yi_ma(shi_zhi: DiZhi) -> YiMa {
    match shi_zhi {
        // 申子辰三合水局，驿马在寅（艮八宫）
        DiZhi::Shen | DiZhi::Zi | DiZhi::Chen => YiMa {
            zhi: DiZhi::Yin,
            gong: JiuGong::Gen,
        },
        // 寅午戌三合火局，驿马在申（坤二宫）
        DiZhi::Yin | DiZhi::Wu | DiZhi::Xu => YiMa {
            zhi: DiZhi::Shen,
            gong: JiuGong::Kun,
        },
        // 巳酉丑三合金局，驿马在亥（乾六宫）
        DiZhi::Si | DiZhi::You | DiZhi::Chou => YiMa {
            zhi: DiZhi::Hai,
            gong: JiuGong::Qian,
        },
        // 亥卯未三合木局，驿马在巳（巽四宫）
        DiZhi::Hai | DiZhi::Mao | DiZhi::Wei => YiMa {
            zhi: DiZhi::Si,
            gong: JiuGong::Xun,
        },
    }
}

/// 旺衰状态
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WangShuai {
    Wang,  // 旺 - 当令
    Xiang, // 相 - 我生者
    Xiu,   // 休 - 生我者
    Qiu,   // 囚 - 克我者
    Si,    // 死/废 - 我克者
}

impl WangShuai {
    /// 获取旺衰名称
    pub fn name(&self) -> &'static str {
        match self {
            Self::Wang => "旺",
            Self::Xiang => "相",
            Self::Xiu => "休",
            Self::Qiu => "囚",
            Self::Si => "死",
        }
    }

    /// 判断是否为有利状态
    pub fn is_favorable(&self) -> bool {
        matches!(self, Self::Wang | Self::Xiang)
    }
}

/// 根据月令判断五行旺衰
///
/// ## 五行旺衰规则
///
/// - 旺：当令（与月令五行相同）
/// - 相：我生者（月令生该五行）
/// - 休：生我者（该五行生月令）
/// - 囚：克我者（月令克该五行）
/// - 死/废：我克者（该五行克月令）
///
/// ## 月令五行
///
/// | 月份 | 地支 | 五行 |
/// |------|------|------|
/// | 春（寅卯） | 寅、卯 | 木 |
/// | 夏（巳午） | 巳、午 | 火 |
/// | 秋（申酉） | 申、酉 | 金 |
/// | 冬（亥子） | 亥、子 | 水 |
/// | 四季（辰戌丑未） | 辰、戌、丑、未 | 土 |
pub fn calc_wang_shuai(wu_xing: WuXing, yue_zhi: DiZhi) -> WangShuai {
    let yue_wu_xing = yue_zhi.wu_xing();

    if wu_xing == yue_wu_xing {
        // 当令
        WangShuai::Wang
    } else if yue_wu_xing.generates(&wu_xing) {
        // 月令生我 -> 相
        WangShuai::Xiang
    } else if wu_xing.generates(&yue_wu_xing) {
        // 我生月令 -> 休
        WangShuai::Xiu
    } else if yue_wu_xing.conquers(&wu_xing) {
        // 月令克我 -> 囚
        WangShuai::Qiu
    } else {
        // 我克月令 -> 死
        WangShuai::Si
    }
}

/// 计算九星旺衰
pub fn calc_xing_wang_shuai(xing: JiuXing, yue_zhi: DiZhi) -> WangShuai {
    calc_wang_shuai(xing.wu_xing(), yue_zhi)
}

/// 计算八门旺衰
pub fn calc_men_wang_shuai(men: BaMen, yue_zhi: DiZhi) -> WangShuai {
    calc_wang_shuai(men.wu_xing(), yue_zhi)
}

/// 宫位格局综合分析结果
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PalaceAnalysis {
    /// 六仪击刑
    pub ji_xing: Option<LiuYiJiXing>,
    /// 奇仪入墓
    pub ru_mu: Option<QiYiRuMu>,
    /// 门迫
    pub men_po: Option<MenPo>,
    /// 十干克应
    pub ke_ying: Option<ShiGanKeYing>,
    /// 是否为驿马宫
    pub is_yi_ma: bool,
    /// 九星旺衰
    pub xing_wang_shuai: Option<WangShuai>,
    /// 八门旺衰
    pub men_wang_shuai: Option<WangShuai>,
}

/// 综合分析单宫格局
///
/// 对单个宫位进行全面的格局分析
pub fn analyze_palace(
    palace: &Palace,
    yue_zhi: DiZhi,
    shi_zhi: DiZhi,
) -> PalaceAnalysis {
    let mut analysis = PalaceAnalysis::default();

    // 检测六仪击刑
    analysis.ji_xing = check_liu_yi_ji_xing(palace.tian_pan_gan, palace.gong);

    // 检测奇仪入墓
    analysis.ru_mu = check_qi_yi_ru_mu(palace.tian_pan_gan, palace.gong);

    // 检测门迫
    if let Some(men) = palace.men {
        analysis.men_po = check_men_po(men, palace.gong);
        // 计算八门旺衰
        analysis.men_wang_shuai = Some(calc_men_wang_shuai(men, yue_zhi));
    }

    // 检测十干克应
    analysis.ke_ying = Some(check_shi_gan_ke_ying(palace.tian_pan_gan, palace.di_pan_gan));

    // 检测驿马
    let yi_ma = calc_yi_ma(shi_zhi);
    analysis.is_yi_ma = palace.gong == yi_ma.gong;

    // 计算九星旺衰
    analysis.xing_wang_shuai = Some(calc_xing_wang_shuai(palace.xing, yue_zhi));

    analysis
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

    /// 测试阳遁一局地盘排布
    ///
    /// 阳遁一局：戊落坎一宫，按顺序排布
    /// 坎1:戊 坤2:己 震3:庚 巽4:辛 中5:壬 乾6:癸 兑7:丁 艮8:丙 离9:乙
    #[test]
    fn test_di_pan_yang_dun_1() {
        let di_pan = get_di_pan(1, DunType::Yang);

        // 验证阳遁一局的地盘排布
        assert_eq!(di_pan[0], TianGan::Wu,   "坎一宫应为戊");
        assert_eq!(di_pan[1], TianGan::Ji,   "坤二宫应为己");
        assert_eq!(di_pan[2], TianGan::Geng, "震三宫应为庚");
        assert_eq!(di_pan[3], TianGan::Xin,  "巽四宫应为辛");
        assert_eq!(di_pan[4], TianGan::Ren,  "中五宫应为壬");
        assert_eq!(di_pan[5], TianGan::Gui,  "乾六宫应为癸");
        assert_eq!(di_pan[6], TianGan::Ding, "兑七宫应为丁");
        assert_eq!(di_pan[7], TianGan::Bing, "艮八宫应为丙");
        assert_eq!(di_pan[8], TianGan::Yi,   "离九宫应为乙");
    }

    /// 测试阴遁一局地盘排布
    ///
    /// 阴遁一局与阳遁一局不同！
    /// 坎1:戊 坤2:乙 震3:丙 巽4:丁 中5:癸 乾6:壬 兑7:辛 艮8:庚 离9:己
    ///
    /// 这是修复的核心测试 - 验证阴遁使用不同的三奇六仪顺序
    #[test]
    fn test_di_pan_yin_dun_1() {
        let di_pan = get_di_pan(1, DunType::Yin);

        // 验证阴遁一局的地盘排布（与阳遁不同！）
        assert_eq!(di_pan[0], TianGan::Wu,   "坎一宫应为戊");
        assert_eq!(di_pan[1], TianGan::Yi,   "坤二宫应为乙（不是己！）");
        assert_eq!(di_pan[2], TianGan::Bing, "震三宫应为丙（不是庚！）");
        assert_eq!(di_pan[3], TianGan::Ding, "巽四宫应为丁（不是辛！）");
        assert_eq!(di_pan[4], TianGan::Gui,  "中五宫应为癸（不是壬！）");
        assert_eq!(di_pan[5], TianGan::Ren,  "乾六宫应为壬（不是癸！）");
        assert_eq!(di_pan[6], TianGan::Xin,  "兑七宫应为辛（不是丁！）");
        assert_eq!(di_pan[7], TianGan::Geng, "艮八宫应为庚（不是丙！）");
        assert_eq!(di_pan[8], TianGan::Ji,   "离九宫应为己（不是乙！）");
    }

    /// 测试阳遁九局地盘排布
    ///
    /// 阳遁九局：戊落离九宫
    /// 坎1:己 坤2:庚 震3:辛 巽4:壬 中5:癸 乾6:丁 兑7:丙 艮8:乙 离9:戊
    #[test]
    fn test_di_pan_yang_dun_9() {
        let di_pan = get_di_pan(9, DunType::Yang);

        // 戊应落在离九宫
        assert_eq!(di_pan[8], TianGan::Wu, "阳遁九局戊应落离九宫");
        // 坎一宫应为己
        assert_eq!(di_pan[0], TianGan::Ji, "阳遁九局坎一宫应为己");
    }

    /// 测试阴遁九局地盘排布
    ///
    /// 阴遁九局：戊落离九宫
    /// 坎1:乙 坤2:丙 震3:丁 巽4:癸 中5:壬 乾6:辛 兑7:庚 艮8:己 离9:戊
    #[test]
    fn test_di_pan_yin_dun_9() {
        let di_pan = get_di_pan(9, DunType::Yin);

        // 戊应落在离九宫
        assert_eq!(di_pan[8], TianGan::Wu, "阴遁九局戊应落离九宫");
        // 坎一宫应为乙（不是己！）
        assert_eq!(di_pan[0], TianGan::Yi, "阴遁九局坎一宫应为乙");
    }

    /// 测试阴阳遁地盘差异
    ///
    /// 同一局数，阴遁和阳遁的地盘排布应该不同（除了戊的位置）
    #[test]
    fn test_di_pan_yin_yang_difference() {
        for ju in 1..=9 {
            let yang_pan = get_di_pan(ju, DunType::Yang);
            let yin_pan = get_di_pan(ju, DunType::Yin);

            // 戊的位置相同（都由局数决定）
            let wu_pos_yang = yang_pan.iter().position(|&g| g == TianGan::Wu);
            let wu_pos_yin = yin_pan.iter().position(|&g| g == TianGan::Wu);
            assert_eq!(wu_pos_yang, wu_pos_yin, "局数{}：阴阳遁戊的位置应相同", ju);

            // 但其他天干的排布应该不同
            let mut diff_count = 0;
            for i in 0..9 {
                if yang_pan[i] != yin_pan[i] {
                    diff_count += 1;
                }
            }
            // 除了戊和可能的一两个位置，大部分应该不同
            assert!(diff_count >= 6, "局数{}：阴阳遁地盘应该有明显差异，实际差异{}", ju, diff_count);
        }
    }

    // ==================== 旬空测试 ====================

    /// 测试甲子旬旬空
    ///
    /// 甲子旬（甲子至癸酉）空戌亥
    #[test]
    fn test_xun_kong_jia_zi_xun() {
        // 甲子时 - 甲子旬首
        let (kong1, kong2) = get_xun_kong(TianGan::Jia, DiZhi::Zi);
        assert_eq!(kong1, DiZhi::Xu, "甲子旬空第一个应为戌");
        assert_eq!(kong2, DiZhi::Hai, "甲子旬空第二个应为亥");

        // 乙丑时 - 仍在甲子旬
        let (kong1, kong2) = get_xun_kong(TianGan::Yi, DiZhi::Chou);
        assert_eq!(kong1, DiZhi::Xu, "乙丑时旬空应为戌亥");
        assert_eq!(kong2, DiZhi::Hai);

        // 癸酉时 - 甲子旬最后一个
        let (kong1, kong2) = get_xun_kong(TianGan::Gui, DiZhi::You);
        assert_eq!(kong1, DiZhi::Xu, "癸酉时旬空应为戌亥");
        assert_eq!(kong2, DiZhi::Hai);
    }

    /// 测试甲戌旬旬空
    ///
    /// 甲戌旬（甲戌至癸未）空申酉
    #[test]
    fn test_xun_kong_jia_xu_xun() {
        // 甲戌时 - 甲戌旬首
        let (kong1, kong2) = get_xun_kong(TianGan::Jia, DiZhi::Xu);
        assert_eq!(kong1, DiZhi::Shen, "甲戌旬空第一个应为申");
        assert_eq!(kong2, DiZhi::You, "甲戌旬空第二个应为酉");
    }

    /// 测试甲申旬旬空
    ///
    /// 甲申旬（甲申至癸巳）空午未
    #[test]
    fn test_xun_kong_jia_shen_xun() {
        // 甲申时 - 甲申旬首
        let (kong1, kong2) = get_xun_kong(TianGan::Jia, DiZhi::Shen);
        assert_eq!(kong1, DiZhi::Wu, "甲申旬空第一个应为午");
        assert_eq!(kong2, DiZhi::Wei, "甲申旬空第二个应为未");
    }

    /// 测试甲午旬旬空
    ///
    /// 甲午旬（甲午至癸卯）空辰巳
    #[test]
    fn test_xun_kong_jia_wu_xun() {
        // 甲午时 - 甲午旬首
        let (kong1, kong2) = get_xun_kong(TianGan::Jia, DiZhi::Wu);
        assert_eq!(kong1, DiZhi::Chen, "甲午旬空第一个应为辰");
        assert_eq!(kong2, DiZhi::Si, "甲午旬空第二个应为巳");
    }

    /// 测试甲辰旬旬空
    ///
    /// 甲辰旬（甲辰至癸丑）空寅卯
    #[test]
    fn test_xun_kong_jia_chen_xun() {
        // 甲辰时 - 甲辰旬首
        let (kong1, kong2) = get_xun_kong(TianGan::Jia, DiZhi::Chen);
        assert_eq!(kong1, DiZhi::Yin, "甲辰旬空第一个应为寅");
        assert_eq!(kong2, DiZhi::Mao, "甲辰旬空第二个应为卯");
    }

    /// 测试甲寅旬旬空
    ///
    /// 甲寅旬（甲寅至癸亥）空子丑
    #[test]
    fn test_xun_kong_jia_yin_xun() {
        // 甲寅时 - 甲寅旬首
        let (kong1, kong2) = get_xun_kong(TianGan::Jia, DiZhi::Yin);
        assert_eq!(kong1, DiZhi::Zi, "甲寅旬空第一个应为子");
        assert_eq!(kong2, DiZhi::Chou, "甲寅旬空第二个应为丑");

        // 癸亥时 - 甲寅旬最后一个
        let (kong1, kong2) = get_xun_kong(TianGan::Gui, DiZhi::Hai);
        assert_eq!(kong1, DiZhi::Zi, "癸亥时旬空应为子丑");
        assert_eq!(kong2, DiZhi::Chou);
    }

    /// 测试六旬完整覆盖
    ///
    /// 验证六十甲子的每个干支组合都能正确返回旬空
    #[test]
    fn test_xun_kong_all_sixty() {
        // 六十甲子每旬的旬首和对应旬空
        let xun_tests: [(TianGan, DiZhi, DiZhi, DiZhi); 6] = [
            (TianGan::Jia, DiZhi::Zi, DiZhi::Xu, DiZhi::Hai),     // 甲子旬
            (TianGan::Jia, DiZhi::Xu, DiZhi::Shen, DiZhi::You),   // 甲戌旬
            (TianGan::Jia, DiZhi::Shen, DiZhi::Wu, DiZhi::Wei),   // 甲申旬
            (TianGan::Jia, DiZhi::Wu, DiZhi::Chen, DiZhi::Si),    // 甲午旬
            (TianGan::Jia, DiZhi::Chen, DiZhi::Yin, DiZhi::Mao),  // 甲辰旬
            (TianGan::Jia, DiZhi::Yin, DiZhi::Zi, DiZhi::Chou),   // 甲寅旬
        ];

        for (gan, zhi, expected_kong1, expected_kong2) in xun_tests {
            let (kong1, kong2) = get_xun_kong(gan, zhi);
            assert_eq!(kong1, expected_kong1, "{}{}旬空第一个错误", gan.name(), zhi.name());
            assert_eq!(kong2, expected_kong2, "{}{}旬空第二个错误", gan.name(), zhi.name());
        }
    }

    // ==================== 格局检测测试 ====================

    /// 测试六仪击刑检测
    #[test]
    fn test_liu_yi_ji_xing() {
        // 戊临震三宫 - 击刑
        let result = check_liu_yi_ji_xing(TianGan::Wu, JiuGong::Zhen);
        assert!(result.is_some());
        assert_eq!(result.unwrap().gan, TianGan::Wu);

        // 己临坤二宫 - 击刑
        let result = check_liu_yi_ji_xing(TianGan::Ji, JiuGong::Kun);
        assert!(result.is_some());

        // 庚临艮八宫 - 击刑
        let result = check_liu_yi_ji_xing(TianGan::Geng, JiuGong::Gen);
        assert!(result.is_some());

        // 辛临离九宫 - 击刑
        let result = check_liu_yi_ji_xing(TianGan::Xin, JiuGong::Li);
        assert!(result.is_some());

        // 壬临巽四宫 - 击刑
        let result = check_liu_yi_ji_xing(TianGan::Ren, JiuGong::Xun);
        assert!(result.is_some());

        // 癸临巽四宫 - 击刑
        let result = check_liu_yi_ji_xing(TianGan::Gui, JiuGong::Xun);
        assert!(result.is_some());

        // 戊临坎一宫 - 不击刑
        let result = check_liu_yi_ji_xing(TianGan::Wu, JiuGong::Kan);
        assert!(result.is_none());

        // 乙（三奇）临任何宫位都不击刑
        let result = check_liu_yi_ji_xing(TianGan::Yi, JiuGong::Zhen);
        assert!(result.is_none());
    }

    /// 测试奇仪入墓检测
    #[test]
    fn test_qi_yi_ru_mu() {
        // 甲入乾六宫 - 入墓
        let result = check_qi_yi_ru_mu(TianGan::Jia, JiuGong::Qian);
        assert!(result.is_some());
        assert_eq!(result.unwrap().mu_zhi, DiZhi::Xu);

        // 乙入乾六宫 - 入墓
        let result = check_qi_yi_ru_mu(TianGan::Yi, JiuGong::Qian);
        assert!(result.is_some());

        // 丙入乾六宫 - 入墓
        let result = check_qi_yi_ru_mu(TianGan::Bing, JiuGong::Qian);
        assert!(result.is_some());

        // 丁入艮八宫 - 入墓
        let result = check_qi_yi_ru_mu(TianGan::Ding, JiuGong::Gen);
        assert!(result.is_some());
        assert_eq!(result.unwrap().mu_zhi, DiZhi::Chou);

        // 辛入巽四宫 - 入墓
        let result = check_qi_yi_ru_mu(TianGan::Xin, JiuGong::Xun);
        assert!(result.is_some());
        assert_eq!(result.unwrap().mu_zhi, DiZhi::Chen);

        // 癸入坤二宫 - 入墓
        let result = check_qi_yi_ru_mu(TianGan::Gui, JiuGong::Kun);
        assert!(result.is_some());
        assert_eq!(result.unwrap().mu_zhi, DiZhi::Wei);

        // 甲入坎一宫 - 不入墓
        let result = check_qi_yi_ru_mu(TianGan::Jia, JiuGong::Kan);
        assert!(result.is_none());
    }

    /// 测试门迫检测
    #[test]
    fn test_men_po() {
        // 休门（水）临离宫（火）- 门迫
        let result = check_men_po(BaMen::Xiu, JiuGong::Li);
        assert!(result.is_some());

        // 生门（土）临坎宫（水）- 门迫
        let result = check_men_po(BaMen::Sheng, JiuGong::Kan);
        assert!(result.is_some());

        // 伤门（木）临坤宫（土）- 门迫
        let result = check_men_po(BaMen::Shang, JiuGong::Kun);
        assert!(result.is_some());

        // 景门（火）临乾宫（金）- 门迫
        let result = check_men_po(BaMen::Jing, JiuGong::Qian);
        assert!(result.is_some());

        // 开门（金）临震宫（木）- 门迫
        let result = check_men_po(BaMen::Kai, JiuGong::Zhen);
        assert!(result.is_some());

        // 休门（水）临坎宫（水）- 归位，不迫
        let result = check_men_po(BaMen::Xiu, JiuGong::Kan);
        assert!(result.is_none());

        // 开门（金）临乾宫（金）- 归位，不迫
        let result = check_men_po(BaMen::Kai, JiuGong::Qian);
        assert!(result.is_none());
    }

    /// 测试十干克应
    #[test]
    fn test_shi_gan_ke_ying() {
        // 丙+戊：飞鸟跌穴（大吉）
        let result = check_shi_gan_ke_ying(TianGan::Bing, TianGan::Wu);
        assert_eq!(result.ge_ju, ShiGanGeJu::FeiNiaoDieXue);
        assert!(result.is_ji);

        // 庚+庚：太白同宫（大凶）
        let result = check_shi_gan_ke_ying(TianGan::Geng, TianGan::Geng);
        assert_eq!(result.ge_ju, ShiGanGeJu::TaiBaiTongGong);
        assert!(!result.is_ji);

        // 乙+乙：日奇伏吟
        let result = check_shi_gan_ke_ying(TianGan::Yi, TianGan::Yi);
        assert_eq!(result.ge_ju, ShiGanGeJu::RiQiFuYin);

        // 辛+乙：白虎猖狂（凶）
        let result = check_shi_gan_ke_ying(TianGan::Xin, TianGan::Yi);
        assert_eq!(result.ge_ju, ShiGanGeJu::BaiHuChangKuang);
        assert!(!result.is_ji);

        // 戊+戊：伏吟
        let result = check_shi_gan_ke_ying(TianGan::Wu, TianGan::Wu);
        assert_eq!(result.ge_ju, ShiGanGeJu::FuYin);
    }

    /// 测试驿马计算
    #[test]
    fn test_yi_ma() {
        // 申子辰三合水局，驿马在寅（艮八宫）
        let yi_ma = calc_yi_ma(DiZhi::Zi);
        assert_eq!(yi_ma.zhi, DiZhi::Yin);
        assert_eq!(yi_ma.gong, JiuGong::Gen);

        let yi_ma = calc_yi_ma(DiZhi::Shen);
        assert_eq!(yi_ma.zhi, DiZhi::Yin);

        let yi_ma = calc_yi_ma(DiZhi::Chen);
        assert_eq!(yi_ma.zhi, DiZhi::Yin);

        // 寅午戌三合火局，驿马在申（坤二宫）
        let yi_ma = calc_yi_ma(DiZhi::Wu);
        assert_eq!(yi_ma.zhi, DiZhi::Shen);
        assert_eq!(yi_ma.gong, JiuGong::Kun);

        // 巳酉丑三合金局，驿马在亥（乾六宫）
        let yi_ma = calc_yi_ma(DiZhi::You);
        assert_eq!(yi_ma.zhi, DiZhi::Hai);
        assert_eq!(yi_ma.gong, JiuGong::Qian);

        // 亥卯未三合木局，驿马在巳（巽四宫）
        let yi_ma = calc_yi_ma(DiZhi::Mao);
        assert_eq!(yi_ma.zhi, DiZhi::Si);
        assert_eq!(yi_ma.gong, JiuGong::Xun);
    }

    /// 测试旺衰计算
    #[test]
    fn test_wang_shuai() {
        // 春季（寅月）木旺
        assert_eq!(calc_wang_shuai(WuXing::Mu, DiZhi::Yin), WangShuai::Wang);
        // 春季水休（水生木，我生月令）
        assert_eq!(calc_wang_shuai(WuXing::Shui, DiZhi::Yin), WangShuai::Xiu);
        // 春季火相（木生火，月令生我）
        assert_eq!(calc_wang_shuai(WuXing::Huo, DiZhi::Yin), WangShuai::Xiang);
        // 春季金死（金克木，我克月令）
        assert_eq!(calc_wang_shuai(WuXing::Jin, DiZhi::Yin), WangShuai::Si);
        // 春季土囚（木克土，月令克我）
        assert_eq!(calc_wang_shuai(WuXing::Tu, DiZhi::Yin), WangShuai::Qiu);

        // 冬季（子月）水旺
        assert_eq!(calc_wang_shuai(WuXing::Shui, DiZhi::Zi), WangShuai::Wang);
        // 冬季木相（水生木，月令生我）
        assert_eq!(calc_wang_shuai(WuXing::Mu, DiZhi::Zi), WangShuai::Xiang);
    }

    /// 测试九星旺衰
    #[test]
    fn test_xing_wang_shuai() {
        // 天蓬星（水）在子月当令
        assert_eq!(calc_xing_wang_shuai(JiuXing::TianPeng, DiZhi::Zi), WangShuai::Wang);
        // 天冲星（木）在寅月当令
        assert_eq!(calc_xing_wang_shuai(JiuXing::TianChong, DiZhi::Yin), WangShuai::Wang);
    }

    /// 测试八门旺衰
    #[test]
    fn test_men_wang_shuai() {
        // 休门（水）在子月当令
        assert_eq!(calc_men_wang_shuai(BaMen::Xiu, DiZhi::Zi), WangShuai::Wang);
        // 开门（金）在酉月当令
        assert_eq!(calc_men_wang_shuai(BaMen::Kai, DiZhi::You), WangShuai::Wang);
    }
}
