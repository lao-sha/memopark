/**
 * 卦象详情页面
 *
 * 显示卦象的完整信息，包括：
 * - 本卦和变卦展示
 * - 体用关系分析
 * - 五行生克
 * - AI 解读入口
 * - 大师服务入口
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Divider,
  Spin,
  Tag,
  Space,
  message,
  Modal,
  Row,
  Col,
  Descriptions,
  Result,
} from 'antd';
import {
  ArrowRightOutlined,
  RobotOutlined,
  UserOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import {
  getHexagram,
  archiveHexagram,
  getInterpretationRequest,
  getInterpretationResult,
  getHexagramDetail,
  getInterpretationData,
  getAiInterpretationResult,
} from '../../services/meihuaService';
import type { Hexagram, InterpretationResult, FullDivinationDetail, InterpretationData, AiInterpretationResultData } from '../../types/meihua';
import {
  Trigram,
  WuXing,
  DivinationMethod,
  HexagramStatus,
  TRIGRAM_NAMES,
  TRIGRAM_SYMBOLS,
  TRIGRAM_MEANINGS,
  WUXING_NAMES,
  WANGSHUAI_NAMES,
  FORTUNE_NAMES,
  GENDER_NAMES,
  DIVINATION_CATEGORY_NAMES,
  getHexagramName,
  formatLunarHour,
} from '../../types/meihua';
import { CreateBountyModal } from '../bounty/components/CreateBountyModal';
import { DivinationType } from '../../types/divination';
import './MeihuaPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 体用关系字符串枚举到中文名称的映射
 */
const TIYONG_RELATION_MAP: Record<string, string> = {
  'BiHe': '比和',
  'YongShengTi': '用生体',
  'TiShengYong': '体生用',
  'YongKeTi': '用克体',
  'TiKeYong': '体克用',
};

/**
 * 五行字符串枚举到数字的映射
 */
const WUXING_STRING_MAP: Record<string, WuXing> = {
  'Mu': WuXing.Wood,
  'Huo': WuXing.Fire,
  'Tu': WuXing.Earth,
  'Jin': WuXing.Metal,
  'Shui': WuXing.Water,
};

/**
 * 旺衰字符串枚举到数字的映射
 */
const WANGSHUAI_STRING_MAP: Record<string, number> = {
  'Wang': 0,
  'Xiang': 1,
  'Xiu': 2,
  'Qiu': 3,
  'Si': 4,
};

/**
 * 吉凶字符串枚举到数字的映射
 */
const FORTUNE_STRING_MAP: Record<string, number> = {
  'DaXiong': 0,
  'XiaoXiong': 1,
  'Ping': 2,
  'XiaoJi': 3,
  'DaJi': 4,
};

/**
 * 辅助函数：从后端数据中安全获取字段值（兼容 snake_case 和 camelCase）
 */
function getFieldValue(obj: any, camelCaseName: string, snakeCaseName: string) {
  return obj?.[camelCaseName] ?? obj?.[snakeCaseName];
}

/**
 * 辅助函数：规范化解卦数据（将 snake_case 转为 camelCase）
 */
function normalizeInterpretationData(data: any): any {
  if (!data) return null;

  // 规范化 basicInfo
  const basicInfo = getFieldValue(data, 'basicInfo', 'basic_info');
  const normalizedBasicInfo = basicInfo ? {
    timestamp: basicInfo.timestamp,
    lunarDate: getFieldValue(basicInfo, 'lunarDate', 'lunar_date'),
    method: basicInfo.method,
    gender: basicInfo.gender,
    category: basicInfo.category,
  } : null;

  // 规范化 tiyongAnalysis
  const tiyongAnalysis = getFieldValue(data, 'tiyongAnalysis', 'tiyong_analysis');
  const normalizedTiyongAnalysis = tiyongAnalysis ? {
    tiWuxing: typeof tiyongAnalysis.tiWuxing === 'string'
      ? WUXING_STRING_MAP[tiyongAnalysis.tiWuxing] ?? tiyongAnalysis.tiWuxing
      : getFieldValue(tiyongAnalysis, 'tiWuxing', 'ti_wuxing'),
    yongWuxing: typeof tiyongAnalysis.yongWuxing === 'string'
      ? WUXING_STRING_MAP[tiyongAnalysis.yongWuxing] ?? tiyongAnalysis.yongWuxing
      : getFieldValue(tiyongAnalysis, 'yongWuxing', 'yong_wuxing'),
    benGuaRelation: getFieldValue(tiyongAnalysis, 'benGuaRelation', 'ben_gua_relation'),
    benGuaRelationName: typeof tiyongAnalysis.benGuaRelation === 'string'
      ? TIYONG_RELATION_MAP[tiyongAnalysis.benGuaRelation] ?? tiyongAnalysis.benGuaRelation
      : undefined,
    bianGuaRelation: getFieldValue(tiyongAnalysis, 'bianGuaRelation', 'bian_gua_relation'),
    bianGuaRelationName: typeof tiyongAnalysis.bianGuaRelation === 'string'
      ? TIYONG_RELATION_MAP[tiyongAnalysis.bianGuaRelation] ?? tiyongAnalysis.bianGuaRelation
      : undefined,
    huGuaRelation: getFieldValue(tiyongAnalysis, 'huGuaRelation', 'hu_gua_relation'),
    huGuaRelationName: typeof tiyongAnalysis.huGuaRelation === 'string'
      ? TIYONG_RELATION_MAP[tiyongAnalysis.huGuaRelation] ?? tiyongAnalysis.huGuaRelation
      : undefined,
    tiWangshuai: typeof tiyongAnalysis.tiWangshuai === 'string'
      ? WANGSHUAI_STRING_MAP[tiyongAnalysis.tiWangshuai] ?? tiyongAnalysis.tiWangshuai
      : getFieldValue(tiyongAnalysis, 'tiWangshuai', 'ti_wangshuai'),
    fortune: typeof tiyongAnalysis.fortune === 'string'
      ? FORTUNE_STRING_MAP[tiyongAnalysis.fortune] ?? tiyongAnalysis.fortune
      : tiyongAnalysis.fortune,
    fortuneLevel: getFieldValue(tiyongAnalysis, 'fortuneLevel', 'fortune_level'),
  } : null;

  // 规范化 yingqiAnalysis
  const yingqiAnalysis = getFieldValue(data, 'yingqiAnalysis', 'yingqi_analysis');
  const normalizedYingqiAnalysis = yingqiAnalysis ? {
    tiGuaNum: getFieldValue(yingqiAnalysis, 'tiGuaNum', 'ti_gua_num'),
    yongGuaNum: getFieldValue(yingqiAnalysis, 'yongGuaNum', 'yong_gua_num'),
    primaryNum: getFieldValue(yingqiAnalysis, 'primaryNum', 'primary_num'),
    secondaryNums: getFieldValue(yingqiAnalysis, 'secondaryNums', 'secondary_nums'),
    shengTiWuxing: typeof yingqiAnalysis.shengTiWuxing === 'string'
      ? WUXING_STRING_MAP[yingqiAnalysis.shengTiWuxing] ?? yingqiAnalysis.shengTiWuxing
      : getFieldValue(yingqiAnalysis, 'shengTiWuxing', 'sheng_ti_wuxing'),
    keTiWuxing: typeof yingqiAnalysis.keTiWuxing === 'string'
      ? WUXING_STRING_MAP[yingqiAnalysis.keTiWuxing] ?? yingqiAnalysis.keTiWuxing
      : getFieldValue(yingqiAnalysis, 'keTiWuxing', 'ke_ti_wuxing'),
    analysis: yingqiAnalysis.analysis,
  } : null;

  // 规范化 hexagramCore
  const hexagramCore = getFieldValue(data, 'hexagramCore', 'hexagram_core');

  // 规范化 auxiliaryHexagrams
  const auxiliaryHexagrams = getFieldValue(data, 'auxiliaryHexagrams', 'auxiliary_hexagrams');

  return {
    basicInfo: normalizedBasicInfo,
    hexagramCore,
    tiyongAnalysis: normalizedTiyongAnalysis,
    yingqiAnalysis: normalizedYingqiAnalysis,
    auxiliaryHexagrams,
  };
}

