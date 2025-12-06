//! # 八字排盘数据类型定义
//!
//! 本模块定义了八字排盘所需的所有数据类型，包括：
//! - 基础类型: 天干、地支、干支、五行
//! - 命理类型: 十神、纳音、藏干、性别
//! - 模式类型: 子时归属模式、节气枚举
//! - 复合类型: 四柱、大运、八字完整信息

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;

// ================================
// 基础类型定义
// ================================

/// 天干类型 (0-9)
///
/// 甲(0) 乙(1) 丙(2) 丁(3) 戊(4) 己(5) 庚(6) 辛(7) 壬(8) 癸(9)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct TianGan(pub u8);

impl TianGan {
	/// 创建天干，验证范围 (0-9)
	pub fn new(value: u8) -> Option<Self> {
		if value < 10 {
			Some(Self(value))
		} else {
			None
		}
	}

	/// 转换为五行
	pub fn to_wuxing(&self) -> WuXing {
		match self.0 {
			0 | 1 => WuXing::Mu,    // 甲乙木
			2 | 3 => WuXing::Huo,   // 丙丁火
			4 | 5 => WuXing::Tu,    // 戊己土
			6 | 7 => WuXing::Jin,   // 庚辛金
			8 | 9 => WuXing::Shui,  // 壬癸水
			_ => unreachable!(),
		}
	}

	/// 判断是否为阳干
	pub fn is_yang(&self) -> bool {
		self.0 % 2 == 0
	}

	/// 获取天干名称
	pub fn name(&self) -> &'static str {
		match self.0 {
			0 => "甲",
			1 => "乙",
			2 => "丙",
			3 => "丁",
			4 => "戊",
			5 => "己",
			6 => "庚",
			7 => "辛",
			8 => "壬",
			9 => "癸",
			_ => "未知",
		}
	}
}

/// 地支类型 (0-11)
///
/// 子(0) 丑(1) 寅(2) 卯(3) 辰(4) 巳(5) 午(6) 未(7) 申(8) 酉(9) 戌(10) 亥(11)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct DiZhi(pub u8);

impl DiZhi {
	/// 创建地支，验证范围 (0-11)
	pub fn new(value: u8) -> Option<Self> {
		if value < 12 {
			Some(Self(value))
		} else {
			None
		}
	}

	/// 转换为五行
	pub fn to_wuxing(&self) -> WuXing {
		match self.0 {
			2 | 3 => WuXing::Mu,       // 寅卯木
			5 | 6 => WuXing::Huo,      // 巳午火
			8 | 9 => WuXing::Jin,      // 申酉金
			11 | 0 => WuXing::Shui,    // 亥子水
			1 | 4 | 7 | 10 => WuXing::Tu,  // 辰戌丑未土
			_ => unreachable!(),
		}
	}

	/// 获取地支名称
	pub fn name(&self) -> &'static str {
		match self.0 {
			0 => "子",
			1 => "丑",
			2 => "寅",
			3 => "卯",
			4 => "辰",
			5 => "巳",
			6 => "午",
			7 => "未",
			8 => "申",
			9 => "酉",
			10 => "戌",
			11 => "亥",
			_ => "未知",
		}
	}

	/// 获取对应的时辰范围
	///
	/// 返回: (开始小时, 结束小时)
	pub fn to_shichen(&self) -> (u8, u8) {
		match self.0 {
			0 => (23, 1),   // 子时 23:00-01:00
			n => ((n * 2 - 1), (n * 2 + 1)),
		}
	}
}

/// 干支组合 (0-59)
///
/// 六十甲子从"甲子"(0)到"癸亥"(59)循环
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct GanZhi {
	/// 天干
	pub gan: TianGan,
	/// 地支
	pub zhi: DiZhi,
}

impl GanZhi {
	/// 从索引创建干支 (0-59)
	pub fn from_index(index: u8) -> Option<Self> {
		if index < 60 {
			Some(Self {
				gan: TianGan(index % 10),
				zhi: DiZhi(index % 12),
			})
		} else {
			None
		}
	}

	/// 转换为索引 (0-59)
	pub fn to_index(&self) -> u8 {
		// 使用中国剩余定理求解
		// 找到满足 x ≡ gan (mod 10) 且 x ≡ zhi (mod 12) 的最小非负整数
		for i in 0..6 {
			let candidate = i * 10 + self.gan.0;
			if candidate % 12 == self.zhi.0 {
				return candidate;
			}
		}
		unreachable!()
	}

