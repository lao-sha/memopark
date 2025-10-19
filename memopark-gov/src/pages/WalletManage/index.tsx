/**
 * 钱包管理页面
 * 函数级中文注释：本地钱包管理，不使用浏览器扩展
 * - 创建钱包
 * - 导入钱包
 * - 管理账户
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  List,
  Modal,
  Form,
  Input,
  Space,
  message,
  Alert,
  Typography,
  Tag,
  Divider,
  Upload,
} from 'antd';
import {
  WalletOutlined,
  PlusOutlined,
  ImportOutlined,
  DeleteOutlined,
  ExportOutlined,
  CopyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useApi } from '@/contexts/ApiContext';
import { useWalletStore, loadLocalAccounts, switchAccount, queryBalance } from '@/hooks/useWallet';
import {
  generateLocalWallet,
  encryptWithPassword,
  upsertKeystore,
  removeKeystore,
  deriveAddressFromMnemonic,
  exportKeystoreJson,
  importKeystoreJson,
  getCurrentAddress,
  type LocalKeystore,
} from '@/lib/keystore';

const { Title, Text, Paragraph } = Typography;

/**
 * 函数级中文注释：钱包管理页面组件
 */
const WalletManage: React.FC = () => {
  const { api } = useApi();
  const { accounts, currentAccount, setAccounts, setCurrentAccount, setBalance } = useWalletStore();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [mnemonicModalVisible, setMnemonicModalVisible] = useState(false);

  const [createForm] = Form.useForm();
  const [importForm] = Form.useForm();

  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [generatedAddress, setGeneratedAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  /**
   * 函数级中文注释：加载账户列表
   */
  const loadAccounts = () => {
    const accs = loadLocalAccounts();
    setAccounts(accs);

    const currentAddr = getCurrentAddress();
    const current = accs.find((acc) => acc.address === currentAddr);
    setCurrentAccount(current || null);
  };

  /**
   * 函数级中文注释：生成新钱包
   */
  const handleGenerateWallet = async () => {
    try {
      const { mnemonic, address } = await generateLocalWallet();
      setGeneratedMnemonic(mnemonic);
      setGeneratedAddress(address);
      setMnemonicModalVisible(true);
    } catch (err: any) {
      message.error(`生成钱包失败: ${err.message}`);
    }
  };

  /**
   * 函数级中文注释：保存钱包
   */
  const handleSaveWallet = async (values: { name: string; password: string }) => {
    if (!generatedMnemonic) {
      message.error('请先生成钱包');
      return;
    }

    setCreating(true);
    try {
      // 加密助记词
      const encrypted = await encryptWithPassword(values.password, generatedMnemonic);

      // 保存 keystore
      const keystore: LocalKeystore = {
        address: generatedAddress,
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        iv: encrypted.iv,
        createdAt: Date.now(),
        name: values.name,
      };

      upsertKeystore(keystore);

      message.success('钱包创建成功！');
      setCreateModalVisible(false);
      setMnemonicModalVisible(false);
      createForm.resetFields();
      setGeneratedMnemonic('');
      setGeneratedAddress('');

      loadAccounts();
    } catch (err: any) {
      message.error(`保存钱包失败: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  /**
   * 函数级中文注释：导入钱包
   */
  const handleImportWallet = async (values: { mnemonic: string; name: string; password: string }) => {
    setImporting(true);
    try {
      // 验证助记词
      const address = await deriveAddressFromMnemonic(values.mnemonic);

      // 加密助记词
      const encrypted = await encryptWithPassword(values.password, values.mnemonic);

      // 保存 keystore
      const keystore: LocalKeystore = {
        address,
        ciphertext: encrypted.ciphertext,
        salt: encrypted.salt,
        iv: encrypted.iv,
        createdAt: Date.now(),
        name: values.name,
      };

      upsertKeystore(keystore);

      message.success('钱包导入成功！');
      setImportModalVisible(false);
      importForm.resetFields();

      loadAccounts();
    } catch (err: any) {
      message.error(`导入钱包失败: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  /**
   * 函数级中文注释：切换账户
   */
  const handleSwitchAccount = async (account: LocalKeystore) => {
    switchAccount(account.address);
    setCurrentAccount(account);

    // 查询余额
    if (api) {
      try {
        const bal = await queryBalance(api, account.address);
        setBalance(bal);
      } catch (err) {
        console.error('查询余额失败:', err);
      }
    }
  };

  /**
   * 函数级中文注释：删除账户
   */
  const handleDeleteAccount = (address: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此账户吗？此操作不可恢复！',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        removeKeystore(address);
        message.success('账户已删除');
        loadAccounts();
      },
    });
  };

  /**
   * 函数级中文注释：导出账户
   */
  const handleExportAccount = (address: string) => {
    const success = exportKeystoreJson(address);
    if (success) {
      message.success('导出成功');
    } else {
      message.error('导出失败');
    }
  };

  /**
   * 函数级中文注释：复制地址
   */
  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    message.success('地址已复制');
  };

  /**
   * 函数级中文注释：导入 JSON 文件
   */
  const handleImportJson = async (file: File) => {
    const success = await importKeystoreJson(file);
    if (success) {
      message.success('导入成功');
      loadAccounts();
    } else {
      message.error('导入失败，文件格式不正确');
    }
    return false; // 阻止自动上传
  };

  // 初始化
  useEffect(() => {
    loadAccounts();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={3}>
          <WalletOutlined /> 钱包管理
        </Title>

        <Alert
          message="本地钱包管理"
          description="钱包密钥存储在本地浏览器中，不依赖浏览器扩展。请务必备份助记词和 Keystore 文件！"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Space style={{ marginBottom: 24 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建钱包
          </Button>
          <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
            导入钱包
          </Button>
          <Upload beforeUpload={handleImportJson} showUploadList={false} accept=".json">
            <Button icon={<ImportOutlined />}>导入 JSON</Button>
          </Upload>
        </Space>

        <Divider />

        <Title level={4}>账户列表 ({accounts.length})</Title>

        {accounts.length === 0 ? (
          <Alert message="暂无账户" description="请创建或导入钱包" type="warning" showIcon />
        ) : (
          <List
            dataSource={accounts}
            renderItem={(account) => (
              <List.Item
                key={account.address}
                actions={[
                  currentAccount?.address === account.address ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      当前账户
                    </Tag>
                  ) : (
                    <Button size="small" onClick={() => handleSwitchAccount(account)}>
                      切换
                    </Button>
                  ),
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopyAddress(account.address)}>
                    复制
                  </Button>,
                  <Button size="small" icon={<ExportOutlined />} onClick={() => handleExportAccount(account.address)}>
                    导出
                  </Button>,
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAccount(account.address)}>
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{account.name || '未命名'}</Text>
                      {currentAccount?.address === account.address && <Tag color="green">当前</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <Text copyable>{account.address}</Text>
                      <div style={{ marginTop: 8, color: '#888' }}>
                        创建时间：{new Date(account.createdAt).toLocaleString()}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 创建钱包对话框 */}
      <Modal
        title="创建钱包"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Button type="primary" block size="large" onClick={handleGenerateWallet}>
          生成新钱包
        </Button>
      </Modal>

      {/* 显示助记词对话框 */}
      <Modal
        title="保存助记词"
        open={mnemonicModalVisible}
        onCancel={() => {
          setMnemonicModalVisible(false);
          setGeneratedMnemonic('');
          setGeneratedAddress('');
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="⚠️ 重要提示"
          description="请务必备份以下助记词，并妥善保管！助记词是恢复钱包的唯一凭证，一旦丢失将无法恢复！"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Card style={{ marginBottom: 16, backgroundColor: '#f5f5f5' }}>
          <Paragraph copyable style={{ fontSize: 16, fontWeight: 'bold', margin: 0 }}>
            {generatedMnemonic}
          </Paragraph>
        </Card>

        <Alert message={`地址：${generatedAddress}`} type="info" showIcon style={{ marginBottom: 16 }} />

        <Form form={createForm} layout="vertical" onFinish={handleSaveWallet}>
          <Form.Item
            label="账户名称"
            name="name"
            rules={[{ required: true, message: '请输入账户名称' }]}
          >
            <Input placeholder="例如：主账户" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8位' },
            ]}
          >
            <Input.Password placeholder="用于加密助记词" />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={creating}>
              我已备份，创建钱包
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入钱包对话框 */}
      <Modal
        title="导入钱包"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          importForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={importForm} layout="vertical" onFinish={handleImportWallet}>
          <Form.Item
            label="助记词"
            name="mnemonic"
            rules={[{ required: true, message: '请输入助记词' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入12个单词的助记词，用空格分隔" />
          </Form.Item>

          <Form.Item
            label="账户名称"
            name="name"
            rules={[{ required: true, message: '请输入账户名称' }]}
          >
            <Input placeholder="例如：导入账户" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8位' },
            ]}
          >
            <Input.Password placeholder="用于加密助记词" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={importing}>
              导入钱包
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WalletManage;

