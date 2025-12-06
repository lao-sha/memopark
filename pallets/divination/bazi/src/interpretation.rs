//! # 八字解盘模块
//!
//! 本模块实现八字命理解盘功能，包括：
//! - 格局分析：正格、从格、化格判断
//! - 用神分析：喜用神、忌神判断
//! - 流年大运分析：吉凶判断
//! - 性格分析：基于十神组合
//! - 事业财运分析：基于财官印食伤

use crate::types::*;
use codec::{Decode, Encode};
use scale_info::TypeInfo;
use frame_support::pallet_prelude::*;

// ================================
// 解盘结果类型定义
// ================================

/// 格局类型
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum GeJuType {
    /// 正格 - 身旺财官
    ZhengGe,
    /// 从强格 - 身旺无制
    CongQiangGe,
    /// 从弱格 - 身弱无助
    CongRuoGe,
    /// 从财格 - 财星当令
    CongCaiGe,
    /// 从官格 - 官星当令
    CongGuanGe,
    /// 从儿格 - 食伤当令
    CongErGe,
    /// 化气格 - 干支化合
    HuaQiGe,
    /// 特殊格局
    TeShuge,
}

/// 命局强弱
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum MingJuQiangRuo {
    /// 身旺
    ShenWang,
    /// 身弱
    ShenRuo,
    /// 中和
    ZhongHe,
    /// 太旺
    TaiWang,
    /// 太弱
    TaiRuo,
}

/// 用神类型
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum YongShenType {
    /// 扶抑用神 - 扶弱抑强
    FuYi,
    /// 调候用神 - 调节寒暖
    DiaoHou,
    /// 通关用神 - 化解冲突
    TongGuan,
    /// 专旺用神 - 顺势而为
    ZhuanWang,
}

/// 性格特征枚举
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum XingGeTrait {
    /// 正直
    ZhengZhi,
    /// 有主见
    YouZhuJian,
    /// 积极向上
    JiJiXiangShang,
    /// 固执
    GuZhi,
    /// 缺乏变通
    QueFaBianTong,
    /// 温和
    WenHe,
    /// 适应性强
    ShiYingXingQiang,
    /// 有艺术天赋
    YouYiShuTianFu,
    /// 优柔寡断
    YouRouGuaDuan,
    /// 依赖性强
    YiLaiXingQiang,
    /// 热情
    ReQing,
    /// 开朗
    KaiLang,
    /// 有领导力
    YouLingDaoLi,
    /// 急躁
    JiZao,
    /// 缺乏耐心
    QueFaNaiXin,
    /// 细心
    XiXin,
    /// 有创造力
    YouChuangZaoLi,
    /// 善于沟通
    ShanYuGouTong,
    /// 情绪化
    QingXuHua,
    /// 敏感
    MinGan,
    /// 稳重
    WenZhong,
    /// 可靠
    KeLao,
    /// 有责任心
    YouZeRenXin,
    /// 保守
    BaoShou,
    /// 变化慢
    BianHuaMan,
    /// 包容
    BaoRong,
    /// 细致
    XiZhi,
    /// 善于协调
    ShanYuXieTiao,
    /// 犹豫不决
    YouYuBuJue,
    /// 缺乏魄力
    QueFaPoLi,
    /// 果断
    GuoDuan,
    /// 有正义感
    YouZhengYiGan,
    /// 执行力强
    ZhiXingLiQiang,
    /// 刚硬
    GangYing,
    /// 不够圆滑
    BuGouYuanHua,
    /// 精致
    JingZhi,
    /// 有品味
    YouPinWei,
    /// 善于表达
    ShanYuBiaoDa,
    /// 挑剔
    TiaoTi,
    /// 情绪波动大
    QingXuBoDongDa,
    /// 智慧
    ZhiHui,
    /// 灵活
    LingHuo,
    /// 适应力强
    ShiYingLiQiang,
    /// 多变
    DuoBian,
    /// 缺乏恒心
    QueFaHengXin,
    /// 内敛
    NeiLian,
    /// 善于思考
    ShanYuSiKao,
    /// 消极
    XiaoJi,
    /// 缺乏自信
    QueFaZiXin,
}

