/**
 * 函数级详细中文注释：做市商首购资金池管理页面
 * 
 * 功能：
 * 1. 查看资金池状态（总额、已用、冻结、可用）
 * 2. 申请提取资金（带7天冷却期）
 * 3. 执行提取（冷却期结束后）
 * 4. 取消提取申请
 * 5. 查看服务统计
 * 6. 治理紧急提取（仅治理权限）
 * 
 * 设计理念：
 * - 保持派生账户方案的简洁性
 * - 增强安全监控和提示
 * - 清晰展示资金流向和状态
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Alert,
  message,
  Progress,
  Descriptions,
  Tag,
  Modal,
  InputNumber,
  Divider,
  Timeline,
  Typography,
  Tooltip,
  Table,
} from 'antd';
import {
  WalletOutlined,
  DollarOutlined,
  LockOutlined,
  UnlockOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SafetyOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../hooks/useWallet';
import { getApi } from '../../lib/polkadot';
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;

/**
 * 函数级详细中文注释：资金池信息接口
 */
interface PoolInfo {
  mmId: number;
  owner: string;
  status: string;
  totalBalance: string; // 总额
  usedBalance: string;  // 已使用
  frozenBalance: string; // 冻结中
  availableBalance: string; // 可用余额
  usersServed: number; // 已服务用户数
  servicePaused: boolean; // 服务暂停状态
  minPoolBalance: string; // 最小保留余额
  firstPurchaseAmount: string; // 每次首购金额
}

/**
 * 函数级详细中文注释：提取请求接口
 */
interface WithdrawalRequest {
  amount: string;
  requestedAt: number; // 申请时间（秒）
  executableAt: number; // 可执行时间（秒）
  status: 'Pending' | 'Executed' | 'Cancelled';
}

/**
 * 函数级详细中文注释：格式化 MEMO 金额（BigInt -> 数字）
 */
const formatBalance = (balance: string): number => {
  try {
    return Number(BigInt(balance) / BigInt(1e12));
  } catch {
    return 0;
  }
};

/**
 * 函数级详细中文注释：格式化 MEMO 金额（数字 -> BigInt 字符串）
 */
const formatMemoAmount = (amount: number): string => {
  try {
    return (BigInt(Math.floor(amount * 1e12))).toString();
  } catch {
    return '0';
  }
};

/**
 * 函数级详细中文注释：计算剩余时间（秒）
 */
const getRemainingTime = (executableAt: number): number => {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, executableAt - now);
};

/**
 * 函数级详细中文注释：格式化时间（秒 -> 天时分秒）
 */
const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return '已到期';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  if (minutes > 0) return `${minutes}分钟${secs}秒`;
  return `${secs}秒`;
};

