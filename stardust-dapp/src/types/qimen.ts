/**
 * 奇门遁甲类型定义
 *
 * 奇门遁甲是中国古代用于预测和决策的术数，由天盘、地盘、人盘、神盘
 * 四层构成，通过分析各盘之间的关系来推断吉凶。
 *
 * 本模块包含：
 * - 基础枚举（九宫、天干、八门、九星、八神等）
 * - 排盘方法（转盘/飞盘）
 * - 排盘类型（时家/日家/月家/年家）
 * - 问事类型（12种）
 * - 格局类型（九遁、凶格等）
 * - 用神系统
 * - 解读文案
 */

// ==================== 排盘方法与类型 ====================

/**
 * 排盘方法（转盘/飞盘）
 *
 * 奇门遁甲有两种主要的排盘方法：
 * - 转盘奇门：九星、八门、八神作为整体旋转，是目前最常用的方法
 * - 飞盘奇门：九星、八门、八神按洛书九宫飞布顺序分别飞入各宫
 */
export enum PanMethod {
  /** 转盘奇门（默认） */
  ZhuanPan = 0,
  /** 飞盘奇门 */
  FeiPan = 1,
}

/**
 * 排盘方法名称
 */
export const PAN_METHOD_NAMES: Record<PanMethod, string> = {
  [PanMethod.ZhuanPan]: '转盘奇门',
  [PanMethod.FeiPan]: '飞盘奇门',
};

/**
 * 排盘方法描述
 */
export const PAN_METHOD_DESC: Record<PanMethod, string> = {
  [PanMethod.ZhuanPan]: '九星、八门、八神作为整体旋转，是目前最常用的排盘方法',
  [PanMethod.FeiPan]: '九星、八门、八神按洛书九宫数序分别飞入各宫，古法排盘方式',
};

/**
 * 排盘类型（时家/日家/月家/年家）
 *
 * 奇门遁甲有多种排盘类型，根据不同的时间单位起局
 */
export enum QimenType {
  /** 时家奇门：以时辰为单位，最常用 */
  ShiJia = 0,
  /** 日家奇门：以日为单位 */
  RiJia = 1,
  /** 月家奇门：以月为单位 */
  YueJia = 2,
  /** 年家奇门：以年为单位 */
  NianJia = 3,
}

/**
 * 排盘类型名称
 */
export const QIMEN_TYPE_NAMES: Record<QimenType, string> = {
  [QimenType.ShiJia]: '时家奇门',
  [QimenType.RiJia]: '日家奇门',
  [QimenType.YueJia]: '月家奇门',
  [QimenType.NianJia]: '年家奇门',
};

/**
 * 排盘类型描述
 */
export const QIMEN_TYPE_DESC: Record<QimenType, string> = {
  [QimenType.ShiJia]: '以时辰为单位起局，每两小时一局，最常用的排盘方式',
  [QimenType.RiJia]: '以日为单位起局，每日一局，适合日课择吉',
  [QimenType.YueJia]: '以月为单位起局，每月一局，适合月度规划',
  [QimenType.NianJia]: '以年为单位起局，每年一局，适合年度大运分析',
};

/**
 * 问事类型（占断事项分类）
 *
 * 奇门遁甲中根据不同的问事类型，有不同的用神和取象规则
 */
export enum QuestionType {
  /** 综合运势（默认） */
  General = 0,
  /** 事业工作 */
  Career = 1,
  /** 财运求财 */
  Wealth = 2,
  /** 婚姻感情 */
  Marriage = 3,
  /** 健康疾病 */
  Health = 4,
  /** 学业考试 */
  Study = 5,
  /** 出行远行 */
  Travel = 6,
  /** 官司诉讼 */
  Lawsuit = 7,
  /** 寻人寻物 */
  Finding = 8,
  /** 投资理财 */
  Investment = 9,
  /** 合作交易 */
  Business = 10,
  /** 祈福求神 */
  Prayer = 11,
}

/**
 * 问事类型名称
 */
export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
  [QuestionType.General]: '综合运势',
  [QuestionType.Career]: '事业工作',
  [QuestionType.Wealth]: '财运求财',
  [QuestionType.Marriage]: '婚姻感情',
  [QuestionType.Health]: '健康疾病',
  [QuestionType.Study]: '学业考试',
  [QuestionType.Travel]: '出行远行',
  [QuestionType.Lawsuit]: '官司诉讼',
  [QuestionType.Finding]: '寻人寻物',
  [QuestionType.Investment]: '投资理财',
  [QuestionType.Business]: '合作交易',
  [QuestionType.Prayer]: '祈福求神',
};

