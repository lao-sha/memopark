/**
 * 大六壬类型定义
 *
 * 本模块定义了大六壬占卜系统的所有类型接口
 * 对应 pallet-daliuren 的数据结构
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
  [WuXing.Mu]: '#52c41a',  // 绿色
  [WuXing.Huo]: '#f5222d', // 红色
  [WuXing.Tu]: '#faad14',  // 黄色
  [WuXing.Jin]: '#d9d9d9', // 白/银色
  [WuXing.Shui]: '#1890ff', // 蓝色
};

// ==================== 大六壬专用类型 ====================

/**
 * 十二天将枚举
 */
export enum TianJiang {
  GuiRen = 0,   // 贵人（天乙贵人）
  TengShe = 1,  // 螣蛇
  ZhuQue = 2,   // 朱雀
  LiuHe = 3,    // 六合
  GouChen = 4,  // 勾陈
  QingLong = 5, // 青龙
  TianKong = 6, // 天空
  BaiHu = 7,    // 白虎
  TaiChang = 8, // 太常
  XuanWu = 9,   // 玄武
  TaiYin = 10,  // 太阴
  TianHou = 11, // 天后
}

/** 十二天将名称 */
export const TIAN_JIANG_NAMES: Record<TianJiang, string> = {
  [TianJiang.GuiRen]: '贵人',
  [TianJiang.TengShe]: '螣蛇',
  [TianJiang.ZhuQue]: '朱雀',
  [TianJiang.LiuHe]: '六合',
  [TianJiang.GouChen]: '勾陈',
  [TianJiang.QingLong]: '青龙',
  [TianJiang.TianKong]: '天空',
  [TianJiang.BaiHu]: '白虎',
  [TianJiang.TaiChang]: '太常',
  [TianJiang.XuanWu]: '玄武',
  [TianJiang.TaiYin]: '太阴',
  [TianJiang.TianHou]: '天后',
};

/** 天将吉凶：吉将 */
export const TIAN_JIANG_AUSPICIOUS = new Set([
  TianJiang.GuiRen,
  TianJiang.LiuHe,
  TianJiang.QingLong,
  TianJiang.TaiChang,
  TianJiang.TaiYin,
  TianJiang.TianHou,
]);

/**
 * 六亲枚举
 */
export enum LiuQin {
  GuanGui = 0, // 官鬼
  FuMu = 1,    // 父母
  XiongDi = 2, // 兄弟
  QiCai = 3,   // 妻财
  ZiSun = 4,   // 子孙
}

/** 六亲名称 */
export const LIU_QIN_NAMES: Record<LiuQin, string> = {
  [LiuQin.GuanGui]: '官鬼',
  [LiuQin.FuMu]: '父母',
  [LiuQin.XiongDi]: '兄弟',
  [LiuQin.QiCai]: '妻财',
  [LiuQin.ZiSun]: '子孙',
};

/**
 * 旺衰枚举
 */
export enum WangShuai {
  Wang = 0,  // 旺
  Xiang = 1, // 相
  Xiu = 2,   // 休
  Qiu = 3,   // 囚
  Si = 4,    // 死
}

/** 旺衰名称 */
export const WANG_SHUAI_NAMES: Record<WangShuai, string> = {
  [WangShuai.Wang]: '旺',
  [WangShuai.Xiang]: '相',
  [WangShuai.Xiu]: '休',
  [WangShuai.Qiu]: '囚',
  [WangShuai.Si]: '死',
};

/**
 * 九种课式类型
 */
export enum KeShiType {
  ZeiKe = 0,    // 贼克课（下克上）
  BiYong = 1,   // 比用课
  SheHai = 2,   // 涉害课
  YaoKe = 3,    // 遥克课
  AngXing = 4,  // 昂星课
  BieZe = 5,    // 别责课
  BaZhuan = 6,  // 八专课
  FuYin = 7,    // 伏吟课
  FanYin = 8,   // 返吟课
}

