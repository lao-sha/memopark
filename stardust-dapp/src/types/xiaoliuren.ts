/**
 * 小六壬类型定义
 *
 * 本模块支持**道家小六壬**和**传统流派**两种体系，两者在五行配属上有所不同：
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

// ==================== 流派定义 ====================

/**
 * 小六壬流派枚举
 *
 * 不同流派在六神的五行配属上有所不同
 */
export enum XiaoLiuRenSchool {
  /** 道家流派 - 留连属土，小吉属水（默认） */
  DaoJia = 0,
  /** 传统流派 - 留连属水，小吉属木 */
  ChuanTong = 1,
}

/** 流派名称 */
export const SCHOOL_NAMES: Record<XiaoLiuRenSchool, string> = {
  [XiaoLiuRenSchool.DaoJia]: '道家流派',
  [XiaoLiuRenSchool.ChuanTong]: '传统流派',
};

/** 流派描述 */
export const SCHOOL_DESCRIPTIONS: Record<XiaoLiuRenSchool, string> = {
  [XiaoLiuRenSchool.DaoJia]: '道家小六壬体系，留连属土临玄武，小吉属水临六合，注重体用关系分析',
  [XiaoLiuRenSchool.ChuanTong]: '传统小六壬体系，留连属水临玄武，小吉属木临六合，注重时辰吉凶判断',
};

// ==================== 子时类型 ====================

/**
 * 子时类型枚举
 *
 * 子时横跨两天，在某些流派中需要区分早子时和晚子时
 */
export enum ZiShiType {
  /** 早子时（夜子时）- 23:00-24:00，属于当天 */
  EarlyZi = 0,
  /** 晚子时（正子时）- 00:00-01:00，属于次日 */
  LateZi = 1,
}

/** 子时类型名称 */
export const ZI_SHI_TYPE_NAMES: Record<ZiShiType, string> = {
  [ZiShiType.EarlyZi]: '早子时',
  [ZiShiType.LateZi]: '晚子时',
};

/** 子时类型别名 */
export const ZI_SHI_TYPE_ALIASES: Record<ZiShiType, string> = {
  [ZiShiType.EarlyZi]: '夜子时',
  [ZiShiType.LateZi]: '正子时',
};

/** 子时类型时间范围 */
export const ZI_SHI_TYPE_RANGES: Record<ZiShiType, string> = {
  [ZiShiType.EarlyZi]: '23:00-24:00',
  [ZiShiType.LateZi]: '00:00-01:00',
};

// ==================== 十二宫定义 ====================

/**
 * 十二宫枚举
 *
 * 六神对应的命理十二宫，每个六神对应一对宫位（外宫/内宫）
 */
export enum TwelvePalace {
  /** 命宫 - 代表自身命运、性格特点 */
  MingGong = 0,
  /** 事业宫 - 代表事业发展、工作状态 */
  ShiYeGong = 1,
  /** 田宅宫 - 代表房产、家庭环境 */
  TianZhaiGong = 2,
  /** 奴仆宫 - 代表下属、仆从关系 */
  NuPuGong = 3,
  /** 感情宫 - 代表感情状态、情感发展 */
  GanQingGong = 4,
  /** 夫妻宫 - 代表婚姻、配偶 */
  FuQiGong = 5,
  /** 疾厄宫 - 代表健康、疾病 */
  JiEGong = 6,
  /** 兄弟宫 - 代表兄弟姐妹、朋友同事 */
  XiongDiGong = 7,
  /** 驿马宫 - 代表出行、变动 */
  YiMaGong = 8,
  /** 子女宫 - 代表子女、晚辈 */
  ZiNvGong = 9,
  /** 福德宫 - 代表福气、精神状态 */
  FuDeGong = 10,
  /** 父母宫 - 代表父母、长辈 */
  FuMuGong = 11,
}

