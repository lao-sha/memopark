/**
 * 八字排盘服务
 *
 * 提供八字排盘的核心计算功能：
 * - 公历转农历
 * - 四柱计算
 * - 十神分析
 * - 大运推算
 * - 流年计算
 */

import {
  TianGan,
  DiZhi,
  WuXing,
  ShiShen,
  Gender,
  GanZhi,
  SiZhu,
  ZhuDetail,
  WuXingCount,
  DaYun,
  LiuNian,
  BaziInput,
  BaziResult,
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  TIAN_GAN_WU_XING,
  DI_ZHI_WU_XING,
  DI_ZHI_CANG_GAN,
  getGanZhiName,
  calculateShiShen,
  getShiChenFromHour,
  isYangGan,
  nextGanZhi,
  prevGanZhi,
  getWuXingLack,
} from '../types/bazi';

// ==================== 农历数据 ====================

/**
 * 农历数据表（1900-2100年）
 * 每个元素包含：
 * - 前12位：每月大小月情况（1为大月30天，0为小月29天）
 * - 后4位：闰月月份（0表示无闰月）
 * - 最后1位：闰月大小（0为小月，1为大月）
 */
const LUNAR_INFO: number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];

/** 节气数据（每年24节气的日期，从1900年开始） */
const SOLAR_TERMS_BASE = [
  6.11, 20.84, 4.15, 19.02, 5.96, 20.17, 5.05, 19.69, 5.15, 19.64,
  5.59, 19.85, 6.17, 20.10, 6.31, 20.64, 7.18, 21.36, 7.70, 21.73,
  7.07, 20.78, 5.77, 19.79,
];

// ==================== 农历转换函数 ====================

/**
 * 获取农历年的总天数
 */
function getLunarYearDays(year: number): number {
  let sum = 348;
  const info = LUNAR_INFO[year - 1900];
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (info & i) ? 1 : 0;
  }
  return sum + getLeapMonthDays(year);
}

/**
 * 获取闰月天数
 */
function getLeapMonthDays(year: number): number {
  const leapMonth = getLeapMonth(year);
  if (leapMonth === 0) return 0;
  return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
}

/**
 * 获取闰月月份（0表示无闰月）
 */
function getLeapMonth(year: number): number {
  return LUNAR_INFO[year - 1900] & 0xf;
}

/**
 * 获取农历某月的天数
 */
function getLunarMonthDays(year: number, month: number): number {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

/**
 * 公历转农历
 */
function solarToLunar(year: number, month: number, day: number): {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
} {
  // 计算距离1900年1月31日（农历1900年正月初一）的天数
  const baseDate = new Date(1900, 0, 31);
  const objDate = new Date(year, month - 1, day);
  let offset = Math.floor((objDate.getTime() - baseDate.getTime()) / 86400000);

  // 计算农历年
  let lunarYear = 1900;
  let temp = 0;
  for (lunarYear = 1900; lunarYear < 2101 && offset > 0; lunarYear++) {
    temp = getLunarYearDays(lunarYear);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    lunarYear--;
  }

  // 计算闰月
  const leapMonth = getLeapMonth(lunarYear);
  let isLeapMonth = false;

  // 计算农历月
  let lunarMonth = 1;
  for (lunarMonth = 1; lunarMonth < 13 && offset > 0; lunarMonth++) {
    if (leapMonth > 0 && lunarMonth === leapMonth + 1 && !isLeapMonth) {
      --lunarMonth;
      isLeapMonth = true;
      temp = getLeapMonthDays(lunarYear);
    } else {
      temp = getLunarMonthDays(lunarYear, lunarMonth);
    }
    if (isLeapMonth && lunarMonth === leapMonth + 1) {
      isLeapMonth = false;
    }
    offset -= temp;
  }

  if (offset === 0 && leapMonth > 0 && lunarMonth === leapMonth + 1) {
    if (isLeapMonth) {
      isLeapMonth = false;
    } else {
      isLeapMonth = true;
      --lunarMonth;
    }
  }

  if (offset < 0) {
    offset += temp;
    --lunarMonth;
  }

  const lunarDay = offset + 1;

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeapMonth,
  };
}

