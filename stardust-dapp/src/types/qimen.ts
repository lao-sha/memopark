/**
 * 奇门遁甲类型定义
 *
 * 奇门遁甲是中国古代用于预测和决策的术数，由天盘、地盘、人盘、神盘
 * 四层构成，通过分析各盘之间的关系来推断吉凶。
 */

// ==================== 基础枚举 ====================

/**
 * 九宫位置
 */
export enum JiuGong {
  /** 坎一宫（北） */
  Kan = 1,
  /** 坤二宫（西南） */
  Kun = 2,
  /** 震三宫（东） */
  Zhen = 3,
  /** 巽四宫（东南） */
  Xun = 4,
  /** 中五宫 */
  Zhong = 5,
  /** 乾六宫（西北） */
  Qian = 6,
  /** 兑七宫（西） */
  Dui = 7,
  /** 艮八宫（东北） */
  Gen = 8,
  /** 离九宫（南） */
  Li = 9,
}

/**
 * 三奇六仪
 */
export enum QiYi {
  /** 甲（戊遁） */
  Jia = 0,
  /** 乙（日奇） */
  Yi = 1,
  /** 丙（月奇） */
  Bing = 2,
  /** 丁（星奇） */
  Ding = 3,
  /** 戊 */
  Wu = 4,
  /** 己 */
  Ji = 5,
  /** 庚 */
  Geng = 6,
  /** 辛 */
  Xin = 7,
  /** 壬 */
  Ren = 8,
  /** 癸 */
  Gui = 9,
}

/**
 * 八门
 */
export enum BaMen {
  /** 休门 */
  Xiu = 0,
  /** 生门 */
  Sheng = 1,
  /** 伤门 */
  Shang = 2,
  /** 杜门 */
  Du = 3,
  /** 景门 */
  Jing = 4,
  /** 死门 */
  Si = 5,
  /** 惊门 */
  Jing2 = 6,
  /** 开门 */
  Kai = 7,
}

/**
 * 九星
 */
export enum JiuXing {
  /** 天蓬星 */
  TianPeng = 0,
  /** 天芮星 */
  TianRui = 1,
  /** 天冲星 */
  TianChong = 2,
  /** 天辅星 */
  TianFu = 3,
  /** 天禽星 */
  TianQin = 4,
  /** 天心星 */
  TianXin = 5,
  /** 天柱星 */
  TianZhu = 6,
  /** 天任星 */
  TianRen = 7,
  /** 天英星 */
  TianYing = 8,
}

/**
 * 八神
 */
export enum BaShen {
  /** 值符 */
  ZhiFu = 0,
  /** 螣蛇 */
  TengShe = 1,
  /** 太阴 */
  TaiYin = 2,
  /** 六合 */
  LiuHe = 3,
  /** 白虎 */
  BaiHu = 4,
  /** 玄武 */
  XuanWu = 5,
  /** 九地 */
  JiuDi = 6,
  /** 九天 */
  JiuTian = 7,
}

/**
 * 局数
 */
export enum JuShu {
  /** 阳遁一局 */
  Yang1 = 1,
  /** 阳遁二局 */
  Yang2 = 2,
  /** 阳遁三局 */
  Yang3 = 3,
  /** 阳遁四局 */
  Yang4 = 4,
  /** 阳遁五局 */
  Yang5 = 5,
  /** 阳遁六局 */
  Yang6 = 6,
  /** 阳遁七局 */
  Yang7 = 7,
  /** 阳遁八局 */
  Yang8 = 8,
  /** 阳遁九局 */
  Yang9 = 9,
  /** 阴遁一局 */
  Yin1 = -1,
  /** 阴遁二局 */
  Yin2 = -2,
  /** 阴遁三局 */
  Yin3 = -3,
  /** 阴遁四局 */
  Yin4 = -4,
  /** 阴遁五局 */
  Yin5 = -5,
  /** 阴遁六局 */
  Yin6 = -6,
  /** 阴遁七局 */
  Yin7 = -7,
  /** 阴遁八局 */
  Yin8 = -8,
  /** 阴遁九局 */
  Yin9 = -9,
}

// ==================== 数据结构 ====================

/**
 * 单个宫位信息
 */
export interface GongWei {
  /** 宫位 */
  gong: JiuGong;
  /** 地盘天干（固定） */
  diPanGan: QiYi;
  /** 天盘天干 */
  tianPanGan: QiYi;
  /** 八门 */
  men: BaMen;
  /** 九星 */
  xing: JiuXing;
  /** 八神 */
  shen: BaShen;
  /** 是否空亡 */
  isKong: boolean;
  /** 是否马星 */
  isMa: boolean;
}