/// 职业类型枚举
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum ZhiYeType {
    /// 教育
    JiaoYu,
    /// 文化
    WenHua,
    /// 环保
    HuanBao,
    /// 农林
    NongLin,
    /// 能源
    NengYuan,
    /// 娱乐
    YuLe,
    /// 餐饮
    CanYin,
    /// 化工
    HuaGong,
    /// 房地产
    FangDiChan,
    /// 建筑
    JianZhu,
    /// 农业
    NongYe,
    /// 服务
    FuWu,
    /// 金融
    JinRong,
    /// 机械
    JiXie,
    /// 军警
    JunJing,
    /// 五金
    WuJin,
    /// 贸易
    MaoYi,
    /// 运输
    YunShu,
    /// 水利
    ShuiLi,
    /// 信息
    XinXi,
}

/// 性格特征
#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct XingGeTeZheng {
    /// 主要性格特点 (最多5个)
    pub zhu_yao_te_dian: BoundedVec<XingGeTrait, ConstU32<5>>,
    /// 优点 (最多5个)
    pub you_dian: BoundedVec<XingGeTrait, ConstU32<5>>,
    /// 缺点 (最多5个)
    pub que_dian: BoundedVec<XingGeTrait, ConstU32<5>>,
    /// 适合职业 (最多8个)
    pub shi_he_zhi_ye: BoundedVec<ZhiYeType, ConstU32<8>>,
}

/// 流年运势
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum LiuNianYunShi {
    /// 大吉
    DaJi,
    /// 中吉
    ZhongJi,
    /// 小吉
    XiaoJi,
    /// 平运
    PingYun,
    /// 小凶
    XiaoXiong,
    /// 中凶
    ZhongXiong,
    /// 大凶
    DaXiong,
}

/// 解盘文本类型枚举
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum JiePanTextType {
    /// 格局描述：正格
    GeJuZhengGe,
    /// 格局描述：从强格
    GeJuCongQiang,
    /// 格局描述：从弱格
    GeJuCongRuo,
    /// 格局描述：特殊格
    GeJuTeShu,
    /// 强弱描述：身旺
    QiangRuoShenWang,
    /// 强弱描述：身弱
    QiangRuoShenRuo,
    /// 强弱描述：中和
    QiangRuoZhongHe,
    /// 强弱描述：其他
    QiangRuoOther,
    /// 用神建议：金
    YongShenJin,
    /// 用神建议：木
    YongShenMu,
    /// 用神建议：水
    YongShenShui,
    /// 用神建议：火
    YongShenHuo,
    /// 用神建议：土
    YongShenTu,
}

/// 解盘结果
#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct JiePanResult {
    /// 格局类型
    pub ge_ju: GeJuType,
    /// 命局强弱
    pub qiang_ruo: MingJuQiangRuo,
    /// 用神
    pub yong_shen: WuXing,
    /// 用神类型
    pub yong_shen_type: YongShenType,
    /// 忌神 (最多3个)
    pub ji_shen: BoundedVec<WuXing, ConstU32<3>>,
    /// 性格分析
    pub xing_ge: XingGeTeZheng,
    /// 综合评分 (0-100)
    pub zong_he_ping_fen: u8,
    /// 解盘文本类型 (最多10条)
    pub jie_pan_text: BoundedVec<JiePanTextType, ConstU32<10>>,
}

// ================================
// 解盘计算函数
// ================================