/**
 * 八卦对应的五行
 */
const TRIGRAM_WUXING: Record<Trigram, WuXing> = {
  [Trigram.Qian]: WuXing.Metal,
  [Trigram.Dui]: WuXing.Metal,
  [Trigram.Li]: WuXing.Fire,
  [Trigram.Zhen]: WuXing.Wood,
  [Trigram.Xun]: WuXing.Wood,
  [Trigram.Kan]: WuXing.Water,
  [Trigram.Gen]: WuXing.Earth,
  [Trigram.Kun]: WuXing.Earth,
};

/**
 * 五行生克关系
 */
const WUXING_RELATIONS: Record<WuXing, { generates: WuXing; overcomes: WuXing }> = {
  [WuXing.Wood]: { generates: WuXing.Fire, overcomes: WuXing.Earth },
  [WuXing.Fire]: { generates: WuXing.Earth, overcomes: WuXing.Metal },
  [WuXing.Earth]: { generates: WuXing.Metal, overcomes: WuXing.Water },
  [WuXing.Metal]: { generates: WuXing.Water, overcomes: WuXing.Wood },
  [WuXing.Water]: { generates: WuXing.Wood, overcomes: WuXing.Fire },
};

/**
 * 起卦方式名称
 */
const METHOD_NAMES: Record<DivinationMethod, string> = {
  [DivinationMethod.Time]: '时间起卦',
  [DivinationMethod.Number]: '数字起卦',
  [DivinationMethod.Text]: '文字起卦',
  [DivinationMethod.Random]: '随机起卦',
};

/**
 * 卦象状态名称
 */
const STATUS_NAMES: Record<HexagramStatus, string> = {
  [HexagramStatus.Active]: '有效',
  [HexagramStatus.Archived]: '已归档',
  [HexagramStatus.Deleted]: '已删除',
};

/**
 * 获取五行生克关系描述
 */
function getWuxingRelation(bodyWuxing: WuXing, funcWuxing: WuXing): { relation: string; favorable: boolean } {
  if (bodyWuxing === funcWuxing) {
    return { relation: '比和', favorable: true };
  }

  // 用生体（吉）
  if (WUXING_RELATIONS[funcWuxing].generates === bodyWuxing) {
    return { relation: '用生体', favorable: true };
  }

  // 体生用（泄）
  if (WUXING_RELATIONS[bodyWuxing].generates === funcWuxing) {
    return { relation: '体生用', favorable: false };
  }

  // 用克体（凶）
  if (WUXING_RELATIONS[funcWuxing].overcomes === bodyWuxing) {
    return { relation: '用克体', favorable: false };
  }

  // 体克用（耗）
  if (WUXING_RELATIONS[bodyWuxing].overcomes === funcWuxing) {
    return { relation: '体克用', favorable: true };
  }

  return { relation: '未知', favorable: false };
}

/**
 * 获取详细的体用关系文字解读
 */
