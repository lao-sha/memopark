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
  Male = 0,   // 男
  Female = 1, // 女
}

/** 性别名称 */
export const GENDER_NAMES: Record<Gender, string> = {
  [Gender.Male]: '男',
  [Gender.Female]: '女',
};

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
