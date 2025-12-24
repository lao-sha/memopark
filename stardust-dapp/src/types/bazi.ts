/**
 * 八字命理类型定义
 *
 * 包含天干地支、五行、十神、四柱、大运等核心概念的类型定义
 * 用于八字排盘和命理分析功能
 */

// ==================== 基础类型 ====================

/**
 * 天干枚举
 * 十天干：甲乙丙丁戊己庚辛壬癸
 */
export enum TianGan {
  Jia = 0,   // 甲
  Yi = 1,    // 乙
  Bing = 2,  // 丙
  Ding = 3,  // 丁
  Wu = 4,    // 戊
  Ji = 5,    // 己
  Geng = 6,  // 庚
  Xin = 7,   // 辛
  Ren = 8,   // 壬
  Gui = 9,   // 癸
}

/** 天干中文名称 */
export const TIAN_GAN_NAMES: Record<TianGan, string> = {
  [TianGan.Jia]: '甲',
  [TianGan.Yi]: '乙',
  [TianGan.Bing]: '丙',
  [TianGan.Ding]: '丁',
  [TianGan.Wu]: '戊',
  [TianGan.Ji]: '己',
  [TianGan.Geng]: '庚',
  [TianGan.Xin]: '辛',
  [TianGan.Ren]: '壬',
  [TianGan.Gui]: '癸',
};

/**
 * 地支枚举
 * 十二地支：子丑寅卯辰巳午未申酉戌亥
 */
export enum DiZhi {
  Zi = 0,   // 子
  Chou = 1, // 丑
  Yin = 2,  // 寅
  Mao = 3,  // 卯
  Chen = 4, // 辰
  Si = 5,   // 巳
  Wu = 6,   // 午
  Wei = 7,  // 未
  Shen = 8, // 申
  You = 9,  // 酉
  Xu = 10,  // 戌
  Hai = 11, // 亥
}

/** 地支中文名称 */
export const DI_ZHI_NAMES: Record<DiZhi, string> = {
  [DiZhi.Zi]: '子',
  [DiZhi.Chou]: '丑',
  [DiZhi.Yin]: '寅',
  [DiZhi.Mao]: '卯',
  [DiZhi.Chen]: '辰',
  [DiZhi.Si]: '巳',
  [DiZhi.Wu]: '午',
  [DiZhi.Wei]: '未',
  [DiZhi.Shen]: '申',
  [DiZhi.You]: '酉',
  [DiZhi.Xu]: '戌',
  [DiZhi.Hai]: '亥',
};

/** 地支对应的时辰范围 */
export const DI_ZHI_HOURS: Record<DiZhi, string> = {
  [DiZhi.Zi]: '23:00-01:00',
  [DiZhi.Chou]: '01:00-03:00',
  [DiZhi.Yin]: '03:00-05:00',
  [DiZhi.Mao]: '05:00-07:00',
  [DiZhi.Chen]: '07:00-09:00',
  [DiZhi.Si]: '09:00-11:00',
  [DiZhi.Wu]: '11:00-13:00',
  [DiZhi.Wei]: '13:00-15:00',
  [DiZhi.Shen]: '15:00-17:00',
  [DiZhi.You]: '17:00-19:00',
  [DiZhi.Xu]: '19:00-21:00',
  [DiZhi.Hai]: '21:00-23:00',
};

/**
 * 五行枚举
 */
export enum WuXing {
  Mu = 0,   // 木
  Huo = 1,  // 火
  Tu = 2,   // 土
  Jin = 3,  // 金
  Shui = 4, // 水
}

/** 五行中文名称 */
export const WU_XING_NAMES: Record<WuXing, string> = {
  [WuXing.Mu]: '木',
  [WuXing.Huo]: '火',
  [WuXing.Tu]: '土',
  [WuXing.Jin]: '金',
  [WuXing.Shui]: '水',
};

/** 五行颜色 */
export const WU_XING_COLORS: Record<WuXing, string> = {
  [WuXing.Mu]: '#52c41a', // 绿色
  [WuXing.Huo]: '#f5222d', // 红色
  [WuXing.Tu]: '#faad14', // 黄色
  [WuXing.Jin]: '#ffffff', // 白色（带边框）
  [WuXing.Shui]: '#1890ff', // 蓝色
};

/** 五行背景色 */
export const WU_XING_BG_COLORS: Record<WuXing, string> = {
  [WuXing.Mu]: '#f6ffed',
  [WuXing.Huo]: '#fff1f0',
  [WuXing.Tu]: '#fffbe6',
  [WuXing.Jin]: '#f5f5f5',
  [WuXing.Shui]: '#e6f7ff',
};

/** 天干对应五行 */
export const TIAN_GAN_WU_XING: Record<TianGan, WuXing> = {
  [TianGan.Jia]: WuXing.Mu,
  [TianGan.Yi]: WuXing.Mu,
  [TianGan.Bing]: WuXing.Huo,
  [TianGan.Ding]: WuXing.Huo,
  [TianGan.Wu]: WuXing.Tu,
  [TianGan.Ji]: WuXing.Tu,
  [TianGan.Geng]: WuXing.Jin,
  [TianGan.Xin]: WuXing.Jin,
  [TianGan.Ren]: WuXing.Shui,
  [TianGan.Gui]: WuXing.Shui,
};

/** 地支对应五行 */
export const DI_ZHI_WU_XING: Record<DiZhi, WuXing> = {
  [DiZhi.Zi]: WuXing.Shui,
  [DiZhi.Chou]: WuXing.Tu,
  [DiZhi.Yin]: WuXing.Mu,
  [DiZhi.Mao]: WuXing.Mu,
  [DiZhi.Chen]: WuXing.Tu,
  [DiZhi.Si]: WuXing.Huo,
  [DiZhi.Wu]: WuXing.Huo,
  [DiZhi.Wei]: WuXing.Tu,
  [DiZhi.Shen]: WuXing.Jin,
  [DiZhi.You]: WuXing.Jin,
  [DiZhi.Xu]: WuXing.Tu,
  [DiZhi.Hai]: WuXing.Shui,
};

// ==================== 十神系统 ====================

/**
 * 十神枚举
 */
export enum ShiShen {
  BiJian = 0,   // 比肩
  JieCai = 1,   // 劫财
  ShiShen = 2,  // 食神
  ShangGuan = 3, // 伤官
  ZhengCai = 4, // 正财
  PianCai = 5,  // 偏财
  ZhengGuan = 6, // 正官
  QiSha = 7,    // 七杀（偏官）
  ZhengYin = 8, // 正印
  PianYin = 9,  // 偏印（枭神）
}

/** 十神中文名称 */
export const SHI_SHEN_NAMES: Record<ShiShen, string> = {
  [ShiShen.BiJian]: '比肩',
  [ShiShen.JieCai]: '劫财',
  [ShiShen.ShiShen]: '食神',
  [ShiShen.ShangGuan]: '伤官',
  [ShiShen.ZhengCai]: '正财',
  [ShiShen.PianCai]: '偏财',
  [ShiShen.ZhengGuan]: '正官',
  [ShiShen.QiSha]: '七杀',
  [ShiShen.ZhengYin]: '正印',
  [ShiShen.PianYin]: '偏印',
};

/** 十神简称 */
export const SHI_SHEN_SHORT: Record<ShiShen, string> = {
  [ShiShen.BiJian]: '比',
  [ShiShen.JieCai]: '劫',
  [ShiShen.ShiShen]: '食',
  [ShiShen.ShangGuan]: '伤',
  [ShiShen.ZhengCai]: '财',
  [ShiShen.PianCai]: '才',
  [ShiShen.ZhengGuan]: '官',
  [ShiShen.QiSha]: '杀',
  [ShiShen.ZhengYin]: '印',
  [ShiShen.PianYin]: '枭',
};

/** 十神颜色 */
export const SHI_SHEN_COLORS: Record<ShiShen, string> = {
  [ShiShen.BiJian]: '#722ed1',
  [ShiShen.JieCai]: '#722ed1',
  [ShiShen.ShiShen]: '#52c41a',
  [ShiShen.ShangGuan]: '#52c41a',
  [ShiShen.ZhengCai]: '#faad14',
  [ShiShen.PianCai]: '#faad14',
  [ShiShen.ZhengGuan]: '#f5222d',
  [ShiShen.QiSha]: '#f5222d',
  [ShiShen.ZhengYin]: '#1890ff',
  [ShiShen.PianYin]: '#1890ff',
};