function getDetailedTiyongInterpretation(
  bodyTrigram: Trigram,
  functionTrigram: Trigram,
  bodyWuxing: WuXing,
  funcWuxing: WuXing,
  relation: { relation: string; favorable: boolean }
): string {
  const bodyName = TRIGRAM_NAMES[bodyTrigram];
  const funcName = TRIGRAM_NAMES[functionTrigram];
  const bodyMeaning = TRIGRAM_MEANINGS[bodyTrigram];
  const funcMeaning = TRIGRAM_MEANINGS[functionTrigram];
  const bodyWuxingName = WUXING_NAMES[bodyWuxing];
  const funcWuxingName = WUXING_NAMES[funcWuxing];

  let interpretation = `体卦为${bodyName}（${bodyMeaning}），五行属${bodyWuxingName}，代表自身状态；用卦为${funcName}（${funcMeaning}），五行属${funcWuxingName}，代表所占之事。`;

  // 根据体用关系给出详细解释
  switch (relation.relation) {
    case '用生体':
      interpretation += `\n\n体用关系为"用生体"，大吉之象。用卦${funcWuxingName}生体卦${bodyWuxingName}，表示外部环境有利于自身发展，所问之事能够助益于己，遇事多有贵人相助，顺水推舟之象。此卦利于求谋、合作、交易等事宜。`;
      break;
    case '体克用':
      interpretation += `\n\n体用关系为"体克用"，次吉之象。体卦${bodyWuxingName}克用卦${funcWuxingName}，表示自身能够掌控局面，所谋之事在自己掌握之中，但需付出一定精力。事情虽可成，但需主动出击，积极进取方能成功。`;
      break;
    case '比和':
      interpretation += `\n\n体用关系为"比和"，中平之象。体卦与用卦五行相同，皆为${bodyWuxingName}，表示事情发展平稳，无大起大落。能成能败，需看其他因素配合。宜守成不宜冒进，稳扎稳打为上策。`;
      break;
    case '体生用':
      interpretation += `\n\n体用关系为"体生用"，小凶之象。体卦${bodyWuxingName}生用卦${funcWuxingName}，表示自身付出多而得益少，泄气之象。所谋之事需要自己不断投入，容易感到疲惫，且未必能得到相应回报。宜谨慎行事，量力而为。`;
      break;
    case '用克体':
      interpretation += `\n\n体用关系为"用克体"，大凶之象。用卦${funcWuxingName}克体卦${bodyWuxingName}，表示外部环境对自身不利，所问之事可能对己造成损害，阻力重重。此时宜静不宜动，避免冲突，待时机成熟再行动。`;
      break;
    default:
      interpretation += `\n\n体用关系待定，需结合其他卦象综合判断。`;
  }

  return interpretation;
}

/**
 * 获取卦象的象义解读
 */
function getHexagramMeaningInterpretation(
  upperTrigram: Trigram,
  lowerTrigram: Trigram,
  hexagramName: string
): string {
  const upperMeaning = TRIGRAM_MEANINGS[upperTrigram];
  const lowerMeaning = TRIGRAM_MEANINGS[lowerTrigram];
  const upperName = TRIGRAM_NAMES[upperTrigram];
  const lowerName = TRIGRAM_NAMES[lowerTrigram];

  const meanings: Record<string, string> = {
    '乾为天': `上下皆乾，纯阳之卦。天行健，君子以自强不息。此卦象征刚健、进取，大吉大利，万事亨通。但需警惕过刚则折，刚柔并济方为上策。`,
    '坤为地': `上下皆坤，纯阴之卦。地势坤，君子以厚德载物。此卦象征柔顺、承载，利于守成，不宜进取。以柔克刚，厚积薄发。`,
    '水雷屯': `上坎下震，如雷雨初动。万物始生，艰难险阻。创业之初，困难重重，但前景光明。宜坚守正道，广纳贤才。`,
    '山水蒙': `上艮下坎，山下有险。蒙昧未开，需要启蒙。求学问道之象，宜虚心求教，勿急于求成。`,
    '水天需': `上坎下乾，云上于天。等待时机，需要耐心。事情尚未成熟，不可妄动，静待良机。`,
    '天水讼': `上乾下坎，天与水违行。争讼之象，不利和合。宜和解息讼，避免对抗升级。`,
    '地水师': `上坤下坎，地中有水。统兵之象，需要纪律。做事需有条理，统筹规划，方能成功。`,
    '水地比': `上坎下坤，水在地上。亲比之象，团结合作。宜广结善缘，互助互利。`,
  };

  // 如果有预定义的卦象解释，则使用
  if (meanings[hexagramName]) {
    return `【${hexagramName}】${meanings[hexagramName]}`;
  }

  // 否则根据上下卦组合给出通用解释
  return `【${hexagramName}】上卦为${upperName}（${upperMeaning}），下卦为${lowerName}（${lowerMeaning}）。上${upperMeaning}下${lowerMeaning}之象，需综合上下卦的性质来判断吉凶。`;
}

/**
 * 生成综合解读建议
 */
