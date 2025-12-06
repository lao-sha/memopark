/**
 * 六爻占卜类型定义
 *
 * 六爻预测是周易预测学的核心方法之一，通过摇铜钱或其他方式起卦，
 * 根据六爻的阴阳变化来推断吉凶祸福。
 */

// ==================== 基础枚举 ====================

/**
 * 爻的阴阳类型
 */
export enum YaoType {
  /** 阳爻 —— (不变) */
  Yang = 0,
  /** 阴爻 -- (不变) */
  Yin = 1,
  /** 老阳爻 —○— (变阴) */
  OldYang = 2,
  /** 老阴爻 --×-- (变阳) */
  OldYin = 3,
}

/**
 * 六亲关系
 */
export enum LiuQin {
  /** 兄弟 */
  XiongDi = 0,
  /** 父母 */
  FuMu = 1,
  /** 官鬼 */
  GuanGui = 2,
  /** 妻财 */
  QiCai = 3,
  /** 子孙 */
  ZiSun = 4,
}

/**
 * 六神
 */
export enum LiuShen {
  /** 青龙 */
  QingLong = 0,
  /** 朱雀 */
  ZhuQue = 1,
  /** 勾陈 */
  GouChen = 2,
  /** 螣蛇 */
  TengShe = 3,
  /** 白虎 */
  BaiHu = 4,
  /** 玄武 */
  XuanWu = 5,
}

/**
 * 世应位置
 */
export enum ShiYing {
  /** 世爻 */
  Shi = 0,
  /** 应爻 */
  Ying = 1,
}

/**
 * 五行
 */
export enum WuXing {
  Mu = 0,   // 木
  Huo = 1,  // 火
  Tu = 2,   // 土
  Jin = 3,  // 金
  Shui = 4, // 水
}

/**
 * 地支
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

/**
 * 天干
 */
export enum TianGan {
  Jia = 0,  // 甲
  Yi = 1,   // 乙
  Bing = 2, // 丙
  Ding = 3, // 丁
  Wu = 4,   // 戊
  Ji = 5,   // 己
  Geng = 6, // 庚
  Xin = 7,  // 辛
  Ren = 8,  // 壬
  Gui = 9,  // 癸
}

/**
 * 神煞类型（14种）
 */
export enum ShenSha {
  /** 天乙贵人 - 最大吉神 */
  TianYiGuiRen = 0,
  /** 驿马 - 主奔波变动 */
  YiMa = 1,
  /** 桃花 - 主感情人缘 */
  TaoHua = 2,
  /** 禄神 - 主财禄俸禄 */
  LuShen = 3,
  /** 文昌 - 主文才学业 */
  WenChang = 4,
  /** 劫煞 - 凶煞 */
  JieSha = 5,
  /** 华盖 - 主孤独艺术 */
  HuaGai = 6,
  /** 将星 - 主权威领导 */
  JiangXing = 7,
  /** 亡神 - 主破败损失 */
  WangShen = 8,
  /** 天喜 - 主喜庆婚姻 */
  TianXi = 9,
  /** 天医 - 主医药治疗 */
  TianYi = 10,
  /** 阳刃 - 主刚烈凶险 */
  YangRen = 11,
  /** 灾煞 - 主灾难血光 */
  ZaiSha = 12,
  /** 谋星 - 主谋划策略 */
  MouXing = 13,
}

/**
 * 旺衰状态
 */
export enum WangShuai {
  /** 旺 - 当令最强 */
  Wang = 0,
  /** 相 - 得令生次强 */
  Xiang = 1,
  /** 休 - 休息力弱 */
  Xiu = 2,
  /** 囚 - 被克较弱 */
  Qiu = 3,
  /** 死 - 克令最弱 */
  Si = 4,
}

/**
 * 日辰关系
 */
export enum RiChenGuanXi {
  /** 无特殊关系 */
  None = 0,
  /** 日辰冲爻 */
  RiChong = 1,
  /** 日辰合爻 */
  RiHe = 2,
  /** 日辰生爻 */
  RiSheng = 3,
  /** 日辰克爻 */
  RiKe = 4,
  /** 爻泄气 */
  XieQi = 5,
  /** 爻耗气 */
  HaoQi = 6,
}

