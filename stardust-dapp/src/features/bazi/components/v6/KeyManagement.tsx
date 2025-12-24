/**
 * V6 密钥管理组件
 *
 * 提供 X25519 密钥对的生成、注册和管理功能：
 * - 生成新的 X25519 密钥对
 * - 将公钥注册到链上
 * - 查看已注册的公钥状态
 * - 安全存储私钥（支持密码加密）
 * - 导出/备份私钥
 *
 * @module features/bazi/components/v6/KeyManagement
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Input,
  Modal,
  message,
  Tag,
  Tooltip,
  Spin,
  Alert,
  Divider,
  Form,
} from 'antd';
import {
  KeyOutlined,
  SafetyOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useWalletStore } from '../../../../store/walletStore';
import { getApi } from '../../../../lib/polkadot';
import {
  generateX25519KeyPair,
  savePrivateKey,
  loadPrivateKey,
  hasStoredKey,
  deletePrivateKey,
  bytesToHex,
} from '../../../../services/multiKeyEncryption';
import {
  registerEncryptionKey,
  getUserEncryptionKey,
} from '../../../../services/baziChainService';

const { Text, Paragraph } = Typography;

/**
 * 组件属性
 */
interface KeyManagementProps {
  /** 紧凑模式（隐藏部分信息） */
  compact?: boolean;
  /** 密钥注册成功回调 */
  onKeyRegistered?: (publicKey: string) => void;
}

/**
 * 密钥状态
 */
interface KeyStatus {
  /** 是否有本地私钥 */
  hasLocalKey: boolean;
  /** 链上公钥（如果已注册） */
  chainPublicKey: string | null;
  /** 本地公钥（从私钥派生） */
  localPublicKey: string | null;
  /** 是否匹配 */
  isMatched: boolean;
}

/**
 * V6 密钥管理组件
 *
 * 用于管理用户的 X25519 加密密钥对，支持：
 * - 密钥生成
 * - 链上注册
 * - 本地安全存储
 * - 密钥状态查看
 */
