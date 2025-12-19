/**
 * 大师入驻说明页
 *
 * 功能：
 * - 展示平台优势
 * - 费率说明
 * - 入驻条件
 * - 收益计算器
 * - 引导注册
 */

import React, { useState } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Divider,
  Tag,
  Statistic,
  Input,
  InputNumber,
  Alert,
  Collapse,
} from 'antd';
import {
  StarOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  WalletOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  RightOutlined,
  CalculatorOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * 平台优势卡片组件
 */
const AdvantageCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <Card hoverable style={{ textAlign: 'center', height: '100%' }}>
    <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
    <Title level={4}>{title}</Title>
    <Paragraph type="secondary">{description}</Paragraph>
  </Card>
);

/**
 * 费率表格组件
 */
const FeeRateTable: React.FC = () => {
  const tiers = [
    { level: '新手', orders: '0', fee: '20%', color: '#8c8c8c' },
    { level: '认证', orders: '10+', fee: '15%', color: '#52c41a' },
    { level: '资深', orders: '50+', fee: '12%', color: '#1890ff' },
    { level: '专家', orders: '200+', fee: '10%', color: '#722ed1' },
    { level: '大师', orders: '500+', fee: '8%', color: '#faad14' },
  ];

  return (
    <Card title="平台费率说明" bordered={false}>
      <Row gutter={[16, 16]}>
        {tiers.map((tier, index) => (
          <Col span={24} md={12} lg={24 / 5} key={index}>
            <Card size="small" style={{ textAlign: 'center', borderColor: tier.color }}>
              <Tag color={tier.color} style={{ marginBottom: 8 }}>
                {tier.level}
              </Tag>
              <div>
                <Text strong style={{ fontSize: 24, color: tier.color }}>
                  {tier.fee}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                完成 {tier.orders} 单
              </Text>
            </Card>
          </Col>
        ))}
      </Row>
      <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
        * 平台费率随等级提升而降低，完成更多订单享受更低费率
      </Paragraph>
    </Card>
  );
};

/**
 * 收益计算器组件
 */
const EarningsCalculator: React.FC = () => {
  const [orderPrice, setOrderPrice] = useState<number>(100);
  const [monthlyOrders, setMonthlyOrders] = useState<number>(30);
  const [tier, setTier] = useState<number>(15); // 默认认证等级15%

  const calculateEarnings = () => {
    const totalRevenue = orderPrice * monthlyOrders;
    const platformFee = totalRevenue * (tier / 100);
    const netIncome = totalRevenue - platformFee;
    return { totalRevenue, platformFee, netIncome };
  };

  const { totalRevenue, platformFee, netIncome } = calculateEarnings();

  return (
    <Card
      title={
        <span>
          <CalculatorOutlined /> 收益计算器
        </span>
      }
      bordered={false}
    >
      <Row gutter={16}>
        <Col span={24} md={8}>
          <Text>单笔订单价格 (DUST)</Text>
          <InputNumber
            min={1}
            max={10000}
            value={orderPrice}
            onChange={(val) => setOrderPrice(val || 100)}
            style={{ width: '100%', marginTop: 8 }}
          />
        </Col>
        <Col span={24} md={8}>
          <Text>每月接单数量</Text>
          <InputNumber
            min={1}
            max={1000}
            value={monthlyOrders}
            onChange={(val) => setMonthlyOrders(val || 30)}
            style={{ width: '100%', marginTop: 8 }}
          />
        </Col>
        <Col span={24} md={8}>
          <Text>平台费率 (%)</Text>
          <InputNumber
            min={8}
            max={20}
            value={tier}
            onChange={(val) => setTier(val || 15)}
            style={{ width: '100%', marginTop: 8 }}
          />
        </Col>
      </Row>

      <Divider />

      <Row gutter={16} style={{ textAlign: 'center' }}>
        <Col span={8}>
          <Statistic
            title="总营收"
            value={totalRevenue}
            suffix="DUST"
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="平台费用"
            value={platformFee}
            suffix="DUST"
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="实际收入"
            value={netIncome}
            suffix="DUST"
            valueStyle={{ color: '#52c41a' }}
            prefix={<WalletOutlined />}
          />
        </Col>
      </Row>

      <Alert
        message={`按此计算，您每月可赚取 ${netIncome.toFixed(2)} DUST`}
        type="success"
        showIcon
        style={{ marginTop: 16 }}
      />
    </Card>
  );
};

/**
 * 入驻条件组件
 */
const RequirementsSection: React.FC = () => (
  <Card title="入驻条件" bordered={false}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
        <Text>持有至少 <Text strong>100 DUST</Text> 作为保证金（可随时取回）</Text>
      </div>
      <div>
        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
        <Text>熟悉至少一种占卜体系（梅花易数、八字、六爻、奇门等）</Text>
      </div>
      <div>
        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
        <Text>能够提供专业、客观、负责的解读服务</Text>
      </div>
      <div>
        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
        <Text>遵守平台服务规范，不得有欺诈、辱骂等违规行为</Text>
      </div>
    </Space>
  </Card>
);

