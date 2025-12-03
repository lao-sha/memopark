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
