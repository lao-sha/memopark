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

// ==================== 解卦相关类型 ====================

/**
 * 吉凶等级
 */
export enum FortuneLevel {
  /** 大吉 */
  DaJi = 0,
  /** 吉 */
  Ji = 1,
  /** 小吉 */
  XiaoJi = 2,
  /** 平 */
  Ping = 3,
  /** 小凶 */
  XiaoXiong = 4,
  /** 凶 */
  Xiong = 5,
  /** 大凶 */
  DaXiong = 6,
}

/**
 * 命格等级
 */
export enum MingGeLevel {
  /** 帝王格局 */
  DiWang = 0,
  /** 极贵格局 */
  JiGui = 1,
  /** 大贵格局 */
  DaGui = 2,
  /** 中贵格局 */
  ZhongGui = 3,
  /** 小贵格局 */
  XiaoGui = 4,
  /** 普通格局 */
  Putong = 5,
}

/**
 * 格局类型
 */
export enum PatternType {
  // 吉格（0-21）
  ZiFuTongGong = 0,      // 紫府同宫
  ZiFuChaoYuan = 1,      // 紫府朝垣
  TianFuChaoYuan = 2,    // 天府朝垣
  JunChenQingHui = 3,    // 君臣庆会
  FuXiangChaoYuan = 4,   // 府相朝垣
  JiYueTongLiang = 5,    // 机月同梁
  RiYueBingMing = 6,     // 日月并明
  RiZhaoLeiMen = 7,      // 日照雷门
  YueLangTianMen = 8,    // 月朗天门
  MingZhuChuHai = 9,     // 明珠出海
  YangLiangChangLu = 10, // 阳梁昌禄
  TanWuTongXing = 11,    // 贪武同行
  HuoTanGeJu = 12,       // 火贪格
  LingTanGeJu = 13,      // 铃贪格
  SanQiJiaHui = 14,      // 三奇嘉会
  ShuangLuJiaMing = 15,  // 双禄夹命
  ShuangLuJiaCai = 16,   // 双禄夹财
  KeQuanLuJia = 17,      // 科权禄夹
  ZuoYouJiaMing = 18,    // 左右夹命
  ChangQuJiaMing = 19,   // 昌曲夹命
  KuiYueJiaMing = 20,    // 魁钺夹命
  LuMaJiaoChiGeJu = 21,  // 禄马交驰

  // 凶格（22-31）
  LingChangTuoWu = 22,   // 铃昌陀武
  JiJiTongGong = 23,     // 巨机同宫（辰戌）
  JuRiTongGong = 24,     // 巨日同宫（落陷）
  MingWuZhengYao = 25,   // 命无正曜
  MaTouDaiJian = 26,     // 马头带箭
  YangTuoJiaMing = 27,   // 羊陀夹命
  HuoLingJiaMing = 28,   // 火铃夹命
  KongJieJiaMing = 29,   // 空劫夹命
  YangTuoJiaJi = 30,     // 羊陀夹忌
  SiShaChongMing = 31,   // 四煞冲命
}

/**
 * 格局信息
 */
export interface PatternInfo {
  /** 格局类型 */
  patternType: PatternType;
  /** 格局强度（0-100） */
  strength: number;
  /** 是否有效 */
  isValid: boolean;
  /** 是否吉格 */
  isAuspicious: boolean;
  /** 格局评分（-50 ~ +50） */
  score: number;
  /** 关键宫位索引 */
  keyPalaces: [number, number, number];
}

/**
 * 宫位解读
 */
export interface PalaceInterpretation {
  /** 宫位类型 */
  gongWei: Gong;
  /** 宫位评分（0-100） */
  score: number;
  /** 吉凶等级 */
  fortuneLevel: FortuneLevel;
  /** 主星强度（0-100） */
  starStrength: number;
  /** 四化影响（-50 ~ +50） */
  siHuaImpact: number;
  /** 六吉星数量 */
  liuJiCount: number;
  /** 六煞星数量 */
  liuShaCount: number;
  /** 关键词索引 */
  keywords: [number, number, number];
  /** 影响因素位标志 */
  factors: number;
}