/** 课式名称 */
export const KE_SHI_NAMES: Record<KeShiType, string> = {
  [KeShiType.ZeiKe]: '贼克课',
  [KeShiType.BiYong]: '比用课',
  [KeShiType.SheHai]: '涉害课',
  [KeShiType.YaoKe]: '遥克课',
  [KeShiType.AngXing]: '昂星课',
  [KeShiType.BieZe]: '别责课',
  [KeShiType.BaZhuan]: '八专课',
  [KeShiType.FuYin]: '伏吟课',
  [KeShiType.FanYin]: '返吟课',
};

/** 课式断语 */
export const KE_SHI_HINTS: Record<KeShiType, string> = {
  [KeShiType.ZeiKe]: '下克上为贼，事多暗昧、小人作祟',
  [KeShiType.BiYong]: '同类相比，需仔细斟酌',
  [KeShiType.SheHai]: '涉害深者为用，事多艰难',
  [KeShiType.YaoKe]: '遥相克制，事情迂回',
  [KeShiType.AngXing]: '高悬明照，宜静不宜动',
  [KeShiType.BieZe]: '三课不全，责任分明',
  [KeShiType.BaZhuan]: '干支同类，一意孤行',
  [KeShiType.FuYin]: '天地重合，静中有动',
  [KeShiType.FanYin]: '天地相冲，动中求静',
};

/**
 * 格局类型
 */
export enum GeJuType {
  YuanShou = 0,     // 元首格
  ChongShen = 1,    // 重审格
  ZhiYi = 2,        // 知一格
  SheHai = 3,       // 涉害格
  JianJi = 4,       // 见机格
  ChaMing = 5,      // 察微格
  FuDeng = 6,       // 复等格
  YaoKe = 7,        // 遥克格
  HuShi = 8,        // 虎视格
  DongSheYanMu = 9, // 冬蛇掩目
  BieZe = 10,       // 别责格
  BaZhuan = 11,     // 八专格
  ZiRen = 12,       // 自任格
  ZiXin = 13,       // 自信格
  WuYi = 14,        // 无依格
}

/** 格局名称 */
export const GE_JU_NAMES: Record<GeJuType, string> = {
  [GeJuType.YuanShou]: '元首格',
  [GeJuType.ChongShen]: '重审格',
  [GeJuType.ZhiYi]: '知一格',
  [GeJuType.SheHai]: '涉害格',
  [GeJuType.JianJi]: '见机格',
  [GeJuType.ChaMing]: '察微格',
  [GeJuType.FuDeng]: '复等格',
  [GeJuType.YaoKe]: '遥克格',
  [GeJuType.HuShi]: '虎视格',
  [GeJuType.DongSheYanMu]: '冬蛇掩目',
  [GeJuType.BieZe]: '别责格',
  [GeJuType.BaZhuan]: '八专格',
  [GeJuType.ZiRen]: '自任格',
  [GeJuType.ZiXin]: '自信格',
  [GeJuType.WuYi]: '无依格',
};

/** 格局断语 */
export const GE_JU_HINTS: Record<GeJuType, string> = {
  [GeJuType.YuanShou]: '上克下，顺势而为，大吉之兆',
  [GeJuType.ChongShen]: '下克上，需再三审视',
  [GeJuType.ZhiYi]: '比用取一，择善而从',
  [GeJuType.SheHai]: '涉害深者，事多周折',
  [GeJuType.JianJi]: '见机行事，当机立断',
  [GeJuType.ChaMing]: '察微知著，细节定成败',
  [GeJuType.FuDeng]: '复杂局面，需等待时机',
  [GeJuType.YaoKe]: '遥相呼应，缓则有成',
  [GeJuType.HuShi]: '虎视眈眈，静观其变',
  [GeJuType.DongSheYanMu]: '隐藏玄机，不宜妄动',
  [GeJuType.BieZe]: '责任分明，各司其职',
  [GeJuType.BaZhuan]: '专一则成，杂则败',
  [GeJuType.ZiRen]: '自力更生，独立完成',
  [GeJuType.ZiXin]: '坚定信心，终有所成',
  [GeJuType.WuYi]: '无所依托，随遇而安',
};