function getComprehensiveInterpretation(
  hexagram: Hexagram,
  interpretationData: any | null,
  relation: { relation: string; favorable: boolean }
): string {
  let interpretation = '';

  // 数据已经被规范化，直接使用 camelCase
  const tiyongAnalysis = interpretationData?.tiyongAnalysis;

  // 1. 总体吉凶判断
  if (tiyongAnalysis?.fortune !== undefined) {
    const fortuneLevel = tiyongAnalysis.fortuneLevel || 2;
    const fortune = tiyongAnalysis.fortune;
    const fortuneName = FORTUNE_NAMES[fortune] || '中平';

    interpretation += `【总体判断】${fortuneName}\n\n`;

    if (fortuneLevel >= 3) {
      interpretation += `此卦整体吉利，所占之事顺遂，多有成功之象。`;
    } else if (fortuneLevel === 2) {
      interpretation += `此卦中平之象，吉凶参半，需谨慎行事。`;
    } else {
      interpretation += `此卦不利之象，所占之事阻碍较多，需审慎而为。`;
    }
  } else {
    // 如果没有数据，根据体用关系给出基本判断
    interpretation += `【总体判断】${relation.favorable ? '偏吉' : '偏凶'}\n\n`;
    if (relation.favorable) {
      interpretation += `此卦整体有利，所占之事可以顺利进行。`;
    } else {
      interpretation += `此卦不太有利，所占之事需要谨慎对待。`;
    }
  }

  // 2. 体用关系建议
  interpretation += `\n\n【体用关系】${relation.relation}\n`;

  switch (relation.relation) {
    case '用生体':
      interpretation += `外部环境有利，贵人相助，可积极进取，把握机会。适合求谋、合作、拓展等事宜。`;
      break;
    case '体克用':
      interpretation += `自身掌控局面，事在人为，需主动出击。虽需付出努力，但终能成功。适合竞争、开拓、改革等事务。`;
      break;
    case '比和':
      interpretation += `事态平稳，无大起大落。宜守成不宜冒进，稳扎稳打为上策。适合维持、巩固、积累等事宜。`;
      break;
    case '体生用':
      interpretation += `付出多得益少，易感疲惫。宜量力而行，避免过度投入。适合短期、轻量、保守型事务。`;
      break;
    case '用克体':
      interpretation += `外部压力大，阻力重重。宜静不宜动，避其锋芒，待时机成熟再行动。适合观望、等待、积蓄实力。`;
      break;
  }

  // 3. 旺衰建议
  if (tiyongAnalysis?.tiWangshuai !== undefined) {
    const wangshuai = WANGSHUAI_NAMES[tiyongAnalysis.tiWangshuai] || '平';
    interpretation += `\n\n【五行旺衰】体卦五行${wangshuai}\n`;

    if (tiyongAnalysis.tiWangshuai <= 1) { // 旺或相
      interpretation += `体卦得时令之助，自身能量充足，宜主动进取。`;
    } else if (tiyongAnalysis.tiWangshuai === 2) { // 休
      interpretation += `体卦处于休整状态，能量一般，宜稳健行事，不宜激进。`;
    } else { // 囚或死
      interpretation += `体卦失时令之助，能量不足，宜保守谨慎，待时而动。`;
    }
  }

  // 4. 卦象变化建议
  const benGuaName = getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram);
  const bianGuaName = getHexagramName(hexagram.changedUpperTrigram, hexagram.changedLowerTrigram);

  interpretation += `\n\n【卦象变化】${benGuaName} 之 ${bianGuaName}\n`;
  interpretation += `本卦显示当前状态，变卦预示未来走向。动爻为第 ${hexagram.changingLine} 爻，表示变化的关键点在此。关注变卦吉凶，可知未来发展趋势。`;

  // 5. 行动建议
  interpretation += `\n\n【行动建议】\n`;

  if (relation.favorable) {
    interpretation += `• 把握当前有利时机，积极行动\n`;
    interpretation += `• 善用外部资源和人际关系\n`;
    interpretation += `• 保持信心，但不可骄傲自满`;
  } else {
    interpretation += `• 谨慎评估风险，量力而行\n`;
    interpretation += `• 加强自身修炼，积蓄实力\n`;
    interpretation += `• 耐心等待时机，不可强求`;
  }

  return interpretation;
}

const HexagramDisplay: React.FC<{
  upper: Trigram;
  lower: Trigram;
  title: string;
  changingLine?: number;
  isBody?: Trigram;
}> = ({ upper, lower, title, changingLine, isBody }) => {
  const hexagramName = getHexagramName(upper, lower);

  /**
   * 渲染单个爻
   */
  const renderLine = (index: number, isYang: boolean, isChanging: boolean) => {
    const lineClass = `hexagram-line ${isYang ? 'yang' : 'yin'} ${isChanging ? 'changing' : ''}`;
    return (
      <div key={index} className={lineClass}>
        {isYang ? (
          <div className="yang-line" />
        ) : (
          <>
            <div className="yin-half" />
            <div className="yin-gap" />
            <div className="yin-half" />
          </>
        )}
        {isChanging && <span className="changing-marker">动</span>}
      </div>
    );
  };

  /**
   * 获取卦的爻线（从下到上）
   */
  const getLines = (trigram: Trigram): boolean[] => {
    const patterns: Record<Trigram, boolean[]> = {
      [Trigram.Qian]: [true, true, true],    // ☰
      [Trigram.Dui]: [true, true, false],    // ☱
      [Trigram.Li]: [true, false, true],     // ☲
      [Trigram.Zhen]: [true, false, false],  // ☳
      [Trigram.Xun]: [false, true, true],    // ☴
      [Trigram.Kan]: [false, true, false],   // ☵
      [Trigram.Gen]: [false, false, true],   // ☶
      [Trigram.Kun]: [false, false, false],  // ☷
    };
    return patterns[trigram];
  };

  const lowerLines = getLines(lower);
  const upperLines = getLines(upper);
  const allLines = [...lowerLines, ...upperLines]; // 从初爻到上爻

  return (
    <div className="hexagram-display">
      <div className="hexagram-title">{title}</div>
      <div className="hexagram-symbol">
        {TRIGRAM_SYMBOLS[upper]}{TRIGRAM_SYMBOLS[lower]}
      </div>
      <div className="hexagram-name">{hexagramName}</div>
      <div className="hexagram-lines">
        {/* 从上到下渲染（逆序） */}
        {[...allLines].reverse().map((isYang, i) => {
          const lineIndex = 6 - i; // 爻位（1-6）
          const isChanging = changingLine === lineIndex;
          return renderLine(i, isYang, isChanging);
        })}
      </div>
      <div className="trigram-info">
        <div className="trigram-row">
          <span>上卦：{TRIGRAM_NAMES[upper]}（{TRIGRAM_MEANINGS[upper]}）</span>
          {isBody === upper && <Tag color="blue">体</Tag>}
          {isBody !== upper && <Tag color="orange">用</Tag>}
        </div>
        <div className="trigram-row">
          <span>下卦：{TRIGRAM_NAMES[lower]}（{TRIGRAM_MEANINGS[lower]}）</span>
          {isBody === lower && <Tag color="blue">体</Tag>}
          {isBody !== lower && <Tag color="orange">用</Tag>}
        </div>
      </div>
    </div>
  );
};

