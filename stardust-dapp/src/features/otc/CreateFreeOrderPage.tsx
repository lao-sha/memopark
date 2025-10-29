/**
 * 买家创建免费订单页面
 * 
 * 功能级详细中文注释：
 * 买家使用免费配额创建OTC订单，无需支付Gas费用。
 * 
 * @component CreateFreeOrderPage
 * @created 2025-10-22
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Input, Alert, Spin, message, Statistic, Tag, Steps } from 'antd';
import { 
  GiftOutlined, 
  ThunderboltOutlined, 
  CheckCircleOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import { useApi } from '../../lib/polkadot';
import { useWallet } from '../../providers/WalletProvider';
import { getRemainingQuota, createFreeOrder, type FreeQuotaInfo } from '../../services/freeQuotaService';
import { keccak256 } from 'ethers';

/**
 * 函数级详细中文注释：买家创建免费订单页面组件
 * 
 * 🚧 状态：功能升级中（2025-10-29）
 * 原因：链端架构整合（Phase 2），pallet-trading 尚未实现免费首购功能
 * TODO: 等待链端实现 create_first_purchase 接口后恢复
 */
const CreateFreeOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { api } = useApi();
  const { selectedAccount } = useWallet();

  // 从路由参数获取做市商ID
  const searchParams = new URLSearchParams(location.search);
  const makerId = searchParams.get('makerId') ? Number(searchParams.get('makerId')) : 1;

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<FreeQuotaInfo | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  // 表单数据
  const [qty, setQty] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  /**
   * 函数级详细中文注释：加载免费配额信息
   */
  const loadQuotaInfo = async () => {
    if (!api || !selectedAccount) return;

    try {
      setLoadingQuota(true);
      const info = await getRemainingQuota(api, makerId, selectedAccount.address);
      setQuotaInfo(info);
    } catch (error) {
      console.error('加载配额失败:', error);
      message.error('加载免费配额信息失败');
    } finally {
      setLoadingQuota(false);
    }
  };

  useEffect(() => {
    loadQuotaInfo();
  }, [api, selectedAccount, makerId]);

  /**
   * 函数级详细中文注释：提交免费订单
   */
  const handleSubmit = async () => {
    if (!api || !selectedAccount) {
      message.error('请先连接钱包');
      return;
    }

    if (!qty || parseFloat(qty) <= 0) {
      message.error('请输入有效的购买数量');
      return;
    }

    if (!paymentInfo.trim()) {
      message.error('请输入支付方式信息');
      return;
    }

    if (!contactInfo.trim()) {
      message.error('请输入联系方式');
      return;
    }

    // 检查免费配额
    if (quotaInfo && quotaInfo.remaining === 0 && !quotaInfo.isNewBuyer) {
      message.error('免费配额已用完，请使用普通创建订单功能');
      return;
    }

    try {
      setLoading(true);

      // 计算承诺哈希
      const paymentCommit = keccak256(Buffer.from(paymentInfo, 'utf-8'));
      const contactCommit = keccak256(Buffer.from(contactInfo, 'utf-8'));

      // 创建免费订单
      const { txHash, orderId } = await createFreeOrder(
        api,
        makerId,
        parseFloat(qty),
        paymentCommit,
        contactCommit,
        selectedAccount,
        (status) => {
          message.info(status);
        }
      );

      message.success(`订单创建成功！订单ID: ${orderId}`);

      // 刷新配额信息
      await loadQuotaInfo();

      // 跳转到订单详情
      if (orderId) {
        navigate(`/otc/order/${orderId}`);
      } else {
        navigate('/otc/my-orders');
      }
    } catch (error: any) {
      console.error('创建订单失败:', error);
      message.error(error.message || '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：渲染免费配额状态卡片
   */
  const renderQuotaCard = () => {
    if (loadingQuota) {
      return (
        <Card>
          <Spin tip="加载免费配额信息..." />
        </Card>
      );
    }

    if (!quotaInfo) {
      return null;
    }

    return (
      <Card 
        title={
          <span>
            <GiftOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            免费配额状态
          </span>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <Statistic
            title="剩余免费次数"
            value={quotaInfo.remaining}
            suffix="次"
            valueStyle={{ color: quotaInfo.remaining > 0 ? '#52c41a' : '#ff4d4f' }}
            prefix={<ThunderboltOutlined />}
          />
          
          {quotaInfo.isNewBuyer && (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              新买家默认配额: {quotaInfo.defaultQuota} 次
            </Tag>
          )}
        </div>

        {quotaInfo.remaining === 0 && !quotaInfo.isNewBuyer && (
          <Alert
            message="免费配额已用完"
            description="您的免费配额已用完，请使用普通创建订单功能（需支付Gas费）"
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {quotaInfo.remaining > 0 && (
          <Alert
            message="免费创建订单"
            description="使用免费配额创建订单，无需支付Gas费用"
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    );
  };

  /**
   * 函数级详细中文注释：渲染步骤指示器
   */
  const steps = [
    {
      title: '填写订单信息',
      icon: <InfoCircleOutlined />,
    },
    {
      title: '确认提交',
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>
        <GiftOutlined style={{ marginRight: 8, color: '#52c41a' }} />
        创建免费订单
      </h2>

      {/* 🚧 功能升级提示 */}
      <Alert
        message="⚠️ 功能升级中"
        description={
          <div>
            <p style={{ marginBottom: 8 }}>
              <strong>首购免费订单功能正在进行架构升级（Phase 2）</strong>
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>升级原因：</strong>链端架构整合，pallet-trading 尚未实现免费首购功能
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>预计上线：</strong>请联系技术团队确认具体时间
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>暂时建议：</strong>
              <Button 
                type="link" 
                style={{ padding: 0, height: 'auto' }}
                onClick={() => navigate('/otc/create')}
              >
                使用普通订单创建功能 →
              </Button>
            </p>
          </div>
        }
        type="warning"
        showIcon
        closable
        style={{ marginBottom: 24 }}
        icon={<InfoCircleOutlined />}
      />

      {/* 免费配额状态 */}
      {renderQuotaCard()}

      {/* 步骤指示器 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </Card>

      {/* 订单表单 */}
      <Card title="订单信息">
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            购买数量（MEMO）
          </label>
          <Input
            type="number"
            placeholder="请输入购买数量"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            size="large"
            suffix="DUST"
          />
          <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12 }}>
            最小购买数量以做市商设置为准
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            支付方式信息
          </label>
          <Input.TextArea
            placeholder="请输入您的支付方式信息（如支付宝账号、银行卡号等）"
            value={paymentInfo}
            onChange={(e) => setPaymentInfo(e.target.value)}
            rows={3}
          />
          <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12 }}>
            此信息将加密存储，仅在需要时向做市商披露
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            联系方式
          </label>
          <Input.TextArea
            placeholder="请输入您的联系方式（如微信、手机号等）"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            rows={3}
          />
          <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12 }}>
            此信息将加密存储，仅在需要时向做市商披露
          </div>
        </div>

        {/* 提示信息 */}
        <Alert
          message="免费订单说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>使用免费配额创建订单，无需支付Gas费用</li>
              <li>每次创建订单将消费1次免费配额</li>
              <li>配额用完后，需使用普通创建订单功能（需支付Gas）</li>
              <li>订单创建后，请及时联系做市商完成交易</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleSubmit}
            disabled={
              !quotaInfo || 
              (quotaInfo.remaining === 0 && !quotaInfo.isNewBuyer) ||
              !qty ||
              !paymentInfo.trim() ||
              !contactInfo.trim()
            }
            style={{ flex: 1 }}
          >
            {loading ? '创建中...' : '免费创建订单'}
          </Button>

          <Button
            size="large"
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            取消
          </Button>
        </div>
      </Card>

      {/* 帮助说明 */}
      <Card 
        title="使用帮助" 
        style={{ marginTop: 24 }}
        size="small"
      >
        <h4>什么是免费配额？</h4>
        <p>
          免费配额是做市商为买家提供的福利，让买家可以在不支付Gas费的情况下创建订单。
          每个做市商可以设置不同的免费次数。
        </p>

        <h4>免费配额用完怎么办？</h4>
        <p>
          配额用完后，您可以：
        </p>
        <ul>
          <li>使用普通创建订单功能（需自己支付Gas费）</li>
          <li>联系做市商申请增加配额</li>
          <li>等待做市商的推广活动获得额外配额</li>
        </ul>

        <h4>如何获得更多免费配额？</h4>
        <p>
          做市商可能会在以下情况下为您增加免费配额：
        </p>
        <ul>
          <li>推广活动期间</li>
          <li>您是优质买家（信用良好）</li>
          <li>合作伙伴福利</li>
          <li>客户服务补偿</li>
        </ul>
      </Card>
    </div>
  );
};

export default CreateFreeOrderPage;

