/**
 * 黄历服务层 (almanacService.ts)
 *
 * 提供黄历数据查询、农历转换、干支计算等功能。
 * 支持链上数据查询和本地计算两种模式。
 *
 * @module almanacService
 */

import { ApiPromise } from "@polkadot/api";

// ============================================================================
// 类型定义
// ============================================================================

/** 黄历数据 */
export interface AlmanacInfo {
  // 农历信息
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;

  // 干支信息
  yearTiangan: number;
  yearDizhi: number;
  monthTiangan: number;
  monthDizhi: number;
  dayTiangan: number;
  dayDizhi: number;
  hourTiangan: number;
  hourDizhi: number;

  // 其他属性
  zodiac: number;
  conflictZodiac: number;
  shaDirection: number;
  wuxing: number;
  jianchu: number;
  constellation: number;

  // 宜忌 (bit 标记)
  suitable: bigint;
  avoid: bigint;

  // 节气和节日
  solarTerm: number;
  festivals: number;
  fortuneLevel: number;

  // 元数据
  updatedAt: number;
  source: number;
}

/** 农历日期 */
export interface LunarDate {
  year: number;
  month: number;
  day: number;
  isLeap: boolean;
  monthName: string;
  dayName: string;
}

/** 干支 */
export interface GanZhi {
  gan: number;
  zhi: number;
  ganName: string;
  zhiName: string;
}

/** 四柱（八字） */
export interface FourPillars {
  year: GanZhi;
  month: GanZhi;
  day: GanZhi;
  hour: GanZhi;
}

/** 黄历显示数据 */
export interface AlmanacDisplay {
  // 公历
  solarDate: string;
  weekday: string;

  // 农历
  lunarDate: LunarDate;
  lunarDateStr: string;

  // 干支
  yearGanZhi: string;
  monthGanZhi: string;
  dayGanZhi: string;

  // 生肖
  zodiac: string;

  // 节气
  solarTerm: string;

  // 宜忌
  suitable: string[];
  avoid: string[];

  // 吉凶
  fortune: string;
  fortuneLevel: number;

  // 其他
  jianchu: string;
  wuxing: string;
}

// ============================================================================
// 常量
// ============================================================================

/** 天干名称 */
export const TIANGAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/** 地支名称 */
export const DIZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/** 生肖名称 */
export const SHENGXIAO = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

/** 农历月份名称 */
export const LUNAR_MONTHS = [
  "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "腊月"
];

/** 农历日期名称 */
export const LUNAR_DAYS = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
];

/** 二十四节气名称 */
export const SOLAR_TERMS = [
  "小寒", "大寒", "立春", "雨水", "惊蛰", "春分",
  "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
  "小暑", "大暑", "立秋", "处暑", "白露", "秋分",
  "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"
];

/** 建除十二神 */
export const JIANCHU = ["建", "除", "满", "平", "定", "执", "破", "危", "成", "收", "开", "闭"];

/** 五行名称 */
export const WUXING = ["金", "木", "水", "火", "土"];

/** 吉凶等级 */
export const FORTUNE_LEVELS = ["大吉", "吉", "平", "凶", "大凶"];

/** 宜忌事项名称 */
export const SUITABLE_ITEMS = [
  "嫁娶", "纳采", "祭祀", "祈福", "出行", "动土", "破土", "安葬",
  "开市", "交易", "立券", "移徙", "修造", "栽种", "纳财", "开光",
  "安床", "入宅", "安门", "求嗣", "解除", "求医", "词讼", "沐浴",
  "理发", "扫舍", "会友", "上梁", "竖柱", "纳畜", "伐木", "作灶"
];

/** 星期名称 */
export const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// ============================================================================
// 本地计算函数
// ============================================================================

/**
 * 计算年干支
 * @param year 公历年份
 */
export function calcYearGanZhi(year: number): GanZhi {
  const offset = ((year - 1984) % 60 + 60) % 60;
  const gan = offset % 10;
  const zhi = offset % 12;
  return {
    gan,
    zhi,
    ganName: TIANGAN[gan],
    zhiName: DIZHI[zhi],
  };
}

/**
 * 计算日干支（使用儒略日）
 * @param year 公历年
 * @param month 公历月
 * @param day 公历日
 */
export function calcDayGanZhi(year: number, month: number, day: number): GanZhi {
  const jd = calcJulianDay(year, month, day);
  // 2001年1月1日是辛巳日 (干=7, 支=5)，儒略日=2451911
  const offset = ((jd - 2451911) % 60 + 60) % 60;
  const baseGan = 7;
  const baseZhi = 5;

  const gan = (baseGan + offset) % 10;
  const zhi = (baseZhi + offset) % 12;

  return {
    gan,
    zhi,
    ganName: TIANGAN[gan],
    zhiName: DIZHI[zhi],
  };
}

