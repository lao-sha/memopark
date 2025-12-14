/**
 * AI解读结果展示页面（通用）
 *
 * 功能：
 * - 显示AI解读请求状态
 * - 展示解读结果内容
 * - 支持用户评分
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  Space,
  Spin,
  Tag,
  message,
  Divider,
  Result,
  Rate,
  Alert,
  Descriptions,
} from 'antd';
import {
  RobotOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  StarOutlined,
} from '@ant-design/icons';
import {
  getDivinationInterpretationRequest,
  getDivinationInterpretationResult,
  rateDivinationInterpretation,
} from '../../services/divinationService';
import {
  InterpretationRequest,
  InterpretationResult,
  DIVINATION_TYPE_NAMES,
  INTERPRETATION_TYPE_NAMES,
} from '../../types/divination';

const { Title, Text, Paragraph } = Typography;

/**
 * AI解读结果页面组件
 */
const InterpretationResultPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<InterpretationRequest | null>(null);
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  /**
   * 加载解读数据
   */
  useEffect(() => {
    loadInterpretationData();
  }, [requestId]);

  const loadInterpretationData = async () => {
    if (!requestId) {
      message.error('无效的解读ID');
      return;
    }

    setLoading(true);
    try {
      const reqId = parseInt(requestId);

      // 获取请求信息
      const reqData = await getDivinationInterpretationRequest(reqId);
      if (!reqData) {
        message.error('找不到解读请求');
        return;
      }
      setRequest(reqData);

      // 如果已完成，获取解读结果
      if (reqData.status === 2) { // Completed
        const resultData = await getDivinationInterpretationResult(reqId);
        if (resultData) {
          setResult(resultData);
          setRating(resultData.userRating || 0);
        }
      }
    } catch (error) {
      console.error('加载解读数据失败:', error);
      message.error('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 提交评分
   */
  const handleSubmitRating = async (value: number) => {
    if (!requestId) return;

    setSubmittingRating(true);
    try {
      await rateDivinationInterpretation(parseInt(requestId), value);
      setRating(value);
      message.success('评分成功！');
    } catch (error) {
      console.error('评分失败:', error);
      message.error('评分失败，请稍后重试');
    } finally {
      setSubmittingRating(false);
    }
  };

  /**
   * 渲染状态标签
   */
  const renderStatusTag = (status: number) => {
    switch (status) {
      case 0: // Pending
        return <Tag icon={<ClockCircleOutlined />} color="default">等待处理</Tag>;
      case 1: // Processing
        return <Tag icon={<LoadingOutlined />} color="processing">解读中</Tag>;
      case 2: // Completed
        return <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>;
      case 3: // Failed
        return <Tag color="error">失败</Tag>;
      default:
        return <Tag>未知状态</Tag>;
    }
  };

  /**
   * 渲染加载中
   */
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  /**
   * 渲染请求不存在
   */
  if (!request) {
    return (
      <Result
        status="404"
        title="解读请求不存在"
        subTitle="请检查解读ID是否正确"
        extra={
          <Button type="primary" onClick={() => navigate(-1)}>
            返回
          </Button>
        }
      />
    );
  }

  /**
   * 渲染处理中状态
   */
  if (request.status !== 2) {
    return (
      <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
        <Card>
          <Result
            icon={<LoadingOutlined style={{ fontSize: 48, color: '#1890ff' }} />}
            title="AI正在解读中"
            subTitle="请稍候，通常需要几秒到几分钟时间"
            extra={
              <Space direction="vertical" style={{ width: '100%' }}>
                {renderStatusTag(request.status)}
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="占卜类型">
                    {DIVINATION_TYPE_NAMES[request.divinationType]}
                  </Descriptions.Item>
                  <Descriptions.Item label="解读类型">
                    {INTERPRETATION_TYPE_NAMES[request.interpretationType]}
                  </Descriptions.Item>
                  <Descriptions.Item label="请求时间">
                    {new Date(request.createdAt * 1000).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                </Descriptions>
                <Button onClick={loadInterpretationData}>刷新状态</Button>
                <Button onClick={() => navigate(-1)}>返回</Button>
              </Space>
            }
          />
        </Card>
      </div>
    );
  }

  /**
   * 渲染解读结果
   */
  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        返回
      </Button>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center' }}>
            <Title level={3}>
              <RobotOutlined /> AI智能解读
            </Title>
            {renderStatusTag(request.status)}
          </div>

          <Divider />

          {/* 解读信息 */}
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="占卜类型">
              {DIVINATION_TYPE_NAMES[request.divinationType]}
            </Descriptions.Item>
            <Descriptions.Item label="解读类型">
              {INTERPRETATION_TYPE_NAMES[request.interpretationType]}
            </Descriptions.Item>
            <Descriptions.Item label="Oracle节点">
              <Text code style={{ fontSize: 11 }}>{result?.oracle || 'Unknown'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="模型版本">
              {result?.modelVersion || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {request.completedAt
                ? new Date(request.completedAt * 1000).toLocaleString('zh-CN')
                : 'N/A'}
            </Descriptions.Item>
          </Descriptions>

          {/* 解读内容 */}
          {result && (
            <>
              <Alert
                message="解读内容"
                description={
                  <div>
                    <Paragraph>
                      解读内容已存储在IPFS上，CID: <Text code>{result.contentCid}</Text>
                    </Paragraph>
                    <Paragraph type="secondary">
                      提示：完整的解读内容需要从IPFS获取并解析。当前版本暂未实现完整的内容展示。
                    </Paragraph>
                  </div>
                }
                type="info"
                showIcon
              />

              {/* 质量评分 */}
              {result.qualityScore !== undefined && (
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>系统质量评分：</Text>
                    <Rate disabled value={result.qualityScore / 20} style={{ fontSize: 24 }} />
                    <Text type="secondary">{result.qualityScore}/100</Text>
                  </Space>
                </Card>
              )}

              {/* 用户评分 */}
              <Card size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>
                    <StarOutlined /> 您的评分：
                  </Text>
                  <Rate
                    value={rating}
                    onChange={handleSubmitRating}
                    disabled={submittingRating || rating > 0}
                    style={{ fontSize: 32 }}
                  />
                  {rating > 0 && (
                    <Text type="success">感谢您的评分！</Text>
                  )}
                  {!rating && (
                    <Text type="secondary">请为本次解读打分</Text>
                  )}
                </Space>
              </Card>
            </>
          )}

          {/* 操作按钮 */}
          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button onClick={() => navigate(-1)}>
              返回
            </Button>
            <Button type="primary" onClick={loadInterpretationData}>
              刷新
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default InterpretationResultPage;
