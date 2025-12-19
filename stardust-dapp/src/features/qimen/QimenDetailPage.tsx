/**
 * 奇门遁甲详细解卦页面
 *
 * 功能：
 * - 显示完整解卦结果
 * - 整合所有解卦组件（核心解卦、九宫、用神、应期、格局）
 * - 支持链端和本地两种模式
 * - 支持问事类型选择
 * - 提供导航和返回功能
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  message,
  Spin,
  Alert,
  Tabs,
  Select,
  Breadcrumb,
} from 'antd';
import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
  BookOutlined,
  CompassOutlined,
  AimOutlined,
  ClockCircleOutlined,
  LayoutOutlined,
} from '@ant-design/icons';

// 导入类型
import type { QuestionType, QimenFullInterpretation } from '../../types/qimen';

// 导入服务
import { getFullInterpretation } from '../../services/qimenService';

// 导入组件
import { CoreInterpretationCard } from './components/CoreInterpretationCard';
import { PalacesGrid } from './components/PalacesGrid';
import { YongShenCard } from './components/YongShenCard';
import { YingQiCard } from './components/YingQiCard';
import { GeJuDetailCard } from './components/GeJuDetailCard';

const { Title, Text, Paragraph } = Typography;

/**
 * 问事类型选项（使用枚举值）
 */
const QUESTION_TYPE_OPTIONS = [
  { label: '综合运势', value: 0 }, // QuestionType.General
  { label: '事业工作', value: 1 }, // QuestionType.Career
  { label: '财运求财', value: 2 }, // QuestionType.Wealth
  { label: '婚姻感情', value: 3 }, // QuestionType.Marriage
  { label: '健康疾病', value: 4 }, // QuestionType.Health
  { label: '学业考试', value: 5 }, // QuestionType.Study
  { label: '出行远行', value: 6 }, // QuestionType.Travel
  { label: '官司诉讼', value: 7 }, // QuestionType.Lawsuit
  { label: '寻人寻物', value: 8 }, // QuestionType.Finding
  { label: '投资理财', value: 9 }, // QuestionType.Investment
  { label: '合作交易', value: 10 }, // QuestionType.Business
  { label: '祈福求神', value: 11 }, // QuestionType.Prayer
] as const;

/**
 * 奇门遁甲详细解卦页面
 */