/**
 * 整体评分
 */
export interface ChartOverallScore {
  /** 整体评分（0-100） */
  overallScore: number;
  /** 命格等级 */
  mingGeLevel: MingGeLevel;
  /** 财运指数（0-100） */
  wealthIndex: number;
  /** 事业指数（0-100） */
  careerIndex: number;
  /** 感情指数（0-100） */
  relationshipIndex: number;
  /** 健康指数（0-100） */
  healthIndex: number;
  /** 福德指数（0-100） */
  fortuneIndex: number;
}

/**
 * 四化分析
 */
export interface SiHuaAnalysis {
  /** 生年四化星 */
  shengNianSiHua: [SiHuaStar, SiHuaStar, SiHuaStar, SiHuaStar];
  /** 命宫飞入宫位 */
  mingGongFeiRu: [number, number, number, number];
  /** 财帛宫飞入宫位 */
  caiBoFeiRu: [number, number, number, number];
  /** 官禄宫飞入宫位 */
  guanLuFeiRu: [number, number, number, number];
  /** 夫妻宫飞入宫位 */
  fuQiFeiRu: [number, number, number, number];
  /** 自化宫位标志（12 bits） */
  ziHuaPalaces: number;
  /** 化忌冲破标志（12 bits） */
  huaJiChongPo: number;
}

/**
 * 大限解读
 */
export interface DaXianInterpretation {
  /** 大限序号（1-12） */
  index: number;
  /** 起始年龄 */
  startAge: number;
  /** 结束年龄 */
  endAge: number;
  /** 大限宫位索引 */
  gongIndex: number;
  /** 大限评分（0-100） */
  score: number;
  /** 运势等级 */
  fortuneLevel: FortuneLevel;
  /** 大限四化飞入 */
  siHuaFeiRu: [number, number, number, number];
  /** 关键词索引 */
  keywords: [number, number, number];
}

/**
 * 完整解卦结果
 */
export interface ZiweiInterpretation {
  /** 命盘ID */
  chartId: number;
  /** 整体评分 */
  overallScore: ChartOverallScore;
  /** 十二宫解读 */
  palaceInterpretations: PalaceInterpretation[];
  /** 格局列表 */
  patterns: PatternInfo[];
  /** 四化分析 */
  siHuaAnalysis: SiHuaAnalysis;
  /** 大限解读 */
  daXianInterpretations: DaXianInterpretation[];
  /** 五行分布 [金, 木, 水, 火, 土] */
  wuXingDistribution: [number, number, number, number, number];
  /** 命主星 */
  mingZhuStar: number;
  /** 身主星 */
  shenZhuStar: number;
}

// ==================== 解卦常量 ====================

/**
 * 吉凶等级名称
 */
export const FORTUNE_LEVEL_NAMES: Record<FortuneLevel, string> = {
  [FortuneLevel.DaJi]: '大吉',
  [FortuneLevel.Ji]: '吉',
  [FortuneLevel.XiaoJi]: '小吉',
  [FortuneLevel.Ping]: '平',
  [FortuneLevel.XiaoXiong]: '小凶',
  [FortuneLevel.Xiong]: '凶',
  [FortuneLevel.DaXiong]: '大凶',
};

/**
 * 吉凶等级颜色
 */
export const FORTUNE_LEVEL_COLORS: Record<FortuneLevel, string> = {
  [FortuneLevel.DaJi]: '#f5222d',
  [FortuneLevel.Ji]: '#fa541c',
  [FortuneLevel.XiaoJi]: '#fa8c16',
  [FortuneLevel.Ping]: '#1890ff',
  [FortuneLevel.XiaoXiong]: '#722ed1',
  [FortuneLevel.Xiong]: '#531dab',
  [FortuneLevel.DaXiong]: '#120338',
};

