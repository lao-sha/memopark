/**
 * AI 解卦服务页面
 *
 * 提供 AI 智能解读功能：
 * - 选择解读类型（基础/详细/专业/分类解读）
 * - 显示费用估算
 * - 提交解读请求
 * - 查看解读结果
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Radio,
  Space,
  Spin,
  Tag,
  message,
  Divider,
  Result,
  Steps,
  Alert,
} from 'antd';
import {
  RobotOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  RiseOutlined,
  StarOutlined,
} from '@ant-design/icons';
import {
  getHexagram,
  requestAiInterpretation,
  getInterpretationRequest,
  getInterpretationResult,
} from '../../services/meihuaService';
import type { Hexagram, InterpretationRequest, InterpretationResult } from '../../types/meihua';
import {
  InterpretationType,
  InterpretationStatus,
  INTERPRETATION_TYPE_NAMES,
  INTERPRETATION_FEE_MULTIPLIER,
  TRIGRAM_SYMBOLS,
  getHexagramName,
} from '../../types/meihua';
import './MeihuaPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 解读类型图标
 */
const INTERPRETATION_ICONS: Record<InterpretationType, React.ReactNode> = {
  [InterpretationType.Basic]: <FileTextOutlined />,
  [InterpretationType.Detailed]: <BulbOutlined />,
  [InterpretationType.Professional]: <StarOutlined />,
  [InterpretationType.Career]: <RiseOutlined />,
  [InterpretationType.Relationship]: <HeartOutlined />,
  [InterpretationType.Health]: <MedicineBoxOutlined />,
  [InterpretationType.Wealth]: <DollarOutlined />,
};

/**
 * 解读类型描述
 */
const INTERPRETATION_DESCRIPTIONS: Record<InterpretationType, string> = {
  [InterpretationType.Basic]: '基于体用关系的简要吉凶判断，适合快速了解卦象大意',
  [InterpretationType.Detailed]: '包含卦辞、爻辞、体用分析的完整解读',
  [InterpretationType.Professional]: '深度分析五行生克、时空因素、应期推算',
  [InterpretationType.Career]: '针对事业发展、职场晋升、创业投资的专项解读',
  [InterpretationType.Relationship]: '针对感情婚姻、人际关系的专项解读',
  [InterpretationType.Health]: '针对身体健康、养生调理的专项解读',
  [InterpretationType.Wealth]: '针对财运投资、求财谋利的专项解读',
};

/**
 * 基础费用（DUST）
 */
const BASE_FEE = 100;

/**
 * AI 解卦页面组件
 */
const AiInterpretationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 状态
  const [hexagram, setHexagram] = useState<Hexagram | null>(null);
  const [selectedType, setSelectedType] = useState<InterpretationType>(InterpretationType.Basic);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [request, setRequest] = useState<InterpretationRequest | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);

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
    } catch (error) {
      console.error('加载卦象失败:', error);
      message.error('加载卦象失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * 轮询解读状态
   */
  const pollRequestStatus = useCallback(async (reqId: number) => {
    try {
      const req = await getInterpretationRequest(reqId);
      setRequest(req);

      if (req?.status === InterpretationStatus.Completed) {
        const res = await getInterpretationResult(reqId);
        setResult(res);
      } else if (
        req?.status === InterpretationStatus.Pending ||
        req?.status === InterpretationStatus.Processing
      ) {
        // 继续轮询
        setTimeout(() => pollRequestStatus(reqId), 5000);
      }
    } catch (error) {
      console.error('查询解读状态失败:', error);
    }
  }, []);

  useEffect(() => {
    loadHexagram();
  }, [loadHexagram]);

  useEffect(() => {
    if (requestId) {
      pollRequestStatus(requestId);
    }
  }, [requestId, pollRequestStatus]);

  /**
   * 计算费用
   */
  const calculateFee = (type: InterpretationType): number => {
    return BASE_FEE * INTERPRETATION_FEE_MULTIPLIER[type];
  };

  /**
   * 提交解读请求
   */
  const handleSubmit = async () => {
    if (!hexagram) return;

    setSubmitting(true);
    try {
      const reqId = await requestAiInterpretation(hexagram.id, selectedType);
      setRequestId(reqId);
      message.success('解读请求已提交，AI 正在分析中...');
    } catch (error) {
      console.error('提交解读请求失败:', error);
      message.error('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 获取当前步骤
   */
  const getCurrentStep = (): number => {
    if (!request) return 0;
    if (request.status === InterpretationStatus.Pending) return 1;
    if (request.status === InterpretationStatus.Processing) return 2;
    if (request.status === InterpretationStatus.Completed) return 3;
    return 0;
  };

  if (loading) {
    return (
      <div className="meihua-page loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!hexagram) {
    return (
      <div className="meihua-page">
        <Result
          status="404"
          title="卦象不存在"
          subTitle="请先起卦后再请求 AI 解读"
          extra={
            <Button type="primary" onClick={() => navigate('/meihua')}>
              去起卦
            </Button>
          }
        />
      </div>
    );
  }

  // 已有解读结果
  if (result) {
    return (
      <div className="meihua-page">
        <Card className="result-card">
          <Result
            status="success"
            icon={<RobotOutlined />}
            title="AI 解读完成"
            subTitle={`${getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram)} · ${INTERPRETATION_TYPE_NAMES[selectedType]}`}
          />
        </Card>

        <Card title="解读内容" className="interpretation-content-card">
          {/* TODO: 从 IPFS 加载解读内容 */}
          <Alert
            type="info"
            message="解读内容"
            description={`解读内容 CID: ${result.contentCid}`}
            showIcon
          />

          {result.summaryCid && (
            <div style={{ marginTop: 16 }}>
              <Alert
                type="success"
                message="解读摘要"
                description={`摘要 CID: ${result.summaryCid}`}
                showIcon
              />
            </div>
          )}

          <Divider />

          <Space>
            <Text type="secondary">模型版本: {result.modelVersion}</Text>
            <Text type="secondary">语言: {result.language}</Text>
          </Space>
        </Card>

        <div className="action-buttons">
          <Space>
            <Button onClick={() => navigate(`/meihua/hexagram/${hexagram.id}`)}>
              返回卦象详情
            </Button>
            <Button type="primary" onClick={() => navigate('/meihua/market')}>
              找大师深度解读
            </Button>
          </Space>
        </div>
      </div>
    );
  }

  // 正在处理中
  if (request && request.status !== InterpretationStatus.Completed) {
    return (
      <div className="meihua-page">
        <Card className="processing-card">
          <Title level={4}>
            <RobotOutlined style={{ marginRight: 8 }} />
            AI 解读进行中
          </Title>

          <div className="hexagram-brief">
            <span className="hexagram-symbol">
              {TRIGRAM_SYMBOLS[hexagram.upperTrigram]}
              {TRIGRAM_SYMBOLS[hexagram.lowerTrigram]}
            </span>
            <span className="hexagram-name">
              {getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram)}
            </span>
          </div>

          <Steps
            current={getCurrentStep()}
            items={[
              { title: '选择类型', icon: <CheckCircleOutlined /> },
              { title: '提交请求', icon: <CheckCircleOutlined /> },
              {
                title: 'AI 分析',
                icon: request.status === InterpretationStatus.Processing
                  ? <LoadingOutlined />
                  : <ClockCircleOutlined />,
              },
              { title: '解读完成', icon: <CheckCircleOutlined /> },
            ]}
          />

          <div className="processing-hint">
            <Spin />
            <Paragraph type="secondary" style={{ marginTop: 16 }}>
              AI 正在根据梅花易数理论分析您的卦象，请稍候...
            </Paragraph>
          </div>
        </Card>
      </div>
    );
  }

  // 选择解读类型
  return (
    <div className="meihua-page">
      {/* 卦象信息 */}
      <Card className="hexagram-info-card">
        <div className="hexagram-brief">
          <span className="hexagram-symbol">
            {TRIGRAM_SYMBOLS[hexagram.upperTrigram]}
            {TRIGRAM_SYMBOLS[hexagram.lowerTrigram]}
          </span>
          <span className="hexagram-name">
            {getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram)}
          </span>
        </div>
        <Text type="secondary">选择 AI 解读类型</Text>
      </Card>

      {/* 解读类型选择 */}
      <Card title="解读类型" className="type-selection-card">
        <Radio.Group
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="interpretation-type-group"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {Object.values(InterpretationType)
              .filter((v) => typeof v === 'number')
              .map((type) => {
                const typeNum = type as InterpretationType;
                const fee = calculateFee(typeNum);
                return (
                  <Radio key={typeNum} value={typeNum} className="interpretation-type-option">
                    <div className="type-option-content">
                      <div className="type-header">
                        <span className="type-icon">{INTERPRETATION_ICONS[typeNum]}</span>
                        <span className="type-name">{INTERPRETATION_TYPE_NAMES[typeNum]}</span>
                        <Tag color="gold">{fee} DUST</Tag>
                      </div>
                      <Text type="secondary" className="type-description">
                        {INTERPRETATION_DESCRIPTIONS[typeNum]}
                      </Text>
                    </div>
                  </Radio>
                );
              })}
          </Space>
        </Radio.Group>
      </Card>

      {/* 费用确认 */}
      <Card className="fee-card">
        <div className="fee-summary">
          <div className="fee-row">
            <Text>解读类型</Text>
            <Text strong>{INTERPRETATION_TYPE_NAMES[selectedType]}</Text>
          </div>
          <div className="fee-row">
            <Text>费用</Text>
            <Text strong style={{ color: '#faad14', fontSize: 18 }}>
              {calculateFee(selectedType)} DUST
            </Text>
          </div>
        </div>

        <Divider />

        <Button
          type="primary"
          size="large"
          icon={<RobotOutlined />}
          loading={submitting}
          onClick={handleSubmit}
          block
        >
          支付并获取 AI 解读
        </Button>

        <Paragraph type="secondary" className="fee-hint">
          费用将从您的账户扣除，解读结果将永久保存在区块链上
        </Paragraph>
      </Card>

      {/* 返回按钮 */}
      <div className="action-buttons">
        <Button onClick={() => navigate(`/meihua/hexagram/${hexagram.id}`)}>
          返回卦象详情
        </Button>
      </div>
    </div>
  );
};

export default AiInterpretationPage;