/** 十二宫名称 */
export const TWELVE_PALACE_NAMES: Record<TwelvePalace, string> = {
  [TwelvePalace.MingGong]: '命宫',
  [TwelvePalace.ShiYeGong]: '事业宫',
  [TwelvePalace.TianZhaiGong]: '田宅宫',
  [TwelvePalace.NuPuGong]: '奴仆宫',
  [TwelvePalace.GanQingGong]: '感情宫',
  [TwelvePalace.FuQiGong]: '夫妻宫',
  [TwelvePalace.JiEGong]: '疾厄宫',
  [TwelvePalace.XiongDiGong]: '兄弟宫',
  [TwelvePalace.YiMaGong]: '驿马宫',
  [TwelvePalace.ZiNvGong]: '子女宫',
  [TwelvePalace.FuDeGong]: '福德宫',
  [TwelvePalace.FuMuGong]: '父母宫',
};

/** 十二宫描述 */
export const TWELVE_PALACE_DESCRIPTIONS: Record<TwelvePalace, string> = {
  [TwelvePalace.MingGong]: '代表自身命运、性格特点、整体运势',
  [TwelvePalace.ShiYeGong]: '代表事业发展、工作状态、官运仕途',
  [TwelvePalace.TianZhaiGong]: '代表房产置业、家庭环境、安居状况',
  [TwelvePalace.NuPuGong]: '代表下属仆从、支配欲望、阴暗私事',
  [TwelvePalace.GanQingGong]: '代表感情状态、情感发展、桃花运势',
  [TwelvePalace.FuQiGong]: '代表婚姻状况、配偶信息、夫妻关系',
  [TwelvePalace.JiEGong]: '代表健康状况、疾病灾祸、外部伤害',
  [TwelvePalace.XiongDiGong]: '代表兄弟姐妹、朋友同事、人际关系',
  [TwelvePalace.YiMaGong]: '代表出行远行、变动迁移、交通运势',
  [TwelvePalace.ZiNvGong]: '代表子女晚辈、生育状况、子孙运势',
  [TwelvePalace.FuDeGong]: '代表福气福报、精神状态、内心修养',
  [TwelvePalace.FuMuGong]: '代表父母长辈、祖业遗产、根基来源',
};

/** 宫位对（外宫/内宫） */
export interface PalacePair {
  /** 外宫（动态宫，表现在外） */
  outer: TwelvePalace;
  /** 内宫（静态宫，表现在内） */
  inner: TwelvePalace;
}

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

/** 六宫吉凶值（正数为吉，负数为凶，0为平） */
export const LIU_GONG_JI_XIONG: Record<LiuGong, number> = {
  [LiuGong.DaAn]: 2,      // 大吉
  [LiuGong.SuXi]: 1,      // 吉
  [LiuGong.XiaoJi]: 1,    // 吉
  [LiuGong.LiuLian]: 0,   // 平
  [LiuGong.ChiKou]: -1,   // 凶
  [LiuGong.KongWang]: -2, // 大凶
};

/** 六宫事项断语 */
export const LIU_GONG_AFFAIR_READINGS: Record<LiuGong, Record<string, string>> = {
  [LiuGong.DaAn]: {
    '求财': '财运稳定，求财可得，宜稳妥保守',
    '婚姻': '感情稳定，婚姻可成，宜静待良缘',
    '出行': '行人未动，出行宜缓，安居为上',
    '疾病': '病情平稳，无大碍，宜调养身心',
    '失物': '失物在近处，可以找回',
    '官司': '官事宜静不宜动，可化解',
  },
  [LiuGong.LiuLian]: {
    '求财': '财运迟缓，事多拖延，需耐心等待',
    '婚姻': '感情纠缠，婚事延迟，需多加考虑',
    '出行': '行人未归，出行多阻，不宜远行',
    '疾病': '病情反复，久病难愈，需细心调养',
    '失物': '失物难寻，或被他人转移',
    '官司': '官事缠身，宜缓不宜急',
  },
  [LiuGong.SuXi]: {
    '求财': '财运亨通，速见喜事，宜积极进取',
    '婚姻': '喜事将近，婚姻可成，良缘天定',
    '出行': '行人将至，出行顺利，逢凶化吉',
    '疾病': '病情好转，速愈可期，吉人天相',
    '失物': '失物可寻回，午未申时见',
    '官司': '官事有福德，逢凶化吉',
  },
  [LiuGong.ChiKou]: {
    '求财': '财运不佳，易有口舌，慎防小人',
    '婚姻': '感情多争执，婚事有变，需三思',
    '出行': '行人有惊，出行不利，宜谨慎',
    '疾病': '病情凶险，需速求医，注意口腔',
    '失物': '失物难回，或有人争夺',
    '官司': '官事凶险，有口舌是非，宜和解',
  },
  [LiuGong.XiaoJi]: {
    '求财': '财运吉祥，事事顺遂，宜把握时机',
    '婚姻': '良缘美满，婚姻大吉，百年好合',
    '出行': '行人即至，出行大吉，诸事顺利',
    '疾病': '病情可愈，得遇良医，吉祥如意',
    '失物': '失物可得，在西南方',
    '官司': '官事和顺，可得贵人相助',
  },
  [LiuGong.KongWang]: {
    '求财': '财运空虚，求财无望，不宜投资',
    '婚姻': '感情虚空，婚事难成，缘分未到',
    '出行': '行人有灾，出行不利，宜取消计划',
    '疾病': '病情严重，需防暗疾，多加小心',
    '失物': '失物难寻，永无音讯',
    '官司': '官事有刑伤，难以解脱',
  },
};