/**
 * 命格等级名称
 */
export const MING_GE_LEVEL_NAMES: Record<MingGeLevel, string> = {
  [MingGeLevel.DiWang]: '帝王格局',
  [MingGeLevel.JiGui]: '极贵格局',
  [MingGeLevel.DaGui]: '大贵格局',
  [MingGeLevel.ZhongGui]: '中贵格局',
  [MingGeLevel.XiaoGui]: '小贵格局',
  [MingGeLevel.Putong]: '普通格局',
};

/**
 * 命格等级颜色
 */
export const MING_GE_LEVEL_COLORS: Record<MingGeLevel, string> = {
  [MingGeLevel.DiWang]: '#f5222d',
  [MingGeLevel.JiGui]: '#fa541c',
  [MingGeLevel.DaGui]: '#fa8c16',
  [MingGeLevel.ZhongGui]: '#faad14',
  [MingGeLevel.XiaoGui]: '#52c41a',
  [MingGeLevel.Putong]: '#1890ff',
};

/**
 * 格局名称
 */
export const PATTERN_NAMES: Record<PatternType, string> = {
  [PatternType.ZiFuTongGong]: '紫府同宫',
  [PatternType.ZiFuChaoYuan]: '紫府朝垣',
  [PatternType.TianFuChaoYuan]: '天府朝垣',
  [PatternType.JunChenQingHui]: '君臣庆会',
  [PatternType.FuXiangChaoYuan]: '府相朝垣',
  [PatternType.JiYueTongLiang]: '机月同梁',
  [PatternType.RiYueBingMing]: '日月并明',
  [PatternType.RiZhaoLeiMen]: '日照雷门',
  [PatternType.YueLangTianMen]: '月朗天门',
  [PatternType.MingZhuChuHai]: '明珠出海',
  [PatternType.YangLiangChangLu]: '阳梁昌禄',
  [PatternType.TanWuTongXing]: '贪武同行',
  [PatternType.HuoTanGeJu]: '火贪格',
  [PatternType.LingTanGeJu]: '铃贪格',
  [PatternType.SanQiJiaHui]: '三奇嘉会',
  [PatternType.ShuangLuJiaMing]: '双禄夹命',
  [PatternType.ShuangLuJiaCai]: '双禄夹财',
  [PatternType.KeQuanLuJia]: '科权禄夹',
  [PatternType.ZuoYouJiaMing]: '左右夹命',
  [PatternType.ChangQuJiaMing]: '昌曲夹命',
  [PatternType.KuiYueJiaMing]: '魁钺夹命',
  [PatternType.LuMaJiaoChiGeJu]: '禄马交驰',
  [PatternType.LingChangTuoWu]: '铃昌陀武',
  [PatternType.JiJiTongGong]: '巨机同宫',
  [PatternType.JuRiTongGong]: '巨日同宫',
  [PatternType.MingWuZhengYao]: '命无正曜',
  [PatternType.MaTouDaiJian]: '马头带箭',
  [PatternType.YangTuoJiaMing]: '羊陀夹命',
  [PatternType.HuoLingJiaMing]: '火铃夹命',
  [PatternType.KongJieJiaMing]: '空劫夹命',
  [PatternType.YangTuoJiaJi]: '羊陀夹忌',
  [PatternType.SiShaChongMing]: '四煞冲命',
};

/**
 * 格局描述
 */