/**
 * 奇门遁甲盘
 */
export interface QimenPan {
  /** 盘ID */
  id: number;
  /** 创建者 */
  creator: string;
  /** 局数 */
  juShu: JuShu;
  /** 值符 */
  zhiFu: JiuXing;
  /** 值使 */
  zhiShi: BaMen;
  /** 旬首 */
  xunShou: QiYi;
  /** 九宫信息 */
  gongWeis: GongWei[];
  /** 占测年 */
  year: number;
  /** 占测月 */
  month: number;
  /** 占测日 */
  day: number;
  /** 占测时辰 */
  hour: number;
  /** 节气 */
  jieQi: string;
  /** 问题（加密） */
  questionHash?: string;
  /** 创建时间 */
  createdAt: number;
  /** 是否公开 */
  isPublic: boolean;
}

/**
 * 奇门排盘输入
 */
export interface QimenInput {
  /** 年 */
  year: number;
  /** 月 */
  month: number;
  /** 日 */
  day: number;
  /** 时辰 (0-11) */
  hour: number;
  /** 问题 */
  question?: string;
  /** 是否公开 */
  isPublic?: boolean;
}

/**
 * 格局类型
 */
export interface GeJu {
  /** 格局名称 */
  name: string;
  /** 吉凶 (1=吉, 0=平, -1=凶) */
  jiXiong: number;
  /** 所在宫位 */
  gong: JiuGong;
  /** 说明 */
  description: string;
}

/**
 * 奇门分析结果
 */
export interface QimenResult {
  /** 基础盘 */
  pan: QimenPan;
  /** 格局列表 */
  geJus: GeJu[];
  /** 用神分析 */
  yongShenAnalysis?: string;
  /** 简易断语 */
  briefAnalysis?: string;
}

// ==================== 常量定义 ====================

/**
 * 九宫名称
 */
export const JIU_GONG_NAMES: Record<JiuGong, string> = {
  [JiuGong.Kan]: '坎一宫',
  [JiuGong.Kun]: '坤二宫',
  [JiuGong.Zhen]: '震三宫',
  [JiuGong.Xun]: '巽四宫',
  [JiuGong.Zhong]: '中五宫',
  [JiuGong.Qian]: '乾六宫',
  [JiuGong.Dui]: '兑七宫',
  [JiuGong.Gen]: '艮八宫',
  [JiuGong.Li]: '离九宫',
};

/**
 * 九宫简称
 */
export const JIU_GONG_SHORT: Record<JiuGong, string> = {
  [JiuGong.Kan]: '坎',
  [JiuGong.Kun]: '坤',
  [JiuGong.Zhen]: '震',
  [JiuGong.Xun]: '巽',
  [JiuGong.Zhong]: '中',
  [JiuGong.Qian]: '乾',
  [JiuGong.Dui]: '兑',
  [JiuGong.Gen]: '艮',
  [JiuGong.Li]: '离',
};

/**
 * 九宫方位
 */
export const JIU_GONG_FANGWEI: Record<JiuGong, string> = {
  [JiuGong.Kan]: '北',
  [JiuGong.Kun]: '西南',
  [JiuGong.Zhen]: '东',
  [JiuGong.Xun]: '东南',
  [JiuGong.Zhong]: '中',
  [JiuGong.Qian]: '西北',
  [JiuGong.Dui]: '西',
  [JiuGong.Gen]: '东北',
  [JiuGong.Li]: '南',
};

/**
 * 三奇六仪名称
 */
export const QI_YI_NAMES: Record<QiYi, string> = {
  [QiYi.Jia]: '甲',
  [QiYi.Yi]: '乙',
  [QiYi.Bing]: '丙',
  [QiYi.Ding]: '丁',
  [QiYi.Wu]: '戊',
  [QiYi.Ji]: '己',
  [QiYi.Geng]: '庚',
  [QiYi.Xin]: '辛',
  [QiYi.Ren]: '壬',
  [QiYi.Gui]: '癸',
};

/**
 * 八门名称
 */
export const BA_MEN_NAMES: Record<BaMen, string> = {
  [BaMen.Xiu]: '休门',
  [BaMen.Sheng]: '生门',
  [BaMen.Shang]: '伤门',
  [BaMen.Du]: '杜门',
  [BaMen.Jing]: '景门',
  [BaMen.Si]: '死门',
  [BaMen.Jing2]: '惊门',
  [BaMen.Kai]: '开门',
};

/**
 * 八门吉凶
 */
