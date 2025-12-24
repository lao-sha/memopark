/**
 * V6 命盘授权管理组件
 *
 * 允许命盘所有者管理对其加密命盘的访问授权：
 * - 查看当前授权列表
 * - 添加新的授权方（选择提供者或输入地址）
 * - 撤销单个授权
 * - 撤销所有授权（紧急情况）
 * - 设置授权过期时间
 *
 * @module features/bazi/components/v6/ChartAuthorization
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
  Select,
  Input,
  DatePicker,
  Empty,
  Tooltip,
  Popconfirm,
  Alert,
  Form,
  Radio,
  Spin,
  List,
  Avatar,
} from 'antd';
import {
  ShareAltOutlined,
  UserAddOutlined,
  DeleteOutlined,
  StopOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StarOutlined,
  TeamOutlined,
  RobotOutlined,
  ExperimentOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useWalletStore } from '../../../../store/walletStore';
import { getApi } from '../../../../lib/polkadot';
import {
  AccessRole,
  AccessScope,
  ServiceProviderType,
  sealDataKey,
  loadPrivateKey,
  unsealDataKey,
} from '../../../../services/multiKeyEncryption';
import {
  grantChartAccess,
  revokeChartAccess,
  revokeAllChartAccess,
  getMultiKeyEncryptedChartInfo,
  getProvidersByType,
  getServiceProvider,
  getUserEncryptionKey,
  type MultiKeyChartInfo,
  type ServiceProviderInfo,
} from '../../../../services/baziChainService';

const { Text, Paragraph } = Typography;

/**
 * 组件属性
 */
interface ChartAuthorizationProps {
  /** 命盘 ID */
  chartId: number;
  /** 授权变更回调 */
  onAuthorizationChanged?: () => void;
}

/**
 * 授权角色配置
 */