/**
 * 卦象详情页面组件
 */
const HexagramDetailPage: React.FC = () => {
  // 从 hash 中解析卦象 ID（格式：#/meihua/hexagram/123）
  const id = window.location.hash.match(/#\/meihua\/hexagram\/(\d+)/)?.[1];

  // 使用 hash 路由导航
  const navigate = useCallback((path: string) => {
    window.location.hash = `#${path}`;
  }, []);

  const [hexagram, setHexagram] = useState<Hexagram | null>(null);
  const [hexagramDetail, setHexagramDetail] = useState<FullDivinationDetail | null>(null);
  const [interpretationData, setInterpretationData] = useState<InterpretationData | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<AiInterpretationResultData | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [bountyModalVisible, setBountyModalVisible] = useState(false);
  const [userAccount, setUserAccount] = useState<string>(''); // TODO: 从钱包获取当前用户账户

  /**
   * 加载卦象数据
   */
  const loadHexagram = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const hexagramId = parseInt(id, 10);
      const data = await getHexagram(hexagramId);
      setHexagram(data);

      // 加载完整详细信息（包含伏卦和体用解读）
      const detail = await getHexagramDetail(hexagramId);
      setHexagramDetail(detail);

      // 加载解卦数据并规范化
      const interpData = await getInterpretationData(hexagramId);
      console.log('[HexagramDetailPage] 原始解卦数据:', interpData);
      const normalizedData = normalizeInterpretationData(interpData);
      console.log('[HexagramDetailPage] 规范化后的解卦数据:', normalizedData);
      setInterpretationData(normalizedData);

      // 加载 AI 解读结果（如果有）
      const aiResult = await getAiInterpretationResult(hexagramId);
      setAiInterpretation(aiResult);

      // TODO: 加载已有的解读结果
    } catch (error) {
      console.error('加载卦象失败:', error);
      message.error('加载卦象失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadHexagram();
  }, [loadHexagram]);

  /**
   * 归档卦象
   */
  const handleArchive = async () => {
    if (!hexagram) return;

    Modal.confirm({
      title: '确认归档',
      content: '归档后卦象将不再显示在主列表中，但仍可以通过历史记录查看。确定要归档吗？',
      onOk: async () => {
        setArchiving(true);
        try {
          await archiveHexagram(hexagram.id);
          message.success('归档成功');
          navigate('/meihua/list');
        } catch (error) {
          console.error('归档失败:', error);
          message.error('归档失败');
        } finally {
          setArchiving(false);
        }
      },
    });
  };

  /**
   * 请求 AI 解读
   */
  const handleRequestAi = () => {
    if (!hexagram) return;
    navigate(`/meihua/ai/${hexagram.id}`);
  };

  /**
   * 寻找大师解读
   */
  const handleFindMaster = () => {
    if (!hexagram) return;
    navigate(`/meihua/market?hexagramId=${hexagram.id}`);
  };

  if (loading) {
    return (
      <div className="meihua-page loading">
        <Spin size="large" tip="加载卦象中..." />
      </div>
    );
  }

  if (!hexagram) {
    return (
      <div className="meihua-page">
        <Result
          status="404"
          title="卦象不存在"
          subTitle="该卦象可能已被删除或从未存在"
          extra={
            <Button type="primary" onClick={() => navigate('/meihua')}>
              返回起卦
            </Button>
          }
        />
      </div>
    );
  }

  const bodyWuxing = hexagram.bodyWuxing;
  const funcWuxing = hexagram.functionWuxing;
  const relation = getWuxingRelation(bodyWuxing, funcWuxing);

  return (
    <div className="meihua-page">
      {/* 卦象标题 */}
      <Card className="hexagram-header-card">
        <div className="hexagram-header">
          <Title level={4}>
            {getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram)}
          </Title>
          <Tag color={hexagram.status === HexagramStatus.Active ? 'green' : 'default'}>
            {STATUS_NAMES[hexagram.status]}
          </Tag>
        </div>
        <Space size="small" wrap>
          <Tag icon={<CalendarOutlined />}>
            {METHOD_NAMES[hexagram.method]}
          </Tag>
          <Tag>
            农历 {hexagram.lunarYear}年{hexagram.lunarMonth}月{hexagram.lunarDay}日 {formatLunarHour(hexagram.lunarHour)}
          </Tag>
        </Space>
      </Card>

      {/* 本卦和变卦展示 */}
      <Card className="hexagram-display-card">
        <Row gutter={16}>
          <Col span={11}>
            <HexagramDisplay
              upper={hexagram.upperTrigram}
              lower={hexagram.lowerTrigram}
              title="本卦"
              changingLine={hexagram.changingLine}
              isBody={hexagram.bodyTrigram}
            />
          </Col>
          <Col span={2} className="arrow-col">
            <ArrowRightOutlined className="transform-arrow" />
          </Col>
          <Col span={11}>
            <HexagramDisplay
              upper={hexagram.changedUpperTrigram}
              lower={hexagram.changedLowerTrigram}
              title="变卦"
            />
          </Col>
        </Row>
      </Card>

      {/* 体用分析 */}
      <Card title="体用分析" className="analysis-card">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="动爻">
            第 {hexagram.changingLine} 爻
            {hexagramDetail?.benGua?.dongYaoMing && (
              <Text style={{ marginLeft: 8 }}>（{hexagramDetail.benGua.dongYaoMing}）</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="体卦">
            {TRIGRAM_NAMES[hexagram.bodyTrigram]}（{TRIGRAM_MEANINGS[hexagram.bodyTrigram]}）
            <Tag color="blue" style={{ marginLeft: 8 }}>{WUXING_NAMES[bodyWuxing]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="用卦">
            {TRIGRAM_NAMES[hexagram.functionTrigram]}（{TRIGRAM_MEANINGS[hexagram.functionTrigram]}）
            <Tag color="orange" style={{ marginLeft: 8 }}>{WUXING_NAMES[funcWuxing]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="体用关系">
            <Tag color={relation.favorable ? 'green' : 'red'}>
              {relation.relation}
            </Tag>
            <Text type={relation.favorable ? 'success' : 'danger'} style={{ marginLeft: 8 }}>
              {relation.favorable ? '吉' : '凶'}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {/* 体用关系详细解读（来自 Pallet） */}
        {hexagramDetail?.tiyongInterpretation ? (
          <Paragraph className="tiyong-interpretation">
            <InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            <Text strong>体用解读：</Text>
            <Text>{hexagramDetail.tiyongInterpretation}</Text>
          </Paragraph>
        ) : (
          <Paragraph className="analysis-hint">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            梅花易数以"体用"论吉凶。体卦代表自身，用卦代表所问之事。
            用生体、体克用为吉；体生用、用克体为凶；比和中平。
          </Paragraph>
        )}

        <Divider />

        {/* 详细的体用关系文字解读 */}
        <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
          <Text strong>体用详解：</Text>
          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            {getDetailedTiyongInterpretation(
              hexagram.bodyTrigram,
              hexagram.functionTrigram,
              bodyWuxing,
              funcWuxing,
              relation
            )}
          </Paragraph>
        </div>
      </Card>

      {/* 解卦详细数据展示 */}
      {interpretationData && (
        <>
          {/* 基础信息卡片 */}
          <Card title="占卜信息" className="interpretation-card">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="性别">
                {interpretationData.basicInfo.gender !== undefined
                  ? GENDER_NAMES[interpretationData.basicInfo.gender as keyof typeof GENDER_NAMES]
                  : '未指定'}
              </Descriptions.Item>
              <Descriptions.Item label="占卜类别">
                {interpretationData.basicInfo.category !== undefined
                  ? DIVINATION_CATEGORY_NAMES[interpretationData.basicInfo.category as keyof typeof DIVINATION_CATEGORY_NAMES]
                  : '未指定'}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <InfoCircleOutlined style={{ marginRight: 4 }} />
                起卦时间信息已在上方卦象标题中显示
              </Text>
            </div>
          </Card>

          {/* 体用详细分析卡片 */}
          <Card title="体用详细分析" className="interpretation-card">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="体卦五行">
                {interpretationData.tiyongAnalysis.tiWuxing !== undefined && (
                  <Tag color="blue">
                    {WUXING_NAMES[interpretationData.tiyongAnalysis.tiWuxing]}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="用卦五行">
                {interpretationData.tiyongAnalysis.yongWuxing !== undefined && (
                  <Tag color="orange">
                    {WUXING_NAMES[interpretationData.tiyongAnalysis.yongWuxing]}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="体卦旺衰">
                {interpretationData.tiyongAnalysis.tiWangshuai !== undefined && (
                  <Tag>{WANGSHUAI_NAMES[interpretationData.tiyongAnalysis.tiWangshuai]}</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="吉凶等级">
                {interpretationData.tiyongAnalysis.fortune !== undefined && (
                  <Tag color={
                    interpretationData.tiyongAnalysis.fortune >= 3 ? 'green' :
                    interpretationData.tiyongAnalysis.fortune === 2 ? 'default' : 'red'
                  }>
                    {FORTUNE_NAMES[interpretationData.tiyongAnalysis.fortune]} (
                    {interpretationData.tiyongAnalysis.fortuneLevel}/4)
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text strong>各卦体用关系：</Text>
              <div>
                <Text>本卦：</Text>
                {interpretationData.tiyongAnalysis?.benGuaRelationName ? (
                  <Tag>{interpretationData.tiyongAnalysis.benGuaRelationName}</Tag>
                ) : interpretationData.tiyongAnalysis?.benGuaRelation !== undefined && interpretationData.tiyongAnalysis.benGuaRelation !== null ? (
                  <Tag>{['比和', '用生体', '体生用', '用克体', '体克用'][interpretationData.tiyongAnalysis.benGuaRelation]}</Tag>
                ) : (
                  <Text type="secondary">（数据加载中）</Text>
                )}
              </div>
              <div>
                <Text>变卦：</Text>
                {interpretationData.tiyongAnalysis?.bianGuaRelationName ? (
                  <Tag>{interpretationData.tiyongAnalysis.bianGuaRelationName}</Tag>
                ) : interpretationData.tiyongAnalysis?.bianGuaRelation !== undefined && interpretationData.tiyongAnalysis.bianGuaRelation !== null ? (
                  <Tag>{['比和', '用生体', '体生用', '用克体', '体克用'][interpretationData.tiyongAnalysis.bianGuaRelation]}</Tag>
                ) : (
                  <Text type="secondary">（数据加载中）</Text>
                )}
              </div>
              <div>
                <Text>互卦：</Text>
                {interpretationData.tiyongAnalysis?.huGuaRelationName ? (
                  <Tag>{interpretationData.tiyongAnalysis.huGuaRelationName}</Tag>
                ) : interpretationData.tiyongAnalysis?.huGuaRelation !== undefined && interpretationData.tiyongAnalysis.huGuaRelation !== null ? (
                  <Tag>{['比和', '用生体', '体生用', '用克体', '体克用'][interpretationData.tiyongAnalysis.huGuaRelation]}</Tag>
                ) : (
                  <Text type="secondary">（数据加载中）</Text>
                )}
              </div>
            </Space>
          </Card>

          {/* 应期推算卡片 */}
          <Card title="应期推算" className="interpretation-card">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="体卦卦数">
                {interpretationData.yingqiAnalysis.tiGuaNum}
              </Descriptions.Item>
              <Descriptions.Item label="用卦卦数">
                {interpretationData.yingqiAnalysis.yongGuaNum}
              </Descriptions.Item>
              <Descriptions.Item label="主要应期数">
                <Tag color="blue">{interpretationData.yingqiAnalysis.primaryNum}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="次要应期数">
                <Space>
                  <Tag>{interpretationData.yingqiAnalysis.secondaryNums[0]}</Tag>
                  <Tag>{interpretationData.yingqiAnalysis.secondaryNums[1]}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="喜神（生体五行）">
                {interpretationData.yingqiAnalysis.shengTiWuxing !== undefined && (
                  <Tag color="green">
                    {WUXING_NAMES[interpretationData.yingqiAnalysis.shengTiWuxing]}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="忌神（克体五行）">
                {interpretationData.yingqiAnalysis.keTiWuxing !== undefined && (
                  <Tag color="red">
                    {WUXING_NAMES[interpretationData.yingqiAnalysis.keTiWuxing]}
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
              <Text strong>应期分析：</Text>
              <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                {interpretationData.yingqiAnalysis.analysis}
              </Paragraph>
            </div>

            <div style={{ backgroundColor: '#e6f7ff', padding: '12px', borderRadius: '4px' }}>
              <Text strong style={{ color: '#1890ff' }}>应期详解：</Text>
              <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                应期数可以理解为事情应验的时间单位（日、月、年等）。主要应期数为 <Tag color="blue">{interpretationData.yingqiAnalysis.primaryNum}</Tag>，次要应期数为 <Tag>{interpretationData.yingqiAnalysis.secondaryNums[0]}</Tag> 和 <Tag>{interpretationData.yingqiAnalysis.secondaryNums[1]}</Tag>。
                {interpretationData.yingqiAnalysis.shengTiWuxing !== undefined && (
                  <>
                    <br /><br />
                    喜神为<Tag color="green">{WUXING_NAMES[interpretationData.yingqiAnalysis.shengTiWuxing]}</Tag>五行，遇此五行之时应吉；
                    忌神为<Tag color="red">{WUXING_NAMES[interpretationData.yingqiAnalysis.keTiWuxing]}</Tag>五行，遇此五行之时需谨慎。
                    <br /><br />
                    可结合天干地支、日期、方位等因素，综合判断应期。如遇喜神五行对应的时间、方位，则有利；遇忌神五行对应的时间、方位，则不利。
                  </>
                )}
              </Paragraph>
            </div>
          </Card>
        </>
      )}

      {/* AI 解读结果展示 */}
      {aiInterpretation && (
        <Card title="AI 智能解读" className="interpretation-card">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="吉凶评分">
              <Tag color={aiInterpretation.fortuneScore >= 60 ? 'green' : 'orange'}>
                {aiInterpretation.fortuneScore}/100
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="可信度">
              <Tag color="blue">{aiInterpretation.confidenceScore}/100</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="AI 模型版本" span={2}>
              {aiInterpretation.modelVersion || '未知'}
            </Descriptions.Item>
          </Descriptions>

          <Divider />

          <div style={{ marginBottom: 16 }}>
            <Text strong>解读摘要：</Text>
            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {aiInterpretation.summary || '暂无摘要'}
            </Paragraph>
          </div>

          {aiInterpretation.interpretationCid && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                完整解读 IPFS CID: {aiInterpretation.interpretationCid}
              </Text>
            </div>
          )}
        </Card>
      )}

      {/* 卦象象义解读 */}
      <Card title="卦象象义" className="hexagram-meaning-card">
        <div style={{ backgroundColor: '#f0f5ff', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
          <Text strong style={{ color: '#1890ff' }}>本卦象义：</Text>
          <Paragraph style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {getHexagramMeaningInterpretation(
              hexagram.upperTrigram,
              hexagram.lowerTrigram,
              getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram)
            )}
          </Paragraph>
        </div>

        <div style={{ backgroundColor: '#fff7e6', padding: '12px', borderRadius: '4px' }}>
          <Text strong style={{ color: '#faad14' }}>变卦象义：</Text>
          <Paragraph style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {getHexagramMeaningInterpretation(
              hexagram.changedUpperTrigram,
              hexagram.changedLowerTrigram,
              getHexagramName(hexagram.changedUpperTrigram, hexagram.changedLowerTrigram)
            )}
          </Paragraph>
        </div>
      </Card>

      {/* 综合解读建议 */}
      <Card
        title={
          <span>
            <InfoCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            综合解读建议
          </span>
        }
        className="comprehensive-interpretation-card"
      >
        <div style={{
          backgroundColor: '#f6ffed',
          border: '1px solid #b7eb8f',
          padding: '16px',
          borderRadius: '4px'
        }}>
          <Paragraph style={{
            marginBottom: 0,
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            lineHeight: '1.8'
          }}>
            {getComprehensiveInterpretation(hexagram, interpretationData, relation)}
          </Paragraph>
        </div>

        <Divider />

        <Text type="secondary" style={{ fontSize: '12px' }}>
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          以上解读基于梅花易数传统理论，综合体用关系、五行旺衰、卦象变化等因素。
          如需更详细的个性化解读，可请求 AI 智能解卦或寻找大师人工解读。
        </Text>
      </Card>

      {/* 卦辞爻辞展示 */}
      {hexagramDetail?.benGua && (
        <Card title="卦辞爻辞" className="guaci-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="卦辞">
              <Text>{hexagramDetail.benGua.guaci || '暂无'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="动爻爻辞">
              <Text>{hexagramDetail.benGua.dongYaoCi || '暂无'}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 互卦、错卦、综卦、伏卦展示 */}
      {hexagramDetail && (
        <Card title="衍生卦象" className="derived-hexagrams-card">
          <Row gutter={[16, 16]}>
            {/* 互卦 */}
            <Col span={12}>
              <div className="derived-hexagram">
                <div className="derived-title">互卦</div>
                <div className="derived-symbol">
                  {hexagramDetail.huGua.shangGuaSymbol}{hexagramDetail.huGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.huGua.name}</div>
                <div className="derived-wuxing">
                  <Tag>{hexagramDetail.huGua.shangGuaWuxing}</Tag>
                  <Tag>{hexagramDetail.huGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>

            {/* 伏卦（新增） */}
            <Col span={12}>
              <div className="derived-hexagram fu-gua">
                <div className="derived-title">
                  伏卦
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 4 }}>（飞伏神）</Text>
                </div>
                <div className="derived-symbol">
                  {hexagramDetail.fuGua.shangGuaSymbol}{hexagramDetail.fuGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.fuGua.name}</div>
                <div className="derived-wuxing">
                  <Tag color="purple">{hexagramDetail.fuGua.shangGuaWuxing}</Tag>
                  <Tag color="purple">{hexagramDetail.fuGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>

            {/* 错卦 */}
            <Col span={12}>
              <div className="derived-hexagram">
                <div className="derived-title">错卦</div>
                <div className="derived-symbol">
                  {hexagramDetail.cuoGua.shangGuaSymbol}{hexagramDetail.cuoGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.cuoGua.name}</div>
                <div className="derived-wuxing">
                  <Tag>{hexagramDetail.cuoGua.shangGuaWuxing}</Tag>
                  <Tag>{hexagramDetail.cuoGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>

            {/* 综卦 */}
            <Col span={12}>
              <div className="derived-hexagram">
                <div className="derived-title">综卦</div>
                <div className="derived-symbol">
                  {hexagramDetail.zongGua.shangGuaSymbol}{hexagramDetail.zongGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.zongGua.name}</div>
                <div className="derived-wuxing">
                  <Tag>{hexagramDetail.zongGua.shangGuaWuxing}</Tag>
                  <Tag>{hexagramDetail.zongGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>
          </Row>

          <Divider />

          <Paragraph className="derived-hint">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            <Text type="secondary">
              <strong>互卦</strong>：取本卦2-4爻为下卦、3-5爻为上卦，反映事物内在变化。
              <strong>伏卦</strong>：八卦各有其对应的伏卦，代表隐藏的五行因素。
              <strong>错卦</strong>：本卦所有爻阴阳互变，从对立角度看问题。
              <strong>综卦</strong>：本卦上下颠倒，从他人角度看问题。
            </Text>
          </Paragraph>
        </Card>
      )}

      {/* 解读服务 */}
      <Card title="获取解读" className="service-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            size="large"
            block
            onClick={handleRequestAi}
          >
            AI 智能解卦
          </Button>
          <Text type="secondary" className="service-hint">
            基于传统梅花易数理论，由 AI 快速生成专业解读
          </Text>

          <Divider />

          <Button
            icon={<UserOutlined />}
            size="large"
            block
            onClick={handleFindMaster}
          >
            找大师人工解读
          </Button>
          <Text type="secondary" className="service-hint">
            由认证大师提供个性化解读，可追问互动
          </Text>

          <Divider />

          <Button
            icon={<GiftOutlined />}
            size="large"
            block
            onClick={() => setBountyModalVisible(true)}
            style={{ borderColor: '#faad14', color: '#faad14' }}
          >
            发起悬赏问答
          </Button>
          <Text type="secondary" className="service-hint">
            设置悬赏金额，邀请多位大师解读，投票选出最佳答案
          </Text>
        </Space>
      </Card>

      {/* 已有解读展示 */}
      {interpretation && (
        <Card title="解读结果" className="interpretation-card">
          <Paragraph>
            {/* TODO: 从 IPFS 加载解读内容 */}
            解读内容加载中...
          </Paragraph>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="action-buttons">
        <Space>
          <Button onClick={() => navigate('/meihua/list')}>
            返回列表
          </Button>
          <Button onClick={() => navigate('/meihua')}>
            重新起卦
          </Button>
          {hexagram.status === HexagramStatus.Active && (
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={archiving}
              onClick={handleArchive}
            >
              归档
            </Button>
          )}
        </Space>
      </div>

      {/* 悬赏问答弹窗 */}
      {hexagram && (
        <CreateBountyModal
          visible={bountyModalVisible}
          divinationType={DivinationType.Meihua}
          resultId={hexagram.id}
          userAccount={userAccount}
          onCancel={() => setBountyModalVisible(false)}
          onSuccess={(bountyId) => {
            setBountyModalVisible(false);
            message.success('悬赏创建成功！');
            // 跳转到悬赏详情页
            window.location.hash = `#/bounty/${bountyId}`;
          }}
        />
      )}
    </div>
  );
};

export default HexagramDetailPage;
