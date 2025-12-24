/**
 * V6 服务提供者注册组件
 *
 * 允许用户注册为不同类型的服务提供者：
 * - 命理师 (MingLiShi)
 * - AI 服务 (AiService)
 * - 家族成员 (FamilyMember)
 * - 研究机构 (Research)
 *
 * 注册后可以接收用户授权访问加密命盘
 *
 * @module features/bazi/components/v6/ProviderRegistration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Radio,
  Modal,
  message,
  Tag,
  Descriptions,
  Spin,
  Alert,
  Switch,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
  TeamOutlined,
  RobotOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useWalletStore } from '../../../../store/walletStore';
import { getApi } from '../../../../lib/polkadot';
import {
  ServiceProviderType,
  hasStoredKey,
} from '../../../../services/multiKeyEncryption';
import {
  registerProvider,
  getServiceProvider,
  setProviderActive,
  unregisterProvider,
  getProviderGrants,
  getUserEncryptionKey,
  type ServiceProviderInfo,
} from '../../../../services/baziChainService';

const { Text, Paragraph } = Typography;

/**
 * 组件属性
 */
interface ProviderRegistrationProps {
  /** 紧凑模式 */
  compact?: boolean;
  /** 注册成功回调 */
  onRegistered?: (providerType: ServiceProviderType) => void;
}

/**
 * 服务提供者类型配置
 */
const providerTypeConfig: Record<ServiceProviderType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> = {
  [ServiceProviderType.MingLiShi]: {
    label: '命理师',
    icon: <StarOutlined />,
    color: '#B2955D',
    description: '专业命理师，提供人工解读服务',
  },
  [ServiceProviderType.AiService]: {
    label: 'AI 服务',
    icon: <RobotOutlined />,
    color: '#1890ff',
    description: 'AI 自动解读服务',
  },
  [ServiceProviderType.FamilyMember]: {
    label: '家族成员',
    icon: <TeamOutlined />,
    color: '#52c41a',
    description: '家族内部成员，非商业用途',
  },
  [ServiceProviderType.Research]: {
    label: '研究机构',
    icon: <ExperimentOutlined />,
    color: '#722ed1',
    description: '学术研究机构',
  },
};

/**
 * V6 服务提供者注册组件
 *
 * 用于注册和管理服务提供者身份
 */