export const MarketMakerPoolPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAccount } = useWallet();
  const [api, setApi] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [withdrawalRequest, setWithdrawalRequest] = useState<WithdrawalRequest | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [pauseService, setPauseService] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  /**
   * 函数级详细中文注释：初始化 API
   */
  useEffect(() => {
    const initApi = async () => {
      try {
        const apiInstance = await getApi();
        setApi(apiInstance);
      } catch (error) {
        console.error('API 连接失败:', error);
        message.error('连接区块链失败');
      }
    };
    initApi();
  }, []);

  /**
   * 函数级详细中文注释：加载做市商资金池信息
   */
  const loadPoolInfo = async () => {
    if (!api || !selectedAccount) return;

    try {
      setLoading(true);

      // 查询做市商（🆕 pallet-trading）
      const entries = await api.query.trading.makerApplications.entries();
      
      let foundMmId: number | null = null;
      let foundApp: any = null;
      
      for (const [key, value] of entries) {
        const mmId = key.args[0].toNumber();
        const app = value.toJSON();
        
        if (app.owner.toLowerCase() === selectedAccount.address.toLowerCase() && app.status === 'Active') {
          foundMmId = mmId;
          foundApp = app;
          break;
        }
      }
      
      if (foundMmId === null || !foundApp) {
        message.error('您不是已激活的做市商');
        navigate('/otc/create-mm');
        return;
      }

      // 查询常量
      const minPoolBalance = await api.consts.marketMaker.minPoolBalance;
      const firstPurchaseAmount = await api.consts.marketMaker.firstPurchaseAmount;

      // 构造资金池信息
      const pool: PoolInfo = {
        mmId: foundMmId,
        owner: foundApp.owner,
        status: foundApp.status,
        totalBalance: foundApp.firstPurchasePool || '0',
        usedBalance: foundApp.firstPurchaseUsed || '0',
        frozenBalance: foundApp.firstPurchaseFrozen || '0',
        availableBalance: (
          BigInt(foundApp.firstPurchasePool || '0') -
          BigInt(foundApp.firstPurchaseUsed || '0') -
          BigInt(foundApp.firstPurchaseFrozen || '0')
        ).toString(),
        usersServed: foundApp.usersServed || 0,
        servicePaused: foundApp.servicePaused || false,
        minPoolBalance: minPoolBalance.toString(),
        firstPurchaseAmount: firstPurchaseAmount.toString(),
      };
      
      setPoolInfo(pool);

      // 查询提取请求（🆕 pallet-trading）
      const withdrawal = await api.query.trading.withdrawalRequests(foundMmId);
      if (withdrawal && !withdrawal.isEmpty) {
        const req = withdrawal.toJSON();
        setWithdrawalRequest({
          amount: req.amount || '0',
          requestedAt: req.requestedAt || 0,
          executableAt: req.executableAt || 0,
          status: req.status || 'Pending',
        });
        
        // 计算剩余时间
        setRemainingSeconds(getRemainingTime(req.executableAt || 0));
      } else {
        setWithdrawalRequest(null);
        setRemainingSeconds(0);
      }

    } catch (error: any) {
      console.error('加载资金池信息失败:', error);
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (api) {
      loadPoolInfo();
    }
  }, [api, selectedAccount]);

  /**
   * 函数级详细中文注释：倒计时更新
   */
  useEffect(() => {
    if (withdrawalRequest && withdrawalRequest.status === 'Pending' && remainingSeconds > 0) {
      const timer = setInterval(() => {
        setRemainingSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [withdrawalRequest, remainingSeconds]);

  /**
   * 函数级详细中文注释：申请提取资金
   */
  const handleRequestWithdrawal = async () => {
    if (!api || !poolInfo) return;

    if (withdrawAmount <= 0) {
      message.error('提取金额必须大于0');
      return;
    }

    const available = formatBalance(poolInfo.availableBalance);
    const minBalance = formatBalance(poolInfo.minPoolBalance);

    if (withdrawAmount > available) {
      message.error(`提取金额不能超过可用余额 ${available.toFixed(2)} MEMO`);
      return;
    }

    if (available - withdrawAmount < minBalance) {
      message.error(`提取后余额不能低于最小值 ${minBalance.toFixed(2)} MEMO`);
      return;
    }

    try {
      setLoading(true);
      
      const amountFormatted = formatMemoAmount(withdrawAmount);
      
      message.loading({ content: '正在提交提取申请...', key: 'withdraw', duration: 0 });

      const hash = await signAndSendLocalFromKeystore('marketMaker', 'requestWithdrawal', [
        poolInfo.mmId,
        amountFormatted,
        pauseService,
      ]);

      message.success({
        content: `提取申请已提交！交易哈希: ${hash}`,
        key: 'withdraw',
        duration: 5,
      });

      setShowWithdrawModal(false);
      
      // 等待区块确认后刷新
      await new Promise(resolve => setTimeout(resolve, 3000));
      await loadPoolInfo();

    } catch (error: any) {
      console.error('提取申请失败:', error);
      message.error({ content: error.message || '提取申请失败', key: 'withdraw', duration: 5 });
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：执行提取
   */
  const handleExecuteWithdrawal = async () => {
    if (!api || !poolInfo || !withdrawalRequest) return;

    if (remainingSeconds > 0) {
      message.warning('冷却期未结束，请等待');
      return;
    }

    try {
      setLoading(true);
      
      message.loading({ content: '正在执行提取...', key: 'execute', duration: 0 });

      const hash = await signAndSendLocalFromKeystore('marketMaker', 'executeWithdrawal', [
        poolInfo.mmId,
      ]);

      message.success({
        content: `提取已完成！交易哈希: ${hash}`,
        key: 'execute',
        duration: 5,
      });

      // 等待区块确认后刷新
      await new Promise(resolve => setTimeout(resolve, 3000));
      await loadPoolInfo();

    } catch (error: any) {
      console.error('执行提取失败:', error);
      message.error({ content: error.message || '执行提取失败', key: 'execute', duration: 5 });
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：取消提取申请
   */
  const handleCancelWithdrawal = async () => {
    if (!api || !poolInfo) return;

    Modal.confirm({
      title: '确认取消提取申请',
      content: '取消后资金将解冻并恢复服务，确定要取消吗？',
      onOk: async () => {
        try {
          setLoading(true);
          
          message.loading({ content: '正在取消提取...', key: 'cancel', duration: 0 });

          const hash = await signAndSendLocalFromKeystore('marketMaker', 'cancelWithdrawal', [
            poolInfo.mmId,
          ]);

          message.success({
            content: `提取申请已取消！交易哈希: ${hash}`,
            key: 'cancel',
            duration: 5,
          });

          // 等待区块确认后刷新
          await new Promise(resolve => setTimeout(resolve, 3000));
          await loadPoolInfo();

        } catch (error: any) {
          console.error('取消提取失败:', error);
          message.error({ content: error.message || '取消提取失败', key: 'cancel', duration: 5 });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  if (!selectedAccount) {
    return (
      <div className="first-purchase-container">
        <Card>
          <Alert
            type="warning"
            message="请先连接钱包"
            description="您需要先连接钱包才能管理资金池"
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

  if (!poolInfo && !loading) {
    return (
      <div className="first-purchase-container">
        <Card>
          <Alert
            type="info"
            message="加载中"
            description="正在加载资金池信息..."
            showIcon
          />
        </Card>
      </div>
    );
  }

  const totalBalance = poolInfo ? formatBalance(poolInfo.totalBalance) : 0;
  const usedBalance = poolInfo ? formatBalance(poolInfo.usedBalance) : 0;
  const frozenBalance = poolInfo ? formatBalance(poolInfo.frozenBalance) : 0;
  const availableBalance = poolInfo ? formatBalance(poolInfo.availableBalance) : 0;
  const minPoolBalance = poolInfo ? formatBalance(poolInfo.minPoolBalance) : 0;
  const firstPurchaseAmount = poolInfo ? formatBalance(poolInfo.firstPurchaseAmount) : 0;

  // 计算使用率
  const usageRate = totalBalance > 0 ? (usedBalance / totalBalance) * 100 : 0;
  const availableRate = totalBalance > 0 ? (availableBalance / totalBalance) * 100 : 0;

  return (
    <div className="first-purchase-container" style={{ padding: '24px' }}>
      {/* 返回按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/otc/market-maker-config')}
        >
          返回做市商配置
        </Button>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题和刷新按钮 */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2}>
              <WalletOutlined /> 首购资金池管理
            </Title>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadPoolInfo}
              loading={loading}
            >
              刷新
            </Button>
          </div>
          <Paragraph type="secondary">
            做市商 ID: {poolInfo?.mmId} | 账户: {selectedAccount.address.slice(0, 10)}...{selectedAccount.address.slice(-8)}
          </Paragraph>
        </Card>

        {/* 服务状态警告 */}
        {poolInfo?.servicePaused && (
          <Alert
            type="warning"
            message="服务已暂停"
            description="您的首购服务已暂停，新用户暂时无法使用您的做市服务"
            showIcon
            icon={<WarningOutlined />}
          />
        )}

        {/* 资金池概览 */}
        <Card title={<Text strong>💰 资金池概览</Text>}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总额"
                value={totalBalance}
                precision={2}
                suffix="MEMO"
                valueStyle={{ color: '#1890ff' }}
                prefix={<DollarOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="可用余额"
                value={availableBalance}
                precision={2}
                suffix="MEMO"
                valueStyle={{ color: '#52c41a' }}
                prefix={<UnlockOutlined />}
              />
              <Progress
                percent={availableRate}
                strokeColor="#52c41a"
                showInfo={false}
                style={{ marginTop: 8 }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="已使用"
                value={usedBalance}
                precision={2}
                suffix="MEMO"
                valueStyle={{ color: '#faad14' }}
                prefix={<CheckCircleOutlined />}
              />
              <Progress
                percent={usageRate}
                strokeColor="#faad14"
                showInfo={false}
                style={{ marginTop: 8 }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="冻结中"
                value={frozenBalance}
                precision={2}
                suffix="MEMO"
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<LockOutlined />}
              />
            </Col>
          </Row>

          <Divider />

          <Descriptions column={2} size="small">
            <Descriptions.Item label="已服务用户数">
              <Text strong>{poolInfo?.usersServed || 0}</Text> 人
            </Descriptions.Item>
            <Descriptions.Item label="每次首购金额">
              <Text strong>{firstPurchaseAmount.toFixed(2)}</Text> MEMO
            </Descriptions.Item>
            <Descriptions.Item label="最小保留余额">
              <Text strong>{minPoolBalance.toFixed(2)}</Text> MEMO
            </Descriptions.Item>
            <Descriptions.Item label="可服务剩余人数">
              <Text strong>
                {firstPurchaseAmount > 0 ? Math.floor(availableBalance / firstPurchaseAmount) : 0}
              </Text> 人
            </Descriptions.Item>
          </Descriptions>

          {/* 余额不足警告 */}
          {availableBalance < minPoolBalance * 2 && (
            <Alert
              type="warning"
              message="余额偏低"
              description={`可用余额接近最小保留值，建议充值以继续提供服务`}
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        {/* 提取请求状态 */}
        {withdrawalRequest && withdrawalRequest.status === 'Pending' && (
          <Card 
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#faad14' }} />
                <Text strong>提取申请进行中</Text>
              </Space>
            }
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="申请金额">
                <Text strong style={{ color: '#1890ff', fontSize: 18 }}>
                  {formatBalance(withdrawalRequest.amount).toFixed(2)} MEMO
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="冷却期状态">
                {remainingSeconds > 0 ? (
                  <Space>
                    <Tag color="processing">冷却中</Tag>
                    <Text>剩余时间: {formatTimeRemaining(remainingSeconds)}</Text>
                  </Space>
                ) : (
                  <Tag color="success">已就绪，可以执行提取</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {new Date(withdrawalRequest.requestedAt * 1000).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="可执行时间">
                {new Date(withdrawalRequest.executableAt * 1000).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            <Space style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleExecuteWithdrawal}
                disabled={remainingSeconds > 0}
                loading={loading}
              >
                {remainingSeconds > 0 ? `${formatTimeRemaining(remainingSeconds)} 后可执行` : '执行提取'}
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleCancelWithdrawal}
                loading={loading}
              >
                取消申请
              </Button>
            </Space>

            <Alert
              type="info"
              message="提取流程说明"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>冷却期为 7 天，期间资金被冻结</li>
                  <li>冷却期结束后，您可以执行提取操作</li>
                  <li>执行后资金将转入您的账户</li>
                  <li>随时可以取消申请并解冻资金</li>
                </ul>
              }
              style={{ marginTop: 16 }}
              showIcon
            />
          </Card>
        )}

        {/* 操作按钮 */}
        {(!withdrawalRequest || withdrawalRequest.status !== 'Pending') && (
          <Card title={<Text strong>🛠️ 资金池操作</Text>}>
            <Space size="large" wrap>
              <Button
                type="primary"
                size="large"
                icon={<UnlockOutlined />}
                onClick={() => setShowWithdrawModal(true)}
                disabled={availableBalance <= minPoolBalance}
              >
                申请提取资金
              </Button>
              <Tooltip title="前往做市商配置页面充值">
                <Button
                  size="large"
                  icon={<DollarOutlined />}
                  onClick={() => navigate('/otc/market-maker-config')}
                >
                  充值资金池
                </Button>
              </Tooltip>
            </Space>

            {availableBalance <= minPoolBalance && (
              <Alert
                type="warning"
                message="可提取余额不足"
                description="当前余额已达到最小保留值，无法申请提取"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        )}

        {/* 安全提示 */}
        <Card title={<Text strong><SafetyOutlined /> 安全提示</Text>}>
          <Timeline
            items={[
              {
                color: 'green',
                children: (
                  <div>
                    <Text strong>资金隔离：</Text>每个做市商有独立的派生账户，资金安全隔离
                  </div>
                ),
              },
              {
                color: 'blue',
                children: (
                  <div>
                    <Text strong>冷却保护：</Text>提取申请需要 7 天冷却期，防止恶意快速提取
                  </div>
                ),
              },
              {
                color: 'orange',
                children: (
                  <div>
                    <Text strong>最小保留：</Text>确保资金池始终保留足够余额继续提供服务
                  </div>
                ),
              },
              {
                color: 'purple',
                children: (
                  <div>
                    <Text strong>治理监督：</Text>异常情况下治理委员会可介入处理
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      {/* 提取申请弹窗 */}
      <Modal
        title="申请提取资金"
        open={showWithdrawModal}
        onOk={handleRequestWithdrawal}
        onCancel={() => setShowWithdrawModal(false)}
        confirmLoading={loading}
        okText="提交申请"
        cancelText="取消"
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            type="info"
            message="提取说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>提取申请提交后进入 7 天冷却期</li>
                <li>冷却期内资金被冻结，无法用于首购服务</li>
                <li>冷却期结束后可以执行提取操作</li>
                <li>提取后余额必须 ≥ {minPoolBalance.toFixed(2)} MEMO</li>
                <li>可以选择是否暂停服务（冻结期间）</li>
              </ul>
            }
            showIcon
          />

          <div>
            <Text strong>可用余额: </Text>
            <Text style={{ fontSize: 18, color: '#52c41a' }}>
              {availableBalance.toFixed(2)} MEMO
            </Text>
          </div>

          <div>
            <Text strong>提取金额（MEMO）：</Text>
            <InputNumber
              style={{ width: '100%', marginTop: 8 }}
              min={0}
              max={availableBalance - minPoolBalance}
              value={withdrawAmount}
              onChange={(value) => setWithdrawAmount(value || 0)}
              precision={2}
              placeholder="输入提取金额"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              最大可提取: {(availableBalance - minPoolBalance).toFixed(2)} MEMO
            </Text>
          </div>

          <div>
            <Button
              type={pauseService ? 'primary' : 'default'}
              onClick={() => setPauseService(!pauseService)}
              block
            >
              {pauseService ? '✓ 冻结期间暂停服务' : '冻结期间继续提供服务'}
            </Button>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              {pauseService 
                ? '服务将被暂停，新用户无法使用您的做市服务' 
                : '服务继续，但冻结资金无法用于首购'}
            </Text>
          </div>

          {withdrawAmount > 0 && (
            <Alert
              type="warning"
              message={`提取后余额: ${(availableBalance - withdrawAmount).toFixed(2)} MEMO`}
              description={`冻结金额: ${withdrawAmount.toFixed(2)} MEMO | 冷却期: 7天`}
              showIcon
            />
          )}
        </Space>
      </Modal>
    </div>
  );
};

