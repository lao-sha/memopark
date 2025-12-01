/**
 * 梅花易数起卦页面
 *
 * 支持多种起卦方式：时间起卦、数字起卦、文字起卦、随机起卦
 */

import React, { useState, useCallback } from 'react';
import { Card, Button, Input, InputNumber, Tabs, message, Spin, Space, Typography, Divider } from 'antd';
import { ClockCircleOutlined, NumberOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import {
  divineByTime,
  divineByNumbers,
  divineByText,
  divineRandom,
} from '../../services/meihuaService';
import './MeihuaPage.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/** 起卦方式标签页 */
type DivinationTab = 'time' | 'number' | 'text' | 'random';

/**
 * 起卦页面组件
 */
const DivinationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DivinationTab>('time');
  const [loading, setLoading] = useState(false);

  // 数字起卦状态
  const [upperNumber, setUpperNumber] = useState<number>(1);
  const [lowerNumber, setLowerNumber] = useState<number>(1);

  // 文字起卦状态
  const [inputText, setInputText] = useState('');

  /**
   * 导航到指定路由（使用 hash 路由）
   */
  const navigate = useCallback((path: string) => {
    window.location.hash = `#${path}`;
  }, []);

  /**
   * 处理起卦成功
   */
  const handleDivinationSuccess = useCallback((hexagramId: number) => {
    message.success('起卦成功！');
    navigate(`/meihua/hexagram/${hexagramId}`);
  }, [navigate]);

  /**
   * 时间起卦
   */
  const handleTimeDivination = useCallback(async () => {
    setLoading(true);
    try {
      const hexagramId = await divineByTime();
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('时间起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [handleDivinationSuccess]);

  /**
   * 数字起卦
   *
   * 使用两个数字进行起卦，动爻由当前时辰自动计算
   */
  const handleNumberDivination = useCallback(async () => {
    if (upperNumber < 1 || lowerNumber < 1) {
      message.warning('请输入有效的数字');
      return;
    }
    setLoading(true);
    try {
      const hexagramId = await divineByNumbers(upperNumber, lowerNumber);
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('数字起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [upperNumber, lowerNumber, handleDivinationSuccess]);

  /**
   * 文字起卦
   */
  const handleTextDivination = useCallback(async () => {
    if (!inputText.trim()) {
      message.warning('请输入占卜问题');
      return;
    }
    setLoading(true);
    try {
      const hexagramId = await divineByText(inputText);
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('文字起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [inputText, handleDivinationSuccess]);

  /**
   * 随机起卦
   */
  const handleRandomDivination = useCallback(async () => {
    setLoading(true);
    try {
      const hexagramId = await divineRandom();
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('随机起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [handleDivinationSuccess]);

  /**
   * 渲染时间起卦面板
   */
  const renderTimePanel = () => (
    <div className="divination-panel">
      <Paragraph className="panel-description">
        时间起卦是梅花易数最经典的起卦方式。系统将根据当前农历时间自动计算卦象，
        取年月日之和为上卦，加时辰数为下卦，总数除以六得动爻。
      </Paragraph>
      <div className="time-info">
        <Text type="secondary">当前时间将自动转换为农历进行起卦</Text>
      </div>
      <Button
        type="primary"
        size="large"
        icon={<ClockCircleOutlined />}
        onClick={handleTimeDivination}
        loading={loading}
        block
      >
        以当前时间起卦
      </Button>
    </div>
  );

  /**
   * 渲染数字起卦面板
   */
  const renderNumberPanel = () => (
    <div className="divination-panel">
      <Paragraph className="panel-description">
        数字起卦适合在看到某些数字时使用，如门牌号、车牌号等。
        输入两个数字，系统将根据这些数字计算上下卦，动爻由当前时辰自动推算。
      </Paragraph>
      <div className="number-inputs">
        <div className="number-input-group">
          <Text>上卦数</Text>
          <InputNumber
            min={1}
            max={999}
            value={upperNumber}
            onChange={(v) => setUpperNumber(v || 1)}
            size="large"
          />
        </div>
        <div className="number-input-group">
          <Text>下卦数</Text>
          <InputNumber
            min={1}
            max={999}
            value={lowerNumber}
            onChange={(v) => setLowerNumber(v || 1)}
            size="large"
          />
        </div>
      </div>
      <Button
        type="primary"
        size="large"
        icon={<NumberOutlined />}
        onClick={handleNumberDivination}
        loading={loading}
        block
      >
        以数字起卦
      </Button>
    </div>
  );

  /**
   * 渲染文字起卦面板
   */
  const renderTextPanel = () => (
    <div className="divination-panel">
      <Paragraph className="panel-description">
        文字起卦将您输入的问题转换为卦象。建议心诚则灵，
        静心冥想您的问题后再输入，问题描述将被哈希存储。
      </Paragraph>
      <TextArea
        placeholder="请输入您想占卜的问题..."
        rows={4}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        maxLength={200}
        showCount
      />
      <div style={{ marginTop: 16 }}>
        <Button
          type="primary"
          size="large"
          icon={<FileTextOutlined />}
          onClick={handleTextDivination}
          loading={loading}
          disabled={!inputText.trim()}
          block
        >
          以文字起卦
        </Button>
      </div>
    </div>
  );

  /**
   * 渲染随机起卦面板
   */
  const renderRandomPanel = () => (
    <div className="divination-panel">
      <Paragraph className="panel-description">
        随机起卦使用区块链随机数生成卦象，适合没有特定问题但想获得指引时使用。
        每次占卜都会生成独一无二的卦象。
      </Paragraph>
      <Button
        type="primary"
        size="large"
        icon={<ThunderboltOutlined />}
        onClick={handleRandomDivination}
        loading={loading}
        block
      >
        随机起卦
      </Button>
    </div>
  );

  const tabItems = [
    {
      key: 'time',
      label: (
        <span>
          <ClockCircleOutlined />
          时间起卦
        </span>
      ),
      children: renderTimePanel(),
    },
    {
      key: 'number',
      label: (
        <span>
          <NumberOutlined />
          数字起卦
        </span>
      ),
      children: renderNumberPanel(),
    },
    {
      key: 'text',
      label: (
        <span>
          <FileTextOutlined />
          文字起卦
        </span>
      ),
      children: renderTextPanel(),
    },
    {
      key: 'random',
      label: (
        <span>
          <ThunderboltOutlined />
          随机起卦
        </span>
      ),
      children: renderRandomPanel(),
    },
  ];

  return (
    <div className="meihua-page">
      <Card className="divination-card">
        <Title level={3} className="page-title">
          梅花易数 · 起卦
        </Title>
        <Text type="secondary" className="page-subtitle">
          心诚则灵，请静心冥想您的问题后选择起卦方式
        </Text>

        <Divider />

        <Spin spinning={loading} tip="正在起卦...">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as DivinationTab)}
            items={tabItems}
            centered
          />
        </Spin>

        <Divider />

        <div className="divination-tips">
          <Title level={5}>起卦须知</Title>
          <ul>
            <li>起卦时请保持心境平和，专注于您的问题</li>
            <li>一事一占，同一问题短期内不宜重复占卜</li>
            <li>所有卦象将永久记录在区块链上，可随时查看</li>
            <li>可选择 AI 智能解卦或找大师人工解读</li>
          </ul>
        </div>
      </Card>

      <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
        <Button type="link" onClick={() => navigate('/meihua/list')}>
          查看我的卦象历史 →
        </Button>
        <Button type="link" onClick={() => navigate('/meihua/market')}>
          浏览占卜服务市场 →
        </Button>
      </Space>
    </div>
  );
};

export default DivinationPage;
