/**
 * 紫微斗数解卦结果页面
 *
 * 展示命盘的完整解卦结果，包括：
 * - 整体评分
 * - 命盘格局
 * - 十二宫解读
 * - 四化分析
 * - 大限运程
 */

import React, { useEffect, useState } from 'react';
import {
  Spin,
  Result,
  Button,
  Tabs,
  FloatButton,
  message,
  Row,
  Col,
  Segmented,
  Space,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  StarOutlined,
  AppstoreOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import {
  ScoreCard,
  PalaceInterpretationCard,
  PatternList,
  SiHuaAnalysisCard,
  DaXianList,
} from './components';
import { getInterpretation, getChart } from '../../services/ziweiService';
import type { ZiweiInterpretation, ZiweiChart, PalaceInterpretation } from '../../types/ziwei';
import { Gong, GONG_NAMES } from '../../types/ziwei';

const { Title, Text } = Typography;

/**
 * 从 hash 路由中提取命盘 ID
 * 格式: #/ziwei/interpretation/{chartId}
 */
function getChartIdFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/#\/ziwei\/interpretation\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * 计算当前年龄
 */
function calculateAge(lunarYear: number): number {
  const currentYear = new Date().getFullYear();
  return currentYear - lunarYear;
}

/**
 * 紫微斗数解卦结果页面
 */
const ZiweiInterpretationPage: React.FC = () => {
  const [chartId, setChartId] = useState<string | null>(getChartIdFromHash());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<ZiweiInterpretation | null>(null);
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [palaceViewMode, setPalaceViewMode] = useState<'grid' | 'list'>('grid');

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      setChartId(getChartIdFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 返回上一页
  const handleBack = () => {
    window.history.back();
  };

  // 导航到首页
  const navigateHome = () => {
    window.location.hash = '#/';
  };

  // 加载解卦数据
  const loadData = async () => {
    if (!chartId) {
      setError('缺少命盘ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const id = parseInt(chartId, 10);
      if (isNaN(id)) {
        throw new Error('无效的命盘ID');
      }

      // 并行加载命盘和解卦数据
      const [chartData, interpData] = await Promise.all([
        getChart(id),
        getInterpretation(id),
      ]);

      if (!chartData) {
        throw new Error('命盘不存在');
      }

      setChart(chartData);
      setInterpretation(interpData);

      if (!interpData) {
        message.warning('解卦数据加载失败，使用本地计算结果');
      }
    } catch (err) {
      console.error('[ZiweiInterpretationPage] 加载失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [chartId]);

  // 刷新按钮
  const handleRefresh = () => {
    loadData();
  };

  // 加载中
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="正在解析命盘..." />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
        extra={[
          <Button key="back" icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>,
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={handleRefresh}>
            重试
          </Button>,
        ]}
      />
    );
  }

  // 无数据
  if (!interpretation || !chart) {
    return (
      <Result
        status="warning"
        title="暂无数据"
        subTitle="无法获取解卦数据"
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
        }
      />
    );
  }

  const currentAge = calculateAge(chart.lunarYear);

  // 十二宫列表（按三合分组）
  const renderPalaceGrid = () => {
    const { palaceInterpretations } = interpretation;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text type="secondary">十二宫解读</Text>
          <Segmented
            size="small"
            options={[
              { value: 'grid', label: '网格' },
              { value: 'list', label: '列表' },
            ]}
            value={palaceViewMode}
            onChange={(v) => setPalaceViewMode(v as 'grid' | 'list')}
          />
        </div>

        {palaceViewMode === 'grid' ? (
          <Row gutter={[8, 8]}>
            {palaceInterpretations.map((interp, idx) => (
              <Col span={12} key={idx}>
                <PalaceInterpretationCard
                  interpretation={interp}
                  diZhiIndex={idx}
                  isMingGong={idx === chart.mingGong}
                  isShenGong={idx === chart.shenGong}
                  expanded={false}
                />
              </Col>
            ))}
          </Row>
        ) : (
          <div>
            {palaceInterpretations.map((interp, idx) => (
              <PalaceInterpretationCard
                key={idx}
                interpretation={interp}
                diZhiIndex={idx}
                isMingGong={idx === chart.mingGong}
                isShenGong={idx === chart.shenGong}
                expanded={true}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // 标签页配置
  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <StarOutlined />
          总览
        </span>
      ),
      children: (
        <div>
          {/* 整体评分 */}
          <ScoreCard
            score={interpretation.overallScore}
            wuXingDistribution={interpretation.wuXingDistribution}
            showDetails={true}
          />

          {/* 命盘格局 */}
          <PatternList
            patterns={interpretation.patterns}
            showDetails={true}
            collapsible={true}
          />

          {/* 大限运程概览 */}
          <DaXianList
            daXians={interpretation.daXianInterpretations}
            currentAge={currentAge}
            showDetails={false}
          />
        </div>
      ),
    },
    {
      key: 'palaces',
      label: (
        <span>
          <AppstoreOutlined />
          十二宫
        </span>
      ),
      children: renderPalaceGrid(),
    },
    {
      key: 'sihua',
      label: (
        <span>
          <SwapOutlined />
          四化
        </span>
      ),
      children: (
        <SiHuaAnalysisCard
          analysis={interpretation.siHuaAnalysis}
          mingGongPos={chart.mingGong}
        />
      ),
    },
    {
      key: 'daxian',
      label: (
        <span>
          <ClockCircleOutlined />
          大限
        </span>
      ),
      children: (
        <DaXianList
          daXians={interpretation.daXianInterpretations}
          currentAge={currentAge}
          showDetails={true}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 16px 80px', maxWidth: 640, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          />
          <div>
            <Title level={4} style={{ margin: 0 }}>命盘解读</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              命盘ID: {chartId} | 年龄: {currentAge}岁
            </Text>
          </div>
        </Space>
      </div>

      {/* 内容标签页 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        centered
        size="small"
      />

      {/* 浮动按钮 */}
      <FloatButton.Group shape="circle" style={{ right: 24 }}>
        <FloatButton
          icon={<ReloadOutlined />}
          tooltip="刷新"
          onClick={handleRefresh}
        />
        <FloatButton
          icon={<HomeOutlined />}
          tooltip="首页"
          onClick={navigateHome}
        />
      </FloatButton.Group>
    </div>
  );
};

export default ZiweiInterpretationPage;