// ==================== 六神扩展属性 ====================

/** 六神对应十二宫位对（外宫/内宫） */
export const LIU_GONG_TWELVE_PALACE: Record<LiuGong, PalacePair> = {
  [LiuGong.DaAn]: { outer: TwelvePalace.ShiYeGong, inner: TwelvePalace.MingGong },
  [LiuGong.LiuLian]: { outer: TwelvePalace.TianZhaiGong, inner: TwelvePalace.NuPuGong },
  [LiuGong.SuXi]: { outer: TwelvePalace.GanQingGong, inner: TwelvePalace.FuQiGong },
  [LiuGong.ChiKou]: { outer: TwelvePalace.JiEGong, inner: TwelvePalace.XiongDiGong },
  [LiuGong.XiaoJi]: { outer: TwelvePalace.YiMaGong, inner: TwelvePalace.ZiNvGong },
  [LiuGong.KongWang]: { outer: TwelvePalace.FuDeGong, inner: TwelvePalace.FuMuGong },
};

/** 六神藏干 */
export const LIU_GONG_HIDDEN_STEMS: Record<LiuGong, [string, string]> = {
  [LiuGong.DaAn]: ['甲', '丁'],
  [LiuGong.LiuLian]: ['丁', '己'],
  [LiuGong.SuXi]: ['丙', '辛'],
  [LiuGong.ChiKou]: ['庚', '癸'],
  [LiuGong.XiaoJi]: ['壬', '甲'],
  [LiuGong.KongWang]: ['戊', '乙'],
};

/** 六神对应天干 */
export const LIU_GONG_TIAN_GAN: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '甲乙',
  [LiuGong.LiuLian]: '戊己',   // 道家流派（土）
  [LiuGong.SuXi]: '丙丁',
  [LiuGong.ChiKou]: '庚辛',
  [LiuGong.XiaoJi]: '壬癸',    // 道家流派（水）
  [LiuGong.KongWang]: '戊己',
};

/** 六神对应季节 */
export const LIU_GONG_SEASONS: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '春季',
  [LiuGong.LiuLian]: '春夏之交',
  [LiuGong.SuXi]: '夏季',
  [LiuGong.ChiKou]: '秋季',
  [LiuGong.XiaoJi]: '冬季',
  [LiuGong.KongWang]: '冬春之交',
};

/** 六神对应月份（地支月） */
export const LIU_GONG_MONTHS: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '寅卯辰月',
  [LiuGong.LiuLian]: '辰巳月',
  [LiuGong.SuXi]: '巳午未月',
  [LiuGong.ChiKou]: '申酉戌月',
  [LiuGong.XiaoJi]: '亥子丑月',
  [LiuGong.KongWang]: '丑寅月',
};

/** 六神对应数字范围 */
export const LIU_GONG_NUMBERS: Record<LiuGong, [number, number, number, number]> = {
  [LiuGong.DaAn]: [1, 7, 4, 5],
  [LiuGong.LiuLian]: [2, 8, 7, 8],
  [LiuGong.SuXi]: [3, 9, 6, 9],
  [LiuGong.ChiKou]: [4, 10, 1, 2],
  [LiuGong.XiaoJi]: [5, 11, 3, 8],
  [LiuGong.KongWang]: [6, 12, 5, 10],
};

