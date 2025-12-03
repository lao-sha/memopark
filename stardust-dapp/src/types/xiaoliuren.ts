/**
 * 小六壬类型定义
 *
 * 本模块采用**道家小六壬**体系，与传统流派在五行配属上有所不同：
 *
 * | 六神 | 道家流派 | 传统流派 |
 * |------|---------|---------|
 * | 大安 | 木/阳   | 木      |
 * | 留连 | 土/阴   | 水      |
 * | 速喜 | 火/阳   | 火      |
 * | 赤口 | 金/阴   | 金      |
 * | 小吉 | 水/阳   | 木      |
 * | 空亡 | 土/阴   | 土      |
 */

// ==================== 五行定义 ====================

/**
 * 五行枚举
 */
export enum WuXing {
  /** 木 */
  Wood = 0,
  /** 火 */
  Fire = 1,
  /** 土 */
  Earth = 2,
  /** 金 */
  Metal = 3,
  /** 水 */
  Water = 4,
}

/** 五行名称 */
export const WU_XING_NAMES: Record<WuXing, string> = {
  [WuXing.Wood]: '木',
  [WuXing.Fire]: '火',
  [WuXing.Earth]: '土',
  [WuXing.Metal]: '金',
  [WuXing.Water]: '水',
};

/** 五行颜色 */
export const WU_XING_COLORS: Record<WuXing, string> = {
  [WuXing.Wood]: '#52c41a', // 青/绿
  [WuXing.Fire]: '#f5222d', // 红
  [WuXing.Earth]: '#faad14', // 黄
  [WuXing.Metal]: '#ffffff', // 白
  [WuXing.Water]: '#000000', // 黑
};

// ==================== 阴阳定义 ====================

/**
 * 阴阳枚举
 */
export enum YinYang {
  /** 阳 */
  Yang = 0,
  /** 阴 */
  Yin = 1,
}

/** 阴阳名称 */
export const YIN_YANG_NAMES: Record<YinYang, string> = {
  [YinYang.Yang]: '阳',
  [YinYang.Yin]: '阴',
};

// ==================== 六宫定义 ====================

/**
 * 六宫枚举（道家小六壬）
 */
export enum LiuGong {
  /** 大安 - 木/阳 */
  DaAn = 0,
  /** 留连 - 土/阴（道家流派） */
  LiuLian = 1,
  /** 速喜 - 火/阳 */
  SuXi = 2,
  /** 赤口 - 金/阴 */
  ChiKou = 3,
  /** 小吉 - 水/阳（道家流派） */
  XiaoJi = 4,
  /** 空亡 - 土/阴 */
  KongWang = 5,
}

/** 六宫名称 */
export const LIU_GONG_NAMES: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '大安',
  [LiuGong.LiuLian]: '留连',
  [LiuGong.SuXi]: '速喜',
  [LiuGong.ChiKou]: '赤口',
  [LiuGong.XiaoJi]: '小吉',
  [LiuGong.KongWang]: '空亡',
};

/** 六宫五行（道家流派） */
export const LIU_GONG_WU_XING: Record<LiuGong, WuXing> = {
  [LiuGong.DaAn]: WuXing.Wood,     // 木
  [LiuGong.LiuLian]: WuXing.Earth, // 土（道家流派）
  [LiuGong.SuXi]: WuXing.Fire,     // 火
  [LiuGong.ChiKou]: WuXing.Metal,  // 金
  [LiuGong.XiaoJi]: WuXing.Water,  // 水（道家流派）
  [LiuGong.KongWang]: WuXing.Earth,// 土
};

/** 六宫阴阳（道家流派） */
export const LIU_GONG_YIN_YANG: Record<LiuGong, YinYang> = {
  [LiuGong.DaAn]: YinYang.Yang,     // 阳
  [LiuGong.LiuLian]: YinYang.Yin,   // 阴
  [LiuGong.SuXi]: YinYang.Yang,     // 阳
  [LiuGong.ChiKou]: YinYang.Yin,    // 阴
  [LiuGong.XiaoJi]: YinYang.Yang,   // 阳
  [LiuGong.KongWang]: YinYang.Yin,  // 阴
};

