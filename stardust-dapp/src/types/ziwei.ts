/**
 * 紫微斗数类型定义
 *
 * 紫微斗数是中国传统命理学的重要流派，通过星曜在十二宫的分布
 * 来推算人的命运走向。
 */

// ==================== 基础枚举 ====================

/**
 * 十二宫位
 */
export enum Gong {
  /** 命宫 */
  Ming = 0,
  /** 兄弟宫 */
  XiongDi = 1,
  /** 夫妻宫 */
  FuQi = 2,
  /** 子女宫 */
  ZiNv = 3,
  /** 财帛宫 */
  CaiBo = 4,
  /** 疾厄宫 */
  JiE = 5,
  /** 迁移宫 */
  QianYi = 6,
  /** 仆役宫/交友宫 */
  PuYi = 7,
  /** 官禄宫/事业宫 */
  GuanLu = 8,
  /** 田宅宫 */
  TianZhai = 9,
  /** 福德宫 */
  FuDe = 10,
  /** 父母宫 */
  FuMu = 11,
}

/**
 * 主星类型
 */
export enum ZhuXing {
  /** 紫微星 */
  ZiWei = 0,
  /** 天机星 */
  TianJi = 1,
  /** 太阳星 */
  TaiYang = 2,
  /** 武曲星 */
  WuQu = 3,
  /** 天同星 */
  TianTong = 4,
  /** 廉贞星 */
  LianZhen = 5,
  /** 天府星 */
  TianFu = 6,
  /** 太阴星 */
  TaiYin = 7,
  /** 贪狼星 */
  TanLang = 8,
  /** 巨门星 */
  JuMen = 9,
  /** 天相星 */
  TianXiang = 10,
  /** 天梁星 */
  TianLiang = 11,
  /** 七杀星 */
  QiSha = 12,
  /** 破军星 */
  PoJun = 13,
}

/**
 * 辅星类型
 */
export enum FuXing {
  /** 文昌 */
  WenChang = 0,
  /** 文曲 */
  WenQu = 1,
  /** 左辅 */
  ZuoFu = 2,
  /** 右弼 */
  YouBi = 3,
  /** 天魁 */
  TianKui = 4,
  /** 天钺 */
  TianYue = 5,
  /** 禄存 */
  LuCun = 6,
  /** 天马 */
  TianMa = 7,
}

/**
 * 煞星类型
 */
export enum ShaXing {
  /** 擎羊 */
  QingYang = 0,
  /** 陀罗 */
  TuoLuo = 1,
  /** 火星 */
  HuoXing = 2,
  /** 铃星 */
  LingXing = 3,
  /** 地空 */
  DiKong = 4,
  /** 地劫 */
  DiJie = 5,
}

/**
 * 四化类型
 */
export enum SiHua {
  /** 化禄 */
  HuaLu = 0,
  /** 化权 */
  HuaQuan = 1,
  /** 化科 */
  HuaKe = 2,
  /** 化忌 */
  HuaJi = 3,
}

/**
 * 五行局
 */
export enum WuXingJu {
  /** 水二局 */
  Shui2 = 2,
  /** 木三局 */
  Mu3 = 3,
  /** 金四局 */
  Jin4 = 4,
  /** 土五局 */
  Tu5 = 5,
  /** 火六局 */
  Huo6 = 6,
}

/**
 * 性别
 */
export enum Gender {
  Male = 0,
  Female = 1,
}

// ==================== 数据结构 ====================

/**
 * 星曜信息
 */
export interface XingYao {
  /** 星曜类型 */
  type: 'zhu' | 'fu' | 'sha';
  /** 星曜ID */
  id: number;
  /** 星曜名称 */
  name: string;
  /** 庙旺利陷 (4=庙, 3=旺, 2=利, 1=平, 0=陷) */
  brightness: number;
  /** 四化 */
  siHua?: SiHua;
}

/**
 * 宫位信息
 */
export interface GongInfo {
  /** 宫位类型 */
  gong: Gong;
  /** 宫位名称 */
  name: string;
  /** 宫位地支 */
  diZhi: number;
  /** 宫位天干 */
  tianGan: number;
  /** 主星列表 */
  zhuXing: XingYao[];
  /** 辅星列表 */
  fuXing: XingYao[];
  /** 煞星列表 */
  shaXing: XingYao[];
  /** 是否身宫 */
  isShenGong: boolean;
}

/**
 * 大限信息
 */
export interface DaXian {
  /** 大限序号 (1-12) */
  index: number;
  /** 起始年龄 */
  startAge: number;
  /** 结束年龄 */
  endAge: number;
  /** 所在宫位 */
  gong: Gong;
  /** 大限天干 */
  tianGan: number;
}

/**
 * 紫微命盘
 */