// ==================== 节气计算 ====================

/**
 * 获取某年某月的节气日期
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns [节气1日期, 节气2日期]
 */
function getSolarTerms(year: number, month: number): [number, number] {
  const idx = (month - 1) * 2;
  const term1 = Math.floor(SOLAR_TERMS_BASE[idx] + 0.2422 * (year - 1900) - Math.floor((year - 1900) / 4));
  const term2 = Math.floor(SOLAR_TERMS_BASE[idx + 1] + 0.2422 * (year - 1900) - Math.floor((year - 1900) / 4));
  return [term1, term2];
}

// ==================== 干支计算 ====================

/**
 * 计算年柱
 * 以立春为界划分年份
 */
function calculateNianZhu(year: number, month: number, day: number): GanZhi {
  // 检查是否过了立春
  const [lichun] = getSolarTerms(year, 2);
  let adjustedYear = year;
  if (month < 2 || (month === 2 && day < lichun)) {
    adjustedYear--;
  }

  // 年柱计算：(年份 - 4) % 60
  const offset = (adjustedYear - 4) % 60;
  return {
    tianGan: (offset % 10) as TianGan,
    diZhi: (offset % 12) as DiZhi,
  };
}

/**
 * 计算月柱
 * 以节气为界划分月份
 *
 * 八字月份以"节"为界（而非"中气"）：
 * - 寅月：立春 - 惊蛰
 * - 卯月：惊蛰 - 清明
 * - 辰月：清明 - 立夏
 * - 巳月：立夏 - 芒种
 * - 午月：芒种 - 小暑
 * - 未月：小暑 - 立秋
 * - 申月：立秋 - 白露
 * - 酉月：白露 - 寒露
 * - 戌月：寒露 - 立冬
 * - 亥月：立冬 - 大雪
 * - 子月：大雪 - 小寒
 * - 丑月：小寒 - 立春
 *
 * 公历月份与节气后月支的对应：
 * 1月(小寒后)→丑(1), 2月(立春后)→寅(2), 3月(惊蛰后)→卯(3),
 * 4月(清明后)→辰(4), 5月(立夏后)→巳(5), 6月(芒种后)→午(6),
 * 7月(小暑后)→未(7), 8月(立秋后)→申(8), 9月(白露后)→酉(9),
 * 10月(寒露后)→戌(10), 11月(立冬后)→亥(11), 12月(大雪后)→子(0)
 */
function calculateYueZhu(year: number, month: number, day: number): GanZhi {
  // 获取当月节气（每月有两个节气，取第一个"节"）
  const [jieqi] = getSolarTerms(year, month);

  // 确定月支
  // 公历月份过了节气后的月支 = month % 12
  // 特殊情况：1月过小寒后是丑月(1)，12月过大雪后是子月(0)
  let monthZhi: DiZhi;

  if (day >= jieqi) {
    // 已过本月节气
    // 公历月份与月支对应：1月→丑(1), 2月→寅(2), ..., 11月→亥(11), 12月→子(0)
    monthZhi = (month % 12) as DiZhi;
  } else {
    // 未过本月节气，使用上个月的月支
    if (month === 1) {
      // 1月未过小寒，还在子月(0)
      monthZhi = DiZhi.Zi;
    } else {
      // 其他月份：月支 = (month - 1) % 12
      monthZhi = ((month - 1) % 12) as DiZhi;
      // 特殊：2月未过立春时是丑月(1)
      // (2-1) % 12 = 1 = 丑，正确
    }
  }

  // 计算年干
  const nianZhu = calculateNianZhu(year, month, day);
  const nianGan = nianZhu.tianGan;

  // 月干计算规则：
  // 甲己之年丙作首（正月寅月为丙寅）
  // 乙庚之年戊为头（正月寅月为戊寅）
  // 丙辛之岁庚寅首（正月寅月为庚寅）
  // 丁壬壬寅顺水流（正月寅月为壬寅）
  // 戊癸之年甲寅始（正月寅月为甲寅）
  const monthGanBase: Record<number, TianGan> = {
    0: TianGan.Bing,  // 甲
    5: TianGan.Bing,  // 己
    1: TianGan.Wu,    // 乙
    6: TianGan.Wu,    // 庚
    2: TianGan.Geng,  // 丙
    7: TianGan.Geng,  // 辛
    3: TianGan.Ren,   // 丁
    8: TianGan.Ren,   // 壬
    4: TianGan.Jia,   // 戊
    9: TianGan.Jia,   // 癸
  };

  const baseGan = monthGanBase[nianGan];
  // 从寅月(地支2)开始计算偏移
  const monthOffset = monthZhi >= 2 ? monthZhi - 2 : monthZhi + 10;
  const monthGan = ((baseGan + monthOffset) % 10) as TianGan;

  return {
    tianGan: monthGan,
    diZhi: monthZhi,
  };
}