/** 六宫方位（道家流派） */
export const LIU_GONG_DIRECTIONS: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '东方',
  [LiuGong.LiuLian]: '东南',  // 道家流派
  [LiuGong.SuXi]: '南方',
  [LiuGong.ChiKou]: '西方',
  [LiuGong.XiaoJi]: '北方',   // 道家流派
  [LiuGong.KongWang]: '中央',
};

/** 六宫颜色（对应五行） */
export const LIU_GONG_COLORS: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '#52c41a',     // 青色 - 木
  [LiuGong.LiuLian]: '#faad14',  // 黄色 - 土（道家流派）
  [LiuGong.SuXi]: '#f5222d',     // 红色 - 火
  [LiuGong.ChiKou]: '#ffffff',   // 白色 - 金
  [LiuGong.XiaoJi]: '#1890ff',   // 蓝色 - 水（道家流派）
  [LiuGong.KongWang]: '#faad14', // 黄色 - 土
};

/** 六宫天将 */
export const LIU_GONG_TIAN_JIANG: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '青龙',
  [LiuGong.LiuLian]: '玄武',
  [LiuGong.SuXi]: '朱雀',
  [LiuGong.ChiKou]: '白虎',
  [LiuGong.XiaoJi]: '六合',
  [LiuGong.KongWang]: '勾陈',
};

/** 六宫吉凶等级（1-5，5最吉） */
export const LIU_GONG_FORTUNE_LEVELS: Record<LiuGong, number> = {
  [LiuGong.DaAn]: 5,     // 大吉
  [LiuGong.SuXi]: 4,     // 吉
  [LiuGong.XiaoJi]: 4,   // 吉
  [LiuGong.LiuLian]: 2,  // 平/凶
  [LiuGong.ChiKou]: 1,   // 凶
  [LiuGong.KongWang]: 1, // 凶
};

/** 六宫是否为吉宫 */
export const LIU_GONG_IS_AUSPICIOUS: Record<LiuGong, boolean> = {
  [LiuGong.DaAn]: true,
  [LiuGong.SuXi]: true,
  [LiuGong.XiaoJi]: true,
  [LiuGong.LiuLian]: false,
  [LiuGong.ChiKou]: false,
  [LiuGong.KongWang]: false,
};

/** 六宫简要描述（道家流派） */
export const LIU_GONG_BRIEFS: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '身不动时，五行属木，阳性，颜色青色，方位东方。临青龙。有静止、心安、吉祥之含义。',
  [LiuGong.LiuLian]: '人未归时，五行属土，阴性，颜色黄色，方位东南。临玄武。有暗味不明、延迟、纠缠、拖延之含义。',
  [LiuGong.SuXi]: '人即至时，五行属火，阳性，颜色红色，方位南方。临朱雀。有快速、喜庆、吉利之含义。指时机已到。',
  [LiuGong.ChiKou]: '官事凶时，五行属金，阴性，颜色白色，方位西方。临白虎。有不吉、惊恐、凶险、口舌是非之含义。',
  [LiuGong.XiaoJi]: '人来喜时，五行属水，阳性，颜色黑色，方位北方。临六合。有和合、吉利之含义。',
  [LiuGong.KongWang]: '音信稀时，五行属土，阴性，颜色黄色，方位中央。临勾陈。有不吉、无结果、忧虑之含义。',
};

