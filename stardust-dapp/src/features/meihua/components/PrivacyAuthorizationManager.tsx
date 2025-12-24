/**
 * 隐私授权管理组件
 *
 * 用于管理卦象的隐私数据授权：
 * - 显示当前隐私状态
 * - 查看已授权用户列表
 * - 添加/撤销授权
 * - 解密查看隐私数据（所有者）
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Card,
  List,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Divider,
  message,
  Spin,
  Empty,
  Popconfirm,
  Tooltip,
  Alert,
  Form,
  DatePicker,
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  SafetyOutlined,
  UserAddOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  KeyOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  PrivacyMode,
  AccessRole,
  AccessScope,
  MeihuaPrivacyUtils,
  getEncryptedRecord,
  getRecordAuthorizations,
  getUserEncryptionKey,
  grantAccess,
  revokeAccess,
  decryptRecordData,
  prepareKeyForGrantee,
  type EncryptedRecordInfo,
  type AuthorizationEntry,
  type DivinerPrivateData,
  bytesToHex,
  hexToBytes,
} from '../../../services/meihuaPrivacyService';

const { Text, Paragraph } = Typography;

/** 隐私模式显示配置 */
const PRIVACY_MODE_CONFIG = {
  [PrivacyMode.Public]: {
    label: '公开',
    icon: <UnlockOutlined />,
    color: 'green',
    desc: '所有人可见',
  },
  [PrivacyMode.Private]: {
    label: '私密',
    icon: <LockOutlined />,
    color: 'red',
    desc: '仅自己可见',
  },
  [PrivacyMode.Authorized]: {
    label: '授权访问',
    icon: <SafetyOutlined />,
    color: 'blue',
    desc: '授权后可见',
  },
};

/** 访问角色显示配置 */
const ACCESS_ROLE_CONFIG = {
  [AccessRole.Owner]: { label: '所有者', color: 'gold' },
  [AccessRole.FamilyMember]: { label: '家族成员', color: 'purple' },
  [AccessRole.Master]: { label: '大师', color: 'blue' },
  [AccessRole.AI]: { label: 'AI', color: 'cyan' },
  [AccessRole.BountyAnswerer]: { label: '悬赏回答者', color: 'orange' },
};

/** 访问范围显示配置 */
const ACCESS_SCOPE_CONFIG = {
  [AccessScope.ReadOnly]: { label: '只读', color: 'default' },
  [AccessScope.WriteOnly]: { label: '只写', color: 'warning' },
  [AccessScope.FullAccess]: { label: '完全访问', color: 'success' },
};

/** 密钥存储键名 */
const KEY_STORAGE_PREFIX = 'stardust_meihua_x25519_';