/// 分析八字格局
pub fn analyze_ge_ju(sizhu: &SiZhu<impl crate::pallet::Config>, wuxing_strength: &WuXingStrength) -> GeJuType {
    let rizhu_wuxing = sizhu.rizhu.to_wuxing();
    let rizhu_strength = get_wuxing_strength(wuxing_strength, rizhu_wuxing);
    let total_strength: u32 = wuxing_strength.jin + wuxing_strength.mu + 
                             wuxing_strength.shui + wuxing_strength.huo + wuxing_strength.tu;
    
    let strength_ratio = (rizhu_strength * 100) / total_strength;
    
    // 简化格局判断
    if strength_ratio >= 60 {
        // 身旺，检查是否有制约
        if has_ke_zhi(&sizhu, rizhu_wuxing) {
            GeJuType::ZhengGe
        } else {
            GeJuType::CongQiangGe
        }
    } else if strength_ratio <= 20 {
        // 身弱，检查是否有生扶
        if has_sheng_fu(&sizhu, rizhu_wuxing) {
            GeJuType::ZhengGe
        } else {
            GeJuType::CongRuoGe
        }
    } else {
        GeJuType::ZhengGe
    }
}

/// 判断命局强弱
pub fn analyze_qiang_ruo(wuxing_strength: &WuXingStrength, rizhu: TianGan) -> MingJuQiangRuo {
    let rizhu_wuxing = rizhu.to_wuxing();
    let rizhu_strength = get_wuxing_strength(wuxing_strength, rizhu_wuxing);
    let total_strength: u32 = wuxing_strength.jin + wuxing_strength.mu + 
                             wuxing_strength.shui + wuxing_strength.huo + wuxing_strength.tu;
    
    let strength_ratio = (rizhu_strength * 100) / total_strength;
    
    match strength_ratio {
        0..=15 => MingJuQiangRuo::TaiRuo,
        16..=25 => MingJuQiangRuo::ShenRuo,
        26..=35 => MingJuQiangRuo::ZhongHe,
        36..=50 => MingJuQiangRuo::ShenWang,
        _ => MingJuQiangRuo::TaiWang,
    }
}

/// 分析用神
#[allow(unused_variables)]
pub fn analyze_yong_shen(
    ge_ju: GeJuType,
    qiang_ruo: MingJuQiangRuo,
    sizhu: &SiZhu<impl crate::pallet::Config>,
    wuxing_strength: &WuXingStrength,
) -> (WuXing, YongShenType) {
    let rizhu_wuxing = sizhu.rizhu.to_wuxing();
    
    match (ge_ju, qiang_ruo) {
        (GeJuType::ZhengGe, MingJuQiangRuo::ShenWang) => {
            // 身旺用克泄耗
            (get_ke_wo(rizhu_wuxing), YongShenType::FuYi)
        },
        (GeJuType::ZhengGe, MingJuQiangRuo::ShenRuo) => {
            // 身弱用生扶
            (get_sheng_wo(rizhu_wuxing), YongShenType::FuYi)
        },
        (GeJuType::CongQiangGe, _) => {
            // 从强格顺势而为
            (rizhu_wuxing, YongShenType::ZhuanWang)
        },
        (GeJuType::CongRuoGe, _) => {
            // 从弱格用克泄耗
            (get_ke_wo(rizhu_wuxing), YongShenType::ZhuanWang)
        },
        _ => {
            // 默认扶抑
            if matches!(qiang_ruo, MingJuQiangRuo::ShenWang | MingJuQiangRuo::TaiWang) {
                (get_ke_wo(rizhu_wuxing), YongShenType::FuYi)
            } else {
                (get_sheng_wo(rizhu_wuxing), YongShenType::FuYi)
            }
        }
    }
}