export const BA_MEN_JI_XIONG: Record<BaMen, number> = {
  [BaMen.Xiu]: 1,   // 吉
  [BaMen.Sheng]: 1, // 吉
  [BaMen.Shang]: -1, // 凶
  [BaMen.Du]: 0,    // 平
  [BaMen.Jing]: 0,  // 平
  [BaMen.Si]: -1,   // 凶
  [BaMen.Jing2]: -1, // 凶
  [BaMen.Kai]: 1,   // 吉
};

/**
 * 八门颜色
 */
export const BA_MEN_COLORS: Record<BaMen, string> = {
  [BaMen.Xiu]: '#1890ff',
  [BaMen.Sheng]: '#52c41a',
  [BaMen.Shang]: '#fa541c',
  [BaMen.Du]: '#722ed1',
  [BaMen.Jing]: '#eb2f96',
  [BaMen.Si]: '#8c8c8c',
  [BaMen.Jing2]: '#faad14',
  [BaMen.Kai]: '#13c2c2',
};

/**
 * 九星名称
 */
export const JIU_XING_NAMES: Record<JiuXing, string> = {
  [JiuXing.TianPeng]: '天蓬',
  [JiuXing.TianRui]: '天芮',
  [JiuXing.TianChong]: '天冲',
  [JiuXing.TianFu]: '天辅',
  [JiuXing.TianQin]: '天禽',
  [JiuXing.TianXin]: '天心',
  [JiuXing.TianZhu]: '天柱',
  [JiuXing.TianRen]: '天任',
  [JiuXing.TianYing]: '天英',
};

/**
 * 九星吉凶
 */
export const JIU_XING_JI_XIONG: Record<JiuXing, number> = {
  [JiuXing.TianPeng]: -1, // 凶
  [JiuXing.TianRui]: -1,  // 凶
  [JiuXing.TianChong]: 1, // 吉
  [JiuXing.TianFu]: 1,    // 吉
  [JiuXing.TianQin]: 1,   // 吉
  [JiuXing.TianXin]: 1,   // 吉
  [JiuXing.TianZhu]: 0,   // 平
  [JiuXing.TianRen]: 1,   // 吉
  [JiuXing.TianYing]: 0,  // 平
};

/**
 * 八神名称
 */
export const BA_SHEN_NAMES: Record<BaShen, string> = {
  [BaShen.ZhiFu]: '值符',
  [BaShen.TengShe]: '螣蛇',
  [BaShen.TaiYin]: '太阴',
  [BaShen.LiuHe]: '六合',
  [BaShen.BaiHu]: '白虎',
  [BaShen.XuanWu]: '玄武',
  [BaShen.JiuDi]: '九地',
  [BaShen.JiuTian]: '九天',
};

/**
 * 八神吉凶
 */
export const BA_SHEN_JI_XIONG: Record<BaShen, number> = {
  [BaShen.ZhiFu]: 1,   // 吉
  [BaShen.TengShe]: -1, // 凶
  [BaShen.TaiYin]: 1,  // 吉
  [BaShen.LiuHe]: 1,   // 吉
  [BaShen.BaiHu]: -1,  // 凶
  [BaShen.XuanWu]: -1, // 凶
  [BaShen.JiuDi]: 0,   // 平
  [BaShen.JiuTian]: 1, // 吉
};

/**
 * 二十四节气
 */
export const JIE_QI_NAMES: string[] = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
];

/**
 * 常见格局
 */
export const COMMON_GE_JU: Array<{ name: string; jiXiong: number; description: string }> = [
  { name: '天遁', jiXiong: 1, description: '丙加戊，贵人扶助' },
  { name: '地遁', jiXiong: 1, description: '乙加己，地利人和' },
  { name: '人遁', jiXiong: 1, description: '丁加癸，贵人相助' },
  { name: '神遁', jiXiong: 1, description: '丙加壬，神灵庇佑' },
  { name: '鬼遁', jiXiong: 1, description: '乙加辛，隐藏不露' },
  { name: '龙遁', jiXiong: 1, description: '戊加癸，龙德吉庆' },
  { name: '虎遁', jiXiong: 1, description: '壬加戊，威猛果断' },
  { name: '风遁', jiXiong: 1, description: '辛加乙，风行草偃' },
  { name: '云遁', jiXiong: 1, description: '癸加壬，遁入云中' },
  { name: '白虎猖狂', jiXiong: -1, description: '庚临艮或乾，凶险难测' },
  { name: '螣蛇夭矫', jiXiong: -1, description: '螣蛇临震或巽，怪异难测' },
  { name: '朱雀投江', jiXiong: -1, description: '丁临坎，文书不利' },
  { name: '玄武入墓', jiXiong: -1, description: '癸临坤，暗昧难明' },
];