	/// 下一个干支
	pub fn next(&self) -> Self {
		let next_index = (self.to_index() + 1) % 60;
		Self::from_index(next_index).unwrap()
	}

	/// 上一个干支
	pub fn prev(&self) -> Self {
		let prev_index = (self.to_index() + 59) % 60;
		Self::from_index(prev_index).unwrap()
	}

	/// 获取干支名称
	pub fn name(&self) -> (&'static str, &'static str) {
		(self.gan.name(), self.zhi.name())
	}
}

/// 五行类型
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum WuXing {
	/// 金
	Jin,
	/// 木
	Mu,
	/// 水
	Shui,
	/// 火
	Huo,
	/// 土
	Tu,
}

impl WuXing {
	/// 获取五行名称
	pub fn name(&self) -> &'static str {
		match self {
			WuXing::Jin => "金",
			WuXing::Mu => "木",
			WuXing::Shui => "水",
			WuXing::Huo => "火",
			WuXing::Tu => "土",
		}
	}
}

/// 十神类型
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum ShiShen {
	/// 比肩 - 同我(同性)
	BiJian,
	/// 劫财 - 同我(异性)
	JieCai,
	/// 食神 - 我生(同性)
	ShiShen,
	/// 伤官 - 我生(异性)
	ShangGuan,
	/// 偏财 - 我克(同性)
	PianCai,
	/// 正财 - 我克(异性)
	ZhengCai,
	/// 七杀 - 克我(同性)
	QiSha,
	/// 正官 - 克我(异性)
	ZhengGuan,
	/// 偏印 - 生我(同性)
	PianYin,
	/// 正印 - 生我(异性)
	ZhengYin,
}

impl ShiShen {
	/// 获取十神名称
	pub fn name(&self) -> &'static str {
		match self {
			ShiShen::BiJian => "比肩",
			ShiShen::JieCai => "劫财",
			ShiShen::ShiShen => "食神",
			ShiShen::ShangGuan => "伤官",
			ShiShen::PianCai => "偏财",
			ShiShen::ZhengCai => "正财",
			ShiShen::QiSha => "七杀",
			ShiShen::ZhengGuan => "正官",
			ShiShen::PianYin => "偏印",
			ShiShen::ZhengYin => "正印",
		}
	}
}

// ================================
// 高级类型定义
// ================================

/// 十二长生（星运）
///
/// 表示天干在地支中的生旺死绝状态
/// 用于判断日主在四柱各支的旺衰程度
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum ShiErChangSheng {
	/// 长生 - 如人之初生，生命开始
	ChangSheng = 0,
	/// 沐浴 - 如婴儿沐浴，脆弱之时
	MuYu = 1,
	/// 冠带 - 如人戴冠束带，渐成气象
	GuanDai = 2,
	/// 临官 - 如人临官任职，得意之时
	LinGuan = 3,
	/// 帝旺 - 如帝王当朝，最旺盛时
	DiWang = 4,
	/// 衰 - 如人年老体衰
	Shuai = 5,
	/// 病 - 如人疾病缠身
	Bing = 6,
	/// 死 - 如人气绝身亡
	Si = 7,
	/// 墓 - 如人入墓归土
	Mu = 8,
	/// 绝 - 如人形骸俱灭
	Jue = 9,
	/// 胎 - 如人受胎于母腹
	Tai = 10,
	/// 养 - 如人在母腹中成形
	Yang = 11,
}

impl ShiErChangSheng {
	/// 获取十二长生名称
	pub fn name(&self) -> &'static str {
		match self {
			ShiErChangSheng::ChangSheng => "长生",
			ShiErChangSheng::MuYu => "沐浴",
			ShiErChangSheng::GuanDai => "冠带",
			ShiErChangSheng::LinGuan => "临官",
			ShiErChangSheng::DiWang => "帝旺",
			ShiErChangSheng::Shuai => "衰",
			ShiErChangSheng::Bing => "病",
			ShiErChangSheng::Si => "死",
			ShiErChangSheng::Mu => "墓",
			ShiErChangSheng::Jue => "绝",
			ShiErChangSheng::Tai => "胎",
			ShiErChangSheng::Yang => "养",
		}
	}

	/// 判断是否为旺相状态（长生、冠带、临官、帝旺）
	pub fn is_prosperous(&self) -> bool {
		matches!(self,
			ShiErChangSheng::ChangSheng |
			ShiErChangSheng::GuanDai |
			ShiErChangSheng::LinGuan |
			ShiErChangSheng::DiWang
		)
	}

	/// 判断是否为衰败状态（衰、病、死、墓、绝）
	pub fn is_declining(&self) -> bool {
		matches!(self,
			ShiErChangSheng::Shuai |
			ShiErChangSheng::Bing |
			ShiErChangSheng::Si |
			ShiErChangSheng::Mu |
			ShiErChangSheng::Jue
		)
	}
}

