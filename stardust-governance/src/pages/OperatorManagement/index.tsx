/**
 * 运营者管理页面
 * 
 * 功能：
 * 1. 显示所有运营者列表及 SLA 统计
 * 2. 注册新运营者（join_operator）
 * 3. 更新运营者信息
 * 4. 退出运营者
 * 5. 执行奖励分配（治理权限）
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  message, 
  Tag, 
  Space,
  Statistic,
  Row,
  Col,
  Progress,
  Tabs,
  Descriptions,
  Upload,
  Select,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  UserAddOutlined,
  DatabaseOutlined,
  DollarOutlined,
  TrophyOutlined,
  InfoCircleOutlined,
  UploadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useApi } from '../../contexts/Api';
import { useWallet } from '../../contexts/Wallet';

const { TabPane } = Tabs;
const { TextArea } = Input;

interface OperatorInfo {
  account: string;
  peer_id: string;
  capacity_gib: number;
  status: number; // 0=Active, 1=Suspended, 2=Banned
  bond: string;
  pinned_bytes: number;
  probe_ok: number;
  probe_fail: number;
  reliability: number;
  weight: number;
  degraded: number;
}

interface Stats {
  total_operators: number;
  active_operators: number;
  total_capacity: number;
  total_pinned: number;
  escrow_balance: string;
}

const OperatorManagement: React.FC = () => {
  const { api } = useApi();
  const { account, signer } = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [operators, setOperators] = useState<OperatorInfo[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_operators: 0,
    active_operators: 0,
    total_capacity: 0,
    total_pinned: 0,
    escrow_balance: '0',
  });
  
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [distributeModalVisible, setDistributeModalVisible] = useState(false);
  const [registerForm] = Form.useForm();
  const [distributeAmount, setDistributeAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // 加载运营者数据
  const loadOperators = async () => {
    if (!api) return;

    try {
      setLoading(true);

      // 1. 获取所有运营者
      const operatorEntries = await api.query.memoIpfs.operators.entries();
      
      const operatorList: OperatorInfo[] = [];
      let totalCapacity = 0;
      let totalPinned = 0;
      let activeCount = 0;

      for (const [key, value] of operatorEntries) {
        const accountId = key.args[0].toString();
        const info = value.toJSON() as any;

        // 获取 SLA 统计
        const sla = await api.query.memoIpfs.operatorSla(accountId);
        const slaData = sla.toJSON() as any;

        // 获取保证金
        const bond = await api.query.memoIpfs.operatorBond(accountId);
        const bondAmount = bond.toString();

        const probeOk = Number(slaData.probe_ok || 0);
        const probeFail = Number(slaData.probe_fail || 0);
        const totalProbes = probeOk + probeFail;
        const reliability = totalProbes > 0 ? (probeOk / totalProbes) * 100 : 50;
        const pinnedBytes = Number(slaData.pinned_bytes || 0);

        // 计算权重
        const capacityBytes = info.capacity_gib * 1024 * 1024 * 1024;
        const availableRatio = capacityBytes > 0 ? (1 - pinnedBytes / capacityBytes) : 0;
        const weight = Math.floor(pinnedBytes * (reliability / 100));

        totalCapacity += info.capacity_gib;
        totalPinned += pinnedBytes;
        if (info.status === 0) activeCount++;

        operatorList.push({
          account: accountId,
          peer_id: info.peer_id,
          capacity_gib: info.capacity_gib,
          status: info.status,
          bond: bondAmount,
          pinned_bytes: pinnedBytes,
          probe_ok: probeOk,
          probe_fail: probeFail,
          reliability,
          weight,
          degraded: Number(slaData.degraded || 0),
        });
      }

      // 2. 获取托管账户余额
      const operatorEscrowPalletId = api.consts.memoIpfs.operatorEscrowPalletId || 'py/opesc';
      // 简化：这里需要正确派生地址，暂时使用占位
      const escrowBalance = '0'; // TODO: 正确获取托管账户余额

      // 按权重排序
      operatorList.sort((a, b) => b.weight - a.weight);

      setOperators(operatorList);
      setStats({
        total_operators: operatorList.length,
        active_operators: activeCount,
        total_capacity: totalCapacity,
        total_pinned: totalPinned / (1024 ** 3), // 转为 GB
        escrow_balance: escrowBalance,
      });

    } catch (error) {
      console.error('加载运营者数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 注册运营者
  const handleRegister = async (values: any) => {
    if (!api || !account || !signer) {
      message.error('请先连接钱包');
      return;
    }

    try {
      setSubmitting(true);

      const {
        peer_id,
        capacity_gib,
        endpoint_url,
        bond_amount,
      } = values;

      // 计算 endpoint_hash（这里简化为使用 blake2）
      const endpointHash = api.createType('Hash', api.registry.hash(endpoint_url));

      // 构建交易
      const tx = api.tx.memoIpfs.joinOperator(
        peer_id,
        capacity_gib,
        endpointHash,
        null, // cert_fingerprint (optional)
        BigInt(bond_amount * 10 ** 12) // 转为最小单位
      );

      // 发送交易
      await tx.signAndSend(account, { signer }, ({ status, events }) => {
        if (status.isInBlock) {
          message.loading('交易已打包，等待确认...', 0);
        } else if (status.isFinalized) {
          message.destroy();
          
          // 检查事件
          let success = false;
          events.forEach(({ event }) => {
            if (api.events.system.ExtrinsicSuccess.is(event)) {
              success = true;
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              message.error('注册失败');
            }
          });

          if (success) {
            message.success('注册成功！');
            setRegisterModalVisible(false);
            registerForm.resetFields();
            loadOperators(); // 重新加载数据
          }
        }
      });

    } catch (error: any) {
      console.error('注册失败:', error);
      message.error(error.message || '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 执行奖励分配
  const handleDistribute = async () => {
    if (!api || !account || !signer) {
      message.error('请先连接钱包');
      return;
    }

    try {
      setSubmitting(true);

      const amount = distributeAmount === 0 ? 0 : BigInt(distributeAmount * 10 ** 12);
      const tx = api.tx.memoIpfs.distributeToOperators(amount);

      await tx.signAndSend(account, { signer }, ({ status, events }) => {
        if (status.isInBlock) {
          message.loading('交易已打包，等待确认...', 0);
        } else if (status.isFinalized) {
          message.destroy();
          
          events.forEach(({ event }) => {
            if (api.events.system.ExtrinsicSuccess.is(event)) {
              message.success('奖励分配成功！');
              setDistributeModalVisible(false);
              loadOperators();
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              message.error('分配失败');
            }
          });
        }
      });

    } catch (error: any) {
      console.error('分配失败:', error);
      message.error(error.message || '分配失败');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadOperators();
    
    // 定时刷新
    const interval = setInterval(loadOperators, 30000);
    
    return () => clearInterval(interval);
  }, [api]);

  // 表格列定义
  const columns = [
    {
      title: '运营者账户',
      dataIndex: 'account',
      key: 'account',
      width: 180,
      fixed: 'left' as const,
      render: (account: string) => (
        <Tooltip title={account}>
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {account.slice(0, 8)}...{account.slice(-8)}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '存储容量',
      dataIndex: 'capacity_gib',
      key: 'capacity_gib',
      width: 120,
      sorter: (a: OperatorInfo, b: OperatorInfo) => a.capacity_gib - b.capacity_gib,
      render: (capacity: number) => `${capacity} GB`,
    },
    {
      title: '已用存储',
      dataIndex: 'pinned_bytes',
      key: 'pinned_bytes',
      width: 120,
      sorter: (a: OperatorInfo, b: OperatorInfo) => a.pinned_bytes - b.pinned_bytes,
      render: (bytes: number) => `${(bytes / (1024 ** 3)).toFixed(2)} GB`,
    },
    {
      title: '使用率',
      key: 'usage',
      width: 100,
      render: (_: any, record: OperatorInfo) => {
        const usage = (record.pinned_bytes / (record.capacity_gib * 1024 ** 3)) * 100;
        return `${usage.toFixed(1)}%`;
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
            <Progress percent={percent} size="small" status={status} />
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
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
      width: 100,
      sorter: (a: OperatorInfo, b: OperatorInfo) => a.weight - b.weight,
      render: (weight: number) => <strong>{weight.toLocaleString()}</strong>,
    },
    {
      title: '保证金',
      dataIndex: 'bond',
      key: 'bond',
      width: 120,
      render: (bond: string) => `${(Number(bond) / 10 ** 12).toFixed(2)} DUST`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      filters: [
        { text: '活跃', value: 0 },
        { text: '暂停', value: 1 },
        { text: '封禁', value: 2 },
      ],
      onFilter: (value: any, record: OperatorInfo) => record.status === value,
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
        <DatabaseOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
        运营者管理
      </h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        管理 IPFS 存储运营者，执行注册、更新和奖励分配
      </p>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="运营者总数"
              value={stats.total_operators}
              prefix={<UserAddOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃运营者"
              value={stats.active_operators}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总容量"
              value={stats.total_capacity}
              suffix="GB"
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已用存储"
              value={stats.total_pinned.toFixed(2)}
              suffix="GB"
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Card style={{ marginBottom: '24px' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setRegisterModalVisible(true)}
          >
            注册为运营者
          </Button>
          <Button
            icon={<TrophyOutlined />}
            onClick={() => setDistributeModalVisible(true)}
            disabled={!account}
          >
            执行奖励分配
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadOperators}
            loading={loading}
          >
            刷新数据
          </Button>
        </Space>
      </Card>

      {/* 运营者列表 */}
      <Card title="运营者列表">
        <Table
          dataSource={operators}
          columns={columns}
          rowKey="account"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个运营者`,
          }}
        />
      </Card>

      {/* 注册对话框 */}
      <Modal
        title={
          <span>
            <UserAddOutlined style={{ marginRight: '8px' }} />
            注册为运营者
          </span>
        }
        open={registerModalVisible}
        onCancel={() => setRegisterModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={registerForm}
          layout="vertical"
          onFinish={handleRegister}
        >
          <Form.Item
            label={
              <span>
                IPFS Peer ID
                <Tooltip title="您的 IPFS 节点的 Peer ID，格式如 QmXXXXXX...">
                  <InfoCircleOutlined style={{ marginLeft: '4px', color: '#999' }} />
                </Tooltip>
              </span>
            }
            name="peer_id"
            rules={[
              { required: true, message: '请输入 Peer ID' },
              { min: 40, message: 'Peer ID 长度至少 40 个字符' },
            ]}
          >
            <Input placeholder="Qm..." />
          </Form.Item>

          <Form.Item
            label={
              <span>
                存储容量（GB）
                <Tooltip title="您愿意提供的存储容量，单位为 GB">
                  <InfoCircleOutlined style={{ marginLeft: '4px', color: '#999' }} />
                </Tooltip>
              </span>
            }
            name="capacity_gib"
            rules={[
              { required: true, message: '请输入存储容量' },
              { type: 'number', min: 100, message: '最小容量为 100 GB' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={100}
              step={100}
              placeholder="1000"
            />
          </Form.Item>

          <Form.Item
            label={
              <span>
                IPFS 集群端点
                <Tooltip title="您的 IPFS Cluster API 端点地址">
                  <InfoCircleOutlined style={{ marginLeft: '4px', color: '#999' }} />
                </Tooltip>
              </span>
            }
            name="endpoint_url"
            rules={[
              { required: true, message: '请输入端点地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input placeholder="http://your-ipfs-cluster:9094" />
          </Form.Item>

          <Form.Item
            label={
              <span>
                保证金（MEMO）
                <Tooltip title="需要质押的保证金数量，用于保证服务质量">
                  <InfoCircleOutlined style={{ marginLeft: '4px', color: '#999' }} />
                </Tooltip>
              </span>
            }
            name="bond_amount"
            rules={[
              { required: true, message: '请输入保证金数量' },
              { type: 'number', min: 1000, message: '最小保证金为 1000 DUST' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1000}
              step={1000}
              placeholder="1000"
            />
          </Form.Item>

          <div style={{ background: '#f0f2f5', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>注册要求：</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
              <li>部署并运行 IPFS 节点</li>
              <li>部署并运行 IPFS Cluster</li>
              <li>提供至少 100 GB 存储空间</li>
              <li>质押至少 1000 DUST 作为保证金</li>
              <li>保持节点在线（建议 &gt; 95%）</li>
            </ul>
          </div>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setRegisterModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交注册
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 奖励分配对话框 */}
      <Modal
        title="执行奖励分配"
        open={distributeModalVisible}
        onOk={handleDistribute}
        onCancel={() => setDistributeModalVisible(false)}
        confirmLoading={submitting}
        okText="确认分配"
        cancelText="取消"
      >
        <div style={{ marginBottom: '16px' }}>
          <p><strong>当前托管账户余额:</strong> {stats.escrow_balance} DUST</p>
          <p><strong>活跃运营者数量:</strong> {stats.active_operators}</p>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>
            分配金额（MEMO）：
          </label>
          <InputNumber
            style={{ width: '100%' }}
            min={0}
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
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666' }}>
            奖励将按照存储量×可靠性的权重自动分配给所有活跃运营者
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default OperatorManagement;