export const PATTERN_DESCRIPTIONS: Record<PatternType, string> = {
  [PatternType.ZiFuTongGong]: '紫微、天府二星同坐命宫，主富贵双全',
  [PatternType.ZiFuChaoYuan]: '紫微、天府在三方四正会照命宫，主贵气逼人',
  [PatternType.TianFuChaoYuan]: '天府守命宫，逢禄存或化禄同宫，主财帛丰盈',
  [PatternType.JunChenQingHui]: '紫微为君，天相、天府为臣，三方会合，主大贵',
  [PatternType.FuXiangChaoYuan]: '天府、天相在命宫或三方会照，主富贵绑身',
  [PatternType.JiYueTongLiang]: '天机、太阴、天同、天梁四星会合，主清贵文秀',
  [PatternType.RiYueBingMing]: '太阳、太阴在旺地会照命宫，日月并明，主富贵双全',
  [PatternType.RiZhaoLeiMen]: '太阳在卯宫守命且庙旺，主早年发达',
  [PatternType.YueLangTianMen]: '太阴在亥宫守命且庙旺，主聪明秀气',
  [PatternType.MingZhuChuHai]: '太阴在酉宫守命，主才华出众',
  [PatternType.YangLiangChangLu]: '太阳、天梁在三方会文昌、禄存，主功名显达',
  [PatternType.TanWuTongXing]: '贪狼、武曲同坐丑未宫，主武贵或偏财运佳',
  [PatternType.HuoTanGeJu]: '火星、贪狼同宫于命宫，主暴发横财',
  [PatternType.LingTanGeJu]: '铃星、贪狼同宫于命宫，主横财暴发',
  [PatternType.SanQiJiaHui]: '化禄、化权、化科三化在命宫三方会合，主大富大贵',
  [PatternType.ShuangLuJiaMing]: '禄存、化禄夹命宫，主财帛滚滚',
  [PatternType.ShuangLuJiaCai]: '禄存、化禄夹财帛宫，主财源广进',
  [PatternType.KeQuanLuJia]: '化科、化权、化禄夹命宫，主贵气加身',
  [PatternType.ZuoYouJiaMing]: '左辅、右弼夹命宫，主贵人多助',
  [PatternType.ChangQuJiaMing]: '文昌、文曲夹命宫，主文采斐然',
  [PatternType.KuiYueJiaMing]: '天魁、天钺夹命宫，主贵人相助',
  [PatternType.LuMaJiaoChiGeJu]: '禄存、天马同宫或会照命宫，主财运亨通',
  [PatternType.LingChangTuoWu]: '铃星、文昌、陀罗、武曲同宫，主波折困顿',
  [PatternType.JiJiTongGong]: '巨门、天机在辰戌宫同宫，主口舌是非',
  [PatternType.JuRiTongGong]: '巨门、太阳同宫且太阳落陷，主是非缠身',
  [PatternType.MingWuZhengYao]: '命宫无主星（空宫），需借对宫星曜',
  [PatternType.MaTouDaiJian]: '午宫擎羊守命，主性格刚烈',
  [PatternType.YangTuoJiaMing]: '擎羊、陀罗夹命宫，主一生多灾多难',
  [PatternType.HuoLingJiaMing]: '火星、铃星夹命宫，主脾气暴躁',
  [PatternType.KongJieJiaMing]: '地空、地劫夹命宫，主钱财难聚',
  [PatternType.YangTuoJiaJi]: '擎羊、陀罗夹化忌，主凶险异常',
  [PatternType.SiShaChongMing]: '擎羊、陀罗、火星、铃星冲命宫，主一生坎坷',
};

/**
 * 宫位关键词表（命宫）
 */
export const MING_GONG_KEYWORDS: string[] = [
  // 性格关键词 (0-19)
  '贵气', '聪慧', '稳重', '果断', '温和', '坚韧', '灵活', '谨慎',
  '大方', '内敛', '乐观', '悲观', '固执', '随和', '保守', '进取',
  '理性', '感性', '独立', '依赖',
  // 能力关键词 (20-39)
  '领导力强', '执行力佳', '创造力丰', '分析力强', '沟通力好', '学习力快',
  '适应力强', '抗压力好', '决策力强', '协调力佳', '表达力优', '洞察力强',
  '记忆力好', '专注力强', '行动力快', '规划力强', '整合力强', '判断力准',
  '社交力强', '组织力佳',
  // 运势关键词 (40-59)
  '一生顺遂', '早年辛劳', '中年发达', '晚年享福', '贵人相助', '白手起家',
  '波折较多', '平稳发展', '大器晚成', '少年得志', '起伏不定', '稳中求进',
  '机遇多多', '需要努力', '有贵人运', '靠自己力', '命带桃花', '福气深厚',
  '劳碌命格', '富贵在后',
];