/// 藏干类型
///
/// 每个地支藏有1-3个天干，分为主气、中气、余气
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum CangGanType {
	/// 主气（权重最高）
	ZhuQi,
	/// 中气（权重中等）
	ZhongQi,
	/// 余气（权重最低）
	YuQi,
}

/// 藏干信息
///
/// 包含藏干天干、十神关系、藏干类型和权重
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub struct CangGanInfo {
	/// 藏干天干
	pub gan: TianGan,
	/// 与日主的十神关系
	pub shishen: ShiShen,
	/// 藏干类型（主气/中气/余气）
	pub canggan_type: CangGanType,
	/// 权重（用于五行强度计算）
	pub weight: u16,
}

/// 纳音五行 (30种)
///
/// 六十甲子对应30种纳音五行，每两个相邻干支共享一个纳音
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum NaYin {
	HaiZhongJin,    // 海中金 (甲子乙丑)
	LuZhongHuo,     // 炉中火 (丙寅丁卯)
	DaLinMu,        // 大林木 (戊辰己巳)
	LuPangTu,       // 路旁土 (庚午辛未)
	JianFengJin,    // 剑锋金 (壬申癸酉)
	ShanTouHuo,     // 山头火 (甲戌乙亥)
	JianXiaShui,    // 涧下水 (丙子丁丑)
	ChengTouTu,     // 城头土 (戊寅己卯)
	BaiLaJin,       // 白蜡金 (庚辰辛巳)
	YangLiuMu,      // 杨柳木 (壬午癸未)
	QuanZhongShui,  // 泉中水 (甲申乙酉)
	WuShangTu,      // 屋上土 (丙戌丁亥)
	PiLiHuo,        // 霹雳火 (戊子己丑)
	SongBaiMu,      // 松柏木 (庚寅辛卯)
	ChangLiuShui,   // 长流水 (壬辰癸巳)
	ShaZhongJin,    // 沙中金 (甲午乙未)
	ShanXiaHuo,     // 山下火 (丙申丁酉)
	PingDiMu,       // 平地木 (戊戌己亥)
	BiShangTu,      // 壁上土 (庚子辛丑)
	JinBoJin,       // 金箔金 (壬寅癸卯)
	FuDengHuo,      // 覆灯火 (甲辰乙巳)
	TianHeShui,     // 天河水 (丙午丁未)
	DaYiTu,         // 大驿土 (戊申己酉)
	ChaiChuanJin,   // 钗钏金 (庚戌辛亥)
	SangTuoMu,      // 桑柘木 (壬子癸丑)
	DaXiShui,       // 大溪水 (甲寅乙卯)
	ShaZhongTu,     // 沙中土 (丙辰丁巳)
	TianShangHuo,   // 天上火 (戊午己未)
	ShiLiuMu,       // 石榴木 (庚申辛酉)
	DaHaiShui,      // 大海水 (壬戌癸亥)
}

impl NaYin {
	/// 获取纳音名称
	pub fn name(&self) -> &'static str {
		match self {
			NaYin::HaiZhongJin => "海中金",
			NaYin::LuZhongHuo => "炉中火",
			NaYin::DaLinMu => "大林木",
			NaYin::LuPangTu => "路旁土",
			NaYin::JianFengJin => "剑锋金",
			NaYin::ShanTouHuo => "山头火",
			NaYin::JianXiaShui => "涧下水",
			NaYin::ChengTouTu => "城头土",
			NaYin::BaiLaJin => "白蜡金",
			NaYin::YangLiuMu => "杨柳木",
			NaYin::QuanZhongShui => "泉中水",
			NaYin::WuShangTu => "屋上土",
			NaYin::PiLiHuo => "霹雳火",
			NaYin::SongBaiMu => "松柏木",
			NaYin::ChangLiuShui => "长流水",
			NaYin::ShaZhongJin => "沙中金",
			NaYin::ShanXiaHuo => "山下火",
			NaYin::PingDiMu => "平地木",
			NaYin::BiShangTu => "壁上土",
			NaYin::JinBoJin => "金箔金",
			NaYin::FuDengHuo => "覆灯火",
			NaYin::TianHeShui => "天河水",
			NaYin::DaYiTu => "大驿土",
			NaYin::ChaiChuanJin => "钗钏金",
			NaYin::SangTuoMu => "桑柘木",
			NaYin::DaXiShui => "大溪水",
			NaYin::ShaZhongTu => "沙中土",
			NaYin::TianShangHuo => "天上火",
			NaYin::ShiLiuMu => "石榴木",
			NaYin::DaHaiShui => "大海水",
		}
	}
}