/**
 * 问事类型描述
 */
export const QUESTION_TYPE_DESC: Record<QuestionType, string> = {
  [QuestionType.General]: '整体运势分析，综合各方面情况',
  [QuestionType.Career]: '工作事业、升迁、求职、创业等',
  [QuestionType.Wealth]: '财运、求财、偏财、正财等',
  [QuestionType.Marriage]: '婚姻、恋爱、感情、桃花等',
  [QuestionType.Health]: '疾病、健康、医疗、康复等',
  [QuestionType.Study]: '考试、学业、资格证、进修等',
  [QuestionType.Travel]: '出行、旅游、搬迁、远行等',
  [QuestionType.Lawsuit]: '官司、诉讼、纠纷、仲裁等',
  [QuestionType.Finding]: '寻人、寻物、失物、走失等',
  [QuestionType.Investment]: '投资、理财、股票、基金等',
  [QuestionType.Business]: '合作、交易、谈判、签约等',
  [QuestionType.Prayer]: '祈福、求神、祭祀、许愿等',
};

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

// ==================== 解卦相关类型 ====================

/**
 * 格局类型
 *
 * 奇门遁甲的格局分类，包括正格、伏吟、反吟、三遁、特殊遁和特殊吉凶格局
 */
export enum GeJuType {
  /** 正格 - 常规格局 */
  ZhengGe = 'ZhengGe',
  /** 伏吟格 - 天盘地盘相同，主迟滞反复 */
  FuYinGe = 'FuYinGe',
  /** 反吟格 - 天盘地盘对冲，主变动不稳 */
  FanYinGe = 'FanYinGe',
  /** 天遁格 - 丙奇+天心星+开门，大吉之格 */
  TianDunGe = 'TianDunGe',
  /** 地遁格 - 乙奇+六合+开门，利于求财合作 */
  DiDunGe = 'DiDunGe',
  /** 人遁格 - 丁奇+太阴+开门，利于隐秘谋略 */
  RenDunGe = 'RenDunGe',
  /** 鬼遁格 - 丁奇+天心星+开门，利于玄学医疗 */
  GuiDunGe = 'GuiDunGe',
  /** 神遁格 - 九天+值符+开门，利于高远创新 */
  ShenDunGe = 'ShenDunGe',
  /** 龙遁格 - 九地+值符+开门，利于稳固长久 */
  LongDunGe = 'LongDunGe',
  /** 青龙返首 - 特殊吉格，主贵人相助 */
  QingLongFanShou = 'QingLongFanShou',
  /** 飞鸟跌穴 - 特殊凶格，主失败挫折 */
  FeiNiaoDieXue = 'FeiNiaoDieXue',
}

/**
 * 格局类型名称
 */
export const GE_JU_TYPE_NAMES: Record<GeJuType, string> = {
  [GeJuType.ZhengGe]: '正格',
  [GeJuType.FuYinGe]: '伏吟格',
  [GeJuType.FanYinGe]: '反吟格',
  [GeJuType.TianDunGe]: '天遁格',
  [GeJuType.DiDunGe]: '地遁格',
  [GeJuType.RenDunGe]: '人遁格',
  [GeJuType.GuiDunGe]: '鬼遁格',
  [GeJuType.ShenDunGe]: '神遁格',
  [GeJuType.LongDunGe]: '龙遁格',
  [GeJuType.QingLongFanShou]: '青龙返首',
  [GeJuType.FeiNiaoDieXue]: '飞鸟跌穴',
};

/**
 * 吉凶等级
 */
export enum Fortune {
  /** 大吉 */
  DaJi = 'DaJi',
  /** 中吉 */
  ZhongJi = 'ZhongJi',
  /** 小吉 */
  XiaoJi = 'XiaoJi',
  /** 平 */
  Ping = 'Ping',
  /** 小凶 */
  XiaoXiong = 'XiaoXiong',
  /** 中凶 */
  ZhongXiong = 'ZhongXiong',
  /** 大凶 */
  DaXiong = 'DaXiong',
}

/**
 * 吉凶等级名称
 */
export const FORTUNE_NAMES: Record<Fortune, string> = {
  [Fortune.DaJi]: '大吉',
  [Fortune.ZhongJi]: '中吉',
  [Fortune.XiaoJi]: '小吉',
  [Fortune.Ping]: '平',
  [Fortune.XiaoXiong]: '小凶',
  [Fortune.ZhongXiong]: '中凶',
  [Fortune.DaXiong]: '大凶',
};

