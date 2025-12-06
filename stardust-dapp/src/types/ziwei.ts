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
 * 四化星联合类型
 *
 * 四化飞星可以作用于主星（十四主星）或辅星（六吉星），
 * 此枚举统一表示可以参与四化的所有星曜。
 *
 * 根据《紫微斗数全书》，各天干四化如下：
 * - 甲：廉贞化禄、破军化权、武曲化科、太阳化忌
 * - 乙：天机化禄、天梁化权、紫微化科、太阴化忌
 * - 丙：天同化禄、天机化权、文昌化科、廉贞化忌
 * - 丁：太阴化禄、天同化权、天机化科、巨门化忌
 * - 戊：贪狼化禄、太阴化权、右弼化科、天机化忌
 * - 己：武曲化禄、贪狼化权、天梁化科、文曲化忌
 * - 庚：太阳化禄、武曲化权、太阴化科、天同化忌
 * - 辛：巨门化禄、太阳化权、文曲化科、文昌化忌
 * - 壬：天梁化禄、紫微化权、左辅化科、武曲化忌
 * - 癸：破军化禄、巨门化权、太阴化科、贪狼化忌
 */
export enum SiHuaStar {
  // ===== 主星（十四主星） =====
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

  // ===== 辅星（六吉星中参与四化的） =====
  /** 文昌星（丙化科、辛化忌） */
  WenChang = 14,
  /** 文曲星（己化忌、辛化科） */
  WenQu = 15,
  /** 左辅星（壬化科） */
  ZuoFu = 16,
  /** 右弼星（戊化科） */
  YouBi = 17,
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

/**
 * 博士十二星
 * 从禄存起博士，依次顺/逆排
 */
export enum BoShiXing {
  /** 博士 - 聪明才智 */
  BoShi = 0,
  /** 力士 - 权力威势 */
  LiShi = 1,
  /** 青龙 - 喜庆吉祥 */
  QingLong = 2,
  /** 小耗 - 小破财 */
  XiaoHao = 3,
  /** 将军 - 威武刚强 */
  JiangJun = 4,
  /** 奏书 - 文书事务 */
  ZouShu = 5,
  /** 飞廉 - 是非口舌 */
  FeiLian = 6,
  /** 喜神 - 喜庆之事 */
  XiShen = 7,
  /** 病符 - 疾病灾厄 */
  BingFu = 8,
  /** 大耗 - 大破财 */
  DaHao = 9,
  /** 伏兵 - 暗藏危机 */
  FuBing = 10,
  /** 官府 - 官司诉讼 */
  GuanFu = 11,
}

/**
 * 长生十二宫
 * 从五行局起长生，依次顺/逆排
 */
export enum ChangSheng {
  /** 长生 - 生命开始 */
  ChangSheng = 0,
  /** 沐浴 - 洗礼净化 */
  MuYu = 1,
  /** 冠带 - 成年礼 */
  GuanDai = 2,
  /** 临官 - 任职做官 */
  LinGuan = 3,
  /** 帝旺 - 最旺盛期 */
  DiWang = 4,
  /** 衰 - 开始衰退 */
  Shuai = 5,
  /** 病 - 生病状态 */
  Bing = 6,
  /** 死 - 死亡阶段 */
  Si = 7,
  /** 墓 - 入墓安葬 */
  Mu = 8,
  /** 绝 - 断绝时期 */
  Jue = 9,
  /** 胎 - 受胎阶段 */
  Tai = 10,
  /** 养 - 养育阶段 */
  Yang = 11,
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
 * 四化星名称（支持主星和辅星）
 */
export const SI_HUA_STAR_NAMES: Record<SiHuaStar, string> = {
  // 主星
  [SiHuaStar.ZiWei]: '紫微',
  [SiHuaStar.TianJi]: '天机',
  [SiHuaStar.TaiYang]: '太阳',
  [SiHuaStar.WuQu]: '武曲',
  [SiHuaStar.TianTong]: '天同',
  [SiHuaStar.LianZhen]: '廉贞',
  [SiHuaStar.TianFu]: '天府',
  [SiHuaStar.TaiYin]: '太阴',
  [SiHuaStar.TanLang]: '贪狼',
  [SiHuaStar.JuMen]: '巨门',
  [SiHuaStar.TianXiang]: '天相',
  [SiHuaStar.TianLiang]: '天梁',
  [SiHuaStar.QiSha]: '七杀',
  [SiHuaStar.PoJun]: '破军',
  // 辅星
  [SiHuaStar.WenChang]: '文昌',
  [SiHuaStar.WenQu]: '文曲',
  [SiHuaStar.ZuoFu]: '左辅',
  [SiHuaStar.YouBi]: '右弼',
};

/**
 * 十天干对应的四化星（完整版）
 *
 * 索引顺序：[化禄, 化权, 化科, 化忌]
 */
export const TIAN_GAN_SI_HUA: Record<number, [SiHuaStar, SiHuaStar, SiHuaStar, SiHuaStar]> = {
  // 甲：廉贞化禄、破军化权、武曲化科、太阳化忌
  0: [SiHuaStar.LianZhen, SiHuaStar.PoJun, SiHuaStar.WuQu, SiHuaStar.TaiYang],
  // 乙：天机化禄、天梁化权、紫微化科、太阴化忌
  1: [SiHuaStar.TianJi, SiHuaStar.TianLiang, SiHuaStar.ZiWei, SiHuaStar.TaiYin],
  // 丙：天同化禄、天机化权、文昌化科、廉贞化忌
  2: [SiHuaStar.TianTong, SiHuaStar.TianJi, SiHuaStar.WenChang, SiHuaStar.LianZhen],
  // 丁：太阴化禄、天同化权、天机化科、巨门化忌
  3: [SiHuaStar.TaiYin, SiHuaStar.TianTong, SiHuaStar.TianJi, SiHuaStar.JuMen],
  // 戊：贪狼化禄、太阴化权、右弼化科、天机化忌
  4: [SiHuaStar.TanLang, SiHuaStar.TaiYin, SiHuaStar.YouBi, SiHuaStar.TianJi],
  // 己：武曲化禄、贪狼化权、天梁化科、文曲化忌
  5: [SiHuaStar.WuQu, SiHuaStar.TanLang, SiHuaStar.TianLiang, SiHuaStar.WenQu],
  // 庚：太阳化禄、武曲化权、太阴化科、天同化忌
  6: [SiHuaStar.TaiYang, SiHuaStar.WuQu, SiHuaStar.TaiYin, SiHuaStar.TianTong],
  // 辛：巨门化禄、太阳化权、文曲化科、文昌化忌
  7: [SiHuaStar.JuMen, SiHuaStar.TaiYang, SiHuaStar.WenQu, SiHuaStar.WenChang],
  // 壬：天梁化禄、紫微化权、左辅化科、武曲化忌
  8: [SiHuaStar.TianLiang, SiHuaStar.ZiWei, SiHuaStar.ZuoFu, SiHuaStar.WuQu],
  // 癸：破军化禄、巨门化权、太阴化科、贪狼化忌
  9: [SiHuaStar.PoJun, SiHuaStar.JuMen, SiHuaStar.TaiYin, SiHuaStar.TanLang],
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
 * 博士十二星名称
 */
export const BO_SHI_XING_NAMES: Record<BoShiXing, string> = {
  [BoShiXing.BoShi]: '博士',
  [BoShiXing.LiShi]: '力士',
  [BoShiXing.QingLong]: '青龙',
  [BoShiXing.XiaoHao]: '小耗',
  [BoShiXing.JiangJun]: '将军',
  [BoShiXing.ZouShu]: '奏书',
  [BoShiXing.FeiLian]: '飞廉',
  [BoShiXing.XiShen]: '喜神',
  [BoShiXing.BingFu]: '病符',
  [BoShiXing.DaHao]: '大耗',
  [BoShiXing.FuBing]: '伏兵',
  [BoShiXing.GuanFu]: '官府',
};

/**
 * 长生十二宫名称
 */
export const CHANG_SHENG_NAMES: Record<ChangSheng, string> = {
  [ChangSheng.ChangSheng]: '长生',
  [ChangSheng.MuYu]: '沐浴',
  [ChangSheng.GuanDai]: '冠带',
  [ChangSheng.LinGuan]: '临官',
  [ChangSheng.DiWang]: '帝旺',
  [ChangSheng.Shuai]: '衰',
  [ChangSheng.Bing]: '病',
  [ChangSheng.Si]: '死',
  [ChangSheng.Mu]: '墓',
  [ChangSheng.Jue]: '绝',
  [ChangSheng.Tai]: '胎',
  [ChangSheng.Yang]: '养',
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

// ==================== 辅助函数 ====================

/**
 * 判断四化星是否为主星
 * @param star 四化星
 * @returns 是否为主星（十四主星）
 */
export function isSiHuaStarZhuXing(star: SiHuaStar): boolean {
  return star >= SiHuaStar.ZiWei && star <= SiHuaStar.PoJun;
}

/**
 * 判断四化星是否为辅星
 * @param star 四化星
 * @returns 是否为辅星（文昌、文曲、左辅、右弼）
 */
export function isSiHuaStarFuXing(star: SiHuaStar): boolean {
  return star >= SiHuaStar.WenChang && star <= SiHuaStar.YouBi;
}

/**
 * 获取四化星名称
 * @param star 四化星
 * @returns 星曜名称
 */
export function getSiHuaStarName(star: SiHuaStar): string {
  return SI_HUA_STAR_NAMES[star] || '未知';
}

/**
 * 获取指定天干的四化星
 * @param tianGanIndex 天干索引（0=甲, 1=乙, ...）
 * @returns [化禄星, 化权星, 化科星, 化忌星]
 */
export function getSiHuaStarsByTianGan(tianGanIndex: number): [SiHuaStar, SiHuaStar, SiHuaStar, SiHuaStar] {
  const index = tianGanIndex % 10;
  return TIAN_GAN_SI_HUA[index];
}

/**
 * 获取指定天干的四化描述
 * @param tianGanIndex 天干索引
 * @returns 格式化的四化描述，如 "廉贞化禄、破军化权、武曲化科、太阳化忌"
 */
export function getSiHuaDescription(tianGanIndex: number): string {
  const stars = getSiHuaStarsByTianGan(tianGanIndex);
  const names = [
    `${getSiHuaStarName(stars[0])}化禄`,
    `${getSiHuaStarName(stars[1])}化权`,
    `${getSiHuaStarName(stars[2])}化科`,
    `${getSiHuaStarName(stars[3])}化忌`,
  ];
  return names.join('、');
}

/**
 * 将 SiHuaStar 转换为 ZhuXing（仅主星有效）
 * @param star 四化星
 * @returns ZhuXing 或 undefined（如果是辅星）
 */
export function siHuaStarToZhuXing(star: SiHuaStar): ZhuXing | undefined {
  if (isSiHuaStarZhuXing(star)) {
    return star as unknown as ZhuXing;
  }
  return undefined;
}

/**
 * 将 SiHuaStar 转换为 FuXing（仅辅星有效）
 * @param star 四化星
 * @returns FuXing 或 undefined（如果是主星）
 */
export function siHuaStarToFuXing(star: SiHuaStar): FuXing | undefined {
  if (isSiHuaStarFuXing(star)) {
    // SiHuaStar.WenChang = 14 对应 FuXing.WenChang = 0
    return (star - SiHuaStar.WenChang) as FuXing;
  }
  return undefined;
}

/**
 * 从 ZhuXing 转换为 SiHuaStar
 * @param zhuXing 主星
 * @returns 对应的 SiHuaStar
 */
export function zhuXingToSiHuaStar(zhuXing: ZhuXing): SiHuaStar {
  return zhuXing as unknown as SiHuaStar;
}

/**
 * 从 FuXing 转换为 SiHuaStar（仅参与四化的辅星有效）
 * @param fuXing 辅星
 * @returns 对应的 SiHuaStar 或 undefined（如果不参与四化）
 */
export function fuXingToSiHuaStar(fuXing: FuXing): SiHuaStar | undefined {
  switch (fuXing) {
    case FuXing.WenChang:
      return SiHuaStar.WenChang;
    case FuXing.WenQu:
      return SiHuaStar.WenQu;
    case FuXing.ZuoFu:
      return SiHuaStar.ZuoFu;
    case FuXing.YouBi:
      return SiHuaStar.YouBi;
    default:
      return undefined; // 天魁、天钺、禄存、天马不参与四化
  }
}

// ==================== 博士十二星辅助函数 ====================

/**
 * 获取博士十二星名称
 * @param star 博士十二星枚举值
 * @returns 星名
 */
export function getBoShiXingName(star: BoShiXing): string {
  return BO_SHI_XING_NAMES[star] || '未知';
}

/**
 * 判断博士十二星是否为吉星
 * @param star 博士十二星
 * @returns 是否吉星
 */
export function isBoShiXingJi(star: BoShiXing): boolean {
  return star === BoShiXing.BoShi ||
         star === BoShiXing.QingLong ||
         star === BoShiXing.XiShen;
}

/**
 * 判断博士十二星是否为凶星
 * @param star 博士十二星
 * @returns 是否凶星
 */
export function isBoShiXingXiong(star: BoShiXing): boolean {
  return star === BoShiXing.XiaoHao ||
         star === BoShiXing.FeiLian ||
         star === BoShiXing.BingFu ||
         star === BoShiXing.DaHao ||
         star === BoShiXing.FuBing ||
         star === BoShiXing.GuanFu;
}

// ==================== 长生十二宫辅助函数 ====================

/**
 * 获取长生十二宫名称
 * @param stage 长生十二宫枚举值
 * @returns 宫名
 */
export function getChangShengName(stage: ChangSheng): string {
  return CHANG_SHENG_NAMES[stage] || '未知';
}

/**
 * 判断长生十二宫是否为吉位
 * @param stage 长生十二宫
 * @returns 是否吉位
 */
export function isChangShengJi(stage: ChangSheng): boolean {
  return stage === ChangSheng.ChangSheng ||
         stage === ChangSheng.GuanDai ||
         stage === ChangSheng.LinGuan ||
         stage === ChangSheng.DiWang;
}

/**
 * 判断长生十二宫是否为凶位
 * @param stage 长生十二宫
 * @returns 是否凶位
 */
export function isChangShengXiong(stage: ChangSheng): boolean {
  return stage === ChangSheng.MuYu ||
         stage === ChangSheng.Bing ||
         stage === ChangSheng.Si ||
         stage === ChangSheng.Mu ||
         stage === ChangSheng.Jue;
}