/**
 * 动爻作用类型
 */
export enum DongYaoZuoYong {
  /** 动生静 */
  DongShengJing = 0,
  /** 动克静 */
  DongKeJing = 1,
  /** 动泄静 */
  DongXieJing = 2,
  /** 动耗静 */
  DongHaoJing = 3,
  /** 比和 */
  BiHe = 4,
  /** 无作用 */
  None = 5,
}

/**
 * 回头生克类型
 */
export enum HuiTouZuoYong {
  /** 回头生 */
  HuiTouSheng = 0,
  /** 回头克 */
  HuiTouKe = 1,
  /** 回头泄 */
  HuiTouXie = 2,
  /** 回头耗 */
  HuiTouHao = 3,
  /** 比和 */
  BiHe = 4,
}

// ==================== 数据结构 ====================

/**
 * 单爻信息
 */
export interface YaoInfo {
  /** 爻位 (1-6，从下到上) */
  position: number;
  /** 爻类型 */
  type: YaoType;
  /** 地支 */
  diZhi: DiZhi;
  /** 天干 */
  tianGan?: TianGan;
  /** 五行 */
  wuXing: WuXing;
  /** 六亲 */
  liuQin: LiuQin;
  /** 六神 */
  liuShen: LiuShen;
  /** 是否世爻 */
  isShi: boolean;
  /** 是否应爻 */
  isYing: boolean;
  /** 是否动爻 */
  isDong: boolean;
  /** 变爻地支（如果是动爻） */
  bianDiZhi?: DiZhi;
  /** 变爻五行 */
  bianWuXing?: WuXing;
  /** 变爻六亲 */
  bianLiuQin?: LiuQin;
  /** 旺衰状态 */
  wangShuai?: WangShuai;
  /** 日辰关系 */
  riChenGuanXi?: RiChenGuanXi;
  /** 神煞列表 */
  shenShaList?: ShenSha[];
  /** 回头生克（动爻时有效） */
  huiTouZuoYong?: HuiTouZuoYong;
  /** 是否旬空 */
  isXunKong?: boolean;
}

/**
 * 铜钱摇卦结果
 */
export interface CoinResult {
  /** 第几爻 (1-6) */
  yaoIndex: number;
  /** 三枚铜钱结果 (true=字/阳, false=背/阴) */
  coins: [boolean, boolean, boolean];
  /** 计算得到的爻类型 */
  yaoType: YaoType;
}

/**
 * 六爻卦象
 */
export interface LiuyaoGua {
  /** 卦象ID */
  id: number;
  /** 创建者地址 */
  creator: string;
  /** 本卦序号 (0-63) */
  benGuaIndex: number;
  /** 本卦名称 */
  benGuaName: string;
  /** 变卦序号（如有动爻） */
  bianGuaIndex?: number;
  /** 变卦名称 */
  bianGuaName?: string;
  /** 互卦序号 */
  huGuaIndex?: number;
  /** 互卦名称 */
  huGuaName?: string;
  /** 六爻详情 */
  yaos: YaoInfo[];
  /** 铜钱摇卦记录 */
  coinResults?: CoinResult[];
  /** 日干 */
  riGan: TianGan;
  /** 日辰（占卜日的地支） */
  riChen: DiZhi;
  /** 月建（占卜月的地支） */
  yueJian: DiZhi;
  /** 卦宫五行 */
  gongWuXing?: WuXing;
  /** 卦身地支 */
  guaShen?: DiZhi;
  /** 旬空地支 */
  xunKong?: [DiZhi, DiZhi];
  /** 是否六冲卦 */
  isLiuChong?: boolean;
  /** 是否六合卦 */
  isLiuHe?: boolean;
  /** 是否反吟（本变卦六冲） */
  isFanYin?: boolean;
  /** 是否伏吟（本变卦相同） */
  isFuYin?: boolean;
  /** 神煞信息 */
  shenShaInfo?: ShenShaInfo;
  /** 问题（加密存储） */
  questionHash?: string;
  /** 占卜时间戳 */
  divinationTime: number;
  /** 创建区块号 */
  createdAt: number;
  /** 是否公开 */
  isPublic: boolean;
}