/// 性格分析
pub fn analyze_xing_ge(sizhu: &SiZhu<impl crate::pallet::Config>) -> XingGeTeZheng {
    let rizhu = sizhu.rizhu;

    // 基于日主天干的基本性格
    let (traits, weaknesses): ([XingGeTrait; 3], [XingGeTrait; 2]) = match rizhu.0 {
        0 => ([XingGeTrait::ZhengZhi, XingGeTrait::YouZhuJian, XingGeTrait::JiJiXiangShang],
              [XingGeTrait::GuZhi, XingGeTrait::QueFaBianTong]),
        1 => ([XingGeTrait::WenHe, XingGeTrait::ShiYingXingQiang, XingGeTrait::YouYiShuTianFu],
              [XingGeTrait::YouRouGuaDuan, XingGeTrait::YiLaiXingQiang]),
        2 => ([XingGeTrait::ReQing, XingGeTrait::KaiLang, XingGeTrait::YouLingDaoLi],
              [XingGeTrait::JiZao, XingGeTrait::QueFaNaiXin]),
        3 => ([XingGeTrait::XiXin, XingGeTrait::YouChuangZaoLi, XingGeTrait::ShanYuGouTong],
              [XingGeTrait::QingXuHua, XingGeTrait::MinGan]),
        4 => ([XingGeTrait::WenZhong, XingGeTrait::KeLao, XingGeTrait::YouZeRenXin],
              [XingGeTrait::BaoShou, XingGeTrait::BianHuaMan]),
        5 => ([XingGeTrait::BaoRong, XingGeTrait::XiZhi, XingGeTrait::ShanYuXieTiao],
              [XingGeTrait::YouYuBuJue, XingGeTrait::QueFaPoLi]),
        6 => ([XingGeTrait::GuoDuan, XingGeTrait::YouZhengYiGan, XingGeTrait::ZhiXingLiQiang],
              [XingGeTrait::GangYing, XingGeTrait::BuGouYuanHua]),
        7 => ([XingGeTrait::JingZhi, XingGeTrait::YouPinWei, XingGeTrait::ShanYuBiaoDa],
              [XingGeTrait::TiaoTi, XingGeTrait::QingXuBoDongDa]),
        8 => ([XingGeTrait::ZhiHui, XingGeTrait::LingHuo, XingGeTrait::ShiYingLiQiang],
              [XingGeTrait::DuoBian, XingGeTrait::QueFaHengXin]),
        _ => ([XingGeTrait::NeiLian, XingGeTrait::ZhiHui, XingGeTrait::ShanYuSiKao],
              [XingGeTrait::XiaoJi, XingGeTrait::QueFaZiXin]),
    };

    let mut zhu_yao_te_dian = BoundedVec::new();
    let mut you_dian = BoundedVec::new();
    let mut que_dian = BoundedVec::new();

    // 添加特点
    for trait_item in traits.iter() {
        let _ = zhu_yao_te_dian.try_push(*trait_item);
        let _ = you_dian.try_push(*trait_item);
    }

    // 添加缺点
    for weakness in weaknesses.iter() {
        let _ = que_dian.try_push(*weakness);
    }

    XingGeTeZheng {
        zhu_yao_te_dian,
        you_dian,
        que_dian,
        shi_he_zhi_ye: get_suitable_careers(rizhu),
    }
}

/// 完整解盘分析
pub fn full_interpretation(
    sizhu: &SiZhu<impl crate::pallet::Config>,
    wuxing_strength: &WuXingStrength,
) -> JiePanResult {
    // 1. 格局分析
    let ge_ju = analyze_ge_ju(sizhu, wuxing_strength);
    
    // 2. 强弱分析
    let qiang_ruo = analyze_qiang_ruo(wuxing_strength, sizhu.rizhu);
    
    // 3. 用神分析
    let (yong_shen, yong_shen_type) = analyze_yong_shen(ge_ju, qiang_ruo, sizhu, wuxing_strength);
    
    // 4. 忌神分析
    let ji_shen = analyze_ji_shen(yong_shen, ge_ju);
    
    // 5. 性格分析
    let xing_ge = analyze_xing_ge(sizhu);
    
    // 6. 综合评分
    let ping_fen = calculate_comprehensive_score(&ge_ju, &qiang_ruo, wuxing_strength);
    
    // 7. 生成解盘文本
    let jie_pan_text = generate_interpretation_text(&ge_ju, &qiang_ruo, &yong_shen);
    
    JiePanResult {
        ge_ju,
        qiang_ruo,
        yong_shen,
        yong_shen_type,
        ji_shen,
        xing_ge,
        zong_he_ping_fen: ping_fen,
        jie_pan_text,
    }
}