const accessRoleConfig: Record<AccessRole, {
  label: string;
  color: string;
  description: string;
}> = {
  [AccessRole.Owner]: {
    label: '所有者',
    color: '#B2955D',
    description: '命盘所有者，不可撤销',
  },
  [AccessRole.Master]: {
    label: '命理师',
    color: '#1890ff',
    description: '专业命理师，可解读命盘',
  },
  [AccessRole.Family]: {
    label: '家族成员',
    color: '#52c41a',
    description: '家族内部成员',
  },
  [AccessRole.AiService]: {
    label: 'AI 服务',
    color: '#722ed1',
    description: 'AI 自动解读服务',
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
 * 服务提供者类型图标
 */
const providerTypeIcon: Record<ServiceProviderType, React.ReactNode> = {
  [ServiceProviderType.MingLiShi]: <StarOutlined style={{ color: '#B2955D' }} />,
  [ServiceProviderType.AiService]: <RobotOutlined style={{ color: '#1890ff' }} />,
  [ServiceProviderType.FamilyMember]: <TeamOutlined style={{ color: '#52c41a' }} />,
  [ServiceProviderType.Research]: <ExperimentOutlined style={{ color: '#722ed1' }} />,
};

/**
 * 授权条目（解析后）
 */
interface GrantEntry {
  account: string;
  role: AccessRole;
  scope: AccessScope;
  grantedAt: number;
  expiresAt: number;
  isOwner: boolean;
}

/**
 * V6 命盘授权管理组件
 */
export const ChartAuthorization: React.FC<ChartAuthorizationProps> = ({
  chartId,
  onAuthorizationChanged,
}) => {
  // 钱包状态
  const { selectedAccount, isConnected } = useWalletStore();

  // 组件状态
  const [loading, setLoading] = useState(false);
  const [chartInfo, setChartInfo] = useState<MultiKeyChartInfo | null>(null);
  const [grants, setGrants] = useState<GrantEntry[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  // 添加授权模态框
  const [grantModalVisible, setGrantModalVisible] = useState(false);
  const [grantForm] = Form.useForm();
  const [grantMethod, setGrantMethod] = useState<'provider' | 'address'>('provider');
  const [selectedProviderType, setSelectedProviderType] = useState<ServiceProviderType>(ServiceProviderType.MingLiShi);
  const [providerList, setProviderList] = useState<Array<{ address: string; info: ServiceProviderInfo }>>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  /**
   * 加载命盘授权信息
   */
  const loadChartInfo = useCallback(async () => {
    if (!chartId) return;

    setLoading(true);
    try {
      const api = await getApi();
      const info = await getMultiKeyEncryptedChartInfo(api, chartId);

      if (info) {
        setChartInfo(info);

        // 检查是否是所有者
        if (selectedAccount?.address) {
          setIsOwner(info.owner === selectedAccount.address);
        }

        // 模拟授权列表（实际应该从链上获取详细信息）
        // TODO: 实现更完整的授权信息查询
        const mockGrants: GrantEntry[] = info.grantAccounts.map((account, index) => ({
          account,
          role: index === 0 ? AccessRole.Owner : AccessRole.Master,
          scope: index === 0 ? AccessScope.FullAccess : AccessScope.CanComment,
          grantedAt: info.createdAt,
          expiresAt: 0,
          isOwner: account === info.owner,
        }));

        setGrants(mockGrants);
      }
    } catch (error) {
      console.error('加载命盘信息失败:', error);
      message.error('加载命盘信息失败');
    } finally {
      setLoading(false);
    }
  }, [chartId, selectedAccount?.address]);

  // 初始化
  useEffect(() => {
    if (isConnected && chartId) {
      loadChartInfo();
    }
  }, [isConnected, chartId, loadChartInfo]);

  /**
   * 加载服务提供者列表
   */
  const loadProviders = useCallback(async (type: ServiceProviderType) => {
    setLoadingProviders(true);
    try {
      const api = await getApi();
      const addresses = await getProvidersByType(api, type);

      const providers: Array<{ address: string; info: ServiceProviderInfo }> = [];
      for (const address of addresses.slice(0, 20)) {
        const info = await getServiceProvider(api, address);
        if (info && info.isActive) {
          providers.push({ address, info });
        }
      }

      // 按信誉分排序
      providers.sort((a, b) => b.info.reputation - a.info.reputation);
      setProviderList(providers);
    } catch (error) {
      console.error('加载服务提供者列表失败:', error);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  // 选择提供者类型时加载列表
  useEffect(() => {
    if (grantModalVisible && grantMethod === 'provider') {
      loadProviders(selectedProviderType);
    }
  }, [grantModalVisible, grantMethod, selectedProviderType, loadProviders]);

  /**
   * 添加授权
   */
  const handleGrantAccess = async () => {
    try {
      const values = await grantForm.validateFields();
      const { granteeAddress, role, scope, expiresAt } = values;

      if (!selectedAccount?.address) {
        message.error('请先连接钱包');
        return;
      }

      setLoading(true);

      const api = await getApi();

      // 获取被授权方的公钥
      const granteePublicKey = await getUserEncryptionKey(api, granteeAddress);
      if (!granteePublicKey) {
        message.error('被授权方未注册加密公钥，无法授权');
        return;
      }

      // 获取自己的私钥解密 DataKey（需要用户输入密码）
      // 简化实现：假设私钥未加密
      const myPrivateKey = loadPrivateKey(selectedAccount.address);
      if (!myPrivateKey) {
        message.error('未找到本地私钥，无法授权');
        return;
      }

      // TODO: 从链上获取自己的加密 DataKey，解密后重新加密给被授权方
      // 这里简化处理，生成一个新的密钥（实际应该使用相同的 DataKey）
      const mockDataKey = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(mockDataKey);
      }

      // 为被授权方封装 DataKey
      const sealedKey = sealDataKey(mockDataKey, granteePublicKey);

      // 计算过期区块号
      let expiresAtBlock = 0;
      if (expiresAt) {
        // 假设 6 秒一个区块
        const now = Date.now();
        const expireTime = expiresAt.valueOf();
        const seconds = Math.floor((expireTime - now) / 1000);
        const blocks = Math.floor(seconds / 6);
        // TODO: 获取当前区块号并加上 blocks
        expiresAtBlock = blocks;
      }

      // 发送授权交易
      const tx = grantChartAccess(
        api,
        chartId,
        granteeAddress,
        sealedKey,
        role,
        scope,
        expiresAtBlock
      );

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: (window as any).injectedWeb3?.['polkadot-js']?.signer },
          ({ status, dispatchError }) => {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
              return;
            }
            if (status.isInBlock || status.isFinalized) {
              resolve();
            }
          }
        ).catch(reject);
      });

      message.success('授权成功');
      setGrantModalVisible(false);
      grantForm.resetFields();
      await loadChartInfo();
      onAuthorizationChanged?.();
    } catch (error: any) {
      console.error('授权失败:', error);
      message.error(`授权失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 撤销单个授权
   */
  const handleRevokeAccess = async (account: string) => {
    if (!selectedAccount?.address) return;

    setLoading(true);
    try {
      const api = await getApi();
      const tx = revokeChartAccess(api, chartId, account);

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          selectedAccount.address,
          { signer: (window as any).injectedWeb3?.['polkadot-js']?.signer },
          ({ status, dispatchError }) => {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                reject(new Error(`${decoded.section}.${decoded.name}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
              return;
            }
            if (status.isInBlock || status.isFinalized) {
              resolve();
            }
          }
        ).catch(reject);
      });

      message.success('已撤销授权');
      await loadChartInfo();
      onAuthorizationChanged?.();
    } catch (error: any) {
      console.error('撤销授权失败:', error);
      message.error(`撤销失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 撤销所有授权
   */
  const handleRevokeAll = () => {
    Modal.confirm({
      title: '撤销所有授权',
      icon: <ExclamationCircleOutlined />,
      content: '此操作将撤销除所有者外的所有授权。被撤销方将无法再访问您的加密命盘数据。确定继续吗？',
      okText: '确认撤销',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!selectedAccount?.address) return;

        setLoading(true);
        try {
          const api = await getApi();
          const tx = revokeAllChartAccess(api, chartId);

          await new Promise<void>((resolve, reject) => {
            tx.signAndSend(
              selectedAccount.address,
              { signer: (window as any).injectedWeb3?.['polkadot-js']?.signer },
              ({ status, dispatchError }) => {
                if (dispatchError) {
                  if (dispatchError.isModule) {
                    const decoded = api.registry.findMetaError(dispatchError.asModule);
                    reject(new Error(`${decoded.section}.${decoded.name}`));
                  } else {
                    reject(new Error(dispatchError.toString()));
                  }
                  return;
                }
                if (status.isInBlock || status.isFinalized) {
                  resolve();
                }
              }
            ).catch(reject);
          });

          message.success('已撤销所有授权');
          await loadChartInfo();
          onAuthorizationChanged?.();
        } catch (error: any) {
          console.error('撤销所有授权失败:', error);
          message.error(`撤销失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '账户',
      dataIndex: 'account',
      key: 'account',
      render: (account: string, record: GrantEntry) => (
        <Space>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {account.slice(0, 8)}...{account.slice(-6)}
          </Text>
          {record.isOwner && <Tag color="gold">所有者</Tag>}
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: AccessRole) => (
        <Tag color={accessRoleConfig[role].color}>
          {accessRoleConfig[role].label}
        </Tag>
      ),
    },
    {
      title: '权限',
      dataIndex: 'scope',
      key: 'scope',
      render: (scope: AccessScope) => (
        <Tooltip title={accessScopeConfig[scope].description}>
          <Tag>{accessScopeConfig[scope].label}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '过期',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (expiresAt: number) => (
        expiresAt === 0 ? (
          <Tag color="blue">永久</Tag>
        ) : (
          <Tag icon={<ClockCircleOutlined />}>区块 #{expiresAt}</Tag>
        )
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: GrantEntry) => (
        record.isOwner ? (
          <Text type="secondary">-</Text>
        ) : (
          <Popconfirm
            title="确认撤销此授权？"
            onConfirm={() => handleRevokeAccess(record.account)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!isOwner}
            >
              撤销
            </Button>
          </Popconfirm>
        )
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
          <ShareAltOutlined style={{ color: '#B2955D' }} />
          <span>授权管理</span>
          <Tag>{grants.length} 个授权</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={loadChartInfo}
            loading={loading}
          >
            刷新
          </Button>
          {isOwner && (
            <>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                size="small"
                onClick={() => setGrantModalVisible(true)}
                disabled={grants.length >= 10}
              >
                添加授权
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                size="small"
                onClick={handleRevokeAll}
                disabled={grants.length <= 1}
              >
                撤销全部
              </Button>
            </>
          )}
        </Space>
      }
      loading={loading}
    >
      {!isOwner && (
        <Alert
          type="info"
          message="仅所有者可以管理授权"
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {grants.length > 0 ? (
        <Table
          dataSource={grants}
          columns={columns}
          rowKey="account"
          size="small"
          pagination={false}
        />
      ) : (
        <Empty description="暂无授权记录" />
      )}

      {/* 添加授权模态框 */}
      <Modal
        title="添加授权"
        open={grantModalVisible}
        onOk={handleGrantAccess}
        onCancel={() => {
          setGrantModalVisible(false);
          grantForm.resetFields();
        }}
        okText="授权"
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={grantForm}
          layout="vertical"
          initialValues={{
            role: AccessRole.Master,
            scope: AccessScope.CanComment,
          }}
        >
          {/* 授权方式选择 */}
          <Form.Item label="授权方式">
            <Radio.Group
              value={grantMethod}
              onChange={(e) => setGrantMethod(e.target.value)}
            >
              <Radio value="provider">选择服务提供者</Radio>
              <Radio value="address">输入地址</Radio>
            </Radio.Group>
          </Form.Item>

          {grantMethod === 'provider' ? (
            <>
              {/* 服务类型选择 */}
              <Form.Item label="服务类型">
                <Select
                  value={selectedProviderType}
                  onChange={setSelectedProviderType}
                >
                  <Select.Option value={ServiceProviderType.MingLiShi}>
                    <Space>
                      <StarOutlined style={{ color: '#B2955D' }} />
                      命理师
                    </Space>
                  </Select.Option>
                  <Select.Option value={ServiceProviderType.AiService}>
                    <Space>
                      <RobotOutlined style={{ color: '#1890ff' }} />
                      AI 服务
                    </Space>
                  </Select.Option>
                  <Select.Option value={ServiceProviderType.FamilyMember}>
                    <Space>
                      <TeamOutlined style={{ color: '#52c41a' }} />
                      家族成员
                    </Space>
                  </Select.Option>
                  <Select.Option value={ServiceProviderType.Research}>
                    <Space>
                      <ExperimentOutlined style={{ color: '#722ed1' }} />
                      研究机构
                    </Space>
                  </Select.Option>
                </Select>
              </Form.Item>

              {/* 服务提供者列表 */}
              <Form.Item
                name="granteeAddress"
                label="选择服务提供者"
                rules={[{ required: true, message: '请选择服务提供者' }]}
              >
                <Spin spinning={loadingProviders}>
                  {providerList.length > 0 ? (
                    <List
                      size="small"
                      bordered
                      style={{ maxHeight: 200, overflow: 'auto' }}
                      dataSource={providerList}
                      renderItem={(item) => (
                        <List.Item
                          style={{ cursor: 'pointer' }}
                          onClick={() => grantForm.setFieldValue('granteeAddress', item.address)}
                        >
                          <List.Item.Meta
                            avatar={
                              <Avatar
                                icon={providerTypeIcon[item.info.providerType]}
                                style={{ backgroundColor: '#f0f0f0' }}
                              />
                            }
                            title={
                              <Space>
                                <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                  {item.address.slice(0, 12)}...
                                </Text>
                                <Tag color="gold">
                                  <StarOutlined /> {item.info.reputation}
                                </Tag>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="暂无可用的服务提供者" />
                  )}
                </Spin>
              </Form.Item>
            </>
          ) : (
            <Form.Item
              name="granteeAddress"
              label="被授权方地址"
              rules={[{ required: true, message: '请输入被授权方地址' }]}
            >
              <Input placeholder="输入 Substrate 账户地址" />
            </Form.Item>
          )}

          {/* 授权角色 */}
          <Form.Item
            name="role"
            label="授权角色"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={AccessRole.Master}>
                <Space>
                  <Tag color={accessRoleConfig[AccessRole.Master].color}>
                    {accessRoleConfig[AccessRole.Master].label}
                  </Tag>
                  <Text type="secondary">{accessRoleConfig[AccessRole.Master].description}</Text>
                </Space>
              </Select.Option>
              <Select.Option value={AccessRole.Family}>
                <Space>
                  <Tag color={accessRoleConfig[AccessRole.Family].color}>
                    {accessRoleConfig[AccessRole.Family].label}
                  </Tag>
                  <Text type="secondary">{accessRoleConfig[AccessRole.Family].description}</Text>
                </Space>
              </Select.Option>
              <Select.Option value={AccessRole.AiService}>
                <Space>
                  <Tag color={accessRoleConfig[AccessRole.AiService].color}>
                    {accessRoleConfig[AccessRole.AiService].label}
                  </Tag>
                  <Text type="secondary">{accessRoleConfig[AccessRole.AiService].description}</Text>
                </Space>
              </Select.Option>
            </Select>
          </Form.Item>

          {/* 访问范围 */}
          <Form.Item
            name="scope"
            label="访问范围"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value={AccessScope.ReadOnly}>
                {accessScopeConfig[AccessScope.ReadOnly].label} - {accessScopeConfig[AccessScope.ReadOnly].description}
              </Select.Option>
              <Select.Option value={AccessScope.CanComment}>
                {accessScopeConfig[AccessScope.CanComment].label} - {accessScopeConfig[AccessScope.CanComment].description}
              </Select.Option>
              <Select.Option value={AccessScope.FullAccess}>
                {accessScopeConfig[AccessScope.FullAccess].label} - {accessScopeConfig[AccessScope.FullAccess].description}
              </Select.Option>
            </Select>
          </Form.Item>

          {/* 过期时间 */}
          <Form.Item
            name="expiresAt"
            label="过期时间（可选）"
            extra="不设置则永久有效"
          >
            <DatePicker
              showTime
              placeholder="选择过期时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>

        <Alert
          type="info"
          message="授权后，被授权方可以使用其私钥解密您的命盘数据"
          showIcon
        />
      </Modal>
    </Card>
  );
};

export default ChartAuthorization;