/// 子时归属模式
///
/// ⚠️ 关键功能：支持传统派和现代派两种子时归属模式
///
/// - 传统派：23:00-23:59 属于次日（早子时）
/// - 现代派：23:00-23:59 属于当日（晚子时）
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen)]
pub enum ZiShiMode {
	/// 传统派：23:00-23:59 属于次日
	Traditional = 1,
	/// 现代派：23:00-23:59 属于当日
	Modern = 2,
}

/// 节气枚举 (24节气中的12个节)
///
/// 注：八字月份以节气为界，这里只列出12个"节"（不含"气"）
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen)]
pub enum JieQi {
	XiaoHan = 0,   // 小寒 (十二月节)
	LiChun = 1,    // 立春 (正月节)
	JingZhe = 2,   // 惊蛰 (二月节)
	QingMing = 3,  // 清明 (三月节)
	LiXia = 4,     // 立夏 (四月节)
	MangZhong = 5, // 芒种 (五月节)
	XiaoShu = 6,   // 小暑 (六月节)
	LiQiu = 7,     // 立秋 (七月节)
	BaiLu = 8,     // 白露 (八月节)
	HanLu = 9,     // 寒露 (九月节)
	LiDong = 10,   // 立冬 (十月节)
	DaXue = 11,    // 大雪 (十一月节)
}

impl JieQi {
	/// 节气对应的八字月份
	pub fn to_bazi_month(&self) -> u8 {
		(*self as u8 % 12) + 1
	}

	/// 获取节气名称
	pub fn name(&self) -> &'static str {
		match self {
			JieQi::XiaoHan => "小寒",
			JieQi::LiChun => "立春",
			JieQi::JingZhe => "惊蛰",
			JieQi::QingMing => "清明",
			JieQi::LiXia => "立夏",
			JieQi::MangZhong => "芒种",
			JieQi::XiaoShu => "小暑",
			JieQi::LiQiu => "立秋",
			JieQi::BaiLu => "白露",
			JieQi::HanLu => "寒露",
			JieQi::LiDong => "立冬",
			JieQi::DaXue => "大雪",
		}
	}
}

/// 性别
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen)]
pub enum Gender {
	/// 男性
	Male = 1,
	/// 女性
	Female = 0,
}

// ================================
// 复合类型定义
// ================================

/// 出生时间
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen)]
pub struct BirthTime {
	/// 公历年份 (1900-2100)
	pub year: u16,
	/// 公历月份 (1-12)
	pub month: u8,
	/// 公历日期 (1-31)
	pub day: u8,
	/// 小时 (0-23)
	pub hour: u8,
	/// 分钟 (0-59)
	pub minute: u8,
}

/// 单个柱 (年/月/日/时)
#[derive(Clone, Debug, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Zhu<T: crate::pallet::Config> {
	/// 干支组合
	pub ganzhi: GanZhi,
	/// 藏干信息（含权重和类型）
	pub canggan: BoundedVec<CangGanInfo, T::MaxCangGan>,
	/// 纳音
	pub nayin: NaYin,
}

impl<T: crate::pallet::Config> PartialEq for Zhu<T> {
	fn eq(&self, other: &Self) -> bool {
		self.ganzhi == other.ganzhi &&
		self.canggan.iter().zip(other.canggan.iter()).all(|(a, b)| a == b) &&
		self.nayin == other.nayin
	}
}

impl<T: crate::pallet::Config> Eq for Zhu<T> {}

/// 四柱
#[derive(Clone, Debug, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct SiZhu<T: crate::pallet::Config> {
	/// 年柱
	pub year_zhu: Zhu<T>,
	/// 月柱
	pub month_zhu: Zhu<T>,
	/// 日柱
	pub day_zhu: Zhu<T>,
	/// 时柱
	pub hour_zhu: Zhu<T>,
	/// 日主（日柱天干）
	pub rizhu: TianGan,
}