// ==================== 辅助函数 ====================

/**
 * 判断是否为阳遁
 */
export function isYangDun(juShu: JuShu): boolean {
  return juShu > 0;
}

/**
 * 获取局数的绝对值
 */
export function getJuNumber(juShu: JuShu): number {
  return Math.abs(juShu);
}

/**
 * 获取门的吉凶等级
 */
export function getMenJiXiong(men: BaMen): string {
  const level = BA_MEN_JI_XIONG[men];
  if (level > 0) return '吉';
  if (level < 0) return '凶';
  return '平';
}

/**
 * 获取星的吉凶等级
 */
export function getXingJiXiong(xing: JiuXing): string {
  const level = JIU_XING_JI_XIONG[xing];
  if (level > 0) return '吉';
  if (level < 0) return '凶';
  return '平';
}

/**
 * 获取神的吉凶等级
 */
export function getShenJiXiong(shen: BaShen): string {
  const level = BA_SHEN_JI_XIONG[shen];
  if (level > 0) return '吉';
  if (level < 0) return '凶';
  return '平';
}

// ==================== 格局检测类型 ====================

/**
 * 五行
 */
export enum WuXing {
  /** 金 */
  Jin = 0,
  /** 木 */
  Mu = 1,
  /** 水 */
  Shui = 2,
  /** 火 */
  Huo = 3,
  /** 土 */
  Tu = 4,
}

/**
 * 五行名称
 */
export const WU_XING_NAMES: Record<WuXing, string> = {
  [WuXing.Jin]: '金',
  [WuXing.Mu]: '木',
  [WuXing.Shui]: '水',
  [WuXing.Huo]: '火',
  [WuXing.Tu]: '土',
};

/**
 * 六仪击刑信息
 *
 * 六仪（戊己庚辛壬癸）临某些特定宫位时形成击刑格局
 */
export interface LiuYiJiXing {
  /** 击刑的天干 */
  gan: QiYi;
  /** 发生击刑的宫位 */
  gong: JiuGong;
}

/**
 * 六仪击刑规则表
 */
export const LIU_YI_JI_XING_RULES: Array<{ gan: QiYi; gong: JiuGong; desc: string }> = [
  { gan: QiYi.Wu, gong: JiuGong.Zhen, desc: '戊击刑（震三宫）' },
  { gan: QiYi.Ji, gong: JiuGong.Kun, desc: '己击刑（坤二宫）' },
  { gan: QiYi.Geng, gong: JiuGong.Gen, desc: '庚击刑（艮八宫）' },
  { gan: QiYi.Xin, gong: JiuGong.Li, desc: '辛击刑（离九宫）' },
  { gan: QiYi.Ren, gong: JiuGong.Xun, desc: '壬击刑（巽四宫）' },
  { gan: QiYi.Gui, gong: JiuGong.Xun, desc: '癸击刑（巽四宫）' },
];

/**
 * 奇仪入墓信息
 *
 * 天干临其墓库之宫位时形成入墓格局，主事不顺、受困
 */
export interface QiYiRuMu {
  /** 入墓的天干 */
  gan: QiYi;
  /** 发生入墓的宫位 */
  gong: JiuGong;
  /** 墓库名称 */
  muName: string;
}

/**
 * 奇仪入墓规则表
 */
export const QI_YI_RU_MU_RULES: Array<{ gan: QiYi; gong: JiuGong; muName: string; desc: string }> = [
  { gan: QiYi.Jia, gong: JiuGong.Qian, muName: '戌土', desc: '甲入墓（乾六宫）' },
  { gan: QiYi.Wu, gong: JiuGong.Qian, muName: '戌土', desc: '戊入墓（乾六宫）' },
  { gan: QiYi.Yi, gong: JiuGong.Qian, muName: '戌土', desc: '乙入墓（乾六宫）' },
  { gan: QiYi.Bing, gong: JiuGong.Qian, muName: '戌土', desc: '丙入墓（乾六宫）' },
  { gan: QiYi.Ding, gong: JiuGong.Gen, muName: '丑土', desc: '丁入墓（艮八宫）' },
  { gan: QiYi.Ji, gong: JiuGong.Gen, muName: '丑土', desc: '己入墓（艮八宫）' },
  { gan: QiYi.Geng, gong: JiuGong.Gen, muName: '丑土', desc: '庚入墓（艮八宫）' },
  { gan: QiYi.Xin, gong: JiuGong.Xun, muName: '辰土', desc: '辛入墓（巽四宫）' },
  { gan: QiYi.Ren, gong: JiuGong.Xun, muName: '辰土', desc: '壬入墓（巽四宫）' },
  { gan: QiYi.Gui, gong: JiuGong.Kun, muName: '未土', desc: '癸入墓（坤二宫）' },
];