const QimenDetailPage: React.FC = () => {
  // 解析 URL 参数
  const [hash, setHash] = useState(window.location.hash);

  // 从 hash 中提取 id
  const idMatch = hash.match(/#\/qimen\/detail\/(\d+)/);
  const id = idMatch ? idMatch[1] : null;

  // 从 hash 中提取查询参数
  const searchParams = new URLSearchParams(hash.split('?')[1] || '');

  // 状态
  const [chartId, setChartId] = useState<number | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>(0); // QuestionType.General
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<QimenFullInterpretation | null>(null);
  const [activeTab, setActiveTab] = useState('1');

  useEffect(() => {
    // 从 URL 参数获取排盘 ID
    const idFromParam = id ? parseInt(id) : null;
    const idFromQuery = searchParams.get('chartId');
    const finalId = idFromParam || (idFromQuery ? parseInt(idFromQuery) : null);

    if (finalId) {
      setChartId(finalId);
    } else {
      setError('未找到排盘ID，请从排盘页面进入');
      setLoading(false);
    }

    // 从 URL 参数获取问事类型
    const typeFromQuery = searchParams.get('questionType');
    if (typeFromQuery) {
      const typeNum = parseInt(typeFromQuery);
      if (!isNaN(typeNum) && QUESTION_TYPE_OPTIONS.find(opt => opt.value === typeNum)) {
        setQuestionType(typeNum as QuestionType);
      }
    }
  }, [id, searchParams]);

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (chartId) {
      loadInterpretation();
    }
  }, [chartId, questionType]);

  /**
   * 加载完整解卦结果
   */
  const loadInterpretation = async () => {
    if (!chartId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getFullInterpretation(chartId, questionType);

      if (result) {
        setInterpretation(result);
      } else {
        setError('无法获取解卦结果，请确认排盘存在');
      }
    } catch (err: any) {
      console.error('加载解卦失败:', err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理问事类型变更
   */
  const handleQuestionTypeChange = (value: QuestionType) => {
    setQuestionType(value);
    // 更新 URL 参数
    const newHash = `#/qimen/detail/${chartId}?questionType=${value}`;
    window.location.hash = newHash;
  };

  /**
   * 返回排盘页面
   */
  const handleGoBack = () => {
    window.location.hash = '#/qimen';
  };

  /**
   * 渲染页面头部
   */
  const renderHeader = () => (
    <Card style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 面包屑导航 */}
        <Breadcrumb
          items={[
            {
              title: (
                <a onClick={handleGoBack}>
                  <CompassOutlined /> 奇门排盘
                </a>
              ),
            },
            {
              title: '详细解卦',
            },
          ]}
        />

        {/* 页面标题 */}
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            <BookOutlined /> 奇门遁甲 · 详细解卦
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            排盘ID: {chartId} | 问事类型: {QUESTION_TYPE_OPTIONS.find(opt => opt.value === questionType)?.label || '未知'}
          </Paragraph>
        </div>

        {/* 问事类型选择 */}
        <div>
          <Space>
            <Text strong>问事类型：</Text>
            <Select
              value={questionType}
              onChange={handleQuestionTypeChange}
              style={{ width: 200 }}
              options={QUESTION_TYPE_OPTIONS}
            />
          </Space>
          <div style={{ marginTop: 8 }}>
            <Alert
              message={
                <Space>
                  <InfoCircleOutlined />
                  <Text>不同问事类型会影响用神选择和应期推算</Text>
                </Space>
              }
              type="info"
              showIcon={false}
              style={{ fontSize: 12 }}
            />
          </div>
        </div>
      </Space>
    </Card>
  );

  /**
   * 渲染错误状态
   */
  const renderError = () => (
    <div style={{ padding: 12, maxWidth: 414, paddingBottom: 80, minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
      {renderHeader()}
      <Alert
        message="加载失败"
        description={error}
        type="error"
        showIcon
        action={
          <Space direction="vertical">
            <Button size="small" onClick={loadInterpretation}>
              重试
            </Button>
            <Button size="small" onClick={handleGoBack}>
              返回排盘
            </Button>
          </Space>
        }
      />
    </div>
  );

  /**
   * 渲染加载状态
   */
  const renderLoading = () => (
    <div style={{ padding: 12, maxWidth: 414, paddingBottom: 80, minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
      {renderHeader()}
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="正在加载解卦结果..." />
        </div>
      </Card>
    </div>
  );

  /**
   * 渲染主内容
   */
  const renderContent = () => {
    if (!interpretation) return null;

    const { core, palaces, yongShen, yingQi, geJuDetail } =
      interpretation;

    // 收集用神宫位用于高亮
    const highlightGongs = yongShen
      ? [yongShen.primaryGong]
      : [];

    return (
      <div style={{ padding: 12, maxWidth: 414, paddingBottom: 80, minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
        {renderHeader()}

        {/* 核心解卦 */}
        {core && (
          <CoreInterpretationCard
            chartId={chartId!}
            onRequestDetail={() => setActiveTab('2')}
          />
        )}

        {/* 标签页 - 详细解读 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: '1',
              label: (
                <span>
                  <LayoutOutlined /> 九宫详解
                </span>
              ),
              children: palaces && palaces.length > 0 ? (
                <PalacesGrid palaces={palaces} highlightGongs={highlightGongs} />
              ) : (
                <Alert message="暂无九宫数据" type="warning" showIcon />
              ),
            },
            {
              key: '2',
              label: (
                <span>
                  <AimOutlined /> 用神分析
                </span>
              ),
              children: yongShen ? (
                <YongShenCard analysis={yongShen} />
              ) : (
                <Alert message="暂无用神数据" type="warning" showIcon />
              ),
            },
            {
              key: '3',
              label: (
                <span>
                  <ClockCircleOutlined /> 应期推算
                </span>
              ),
              children: yingQi ? (
                <YingQiCard analysis={yingQi} />
              ) : (
                <Alert message="暂无应期数据" type="warning" showIcon />
              ),
            },
            {
              key: '4',
              label: (
                <span>
                  <BookOutlined /> 格局详解
                </span>
              ),
              children: geJuDetail ? (
                <GeJuDetailCard detail={geJuDetail} />
              ) : (
                <Alert message="暂无格局数据" type="warning" showIcon />
              ),
            },
          ]}
        />

        {/* 使用说明 */}
        <Card style={{ marginTop: 16 }}>
          <Title level={5}>
            <InfoCircleOutlined /> 解卦说明
          </Title>
          <Space direction="vertical" size={8}>
            <div>
              <Text strong>核心解卦：</Text>
              <Text type="secondary">
                展示整体吉凶、格局类型、旺衰状态和可信度，是整盘的总体评估
              </Text>
            </div>
            <div>
              <Text strong>九宫详解：</Text>
              <Text type="secondary">
                展示九宫的详细信息，包括星门神配置、天地盘干、五行关系等
              </Text>
            </div>
            <div>
              <Text strong>用神分析：</Text>
              <Text type="secondary">
                根据问事类型选取用神，分析用神旺衰得力情况，评估事情成败
              </Text>
            </div>
            <div>
              <Text strong>应期推算：</Text>
              <Text type="secondary">
                推算事情应验的时间，包括主应期和次应期，以及吉利和不利时间
              </Text>
            </div>
            <div>
              <Text strong>格局详解：</Text>
              <Text type="secondary">
                解析当前盘面的特殊格局，说明格局的吉凶和适用场景
              </Text>
            </div>
          </Space>

          <Divider />

          <Alert
            message="重要提示"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>奇门遁甲解卦需综合多方面因素判断，不可执着于单一指标</li>
                <li>不同问事类型对应不同的用神和判断方法，请正确选择问事类型</li>
                <li>应期仅供参考，实际应期受多种因素影响，需灵活变通</li>
                <li>格局有吉有凶，需结合具体情况和用神分析综合判断</li>
              </ul>
            }
            type="warning"
            showIcon
          />
        </Card>

        {/* 底部导航 */}
        <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack}>
            返回排盘页面
          </Button>
        </div>
      </div>
    );
  };

  // 根据状态渲染不同内容
  if (error && !interpretation) {
    return renderError();
  }

  if (loading && !interpretation) {
    return renderLoading();
  }

  return renderContent();
};

export default QimenDetailPage;