interface PrivacyAuthorizationManagerProps {
  /** 卦象 ID */
  hexagramId: number;
  /** 当前用户地址 */
  currentAddress?: string;
  /** 是否为所有者 */
  isOwner: boolean;
  /** 是否显示弹窗 */
  visible: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

/**
 * 隐私授权管理组件
 */
const PrivacyAuthorizationManager: React.FC<PrivacyAuthorizationManagerProps> = ({
  hexagramId,
  currentAddress,
  isOwner,
  visible,
  onClose,
}) => {
  // 状态
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState<EncryptedRecordInfo | null>(null);
  const [authorizations, setAuthorizations] = useState<AuthorizationEntry[]>([]);
  const [decryptedData, setDecryptedData] = useState<DivinerPrivateData | null>(null);
  const [showDecrypted, setShowDecrypted] = useState(false);

  // 添加授权表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [granteeAddress, setGranteeAddress] = useState('');
  const [granteeRole, setGranteeRole] = useState<AccessRole>(AccessRole.Master);
  const [granteeScope, setGranteeScope] = useState<AccessScope>(AccessScope.ReadOnly);
  const [granteeExpires, setGranteeExpires] = useState<dayjs.Dayjs | null>(null);

  /**
   * 加载隐私数据
   */
  const loadPrivacyData = useCallback(async () => {
    if (!hexagramId) return;

    setLoading(true);
    try {
      // 查询加密记录
      const encryptedRecord = await getEncryptedRecord(hexagramId);
      setRecord(encryptedRecord);

      // 查询授权列表
      if (encryptedRecord) {
        const auths = await getRecordAuthorizations(hexagramId);
        setAuthorizations(auths);
      }
    } catch (error) {
      console.error('加载隐私数据失败:', error);
      message.error('加载隐私数据失败');
    } finally {
      setLoading(false);
    }
  }, [hexagramId]);

  /**
   * 加载本地私钥
   */
  const loadLocalSecretKey = (): Uint8Array | null => {
    const storedKeyHex = localStorage.getItem(KEY_STORAGE_PREFIX + 'default');
    if (storedKeyHex) {
      try {
        return hexToBytes(storedKeyHex);
      } catch {
        return null;
      }
    }
    return null;
  };

  /**
   * 解密隐私数据
   */
  const handleDecrypt = useCallback(async () => {
    if (!record || !isOwner) {
      message.warning('只有所有者才能解密数据');
      return;
    }

    const secretKey = loadLocalSecretKey();
    if (!secretKey) {
      message.error('未找到本地私钥，无法解密');
      return;
    }

    try {
      const data = decryptRecordData(record, record.ownerEncryptedKey, secretKey);
      setDecryptedData(data);
      setShowDecrypted(true);
      message.success('解密成功');
    } catch (error) {
      console.error('解密失败:', error);
      message.error('解密失败，请确认私钥正确');
    }
  }, [record, isOwner]);

  /**
   * 添加授权
   */
  const handleGrantAccess = useCallback(async () => {
    if (!record || !granteeAddress.trim()) {
      message.warning('请输入被授权者地址');
      return;
    }

    setSubmitting(true);
    try {
      // 查询被授权者的公钥
      const granteeKeyInfo = await getUserEncryptionKey(granteeAddress);
      if (!granteeKeyInfo) {
        message.error('被授权者尚未注册加密公钥，请先让对方注册');
        return;
      }

      // 加载所有者私钥
      const ownerSecretKey = loadLocalSecretKey();
      if (!ownerSecretKey) {
        message.error('未找到本地私钥，无法授权');
        return;
      }

      // 重新封装 DataKey 给被授权者
      const encryptedKeyForGrantee = prepareKeyForGrantee(
        record,
        ownerSecretKey,
        granteeKeyInfo.publicKey
      );

      // 计算过期时间
      const expiresAt = granteeExpires
        ? Math.floor(granteeExpires.valueOf() / 1000)
        : undefined;

      // 提交授权
      await grantAccess(
        hexagramId,
        granteeAddress,
        encryptedKeyForGrantee,
        granteeRole,
        granteeScope,
        expiresAt
      );

      message.success('授权成功');
      setShowAddForm(false);
      setGranteeAddress('');
      setGranteeExpires(null);

      // 刷新授权列表
      await loadPrivacyData();
    } catch (error) {
      console.error('授权失败:', error);
      message.error(`授权失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [
    record,
    hexagramId,
    granteeAddress,
    granteeRole,
    granteeScope,
    granteeExpires,
    loadPrivacyData,
  ]);

  /**
   * 撤销授权
   */
  const handleRevokeAccess = useCallback(
    async (grantee: string) => {
      setSubmitting(true);
      try {
        await revokeAccess(hexagramId, grantee);
        message.success('已撤销授权');
        await loadPrivacyData();
      } catch (error) {
        console.error('撤销授权失败:', error);
        message.error(`撤销授权失败: ${(error as Error).message}`);
      } finally {
        setSubmitting(false);
      }
    },
    [hexagramId, loadPrivacyData]
  );

  // 弹窗打开时加载数据
  useEffect(() => {
    if (visible) {
      loadPrivacyData();
    }
  }, [visible, loadPrivacyData]);

  /**
   * 渲染隐私状态卡片
   */
  const renderPrivacyStatus = () => {
    if (!record) {
      return (
        <Alert
          message="无隐私数据"
          description="此卦象没有关联的加密隐私数据"
          type="info"
          showIcon
        />
      );
    }

    const modeConfig = PRIVACY_MODE_CONFIG[record.privacyMode];

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Text strong>隐私模式:</Text>
            <Tag color={modeConfig.color} icon={modeConfig.icon}>
              {modeConfig.label}
            </Tag>
            <Text type="secondary">{modeConfig.desc}</Text>
          </Space>

          <Space>
            <Text strong>创建时间:</Text>
            <Text>
              {record.createdAt
                ? dayjs(record.createdAt * 1000).format('YYYY-MM-DD HH:mm')
                : '未知'}
            </Text>
          </Space>

          <Space>
            <Text strong>所有者:</Text>
            <Text copyable={{ text: record.owner }}>
              {record.owner.slice(0, 8)}...{record.owner.slice(-6)}
            </Text>
          </Space>

          {isOwner && (
            <Button
              type="primary"
              icon={showDecrypted ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => {
                if (showDecrypted) {
                  setShowDecrypted(false);
                } else {
                  handleDecrypt();
                }
              }}
            >
              {showDecrypted ? '隐藏隐私数据' : '解密查看隐私数据'}
            </Button>
          )}
        </Space>
      </Card>
    );
  };

  /**
   * 渲染解密后的隐私数据
   */
  const renderDecryptedData = () => {
    if (!showDecrypted || !decryptedData) return null;

    return (
      <Card
        size="small"
        title={
          <Space>
            <LockOutlined />
            <span>隐私数据（已解密）</span>
          </Space>
        }
        style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>姓名:</Text> <Text>{decryptedData.name || '未设置'}</Text>
          </div>
          {decryptedData.birthDate && (
            <div>
              <Text strong>出生日期:</Text> <Text>{decryptedData.birthDate}</Text>
            </div>
          )}
          {decryptedData.birthHour !== undefined && (
            <div>
              <Text strong>出生时辰:</Text> <Text>{decryptedData.birthHour}时</Text>
            </div>
          )}
          {decryptedData.notes && (
            <div>
              <Text strong>备注:</Text> <Text>{decryptedData.notes}</Text>
            </div>
          )}
        </Space>
      </Card>
    );
  };

  /**
   * 渲染授权列表
   */
  const renderAuthorizationList = () => {
    if (authorizations.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无授权记录"
          style={{ padding: '20px 0' }}
        />
      );
    }

    return (
      <List
        size="small"
        dataSource={authorizations}
        renderItem={(auth) => {
          const roleConfig = ACCESS_ROLE_CONFIG[auth.role];
          const scopeConfig = ACCESS_SCOPE_CONFIG[auth.scope];
          const isExpired = auth.expiresAt && auth.expiresAt * 1000 < Date.now();

          return (
            <List.Item
              actions={
                isOwner
                  ? [
                      <Popconfirm
                        key="revoke"
                        title="确定撤销此授权？"
                        description="撤销后对方将无法访问隐私数据"
                        onConfirm={() => handleRevokeAccess(auth.grantee)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          loading={submitting}
                        >
                          撤销
                        </Button>
                      </Popconfirm>,
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                avatar={
                  <Tag color={auth.isActive && !isExpired ? 'green' : 'default'}>
                    {auth.isActive && !isExpired ? (
                      <CheckCircleOutlined />
                    ) : (
                      <CloseCircleOutlined />
                    )}
                  </Tag>
                }
                title={
                  <Space>
                    <Text copyable={{ text: auth.grantee }}>
                      {auth.grantee.slice(0, 8)}...{auth.grantee.slice(-6)}
                    </Text>
                    <Tag color={roleConfig.color}>{roleConfig.label}</Tag>
                    <Tag color={scopeConfig.color}>{scopeConfig.label}</Tag>
                  </Space>
                }
                description={
                  <Space size="small">
                    <ClockCircleOutlined />
                    <Text type="secondary">
                      授权时间:{' '}
                      {dayjs(auth.grantedAt * 1000).format('YYYY-MM-DD HH:mm')}
                    </Text>
                    {auth.expiresAt && (
                      <Text type={isExpired ? 'danger' : 'secondary'}>
                        {isExpired ? '已过期' : `过期: ${dayjs(auth.expiresAt * 1000).format('YYYY-MM-DD')}`}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    );
  };

  /**
   * 渲染添加授权表单
   */
  const renderAddAuthorizationForm = () => {
    if (!showAddForm) return null;

    return (
      <Card
        size="small"
        title={
          <Space>
            <UserAddOutlined />
            <span>添加授权</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Form layout="vertical" size="small">
          <Form.Item label="被授权者地址" required>
            <Input
              value={granteeAddress}
              onChange={(e) => setGranteeAddress(e.target.value)}
              placeholder="输入 Substrate 账户地址"
            />
          </Form.Item>

          <Form.Item label="访问角色">
            <Select
              value={granteeRole}
              onChange={setGranteeRole}
              options={[
                { value: AccessRole.Master, label: '大师' },
                { value: AccessRole.FamilyMember, label: '家族成员' },
                { value: AccessRole.BountyAnswerer, label: '悬赏回答者' },
              ]}
            />
          </Form.Item>

          <Form.Item label="访问范围">
            <Select
              value={granteeScope}
              onChange={setGranteeScope}
              options={[
                { value: AccessScope.ReadOnly, label: '只读' },
                { value: AccessScope.FullAccess, label: '完全访问' },
              ]}
            />
          </Form.Item>

          <Form.Item label="过期时间（可选）">
            <DatePicker
              value={granteeExpires}
              onChange={setGranteeExpires}
              placeholder="不设置则永久有效"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().endOf('day')}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                onClick={handleGrantAccess}
                loading={submitting}
                icon={<KeyOutlined />}
              >
                授权
              </Button>
              <Button onClick={() => setShowAddForm(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined style={{ color: '#B2955D' }} />
          <span>隐私数据管理</span>
          <Tag>卦象 #{hexagramId}</Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {/* 隐私状态 */}
        {renderPrivacyStatus()}

        {/* 解密后的数据 */}
        {renderDecryptedData()}

        {/* 授权管理 */}
        {record && record.privacyMode !== PrivacyMode.Public && (
          <>
            <Divider orientation="left">
              <Space>
                <TeamOutlined />
                <span>授权管理</span>
                <Tag>{authorizations.length} 人</Tag>
              </Space>
            </Divider>

            {/* 添加授权按钮 */}
            {isOwner && !showAddForm && (
              <Button
                type="dashed"
                block
                icon={<UserAddOutlined />}
                onClick={() => setShowAddForm(true)}
                style={{ marginBottom: 16 }}
              >
                添加授权
              </Button>
            )}

            {/* 添加授权表单 */}
            {renderAddAuthorizationForm()}

            {/* 授权列表 */}
            {renderAuthorizationList()}
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default PrivacyAuthorizationManager;