/** 六宫卦辞 */
export const LIU_GONG_GUA_CI: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '大安事事昌，求财在坤方，失物去不远，宅舍保安康。行人身未动，病者主无妨，将军回田野，仔细好推详。',
  [LiuGong.LiuLian]: '留连事难成，求谋日未明，官事只宜缓。去者未回程，失物南方见，急讨方心称。更须防口舌，人口且平平。',
  [LiuGong.SuXi]: '速喜喜来临，求财向南行，失物申未午。逢人路上寻，官事有福德，病者无祸侵。田宅六畜吉，行人有信音。',
  [LiuGong.ChiKou]: '赤口主口舌，官非切要防，失物速速讨。行人有惊慌，六畜多作怪，病者出西方。更须防咀咒，诚恐染瘟皇。',
  [LiuGong.XiaoJi]: '小吉最吉昌，路上好商量，阴人来报喜。失物在坤方，行人即便至，交关甚是强。凡事皆和合，病者叩穷苍。',
  [LiuGong.KongWang]: '空亡事不祥，阴人多乖张，求财无利益。行人有灾殃，失物寻不见，官事有刑伤。病人逢暗鬼，祈解可安康。',
};

// ==================== 起课方式 ====================

/**
 * 起课方式枚举
 */
export enum DivinationMethod {
  /** 月日时起课 - 以农历月日时起课（传统方法） */
  TimeMethod = 0,
  /** 时刻分起课 - 以时辰、刻、分起课（道家流派） */
  TimeKeMethod = 1,
  /** 数字起课 - 以三个数字起课（活数起课法） */
  NumberMethod = 2,
  /** 随机起课 - 使用链上随机数起课 */
  RandomMethod = 3,
  /** 手动指定 - 直接指定三宫结果 */
  ManualMethod = 4,
}

/** 起课方式名称 */
export const DIVINATION_METHOD_NAMES: Record<DivinationMethod, string> = {
  [DivinationMethod.TimeMethod]: '月日时起课',
  [DivinationMethod.TimeKeMethod]: '时刻分起课',
  [DivinationMethod.NumberMethod]: '数字起课',
  [DivinationMethod.RandomMethod]: '随机起课',
  [DivinationMethod.ManualMethod]: '手动指定',
};

/** 起课方式描述 */
export const DIVINATION_METHOD_DESCRIPTIONS: Record<DivinationMethod, string> = {
  [DivinationMethod.TimeMethod]: '使用农历月、日、时辰起课，最为传统的方法',
  [DivinationMethod.TimeKeMethod]: '使用时辰、刻、分起课，道家小六壬专用方法',
  [DivinationMethod.NumberMethod]: '输入三个数字起课，适合随机取数场景',
  [DivinationMethod.RandomMethod]: '使用区块链随机数自动起课',
  [DivinationMethod.ManualMethod]: '直接指定三宫结果，用于练习或特定场景',
};

// ==================== 十二时辰 ====================

/**
 * 十二时辰枚举
 */
export enum ShiChen {
  /** 子时 (23:00-01:00) */
  Zi = 0,
  /** 丑时 (01:00-03:00) */
  Chou = 1,
  /** 寅时 (03:00-05:00) */
  Yin = 2,
  /** 卯时 (05:00-07:00) */
  Mao = 3,
  /** 辰时 (07:00-09:00) */
  Chen = 4,
  /** 巳时 (09:00-11:00) */
  Si = 5,
  /** 午时 (11:00-13:00) */
  Wu = 6,
  /** 未时 (13:00-15:00) */
  Wei = 7,
  /** 申时 (15:00-17:00) */
  Shen = 8,
  /** 酉时 (17:00-19:00) */
  You = 9,
  /** 戌时 (19:00-21:00) */
  Xu = 10,
  /** 亥时 (21:00-23:00) */
  Hai = 11,
}

/** 时辰名称 */
export const SHI_CHEN_NAMES: Record<ShiChen, string> = {
  [ShiChen.Zi]: '子时',
  [ShiChen.Chou]: '丑时',
  [ShiChen.Yin]: '寅时',
  [ShiChen.Mao]: '卯时',
  [ShiChen.Chen]: '辰时',
  [ShiChen.Si]: '巳时',
  [ShiChen.Wu]: '午时',
  [ShiChen.Wei]: '未时',
  [ShiChen.Shen]: '申时',
  [ShiChen.You]: '酉时',
  [ShiChen.Xu]: '戌时',
  [ShiChen.Hai]: '亥时',
};

