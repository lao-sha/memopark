/**
 * 梅花易数起卦页面
 *
 * 支持多种起卦方式：时间起卦、数字起卦、文字起卦、随机起卦
 */

import React, { useState, useCallback } from 'react';
import { Card, Button, Input, InputNumber, Tabs, message, Spin, Space, Typography, Divider, Select, Row, Col, Modal } from 'antd';
import { ClockCircleOutlined, NumberOutlined, FileTextOutlined, ThunderboltOutlined, UserOutlined, TagsOutlined, QuestionCircleOutlined, HistoryOutlined, ShopOutlined } from '@ant-design/icons';
import {
  divineByTime,
  divineByNumbers,
  divineByText,
  divineRandom,
} from '../../services/meihuaService';
import { Gender, DivinationCategory, GENDER_NAMES, DIVINATION_CATEGORY_NAMES } from '../../types/meihua';
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
  const [showInstructions, setShowInstructions] = useState(false);

  // 数字起卦状态
  const [upperNumber, setUpperNumber] = useState<number>(1);
  const [lowerNumber, setLowerNumber] = useState<number>(1);

  // 文字起卦状态
  const [inputText, setInputText] = useState('');

  // 性别和类别选择状态
  const [gender, setGender] = useState<number>(Gender.Unspecified);
  const [category, setCategory] = useState<number>(DivinationCategory.Unspecified);

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
      const hexagramId = await divineByTime(undefined, false, gender, category);
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('时间起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [gender, category, handleDivinationSuccess]);

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
      const hexagramId = await divineByNumbers(upperNumber, lowerNumber, undefined, false, gender, category);
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('数字起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [upperNumber, lowerNumber, gender, category, handleDivinationSuccess]);

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
      const hexagramId = await divineByText(inputText, false, gender, category);
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('文字起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [inputText, gender, category, handleDivinationSuccess]);

  /**
   * 随机起卦
   */
  const handleRandomDivination = useCallback(async () => {
    setLoading(true);
    try {
      const hexagramId = await divineRandom(undefined, false, gender, category);
      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('随机起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [gender, category, handleDivinationSuccess]);

  /**
   * 渲染性别和类别选择器
   */
  const renderPersonalInfoSelectors = () => (
    <div style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            <Text type="secondary">
              <UserOutlined /> 性别（可选）
            </Text>
            <Select
              value={gender}
              onChange={setGender}
              style={{ width: '100%' }}
              options={[
                { value: Gender.Unspecified, label: GENDER_NAMES[Gender.Unspecified] },
                { value: Gender.Male, label: GENDER_NAMES[Gender.Male] },
                { value: Gender.Female, label: GENDER_NAMES[Gender.Female] },
              ]}
            />
          </Space>
        </Col>
        <Col span={12}>
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            <Text type="secondary">
              <TagsOutlined /> 占卜类别（可选）
            </Text>
            <Select
              value={category}
              onChange={setCategory}
              style={{ width: '100%' }}
              options={[
                { value: DivinationCategory.Unspecified, label: DIVINATION_CATEGORY_NAMES[DivinationCategory.Unspecified] },
                { value: DivinationCategory.Career, label: DIVINATION_CATEGORY_NAMES[DivinationCategory.Career] },
                { value: DivinationCategory.Wealth, label: DIVINATION_CATEGORY_NAMES[DivinationCategory.Wealth] },
                { value: DivinationCategory.Love, label: DIVINATION_CATEGORY_NAMES[DivinationCategory.Love] },
                { value: DivinationCategory.Health, label: DIVINATION_CATEGORY_NAMES[DivinationCategory.Health] },
                { value: DivinationCategory.Education, label: DIVINATION_CATEGORY_NAMES[DivinationCategory.Education] },
                { value: DivinationCategory.Other, label: DIVINATION_CATEGORY_NAMES[DivinationCategory.Other] },
              ]}
            />
          </Space>
        </Col>
      </Row>
    </div>
  );

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          梅花易数 · 起卦说明
        </span>
      }
      open={showInstructions}
      onCancel={() => setShowInstructions(false)}
      footer={null}
      width={460}
      style={{ top: 20 }}
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px 0' }}>
        {/* 起卦须知 */}
        <Title level={5} style={{ color: '#B2955D', marginTop: 16 }}>起卦须知</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>起卦时请保持心境平和，专注于您的问题</li>
            <li style={{ marginBottom: 8 }}>一事一占，同一问题短期内不宜重复占卜</li>
            <li style={{ marginBottom: 8 }}>所有卦象将永久记录在区块链上，可随时查看</li>
            <li style={{ marginBottom: 8 }}>可选择 AI 智能解卦或找大师人工解读</li>
          </ul>
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 起卦方式详解 */}
        <Title level={5} style={{ color: '#B2955D' }}>起卦方式详解</Title>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>
            <ClockCircleOutlined /> 时间起卦
          </Text>
          <br />
          梅花易数最经典的起卦方式。系统将根据当前农历时间自动计算卦象，取年月日之和为上卦，加时辰数为下卦，总数除以六得动爻。适合没有特定数字或文字时使用。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>
            <NumberOutlined /> 数字起卦
          </Text>
          <br />
          适合在看到某些数字时使用，如门牌号、车牌号等。输入两个数字，系统将根据这些数字计算上下卦，动爻由当前时辰自动推算。数字范围：1-999。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>
            <FileTextOutlined /> 文字起卦
          </Text>
          <br />
          将您输入的问题转换为卦象。建议心诚则灵，静心冥想您的问题后再输入，问题描述将被哈希存储在链上。适合有明确问题需要占卜的情况。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>
            <ThunderboltOutlined /> 随机起卦
          </Text>
          <br />
          使用区块链随机数生成卦象，适合没有特定问题但想获得指引时使用。每次占卜都会生成独一无二的卦象，由链上随机性保证公平性。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 性别和类别说明 */}
        <Title level={5} style={{ color: '#B2955D' }}>个人信息说明</Title>
        <Paragraph>
          <Text strong>性别和占卜类别</Text>为可选项，填写后可获得更精准的解读建议。系统支持事业、财运、感情、健康、学业等多种类别，AI解读时会结合这些信息提供针对性分析。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 操作提示 */}
        <Title level={5} style={{ color: '#B2955D' }}>操作提示</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>起卦成功后会自动跳转到卦象详情页面</li>
            <li style={{ marginBottom: 8 }}>可在"我的卦象历史"中查看所有历史记录</li>
            <li style={{ marginBottom: 8 }}>如需专业解读，可前往"占卜服务市场"寻找大师</li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  /**
   * 渲染时间起卦面板
   */
  const renderTimePanel = () => (
    <div className="divination-panel">
      <Paragraph className="panel-description">
        根据当前农历时间自动计算卦象（取年月日之和为上卦，加时辰数为下卦）
      </Paragraph>
      {renderPersonalInfoSelectors()}
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
        输入两个数字（如门牌号、车牌号），动爻由当前时辰自动推算
      </Paragraph>
      {renderPersonalInfoSelectors()}
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
        静心冥想您的问题后输入，问题描述将被哈希存储
      </Paragraph>
      {renderPersonalInfoSelectors()}
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
        使用区块链随机数生成卦象，每次占卜独一无二
      </Paragraph>
      {renderPersonalInfoSelectors()}
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
      {/* 顶部导航卡片 - 复刻八字页面风格 */}
      <div className="nav-card" style={{
        borderRadius: '0',
        background: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        border: 'none',
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '414px',
        zIndex: 100,
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        {/* 左边：卦象历史 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => navigate('/meihua/list')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的卦象</div>
        </div>

        {/* 中间：梅花易数 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>梅花易数</div>

        {/* 右边：使用说明 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', cursor: 'pointer' }}
          onClick={() => setShowInstructions(true)}
        >
          <QuestionCircleOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>说明</div>
        </div>
      </div>

      {/* 顶部占位 */}
      <div style={{ height: '50px' }}></div>

      {/* 主卡片 */}
      <Card className="divination-card input-card" style={{ position: 'relative' }}>
        <Title level={4} className="page-title" style={{ marginBottom: 4 }}>
          起卦
        </Title>
        <Text type="secondary" className="page-subtitle">
          心诚则灵，请静心冥想您的问题后选择起卦方式
        </Text>

        <Divider style={{ margin: '16px 0' }} />

        <Spin spinning={loading} tip="正在起卦...">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as DivinationTab)}
            items={tabItems}
            centered
          />
        </Spin>
      </Card>

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => navigate('/meihua/list')}>
            <HistoryOutlined /> 我的卦象
          </Button>
          <Button type="link" onClick={() => navigate('/meihua/market')}>
            <ShopOutlined /> 占卜市场
          </Button>
        </Space>
      </div>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}
    </div>
  );
};

export default DivinationPage;
