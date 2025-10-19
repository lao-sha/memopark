import React, { useState, useEffect } from 'react';
import { 
  Card, Form, InputNumber, Input, Button, Alert, Steps, Statistic, 
  Row, Col, message, Typography, Tag, Space, Spin, Progress, Descriptions, Modal 
} from 'antd';
import { 
  SwapOutlined, CheckCircleOutlined, LoadingOutlined, 
  WalletOutlined, InfoCircleOutlined, ClockCircleOutlined,
  WarningOutlined, ArrowLeftOutlined 
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPassword, signAndSendTxWithPrompt } from '@/lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;

/**
 * 做市商兑换页面
 * 
 * 功能：
 * - 用户选择做市商进行 MEMO → USDT 兑换
 * - 显示做市商信息和手续费
 * - 实时计算兑换金额
 * - 兑换流程追踪（Pending → Completed）
 * - 超时倒计时和举报功能
 * - 确认收款按钮
 */
export const MakerBridgeSwapPage: React.FC = () => {
  const { makerId } = useParams<{ makerId: string }>();
  const { api, currentAccount } = usePolkadot();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  // 做市商信息
  const [makerInfo, setMakerInfo] = useState<any>(null);
  const [serviceConfig, setServiceConfig] = useState<any>(null);
  const [makerLoading, setMakerLoading] = useState(false);
  
  // 表单状态
  const [memoAmount, setMemoAmount] = useState<number>(0);
  const [tronAddress, setTronAddress] = useState<string>('');
  
  // 市场价格
  const [marketPrice, setMarketPrice] = useState<number>(0);
  const [priceLoading, setPriceLoading] = useState(false);
  
  // 流程状态
  const [step, setStep] = useState(0);
  const [swapId, setSwapId] = useState<number>();
  const [swapRecord, setSwapRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // 余额
  const [balance, setBalance] = useState<string>('0');
  
  // 超时状态
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isTimeout, setIsTimeout] = useState(false);
  
  const MIN_AMOUNT = 10; // 最小 10 MEMO
  
  /**
   * 加载做市商信息
   */
  const loadMakerInfo = async () => {
    if (!api || !makerId) {
      message.error('参数错误');
      return;
    }
    
    setMakerLoading(true);
    try {
      const mmId = parseInt(makerId);
      
      // 1. 查询做市商基本信息
      const makerOpt = await api.query.marketMaker.activeMarketMakers(mmId);
      if (makerOpt.isNone) {
        message.error('做市商不存在');
        navigate('/bridge/maker-list');
        return;
      }
      
      const maker = makerOpt.unwrap();
      setMakerInfo({
        mmId,
        owner: maker.owner.toHuman(),
        name: maker.public_cid.toHuman() || `做市商 #${mmId}`,
      });
      
      // 2. 查询桥接服务配置
      const serviceOpt = await api.query.marketMaker.bridgeServices(mmId);
      if (serviceOpt.isNone) {
        message.error('该做市商未提供桥接服务');
        navigate('/bridge/maker-list');
        return;
      }
      
      const service = serviceOpt.unwrap();
      if (!service.enabled.toHuman()) {
        message.error('该做市商的桥接服务已暂停');
        navigate('/bridge/maker-list');
        return;
      }
      
      setServiceConfig({
        maxSwapAmount: service.max_swap_amount.toNumber() / 1_000_000,
        feeRate: service.fee_rate_bps.toNumber() / 100,
        totalSwaps: service.total_swaps.toNumber(),
        successCount: service.success_count.toNumber(),
        avgTime: service.avg_time_seconds.toNumber(),
        deposit: service.deposit.toNumber() / 1e12,
      });
      
    } catch (error: any) {
      console.error('加载做市商信息失败:', error);
      message.error(`加载失败: ${error.message || '未知错误'}`);
    } finally {
      setMakerLoading(false);
    }
  };
  
  /**
   * 加载市场价格
   */
  const loadMarketPrice = async () => {
    if (!api) return;
    
    setPriceLoading(true);
    try {
      const price = await api.query.pricing.marketPrice();
      const priceUsdt = price.toNumber() / 1_000_000;
      setMarketPrice(priceUsdt);
    } catch (error: any) {
      console.error('获取市场价格失败:', error);
      message.warning('无法获取市场价格，请稍后重试');
    } finally {
      setPriceLoading(false);
    }
  };
  
  /**
   * 加载用户余额
   */
  const loadBalance = async () => {
    if (!api || !currentAccount) return;
    
    try {
      const { data } = await api.query.system.account(currentAccount.address);
      const free = data.free.toNumber() / 1e12;
      setBalance(free.toFixed(2));
    } catch (error: any) {
      console.error('获取余额失败:', error);
    }
  };
  
  /**
   * 计算兑换金额
   */
  const calculateSwap = () => {
    if (memoAmount <= 0 || marketPrice <= 0 || !serviceConfig) {
      return { baseUsdt: 0, fee: 0, actualUsdt: 0 };
    }
    
    const baseUsdt = memoAmount * marketPrice;
    const fee = baseUsdt * (serviceConfig.feeRate / 100);
    const actualUsdt = baseUsdt - fee;
    
    return { baseUsdt, fee, actualUsdt };
  };
  
  const { baseUsdt, fee, actualUsdt } = calculateSwap();
  
  /**
   * 发起兑换
   */
  const handleSwap = async (values: any) => {
    if (!api || !currentAccount || !makerId) {
      message.error('请先连接钱包');
      return;
    }
    
    if (actualUsdt > serviceConfig.maxSwapAmount) {
      message.error(`兑换金额超过做市商限额 ${serviceConfig.maxSwapAmount} USDT`);
      return;
    }
    
    setLoading(true);
    try {
      const mmId = parseInt(makerId);
      const memoAmountRaw = BigInt(Math.floor(values.memoAmount * 1e12));
      const tronAddr = values.tronAddress;
      
      // 调用链上方法
      const tx = api.tx.simpleBridge.swapWithMaker(
        mmId,
        memoAmountRaw,
        tronAddr
      );
      
      await signAndSendTxWithPassword(
        tx,
        currentAccount.address,
        (status, events) => {
          if (status.isInBlock) {
            // 查找 MakerSwapInitiated 事件
            if (events) {
              events.forEach(({ event }: any) => {
                if (event.section === 'simpleBridge' && event.method === 'MakerSwapInitiated') {
                  const swapIdRaw = event.data[0].toNumber();
                  setSwapId(swapIdRaw);
                  message.success(`兑换已发起！兑换ID: ${swapIdRaw}`);
                  setStep(1);
                  
                  // 开始监听兑换状态
                  pollSwapStatus(swapIdRaw);
                }
              });
            }
          }
        }
      );
    } catch (error: any) {
      console.error('发起兑换失败:', error);
      message.error(`兑换失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 轮询兑换状态
   */
  const pollSwapStatus = async (id: number) => {
    if (!api) return;
    
    const interval = setInterval(async () => {
      try {
        const recordOpt = await api.query.simpleBridge.makerSwaps(id);
        if (recordOpt.isSome) {
          const record = recordOpt.unwrap();
          setSwapRecord(record.toJSON());
          
          const status = record.status.toHuman();
          
          // 计算剩余时间
          const currentBlock = await api.query.system.number();
          const timeoutBlock = record.timeout_at.toNumber();
          const currentBlockNum = currentBlock.toNumber();
          const blocksRemaining = timeoutBlock - currentBlockNum;
          const secondsRemaining = blocksRemaining * 6; // 假设 6 秒一个块
          setTimeRemaining(secondsRemaining);
          setIsTimeout(secondsRemaining <= 0);
          
          // 根据状态更新 UI
          if (status === 'Completed') {
            setStep(2);
            clearInterval(interval);
            message.success('兑换已完成！');
          } else if (status === 'UserReported') {
            setStep(3);
            clearInterval(interval);
            message.info('已进入仲裁流程');
          } else if (status === 'Refunded') {
            setStep(3);
            clearInterval(interval);
            message.success('已退款');
          }
        }
      } catch (error: any) {
        console.error('查询兑换状态失败:', error);
      }
    }, 10000); // 每 10 秒查询一次
    
    // 组件卸载时清除定时器
    return () => clearInterval(interval);
  };
  
  /**
   * 确认收款
   */
  const handleConfirmReceipt = async () => {
    if (!api || !currentAccount || !swapId) {
      message.error('参数错误');
      return;
    }
    
    setLoading(true);
    try {
      const tx = api.tx.simpleBridge.confirmReceipt(swapId);
      
      const hash = await signAndSendTxWithPrompt(tx, currentAccount.address);
      
      message.success(`已确认收款！交易哈希: ${hash.substring(0, 10)}...`);
      setStep(2);
    } catch (error: any) {
      console.error('确认收款失败:', error);
      message.error(`确认失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 举报做市商
   */
  const handleReport = () => {
    if (!swapId) return;
    navigate(`/bridge/maker-complaint/${swapId}`);
  };
  
  // 初始加载
  useEffect(() => {
    loadMakerInfo();
    loadMarketPrice();
    loadBalance();
  }, [api, makerId, currentAccount]);
  
  // 步骤配置
  const steps = [
    { title: '填写信息', icon: <WalletOutlined /> },
    { title: '等待转账', icon: <LoadingOutlined /> },
    { title: '兑换完成', icon: <CheckCircleOutlined /> },
  ];
  
  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <Card>
        {/* 返回按钮 */}
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/bridge/maker-list')}
          style={{ marginBottom: 16 }}
        >
          返回列表
        </Button>
        
        {/* 页面标题 */}
        <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 24 }}>
          <Title level={2}>
            <SwapOutlined /> 通过做市商兑换
          </Title>
        </Space>
        
        {/* 做市商信息卡片 */}
        {makerLoading ? (
          <Spin tip="加载做市商信息..." />
        ) : makerInfo && serviceConfig ? (
          <Card style={{ marginBottom: 24, background: '#f9f9f9' }}>
            <Descriptions title="做市商信息" column={2}>
              <Descriptions.Item label="名称">{makerInfo.name}</Descriptions.Item>
              <Descriptions.Item label="ID">{makerInfo.mmId}</Descriptions.Item>
              <Descriptions.Item label="手续费率">
                <Tag color="green">{serviceConfig.feeRate.toFixed(2)}%</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最大兑换额">
                {serviceConfig.maxSwapAmount.toLocaleString()} USDT
              </Descriptions.Item>
              <Descriptions.Item label="成功率">
                <Tag color={
                  serviceConfig.totalSwaps > 0 
                    ? (serviceConfig.successCount / serviceConfig.totalSwaps >= 0.95 ? 'green' : 'orange')
                    : 'default'
                }>
                  {serviceConfig.totalSwaps > 0 
                    ? ((serviceConfig.successCount / serviceConfig.totalSwaps) * 100).toFixed(1) + '%'
                    : 'N/A'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="平均时间">
                {Math.floor(serviceConfig.avgTime / 60)} 分钟
              </Descriptions.Item>
              <Descriptions.Item label="押金">
                {serviceConfig.deposit.toLocaleString()} MEMO
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ) : null}
        
        {/* 流程步骤 */}
        <Steps 
          current={step} 
          items={steps} 
          style={{ marginBottom: 32 }} 
        />
        
        {/* Step 0: 填写兑换信息 */}
        {step === 0 && (
          <>
            {/* 市场价格显示 */}
            <Alert
              message={
                <Space>
                  <Text>当前市场价格:</Text>
                  {priceLoading ? (
                    <Spin size="small" />
                  ) : (
                    <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                      {marketPrice > 0 ? `${marketPrice.toFixed(4)} USDT/MEMO` : '暂无数据'}
                    </Text>
                  )}
                </Space>
              }
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              style={{ marginBottom: 24 }}
            />
            
            {/* 兑换表单 */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSwap}
              initialValues={{ memoAmount: 0 }}
            >
              <Form.Item
                label="兑换数量 (MEMO)"
                name="memoAmount"
                rules={[
                  { required: true, message: '请输入兑换数量' },
                  { 
                    type: 'number', 
                    min: MIN_AMOUNT, 
                    message: `最小兑换 ${MIN_AMOUNT} MEMO` 
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={`最小 ${MIN_AMOUNT} MEMO`}
                  min={MIN_AMOUNT}
                  onChange={(value) => setMemoAmount(value || 0)}
                  addonAfter="MEMO"
                />
              </Form.Item>
              
              <Form.Item
                label="USDT 接收地址 (TRC20)"
                name="tronAddress"
                rules={[
                  { required: true, message: '请输入 TRC20 地址' },
                  { 
                    pattern: /^T[A-Za-z1-9]{33}$/, 
                    message: 'TRC20 地址格式错误（以 T 开头，34 位）' 
                  },
                ]}
              >
                <Input
                  placeholder="T..."
                  onChange={(e) => setTronAddress(e.target.value)}
                />
              </Form.Item>
              
              {/* 计算结果 */}
              {memoAmount > 0 && marketPrice > 0 && (
                <Card style={{ marginBottom: 16, background: '#f0f5ff' }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic 
                        title="基础金额" 
                        value={baseUsdt.toFixed(2)} 
                        suffix="USDT"
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic 
                        title="手续费" 
                        value={fee.toFixed(2)} 
                        suffix="USDT"
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic 
                        title="实际到账" 
                        value={actualUsdt.toFixed(2)} 
                        suffix="USDT"
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Col>
                  </Row>
                </Card>
              )}
              
              {/* 余额显示 */}
              <Alert
                message={`当前余额: ${balance} MEMO`}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              {/* 提交按钮 */}
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  size="large" 
                  block
                  icon={<SwapOutlined />}
                  loading={loading}
                  disabled={!currentAccount || marketPrice === 0}
                >
                  发起兑换
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
        
        {/* Step 1: 等待做市商转账 */}
        {step === 1 && swapRecord && (
          <>
            <Card style={{ marginBottom: 24, textAlign: 'center' }}>
              <Spin size="large" />
              <Title level={4} style={{ marginTop: 16 }}>
                等待做市商转账...
              </Title>
              <Paragraph type="secondary">
                做市商通常会在 {Math.floor(serviceConfig.avgTime / 60)} 分钟内完成转账
              </Paragraph>
              
              {/* 倒计时 */}
              {timeRemaining > 0 ? (
                <Progress 
                  type="circle" 
                  percent={Math.max(0, (timeRemaining / 1800) * 100)} 
                  format={() => `${Math.floor(timeRemaining / 60)} 分钟`}
                  status="active"
                />
              ) : (
                <Alert
                  message="已超时"
                  description="做市商超过 30 分钟未转账，您可以提交举报"
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                />
              )}
            </Card>
            
            {/* 操作按钮 */}
            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button 
                type="primary" 
                onClick={handleConfirmReceipt}
                disabled={!swapRecord.trc20_tx_hash}
                loading={loading}
              >
                <CheckCircleOutlined /> 确认收款
              </Button>
              
              {isTimeout && (
                <Button 
                  danger 
                  onClick={handleReport}
                  icon={<WarningOutlined />}
                >
                  举报做市商
                </Button>
              )}
            </Space>
          </>
        )}
        
        {/* Step 2: 兑换完成 */}
        {step === 2 && swapRecord && (
          <>
            <Card style={{ textAlign: 'center', marginBottom: 24 }}>
              <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
              <Title level={3} style={{ marginTop: 16, color: '#52c41a' }}>
                兑换完成！
              </Title>
              <Paragraph type="secondary">
                您已成功兑换 {actualUsdt.toFixed(2)} USDT
              </Paragraph>
              
              {swapRecord.trc20_tx_hash && (
                <Alert
                  message={`TRC20 交易哈希: ${swapRecord.trc20_tx_hash}`}
                  type="success"
                  showIcon
                />
              )}
            </Card>
            
            <Button 
              type="primary" 
              block 
              onClick={() => navigate('/bridge/maker-list')}
            >
              返回列表
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default MakerBridgeSwapPage;