/** 时辰地支名称 */
export const SHI_CHEN_BRANCH_NAMES: Record<ShiChen, string> = {
  [ShiChen.Zi]: '子',
  [ShiChen.Chou]: '丑',
  [ShiChen.Yin]: '寅',
  [ShiChen.Mao]: '卯',
  [ShiChen.Chen]: '辰',
  [ShiChen.Si]: '巳',
  [ShiChen.Wu]: '午',
  [ShiChen.Wei]: '未',
  [ShiChen.Shen]: '申',
  [ShiChen.You]: '酉',
  [ShiChen.Xu]: '戌',
  [ShiChen.Hai]: '亥',
};

/** 时辰时间范围 */
export const SHI_CHEN_TIME_RANGES: Record<ShiChen, string> = {
  [ShiChen.Zi]: '23:00-01:00',
  [ShiChen.Chou]: '01:00-03:00',
  [ShiChen.Yin]: '03:00-05:00',
  [ShiChen.Mao]: '05:00-07:00',
  [ShiChen.Chen]: '07:00-09:00',
  [ShiChen.Si]: '09:00-11:00',
  [ShiChen.Wu]: '11:00-13:00',
  [ShiChen.Wei]: '13:00-15:00',
  [ShiChen.Shen]: '15:00-17:00',
  [ShiChen.You]: '17:00-19:00',
  [ShiChen.Xu]: '19:00-21:00',
  [ShiChen.Hai]: '21:00-23:00',
};

/** 时辰五行 */
export const SHI_CHEN_WU_XING: Record<ShiChen, WuXing> = {
  [ShiChen.Zi]: WuXing.Water,   // 子 - 水
  [ShiChen.Chou]: WuXing.Earth, // 丑 - 土
  [ShiChen.Yin]: WuXing.Wood,   // 寅 - 木
  [ShiChen.Mao]: WuXing.Wood,   // 卯 - 木
  [ShiChen.Chen]: WuXing.Earth, // 辰 - 土
  [ShiChen.Si]: WuXing.Fire,    // 巳 - 火
  [ShiChen.Wu]: WuXing.Fire,    // 午 - 火
  [ShiChen.Wei]: WuXing.Earth,  // 未 - 土
  [ShiChen.Shen]: WuXing.Metal, // 申 - 金
  [ShiChen.You]: WuXing.Metal,  // 酉 - 金
  [ShiChen.Xu]: WuXing.Earth,   // 戌 - 土
  [ShiChen.Hai]: WuXing.Water,  // 亥 - 水
};

/** 时辰阴阳 */
export const SHI_CHEN_YIN_YANG: Record<ShiChen, YinYang> = {
  [ShiChen.Zi]: YinYang.Yang,   // 阳
  [ShiChen.Chou]: YinYang.Yin,  // 阴
  [ShiChen.Yin]: YinYang.Yang,  // 阳
  [ShiChen.Mao]: YinYang.Yin,   // 阴
  [ShiChen.Chen]: YinYang.Yang, // 阳
  [ShiChen.Si]: YinYang.Yin,    // 阴
  [ShiChen.Wu]: YinYang.Yang,   // 阳
  [ShiChen.Wei]: YinYang.Yin,   // 阴
  [ShiChen.Shen]: YinYang.Yang, // 阳
  [ShiChen.You]: YinYang.Yin,   // 阴
  [ShiChen.Xu]: YinYang.Yang,   // 阳
  [ShiChen.Hai]: YinYang.Yin,   // 阴
};

// ==================== 体用关系 ====================

/**
 * 体用关系枚举
 *
 * 道家小六壬的体用关系分析：
 * - 体：人宫（时宫），代表求测者自身
 * - 用：时辰，代表外部环境或时机
 */
export enum TiYongRelation {
  /** 用生体 - 大吉（外部环境生助自身） */
  YongShengTi = 0,
  /** 体克用 - 小吉（自身克制环境） */
  TiKeYong = 1,
  /** 用克体 - 大凶（外部环境克制自身） */
  YongKeTi = 2,
  /** 体生用 - 小凶（自身精力外泄） */
  TiShengYong = 3,
  /** 比肩 - 中平（五行相同，阴阳相同） */
  BiJian = 4,
  /** 比助 - 中平（五行相同，阴阳不同） */
  BiZhu = 5,
}