/**
 * 计算月干支
 * @param year 公历年
 * @param lunarMonth 农历月份
 */
export function calcMonthGanZhi(year: number, lunarMonth: number): GanZhi {
  const zhi = ((lunarMonth - 1 + 2) % 12);
  const yearGan = calcYearGanZhi(year).gan;

  // 年干决定正月天干
  const firstMonthGan = [2, 4, 6, 8, 0][yearGan % 5];
  const gan = (firstMonthGan + lunarMonth - 1) % 10;

  return {
    gan,
    zhi,
    ganName: TIANGAN[gan],
    zhiName: DIZHI[zhi],
  };
}

/**
 * 计算时辰干支
 * @param dayGan 日天干
 * @param hour 小时 (0-23)
 */
export function calcHourGanZhi(dayGan: number, hour: number): GanZhi {
  // 时辰地支
  let zhi: number;
  if (hour === 23 || hour === 0) zhi = 0;
  else zhi = Math.floor((hour + 1) / 2);

  // 时辰天干
  const ziGan = [0, 2, 4, 6, 8][dayGan % 5];
  const gan = (ziGan + zhi) % 10;

  return {
    gan,
    zhi,
    ganName: TIANGAN[gan],
    zhiName: DIZHI[zhi],
  };
}

/**
 * 计算四柱（八字）
 */
export function calcFourPillars(
  year: number,
  month: number,
  day: number,
  hour: number,
  lunarMonth?: number
): FourPillars {
  const yearGZ = calcYearGanZhi(year);
  const dayGZ = calcDayGanZhi(year, month, day);
  const monthGZ = calcMonthGanZhi(year, lunarMonth || month);
  const hourGZ = calcHourGanZhi(dayGZ.gan, hour);

  return {
    year: yearGZ,
    month: monthGZ,
    day: dayGZ,
    hour: hourGZ,
  };
}

/**
 * 获取生肖
 */
export function getZodiac(year: number): string {
  const zhi = calcYearGanZhi(year).zhi;
  return SHENGXIAO[zhi];
}

/**
 * 计算儒略日
 */
export function calcJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/**
 * 从 bit 标记获取事项列表
 */
export function getItemsFromBits(bits: bigint): string[] {
  const items: string[] = [];
  for (let i = 0; i < SUITABLE_ITEMS.length; i++) {
    if ((bits & (1n << BigInt(i))) !== 0n) {
      items.push(SUITABLE_ITEMS[i]);
    }
  }
  return items;
}

// ============================================================================
// 链上查询函数
// ============================================================================

/**
 * 从链上获取黄历数据
 * @param api Polkadot API 实例
 * @param year 公历年
 * @param month 公历月
 * @param day 公历日
 */
export async function getAlmanacFromChain(
  api: ApiPromise,
  year: number,
  month: number,
  day: number
): Promise<AlmanacInfo | null> {
  try {
    const result = await (api.query as any).almanac.almanacData([year, month, day]);

    if (result.isNone) {
      return null;
    }

    const data = result.unwrap();

    return {
      lunarYear: data.lunarYear.toNumber(),
      lunarMonth: data.lunarMonth.toNumber(),
      lunarDay: data.lunarDay.toNumber(),
      yearTiangan: data.yearTiangan.toNumber(),
      yearDizhi: data.yearDizhi.toNumber(),
      monthTiangan: data.monthTiangan.toNumber(),
      monthDizhi: data.monthDizhi.toNumber(),
      dayTiangan: data.dayTiangan.toNumber(),
      dayDizhi: data.dayDizhi.toNumber(),
      hourTiangan: data.hourTiangan.toNumber(),
      hourDizhi: data.hourDizhi.toNumber(),
      zodiac: data.zodiac.toNumber(),
      conflictZodiac: data.conflictZodiac.toNumber(),
      shaDirection: data.shaDirection.toNumber(),
      wuxing: data.wuxing.toNumber(),
      jianchu: data.jianchu.toNumber(),
      constellation: data.constellation.toNumber(),
      suitable: BigInt(data.suitable.toString()),
      avoid: BigInt(data.avoid.toString()),
      solarTerm: data.solarTerm.toNumber(),
      festivals: data.festivals.toNumber(),
      fortuneLevel: data.fortuneLevel.toNumber(),
      updatedAt: data.updatedAt.toNumber(),
      source: data.source.toNumber(),
    };
  } catch (error) {
    console.error("Failed to get almanac from chain:", error);
    return null;
  }
}

/**
 * 获取黄历显示数据（优先从链上获取，回退到本地计算）
 */
