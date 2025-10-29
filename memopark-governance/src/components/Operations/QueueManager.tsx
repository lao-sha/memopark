/**
 * 执行队列管理工具
 * 
 * 功能：
 * - 查看执行队列状态
 * - 清理历史队列（调用purge_execution_queues）
 * - 队列统计和可视化
 * 
 * 运维场景：
 * - 检查队列积压情况
 * - 清理已执行的历史队列释放存储
 * - 监控队列健康状况
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  InputNumber,
  message,
  Space,
  Tag,
  Alert,
  Statistic,
  Row,
  Col,
  Descriptions,
} from 'antd';
import {
  DeleteOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useApi } from '@/contexts/Api';
import { useWallet } from '@/contexts/Wallet';
import type { ApiPromise } from '@polkadot/api';
import type { ColumnsType } from 'antd/es/table';

/**
 * 队列信息
 */
interface QueueInfo {
  blockNumber: number;          // 区块号
  appealIds: number[];          // 待执行申诉ID列表
  count: number;                // 申诉数量
  status: 'future' | 'current' | 'past'; // 队列状态
}

/**
 * 队列统计
 */
interface QueueStats {
  totalQueues: number;          // 总队列数
  totalAppeals: number;         // 总待执行申诉数
  maxQueueSize: number;         // 最大队列长度
  avgQueueSize: number;         // 平均队列长度
}

/**
 * 获取当前区块高度
 */
async function getCurrentBlockHeight(api: ApiPromise): Promise<number> {
  const header = await api.rpc.chain.getHeader();
  return header.number.toNumber();
}

/**
 * 获取执行队列信息
 */
async function getQueueInfo(
  api: ApiPromise,
  startBlock: number,
  endBlock: number,
  currentBlock: number
): Promise<QueueInfo[]> {
  const queues: QueueInfo[] = [];
  
  // 批量查询队列
  const blockNumbers = Array.from(
    { length: endBlock - startBlock + 1 },
    (_, i) => startBlock + i
  );
  
  const queueData = await Promise.all(
    blockNumbers.map(blockNum => api.query.memoAppeals.executionQueue(blockNum))
  );
  
  for (let i = 0; i < blockNumbers.length; i++) {
    const blockNumber = blockNumbers[i];
    const appealIds = queueData[i].toJSON() as number[];
    
    if (appealIds.length > 0) {
      queues.push({
        blockNumber,
        appealIds,
        count: appealIds.length,
        status:
          blockNumber < currentBlock
            ? 'past'
            : blockNumber === currentBlock
            ? 'current'
            : 'future',
      });
    }
  }
  
  return queues;
}

/**
 * 计算队列统计
 */
function calculateStats(queues: QueueInfo[]): QueueStats {
  const totalQueues = queues.length;
  const totalAppeals = queues.reduce((sum, q) => sum + q.count, 0);
  const maxQueueSize = Math.max(...queues.map(q => q.count), 0);
  const avgQueueSize = totalQueues > 0 ? totalAppeals / totalQueues : 0;
  
  return {
    totalQueues,
    totalAppeals,
    maxQueueSize,
    avgQueueSize: Math.round(avgQueueSize * 10) / 10,
  };
}

/**
 * 队列管理组件
 */