/** 体用关系名称 */
export const TI_YONG_RELATION_NAMES: Record<TiYongRelation, string> = {
  [TiYongRelation.YongShengTi]: '用生体',
  [TiYongRelation.TiKeYong]: '体克用',
  [TiYongRelation.YongKeTi]: '用克体',
  [TiYongRelation.TiShengYong]: '体生用',
  [TiYongRelation.BiJian]: '比肩',
  [TiYongRelation.BiZhu]: '比助',
};

/** 体用关系吉凶描述 */
export const TI_YONG_FORTUNE_DESCS: Record<TiYongRelation, string> = {
  [TiYongRelation.YongShengTi]: '大吉',
  [TiYongRelation.TiKeYong]: '小吉',
  [TiYongRelation.YongKeTi]: '大凶',
  [TiYongRelation.TiShengYong]: '小凶',
  [TiYongRelation.BiJian]: '中平',
  [TiYongRelation.BiZhu]: '中平',
};

/** 体用关系吉凶等级（1-6，6最吉） */
export const TI_YONG_FORTUNE_LEVELS: Record<TiYongRelation, number> = {
  [TiYongRelation.YongShengTi]: 6, // 大吉
  [TiYongRelation.TiKeYong]: 5,    // 小吉
  [TiYongRelation.BiJian]: 4,      // 中平
  [TiYongRelation.BiZhu]: 3,       // 中平
  [TiYongRelation.TiShengYong]: 2, // 小凶
  [TiYongRelation.YongKeTi]: 1,    // 大凶
};

/** 体用关系颜色 */
export const TI_YONG_COLORS: Record<TiYongRelation, string> = {
  [TiYongRelation.YongShengTi]: '#52c41a', // 绿色 - 大吉
  [TiYongRelation.TiKeYong]: '#73d13d',    // 浅绿 - 小吉
  [TiYongRelation.BiJian]: '#faad14',      // 黄色 - 中平
  [TiYongRelation.BiZhu]: '#faad14',       // 黄色 - 中平
  [TiYongRelation.TiShengYong]: '#ff7875', // 浅红 - 小凶
  [TiYongRelation.YongKeTi]: '#f5222d',    // 红色 - 大凶
};

// ==================== 八卦定义 ====================

/**
 * 八卦枚举
 */
export enum BaGua {
  /** 乾卦 ☰ - 阳阳阳，五行属金 */
  Qian = 0,
  /** 兑卦 ☱ - 阴阳阳，五行属金 */
  Dui = 1,
  /** 离卦 ☲ - 阳阴阳，五行属火 */
  Li = 2,
  /** 震卦 ☳ - 阴阴阳，五行属木 */
  Zhen = 3,
  /** 巽卦 ☴ - 阳阳阴，五行属木 */
  Xun = 4,
  /** 坎卦 ☵ - 阴阳阴，五行属水 */
  Kan = 5,
  /** 艮卦 ☶ - 阳阴阴，五行属土 */
  Gen = 6,
  /** 坤卦 ☷ - 阴阴阴，五行属土 */
  Kun = 7,
}

/** 八卦名称 */
export const BA_GUA_NAMES: Record<BaGua, string> = {
  [BaGua.Qian]: '乾',
  [BaGua.Dui]: '兑',
  [BaGua.Li]: '离',
  [BaGua.Zhen]: '震',
  [BaGua.Xun]: '巽',
  [BaGua.Kan]: '坎',
  [BaGua.Gen]: '艮',
  [BaGua.Kun]: '坤',
};

/** 八卦符号 */
export const BA_GUA_SYMBOLS: Record<BaGua, string> = {
  [BaGua.Qian]: '☰',
  [BaGua.Dui]: '☱',
  [BaGua.Li]: '☲',
  [BaGua.Zhen]: '☳',
  [BaGua.Xun]: '☴',
  [BaGua.Kan]: '☵',
  [BaGua.Gen]: '☶',
  [BaGua.Kun]: '☷',
};