/**
 * 计算日柱
 * 使用高斯公式计算
 */
function calculateRiZhu(year: number, month: number, day: number): GanZhi {
  // 蔡勒公式改进版计算日柱
  // 基准日：1900年1月1日为甲戌日
  const baseDate = new Date(1900, 0, 1);
  const targetDate = new Date(year, month - 1, day);
  const diffDays = Math.floor((targetDate.getTime() - baseDate.getTime()) / 86400000);

  // 1900年1月1日为甲戌日，干支序号为10
  const baseGanZhi = 10;
  const ganZhiIndex = (baseGanZhi + diffDays) % 60;

  return {
    tianGan: (ganZhiIndex % 10) as TianGan,
    diZhi: (ganZhiIndex % 12) as DiZhi,
  };
}

/**
 * 计算时柱
 */
function calculateShiZhu(riGan: TianGan, hour: number): GanZhi {
  // 获取时辰地支
  const shiZhi = getShiChenFromHour(hour);

  // 日上起时法：
  // 甲己还加甲（子时为甲子）
  // 乙庚丙作初（子时为丙子）
  // 丙辛从戊起（子时为戊子）
  // 丁壬庚子居（子时为庚子）
  // 戊癸何方发，壬子是真途（子时为壬子）
  const shiGanBase: Record<TianGan, TianGan> = {
    [TianGan.Jia]: TianGan.Jia,
    [TianGan.Ji]: TianGan.Jia,
    [TianGan.Yi]: TianGan.Bing,
    [TianGan.Geng]: TianGan.Bing,
    [TianGan.Bing]: TianGan.Wu,
    [TianGan.Xin]: TianGan.Wu,
    [TianGan.Ding]: TianGan.Geng,
    [TianGan.Ren]: TianGan.Geng,
    [TianGan.Wu]: TianGan.Ren,
    [TianGan.Gui]: TianGan.Ren,
  };

  const baseGan = shiGanBase[riGan];
  const shiGan = ((baseGan + shiZhi) % 10) as TianGan;

  return {
    tianGan: shiGan,
    diZhi: shiZhi,
  };
}

// ==================== 详情计算 ====================

/**
 * 计算单柱详情
 */
function calculateZhuDetail(ganZhi: GanZhi, riGan: TianGan, isRiZhu: boolean): ZhuDetail {
  const cangGan = DI_ZHI_CANG_GAN[ganZhi.diZhi];

  return {
    ganZhi,
    tianGanShiShen: isRiZhu ? null : calculateShiShen(riGan, ganZhi.tianGan),
    cangGan,
    cangGanShiShen: cangGan.map(g => calculateShiShen(riGan, g)),
    tianGanWuXing: TIAN_GAN_WU_XING[ganZhi.tianGan],
    diZhiWuXing: DI_ZHI_WU_XING[ganZhi.diZhi],
  };
}

/**
 * 统计五行
 */