/**
 * 门迫信息
 *
 * 八门五行克落宫五行时为门迫，主事受阻、不顺
 */
export interface MenPo {
  /** 被迫之门 */
  men: BaMen;
  /** 发生门迫的宫位 */
  gong: JiuGong;
}

/**
 * 门迫规则表
 */
export const MEN_PO_RULES: Array<{ men: BaMen; gong: JiuGong; desc: string }> = [
  { men: BaMen.Xiu, gong: JiuGong.Li, desc: '休门（水）克离宫（火）' },
  { men: BaMen.Sheng, gong: JiuGong.Kan, desc: '生门（土）克坎宫（水）' },
  { men: BaMen.Shang, gong: JiuGong.Kun, desc: '伤门（木）克坤宫（土）' },
  { men: BaMen.Shang, gong: JiuGong.Gen, desc: '伤门（木）克艮宫（土）' },
  { men: BaMen.Du, gong: JiuGong.Kun, desc: '杜门（木）克坤宫（土）' },
  { men: BaMen.Du, gong: JiuGong.Gen, desc: '杜门（木）克艮宫（土）' },
  { men: BaMen.Jing, gong: JiuGong.Qian, desc: '景门（火）克乾宫（金）' },
  { men: BaMen.Jing, gong: JiuGong.Dui, desc: '景门（火）克兑宫（金）' },
  { men: BaMen.Si, gong: JiuGong.Kan, desc: '死门（土）克坎宫（水）' },
  { men: BaMen.Jing2, gong: JiuGong.Zhen, desc: '惊门（金）克震宫（木）' },
  { men: BaMen.Jing2, gong: JiuGong.Xun, desc: '惊门（金）克巽宫（木）' },
  { men: BaMen.Kai, gong: JiuGong.Zhen, desc: '开门（金）克震宫（木）' },
  { men: BaMen.Kai, gong: JiuGong.Xun, desc: '开门（金）克巽宫（木）' },
];

/**
 * 十干克应格局类型
 */
export enum ShiGanGeJuType {
  // ========== 吉格 ==========
  /** 乙+乙：日奇伏吟 */
  RiQiFuYin = 'RiQiFuYin',
  /** 乙+丙：奇仪顺遂 */
  QiYiShunSui = 'QiYiShunSui',
  /** 乙+丁：奇仪相佐 */
  QiYiXiangZuo = 'QiYiXiangZuo',
  /** 丙+乙：日月并行 */
  RiYueBingXing = 'RiYueBingXing',
  /** 丙+丙：月奇悖师 */
  YueQiBeiShi = 'YueQiBeiShi',
  /** 丙+丁：星奇朱雀 */
  XingQiZhuQue = 'XingQiZhuQue',
  /** 丁+乙：星奇入太阴 */
  XingQiRuTaiYin = 'XingQiRuTaiYin',
  /** 丁+丙：星奇入六合 */
  XingQiRuLiuHe = 'XingQiRuLiuHe',
  /** 丁+丁：星奇伏吟 */
  XingQiFuYin = 'XingQiFuYin',
  /** 丙+戊：飞鸟跌穴（大吉） */
  FeiNiaoDieXue = 'FeiNiaoDieXue',

  // ========== 凶格 ==========
  /** 庚+庚：太白同宫（大凶） */
  TaiBaiTongGong = 'TaiBaiTongGong',
  /** 庚+乙：太白入日 */
  TaiBaiRuRi = 'TaiBaiRuRi',
  /** 庚+丙：太白入荧 */
  TaiBaiRuYing = 'TaiBaiRuYing',
  /** 庚+丁：太白入星 */
  TaiBaiRuXing = 'TaiBaiRuXing',
  /** 癸+癸：华盖伏吟 */
  HuaGaiFuYin = 'HuaGaiFuYin',
  /** 辛+乙：白虎猖狂 */
  BaiHuChangKuang = 'BaiHuChangKuang',
  /** 辛+丙：白虎入荧 */
  BaiHuRuYing = 'BaiHuRuYing',
  /** 辛+丁：白虎入星 */
  BaiHuRuXing = 'BaiHuRuXing',
  /** 壬+壬：蛇夭矫 */
  SheYaoJiao = 'SheYaoJiao',