/**
 * 神煞信息结构
 */
export interface ShenShaInfo {
  /** 天乙贵人（两个地支） */
  tianYiGuiRen: [DiZhi, DiZhi];
  /** 驿马 */
  yiMa: DiZhi;
  /** 桃花 */
  taoHua: DiZhi;
  /** 禄神 */
  luShen: DiZhi;
  /** 文昌 */
  wenChang: DiZhi;
  /** 劫煞 */
  jieSha: DiZhi;
  /** 华盖 */
  huaGai: DiZhi;
  /** 将星 */
  jiangXing: DiZhi;
  /** 亡神 */
  wangShen: DiZhi;
  /** 天喜 */
  tianXi: DiZhi;
  /** 天医 */
  tianYi: DiZhi;
  /** 阳刃 */
  yangRen: DiZhi;
  /** 灾煞 */
  zaiSha: DiZhi;
  /** 谋星 */
  mouXing: DiZhi;
}

/**
 * 六爻排盘输入
 */
export interface LiuyaoInput {
  /** 六爻类型（从下到上） */
  yaos: YaoType[];
  /** 占卜问题 */
  question?: string;
  /** 是否公开 */
  isPublic?: boolean;
}

/**
 * 六爻占卜结果
 */
export interface LiuyaoResult {
  /** 基本卦象 */
  gua: LiuyaoGua;
  /** 卦辞 */
  guaCi?: string;
  /** 爻辞（动爻） */
  yaoCi?: string;
  /** 简易断语 */
  briefAnalysis?: string;
}

// ==================== 常量定义 ====================

/**
 * 爻类型名称
 */
export const YAO_TYPE_NAMES: Record<YaoType, string> = {
  [YaoType.Yang]: '少阳',
  [YaoType.Yin]: '少阴',
  [YaoType.OldYang]: '老阳',
  [YaoType.OldYin]: '老阴',
};

/**
 * 爻符号
 */
export const YAO_SYMBOLS: Record<YaoType, string> = {
  [YaoType.Yang]: '———',
  [YaoType.Yin]: '— —',
  [YaoType.OldYang]: '—○—',
  [YaoType.OldYin]: '—×—',
};

/**
 * 六亲名称
 */
export const LIU_QIN_NAMES: Record<LiuQin, string> = {
  [LiuQin.FuMu]: '父母',
  [LiuQin.XiongDi]: '兄弟',
  [LiuQin.ZiSun]: '子孙',
  [LiuQin.QiCai]: '妻财',
  [LiuQin.GuanGui]: '官鬼',
};

/**
 * 六亲简称
 */
export const LIU_QIN_SHORT: Record<LiuQin, string> = {
  [LiuQin.FuMu]: '父',
  [LiuQin.XiongDi]: '兄',
  [LiuQin.ZiSun]: '子',
  [LiuQin.QiCai]: '财',
  [LiuQin.GuanGui]: '官',
};

/**
 * 六神名称
 */
export const LIU_SHEN_NAMES: Record<LiuShen, string> = {
  [LiuShen.QingLong]: '青龙',
  [LiuShen.ZhuQue]: '朱雀',
  [LiuShen.GouChen]: '勾陈',
  [LiuShen.TengShe]: '螣蛇',
  [LiuShen.BaiHu]: '白虎',
  [LiuShen.XuanWu]: '玄武',
};

/**
 * 六神简称
 */
export const LIU_SHEN_SHORT: Record<LiuShen, string> = {
  [LiuShen.QingLong]: '龙',
  [LiuShen.ZhuQue]: '雀',
  [LiuShen.GouChen]: '陈',
  [LiuShen.TengShe]: '蛇',
  [LiuShen.BaiHu]: '虎',
  [LiuShen.XuanWu]: '武',
};

/**
 * 五行名称
 */
export const WU_XING_NAMES: Record<WuXing, string> = {
  [WuXing.Mu]: '木',
  [WuXing.Huo]: '火',
  [WuXing.Tu]: '土',
  [WuXing.Jin]: '金',
  [WuXing.Shui]: '水',
};

/**
 * 五行颜色
 */