// ==================== 地支藏干 ====================

/** 地支藏干（本气、中气、余气） */
export const DI_ZHI_CANG_GAN: Record<DiZhi, TianGan[]> = {
  [DiZhi.Zi]: [TianGan.Gui],
  [DiZhi.Chou]: [TianGan.Ji, TianGan.Gui, TianGan.Xin],
  [DiZhi.Yin]: [TianGan.Jia, TianGan.Bing, TianGan.Wu],
  [DiZhi.Mao]: [TianGan.Yi],
  [DiZhi.Chen]: [TianGan.Wu, TianGan.Yi, TianGan.Gui],
  [DiZhi.Si]: [TianGan.Bing, TianGan.Wu, TianGan.Geng],
  [DiZhi.Wu]: [TianGan.Ding, TianGan.Ji],
  [DiZhi.Wei]: [TianGan.Ji, TianGan.Ding, TianGan.Yi],
  [DiZhi.Shen]: [TianGan.Geng, TianGan.Ren, TianGan.Wu],
  [DiZhi.You]: [TianGan.Xin],
  [DiZhi.Xu]: [TianGan.Wu, TianGan.Xin, TianGan.Ding],
  [DiZhi.Hai]: [TianGan.Ren, TianGan.Jia],
};

// ==================== 核心数据结构 ====================

/**
 * 干支组合
 */
export interface GanZhi {
  /** 天干 */
  tianGan: TianGan;
  /** 地支 */
  diZhi: DiZhi;
}

/**
 * 四柱接口
 */
export interface SiZhu {
  /** 年柱 */
  nianZhu: GanZhi;
  /** 月柱 */
  yueZhu: GanZhi;
  /** 日柱 */
  riZhu: GanZhi;
  /** 时柱 */
  shiZhu: GanZhi;
}

/**
 * 单柱详情（包含十神分析）
 */
export interface ZhuDetail {
  /** 干支 */
  ganZhi: GanZhi;
  /** 天干十神 */
  tianGanShiShen: ShiShen | null; // 日干本身为null
  /** 地支藏干 */
  cangGan: TianGan[];
  /** 藏干十神 */
  cangGanShiShen: ShiShen[];
  /** 天干五行 */
  tianGanWuXing: WuXing;
  /** 地支五行 */
  diZhiWuXing: WuXing;
}

/**
 * 五行统计
 */
export interface WuXingCount {
  /** 木 */
  mu: number;
  /** 火 */
  huo: number;
  /** 土 */
  tu: number;
  /** 金 */
  jin: number;
  /** 水 */
  shui: number;
}

/**
 * 大运信息
 */
export interface DaYun {
  /** 大运序号（从1开始） */
  index: number;
  /** 干支 */
  ganZhi: GanZhi;
  /** 起运年龄 */
  startAge: number;
  /** 结束年龄 */
  endAge: number;
  /** 起运年份 */
  startYear: number;
  /** 天干十神 */
  tianGanShiShen: ShiShen;
  /** 地支藏干十神 */
  cangGanShiShen: ShiShen[];
}

/**
 * 流年信息
 */
export interface LiuNian {
  /** 年份 */
  year: number;
  /** 干支 */
  ganZhi: GanZhi;
  /** 天干十神 */
  tianGanShiShen: ShiShen;
  /** 虚岁 */
  age: number;
}

/**
 * 性别
 */
export enum Gender {
  Male = 1,   // 男（与链上定义一致）
  Female = 0, // 女
}

/** 性别名称 */
export const GENDER_NAMES: Record<Gender, string> = {
  [Gender.Male]: '男',
  [Gender.Female]: '女',
};

/**
 * 子时归属模式
 *
 * 传统派：23:00-23:59 属于次日（早子时）
 * 现代派：23:00-23:59 属于当日（晚子时）
 */
export enum ZiShiMode {
  Traditional = 1, // 传统派
  Modern = 2,      // 现代派
}

/** 子时模式名称 */
export const ZI_SHI_MODE_NAMES: Record<ZiShiMode, string> = {
  [ZiShiMode.Traditional]: '传统派',
  [ZiShiMode.Modern]: '现代派',
};

/**
 * 日期输入类型
 *
 * 支持多种日期输入方式
 */
export enum DateInputType {
  Solar = 0,      // 公历输入（默认）
  Lunar = 1,      // 农历输入
  SiZhuDirect = 2, // 四柱直接输入
}

/** 日期输入类型名称 */
export const DATE_INPUT_TYPE_NAMES: Record<DateInputType, string> = {
  [DateInputType.Solar]: '公历',
  [DateInputType.Lunar]: '农历',
  [DateInputType.SiZhuDirect]: '直接输入四柱',
};

/**
 * 农历日期输入
 *
 * 用于农历输入模式，包含农历年月日和闰月标记
 */
export interface LunarDateInput {
  /** 农历年份（1901-2100） */
  year: number;
  /** 农历月份（1-12） */
  month: number;
  /** 农历日期（1-30） */
  day: number;
  /** 是否为闰月 */
  isLeapMonth: boolean;
}

/**
 * 四柱直接输入
 *
 * 用于直接输入四柱干支，跳过日期计算
 * 适用于已知四柱或特殊测算场景
 */
export interface SiZhuDirectInput {
  /** 年柱干支索引（0-59，六十甲子） */
  yearGanZhi: number;
  /** 月柱干支索引（0-59） */
  monthGanZhi: number;
  /** 日柱干支索引（0-59） */
  dayGanZhi: number;
  /** 时柱干支索引（0-59） */
  hourGanZhi: number;
}

/**
 * 验证四柱直接输入有效性
 */
export function isSiZhuDirectInputValid(input: SiZhuDirectInput): boolean {
  return (
    input.yearGanZhi >= 0 && input.yearGanZhi < 60 &&
    input.monthGanZhi >= 0 && input.monthGanZhi < 60 &&
    input.dayGanZhi >= 0 && input.dayGanZhi < 60 &&
    input.hourGanZhi >= 0 && input.hourGanZhi < 60
  );
}

/**
 * 从干支索引获取干支组合
 */
export function ganZhiFromIndex(index: number): GanZhi | null {
  if (index < 0 || index >= 60) return null;
  return {
    tianGan: (index % 10) as TianGan,
    diZhi: (index % 12) as DiZhi,
  };
}

/**
 * 出生地点信息
 *
 * 用于真太阳时计算，提供经度修正时差
 */
export interface BirthPlace {
  /** 经度（单位：1/100000 度，正数为东经，负数为西经） */
  longitude?: number;
  /** 纬度（单位：1/100000 度，正数为北纬，负数为南纬） */
  latitude?: number;
  /** 时区偏移（单位：分钟，相对 UTC，如北京时间 UTC+8 = 480） */
  timezoneOffset?: number;
}

/** 中国主要城市经度常量（单位：1/100000 度） */
export const CHINESE_CITIES: Record<string, number> = {
  BEIJING: 11640000,    // 北京 (东经 116.40°)
  SHANGHAI: 12147000,   // 上海 (东经 121.47°)
  GUANGZHOU: 11326000,  // 广州 (东经 113.26°)
  SHENZHEN: 11406000,   // 深圳 (东经 114.06°)
  CHENGDU: 10407000,    // 成都 (东经 104.07°)
  CHONGQING: 10655000,  // 重庆 (东经 106.55°)
  XIAN: 10894000,       // 西安 (东经 108.94°)
  WUHAN: 11430000,      // 武汉 (东经 114.30°)
  HANGZHOU: 12016000,   // 杭州 (东经 120.16°)
  NANJING: 11878000,    // 南京 (东经 118.78°)
  URUMQI: 8762000,      // 乌鲁木齐 (东经 87.62°)
  LHASA: 9114000,       // 拉萨 (东经 91.14°)
  HARBIN: 12653000,     // 哈尔滨 (东经 126.53°)
  SHENYANG: 12343000,   // 沈阳 (东经 123.43°)
  TAIPEI: 12156000,     // 台北 (东经 121.56°)
  HONGKONG: 11417000,   // 香港 (东经 114.17°)
};

/**
 * 计算经度修正时差（分钟）
 *
 * 公式：修正分钟 = (经度 - 标准子午线经度) × 4
 * 北京时间标准子午线为 120°
 */