// ================================
// 辅助函数
// ================================

fn get_wuxing_strength(strength: &WuXingStrength, wuxing: WuXing) -> u32 {
    match wuxing {
        WuXing::Jin => strength.jin,
        WuXing::Mu => strength.mu,
        WuXing::Shui => strength.shui,
        WuXing::Huo => strength.huo,
        WuXing::Tu => strength.tu,
    }
}

fn has_ke_zhi(sizhu: &SiZhu<impl crate::pallet::Config>, rizhu_wuxing: WuXing) -> bool {
    // 简化判断：检查是否有克制日主的五行
    let ke_wo = get_ke_wo(rizhu_wuxing);
    
    [sizhu.year_zhu.ganzhi.gan, sizhu.month_zhu.ganzhi.gan, sizhu.hour_zhu.ganzhi.gan]
        .iter()
        .any(|gan| gan.to_wuxing() == ke_wo)
}

fn has_sheng_fu(sizhu: &SiZhu<impl crate::pallet::Config>, rizhu_wuxing: WuXing) -> bool {
    // 简化判断：检查是否有生扶日主的五行
    let sheng_wo = get_sheng_wo(rizhu_wuxing);
    
    [sizhu.year_zhu.ganzhi.gan, sizhu.month_zhu.ganzhi.gan, sizhu.hour_zhu.ganzhi.gan]
        .iter()
        .any(|gan| gan.to_wuxing() == sheng_wo || gan.to_wuxing() == rizhu_wuxing)
}

fn get_ke_wo(wuxing: WuXing) -> WuXing {
    match wuxing {
        WuXing::Jin => WuXing::Huo,  // 火克金
        WuXing::Mu => WuXing::Jin,   // 金克木
        WuXing::Shui => WuXing::Tu,  // 土克水
        WuXing::Huo => WuXing::Shui, // 水克火
        WuXing::Tu => WuXing::Mu,    // 木克土
    }
}

fn get_sheng_wo(wuxing: WuXing) -> WuXing {
    match wuxing {
        WuXing::Jin => WuXing::Tu,   // 土生金
        WuXing::Mu => WuXing::Shui,  // 水生木
        WuXing::Shui => WuXing::Jin, // 金生水
        WuXing::Huo => WuXing::Mu,   // 木生火
        WuXing::Tu => WuXing::Huo,   // 火生土
    }
}

fn analyze_ji_shen(yong_shen: WuXing, ge_ju: GeJuType) -> BoundedVec<WuXing, ConstU32<3>> {
    let mut ji_shen = BoundedVec::new();
    
    match ge_ju {
        GeJuType::ZhengGe => {
            let _ = ji_shen.try_push(get_ke_wo(yong_shen));
        },
        GeJuType::CongQiangGe => {
            let _ = ji_shen.try_push(get_ke_wo(yong_shen));
            let _ = ji_shen.try_push(get_sheng_wo(yong_shen));
        },
        _ => {
            let _ = ji_shen.try_push(get_ke_wo(yong_shen));
        },
    }
    
    ji_shen
}