/** 八卦五行 */
export const BA_GUA_WU_XING: Record<BaGua, WuXing> = {
  [BaGua.Qian]: WuXing.Metal, // 金
  [BaGua.Dui]: WuXing.Metal,  // 金
  [BaGua.Li]: WuXing.Fire,    // 火
  [BaGua.Zhen]: WuXing.Wood,  // 木
  [BaGua.Xun]: WuXing.Wood,   // 木
  [BaGua.Kan]: WuXing.Water,  // 水
  [BaGua.Gen]: WuXing.Earth,  // 土
  [BaGua.Kun]: WuXing.Earth,  // 土
};

/** 八卦描述 */
export const BA_GUA_BRIEFS: Record<BaGua, string> = {
  [BaGua.Qian]: '五行属金，方位为西北，人物为老年男性或当官的。天、父、老人、官贵、头、骨、马、金、宝珠、玉。',
  [BaGua.Dui]: '五行属金，方位为西方，人物为小女儿或少女。泽、少女、舌、妾、肺、羊、毁抓之物、带口之器。',
  [BaGua.Li]: '五行属火，方位南方，人物为二女儿或中年女性。火、雉、日、目、电、中女、甲胄、戈兵、文书。',
  [BaGua.Zhen]: '五行属木，方位为东方，人物为大儿子、军警人员。雷、长男、足、发、龙、百虫、蹄、竹。',
  [BaGua.Xun]: '五行属木，方位东南，人物为大女儿或大儿媳妇。风、长女、僧尼、鸡、股、百禽、百草、香气。',
  [BaGua.Kan]: '五行属水，方位北方，人物为二儿子或中年男性。水、雨雪、工、猪、中男、沟渎、弓轮、耳、血、月。',
  [BaGua.Gen]: '五行属土，方位东北，人物为小儿子或少年男性。山、土、少男、童子、狗、手、指、径路、门阙。',
  [BaGua.Kun]: '五行属土，方位为西南，人物为老年妇女或女主人。地、母、老妇、土、牛、釜、布帛、文章。',
};

// ==================== 三宫结果 ====================

/**
 * 三宫结果接口
 */
export interface SanGong {
  /** 月宫（第一宫）- 代表事情的起因或背景 */
  yueGong: LiuGong;
  /** 日宫（第二宫）- 代表事情的经过或现状 */
  riGong: LiuGong;
  /** 时宫（第三宫）- 代表事情的结果或未来 */
  shiGong: LiuGong;
}

// ==================== 小六壬课盘 ====================

/**
 * 小六壬课盘接口
 */
export interface XiaoLiuRenPan {
  /** 课盘 ID */
  id: number;
  /** 创建者 */
  creator: string;
  /** 创建区块 */
  createdAt: number;
  /** 起课方式 */
  method: DivinationMethod;
  /** 占问事项 CID（IPFS） */
  questionCid?: string;
  /** 起课参数1 */
  param1: number;
  /** 起课参数2 */
  param2: number;
  /** 起课参数3 */
  param3: number;
  /** 农历月 */
  lunarMonth?: number;
  /** 农历日 */
  lunarDay?: number;
  /** 时辰 */
  shiChen?: ShiChen;
  /** 三宫结果 */
  sanGong: SanGong;
  /** 是否公开 */
  isPublic: boolean;
  /** AI 解读 CID */
  aiInterpretationCid?: string;
}

// ==================== 辅助函数 ====================

/**
 * 从小时数计算时辰
 * @param hour 小时（0-23）
 */