export function calculateLongitudeTimeCorrection(
  longitude: number,
  timezoneOffset: number = 480
): number {
  // 标准子午线经度 = 时区偏移 × 15° / 60分钟 × 100000
  const standardMeridian = (timezoneOffset * 15 * 100000) / 60;
  // 修正分钟 = (经度 - 标准子午线) × 4 / 100000
  return Math.round(((longitude - standardMeridian) * 4) / 100000);
}

/**
 * 八字排盘输入
 */
export interface BaziInput {
  /** 公历年 */
  year: number;
  /** 公历月 */
  month: number;
  /** 公历日 */
  day: number;
  /** 时辰（0-23） */
  hour: number;
  /** 分钟（可选，用于精确排盘） */
  minute?: number;
  /** 性别（用于计算大运顺逆） */
  gender: Gender;
  /** 是否考虑真太阳时 */
  useTrueSolarTime?: boolean;
  /** 出生地经度（用于真太阳时计算） */
  longitude?: number;
}

/**
 * 八字排盘结果
 */
export interface BaziResult {
  /** 结果ID（链上存储时使用） */
  id?: number;
  /** 四柱 */
  siZhu: SiZhu;
  /** 四柱详情 */
  siZhuDetail: {
    nian: ZhuDetail;
    yue: ZhuDetail;
    ri: ZhuDetail;
    shi: ZhuDetail;
  };
  /** 日主（日干） */
  riZhu: TianGan;
  /** 日主五行 */
  riZhuWuXing: WuXing;
  /** 五行统计 */
  wuXingCount: WuXingCount;
  /** 五行缺失 */
  wuXingLack: WuXing[];
  /** 大运列表 */
  daYunList: DaYun[];
  /** 起运年龄 */
  qiYunAge: number;
  /** 大运顺逆（true为顺行，false为逆行） */
  daYunShun: boolean;
  /** 命主出生信息 */
  birthInfo: BaziInput;
  /** 农历信息 */
  lunarInfo: {
    year: number;
    month: number;
    day: number;
    isLeapMonth: boolean;
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
  };
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 纳音
 */
export interface NaYin {
  /** 纳音名称 */
  name: string;
  /** 纳音五行 */
  wuXing: WuXing;
}

/** 六十甲子纳音表 */
export const JIA_ZI_NA_YIN: Record<string, NaYin> = {
  '甲子': { name: '海中金', wuXing: WuXing.Jin },
  '乙丑': { name: '海中金', wuXing: WuXing.Jin },
  '丙寅': { name: '炉中火', wuXing: WuXing.Huo },
  '丁卯': { name: '炉中火', wuXing: WuXing.Huo },
  '戊辰': { name: '大林木', wuXing: WuXing.Mu },
  '己巳': { name: '大林木', wuXing: WuXing.Mu },
  '庚午': { name: '路旁土', wuXing: WuXing.Tu },
  '辛未': { name: '路旁土', wuXing: WuXing.Tu },
  '壬申': { name: '剑锋金', wuXing: WuXing.Jin },
  '癸酉': { name: '剑锋金', wuXing: WuXing.Jin },
  '甲戌': { name: '山头火', wuXing: WuXing.Huo },
  '乙亥': { name: '山头火', wuXing: WuXing.Huo },
  '丙子': { name: '涧下水', wuXing: WuXing.Shui },
  '丁丑': { name: '涧下水', wuXing: WuXing.Shui },
  '戊寅': { name: '城头土', wuXing: WuXing.Tu },
  '己卯': { name: '城头土', wuXing: WuXing.Tu },
  '庚辰': { name: '白蜡金', wuXing: WuXing.Jin },
  '辛巳': { name: '白蜡金', wuXing: WuXing.Jin },
  '壬午': { name: '杨柳木', wuXing: WuXing.Mu },
  '癸未': { name: '杨柳木', wuXing: WuXing.Mu },
  '甲申': { name: '泉中水', wuXing: WuXing.Shui },
  '乙酉': { name: '泉中水', wuXing: WuXing.Shui },
  '丙戌': { name: '屋上土', wuXing: WuXing.Tu },
  '丁亥': { name: '屋上土', wuXing: WuXing.Tu },
  '戊子': { name: '霹雳火', wuXing: WuXing.Huo },
  '己丑': { name: '霹雳火', wuXing: WuXing.Huo },
  '庚寅': { name: '松柏木', wuXing: WuXing.Mu },
  '辛卯': { name: '松柏木', wuXing: WuXing.Mu },
  '壬辰': { name: '长流水', wuXing: WuXing.Shui },
  '癸巳': { name: '长流水', wuXing: WuXing.Shui },
  '甲午': { name: '沙中金', wuXing: WuXing.Jin },
  '乙未': { name: '沙中金', wuXing: WuXing.Jin },
  '丙申': { name: '山下火', wuXing: WuXing.Huo },
  '丁酉': { name: '山下火', wuXing: WuXing.Huo },
  '戊戌': { name: '平地木', wuXing: WuXing.Mu },
  '己亥': { name: '平地木', wuXing: WuXing.Mu },
  '庚子': { name: '壁上土', wuXing: WuXing.Tu },
  '辛丑': { name: '壁上土', wuXing: WuXing.Tu },
  '壬寅': { name: '金箔金', wuXing: WuXing.Jin },
  '癸卯': { name: '金箔金', wuXing: WuXing.Jin },
  '甲辰': { name: '覆灯火', wuXing: WuXing.Huo },
  '乙巳': { name: '覆灯火', wuXing: WuXing.Huo },
  '丙午': { name: '天河水', wuXing: WuXing.Shui },
  '丁未': { name: '天河水', wuXing: WuXing.Shui },
  '戊申': { name: '大驿土', wuXing: WuXing.Tu },
  '己酉': { name: '大驿土', wuXing: WuXing.Tu },
  '庚戌': { name: '钗钏金', wuXing: WuXing.Jin },
  '辛亥': { name: '钗钏金', wuXing: WuXing.Jin },
  '壬子': { name: '桑柘木', wuXing: WuXing.Mu },
  '癸丑': { name: '桑柘木', wuXing: WuXing.Mu },
  '甲寅': { name: '大溪水', wuXing: WuXing.Shui },
  '乙卯': { name: '大溪水', wuXing: WuXing.Shui },
  '丙辰': { name: '沙中土', wuXing: WuXing.Tu },
  '丁巳': { name: '沙中土', wuXing: WuXing.Tu },
  '戊午': { name: '天上火', wuXing: WuXing.Huo },
  '己未': { name: '天上火', wuXing: WuXing.Huo },
  '庚申': { name: '石榴木', wuXing: WuXing.Mu },
  '辛酉': { name: '石榴木', wuXing: WuXing.Mu },
  '壬戌': { name: '大海水', wuXing: WuXing.Shui },
  '癸亥': { name: '大海水', wuXing: WuXing.Shui },
};

// ==================== 辅助函数 ====================

/**
 * 获取干支组合的中文名称
 */
export function getGanZhiName(ganZhi: GanZhi): string {
  return TIAN_GAN_NAMES[ganZhi.tianGan] + DI_ZHI_NAMES[ganZhi.diZhi];
}

/**
 * 获取天干的五行
 */
export function getTianGanWuXing(tianGan: TianGan): WuXing {
  return TIAN_GAN_WU_XING[tianGan];
}

/**
 * 获取地支的五行
 */
export function getDiZhiWuXing(diZhi: DiZhi): WuXing {
  return DI_ZHI_WU_XING[diZhi];
}

/**
 * 获取地支的藏干
 */
export function getCangGan(diZhi: DiZhi): TianGan[] {
  return DI_ZHI_CANG_GAN[diZhi];
}

/**
 * 计算十神
 * @param riGan 日干（日主）
 * @param otherGan 要计算的天干
 * @returns 十神类型
 */
export function calculateShiShen(riGan: TianGan, otherGan: TianGan): ShiShen {
  const riWuXing = TIAN_GAN_WU_XING[riGan];
  const otherWuXing = TIAN_GAN_WU_XING[otherGan];
  const riYinYang = riGan % 2; // 0为阳，1为阴
  const otherYinYang = otherGan % 2;
  const sameYinYang = riYinYang === otherYinYang;

  // 同我者为比劫
  if (riWuXing === otherWuXing) {
    return sameYinYang ? ShiShen.BiJian : ShiShen.JieCai;
  }

  // 我生者为食伤
  const iSheng = (riWuXing + 1) % 5;
  if (otherWuXing === iSheng) {
    return sameYinYang ? ShiShen.ShiShen : ShiShen.ShangGuan;
  }

  // 我克者为财
  const iKe = (riWuXing + 2) % 5;
  if (otherWuXing === iKe) {
    return sameYinYang ? ShiShen.PianCai : ShiShen.ZhengCai;
  }

  // 克我者为官杀
  const keI = (riWuXing + 3) % 5;
  if (otherWuXing === keI) {
    return sameYinYang ? ShiShen.QiSha : ShiShen.ZhengGuan;
  }

  // 生我者为印
  const shengI = (riWuXing + 4) % 5;
  if (otherWuXing === shengI) {
    return sameYinYang ? ShiShen.PianYin : ShiShen.ZhengYin;
  }

  // 默认返回比肩（不应该到达这里）
  return ShiShen.BiJian;
}

/**
 * 获取干支的纳音
 */
export function getNaYin(ganZhi: GanZhi): NaYin | null {
  const name = getGanZhiName(ganZhi);
  return JIA_ZI_NA_YIN[name] || null;
}

/**
 * 根据小时获取时辰地支
 */
export function getShiChenFromHour(hour: number): DiZhi {
  // 子时：23-1点，丑时：1-3点，以此类推
  if (hour === 23 || hour === 0) return DiZhi.Zi;
  return Math.floor((hour + 1) / 2) as DiZhi;
}

/**
 * 判断天干是阳干还是阴干
 */
export function isYangGan(tianGan: TianGan): boolean {
  return tianGan % 2 === 0;
}

/**
 * 判断地支是阳支还是阴支
 */
export function isYangZhi(diZhi: DiZhi): boolean {
  return diZhi % 2 === 0;
}

/**
 * 获取下一个天干
 */
export function nextTianGan(tianGan: TianGan): TianGan {
  return ((tianGan + 1) % 10) as TianGan;
}

/**
 * 获取上一个天干
 */
export function prevTianGan(tianGan: TianGan): TianGan {
  return ((tianGan + 9) % 10) as TianGan;
}

/**
 * 获取下一个地支
 */
export function nextDiZhi(diZhi: DiZhi): DiZhi {
  return ((diZhi + 1) % 12) as DiZhi;
}

/**
 * 获取上一个地支
 */
export function prevDiZhi(diZhi: DiZhi): DiZhi {
  return ((diZhi + 11) % 12) as DiZhi;
}

/**
 * 获取下一个干支
 */
export function nextGanZhi(ganZhi: GanZhi): GanZhi {
  return {
    tianGan: nextTianGan(ganZhi.tianGan),
    diZhi: nextDiZhi(ganZhi.diZhi),
  };
}

/**
 * 获取上一个干支
 */
export function prevGanZhi(ganZhi: GanZhi): GanZhi {
  return {
    tianGan: prevTianGan(ganZhi.tianGan),
    diZhi: prevDiZhi(ganZhi.diZhi),
  };
}

/**
 * 格式化五行统计为字符串
 */
export function formatWuXingCount(count: WuXingCount): string {
  return `木${count.mu} 火${count.huo} 土${count.tu} 金${count.jin} 水${count.shui}`;
}

/**
 * 获取五行缺失列表
 */
export function getWuXingLack(count: WuXingCount): WuXing[] {
  const lack: WuXing[] = [];
  if (count.mu === 0) lack.push(WuXing.Mu);
  if (count.huo === 0) lack.push(WuXing.Huo);
  if (count.tu === 0) lack.push(WuXing.Tu);
  if (count.jin === 0) lack.push(WuXing.Jin);
  if (count.shui === 0) lack.push(WuXing.Shui);
  return lack;
}

// ==================== 神煞系统 ====================

/**
 * 神煞类型枚举
 */
export enum ShenSha {
  // 贵人类
  TianYiGuiRen = 0,   // 天乙贵人
  TaiJiGuiRen = 1,    // 太极贵人
  TianDeGuiRen = 2,   // 天德贵人
  YueDeGuiRen = 3,    // 月德贵人
  TianDeHe = 4,       // 天德合
  YueDeHe = 5,        // 月德合
  WenChangGuiRen = 6, // 文昌贵人
  FuXingGuiRen = 7,   // 福星贵人
  GuoYinGuiRen = 8,   // 国印贵人