// ==================== 解盘类型 ====================

/**
 * 吉凶等级（7级）
 */
export enum FortuneLevel {
  DaJi = 0,      // 大吉
  ZhongJi = 1,   // 中吉
  XiaoJi = 2,    // 小吉
  Ping = 3,      // 平
  XiaoXiong = 4, // 小凶
  ZhongXiong = 5,// 中凶
  DaXiong = 6,   // 大凶
}

/** 吉凶名称 */
export const FORTUNE_LEVEL_NAMES: Record<FortuneLevel, string> = {
  [FortuneLevel.DaJi]: '大吉',
  [FortuneLevel.ZhongJi]: '中吉',
  [FortuneLevel.XiaoJi]: '小吉',
  [FortuneLevel.Ping]: '平',
  [FortuneLevel.XiaoXiong]: '小凶',
  [FortuneLevel.ZhongXiong]: '中凶',
  [FortuneLevel.DaXiong]: '大凶',
};

/** 吉凶颜色 */
export const FORTUNE_LEVEL_COLORS: Record<FortuneLevel, string> = {
  [FortuneLevel.DaJi]: '#52c41a',
  [FortuneLevel.ZhongJi]: '#73d13d',
  [FortuneLevel.XiaoJi]: '#95de64',
  [FortuneLevel.Ping]: '#d9d9d9',
  [FortuneLevel.XiaoXiong]: '#ffa39e',
  [FortuneLevel.ZhongXiong]: '#ff7875',
  [FortuneLevel.DaXiong]: '#f5222d',
};

/**
 * 事态趋势
 */
export enum TrendType {
  Descending = 0, // 下降
  Stable = 1,     // 平稳
  Ascending = 2,  // 上升
}

/** 趋势名称 */
export const TREND_NAMES: Record<TrendType, string> = {
  [TrendType.Descending]: '下降',
  [TrendType.Stable]: '平稳',
  [TrendType.Ascending]: '上升',
};

/**
 * 事情成败
 */
export enum OutcomeType {
  BuCheng = 0,  // 不成
  NanCheng = 1, // 难成
  KeCheng = 2,  // 可成
  BiCheng = 3,  // 必成
}

/** 成败名称 */
export const OUTCOME_NAMES: Record<OutcomeType, string> = {
  [OutcomeType.BuCheng]: '不成',
  [OutcomeType.NanCheng]: '难成',
  [OutcomeType.KeCheng]: '可成',
  [OutcomeType.BiCheng]: '必成',
};

/**
 * 事象类型（占断方向）
 */
export enum ShiXiangType {
  ShiYeGuan = 0,       // 事业官运
  CaiYun = 1,          // 财运
  HunYinGanQing = 2,   // 婚姻感情
  QiuMingKaoShi = 3,   // 求名考试
  JiBingJianKang = 4,  // 疾病健康
  ChuXing = 5,         // 出行
  QiuZi = 6,           // 求子
  XingRenXunXi = 7,    // 行人讯息
  SuSong = 8,          // 诉讼
  ShiWuXunRen = 9,     // 失物寻人
  TianQi = 10,         // 天气
  QiTa = 11,           // 其他
}

/** 事象名称 */
export const SHI_XIANG_NAMES: Record<ShiXiangType, string> = {
  [ShiXiangType.ShiYeGuan]: '事业官运',
  [ShiXiangType.CaiYun]: '财运',
  [ShiXiangType.HunYinGanQing]: '婚姻感情',
  [ShiXiangType.QiuMingKaoShi]: '求名考试',
  [ShiXiangType.JiBingJianKang]: '疾病健康',
  [ShiXiangType.ChuXing]: '出行',
  [ShiXiangType.QiuZi]: '求子',
  [ShiXiangType.XingRenXunXi]: '行人讯息',
  [ShiXiangType.SuSong]: '诉讼',
  [ShiXiangType.ShiWuXunRen]: '失物寻人',
  [ShiXiangType.TianQi]: '天气',
  [ShiXiangType.QiTa]: '其他',
};

