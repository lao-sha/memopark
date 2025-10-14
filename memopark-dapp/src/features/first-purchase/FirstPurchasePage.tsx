/**
 * 函数级详细中文注释：首购页面组件
 * 
 * 功能：
 * 1. 选择购买金额（50-100 MEMO）
 * 2. 可选填写推荐码（享9折优惠）
 * 3. 创建订单并跳转支付
 * 4. 实时显示折扣金额
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Slider,
  Input,
  Button,
  Typography,
  Space,
  Alert,
  message,
  Statistic,
  Row,
  Col,
  Divider,
  Tag,
  Tooltip,
} from 'antd';
import {
  GiftOutlined,
  WalletOutlined,
  DollarOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { firstPurchaseApi } from './api';
import './styles.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 函数级详细中文注释：做市商状态接口
 */
interface MarketMakerStatus {
  mmId: number;
  status: 'active' | 'paused' | 'insufficient';
  servicePaused: boolean;
  availableBalance: number;
  frozenBalance: number;
  totalBalance: number;
  usedBalance: number;
  canServe: boolean;
}

export const FirstPurchasePage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAccount } = useWallet();
  const [form] = Form.useForm();
  
  const [amount, setAmount] = useState<number>(80);
  const [referralCode, setReferralCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [hasFirstPurchased, setHasFirstPurchased] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  
  // 🆕 做市商状态
  const [marketMakers, setMarketMakers] = useState<MarketMakerStatus[]>([]);
  const [selectedMM, setSelectedMM] = useState<MarketMakerStatus | null>(null);
  const [mmLoading, setMmLoading] = useState<boolean>(false);
  
  // 计算支付金额
  const memoToCnyRate = 0.01; // 1 MEMO = 0.01 CNY
  const hasReferrer = referralCode.trim().length > 0;
  const totalAmount = amount * memoToCnyRate;
  const discount = hasReferrer ? totalAmount * 0.1 : 0;
  const finalAmount = totalAmount - discount;

  /**
   * 函数级详细中文注释：检查是否已首购
   */
  useEffect(() => {
    const checkFirstPurchase = async () => {
      if (!selectedAccount) {
        setChecking(false);
        return;
      }
      
      try {
        setChecking(true);
        const result = await firstPurchaseApi.checkFirstPurchase(selectedAccount.address);
        setHasFirstPurchased(result.hasFirstPurchased);
      } catch (error) {
        console.error('检查首购失败:', error);
        message.error('检查首购状态失败');
      } finally {
        setChecking(false);
      }
    };
    
    checkFirstPurchase();
  }, [selectedAccount]);

  /**
   * 🆕 函数级详细中文注释：查询可用做市商
   */
  useEffect(() => {
    const fetchMarketMakers = async () => {
      try {
        setMmLoading(true);
        const data = await firstPurchaseApi.getAvailableMarketMakers();
        setMarketMakers(data.marketMakers || []);
        
        // 自动选择第一个可用的做市商
        const availableMM = data.marketMakers?.find((mm: MarketMakerStatus) => mm.canServe);
        if (availableMM) {
          setSelectedMM(availableMM);
        }
      } catch (error) {
        console.error('查询做市商失败:', error);
        message.error('查询做市商状态失败');
      } finally {
        setMmLoading(false);
      }
    };
    
    fetchMarketMakers();
    
    // 每30秒刷新一次做市商状态
    const interval = setInterval(fetchMarketMakers, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * 🆕 函数级详细中文注释：创建订单（增加做市商验证）
   */
  const handleCreateOrder = async () => {
    if (!selectedAccount) {
      message.error('请先创建或导入钱包');
      navigate('/wallet/create');
      return;
    }
    
    // 🆕 验证做市商状态
    if (!selectedMM) {
      message.error('暂无可用做市商，请稍后再试');
      return;
    }
    
    if (selectedMM.servicePaused) {
      message.error('做市商服务已暂停，请选择其他做市商或稍后再试');
      return;
    }
    
    if (!selectedMM.canServe) {
      message.error('做市商资金池余额不足，请选择其他做市商或稍后再试');
      return;
    }
    
    // 🆕 再次查询做市商最新状态（防止状态变化）
    try {
      setLoading(true);
      const latestMM = await firstPurchaseApi.getMarketMakerInfo(selectedMM.mmId);
      
      if (latestMM.servicePaused) {
        message.error('做市商服务已暂停，请刷新页面重新选择');
        return;
      }
      
      if (!latestMM.canServe) {
        message.error('做市商资金池余额不足，请刷新页面重新选择');
        return;
      }
      
      // 创建订单
      const result = await firstPurchaseApi.createOrder({
        walletAddress: selectedAccount.address,
        amount,
        referralCode: referralCode.trim() || undefined,
      });
      
      message.success('订单已创建，正在跳转支付...');
      
      // 跳转到支付页面
      navigate(`/first-purchase/payment/${result.orderId}`, {
        state: { orderData: result },
      });
      
    } catch (error: any) {
      console.error('创建订单失败:', error);
      message.error(error.message || '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 如果没有钱包，提示创建
  if (!selectedAccount && !checking) {
    return (
      <div className="first-purchase-container">
        <Card>
          <Alert
            type="warning"
            message="请先创建钱包"
            description="您需要先创建或导入钱包才能购买 MEMO"
            showIcon
            action={
              <Button type="primary" onClick={() => navigate('/wallet/create')}>
                创建钱包
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // 如果已首购，提示
  if (hasFirstPurchased) {
    return (
      <div className="first-purchase-container">
        <Card>
          <Alert
            type="info"
            message="您已完成首购"
            description="每个地址仅可首购一次，您可以通过其他方式购买 MEMO"
            showIcon
            action={
              <Button type="primary" onClick={() => navigate('/otc')}>
                前往 OTC 市场
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="first-purchase-container">
      <Card
        className="first-purchase-card"
        loading={checking}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>
              <WalletOutlined /> 首次购买 MEMO
            </Title>
            <Paragraph type="secondary">
              获取少量 MEMO 作为 GAS 费，开始您的 MemoPark 之旅
            </Paragraph>
          </div>

          {/* 提示信息 */}
          <Alert
            type="info"
            message="首购说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>每个地址仅限首购一次</li>
                <li>购买金额限制：50-100 MEMO</li>
                <li>支持支付宝/微信支付</li>
                <li>填写推荐码可享 9 折优惠</li>
                <li>订单有效期 15 分钟</li>
              </ul>
            }
            showIcon
          />

          {/* 🆕 做市商状态 */}
          <Card
            size="small"
            title={<Text strong>📊 做市商服务状态</Text>}
            loading={mmLoading}
            style={{ background: '#fafafa' }}
          >
            {marketMakers.length === 0 ? (
              <Alert
                type="warning"
                message="暂无可用做市商"
                description="系统暂时无法提供首购服务，请稍后再试"
                showIcon
              />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {selectedMM && (
                  <div>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Space>
                          <Text type="secondary">服务状态:</Text>
                          {selectedMM.servicePaused ? (
                            <Tag icon={<CloseCircleOutlined />} color="error">
                              服务已暂停
                            </Tag>
                          ) : (
                            <Tag icon={<CheckCircleOutlined />} color="success">
                              服务正常
                            </Tag>
                          )}
                        </Space>
                      </Col>
                      <Col span={12}>
                        <Space>
                          <Text type="secondary">可用余额:</Text>
                          <Tooltip title={`总额: ${selectedMM.totalBalance} MEMO | 已用: ${selectedMM.usedBalance} MEMO | 冻结: ${selectedMM.frozenBalance} MEMO`}>
                            <Tag color={selectedMM.availableBalance >= 100 ? 'success' : 'warning'}>
                              {selectedMM.availableBalance.toFixed(2)} MEMO
                            </Tag>
                          </Tooltip>
                        </Space>
                      </Col>
                    </Row>
                    
                    {selectedMM.frozenBalance > 0 && (
                      <Alert
                        type="info"
                        message={
                          <Space>
                            <LockOutlined />
                            <Text>
                              做市商当前有 {selectedMM.frozenBalance.toFixed(2)} MEMO 资金冻结中（提取申请中）
                            </Text>
                          </Space>
                        }
                        style={{ marginTop: 8 }}
                        showIcon={false}
                      />
                    )}
                    
                    {selectedMM.servicePaused && (
                      <Alert
                        type="warning"
                        message="服务暂停说明"
                        description="做市商已暂停首购服务（可能正在提取资金），请稍后再试或联系管理员"
                        style={{ marginTop: 8 }}
                        showIcon
                      />
                    )}
                    
                    {!selectedMM.canServe && !selectedMM.servicePaused && (
                      <Alert
                        type="warning"
                        message="资金不足"
                        description="做市商资金池可用余额不足，暂时无法提供服务"
                        style={{ marginTop: 8 }}
                        showIcon
                      />
                    )}
                  </div>
                )}
              </Space>
            )}
          </Card>

          <Divider />

          {/* 表单 */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateOrder}
          >
            {/* 购买金额 */}
            <Form.Item
              label={
                <Text strong>
                  <DollarOutlined /> 购买金额（MEMO）
                </Text>
              }
            >
              <Slider
                min={50}
                max={100}
                value={amount}
                onChange={setAmount}
                marks={{
                  50: '50',
                  75: '75',
                  100: '100',
                }}
                tooltip={{ formatter: (value) => `${value} MEMO` }}
              />
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {amount} MEMO
                </Text>
                <br />
                <Text type="secondary">
                  约 {totalAmount.toFixed(2)} 元
                </Text>
              </div>
            </Form.Item>

            {/* 推荐码（可选） */}
            <Form.Item
              label={
                <Space>
                  <Text strong>
                    <UserAddOutlined /> 推荐码（可选）
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    填写推荐码享 9 折优惠
                  </Text>
                </Space>
              }
            >
              <Input
                placeholder="输入推荐码（6位字母数字）"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={6}
                prefix={<GiftOutlined />}
                suffix={
                  hasReferrer && (
                    <Text type="success" strong>
                      9折优惠已激活
                    </Text>
                  )
                }
              />
            </Form.Item>

            {/* 价格明细 */}
            <Card size="small" style={{ background: '#f5f5f5' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="原价"
                    value={totalAmount}
                    precision={2}
                    prefix="¥"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="优惠"
                    value={discount}
                    precision={2}
                    prefix="-¥"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="实付"
                    value={finalAmount}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#1890ff', fontSize: 24 }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 钱包地址 */}
            <Form.Item label="接收地址">
              <Input
                value={selectedAccount?.address}
                disabled
                prefix={<WalletOutlined />}
              />
            </Form.Item>

            {/* 提交按钮 */}
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                disabled={!selectedMM || selectedMM.servicePaused || !selectedMM.canServe}
              >
                {!selectedMM
                  ? '暂无可用做市商'
                  : selectedMM.servicePaused
                  ? '服务已暂停'
                  : !selectedMM.canServe
                  ? '做市商资金不足'
                  : '创建订单并支付'}
              </Button>
            </Form.Item>
            
            {/* 🆕 按钮下方提示 */}
            {selectedMM && (!selectedMM.canServe || selectedMM.servicePaused) && (
              <Alert
                type="warning"
                message={
                  <Space>
                    <WarningOutlined />
                    <Text>
                      {selectedMM.servicePaused
                        ? '做市商服务暂停中，请稍后再试'
                        : '做市商资金池余额不足，请稍后再试'}
                    </Text>
                  </Space>
                }
                showIcon={false}
              />
            )}
          </Form>
        </Space>
      </Card>
    </div>
  );
};