fn get_suitable_careers(rizhu: TianGan) -> BoundedVec<ZhiYeType, ConstU32<8>> {
    let mut careers = BoundedVec::new();

    let career_list: [ZhiYeType; 4] = match rizhu.0 {
        0 | 1 => [ZhiYeType::JiaoYu, ZhiYeType::WenHua, ZhiYeType::HuanBao, ZhiYeType::NongLin],  // 甲乙木
        2 | 3 => [ZhiYeType::NengYuan, ZhiYeType::YuLe, ZhiYeType::CanYin, ZhiYeType::HuaGong],  // 丙丁火
        4 | 5 => [ZhiYeType::FangDiChan, ZhiYeType::JianZhu, ZhiYeType::NongYe, ZhiYeType::FuWu], // 戊己土
        6 | 7 => [ZhiYeType::JinRong, ZhiYeType::JiXie, ZhiYeType::JunJing, ZhiYeType::WuJin],  // 庚辛金
        _ => [ZhiYeType::MaoYi, ZhiYeType::YunShu, ZhiYeType::ShuiLi, ZhiYeType::XinXi],  // 壬癸水
    };

    for career in career_list.iter() {
        let _ = careers.try_push(*career);
    }

    careers
}

fn calculate_comprehensive_score(
    ge_ju: &GeJuType,
    qiang_ruo: &MingJuQiangRuo,
    wuxing_strength: &WuXingStrength,
) -> u8 {
    let mut score = 50u8; // 基础分
    
    // 格局加分
    match ge_ju {
        GeJuType::ZhengGe => score += 20,
        GeJuType::CongQiangGe | GeJuType::CongRuoGe => score += 15,
        _ => score += 10,
    }
    
    // 强弱平衡加分
    match qiang_ruo {
        MingJuQiangRuo::ZhongHe => score += 20,
        MingJuQiangRuo::ShenWang | MingJuQiangRuo::ShenRuo => score += 10,
        _ => score += 5,
    }
    
    // 五行平衡加分
    let total = wuxing_strength.jin + wuxing_strength.mu + wuxing_strength.shui + 
                wuxing_strength.huo + wuxing_strength.tu;
    let average = total / 5;
    let variance = [
        wuxing_strength.jin.abs_diff(average),
        wuxing_strength.mu.abs_diff(average),
        wuxing_strength.shui.abs_diff(average),
        wuxing_strength.huo.abs_diff(average),
        wuxing_strength.tu.abs_diff(average),
    ].iter().sum::<u32>() / 5;
    
    if variance < average / 4 {
        score += 10; // 五行相对平衡
    }
    
    score.min(100)
}

fn generate_interpretation_text(
    ge_ju: &GeJuType,
    qiang_ruo: &MingJuQiangRuo,
    yong_shen: &WuXing,
) -> BoundedVec<JiePanTextType, ConstU32<10>> {
    let mut texts = BoundedVec::new();

    // 格局描述
    let ge_ju_text = match ge_ju {
        GeJuType::ZhengGe => JiePanTextType::GeJuZhengGe,
        GeJuType::CongQiangGe => JiePanTextType::GeJuCongQiang,
        GeJuType::CongRuoGe => JiePanTextType::GeJuCongRuo,
        _ => JiePanTextType::GeJuTeShu,
    };
    let _ = texts.try_push(ge_ju_text);

    // 强弱描述
    let qiang_ruo_text = match qiang_ruo {
        MingJuQiangRuo::ShenWang => JiePanTextType::QiangRuoShenWang,
        MingJuQiangRuo::ShenRuo => JiePanTextType::QiangRuoShenRuo,
        MingJuQiangRuo::ZhongHe => JiePanTextType::QiangRuoZhongHe,
        _ => JiePanTextType::QiangRuoOther,
    };
    let _ = texts.try_push(qiang_ruo_text);

    // 用神建议
    let yong_shen_text = match yong_shen {
        WuXing::Jin => JiePanTextType::YongShenJin,
        WuXing::Mu => JiePanTextType::YongShenMu,
        WuXing::Shui => JiePanTextType::YongShenShui,
        WuXing::Huo => JiePanTextType::YongShenHuo,
        WuXing::Tu => JiePanTextType::YongShenTu,
    };
    let _ = texts.try_push(yong_shen_text);

    texts
}