/**
 * 应期单位
 */
export enum YingQiUnit {
  Ri = 0,   // 日
  Xun = 1,  // 旬（10日）
  Yue = 2,  // 月
  Nian = 3, // 年
}

/** 应期单位名称 */
export const YING_QI_UNIT_NAMES: Record<YingQiUnit, string> = {
  [YingQiUnit.Ri]: '日',
  [YingQiUnit.Xun]: '旬',
  [YingQiUnit.Yue]: '月',
  [YingQiUnit.Nian]: '年',
};

/**
 * 应期计算方法
 */
export enum YingQiMethod {
  SanChuanXiangJia = 0, // 三传相加法
  LeiShen = 1,          // 类神法
  KongWangTianShi = 2,  // 空亡填实
  LiuChong = 3,         // 六冲应期
  LiuHe = 4,            // 六合应期
  TianJiang = 5,        // 天将应期
  ShengWangMuJue = 6,   // 生旺墓绝
}

/** 应期方法名称 */
export const YING_QI_METHOD_NAMES: Record<YingQiMethod, string> = {
  [YingQiMethod.SanChuanXiangJia]: '三传相加',
  [YingQiMethod.LeiShen]: '类神法',
  [YingQiMethod.KongWangTianShi]: '空亡填实',
  [YingQiMethod.LiuChong]: '六冲应期',
  [YingQiMethod.LiuHe]: '六合应期',
  [YingQiMethod.TianJiang]: '天将应期',
  [YingQiMethod.ShengWangMuJue]: '生旺墓绝',
};

/**
 * 神煞类型
 */
export enum ShenShaType {
  // 吉神 (0-19)
  TianYiGuiRen = 0,  // 天乙贵人
  TianDe = 1,        // 天德
  YueDe = 2,         // 月德
  TianXi = 3,        // 天喜
  ShengQi = 4,       // 生气
  YiMa = 5,          // 驿马
  HuangShu = 6,      // 皇书
  HuangEn = 7,       // 皇恩
  TianYi = 8,        // 天医
  TianZhao = 9,      // 天诏
  XunQi = 10,        // 旬奇
  XunYi = 11,        // 旬仪

  // 凶神 (20-39)
  TianLuo = 20,      // 天罗
  DiWang = 21,       // 地网
  TianGui = 22,      // 天鬼
  SangMen = 23,      // 丧门
  SangChe = 24,      // 丧车
  XueZhi = 25,       // 血支
  XueJi = 26,        // 血忌
  DaHao = 27,        // 大耗
  XiaoHao = 28,      // 小耗
  BingFu = 29,       // 病符
  GuChen = 30,       // 孤辰
  GuaSu = 31,        // 寡宿
  SiQi = 32,         // 死气
  WuMu = 33,         // 五墓
  SanQiu = 34,       // 三丘
}

/** 神煞名称 */
export const SHEN_SHA_NAMES: Record<ShenShaType, string> = {
  [ShenShaType.TianYiGuiRen]: '天乙贵人',
  [ShenShaType.TianDe]: '天德',
  [ShenShaType.YueDe]: '月德',
  [ShenShaType.TianXi]: '天喜',
  [ShenShaType.ShengQi]: '生气',
  [ShenShaType.YiMa]: '驿马',
  [ShenShaType.HuangShu]: '皇书',
  [ShenShaType.HuangEn]: '皇恩',
  [ShenShaType.TianYi]: '天医',
  [ShenShaType.TianZhao]: '天诏',
  [ShenShaType.XunQi]: '旬奇',
  [ShenShaType.XunYi]: '旬仪',
  [ShenShaType.TianLuo]: '天罗',
  [ShenShaType.DiWang]: '地网',
  [ShenShaType.TianGui]: '天鬼',
  [ShenShaType.SangMen]: '丧门',
  [ShenShaType.SangChe]: '丧车',
  [ShenShaType.XueZhi]: '血支',
  [ShenShaType.XueJi]: '血忌',
  [ShenShaType.DaHao]: '大耗',
  [ShenShaType.XiaoHao]: '小耗',
  [ShenShaType.BingFu]: '病符',
  [ShenShaType.GuChen]: '孤辰',
  [ShenShaType.GuaSu]: '寡宿',
  [ShenShaType.SiQi]: '死气',
  [ShenShaType.WuMu]: '五墓',
  [ShenShaType.SanQiu]: '三丘',
};

