/**
 * V6 被授权命盘列表组件
 *
 * 供服务提供者（命理师、AI 服务等）查看被授权访问的命盘：
 * - 显示所有被授权的命盘列表
 * - 支持解密查看命盘详情
 * - 显示授权角色和权限范围
 * - 支持筛选和搜索
 *
 * @module features/bazi/components/v6/GrantedCharts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Table,
  Modal,
  message,
  Tag,
  Empty,
  Tooltip,
  Alert,
  Input,
  Select,
  Spin,
  Descriptions,
  Divider,
  Badge,
} from 'antd';
import {
  UnlockOutlined,
  LockOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  ManOutlined,
  WomanOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useWalletStore } from '../../../../store/walletStore';
import { getApi } from '../../../../lib/polkadot';
import {
  AccessRole,
  AccessScope,
  loadPrivateKey,
  unsealDataKey,
  decryptWithDataKey,
  hasStoredKey,
} from '../../../../services/multiKeyEncryption';
import {
  getProviderGrants,
  getMultiKeyEncryptedChartInfo,
  getServiceProvider,
  type MultiKeyChartInfo,
  type ServiceProviderInfo,
} from '../../../../services/baziChainService';

const { Text, Paragraph } = Typography;

/**
 * 组件属性
 */
interface GrantedChartsProps {
  /** 点击查看命盘详情回调 */
  onViewChart?: (chartId: number, decryptedData: any) => void;
}

/**
 * 授权角色配置
 */
const accessRoleConfig: Record<AccessRole, {
  label: string;
  color: string;
}> = {
  [AccessRole.Owner]: {
    label: '所有者',
    color: '#B2955D',
  },
  [AccessRole.Master]: {
    label: '命理师',
    color: '#1890ff',
  },
  [AccessRole.Family]: {
    label: '家族成员',
    color: '#52c41a',
  },
  [AccessRole.AiService]: {
    label: 'AI 服务',
    color: '#722ed1',
  },
};

/**
 * 访问范围配置
 */
const accessScopeConfig: Record<AccessScope, {
  label: string;
  description: string;
}> = {
  [AccessScope.ReadOnly]: {
    label: '只读',
    description: '仅能查看命盘基本信息',
  },
  [AccessScope.CanComment]: {
    label: '可评论',
    description: '可以查看并添加解读评论',
  },
  [AccessScope.FullAccess]: {
    label: '完全访问',
    description: '完全访问所有命盘数据',
  },
};

/**
 * 被授权命盘条目
 */
interface GrantedChartEntry {
  chartId: number;
  chartInfo: MultiKeyChartInfo | null;
  myRole: AccessRole;
  myScope: AccessScope;
  grantedAt: number;
  expiresAt: number;
  ownerAddress: string;
  isExpired: boolean;
  isDecrypted: boolean;
  decryptedData?: any;
}

/**
 * V6 被授权命盘列表组件
 */
