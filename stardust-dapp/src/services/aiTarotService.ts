/**
 * AI 塔罗牌解读服务
 *
 * 提供 AI 驱动的塔罗牌深度解读功能：
 * - 生成结构化的解读提示词
 * - 调用 AI 服务获取个性化解读
 * - 缓存和存储解读结果
 */

import type { TarotReading, TarotCoreInterpretation, SpreadEnergyAnalysis } from '../types/tarot';
import {
  SPREAD_TYPE_NAMES,
  SPREAD_POSITION_NAMES,
  MAJOR_ARCANA_NAMES_CN,
  SUIT_NAMES_CN,
  SUIT_ELEMENTS,
  FORTUNE_TENDENCY_NAMES,
  DOMINANT_ELEMENT_NAMES,
  ENERGY_FLOW_NAMES,
  getCardFullName,
  isMajorArcana,
  getCardSuit,
} from '../types/tarot';
import { getCardMeaning, getCurrentMeaning } from '../data/tarotMeanings';

/**
 * AI 解读请求参数
 */
export interface AiInterpretationRequest {
  /** 占卜问题（可选） */
  question?: string;
  /** 占卜记录 */
  reading: TarotReading;
  /** 核心解卦数据 */
  coreInterpretation?: TarotCoreInterpretation | null;
  /** 能量分析数据 */
  spreadEnergy?: SpreadEnergyAnalysis | null;
  /** 解读风格 */
  style?: 'professional' | 'friendly' | 'mystical' | 'practical';
  /** 关注领域 */
  focus?: 'love' | 'career' | 'health' | 'finance' | 'general';
}

/**
 * AI 解读结果
 */
export interface AiInterpretationResult {
  /** 总体概述 */
  overview: string;
  /** 各牌位解读 */
  cardReadings: Array<{
    position: string;
    cardName: string;
    interpretation: string;
  }>;
  /** 综合分析 */
  synthesis: string;
  /** 建议与指导 */
  advice: string;
  /** 注意事项 */
  warnings?: string;
  /** 幸运提示 */
  luckyTips?: string;
}

/**
 * 生成 AI 解读提示词
 *
 * @param request 解读请求参数
 * @returns 结构化的提示词
 */
export function generateAiPrompt(request: AiInterpretationRequest): string {
  const { reading, coreInterpretation, spreadEnergy, style = 'professional', focus = 'general', question } = request;
  const positionNames = SPREAD_POSITION_NAMES[reading.spreadType] || [];

  // 构建牌面信息
  const cardDescriptions = reading.cards.map((drawnCard, index) => {
    const cardId = drawnCard.card.id;
    const isReversed = drawnCard.position === 1;
    const cardName = getCardFullName(cardId);
    const positionName = positionNames[index] || `位置${index + 1}`;
    const meaning = getCardMeaning(cardId);
    const currentMeaning = getCurrentMeaning(cardId, isReversed);

    let description = `【${positionName}】${cardName}`;
    if (isReversed) description += '（逆位）';
    description += `\n- 关键词：${meaning?.keywords.join('、') || '暂无'}`;
    description += `\n- 含义：${currentMeaning}`;

    if (isMajorArcana(cardId)) {
      description += '\n- 注：大阿卡纳牌，代表重要的人生课题';
    } else {
      const suit = getCardSuit(cardId);
      description += `\n- 元素：${SUIT_ELEMENTS[suit]}（${SUIT_NAMES_CN[suit]}）`;
    }

    return description;
  }).join('\n\n');

  // 构建解读上下文
  let context = `## 塔罗牌占卜解读任务

### 牌阵信息
- 牌阵类型：${SPREAD_TYPE_NAMES[reading.spreadType]}
- 抽牌时间：${new Date(reading.timestamp * 1000).toLocaleString('zh-CN')}
- 牌数：${reading.cards.length}张

`;

  if (question) {
    context += `### 占卜问题
${question}

`;
  }

  context += `### 抽到的牌
${cardDescriptions}

`;

  // 添加核心解卦数据
  if (coreInterpretation) {
    context += `### 能量分析数据
- 总体能量：${coreInterpretation.overallEnergy}%
- 主导元素：${DOMINANT_ELEMENT_NAMES[coreInterpretation.dominantElement]}
- 吉凶倾向：${FORTUNE_TENDENCY_NAMES[coreInterpretation.fortuneTendency]}
- 逆位比例：${coreInterpretation.reversedRatio}%
- 大阿卡纳数量：${coreInterpretation.majorArcanaCount}张
- 综合评分：${coreInterpretation.overallScore}/100

`;
  }

  if (spreadEnergy) {
    context += `### 时间能量分布
- 过去能量：${spreadEnergy.pastEnergy}%
- 现在能量：${spreadEnergy.presentEnergy}%
- 未来能量：${spreadEnergy.futureEnergy}%
- 能量流动：${ENERGY_FLOW_NAMES[spreadEnergy.energyFlow]}
- 能量平衡度：${spreadEnergy.energyBalance}%

`;
  }

  // 解读要求
  const styleGuide: Record<string, string> = {
    professional: '请以专业塔罗牌解读师的角度，提供客观、深入的分析。',
    friendly: '请以亲切友善的口吻，像朋友一样给出建议和解读。',
    mystical: '请以神秘学的视角，融入占星、数秘等元素进行解读。',
    practical: '请以实用主义的角度，给出具体可行的建议和行动方案。',
  };

  const focusGuide: Record<string, string> = {
    love: '重点关注感情、人际关系方面的解读。',
    career: '重点关注事业、工作发展方面的解读。',
    health: '重点关注身心健康、生活状态方面的解读。',
    finance: '重点关注财务、投资理财方面的解读。',
    general: '综合各方面进行全面解读。',
  };

  context += `### 解读要求
${styleGuide[style]}
${focusGuide[focus]}

请提供以下内容：
1. **总体概述**：对本次占卜的整体印象和核心信息
2. **各牌位解读**：逐一解读每张牌在其位置上的含义
3. **综合分析**：结合所有牌面，分析它们之间的关系和整体信息
4. **建议与指导**：基于解读结果，给出具体的建议
5. **注意事项**：需要警惕或注意的地方
6. **幸运提示**：有利的时机、方向或元素

请用中文回答，语言温和但有深度，避免绝对化的表述。`;

  return context;
}

