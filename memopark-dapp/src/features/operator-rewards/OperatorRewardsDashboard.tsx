/**
 * 运营者奖励分配 Dashboard
 * 
 * 功能：
 * 1. 展示所有活跃运营者及其 SLA 统计
 * 2. 计算权重和预估收益
 * 3. 执行奖励分配（需要治理权限）
 * 4. 监听分配事件
 */

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Statistic, Row, Col, Progress, message, Modal, InputNumber, Tag, Space } from 'antd';
import { 
  TrophyOutlined, 
  DatabaseOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined 
} from '@ant-design/icons';
import { useWallet } from '../../providers/WalletProvider';
import { formatBalance } from '../../utils/format';

interface OperatorInfo {
  account: string;
  peer_id: string;
  capacity_gib: number;
  status: number;
  pinned_bytes: number;
  probe_ok: number;
  probe_fail: number;
  reliability: number;
  weight: number;
  estimated_reward: number;
}

interface RewardStats {
  total_weight: number;
  operator_count: number;
  escrow_balance: number;
  average_weight: number;
}

const OperatorRewardsDashboard: React.FC = () => {
  const { api, currentAccount: account } = useWallet();
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [operators, setOperators] = useState<OperatorInfo[]>([]);
  const [stats, setStats] = useState<RewardStats>({
    total_weight: 0,
    operator_count: 0,
    escrow_balance: 0,
    average_weight: 0,
  });
  const [distributeModalVisible, setDistributeModalVisible] = useState(false);
  const [distributeAmount, setDistributeAmount] = useState<number>(0);

  // 加载运营者数据
  const loadOperators = async () => {
    if (!api) return;

    try {
      setLoading(true);

      // 1. 获取托管账户余额
      const operatorEscrowPalletId = 'py/opesc';
      const escrowAddress = getOperatorEscrowAccount(operatorEscrowPalletId);
      const { data: escrowAccount } = await api.query.system.account(escrowAddress);
      const escrowBalance = escrowAccount.free.toBigInt();

      // 2. 查询所有运营者
      const operatorEntries = await api.query.memoIpfs.operators.entries();
      
      let totalWeight = 0n;
      let activeCount = 0;
      const operatorList: OperatorInfo[] = [];

      for (const [key, value] of operatorEntries) {
        const accountId = key.args[0].toString();
        const info = value.toJSON() as any;

        // 查询 SLA 统计
        const sla = await api.query.memoIpfs.operatorSla(accountId);
        const slaData = sla.toJSON() as any;

        // 只显示活跃运营者
        if (info.status === 0) {
          const probeOk = Number(slaData.probe_ok || 0);
          const probeFail = Number(slaData.probe_fail || 0);
          const totalProbes = probeOk + probeFail;
          const pinnedBytes = BigInt(slaData.pinned_bytes || 0);

          // 计算可靠性（千分比）
          const reliability = totalProbes > 0 
            ? (probeOk * 1000) / totalProbes 
            : 500; // 默认 50%

          // 计算权重
          const weight = (pinnedBytes * BigInt(reliability)) / 1000n;

          if (weight > 0n) {
            totalWeight += weight;
            activeCount++;

            operatorList.push({
              account: accountId,
              peer_id: info.peer_id,
              capacity_gib: info.capacity_gib,
              status: info.status,
              pinned_bytes: Number(pinnedBytes),
              probe_ok: probeOk,
              probe_fail: probeFail,
              reliability: reliability / 10, // 转为百分比
              weight: Number(weight),
              estimated_reward: 0, // 稍后计算
            });
          }
        }
      }

      // 计算预估收益
      if (totalWeight > 0n) {
        operatorList.forEach(op => {
          op.estimated_reward = Number(
            (escrowBalance * BigInt(op.weight)) / totalWeight
          );
        });
      }

      // 按权重排序
      operatorList.sort((a, b) => b.weight - a.weight);

      setOperators(operatorList);
      setStats({
        total_weight: Number(totalWeight),
        operator_count: activeCount,
        escrow_balance: Number(escrowBalance),
        average_weight: activeCount > 0 ? Number(totalWeight) / activeCount : 0,
      });

    } catch (error) {
      console.error('加载运营者数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 执行分配
  const handleDistribute = async () => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }

    try {
      setDistributing(true);

      // 构建交易
      const amount = distributeAmount === 0 ? 0 : BigInt(distributeAmount * 10 ** 12);
      const tx = api.tx.memoIpfs.distributeToOperators(amount);

      // 发送交易
      await tx.signAndSend(account.address, ({ status, events }) => {
        if (status.isInBlock) {
          message.loading('交易已打包，等待确认...');
        } else if (status.isFinalized) {
          // 检查事件
          events.forEach(({ event }) => {
            if (api.events.system.ExtrinsicSuccess.is(event)) {
              message.success('奖励分配成功！');
              setDistributeModalVisible(false);
              loadOperators(); // 重新加载数据
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              message.error('奖励分配失败');
            }
          });
        }
      });

    } catch (error: any) {
      console.error('分配失败:', error);
      message.error(error.message || '分配失败');
    } finally {
      setDistributing(false);
    }
  };

  // 获取 OperatorEscrowAccount 地址
  const getOperatorEscrowAccount = (palletId: string): string => {
    // 简化版：实际应该使用 @polkadot/util-crypto
    // 这里返回一个占位符，实际使用时需要正确计算
    return '5EYCAe5ijiYfyeZ2JJCGq56LmPyNRAKzpG4QkoQkkQNB5e6Z'; // 示例地址
  };

  useEffect(() => {
    loadOperators();
    
    // 设置定时刷新
    const interval = setInterval(loadOperators, 30000); // 30秒刷新一次
    
    return () => clearInterval(interval);
  }, [api]);

  // 表格列定义
  const columns = [
    {
      title: '运营者账户',
      dataIndex: 'account',
      key: 'account',
      width: 200,
      render: (account: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {account.slice(0, 6)}...{account.slice(-6)}
        </span>
      ),
    },
    {
      title: '存储量',
      dataIndex: 'pinned_bytes',
      key: 'pinned_bytes',
      width: 120,
      sorter: (a: OperatorInfo, b: OperatorInfo) => a.pinned_bytes - b.pinned_bytes,
      render: (bytes: number) => {
        const gb = bytes / (1024 ** 3);
        return (
          <Space>
            <DatabaseOutlined />
            <span>{gb.toFixed(2)} GB</span>
          </Space>
        );
      },
    },
    {
      title: '可靠性',
      key: 'reliability',
      width: 180,
      sorter: (a: OperatorInfo, b: OperatorInfo) => a.reliability - b.reliability,
      render: (_: any, record: OperatorInfo) => {
        const percent = record.reliability;
        let status: 'success' | 'normal' | 'exception' = 'normal';
        if (percent >= 90) status = 'success';
        else if (percent < 70) status = 'exception';
        
        return (
          <div>
            <Progress 
              percent={percent} 
              size="small" 
              status={status}
              format={(percent) => `${percent?.toFixed(1)}%`}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} /> {record.probe_ok} / {' '}
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> {record.probe_fail}
            </div>
          </div>
        );
      },
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 120,
      sorter: (a: OperatorInfo, b: OperatorInfo) => a.weight - b.weight,
      render: (weight: number, record: OperatorInfo) => {
        const share = stats.total_weight > 0 
          ? (weight / stats.total_weight * 100).toFixed(2) 
          : '0.00';
        return (
          <div>
            <div><strong>{weight}</strong></div>
            <div style={{ fontSize: '12px', color: '#666' }}>{share}%</div>
          </div>
        );
      },
    },
    {
      title: '预估收益',
      dataIndex: 'estimated_reward',
      key: 'estimated_reward',
      width: 150,
      sorter: (a: OperatorInfo, b: OperatorInfo) => a.estimated_reward - b.estimated_reward,
      render: (reward: number) => (
        <div>
          <DollarOutlined style={{ color: '#faad14' }} />{' '}
          <strong>{formatBalance(reward)}</strong>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => {
        const statusMap = {
          0: { text: '活跃', color: 'green' },
          1: { text: '暂停', color: 'orange' },
          2: { text: '封禁', color: 'red' },
        };
        const s = statusMap[status as keyof typeof statusMap] || { text: '未知', color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>
        <TrophyOutlined style={{ marginRight: '12px', color: '#faad14' }} />
        运营者奖励分配
      </h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        按存储量×可靠性加权分配，多劳多得，质量优先
      </p>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待分配金额"
              value={formatBalance(stats.escrow_balance)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃运营者"
              value={stats.operator_count}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总权重"
              value={stats.total_weight}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均权重"
              value={stats.average_weight.toFixed(0)}
            />
          </Card>
        </Col>
      </Row>

      {/* 运营者列表 */}
      <Card 
        title="运营者列表"
        extra={
          <Button 
            type="primary" 
            icon={<TrophyOutlined />}
            onClick={() => setDistributeModalVisible(true)}
            disabled={stats.operator_count === 0 || stats.escrow_balance === 0}
          >
            执行分配
          </Button>
        }
      >
        <Table
          dataSource={operators}
          columns={columns}
          rowKey="account"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个运营者`,
          }}
        />
      </Card>

      {/* 分配对话框 */}
      <Modal
        title="执行奖励分配"
        open={distributeModalVisible}
        onOk={handleDistribute}
        onCancel={() => setDistributeModalVisible(false)}
        confirmLoading={distributing}
        okText="确认分配"
        cancelText="取消"
      >
        <div style={{ marginBottom: '16px' }}>
          <p><strong>当前托管账户余额:</strong> {formatBalance(stats.escrow_balance)}</p>
          <p><strong>活跃运营者数量:</strong> {stats.operator_count}</p>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>
            分配金额（MEMO）：
          </label>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={stats.escrow_balance / 10 ** 12}
            value={distributeAmount}
            onChange={(value) => setDistributeAmount(value || 0)}
            placeholder="0 表示分配全部余额"
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            提示：输入 0 表示分配托管账户的全部余额
          </div>
        </div>

        <div style={{ background: '#f0f2f5', padding: '12px', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
            ⚠️ 此操作需要治理权限（Root 或技术委员会）
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default OperatorRewardsDashboard;

