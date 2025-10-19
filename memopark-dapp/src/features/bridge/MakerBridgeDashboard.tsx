import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Button, Form, InputNumber, Statistic, Row, Col,
  message, Typography, Tag, Space, Spin, Alert, Modal, Switch, Descriptions 
} from 'antd';
import { 
  DashboardOutlined, PlusOutlined, StopOutlined, PlayCircleOutlined,
  DollarOutlined, StarFilled, ThunderboltOutlined, WarningOutlined,
  CheckCircleOutlined, CloseCircleOutlined 
} from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPrompt } from '@/lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;

/**
 * 做市商桥接管理 Dashboard
 * 
 * 功能：
 * - 做市商启用/禁用桥接服务
 * - 设置最大兑换额和费率
 * - 查看押金余额
 * - 查看服务统计数据（累计交易、成功率、平均时间）
 * - 查看待处理订单列表
 * - 完成兑换（填写 TRC20 哈希）
 */
export const MakerBridgeDashboard: React.FC = () => {
  const { api, currentAccount } = usePolkadot();
  const [form] = Form.useForm();
  
  // 做市商信息
  const [makerInfo, setMakerInfo] = useState<any>(null);
  const [serviceConfig, setServiceConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  
  // 待处理订单
  const [pendingSwaps, setPendingSwaps] = useState<any[]>([]);
  
  // 模态框
  const [enableModalVisible, setEnableModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<any>(null);
  const [trc20TxHash, setTrc20TxHash] = useState<string>('');
  
  /**
   * 加载做市商信息
   */
  const loadMakerInfo = async () => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }
    
    setDataLoading(true);
    try {
      // 1. 查找当前账户是哪个做市商
      const activeMakersEntries = await api.query.marketMaker.activeMarketMakers.entries();
      
      let foundMaker: any = null;
      let mmId: number = 0;
      
      for (const [key, makerOpt] of activeMakersEntries) {
        const maker = makerOpt.unwrap();
        if (maker.owner.toHuman() === currentAccount.address) {
          mmId = (key.args[0] as any).toNumber();
          foundMaker = {
            mmId,
            owner: maker.owner.toHuman(),
            name: maker.public_cid.toHuman() || `做市商 #${mmId}`,
            deposit: maker.deposit.toNumber() / 1e12,
            status: maker.status.toHuman(),
          };
          break;
        }
      }
      
      if (!foundMaker) {
        message.error('您不是已认证的做市商');
        return;
      }
      
      setMakerInfo(foundMaker);
      
      // 2. 查询桥接服务配置
      const serviceOpt = await api.query.marketMaker.bridgeServices(mmId);
      if (serviceOpt.isSome) {
        const service = serviceOpt.unwrap();
        setServiceConfig({
          enabled: service.enabled.toHuman(),
          maxSwapAmount: service.max_swap_amount.toNumber() / 1_000_000,
          feeRate: service.fee_rate_bps.toNumber() / 100,
          totalSwaps: service.total_swaps.toNumber(),
          totalVolume: service.total_volume.toNumber() / 1e12,
          successCount: service.success_count.toNumber(),
          avgTime: service.avg_time_seconds.toNumber(),
          deposit: service.deposit.toNumber() / 1e12,
        });
        
        // 3. 加载待处理订单
        await loadPendingSwaps(mmId);
      }
      
    } catch (error: any) {
      console.error('加载做市商信息失败:', error);
      message.error(`加载失败: ${error.message || '未知错误'}`);
    } finally {
      setDataLoading(false);
    }
  };
  
  /**
   * 加载待处理订单
   */
  const loadPendingSwaps = async (mmId: number) => {
    if (!api) return;
    
    try {
      // 查询所有兑换记录，筛选该做市商的待处理订单
      const allSwapsEntries = await api.query.simpleBridge.makerSwaps.entries();
      
      const pending: any[] = [];
      for (const [key, recordOpt] of allSwapsEntries) {
        const record = recordOpt.unwrap();
        const status = record.status.toHuman();
        const makerId = record.maker_id.toNumber();
        
        if (makerId === mmId && status === 'Pending') {
          pending.push({
            swapId: record.swap_id.toNumber(),
            user: record.user.toHuman(),
            memoAmount: record.memo_amount.toNumber() / 1e12,
            usdtAmount: record.usdt_amount.toNumber() / 1_000_000,
            usdtAddress: record.usdt_address.toHuman(),
            createdAt: record.created_at.toNumber(),
            timeoutAt: record.timeout_at.toNumber(),
            priceUsdt: record.price_usdt.toNumber() / 1_000_000,
          });
        }
      }
      
      setPendingSwaps(pending);
      
    } catch (error: any) {
      console.error('加载待处理订单失败:', error);
    }
  };
  
  /**
   * 启用桥接服务
   */
  const handleEnableService = async (values: any) => {
    if (!api || !currentAccount || !makerInfo) {
      message.error('请先连接钱包');
      return;
    }
    
    setLoading(true);
    try {
      const maxSwapAmountRaw = Math.floor(values.maxSwapAmount * 1_000_000);
      const feeRateBps = Math.floor(values.feeRate * 100);
      
      // 调用链上方法
      const tx = api.tx.marketMaker.enableBridgeService(
        makerInfo.mmId,
        maxSwapAmountRaw,
        feeRateBps
      );
      
      const hash = await signAndSendTxWithPrompt(tx, currentAccount.address);
      
      message.success(`桥接服务已启用！交易哈希: ${hash.substring(0, 10)}...`);
      setEnableModalVisible(false);
      
      // 刷新数据
      await loadMakerInfo();
    } catch (error: any) {
      console.error('启用服务失败:', error);
      message.error(`启用失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 禁用桥接服务
   */
  const handleDisableService = async () => {
    if (!api || !currentAccount || !makerInfo) {
      message.error('请先连接钱包');
      return;
    }
    
    setLoading(true);
    try {
      const tx = api.tx.marketMaker.disableBridgeService(makerInfo.mmId);
      
      const hash = await signAndSendTxWithPrompt(tx, currentAccount.address);
      
      message.success(`桥接服务已禁用！交易哈希: ${hash.substring(0, 10)}...`);
      
      // 刷新数据
      await loadMakerInfo();
    } catch (error: any) {
      console.error('禁用服务失败:', error);
      message.error(`禁用失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 完成兑换
   */
  const handleCompleteSwap = async () => {
    if (!api || !currentAccount || !selectedSwap || !trc20TxHash) {
      message.error('参数错误');
      return;
    }
    
    setLoading(true);
    try {
      const tx = api.tx.simpleBridge.completeSwapByMaker(
        selectedSwap.swapId,
        trc20TxHash
      );
      
      const hash = await signAndSendTxWithPrompt(tx, currentAccount.address);
      
      message.success(`兑换 #${selectedSwap.swapId} 已完成！交易哈希: ${hash.substring(0, 10)}...`);
      setCompleteModalVisible(false);
      setSelectedSwap(null);
      setTrc20TxHash('');
      
      // 刷新数据
      await loadMakerInfo();
    } catch (error: any) {
      console.error('完成兑换失败:', error);
      message.error(`完成失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    loadMakerInfo();
  }, [api, currentAccount]);
  
  /**
   * 待处理订单表格列
   */
  const columns = [
    {
      title: '兑换 ID',
      dataIndex: 'swapId',
      key: 'swapId',
      width: 100,
    },
    {
      title: '用户地址',
      dataIndex: 'user',
      key: 'user',
      width: 180,
      render: (addr: string) => (
        <Text copyable ellipsis style={{ maxWidth: 150 }}>
          {addr}
        </Text>
      ),
    },
    {
      title: 'MEMO 数量',
      dataIndex: 'memoAmount',
      key: 'memoAmount',
      width: 120,
      render: (amount: number) => `${amount.toFixed(2)} MEMO`,
    },
    {
      title: 'USDT 金额',
      dataIndex: 'usdtAmount',
      key: 'usdtAmount',
      width: 120,
      render: (amount: number) => `${amount.toFixed(2)} USDT`,
    },
    {
      title: 'USDT 地址',
      dataIndex: 'usdtAddress',
      key: 'usdtAddress',
      width: 180,
      render: (addr: string) => (
        <Text copyable ellipsis style={{ maxWidth: 150 }}>
          {addr}
        </Text>
      ),
    },
    {
      title: '超时时间',
      dataIndex: 'timeoutAt',
      key: 'timeoutAt',
      width: 120,
      render: (block: number) => (
        <Tag color="orange">
          <ClockCircleOutlined /> 区块 {block}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => {
            setSelectedSwap(record);
            setCompleteModalVisible(true);
          }}
        >
          完成兑换
        </Button>
      ),
    },
  ];
  
  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <Card>
        {/* 页面标题 */}
        <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 24 }}>
          <Title level={2}>
            <DashboardOutlined /> 做市商桥接管理
          </Title>
          <Paragraph type="secondary">
            管理您的桥接服务，查看统计数据和处理待办订单。
          </Paragraph>
        </Space>
        
        {dataLoading ? (
          <Spin tip="加载做市商信息..." />
        ) : makerInfo ? (
          <>
            {/* 做市商基本信息 */}
            <Card title="做市商信息" style={{ marginBottom: 24 }}>
              <Descriptions column={3}>
                <Descriptions.Item label="做市商 ID">{makerInfo.mmId}</Descriptions.Item>
                <Descriptions.Item label="名称">{makerInfo.name}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color="green">{makerInfo.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="押金余额">
                  {makerInfo.deposit.toLocaleString()} MEMO
                </Descriptions.Item>
              </Descriptions>
            </Card>
            
            {/* 服务配置和统计 */}
            {serviceConfig ? (
              <>
                {/* 统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="服务状态" 
                        value={serviceConfig.enabled ? '启用' : '禁用'} 
                        valueStyle={{ color: serviceConfig.enabled ? '#52c41a' : '#999' }}
                        prefix={serviceConfig.enabled ? <PlayCircleOutlined /> : <StopOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="手续费率" 
                        value={serviceConfig.feeRate} 
                        suffix="%"
                        precision={2}
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<DollarOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="成功率" 
                        value={
                          serviceConfig.totalSwaps > 0 
                            ? (serviceConfig.successCount / serviceConfig.totalSwaps) * 100 
                            : 0
                        } 
                        suffix="%"
                        precision={1}
                        valueStyle={{ color: '#52c41a' }}
                        prefix={<StarFilled />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="平均时间" 
                        value={Math.floor(serviceConfig.avgTime / 60)} 
                        suffix="分钟"
                        valueStyle={{ color: '#faad14' }}
                        prefix={<ThunderboltOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>
                
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="累计交易" 
                        value={serviceConfig.totalSwaps} 
                        suffix="笔"
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="累计交易量" 
                        value={serviceConfig.totalVolume} 
                        suffix="MEMO"
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="最大兑换额" 
                        value={serviceConfig.maxSwapAmount} 
                        suffix="USDT"
                        precision={0}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="服务押金" 
                        value={serviceConfig.deposit} 
                        suffix="MEMO"
                        precision={0}
                      />
                    </Card>
                  </Col>
                </Row>
                
                {/* 操作按钮 */}
                <Space style={{ marginBottom: 24 }}>
                  {serviceConfig.enabled ? (
                    <Button 
                      danger 
                      icon={<StopOutlined />}
                      onClick={handleDisableService}
                      loading={loading}
                    >
                      禁用服务
                    </Button>
                  ) : (
                    <Button 
                      type="primary" 
                      icon={<PlayCircleOutlined />}
                      onClick={() => setEnableModalVisible(true)}
                    >
                      启用服务
                    </Button>
                  )}
                  
                  <Button 
                    icon={<DashboardOutlined />}
                    onClick={() => loadMakerInfo()}
                    loading={dataLoading}
                  >
                    刷新数据
                  </Button>
                </Space>
                
                {/* 待处理订单 */}
                <Card title={`待处理订单 (${pendingSwaps.length})`} style={{ marginBottom: 24 }}>
                  {pendingSwaps.length > 0 ? (
                    <>
                      <Alert
                        message="重要提示"
                        description="请在 30 分钟内转账 USDT 到用户地址，并在完成后填写 TRC20 交易哈希。超时未转账将导致用户举报和押金罚没。"
                        type="warning"
                        showIcon
                        icon={<WarningOutlined />}
                        style={{ marginBottom: 16 }}
                      />
                      
                      <Table
                        columns={columns}
                        dataSource={pendingSwaps}
                        rowKey="swapId"
                        pagination={false}
                        scroll={{ x: 1000 }}
                      />
                    </>
                  ) : (
                    <Alert
                      message="暂无待处理订单"
                      description="当前没有需要处理的兑换订单。"
                      type="info"
                      showIcon
                    />
                  )}
                </Card>
              </>
            ) : (
              <Card style={{ marginBottom: 24, textAlign: 'center' }}>
                <Title level={4}>您尚未启用桥接服务</Title>
                <Paragraph type="secondary">
                  点击下方按钮启用桥接服务，开始为用户提供 MEMO → USDT 兑换。
                </Paragraph>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => setEnableModalVisible(true)}
                >
                  启用桥接服务
                </Button>
              </Card>
            )}
          </>
        ) : (
          <Alert
            message="您不是已认证的做市商"
            description="请先申请成为做市商，并通过审核后才能使用此功能。"
            type="error"
            showIcon
          />
        )}
      </Card>
      
      {/* 启用服务模态框 */}
      <Modal
        title="启用桥接服务"
        open={enableModalVisible}
        onCancel={() => setEnableModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEnableService}
          initialValues={{ maxSwapAmount: 1000, feeRate: 0.1 }}
        >
          <Form.Item
            label="最大单笔兑换额 (USDT)"
            name="maxSwapAmount"
            rules={[
              { required: true, message: '请输入最大兑换额' },
              { type: 'number', min: 100, message: '最小 100 USDT' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={100}
              addonAfter="USDT"
            />
          </Form.Item>
          
          <Form.Item
            label="手续费率 (%)"
            name="feeRate"
            rules={[
              { required: true, message: '请输入手续费率' },
              { type: 'number', min: 0.05, max: 5, message: '范围: 0.05% - 5%' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.05}
              max={5}
              step={0.01}
              precision={2}
              addonAfter="%"
            />
          </Form.Item>
          
          <Alert
            message="押金计算"
            description={
              form.getFieldValue('maxSwapAmount') 
                ? `所需押金: ${(form.getFieldValue('maxSwapAmount') * 100).toLocaleString()} MEMO`
                : '填写最大兑换额后自动计算'
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEnableModalVisible(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
              >
                启用
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 完成兑换模态框 */}
      <Modal
        title="完成兑换"
        open={completeModalVisible}
        onCancel={() => {
          setCompleteModalVisible(false);
          setSelectedSwap(null);
          setTrc20TxHash('');
        }}
        onOk={handleCompleteSwap}
        confirmLoading={loading}
        okText="确认完成"
        cancelText="取消"
      >
        {selectedSwap && (
          <>
            <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="兑换 ID">{selectedSwap.swapId}</Descriptions.Item>
              <Descriptions.Item label="USDT 金额">
                {selectedSwap.usdtAmount.toFixed(2)} USDT
              </Descriptions.Item>
              <Descriptions.Item label="USDT 地址">
                <Text copyable>{selectedSwap.usdtAddress}</Text>
              </Descriptions.Item>
            </Descriptions>
            
            <Alert
              message="操作步骤"
              description={
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>复制 USDT 地址</li>
                  <li>在 TRON 钱包中转账 {selectedSwap.usdtAmount.toFixed(2)} USDT (TRC20)</li>
                  <li>复制交易哈希并粘贴到下方输入框</li>
                  <li>点击"确认完成"提交到链上</li>
                </ol>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Form.Item
              label="TRC20 交易哈希"
              required
            >
              <Input
                placeholder="0x..."
                value={trc20TxHash}
                onChange={(e) => setTrc20TxHash(e.target.value)}
              />
            </Form.Item>
          </>
        )}
      </Modal>
    </div>
  );
};

export default MakerBridgeDashboard;

