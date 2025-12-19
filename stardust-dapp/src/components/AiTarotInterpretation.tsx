/**
 * AI 塔罗牌解读组件
 *
 * 展示 AI 深度解读结果，包括：
 * - 总体概述
 * - 各牌位详细解读
 * - 综合分析
 * - 建议与指导
 * - 注意事项
 */

import React, { useState } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Spin,
  Collapse,
  Tag,
  Divider,
  Alert,
  Modal,
  Input,
  Radio,
  message,
} from 'antd';
import {
  RobotOutlined,
  BulbOutlined,
  WarningOutlined,
  StarOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { TarotReading, TarotCoreInterpretation, SpreadEnergyAnalysis } from '../types/tarot';
import {
  getAiInterpretation,
  generateLocalInterpretation,
  type AiInterpretationResult,
  type AiInterpretationRequest,
} from '../services/aiTarotService';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

/**
 * AI 解读组件属性
 */
interface AiTarotInterpretationProps {
  /** 占卜记录 */
  reading: TarotReading;
  /** 核心解卦数据 */
  coreInterpretation?: TarotCoreInterpretation | null;
  /** 能量分析 */
  spreadEnergy?: SpreadEnergyAnalysis | null;
}

/**
 * AI 塔罗牌解读组件
 */
const AiTarotInterpretation: React.FC<AiTarotInterpretationProps> = ({
  reading,
  coreInterpretation,
  spreadEnergy,
}) => {
  const [loading, setLoading] = useState(false);
  const [interpretation, setInterpretation] = useState<AiInterpretationResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [question, setQuestion] = useState('');
  const [style, setStyle] = useState<'professional' | 'friendly' | 'mystical' | 'practical'>('professional');
  const [focus, setFocus] = useState<'love' | 'career' | 'health' | 'finance' | 'general'>('general');

  /**
   * 打开设置弹窗
   */
  const handleOpenModal = () => {
    setModalVisible(true);
  };

  /**
   * 执行 AI 解读
   */
  const handleGetInterpretation = async () => {
    setModalVisible(false);
    setLoading(true);

    try {
      const request: AiInterpretationRequest = {
        reading,
        coreInterpretation,
        spreadEnergy,
        question: question.trim() || undefined,
        style,
        focus,
      };

      // 尝试获取 AI 解读（如果没有配置 AI 服务，会自动使用本地解读）
      const result = await getAiInterpretation(request);
      setInterpretation(result);
      message.success('解读完成');
    } catch (error: any) {
      console.error('[AiTarotInterpretation] 解读失败:', error);
      message.error('解读失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 快速本地解读
   */
  const handleQuickInterpretation = () => {
    setLoading(true);
    setTimeout(() => {
      const result = generateLocalInterpretation({
        reading,
        coreInterpretation,
        spreadEnergy,
        style: 'professional',
        focus: 'general',
      });
      setInterpretation(result);
      setLoading(false);
      message.success('快速解读完成');
    }, 500);
  };

  /**
   * 重新解读
   */
  const handleRefresh = () => {
    setInterpretation(null);
    setQuestion('');
  };

  // 未解读状态
  if (!interpretation && !loading) {
    return (
      <Card
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            AI 深度解读
          </Space>
        }
        style={{ marginBottom: '16px' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Paragraph type="secondary">
            AI 将根据您抽到的牌面、牌阵位置和能量分析，提供个性化的深度解读和建议。
          </Paragraph>

          <Space wrap>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleOpenModal}
            >
              定制解读
            </Button>
            <Button
              icon={<BulbOutlined />}
              onClick={handleQuickInterpretation}
            >
              快速解读
            </Button>
          </Space>
        </Space>

        {/* 设置弹窗 */}
        <Modal
          title="AI 解读设置"
          open={modalVisible}
          onOk={handleGetInterpretation}
          onCancel={() => setModalVisible(false)}
          okText="开始解读"
          cancelText="取消"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 占卜问题 */}
            <div>
              <Text strong>占卜问题（可选）</Text>
              <TextArea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="输入您的具体问题，AI 将针对性解读..."
                rows={3}
                maxLength={200}
                showCount
                style={{ marginTop: 8 }}
              />
            </div>

            {/* 解读风格 */}
            <div>
              <Text strong>解读风格</Text>
              <div style={{ marginTop: 8 }}>
                <Radio.Group value={style} onChange={(e) => setStyle(e.target.value)}>
                  <Radio.Button value="professional">专业分析</Radio.Button>
                  <Radio.Button value="friendly">亲切友善</Radio.Button>
                  <Radio.Button value="mystical">神秘学派</Radio.Button>
                  <Radio.Button value="practical">实用建议</Radio.Button>
                </Radio.Group>
              </div>
            </div>

            {/* 关注领域 */}
            <div>
              <Text strong>关注领域</Text>
              <div style={{ marginTop: 8 }}>
                <Radio.Group value={focus} onChange={(e) => setFocus(e.target.value)}>
                  <Radio.Button value="general">综合</Radio.Button>
                  <Radio.Button value="love">感情</Radio.Button>
                  <Radio.Button value="career">事业</Radio.Button>
                  <Radio.Button value="finance">财务</Radio.Button>
                  <Radio.Button value="health">健康</Radio.Button>
                </Radio.Group>
              </div>
            </div>
          </Space>
        </Modal>
      </Card>
    );
  }

  // 加载中状态
  if (loading) {
    return (
      <Card
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            AI 深度解读
          </Space>
        }
        style={{ marginBottom: '16px' }}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="AI 正在分析您的牌面..." />
        </div>
      </Card>
    );
  }

  // 解读结果展示
  return (
    <Card
      title={
        <Space>
          <RobotOutlined style={{ color: '#722ed1' }} />
          AI 深度解读
        </Space>
      }
      extra={
        <Button
          type="text"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
        >
          重新解读
        </Button>
      }
      style={{ marginBottom: '16px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 总体概述 */}
        <div>
          <Text strong style={{ fontSize: 16 }}>
            <BulbOutlined style={{ marginRight: 8, color: '#faad14' }} />
            总体概述
          </Text>
          <Paragraph style={{ marginTop: 8, marginBottom: 0, padding: '12px', backgroundColor: '#fafafa', borderRadius: 8 }}>
            {interpretation?.overview}
          </Paragraph>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 各牌位解读 */}
        {interpretation?.cardReadings && interpretation.cardReadings.length > 0 && (
          <>
            <Text strong style={{ fontSize: 16 }}>各牌位解读</Text>
            <Collapse>
              {interpretation.cardReadings.map((cardReading, index) => (
                <Panel
                  key={index}
                  header={
                    <Space>
                      <Tag color="purple">{cardReading.position}</Tag>
                      <Text strong>{cardReading.cardName}</Text>
                    </Space>
                  }
                >
                  <Paragraph style={{ margin: 0 }}>{cardReading.interpretation}</Paragraph>
                </Panel>
              ))}
            </Collapse>
            <Divider style={{ margin: '12px 0' }} />
          </>
        )}

        {/* 综合分析 */}
        <div>
          <Text strong style={{ fontSize: 16 }}>综合分析</Text>
          <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
            {interpretation?.synthesis}
          </Paragraph>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 建议与指导 */}
        <Alert
          message="建议与指导"
          description={interpretation?.advice}
          type="success"
          icon={<StarOutlined />}
          showIcon
        />

        {/* 注意事项 */}
        {interpretation?.warnings && (
          <Alert
            message="注意事项"
            description={interpretation.warnings}
            type="warning"
            icon={<WarningOutlined />}
            showIcon
          />
        )}

        {/* 幸运提示 */}
        {interpretation?.luckyTips && (
          <Alert
            message="幸运提示"
            description={interpretation.luckyTips}
            type="info"
            icon={<StarOutlined />}
            showIcon
          />
        )}

        {/* 免责声明 */}
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          * AI 解读仅供参考，请结合实际情况做出判断。塔罗牌是一种自我探索的工具，最终的选择权在您自己手中。
        </Text>
      </Space>
    </Card>
  );
};

export default AiTarotInterpretation;
