/**
 * 基础解盘卡片组件（V2 精简版）
 *
 * 功能：
 * - 显示八字基础解盘结果（格局、强弱、用神等）
 * - 显示可信度评分
 * - 提供缓存功能（可选）
 * - 引导用户升级到 AI 解读
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Alert,
  Button,
  Progress,
  Spin,
  Space,
  Divider,
  Typography,
} from 'antd';
import {
  ThunderboltOutlined,
  RobotOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  StarOutlined,
  HeartOutlined,
  DollarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  getInterpretationSmartV3,
  type V3FullInterpretation,
} from '../../../services/baziChainService';

const { Text, Paragraph } = Typography;

interface Props {
  chartId: number;
  onRequestAi?: () => void;
}

export const BasicInterpretationCard: React.FC<Props> = ({
  chartId,
  onRequestAi,
}) => {
  const [interpretation, setInterpretation] =
    useState<V3FullInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInterpretation();
  }, [chartId]);

  /**
   * 加载 V3 完整解盘结果
   * 包含核心指标 + 性格分析 + 扩展忌神
   */
  const loadInterpretation = async () => {
    setLoading(true);
    setError(null);

    try {
      // 使用 V3 智能获取，会自动回退到 V2
      const result = await getInterpretationSmartV3(chartId);

      if (result) {
        setInterpretation(result);
      } else {
        setError('无法获取解盘结果，请确认命盘存在');
      }
    } catch (err: any) {
      console.error('加载解盘失败:', err);
      setError(err.message || '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 可信度状态
  const getConfidenceStatus = (
    score: number
  ): 'success' | 'normal' | 'exception' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'normal';
    return 'exception';
  };

  // 可信度描述
  const getConfidenceLabel = (score: number): string => {
    if (score >= 90) return '极高';
    if (score >= 80) return '高';
    if (score >= 70) return '中等';
    if (score >= 60) return '较低';
    return '低';
  };

  // 根据格局生成描述
  const getGeJuDescription = (geJu: string): string => {
    const descriptions: Record<string, string> = {
      '正格': '命局五行相对平衡，发展较为稳定，适合循序渐进的发展方式。',
      '从强格': '日主旺盛，自主性强，宜顺势发展，适合独立创业或领导岗位。',
      '从弱格': '日主虚弱，宜借力打力，适合团队合作，借助贵人力量发展。',
      '从财格': '财星当令，财运较好，适合从事商业、金融相关行业。',
      '从官格': '官星当令，适合从政或管理岗位，有领导才能。',
      '从儿格': '食伤当令，才华横溢，适合艺术、创意、技术类工作。',
      '化气格': '干支化合，命局特殊，需要综合分析具体情况。',
      '特殊格局': '命局格局特殊，建议寻求专业命理师详细分析。',
    };
    return descriptions[geJu] || '命局格局需要综合分析。';
  };

  // 根据强弱生成描述
  const getQiangRuoDescription = (qiangRuo: string): string => {
    const descriptions: Record<string, string> = {
      '身旺': '日主偏旺，精力充沛，自主性强，但需注意克制，避免刚愎自用。',
      '身弱': '日主偏弱，需要贵人相助，宜团队合作，借力发展更为顺利。',
      '中和': '日主中和，五行平衡，发展顺遂，运势较好，适应性强。',
      '太旺': '日主极旺，个性强烈，需要适当克制，避免过于强势。',
      '太弱': '日主极弱，需要多方扶持，宜稳健发展，避免冒险。',
    };
    return descriptions[qiangRuo] || '命局强弱需要综合分析。';
  };

  // 根据用神生成建议
  const getYongShenAdvice = (yongShen: string): { career: string; direction: string; color: string } => {
    const advice: Record<string, { career: string; direction: string; color: string }> = {
      '金': { career: '金融、机械、五金、军警、法律', direction: '西方', color: '白色、金色' },
      '木': { career: '教育、文化、环保、农林、医药', direction: '东方', color: '绿色、青色' },
      '水': { career: '贸易、运输、水利、信息、旅游', direction: '北方', color: '黑色、蓝色' },
      '火': { career: '能源、娱乐、餐饮、化工、电子', direction: '南方', color: '红色、紫色' },
      '土': { career: '房地产、建筑、农业、服务、矿业', direction: '中央', color: '黄色、棕色' },
    };
    return advice[yongShen] || { career: '需综合分析', direction: '需综合分析', color: '需综合分析' };
  };

  // 根据评分生成总体评价
  const getScoreEvaluation = (score: number): { level: string; description: string; color: string } => {
    if (score >= 90) return { level: '上上', description: '命局极佳，天赋异禀，发展潜力巨大', color: '#52c41a' };
    if (score >= 80) return { level: '上中', description: '命局优良，条件较好，发展前景光明', color: '#73d13d' };
    if (score >= 70) return { level: '中上', description: '命局良好，稳中有进，把握机遇可成', color: '#1890ff' };
    if (score >= 60) return { level: '中中', description: '命局平稳，需要努力，勤能补拙', color: '#faad14' };
    if (score >= 50) return { level: '中下', description: '命局一般，需多加努力，贵人相助为佳', color: '#fa8c16' };
    return { level: '下', description: '命局较弱，需谨慎行事，稳健为上', color: '#f5222d' };
  };

  /**
   * 生成综合分析文本
   * 基于核心指标、性格分析等信息生成完整的综合分析
   */
  const generateComprehensiveAnalysis = (): string[] => {
    if (!interpretation) return [];

    const { core, xingGe } = interpretation;
    const texts: string[] = [];

    // 1. 格局分析
    texts.push(`【格局分析】您的命局为${core.geJu}。${getGeJuDescription(core.geJu)}`);

    // 2. 强弱分析
    texts.push(`【命局强弱】日主${core.qiangRuo}。${getQiangRuoDescription(core.qiangRuo)}`);

    // 3. 用神分析
    const yongShenAdvice = getYongShenAdvice(core.yongShen);
    texts.push(
      `【用神分析】命局用神为${core.yongShen}，属于${core.yongShenType}。` +
      `喜神为${core.xiShen}，忌神为${core.jiShen}。` +
      `用神${core.yongShen}主管方位为${yongShenAdvice.direction}，幸运颜色为${yongShenAdvice.color}。`
    );

    // 4. 事业发展
    texts.push(
      `【事业发展】根据用神${core.yongShen}的特性，您适合从事${yongShenAdvice.career}等相关行业。` +
      `在这些领域能够更好地发挥您的优势，获得事业上的成功。`
    );

    // 5. 性格特征（如果有）
    if (xingGe && xingGe.zhuYaoTeDian.length > 0) {
      texts.push(
        `【性格特征】您的主要性格特点是${xingGe.zhuYaoTeDian.join('、')}。` +
        (xingGe.youDian.length > 0 ? `优点表现为${xingGe.youDian.join('、')}。` : '') +
        (xingGe.queDian.length > 0 ? `需要注意克服${xingGe.queDian.join('、')}等倾向。` : '')
      );
    }

    // 6. 职业建议（如果有）
    if (xingGe && xingGe.shiHeZhiYe.length > 0) {
      texts.push(
        `【职业建议】综合您的命局特点，除了前述行业外，还特别适合从事${xingGe.shiHeZhiYe.join('、')}等工作。` +
        `这些职业能够充分发挥您的天赋和才能。`
      );
    }

    // 7. 发展方位
    texts.push(
      `【发展方位】以您的出生地为中心，向${yongShenAdvice.direction}方向发展更为有利。` +
      `在选择工作地点、投资方向时，可优先考虑${yongShenAdvice.direction}方位的城市或区域。`
    );

    // 8. 总体评价
    const evaluation = getScoreEvaluation(core.score);
    texts.push(
      `【综合评价】您的命局综合评分为${core.score}分（满分100分），评级为"${evaluation.level}"等。` +
      `${evaluation.description}建议在人生规划中充分考虑上述因素，顺势而为，必能有所成就。`
    );

    // 9. 可信度说明
    if (core.confidence < 70) {
      texts.push(
        `【温馨提示】本次解盘可信度为${core.confidence}%，建议您结合实际情况参考。` +
        `如需更准确的分析，建议使用AI智能解读或咨询专业命理师。`
      );
    }

    return texts;
  };

  if (loading) {
    return (
      <Card>
        <Spin tip="加载解盘中...">
          <div style={{ padding: 50 }} />
        </Spin>
      </Card>
    );
  }

  if (error && !interpretation) {
    return (
      <Card>
        <Alert
          message="无法获取解盘结果"
          description={
            <div>
              <p>{error}</p>
              <p>可能的原因：命盘不存在、节点未升级到最新版本。</p>
            </div>
          }
          type="warning"
          showIcon
          action={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => loadInterpretation()}
            >
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  if (!interpretation) {
    return (
      <Card>
        <Alert message="解盘计算失败" type="error" showIcon />
      </Card>
    );
  }

  // 快捷访问核心数据
  const core = interpretation.core;

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#faad14' }} />
          <span>基础解盘</span>
          <Tag color="blue">V3 实时计算</Tag>
          <Tag color="purple">v{core.algorithmVersion}</Tag>
        </Space>
      }
      extra={
        <Space>
          <SafetyOutlined />
          <span style={{ fontSize: 12 }}>可信度</span>
          <Progress
            type="circle"
            width={40}
            percent={core.confidence}
            status={getConfidenceStatus(core.confidence)}
            format={() => getConfidenceLabel(core.confidence)}
          />
        </Space>
      }
    >
      {/* 核心指标 */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card type="inner" size="small">
            <Statistic
              title="格局"
              value={core.geJu}
              valueStyle={{ fontSize: 18, color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card type="inner" size="small">
            <Statistic
              title="命局强弱"
              value={core.qiangRuo}
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card type="inner" size="small">
            <Statistic
              title="综合评分"
              value={core.score}
              suffix="/100"
              valueStyle={{ fontSize: 18, color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* 用神喜神忌神 */}
      <Row gutter={[16, 12]}>
        <Col span={8}>
          <Card type="inner" size="small" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>用神</Text>
            </div>
            <Tag color="success" style={{ fontSize: 16, padding: '4px 12px' }}>
              {core.yongShen}
            </Tag>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{core.yongShenType}</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card type="inner" size="small" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>喜神</Text>
            </div>
            <Tag color="processing" style={{ fontSize: 16, padding: '4px 12px' }}>
              {core.xiShen}
            </Tag>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>辅助用神</Text>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card type="inner" size="small" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>忌神</Text>
            </div>
            <Tag color="error" style={{ fontSize: 16, padding: '4px 12px' }}>
              {core.jiShen}
            </Tag>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>需要避免</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 详细解读 */}
      <Divider orientation="left">命局解读</Divider>

      {/* 格局解读 */}
      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <StarOutlined style={{ color: '#1890ff' }} />
          <Text strong>格局分析</Text>
          <Tag color="blue">{core.geJu}</Tag>
        </Space>
        <Paragraph style={{ margin: 0, paddingLeft: 22, color: '#595959' }}>
          {getGeJuDescription(core.geJu)}
        </Paragraph>
      </div>

      {/* 强弱解读 */}
      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <HeartOutlined style={{ color: '#52c41a' }} />
          <Text strong>命局强弱</Text>
          <Tag color="green">{core.qiangRuo}</Tag>
        </Space>
        <Paragraph style={{ margin: 0, paddingLeft: 22, color: '#595959' }}>
          {getQiangRuoDescription(core.qiangRuo)}
        </Paragraph>
      </div>

      {/* V3 性格分析（如果有） */}
      {interpretation.xingGe && (
        <>
          <Divider orientation="left">性格分析</Divider>

          {/* 主要性格特点 */}
          {interpretation.xingGe.zhuYaoTeDian.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>主要特点：</Text>
              <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                {interpretation.xingGe.zhuYaoTeDian.map((trait, idx) => (
                  <Tag key={idx} color="blue">{trait}</Tag>
                ))}
              </Space>
            </div>
          )}

          {/* 优点 */}
          {interpretation.xingGe.youDian.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>优点：</Text>
              <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                {interpretation.xingGe.youDian.map((trait, idx) => (
                  <Tag key={idx} color="green">{trait}</Tag>
                ))}
              </Space>
            </div>
          )}

          {/* 缺点 */}
          {interpretation.xingGe.queDian.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>缺点：</Text>
              <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                {interpretation.xingGe.queDian.map((trait, idx) => (
                  <Tag key={idx} color="orange">{trait}</Tag>
                ))}
              </Space>
            </div>
          )}

          {/* 适合职业 */}
          {interpretation.xingGe.shiHeZhiYe.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong>适合职业：</Text>
              <Space size={4} style={{ marginLeft: 8, flexWrap: 'wrap' }}>
                {interpretation.xingGe.shiHeZhiYe.map((career, idx) => (
                  <Tag key={idx} color="purple">{career}</Tag>
                ))}
              </Space>
            </div>
          )}
        </>
      )}

      {/* 用神建议 */}
      {(() => {
        const advice = getYongShenAdvice(core.yongShen);
        return (
          <>
            <Divider orientation="left">发展建议</Divider>
            <div style={{ marginBottom: 16 }}>
              <Row gutter={[8, 8]}>
                <Col span={24}>
                  <Text type="secondary">适合行业：</Text>
                  <Text style={{ color: '#595959' }}>{advice.career}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">有利方位：</Text>
                  <Tag color="cyan">{advice.direction}</Tag>
                </Col>
                <Col span={12}>
                  <Text type="secondary">幸运颜色：</Text>
                  <Tag color="magenta">{advice.color}</Tag>
                </Col>
              </Row>
            </div>
          </>
        );
      })()}

      {/* 总体评价 */}
      {(() => {
        const evaluation = getScoreEvaluation(core.score);
        return (
          <div style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <TeamOutlined style={{ color: '#722ed1' }} />
              <Text strong>总体评价</Text>
              <Tag color="purple">{evaluation.level}</Tag>
            </Space>
            <Paragraph style={{ margin: 0, paddingLeft: 22, color: evaluation.color, fontWeight: 500 }}>
              {evaluation.description}
            </Paragraph>
          </div>
        );
      })()}

      <Divider orientation="left">综合分析</Divider>

      {/* 综合分析文本 */}
      {(() => {
        const analysisTexts = generateComprehensiveAnalysis();
        return (
          <div style={{ marginBottom: 16 }}>
            {analysisTexts.map((text, idx) => (
              <Paragraph
                key={idx}
                style={{
                  marginBottom: 12,
                  padding: '12px',
                  backgroundColor: '#fafafa',
                  borderRadius: '4px',
                  lineHeight: '1.8',
                  textIndent: '0',
                }}
              >
                {text}
              </Paragraph>
            ))}
          </div>
        );
      })()}

      <Divider />

      {/* 可信度警告（低于 70 分） */}
      {core.confidence < 70 && (
        <Alert
          message="解盘可信度较低"
          description="由于时辰精确度、格局特殊性等因素，建议使用 AI 智能解读获取更准确的分析结果。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            onRequestAi && (
              <Button
                type="primary"
                size="small"
                icon={<RobotOutlined />}
                onClick={onRequestAi}
              >
                AI 解读
              </Button>
            )
          }
        />
      )}

      {/* 升级提示 */}
      <Alert
        message={
          <Space>
            <InfoCircleOutlined />
            <span>想要更详细的解读？</span>
          </Space>
        }
        description={
          <div>
            <p style={{ marginBottom: 8 }}>
              基础解盘提供核心指标参考，<strong>AI 智能解读</strong>还可提供：
            </p>
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>性格特征深度分析</li>
              <li>婚姻感情详细建议</li>
              <li>健康注意事项</li>
              <li>流年大运逐年分析</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        action={
          onRequestAi && (
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={onRequestAi}
            >
              升级到 AI 解读
            </Button>
          )
        }
      />

      {/* 底部信息 */}
      <div
        style={{
          marginTop: 16,
          padding: '8px 0',
          borderTop: '1px solid #f0f0f0',
          fontSize: 12,
          color: '#8c8c8c',
          textAlign: 'center',
        }}
      >
        算法版本 v{core.algorithmVersion} · V3 实时计算 · 免费
      </div>
    </Card>
  );
};