function countWuXing(siZhu: SiZhu): WuXingCount {
  const count: WuXingCount = { mu: 0, huo: 0, tu: 0, jin: 0, shui: 0 };

  const addWuXing = (wx: WuXing) => {
    switch (wx) {
      case WuXing.Mu: count.mu++; break;
      case WuXing.Huo: count.huo++; break;
      case WuXing.Tu: count.tu++; break;
      case WuXing.Jin: count.jin++; break;
      case WuXing.Shui: count.shui++; break;
    }
  };

  // 统计四柱天干
  addWuXing(TIAN_GAN_WU_XING[siZhu.nianZhu.tianGan]);
  addWuXing(TIAN_GAN_WU_XING[siZhu.yueZhu.tianGan]);
  addWuXing(TIAN_GAN_WU_XING[siZhu.riZhu.tianGan]);
  addWuXing(TIAN_GAN_WU_XING[siZhu.shiZhu.tianGan]);

  // 统计四柱地支
  addWuXing(DI_ZHI_WU_XING[siZhu.nianZhu.diZhi]);
  addWuXing(DI_ZHI_WU_XING[siZhu.yueZhu.diZhi]);
  addWuXing(DI_ZHI_WU_XING[siZhu.riZhu.diZhi]);
  addWuXing(DI_ZHI_WU_XING[siZhu.shiZhu.diZhi]);

  return count;
}

// ==================== 大运计算 ====================

/**
 * 计算大运
 * @param siZhu 四柱
 * @param birthInfo 出生信息
 * @returns 大运列表和相关信息
 */
function calculateDaYun(
  siZhu: SiZhu,
  birthInfo: BaziInput
): { daYunList: DaYun[]; qiYunAge: number; daYunShun: boolean } {
  const { year, month, day, gender } = birthInfo;
  const nianGan = siZhu.nianZhu.tianGan;

  // 判断大运顺逆
  // 阳年男命、阴年女命顺行
  // 阴年男命、阳年女命逆行
  const isYangYear = isYangGan(nianGan);
  const isMale = gender === Gender.Male;
  const daYunShun = (isYangYear && isMale) || (!isYangYear && !isMale);

  // 计算起运年龄
  // 从出生日到下一个（顺行）或上一个（逆行）节气的天数，除以3，得到起运年龄
  const [jieqi1, jieqi2] = getSolarTerms(year, month);
  let daysToJieqi: number;

  if (daYunShun) {
    // 顺行：找下一个节气
    if (day < jieqi1) {
      daysToJieqi = jieqi1 - day;
    } else if (day < jieqi2) {
      daysToJieqi = jieqi2 - day;
    } else {
      // 需要找下个月的节气
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const [nextJieqi] = getSolarTerms(nextYear, nextMonth);
      const daysInMonth = new Date(year, month, 0).getDate();
      daysToJieqi = (daysInMonth - day) + nextJieqi;
    }
  } else {
    // 逆行：找上一个节气
    if (day > jieqi2) {
      daysToJieqi = day - jieqi2;
    } else if (day > jieqi1) {
      daysToJieqi = day - jieqi1;
    } else {
      // 需要找上个月的节气
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const [, prevJieqi2] = getSolarTerms(prevYear, prevMonth);
      const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
      daysToJieqi = day + (prevDaysInMonth - prevJieqi2);
    }
  }

  // 三天折合一岁
  const qiYunAge = Math.round(daysToJieqi / 3);

  // 生成大运列表（通常显示8-10步大运）
  const daYunList: DaYun[] = [];
  let currentGanZhi = siZhu.yueZhu;
  const riGan = siZhu.riZhu.tianGan;

  for (let i = 1; i <= 10; i++) {
    currentGanZhi = daYunShun ? nextGanZhi(currentGanZhi) : prevGanZhi(currentGanZhi);

    const daYun: DaYun = {
      index: i,
      ganZhi: { ...currentGanZhi },
      startAge: qiYunAge + (i - 1) * 10,
      endAge: qiYunAge + i * 10 - 1,
      startYear: year + qiYunAge + (i - 1) * 10,
      tianGanShiShen: calculateShiShen(riGan, currentGanZhi.tianGan),
      cangGanShiShen: DI_ZHI_CANG_GAN[currentGanZhi.diZhi].map(g => calculateShiShen(riGan, g)),
    };

    daYunList.push(daYun);
  }

  return { daYunList, qiYunAge, daYunShun };
}