/** 六神详细解释 */
export const LIU_GONG_DETAILED_EXPLANATIONS: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '大安事事昌，求财在坤方，失物去不远，宅舍保安康，行人身未动，病者主无妨。将军回田野，仔细与推详，丢失在附近，可能西南向，安居得吉日，不可动身祥。办事别出屋，求借邀自房，得病凶化吉，久疾得安康，寻人知音信，可能归村庄。口舌能消散，远行要提防，交易别出村，离屯细推详，求财有八分，得全不出房。',
  [LiuGong.LiuLian]: '留连事未当，求事日莫光，凡事只宜缓，去者未回向，失物南方去，急急行便访。紧记防口舌，人口且平祥，丢失难寻找，窃者又转场，出行定不归，久去拖延长。办事不果断，牵连又返往，求借不易成，被求而彷徨，此日患疾病，几天不复康。找人迷雾中，迷迷又恍惚，口舌继续有，拖拉又伸长，女方嫁吉日，求财六分量。',
  [LiuGong.SuXi]: '速喜喜临乡，求财往南方，失物申午未，逢人路寻详，官事有福德，病者无大伤。六畜田稼庆，行人有音向，丢失得音信，微乐在面上，出行遇吉利，小喜而顺当。办事如逢春，吉利又荣光，小量可求借，大事难全强，久病见小愈，得病速回康，寻人得知见，口舌见消亡，交易可得成，但不太久长，求财有十分，吉时得顺当。',
  [LiuGong.ChiKou]: '赤口主口伤，官事且紧防，失物急去找，行人有惊慌，鸡犬多作怪，病者上西方。更须防咒咀，恐怕染瘟殃，找物犯谎口，寻问无音向，出门千口怨，言谈万骂伤。办事犯口舌，难成有阻挡，求借不全顺，闭口无事张，得病千口猜，求医还无妨。寻人得凶音，人心不安详，口舌犯最重，交易口舌防，求财只四分，逢吉才成当。',
  [LiuGong.XiaoJi]: '小吉最吉昌，路上好商量，阴人来报喜，失物在坤方，行人立刻至，交易甚是强。凡事皆合好，病者保安康，大吉又大顺，万事如意详，出行可得喜，千里吉安祥。诸事可心顺，有忧皆消光，求借自来助，众友愿相帮，重病莫要愁，久病得安康。不见得相见，不打自归庄，千人称赞君，无限上荣光，交易成兴隆，十二分财量。',
  [LiuGong.KongWang]: '空亡事不长，阴人无主张，求财心白费，行人有灾殃，失物永不见，官事有刑伤。病人逢邪鬼，久病添祸殃，失物难找见，找寻空荡荡，出行不吉利，凶多不吉祥。办事凶为多，处处有阻挡，求借不能成，成事化败伤，得病凶多噩，久患雪加霜。寻人无音信，知音变空想，万口都诽骂，小舟遭狂浪，求财有二分，不吉不利亡。',
};

/** 传统流派六神五行 */
export const LIU_GONG_WU_XING_TRADITIONAL: Record<LiuGong, WuXing> = {
  [LiuGong.DaAn]: WuXing.Wood,     // 木
  [LiuGong.LiuLian]: WuXing.Water, // 水（传统流派）
  [LiuGong.SuXi]: WuXing.Fire,     // 火
  [LiuGong.ChiKou]: WuXing.Metal,  // 金
  [LiuGong.XiaoJi]: WuXing.Wood,   // 木（传统流派）
  [LiuGong.KongWang]: WuXing.Earth,// 土
};

/** 传统流派六神方位 */
export const LIU_GONG_DIRECTIONS_TRADITIONAL: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '东方',
  [LiuGong.LiuLian]: '北方',   // 传统流派：北方（水）
  [LiuGong.SuXi]: '南方',
  [LiuGong.ChiKou]: '西方',
  [LiuGong.XiaoJi]: '东方',    // 传统流派：东方（木）
  [LiuGong.KongWang]: '中央',
};