/** 判断神煞是否为吉神 */
export function isShenShaAuspicious(shenSha: ShenShaType): boolean {
  return shenSha < 20;
}

/**
 * 起课方式
 */
export enum DivinationMethod {
  TimeMethod = 0,   // 时间起课
  RandomMethod = 1, // 随机起课
  ManualMethod = 2, // 手动起课
}

/** 起课方式名称 */
export const DIVINATION_METHOD_NAMES: Record<DivinationMethod, string> = {
  [DivinationMethod.TimeMethod]: '时间起课',
  [DivinationMethod.RandomMethod]: '随机起课',
  [DivinationMethod.ManualMethod]: '手动起课',
};

// ==================== 式盘数据结构 ====================

/** 干支组合 */
export interface GanZhi {
  tianGan: TianGan;
  diZhi: DiZhi;
}

/** 单课数据 */
export interface KeData {
  /** 上神 */
  shang: DiZhi;
  /** 下神 */
  xia: DiZhi;
  /** 天将 */
  jiang: TianJiang;
}

/** 四课数据 */
export interface SiKe {
  ke1: KeData;
  ke2: KeData;
  ke3: KeData;
  ke4: KeData;
}

/** 三传数据 */
export interface SanChuan {
  /** 初传 */
  chu: DiZhi;
  /** 中传 */
  zhong: DiZhi;
  /** 末传 */
  mo: DiZhi;
  /** 初传天将 */
  chuJiang: TianJiang;
  /** 中传天将 */
  zhongJiang: TianJiang;
  /** 末传天将 */
  moJiang: TianJiang;
  /** 初传六亲 */
  chuQin: LiuQin;
  /** 中传六亲 */
  zhongQin: LiuQin;
  /** 末传六亲 */
  moQin: LiuQin;
}

/** 天盘数据（12地支位置） */
export interface TianPan {
  positions: DiZhi[];
}

/** 天将盘数据 */
export interface TianJiangPan {
  positions: TianJiang[];
}

/**
 * 大六壬式盘完整数据
 */
export interface DaLiuRenPan {
  /** 式盘ID */
  id: number;
  /** 创建者 */
  creator: string;
  /** 创建区块 */
  createdAt: number;
  /** 起课方式 */
  method: DivinationMethod;
  /** 问题CID */
  questionCid?: string;
  /** 年干支 */
  yearGz: GanZhi;
  /** 月干支 */
  monthGz: GanZhi;
  /** 日干支 */
  dayGz: GanZhi;
  /** 时干支 */
  hourGz: GanZhi;
  /** 月将 */
  yueJiang: DiZhi;
  /** 占时 */
  zhanShi: DiZhi;
  /** 是否昼占 */
  isDay: boolean;
  /** 天盘 */
  tianPan: TianPan;
  /** 天将盘 */
  tianJiangPan: TianJiangPan;
  /** 四课 */
  siKe: SiKe;
  /** 三传 */
  sanChuan: SanChuan;
  /** 课式类型 */
  keShiType: KeShiType;
  /** 格局类型 */
  geJuType: GeJuType;
  /** 空亡 */
  xunKong: [DiZhi, DiZhi];
  /** 是否公开 */
  isPublic: boolean;
  /** AI解读CID */
  aiInterpretationCid?: string;
}