/**
 * 财帛宫关键词表
 */
export const CAI_BO_KEYWORDS: string[] = [
  // 财运关键词 (0-19)
  '财源广进', '财运亨通', '正财旺盛', '偏财运强', '财库丰盈', '理财有道',
  '投资获利', '积累为主', '财来财去', '破耗较多', '收入稳定', '收入不稳',
  '贵人送财', '白手起家', '祖业可继', '靠己创业', '合作生财', '独立经营',
  '大进大出', '细水长流',
  // 理财方式关键词 (20-39)
  '适合经商', '适合投资', '适合技术', '适合管理', '适合创业', '工资收入',
  '副业收入', '被动收入', '主动投资', '谨慎投资', '长线投资', '短线操作',
  '实业经营', '服务行业', '金融投资', '房产投资', '股票基金', '储蓄为主',
  '保险配置', '节流为主',
  // 财运建议关键词 (40-49)
  '宜投资', '宜储蓄', '宜创业', '宜合作', '宜稳健', '谨慎理财',
  '勿贪心', '防破财', '广积粮', '细规划',
];

/**
 * 官禄宫关键词表
 */
export const GUAN_LU_KEYWORDS: string[] = [
  // 事业关键词 (0-19)
  '事业有成', '仕途顺利', '步步高升', '创业成功', '专业精进', '事业平稳',
  '波折较多', '需要努力', '大器晚成', '中年转运', '贵人助力', '靠己打拼',
  '适合从政', '适合经商', '适合技术', '适合艺术', '适合服务', '适合管理',
  '独当一面', '团队合作',
  // 能力关键词 (20-29)
  '领导能力强', '执行能力佳', '专业能力精', '沟通能力好', '协调能力强',
  '决策能力优', '独立工作强', '团队协作好', '开拓能力强', '守成能力佳',
  // 事业状态关键词 (30-39)
  '升职快', '名望高', '权力大', '收入稳', '发展好', '压力大',
  '稳定安逸', '竞争激烈', '机会多多', '需要转型',
];

/**
 * 获取吉凶等级
 * @param score 评分（0-100）
 * @returns 吉凶等级
 */
export function getFortuneLevel(score: number): FortuneLevel {
  if (score >= 90) return FortuneLevel.DaJi;
  if (score >= 75) return FortuneLevel.Ji;
  if (score >= 60) return FortuneLevel.XiaoJi;
  if (score >= 40) return FortuneLevel.Ping;
  if (score >= 25) return FortuneLevel.XiaoXiong;
  if (score >= 10) return FortuneLevel.Xiong;
  return FortuneLevel.DaXiong;
}

/**
 * 判断格局是否为吉格
 * @param patternType 格局类型
 * @returns 是否吉格
 */
export function isPatternAuspicious(patternType: PatternType): boolean {
  return patternType <= PatternType.LuMaJiaoChiGeJu;
}

/**
 * 获取格局名称
 * @param patternType 格局类型
 * @returns 格局名称
 */
export function getPatternName(patternType: PatternType): string {
  return PATTERN_NAMES[patternType] || '未知格局';
}

/**
 * 获取格局描述
 * @param patternType 格局类型
 * @returns 格局描述
 */
export function getPatternDescription(patternType: PatternType): string {
  return PATTERN_DESCRIPTIONS[patternType] || '暂无描述';
}