  // 桃花婚姻类
  TaoHua = 9,         // 桃花（咸池）
  HongLuan = 10,      // 红鸾
  TianXi = 11,        // 天喜
  GuChen = 12,        // 孤辰
  GuaSu = 13,         // 寡宿

  // 财官类
  JinYu = 14,         // 金舆
  JiangXing = 15,     // 将星
  YiMa = 16,          // 驿马
  HuaGai = 17,        // 华盖
  TianChu = 18,       // 天厨

  // 凶神类
  YangRen = 19,       // 羊刃
  WangShen = 20,      // 亡神
  JieSha = 21,        // 劫煞
  XueRen = 22,        // 血刃
  YuanChen = 23,      // 元辰

  // 特殊类
  TianLuo = 24,       // 天罗
  DiWang = 25,        // 地网
  TongZiSha = 26,     // 童子煞
  JiuChou = 27,       // 九丑
  KongWang = 28,      // 空亡
}

/** 神煞中文名称 */
export const SHEN_SHA_NAMES: Record<ShenSha, string> = {
  [ShenSha.TianYiGuiRen]: '天乙贵人',
  [ShenSha.TaiJiGuiRen]: '太极贵人',
  [ShenSha.TianDeGuiRen]: '天德贵人',
  [ShenSha.YueDeGuiRen]: '月德贵人',
  [ShenSha.TianDeHe]: '天德合',
  [ShenSha.YueDeHe]: '月德合',
  [ShenSha.WenChangGuiRen]: '文昌贵人',
  [ShenSha.FuXingGuiRen]: '福星贵人',
  [ShenSha.GuoYinGuiRen]: '国印贵人',
  [ShenSha.TaoHua]: '桃花',
  [ShenSha.HongLuan]: '红鸾',
  [ShenSha.TianXi]: '天喜',
  [ShenSha.GuChen]: '孤辰',
  [ShenSha.GuaSu]: '寡宿',
  [ShenSha.JinYu]: '金舆',
  [ShenSha.JiangXing]: '将星',
  [ShenSha.YiMa]: '驿马',
  [ShenSha.HuaGai]: '华盖',
  [ShenSha.TianChu]: '天厨',
  [ShenSha.YangRen]: '羊刃',
  [ShenSha.WangShen]: '亡神',
  [ShenSha.JieSha]: '劫煞',
  [ShenSha.XueRen]: '血刃',
  [ShenSha.YuanChen]: '元辰',
  [ShenSha.TianLuo]: '天罗',
  [ShenSha.DiWang]: '地网',
  [ShenSha.TongZiSha]: '童子煞',
  [ShenSha.JiuChou]: '九丑',
  [ShenSha.KongWang]: '空亡',
};

/** 神煞吉凶分类 */
export const SHEN_SHA_AUSPICIOUS: Set<ShenSha> = new Set([
  ShenSha.TianYiGuiRen, ShenSha.TaiJiGuiRen, ShenSha.TianDeGuiRen,
  ShenSha.YueDeGuiRen, ShenSha.TianDeHe, ShenSha.YueDeHe,
  ShenSha.WenChangGuiRen, ShenSha.FuXingGuiRen, ShenSha.GuoYinGuiRen,
  ShenSha.HongLuan, ShenSha.TianXi, ShenSha.JinYu,
  ShenSha.JiangXing, ShenSha.TianChu,
]);

/** 单柱神煞信息 */
export interface ZhuShenSha {
  /** 该柱包含的神煞列表 */
  shenShaList: ShenSha[];
}

/** 四柱神煞信息 */
export interface SiZhuShenSha {
  /** 年柱神煞 */
  yearShenSha: ZhuShenSha;
  /** 月柱神煞 */
  monthShenSha: ZhuShenSha;
  /** 日柱神煞 */
  dayShenSha: ZhuShenSha;
  /** 时柱神煞 */
  hourShenSha: ZhuShenSha;
}

// ==================== 刑冲合会系统 ====================

/**
 * 地支关系类型
 */
export enum DiZhiGuanXi {
  LiuHe = 0,      // 六合
  SanHe = 1,      // 三合
  BanHe = 2,      // 半合
  LiuChong = 3,   // 六冲
  SanXing = 4,    // 三刑
  ZiXing = 5,     // 自刑
  LiuHai = 6,     // 六害
  LiuPo = 7,      // 六破
}

/** 地支关系名称 */
export const DI_ZHI_GUAN_XI_NAMES: Record<DiZhiGuanXi, string> = {
  [DiZhiGuanXi.LiuHe]: '六合',
  [DiZhiGuanXi.SanHe]: '三合',
  [DiZhiGuanXi.BanHe]: '半合',
  [DiZhiGuanXi.LiuChong]: '六冲',
  [DiZhiGuanXi.SanXing]: '三刑',
  [DiZhiGuanXi.ZiXing]: '自刑',
  [DiZhiGuanXi.LiuHai]: '六害',
  [DiZhiGuanXi.LiuPo]: '六破',
};

/** 吉利关系 */
export const FAVORABLE_GUAN_XI: Set<DiZhiGuanXi> = new Set([
  DiZhiGuanXi.LiuHe, DiZhiGuanXi.SanHe, DiZhiGuanXi.BanHe,
]);

/**
 * 天干关系类型
 */
export enum TianGanGuanXi {
  WuHe = 0,       // 五合
  XiangChong = 1, // 相冲
}

/** 天干关系名称 */
export const TIAN_GAN_GUAN_XI_NAMES: Record<TianGanGuanXi, string> = {
  [TianGanGuanXi.WuHe]: '五合',
  [TianGanGuanXi.XiangChong]: '相冲',
};

/** 六合描述 */
export const LIUHE_DESC: string[] = [
  '子丑合土', '寅亥合木', '卯戌合火', '辰酉合金', '巳申合水', '午未合土',
];

/** 三合描述 */
export const SANHE_DESC: string[] = [
  '申子辰合水', '亥卯未合木', '寅午戌合火', '巳酉丑合金',
];

/** 六冲描述 */
export const LIUCHONG_DESC: string[] = [
  '子午冲', '丑未冲', '寅申冲', '卯酉冲', '辰戌冲', '巳亥冲',
];

/** 五合描述 */
export const WUHE_DESC: string[] = [
  '甲己合土', '乙庚合金', '丙辛合水', '丁壬合木', '戊癸合火',
];

/** 地支关系记录 */
export interface GuanXiRecord {
  /** 关系类型 */
  guanXiType: DiZhiGuanXi;
  /** 涉及的柱位置（0=年,1=月,2=日,3=时） */
  zhuIdx1: number;
  /** 涉及的柱位置 */
  zhuIdx2: number;
  /** 描述索引 */
  descIndex: number;
  /** 合化五行（如果适用） */
  heHuaWuXing?: WuXing;
}

/** 天干关系记录 */
export interface TianGanGuanXiRecord {
  /** 关系类型 */
  guanXiType: TianGanGuanXi;
  /** 涉及的柱位置（0=年,1=月,2=日,3=时） */
  zhuIdx1: number;
  /** 涉及的柱位置 */
  zhuIdx2: number;
  /** 合化五行（如果适用） */
  heHuaWuXing?: WuXing;
  /** 描述索引 */
  descIndex: number;
}

/** 四柱关系分析结果 */
export interface SiZhuGuanXi {
  /** 地支六合列表 */
  liuHeList: GuanXiRecord[];
  /** 地支半合列表 */
  banHeList: GuanXiRecord[];
  /** 地支六冲列表 */
  liuChongList: GuanXiRecord[];
  /** 地支三刑列表 */
  xingList: GuanXiRecord[];
  /** 地支六害列表 */
  liuHaiList: GuanXiRecord[];
  /** 天干五合列表 */
  tianGanWuHeList: TianGanGuanXiRecord[];
}

// ==================== 解盘系统 ====================

/**
 * 格局类型
 */
export enum GeJuType {
  ZhengGe = 0,      // 正格 - 身旺财官
  CongQiangGe = 1,  // 从强格 - 身旺无制
  CongRuoGe = 2,    // 从弱格 - 身弱无助
  CongCaiGe = 3,    // 从财格 - 财星当令
  CongGuanGe = 4,   // 从官格 - 官星当令
  CongErGe = 5,     // 从儿格 - 食伤当令
  HuaQiGe = 6,      // 化气格 - 干支化合
  TeShuge = 7,      // 特殊格局
}

/** 格局名称 */
export const GE_JU_NAMES: Record<GeJuType, string> = {
  [GeJuType.ZhengGe]: '正格',
  [GeJuType.CongQiangGe]: '从强格',
  [GeJuType.CongRuoGe]: '从弱格',
  [GeJuType.CongCaiGe]: '从财格',
  [GeJuType.CongGuanGe]: '从官格',
  [GeJuType.CongErGe]: '从儿格',
  [GeJuType.HuaQiGe]: '化气格',
  [GeJuType.TeShuge]: '特殊格',
};

/**
 * 命局强弱
 */
export enum MingJuQiangRuo {
  ShenWang = 0,  // 身旺
  ShenRuo = 1,   // 身弱
  ZhongHe = 2,   // 中和
  TaiWang = 3,   // 太旺
  TaiRuo = 4,    // 太弱
}

/** 命局强弱名称 */
export const MING_JU_QIANG_RUO_NAMES: Record<MingJuQiangRuo, string> = {
  [MingJuQiangRuo.ShenWang]: '身旺',
  [MingJuQiangRuo.ShenRuo]: '身弱',
  [MingJuQiangRuo.ZhongHe]: '中和',
  [MingJuQiangRuo.TaiWang]: '太旺',
  [MingJuQiangRuo.TaiRuo]: '太弱',
};

/**
 * 用神类型
 */
export enum YongShenType {
  FuYi = 0,      // 扶抑用神 - 扶弱抑强
  DiaoHou = 1,   // 调候用神 - 调节寒暖
  TongGuan = 2,  // 通关用神 - 化解冲突
  ZhuanWang = 3, // 专旺用神 - 顺势而为
}

/** 用神类型名称 */
export const YONG_SHEN_TYPE_NAMES: Record<YongShenType, string> = {
  [YongShenType.FuYi]: '扶抑用神',
  [YongShenType.DiaoHou]: '调候用神',
  [YongShenType.TongGuan]: '通关用神',
  [YongShenType.ZhuanWang]: '专旺用神',
};

/**
 * 性格特征枚举
 */
export enum XingGeTrait {
  ZhengZhi = 0,         // 正直
  YouZhuJian = 1,       // 有主见
  JiJiXiangShang = 2,   // 积极向上
  GuZhi = 3,            // 固执
  QueFaBianTong = 4,    // 缺乏变通
  WenHe = 5,            // 温和
  ShiYingXingQiang = 6, // 适应性强
  YouYiShuTianFu = 7,   // 有艺术天赋
  YouRouGuaDuan = 8,    // 优柔寡断
  YiLaiXingQiang = 9,   // 依赖性强
  ReQing = 10,          // 热情
  KaiLang = 11,         // 开朗
  YouLingDaoLi = 12,    // 有领导力
  JiZao = 13,           // 急躁
  QueFaNaiXin = 14,     // 缺乏耐心
  XiXin = 15,           // 细心
  YouChuangZaoLi = 16,  // 有创造力
  ShanYuGouTong = 17,   // 善于沟通
  QingXuHua = 18,       // 情绪化
  MinGan = 19,          // 敏感
  WenZhong = 20,        // 稳重
  KeLao = 21,           // 可靠
  YouZeRenXin = 22,     // 有责任心
  BaoShou = 23,         // 保守
  BianHuaMan = 24,      // 变化慢
  // ... 其他特征
}

/** 性格特征名称 */
export const XING_GE_TRAIT_NAMES: Record<number, string> = {
  0: '正直', 1: '有主见', 2: '积极向上', 3: '固执', 4: '缺乏变通',
  5: '温和', 6: '适应性强', 7: '有艺术天赋', 8: '优柔寡断', 9: '依赖性强',
  10: '热情', 11: '开朗', 12: '有领导力', 13: '急躁', 14: '缺乏耐心',
  15: '细心', 16: '有创造力', 17: '善于沟通', 18: '情绪化', 19: '敏感',
  20: '稳重', 21: '可靠', 22: '有责任心', 23: '保守', 24: '变化慢',
};

/**
 * 职业类型枚举
 */
export enum ZhiYeType {
  JiaoYu = 0,       // 教育
  WenHua = 1,       // 文化
  HuanBao = 2,      // 环保
  NongLin = 3,      // 农林
  NengYuan = 4,     // 能源
  YuLe = 5,         // 娱乐
  CanYin = 6,       // 餐饮
  HuaGong = 7,      // 化工
  FangDiChan = 8,   // 房地产
  JianZhu = 9,      // 建筑
  NongYe = 10,      // 农业
  FuWu = 11,        // 服务
  JinRong = 12,     // 金融
  JiXie = 13,       // 机械
  JunJing = 14,     // 军警
  WuJin = 15,       // 五金
  MaoYi = 16,       // 贸易
  YunShu = 17,      // 运输
  ShuiLi = 18,      // 水利
  XinXi = 19,       // 信息
}

/** 职业类型名称 */
export const ZHI_YE_TYPE_NAMES: Record<ZhiYeType, string> = {
  [ZhiYeType.JiaoYu]: '教育',
  [ZhiYeType.WenHua]: '文化',
  [ZhiYeType.HuanBao]: '环保',
  [ZhiYeType.NongLin]: '农林',
  [ZhiYeType.NengYuan]: '能源',
  [ZhiYeType.YuLe]: '娱乐',
  [ZhiYeType.CanYin]: '餐饮',
  [ZhiYeType.HuaGong]: '化工',
  [ZhiYeType.FangDiChan]: '房地产',
  [ZhiYeType.JianZhu]: '建筑',
  [ZhiYeType.NongYe]: '农业',
  [ZhiYeType.FuWu]: '服务',
  [ZhiYeType.JinRong]: '金融',
  [ZhiYeType.JiXie]: '机械',
  [ZhiYeType.JunJing]: '军警',
  [ZhiYeType.WuJin]: '五金',
  [ZhiYeType.MaoYi]: '贸易',
  [ZhiYeType.YunShu]: '运输',
  [ZhiYeType.ShuiLi]: '水利',
  [ZhiYeType.XinXi]: '信息',
};

/** 性格特征 */
export interface XingGeTeZheng {
  /** 主要性格特点 */
  zhuYaoTeDian: XingGeTrait[];
  /** 优点 */
  youDian: XingGeTrait[];
  /** 缺点 */
  queDian: XingGeTrait[];
  /** 适合职业 */
  shiHeZhiYe: ZhiYeType[];
}

/** 解盘结果 */
export interface JiePanResult {
  /** 格局类型 */
  geJu: GeJuType;
  /** 命局强弱 */
  qiangRuo: MingJuQiangRuo;
  /** 用神 */
  yongShen: WuXing;
  /** 用神类型 */
  yongShenType: YongShenType;
  /** 忌神 */
  jiShen: WuXing[];
  /** 性格分析 */
  xingGe: XingGeTeZheng;
  /** 综合评分 (0-100) */
  zongHePingFen: number;
  /** 解盘文本类型索引 */
  jiePanText: number[];
}

// ==================== 五行强度 ====================

/** 五行强度（链上数据格式） */
export interface WuXingStrength {
  /** 金 */
  jin: number;
  /** 木 */
  mu: number;
  /** 水 */
  shui: number;
  /** 火 */
  huo: number;
  /** 土 */
  tu: number;
}

/** 喜用神信息 */
export interface XiYongShen {
  /** 用神 */
  yongShen: WuXing;
  /** 喜神 */
  xiShen: WuXing;
  /** 忌神 */
  jiShen: WuXing;
  /** 仇神 */
  chouShen: WuXing;
  /** 闲神 */
  xianShen: WuXing;
}

// ==================== 扩展八字结果 ====================

/**
 * 扩展的八字排盘结果（包含新增功能）
 */
export interface BaziResultExtended extends BaziResult {
  /** 五行强度分析 */
  wuXingStrength?: WuXingStrength;
  /** 喜用神分析 */
  xiYongShen?: XiYongShen;
  /** 神煞分析 */
  shenSha?: SiZhuShenSha;
  /** 刑冲合会分析 */
  guanXi?: SiZhuGuanXi;
  /** 解盘结果 */
  jiePan?: JiePanResult;
}

// ==================== V5 完整命盘类型 ====================

/**
 * 十二长生枚举
 *
 * 表示天干在地支中的生旺死绝状态
 * 用于判断日主在四柱各支的旺衰程度
 */
export enum ShiErChangSheng {
  ChangSheng = 0,  // 长生 - 如人之初生
  MuYu = 1,        // 沐浴 - 如婴儿沐浴，脆弱之时
  GuanDai = 2,     // 冠带 - 如人戴冠束带
  LinGuan = 3,     // 临官 - 如人临官任职（建禄）
  DiWang = 4,      // 帝旺 - 如帝王当朝，最旺盛
  Shuai = 5,       // 衰 - 如人年老体衰
  Bing = 6,        // 病 - 如人疾病缠身
  Si = 7,          // 死 - 如人气绝身亡
  Mu = 8,          // 墓 - 如人入墓归土（库）
  Jue = 9,         // 绝 - 如人形骸俱灭
  Tai = 10,        // 胎 - 如人受胎于母腹
  Yang = 11,       // 养 - 如人在母腹中成形
}

/** 十二长生中文名称 */
export const SHI_ER_CHANG_SHENG_NAMES: Record<ShiErChangSheng, string> = {
  [ShiErChangSheng.ChangSheng]: '长生',
  [ShiErChangSheng.MuYu]: '沐浴',
  [ShiErChangSheng.GuanDai]: '冠带',
  [ShiErChangSheng.LinGuan]: '临官',
  [ShiErChangSheng.DiWang]: '帝旺',
  [ShiErChangSheng.Shuai]: '衰',
  [ShiErChangSheng.Bing]: '病',
  [ShiErChangSheng.Si]: '死',
  [ShiErChangSheng.Mu]: '墓',
  [ShiErChangSheng.Jue]: '绝',
  [ShiErChangSheng.Tai]: '胎',
  [ShiErChangSheng.Yang]: '养',
};

/**
 * 判断是否为旺相状态
 */
export function isProsperous(changsheng: ShiErChangSheng): boolean {
  return [
    ShiErChangSheng.ChangSheng,
    ShiErChangSheng.GuanDai,
    ShiErChangSheng.LinGuan,
    ShiErChangSheng.DiWang,
  ].includes(changsheng);
}

/**
 * 判断是否为衰败状态
 */
export function isDeclining(changsheng: ShiErChangSheng): boolean {
  return [
    ShiErChangSheng.Shuai,
    ShiErChangSheng.Bing,
    ShiErChangSheng.Si,
    ShiErChangSheng.Mu,
    ShiErChangSheng.Jue,
  ].includes(changsheng);
}

/**
 * 藏干类型
 */
export enum CangGanType {
  ZhuQi = 0,   // 主气（权重最高）
  ZhongQi = 1, // 中气（权重中等）
  YuQi = 2,    // 余气（权重最低）
}

/** 藏干类型名称 */
export const CANG_GAN_TYPE_NAMES: Record<CangGanType, string> = {
  [CangGanType.ZhuQi]: '主气',
  [CangGanType.ZhongQi]: '中气',
  [CangGanType.YuQi]: '余气',
};

/**
 * 藏干详细信息
 */
export interface CangGanDetail {
  /** 藏干天干 */
  gan: TianGan;
  /** 与日主的十神关系 */
  shiShen: ShiShen;
  /** 藏干类型（主气/中气/余气） */
  cangGanType: CangGanType;
  /** 权重（用于五行强度计算） */
  weight: number;
}

/**
 * 纳音枚举（30种）
 */
export enum NaYinType {
  HaiZhongJin = 0,     // 海中金
  LuZhongHuo = 1,      // 炉中火
  DaLinMu = 2,         // 大林木
  LuPangTu = 3,        // 路旁土
  JianFengJin = 4,     // 剑锋金
  ShanTouHuo = 5,      // 山头火
  JianXiaShui = 6,     // 涧下水
  ChengTouTu = 7,      // 城头土
  BaiLaJin = 8,        // 白蜡金
  YangLiuMu = 9,       // 杨柳木
  QuanZhongShui = 10,  // 泉中水
  WuShangTu = 11,      // 屋上土
  PiLiHuo = 12,        // 霹雳火
  SongBaiMu = 13,      // 松柏木
  ChangLiuShui = 14,   // 长流水
  ShaZhongJin = 15,    // 沙中金
  ShanXiaHuo = 16,     // 山下火
  PingDiMu = 17,       // 平地木
  BiShangTu = 18,      // 壁上土
  JinBoJin = 19,       // 金箔金
  FuDengHuo = 20,      // 覆灯火
  TianHeShui = 21,     // 天河水
  DaYiTu = 22,         // 大驿土
  ChaiChuanJin = 23,   // 钗钏金
  SangTuoMu = 24,      // 桑柘木
  DaXiShui = 25,       // 大溪水
  ShaZhongTu = 26,     // 沙中土
  TianShangHuo = 27,   // 天上火
  ShiLiuMu = 28,       // 石榴木
  DaHaiShui = 29,      // 大海水
}

/** 纳音名称 */
export const NA_YIN_TYPE_NAMES: Record<NaYinType, string> = {
  [NaYinType.HaiZhongJin]: '海中金',
  [NaYinType.LuZhongHuo]: '炉中火',
  [NaYinType.DaLinMu]: '大林木',
  [NaYinType.LuPangTu]: '路旁土',
  [NaYinType.JianFengJin]: '剑锋金',
  [NaYinType.ShanTouHuo]: '山头火',
  [NaYinType.JianXiaShui]: '涧下水',
  [NaYinType.ChengTouTu]: '城头土',
  [NaYinType.BaiLaJin]: '白蜡金',
  [NaYinType.YangLiuMu]: '杨柳木',
  [NaYinType.QuanZhongShui]: '泉中水',
  [NaYinType.WuShangTu]: '屋上土',
  [NaYinType.PiLiHuo]: '霹雳火',
  [NaYinType.SongBaiMu]: '松柏木',
  [NaYinType.ChangLiuShui]: '长流水',
  [NaYinType.ShaZhongJin]: '沙中金',
  [NaYinType.ShanXiaHuo]: '山下火',
  [NaYinType.PingDiMu]: '平地木',
  [NaYinType.BiShangTu]: '壁上土',
  [NaYinType.JinBoJin]: '金箔金',
  [NaYinType.FuDengHuo]: '覆灯火',
  [NaYinType.TianHeShui]: '天河水',
  [NaYinType.DaYiTu]: '大驿土',
  [NaYinType.ChaiChuanJin]: '钗钏金',
  [NaYinType.SangTuoMu]: '桑柘木',
  [NaYinType.DaXiShui]: '大溪水',
  [NaYinType.ShaZhongTu]: '沙中土',
  [NaYinType.TianShangHuo]: '天上火',
  [NaYinType.ShiLiuMu]: '石榴木',
  [NaYinType.DaHaiShui]: '大海水',
};

/**
 * 四柱位置
 */
export enum SiZhuPosition {
  Year = 0,  // 年柱
  Month = 1, // 月柱
  Day = 2,   // 日柱
  Hour = 3,  // 时柱
}

/** 四柱位置名称 */
export const SI_ZHU_POSITION_NAMES: Record<SiZhuPosition, string> = {
  [SiZhuPosition.Year]: '年柱',
  [SiZhuPosition.Month]: '月柱',
  [SiZhuPosition.Day]: '日柱',
  [SiZhuPosition.Hour]: '时柱',
};

/**
 * 神煞吉凶属性
 */
export enum ShenShaNature {
  JiShen = 0,    // 吉神
  XiongShen = 1, // 凶神
  Neutral = 2,   // 中性
}

/** 神煞吉凶名称 */
export const SHEN_SHA_NATURE_NAMES: Record<ShenShaNature, string> = {
  [ShenShaNature.JiShen]: '吉神',
  [ShenShaNature.XiongShen]: '凶神',
  [ShenShaNature.Neutral]: '中性',
};

/**
 * 神煞条目（V5 版本）
 */
export interface ShenShaEntryV5 {
  /** 神煞类型 */
  shenSha: ShenSha;
  /** 出现的位置（年/月/日/时） */
  position: SiZhuPosition;
  /** 吉凶属性 */
  nature: ShenShaNature;
}

/**
 * 空亡信息
 */
export interface KongWangInfo {
  /** 年柱旬空（两个地支索引） */
  yearKongWang: [DiZhi, DiZhi];
  /** 月柱旬空 */
  monthKongWang: [DiZhi, DiZhi];
  /** 日柱旬空（最重要） */
  dayKongWang: [DiZhi, DiZhi];
  /** 时柱旬空 */
  hourKongWang: [DiZhi, DiZhi];
  /** 年柱地支是否落空亡 */
  yearIsKong: boolean;
  /** 月柱地支是否落空亡 */
  monthIsKong: boolean;
  /** 日柱地支是否落空亡 */
  dayIsKong: boolean;
  /** 时柱地支是否落空亡 */
  hourIsKong: boolean;
}

/**
 * 星运信息（日主在四柱各支的十二长生状态）
 */
export interface XingYunInfo {
  /** 日主在年支的十二长生 */
  yearChangSheng: ShiErChangSheng;
  /** 日主在月支的十二长生 */
  monthChangSheng: ShiErChangSheng;
  /** 日主在日支的十二长生 */
  dayChangSheng: ShiErChangSheng;
  /** 日主在时支的十二长生 */
  hourChangSheng: ShiErChangSheng;
}

/**
 * 增强单柱详情（V5 版本）
 *
 * 包含主星、藏干（副星）、纳音、星运
 */
export interface EnhancedZhu {
  /** 干支组合 */
  ganZhi: GanZhi;
  /** 天干十神（主星） */
  tianGanShiShen: ShiShen;
  /** 地支本气十神（主星） */
  diZhiBenQiShiShen: ShiShen;
  /** 藏干详细信息（包含副星十神） */
  cangGanList: CangGanDetail[];
  /** 纳音五行 */
  naYin: NaYinType;
  /** 日主在该地支的十二长生状态 */
  changSheng: ShiErChangSheng;
}

/**
 * 增强四柱（V5 版本）
 */
export interface EnhancedSiZhu {
  /** 年柱详情 */
  yearZhu: EnhancedZhu;
  /** 月柱详情 */
  monthZhu: EnhancedZhu;
  /** 日柱详情 */
  dayZhu: EnhancedZhu;
  /** 时柱详情 */
  hourZhu: EnhancedZhu;
  /** 日主天干 */
  riZhu: TianGan;
}

/**
 * 大运步骤（V5 版本）
 */
export interface DaYunStepV5 {
  /** 大运干支 */
  ganZhi: GanZhi;
  /** 起始年龄 */
  startAge: number;
  /** 结束年龄 */
  endAge: number;
  /** 起始年份 */
  startYear: number;
  /** 结束年份 */
  endYear: number;
  /** 天干十神 */
  tianGanShiShen: ShiShen;
  /** 藏干十神列表 */
  cangGanShiShen: ShiShen[];
}

/**
 * 大运信息（V5 版本）
 */
export interface DaYunInfoV5 {
  /** 起运年龄 */
  qiYunAge: number;
  /** 起运年份 */
  qiYunYear: number;
  /** 是否顺排（true=顺，false=逆） */
  isShun: boolean;
  /** 大运列表 */
  daYunList: DaYunStepV5[];
}

/**
 * 自坐信息
 *
 * 自坐是八字命理中最重要的关系之一，专指日主（日柱天干）与日柱地支的十神关系。
 *
 * @description 命理意义
 *
 * 自坐关系直接影响命主的：
 * - **性格特质**: 如自坐比肩者独立自主、自坐食神者有创造力
 * - **能力倾向**: 如自坐正财者善经营、自坐正官者重规矩
 * - **六亲关系**: 如自坐正财利妻、自坐正官利子女
 *
 * @example
 * 日柱为"甲寅"：
 * - 日主：甲木
 * - 自坐地支：寅木
 * - 本气十神：比肩（甲木见甲木）
 * - 藏干十神：[比肩（甲）、食神（丙）、偏财（戊）]
 *
 * 命理含义：自坐比肩，性格独立自主，有主见；坐下藏食神和偏财，有创造力和经营能力。
 */
export interface ZiZuoInfo {
  /** 日柱地支（日主所坐的地支） */
  diZhi: DiZhi;
  /** 本气十神（最重要，主导性格特质）
   *
   * 地支本气是该地支最主要的藏干，权重最高，对命主性格影响最大
   */
  benQiShiShen: ShiShen;
  /** 藏干十神列表（辅助性格、能力）
   *
   * 按权重排序：主气 > 中气 > 余气
   * 辅助分析命主的多面性格和潜在能力
   */
  cangGanShiShenList: ShiShen[];
}

/**
 * 完整八字命盘（V5 版本）
 *
 * 包含所有计算字段：主星、藏干、副星、星运、空亡、纳音、神煞、自坐
 */
export interface FullBaziChartV5 {
  /** 命盘ID */
  chartId: number;
  /** 所有者地址 */
  owner: string;
  /** 出生时间 */
  birthTime: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  /** 出生地点（可选，用于真太阳时计算） */
  birthPlace?: BirthPlace;
  /** 性别 */
  gender: Gender;
  /** 子时模式 (1=传统派, 2=现代派) */
  ziShiMode: ZiShiMode;
  /** 增强四柱信息（包含主星、藏干、纳音、星运） */
  siZhu: EnhancedSiZhu;
  /** 大运信息 */
  daYun: DaYunInfoV5;
  /** 空亡信息 */
  kongWang: KongWangInfo;
  /** 神煞列表（最多32个） */
  shenShaList: ShenShaEntryV5[];
  /** 星运（十二长生） */
  xingYun: XingYunInfo;
  /** 自坐信息（日主坐下地支的十神关系）⭐ 核心字段
   *
   * 自坐是八字命理中最重要的关系之一，直接体现命主的性格特质、能力倾向和六亲关系。
   * 前端可以直接使用此字段进行自坐分析，无需再从 day_zhu 中提取。
   */
  ziZuo: ZiZuoInfo;
  /** 五行强度 */
  wuXingStrength: WuXingStrength;
  /** 喜用神 */
  xiYongShen: WuXing | null;
  /** 创建时间戳（区块号） */
  timestamp: number;
}

// ==================== 加密存储类型 ====================

/**
 * 四柱干支索引（8 bytes）
 *
 * 仅保存四柱的干支索引，不包含任何敏感信息（如出生时间）
 * 这个索引足以进行命理计算，但无法反推出具体出生时间
 */
export interface SiZhuIndex {
  /** 年柱天干索引 (0-9) */
  yearGan: number;
  /** 年柱地支索引 (0-11) */
  yearZhi: number;
  /** 月柱天干索引 (0-9) */
  monthGan: number;
  /** 月柱地支索引 (0-11) */
  monthZhi: number;
  /** 日柱天干索引 (0-9) */
  dayGan: number;
  /** 日柱地支索引 (0-11) */
  dayZhi: number;
  /** 时柱天干索引 (0-9) */
  hourGan: number;
  /** 时柱地支索引 (0-11) */
  hourZhi: number;
}

/**
 * 验证四柱索引有效性
 */
export function isSiZhuIndexValid(index: SiZhuIndex): boolean {
  return (
    index.yearGan >= 0 && index.yearGan < 10 &&
    index.yearZhi >= 0 && index.yearZhi < 12 &&
    index.monthGan >= 0 && index.monthGan < 10 &&
    index.monthZhi >= 0 && index.monthZhi < 12 &&
    index.dayGan >= 0 && index.dayGan < 10 &&
    index.dayZhi >= 0 && index.dayZhi < 12 &&
    index.hourGan >= 0 && index.hourGan < 10 &&
    index.hourZhi >= 0 && index.hourZhi < 12
  );
}

/**
 * 从四柱索引获取干支组合
 */
export function ganZhiFromSiZhuIndex(index: SiZhuIndex, position: SiZhuPosition): GanZhi {
  switch (position) {
    case SiZhuPosition.Year:
      return { tianGan: index.yearGan as TianGan, diZhi: index.yearZhi as DiZhi };
    case SiZhuPosition.Month:
      return { tianGan: index.monthGan as TianGan, diZhi: index.monthZhi as DiZhi };
    case SiZhuPosition.Day:
      return { tianGan: index.dayGan as TianGan, diZhi: index.dayZhi as DiZhi };
    case SiZhuPosition.Hour:
      return { tianGan: index.hourGan as TianGan, diZhi: index.hourZhi as DiZhi };
  }
}

/**
 * 加密的八字命盘
 *
 * 隐私保护版本的八字存储：
 * - 敏感数据（出生时间等）在前端加密后存储
 * - 四柱索引明文存储，支持 Runtime API 免费计算
 * - 用户通过钱包签名派生密钥进行加解密
 */
export interface EncryptedBaziChart {
  /** 命盘ID */
  chartId: number;
  /** 所有者地址 */
  owner: string;
  /** 四柱干支索引（明文，用于计算） */
  siZhuIndex: SiZhuIndex;
  /** 性别（明文，用于大运计算） */
  gender: Gender;
  /** 加密的敏感数据（AES-256-GCM 加密，Base64编码） */
  encryptedData: string;
  /** 加密的姓名数据（可选，AES-256-GCM 加密，Base64编码） */
  encryptedName?: string;
  /** 原始数据的 Blake2-256 哈希（用于验证解密正确性） */
  dataHash: string;
  /** 创建时间戳（区块号） */
  createdAt: number;
}

/**
 * 加密前的敏感数据结构
 *
 * 这些数据会被加密后存储在 encryptedData 字段中
 */
export interface BaziSensitiveData {
  /** 出生年份 */
  year: number;
  /** 出生月份 */
  month: number;
  /** 出生日期 */
  day: number;
  /** 出生小时 */
  hour: number;
  /** 出生分钟 */
  minute: number;
  /** 子时模式 */
  ziShiMode: ZiShiMode;
  /** 出生地点（可选） */
  birthPlace?: BirthPlace;
}

// ==================== 创建八字参数类型 ====================

/**
 * 创建八字命盘参数（公历输入）
 */
export interface CreateBaziChartParams {
  /** 公历年份 (1900-2100) */
  year: number;
  /** 公历月份 (1-12) */
  month: number;
  /** 公历日期 (1-31) */
  day: number;
  /** 小时 (0-23) */
  hour: number;
  /** 分钟 (0-59) */
  minute: number;
  /** 性别 */
  gender: Gender;
  /** 子时归属模式 */
  ziShiMode: ZiShiMode;
  /** 出生地经度（可选，单位：1/100000 度） */
  longitude?: number;
  /** 出生地纬度（可选，单位：1/100000 度） */
  latitude?: number;
}

/**
 * 从农历创建八字命盘参数
 */
export interface CreateBaziChartFromLunarParams {
  /** 农历年份 (1901-2100) */
  lunarYear: number;
  /** 农历月份 (1-12) */
  lunarMonth: number;
  /** 农历日期 (1-30) */
  lunarDay: number;
  /** 是否为闰月 */
  isLeapMonth: boolean;
  /** 小时 (0-23) */
  hour: number;
  /** 分钟 (0-59) */
  minute: number;
  /** 性别 */
  gender: Gender;
  /** 子时归属模式 */
  ziShiMode: ZiShiMode;
  /** 出生地经度（可选） */
  longitude?: number;
  /** 出生地纬度（可选） */
  latitude?: number;
}

/**
 * 从四柱直接创建八字命盘参数
 */
export interface CreateBaziChartFromSiZhuParams {
  /** 四柱干支输入 */
  siZhuInput: SiZhuDirectInput;
  /** 性别 */
  gender: Gender;
  /** 出生年份（用于大运计算，0表示未知） */
  birthYear: number;
}

/**
 * 创建加密八字命盘参数
 */
export interface CreateEncryptedChartParams {
  /** 四柱干支索引 */
  siZhuIndex: SiZhuIndex;
  /** 性别 */
  gender: Gender;
  /** 加密的敏感数据（AES-256-GCM 加密后的字节数组） */
  encryptedData: Uint8Array;
  /** 加密的姓名数据（可选） */
  encryptedName?: Uint8Array;
  /** 原始数据的 Blake2-256 哈希 */
  dataHash: Uint8Array;
}