  // ========== 中平格 ==========
  /** 戊+戊/己+己：伏吟 */
  FuYin = 'FuYin',
  /** 其他组合 */
  Other = 'Other',
}

/**
 * 十干克应格局名称
 */
export const SHI_GAN_GE_JU_NAMES: Record<ShiGanGeJuType, string> = {
  [ShiGanGeJuType.RiQiFuYin]: '日奇伏吟',
  [ShiGanGeJuType.QiYiShunSui]: '奇仪顺遂',
  [ShiGanGeJuType.QiYiXiangZuo]: '奇仪相佐',
  [ShiGanGeJuType.RiYueBingXing]: '日月并行',
  [ShiGanGeJuType.YueQiBeiShi]: '月奇悖师',
  [ShiGanGeJuType.XingQiZhuQue]: '星奇朱雀',
  [ShiGanGeJuType.XingQiRuTaiYin]: '星奇入太阴',
  [ShiGanGeJuType.XingQiRuLiuHe]: '星奇入六合',
  [ShiGanGeJuType.XingQiFuYin]: '星奇伏吟',
  [ShiGanGeJuType.FeiNiaoDieXue]: '飞鸟跌穴',
  [ShiGanGeJuType.TaiBaiTongGong]: '太白同宫',
  [ShiGanGeJuType.TaiBaiRuRi]: '太白入日',
  [ShiGanGeJuType.TaiBaiRuYing]: '太白入荧',
  [ShiGanGeJuType.TaiBaiRuXing]: '太白入星',
  [ShiGanGeJuType.HuaGaiFuYin]: '华盖伏吟',
  [ShiGanGeJuType.BaiHuChangKuang]: '白虎猖狂',
  [ShiGanGeJuType.BaiHuRuYing]: '白虎入荧',
  [ShiGanGeJuType.BaiHuRuXing]: '白虎入星',
  [ShiGanGeJuType.SheYaoJiao]: '蛇夭矫',
  [ShiGanGeJuType.FuYin]: '伏吟',
  [ShiGanGeJuType.Other]: '普通',
};

/**
 * 十干克应格局吉凶
 */
export const SHI_GAN_GE_JU_JI_XIONG: Record<ShiGanGeJuType, number> = {
  [ShiGanGeJuType.RiQiFuYin]: 1,
  [ShiGanGeJuType.QiYiShunSui]: 1,
  [ShiGanGeJuType.QiYiXiangZuo]: 1,
  [ShiGanGeJuType.RiYueBingXing]: 1,
  [ShiGanGeJuType.YueQiBeiShi]: 1,
  [ShiGanGeJuType.XingQiZhuQue]: 1,
  [ShiGanGeJuType.XingQiRuTaiYin]: 1,
  [ShiGanGeJuType.XingQiRuLiuHe]: 1,
  [ShiGanGeJuType.XingQiFuYin]: 1,
  [ShiGanGeJuType.FeiNiaoDieXue]: 1,
  [ShiGanGeJuType.TaiBaiTongGong]: -1,
  [ShiGanGeJuType.TaiBaiRuRi]: -1,
  [ShiGanGeJuType.TaiBaiRuYing]: -1,
  [ShiGanGeJuType.TaiBaiRuXing]: -1,
  [ShiGanGeJuType.HuaGaiFuYin]: -1,
  [ShiGanGeJuType.BaiHuChangKuang]: -1,
  [ShiGanGeJuType.BaiHuRuYing]: -1,
  [ShiGanGeJuType.BaiHuRuXing]: -1,
  [ShiGanGeJuType.SheYaoJiao]: -1,
  [ShiGanGeJuType.FuYin]: 0,
  [ShiGanGeJuType.Other]: 0,
};

/**
 * 十干克应检测结果
 */
export interface ShiGanKeYing {
  /** 天盘干 */
  tianGan: QiYi;
  /** 地盘干 */
  diGan: QiYi;
  /** 格局类型 */
  geJu: ShiGanGeJuType;
  /** 是否吉格 */
  isJi: boolean;
}

/**
 * 旺衰状态
 */
export enum WangShuai {
  /** 旺 - 当令 */
  Wang = 'Wang',
  /** 相 - 我生者 */
  Xiang = 'Xiang',
  /** 休 - 生我者 */
  Xiu = 'Xiu',
  /** 囚 - 克我者 */
  Qiu = 'Qiu',
  /** 死 - 我克者 */
  Si = 'Si',
}

/**
 * 旺衰名称
 */