const QueueManager: React.FC = () => {
  const { api } = useApi();
  const { activeAccount } = useWallet();
  
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  
  // 清理参数
  const [startBlock, setStartBlock] = useState<number>(0);
  const [endBlock, setEndBlock] = useState<number>(0);
  
  /**
   * 加载队列数据
   */
  const loadQueues = useCallback(async () => {
    if (!api) return;
    
    setLoading(true);
    try {
      // 获取当前区块高度
      const current = await getCurrentBlockHeight(api);
      setCurrentBlock(current);
      
      // 查询前后各50个区块的队列（共100个区块）
      const start = Math.max(0, current - 50);
      const end = current + 50;
      
      const queueData = await getQueueInfo(api, start, end, current);
      setQueues(queueData);
      
      // 计算统计
      const queueStats = calculateStats(queueData);
      setStats(queueStats);
      
      // 设置清理参数默认值
      if (queueData.length > 0) {
        const pastQueues = queueData.filter(q => q.status === 'past');
        if (pastQueues.length > 0) {
          setStartBlock(pastQueues[0].blockNumber);
          setEndBlock(pastQueues[pastQueues.length - 1].blockNumber);
        }
      }
    } catch (e) {
      console.error('加载队列数据失败:', e);
      message.error('加载队列数据失败');
    } finally {
      setLoading(false);
    }
  }, [api]);
  
  /**
   * 清理历史队列
   */
  const handlePurgeQueues = async () => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包');
      return;
    }
    
    if (startBlock >= endBlock) {
      message.error('结束区块必须大于起始区块');
      return;
    }
    
    if (endBlock >= currentBlock) {
      message.error('不能清理未来或当前区块的队列');
      return;
    }
    
    Modal.confirm({
      title: '确认清理队列',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>确定要清理以下区块范围的执行队列吗？</p>
          <p>
            <strong>起始区块:</strong> {startBlock}
          </p>
          <p>
            <strong>结束区块:</strong> {endBlock}
          </p>
          <p style={{ color: '#ff4d4f', marginTop: 12 }}>
            ⚠️ 此操作不可撤销，仅清理已执行完的历史队列。
          </p>
        </div>
      ),
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setPurgeLoading(true);
        try {
          // 调用purge_execution_queues extrinsic
          const tx = api.tx.memoAppeals.purgeExecutionQueues(startBlock, endBlock);
          
          // 签名并发送交易
          await (window as any).signAndSend(activeAccount, tx, {
            onSuccess: () => {
              message.success('队列清理成功！');
              setTimeout(() => loadQueues(), 3000);
            },
            onError: (error: Error) => {
              message.error('队列清理失败：' + error.message);
            },
          });
        } catch (e: any) {
          message.error('操作失败：' + (e?.message || ''));
        } finally {
          setPurgeLoading(false);
        }
      },
    });
  };
  
  // 初始加载
  useEffect(() => {
    loadQueues();
  }, [loadQueues]);
  
  // 表格列定义
  const columns: ColumnsType<QueueInfo> = [
    {
      title: '区块号',
      dataIndex: 'blockNumber',
      key: 'blockNumber',
      width: 150,
      render: (blockNumber, record) => (
        <Space>
          <span style={{ fontWeight: 'bold' }}>{blockNumber.toLocaleString()}</span>
          {record.status === 'current' && <Tag color="processing">当前</Tag>}
          {record.status === 'past' && <Tag color="default">已过</Tag>}
          {record.status === 'future' && <Tag color="blue">未来</Tag>}
        </Space>
      ),
    },
    {
      title: '待执行申诉数',
      dataIndex: 'count',
      key: 'count',
      width: 150,
      render: (count) => (
        <Tag color={count > 5 ? 'error' : count > 2 ? 'warning' : 'success'}>
          {count} 个
        </Tag>
      ),
    },
    {
      title: '申诉ID列表',
      dataIndex: 'appealIds',
      key: 'appealIds',
      ellipsis: true,
      render: (appealIds: number[]) => (
        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>
          [{appealIds.join(', ')}]
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.status === 'past') {
          return <Tag color="default" icon={<CheckCircleOutlined />}>已执行</Tag>;
        }
        if (record.status === 'current') {
          return <Tag color="processing" icon={<ClockCircleOutlined />}>执行中</Tag>;
        }
        return <Tag color="blue" icon={<ClockCircleOutlined />}>待执行</Tag>;
      },
    },
  ];
  
  return (
    <div>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic title="队列数量" value={stats.totalQueues} suffix="个" />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="待执行申诉"
                value={stats.totalAppeals}
                suffix="个"
                valueStyle={{ color: stats.totalAppeals > 50 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="最大队列长度"
                value={stats.maxQueueSize}
                valueStyle={{ color: stats.maxQueueSize > 10 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="平均队列长度"
                value={stats.avgQueueSize}
                precision={1}
              />
            </Card>
          </Col>
        </Row>
      )}
      
      {/* 队列健康提示 */}
      {stats && stats.totalAppeals > 50 && (
        <Alert
          type="warning"
          message="队列积压告警"
          description={`当前有 ${stats.totalAppeals} 个申诉待执行，建议检查系统状态。`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      {/* 队列列表 */}
      <Card
        title="执行队列列表"
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadQueues} loading={loading}>
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={queues}
          rowKey="blockNumber"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 个队列`,
          }}
          scroll={{ x: 800 }}
          locale={{ emptyText: '暂无队列数据' }}
        />
      </Card>
      
      {/* 队列清理工具 */}
      <Card
        title="队列清理工具"
        style={{ marginTop: 16 }}
        extra={
          <Tag color="warning">
            <ExclamationCircleOutlined /> 仅清理已执行完的历史队列
          </Tag>
        }
      >
        <Alert
          type="info"
          message="清理说明"
          description="清理历史执行队列可以释放链上存储空间。只能清理已执行完毕的队列（区块号小于当前区块）。"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Descriptions bordered column={1}>
          <Descriptions.Item label="当前区块高度">
            <strong>{currentBlock.toLocaleString()}</strong>
          </Descriptions.Item>
          
          <Descriptions.Item label="起始区块">
            <InputNumber
              min={0}
              max={currentBlock - 1}
              value={startBlock}
              onChange={(val) => setStartBlock(val || 0)}
              style={{ width: 200 }}
            />
          </Descriptions.Item>
          
          <Descriptions.Item label="结束区块">
            <InputNumber
              min={startBlock + 1}
              max={currentBlock - 1}
              value={endBlock}
              onChange={(val) => setEndBlock(val || 0)}
              style={{ width: 200 }}
            />
          </Descriptions.Item>
          
          <Descriptions.Item label="将清理区块范围">
            <Tag color="processing">
              {startBlock.toLocaleString()} ~ {endBlock.toLocaleString()}
            </Tag>
            <span style={{ marginLeft: 8, color: '#999' }}>
              （共 {Math.max(0, endBlock - startBlock + 1)} 个区块）
            </span>
          </Descriptions.Item>
        </Descriptions>
        
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={handlePurgeQueues}
            loading={purgeLoading}
            disabled={!activeAccount || startBlock >= endBlock || endBlock >= currentBlock}
          >
            清理队列
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default QueueManager;