/** 传统流派六神颜色 */
export const LIU_GONG_COLORS_TRADITIONAL: Record<LiuGong, string> = {
  [LiuGong.DaAn]: '#52c41a',     // 青色 - 木
  [LiuGong.LiuLian]: '#1890ff',  // 蓝色 - 水（传统流派）
  [LiuGong.SuXi]: '#f5222d',     // 红色 - 火
  [LiuGong.ChiKou]: '#ffffff',   // 白色 - 金
  [LiuGong.XiaoJi]: '#52c41a',   // 青色 - 木（传统流派）
  [LiuGong.KongWang]: '#faad14', // 黄色 - 土
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

/** 体用关系颜色（页面使用的别名） */
export const TI_YONG_RELATION_COLORS: Record<TiYongRelation, string> = TI_YONG_COLORS;

/** 体用关系详细描述 */
export const TI_YONG_DESCRIPTIONS: Record<TiYongRelation, string> = {
  [TiYongRelation.YongShengTi]: '外部环境对自身有利，时机成熟，贵人相助，事情顺利',
  [TiYongRelation.TiKeYong]: '自身能力强于环境阻力，可以克服困难，成事有望',
  [TiYongRelation.BiJian]: '五行相同阴阳相同，力量均衡，结果平平，需靠自身努力',
  [TiYongRelation.BiZhu]: '五行相同阴阳不同，有助力但有限，中规中矩',
  [TiYongRelation.TiShengYong]: '自身精力外泄于环境，付出多回报少，劳而无功',
  [TiYongRelation.YongKeTi]: '外部环境克制自身，阻碍重重，不宜行事，需等待时机',
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
 *
 * 支持两种调用方式：
 * 1. calculateTiYongRelation(sanGong) - 传入三宫，月宫为体，时宫为用
 * 2. calculateTiYongRelation(tiGong, yongShiChen) - 传入体宫和时辰
 *
 * @param tiGongOrSanGong 体宫或三宫结果
 * @param yongShiChen 用（时辰），当第一个参数为三宫时可省略
 */
export function calculateTiYongRelation(sanGong: SanGong): TiYongRelation;
export function calculateTiYongRelation(tiGong: LiuGong, yongShiChen: ShiChen): TiYongRelation;
export function calculateTiYongRelation(tiGongOrSanGong: LiuGong | SanGong, yongShiChen?: ShiChen): TiYongRelation {
  let tiWuXing: WuXing;
  let tiYinYang: YinYang;
  let yongWuXing: WuXing;
  let yongYinYang: YinYang;

  // 判断是三宫还是单独的六宫
  if (typeof tiGongOrSanGong === 'object' && 'yueGong' in tiGongOrSanGong) {
    // 传入的是 SanGong，月宫为体，时宫为用
    const sanGong = tiGongOrSanGong;
    tiWuXing = LIU_GONG_WU_XING[sanGong.yueGong];
    tiYinYang = LIU_GONG_YIN_YANG[sanGong.yueGong];
    yongWuXing = LIU_GONG_WU_XING[sanGong.shiGong];
    yongYinYang = LIU_GONG_YIN_YANG[sanGong.shiGong];
  } else {
    // 传入的是 LiuGong 和 ShiChen
    tiWuXing = LIU_GONG_WU_XING[tiGongOrSanGong as LiuGong];
    tiYinYang = LIU_GONG_YIN_YANG[tiGongOrSanGong as LiuGong];
    yongWuXing = SHI_CHEN_WU_XING[yongShiChen!];
    yongYinYang = SHI_CHEN_YIN_YANG[yongShiChen!];
  }

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

// ==================== 流派相关辅助函数 ====================

/**
 * 根据流派获取六神五行
 * @param gong 六神
 * @param school 流派（默认道家流派）
 */
export function getLiuGongWuXingBySchool(gong: LiuGong, school: XiaoLiuRenSchool = XiaoLiuRenSchool.DaoJia): WuXing {
  if (school === XiaoLiuRenSchool.ChuanTong) {
    return LIU_GONG_WU_XING_TRADITIONAL[gong];
  }
  return LIU_GONG_WU_XING[gong];
}

/**
 * 根据流派获取六神方位
 * @param gong 六神
 * @param school 流派（默认道家流派）
 */
export function getLiuGongDirectionBySchool(gong: LiuGong, school: XiaoLiuRenSchool = XiaoLiuRenSchool.DaoJia): string {
  if (school === XiaoLiuRenSchool.ChuanTong) {
    return LIU_GONG_DIRECTIONS_TRADITIONAL[gong];
  }
  return LIU_GONG_DIRECTIONS[gong];
}

/**
 * 根据流派获取六神颜色
 * @param gong 六神
 * @param school 流派（默认道家流派）
 */
export function getLiuGongColorBySchool(gong: LiuGong, school: XiaoLiuRenSchool = XiaoLiuRenSchool.DaoJia): string {
  if (school === XiaoLiuRenSchool.ChuanTong) {
    return LIU_GONG_COLORS_TRADITIONAL[gong];
  }
  return LIU_GONG_COLORS[gong];
}

/**
 * 从小时数计算时辰，并返回子时类型（如果是子时）
 * @param hour 小时（0-23）
 */
export function getShiChenFromHourDetailed(hour: number): { shiChen: ShiChen; ziShiType: ZiShiType | null } {
  const shiChen = getShiChenFromHour(hour);
  let ziShiType: ZiShiType | null = null;

  if (hour === 23) {
    ziShiType = ZiShiType.EarlyZi;
  } else if (hour === 0) {
    ziShiType = ZiShiType.LateZi;
  }

  return { shiChen, ziShiType };
}

/**
 * 获取六神的十二宫信息
 * @param gong 六神
 */
export function getLiuGongPalaceInfo(gong: LiuGong): {
  palacePair: PalacePair;
  outerName: string;
  innerName: string;
  outerDesc: string;
  innerDesc: string;
} {
  const palacePair = LIU_GONG_TWELVE_PALACE[gong];
  return {
    palacePair,
    outerName: TWELVE_PALACE_NAMES[palacePair.outer],
    innerName: TWELVE_PALACE_NAMES[palacePair.inner],
    outerDesc: TWELVE_PALACE_DESCRIPTIONS[palacePair.outer],
    innerDesc: TWELVE_PALACE_DESCRIPTIONS[palacePair.inner],
  };
}

/**
 * 获取六神的完整信息
 * @param gong 六神
 * @param school 流派（默认道家流派）
 */
export function getLiuGongFullInfo(gong: LiuGong, school: XiaoLiuRenSchool = XiaoLiuRenSchool.DaoJia): {
  name: string;
  wuXing: WuXing;
  wuXingName: string;
  yinYang: YinYang;
  yinYangName: string;
  direction: string;
  color: string;
  tianJiang: string;
  fortuneLevel: number;
  isAuspicious: boolean;
  brief: string;
  guaCi: string;
  detailedExplanation: string;
  hiddenStems: [string, string];
  tianGan: string;
  season: string;
  months: string;
  numbers: [number, number, number, number];
  palaceInfo: ReturnType<typeof getLiuGongPalaceInfo>;
} {
  const wuXing = getLiuGongWuXingBySchool(gong, school);
  const palaceInfo = getLiuGongPalaceInfo(gong);

  return {
    name: LIU_GONG_NAMES[gong],
    wuXing,
    wuXingName: WU_XING_NAMES[wuXing],
    yinYang: LIU_GONG_YIN_YANG[gong],
    yinYangName: YIN_YANG_NAMES[LIU_GONG_YIN_YANG[gong]],
    direction: getLiuGongDirectionBySchool(gong, school),
    color: getLiuGongColorBySchool(gong, school),
    tianJiang: LIU_GONG_TIAN_JIANG[gong],
    fortuneLevel: LIU_GONG_FORTUNE_LEVELS[gong],
    isAuspicious: LIU_GONG_IS_AUSPICIOUS[gong],
    brief: LIU_GONG_BRIEFS[gong],
    guaCi: LIU_GONG_GUA_CI[gong],
    detailedExplanation: LIU_GONG_DETAILED_EXPLANATIONS[gong],
    hiddenStems: LIU_GONG_HIDDEN_STEMS[gong],
    tianGan: LIU_GONG_TIAN_GAN[gong],
    season: LIU_GONG_SEASONS[gong],
    months: LIU_GONG_MONTHS[gong],
    numbers: LIU_GONG_NUMBERS[gong],
    palaceInfo,
  };
}