// ==================== 解盘结果数据结构 ====================

/**
 * 核心解盘结果（约20字节）
 *
 * Layer 1: 链上存储的核心指标
 */
export interface CoreInterpretation {
  /** 课式类型 */
  keShiType: KeShiType;
  /** 格局类型 */
  geJuType: GeJuType;
  /** 综合吉凶等级 */
  fortune: FortuneLevel;
  /** 事态发展趋势 */
  trend: TrendType;
  /** 事情成败 */
  outcome: OutcomeType;
  /** 主类神（初传地支） */
  primaryLeiShen: DiZhi;
  /** 主类神旺衰 */
  primaryWangShuai: WangShuai;
  /** 主类神六亲 */
  primaryLiuQin: LiuQin;
  /** 主类神天将吉凶 */
  primaryJiangJi: boolean;
  /** 应期数 */
  yingQiNum: number;
  /** 应期单位 */
  yingQiUnit: YingQiUnit;
  /** 次应期地支 */
  secondaryYingQi: DiZhi;
  /** 应期可信度 0-100 */
  yingQiConfidence: number;
  /** 综合评分 0-100 */
  score: number;
  /** 解盘可信度 0-100 */
  confidence: number;
  /** 解盘区块号 */
  timestamp: number;
}

/**
 * 三传分析（Layer 2）
 */
export interface SanChuanAnalysis {
  /** 初传旺衰 */
  chuWangShuai: WangShuai;
  /** 初传天将吉凶 */
  chuJiangJi: boolean;
  /** 初传空亡 */
  chuKong: boolean;
  /** 中传旺衰 */
  zhongWangShuai: WangShuai;
  /** 中传天将吉凶 */
  zhongJiangJi: boolean;
  /** 中传空亡 */
  zhongKong: boolean;
  /** 末传旺衰 */
  moWangShuai: WangShuai;
  /** 末传天将吉凶 */
  moJiangJi: boolean;
  /** 末传空亡 */
  moKong: boolean;
  /** 递生 */
  diSheng: boolean;
  /** 递克 */
  diKe: boolean;
  /** 连茹 */
  lianRu: boolean;
}

/**
 * 四课分析（Layer 2）
 */
export interface SiKeAnalysis {
  /** 日干得助 */
  riGanYouZhu: boolean;
  /** 干阳神旺衰 */
  ganYangWangShuai: WangShuai;
  /** 日支得生 */
  riZhiYouSheng: boolean;
  /** 支阳神旺衰 */
  zhiYangWangShuai: WangShuai;
  /** 上克下数量 */
  shangKeXiaCount: number;
  /** 下克上数量 */
  xiaKeShangCount: number;
  /** 干支相合 */
  ganZhiHe: boolean;
  /** 干支相冲 */
  ganZhiChong: boolean;
}

/**
 * 天将分析（Layer 2）
 */
export interface TianJiangAnalysis {
  /** 贵人所临 */
  guiRenLin: DiZhi;
  /** 贵人空亡 */
  guiRenKong: boolean;
  /** 贵人入墓 */
  guiRenMu: boolean;
  /** 青龙所临 */
  qingLongLin: DiZhi;
  /** 白虎所临 */
  baiHuLin: DiZhi;
  /** 吉将数量 */
  jiJiangCount: number;
  /** 凶将数量 */
  xiongJiangCount: number;
  /** 三传吉将数 */
  sanChuanJiJiang: number;
}

/**
 * 神煞分析（Layer 2）
 */
export interface ShenShaAnalysis {
  /** 吉神煞列表 */
  jiShenSha: ShenShaType[];
  /** 凶神煞列表 */
  xiongShenSha: ShenShaType[];
  /** 驿马入传 */
  yiMaRuChuan: boolean;
  /** 天罗地网 */
  tianLuoDiWang: boolean;
  /** 六害入传 */
  liuHaiRuChuan: boolean;
  /** 三刑入传 */
  sanXingRuChuan: boolean;
}