/**
 * 解析 AI 返回的解读结果
 *
 * @param aiResponse AI 返回的文本
 * @returns 结构化的解读结果
 */
export function parseAiResponse(aiResponse: string): AiInterpretationResult {
  // 简单的文本解析，实际应用中可能需要更复杂的解析逻辑
  const sections: Record<string, string> = {};

  // 尝试按标题分割
  const sectionPatterns = [
    { key: 'overview', patterns: ['总体概述', '整体概述', '概述'] },
    { key: 'synthesis', patterns: ['综合分析', '整体分析', '综合'] },
    { key: 'advice', patterns: ['建议与指导', '建议', '指导'] },
    { key: 'warnings', patterns: ['注意事项', '警示', '提醒'] },
    { key: 'luckyTips', patterns: ['幸运提示', '开运建议', '幸运'] },
  ];

  let currentSection = 'overview';
  const lines = aiResponse.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 检查是否是新的段落标题
    let matched = false;
    for (const { key, patterns } of sectionPatterns) {
      for (const pattern of patterns) {
        if (trimmedLine.includes(pattern) && (trimmedLine.startsWith('#') || trimmedLine.startsWith('**'))) {
          currentSection = key;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched && trimmedLine) {
      // 添加到当前段落
      sections[currentSection] = (sections[currentSection] || '') + trimmedLine + '\n';
    }
  }

  // 清理文本
  const cleanText = (text?: string) => text?.trim().replace(/^\*\*.*?\*\*:?\s*/gm, '').replace(/^#+\s*/gm, '') || '';

  return {
    overview: cleanText(sections.overview) || '塔罗牌为您揭示了当前的能量状态和发展趋势。',
    cardReadings: [], // 需要更复杂的解析逻辑
    synthesis: cleanText(sections.synthesis) || '各牌面之间形成了独特的能量组合，请结合具体问题进行理解。',
    advice: cleanText(sections.advice) || '建议保持开放的心态，根据牌面指引调整行动方向。',
    warnings: cleanText(sections.warnings),
    luckyTips: cleanText(sections.luckyTips),
  };
}

/**
 * 本地 AI 解读（基于规则的简化版本）
 *
 * 当没有外部 AI 服务时，提供基于规则的本地解读
 *
 * @param request 解读请求
 * @returns 解读结果
 */
export function generateLocalInterpretation(request: AiInterpretationRequest): AiInterpretationResult {
  const { reading, coreInterpretation, focus = 'general' } = request;
  const positionNames = SPREAD_POSITION_NAMES[reading.spreadType] || [];

  // 生成各牌位解读
  const cardReadings = reading.cards.map((drawnCard, index) => {
    const cardId = drawnCard.card.id;
    const isReversed = drawnCard.position === 1;
    const cardName = getCardFullName(cardId);
    const positionName = positionNames[index] || `位置${index + 1}`;
    const currentMeaning = getCurrentMeaning(cardId, isReversed);

    return {
      position: positionName,
      cardName: isReversed ? `${cardName}（逆位）` : cardName,
      interpretation: `在"${positionName}"的位置，${cardName}${isReversed ? '逆位' : ''}出现，${currentMeaning}`,
    };
  });

  // 生成总体概述
  let overview = '本次塔罗牌占卜为您展示了当前的能量格局。';
  if (coreInterpretation) {
    const fortuneName = FORTUNE_TENDENCY_NAMES[coreInterpretation.fortuneTendency];
    overview += `整体呈现"${fortuneName}"的态势，`;
    if (coreInterpretation.majorArcanaCount > 0) {
      overview += `有${coreInterpretation.majorArcanaCount}张大阿卡纳牌出现，表明这是一个重要的人生阶段。`;
    }
    if (coreInterpretation.reversedRatio > 50) {
      overview += '较多的逆位牌提示您需要关注内在的阻碍和需要调整的方向。';
    }
  }

  // 生成综合分析
  let synthesis = '综合所有牌面来看，';
  const majorCount = reading.cards.filter((c) => isMajorArcana(c.card.id)).length;
  if (majorCount >= 3) {
    synthesis += '大阿卡纳牌的大量出现表明当前正处于人生的重要转折点，需要认真对待每一个选择。';
  } else if (majorCount === 0) {
    synthesis += '全部是小阿卡纳牌，说明当前的问题更多是日常层面的，通过具体行动可以解决。';
  } else {
    synthesis += '大小阿卡纳的组合显示了宏观命运与具体行动的交织。';
  }

  // 根据关注领域调整建议
  const focusAdvice: Record<string, string> = {
    love: '在感情方面，建议保持真诚的沟通，倾听内心的声音。',
    career: '在事业方面，建议把握当前机遇，同时注意团队协作。',
    health: '在健康方面，建议关注身心平衡，适当休息。',
    finance: '在财务方面，建议谨慎决策，避免冲动投资。',
    general: '建议在各方面保持平衡，根据实际情况灵活调整。',
  };

  const advice = focusAdvice[focus] + '相信自己的直觉，同时也要理性分析现实情况。';

  // 警示信息
  let warnings: string | undefined;
  if (coreInterpretation && coreInterpretation.fortuneTendency >= 3) {
    warnings = '当前存在一些需要注意的挑战，保持警惕但不必过度担忧。';
  }

  // 幸运提示
  let luckyTips: string | undefined;
  if (coreInterpretation) {
    const elementNames = ['火', '水', '风', '土', '灵性'];
    const luckyElement = elementNames[coreInterpretation.dominantElement] || '平衡';
    luckyTips = `当前的幸运元素是"${luckyElement}"，可以多接触与此元素相关的事物。`;
  }

  return {
    overview,
    cardReadings,
    synthesis,
    advice,
    warnings,
    luckyTips,
  };
}

/**
 * 获取 AI 深度解读
 *
 * 优先使用外部 AI 服务，失败时回退到本地规则解读
 *
 * @param request 解读请求
 * @param aiEndpoint 可选的 AI 服务端点
 * @returns 解读结果
 */
export async function getAiInterpretation(
  request: AiInterpretationRequest,
  aiEndpoint?: string
): Promise<AiInterpretationResult> {
  // 如果没有配置 AI 服务，使用本地解读
  if (!aiEndpoint) {
    console.log('[getAiInterpretation] 未配置 AI 服务，使用本地解读');
    return generateLocalInterpretation(request);
  }

  try {
    const prompt = generateAiPrompt(request);

    // 调用 AI 服务
    const response = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI 服务请求失败: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.text || data.response || data.content;

    if (!aiText) {
      throw new Error('AI 服务返回空结果');
    }

    return parseAiResponse(aiText);
  } catch (error) {
    console.error('[getAiInterpretation] AI 服务调用失败，回退到本地解读:', error);
    return generateLocalInterpretation(request);
  }
}