export interface ZiweiChart {
  /** 命盘ID */
  id: number;
  /** 创建者 */
  creator: string;
  /** 出生年 */
  birthYear: number;
  /** 出生月 */
  birthMonth: number;
  /** 出生日 */
  birthDay: number;
  /** 出生时辰 */
  birthHour: number;
  /** 性别 */
  gender: Gender;
  /** 农历年 */
  lunarYear: number;
  /** 农历月 */
  lunarMonth: number;
  /** 农历日 */
  lunarDay: number;
  /** 是否闰月 */
  isLeapMonth: boolean;
  /** 五行局 */
  wuXingJu: WuXingJu;
  /** 命主 */
  mingZhu: ZhuXing;
  /** 身主 */
  shenZhu: ZhuXing;
  /** 十二宫信息 */
  gongs: GongInfo[];
  /** 大限列表 */
  daXians: DaXian[];
  /** 创建时间 */
  createdAt: number;
  /** 是否公开 */
  isPublic: boolean;
}

/**
 * 紫微排盘输入
 */
export interface ZiweiInput {
  /** 出生年份 */
  year: number;
  /** 出生月份 */
  month: number;
  /** 出生日 */
  day: number;
  /** 出生时辰 (0-23) */
  hour: number;
  /** 性别 */
  gender: Gender;
  /** 是否公开 */
  isPublic?: boolean;
}

// ==================== 常量定义 ====================

/**
 * 宫位名称
 */
export const GONG_NAMES: Record<Gong, string> = {
  [Gong.Ming]: '命宫',
  [Gong.XiongDi]: '兄弟',
  [Gong.FuQi]: '夫妻',
  [Gong.ZiNv]: '子女',
  [Gong.CaiBo]: '财帛',
  [Gong.JiE]: '疾厄',
  [Gong.QianYi]: '迁移',
  [Gong.PuYi]: '交友',
  [Gong.GuanLu]: '官禄',
  [Gong.TianZhai]: '田宅',
  [Gong.FuDe]: '福德',
  [Gong.FuMu]: '父母',
};

/**
 * 主星名称
 */
export const ZHU_XING_NAMES: Record<ZhuXing, string> = {
  [ZhuXing.ZiWei]: '紫微',
  [ZhuXing.TianJi]: '天机',
  [ZhuXing.TaiYang]: '太阳',
  [ZhuXing.WuQu]: '武曲',
  [ZhuXing.TianTong]: '天同',
  [ZhuXing.LianZhen]: '廉贞',
  [ZhuXing.TianFu]: '天府',
  [ZhuXing.TaiYin]: '太阴',
  [ZhuXing.TanLang]: '贪狼',
  [ZhuXing.JuMen]: '巨门',
  [ZhuXing.TianXiang]: '天相',
  [ZhuXing.TianLiang]: '天梁',
  [ZhuXing.QiSha]: '七杀',
  [ZhuXing.PoJun]: '破军',
};

/**
 * 辅星名称
 */
export const FU_XING_NAMES: Record<FuXing, string> = {
  [FuXing.WenChang]: '文昌',
  [FuXing.WenQu]: '文曲',
  [FuXing.ZuoFu]: '左辅',
  [FuXing.YouBi]: '右弼',
  [FuXing.TianKui]: '天魁',
  [FuXing.TianYue]: '天钺',
  [FuXing.LuCun]: '禄存',
  [FuXing.TianMa]: '天马',
};

/**
 * 煞星名称
 */
export const SHA_XING_NAMES: Record<ShaXing, string> = {
  [ShaXing.QingYang]: '擎羊',
  [ShaXing.TuoLuo]: '陀罗',
  [ShaXing.HuoXing]: '火星',
  [ShaXing.LingXing]: '铃星',
  [ShaXing.DiKong]: '地空',
  [ShaXing.DiJie]: '地劫',
};

/**
 * 四化名称
 */
export const SI_HUA_NAMES: Record<SiHua, string> = {
  [SiHua.HuaLu]: '化禄',
  [SiHua.HuaQuan]: '化权',
  [SiHua.HuaKe]: '化科',
  [SiHua.HuaJi]: '化忌',
};

/**
 * 四化简称
 */
export const SI_HUA_SHORT: Record<SiHua, string> = {
  [SiHua.HuaLu]: '禄',
  [SiHua.HuaQuan]: '权',
  [SiHua.HuaKe]: '科',
  [SiHua.HuaJi]: '忌',
};

/**
 * 五行局名称
 */
export const WU_XING_JU_NAMES: Record<WuXingJu, string> = {
  [WuXingJu.Shui2]: '水二局',
  [WuXingJu.Mu3]: '木三局',
  [WuXingJu.Jin4]: '金四局',
  [WuXingJu.Tu5]: '土五局',
  [WuXingJu.Huo6]: '火六局',
};

/**
 * 亮度等级名称
 */
export const BRIGHTNESS_NAMES: Record<number, string> = {
  4: '庙',
  3: '旺',
  2: '得',
  1: '平',
  0: '陷',
};

/**
 * 亮度等级颜色
 */
export const BRIGHTNESS_COLORS: Record<number, string> = {
  4: '#f5222d',
  3: '#fa8c16',
  2: '#52c41a',
  1: '#1890ff',
  0: '#8c8c8c',
};

/**
 * 地支名称
 */
export const DI_ZHI_NAMES: string[] = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
];

/**
 * 天干名称
 */
export const TIAN_GAN_NAMES: string[] = [
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
];