/**
 * 吉凶等级颜色
 */
export const FORTUNE_COLORS: Record<Fortune, string> = {
  [Fortune.DaJi]: '#52c41a',       // 绿色
  [Fortune.ZhongJi]: '#73d13d',    // 浅绿
  [Fortune.XiaoJi]: '#95de64',     // 更浅绿
  [Fortune.Ping]: '#d9d9d9',       // 灰色
  [Fortune.XiaoXiong]: '#ff7875',  // 浅红
  [Fortune.ZhongXiong]: '#ff4d4f', // 红色
  [Fortune.DaXiong]: '#f5222d',    // 深红
};

/**
 * 旺衰状态（解卦用）
 *
 * 注意：这里重新定义是为了与后端 Rust 枚举保持一致
 */
export enum WangShuaiStatus {
  /** 旺相 - 当令或生我 */
  WangXiang = 'WangXiang',
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
 * 旺衰状态名称（解卦用）
 */
export const WANG_SHUAI_STATUS_NAMES: Record<WangShuaiStatus, string> = {
  [WangShuaiStatus.WangXiang]: '旺相',
  [WangShuaiStatus.Xiang]: '相',
  [WangShuaiStatus.Xiu]: '休',
  [WangShuaiStatus.Qiu]: '囚',
  [WangShuaiStatus.Si]: '死',
};

/**
 * 星门关系
 */
export enum XingMenRelation {
  /** 星生门 */
  XingShengMen = 'XingShengMen',
  /** 门生星 */
  MenShengXing = 'MenShengXing',
  /** 星克门 */
  XingKeMen = 'XingKeMen',
  /** 门克星 */
  MenKeXing = 'MenKeXing',
  /** 比和 */
  BiHe = 'BiHe',
}

/**
 * 星门关系名称
 */
export const XING_MEN_RELATION_NAMES: Record<XingMenRelation, string> = {
  [XingMenRelation.XingShengMen]: '星生门',
  [XingMenRelation.MenShengXing]: '门生星',
  [XingMenRelation.XingKeMen]: '星克门',
  [XingMenRelation.MenKeXing]: '门克星',
  [XingMenRelation.BiHe]: '比和',
};

/**
 * 用神类型
 */
export enum YongShenType {
  /** 日干 */
  RiGan = 'RiGan',
  /** 时干 */
  ShiGan = 'ShiGan',
  /** 值符 */
  ZhiFu = 'ZhiFu',
  /** 值使 */
  ZhiShi = 'ZhiShi',
  /** 年命 */
  NianMing = 'NianMing',
  /** 特定星 */
  SpecificXing = 'SpecificXing',
  /** 特定门 */
  SpecificMen = 'SpecificMen',
  /** 特定宫 */
  SpecificGong = 'SpecificGong',
}

/**
 * 用神类型名称
 */
export const YONG_SHEN_TYPE_NAMES: Record<YongShenType, string> = {
  [YongShenType.RiGan]: '日干',
  [YongShenType.ShiGan]: '时干',
  [YongShenType.ZhiFu]: '值符',
  [YongShenType.ZhiShi]: '值使',
  [YongShenType.NianMing]: '年命',
  [YongShenType.SpecificXing]: '特定星',
  [YongShenType.SpecificMen]: '特定门',
  [YongShenType.SpecificGong]: '特定宫',
};

/**
 * 得力状态
 */
export enum DeLiStatus {
  /** 大得力 */
  DaDeLi = 'DaDeLi',
  /** 得力 */
  DeLi = 'DeLi',
  /** 平 */
  Ping = 'Ping',
  /** 失力 */
  ShiLi = 'ShiLi',
  /** 大失力 */
  DaShiLi = 'DaShiLi',
}

/**
 * 得力状态名称
 */
export const DE_LI_STATUS_NAMES: Record<DeLiStatus, string> = {
  [DeLiStatus.DaDeLi]: '大得力',
  [DeLiStatus.DeLi]: '得力',
  [DeLiStatus.Ping]: '平',
  [DeLiStatus.ShiLi]: '失力',
  [DeLiStatus.DaShiLi]: '大失力',
};

/**
 * 应期单位
 */
export enum YingQiUnit {
  /** 时辰 */
  Hour = 'Hour',
  /** 日 */
  Day = 'Day',
  /** 旬 */
  Xun = 'Xun',
  /** 月 */
  Month = 'Month',
  /** 季 */
  Season = 'Season',
  /** 年 */
  Year = 'Year',
}

/**
 * 应期单位名称
 */
export const YING_QI_UNIT_NAMES: Record<YingQiUnit, string> = {
  [YingQiUnit.Hour]: '时辰',
  [YingQiUnit.Day]: '日',
  [YingQiUnit.Xun]: '旬',
  [YingQiUnit.Month]: '月',
  [YingQiUnit.Season]: '季',
  [YingQiUnit.Year]: '年',
};

/**
 * 奇门遁甲核心解卦结果
 *
 * 存储最关键的解卦指标，约 16 bytes
 */
export interface QimenCoreInterpretation {
  /** 格局类型 */
  geJu: GeJuType;
  /** 用神宫位 (1-9) */
  yongShenGong: number;
  /** 值符星 */
  zhiFuXing: JiuXing;
  /** 值使门 */
  zhiShiMen: BaMen;
  /** 日干落宫 (1-9) */
  riGanGong: number;
  /** 时干落宫 (1-9) */
  shiGanGong: number;
  /** 综合吉凶 */
  fortune: Fortune;
  /** 吉凶评分 (0-100) */
  fortuneScore: number;
  /** 旺衰状态 */
  wangShuai: WangShuaiStatus;
  /** 特殊格局标记（位标志） */
  specialPatterns: number;
  /** 可信度 (0-100) */
  confidence: number;
  /** 解盘时间戳（区块号） */
  timestamp: number;
  /** 算法版本 */
  algorithmVersion: number;
}

/**
 * 单宫详细解读
 */
export interface PalaceInterpretation {
  /** 宫位 */
  gong: JiuGong;
  /** 天盘干 */
  tianPanGan: QiYi;
  /** 地盘干 */
  diPanGan: QiYi;
  /** 九星 */
  xing: JiuXing;
  /** 八门 */
  men: BaMen | null;
  /** 八神 */
  shen: BaShen | null;
  /** 宫位五行 */
  gongWuxing: WuXing;
  /** 天盘五行 */
  tianWuxing: WuXing;
  /** 地盘五行 */
  diWuxing: WuXing;
  /** 星门关系 */
  xingMenRelation: XingMenRelation;
  /** 宫位旺衰 */
  wangShuai: WangShuaiStatus;
  /** 是否伏吟 */
  isFuYin: boolean;
  /** 是否反吟 */
  isFanYin: boolean;
  /** 是否旬空 */
  isXunKong: boolean;
  /** 是否马星 */
  isMaXing: boolean;
  /** 宫位吉凶 */
  fortune: Fortune;
  /** 吉凶评分 (0-100) */
  fortuneScore: number;
}

/**
 * 用神分析结果
 */
export interface YongShenAnalysis {
  /** 问事类型 */
  questionType: QuestionType;
  /** 主用神宫位 */
  primaryGong: JiuGong;
  /** 主用神类型 */
  primaryType: YongShenType;
  /** 次用神宫位 */
  secondaryGong: JiuGong | null;
  /** 次用神类型 */
  secondaryType: YongShenType | null;
  /** 用神旺衰 */
  wangShuai: WangShuaiStatus;
  /** 用神得力情况 */
  deLi: DeLiStatus;
  /** 用神吉凶 */
  fortune: Fortune;
  /** 用神评分 (0-100) */
  score: number;
}

/**
 * 应期推算结果
 */
export interface YingQiAnalysis {
  /** 主应期数（基于用神宫位） */
  primaryNum: number;
  /** 次应期数（基于值符值使） */
  secondaryNums: [number, number];
  /** 应期单位 */
  unit: YingQiUnit;
  /** 应期范围描述 */
  rangeDesc: string;
  /** 吉利时间 */
  auspiciousTimes: Uint8Array;
  /** 不利时间 */
  inauspiciousTimes: Uint8Array;
}

/**
 * 格局详解
 */
export interface GeJuDetail {
  /** 格局类型 */
  geJu: GeJuType;
  /** 格局名称 */
  name: string;
  /** 格局描述 */
  description: string;
  /** 格局吉凶 */
  fortune: Fortune;
  /** 适用场景 */
  applicableScenarios: QuestionType[];
  /** 注意事项 */
  notes: string;
}

/**
 * 奇门遁甲完整解读结果
 */
export interface QimenFullInterpretation {
  /** 核心指标（必有） */
  core: QimenCoreInterpretation;
  /** 九宫详细解读（可选） */
  palaces?: PalaceInterpretation[];
  /** 用神分析（可选） */
  yongShen?: YongShenAnalysis;
  /** 应期推算（可选） */
  yingQi?: YingQiAnalysis;
  /** 格局详解（可选） */
  geJuDetail?: GeJuDetail;
}