impl<T: crate::pallet::Config> PartialEq for SiZhu<T> {
	fn eq(&self, other: &Self) -> bool {
		self.year_zhu == other.year_zhu &&
		self.month_zhu == other.month_zhu &&
		self.day_zhu == other.day_zhu &&
		self.hour_zhu == other.hour_zhu &&
		self.rizhu == other.rizhu
	}
}

impl<T: crate::pallet::Config> Eq for SiZhu<T> {}

/// 单步大运
#[derive(Clone, Debug, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct DaYunStep<T: crate::pallet::Config> {
	/// 大运干支
	pub ganzhi: GanZhi,
	/// 起始年龄
	pub start_age: u8,
	/// 结束年龄
	pub end_age: u8,
	/// 起始年份
	pub start_year: u16,
	/// 结束年份
	pub end_year: u16,
	/// 天干十神
	pub tiangan_shishen: ShiShen,
	/// 藏干十神列表
	pub canggan_shishen: BoundedVec<ShiShen, T::MaxCangGan>,
}

impl<T: crate::pallet::Config> PartialEq for DaYunStep<T> {
	fn eq(&self, other: &Self) -> bool {
		self.ganzhi == other.ganzhi &&
		self.start_age == other.start_age &&
		self.end_age == other.end_age &&
		self.start_year == other.start_year &&
		self.end_year == other.end_year &&
		self.tiangan_shishen == other.tiangan_shishen &&
		self.canggan_shishen.iter().zip(other.canggan_shishen.iter()).all(|(a, b)| a == b)
	}
}

impl<T: crate::pallet::Config> Eq for DaYunStep<T> {}

/// 大运信息
#[derive(Clone, Debug, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct DaYunInfo<T: crate::pallet::Config> {
	/// 起运年龄
	pub qiyun_age: u8,
	/// 起运年份
	pub qiyun_year: u16,
	/// 是否顺排（true=顺，false=逆）
	pub is_shun: bool,
	/// 大运列表（10-12步）
	pub dayun_list: BoundedVec<DaYunStep<T>, T::MaxDaYunSteps>,
}

impl<T: crate::pallet::Config> PartialEq for DaYunInfo<T> {
	fn eq(&self, other: &Self) -> bool {
		self.qiyun_age == other.qiyun_age &&
		self.qiyun_year == other.qiyun_year &&
		self.is_shun == other.is_shun &&
		self.dayun_list.iter().zip(other.dayun_list.iter()).all(|(a, b)| a == b)
	}
}

impl<T: crate::pallet::Config> Eq for DaYunInfo<T> {}

/// 五行强度
#[derive(Clone, Copy, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, Default)]
pub struct WuXingStrength {
	/// 金的强度
	pub jin: u32,
	/// 木的强度
	pub mu: u32,
	/// 水的强度
	pub shui: u32,
	/// 火的强度
	pub huo: u32,
	/// 土的强度
	pub tu: u32,
}

impl WuXingStrength {
	/// 添加五行强度
	pub fn add_element(&mut self, wuxing: WuXing, value: u32) {
		match wuxing {
			WuXing::Jin => self.jin += value,
			WuXing::Mu => self.mu += value,
			WuXing::Shui => self.shui += value,
			WuXing::Huo => self.huo += value,
			WuXing::Tu => self.tu += value,
		}
	}
}

/// 完整八字信息
#[derive(Clone, Debug, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct BaziChart<T: crate::pallet::Config> {
	/// 所有者账户
	pub owner: T::AccountId,
	/// 出生时间
	pub birth_time: BirthTime,
	/// 性别
	pub gender: Gender,
	/// 子时模式
	pub zishi_mode: ZiShiMode,
	/// 四柱
	pub sizhu: SiZhu<T>,
	/// 大运
	pub dayun: DaYunInfo<T>,
	/// 五行强度
	pub wuxing_strength: WuXingStrength,
	/// 喜用神
	pub xiyong_shen: Option<WuXing>,
	/// 创建时间戳（区块号）
	pub timestamp: u64,
}

impl<T: crate::pallet::Config> PartialEq for BaziChart<T> {
	fn eq(&self, other: &Self) -> bool {
		self.owner == other.owner &&
		self.birth_time == other.birth_time &&
		self.gender == other.gender &&
		self.zishi_mode == other.zishi_mode &&
		self.sizhu == other.sizhu &&
		self.dayun == other.dayun &&
		self.wuxing_strength == other.wuxing_strength &&
		self.xiyong_shen == other.xiyong_shen &&
		self.timestamp == other.timestamp
	}
}

impl<T: crate::pallet::Config> Eq for BaziChart<T> {}
