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
  message,
} from 'antd';
import {
  ThunderboltOutlined,
  RobotOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  getInterpretationSmart,
  cacheInterpretationOnChain,
  type SimplifiedInterpretation,
} from '../../../services/baziChainService';

interface Props {
  chartId: number;
  onRequestAi?: () => void;
}

export const BasicInterpretationCard: React.FC<Props> = ({
  chartId,
  onRequestAi,
}) => {
  const [interpretation, setInterpretation] =
    useState<SimplifiedInterpretation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caching, setCaching] = useState(false);

  useEffect(() => {
    loadInterpretation();
  }, [chartId]);

  const loadInterpretation = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getInterpretationSmart(chartId);

      if (result) {
        setInterpretation(result);
      } else {
        setError('尚未缓存解盘结果');
      }
    } catch (err: any) {
      console.error('加载解盘失败:', err);
      setError(err.message || '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCache = async () => {
    setCaching(true);
    try {
      await cacheInterpretationOnChain(chartId);
      message.success('解盘结果已缓存到链上');
      // 重新加载
      await loadInterpretation();
    } catch (err: any) {
      console.error('缓存失败:', err);
      message.error(`缓存失败: ${err.message}`);
    } finally {
      setCaching(false);
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
          message="未找到解盘结果"
          description={
            <div>
              <p>{error}</p>
              <p>您可以选择缓存解盘结果到链上（需支付少量 Gas 费用），后续查询将更快速。</p>
            </div>
          }
          type="warning"
          showIcon
          action={
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={caching}
              onClick={handleCache}
            >
              立即缓存
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

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#faad14' }} />
          <span>基础解盘</span>
          <Tag color="green">已缓存</Tag>
          <Tag color="purple">v{interpretation.algorithmVersion}</Tag>
        </Space>
      }
      extra={
        <Space>
          <SafetyOutlined />
          <span style={{ fontSize: 12 }}>可信度</span>
          <Progress
            type="circle"
            width={40}
            percent={interpretation.confidence}
            status={getConfidenceStatus(interpretation.confidence)}
            format={() => getConfidenceLabel(interpretation.confidence)}
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
              value={interpretation.geJu}
              valueStyle={{ fontSize: 18, color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card type="inner" size="small">
            <Statistic
              title="命局强弱"
              value={interpretation.qiangRuo}
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card type="inner" size="small">
            <Statistic
              title="综合评分"
              value={interpretation.score}
              suffix="/100"
              valueStyle={{ fontSize: 18, color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* 用神忌神 */}
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <strong>用神：</strong>
            <Tag color="success" style={{ marginLeft: 8, fontSize: 14 }}>
              {interpretation.yongShen}
            </Tag>
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 48 }}>
            {interpretation.yongShenType}
          </div>
        </Col>
        <Col span={12}>
          <div style={{ marginBottom: 12 }}>
            <strong>喜神：</strong>
            <Tag color="processing" style={{ marginLeft: 8, fontSize: 14 }}>
              {interpretation.xiShen}
            </Tag>
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 48 }}>
            辅助用神
          </div>
        </Col>
      </Row>

      <div style={{ marginTop: 12 }}>
        <strong>忌神：</strong>
        <Tag color="error" style={{ marginLeft: 8, fontSize: 14 }}>
          {interpretation.jiShen}
        </Tag>
        <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
          需要避免的五行
        </span>
      </div>

      <Divider />

      {/* 可信度警告（低于 70 分） */}
      {interpretation.confidence < 70 && (
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
              基础解盘仅提供关键指标参考，<strong>AI 智能解读</strong>提供：
            </p>
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>完整的命理分析和人生指导</li>
              <li>性格特征、优缺点详解</li>
              <li>事业、财运、婚姻、健康建议</li>
              <li>流年大运详细分析</li>
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
        算法版本 v{interpretation.algorithmVersion} · 已缓存到链上 ·
        数据大小 13 bytes
      </div>
    </Card>
  );
};
