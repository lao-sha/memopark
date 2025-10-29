/**
 * 查看加密证据组件（委员会专用）
 * 
 * 功能：委员会成员解密并查看买家提交的聊天记录证据
 * 
 * @module ViewEncryptedEvidence
 * @author Memopark Team
 * @date 2025-10-23
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, List, message, Spin, Typography, Alert, Space, Tag, Card, Descriptions, Timeline } from 'antd';
import { 
  UnlockOutlined, 
  LockOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  MessageOutlined 
} from '@ant-design/icons';
import { useApi } from '@/contexts/Api';
import { useWallet } from '@/contexts/Wallet';
import { MultiRecipientEncryption, type MultiRecipientEncryptedData } from '@/utils/multiRecipientEncryption';
import { fetchFromIPFS } from '@/services/ipfs';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;

/**
 * 解密后的证据数据结构
 */
interface DecryptedEvidenceData {
  order_id: number;
  dispute_type: string;
  submitted_by: string;
  submitted_at: number;
  maker_account: string;
  messages: Array<{
    id: number;
    sender: string;
    receiver: string;
    content: string;
    msg_type: string;
    sent_at: number;
    timestamp: string;
  }>;
  metadata: {
    total_messages: number;
    session_id: string;
    time_range: {
      start: number;
      end: number;
    };
  };
}

/**
 * 组件Props
 */
interface ViewEncryptedEvidenceProps {
  /** 证据CID */
  evidenceCid: string;
  
  /** 订单ID */
  orderId: number;
  
