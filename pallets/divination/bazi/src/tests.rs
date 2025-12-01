//! # 八字排盘 Pallet 单元测试
//!
//! 测试所有核心功能的正确性

use crate::{mock::*, types::*, constants::*};

// ================================
// 基础类型测试
// ================================

#[test]
fn test_tiangan_creation() {
	// 测试天干创建
	assert!(TianGan::new(0).is_some()); // 甲
	assert!(TianGan::new(9).is_some()); // 癸
	assert!(TianGan::new(10).is_none()); // 超出范围
}

#[test]
fn test_tiangan_wuxing() {
	// 测试天干转五行
	assert_eq!(TianGan(0).to_wuxing(), WuXing::Mu); // 甲木
	assert_eq!(TianGan(2).to_wuxing(), WuXing::Huo); // 丙火
	assert_eq!(TianGan(4).to_wuxing(), WuXing::Tu); // 戊土
	assert_eq!(TianGan(6).to_wuxing(), WuXing::Jin); // 庚金
	assert_eq!(TianGan(8).to_wuxing(), WuXing::Shui); // 壬水
}

#[test]
fn test_tiangan_yinyang() {
	// 测试天干阴阳
	assert!(TianGan(0).is_yang()); // 甲为阳
	assert!(!TianGan(1).is_yang()); // 乙为阴
}

#[test]
fn test_dizhi_creation() {
	// 测试地支创建
	assert!(DiZhi::new(0).is_some()); // 子
	assert!(DiZhi::new(11).is_some()); // 亥
	assert!(DiZhi::new(12).is_none()); // 超出范围
}

#[test]
fn test_ganzhi_index_conversion() {
	// 测试干支索引转换
	let jiazi = GanZhi::from_index(0).unwrap(); // 甲子
	assert_eq!(jiazi.gan.0, 0); // 甲
	assert_eq!(jiazi.zhi.0, 0); // 子
	assert_eq!(jiazi.to_index(), 0);

	let guihai = GanZhi::from_index(59).unwrap(); // 癸亥
	assert_eq!(guihai.gan.0, 9); // 癸
	assert_eq!(guihai.zhi.0, 11); // 亥
	assert_eq!(guihai.to_index(), 59);
}

#[test]
fn test_ganzhi_next_prev() {
	// 测试干支的前后关系
	let jiazi = GanZhi::from_index(0).unwrap(); // 甲子
	let yichou = jiazi.next(); // 乙丑
	assert_eq!(yichou.gan.0, 1); // 乙
	assert_eq!(yichou.zhi.0, 1); // 丑

	let guihai = GanZhi::from_index(59).unwrap(); // 癸亥
	let next = guihai.next(); // 应该循环回甲子
	assert_eq!(next.gan.0, 0); // 甲
	assert_eq!(next.zhi.0, 0); // 子
}

// ================================
// 常量表测试
// ================================

#[test]
fn test_chen_hidden_stems() {
	// ⚠️ 关键测试：确保辰藏干为"戊乙癸"
	let chen = DiZhi(4); // 辰
	let stems = get_hidden_stems(chen);

	assert_eq!(stems[0].0 .0, 4); // 戊
	assert_eq!(stems[1].0 .0, 1); // 乙
	assert_eq!(stems[2].0 .0, 9); // 癸 (不是壬!)

	// 验证权重
	assert_eq!(stems[0].2, 500); // 主气权重
	assert_eq!(stems[1].2, 300); // 中气权重
	assert_eq!(stems[2].2, 200); // 余气权重
}

#[test]
fn test_all_hidden_stems() {
	// 测试所有地支的藏干
	for i in 0..12 {
		let dizhi = DiZhi(i);
		let stems = get_hidden_stems(dizhi);

		// 确保至少有一个藏干
		assert!(stems[0].0 .0 < 10);
	}
}

#[test]
fn test_nayin_calculation() {
	// 测试纳音计算
	let jiazi = GanZhi::from_index(0).unwrap(); // 甲子
	let nayin = calculate_nayin(&jiazi);
	assert_eq!(nayin, NaYin::HaiZhongJin); // 海中金

	let yichou = GanZhi::from_index(1).unwrap(); // 乙丑
	let nayin = calculate_nayin(&yichou);
	assert_eq!(nayin, NaYin::HaiZhongJin); // 同样是海中金

	let bingyin = GanZhi::from_index(2).unwrap(); // 丙寅
	let nayin = calculate_nayin(&bingyin);
	assert_eq!(nayin, NaYin::LuZhongHuo); // 炉中火
}