export const KeyManagement: React.FC<KeyManagementProps> = ({
  compact = false,
  onKeyRegistered,
}) => {
  // 钱包状态
  const { selectedAccount, isConnected } = useWalletStore();

  // 组件状态
  const [loading, setLoading] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    hasLocalKey: false,
    chainPublicKey: null,
    localPublicKey: null,
    isMatched: false,
  });
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [currentPrivateKey, setCurrentPrivateKey] = useState<string | null>(null);

  // 模态框状态
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newKeyPair, setNewKeyPair] = useState<{ publicKey: string; privateKey: string } | null>(null);

  // 表单
  const [form] = Form.useForm();

  /**
   * 检查密钥状态
   */
  const checkKeyStatus = useCallback(async () => {
    if (!selectedAccount?.address) return;

    setLoading(true);
    try {
      const api = await getApi();
      const address = selectedAccount.address;

      // 检查本地是否有私钥
      const hasLocal = hasStoredKey(address);

      // 查询链上公钥
      const chainKey = await getUserEncryptionKey(api, address);

      // 如果有本地私钥，尝试加载并派生公钥
      let localPubKey: string | null = null;
      if (hasLocal) {
        // 尝试无密码加载（开发模式）
        const privateKey = loadPrivateKey(address);
        if (privateKey) {
          // 简化：直接使用存储的公钥（实际应该从私钥派生）
          // 这里我们假设公钥和私钥是一起存储的
          setCurrentPrivateKey(privateKey);
        }
      }

      setKeyStatus({
        hasLocalKey: hasLocal,
        chainPublicKey: chainKey,
        localPublicKey: localPubKey,
        isMatched: chainKey !== null && hasLocal,
      });
    } catch (error) {
      console.error('检查密钥状态失败:', error);
      message.error('检查密钥状态失败');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount?.address]);

  // 初始化时检查密钥状态
  useEffect(() => {
    if (isConnected && selectedAccount?.address) {
      checkKeyStatus();
    }
  }, [isConnected, selectedAccount?.address, checkKeyStatus]);

  /**
   * 生成新密钥对
   */
  const handleGenerateKey = async () => {
    setLoading(true);
    try {
      const keyPair = await generateX25519KeyPair();
      setNewKeyPair(keyPair);
      setGenerateModalVisible(false);
      setPasswordModalVisible(true);
      message.success('密钥对生成成功');
    } catch (error) {
      console.error('生成密钥对失败:', error);
      message.error('生成密钥对失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 保存密钥并注册到链上
   */
  const handleSaveAndRegister = async (values: { password: string; confirmPassword: string }) => {
    if (!selectedAccount?.address || !newKeyPair) return;

    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const api = await getApi();
      const address = selectedAccount.address;

      // 1. 保存私钥到本地（使用密码加密）
      savePrivateKey(address, newKeyPair.privateKey, values.password || undefined);

      // 2. 注册公钥到链上
      const tx = registerEncryptionKey(api, newKeyPair.publicKey);

      // 签名并发送交易
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

      message.success('密钥已保存并注册到链上');
      setPasswordModalVisible(false);
      setNewKeyPair(null);
      form.resetFields();

      // 刷新状态
      await checkKeyStatus();

      // 回调
      onKeyRegistered?.(newKeyPair.publicKey);
    } catch (error: any) {
      console.error('保存并注册密钥失败:', error);
      message.error(`操作失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 复制公钥到剪贴板
   */
  const handleCopyPublicKey = () => {
    if (keyStatus.chainPublicKey) {
      navigator.clipboard.writeText(keyStatus.chainPublicKey);
      message.success('公钥已复制到剪贴板');
    }
  };

  /**
   * 显示/隐藏私钥
   */
  const handleTogglePrivateKey = () => {
    if (!privateKeyVisible && !currentPrivateKey) {
      // 需要输入密码
      Modal.confirm({
        title: '查看私钥',
        content: (
          <Input.Password
            placeholder="请输入密码（如果设置了密码）"
            onChange={(e) => setCurrentPrivateKey(e.target.value)}
          />
        ),
        onOk: () => {
          const privateKey = loadPrivateKey(selectedAccount!.address, currentPrivateKey || undefined);
          if (privateKey) {
            setCurrentPrivateKey(privateKey);
            setPrivateKeyVisible(true);
          } else {
            message.error('密码错误或私钥不存在');
          }
        },
      });
    } else {
      setPrivateKeyVisible(!privateKeyVisible);
    }
  };

  /**
   * 导出私钥
   */
  const handleExportPrivateKey = () => {
    if (!currentPrivateKey) {
      message.error('请先解锁私钥');
      return;
    }

    const blob = new Blob([currentPrivateKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stardust-private-key-${selectedAccount?.address?.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('私钥已导出');
  };

  /**
   * 删除本地密钥
   */
  const handleDeleteLocalKey = () => {
    Modal.confirm({
      title: '确认删除',
      content: '删除本地密钥后，您将无法解密已加密的命盘数据。请确保已备份私钥！',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        if (selectedAccount?.address) {
          deletePrivateKey(selectedAccount.address);
          setCurrentPrivateKey(null);
          setPrivateKeyVisible(false);
          checkKeyStatus();
          message.success('本地密钥已删除');
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
          description="连接钱包后才能管理加密密钥"
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
            <KeyOutlined style={{ color: '#B2955D' }} />
            <Text strong>加密密钥</Text>
            {keyStatus.chainPublicKey ? (
              <Tag color="success" icon={<CheckCircleOutlined />}>已注册</Tag>
            ) : (
              <Tag color="warning" icon={<ExclamationCircleOutlined />}>未注册</Tag>
            )}
          </Space>
          {!keyStatus.chainPublicKey && (
            <Button
              type="primary"
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => setGenerateModalVisible(true)}
            >
              生成并注册密钥
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
          <KeyOutlined style={{ color: '#B2955D' }} />
          <span>V6 加密密钥管理</span>
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={checkKeyStatus}
          loading={loading}
        >
          刷新
        </Button>
      }
      loading={loading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 密钥状态 */}
        <div>
          <Text type="secondary">密钥状态</Text>
          <div style={{ marginTop: 8 }}>
            <Space wrap>
              {keyStatus.hasLocalKey ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>本地私钥已存储</Tag>
              ) : (
                <Tag color="default" icon={<ExclamationCircleOutlined />}>无本地私钥</Tag>
              )}
              {keyStatus.chainPublicKey ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>链上公钥已注册</Tag>
              ) : (
                <Tag color="warning" icon={<ExclamationCircleOutlined />}>链上公钥未注册</Tag>
              )}
            </Space>
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        {/* 链上公钥显示 */}
        {keyStatus.chainPublicKey && (
          <div>
            <Text type="secondary">链上公钥</Text>
            <div style={{ marginTop: 8 }}>
              <Input.Group compact>
                <Input
                  value={keyStatus.chainPublicKey}
                  readOnly
                  style={{ width: 'calc(100% - 64px)', fontFamily: 'monospace', fontSize: 12 }}
                />
                <Tooltip title="复制公钥">
                  <Button icon={<CopyOutlined />} onClick={handleCopyPublicKey} />
                </Tooltip>
              </Input.Group>
            </div>
          </div>
        )}

        {/* 私钥管理（如果有本地私钥） */}
        {keyStatus.hasLocalKey && (
          <div>
            <Text type="secondary">本地私钥</Text>
            <div style={{ marginTop: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {privateKeyVisible && currentPrivateKey ? (
                  <Input.TextArea
                    value={currentPrivateKey}
                    readOnly
                    rows={2}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                ) : (
                  <Input
                    value="••••••••••••••••••••••••••••••••"
                    readOnly
                    style={{ fontFamily: 'monospace' }}
                  />
                )}
                <Space wrap>
                  <Button
                    size="small"
                    icon={privateKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={handleTogglePrivateKey}
                  >
                    {privateKeyVisible ? '隐藏' : '显示'}
                  </Button>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={handleExportPrivateKey}
                    disabled={!currentPrivateKey}
                  >
                    导出
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={handleDeleteLocalKey}
                  >
                    删除
                  </Button>
                </Space>
              </Space>
            </div>
          </div>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* 操作按钮 */}
        <Space wrap>
          {!keyStatus.chainPublicKey && (
            <Button
              type="primary"
              icon={<SafetyOutlined />}
              onClick={() => setGenerateModalVisible(true)}
            >
              生成新密钥
            </Button>
          )}
          {keyStatus.hasLocalKey && !keyStatus.chainPublicKey && (
            <Button
              icon={<CloudUploadOutlined />}
              onClick={() => {
                // TODO: 重新注册现有密钥
                message.info('功能开发中');
              }}
            >
              注册现有密钥
            </Button>
          )}
        </Space>

        {/* 安全提示 */}
        <Alert
          type="info"
          message="安全提示"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>私钥是解密命盘数据的唯一凭证，请妥善保管</li>
              <li>建议使用密码加密私钥存储</li>
              <li>定期备份私钥到安全位置</li>
            </ul>
          }
          showIcon
        />
      </Space>

      {/* 生成密钥确认模态框 */}
      <Modal
        title="生成新密钥"
        open={generateModalVisible}
        onOk={handleGenerateKey}
        onCancel={() => setGenerateModalVisible(false)}
        okText="生成"
        cancelText="取消"
        confirmLoading={loading}
      >
        <Alert
          type="warning"
          message="注意"
          description="生成新密钥后，旧密钥将被替换。如果您有使用旧密钥加密的数据，请先备份旧密钥。"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Paragraph>
          即将为您生成新的 X25519 密钥对，用于多方授权加密命盘功能。
        </Paragraph>
      </Modal>

      {/* 设置密码模态框 */}
      <Modal
        title="设置密钥保护密码"
        open={passwordModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setPasswordModalVisible(false);
          setNewKeyPair(null);
          form.resetFields();
        }}
        okText="保存并注册"
        cancelText="取消"
        confirmLoading={loading}
      >
        {newKeyPair && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">您的新公钥：</Text>
            <Input
              value={newKeyPair.publicKey}
              readOnly
              style={{ fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}
            />
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveAndRegister}
        >
          <Form.Item
            name="password"
            label="保护密码（可选）"
            extra="设置密码可以加密保护本地存储的私钥"
          >
            <Input.Password placeholder="输入密码（留空则不加密）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入密码" />
          </Form.Item>
        </Form>
        <Alert
          type="info"
          message="密钥将保存到浏览器本地存储，并注册公钥到链上"
          showIcon
        />
      </Modal>
    </Card>
  );
};

export default KeyManagement;
