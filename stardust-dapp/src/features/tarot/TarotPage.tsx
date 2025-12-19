/**
 * 塔罗牌排盘页面
 *
 * 塔罗牌是西方神秘学占卜工具，通过78张牌的排列组合和解读，
 * 帮助人们了解自己的内心世界、探索未来可能性。
 */

import React, { useState } from 'react';
import { Card, Button, Typography, Space, Radio, message, Divider, Input, Modal, Spin } from 'antd';
import { QuestionCircleOutlined, HistoryOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { SpreadType, SPREAD_TYPE_NAMES, SPREAD_TYPE_DESCRIPTIONS, getSpreadCardCount } from '../../types/tarot';
import { quickDivine } from '../../services/tarotService';
import './TarotPage.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 牌阵选项配置（映射到类型定义）
 */
const AVAILABLE_SPREADS = [
  SpreadType.SingleCard,
  SpreadType.ThreeCardTime,
  SpreadType.LoveRelationship,
  SpreadType.CareerGuidance,
  SpreadType.DecisionMaking,
  SpreadType.CelticCross,
];

/**
 * 塔罗牌排盘页面
 */
const TarotPage: React.FC = () => {
  const [selectedSpread, setSelectedSpread] = useState<SpreadType>(SpreadType.ThreeCardTime);
  const [loading, setLoading] = useState(false);
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [question, setQuestion] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  /**
   * 点击开始抽牌，弹出问题输入框
   */
  const handleStartDivine = () => {
    setQuestionModalVisible(true);
  };

  /**
   * 执行抽牌
   */
  const handleDrawCards = async () => {
    if (!question.trim()) {
      message.warning('请输入您的占卜问题');
      return;
    }

    try {
      setLoading(true);
      setQuestionModalVisible(false);
      console.log('[TarotPage] 开始抽牌，牌阵:', selectedSpread, '问题:', question);

      // 调用快速占卜服务（内部会自动处理问题哈希）
      const readingId = await quickDivine(question, selectedSpread, false);

      console.log('[TarotPage] 抽牌成功，占卜ID:', readingId);
      message.success('抽牌成功！');

      // 跳转到结果页面
      window.location.hash = `#/tarot/reading/${readingId}`;

    } catch (error: any) {
      console.error('[TarotPage] 抽牌失败:', error);
      message.error(error.message || '抽牌失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 取消抽牌
   */
  const handleCancelDivine = () => {
    setQuestionModalVisible(false);
    setQuestion('');
  };

  /**
   * 重置
   */
  const handleReset = () => {
    setSelectedSpread(SpreadType.ThreeCardTime);
    setQuestion('');
    message.success('已重置');
  };

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          塔罗牌 · 占卜说明
        </span>
      }
      open={showInstructions}
      onCancel={() => setShowInstructions(false)}
      footer={null}
      width={460}
      style={{ top: 20 }}
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px 0' }}>
        {/* 温馨提示 */}
        <Title level={5} style={{ color: '#B2955D', marginTop: 16 }}>温馨提示</Title>
        <Paragraph>
          占卜结果将上链保存，可永久查询。占卜需要支付少量 Gas 费用。您的问题将被加密存储，保护隐私安全。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 塔罗牌基础 */}
        <Title level={5} style={{ color: '#B2955D' }}>塔罗牌基础</Title>
        <Paragraph>
          <Text strong>塔罗牌</Text>源于西方神秘学传统，由78张牌组成：22张大阿尔卡那（Major Arcana）代表人生的重大主题和灵性旅程，56张小阿尔卡那（Minor Arcana）分为权杖、圣杯、宝剑、星币四个花色，代表日常生活的各个方面。
        </Paragraph>
        <Paragraph>
          塔罗牌通过牌面的象征意义和组合关系，帮助人们探索内心世界、了解潜意识、预见未来可能性，是一种深度的自我认知和心灵成长工具。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 如何占卜 */}
        <Title level={5} style={{ color: '#B2955D' }}>如何占卜</Title>
        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>1. 选择牌阵：</Text>根据您的问题类型选择合适的牌阵。单张牌适合快速指引，三张牌揭示过去现在未来，特殊牌阵针对爱情、事业等具体领域
          <br />
          <Text strong style={{ color: '#B2955D' }}>2. 专注问题：</Text>在心中默念您的问题，保持专注和开放的心态
          <br />
          <Text strong style={{ color: '#B2955D' }}>3. 抽取塔罗：</Text>系统将为您随机抽取相应数量的牌（使用链上随机数保证公平性）
          <br />
          <Text strong style={{ color: '#B2955D' }}>4. 解读牌面：</Text>系统将根据牌面的正逆位和牌阵位置，为您提供详细解读
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 正逆位含义 */}
        <Title level={5} style={{ color: '#B2955D' }}>正逆位含义</Title>
        <Paragraph>
          <Text strong>正位：</Text>牌面向上，代表该牌的正面含义、顺利发展、积极能量
          <br />
          <Text strong>逆位：</Text>牌面向下，代表该牌的阻碍、挑战、需要调整的方面，或是能量过度或不足
        </Paragraph>
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          每张牌的正逆位都有其独特含义，系统会根据抽到的牌面自动判断并给出解读。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 应用范围 */}
        <Title level={5} style={{ color: '#B2955D' }}>应用范围</Title>
        <Paragraph>
          塔罗牌适用于以下各类人生问题探索：
        </Paragraph>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>情感：</Text>爱情发展、关系状态、情感选择、复合可能等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>事业：</Text>职业方向、工作机会、项目发展、人际关系等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>人际关系：</Text>友谊、家庭、合作伙伴、社交状况等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>个人成长：</Text>内心探索、潜能发掘、心灵成长、人生方向等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>决策辅助：</Text>重大选择、两难抉择、时机判断等
            </li>
          </ul>
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 区块链优势 */}
        <Title level={5} style={{ color: '#B2955D' }}>区块链优势</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>链上存储：</Text>所有占卜记录上链保存，永不丢失
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>可追溯性：</Text>随时可查询历史记录，回顾过往指引
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>真随机性：</Text>使用链上随机数抽牌，保证占卜的公平性
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>AI 深度解读：</Text>支持请求 AI 智能解读，提供个性化分析
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>隐私保护：</Text>问题加密存储，保护个人隐私
            </li>
          </ul>
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 操作提示 */}
        <Title level={5} style={{ color: '#B2955D' }}>操作提示</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>占卜前请心态平和，专注于您的问题</li>
            <li style={{ marginBottom: 8 }}>同一问题不宜短期内重复占卜</li>
            <li style={{ marginBottom: 8 }}>塔罗牌提供的是指引和建议，而非绝对预言</li>
            <li style={{ marginBottom: 8 }}>保持开放心态，从多角度理解牌面含义</li>
            <li style={{ marginBottom: 8 }}>链端占卜需要连接钱包并支付少量 Gas 费用</li>
            <li style={{ marginBottom: 8 }}>如需专业解读，可前往"占卜服务市场"寻找大师</li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  return (
    <div className="tarot-page">
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
        {/* 左边：占卜历史 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => (window.location.hash = '#/tarot/history')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>占卜历史</div>
        </div>

        {/* 中间：塔罗牌 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>塔罗牌</div>

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

      <Spin spinning={loading}>
        {/* 输入卡片 */}
        <Card className="input-card">
          <Title level={4} className="page-title" style={{ marginBottom: 4, textAlign: 'center' }}>
            占卜
          </Title>
          <Text type="secondary" className="page-subtitle" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
            西方神秘学占卜，通过牌面解读人生
          </Text>

          <Divider style={{ margin: '16px 0' }} />

          {/* 牌阵选择 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>选择牌阵</Text>
            <div style={{ marginTop: 8 }}>
              <Radio.Group
                value={selectedSpread}
                onChange={(e) => setSelectedSpread(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {AVAILABLE_SPREADS.map((spreadType) => (
                    <Card
                      key={spreadType}
                      size="small"
                      style={{
                        cursor: 'pointer',
                        border: selectedSpread === spreadType ? '2px solid #B2955D' : '1px solid #d9d9d9',
                        borderRadius: 8,
                      }}
                      onClick={() => setSelectedSpread(spreadType)}
                    >
                      <Radio value={spreadType}>
                        <Space direction="vertical" size={0}>
                          <Text strong>{SPREAD_TYPE_NAMES[spreadType]}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {SPREAD_TYPE_DESCRIPTIONS[spreadType]} ({getSpreadCardCount(spreadType)}张牌)
                          </Text>
                        </Space>
                      </Radio>
                    </Card>
                  ))}
                </Space>
              </Radio.Group>
            </div>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          {/* 操作按钮 */}
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button
              block
              type="primary"
              size="large"
              loading={loading}
              onClick={handleStartDivine}
              style={{
                background: '#000000',
                borderColor: '#000000',
                borderRadius: '54px',
                height: '54px',
                fontSize: '19px',
                fontWeight: '700',
                color: '#F7D3A1',
              }}
            >
              开始抽牌 ({getSpreadCardCount(selectedSpread)}张)
            </Button>

            <Button
              block
              onClick={handleReset}
              icon={<ReloadOutlined />}
              style={{ borderRadius: '27px', height: '44px' }}
            >
              重置
            </Button>
          </Space>
        </Card>
      </Spin>

      {/* 问题输入弹窗 */}
      <Modal
        title="输入占卜问题"
        open={questionModalVisible}
        onOk={handleDrawCards}
        onCancel={handleCancelDivine}
        confirmLoading={loading}
        okText="确认抽牌"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Paragraph type="secondary">
            请输入您想要占卜的问题。您的问题将被加密存储，保护隐私安全。
          </Paragraph>
          <TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：我最近的感情运势如何？"
            rows={4}
            maxLength={500}
            showCount
          />
        </Space>
      </Modal>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/tarot/history')}>
            <HistoryOutlined /> 占卜历史
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default TarotPage;