export const ProviderRegistration: React.FC<ProviderRegistrationProps> = ({
  compact = false,
  onRegistered,
}) => {
  // 钱包状态
  const { selectedAccount, isConnected } = useWalletStore();

  // 组件状态
  const [loading, setLoading] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ServiceProviderInfo | null>(null);
  const [grantsCount, setGrantsCount] = useState(0);
  const [hasEncryptionKey, setHasEncryptionKey] = useState(false);

  // 注册模态框状态
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<ServiceProviderType>(ServiceProviderType.MingLiShi);

  /**
   * 检查提供者状态
   */
  const checkProviderStatus = useCallback(async () => {
    if (!selectedAccount?.address) return;

    setLoading(true);
    try {
      const api = await getApi();
      const address = selectedAccount.address;

      // 检查是否已注册加密公钥
      const encKey = await getUserEncryptionKey(api, address);
      setHasEncryptionKey(!!encKey);

      // 获取提供者信息
      const info = await getServiceProvider(api, address);
      setProviderInfo(info);

      // 获取授权数量
      if (info) {
        const grants = await getProviderGrants(api, address);
        setGrantsCount(grants.length);
      }
    } catch (error) {
      console.error('检查提供者状态失败:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount?.address]);

  // 初始化
  useEffect(() => {
    if (isConnected && selectedAccount?.address) {
      checkProviderStatus();
    }
  }, [isConnected, selectedAccount?.address, checkProviderStatus]);

  /**
   * 注册为服务提供者
   */
  const handleRegister = async () => {
    if (!selectedAccount?.address) return;

    // 检查是否有加密公钥
    if (!hasEncryptionKey) {
      message.error('请先注册加密公钥');
      return;
    }

    setLoading(true);
    try {
      const api = await getApi();

      // 获取现有公钥用于注册
      const publicKey = await getUserEncryptionKey(api, selectedAccount.address);
      if (!publicKey) {
        message.error('未找到加密公钥，请先注册密钥');
        return;
      }

      // 注册提供者
      const tx = registerProvider(api, selectedType, publicKey);

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

      message.success('服务提供者注册成功');
      setRegisterModalVisible(false);
      await checkProviderStatus();
      onRegistered?.(selectedType);
    } catch (error: any) {
      console.error('注册服务提供者失败:', error);
      message.error(`注册失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 切换激活状态
   */
  const handleToggleActive = async (active: boolean) => {
    if (!selectedAccount?.address) return;

    setLoading(true);
    try {
      const api = await getApi();
      const tx = setProviderActive(api, active);

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

      message.success(active ? '已激活' : '已暂停');
      await checkProviderStatus();
    } catch (error: any) {
      console.error('切换状态失败:', error);
      message.error(`操作失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 注销提供者
   */
  const handleUnregister = () => {
    Modal.confirm({
      title: '确认注销',
      content: '注销后您将无法接收新的授权。已有的授权不会被撤销，但您将无法查看提供者列表中的身份。',
      okText: '确认注销',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!selectedAccount?.address) return;

        setLoading(true);
        try {
          const api = await getApi();
          const tx = unregisterProvider(api);

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

          message.success('已注销服务提供者身份');
          await checkProviderStatus();
        } catch (error: any) {
          console.error('注销失败:', error);
          message.error(`注销失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 未连接钱包
  if (!isConnected || !selectedAccount) {
    return (
      <Card size="small">
        <Alert
          type="warning"
          message="请先连接钱包"
          showIcon
        />
      </Card>
    );
  }

  // 紧凑模式
  if (compact) {
    return (
      <Card size="small" loading={loading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <SafetyCertificateOutlined style={{ color: '#B2955D' }} />
            <Text strong>服务提供者</Text>
            {providerInfo ? (
              <Tag color={providerTypeConfig[providerInfo.providerType].color}>
                {providerTypeConfig[providerInfo.providerType].label}
              </Tag>
            ) : (
              <Tag>未注册</Tag>
            )}
          </Space>
          {!providerInfo && hasEncryptionKey && (
            <Button
              type="primary"
              size="small"
              icon={<UserOutlined />}
              onClick={() => setRegisterModalVisible(true)}
            >
              注册为服务提供者
            </Button>
          )}
        </Space>
      </Card>
    );
  }

  // 完整模式
  return (
    <Card
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#B2955D' }} />
          <span>服务提供者管理</span>
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={checkProviderStatus}
          loading={loading}
        >
          刷新
        </Button>
      }
      loading={loading}
    >
      {providerInfo ? (
        // 已注册：显示提供者信息
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="服务类型">
              <Tag
                color={providerTypeConfig[providerInfo.providerType].color}
                icon={providerTypeConfig[providerInfo.providerType].icon}
              >
                {providerTypeConfig[providerInfo.providerType].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Space>
                {providerInfo.isActive ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>活跃</Tag>
                ) : (
                  <Tag color="default" icon={<CloseCircleOutlined />}>暂停</Tag>
                )}
                <Switch
                  checked={providerInfo.isActive}
                  onChange={handleToggleActive}
                  size="small"
                />
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="信誉分">
              <Space>
                <StarOutlined style={{ color: '#faad14' }} />
                <Text strong>{providerInfo.reputation}</Text>
                <Text type="secondary">/ 100</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="注册区块">
              #{providerInfo.registeredAt}
            </Descriptions.Item>
          </Descriptions>

          <Row gutter={16}>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="被授权命盘"
                  value={grantsCount}
                  suffix="个"
                  valueStyle={{ color: '#B2955D' }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="信誉评分"
                  value={providerInfo.reputation}
                  suffix="/ 100"
                  valueStyle={{ color: providerInfo.reputation >= 80 ? '#52c41a' : providerInfo.reputation >= 50 ? '#faad14' : '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleUnregister}
          >
            注销服务提供者身份
          </Button>
        </Space>
      ) : (
        // 未注册：显示注册入口
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {!hasEncryptionKey ? (
            <Alert
              type="warning"
              message="需要先注册加密公钥"
              description="注册为服务提供者前，请先在「密钥管理」中生成并注册加密公钥"
              showIcon
            />
          ) : (
            <>
              <Alert
                type="info"
                message="成为服务提供者"
                description="注册后，用户可以授权您访问其加密命盘数据。您将出现在对应类型的服务提供者列表中。"
                showIcon
              />
              <Button
                type="primary"
                icon={<UserOutlined />}
                onClick={() => setRegisterModalVisible(true)}
                block
              >
                注册为服务提供者
              </Button>
            </>
          )}
        </Space>
      )}

      {/* 注册模态框 */}
      <Modal
        title="注册为服务提供者"
        open={registerModalVisible}
        onOk={handleRegister}
        onCancel={() => setRegisterModalVisible(false)}
        okText="注册"
        cancelText="取消"
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text>选择您的服务类型：</Text>
          <Radio.Group
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(providerTypeConfig).map(([type, config]) => (
                <Radio
                  key={type}
                  value={Number(type)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <Space>
                    <span style={{ color: config.color }}>{config.icon}</span>
                    <span>
                      <Text strong>{config.label}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {config.description}
                      </Text>
                    </span>
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>

          <Alert
            type="info"
            message="初始信誉分为 50 分，通过优质服务可以提升"
            showIcon
          />
        </Space>
      </Modal>
    </Card>
  );
};

export default ProviderRegistration;