export function getShiChenFromHour(hour: number): ShiChen {
  switch (hour) {
    case 23:
    case 0:
      return ShiChen.Zi;
    case 1:
    case 2:
      return ShiChen.Chou;
    case 3:
    case 4:
      return ShiChen.Yin;
    case 5:
    case 6:
      return ShiChen.Mao;
    case 7:
    case 8:
      return ShiChen.Chen;
    case 9:
    case 10:
      return ShiChen.Si;
    case 11:
    case 12:
      return ShiChen.Wu;
    case 13:
    case 14:
      return ShiChen.Wei;
    case 15:
    case 16:
      return ShiChen.Shen;
    case 17:
    case 18:
      return ShiChen.You;
    case 19:
    case 20:
      return ShiChen.Xu;
    default:
      return ShiChen.Hai; // 21, 22
  }
}

/**
 * 计算体用关系
 * @param tiGong 体（人宫/时宫的六宫）
 * @param yongShiChen 用（时辰）
 */
export function calculateTiYongRelation(tiGong: LiuGong, yongShiChen: ShiChen): TiYongRelation {
  const tiWuXing = LIU_GONG_WU_XING[tiGong];
  const tiYinYang = LIU_GONG_YIN_YANG[tiGong];
  const yongWuXing = SHI_CHEN_WU_XING[yongShiChen];
  const yongYinYang = SHI_CHEN_YIN_YANG[yongShiChen];

  // 五行相同的情况
  if (tiWuXing === yongWuXing) {
    return tiYinYang === yongYinYang ? TiYongRelation.BiJian : TiYongRelation.BiZhu;
  }

  // 五行相生相克关系
  const generates = getGenerates(yongWuXing);
  const restrains = getRestrains(tiWuXing);

  if (generates === tiWuXing) return TiYongRelation.YongShengTi;
  if (getGenerates(tiWuXing) === yongWuXing) return TiYongRelation.TiShengYong;
  if (restrains === yongWuXing) return TiYongRelation.TiKeYong;
  if (getRestrains(yongWuXing) === tiWuXing) return TiYongRelation.YongKeTi;

  return TiYongRelation.BiZhu;
}

/** 获取五行相生（我生） */
function getGenerates(wuXing: WuXing): WuXing {
  const generates: Record<WuXing, WuXing> = {
    [WuXing.Wood]: WuXing.Fire,
    [WuXing.Fire]: WuXing.Earth,
    [WuXing.Earth]: WuXing.Metal,
    [WuXing.Metal]: WuXing.Water,
    [WuXing.Water]: WuXing.Wood,
  };
  return generates[wuXing];
}

/** 获取五行相克（我克） */
function getRestrains(wuXing: WuXing): WuXing {
  const restrains: Record<WuXing, WuXing> = {
    [WuXing.Wood]: WuXing.Earth,
    [WuXing.Fire]: WuXing.Metal,
    [WuXing.Earth]: WuXing.Water,
    [WuXing.Metal]: WuXing.Wood,
    [WuXing.Water]: WuXing.Fire,
  };
  return restrains[wuXing];
}

/**
 * 从三宫转化为八卦
 * @param sanGong 三宫结果
 */
export function getBaGuaFromSanGong(sanGong: SanGong): BaGua {
  const yao1 = LIU_GONG_YIN_YANG[sanGong.yueGong]; // 上爻
  const yao2 = LIU_GONG_YIN_YANG[sanGong.riGong];  // 中爻
  const yao3 = LIU_GONG_YIN_YANG[sanGong.shiGong]; // 下爻

  // 阳阳阳 = 乾
  if (yao1 === YinYang.Yang && yao2 === YinYang.Yang && yao3 === YinYang.Yang) return BaGua.Qian;
  // 阴阳阳 = 兑
  if (yao1 === YinYang.Yin && yao2 === YinYang.Yang && yao3 === YinYang.Yang) return BaGua.Dui;
  // 阳阴阳 = 离
  if (yao1 === YinYang.Yang && yao2 === YinYang.Yin && yao3 === YinYang.Yang) return BaGua.Li;
  // 阴阴阳 = 震
  if (yao1 === YinYang.Yin && yao2 === YinYang.Yin && yao3 === YinYang.Yang) return BaGua.Zhen;
  // 阳阳阴 = 巽
  if (yao1 === YinYang.Yang && yao2 === YinYang.Yang && yao3 === YinYang.Yin) return BaGua.Xun;
  // 阴阳阴 = 坎
  if (yao1 === YinYang.Yin && yao2 === YinYang.Yang && yao3 === YinYang.Yin) return BaGua.Kan;
  // 阳阴阴 = 艮
  if (yao1 === YinYang.Yang && yao2 === YinYang.Yin && yao3 === YinYang.Yin) return BaGua.Gen;
  // 阴阴阴 = 坤
  return BaGua.Kun;
}