/**
 * 常见问题组件
 */
const FAQSection: React.FC = () => (
  <Card title="常见问题" bordered={false}>
    <Collapse ghost>
      <Panel header="保证金什么时候可以退回？" key="1">
        <Paragraph>
          保证金使用区块链智能合约托管，当您主动注销提供者身份时，系统会自动将保证金退回您的账户。
          整个过程无需人工审核，即时到账。
        </Paragraph>
      </Panel>
      <Panel header="平台会抽取多少手续费？" key="2">
        <Paragraph>
          手续费根据您的等级而定，从 8% 到 20% 不等。新手等级为 20%，随着完成订单数增加，
          等级提升后手续费会逐步降低。最高等级（大师）仅需 8% 手续费。
        </Paragraph>
      </Panel>
      <Panel header="如何提升等级？" key="3">
        <Paragraph>
          等级提升完全自动化，系统会根据您的完成订单数和平均评分自动晋升。
          例如完成 10 单且评分 3.5 星以上即可从新手晋升为认证等级。
        </Paragraph>
      </Panel>
      <Panel header="可以随时暂停接单吗？" key="4">
        <Paragraph>
          可以。您可以在工作台随时选择"暂停接单"，暂停后不会收到新订单通知。
          已接的订单仍需完成，恢复接单后即可继续接收新订单。
        </Paragraph>
      </Panel>
      <Panel header="如何处理客户投诉？" key="5">
        <Paragraph>
          平台有完善的纠纷仲裁机制。如遇客户投诉，平台会介入调查，根据实际情况做出公正裁决。
          恶意投诉会被驳回，合理投诉我们会协助双方协商解决。
        </Paragraph>
      </Panel>
    </Collapse>
  </Card>
);

/**
 * 大师入驻说明页
 */
const ProviderInfoPage: React.FC = () => {
  return (
    <div className="provider-info-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {/* 顶部横幅 */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #B2955D 0%, #9A7D4A 100%)',
          marginBottom: 16,
          color: 'white',
          border: 'none',
        }}
      >
        <Title level={3} style={{ color: 'white', marginBottom: 8 }}>
          <StarOutlined /> 加入星尘玄学大师联盟
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, marginBottom: 16 }}>
          用专业知识创造价值，灵活时间自由接单
        </Paragraph>
        <Space wrap>
          <Tag color="gold" style={{ fontSize: 14 }}>
            <TeamOutlined /> 已有 1,234 位大师
          </Tag>
          <Tag color="gold" style={{ fontSize: 14 }}>
            <WalletOutlined /> 月均收入 3,500 DUST
          </Tag>
          <Tag color="gold" style={{ fontSize: 14 }}>
            <StarOutlined /> 最高月入 10K+
          </Tag>
        </Space>
      </Card>

      {/* 平台优势 */}
      <Title level={4} style={{ marginTop: 24, marginBottom: 16 }}>
        平台优势
      </Title>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <AdvantageCard
            icon={<WalletOutlined style={{ color: '#52c41a' }} />}
            title="高收入"
            description="自主定价，月均3.5K，top 10% 月入10K+"
          />
        </Col>
        <Col span={12}>
          <AdvantageCard
            icon={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
            title="时间自由"
            description="随时暂停接单，自主安排工作时间"
          />
        </Col>
        <Col span={12}>
          <AdvantageCard
            icon={<SafetyOutlined style={{ color: '#722ed1' }} />}
            title="保障完善"
            description="资金托管、信用体系、纠纷仲裁"
          />
        </Col>
        <Col span={12}>
          <AdvantageCard
            icon={<RiseOutlined style={{ color: '#faad14' }} />}
            title="成长体系"
            description="5级晋升机制，高等级享低费率"
          />
        </Col>
      </Row>

      <Divider />

      {/* 费率说明 */}
      <FeeRateTable />

      <Divider />

      {/* 收益计算器 */}
      <EarningsCalculator />

      <Divider />

      {/* 入驻条件 */}
      <RequirementsSection />

      <Divider />

      {/* 常见问题 */}
      <FAQSection />

      {/* CTA 按钮 */}
      <Card style={{ marginTop: 24, textAlign: 'center' }}>
        <Title level={4}>准备好开始了吗？</Title>
        <Paragraph type="secondary">
          加入我们，开启您的玄学服务之旅
        </Paragraph>
        <Button
          type="primary"
          size="large"
          icon={<RightOutlined />}
          onClick={() => (window.location.hash = '#/provider/register')}
          style={{ marginTop: 16 }}
        >
          立即注册
        </Button>
        <div style={{ marginTop: 16 }}>
          <Button type="link" onClick={() => (window.location.hash = '#/market')}>
            返回市场
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProviderInfoPage;