export async function getAlmanacDisplay(
  api: ApiPromise | null,
  date: Date
): Promise<AlmanacDisplay> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.getDay();

  // 尝试从链上获取
  let chainData: AlmanacInfo | null = null;
  if (api) {
    chainData = await getAlmanacFromChain(api, year, month, day);
  }

  // 本地计算干支
  const yearGZ = calcYearGanZhi(year);
  const dayGZ = calcDayGanZhi(year, month, day);
  const monthGZ = calcMonthGanZhi(year, chainData?.lunarMonth || month);

  // 构建显示数据
  const display: AlmanacDisplay = {
    solarDate: `${year}年${month}月${day}日`,
    weekday: `星期${WEEKDAYS[weekday]}`,

    lunarDate: {
      year: chainData?.lunarYear || year,
      month: chainData?.lunarMonth || month,
      day: chainData?.lunarDay || day,
      isLeap: false,
      monthName: LUNAR_MONTHS[(chainData?.lunarMonth || month) - 1] || "",
      dayName: LUNAR_DAYS[(chainData?.lunarDay || day) - 1] || "",
    },
    lunarDateStr: chainData
      ? `${LUNAR_MONTHS[chainData.lunarMonth - 1]}${LUNAR_DAYS[chainData.lunarDay - 1]}`
      : "计算中...",

    yearGanZhi: `${yearGZ.ganName}${yearGZ.zhiName}`,
    monthGanZhi: `${monthGZ.ganName}${monthGZ.zhiName}`,
    dayGanZhi: `${dayGZ.ganName}${dayGZ.zhiName}`,

    zodiac: getZodiac(year),

    solarTerm: chainData?.solarTerm
      ? SOLAR_TERMS[chainData.solarTerm - 1] || ""
      : "",

    suitable: chainData ? getItemsFromBits(chainData.suitable) : [],
    avoid: chainData ? getItemsFromBits(chainData.avoid) : [],

    fortune: chainData ? FORTUNE_LEVELS[chainData.fortuneLevel] || "平" : "平",
    fortuneLevel: chainData?.fortuneLevel || 2,

    jianchu: chainData ? JIANCHU[chainData.jianchu] || "" : "",
    wuxing: chainData ? WUXING[chainData.wuxing] || "" : "",
  };

  return display;
}

/**
 * 获取月度黄历数据
 */
export async function getMonthAlmanac(
  api: ApiPromise,
  year: number,
  month: number
): Promise<Map<number, AlmanacInfo>> {
  const result = new Map<number, AlmanacInfo>();

  // 获取该月天数
  const daysInMonth = new Date(year, month, 0).getDate();

  // 批量查询
  for (let day = 1; day <= daysInMonth; day++) {
    const data = await getAlmanacFromChain(api, year, month, day);
    if (data) {
      result.set(day, data);
    }
  }

  return result;
}

/**
 * 获取今日黄历
 */
export async function getTodayAlmanac(api: ApiPromise | null): Promise<AlmanacDisplay> {
  return getAlmanacDisplay(api, new Date());
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化四柱显示
 */
export function formatFourPillars(pillars: FourPillars): string {
  return `${pillars.year.ganName}${pillars.year.zhiName}年 ` +
    `${pillars.month.ganName}${pillars.month.zhiName}月 ` +
    `${pillars.day.ganName}${pillars.day.zhiName}日 ` +
    `${pillars.hour.ganName}${pillars.hour.zhiName}时`;
}

/**
 * 获取时辰名称
 */
export function getShichenName(hour: number): string {
  const names = [
    "子时(23-1)", "丑时(1-3)", "寅时(3-5)", "卯时(5-7)",
    "辰时(7-9)", "巳时(9-11)", "午时(11-13)", "未时(13-15)",
    "申时(15-17)", "酉时(17-19)", "戌时(19-21)", "亥时(21-23)"
  ];
  let zhi: number;
  if (hour === 23 || hour === 0) zhi = 0;
  else zhi = Math.floor((hour + 1) / 2);
  return names[zhi];
}

/**
 * 判断是否闰年
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export default {
  // 本地计算
  calcYearGanZhi,
  calcDayGanZhi,
  calcMonthGanZhi,
  calcHourGanZhi,
  calcFourPillars,
  getZodiac,
  calcJulianDay,
  getItemsFromBits,

  // 链上查询
  getAlmanacFromChain,
  getAlmanacDisplay,
  getMonthAlmanac,
  getTodayAlmanac,

  // 工具函数
  formatFourPillars,
  getShichenName,
  isLeapYear,

  // 常量
  TIANGAN,
  DIZHI,
  SHENGXIAO,
  LUNAR_MONTHS,
  LUNAR_DAYS,
  SOLAR_TERMS,
  JIANCHU,
  WUXING,
  FORTUNE_LEVELS,
  SUITABLE_ITEMS,
};