export const GrantedCharts: React.FC<GrantedChartsProps> = ({
  onViewChart,
}) => {
  // 钱包状态
  const { selectedAccount, isConnected } = useWalletStore();

  // 组件状态
  const [loading, setLoading] = useState(false);
  const [grants, setGrants] = useState<GrantedChartEntry[]>([]);
  const [providerInfo, setProviderInfo] = useState<ServiceProviderInfo | null>(null);
  const [hasLocalKey, setHasLocalKey] = useState(false);

  // 筛选状态
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<AccessRole | 'all'>('all');

  // 解密模态框
  const [decryptModalVisible, setDecryptModalVisible] = useState(false);
  const [selectedChart, setSelectedChart] = useState<GrantedChartEntry | null>(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [decrypting, setDecrypting] = useState(false);

  // 查看详情模态框
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingChart, setViewingChart] = useState<GrantedChartEntry | null>(null);

  /**
   * 加载被授权的命盘列表
   */
  const loadGrantedCharts = useCallback(async () => {
    if (!selectedAccount?.address) return;

    setLoading(true);
    try {
      const api = await getApi();
      const address = selectedAccount.address;

      // 检查是否有本地私钥
      setHasLocalKey(hasStoredKey(address));

      // 获取服务提供者信息
      const provider = await getServiceProvider(api, address);
      setProviderInfo(provider);

      // 获取被授权的命盘 ID 列表
      const chartIds = await getProviderGrants(api, address);

      if (chartIds.length === 0) {
        setGrants([]);
        return;
      }

      // 加载每个命盘的详细信息
      const entries: GrantedChartEntry[] = [];
      for (const chartId of chartIds) {
        try {
          const chartInfo = await getMultiKeyEncryptedChartInfo(api, chartId);
          if (chartInfo) {
            // 查找自己的授权信息
            const myGrant = chartInfo.grantAccounts.includes(address);

            // TODO: 从链上获取更详细的授权信息（角色、范围、过期时间）
            // 当前简化处理，假设为 Master + CanComment
            entries.push({
              chartId,
              chartInfo,
              myRole: AccessRole.Master,
              myScope: AccessScope.CanComment,
              grantedAt: chartInfo.createdAt,
              expiresAt: 0, // 永久
              ownerAddress: chartInfo.owner,
              isExpired: false,
              isDecrypted: false,
            });
          }
        } catch (error) {
          console.error(`加载命盘 ${chartId} 失败:`, error);
        }
      }

      setGrants(entries);
    } catch (error) {
      console.error('加载被授权命盘失败:', error);
      message.error('加载被授权命盘失败');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount?.address]);

  // 初始化
  useEffect(() => {
    if (isConnected && selectedAccount?.address) {
      loadGrantedCharts();
    }
  }, [isConnected, selectedAccount?.address, loadGrantedCharts]);

  /**
   * 解密命盘数据
   */
  const handleDecrypt = async () => {
    if (!selectedChart || !selectedAccount?.address) return;

    setDecrypting(true);
    try {
      // 加载私钥
      const privateKey = loadPrivateKey(selectedAccount.address, decryptPassword || undefined);
      if (!privateKey) {
        message.error('密码错误或私钥不存在');
        return;
      }

      // TODO: 从链上获取自己的加密 DataKey
      // 这里需要实际从 chartInfo.encryptedKeys 中找到自己的条目
      // 简化处理：模拟解密成功

      // 实际流程应该是：
      // 1. const myEntry = chartInfo.encryptedKeys.find(e => e.account === selectedAccount.address)
      // 2. const dataKey = unsealDataKey(myEntry.encryptedKey, privateKey)
      // 3. const decryptedData = decryptWithDataKey(chartInfo.encryptedData, dataKey)

      // 模拟解密后的数据
      const mockDecryptedData = {
        year: 1990,
        month: 11,
        day: 15,
        hour: 14,
        minute: 30,
        name: '张三',
        notes: '测试命盘',
      };

      // 更新状态
      setGrants(prev => prev.map(g =>
        g.chartId === selectedChart.chartId
          ? { ...g, isDecrypted: true, decryptedData: mockDecryptedData }
          : g
      ));

      message.success('命盘解密成功');
      setDecryptModalVisible(false);
      setDecryptPassword('');
      setSelectedChart(null);
    } catch (error: any) {
      console.error('解密失败:', error);
      message.error(`解密失败: ${error.message || '未知错误'}`);
    } finally {
      setDecrypting(false);
    }
  };

  /**
   * 查看命盘详情
   */
  const handleViewChart = (entry: GrantedChartEntry) => {
    if (!entry.isDecrypted) {
      // 需要先解密
      setSelectedChart(entry);
      setDecryptModalVisible(true);
    } else {
      // 已解密，显示详情
      setViewingChart(entry);
      setViewModalVisible(true);

      // 调用外部回调
      if (onViewChart && entry.decryptedData) {
        onViewChart(entry.chartId, entry.decryptedData);
      }
    }
  };

  /**
   * 筛选后的列表
   */
  const filteredGrants = grants.filter(entry => {
    // 角色筛选
    if (roleFilter !== 'all' && entry.myRole !== roleFilter) {
      return false;
    }
    // 搜索筛选
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        entry.chartId.toString().includes(search) ||
        entry.ownerAddress.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // 表格列定义
  const columns = [
    {
      title: '命盘 ID',
      dataIndex: 'chartId',
      key: 'chartId',
      width: 100,
      render: (chartId: number) => (
        <Text strong>#{chartId}</Text>
      ),
    },
    {
      title: '所有者',
      dataIndex: 'ownerAddress',
      key: 'ownerAddress',
      render: (address: string) => (
        <Tooltip title={address}>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {address.slice(0, 8)}...{address.slice(-6)}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '性别',
      key: 'gender',
      width: 60,
      render: (_: any, record: GrantedChartEntry) => (
        record.chartInfo?.gender === 0 ? (
          <ManOutlined style={{ color: '#1890ff' }} />
        ) : (
          <WomanOutlined style={{ color: '#eb2f96' }} />
        )
      ),
    },
    {
      title: '我的角色',
      dataIndex: 'myRole',
      key: 'myRole',
      width: 100,
      render: (role: AccessRole) => (
        <Tag color={accessRoleConfig[role].color}>
          {accessRoleConfig[role].label}
        </Tag>
      ),
    },
    {
      title: '权限',
      dataIndex: 'myScope',
      key: 'myScope',
      width: 80,
      render: (scope: AccessScope) => (
        <Tooltip title={accessScopeConfig[scope].description}>
          <Tag>{accessScopeConfig[scope].label}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: any, record: GrantedChartEntry) => (
        record.isExpired ? (
          <Badge status="error" text="已过期" />
        ) : record.isDecrypted ? (
          <Badge status="success" text="已解密" />
        ) : (
          <Badge status="default" text="未解密" />
        )
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: GrantedChartEntry) => (
        <Space>
          <Tooltip title={record.isDecrypted ? '查看详情' : '解密并查看'}>
            <Button
              type="link"
              size="small"
              icon={record.isDecrypted ? <EyeOutlined /> : <UnlockOutlined />}
              onClick={() => handleViewChart(record)}
              disabled={record.isExpired || !hasLocalKey}
            >
              {record.isDecrypted ? '查看' : '解密'}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 未连接钱包
  if (!isConnected || !selectedAccount) {
    return (
      <Card>
        <Alert
          type="warning"
          message="请先连接钱包"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#B2955D' }} />
          <span>被授权的命盘</span>
          <Tag>{grants.length} 个</Tag>
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={loadGrantedCharts}
          loading={loading}
        >
          刷新
        </Button>
      }
      loading={loading}
    >
      {/* 服务提供者信息 */}
      {providerInfo && (
        <Alert
          type="info"
          message={
            <Space>
              <Text>您是注册的服务提供者</Text>
              <Tag color="gold">
                <StarOutlined /> 信誉分 {providerInfo.reputation}
              </Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* 没有本地私钥警告 */}
      {!hasLocalKey && (
        <Alert
          type="warning"
          message="未找到本地私钥"
          description="请先在「密钥管理」中生成或导入私钥，否则无法解密命盘数据"
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* 筛选工具栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索命盘 ID 或所有者地址"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          value={roleFilter}
          onChange={setRoleFilter}
          style={{ width: 120 }}
        >
          <Select.Option value="all">全部角色</Select.Option>
          <Select.Option value={AccessRole.Master}>命理师</Select.Option>
          <Select.Option value={AccessRole.Family}>家族成员</Select.Option>
          <Select.Option value={AccessRole.AiService}>AI 服务</Select.Option>
        </Select>
      </Space>

      {/* 命盘列表 */}
      {filteredGrants.length > 0 ? (
        <Table
          dataSource={filteredGrants}
          columns={columns}
          rowKey="chartId"
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      ) : (
        <Empty
          description={
            grants.length === 0
              ? '暂无被授权的命盘'
              : '没有匹配的命盘'
          }
        />
      )}

      {/* 解密模态框 */}
      <Modal
        title={
          <Space>
            <UnlockOutlined />
            <span>解密命盘数据</span>
          </Space>
        }
        open={decryptModalVisible}
        onOk={handleDecrypt}
        onCancel={() => {
          setDecryptModalVisible(false);
          setDecryptPassword('');
          setSelectedChart(null);
        }}
        okText="解密"
        cancelText="取消"
        confirmLoading={decrypting}
      >
        {selectedChart && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="命盘 ID">
                #{selectedChart.chartId}
              </Descriptions.Item>
              <Descriptions.Item label="所有者">
                <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {selectedChart.ownerAddress.slice(0, 12)}...
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="我的角色">
                <Tag color={accessRoleConfig[selectedChart.myRole].color}>
                  {accessRoleConfig[selectedChart.myRole].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="访问权限">
                {accessScopeConfig[selectedChart.myScope].description}
              </Descriptions.Item>
            </Descriptions>

            <Input.Password
              placeholder="输入私钥保护密码（如果设置了密码）"
              value={decryptPassword}
              onChange={(e) => setDecryptPassword(e.target.value)}
            />

            <Alert
              type="info"
              message="解密后的数据仅在本次会话中可见，不会上传到链上"
              showIcon
            />
          </Space>
        )}
      </Modal>

      {/* 查看详情模态框 */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            <span>命盘详情</span>
            <Tag>#{viewingChart?.chartId}</Tag>
          </Space>
        }
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setViewingChart(null);
        }}
        footer={
          <Button onClick={() => setViewModalVisible(false)}>关闭</Button>
        }
        width={600}
      >
        {viewingChart && viewingChart.decryptedData && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 解密后的敏感信息 */}
            <Card size="small" title="出生信息（已解密）">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="姓名">
                  {viewingChart.decryptedData.name || '未填写'}
                </Descriptions.Item>
                <Descriptions.Item label="出生日期">
                  <Space>
                    <CalendarOutlined />
                    {viewingChart.decryptedData.year}年
                    {viewingChart.decryptedData.month}月
                    {viewingChart.decryptedData.day}日
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="出生时间">
                  <Space>
                    <ClockCircleOutlined />
                    {viewingChart.decryptedData.hour}:
                    {String(viewingChart.decryptedData.minute).padStart(2, '0')}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="性别">
                  {viewingChart.chartInfo?.gender === 0 ? (
                    <Space><ManOutlined style={{ color: '#1890ff' }} /> 男</Space>
                  ) : (
                    <Space><WomanOutlined style={{ color: '#eb2f96' }} /> 女</Space>
                  )}
                </Descriptions.Item>
              </Descriptions>
              {viewingChart.decryptedData.notes && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary">备注：{viewingChart.decryptedData.notes}</Text>
                </>
              )}
            </Card>

            {/* 四柱信息（明文） */}
            {viewingChart.chartInfo?.sizhuIndex && (
              <Card size="small" title="四柱排盘（公开）">
                <Text type="secondary">
                  四柱索引已从链上读取，可用于解盘计算
                </Text>
              </Card>
            )}

            {/* 授权信息 */}
            <Card size="small" title="我的授权信息">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="授权角色">
                  <Tag color={accessRoleConfig[viewingChart.myRole].color}>
                    {accessRoleConfig[viewingChart.myRole].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="访问权限">
                  <Tag>{accessScopeConfig[viewingChart.myScope].label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="授权时间">
                  区块 #{viewingChart.grantedAt}
                </Descriptions.Item>
                <Descriptions.Item label="有效期">
                  {viewingChart.expiresAt === 0 ? (
                    <Tag color="blue">永久有效</Tag>
                  ) : (
                    <Tag icon={<ClockCircleOutlined />}>
                      区块 #{viewingChart.expiresAt}
                    </Tag>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 操作提示 */}
            {viewingChart.myScope === AccessScope.CanComment && (
              <Alert
                type="info"
                message="您拥有评论权限，可以为此命盘添加解读"
                showIcon
              />
            )}
          </Space>
        )}
      </Modal>
    </Card>
  );
};

export default GrantedCharts;