export const WANG_SHUAI_NAMES: Record<WangShuai, string> = {
  [WangShuai.Wang]: '旺',
  [WangShuai.Xiang]: '相',
  [WangShuai.Xiu]: '休',
  [WangShuai.Qiu]: '囚',
  [WangShuai.Si]: '死',
};

/**
 * 旺衰颜色
 */
export const WANG_SHUAI_COLORS: Record<WangShuai, string> = {
  [WangShuai.Wang]: '#52c41a',  // 绿色
  [WangShuai.Xiang]: '#1890ff', // 蓝色
  [WangShuai.Xiu]: '#faad14',   // 黄色
  [WangShuai.Qiu]: '#fa541c',   // 橙色
  [WangShuai.Si]: '#8c8c8c',    // 灰色
};

/**
 * 驿马信息
 */
export interface YiMa {
  /** 驿马所在宫位 */
  gong: JiuGong;
  /** 驿马对应地支名称 */
  zhiName: string;
}

/**
 * 驿马规则表（根据时支三合局）
 */
export const YI_MA_RULES: Array<{ shiZhi: string[]; gong: JiuGong; zhiName: string }> = [
  { shiZhi: ['申', '子', '辰'], gong: JiuGong.Gen, zhiName: '寅' },  // 水局驿马在寅
  { shiZhi: ['寅', '午', '戌'], gong: JiuGong.Kun, zhiName: '申' },  // 火局驿马在申
  { shiZhi: ['巳', '酉', '丑'], gong: JiuGong.Qian, zhiName: '亥' }, // 金局驿马在亥
  { shiZhi: ['亥', '卯', '未'], gong: JiuGong.Xun, zhiName: '巳' },  // 木局驿马在巳
];

/**
 * 宫位格局分析结果
 */
export interface PalaceAnalysis {
  /** 六仪击刑 */
  jiXing?: LiuYiJiXing;
  /** 奇仪入墓 */
  ruMu?: QiYiRuMu;
  /** 门迫 */
  menPo?: MenPo;
  /** 十干克应 */
  keYing?: ShiGanKeYing;
  /** 是否为驿马宫 */
  isYiMa: boolean;
  /** 九星旺衰 */
  xingWangShuai?: WangShuai;
  /** 八门旺衰 */
  menWangShuai?: WangShuai;
}

/**
 * 扩展的宫位信息（包含格局分析）
 */
export interface GongWeiWithAnalysis extends GongWei {
  /** 格局分析结果 */
  analysis?: PalaceAnalysis;
}

/**
 * 奇门遁甲完整分析结果
 */
export interface QimenFullAnalysis {
  /** 基础盘 */
  pan: QimenPan;
  /** 九宫格局分析 */
  palaceAnalyses: PalaceAnalysis[];
  /** 整盘格局列表（如飞鸟跌穴、太白同宫等） */
  patterns: GeJu[];
  /** 驿马信息 */
  yiMa?: YiMa;
  /** 综合吉凶评分（-100到100） */
  score: number;
  /** 简要断语 */
  summary: string;
}

// ==================== 格局检测辅助函数 ====================

/**
 * 检测六仪击刑
 */
export function checkLiuYiJiXing(tianPanGan: QiYi, gong: JiuGong): LiuYiJiXing | undefined {
  const rule = LIU_YI_JI_XING_RULES.find(r => r.gan === tianPanGan && r.gong === gong);
  return rule ? { gan: tianPanGan, gong } : undefined;
}

/**
 * 检测奇仪入墓
 */
export function checkQiYiRuMu(tianPanGan: QiYi, gong: JiuGong): QiYiRuMu | undefined {
  const rule = QI_YI_RU_MU_RULES.find(r => r.gan === tianPanGan && r.gong === gong);
  return rule ? { gan: tianPanGan, gong, muName: rule.muName } : undefined;
}

/**
 * 检测门迫
 */
export function checkMenPo(men: BaMen, gong: JiuGong): MenPo | undefined {
  const rule = MEN_PO_RULES.find(r => r.men === men && r.gong === gong);
  return rule ? { men, gong } : undefined;
}

/**
 * 检测十干克应
 */