  /** 是否显示 */
  visible: boolean;
  
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 查看加密证据组件
 */
export const ViewEncryptedEvidence: React.FC<ViewEncryptedEvidenceProps> = ({
  evidenceCid,
  orderId,
  visible,
  onClose,
}) => {
  const { api } = useApi();
  const { activeAccount } = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [encryptedData, setEncryptedData] = useState<MultiRecipientEncryptedData | null>(null);
  const [decryptedData, setDecryptedData] = useState<DecryptedEvidenceData | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string>('');
  
  /**
   * 加载加密证据
   */
  useEffect(() => {
    if (visible && evidenceCid) {
      loadEncryptedEvidence();
    }
  }, [visible, evidenceCid]);
  
  /**
   * 从IPFS加载加密证据
   */
  const loadEncryptedEvidence = async () => {
    setLoading(true);
    setError('');
    
    try {
      message.loading('正在从IPFS下载证据...', 0);
      
      // 从IPFS下载加密数据
      const data = await fetchFromIPFS(evidenceCid);
      
      message.destroy();
      
      // 验证数据完整性
      const validation = MultiRecipientEncryption.validate(data);
      if (!validation.valid) {
        setError(`证据数据无效: ${validation.errors.join(', ')}`);
        return;
      }
      
      setEncryptedData(data);
      
      // 检查当前用户是否为授权接收方
      if (activeAccount) {
        const authorized = MultiRecipientEncryption.isAuthorized(
          data,
          activeAccount.address
        );
        setIsAuthorized(authorized);
        
        if (!authorized) {
          setError('您无权查看此证据（不在委员会名单中）');
        }
      }
      
    } catch (err: any) {
      console.error('加载证据失败:', err);
      setError(`加载失败: ${err.message}`);
      message.error('从IPFS加载证据失败');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 解密证据
   */
  const handleDecrypt = async () => {
    if (!encryptedData || !activeAccount) {
      message.error('缺少必要信息');
      return;
    }
    
    setDecrypting(true);
    setError('');
    
    try {
      message.loading('正在解密证据...', 0);
      
      // 1. 获取用户私钥（需要用户授权）
      // 注意：实际实现中需要通过钱包插件安全地获取私钥
      const privateKey = await getPrivateKeyFromWallet(activeAccount.address);
      
      // 2. 解密证据
      const decrypted = await MultiRecipientEncryption.decrypt(
        encryptedData,
        activeAccount.address,
        privateKey
      );
      
      message.destroy();
      message.success('解密成功！');
      
      setDecryptedData(decrypted);
      
      // 3. 记录访问日志到链上（可选）
      await logEvidenceAccess(orderId, evidenceCid);
      
    } catch (err: any) {
      console.error('解密失败:', err);
      setError(`解密失败: ${err.message}`);
      message.error('解密失败，请检查您的权限');
      message.destroy();
    } finally {
      setDecrypting(false);
    }
  };
  
  /**
   * 记录访问日志到链上
   */
  const logEvidenceAccess = async (orderId: number, evidenceCid: string) => {
    if (!api || !activeAccount) return;
    
    try {
      // 调用链上接口记录访问（pallet-evidence 或自定义）
      // 这里是示例代码
      console.log(`📝 记录访问日志: 委员 ${activeAccount.address} 查看了订单 ${orderId} 的证据`);
      
      // 实际实现：
      // const tx = api.tx.evidence.logAccess(orderId, evidenceCid, '审核争议');
      // await signAndSend(activeAccount, tx);
      
    } catch (error) {
      console.error('记录访问日志失败:', error);
      // 不影响主流程
    }
  };
  
  /**
   * 渲染加密信息卡片
   */
  const renderEncryptedInfo = () => {
    if (!encryptedData) return null;
    
    const recipients = MultiRecipientEncryption.getRecipients(encryptedData);
    
    return (
      <Card title="加密信息" size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="加密版本">
            {encryptedData.version}
          </Descriptions.Item>
          <Descriptions.Item label="加密方法">
            混合加密（AES-256 + X25519）
          </Descriptions.Item>
          <Descriptions.Item label="授权接收方">
            {recipients.length} 位委员会成员
          </Descriptions.Item>
          <Descriptions.Item label="原始大小">
            {(encryptedData.metadata.original_size / 1024).toFixed(2)} KB
          </Descriptions.Item>
          <Descriptions.Item label="加密时间">
            {moment.unix(encryptedData.metadata.encrypted_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="提交者">
            <Text code copyable>
              {encryptedData.metadata.encryptor}
            </Text>
          </Descriptions.Item>
          {encryptedData.metadata.description && (
            <Descriptions.Item label="描述">
              {encryptedData.metadata.description}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    );
  };
  
  /**
   * 渲染解密后的证据内容
   */
  const renderDecryptedContent = () => {
    if (!decryptedData) return null;
    
    const { messages, metadata, submitted_by, submitted_at, maker_account } = decryptedData;
    
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 证据概要 */}
        <Card title="证据概要" size="small">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="订单ID">
              {decryptedData.order_id}
            </Descriptions.Item>
            <Descriptions.Item label="证据类型">
              <Tag color="blue">聊天记录</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="提交者">
              <Text code copyable>{submitted_by}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="做市商">
              <Text code copyable>{maker_account}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="提交时间">
              {moment.unix(submitted_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="消息数量">
              {metadata.total_messages} 条
            </Descriptions.Item>
            <Descriptions.Item label="时间范围">
              {moment(metadata.time_range.start * 6000).format('MM-DD HH:mm')} ~ {' '}
              {moment(metadata.time_range.end * 6000).format('MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
        
        {/* 聊天记录时间线 */}
        <Card 
          title={
            <Space>
              <MessageOutlined />
              <span>聊天记录详情（{messages.length}条）</span>
            </Space>
          }
          size="small"
        >
          <Timeline
            mode="left"
            items={messages.map((msg, index) => {
              const isBuyer = msg.sender === submitted_by;
              
              return {
                key: msg.id,
                color: isBuyer ? 'blue' : 'green',
                label: (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {msg.timestamp}
                  </Text>
                ),
                dot: (
                  <UserOutlined 
                    style={{ 
                      fontSize: 16, 
                      color: isBuyer ? '#1890ff' : '#52c41a' 
                    }} 
                  />
                ),
                children: (
                  <Card 
                    size="small" 
                    style={{ 
                      marginBottom: 8,
                      backgroundColor: isBuyer ? '#e6f7ff' : '#f6ffed',
                    }}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space>
                        <Tag color={isBuyer ? 'blue' : 'green'}>
                          {isBuyer ? '买家' : '做市商'}
                        </Tag>
                        <Tag>{msg.msg_type}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          #{msg.id}
                        </Text>
                      </Space>
                      <Paragraph 
                        style={{ 
                          margin: 0, 
                          fontSize: 14,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {msg.content}
                      </Paragraph>
                    </Space>
                  </Card>
                ),
              };
            })}
          />
        </Card>
        
        {/* 裁决建议区域 */}
        <Alert
          message="审核提示"
          description={
            <Space direction="vertical">
              <Text>• 请仔细阅读聊天记录，判断争议的真实情况</Text>
              <Text>• 重点关注做市商的服务态度和履约情况</Text>
              <Text>• 综合考虑双方陈述，做出公正裁决</Text>
            </Space>
          }
          type="info"
          showIcon
        />
      </Space>
    );
  };
  
  return (
    <Modal
      title={
        <Space>
          {decryptedData ? <UnlockOutlined /> : <LockOutlined />}
          <span>查看加密证据 - 订单 #{orderId}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={
        decryptedData ? [
          <Button key="close" onClick={onClose}>
            关闭
          </Button>,
        ] : [
          <Button key="cancel" onClick={onClose}>
            取消
          </Button>,
          <Button
            key="decrypt"
            type="primary"
            icon={<UnlockOutlined />}
            loading={decrypting}
            disabled={!isAuthorized || !!error}
            onClick={handleDecrypt}
          >
            解密并查看
          </Button>,
        ]
      }
      style={{ top: 20 }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" tip="正在加载证据..." />
        </div>
      ) : error ? (
        <Alert
          message="无法查看证据"
          description={error}
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
        />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {!decryptedData && (
            <>
              <Alert
                message="证据已加密"
                description={
                  <Space direction="vertical">
                    <Text>
                      此证据使用<strong>混合加密（AES-256 + X25519）</strong>进行保护
                    </Text>
                    <Text>
                      只有<strong>委员会成员</strong>可以解密查看
                    </Text>
                    {isAuthorized ? (
                      <Text type="success">
                        ✅ 您已授权，可以解密此证据
                      </Text>
                    ) : (
                      <Text type="danger">
                        ❌ 您不在授权名单中，无法解密
                      </Text>
                    )}
                  </Space>
                }
                type={isAuthorized ? 'info' : 'warning'}
                showIcon
                icon={<LockOutlined />}
              />
              
              {renderEncryptedInfo()}
            </>
          )}
          
          {decryptedData && renderDecryptedContent()}
        </Space>
      )}
    </Modal>
  );
};

/**
 * 从钱包获取私钥（需要用户授权）
 * 
 * 注意：这是简化示例，实际实现需要安全地处理私钥
 */
async function getPrivateKeyFromWallet(
  address: string
): Promise<Uint8Array> {
  // 实际实现中应该：
  // 1. 通过钱包插件安全地请求签名权限
  // 2. 使用临时会话密钥
  // 3. 不直接暴露私钥
  
  // 这里返回模拟数据
  // 实际应该从 Polkadot.js 钱包派生
  
  try {
    // 方式1：通过账户地址派生（仅用于演示）
    const { decodeAddress } = await import('@polkadot/util-crypto');
    return decodeAddress(address);
    
    // 方式2：实际应该使用钱包API获取解密密钥
    // const { keyring } = await import('@polkadot/ui-keyring');
    // const pair = keyring.getPair(address);
    // return pair.secretKey;
    
  } catch (error) {
    throw new Error('无法获取私钥，请确保钱包已解锁');
  }
}

