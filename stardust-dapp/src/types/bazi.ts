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