/**
 * 计算流年
 * @param siZhu 四柱
 * @param birthYear 出生年份
 * @param startYear 起始年份
 * @param count 流年数量
 */
export function calculateLiuNian(
  siZhu: SiZhu,
  birthYear: number,
  startYear: number,
  count: number = 10
): LiuNian[] {
  const riGan = siZhu.riZhu.tianGan;
  const liuNianList: LiuNian[] = [];

  for (let i = 0; i < count; i++) {
    const year = startYear + i;
    const offset = (year - 4) % 60;
    const ganZhi: GanZhi = {
      tianGan: (offset % 10) as TianGan,
      diZhi: (offset % 12) as DiZhi,
    };

    liuNianList.push({
      year,
      ganZhi,
      tianGanShiShen: calculateShiShen(riGan, ganZhi.tianGan),
      age: year - birthYear + 1, // 虚岁
    });
  }

  return liuNianList;
}

// ==================== 主函数 ====================

/**
 * 八字排盘
 * @param input 排盘输入
 * @returns 八字排盘结果
 */
export function calculateBazi(input: BaziInput): BaziResult {
  const { year, month, day, hour } = input;

  // 计算四柱
  const nianZhu = calculateNianZhu(year, month, day);
  const yueZhu = calculateYueZhu(year, month, day);
  const riZhu = calculateRiZhu(year, month, day);
  const shiZhu = calculateShiZhu(riZhu.tianGan, hour);

  const siZhu: SiZhu = { nianZhu, yueZhu, riZhu, shiZhu };

  // 计算四柱详情
  const riGan = riZhu.tianGan;
  const siZhuDetail = {
    nian: calculateZhuDetail(nianZhu, riGan, false),
    yue: calculateZhuDetail(yueZhu, riGan, false),
    ri: calculateZhuDetail(riZhu, riGan, true),
    shi: calculateZhuDetail(shiZhu, riGan, false),
  };

  // 统计五行
  const wuXingCount = countWuXing(siZhu);
  const wuXingLack = getWuXingLack(wuXingCount);

  // 计算大运
  const { daYunList, qiYunAge, daYunShun } = calculateDaYun(siZhu, input);

  // 转换农历
  const lunar = solarToLunar(year, month, day);

  return {
    siZhu,
    siZhuDetail,
    riZhu: riGan,
    riZhuWuXing: TIAN_GAN_WU_XING[riGan],
    wuXingCount,
    wuXingLack,
    daYunList,
    qiYunAge,
    daYunShun,
    birthInfo: input,
    lunarInfo: {
      year: lunar.year,
      month: lunar.month,
      day: lunar.day,
      isLeapMonth: lunar.isLeapMonth,
      yearGanZhi: getGanZhiName(nianZhu),
      monthGanZhi: getGanZhiName(yueZhu),
      dayGanZhi: getGanZhiName(riZhu),
    },
    createdAt: Date.now(),
  };
}

/**
 * 格式化八字为字符串
 */
export function formatBazi(siZhu: SiZhu): string {
  return `${getGanZhiName(siZhu.nianZhu)} ${getGanZhiName(siZhu.yueZhu)} ${getGanZhiName(siZhu.riZhu)} ${getGanZhiName(siZhu.shiZhu)}`;
}

/**
 * 获取当前年的流年信息
 */
export function getCurrentLiuNian(siZhu: SiZhu, birthYear: number): LiuNian {
  const currentYear = new Date().getFullYear();
  const [liuNian] = calculateLiuNian(siZhu, birthYear, currentYear, 1);
  return liuNian;
}