#[test]
fn test_shishen_calculation() {
	// 测试十神计算
	let rizhu = TianGan(0); // 甲木日主

	// 甲见甲 → 比肩
	assert_eq!(calculate_shishen(rizhu, TianGan(0)), ShiShen::BiJian);
	// 甲见乙 → 劫财
	assert_eq!(calculate_shishen(rizhu, TianGan(1)), ShiShen::JieCai);
	// 甲见丙 → 食神
	assert_eq!(calculate_shishen(rizhu, TianGan(2)), ShiShen::ShiShen);
	// 甲见丁 → 伤官
	assert_eq!(calculate_shishen(rizhu, TianGan(3)), ShiShen::ShangGuan);
}

// ================================
// Pallet 功能测试（占位）
// ================================

#[test]
fn test_create_bazi_chart_placeholder() {
	new_test_ext().execute_with(|| {
		// TODO: 实现完整的创建八字测试
		// 当前只是占位，确保编译通过
	});
}

// ================================
// 边界情况测试
// ================================

#[test]
fn test_leap_year() {
	// 测试闰年判断
	use crate::calculations::ganzhi::is_leap_year;

	assert!(is_leap_year(2000)); // 2000年是闰年
	assert!(is_leap_year(2024)); // 2024年是闰年
	assert!(!is_leap_year(1900)); // 1900年不是闰年
	assert!(!is_leap_year(2023)); // 2023年不是闰年
}

#[test]
fn test_days_in_month() {
	// 测试月份天数
	use crate::calculations::ganzhi::get_days_in_month;

	assert_eq!(get_days_in_month(2024, 1), 31); // 1月31天
	assert_eq!(get_days_in_month(2024, 2), 29); // 2024年2月29天（闰年）
	assert_eq!(get_days_in_month(2023, 2), 28); // 2023年2月28天（平年）
	assert_eq!(get_days_in_month(2024, 4), 30); // 4月30天
}

// ================================
// 月柱计算测试
// ================================

#[test]
fn test_month_ganzhi_1990_11_29() {
	// 关键测试：1990年11月29日12时 月柱应该是 丁亥
	// 1990年是庚午年，年干是庚(6)
	use crate::calculations::calculate_month_ganzhi;

	let gz = calculate_month_ganzhi(1990, 11, 29, 6).expect("月柱计算失败");

	// 丁亥: 天干丁(3), 地支亥(11)
	assert_eq!(gz.gan.0, 3, "月干应该是丁(3)，实际得到: {}", gz.gan.0);
	assert_eq!(gz.zhi.0, 11, "月支应该是亥(11)，实际得到: {}", gz.zhi.0);
}

#[test]
fn test_month_ganzhi_1990_12_23() {
	// 关键测试：1990年12月23日12时 月柱应该是 戊子
	// 1990年是庚午年，年干是庚(6)
	// 1990年大雪：12月7日左右
	// 12月23日在大雪之后，属于子月(0)
	use crate::calculations::calculate_month_ganzhi;

	let gz = calculate_month_ganzhi(1990, 12, 23, 6).expect("月柱计算失败");

	// 戊子: 天干戊(4), 地支子(0)
	assert_eq!(gz.gan.0, 4, "月干应该是戊(4)，实际得到: {}", gz.gan.0);
	assert_eq!(gz.zhi.0, 0, "月支应该是子(0)，实际得到: {}", gz.zhi.0);
}

#[test]
fn test_jieqi_1990_lidong_daxue() {
	// 验证1990年立冬和大雪的计算
	use crate::calculations::jieqi::get_jieqi_time;

	// 1990年立冬(索引15)应该在11月7日左右
	let lidong = get_jieqi_time(1990, 15);
	assert_eq!(lidong.year, 1990, "立冬年份");
	assert_eq!(lidong.month, 11, "立冬月份");
	assert!(lidong.day >= 7 && lidong.day <= 8, "1990年立冬应该在11月7-8日，实际: {}日", lidong.day);

	// 1990年大雪(索引17)应该在12月7日左右
	let daxue = get_jieqi_time(1990, 17);
	assert_eq!(daxue.year, 1990, "大雪年份");
	assert_eq!(daxue.month, 12, "大雪月份");
	assert!(daxue.day >= 6 && daxue.day <= 8, "1990年大雪应该在12月6-8日，实际: {}日", daxue.day);
}