export function checkShiGanKeYing(tianGan: QiYi, diGan: QiYi): ShiGanKeYing {
  let geJu: ShiGanGeJuType = ShiGanGeJuType.Other;
  let isJi = true;

  // 吉格
  if (tianGan === QiYi.Yi && diGan === QiYi.Yi) { geJu = ShiGanGeJuType.RiQiFuYin; }
  else if (tianGan === QiYi.Yi && diGan === QiYi.Bing) { geJu = ShiGanGeJuType.QiYiShunSui; }
  else if (tianGan === QiYi.Yi && diGan === QiYi.Ding) { geJu = ShiGanGeJuType.QiYiXiangZuo; }
  else if (tianGan === QiYi.Bing && diGan === QiYi.Yi) { geJu = ShiGanGeJuType.RiYueBingXing; }
  else if (tianGan === QiYi.Bing && diGan === QiYi.Bing) { geJu = ShiGanGeJuType.YueQiBeiShi; }
  else if (tianGan === QiYi.Bing && diGan === QiYi.Ding) { geJu = ShiGanGeJuType.XingQiZhuQue; }
  else if (tianGan === QiYi.Ding && diGan === QiYi.Yi) { geJu = ShiGanGeJuType.XingQiRuTaiYin; }
  else if (tianGan === QiYi.Ding && diGan === QiYi.Bing) { geJu = ShiGanGeJuType.XingQiRuLiuHe; }
  else if (tianGan === QiYi.Ding && diGan === QiYi.Ding) { geJu = ShiGanGeJuType.XingQiFuYin; }
  else if (tianGan === QiYi.Bing && diGan === QiYi.Wu) { geJu = ShiGanGeJuType.FeiNiaoDieXue; }
  // 凶格
  else if (tianGan === QiYi.Geng && diGan === QiYi.Geng) { geJu = ShiGanGeJuType.TaiBaiTongGong; isJi = false; }
  else if (tianGan === QiYi.Geng && diGan === QiYi.Yi) { geJu = ShiGanGeJuType.TaiBaiRuRi; isJi = false; }
  else if (tianGan === QiYi.Geng && diGan === QiYi.Bing) { geJu = ShiGanGeJuType.TaiBaiRuYing; isJi = false; }
  else if (tianGan === QiYi.Geng && diGan === QiYi.Ding) { geJu = ShiGanGeJuType.TaiBaiRuXing; isJi = false; }
  else if (tianGan === QiYi.Gui && diGan === QiYi.Gui) { geJu = ShiGanGeJuType.HuaGaiFuYin; isJi = false; }
  else if (tianGan === QiYi.Xin && diGan === QiYi.Yi) { geJu = ShiGanGeJuType.BaiHuChangKuang; isJi = false; }
  else if (tianGan === QiYi.Xin && diGan === QiYi.Bing) { geJu = ShiGanGeJuType.BaiHuRuYing; isJi = false; }
  else if (tianGan === QiYi.Xin && diGan === QiYi.Ding) { geJu = ShiGanGeJuType.BaiHuRuXing; isJi = false; }
  else if (tianGan === QiYi.Ren && diGan === QiYi.Ren) { geJu = ShiGanGeJuType.SheYaoJiao; isJi = false; }
  // 中平格
  else if (tianGan === QiYi.Wu && diGan === QiYi.Wu) { geJu = ShiGanGeJuType.FuYin; }
  else if (tianGan === QiYi.Ji && diGan === QiYi.Ji) { geJu = ShiGanGeJuType.FuYin; }

  return { tianGan, diGan, geJu, isJi };
}

/**
 * 根据时辰获取驿马宫位
 */
export function getYiMaGong(hourIndex: number): YiMa | undefined {
  // 时辰对应的地支
  const diZhiNames = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const shiZhi = diZhiNames[hourIndex % 12];

  const rule = YI_MA_RULES.find(r => r.shiZhi.includes(shiZhi));
  return rule ? { gong: rule.gong, zhiName: rule.zhiName } : undefined;
}

/**
 * 综合分析单宫格局
 */
export function analyzePalace(
  gongWei: GongWei,
  hourIndex: number,
): PalaceAnalysis {
  const analysis: PalaceAnalysis = {
    isYiMa: false,
  };

  // 检测六仪击刑
  analysis.jiXing = checkLiuYiJiXing(gongWei.tianPanGan, gongWei.gong);

  // 检测奇仪入墓
  analysis.ruMu = checkQiYiRuMu(gongWei.tianPanGan, gongWei.gong);

  // 检测门迫
  analysis.menPo = checkMenPo(gongWei.men, gongWei.gong);

  // 检测十干克应
  analysis.keYing = checkShiGanKeYing(gongWei.tianPanGan, gongWei.diPanGan);

  // 检测驿马
  const yiMa = getYiMaGong(hourIndex);
  if (yiMa && yiMa.gong === gongWei.gong) {
    analysis.isYiMa = true;
  }

  return analysis;
}