export const WU_XING_COLORS: Record<WuXing, string> = {
  [WuXing.Mu]: '#52c41a',
  [WuXing.Huo]: '#f5222d',
  [WuXing.Tu]: '#d4b106',
  [WuXing.Jin]: '#faad14',
  [WuXing.Shui]: '#1890ff',
};

/**
 * 地支名称
 */
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

/**
 * 地支五行对应
 */
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

/**
 * 六十四卦名称
 */
export const GUA_NAMES: string[] = [
  '乾为天', '坤为地', '水雷屯', '山水蒙', '水天需', '天水讼', '地水师', '水地比',
  '风天小畜', '天泽履', '地天泰', '天地否', '天火同人', '火天大有', '地山谦', '雷地豫',
  '泽雷随', '山风蛊', '地泽临', '风地观', '火雷噬嗑', '山火贲', '山地剥', '地雷复',
  '天雷无妄', '山天大畜', '山雷颐', '泽风大过', '坎为水', '离为火', '泽山咸', '雷风恒',
  '天山遁', '雷天大壮', '火地晋', '地火明夷', '风火家人', '火泽睽', '水山蹇', '雷水解',
  '山泽损', '风雷益', '泽天夬', '天风姤', '泽地萃', '地风升', '泽水困', '水风井',
  '泽火革', '火风鼎', '震为雷', '艮为山', '风山渐', '雷泽归妹', '雷火丰', '火山旅',
  '巽为风', '兑为泽', '风水涣', '水泽节', '风泽中孚', '雷山小过', '水火既济', '火水未济',
];

/**
 * 八卦名称（用于组合）
 */
export const BA_GUA_NAMES: string[] = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

/**
 * 天干名称
 */
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
 * 神煞名称
 */
export const SHEN_SHA_NAMES: Record<ShenSha, string> = {
  [ShenSha.TianYiGuiRen]: '天乙贵人',
  [ShenSha.YiMa]: '驿马',
  [ShenSha.TaoHua]: '桃花',
  [ShenSha.LuShen]: '禄神',
  [ShenSha.WenChang]: '文昌',
  [ShenSha.JieSha]: '劫煞',
  [ShenSha.HuaGai]: '华盖',
  [ShenSha.JiangXing]: '将星',
  [ShenSha.WangShen]: '亡神',
  [ShenSha.TianXi]: '天喜',
  [ShenSha.TianYi]: '天医',
  [ShenSha.YangRen]: '阳刃',
  [ShenSha.ZaiSha]: '灾煞',
  [ShenSha.MouXing]: '谋星',
};

/**
 * 神煞简短描述
 */
export const SHEN_SHA_DESC: Record<ShenSha, string> = {
  [ShenSha.TianYiGuiRen]: '贵人相助',
  [ShenSha.YiMa]: '奔波变动',
  [ShenSha.TaoHua]: '感情人缘',
  [ShenSha.LuShen]: '财禄俸禄',
  [ShenSha.WenChang]: '文才学业',
  [ShenSha.JieSha]: '灾祸劫难',
  [ShenSha.HuaGai]: '孤独艺术',
  [ShenSha.JiangXing]: '权威领导',
  [ShenSha.WangShen]: '破败损失',
  [ShenSha.TianXi]: '喜庆婚姻',
  [ShenSha.TianYi]: '医药治疗',
  [ShenSha.YangRen]: '刚烈凶险',
  [ShenSha.ZaiSha]: '灾难血光',
  [ShenSha.MouXing]: '谋划策略',
};

/**
 * 判断神煞是否为吉神
 */
export function isShenShaAuspicious(shenSha: ShenSha): boolean {
  return [
    ShenSha.TianYiGuiRen,
    ShenSha.LuShen,
    ShenSha.WenChang,
    ShenSha.JiangXing,
    ShenSha.TianXi,
    ShenSha.TianYi,
  ].includes(shenSha);
}

/**
 * 判断神煞是否为凶煞
 */