/**
 * 计算综合吉凶等级
 * @param sanGong 三宫结果
 */
export function calculateFortuneLevel(sanGong: SanGong): number {
  const base = LIU_GONG_FORTUNE_LEVELS[sanGong.shiGong];
  const avg = Math.floor(
    (LIU_GONG_FORTUNE_LEVELS[sanGong.yueGong] +
      LIU_GONG_FORTUNE_LEVELS[sanGong.riGong] +
      LIU_GONG_FORTUNE_LEVELS[sanGong.shiGong]) /
      3
  );
  // 结果占60%，过程占40%
  return Math.floor((base * 6 + avg * 4) / 10);
}

/**
 * 检查是否全吉
 * @param sanGong 三宫结果
 */
export function isAllAuspicious(sanGong: SanGong): boolean {
  return (
    LIU_GONG_IS_AUSPICIOUS[sanGong.yueGong] &&
    LIU_GONG_IS_AUSPICIOUS[sanGong.riGong] &&
    LIU_GONG_IS_AUSPICIOUS[sanGong.shiGong]
  );
}

/**
 * 检查是否全凶
 * @param sanGong 三宫结果
 */
export function isAllInauspicious(sanGong: SanGong): boolean {
  return (
    !LIU_GONG_IS_AUSPICIOUS[sanGong.yueGong] &&
    !LIU_GONG_IS_AUSPICIOUS[sanGong.riGong] &&
    !LIU_GONG_IS_AUSPICIOUS[sanGong.shiGong]
  );
}

/**
 * 检查是否为纯宫（三宫相同）
 * @param sanGong 三宫结果
 */
export function isPure(sanGong: SanGong): boolean {
  return sanGong.yueGong === sanGong.riGong && sanGong.riGong === sanGong.shiGong;
}

/**
 * 从时分计算时刻分
 * @param hour 小时（0-23）
 * @param minute 分钟（0-59）
 */
export function calculateKeAndFen(
  hour: number,
  minute: number
): { shiChen: ShiChen; ke: number; fen: number } {
  const shiChen = getShiChenFromHour(hour);

  // 计算刻数（每时辰8刻，每刻约15分钟）
  const isEvenHour = hour % 2 === 0;
  const quarterInHour = Math.floor(minute / 15);

  let ke: number;
  if (isEvenHour) {
    ke = ((quarterInHour + 4) % 8) + 1;
  } else {
    ke = quarterInHour + 1;
  }

  // 计算分数（1-15）
  const fen = (minute % 15) + 1;

  return { shiChen, ke, fen };
}

/**
 * 格式化三宫显示
 * @param sanGong 三宫结果
 */
export function formatSanGong(sanGong: SanGong): string {
  return `${LIU_GONG_NAMES[sanGong.yueGong]} → ${LIU_GONG_NAMES[sanGong.riGong]} → ${LIU_GONG_NAMES[sanGong.shiGong]}`;
}

/**
 * 获取吉凶等级颜色
 * @param level 吉凶等级（1-5）
 */
export function getFortuneColor(level: number): string {
  if (level >= 4) return '#52c41a'; // 吉 - 绿色
  if (level >= 3) return '#faad14'; // 平 - 黄色
  return '#f5222d'; // 凶 - 红色
}

/**
 * 获取吉凶等级描述
 * @param level 吉凶等级（1-5）
 */
export function getFortuneDescription(level: number): string {
  if (level >= 5) return '大吉';
  if (level >= 4) return '吉';
  if (level >= 3) return '平';
  if (level >= 2) return '凶';
  return '大凶';
}