/**
 * 应期结果
 */
export interface YingQiResult {
  /** 数值 */
  num: number;
  /** 单位 */
  unit: YingQiUnit;
  /** 地支 */
  zhi: DiZhi;
  /** 计算方法 */
  method: YingQiMethod;
}

/**
 * 应期详细分析（Layer 2）
 */
export interface YingQiAnalysis {
  /** 主应期 */
  primary: YingQiResult;
  /** 次应期 */
  secondary?: YingQiResult;
  /** 特殊应期 */
  special?: YingQiResult;
  /** 建议索引 */
  suggestionIndex: number;
}

/**
 * 事象断语提示
 */
export interface ShiXiangHints {
  /** 占问类型 */
  shiXiangType: ShiXiangType;
  /** 主断语索引 */
  primaryHintIndex: number;
  /** 辅助断语索引 */
  secondaryHints: number[];
  /** 注意事项索引 */
  cautionIndex?: number;
}

/**
 * 完整解盘结果（Layer 3）
 *
 * 通过 Runtime API 返回
 */
export interface FullInterpretation {
  /** 核心解盘 */
  core: CoreInterpretation;
  /** 三传分析 */
  sanChuanAnalysis: SanChuanAnalysis;
  /** 四课分析 */
  siKeAnalysis: SiKeAnalysis;
  /** 天将分析 */
  tianJiangAnalysis: TianJiangAnalysis;
  /** 神煞分析 */
  shenShaAnalysis: ShenShaAnalysis;
  /** 应期分析 */
  yingQiAnalysis: YingQiAnalysis;
  /** 事象断语提示 */
  shiXiangHints?: ShiXiangHints;
}

// ==================== 用户统计 ====================

/**
 * 用户统计数据
 */
export interface UserStats {
  /** 式盘总数 */
  totalPans: number;
  /** AI解读次数 */
  aiInterpretations: number;
  /** 首次起课区块 */
  firstPanBlock: number;
}

// ==================== 辅助函数 ====================

/**
 * 获取干支名称
 */
export function getGanZhiName(gz: GanZhi): string {
  return TIAN_GAN_NAMES[gz.tianGan] + DI_ZHI_NAMES[gz.diZhi];
}

/**
 * 格式化应期
 */
export function formatYingQi(num: number, unit: YingQiUnit): string {
  return `${num}${YING_QI_UNIT_NAMES[unit]}`;
}

/**
 * 判断吉凶等级是否为吉
 */
export function isFortuneLevelAuspicious(level: FortuneLevel): boolean {
  return level <= FortuneLevel.XiaoJi;
}

/**
 * 判断天将是否为吉将
 */
export function isTianJiangAuspicious(jiang: TianJiang): boolean {
  return TIAN_JIANG_AUSPICIOUS.has(jiang);
}

/**
 * 获取吉凶等级评分
 */
export function fortuneLevelToScore(level: FortuneLevel): number {
  const scores: Record<FortuneLevel, number> = {
    [FortuneLevel.DaJi]: 95,
    [FortuneLevel.ZhongJi]: 80,
    [FortuneLevel.XiaoJi]: 65,
    [FortuneLevel.Ping]: 50,
    [FortuneLevel.XiaoXiong]: 35,
    [FortuneLevel.ZhongXiong]: 20,
    [FortuneLevel.DaXiong]: 5,
  };
  return scores[level];
}

/**
 * 解析 BoundedVec<u8> 为字符串
 */
export function parseBoundedVecToString(data: unknown): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    try {
      const bytes = data.map((b: number | { toNumber?: () => number }) =>
        typeof b === 'number' ? b : b.toNumber?.() ?? 0
      );
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
      return '';
    }
  }
  if (typeof (data as { toHuman?: () => string }).toHuman === 'function') {
    return (data as { toHuman: () => string }).toHuman();
  }
  if (typeof (data as { toString?: () => string }).toString === 'function') {
    return (data as { toString: () => string }).toString();
  }
  return '';
}