export function isShenShaInauspicious(shenSha: ShenSha): boolean {
  return [
    ShenSha.JieSha,
    ShenSha.WangShen,
    ShenSha.YangRen,
    ShenSha.ZaiSha,
  ].includes(shenSha);
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
 * 旺衰描述
 */
export const WANG_SHUAI_DESC: Record<WangShuai, string> = {
  [WangShuai.Wang]: '当令最强',
  [WangShuai.Xiang]: '得令生次强',
  [WangShuai.Xiu]: '休息力弱',
  [WangShuai.Qiu]: '被克较弱',
  [WangShuai.Si]: '克令最弱',
};

/**
 * 旺衰颜色
 */
export const WANG_SHUAI_COLORS: Record<WangShuai, string> = {
  [WangShuai.Wang]: '#f5222d',  // 红色 - 最强
  [WangShuai.Xiang]: '#fa8c16', // 橙色 - 次强
  [WangShuai.Xiu]: '#fadb14',   // 黄色 - 中等
  [WangShuai.Qiu]: '#52c41a',   // 绿色 - 较弱
  [WangShuai.Si]: '#1890ff',    // 蓝色 - 最弱
};

/**
 * 判断旺衰是否有力
 */
export function isWangShuaiStrong(wangShuai: WangShuai): boolean {
  return wangShuai === WangShuai.Wang || wangShuai === WangShuai.Xiang;
}

/**
 * 日辰关系名称
 */
export const RI_CHEN_GUANXI_NAMES: Record<RiChenGuanXi, string> = {
  [RiChenGuanXi.None]: '无',
  [RiChenGuanXi.RiChong]: '日冲',
  [RiChenGuanXi.RiHe]: '日合',
  [RiChenGuanXi.RiSheng]: '日生',
  [RiChenGuanXi.RiKe]: '日克',
  [RiChenGuanXi.XieQi]: '泄气',
  [RiChenGuanXi.HaoQi]: '耗气',
};

/**
 * 动爻作用名称
 */
export const DONG_YAO_ZUOYONG_NAMES: Record<DongYaoZuoYong, string> = {
  [DongYaoZuoYong.DongShengJing]: '动生静',
  [DongYaoZuoYong.DongKeJing]: '动克静',
  [DongYaoZuoYong.DongXieJing]: '动泄静',
  [DongYaoZuoYong.DongHaoJing]: '动耗静',
  [DongYaoZuoYong.BiHe]: '比和',
  [DongYaoZuoYong.None]: '无作用',
};

/**
 * 回头生克名称
 */
export const HUI_TOU_ZUOYONG_NAMES: Record<HuiTouZuoYong, string> = {
  [HuiTouZuoYong.HuiTouSheng]: '回头生',
  [HuiTouZuoYong.HuiTouKe]: '回头克',
  [HuiTouZuoYong.HuiTouXie]: '回头泄',
  [HuiTouZuoYong.HuiTouHao]: '回头耗',
  [HuiTouZuoYong.BiHe]: '比和',
};

// ==================== 辅助函数 ====================

/**
 * 根据铜钱结果计算爻类型
 * 字(阳)=3分，背(阴)=2分
 * 6分=老阴，7分=少阳，8分=少阴，9分=老阳
 */
export function calculateYaoFromCoins(coins: [boolean, boolean, boolean]): YaoType {
  const score = coins.reduce((sum, coin) => sum + (coin ? 3 : 2), 0);
  switch (score) {
    case 6: return YaoType.OldYin;
    case 7: return YaoType.Yang;
    case 8: return YaoType.Yin;
    case 9: return YaoType.OldYang;
    default: return YaoType.Yang;
  }
}

/**
 * 判断爻是否为阳
 */
export function isYangYao(yaoType: YaoType): boolean {
  return yaoType === YaoType.Yang || yaoType === YaoType.OldYang;
}

/**
 * 判断爻是否为动爻（老阳或老阴）
 */
export function isDongYao(yaoType: YaoType): boolean {
  return yaoType === YaoType.OldYang || yaoType === YaoType.OldYin;
}

/**
 * 获取变爻类型
 */
export function getBianYaoType(yaoType: YaoType): YaoType {
  if (yaoType === YaoType.OldYang) return YaoType.Yin;
  if (yaoType === YaoType.OldYin) return YaoType.Yang;
  return yaoType;
}
